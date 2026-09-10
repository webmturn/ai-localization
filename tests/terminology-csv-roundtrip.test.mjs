/**
 * 术语库 CSV 往返回归测试（本次修复新增）
 *
 * 修复前：导出使用中文表头（"源术语,目标术语,词性"），而
 * terminology-import.js 按 term.source / term.target 取值 →
 * 自家导出的 CSV 无法再导入（列名对不上，全部条目被丢弃）。
 * 另外词性列导出的是本地化显示名而非 key。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/parsers/csv.js");
  loadSource("public/app/features/translations/export/terminology-export.js");
});

/** 复刻 terminology-import.js 的 CSV → 术语映射逻辑（第 213-232 行） */
function importCsvLikeApp(fileContent) {
  const rows = parseCSVLines(fileContent, ",").filter(
    (row) => row.length > 0 && row.some((cell) => String(cell || "").trim() !== "")
  );
  if (rows.length === 0) throw new Error("CSV 文件为空");
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
  const imported = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const term = {};
    headers.forEach((header, index) => {
      term[header] = String(values[index] || "").trim();
    });
    if (term.source && term.target) {
      imported.push({
        source: term.source,
        target: term.target,
        partOfSpeech: term.partofspeech || term.pos || "other",
        definition: term.definition || term.description || "",
      });
    }
  }
  return imported;
}

const TERMS = [
  { id: 1, source: "API", target: "应用程序接口", partOfSpeech: "noun", definition: "接口" },
  { id: 2, source: "file", target: "文件", partOfSpeech: "noun", definition: "" },
  { id: 3, source: 'quote"inside', target: "带,逗号", partOfSpeech: "verb", definition: "多行\n定义" },
];

describe("术语库 CSV 导出 → 导入 往返", () => {
  it("导出的表头使用英文键名，可被导入端识别", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const header = csv.split("\n")[0];
    expect(header).toBe("source,target,partOfSpeech,definition");
  });

  it("往返后术语条目数不丢失", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const imported = importCsvLikeApp(csv);
    expect(imported).toHaveLength(TERMS.length);
  });

  it("往返后 source/target/词性/定义 全部保留", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const imported = importCsvLikeApp(csv);
    expect(imported[0]).toMatchObject({
      source: "API",
      target: "应用程序接口",
      partOfSpeech: "noun",
      definition: "接口",
    });
  });

  it("含双引号的字段往返正确（RFC 4180 翻倍）", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const imported = importCsvLikeApp(csv);
    expect(imported[2].source).toBe('quote"inside');
  });

  it("含逗号的字段往返正确", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const imported = importCsvLikeApp(csv);
    expect(imported[2].target).toBe("带,逗号");
  });

  it("含换行的字段往返正确", () => {
    const csv = generateTerminologyCSV(TERMS, true, false);
    const imported = importCsvLikeApp(csv);
    expect(imported[2].definition).toBe("多行\n定义");
  });

  it("不包含定义列时仍可导入", () => {
    const csv = generateTerminologyCSV(TERMS, false, false);
    expect(csv.split("\n")[0]).toBe("source,target,partOfSpeech");
    expect(importCsvLikeApp(csv)).toHaveLength(TERMS.length);
  });

  it("包含创建时间列时仍可导入且不破坏映射", () => {
    const csv = generateTerminologyCSV(TERMS, true, true);
    expect(csv.split("\n")[0]).toContain("createdAt");
    const imported = importCsvLikeApp(csv);
    expect(imported).toHaveLength(TERMS.length);
    expect(imported[1].source).toBe("file");
  });

  it("词性不是本地化显示名（导入端只认 key）", () => {
    const csv = generateTerminologyCSV([TERMS[0]], false, false);
    expect(csv).toContain('"noun"');
  });

  it("缺失词性时回退为 other", () => {
    const csv = generateTerminologyCSV(
      [{ id: 9, source: "a", target: "b" }],
      false,
      false
    );
    expect(importCsvLikeApp(csv)[0].partOfSpeech).toBe("other");
  });
});
