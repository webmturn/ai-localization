/**
 * 增量翻译 Diff 测试
 * 测试 public/app/services/translation/translation-diff.js
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/translation-diff.js");
});

beforeEach(() => {
  // 清理 localStorage
  localStorage.removeItem("__translationSnapshots");
});

describe("TranslationDiff._hashText", () => {
  it("相同文本产生相同哈希", () => {
    expect(TranslationDiff._hashText("Hello")).toBe(TranslationDiff._hashText("Hello"));
  });

  it("不同文本产生不同哈希", () => {
    expect(TranslationDiff._hashText("Hello")).not.toBe(TranslationDiff._hashText("World"));
  });

  it("标准化空白后哈希一致", () => {
    expect(TranslationDiff._hashText("  Hello  World ")).toBe(TranslationDiff._hashText("Hello World"));
  });
});

describe("TranslationDiff.createSnapshot / compare", () => {
  const items = [
    { id: "k1", sourceText: "Hello", targetText: "你好", metadata: {} },
    { id: "k2", sourceText: "World", targetText: "世界", metadata: {} },
    { id: "k3", sourceText: "Goodbye", targetText: "再见", metadata: {} },
  ];

  it("首次比较（无快照）返回 hasSnapshot=false", () => {
    const result = TranslationDiff.compare("test-file", items);
    expect(result.hasSnapshot).toBe(false);
    expect(result.summary).toContain("首次导入");
  });

  it("无变化时全部为 unchanged", () => {
    TranslationDiff.createSnapshot("test-file", items);
    const result = TranslationDiff.compare("test-file", items);
    expect(result.hasSnapshot).toBe(true);
    expect(result.unchanged).toHaveLength(3);
    expect(result.changed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it("检测源文本变更", () => {
    TranslationDiff.createSnapshot("test-file", items);
    const modified = [
      { id: "k1", sourceText: "Hello!", targetText: "你好", metadata: {} }, // 变更
      { id: "k2", sourceText: "World", targetText: "世界", metadata: {} },
      { id: "k3", sourceText: "Goodbye", targetText: "再见", metadata: {} },
    ];
    const result = TranslationDiff.compare("test-file", modified);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].key).toBe("k1");
    expect(result.unchanged).toHaveLength(2);
  });

  it("检测新增条目", () => {
    TranslationDiff.createSnapshot("test-file", items);
    const withNew = [...items, { id: "k4", sourceText: "New item", targetText: "", metadata: {} }];
    const result = TranslationDiff.compare("test-file", withNew);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].key).toBe("k4");
  });

  it("检测删除条目", () => {
    TranslationDiff.createSnapshot("test-file", items);
    const fewer = items.slice(0, 2); // 移除 k3
    const result = TranslationDiff.compare("test-file", fewer);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].key).toBe("k3");
  });
});

describe("TranslationDiff.markForRetranslation", () => {
  it("将变更和新增项标记为 pending", () => {
    const items = [
      { id: "k1", sourceText: "Changed", status: "translated" },
      { id: "k2", sourceText: "Same", status: "translated" },
      { id: "k3", sourceText: "New", status: "translated" },
    ];
    const diffResult = {
      changed: [{ index: 0, key: "k1" }],
      added: [{ index: 2, key: "k3" }],
      unchanged: [{ index: 1, key: "k2" }],
      removed: [],
    };
    const count = TranslationDiff.markForRetranslation(items, diffResult);
    expect(count).toBe(2);
    expect(items[0].status).toBe("pending");
    expect(items[0]._diffStatus).toBe("changed");
    expect(items[1].status).toBe("translated"); // 未变
    expect(items[2].status).toBe("pending");
    expect(items[2]._diffStatus).toBe("added");
  });
});

describe("TranslationDiff.listSnapshots / removeSnapshot", () => {
  it("列出所有快照", () => {
    TranslationDiff.createSnapshot("file-a", [{ id: "1", sourceText: "A" }]);
    TranslationDiff.createSnapshot("file-b", [{ id: "2", sourceText: "B" }]);
    const list = TranslationDiff.listSnapshots();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.id).sort()).toEqual(["file-a", "file-b"]);
  });

  it("删除指定快照", () => {
    TranslationDiff.createSnapshot("file-a", [{ id: "1", sourceText: "A" }]);
    TranslationDiff.removeSnapshot("file-a");
    expect(TranslationDiff.listSnapshots()).toHaveLength(0);
  });

  it("clearAll 清除全部", () => {
    TranslationDiff.createSnapshot("file-a", [{ id: "1", sourceText: "A" }]);
    TranslationDiff.createSnapshot("file-b", [{ id: "2", sourceText: "B" }]);
    TranslationDiff.clearAll();
    expect(TranslationDiff.listSnapshots()).toHaveLength(0);
  });
});
