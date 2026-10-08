/**
 * PO 导入：带注释的条目必须能被解析（P1 回归）
 *
 * 修复前：`if (!entry || entry.startsWith("#")) continue;` —— 只要条目以注释开头就整条跳过。
 * 而 xgettext 生成的 PO 每个条目都带 `#: 引用位置`，于是：
 *   - 全部条目带注释的标准 PO 文件 → 解析出 0 条 → 抛「未找到有效的PO条目」；
 *   - 部分条目带注释 → 静默丢条目（用户看不到任何警告）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/parsers/parser-registry.js");
  loadSource("public/app/parsers/parser-utils.js");
  loadSource("public/app/parsers/po.js");
});

const XGETTEXT_STYLE = `# Chinese translations for demo.
# Copyright (C) 2026
# This file is distributed under the same license as the demo package.
#
msgid ""
msgstr ""
"Project-Id-Version: demo 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#: src/main.js:10
msgid "Hello"
msgstr "你好"

#. Menu entry
#: src/menu.js:42
msgid "Open"
msgstr "打开"

#, fuzzy
#: src/legacy.js:7
msgid "Legacy"
msgstr "旧"

#: src/count.js:12
msgid "%n file"
msgid_plural "%n files"
msgstr[0] "%n 个文件"
msgstr[1] "%n 个文件"
`;

describe("PO 导入：注释条目（P1 回归）", () => {
  it("标准 xgettext 风格文件（每条都带注释）能被完整解析", () => {
    const items = parsePO(XGETTEXT_STYLE, "demo.po");
    expect(items.map((i) => i.sourceText)).toEqual(["Hello", "Open", "Legacy", "%n file", "%n files"]);
  });

  it("头部元数据条目（msgid 为空）仍被跳过", () => {
    const items = parsePO(XGETTEXT_STYLE, "demo.po");
    expect(items.some((i) => i.sourceText.trim() === "")).toBe(false);
  });

  it("带注释的复数条目保留 msgid_plural 与 msgstr[1]", () => {
    const items = parsePO(XGETTEXT_STYLE, "demo.po");
    const plural = items.find((i) => i.sourceText === "%n file");
    expect(plural).toBeTruthy();
    expect(plural.metadata.plural).toBe("%n files");
    expect(plural.metadata.pluralTarget).toBe("%n 个文件");
  });

  it("msgctxt 仍被记录", () => {
    const po = `msgid "Open"\nmsgctxt "menu"\nmsgstr "打开"\n`;
    const items = parsePO(po, "t.po");
    expect(items[0].metadata.msgctxt).toBe("menu");
  });

  it("纯注释块不会产生幽灵条目", () => {
    const po = `msgid "A"\nmsgstr "a"\n\n# 只有注释\n#: x.js:1\n\nmsgid "B"\nmsgstr "b"\n`;
    const items = parsePO(po, "t.po");
    expect(items.map((i) => i.sourceText)).toEqual(["A", "B"]);
  });

  it("混合注释风格（#: / #. / #, / #）都能解析", () => {
    const po = `#: a.js:1\nmsgid "One"\nmsgstr "1"\n\n#. note\nmsgid "Two"\nmsgstr "2"\n\n#, fuzzy\nmsgid "Three"\nmsgstr "3"\n\n# plain\nmsgid "Four"\nmsgstr "4"\n`;
    const items = parsePO(po, "t.po");
    expect(items.map((i) => i.sourceText)).toEqual(["One", "Two", "Three", "Four"]);
  });

  it("仍然拒绝完全没有条目的内容", () => {
    expect(() => parsePO("# 只有注释\n", "t.po")).toThrow(/未找到有效的PO条目/);
  });
});
