/**
 * 质量检查规则测试（features/quality/checks.js）
 * 覆盖：占位符 token 多重集比较——风格互换/重命名漏报修复、
 * 顺序无关性、重复占位符、缺失/多出检出
 */
import { describe, it, expect, beforeAll } from "vitest";
import vm from "vm";
import fs from "fs";
import path from "path";

let checkItem;
let extractTokens;

beforeAll(() => {
  const code = fs.readFileSync(
    path.resolve("public/app/features/quality/checks.js"),
    "utf-8"
  );
  const ctx = {
    window: {},
    console,
    // SettingsCache.get() 返回 null → __getQualityCheckOptions 走 catch 默认值
    // （全部检查开启，长度检查关闭）
    SettingsCache: { get: () => null },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  checkItem = ctx.window.App.impl.checkTranslationItemOptimized;
  extractTokens = ctx.window.App.impl.extractPlaceholderTokens;
});

function makeItem(sourceText, targetText) {
  return { id: "t1", sourceText, targetText };
}

function variableIssues(result) {
  return result.issues.filter((i) => i.type === "variable");
}

describe("extractPlaceholderTokens 提取", () => {
  it("{{}} 不被 {} 模式误吞", () => {
    expect(extractTokens("Hello {{name}}")).toEqual(["{{name}}"]);
  });

  it("混合家族按序提取", () => {
    expect(extractTokens("{{a}} {b} %1$s %d")).toEqual([
      "{{a}}",
      "%1$s",
      "{b}",
      "%d",
    ]);
  });

  it("空文本返回空数组", () => {
    expect(extractTokens("")).toEqual([]);
    expect(extractTokens(null)).toEqual([]);
  });
});

describe("占位符检查（修复风格互换漏报）", () => {
  it("风格互换 {{a}} {b} ↔ {a} {{b}} 被检出", async () => {
    const result = await checkItem(makeItem("{{a}} and {b}", "{a} 和 {{b}}"));
    const issues = variableIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("high");
    expect(issues[0].description).toContain("{{a}}");
    expect(issues[0].description).toContain("{b}");
  });

  it("重命名 {name} → {nom} 被检出", async () => {
    const result = await checkItem(makeItem("Hi {name}", "你好 {nom}"));
    const issues = variableIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("{name}");
    expect(issues[0].description).toContain("{nom}");
  });

  it("丢失占位符被检出", async () => {
    const result = await checkItem(makeItem("{a} and {b}", "只有 {a}"));
    const issues = variableIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("{b}");
  });

  it("译文多出占位符被检出", async () => {
    const result = await checkItem(makeItem("没有占位符", "译文 {x}"));
    const issues = variableIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("{x}");
  });

  it("%s 与 %1$s 互换被检出（不同 token）", async () => {
    const result = await checkItem(makeItem("value: %s", "值：%1$s"));
    expect(variableIssues(result).length).toBe(1);
  });
});

describe("占位符检查（正确场景不误报）", () => {
  it("正确保留不报", async () => {
    const result = await checkItem(makeItem("Hello {name}", "你好 {name}"));
    expect(variableIssues(result)).toEqual([]);
  });

  it("顺序不同但集合相同不报", async () => {
    const result = await checkItem(makeItem("{{x}} {{y}}", "{{y}} {{x}}"));
    expect(variableIssues(result)).toEqual([]);
  });

  it("位置参数换位不报", async () => {
    const result = await checkItem(
      makeItem("%1$s has %2$d items", "%2$d 个项目属于 %1$s")
    );
    expect(variableIssues(result)).toEqual([]);
  });

  it("重复占位符数量一致不报", async () => {
    const result = await checkItem(makeItem("{a} {a}", "{a} {a}"));
    expect(variableIssues(result)).toEqual([]);
  });

  it("双方均无占位符不报", async () => {
    const result = await checkItem(makeItem("plain text", "纯文本"));
    expect(variableIssues(result)).toEqual([]);
  });
});
