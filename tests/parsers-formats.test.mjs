/**
 * 格式解析器综合测试：PO / iOS strings / YAML / XLIFF / JSON / CSV
 * 覆盖真实格式的边界情况（转义、注释、内联标记、空值）
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/parsers/po.js");
  loadSource("public/app/parsers/ios-strings.js");
  loadSource("public/app/parsers/yaml.js");
  loadSource("public/app/parsers/json.js");
  loadSource("public/app/parsers/csv.js");
});

describe("PO 解析器", () => {
  it("字面 \\n 序列（反斜杠+n）不被误转为换行", () => {
    const po = 'msgid "Multi\\\\nLine"\nmsgstr "译"';
    const items = parsePO(po, "t.po");
    expect(items[0].sourceText).toBe("Multi\\nLine");
  });

  it("\\n 转义序列正常转为换行", () => {
    const po = 'msgid "第一行\\n第二行"\nmsgstr "译"';
    const items = parsePO(po, "t.po");
    expect(items[0].sourceText).toBe("第一行\n第二行");
  });

  it("复数条目：msgstr[1] 保留在 metadata.pluralTarget", () => {
    const po = [
      'msgid "%d item"',
      'msgid_plural "%d items"',
      'msgstr[0] "1 项"',
      'msgstr[1] "%d 项"'
    ].join("\n");
    const items = parsePO(po, "t.po");
    expect(items[0].sourceText).toBe("%d item");
    expect(items[0].targetText).toBe("1 项");
    expect(items[0].metadata.pluralTarget).toBe("%d 项");
    expect(items[0].metadata.plural).toBe("%d items");
  });

  it("msgctxt 上下文保留", () => {
    const po = 'msgctxt "menu"\nmsgid "Open"\nmsgstr "打开"';
    const items = parsePO(po, "t.po");
    expect(items[0].metadata.msgctxt).toBe("menu");
    expect(items[0].targetText).toBe("打开");
  });
});

describe("iOS strings 解析器", () => {
  it("\\uXXXX unicode 转义", () => {
    const src = '"key" = "caf\\u00e9";';
    const items = parseIOSStrings(src, "t.strings");
    expect(items[0].sourceText).toBe("café");
  });

  it("空值条目保留 key 且 sourceText 为空（不误用 key 当原文）", () => {
    const src = '"empty" = "";';
    const items = parseIOSStrings(src, "t.strings");
    expect(items[0].sourceText).toBe("");
    expect(items[0].metadata.key).toBe("empty");
  });

  it("注释与多行字符串", () => {
    const src = [
      '// 注释',
      '"a" = "第一行\\n第二行";',
      '/* 块注释 */',
      '"b" = "tab\\tvalue";'
    ].join("\n");
    const items = parseIOSStrings(src, "t.strings");
    expect(items.length).toBe(2);
    expect(items[0].sourceText).toBe("第一行\n第二行");
    expect(items[1].sourceText).toBe("tab\tvalue");
  });
});

describe("YAML 解析器", () => {
  it("内联注释被剥离", () => {
    const yaml = 'app:\n  title: Hello # 注释\n  count: 3';
    const items = parseYAML(yaml, "t.yml");
    expect(items[0].sourceText).toBe("Hello");
    expect(items[0].metadata.path).toBe("app.title");
  });

  it("嵌套路径与引号值", () => {
    const yaml = 'a:\n  b:\n    c: "quoted value"';
    const items = parseYAML(yaml, "t.yml");
    expect(items[0].sourceText).toBe("quoted value");
    expect(items[0].metadata.path).toBe("a.b.c");
  });
});

describe("JSON 解析器", () => {
  it("嵌套对象与数组路径", () => {
    const json = JSON.stringify({ app: { title: "Hi" }, menu: ["Open", "Save"] });
    const items = parseJSON(json, "t.json");
    expect(items.length).toBe(3);
    expect(items[0].metadata.path).toBe("$.app.title");
    expect(items[1].metadata.path).toBe("$.menu[0]");
  });

  it("数字/布尔/null 不提取", () => {
    const json = JSON.stringify({ a: 42, b: true, c: null, d: "text" });
    const items = parseJSON(json, "t.json");
    expect(items.length).toBe(1);
    expect(items[0].sourceText).toBe("text");
  });
});

describe("CSV 解析器", () => {
  it("公式注入防护：= + - @ 前缀加单引号", () => {
    expect(escapeCSVField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCSVField("+cmd")).toBe("'+cmd");
    expect(escapeCSVField("@import")).toBe("'@import");
    expect(escapeCSVField("-1")).toBe("'-1");
    expect(escapeCSVField("hello")).toBe("hello");
  });

  it("含引号字段正确转义", () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });
});
