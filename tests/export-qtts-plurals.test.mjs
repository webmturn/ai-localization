/**
 * 复核：Qt TS 导出在解析器新增形态数元数据后仍正常（跑完即删）
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

const FILE = "app.ts";
const XML = `<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="en_US">
<context>
    <name>Main</name>
    <message numerus="yes">
        <source>%n file(s)</source>
        <translation type="unfinished">
            <numerusform>%n file</numerusform>
            <numerusform>%n files</numerusform>
        </translation>
    </message>
    <message>
        <source>Open</source>
        <translation type="unfinished"></translation>
    </message>
</context>
</TS>`;

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/parsers/qt-ts.js");
  loadSource("public/app/features/translations/export/translation-original.js");
  loadSource("public/app/features/translations/export/translation-formats.js");
  globalThis.AppState.fileMetadata = { [FILE]: { originalContent: XML, extension: "ts" } };
});

function forms(out) {
  return (out.match(/<numerusform>([\s\S]*?)<\/numerusform>/g) || []).map((f) =>
    f.replace(/<\/?numerusform>/g, "")
  );
}

describe("Qt TS：解析器元数据 → 导出器", () => {
  it("解析器写入 sourceNumerusCount / targetNumerusCount", () => {
    const items = parseQtTs(XML, FILE);
    const plural = items[0];
    expect(plural.metadata.sourceNumerusCount).toBe(0); // 源 <source> 无 numerusform
    expect(plural.metadata.targetNumerusCount).toBe(2);
  });

  it("段数与形态数一致时按序写回各形态", () => {
    const out = generateQtTsFromOriginal(
      [
        {
          sourceText: "%n file(s)",
          targetText: "%n 个文件\n%n 个文件们",
          status: "translated",
          metadata: { file: FILE, position: "context-1-message-1" },
        },
      ],
      FILE
    );
    const f = forms(out);
    expect(f).toHaveLength(2);
    expect(f[0]).toContain("个文件");
    expect(f[1]).toContain("个文件们");
  });

  it("段数与形态数不一致时保留原形态（不写坏）", () => {
    const out = generateQtTsFromOriginal(
      [
        {
          sourceText: "%n file(s)",
          targetText: "单段译文",
          status: "translated",
          metadata: { file: FILE, position: "context-1-message-1" },
        },
      ],
      FILE
    );
    const f = forms(out);
    expect(f).toHaveLength(2);
    expect(f[0]).toContain("%n file");
    expect(f[1]).toContain("%n files");
  });

  it("非复数消息正常写回，且不影响复数消息", () => {
    const out = generateQtTsFromOriginal(
      [
        {
          sourceText: "Open",
          targetText: "打开",
          status: "translated",
          metadata: { file: FILE, position: "context-1-message-2" },
        },
      ],
      FILE
    );
    expect(out).toContain("打开");
    const f = forms(out);
    expect(f[0]).toContain("%n file");
  });

  // 多语言关键场景：目标语言复数形态多于源语言（如 ru 3 种 vs en 2 种）。
  // 必须按解析时记录的 targetNumerusCount 对齐，而不是按源文形态数。
  it("目标语言复数形态数多于源语言时仍正确对齐", () => {
    const ruXml = `<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="ru_RU">
<context>
    <name>Main</name>
    <message numerus="yes">
        <source>%n file(s)</source>
        <translation type="unfinished">
            <numerusform>%n файл</numerusform>
            <numerusform>%n файла</numerusform>
            <numerusform>%n файлов</numerusform>
        </translation>
    </message>
</context>
</TS>`;
    const items = parseQtTs(ruXml, FILE);
    expect(items[0].metadata.targetNumerusCount).toBe(3);

    AppState.fileMetadata = { [FILE]: { originalContent: ruXml, extension: "ts" } };
    const out = generateQtTsFromOriginal(
      [
        {
          sourceText: "%n file(s)",
          // 用户按 3 个形态逐行给出
          targetText: "%n файл\n%n файла\n%n файлов",
          status: "translated",
          metadata: {
            file: FILE,
            position: "context-1-message-1",
            targetNumerusCount: 3,
          },
        },
      ],
      FILE
    );
    const f = forms(out);
    expect(f).toHaveLength(3);
    expect(f[0]).toContain("файл");
    expect(f[1]).toContain("файла");
    expect(f[2]).toContain("файлов");
  });
});
