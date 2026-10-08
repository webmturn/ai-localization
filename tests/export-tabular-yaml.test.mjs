import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSource, setupGlobals } from './setup.mjs';

beforeAll(() => {
  setupGlobals();
  loadSource('public/lib/js-yaml/js-yaml.min.js');
  for (const parser of ['json', 'yaml', 'csv']) loadSource('public/app/parsers/' + parser + '.js');
  for (const file of ['shared', 'translation-formats', 'translation-original', 'translation-entry']) loadSource('public/app/features/translations/export/' + file + '.js');
});
beforeEach(() => {
  globalThis.AppState = { project: { name: 'Test' }, fileMetadata: {} };
  globalThis.showNotification = vi.fn();
  globalThis.downloadFile = vi.fn();
  globalThis.ensureOriginalContentLoadedForFile = vi.fn().mockResolvedValue(undefined);
  globalThis.closeModal = vi.fn();
});
const cache = (name, originalContent) => {
  AppState.fileMetadata[name] = { originalContent, extension: name.split('.').pop() };
};
const runExport = async (items, onlyTranslated = false) => {
  globalThis.TranslationViewStore = { getViewItems: () => items };
  globalThis.DOMCache = { get: id => ({ exportFormat: { value: 'original' }, exportOnlyTranslated: { checked: onlyTranslated }, exportIncludeOriginal: { checked: true } })[id] };
  await exportTranslation();
};

describe('CSV/TSV 原格式回写', () => {
  it.each([['csv', ','], ['tsv', '\t']])('%s 按行回写，保留重复 key、额外列和未选中译文', async (ext, delimiter) => {
    const name = 'table.' + ext;
    const rows = [['key', 'source', 'context', 'target', 'count'], ['same', 'Open', 'Menu', '旧菜单', '001'], ['same', 'Open', 'Dialog', '旧对话框', '002']];
    const original = rows.map(row => row.join(delimiter)).join('\n') + '\n';
    cache(name, original);
    const items = parseCSV(original, name, { delimiter });
    items[1].targetText = '打开对话框';
    const result = await generateOriginalFormatExport(name, [items[1]]);
    expect(result?.filename).toBe('table-translated.' + ext);
    rows[2][3] = '打开对话框';
    expect(parseCSVLines(result.content, delimiter)).toEqual(rows);
    expect(result.content.endsWith('\n')).toBe(true);
  });
  it.each([['csv', ','], ['tsv', '\t']])('%s 原译文保留引号、分隔符、换行和前后空格', async (ext, delimiter) => {
    const name = 'quotes.' + ext;
    const original = ['source' + delimiter + 'target', '" Hello,\tworld\nagain "' + delimiter + '"old"'].join('\n');
    cache(name, original);
    const items = parseCSV(original, name, { delimiter });
    items[0].targetText = ' 他说 "你好",\t世界\n下一行 ';
    const result = await generateOriginalFormatExport(name, items);
    const reparsed = parseCSV(result.content, name, { delimiter });
    expect(reparsed[0].sourceText).toBe(items[0].sourceText);
    expect(reparsed[0].targetText).toBe(items[0].targetText);
  });
  it('无表头、空行和额外列均保留，公式样式文本不被改写', async () => {
    const name = 'plain.csv'; const original = '\n-5 degrees,旧值,extra\n\nWorld,世界,unchanged\n';
    cache(name, original);
    const items = parseCSV(original, name); items[0].targetText = '=literal';
    const result = await generateOriginalFormatExport(name, [items[0]]);
    expect(parseCSVLines(result.content)).toEqual([[''], ['-5 degrees', '=literal', 'extra'], [''], ['World', '世界', 'unchanged']]);
  });
  it('原文件 CRLF 包括字段内换行与导入后的 LF 身份匹配', async () => {
    const name = 'windows.csv'; const original = 'source,target\r\n"Hello\r\nWorld",old\r\n';
    cache(name, original);
    const items = parseCSV(original.replace(/\r\n/g, '\n'), name); items[0].targetText = '你好\n世界';
    const result = await generateOriginalFormatExport(name, items);
    expect(parseCSVLines(result.content)[1]).toEqual(['Hello\r\nWorld', '你好\n世界']);
  });
  it('缺少原文时仍能生成正确分隔符的通用 TSV', async () => {
    const result = await generateOriginalFormatExport('missing.tsv', [{ id: 'a', sourceText: ' Hello\tWorld ', targetText: '-literal', context: 'Note', status: 'edited' }]);
    expect(result?.filename).toBe('missing-translated.tsv');
    expect(parseCSV(result.content, 'missing.tsv', { delimiter: '\t' })[0]).toMatchObject({ sourceText: ' Hello\tWorld ', targetText: '-literal' });
  });
  it('缓存行位置已变时明确失败，不写入另一行', async () => {
    const name = 'changed.csv'; const items = parseCSV('source,target\nHello,old', name); items[0].targetText = '你好';
    cache(name, 'source,target\nDifferent,keep');
    await expect(Promise.resolve().then(() => generateOriginalFormatExport(name, items))).rejects.toThrow(/原文|位置/);
  });
  it('只有 CR 的原文件仍按原行位置回写', async () => {
    const name = 'cr.csv'; const original = 'source,target\rHello,old\rWorld,keep\r';
    cache(name, original); const items = parseCSV(original.replace(/\r/g, '\n'), name); items[0].targetText = '你好';
    const result = await generateOriginalFormatExport(name, [items[0]]);
    expect(parseCSVLines(result.content)).toEqual([['source', 'target'], ['Hello', '你好'], ['World', 'keep']]);
    expect(result.content.includes('\n')).toBe(false);
  });
});

