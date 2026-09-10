/**
 * 导出回写回归测试（本次修复新增）
 *
 * 覆盖三个此前完全未被测试覆盖、且都会「静默产出错误文件」的缺陷：
 *  1. JSON「原格式」导出写入 0 条译文  —— setValueByPath 不认以 $ 为根的路径
 *  2. Qt TS 复数消息被写坏            —— 整段拼接文本被塞进每个 <numerusform>
 *  3. XLIFF 源文含实体/内联标签时译文丢失 —— 解析存序列化 XML，导出却用 textContent 比对
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
  globalThis.AppState.fileMetadata = {
    [fileName]: { originalContent },
  };
}

describe("JSON「原格式」导出（回归：此前写入 0 条译文）", () => {
  const FILE = "app.json";
  const ORIGINAL = JSON.stringify(
    {
      app: { title: "Hello", nested: { deep: "World" } },
      menu: [{ label: "Open" }, { label: "Save" }],
      plain: "Top",
    },
    null,
    2
  );

  function item(path, targetText, status = "translated") {
    return { sourceText: "x", targetText, status, metadata: { file: FILE, path } };
  }

  beforeEach(() => setFile(FILE, ORIGINAL));

  it("按 $.a.b 路径写回译文", () => {
    const out = generateJSONFromOriginal([item("$.app.title", "你好")], FILE);
    const parsed = JSON.parse(out);
    expect(parsed.app.title).toBe("你好");
    // 未翻译项保持不变
    expect(parsed.app.nested.deep).toBe("World");
  });

  it("按 $.a[0].b 数组下标路径写回译文", () => {
    const out = generateJSONFromOriginal(
      [item("$.menu[0].label", "打开"), item("$.menu[1].label", "保存")],
      FILE
    );
    const parsed = JSON.parse(out);
    expect(parsed.menu[0].label).toBe("打开");
    expect(parsed.menu[1].label).toBe("保存");
  });

  it("深层次路径写回", () => {
    const out = generateJSONFromOriginal([item("$.app.nested.deep", "世界")], FILE);
    expect(JSON.parse(out).app.nested.deep).toBe("世界");
  });

  it("根级字符串路径写回（$ 后直接是键）", () => {
    const out = generateJSONFromOriginal([item("$.plain", "顶层")], FILE);
    expect(JSON.parse(out).plain).toBe("顶层");
  });

  it("译文必须真的出现在导出内容里（防止再次静默不写入）", () => {
    const out = generateJSONFromOriginal([item("$.app.title", "独特标记XYZ")], FILE);
    expect(out).toContain("独特标记XYZ");
  });

  it("空译文 / 无 path 的条目被跳过且不影响其他项", () => {
    const out = generateJSONFromOriginal(
      [item("$.app.title", ""), { sourceText: "x", targetText: "y", metadata: { file: FILE } }],
      FILE
    );
    const parsed = JSON.parse(out);
    expect(parsed.app.title).toBe("Hello");
  });

  it("不存在的路径不抛错", () => {
    const out = generateJSONFromOriginal([item("$.nope.nothere", "x")], FILE);
    expect(JSON.parse(out).app.title).toBe("Hello");
  });
});

describe("Qt TS 复数导出（回归：此前把整段文本写进每个 numerusform）", () => {
  const FILE = "app.ts";
  const XML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
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
</context>
</TS>`;

  function item(targetText, opts = {}) {
    return {
      sourceText: "%n file(s)",
      targetText,
      status: "translated",
      metadata: {
        file: FILE,
        position: "context-1-message-1",
        ...opts,
      },
    };
  }

  beforeEach(() => setFile(FILE, XML));

  it("段数与形态数一致时按序写回各形态（不重复整段）", () => {
    const out = generateQtTsFromOriginal([item("%n 个文件\n%n 个文件们")], FILE);
    const forms = out.match(/<numerusform>([^<]*)<\/numerusform>/g);
    expect(forms).toHaveLength(2);
    expect(forms[0]).toContain("%n 个文件<");
    expect(forms[1]).toContain("%n 个文件们<");
  });

  it("段数与形态数不一致时保守保留原形态（避免破坏既有译文）", () => {
    const out = generateQtTsFromOriginal([item("单一译文")], FILE);
    const forms = out.match(/<numerusform>([^<]*)<\/numerusform>/g);
    expect(forms).toHaveLength(2);
    // 原形态内容必须保留，而不是被写成同一段文本
    expect(forms[0]).toContain("%n file<");
    expect(forms[1]).toContain("%n files<");
  });

  it("非复数消息仍走普通 textContent 写入", () => {
    const plainXml = `<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="en_US">
<context>
    <name>Main</name>
    <message>
        <source>Open</source>
        <translation type="unfinished"></translation>
    </message>
</context>
</TS>`;
    setFile(FILE, plainXml);
    const out = generateQtTsFromOriginal(
      [
        {
          sourceText: "Open",
          targetText: "打开",
          status: "translated",
          metadata: { file: FILE, position: "context-1-message-1" },
        },
      ],
      FILE
    );
    expect(out).toContain("打开");
  });
});

describe("XLIFF 导出（回归：实体/内联标签源文译文丢失）", () => {
  const FILE = "app.xlf";
  const XML_12 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="zh" datatype="plaintext">
    <body>
      <trans-unit id="u1">
        <source>Fish &amp; Chips</source>
        <target></target>
      </trans-unit>
      <trans-unit id="u2">
        <source>Open</source>
        <target></target>
      </trans-unit>
      <trans-unit id="u3">
        <source>Open</source>
        <target></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

  beforeEach(() => setFile(FILE, XML_12));

  it("带 XML 实体的源文可以匹配并写回译文", () => {
    const items = [
      {
        sourceText: "Fish &amp; Chips",
        targetText: "炸鱼薯条",
        status: "translated",
        metadata: { file: FILE, unitId: "u1" },
      },
    ];
    const out = updateXLIFFContent(items, XML_12);
    expect(out).toContain("炸鱼薯条");
  });

  it("重复源文按 unitId 分别写入，不再全部写成同一条译文", () => {
    const items = [
      {
        sourceText: "Open",
        targetText: "打开",
        status: "translated",
        metadata: { file: FILE, unitId: "u2" },
      },
      {
        sourceText: "Open",
        targetText: "开启",
        status: "translated",
        metadata: { file: FILE, unitId: "u3" },
      },
    ];
    const out = updateXLIFFContent(items, XML_12);
    expect(out).toContain("打开");
    expect(out).toContain("开启");
    // 两个 unit 各自拿到不同译文
    const targets = out.match(/<target[^>]*>([^<]*)<\/target>/g) || [];
    const texts = targets.map((t) => t.replace(/<[^>]*>/g, ""));
    expect(texts).toContain("打开");
    expect(texts).toContain("开启");
  });

  it("已存在的 target 不会被二次转义（& 不应变成 &amp;amp;）", () => {
    const withTarget = XML_12.replace(
      "<source>Fish &amp; Chips</source>\n        <target></target>",
      "<source>Fish &amp; Chips</source>\n        <target>Tom &amp; Jerry</target>"
    );
    const items = [
      {
        sourceText: "Fish &amp; Chips",
        targetText: "Tom & Jerry",
        status: "translated",
        metadata: { file: FILE, unitId: "u1" },
      },
    ];
    const out = updateXLIFFContent(items, withTarget);
    expect(out).toContain("Tom &amp; Jerry");
    expect(out).not.toContain("&amp;amp;");
  });

  it("XLIFF 2.0（unit/segment）也能写入，而不是整体空操作", () => {
    const xliff20 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en" trgLang="zh">
  <file id="f1">
    <unit id="u1">
      <segment>
        <source>Hello</source>
        <target></target>
      </segment>
    </unit>
  </file>
</xliff>`;
    setFile(FILE, xliff20);
    const items = [
      {
        sourceText: "Hello",
        targetText: "你好",
        status: "translated",
        metadata: { file: FILE, unitId: "u1" },
      },
    ];
    const out = updateXLIFFContent(items, xliff20);
    expect(out).toContain("你好");
  });
});

// 回归：反复导出必须幂等 —— 对「已经含 target 的文件」再次导出，
// 不能出现二次转义（& → &amp;amp;）或把内联标记拍平成文本。
describe("XLIFF 重复导出幂等性（回归）", () => {
  const FILE = "idem.xlf";
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="zh" datatype="plaintext">
    <body>
      <trans-unit id="u1">
        <source>Fish &amp; Chips</source>
        <target></target>
      </trans-unit>
      <trans-unit id="u2">
        <source>Click <g id="1">here</g> now</source>
        <target></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

  function items() {
    return [
      {
        sourceText: "Fish &amp; Chips",
        targetText: "Tom & Jerry",
        status: "translated",
        metadata: { file: FILE, unitId: "u1" },
      },
      {
        sourceText: 'Click <g id="1">here</g> now',
        // 内联标记用单引号属性：双引号出现在文本内容里会被合法地转义成 &quot;
        // （属性用单引号时无需转义），那是正确行为而非缺陷。
        targetText: "请点击 <g id='1'>这里</g>",
        status: "translated",
        metadata: { file: FILE, unitId: "u2" },
      },
    ];
  }

  it("同一份 items 连续导出两次结果完全一致", () => {
    const first = updateXLIFFContent(items(), XML);
    const second = updateXLIFFContent(items(), first);
    expect(second).toBe(first);
  });

  it("第二次导出不产生二次转义", () => {
    const first = updateXLIFFContent(items(), XML);
    const second = updateXLIFFContent(items(), first);
    expect(second).not.toContain("&amp;amp;");
    expect(second).not.toContain("&amp;lt;");
  });

  it("内联 <g> 标记不被拍平成转义文本", () => {
    const first = updateXLIFFContent(items(), XML);
    const second = updateXLIFFContent(items(), first);
    expect(second).toContain("<g");
    expect(second).not.toContain("&lt;g");
  });

  it("三次导出仍然稳定（无累积漂移）", () => {
    const a = updateXLIFFContent(items(), XML);
    const b = updateXLIFFContent(items(), a);
    const c = updateXLIFFContent(items(), b);
    expect(c).toBe(a);
  });

  it("导出结果仍是良构 XML", () => {
    const out = updateXLIFFContent(items(), XML);
    const doc = new DOMParser().parseFromString(out, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });
});
