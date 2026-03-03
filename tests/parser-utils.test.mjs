/**
 * 解析器工具类测试
 * 测试 public/app/parsers/parser-utils.js
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/parsers/parser-utils.js");
});

describe("ParserUtils.detectBom", () => {
  it("检测 UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x48]);
    expect(ParserUtils.detectBom(bytes)).toBe("utf-8");
  });

  it("检测 UTF-16 LE BOM", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00]);
    expect(ParserUtils.detectBom(bytes)).toBe("utf-16le");
  });

  it("检测 UTF-16 BE BOM", () => {
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x48]);
    expect(ParserUtils.detectBom(bytes)).toBe("utf-16be");
  });

  it("检测 UTF-32 LE BOM", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x00]);
    expect(ParserUtils.detectBom(bytes)).toBe("utf-32le");
  });

  it("无 BOM 返回空字符串", () => {
    const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c]);
    expect(ParserUtils.detectBom(bytes)).toBe("");
  });

  it("空/短输入返回空字符串", () => {
    expect(ParserUtils.detectBom(new Uint8Array([]))).toBe("");
    expect(ParserUtils.detectBom(new Uint8Array([0x48]))).toBe("");
  });
});

describe("ParserUtils.detectEncoding", () => {
  it("有 BOM 时返回对应编码", () => {
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, 0x48]).buffer;
    expect(ParserUtils.detectEncoding(buf)).toBe("utf-8");
  });

  it("无 BOM 时默认 utf-8", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c]).buffer;
    expect(ParserUtils.detectEncoding(buf)).toBe("utf-8");
  });
});

describe("ParserUtils.cleanText", () => {
  it("统一换行符", () => {
    expect(ParserUtils.cleanText("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("移除 BOM", () => {
    expect(ParserUtils.cleanText("\uFEFFhello")).toBe("hello");
  });

  it("trim 前后空白", () => {
    expect(ParserUtils.cleanText("  hello  ")).toBe("hello");
  });

  it("空值返回空字符串", () => {
    expect(ParserUtils.cleanText(null)).toBe("");
    expect(ParserUtils.cleanText("")).toBe("");
  });
});

describe("ParserUtils.validateJSON", () => {
  it("有效 JSON 对象", () => {
    const result = ParserUtils.validateJSON('{"a":1,"b":2}');
    expect(result.valid).toBe(true);
    expect(result.type).toBe("object");
    expect(result.keys).toBe(2);
  });

  it("有效 JSON 数组", () => {
    const result = ParserUtils.validateJSON("[1,2,3]");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("array");
    expect(result.keys).toBe(3);
  });

  it("无效 JSON", () => {
    const result = ParserUtils.validateJSON("{invalid}");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("ParserUtils.detectPOFormat", () => {
  it("检测 PO 文件特征", () => {
    const content = `msgid "Hello"
msgstr "你好"
msgid "World"
msgid_plural "items"
msgctxt "menu"
"Content-Type: text/plain; charset=UTF-8\\n"`;
    const result = ParserUtils.detectPOFormat(content);
    expect(result.hasPlural).toBe(true);
    expect(result.hasContext).toBe(true);
    expect(result.encoding).toBe("UTF-8");
    expect(result.messageCount).toBe(2);
  });

  it("简单 PO 文件（无复数、无上下文）", () => {
    const content = `msgid "OK"\nmsgstr "确定"`;
    const result = ParserUtils.detectPOFormat(content);
    expect(result.hasPlural).toBe(false);
    expect(result.hasContext).toBe(false);
  });
});

describe("ParserUtils.normalizeItem", () => {
  it("填充默认字段", () => {
    const item = { sourceText: "Hello" };
    const result = ParserUtils.normalizeItem(item, "json", "en.json");
    expect(result.sourceText).toBe("Hello");
    expect(result.targetText).toBe("");
    expect(result.status).toBe("pending");
    expect(result.metadata.file).toBe("en.json");
    expect(result.metadata.format).toBe("json");
  });

  it("有翻译时状态为 translated", () => {
    const item = { sourceText: "Hi", targetText: "你好" };
    const result = ParserUtils.normalizeItem(item, "po", "zh.po");
    expect(result.status).toBe("translated");
    expect(result.qualityScore).toBe(85);
  });
});

describe("ParserUtils.filterEmpty", () => {
  it("过滤空源文本", () => {
    const items = [
      { sourceText: "Hello" },
      { sourceText: "" },
      { sourceText: "   " },
      { sourceText: "World" },
    ];
    const result = ParserUtils.filterEmpty(items);
    expect(result).toHaveLength(2);
    expect(result[0].sourceText).toBe("Hello");
    expect(result[1].sourceText).toBe("World");
  });
});

describe("ParserUtils.mergeDuplicates", () => {
  it("合并同源文本同文件的重复项（保留有翻译的）", () => {
    const items = [
      { sourceText: "Hello", targetText: "", metadata: { file: "a.json" } },
      { sourceText: "Hello", targetText: "你好", metadata: { file: "a.json" } },
      { sourceText: "World", targetText: "", metadata: { file: "a.json" } },
    ];
    const result = ParserUtils.mergeDuplicates(items);
    expect(result).toHaveLength(2);
    expect(result[0].targetText).toBe("你好");
  });

  it("不同文件的同源文本不合并", () => {
    const items = [
      { sourceText: "OK", targetText: "", metadata: { file: "a.json" } },
      { sourceText: "OK", targetText: "", metadata: { file: "b.json" } },
    ];
    const result = ParserUtils.mergeDuplicates(items);
    expect(result).toHaveLength(2);
  });
});

describe("ParserUtils.getStats", () => {
  it("正确统计翻译进度", () => {
    const items = [
      { sourceText: "a", status: "translated" },
      { sourceText: "b", status: "translated" },
      { sourceText: "c", status: "pending" },
      { sourceText: "", status: "pending" },
    ];
    const stats = ParserUtils.getStats(items);
    expect(stats.total).toBe(4);
    expect(stats.translated).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.empty).toBe(1);
    expect(stats.progress).toBe(50);
  });

  it("空数组返回全零", () => {
    const stats = ParserUtils.getStats([]);
    expect(stats.total).toBe(0);
    expect(stats.progress).toBe(0);
  });
});
