# Functional review — file-format parsers & translation export paths

Scope: `public/app/parsers/*.js`, `public/app/features/translations/export/*.js`,
`public/app/features/files/parse.js`, `public/app/features/files/read.js`.

Method: every finding below was reproduced by loading the real source files into Node with
`vm.runInThisContext` over a jsdom DOM (the same loading pattern as `tests/setup.mjs` /
`vitest.config.mjs`), feeding real inputs to the real parser/export functions and printing the
real output. 27 defects were confirmed; nothing in this report is inferred from reading alone.
The scratch harness was deleted after the review — the appendix contains the exact harness and
the standalone repro snippets so every finding can be re-run in a few seconds.

Baseline: `node node_modules/vitest/vitest.mjs run tests/parsers-formats.test.mjs
tests/parser-utils.test.mjs tests/parser-registry.test.mjs` → **61 passed**. All defects below
live in code paths the existing tests do not exercise (parse-only tests, no parse→edit→export→
re-parse round trips).

---

## CRITICAL

### 1. JSON "original format" export writes **zero** translations (100 % data loss)

**Severity**: critical
**Location**: `public/app/features/translations/export/translation-original.js:266-288`
(`setValueByPath`, called from `generateJSONFromOriginal`) together with
`public/app/parsers/json.js:52` (`traverseValue(json, "$")`).

**Reproduction**

```js
const original = `{"app":{"title":"Hello"},"menu":["Open","Save"]}`;
const items = parseJSON(original, "en.json");       // paths: $.app.title, $.menu[0], $.menu[1]
items.forEach(i => { i.targetText = "译:" + i.sourceText; i.status = "translated"; });
AppState.fileMetadata["en.json"] = { extension: "json", originalContent: original };
const out = generateOriginalFormatExport("en.json", items).content;
console.log(out);
```

**Observed**

```
{
  "app": {
    "title": "Hello"
  },
  "menu": [
    "Open",
    "Save"
  ]
}
contains '译:' : false
semantically identical to input: true
```

Every parsed path starts with `$` (`$.app.title`), but `setValueByPath` splits on `.` and walks
`json["$"]`, which is `undefined` → it returns early for **every** item. Array segments are a
second, independent failure: `parts = ["$.menu[0]"]` writes the non-index property `"$[0]"` on
the array, which `JSON.stringify` ignores (`["Open","Save"]` comes back unchanged).

**Expected**: the translated file should contain `"title": "译:Hello"`, `"menu": ["译:Open", …]`.

**Impact**: the "原格式（按导入文件）" export of any `.json` file downloads an untranslated copy of
the source file while the UI reports success. The user ships an untranslated app and has no
signal that anything went wrong.

---

### 2. XLIFF: sources containing XML entities / inline tags / CDATA are never updated

**Severity**: critical
**Location**: `public/app/parsers/xliff.js:19-31` (`serializeChildren`) vs
`public/app/features/translations/export/translation-formats.js:391-394`
(`source.textContent?.trim()` comparison).

**Reproduction**

```js
const content = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2"><file><body>
  <trans-unit id="1"><source>Fish &amp; Chips</source><target/></trans-unit>
  <trans-unit id="2"><source>Click <g id="1">here</g> now</source><target/></trans-unit>
  <trans-unit id="3"><source><![CDATA[Hello & <b>world</b>]]></source><target/></trans-unit>
</body></file></xliff>`;
const items = parseXLIFF(content, "t.xliff");
items.forEach(i => { i.targetText = "译:" + i.sourceText; i.status = "translated"; });
AppState.fileMetadata["t.xliff"] = { extension: "xliff", originalContent: content };
console.log(generateOriginalFormatExport("t.xliff", items).content);
```

**Observed** (all three `<target/>` stay empty; a plain-text unit in the same file *is* updated)

```
<trans-unit id="1"><source>Fish &amp; Chips</source><target/></trans-unit>
<trans-unit id="2"><source>Click <g id="1">here</g> now</source><target/></trans-unit>
<trans-unit id="3"><source><![CDATA[Hello & <b>world</b>]]></source><target/></trans-unit>
```

Parsed `sourceText` values are `"Fish &amp; Chips"`, `"Click <g id=\"1\">here</g> now"`,
`"<![CDATA[Hello & <b>world</b>]]>"` — i.e. the *serialized XML*, not the text. The exporter
compares them with `source.textContent` (`"Fish & Chips"`, `"Click here now"`,
`"Hello & <b>world</b>"`) so `items.find(...)` never matches and the whole unit is skipped
silently (no warning; only a per-unit `debug` log).

**Expected**: `&amp;` should decode to `&` for display/translation and the unit should be
matched by `metadata.unitId` (or by comparing like with like), so the target is written.

**Impact**: any XLIFF file whose strings contain `&`, `<`, `>` or inline tags (i.e. most real
XLIFF) exports with **no translations at all**, with a success toast. The UI also shows the raw
entity text (`Fish &amp; Chips`) as the source string.

---

### 3. Qt TS: plural (`numerusform`) messages are flattened on import and re-exported into every form — file corrupted with no user action

**Severity**: critical
**Location**: `public/app/parsers/qt-ts.js:13-22` (joins all `numerusform`s with `\n` into one
item) and `public/app/features/translations/export/translation-original.js:150-157` / `:182-189`
(writes that single text into *every* `numerusform`).

**Reproduction** (no editing at all — parse then export)

```js
const ts = `<TS version="2.1" language="zh_CN"><context><name>MainWindow</name>
 <message numerus="yes"><source>%n file(s)</source>
  <translation><numerusform>%n 个文件</numerusform><numerusform>%n 个文件(多)</numerusform></translation>
 </message></context></TS>`;
