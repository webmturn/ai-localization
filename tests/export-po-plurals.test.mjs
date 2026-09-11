/**
 * PO 复数条目导出回归测试（P0 修复）
 *
 * 修复前：定位 msgstr 时只跳过空行，而复数条目的 msgid 下一行是 `msgid_plural`，
 * 于是匹配不到 msgstr 直接 return null —— 主译文（msgstr[0]）**静默不写回**，
 * 而 msgstr[1] 仍会被写（走 __poReplaceMsgstrBlockWithIndex），得到半新半旧的文件。
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-original.js");
});

const FILE = "plural.po";
const PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

msgid "Hello"
msgstr "你好"

#: src/count.js:12
msgid "%n file"
msgid_plural "%n files"
msgstr[0] "old one"
msgstr[1] "old many"

msgid "Tail"
msgstr "尾部"
`;

const setFile = () => {
  globalThis.AppState.fileMetadata = { [FILE]: { originalContent: PO } };
};

const item = (sourceText, targetText, metadata = {}) => ({
  sourceText,
  targetText,
  status: "translated",
  metadata: { file: FILE, ...metadata },
});

/** 取指定 msgid 的 msgstr[N] 内容 */
const msgstr = (out, msgid, index = null) => {
  const block = out.split(/\n\s*\n/).find((b) => b.includes(`msgid "${msgid}"`));
  if (!block) return null;
  const re = index === null ? /msgstr\s+"((?:\\.|[^"\\])*)"/ : new RegExp(`msgstr\\[${index}\\]\\s+"((?:\\\\.|[^"\\\\])*)"`);
  const m = block.match(re);
  return m ? m[1] : null;
};

describe("PO 复数条目：msgstr[0] 必须被写回（P0 回归）", () => {
  beforeEach(setFile);

  it("主译文写入 msgstr[0]，复数译文写入 msgstr[1]", () => {
    const out = generatePOFromOriginal(
      [item("%n file", "单数：%n 个文件", { pluralTarget: "复数：%n 个文件" })],
      FILE
    );
    expect(msgstr(out, "%n file", 0)).toBe("单数：%n 个文件");
    expect(msgstr(out, "%n file", 1)).toBe("复数：%n 个文件");
  });

  it("只改主译文时 msgstr[1] 保持原样（不被清空/覆盖）", () => {
    const out = generatePOFromOriginal([item("%n file", "新单数")], FILE);
    expect(msgstr(out, "%n file", 0)).toBe("新单数");
    expect(msgstr(out, "%n file", 1)).toBe("old many");
  });

  it("复数条目之后的普通条目不受影响", () => {
    const out = generatePOFromOriginal(
      [item("%n file", "新单数", { pluralTarget: "新复数" }), item("Tail", "新尾部")],
      FILE
    );
    expect(msgstr(out, "Tail")).toBe("新尾部");
    expect(msgstr(out, "Hello")).toBe("你好");
  });

  it("带 #: 注释的条目同样能被定位", () => {
    const out = generatePOFromOriginal([item("Hello", "新你好")], FILE);
    expect(msgstr(out, "Hello")).toBe("新你好");
  });

  it("不存在的 msgid 不会破坏文件结构", () => {
    const out = generatePOFromOriginal([item("NotThere", "x")], FILE);
    expect(out).toBe(PO);
  });
});
