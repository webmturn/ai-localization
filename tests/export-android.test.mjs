/**
 * Android strings.xml 导出回归测试（本次修复新增）
 *
 * 修复前：
 *  - 正则用 [^<]* 匹配内容 → 含内联标记（<b>、<xliff:g>）的字符串永不被写回
 *  - string-array / plurals 条目的 resourceId 是 "a[0]" / "p[one]" 形式，
 *    只按 <string name> 查找 → 这些条目全部静默丢弃
 *  - resourceId 与 name 相同形式的普通字符串正常，但实体处理与内联标记无法保留
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  // escapeXml / escapeCsv 定义在 export/shared.js，应用启动时是急加载的
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-formats.js");
  loadSource("public/app/features/translations/export/translation-original.js");
});

const FILE = "strings.xml";
const XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="app_name">MyApp</string>
    <string name="plain">Hello</string>
    <string name="entities">Fish &amp; Chips &lt;tag&gt;</string>
    <string name="markup">Click <b>here</b> now</string>
    <string name="with_xliff">Use <xliff:g id="n">%1$s</xliff:g> items</string>
    <string-array name="colors">
        <item>Red</item>
        <item>Green</item>
    </string-array>
    <plurals name="count">
        <item quantity="one">%d item</item>
        <item quantity="other">%d items</item>
    </plurals>
</resources>`;

function setFile() {
  globalThis.AppState.fileMetadata = { [FILE]: { originalContent: XML } };
}

function item(resourceId, targetText) {
  return {
    sourceText: "x",
    targetText,
    status: "translated",
    metadata: { file: FILE, resourceId },
  };
}

/** 从导出结果中取出指定 name 的 <string> 原始内容 */
function stringInner(out, name) {
  const m = out.match(new RegExp('<string[^>]*name="' + name + '"[^>]*>([\\s\\S]*?)</string>'));
  return m ? m[1] : null;
}

describe("Android 导出：普通字符串", () => {
  beforeEach(setFile);

  it("普通字符串被写回", () => {
    const out = generateAndroidStringsXML([item("plain", "你好")], XML);
    expect(stringInner(out, "plain")).toBe("你好");
  });

  it("译文中的 XML 特殊字符被转义，不会破坏文档", () => {
    const out = generateAndroidStringsXML([item("plain", "a < b & c > d")], XML);
    const inner = stringInner(out, "plain");
    expect(inner).toContain("&lt;");
    expect(inner).toContain("&amp;");
    // 文档仍可被解析
    const doc = new DOMParser().parseFromString(out, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });

  it("未翻译项保持原样（含实体）", () => {
    const out = generateAndroidStringsXML([item("plain", "你好")], XML);
    expect(out).toContain("Fish &amp; Chips &lt;tag&gt;");
  });

  it("含内联标记的字符串可被写回（回归：此前 [^<]* 匹配不到）", () => {
    const out = generateAndroidStringsXML([item("markup", "请点击 <b>这里</b>")], XML);
    const inner = stringInner(out, "markup");
    expect(inner).not.toBe("Click <b>here</b> now");
    expect(inner).toContain("请点击");
    expect(inner).toContain("<b>");
    expect(inner).toContain("这里");
  });

  it("含内联标记时自动加上 formatted=\"false\"", () => {
    const out = generateAndroidStringsXML([item("markup", "请点击 <b>这里</b>")], XML);
    const tag = out.match(/<string[^>]*name="markup"[^>]*>/)[0];
    expect(tag).toContain('formatted="false"');
  });

  it("含 xliff:g 占位符的字符串可被写回且保留标记", () => {
    const out = generateAndroidStringsXML(
      [item("with_xliff", '使用 <xliff:g id="n">%1$s</xliff:g> 项')],
      XML
    );
    const inner = stringInner(out, "with_xliff");
    expect(inner).toContain("xliff:g");
    expect(inner).toContain("%1$s");
  });
});

describe("Android 导出：string-array 与 plurals（回归：此前全部丢弃）", () => {
  beforeEach(setFile);

  it("string-array 指定下标被写回，其他 item 不受影响", () => {
    const out = generateAndroidStringsXML([item("colors:0", "红色")], XML);
    const arr = out.match(/<string-array[^>]*name="colors"[^>]*>([\s\S]*?)<\/string-array>/)[1];
    expect(arr).toContain("红色");
    // 第二个 item 必须保留
    expect(arr).toContain("Green");
  });

  it("string-array 两个下标分别写回", () => {
    const out = generateAndroidStringsXML(
      [item("colors:0", "红色"), item("colors:1", "绿色")],
      XML
    );
    const arr = out.match(/<string-array[^>]*name="colors"[^>]*>([\s\S]*?)<\/string-array>/)[1];
    expect(arr).toContain("红色");
    expect(arr).toContain("绿色");
  });

  it("plurals 按 quantity 写回", () => {
    const out = generateAndroidStringsXML(
      [item("count[one]", "一条"), item("count[other]", "多条")],
      XML
    );
    const pl = out.match(/<plurals[^>]*name="count"[^>]*>([\s\S]*?)<\/plurals>/)[1];
    expect(pl).toMatch(/quantity="one"[^>]*>一条</);
    expect(pl).toMatch(/quantity="other"[^>]*>多条</);
  });

  it("数组/复数写回后文档仍可解析", () => {
    const out = generateAndroidStringsXML(
      [item("colors:0", "红色"), item("count[one]", "一条")],
      XML
    );
    const doc = new DOMParser().parseFromString(out, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });

  it("不存在的下标不会破坏文档", () => {
    const out = generateAndroidStringsXML([item("colors:9", "不存在")], XML);
    const doc = new DOMParser().parseFromString(out, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(out.match(/<string-array[^>]*name="colors"[^>]*>([\s\S]*?)<\/string-array>/)[1])
      .toContain("Green");
  });
});

describe("Android 导出：解析器 → 导出 往返", () => {
  it("解析得到的 resourceId 能被导出器识别（三类资源）", () => {
    // 手工构造与解析器一致形状的条目，覆盖三类 resourceId 形态
    const items = [
      item("app_name", "我的应用"),
      item("colors:1", "绿色"),
      item("count[other]", "多条"),
    ];
    const out = generateAndroidStringsXML(items, XML);
    expect(stringInner(out, "app_name")).toBe("我的应用");
    expect(out).toMatch(/quantity="other"[^>]*>多条</);
    const arr = out.match(/<string-array[^>]*name="colors"[^>]*>([\s\S]*?)<\/string-array>/)[1];
    expect(arr).toContain("绿色");
  });
});
