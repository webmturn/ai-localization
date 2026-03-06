import { describe, it, expect, beforeAll } from "vitest";
import vm from "vm";
import fs from "fs";
import path from "path";

let PlaceholderGuard;

beforeAll(() => {
  const code = fs.readFileSync(
    path.resolve("public/app/services/translation/placeholder-guard.js"),
    "utf-8"
  );
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  PlaceholderGuard = ctx.window.PlaceholderGuard;
});

describe("PlaceholderGuard.protect + restore", () => {
  it("保护双花括号 {{variable}}", () => {
    const r = PlaceholderGuard.protect("Hello {{name}}, welcome!");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.length).toBe(1);
    expect(r.map[0].original).toBe("{{name}}");
    expect(r.text).not.toContain("{{name}}");

    const restored = PlaceholderGuard.restore("你好 " + r.text.match(/\u00ab\d+\u00bb/)[0] + "，欢迎！", r.map);
    expect(restored).toContain("{{name}}");
  });

  it("保护单花括号 {count}", () => {
    const r = PlaceholderGuard.protect("You have {count} items");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "{count}")).toBe(true);
  });

  it("保护 printf 格式 %s %d %02d", () => {
    const r = PlaceholderGuard.protect("File %s has %d lines");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "%s")).toBe(true);
    expect(r.map.some(m => m.original === "%d")).toBe(true);
  });

  it("保护 Android 格式 %1$s %2$d", () => {
    const r = PlaceholderGuard.protect("Hello %1$s, you have %2$d messages");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "%1$s")).toBe(true);
    expect(r.map.some(m => m.original === "%2$d")).toBe(true);
  });

  it("保护 HTML 标签 <b> </b> <br/>", () => {
    const r = PlaceholderGuard.protect("Click <b>here</b> to continue<br/>");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "<b>")).toBe(true);
    expect(r.map.some(m => m.original === "</b>")).toBe(true);
  });

  it("保护 HTML 实体 &amp; &#x20;", () => {
    const r = PlaceholderGuard.protect("Tom &amp; Jerry &#x20; end");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "&amp;")).toBe(true);
  });

  it("保护转义字符 \\n \\t", () => {
    const r = PlaceholderGuard.protect("Line1\\nLine2\\tEnd");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "\\n")).toBe(true);
  });

  it("保护 Python format {0} {name}", () => {
    const r = PlaceholderGuard.protect("Hello {0}, your name is {name}");
    expect(r.hasPlaceholders).toBe(true);
    expect(r.map.some(m => m.original === "{0}")).toBe(true);
    expect(r.map.some(m => m.original === "{name}")).toBe(true);
  });

  it("无占位符文本原样返回", () => {
    const r = PlaceholderGuard.protect("Hello world");
    expect(r.hasPlaceholders).toBe(false);
    expect(r.text).toBe("Hello world");
    expect(r.map.length).toBe(0);
  });

  it("restore 恢复所有标记", () => {
    const src = "Hello {{user}}, you have %d new {{type}} messages";
    const r = PlaceholderGuard.protect(src);
    // Simulate translation: just prefix each word
    const translated = r.text.replace("Hello", "你好").replace("you have", "你有").replace("new", "新").replace("messages", "消息");
    const restored = PlaceholderGuard.restore(translated, r.map);
    expect(restored).toContain("{{user}}");
    expect(restored).toContain("%d");
    expect(restored).toContain("{{type}}");
  });

  it("null/空输入安全", () => {
    expect(PlaceholderGuard.protect(null).text).toBe("");
    expect(PlaceholderGuard.protect("").text).toBe("");
    expect(PlaceholderGuard.restore(null, [])).toBe("");
    expect(PlaceholderGuard.restore("hello", null)).toBe("hello");
  });
});

describe("PlaceholderGuard.validate", () => {
  it("源文和译文占位符一致时返回 valid", () => {
    const r = PlaceholderGuard.validate(
      "Hello {name}, %d items",
      "你好 {name}，%d 个项目"
    );
    expect(r.valid).toBe(true);
    expect(r.missing.length).toBe(0);
  });

  it("译文缺少占位符时报告 missing", () => {
    const r = PlaceholderGuard.validate(
      "Hello {name}, %d items",
      "你好，一些项目"
    );
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("{name}");
    expect(r.missing).toContain("%d");
  });

  it("译文多出占位符时报告 extra", () => {
    const r = PlaceholderGuard.validate(
      "Hello {name}",
      "你好 {name} {extra}"
    );
    expect(r.valid).toBe(false);
    expect(r.extra).toContain("{extra}");
  });
});

describe("PlaceholderGuard.extractAll", () => {
  it("提取所有占位符", () => {
    const all = PlaceholderGuard.extractAll("{{a}} {b} %s <br/> &amp;");
    expect(all.length).toBeGreaterThanOrEqual(5);
    expect(all).toContain("{{a}}");
    expect(all).toContain("%s");
    expect(all).toContain("&amp;");
  });
});
