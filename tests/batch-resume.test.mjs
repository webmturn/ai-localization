/**
 * 批量翻译断点续传测试
 * 测试 public/app/services/translation/batch-resume.js
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/batch-resume.js");
});

beforeEach(() => {
  localStorage.removeItem("__batchResume");
});

describe("BatchResumeManager.generateBatchId", () => {
  it("基于引擎、数量、首尾源文本生成 ID", () => {
    const items = [
      { sourceText: "Hello" },
      { sourceText: "World" },
    ];
    const id = BatchResumeManager.generateBatchId(items, "deepseek");
    expect(id).toContain("deepseek");
    expect(id).toContain("2");
    expect(id).toContain("Hello");
    expect(id).toContain("World");
  });

  it("相同输入产生相同 ID", () => {
    const items = [{ sourceText: "A" }, { sourceText: "B" }];
    const id1 = BatchResumeManager.generateBatchId(items, "openai");
    const id2 = BatchResumeManager.generateBatchId(items, "openai");
    expect(id1).toBe(id2);
  });
});

describe("BatchResumeManager.saveProgress / getProgress", () => {
  it("保存并读取进度", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [0, 1, 2],
      totalCount: 10,
      engine: "deepseek",
      sourceLang: "en",
      targetLang: "zh",
    });
    const progress = BatchResumeManager.getProgress("batch-1");
    expect(progress).not.toBeNull();
    expect(progress.completedIndices).toEqual([0, 1, 2]);
    expect(progress.totalCount).toBe(10);
    expect(progress.engine).toBe("deepseek");
  });

  it("不存在的批次返回 null", () => {
    expect(BatchResumeManager.getProgress("nonexistent")).toBeNull();
  });
});

describe("BatchResumeManager.markCompleted", () => {
  it("逐个标记完成", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [],
      totalCount: 5,
      engine: "test",
    });
    BatchResumeManager.markCompleted("batch-1", 0);
    BatchResumeManager.markCompleted("batch-1", 3);
    BatchResumeManager.markCompleted("batch-1", 3); // 重复标记不增加

    const progress = BatchResumeManager.getProgress("batch-1");
    expect(progress.completedIndices).toEqual([0, 3]);
  });
});

describe("BatchResumeManager.getPendingIndices", () => {
  it("返回未完成的索引", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [0, 2, 4],
      totalCount: 5,
      engine: "test",
    });
    const pending = BatchResumeManager.getPendingIndices("batch-1", 5);
    expect(pending).toEqual([1, 3]);
  });

  it("无进度返回 null", () => {
    expect(BatchResumeManager.getPendingIndices("nonexistent", 5)).toBeNull();
  });
});

describe("BatchResumeManager.hasResumableProgress", () => {
  it("有部分完成时返回 true", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [0, 1],
      totalCount: 5,
      engine: "test",
    });
    expect(BatchResumeManager.hasResumableProgress("batch-1")).toBe(true);
  });

  it("全部完成时返回 false", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [0, 1, 2],
      totalCount: 3,
      engine: "test",
    });
    expect(BatchResumeManager.hasResumableProgress("batch-1")).toBe(false);
  });

  it("无进度返回 false", () => {
    expect(BatchResumeManager.hasResumableProgress("nonexistent")).toBe(false);
  });
});

describe("BatchResumeManager.getResumeSummary", () => {
  it("返回恢复摘要", () => {
    BatchResumeManager.saveProgress("batch-1", {
      completedIndices: [0, 1, 2],
      totalCount: 10,
      engine: "deepseek",
    });
    const summary = BatchResumeManager.getResumeSummary("batch-1");
    expect(summary.completed).toBe(3);
    expect(summary.total).toBe(10);
    expect(summary.remaining).toBe(7);
    expect(summary.percent).toBe(30);
    expect(summary.engine).toBe("deepseek");
  });
});

describe("BatchResumeManager.clearProgress", () => {
  it("清除指定批次进度", () => {
    BatchResumeManager.saveProgress("batch-1", { completedIndices: [0], totalCount: 5, engine: "test" });
    BatchResumeManager.saveProgress("batch-2", { completedIndices: [1], totalCount: 3, engine: "test" });
    BatchResumeManager.clearProgress("batch-1");
    expect(BatchResumeManager.getProgress("batch-1")).toBeNull();
    expect(BatchResumeManager.getProgress("batch-2")).not.toBeNull();
  });
});
