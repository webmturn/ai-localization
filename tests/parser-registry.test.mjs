/**
 * 解析器注册表测试：注册 wiring、扩展名命中、XML 结构探测、TSV 委派
 * 加载顺序与 public/app.js parserScripts 保持一致（注册顺序 = detectXml 探测优先级）
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/parsers/parser-registry.js");
  loadSource("public/app/parsers/parser-utils.js");
  loadSource("public/app/parsers/xml-generic.js");
  loadSource("public/app/parsers/xml-android.js");
  loadSource("public/app/parsers/xliff.js");
  loadSource("public/app/parsers/qt-ts.js");
  loadSource("public/app/parsers/ios-strings.js");
  loadSource("public/app/parsers/resx.js");
  loadSource("public/app/parsers/po.js");
  loadSource("public/app/parsers/json.js");
  loadSource("public/app/parsers/yaml.js");
  loadSource("public/app/parsers/csv.js");
  loadSource("public/app/parsers/text.js");
});

const parseDoc = (xml) =>
  new DOMParser().parseFromString(xml, "application/xml");

describe("注册完备性", () => {
  it("全部格式已注册，id 与注册顺序符合 app.js 加载顺序", () => {
    expect(ParserRegistry.list()).toEqual([
      "android", "xliff", "ts", "strings", "resx", "po", "json", "yaml", "csv", "tsv",
    ]);
  });

  it("register 拒绝无效配置（缺 id / 缺 parse）", () => {
    const before = ParserRegistry.list().length;
    ParserRegistry.register({ id: "bad" });
    ParserRegistry.register({ extensions: ["x"], parse: () => [] });
    expect(ParserRegistry.list().length).toBe(before);
  });
});

describe("扩展名命中", () => {
  it("直配格式：parse 函数身份一致", () => {
    expect(ParserRegistry.getByExtension("xliff").parse).toBe(parseXLIFF);
    expect(ParserRegistry.getByExtension("xlf").id).toBe("xliff");
    expect(ParserRegistry.getByExtension("po").parse).toBe(parsePO);
    expect(ParserRegistry.getByExtension("strings").parse).toBe(parseIOSStrings);
    expect(ParserRegistry.getByExtension("json").parse).toBe(parseJSON);
    expect(ParserRegistry.getByExtension("yaml").parse).toBe(parseYAML);
    expect(ParserRegistry.getByExtension("yml").id).toBe("yaml");
    expect(ParserRegistry.getByExtension("csv").parse).toBe(parseCSV);
    expect(ParserRegistry.getByExtension("resx").parse).toBe(parseRESX);
    expect(ParserRegistry.getByExtension("ts").parse).toBe(parseQtTs);
  });

  it("xml 扩展名不被独占（必须走结构探测），未知扩展名返回 null", () => {
    expect(ParserRegistry.getByExtension("xml")).toBeNull();
    expect(ParserRegistry.getByExtension("xyz")).toBeNull();
  });
});

describe("XML 结构探测（真实 DOMParser）", () => {
  it("Android strings.xml", () => {
    const doc = parseDoc('<resources><string name="a">Hello</string></resources>');
    expect(ParserRegistry.detectXml(doc).id).toBe("android");
  });

  it("XLIFF 1.2（trans-unit/source）与根元素名命中", () => {
    const doc = parseDoc(
      '<xliff version="1.2"><file><body><trans-unit id="1"><source>Hello</source></trans-unit></body></file></xliff>'
    );
    expect(ParserRegistry.detectXml(doc).id).toBe("xliff");
  });

  it("Qt TS", () => {
    const doc = parseDoc(
      '<TS><context><name>C</name><message><source>Hello</source></message></context></TS>'
    );
    expect(ParserRegistry.detectXml(doc).id).toBe("ts");
  });

  it("RESX", () => {
    const doc = parseDoc('<root><data name="a" xml:space="preserve"><value>Hello</value></data></root>');
    expect(ParserRegistry.detectXml(doc).id).toBe("resx");
  });

  it("未识别结构返回 null（通用XML兜底）", () => {
    const doc = parseDoc("<foo><bar>text</bar></foo>");
    expect(ParserRegistry.detectXml(doc)).toBeNull();
  });

  it("探测优先级 = 注册顺序（android 先于 xliff）", () => {
    const doc = parseDoc(
      '<resources><trans-unit><source>x</source></trans-unit><string name="a">y</string></resources>'
    );
    expect(ParserRegistry.detectXml(doc).id).toBe("android");
  });
});

describe("结构校验 wiring", () => {
  it("xliff validateSchema 缺少必需标签时返回失败原因", () => {
    const parser = ParserRegistry.getById("xliff");
    const doc = parseDoc("<xliff><file><body></body></file></xliff>");
    const check = parser.validateSchema(doc);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("缺少 trans-unit/source 或 unit/segment/source");
  });

  it("ts validateSchema root 不是 <ts> 时失败", () => {
    const parser = ParserRegistry.getById("ts");
    const doc = parseDoc("<not-ts><context><message><source>x</source></message></context></not-ts>");
    expect(parser.validateSchema(doc).ok).toBe(false);
  });
});

describe("TSV 委派", () => {
  it("tsv 扩展名命中 parseTSV（tab 分隔解析）", async () => {
    const parser = ParserRegistry.getByExtension("tsv");
    expect(parser.parse).toBe(parseTSV);
    const items = await parser.parse("source\ttarget\nHello\t你好", "t.tsv");
    expect(items.length).toBe(1);
    expect(items[0].sourceText).toBe("Hello");
    expect(items[0].targetText).toBe("你好");
  });
});

describe("XML 系扩展名派生", () => {
  it("getDetectableExtensions = 声明结构探测的解析器认领的扩展名", () => {
    expect(ParserRegistry.getDetectableExtensions()).toEqual([
      "xliff", "xlf", "ts", "resx",
    ]);
  });
});

describe("detectXmlFormat 兼容契约（error-handler.js 恢复路径依赖）", () => {
  beforeAll(() => {
    // parse.js 仅在运行期依赖 showNotification/securityUtils 等，加载期安全
    loadSource("public/app/features/files/parse.js");
  });

  it("返回注册表 parser.id 作为 type", () => {
    expect(detectXmlFormat('<resources><string name="a">x</string></resources>').type).toBe("android");
    expect(
      detectXmlFormat('<xliff><file><body><trans-unit><source>x</source></trans-unit></body></file></xliff>').type
    ).toBe("xliff");
    expect(
      detectXmlFormat('<TS><context><message><source>x</source></message></context></TS>').type
    ).toBe("ts");
    expect(detectXmlFormat('<root><data name="a"><value>x</value></data></root>').type).toBe("resx");
  });

  it("非法 XML 返回 invalid，未识别结构返回 generic", () => {
    expect(detectXmlFormat("<broken><unclosed>").type).toBe("invalid");
    expect(detectXmlFormat("<foo><bar>x</bar></foo>").type).toBe("generic");
  });
});

describe("端到端分发冒烟（__parseFileAsyncImpl → 注册表 → 解析器）", () => {
  let notifications;

  beforeAll(() => {
    loadSource("public/app/features/files/read.js");
    notifications = [];
    globalThis.showNotification = (type, title, message) => {
      notifications.push({ type, title, message });
    };
    // securityUtils 真实实现不在本测试范围，注入最小桩
    globalThis.securityUtils = { validateXMLContent: () => true };
  });

  const parseFile = (content, name, type) =>
    App.impl.parseFileAsync(new File([content], name, { type: type || "text/plain" }), {
      silent: true,
      skipPersist: true, // 不写 AppState.fileMetadata / IndexedDB
    });

  it("JSON 扩展名直配 parseJSON", async () => {
    const result = await parseFile('{"app.title": "Hello"}', "t.json", "application/json");
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].sourceText).toBe("Hello");
  });

  it("XLIFF 结构探测命中（.xlf 扩展名）", async () => {
    const result = await parseFile(
      '<xliff version="1.2"><file source-language="en"><body><trans-unit id="1"><source>Hello</source><target>你好</target></trans-unit></body></file></xliff>',
      "t.xlf",
      "application/xml"
    );
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].metadata.unitId).toBe("1");
  });

  it("Android strings.xml（.xml 扩展名，无扩展名独占）", async () => {
    const result = await parseFile(
      '<resources><string name="greeting">Hello</string></resources>',
      "strings.xml",
      "application/xml"
    );
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].sourceText).toBe("Hello");
  });

  it("TSV 扩展名直配 parseTSV", async () => {
    const result = await parseFile("source\ttarget\nHello\t你好", "t.tsv", "text/tab-separated-values");
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].targetText).toBe("你好");
  });

  it("未认领扩展名走文本兜底 parseTextFile", async () => {
    const result = await parseFile("Hello world", "t.xyz");
    expect(result.success).toBe(true);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("结构未命中 + .resx 扩展名 → 扩展名提示 → 校验失败回退通用XML（silent 门控：静默不弹 toast）", async () => {
    notifications.length = 0;
    const result = await parseFile(
      "<weird><data>x</data></weird>",
      "t.resx",
      "application/xml"
    );
    expect(result.success).toBe(true);
    // silent: true 时 warnFallback 仅记录日志，不弹 toast（避免源文件编辑器叠提示）
    expect(notifications.filter((n) => n.type === "warning").length).toBe(0);
  });

  it("非 silent 时保留 warnFallback 回退提示（结构未命中 + 校验失败两条）", async () => {
    notifications.length = 0;
    const result = await App.impl.parseFileAsync(
      new File(["<weird><data>x</data></weird>"], "t.resx", { type: "application/xml" }),
      { skipPersist: true } // 不传 silent，走正常提示路径
    );
    expect(result.success).toBe(true);
    // 两条回退提示：结构识别未命中（按扩展名尝试）+ RESX 结构校验失败
    const warning = notifications.filter((n) => n.type === "warning");
    expect(warning.length).toBe(2);
    expect(warning[0].message).toContain("结构识别未命中，尝试按扩展名解析(RESX)。");
    expect(warning[1].message).toContain("RESX结构校验失败");
  });
});
