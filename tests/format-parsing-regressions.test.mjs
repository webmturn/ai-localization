import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDecoder as NativeTextDecoder } from 'node:util';
import { loadSource, setupGlobals } from './setup.mjs';

let settings;
beforeAll(() => {
  setupGlobals();
  globalThis.TextDecoder = NativeTextDecoder;
  loadSource('public/lib/js-yaml/js-yaml.min.js');
  for (const file of ['parser-registry', 'parser-utils', 'xml-generic', 'xml-android', 'xliff', 'qt-ts', 'ios-strings', 'resx', 'po', 'json', 'yaml', 'csv', 'text']) loadSource('public/app/parsers/' + file + '.js');
  loadSource('public/app/features/files/read.js');
  loadSource('public/app/features/files/parse.js');
  loadSource('public/app/features/files/process.js');
  loadSource('public/app/features/files/source-editor.js');
  loadSource('public/app/features/translations/export/shared.js');
  loadSource('public/app/features/translations/export/translation-formats.js');
  loadSource('public/app/features/translations/export/translation-original.js');
});
beforeEach(() => {
  settings = { autoDetectEncoding: true };
  globalThis.SettingsCache = { get: () => settings };
  globalThis.AppState = { project: { id: 'test', name: 'Test', translationItems: [] }, fileMetadata: {}, translations: {} };
  globalThis.securityUtils = { validateXMLContent: () => true };
  globalThis.showNotification = vi.fn();
  globalThis.buildFileContentKey = (project, file) => project + '/' + file;
  globalThis.idbPutFileContent = vi.fn().mockResolvedValue(undefined);
  globalThis.ProjectStore = { setFileMetadata: vi.fn((name, meta) => { AppState.fileMetadata[name] = meta; }), getTranslationItems: () => AppState.project.translationItems };
  globalThis.DOMCache = { get: () => null };
});
const parse = (text, name, options = {}) => App.impl.parseFileAsync(new File([text], name), { silent: true, skipPersist: true, ...options });
const cache = (name, text) => { AppState.fileMetadata[name] = { originalContent: text, extension: name.split('.').pop() }; };

describe('文件级失败及格式开关', () => {
  it.each([['bad.json', '{"title":"Hello",}'], ['bad.csv', 'source,target\n"Open,打开'], ['bad.yaml', 'a: [unfinished'], ['bad.xml', '<root><label>Hello</root>'], ['bad.po', 'msgid "Hello"\nmsgstr "broken'], ['bad.strings', '"a" = "broken']])('%s 拒绝损坏结构且没有可翻译错误行', async (name, text) => {
    const result = await parse(text, name);
    expect(result.success).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.error).toBeTruthy();
  });
  it('失败重导入不覆盖缓存内容', async () => {
    cache('a.json', '{"title":"Old"}');
    const result = await parse('{broken', 'a.json', { skipPersist: false });
    expect(result.success).toBe(false);
    expect(AppState.fileMetadata['a.json'].originalContent).toBe('{"title":"Old"}');
    expect(idbPutFileContent).not.toHaveBeenCalled();
  });
  it('混合导入仅把成功文件交给合并流程', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const original = globalThis.__completeFileProcessingImpl;
    globalThis.__completeFileProcessingImpl = complete;
    try {
      await __processFilesImpl([new File(['{"title":"Good"}'], 'good.json'), new File(['{broken'], 'bad.json')]);
      expect(complete).toHaveBeenCalledOnce();
      expect(complete.mock.calls[0][0].map(f => f.name)).toEqual(['good.json']);
      expect(complete.mock.calls[0][1].map(i => i.sourceText)).toEqual(['Good']);
    } finally { globalThis.__completeFileProcessingImpl = original; }
  });
  it.each([['a.yaml', 'title: Hello'], ['a.yml', 'title: Hello'], ['a.csv', 'source,target\nHello,你好'], ['a.tsv', 'source\ttarget\nHello\t你好'], ['a.pot', 'msgid "Hello"\nmsgstr ""']])('%s 不受文本兜底开关误拦截', async (name, text) => {
    settings.formatTextFallback = false;
    expect((await parse(text, name)).success).toBe(true);
  });
  it('专属 YAML/CSV 格式开关生效', async () => {
    settings.formatYAML = false; settings.formatCSV = false;
    expect(await parse('title: Hello', 'a.yaml')).toBeNull();
    expect(await parse('source,target\nHello,你好', 'a.tsv')).toBeNull();
  });
  it('JSON 空值不生成待翻译行', async () => {
    expect((await parse('{"blank":"", "space":"  ", "title":"Hello"}', 'a.json')).items.map(i => i.sourceText)).toEqual(['Hello']);
  });
});