const items = parseQtTs(ts, "plur.ts");
AppState.fileMetadata["plur.ts"] = { extension: "ts", originalContent: ts };
console.log(generateOriginalFormatExport("plur.ts", items).content);
```

**Observed**

```
    <message numerus="yes">
        <source>%n file(s)</source>
        <translation>
            <numerusform>%n 个文件
%n 个文件(多)</numerusform>
            <numerusform>%n 个文件
%n 个文件(多)</numerusform>
        </translation>
    </message>
```

**Expected**: each `numerusform` keeps its own plural form; plural messages should be
represented per form (or at least not written back).

**Impact**: a correctly translated Qt `.ts` file is silently destroyed by exporting it — both
singular and plural translations now contain the concatenation of both, which ships as broken
plurals in the application.

---

## HIGH

### 4. XLIFF 2.0 files: export is a complete no-op

**Severity**: high
**Location**: `public/app/features/translations/export/translation-formats.js:384-387`
(`xmlDoc.querySelectorAll("trans-unit")`).

**Reproduction**

```js
const content = `<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en" trgLang="zh">
  <file id="f1"><unit id="u1"><segment><source>Hello</source><target/></segment></unit></file></xliff>`;
const items = parseXLIFF(content, "v2.xliff");       // parser supports unit/segment (xliff.js:66-116)
items[0].targetText = "你好"; items[0].status = "translated";
AppState.fileMetadata["v2.xliff"] = { extension: "xliff", originalContent: content };
console.log(generateOriginalFormatExport("v2.xliff", items).content);
```

**Observed**: output is byte-identical to the input apart from the dropped XML declaration —
`<target/>` is untouched (`querySelectorAll("trans-unit")` returns 0 nodes, the `forEach` body
never runs, the original document is re-serialized).

**Expected**: `<target>你好</target>` inside the matching `<segment>`.

**Impact**: XLIFF 2.0 is parsed (so the user can translate the whole file) but nothing is ever
exported; the download silently contains the original, untranslated file.

---

### 5. XLIFF: re-exporting an existing target double-escapes entities and flattens inline markup

**Severity**: high
**Location**: `public/app/features/translations/export/translation-formats.js:404`
(`target.textContent = item.targetText`) combined with `parsers/xliff.js:19-31`.

**Reproduction** / **Observed** (no edit; item target = parsed target)

```
input : <trans-unit id="1"><source>Hello</source><target>Tom &amp; Jerry</target></trans-unit>
output: <trans-unit id="1"><source>Hello</source><target state="translated">Tom &amp;amp; Jerry</target></trans-unit>

input : <source>Hello</source><target>你好 <g id="1">世界</g></target>
output: <source>Hello</source><target state="translated">你好 &lt;g id="1"&gt;世界&lt;/g&gt;</target>
```

**Expected**: `Tom &amp; Jerry` stays `Tom &amp; Jerry`; the `<g>` element stays an element.

**Impact**: every re-export of an XLIFF file that already contains `&`-entities or inline tags
corrupts those targets — the app then displays/renders `&amp;` and literal `<g id="1">` text.
The whole document is affected even for units the user never touched, because the export writes
*all* items that have a target.

---

### 6. XLIFF + generic XML: duplicate source strings all receive the **first** item's translation

**Severity**: high
**Location**: `public/app/features/translations/export/translation-formats.js:394` and `:137`
(`items.find(item => item.sourceText?.trim() === text)`).

**Reproduction**

```js
const content = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2"><file><body>
 <trans-unit id="menu"><source>Open</source><target/></trans-unit>
 <trans-unit id="file"><source>Open</source><target/></trans-unit>
</body></file></xliff>`;
const items = parseXLIFF(content, "dup.xliff");
items[0].targetText = "打开(菜单)"; items[1].targetText = "打开(文件)";
items.forEach(i => i.status = "translated");
AppState.fileMetadata["dup.xliff"] = { extension: "xliff", originalContent: content };
console.log(generateOriginalFormatExport("dup.xliff", items).content);
```

**Observed**

```
<trans-unit id="menu"><source>Open</source><target state="translated">打开(菜单)</target></trans-unit>
<trans-unit id="file"><source>Open</source><target state="translated">打开(菜单)</target></trans-unit>
```

Same for generic XML (`replaceXMLContent`): `<file label="f">打开(菜单)</file>` is written for
`<menu label="m">打开(菜单)</menu>`'s sibling. Android is **not** affected (it matches by
`metadata.resourceId`).

**Expected**: match units by `metadata.unitId` (XLIFF) / per-node path (generic XML).

**Impact**: short duplicate strings ("Open", "Cancel", "OK", "Name") are extremely common; all
but the first occurrence get the wrong translation. The user's distinct per-context translations
are silently replaced.

---

### 7. PO export: target text is not escaped → invalid PO files and corrupted values

**Severity**: high
**Location**: `public/app/features/translations/export/translation-original.js:354-361`
(`const escapedMsgstr = msgstr.replace(/"/g, '\\"');` — only `"` is escaped).

