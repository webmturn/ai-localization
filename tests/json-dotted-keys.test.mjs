/**
 * JSON/YAML 导出：键名含 `.` / `[` 的路径歧义回归测试（P1 修复）
 *
 * 修复前：`parsers/json.js` 用 `path + "." + key` 拼路径，键名里的 `.`/`[` 不转义，
 * 导出端再按 `.`/`[` 拆开，于是：
 *   - `{"menu.file.open":"Open"}` 这类扁平键名 → 译文写不回去（文件与输入几乎一致）；
 *   - `{"a.b":"x","a":{"b":{"c":"z"}}}` 这类键名与真实路径冲突 → 子树被摧毁。
 * 现在解析器同时输出 metadata.pathTokens，导出端优先按真实键/下标回写；
 * 路径字符串里的 `.`/`[` 也会转义（`\.` / `\[`），旧数据仍可解析。
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  globalThis.window = globalThis;
  globalThis.window.App = globalThis.window.App || { services: {} };
  globalThis.window.jsyaml = { load: () => ({}), dump: (obj) => JSON.stringify(obj) };
  loadSource("public/app/parsers/parser-registry.js");
  loadSource("public/app/parsers/parser-utils.js");
  loadSource("public/app/parsers/json.js");
  loadSource("public/app/parsers/yaml.js");
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-original.js");
});

beforeEach(() => {
  globalThis.window = globalThis;
  globalThis.window.App = globalThis.window.App || { services: {} };
  globalThis.window.jsyaml = { load: () => ({}), dump: (obj) => JSON.stringify(obj) };
});

const FILE = "flat.json";

/** 走真实解析 → 翻译 → 导出的往返 */
function roundTrip(content, translateAll = (src) => "T:" + src, fileName = FILE) {
  const items = parseJSON(content, fileName);
  globalThis.AppState.fileMetadata = { [fileName]: { originalContent: content } };
  for (const it of items) it.targetText = translateAll(it.sourceText);
  return { items, out: generateJSONFromOriginal(items, fileName), parsed: null };
}

describe("JSON 扁平键名（含点号）往返", () => {
  const FLAT = JSON.stringify({ "menu.file.open": "Open", "menu.file.save": "Save", home: "Home" }, null, 2);

  it("解析出的 pathTokens 把带点的键当成一个键", () => {
    const items = parseJSON(FLAT, FILE);
    const open = items.find((i) => i.sourceText === "Open");
    expect(open.metadata.pathTokens).toEqual(["menu.file.open"]);
    // 路径字符串里的点被转义，仍可读且无歧义
    expect(open.metadata.path).toBe("$.menu\\.file\\.open");
  });

  it("三条译文全部写回（修复前只写回 1 条）", () => {
    const { out } = roundTrip(FLAT);
    const parsed = JSON.parse(out);
    expect(parsed["menu.file.open"]).toBe("T:Open");
    expect(parsed["menu.file.save"]).toBe("T:Save");
    expect(parsed.home).toBe("T:Home");
    expect(Object.keys(parsed)).toEqual(["menu.file.open", "menu.file.save", "home"]);
  });
});

describe("JSON 键名与真实路径冲突时不再摧毁子树", () => {
  const COLLIDE = JSON.stringify({ "a.b": "x", a: { b: { c: "z" } } }, null, 2);

  it("扁平键与嵌套键各写各的", () => {
    const { out } = roundTrip(COLLIDE);
    const parsed = JSON.parse(out);
    expect(parsed["a.b"]).toBe("T:x");
    expect(parsed.a.b.c).toBe("T:z");
  });

  it("数组下标与带点的键混用", () => {
    const content = JSON.stringify({ list: [{ "a.b": "one" }, { "a.b": "two" }] }, null, 2);
    const { out } = roundTrip(content);
    const parsed = JSON.parse(out);
    expect(parsed.list[0]["a.b"]).toBe("T:one");
    expect(parsed.list[1]["a.b"]).toBe("T:two");
  });

  it("键名含方括号时也能写回", () => {
    const content = JSON.stringify({ "a[0]": "x", arr: ["y"] }, null, 2);
    const { out } = roundTrip(content);
    const parsed = JSON.parse(out);
    expect(parsed["a[0]"]).toBe("T:x");
    expect(parsed.arr[0]).toBe("T:y");
  });
});

describe("旧数据（只有转义的 path、没有 pathTokens）仍可导出", () => {
  const item = (path, targetText) => ({
    sourceText: "src",
    targetText,
    status: "translated",
    metadata: { file: FILE, path },
  });

  it("转义路径 $.menu\\.file\\.open 写到扁平键", () => {
    const content = JSON.stringify({ "menu.file.open": "Open" }, null, 2);
    globalThis.AppState.fileMetadata = { [FILE]: { originalContent: content } };
    const out = generateJSONFromOriginal([item("$.menu\\.file\\.open", "译文")], FILE);
    expect(JSON.parse(out)["menu.file.open"]).toBe("译文");
  });

  it("未转义的嵌套路径行为不变", () => {
    const content = JSON.stringify({ app: { title: "Hello" } }, null, 2);
    globalThis.AppState.fileMetadata = { [FILE]: { originalContent: content } };
    const out = generateJSONFromOriginal([item("$.app.title", "你好")], FILE);
    expect(JSON.parse(out).app.title).toBe("你好");
  });
});

describe("YAML 导出：带点的键不再被拆成嵌套", () => {
  const yamlItem = (tokens, path, targetText) => ({
    sourceText: "src",
    targetText,
    status: "translated",
    metadata: { path, pathTokens: tokens },
  });

  it("pathTokens 为单个带点键时输出扁平键", async () => {
    const out = await exportYAML([yamlItem(["a.b"], "$.a\\.b", "T0")]);
    expect(JSON.parse(out)).toEqual({ "a.b": "T0" });
  });

  it("无 pathTokens 时按转义路径解析", async () => {
    const out = await exportYAML([
      { sourceText: "src", targetText: "T0", status: "translated", metadata: { path: "$.a\\.b" } },
    ]);
    expect(JSON.parse(out)).toEqual({ "a.b": "T0" });
  });

  it("嵌套与数组下标仍然正确", async () => {
    const out = await exportYAML([
      yamlItem(["app", "title"], "$.app.title", "你好"),
      yamlItem(["list", 0, "name"], "$.list[0].name", "第一"),
    ]);
    expect(JSON.parse(out)).toEqual({ app: { title: "你好" }, list: [{ name: "第一" }] });
  });

  it("根级数组单独导出（容器本身是数组）", async () => {
    const out = await exportYAML([yamlItem([0, "name"], "$[0].name", "根数组")]);
    expect(JSON.parse(out)).toEqual([{ name: "根数组" }]);
  });
});
