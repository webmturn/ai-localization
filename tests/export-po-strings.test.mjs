/**
 * PO / iOS .strings 导出转义回归测试（本次修复新增）
 *
 * 修复前：
 *  - PO：只转义双引号。译文含换行 → 生成非法 PO；含制表符/反斜杠 → 破坏结构；
 *        msgid 含 \n 转义时匹配不到 → 译文被静默丢弃。
 *  - iOS：行正则用 [^"]* ，遇到 \" 即截断 → 含转义引号/多行值的条目永不更新；
 *        尾随反斜杠会吞掉收尾引号并破坏下一条键值对。
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-original.js");
  loadSource("public/app/features/translations/export/translation-formats.js");
});

function setFile(fileName, originalContent) {
  globalThis.AppState.fileMetadata = { [fileName]: { originalContent } };
}

// 用解析器把导出结果再读一遍，确认往返可用
function parsePoBack(content) {
  const items = [];
  const re = /msgid\s+"((?:\\.|[^"\\])*)"\s*\nmsgstr\s+"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    items.push({ msgid: m[1], msgstr: m[2] });
  }
  return items;
}

describe("PO 导出转义（回归）", () => {
  const FILE = "app.po";
  const PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr ""

msgid "Multi"
msgstr ""
`;

  beforeEach(() => setFile(FILE, PO));

  function item(sourceText, targetText, metadata = {}) {
    return { sourceText, targetText, status: "translated", metadata: { file: FILE, ...metadata } };
  }

  it("换行被转义为 \\n，不产生非法 PO", () => {
    const out = generatePOFromOriginal([item("Multi", "第一行\n第二行")], FILE);
    // 不允许出现真实换行落在字符串字面量内部
    expect(out).toContain('"第一行\\n第二行"');
    expect(out).not.toMatch(/msgstr "第一行\n第二行"/);
    // 再解析回来必须能取到该 msgid
    const parsed = parsePoBack(out);
    expect(parsed.some((p) => p.msgid === "Multi")).toBe(true);
  });

  it("制表符被转义为 \\t", () => {
    const out = generatePOFromOriginal([item("Multi", "a\tb")], FILE);
    expect(out).toContain('"a\\tb"');
    expect(out).not.toContain("a\tb");
  });

  it("反斜杠被转义，尾随反斜杠不再破坏结尾引号", () => {
    const out = generatePOFromOriginal([item("Multi", "C:\\temp\\")], FILE);
    expect(out).toContain('"C:\\\\temp\\\\"');
  });

  it("双引号仍被正确转义", () => {
    const out = generatePOFromOriginal([item("Multi", 'say "hi"')], FILE);
    expect(out).toContain('"say \\"hi\\""');
  });

  it("普通译文正常写入", () => {
    const out = generatePOFromOriginal([item("Hello", "你好")], FILE);
    expect(out).toContain('msgid "Hello"\nmsgstr "你好"');
  });

  it("多行 msgstr 结构被保持且内容正确", () => {
    const longPo = `msgid "Multi"
msgstr ""
"part one "
"part two"
`;
    setFile(FILE, longPo);
    const out = generatePOFromOriginal([item("Multi", "短译文")], FILE);
    expect(out).toContain('msgstr "短译文"');
    const parsed = parsePoBack(out);
    expect(parsed.find((p) => p.msgid === "Multi")).toBeTruthy();
  });

  it("未翻译条目保持原样", () => {
    const out = generatePOFromOriginal([item("Hello", "")], FILE);
    expect(out).toContain('msgid "Hello"\nmsgstr ""');
  });

  it("msgid 在文件中以 \\n 转义形式存在时仍能匹配（回归：此前被静默丢弃）", () => {
    const poWithEscape = `msgid "Line1\\nLine2"
msgstr ""
`;
    setFile(FILE, poWithEscape);
    // 解析器会把 msgid 解码成真实换行
    const out = generatePOFromOriginal([item("Line1\nLine2", "第一行\n第二行")], FILE);
    expect(out).toContain("第一行");
    const parsed = parsePoBack(out);
    expect(parsed.find((p) => p.msgid === "Line1\\nLine2")).toBeTruthy();
  });
});

describe("iOS .strings 导出转义（回归）", () => {
  const FILE = "Localizable.strings";
  const STRINGS = `"greeting" = "Hello";
"quoted" = "Say hi";
"multi" = "A";
"tail" = "x";
"after" = "Should survive";
`;

  beforeEach(() => setFile(FILE, STRINGS));

  function item(key, targetText) {
    return { sourceText: key, targetText, status: "translated", metadata: { file: FILE, key } };
  }

  it("普通值正常更新", () => {
    const out = generateIOSStringsFromOriginal([item("greeting", "你好")], FILE);
    expect(out).toContain('"greeting" = "你好";');
  });

  it("译文含双引号时被转义为 \\\"", () => {
    const out = generateIOSStringsFromOriginal([item("greeting", 'say "hi"')], FILE);
    expect(out).toContain('"greeting" = "say \\"hi\\"";');
  });

  it("文件中原值含转义引号的条目仍能匹配并更新（回归：此前永不更新）", () => {
    const withEscaped = `"quoted" = "Say \\"hi\\"";
"other" = "x";
`;
    setFile(FILE, withEscaped);
    const out = generateIOSStringsFromOriginal([item("quoted", "说“你好”")], FILE);
    expect(out).toContain("说“你好”");
    expect(out).not.toContain('Say \\"hi\\"');
  });

  it("译文含换行时被转义为 \\n，不产生跨行破坏", () => {
    const out = generateIOSStringsFromOriginal([item("greeting", "第一行\n第二行")], FILE);
    expect(out).toContain('"greeting" = "第一行\\n第二行";');
    // 该行不应被拆成两行
    const line = out.split("\n").find((l) => l.includes("greeting"));
    expect(line).toContain("第二行");
  });

  it("尾随反斜杠不会吞掉引号、也不破坏下一条键值对（回归）", () => {
    const out = generateIOSStringsFromOriginal(
      [item("multi", "path\\"), item("after", "幸存")],
      FILE
    );
    expect(out).toContain('"multi" = "path\\\\";');
    // 下一条必须完好
    expect(out).toContain('"after" = "幸存";');
    expect(out.split("\n").filter((l) => l.includes('"after"')).length).toBe(1);
  });

  it("未在 map 中的键保持原样", () => {
    const out = generateIOSStringsFromOriginal([item("greeting", "你好")], FILE);
    expect(out).toContain('"quoted" = "Say hi";');
    expect(out).toContain('"after" = "Should survive";');
  });
});