**Reproduction**

```js
const content = 'msgid "Line"\nmsgstr ""\n';
const items = parsePO(content, "n.po");
items[0].targetText = "第一行\n第二行";          // user pressed Enter in the editor
items[0].status = "translated";
AppState.fileMetadata["n.po"] = { extension: "po", originalContent: content };
const out = generateOriginalFormatExport("n.po", items).content;
console.log(JSON.stringify(out));
console.log(JSON.stringify(parsePO(out, "n.po").map(i => i.targetText)));
```

**Observed**

```
"msgid \"Line\"\nmsgstr \"第一行\n第二行\"\n"     <- raw LF inside the quoted string
re-parsed: [""]                                  <- translation gone
```

Backslashes are corrupted too:

| target the user typed | written to file | value after re-parse |
|---|---|---|
| `C:\temp\new` | `msgstr "C:\temp\new"` | `C:<TAB>emp<LF>ew` |
| `a\\b` | `msgstr "a\\b"` | `a\b` |

A target that *ends* with a backslash escapes the closing quote and breaks the file structure:
`msgstr "ends with backslash \"` → re-parse yields an empty target for that entry.

**Expected**: standard PO escaping (`\\`, `\n`, `\t`, `\"`) on export; re-parse returns the same
string that was typed.

**Impact**: any multi-line or backslash-containing translation produces a `.po` file that
`msgfmt`/CAT tools reject, that the tool itself re-reads with the translation lost, and that can
swallow following entries.

---

### 8. PO: entries whose `msgid` contains an escape sequence are never exported

**Severity**: high
**Location**: `public/app/features/translations/export/translation-original.js:353-361`
(the parsed `msgid` is used as a literal regex fragment).

**Reproduction**

```js
const content = 'msgid "First line\\nSecond line"\nmsgstr ""\n\nmsgid "Tab\\there"\nmsgstr ""\n';
const items = parsePO(content, "t.po");     // sourceTexts contain a real LF / TAB
items.forEach(i => { i.targetText = "译:" + i.sourceText; i.status = "translated"; });
AppState.fileMetadata["t.po"] = { extension: "po", originalContent: content };
console.log(generateOriginalFormatExport("t.po", items).content);
```