describe('YAML/YML 原格式回写', () => {
  it.each(['yaml', 'yml'])('%s 保留非文本值、数组位置、特殊键和未选中项', async ext => {
    const name = 'data.' + ext;
    const original = '"a.b": Literal\nlist: [One, 42, false, null, Two]\nblank: ""\ncount: 3\nenabled: true\noptional: null\ntitle: Hello\n';
    cache(name, original); const items = await parseYAML(original, name);
    const chosen = items.find(item => item.metadata.pathTokens[1] === 4); chosen.targetText = '第二';
    const result = await generateOriginalFormatExport(name, [chosen]);
    expect(result?.filename).toBe('data-translated.' + ext);
    expect(window.jsyaml.load(result.content)).toEqual({ 'a.b': 'Literal', list: ['One', 42, false, null, '第二'], blank: '', count: 3, enabled: true, optional: null, title: 'Hello' });
  });
  it('多文档保留空文档、根字符串和根数组的位置', async () => {
    const name = 'multi.yaml'; const original = '---\nHello\n---\nnull\n---\n- First\n- 8\n---\ntitle: Last\n';
    cache(name, original); const items = await parseYAML(original, name);
    items[0].targetText = '你好'; items[1].targetText = '第一';
    const result = await generateOriginalFormatExport(name, [items[0], items[1]]);
    expect(window.jsyaml.loadAll(result.content)).toEqual(['你好', null, ['第一', 8], { title: 'Last' }]);
  });
  it('别名指向同一对象时，不把另一资源的译文一起覆盖', async () => {
    const name = 'alias.yaml'; const original = 'base: &base\n  title: Hello\ncopy: *base\n';
    cache(name, original); const items = await parseYAML(original, name);
    items[1].targetText = '副本标题';
    const result = await generateOriginalFormatExport(name, [items[1]]);
    expect(window.jsyaml.load(result.content)).toEqual({ base: { title: 'Hello' }, copy: { title: '副本标题' } });
  });
  it('日期和二进制值保持其类型', async () => {
    const name = 'typed.yaml'; const original = 'title: Hello\ndate: 2026-10-08\nbinary: !!binary SGVsbG8=\n';
    cache(name, original); const items = await parseYAML(original, name); items[0].targetText = '你好';
    const result = await generateOriginalFormatExport(name, items);
    const parsed = window.jsyaml.load(result.content);
    expect(parsed.date).toBeInstanceOf(Date); expect(parsed.date.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect([...parsed.binary]).toEqual([72, 101, 108, 108, 111]);
  });
  it('旧项目仅有路径字符串的条目能回写', async () => {
    cache('legacy.yml', 'app:\n  list: [First, Second]\ncount: 4');
    const result = await generateOriginalFormatExport('legacy.yml', [{ sourceText: 'Second', targetText: '第二', metadata: { file: 'legacy.yml', path: 'app.list[1]' } }]);
    expect(window.jsyaml.load(result.content)).toEqual({ app: { list: ['First', '第二'] }, count: 4 });
  });
  it('旧路径与带点的字面键发生歧义时拒绝猜测', async () => {
    cache('ambiguous.yml', '"a.b": Hello\na:\n  b: Hello');
    await expect(generateOriginalFormatExport('ambiguous.yml', [{ sourceText: 'Hello', targetText: '你好', metadata: { path: 'a.b' } }])).rejects.toThrow(/路径/);
  });
  it('原文件文字变化时拒绝覆盖，保留缓存原文', async () => {
    const name = 'changed.yml'; const items = await parseYAML('title: Hello', name); items[0].targetText = '你好';
    cache(name, 'title: New');
    await expect(generateOriginalFormatExport(name, items)).rejects.toThrow(/原文/);
    expect(AppState.fileMetadata[name].originalContent).toBe('title: New');
  });
});

describe('根 JSON 与批量原格式导出', () => {
  it('根 JSON 字符串写回译文，包括旧项目的 $ 路径', async () => {
    cache('root.json', '"Hello"'); const items = parseJSON('"Hello"', 'root.json'); items[0].targetText = '你好';
    expect(JSON.parse((await generateOriginalFormatExport('root.json', items)).content)).toBe('你好');
    delete items[0].metadata.pathTokens;
    expect(JSON.parse((await generateOriginalFormatExport('root.json', items)).content)).toBe('你好');
  });
  it('界面导出等待异步 YAML，按文件生成正确内容', async () => {
    cache('async.yaml', 'title: Hello\ncount: 2'); const items = await parseYAML('title: Hello\ncount: 2', 'async.yaml');
    items[0].targetText = '你好'; items[0].status = 'edited';
    await runExport(items, true);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile.mock.calls[0][1]).toBe('async-translated.yaml');
    expect(window.jsyaml.load(downloadFile.mock.calls[0][0])).toEqual({ title: '你好', count: 2 });
  });
  it('某文件失败仍导出后续文件，提示准确的失败文件', async () => {
    cache('bad.yaml', 'title: [broken'); cache('good.csv', 'source,target\nHello,old');
    const good = parseCSV('source,target\nHello,old', 'good.csv'); good[0].targetText = '你好';
    await runExport([{ sourceText: 'Bad', targetText: '坏', metadata: { file: 'bad.yaml', pathTokens: ['title'] } }, ...good]);
    expect(downloadFile).toHaveBeenCalledTimes(1); expect(downloadFile.mock.calls[0][1]).toBe('good-translated.csv');
    expect(showNotification.mock.calls.some(call => call[0] === 'warning' && call[2].includes('bad.yaml') && call[2].includes('成功导出 1'))).toBe(true);
    expect(showNotification.mock.calls.some(call => call[2].includes('YAML 源文件无法解析') && call[2].includes('行，第'))).toBe(true);
  });
});
