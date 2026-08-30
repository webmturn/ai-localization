/**
 * 质量检查规则测试（第二批）
 * 覆盖：
 *   - scoring.js 评分下限修复（high 问题过多时侵蚀翻译率分）
 *   - run.js 重复译文检测（原文相似度门槛，避免合法共享译文误报）
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import vm from "vm";
import fs from "fs";
import path from "path";

let calculateOverallScore;
let detectDuplicateIssues;
let bigramSimilarity;
let ctx;

beforeAll(() => {
  ctx = { window: {}, console };
  // scoring.js 读取 AppState.qualityCheckResults
  ctx.AppState = {
    qualityCheckResults: {
      overallScore: 0,
      translatedCount: 0,
      totalCount: 0,
      issues: [],
      termMatches: 0,
      termsTruncatedCount: 0,
      lastCheckTime: null,
      scope: null,
      fileName: null,
    },
  };
  vm.createContext(ctx);

  const scoringCode = fs.readFileSync(
    path.resolve("public/app/features/quality/scoring.js"),
    "utf-8"
  );
  vm.runInContext(scoringCode, ctx);
  calculateOverallScore = ctx.window.App.impl.calculateOverallScore;

  // run.js 顶层仅定义函数并挂载，__detectDuplicateIssuesImpl / __bigramSimilarityImpl 自包含
  const runCode = fs.readFileSync(
    path.resolve("public/app/features/quality/run.js"),
    "utf-8"
  );
  vm.runInContext(runCode, ctx);
  detectDuplicateIssues = ctx.window.App.impl.detectDuplicateIssues;
  bigramSimilarity = ctx.window.App.impl.bigramSimilarity;
});

function makeIssue(severity) {
  return { severity };
}

describe("评分下限修复（scoring.js）", () => {
  beforeEach(() => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.overallScore = 0;
    qr.translatedCount = 0;
    qr.totalCount = 0;
    qr.issues = [];
  });

  it("全部翻译且无问题 → 满分 100", () => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.totalCount = 100;
    qr.translatedCount = 100;
    qr.issues = [];
    calculateOverallScore();
    expect(qr.overallScore).toBe(100);
  });

  it("全部翻译 + 少量问题 → 正常扣分", () => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.totalCount = 100;
    qr.translatedCount = 100;
    qr.issues = [makeIssue("medium"), makeIssue("low")];
    calculateOverallScore();
    // 60 + 40 - (1.5 + 0.5) = 98
    expect(qr.overallScore).toBe(98);
  });

  it("全部翻译 + 大量 high 问题 → 低于 60（不再停留 60 下限）", () => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.totalCount = 100;
    qr.translatedCount = 100;
    qr.issues = Array.from({ length: 20 }, () => makeIssue("high"));
    calculateOverallScore();
    // 60 + 40 - 20*3 = 40
    expect(qr.overallScore).toBe(40);
  });

  it("惩罚超过总分时不低于 0", () => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.totalCount = 100;
    qr.translatedCount = 100;
    qr.issues = Array.from({ length: 100 }, () => makeIssue("high"));
    calculateOverallScore();
    expect(qr.overallScore).toBe(0);
  });

  it("空项目 → 0 分", () => {
    const qr = ctx.AppState.qualityCheckResults;
    qr.totalCount = 0;
    qr.translatedCount = 0;
    qr.issues = [];
    calculateOverallScore();
    expect(qr.overallScore).toBe(0);
  });
});

describe("bigramSimilarity 原文相似度", () => {
  it("相同文本为 1", () => {
    expect(bigramSimilarity("abc", "abc")).toBe(1);
  });

  it("完全不同为 0", () => {
    expect(bigramSimilarity("OK", "确定")).toBe(0);
  });

  it("相近文本得分较高", () => {
    expect(
      bigramSimilarity("Save the file", "Save the document")
    ).toBeGreaterThan(0.4);
  });
});

describe("重复译文检测（原文相似度门槛）", () => {
  it("原文相近 + 译文相同 → 检出", () => {
    const items = [
      { id: "a", sourceText: "Save the file", targetText: "保存文件" },
      { id: "b", sourceText: "Save the document", targetText: "保存文件" },
    ];
    const issues = detectDuplicateIssues(items);
    expect(issues.length).toBe(2);
    expect(issues[0].type).toBe("duplicate");
  });

  it("原文差异大 + 共享译文 → 不检出（合法，如 OK/Yes/Sure → 确定）", () => {
    const items = [
      { id: "a", sourceText: "OK", targetText: "确定" },
      { id: "b", sourceText: "Yes", targetText: "确定" },
      { id: "c", sourceText: "Sure", targetText: "确定" },
    ];
    const issues = detectDuplicateIssues(items);
    expect(issues).toEqual([]);
  });

  it("唯一译文不检出", () => {
    const items = [
      { id: "a", sourceText: "Hello", targetText: "你好" },
      { id: "b", sourceText: "Bye", targetText: "再见" },
    ];
    expect(detectDuplicateIssues(items)).toEqual([]);
  });

  it("空译文不参与分组", () => {
    const items = [
      { id: "a", sourceText: "Hello", targetText: "" },
      { id: "b", sourceText: "Bye", targetText: "" },
    ];
    expect(detectDuplicateIssues(items)).toEqual([]);
  });
});