**Observed** — the file is returned unchanged, both `msgstr ""` are still empty
(`msgid "First line<LF>Second line"` cannot match the file's `First line\nSecond line`).

**Expected**: the entry is updated (the parser itself round-trips `\n` correctly — see the
existing test `tests/parsers-formats.test.mjs:24`).

**Impact**: multi-line messages are the norm in PO files produced by `xgettext`; their
translations are silently dropped from the export while the UI reports success.

---

### 9. PO: one `msgid` used with several `msgctxt` values gets a single translation everywhere

**Severity**: high
**Location**: `public/app/features/translations/export/translation-original.js:357-361`
(the replacement regex is anchored on `msgid` only, and `replace(..., "g")` rewrites every
occurrence).

**Reproduction**

```js
const content = 'msgctxt "menu"\nmsgid "Open"\nmsgstr ""\n\nmsgctxt "file"\nmsgid "Open"\nmsgstr ""\n';
const items = parsePO(content, "t.po");
items[0].targetText = "打开(菜单)"; items[1].targetText = "打开(文件)";
items.forEach(i => i.status = "translated");
AppState.fileMetadata["t.po"] = { extension: "po", originalContent: content };
console.log(generateOriginalFormatExport("t.po", items).content);
```

**Observed**

```
msgctxt "menu"
msgid "Open"
msgstr "打开(文件)"      <- should be 打开(菜单)

msgctxt "file"
msgid "Open"
msgstr "打开(文件)"
```

**Expected**: the replacement is scoped to the entry with the matching `msgctxt`
(`metadata.msgctxt` is already available on the item).

**Impact**: the last item processed wins for every duplicate-context entry; the user's
context-specific translations are silently overwritten.

---

### 10. iOS `.strings` export: line-based rewriting never matches escaped quotes / multi-line values, and an unescaped backslash destroys the following entry

**Severity**: high
**Location**: `public/app/features/translations/export/translation-original.js:401-408`.

**Reproduction**

```js
// (a) entry that already contains an escaped quote
const src = '"q" = "He said \\"hi\\"";\n"n" = "a";\n';
const items = parseIOSStrings(src, "q.strings");
items[0].targetText = "他说“你好”"; items[1].targetText = "A";
items.forEach(i => i.status = "translated");
AppState.fileMetadata["q.strings"] = { extension: "strings", originalContent: src };
console.log(JSON.stringify(generateOriginalFormatExport("q.strings", items).content));

// (b) translation that ends with a backslash
const src2 = '"a" = "A";\n"b" = "B";\n';
const items2 = parseIOSStrings(src2, "b.strings");
items2[0].targetText = "ends with backslash \\";
AppState.fileMetadata["b.strings"] = { extension: "strings", originalContent: src2 };
const out2 = generateOriginalFormatExport("b.strings", items2).content;
console.log(JSON.stringify(out2), JSON.stringify(parseIOSStrings(out2, "b.strings").map(i => [i.metadata.key, i.sourceText])));
```

**Observed**

```
(a) "\"q\" = \"He said \\\"hi\\\"\";\n\"n\" = \"A\";\n"      <- "q" was NOT updated
(b) "\"a\" = \"ends with backslash \\\";\n\"b\" = \"B\";\n"
    re-parsed: [["a","ends with backslash \";\n"]]          <- entry "b" is GONE
```

The same happens for a value spanning several lines (`"m" = "line1<LF>line2";`): the line regex
`^\s*"([^"]+)"\s*=\s*"([^"]*)";?\s*$` cannot match, so the entry is silently left untranslated.

**Expected**: escaping of `\` / `"` / newlines on write, and a tokenizer-based (not line-based)
rewrite so multi-line and escaped entries are updated.

**Impact**: an existing `.strings` entry containing `\"` or a line break can never be updated;
a translation ending in `\` (paths, regexes, `\n` typed literally) corrupts the file and deletes
the following key-value pair.

---

## MEDIUM

### 11. Android export silently skips `string-array` / `plurals` items and any string with inline markup (and trims `xml:space="preserve"` text)

**Severity**: medium
**Location**: `public/app/features/translations/export/translation-formats.js:242-285`
(regex `<string[^>]*name="ID"[^>]*>([^<]*)</string>`), `public/app/parsers/xml-android.js:23-31`.

**Reproduction**

```js
const xml = `<resources>
  <string name="app_name">My App</string>
  <string name="styled">Click <b>here</b> now</string>
  <string name="padded" xml:space="preserve">  spaced  </string>
  <string-array name="planets"><item>Mercury</item><item>Venus</item></string-array>
  <plurals name="n_files"><item quantity="one">%d file</item><item quantity="other">%d files</item></plurals>
</resources>`;
const items = parseAndroidStrings(xml, "strings.xml");
items.forEach(i => { i.targetText = "ZH[" + i.sourceText + "]"; i.status = "translated"; });
AppState.fileMetadata["strings.xml"] = { extension: "xml", originalContent: xml };
console.log(generateXML(items, true));
```

**Observed** — only `app_name` and `padded` change; `styled` (inline `<b>`), `planets[0..1]`,
`n_files[one|other]` are untouched, and `padded` lost its preserved spaces
(`<string name="padded" xml:space="preserve">ZH[spaced]</string>`). The export still reports
success. The no-original-content generator (`generateAndroidStringsXMLFromItems`) is worse: it
emits `<string name="planets[0]">` / `<string name="n_files[one]">`, which are invalid Android
resource names and destroy the array/plural structure.

**Expected**: arrays/plurals are updated in place (the parser already stores
`resourceId = name[quantity]`); `[^<]*` must not exclude values containing markup; preserved
whitespace must survive.

**Impact**: every string-array and plural translation is dropped from the exported
`strings.xml` without any error, so the shipped app keeps the source language for those
resources.

---

### 12. Android: entity text is double-escaped on export (`&amp;` → `&amp;amp;`)

**Severity**: medium
**Location**: `public/app/parsers/xml-android.js:27-30` (source text keeps the serialized
`&amp;`) + `public/app/features/translations/export/translation-formats.js:232-234,274`
(`escapeXml`).

**Reproduction / Observed**

```
input  : <string name="welcome">Hello &amp; welcome</string>
parsed : sourceText === "Hello &amp; welcome"
output : <string name="welcome">ZH[Hello &amp;amp; welcome]</string>
```

**Expected**: the parsed source text should be the decoded `Hello & welcome` (as RESX/Qt TS do),
so escaping on write yields `&amp;` again.

**Impact**: the exported resource renders the literal characters `&amp;` in the app. The same
double-escape occurs in `generateAndroidStringsXMLFromItems` (used when the original content is
not available).

---

### 13. RESX: inline markup inside `<value>` is destroyed

**Severity**: medium
**Location**: `public/app/parsers/resx.js:24` (`valueElement.textContent`) +
`public/app/features/translations/export/translation-original.js:324-326`
(`valueEl.textContent = targetText`).

**Reproduction / Observed**

```
input  : <data name="Html"><value>Click <b>here</b> to continue</value></data>
parsed : sourceText === "Click here to continue"      (the <b> element is gone)
export : <value>译:Click here to continue</value>
```

**Expected**: markup is preserved (serialize children like the Android/XLIFF parsers, or reuse
the original value node and only replace text).

**Impact**: ASP.NET `.resx` files routinely embed `<b>`, `<a href=…>`, `<br/>` in values; both
the string shown for translation and the exported file lose that markup.

---

### 14. YAML export produces an **empty** document for items that come from any other format

**Severity**: medium
**Location**: `public/app/parsers/yaml.js:170-178` (`if (!path) continue;`) +
`public/app/features/translations/export/translation-entry.js:199-204`.

**Reproduction** (through the real export entry point)

```js
const items = parsePO('msgid "Hello"\nmsgstr ""\n\nmsgid "Bye"\nmsgstr ""\n', "t.po");
items.forEach(i => { i.targetText = "译:" + i.sourceText; i.status = "translated"; });
globalThis.TranslationViewStore = { getViewItems: () => items };
globalThis.DOMCache = { get: id => id === "exportFormat" ? { value: "yaml" }
                                   : id === "exportOnlyTranslated" ? { checked: false }
                                   : id === "exportIncludeOriginal" ? { checked: true } : {} };
globalThis.downloadFile = (content, filename) => downloads.push([filename, content]);
globalThis.closeModal = () => {};
loadSource("public/app/features/translations/export/translation-entry.js");
await exportTranslation();
```

**Observed**

```
downloads: [["demo_yaml_1789051975273.yaml", "{}\n"]]
notifications: ["success: 已成功导出 2 项翻译为 YAML 格式（包含原文）"]
```

Only `parseJSON`/`parseYAML` set `metadata.path`; PO, XLIFF, iOS `.strings`, Android, RESX,
Qt TS and CSV items have none, so every item is skipped and `jsyaml.dump({})` returns `{}`.

**Expected**: YAML export should work for any loaded items (keyed by `resourceId`/`key`/
`unitId`/`path`, as `parse.js:232-241` already does for duplicate detection) or be rejected with
an error instead of writing an empty file.

**Impact**: a user exporting a PO/Android/XLIFF project as YAML receives an empty file plus a
success message.

---

### 15. YAML export loses all non-string values and restructures keys containing dots

**Severity**: medium
**Location**: `public/app/parsers/yaml.js:175,182-211`.

**Reproduction / Observed**

```yaml
# input                          # export (targets = "译:"+source)
app:                             app:
  title: Hello                     title: '译:Hello'
  count: 3                         list:
  enabled: true                      - '译:Open'
  empty: null                        - '译:Save'
  list: [Open, Save]               block: "译:line one\nline two\n"
  block: |                       dotted:
    line one                       key: '译:Dotted value'
    line two
"dotted.key": Dotted value
```

`count`, `enabled` and `empty` are gone (the parser intentionally extracts only strings, the
exporter rebuilds the document from those strings alone); `"dotted.key"` becomes a nested
`dotted: {key: …}` object, changing the file's semantics.

**Expected**: values the parser does not expose as items must be carried over, and key strings
must be emitted as single quoted keys.

**Impact**: the exported locale file silently loses numbers/booleans/null and can change the key
structure, breaking the consuming app.

---

### 16. "原格式" export returns **nothing at all** for CSV / TSV / YAML / TXT files

**Severity**: medium
**Location**: `public/app/features/translations/export/translation-original.js:24-59`
(handles only `xml`, `xlf/xliff`, `json`, `resx`, `po`, `strings`, `ts`), caller
`translation-entry.js:115-119`.

**Reproduction**

```js
// CSV + YAML items, both with originalContent present in AppState.fileMetadata,
// exportFormat = "original"
await exportTranslation();
```

**Observed**

```
downloads: []
notifications: ["warning: 导出完成: 成功导出 0 个文件，失败 2 个（包含原文）"]
```

**Expected**: CSV/TSV/YAML (`csv`, `tsv`, `yaml`, `yml` are all registered parsers) should either
be exported in their original format or reported as unsupported *before* the export loop; the
current warning text ("部分文件缺少原始内容，将使用通用导出") is also wrong — the content is
present.

**Impact**: users who import a CSV/YAML file and choose "原格式（按导入文件）" get no file at
all, only a confusing failure count.

---

### 17. Terminology CSV export cannot be re-imported (headers are Chinese, importer looks for English keys)

**Severity**: medium
**Location**: `public/app/features/translations/export/terminology-export.js:80-83` vs
`public/app/features/translations/export/terminology-import.js:213-231`.

**Reproduction**

```js
const terms = [{ source: "Hello", target: "你好", partOfSpeech: "noun", definition: "greeting" }];
const csv = generateTerminologyCSV(terms, true, false);   // header: 源术语,目标术语,词性,定义
readFileAsync = async () => csv;  importFormat = "csv";
await importTerminology();
```

**Observed**

```
源术语,目标术语,词性,定义
"Hello","你好","名词","greeting"

import notifications: ["error: 导入失败: 导入过程中发生错误: 文件中没有找到有效的术语数据"]
imported terms: []
```

The importer builds `term["源术语"]` and then requires `term.source && term.target`
(`importTerminology`, lines 219-231), so every row is discarded. The JSON round trip works
(same test: `success: 成功导入 2 个术语`), which shows the CSV header mismatch is the cause. The
import dialog also advertises "支持 CSV、JSON、XLSX 格式" while XLSX throws `不支持的文件格式`.

**Expected**: the exported CSV should be importable (English headers, or a header alias map that
accepts 源术语/目标术语/词性/定义).

**Impact**: terminology can be exported to CSV but never restored — a data-export dead end for
the default format in the dropdown.

---

### 18. Malformed XML is silently "parsed" into junk items and reported as success

**Severity**: medium
**Location**: `public/app/features/files/parse.js:225-228` (catch-all `parseTextFile` fallback).

**Reproduction**

```js
await App.impl.parseFileAsync(new File([`<?xml version="1.0"?>
<xliff version="1.2"><file><body><trans-unit id="1"><source>Hello world</source><target/>
</body></file>`], "broken.xlf"), { silent: false, skipPersist: true });
```

**Observed**

```
success: true   items: 4
[["\"1.0\" encoding=\"UTF-8\"?>", "", "Text key: <?xml version"],
 ["\"1.2\"><file source-language=\"en\"><body>", "", "Text key: <xliff version"],
 ["\"1\"><source>Hello world</source><target/>", "", "Text key: <trans-unit id"],
 ["</body></file>", "", "Text line 4"]]
notifications: ["info: 正在解析文件: broken.xlf", "success: 文件 broken.xlf 已成功解析，找到 4 个翻译项"]
```

`securityUtils.validateXMLContent` (`public/app/services/security-utils.js:219-225`) only checks
that the text starts with `<` and contains `>`, so malformed XML reaches `detectXmlFormat`,
which correctly reports `invalid` → `throw` → the outer `catch` runs the **text** parser. The
intended error path (`success:false`, `FILE_PARSE_ERROR`) is unreachable for XML-family files.

**Expected**: malformed XML should fail with an error notification (and the `FILE_PARSE_ERROR`
item), not produce items whose "source text" is XML markup.

**Impact**: a truncated/edited XLIFF or RESX file gives the user 4 nonsense strings to translate
and a green "success" toast; if they then export, the "translations" are written into an
unrelated format.

---

### 19. CSV without a header row silently loses the first data row

**Severity**: medium
**Location**: `public/app/parsers/csv.js:41-44` (`hasHeader` defaults to `true`) — all registry
dispatch calls pass no options (`parse.js:220`).

**Reproduction / Observed**

```js
parseCSV("Hello,你好\nWorld,世界\n", "nohdr.csv")
// -> [{ sourceText: "World", targetText: "世界" }]     ("Hello,你好" is gone)
```

**Expected**: either detect the absence of a header, or at least warn (the app currently also
emits the success toast "找到 1 个翻译项").

**Impact**: a two-column CSV without a header loses its first entry entirely and shifts the
column mapping for files whose first row is data.

---

### 20. XLIFF: a newly created `<target>` element has no namespace (`xmlns=""`)

**Severity**: medium
**Location**: `public/app/features/translations/export/translation-formats.js:399-402`
(`xmlDoc.createElement("target")` — `createElement`, not `createElementNS`).

**Reproduction**

```js
const content = `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2"><file><body>
  <trans-unit id="1"><source>Hello</source></trans-unit></body></file></xliff>`;
const items = parseXLIFF(content, "notarget.xliff");
items[0].targetText = "你好";
AppState.fileMetadata["notarget.xliff"] = { extension: "xliff", originalContent: content };
const out = generateOriginalFormatExport("notarget.xliff", items).content;
console.log(out);
console.log(new DOMParser().parseFromString(out, "application/xml").getElementsByTagName("target")[0].namespaceURI);
```

**Observed**

```
<source>Hello</source><target xmlns="" state="translated">你好</target>
target element namespaceURI: null
```

**Expected**: `<target state="translated">你好</target>` in the XLIFF namespace
(`createElementNS(xliffNs, "target")`).

**Impact**: the produced file is not valid XLIFF 1.2 (schema-invalid, `target` is in no
namespace); namespace-aware CAT tools / validators will not see the translation. The tool's own
parser uses a `*` namespace wildcard so it re-reads its own output, hiding the problem.

---

### 21. Generic XML: CDATA sections are invisible to the parser and exporter, and the regex fallback emits junk

**Severity**: medium
**Location**: `public/app/parsers/xml-generic.js:23-40` (`NodeFilter.SHOW_TEXT` walker),
`:110-133` (regex fallback), `:136-160` (CDATA fallback — only reached when the regex finds
nothing); export side `public/app/features/translations/export/translation-formats.js:125-129`.

**Reproduction**

```js
parseGenericXML(`<root><a>Hello</a><b><![CDATA[World & <i>friends</i>]]></b></root>`, "mix.xml")
parseGenericXML(`<root><a><![CDATA[Hello & <b>world</b>]]></a></root>`, "cd.xml")
```

**Observed**

```
mix.xml -> [["/a","Hello"]]                      <- CDATA content silently dropped
cd.xml  -> [[null,"world"],[null,"]]>"]]         <- junk fragments from the regex fallback
```

CDATA is `nodeType 4`, which `SHOW_TEXT` (`0x4` == nodeType 3) does not match, so the walker
skips it; in a mixed document the CDATA text is never offered for translation, and in a
CDATA-only document the walker returns 0 items so the regex `>([^<]+)<` shreds the markup. The
export walker (`translation-formats.js:125`) has the same `SHOW_TEXT` filter, so CDATA text is
never replaced either.

**Expected**: CDATA text nodes are traversed (`SHOW_TEXT | SHOW_CDATA_SECTION`) and matched on
export.

**Impact**: XML files that store strings in CDATA (common in custom XML formats) either lose
those strings or produce meaningless items to translate, which then get exported as garbage.

---

## LOW

### 22. `parseCSV` trims every field → CSV round-trip loses leading/trailing whitespace

**Severity**: low
**Location**: `public/app/parsers/csv.js:101-104`.

**Reproduction / Observed**

```js
generateCSV([{ id:"k3", sourceText:"  padded  ", targetText:"  保留  ", context:"ws", status:"translated" }], true)
// row: "k3","  padded  ","  保留  ","ws","translated"
parseCSV(row, "out.csv")  // -> sourceText "padded", targetText "保留"
```

**Expected**: quoted CSV fields should keep their whitespace (RFC 4180 has no trimming rules).

**Impact**: significant leading/trailing spaces in UI strings are lost on every CSV round trip.

---

### 23. iOS `.strings`: the uppercase `\Uxxxx` escape is not decoded

**Severity**: low
**Location**: `public/app/parsers/ios-strings.js:94-99` (only lowercase `\u`, and only with
exactly 4 hex digits).

**Reproduction / Observed**

```js
parseIOSStrings('"appleU" = "caf\\U00e9";', "t.strings")[0].sourceText
// -> "cafU00e9"        (expected "café")
```

`\Uxxxx` is the form Apple's tooling emits (the lowercase `\uxxxx` form is the one that does not
work on iOS — see the format notes at
<https://respresso.io/docs/localization/apple-ios-strings-format/> and
<https://stackoverflow.com/questions/23452906>); the parser implements only the lowercase form and
otherwise falls through to `out += esc`, silently dropping the backslash.

**Impact**: strings containing Apple-style Unicode escapes are shown (and translated) as
`cafU00e9`; the translator sees mojibake and the wrong source text is recorded in the TM.

---

### 24. `exportCSV` / `escapeCSVField` formula guard breaks the round trip

**Severity**: low (dead code — not wired into the export UI; only the generic `generateCSV` is)
**Location**: `public/app/parsers/csv.js:242-244`.

**Reproduction / Observed**

```js
exportCSV([{ id:"k4", sourceText:"-5 degrees", targetText:"=SUM(A1)", context:"f", status:"translated" }])
// k4,'-5 degrees,'=SUM(A1),f
parseCSV(that, "out.csv")  // -> "-5 degrees" becomes "'-5 degrees"; "=SUM(A1)" becomes "'=SUM(A1)"
```

**Expected**: whatever is exported must re-import unchanged (the guard cannot be reversed
because a leading `'` is indistinguishable from user text).

**Impact**: if this exporter is ever wired up, any value starting with `=`, `+`, `-` or `@`
silently gains a stray apostrophe.

---

### 25. PO: syntactically invalid entries are silently dropped while the import reports success

**Severity**: low
**Location**: `public/app/parsers/po.js:20-28,51-77,93`.

**Reproduction / Observed**

```js
parsePO('msgid Hello there\nmsgstr 你好\n\nmsgid "Bye"\nmsgstr "再见"\n', "broken.po")
// -> [{ sourceText: "Bye", targetText: "再见" }]   — entry 1 vanishes, no warning
```

End-to-end, `parseFileAsync` reports `success: true / 找到 1 个翻译项`.

**Expected**: an entry whose `msgid` cannot be read should raise a warning (the file is
unusable for that entry) — GNU `msgfmt` rejects the file outright.

**Impact**: hand-edited or generator-broken PO files lose messages without any signal.

---

### 26. `__parseYAMLSimple` fallback drops block scalars and list items

**Severity**: low (only used when js-yaml fails to load)
**Location**: `public/app/parsers/yaml.js:37-62`.

**Reproduction / Observed**

```js
__parseYAMLSimple(`en:\n  greeting: "Hello"\n  body: |\n    line one\n    line two\n  items:\n    - Open\n    - Save\n`)
// -> [["en.greeting","Hello"]]        (body / items lost)
// js-yaml path: en.greeting, en.body, en.items[0], en.items[1]
```

**Expected**: at minimum, warn that the fallback is lossy, or keep the block content.

**Impact**: if the vendored `js-yaml` ever fails to load, multi-line strings and list entries are
silently missing from the item list.

---

### 27. Text fallback splits prose lines at the first colon/comma

**Severity**: low
**Location**: `public/app/parsers/text.js:135-155`.

**Reproduction / Observed**

```js
// file "prose.txt": "Chapter 1: The Beginning\nJust a sentence.\n"
// -> [["The Beginning", "Text key: Chapter 1"], ["Just a sentence."]]
```

**Expected**: for a `.txt`/unknown-extension file, the whole line is the string unless it clearly
looks like `key = value`.

**Impact**: the string offered for translation silently loses its prefix ("Chapter 1: "), and the
translation is written back against the truncated text.

---

## Verified working

Tested and behaving correctly (no defect found):

* **Parsing, no exceptions**: JSON, YAML, CSV/TSV, PO, XLIFF 1.2/2.0, Android, RESX, Qt TS,
  iOS `.strings` and generic XML all load and parse representative real-world inputs.
* **Encoding / BOM (`read.js` + `parse.js`)**: UTF-16LE with BOM, UTF-8 BOM, GBK/GB18030 bytes,
  a UTF-8-BOM-only file, an empty file and a 5000-character key all decode and parse correctly;
  `\r\n` is normalised before parsing (CRLF PO and CRLF `.strings` parse identically to LF).
* **XML escaping (no injection)**: `escapeXml` output for `</target><target>INJECTED</target> &
  < > " ' ]]> ]]&>` is fully escaped in `generateGenericXML`, `generateNewXLIFF`,
  `generateAndroidStringsXMLFromItems` and attribute values — no way to break out of the element
  or attribute.
* **Android resource replacement** matches by `metadata.resourceId`, so duplicate source texts
  with distinct `name`s are handled correctly (see finding 6 for the formats that are not).
* **RESX** decodes entities (`Hello &amp; welcome` → `Hello & welcome`) and preserves
  `xml:space="preserve"` padding through parse *and* export.
* **Qt TS non-plural messages** decode entities (`Fish &amp; Chips` → `Fish & Chips`) and re-escape
  correctly on export; positional mapping (`context-N-message-M`) is stable.
* **PO basics**: header entry dropped/handled, comments skipped, `msgstr`/`msgstr[n]`,
  `msgid_plural` + `metadata.pluralTarget`, `msgctxt` capture and plain-text round trip all work
  (including the `\\n` vs `\n` distinction the unit tests cover).
* **iOS `.strings` tokenizer**: comments, multi-line input values, `\n`, `\r`, `\t`, `\\`, `\"`,
  `\uXXXX`, and empty values are read correctly; entries with no value keep their key.
* **CSV**: `generateCSV` → `parseCSV` round-trips commas, doubled quotes and embedded newlines;
  TSV dispatch via the registry works; empty rows are skipped.
* **YAML parsing (js-yaml path)**: nested maps, lists, block scalars and quoted keys produce the
  expected `metadata.path` values (the export side is where findings 14/15 apply).
* **Terminology JSON** export → import round trip works (`成功导入 2 个术语`), and
  `escapeCsv`/`escapeXml` are applied consistently in the terminology exporters.
* **Duplicate-key detection** in `parse.js:230-261` and `ParserUtils` helpers
  (`detectBom`, `cleanText`, `validateJSON`, `detectPOFormat`, `getStats`, `mergeDuplicates`,
  `filterEmpty`) behave as documented — 61/61 existing tests pass.

## Notes / not reported as defects

* Exported `.resx`/`.xliff`/`.ts` files lose the `<?xml … ?>` declaration when produced through
  `XMLSerializer.serializeToString(document)`. This is serializer-dependent (jsdom/WebKit-family
  omit it, Firefox keeps it), the prolog is optional in XML 1.0, and re-parsing works, so it is
  not counted as a defect; `__withXmlDeclarationAndDoctypeTs` already compensates for the Qt TS
  path.
* `ParserUtils.mergeDuplicates` / `filterEmpty` / `EnhancedParserManager` and `exportCSV` are not
  reached from the current UI (the registry path in `parse.js` bypasses `EnhancedParserManager`);
  defects found there are reported with that caveat.
* CSV column auto-detection (`csv.js:52-90`) prefers a header containing `key`/`id` when no
  `source`-like column exists (`Key,en,zh` → the key column is treated as the source text). This
  is a heuristic trade-off rather than a clear bug, so it is listed here rather than as a finding.

---

## Appendix — reproduction harness

Every finding above was produced with this harness (Node 24 + the repo's own `jsdom`), which mirrors
`tests/setup.mjs`; `window`/`globalThis` are kept in sync because `parse.js` writes through
`window.App`.

```js
// harness.mjs (scratch, deleted after the review)
import { readFileSync } from "fs"; import { resolve } from "path";
import vm from "vm"; import { JSDOM } from "jsdom";
const ROOT = "D:/laster/html";
const silent = { error(){}, warn(){}, info(){}, debug(){}, verbose(){}, log(){} };
export function createEnv() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, {
    window: w, document: w.document, DOMParser: w.DOMParser, XMLSerializer: w.XMLSerializer,
    NodeFilter: w.NodeFilter, Node: w.Node, CSS: w.CSS, FileReader: w.FileReader, File: w.File,
    Blob: w.Blob, URL: w.URL,
  });
  globalThis.loggers = { app: silent, translation: silent, network: silent, storage: silent,
                         quality: silent, ui: silent };
  globalThis.App = { services: {}, features: {}, core: {}, parsers: {}, ui: {}, utils: {}, impl: {} };
  globalThis.AppState = { project: { id:"p1", name:"demo", sourceLanguage:"en", targetLanguage:"zh" },
                          translations: {}, terminology: { entries: [] }, ui: {}, fileMetadata: {} };
  globalThis.SettingsCache = { get: () => ({}), set(){} };
  globalThis.showNotification = () => {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  w.App = globalThis.App; w.AppState = globalThis.AppState; w.SettingsCache = globalThis.SettingsCache;
  return { dom, window: w };
}
export function loadSource(p) { vm.runInThisContext(readFileSync(resolve(ROOT, p), "utf-8"), { filename: p }); }
export function loadParsers() {
  ["parser-registry","parser-utils","xml-generic","xml-android","xliff","qt-ts","ios-strings",
   "resx","po","json","yaml","csv","text"].forEach(f => loadSource(`public/app/parsers/${f}.js`));
}
export function loadExporters() {
  ["shared","translation-formats","translation-original"]
    .forEach(f => loadSource(`public/app/features/translations/export/${f}.js`));
}
```

```js
// repro-template.mjs
import { createEnv, loadParsers, loadExporters, loadSource } from "./harness.mjs";
import vm from "vm"; import { readFileSync } from "fs";
const { window } = createEnv();
loadParsers(); loadExporters();
// YAML findings only: also load the vendored js-yaml (it attaches to globalThis)
vm.runInThisContext(readFileSync("D:/laster/html/public/lib/js-yaml/js-yaml.min.js", "utf-8"));
window.jsyaml = globalThis.jsyaml;
// then paste the snippet from any finding above
```

Run with `node repro-template.mjs` from `D:\laster\html`.

The end-to-end findings (16, 17, 18) additionally stub the UI seams the same way the snippets show
(`TranslationViewStore`, `DOMCache`, `downloadFile`, `readFileAsync`, `TerminologyStore`,
`securityUtils.validateXMLContent` — the last one copied verbatim from
`public/app/services/security-utils.js:219-225`).
