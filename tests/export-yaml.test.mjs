/**
 * YAML 导出回归测试（本次修复新增）
 *
 * 修复前：
 *  - 路径未跳过根符号 "$" → 全部内容被错误嵌套在顶层键 "$" 之下
 *  - 对不含 metadata.path 的条目（PO/XLIFF/Android/RESX/iOS/CSV 来源）
 *    静默 dump 出空对象 {}，用户拿到空文件却提示导出成功
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  // yaml.js 末尾有 IIFE 访问 window.jsyaml，加载前必须先备好 window 与替身，
  // 否则脚本抛错（表现为 "Illegal return statement" 之类的加载期失败）。
  globalThis.window = globalThis;
  globalThis.window.App = globalThis.window.App || { services: {} };
  globalThis.window.jsyaml = {
    load: () => ({}),
    dump: (obj) => JSON.stringify(obj),
  };
  loadSource("public/app/parsers/yaml.js");
});

/** 最小 js-yaml 替身：够用于验证结构与键名 */
beforeEach(() => {
  globalThis.window = globalThis;
  globalThis.window.App = globalThis.window.App || { services: {} };
  globalThis.window.jsyaml = {
    load: () => ({}),
    dump: (obj) => JSON.stringify(obj),
  };
});

function item(path, targetText, sourceText = "src") {
  return { sourceText, targetText, status: "translated", metadata: path === undefined ? {} : { path } };
}

describe("YAML 导出：路径以 $ 为根", () => {
  it("$.app.title 输出顶层 app 键，而不是 $ 键", async () => {
    const out = await exportYAML([item("$.app.title", "你好")]);
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed)).toEqual(["app"]);
    expect(parsed.app.title).toBe("你好");
    expect(parsed.$).toBeUndefined();
  });

  it("数组下标路径正确构建数组", async () => {
    const out = await exportYAML([
      item("$.menu[0].label", "打开"),
      item("$.menu[1].label", "保存"),
    ]);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed.menu)).toBe(true);
    expect(parsed.menu[0].label).toBe("打开");
    expect(parsed.menu[1].label).toBe("保存");
  });

  it("深层嵌套路径正确", async () => {
    const out = await exportYAML([item("$.a.b.c", "深")]);
    expect(JSON.parse(out).a.b.c).toBe("深");
  });

  it("多个顶级键各自独立", async () => {
    const out = await exportYAML([
      item("$.app.title", "你好"),
      item("$.menu.label", "菜单"),
    ]);
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed).sort()).toEqual(["app", "menu"]);
  });

  it("不带 $ 根的路径（旧数据）仍可用", async () => {
    const out = await exportYAML([item("app.title", "你好")]);
    expect(JSON.parse(out).app.title).toBe("你好");
  });
});

describe("YAML 导出：根级数组与入参保护（审查补充）", () => {
  it("根级数组路径 $[0]… 输出数组而不是 \"$\" 键", async () => {
    const out = await exportYAML([
      item("$[0]", "v0"),
      item("$[1]", "v1"),
    ]);
    expect(JSON.parse(out)).toEqual(["v0", "v1"]);
  });

  it("根级对象数组 $[0].name 输出 [{name}]", async () => {
    const out = await exportYAML([
      item("$[0].name", "v0"),
      item("$[1].name", "v1"),
    ]);
    expect(JSON.parse(out)).toEqual([{ name: "v0" }, { name: "v1" }]);
  });

  it("对象内数组 $.list[0] 仍输出 {list:[…]}", async () => {
    const out = await exportYAML([item("$.list[0]", "v0"), item("$.list[1]", "v1")]);
    expect(JSON.parse(out)).toEqual({ list: ["v0", "v1"] });
  });

  it("仅根符号 $ 不产生任何键", async () => {
    expect(JSON.parse(await exportYAML([item("$", "x")]))).toEqual({});
  });

  it("null / undefined 按空处理，不抛 TypeError", async () => {
    expect(JSON.parse(await exportYAML(null))).toEqual({});
    expect(JSON.parse(await exportYAML(undefined))).toEqual({});
  });

  it("非数组入参抛出带类型信息的错误（此前是裸 TypeError）", async () => {
    await expect(exportYAML(42)).rejects.toThrow(/数组/);
    await expect(exportYAML("str")).rejects.toThrow(/string/);
    await expect(exportYAML({})).rejects.toThrow(/object/);
  });
});

describe("YAML 导出：无路径条目不静默产出空文件", () => {
  it("全部条目都没有 path 时抛错（此前 dump 出 {}）", async () => {
    const items = [
      { sourceText: "Hello", targetText: "你好", status: "translated", metadata: { key: "k" } },
    ];
    await expect(exportYAML(items)).rejects.toThrow(/metadata\.path/);
  });

  it("错误信息说明可用格式线索", async () => {
    const items = [
      { sourceText: "Hello", targetText: "你好", metadata: { resourceId: "app_name" } },
    ];
    await expect(exportYAML(items)).rejects.toThrow(/1 个条目/);
  });

  it("空数组不抛错（无可导出内容，属正常）", async () => {
    const out = await exportYAML([]);
    expect(JSON.parse(out)).toEqual({});
  });

  it("部分条目有 path 时只导出这些条目", async () => {
    const out = await exportYAML([
      item("$.app.title", "你好"),
      { sourceText: "x", targetText: "y", metadata: { key: "nope" } },
    ]);
    const parsed = JSON.parse(out);
    expect(parsed.app.title).toBe("你好");
    expect(Object.keys(parsed)).toEqual(["app"]);
  });
});
