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
