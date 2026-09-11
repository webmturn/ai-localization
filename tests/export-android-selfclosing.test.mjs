/**
 * Android 导出：自闭合元素与 formatted 注入的回归测试（P0/P1 修复）
 *
 * 修复前：
 *  - 内容正则 `>…</tag>` 遇到合法的自闭合元素（<string name="x"/>）会跨过它去匹配**下一个**
 *    </tag>，把后面的元素连同译文一起吞掉 → 非良构 XML + 译文丢失
 *  - <item/> 这类自闭合项不计入下标，导致数组下标整体前移、译文写进错误的条目
 *  - safeAndroidValue 只要「片段能解析」就置 hasMarkup → 每个 <string> 都被注入 formatted="false"
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-formats.js");
});

const FILE = "strings.xml";
const XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="a">Hello</string>
    <string name="empty"/>
    <string name="b">KONG</string>
    <string name="plain">Plain text</string>
    <string name="markup">Click <b>here</b> now</string>
    <string-array name="arr">
        <item/>
        <item>Second</item>
    </string-array>
    <plurals name="p">
        <item quantity="one"/>
        <item quantity="other">%d items</item>
    </plurals>
</resources>`;

const setFile = () => {
  globalThis.AppState.fileMetadata = { [FILE]: { originalContent: XML } };
};

const item = (resourceId, targetText) => ({
  sourceText: "x",
  targetText,
  status: "translated",
  metadata: { file: FILE, resourceId },
});

const isWellFormed = (xml) =>
  !new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror");

/** 取某个 name 的 <string> 内容（成对或自闭合都能识别） */
const stringInner = (out, name) => {
  const m = out.match(
    new RegExp('<string[^>]*name="' + name + '"[^>]*?(/?)>([\\s\\S]*?)</string>')
  );
  if (!m) return out.includes(`name="${name}"`) ? "" : null; // 自闭合 → 空内容
  return m[2];
};

describe("Android 导出：自闭合 <string/>（P0 回归）", () => {
  beforeEach(setFile);

  it("写入自闭合字符串：展开为成对形式，且不吞掉后面的元素", () => {
    const out = generateAndroidStringsXML([item("empty", "空值")], XML);
    expect(isWellFormed(out)).toBe(true);
    expect(out).toContain('<string name="empty">空值</string>');
    // 关键：后面的 b 与它的原文必须完好（修复前会被吞掉并破坏结构）
    expect(stringInner(out, "b")).toBe("KONG");
    expect(out).toContain('<string name="a">Hello</string>');
  });

  it("目标在自闭合元素之后时，前面的自闭合元素不受影响", () => {
    const out = generateAndroidStringsXML([item("b", "译文B")], XML);
    expect(isWellFormed(out)).toBe(true);
    expect(out).toContain('<string name="empty"/>');
    expect(stringInner(out, "b")).toBe("译文B");
  });

  it("自闭合字符串 + 只导出不改动时保持原样", () => {
    const out = generateAndroidStringsXML([], XML);
    expect(out).toBe(XML);
    expect(out).toContain('<string name="empty"/>');
  });
});

describe("Android 导出：自闭合 <item/> 的下标一致性（P0 回归）", () => {
  beforeEach(setFile);

  it("数组下标 1 不会因为前面的 <item/> 而前移", () => {
    const out = generateAndroidStringsXML([item("arr:1", "第二项")], XML);
    expect(isWellFormed(out)).toBe(true);
    const inner = out.match(/<string-array name="arr">([\s\S]*?)<\/string-array>/)[1];
    const items = inner.match(/<item\b[^>]*?(\/>|>[\s\S]*?<\/item>)/g);
    expect(items).toHaveLength(2);
    expect(items[0]).toBe("<item/>"); // 第 0 项保持自闭合
    expect(items[1]).toBe("<item>第二项</item>");
  });

  it("自闭合的复数 <item quantity/> 能被展开写入，兄弟项不受影响", () => {
    const out = generateAndroidStringsXML([item("p[one]", "一项")], XML);
    expect(isWellFormed(out)).toBe(true);
    const inner = out.match(/<plurals name="p">([\s\S]*?)<\/plurals>/)[1];
    expect(inner).toContain('<item quantity="one">一项</item>');
    expect(inner).toContain('<item quantity="other">%d items</item>');
  });
});

describe("Android 导出：formatted 只在真有内联标记时注入（P1 回归）", () => {
  beforeEach(setFile);

  it("纯文本字符串不被注入 formatted", () => {
    const out = generateAndroidStringsXML([item("plain", "纯文本")], XML);
    const line = out.split("\n").find((l) => l.includes('name="plain"'));
    expect(line).not.toContain("formatted");
    expect(line).toContain("纯文本");
  });

  it("含内联标记的字符串仍会注入 formatted=\"false\"", () => {
    const out = generateAndroidStringsXML([item("markup", "点击<b>这里</b>")], XML);
    const line = out.split("\n").find((l) => l.includes('name="markup"'));
    expect(line).toContain('formatted="false"');
    expect(line).toContain("<b>这里</b>");
  });

  it("同一份文件里只注入到含标记的那一条", () => {
    const out = generateAndroidStringsXML(
      [item("plain", "纯文本"), item("markup", "点击<b>这里</b>")],
      XML
    );
    const injected = (out.match(/formatted="false"/g) || []).length;
    expect(injected).toBe(1);
  });
});