describe('CSV 列识别和文本保持', () => {
  it('key 在 source 前仍选择实际原文列', () => {
    const [item] = parseCSV('key,source,target\nmenu.open,Open,打开', 'a.csv');
    expect(item.sourceText).toBe('Open'); expect(item.targetText).toBe('打开'); expect(item.metadata.key).toBe('menu.open');
  });
  it('无表头不丢首行', () => { expect(parseCSV('Open,打开\nSave,保存', 'a.csv').map(i => i.sourceText)).toEqual(['Open', 'Save']); });
  it('显式列选项优先于表头识别', () => { expect(parseCSV('key,source,target\nmenu.open,Open,打开', 'a.csv', { hasHeader: true, sourceColumn: 0 })[0].sourceText).toBe('menu.open'); });
  it('引号、逗号、多行原译文均保留', () => {
    const [item] = parseCSV('source,target\n"Hello, world\nAgain","say ""hi"""', 'a.csv');
    expect(item.sourceText).toBe('Hello, world\nAgain'); expect(item.targetText).toBe('say "hi"');
  });
  it('未闭合引号抛出明确错误', () => { expect(() => parseCSV('source,target\n"Open', 'a.csv')).toThrow(/引号/); });
  it('原译文有意义的前后空格保留', () => { expect(parseCSV('source,target\n" Hello "," 你好 "', 'a.csv')[0]).toMatchObject({ sourceText: ' Hello ', targetText: ' 你好 ' }); });
});

describe('YAML 多文档与锚点', () => {
  it('多文档分别提取和导出，重名路径不互相覆盖', async () => {
    const items = await parseYAML('---\ntitle: First\n---\ntitle: Second', 'a.yaml');
    expect(items.map(i => i.sourceText)).toEqual(['First', 'Second']);
    expect(items.map(i => i.metadata.documentIndex)).toEqual([0, 1]);
    items[0].targetText = '第一'; items[1].targetText = '第二';
    expect(window.jsyaml.loadAll(await exportYAML(items))).toEqual([{ title: '第一' }, { title: '第二' }]);
  });
  it('含点/方括号的字面键和数组路径正确导出', async () => {
    const items = await parseYAML('"a.b": Literal\n"a[0]": Other\nlist: [One, Two]', 'a.yaml');
    expect(window.jsyaml.load(await exportYAML(items))).toEqual({ 'a.b': 'Literal', 'a[0]': 'Other', list: ['One', 'Two'] });
  });
  it('锚点、多行正常；循环引用明确失败', async () => {
    expect((await parseYAML('a: &a Hello\nb: *a\nc: |\n  First\n  Second', 'a.yaml')).map(i => i.sourceText)).toEqual(['Hello', 'Hello', 'First\nSecond\n']);
    await expect(parseYAML('a: &a { child: *a }', 'a.yaml')).rejects.toThrow(/循环/);
  });
});

describe('编码读取', () => {
  it.each([
    [[0xd6, 0xd0, 0xce, 0xc4], '中文', 'gb18030'],
    [[0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd], 'こんにちは', 'shift_jis'],
    [[67, 97, 102, 0xe9], 'Café', 'windows-1252'],
  ])('严格解码并提示自动尝试的旧编码', (bytes, text, encoding) => {
    const decoded = ParserUtils.decodeFileBytes(new Uint8Array(bytes));
    expect(decoded.text).toBe(text); expect(decoded.encoding).toBe(encoding); expect(decoded.uncertain).toBe(true);
  });
  it('手动编码优先，不用默认候选替代', () => { expect(ParserUtils.decodeFileBytes(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]), { encoding: 'gb18030' }).uncertain).toBe(false); });
  it('无自动识别时非法 UTF-8 明确失败', () => { expect(() => ParserUtils.decodeFileBytes(new Uint8Array([0xe9]), { autoDetect: false })).toThrow(/UTF-8/); });
  it('UTF-16 BOM 和 UTF-32 BOM 解码', () => {
    expect(ParserUtils.decodeFileBytes(new Uint8Array([255, 254, 0x2d, 0x4e])).text).toBe('中');
    expect(ParserUtils.decodeFileBytes(new Uint8Array([255, 254, 0, 0, 0x2d, 0x4e, 0, 0])).text).toBe('中');
  });
  it('手动选错编码明确失败', () => { expect(() => ParserUtils.decodeFileBytes(new Uint8Array([0xe9]), { encoding: 'utf-8' })).toThrow(/解码/); });
  it('选择与拖放使用同一大小配置', () => { settings.maxFileSize = 25; expect(ParserUtils.getMaxFileSizeMB()).toBe(25); settings.maxFileSize = 101; expect(ParserUtils.getMaxFileSizeMB()).toBe(100); });
});

