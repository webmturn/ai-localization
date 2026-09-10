/**
 * 术语库功能测试
 * 覆盖：匹配模式（exact/prefix/contains）、翻译后自动应用术语、幂等保护、特殊字符
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  // terminology.js 将方法挂到 TranslationService.prototype 上，需先定义类
  globalThis.TranslationService = class TranslationService {};
  globalThis.translationService = new globalThis.TranslationService();
  globalThis.AppState = {
    project: { terminologyList: [] },
    translations: { items: [] },
    terminology: { list: [], filtered: [], currentPage: 1, perPage: 10 },
  };
  globalThis.SettingsCache = {
    _s: {},
    get() { return this._s; },
    update(fn) { fn(this._s); },
  };
  // 阶段 1：术语匹配改读 TerminologyStore（运行时唯一数据源）
  loadSource("public/app/core/terminology-store.js");
  loadSource("public/app/services/translation/terminology.js");
});

beforeEach(() => {
  globalThis.SettingsCache._s = {};
  // 每个用例前恢复完整术语列表（避免用例间互相污染）
  // 阶段 1 后运行时唯一数据源为 AppState.terminology.list
  globalThis.AppState.terminology.list = [
    { id: 1, source: "API", target: "应用程序接口" },
    { id: 2, source: "XML", target: "可扩展标记语言" },
    { id: 3, source: "C++", target: "C加加" },
  ];
});

describe("findTerminologyMatches 匹配模式", () => {
  it("默认 contains：包含即命中", () => {
    const m = translationService.findTerminologyMatches("The API endpoint failed");
    expect(m.map(t => t.source)).toContain("API");
  });

  it("exact：仅完全匹配", () => {
    globalThis.SettingsCache._s.termMatchMode = "exact";
    expect(translationService.findTerminologyMatches("The API endpoint")).toEqual([]);
    expect(translationService.findTerminologyMatches("API").length).toBe(1);
  });

  it("prefix：前缀匹配", () => {
    globalThis.SettingsCache._s.termMatchMode = "prefix";
    expect(translationService.findTerminologyMatches("API endpoint is down").map(t => t.source)).toContain("API");
    expect(translationService.findTerminologyMatches("The API")).toEqual([]);
  });

  it("大小写不敏感", () => {
    expect(translationService.findTerminologyMatches("use api for data").length).toBe(1);
  });

  it("空术语库返回空数组", () => {
    globalThis.AppState.terminology.list = [];
    expect(translationService.findTerminologyMatches("anything")).toEqual([]);
    globalThis.AppState.terminology.list = [
      { id: 1, source: "API", target: "应用程序接口" },
    ];
  });
});

describe("applyTerminologyToTranslation 自动应用", () => {
  it("默认开启：替换命中术语", () => {
    expect(translationService.applyTerminologyToTranslation("The API requires XML format"))
      .toBe("The 应用程序接口 requires 可扩展标记语言 format");
  });

  it("忽略大小写替换", () => {
    expect(translationService.applyTerminologyToTranslation("use api service")).toBe("use 应用程序接口 service");
  });

  it("幂等：已是术语 target 时不重复替换", () => {
    expect(translationService.applyTerminologyToTranslation("API 应用程序接口")).toBe("应用程序接口 应用程序接口");
  });

  it("显式关闭 autoApplyTerms 时不应用", () => {
    globalThis.SettingsCache._s.autoApplyTerms = false;
    expect(translationService.applyTerminologyToTranslation("The API requires XML")).toBe("The API requires XML");
  });

  it("特殊字符术语（C++）可正确替换", () => {
    expect(translationService.applyTerminologyToTranslation("I use C++ daily")).toBe("I use C加加 daily");
  });

  it("非字符串/空输入原样返回", () => {
    expect(translationService.applyTerminologyToTranslation(null)).toBeNull();
    expect(translationService.applyTerminologyToTranslation("")).toBe("");
  });
});

// 回归：术语替换曾经是无词边界的子串替换，会把更长单词内部改坏
// （category → 猫egory、node → 否de、width → w标识th），且 autoApplyTerms 默认开启，
// 影响每一条译文。
describe("applyTerminologyToTranslation 词边界（子串误伤回归）", () => {
  beforeEach(() => {
    globalThis.SettingsCache._s = {};
    globalThis.AppState.terminology.list = [];
  });

  function withTerm(source, target, text) {
    globalThis.AppState.terminology.list = [{ id: 1, source, target }];
    return translationService.applyTerminologyToTranslation(text);
  }

  it("短术语不命中更长单词内部（cat vs category）", () => {
    expect(withTerm("cat", "猫", "This category contains a cat."))
      .toBe("This category contains a 猫.");
  });

  it("术语不命中其他单词内部（no vs node）", () => {
    expect(withTerm("no", "否", "Please open the node."))
      .toBe("Please open the node.");
  });

  it("术语不命中代码标识符内部（id vs width）", () => {
    expect(withTerm("id", "标识", "Set the width and height."))
      .toBe("Set the width and height.");
  });

  it("仍能命中独立词（含大小写不敏感）", () => {
    expect(withTerm("cat", "猫", "A Cat and a cat.")).toBe("A 猫 and a 猫.");
  });

  it("紧跟标点的独立词仍能命中", () => {
    expect(withTerm("file", "文件", "Open file, then save."))
      .toBe("Open 文件, then save.");
  });

  it("尾部非词字符的术语（C++）仍能命中", () => {
    expect(withTerm("C++", "C加加", "I use C++ daily"))
      .toBe("I use C加加 daily");
  });

  it("下划线/数字属于词字符，不应把标识符内部当作命中", () => {
    expect(withTerm("id", "标识", "user_id_value")).toBe("user_id_value");
  });

  // CJK 术语：中文/日文不写空格，词间没有可判定边界，因此按子串匹配。
  // 这一点很关键 —— 若对 CJK 也施加边界规则，「打开文件」里的「文件」、
  // 「点击取消按钮」里的「取消」都无法命中，等于让中文术语库整体失效。
  it("中文术语在连续汉字串中命中（CJK 无词边界）", () => {
    expect(withTerm("术语", "term", "这是一个术语库")).toBe("这是一个term库");
    expect(withTerm("文件", "file", "打开文件")).toBe("打开file");
    expect(withTerm("取消", "Cancel", "点击取消按钮")).toBe("点击Cancel按钮");
  });

  it("中文术语被标点隔开时同样命中", () => {
    expect(withTerm("术语", "term", "术语、词条")).toBe("term、词条");
  });

  // 本次修复真正要覆盖的英文场景：拉丁术语嵌在更长单词/标识符里时，
  // 修复前会命中内部子串（"category" 里的 "cat"、"width" 里的 "id"）。
  it("拉丁术语不命中更长单词内部", () => {
    expect(withTerm("cat", "猫", "This category contains a cat."))
      .toBe("This category contains a 猫.");
    expect(withTerm("no", "否", "Please open the node.")).toBe("Please open the node.");
    expect(withTerm("id", "标识", "Set the width.")).toBe("Set the width.");
    expect(withTerm("API", "接口", "MYAPI")).toBe("MYAPI");
  });

  it("拉丁术语嵌在中文语境的长标识符里也不命中", () => {
    expect(withTerm("id", "标识", "用户userid不可见")).toBe("用户userid不可见");
  });

  it("拉丁术语被空格/中文隔开时仍能命中", () => {
    expect(withTerm("id", "标识", "用户 id 不可见")).toBe("用户 标识 不可见");
    expect(withTerm("API", "接口", "The API call")).toBe("The 接口 call");
  });
});
