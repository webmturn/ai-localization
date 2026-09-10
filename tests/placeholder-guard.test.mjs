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

// 回归：printf 模式的标志字符集里曾含有一个字面空格，
// 导致普通百分数被误判为占位符 —— "Save 50% off" 会在送给模型之前
// 被改写成 "Save 50«0»ff"，并且 validate() 会把正确译文判为无效。
describe("printf 占位符误报回归（普通百分数不应被保护）", () => {
  function extract(text) {
    return PlaceholderGuard.extractAll(text);
  }

  it("普通百分数不被当作占位符", () => {
    expect(extract("Save 50% off")).toEqual([]);
    expect(extract("100% done")).toEqual([]);
    expect(extract("50% of users")).toEqual([]);
    expect(PlaceholderGuard.protect("Save 50% off").hasPlaceholders).toBe(false);
  });

  it("真正的 printf 占位符仍被识别", () => {
    expect(extract("%s")).toContain("%s");
    expect(extract("%d")).toContain("%d");
    expect(extract("%02d")).toContain("%02d");
    expect(extract("%1$s")).toContain("%1$s");
    expect(extract("%-10.2f")).toContain("%-10.2f");
    expect(extract("%@")).toContain("%@");
    expect(extract("%%")).toContain("%%");
  });

  it("紧邻数字的 %d 仍被识别（50%d）", () => {
    expect(extract("50%d")).toContain("%d");
  });

  it("含百分数的正确译文不再被判为占位符缺失", () => {
    const r = PlaceholderGuard.validate("Discount 50% off", "折扣 50% 优惠");
    expect(r.valid).toBe(true);
  });
});

// 回归：ICU 模式原用非贪婪正则 /\{…,[\s\S]*?\}/，遇嵌套分支会停在第一个 "}"，
// 只保护到半截，模型收到的是结构已被破坏的文本。
describe("ICU MessageFormat 嵌套花括号（回归）", () => {
  function protectThenRestore(text) {
    const p = PlaceholderGuard.protect(text);
    return { sent: p.text, restored: PlaceholderGuard.restore(p.text, p.map), map: p.map };
  }

  it("plural 整段被保护，不再只剩前一半", () => {
    const src = "{count, plural, one{# item} other{# items}}";
    const r = protectThenRestore(src);
    expect(r.map).toHaveLength(1);
    expect(r.map[0].original).toBe(src);
    // 送给模型的内容不应残留任何 ICU 结构字符
    expect(r.sent).not.toContain("plural");
    expect(r.sent).not.toContain("other{");
    expect(r.sent).not.toContain("#");
  });

  it("select 整段被保护", () => {
    const src = "{gender, select, male{他} female{她} other{TA}}";
    const r = protectThenRestore(src);
    expect(r.map[0].original).toBe(src);
    expect(r.sent).not.toContain("select");
    expect(r.restored).toBe(src);
  });

  it("=0 精确分支形式被保护", () => {
    const src = "{n, plural, =0{没有} other{# 个}}";
    const r = protectThenRestore(src);
    expect(r.map[0].original).toBe(src);
    expect(r.restored).toBe(src);
  });

  it("ICU 与普通占位符混排时各自独立", () => {
    const src = "Hello {name}, you have {count, plural, one{# msg} other{# msgs}}";
    const r = protectThenRestore(src);
    expect(r.map).toHaveLength(2);
    expect(r.map.map((m) => m.original)).toEqual([
      "{count, plural, one{# msg} other{# msgs}}",
      "{name}",
    ]);
    expect(r.restored).toBe(src);
  });

  it("重复出现的同一 ICU 共用索引且往返正确", () => {
    const src = "{c, plural, one{# a} other{# b}} 和 {c, plural, one{# a} other{# b}}";
    const r = protectThenRestore(src);
    expect(r.map).toHaveLength(1);
    expect(r.restored).toBe(src);
  });

  it("未配平的花括号不触发 ICU 保护（不误伤）", () => {
    const src = "{count, plural, one{# item}";
    const r = protectThenRestore(src);
    expect(r.restored).toBe(src);
  });

  it("普通单花括号不被当作 ICU", () => {
    const p = PlaceholderGuard.protect("{braces}");
    expect(p.map[0].name).not.toBe("icu");
    expect(PlaceholderGuard.restore(p.text, p.map)).toBe("{braces}");
  });

  it("双花括号优先于 ICU 扫描", () => {
    const src = "{{mustache}} and {0} and %s";
    const r = protectThenRestore(src);
    expect(r.restored).toBe(src);
  });

  it("ICU 译文被模型改写后仍能还原原文结构", () => {
    const src = "{count, plural, one{# item} other{# items}}";
    const p = PlaceholderGuard.protect(src);
    // 模拟模型把标记挪位/包在译文中
    const translated = "共 " + p.text + " 个";
    expect(PlaceholderGuard.restore(translated, p.map))
      .toBe("共 " + src + " 个");
  });

  it("多花括号不会吞掉多余括号（{{{a}}}）", () => {
    const p = PlaceholderGuard.protect("{{{a}}}");
    expect(PlaceholderGuard.restore(p.text, p.map)).toBe("{{{a}}}");
  });

  // 已知边界：标记字符 « » 出现在源文本中时，后续模式不会跨过它做匹配。
  // 这是防止「跨过已生成标记」的必要保守行为，往返仍然正确。
  it("源文本本身含标记字符时往返仍正确", () => {
    const src = "值 «x» 与 {name}";
    const p = PlaceholderGuard.protect(src);
    expect(PlaceholderGuard.restore(p.text, p.map)).toBe(src);
  });
});