describe('资源过滤、状态与复数', () => {
  it('Android 禁译数组、字符串和复数均跳过', async () => {
    const text = '<resources><string name="s" translatable="false">Skip</string><string-array name="a" translatable="false"><item>Skip</item></string-array><plurals name="p" translatable="false"><item quantity="other">Skip</item></plurals></resources>';
    expect((await parse(text, 'a.xml')).items).toEqual([]);
  });
  it('RESX 仅提取非空字符串资源，注释保留', async () => {
    const text = '<root><data name="label"><value>Hello</value><comment>Caption</comment></data><data name="count" type="System.Int32, mscorlib"><value>42</value></data><data name="icon" mimetype="binary"><value>AAAA</value></data><data name="empty"><value/></data></root>';
    const result = await parse(text, 'a.resx');
    expect(result.items.map(i => i.sourceText)).toEqual(['Hello']); expect(result.items[0].metadata.comment).toBe('Caption');
  });
  it('iOS 大写 Unicode 转义正确解码', () => { expect(parseIOSStrings('"a"="\\U4F60\\U597D";', 'a.strings')[0].sourceText).toBe('你好'); });
  it('PO 全部复数形式独立编辑、精准回写且不串语境', () => {
    const text = '#, fuzzy\n#. Counter\n#: a.c:1\nmsgctxt "a"\nmsgid "%d file"\nmsgid_plural "%d files"\nmsgstr[0] "One"\nmsgstr[1] "Few"\nmsgstr[2] "Many"\n\nmsgctxt "b"\nmsgid "%d file"\nmsgstr "Other context"';
    const items = parsePO(text, 'a.po');
    expect(items.slice(0, 3).map(i => i.targetText)).toEqual(['One', 'Few', 'Many']);
    expect(items.slice(0, 3).every(i => i.status === 'pending')).toBe(true);
    expect(items[0].metadata.references).toEqual(['a.c:1']); expect(items[0].metadata.comment).toBe('Counter');
    items[2].targetText = '多个'; cache('a.po', text);
    const out = generatePOFromOriginal([items[2]], 'a.po');
    expect(out).toContain('msgstr[2] "多个"'); expect(out).toContain('msgstr[0] "One"'); expect(out).toContain('msgstr "Other context"');
  });
  it('Qt 多行复数不合并；废弃消息过滤；单形态修改不改其它形态', () => {
    const text = '<TS><context><name>Main</name><message numerus="yes"><source>%n files</source><extracomment>Counter</extracomment><translation><numerusform>One\nline</numerusform><numerusform>Many</numerusform></translation></message><message><source>Old</source><translation type="obsolete">旧</translation></message></context></TS>';
    const items = parseQtTs(text, 'a.ts'); expect(items).toHaveLength(2);
    expect(items[0].targetText).toBe('One\nline'); expect(items[1].metadata.pluralIndex).toBe(1);
    items[1].targetText = '多个'; items[1].status = 'edited'; cache('a.ts', text);
    const doc = new DOMParser().parseFromString(generateQtTsFromOriginal([items[1]], 'a.ts'), 'application/xml');
    expect([...doc.querySelectorAll('numerusform')].map(n => n.textContent)).toEqual(['One\nline', '多个']);
    expect(doc.querySelector('translation[type="obsolete"]').textContent).toBe('旧');
  });
  it('XLIFF 分段标识、待审状态、注释和部分导出正确', async () => {
    const text = '<xliff version="2.0"><file id="f"><unit id="u"><notes><note>Hint</note></notes><segment id="a"><source>Open</source><target>打开</target></segment><segment id="b" state="initial"><source>Save</source><target>旧保存</target></segment></unit></file></xliff>';
    const result = await parse(text, 'a.xlf'); expect(result.warnings).toEqual([]);
    expect(result.items[1].metadata.segmentId).toBe('b'); expect(result.items[1].status).toBe('pending'); expect(result.items[0].metadata.comment).toBe('Hint');
    result.items[1].targetText = '保存'; result.items[1].status = 'edited'; cache('a.xlf', text);
    const doc = new DOMParser().parseFromString(generateXLIFF([result.items[1]], true), 'application/xml');
    expect([...doc.querySelectorAll('target')].map(n => n.textContent)).toEqual(['打开', '保存']);
  });
  it('通用 XML 单字符、CDATA、属性和同文异译精确回写', () => {
    const text = '<root><label>A</label><hint><![CDATA[Hello]]></hint><button title="Hello"/><label>Hello</label></root>';
    const items = parseGenericXML(text, 'a.xml'); expect(items.map(i => i.sourceText)).toEqual(['A', 'Hello', 'Hello', 'Hello']);
    items.forEach((item, index) => { item.targetText = ['甲', '提示', '按钮', '正文'][index]; });
    const doc = new DOMParser().parseFromString(replaceXMLContent(items, text), 'application/xml');
    expect(doc.querySelector('hint').textContent).toBe('提示'); expect(doc.querySelector('button').getAttribute('title')).toBe('按钮'); expect(doc.querySelectorAll('label')[1].textContent).toBe('正文');
  });
  it('旧编码 PO/Qt 文件导出声明与 UTF-8 下载一致', () => {
    const po = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=Shift_JIS\\n"\n\nmsgid "Open"\nmsgstr ""';
    cache('a.po', po); expect(generatePOFromOriginal([{ sourceText: 'Open', targetText: '打开' }], 'a.po')).toContain('charset=UTF-8');
    const qt = '<?xml version="1.0" encoding="GB18030"?><TS><context><name>Main</name><message><source>Open</source><translation/></message></context></TS>';
    cache('a.ts', qt); const items = parseQtTs(qt, 'a.ts'); items[0].targetText = '打开'; items[0].status = 'edited';
    expect(generateQtTsFromOriginal(items, 'a.ts')).toContain('encoding="utf-8"');
  });
});

