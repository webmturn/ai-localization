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
let normalizeNumber;
let parseChineseNumber;

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
  normalizeNumber = ctx.window.App.impl.normalizeNumberToken;
  parseChineseNumber = ctx.window.App.impl.parseChineseNumber;
});

function makeItem(sourceText, targetText) {
  return { id: "t1", sourceText, targetText };
}

function variableIssues(result) {
  return result.issues.filter((i) => i.type === "variable");
}

function numberIssues(result) {
  return result.issues.filter((i) => i.type === "numbers");
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

describe("normalizeNumberToken 规范化", () => {
  it("欧式小数逗号 → 点", () => {
    expect(normalizeNumber("1,5")).toBe("1.5");
  });

  it("千分位（逗号/点）去除", () => {
    expect(normalizeNumber("1,000")).toBe("1000");
    expect(normalizeNumber("1.000")).toBe("1000");
    expect(normalizeNumber("1,000.50")).toBe("1000.50");
    expect(normalizeNumber("1.000,50")).toBe("1000.50");
  });

  it("前导零去除", () => {
    expect(normalizeNumber("01")).toBe("1");
    expect(normalizeNumber("0")).toBe("0");
  });

  it("多点版本号保持原样", () => {
    expect(normalizeNumber("2.0.1")).toBe("2.0.1");
  });
});

describe("parseChineseNumber 中文数字", () => {
  it("基础与进位", () => {
    expect(parseChineseNumber("五")).toBe(5);
    expect(parseChineseNumber("十五")).toBe(15);
    expect(parseChineseNumber("二十")).toBe(20);
    expect(parseChineseNumber("一百二十三")).toBe(123);
    expect(parseChineseNumber("两万三千")).toBe(23000);
  });
});

describe("数字检查（修复字面匹配误报）", () => {
  it("日期本地化不误报", async () => {
    const result = await checkItem(
      makeItem("Date: 2024-01-01", "日期：2024年1月1日")
    );
    expect(numberIssues(result)).toEqual([]);
  });

  it("欧式小数逗号不误报", async () => {
    const result = await checkItem(
      makeItem("Weight: 1.5 kg", "Gewicht: 1,5 kg")
    );
    expect(numberIssues(result)).toEqual([]);
  });

  it("千分位差异不误报", async () => {
    const result = await checkItem(
      makeItem("Total: 1,000 items", "Gesamt: 1.000 Artikel")
    );
    expect(numberIssues(result)).toEqual([]);
  });

  it("中文数字表达不误报", async () => {
    const result = await checkItem(makeItem("Level 5 unlocked", "解锁第五关"));
    expect(numberIssues(result)).toEqual([]);
    const result2 = await checkItem(
      makeItem("You have 3 messages", "你有三条消息")
    );
    expect(numberIssues(result2)).toEqual([]);
  });

  it("占位符内数字不干扰", async () => {
    const result = await checkItem(
      makeItem("%1$s has %2$d items", "%2$d 个项目属于 %1$s")
    );
    expect(numberIssues(result)).toEqual([]);
  });

  it("数字丢失仍检出", async () => {
    const result = await checkItem(
      makeItem("You have 3 messages", "你有新消息")
    );
    const issues = numberIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("3");
  });

  it("数字被篡改仍检出", async () => {
    const result = await checkItem(
      makeItem("Retry in 10 seconds", "15 秒后重试")
    );
    const issues = numberIssues(result);
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("10");
  });

  it("版本号变更仍检出", async () => {
    const result = await checkItem(makeItem("v2.0.1 released", "发布 v2.0.2"));
    expect(numberIssues(result).length).toBe(1);
  });
});

describe("术语检查（词边界修复子串误命中）", () => {
  const terms = [{ source: "in", target: "在" }];

  it("单词内的子串不命中（king 不含术语 in）", async () => {
    const result = await checkItem(
      makeItem("The king is happy", "国王很开心"),
      terms
    );
    expect(result.termMatches).toBe(0);
    expect(
      result.issues.filter((i) => i.type === "terminology")
    ).toEqual([]);
  });

  it("独立单词命中（in the castle）", async () => {
    const result = await checkItem(
      makeItem("The king in the castle", "城堡里的国王"),
      terms
    );
    expect(result.termMatches).toBe(1);
  });

  it("下划线包裹视为标识符不命中（_in_）", async () => {
    const result = await checkItem(
      makeItem("variable _in_ scope", "变量 _in_ 作用域"),
      terms
    );
    expect(result.termMatches).toBe(0);
  });

  it("纯 CJK 术语退化为子串匹配", async () => {
    const cjkTerms = [{ source: "本地化", target: "localization" }];
    const result = await checkItem(
      makeItem("本地化工具", "localization tool"),
      cjkTerms
    );
    expect(result.termMatches).toBe(1);
    expect(
      result.issues.filter((i) => i.type === "terminology").length
    ).toBe(0);
  });

  it("译文含正确术语不报 issue", async () => {
    const apiTerms = [
      { source: "API", target: "应用程序接口" },
    ];
    const result = await checkItem(
      makeItem("Call the API", "调用应用程序接口"),
      apiTerms
    );
    expect(result.termMatches).toBe(1);
    expect(
      result.issues.filter((i) => i.type === "terminology")
    ).toEqual([]);
  });

  it("译文未用正确术语报 issue", async () => {
    const apiTerms = [
      { source: "API", target: "应用程序接口" },
    ];
    const result = await checkItem(
      makeItem("Call the API", "调用接口"),
      apiTerms
    );
    expect(result.termMatches).toBe(1);
    const issues = result.issues.filter((i) => i.type === "terminology");
    expect(issues.length).toBe(1);
    expect(issues[0].description).toContain("应用程序接口");
  });

  it("译文侧子串包含不算已使用（rapid 不含 api 术语）", async () => {
    const apiTerms = [{ source: "API", target: "api" }];
    const result = await checkItem(
      makeItem("Use the API", "use the rapid endpoint"),
      apiTerms
    );
    expect(result.termMatches).toBe(1);
    const issues = result.issues.filter((i) => i.type === "terminology");
    expect(issues.length).toBe(1);
  });

  it("空 source 术语跳过（不误计数）", async () => {
    const result = await checkItem(
      makeItem("任意文本", "任意译文"),
      [{ source: "", target: "某术语" }]
    );
    expect(result.termMatches).toBe(0);
  });

  it("空 target 术语跳过（不计命中、不产 issue，不虚增一致性）", async () => {
    const result = await checkItem(
      makeItem("Call the API", "调用接口"),
      [{ source: "API", target: "" }]
    );
    expect(result.termMatches).toBe(0);
    expect(
      result.issues.filter((i) => i.type === "terminology")
    ).toEqual([]);
  });
});