describe('旧项目源文件重新解析兼容', () => {
  const qt = '<TS><context><name>Main</name><message numerus="yes"><source>%n files</source><translation><numerusform>One</numerusform><numerusform>Many</numerusform></translation></message></context></TS>';
  const saveLegacy = async (text, name, items) => {
    cache(name, text);
    AppState.project.translationItems = items;
    document.body.innerHTML = '<textarea id="sourceEditorContent"></textarea><div id="sourceEditorError"></div>';
    globalThis.DOMCache = { get: id => document.getElementById(id) };
    ProjectStore.replaceFileItems = vi.fn((_name, next) => { AppState.project.translationItems = next; });
    globalThis.autoSaveManager = { markDirty: vi.fn(), saveProject: vi.fn().mockResolvedValue(undefined) };
    globalThis.updateFileTree = vi.fn(); globalThis.updateTranslationLists = vi.fn(); globalThis.updateCounters = vi.fn();
    globalThis.openModal = vi.fn(); globalThis.closeModal = vi.fn();
    await openSourceEditor(name); await saveSourceEditor();
  };
  it('旧 Qt 合并译文转为独立形式时保留人工修改', async () => {
    await saveLegacy(qt, 'a.ts', [{ id: 'old', sourceText: '%n files', targetText: '人工单数\n人工复数', status: 'edited', metadata: { file: 'a.ts', contextName: 'Main', position: 'context-1-message-1', targetNumerusCount: 2 } }]);
    expect(AppState.project.translationItems.map(i => i.targetText)).toEqual(['人工单数', '人工复数']);
    expect(AppState.project.translationItems.map(i => i.status)).toEqual(['edited', 'edited']);
  });
  it('不能安全拆分的旧复数编辑保留原项目并显示原因', async () => {
    const items = [{ id: 'old', sourceText: '%n files', targetText: '人工译文含\n额外\n换行', status: 'edited', metadata: { file: 'a.ts', contextName: 'Main', position: 'context-1-message-1', targetNumerusCount: 2 } }];
    await saveLegacy(qt, 'a.ts', items);
    expect(ProjectStore.replaceFileItems).not.toHaveBeenCalled();
    expect(AppState.project.translationItems).toBe(items);
    expect(document.getElementById('sourceEditorError').textContent).toContain('安全拆分');
  });
  it('旧 PO 带语境的第一/第二复数人工译文均保留', async () => {
    const text = 'msgctxt "counter"\nmsgid "File"\nmsgid_plural "Files"\nmsgstr[0] "One"\nmsgstr[1] "Many"';
    await saveLegacy(text, 'a.po', [{ id: 'old', sourceText: 'File', targetText: '人工单数', status: 'edited', metadata: { file: 'a.po', msgctxt: 'counter', plural: 'Files', pluralTarget: '人工复数', position: 'entry-1' } }]);
    expect(AppState.project.translationItems.map(i => i.targetText)).toEqual(['人工单数', '人工复数']);
  });
});
