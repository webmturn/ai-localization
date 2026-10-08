import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSource, setupGlobals } from './setup.mjs';

let settings;
beforeAll(() => {
  setupGlobals();
  for (const parser of ['parser-registry', 'parser-utils', 'text']) loadSource('public/app/parsers/' + parser + '.js');
  loadSource('public/app/features/files/read.js');
  loadSource('public/app/features/files/parse.js');
  loadSource('public/app/features/files/source-editor.js');
  loadSource('public/app/features/translations/export/translation-original.js');
});
beforeEach(() => {
  settings = { autoDetectEncoding: true, textParseMode: 'auto' };
  globalThis.SettingsCache = { get: () => settings };
  globalThis.AppState = { project: { id: 'text', name: 'Text', translationItems: [] }, fileMetadata: {} };
  globalThis.showNotification = vi.fn();
  globalThis.DOMCache = { get: () => null };
  globalThis.buildFileContentKey = (project, file) => project + '/' + file;
  globalThis.idbPutFileContent = vi.fn().mockResolvedValue(undefined);
  globalThis.ProjectStore = {
    setFileMetadata: vi.fn((name, meta) => { AppState.fileMetadata[name] = meta; }),
    replaceFileItems: vi.fn((_name, items) => { AppState.project.translationItems = items; }),
    getTranslationItems: () => AppState.project.translationItems,
  };
});
const cache = (name, originalContent, textParseMode) => { AppState.fileMetadata[name] = { originalContent, extension: name.includes('.') ? name.split('.').pop() : '', ...(textParseMode ? { parserId: 'text', textParseMode } : {}) }; };
const parse = (text, name, options = {}) => App.impl.parseFileAsync(new File([text], name), { silent: true, skipPersist: true, ...options });

describe('文本解析模式', () => {
  it.each(['Chapter 1: The Beginning', 'Hello, world', 'https://example.com/path?a=b', 'Time: 10:30', 'a + b = c', '  padded text  '])('自动模式保留整行 %s', text => {
    expect(parseTextFile(text, 'prose.txt')[0].sourceText).toBe(text);
  });
  it('自动模式仍识别明确的 key=value', () => {
    const items = parseTextFile('menu.open = Open\n"menu title"="Hello"', 'keys.txt');
    expect(items.map(item => item.sourceText)).toEqual(['Open', 'Hello']);
    expect(items.map(item => item.metadata.resourceId)).toEqual(['menu.open', 'menu title']);
  });
  it('普通文本行末反斜杠不吞掉下一行', () => {
    expect(parseTextFile('C:\\folder\\\nNext sentence', 'prose.txt').map(item => item.sourceText)).toEqual(['C:\\folder\\', 'Next sentence']);
  });
  it('逐行模式保留注释样式文字、标题、等号和 Tab', () => {
    const text = '# Chapter\n; Note\n[Introduction]\nhello=world\na\tb';
    expect(parseTextFile(text, 'prose.txt', { mode: 'plain' }).map(item => item.sourceText)).toEqual(text.split('\n'));
  });
  it('键值模式支持显式分隔符、section 与空值过滤', () => {
    const items = parseTextFile('[menu]\nopen: Open\nempty=\n[dialog]\nopen=Open\nother\tOther\nlast,Last', 'keys.txt', { mode: 'keyValue' });
    expect(items.map(item => item.sourceText)).toEqual(['Open', 'Open', 'Other', 'Last']);
    expect(items[0].metadata.identity).not.toBe(items[1].metadata.identity);
    expect(items[0].metadata.textSection).toBe('menu'); expect(items[1].metadata.textSection).toBe('dialog');
    expect(items[0].context).toContain('menu'); expect(items[1].context).toContain('dialog');
  });
  it.each(['auto', 'keyValue'])('%s 识别带分隔符的字面引号键', mode => {
    const items = parseTextFile('"a=b"=Hello\n"a:b"=World', 'keys.txt', { mode });
    expect(items.map(item => item.metadata.resourceId)).toEqual(['a=b', 'a:b']);
    expect(items.map(item => item.sourceText)).toEqual(['Hello', 'World']);
  });
  it('键值模式按第一个分隔符拆分，值里的等号和冒号保留', () => {
    expect(parseTextFile('url: https://example.com/?a=b\nlabel=Time: 10:30', 'keys.txt', { mode: 'keyValue' }).map(item => item.sourceText)).toEqual(['https://example.com/?a=b', 'Time: 10:30']);
  });
  it('奇数个反斜杠才续行，偶数个反斜杠保留', () => {
    const text = 'first=Hello\\\n  world\npath=C:\\folder\\\\\nnext=Next';
    const items = parseTextFile(text, 'keys.txt');
    expect(items.map(item => item.sourceText)).toEqual(['Helloworld', 'C:\\folder\\\\', 'Next']);
    expect(items[0].metadata.textLineEnd).toBe(2);
  });
  it('新导入的键值续行缺少下一行时明确失败', async () => {
    const result = await parse('key=Unfinished\\\n', 'keys.txt');
    expect(result.success).toBe(false); expect(result.items).toEqual([]); expect(result.error).toContain('续行');
  });
  it('文件入口使用设置并保存模式，显式选项可以覆盖', async () => {
    settings.textParseMode = 'plain';
    const result = await App.impl.parseFileAsync(new File(['hello=world'], 'prose.txt'), { silent: true });
    expect(result.items[0].sourceText).toBe('hello=world');
    expect(AppState.fileMetadata['prose.txt'].textParseMode).toBe('plain');
    expect(AppState.fileMetadata['prose.txt'].parserId).toBe('text');
    expect((await parse('hello: world', 'keys.txt', { textParseMode: 'keyValue' })).items[0].sourceText).toBe('world');
  });
});

describe('文本原格式导出', () => {
  it('TXT 只修改选中行，保留空行、注释、缩进与 CRLF', async () => {
    const name = 'prose.txt'; const text = '# comment\r\n\r\n  Chapter 1: The Beginning  \r\nHello, world\r\n';
    cache(name, text, 'auto'); const items = parseTextFile(text, name); items[0].targetText = '  第 1 章：开始  ';
    const result = await generateOriginalFormatExport(name, [items[0]]);
    expect(result?.filename).toBe('prose-translated.txt');
    expect(result.content).toBe('# comment\r\n\r\n  第 1 章：开始  \r\nHello, world\r\n');
  });
  it('BOM、混合行尾和末行没有换行均保留', async () => {
    const text = '\uFEFFHello\r\nWorld\nEnd'; cache('mixed.txt', text, 'plain');
    const items = parseTextFile(text, 'mixed.txt', { mode: 'plain' }); items[1].targetText = '世界';
    expect((await generateOriginalFormatExport('mixed.txt', [items[1]])).content).toBe('\uFEFFHello\r\n世界\nEnd');
  });
  it('同文和重复键按行定位，不把一条译文写到另一条', async () => {
    const name = 'keys.txt'; const text = 'open=Open\nopen=Open\n';
    cache(name, text, 'auto'); const items = parseTextFile(text, name); items[1].targetText = '打开对话框';
    expect((await generateOriginalFormatExport(name, [items[1]])).content).toBe('open=Open\nopen=打开对话框\n');
  });
  it('保留键、分隔符、引号、缩进和未选中续行，选中续行只修改自身', async () => {
    const name = 'keys.txt'; const text = '[menu]\n  title : "Hello"  \nbody=First\\\n  second\nkeep=Third\\\n  fourth\n';
    cache(name, text, 'keyValue'); const items = parseTextFile(text, name, { mode: 'keyValue' });
    items[0].targetText = '标题'; items[1].targetText = '正文';
    expect((await generateOriginalFormatExport(name, items.slice(0, 2))).content).toBe('[menu]\n  title : "标题"  \nbody=正文\nkeep=Third\\\n  fourth\n');
  });
  it('纯文本译文的实际换行按源文件行尾导出', async () => {
    cache('lines.txt', 'Hello\rWorld\r', 'plain'); const items = parseTextFile('Hello\rWorld\r', 'lines.txt', { mode: 'plain' }); items[0].targetText = '第一行\n第二行';
    expect((await generateOriginalFormatExport('lines.txt', [items[0]])).content).toBe('第一行\r第二行\rWorld\r');
  });
  it('键值译文中的实际换行明确拒绝，避免生成额外键或内容', async () => {
    cache('keys.txt', 'a=Hello\nb=World', 'auto'); const items = parseTextFile('a=Hello\nb=World', 'keys.txt'); items[0].targetText = '第一\n第二';
    await expect(Promise.resolve().then(() => generateOriginalFormatExport('keys.txt', [items[0]]))).rejects.toThrow(/换行/);
  });
  it('译文尾随反斜杠、前后空格和字面引号不会变成续行或丢失', async () => {
    cache('keys.txt', 'a=Hello\nb=World', 'auto'); const items = parseTextFile('a=Hello\nb=World', 'keys.txt');
    for (const target of ['C:\\folder\\', '  padded  ', '"Quoted"']) {
      items[0].targetText = target;
      const result = await generateOriginalFormatExport('keys.txt', [items[0]]);
      expect(parseTextFile(result.content, 'keys.txt')[0].sourceText).toBe(target);
      expect(parseTextFile(result.content, 'keys.txt')[1].sourceText).toBe('World');
    }
  });
  it.each(['notes.custom', 'README'])('文本兜底导入的 %s 保留实际文件扩展名或无扩展名', async name => {
    const text = 'Hello\nWorld'; cache(name, text, 'plain'); const items = parseTextFile(text, name, { mode: 'plain' }); items[0].targetText = '你好';
    const result = await generateOriginalFormatExport(name, [items[0]]);
    expect(result?.filename).toBe(name.includes('.') ? 'notes-translated.custom' : 'README-translated');
    expect(result.content).toBe('你好\nWorld');
  });
  it('旧项目冒号和逗号键值按原有含义回写', async () => {
    cache('legacy.txt', 'menu: Open\nnext,Next\n');
    const items = [{ sourceText: 'Open', targetText: '打开', context: 'Text key: menu', metadata: { file: 'legacy.txt', resourceId: 'menu', position: 'line-1' } }];
    expect((await generateOriginalFormatExport('legacy.txt', items)).content).toBe('menu: 打开\nnext,Next\n');
  });
  it('源文位置或内容变化时拒绝写入，缺少源文件时明确提示', async () => {
    const items = parseTextFile('Hello', 'changed.txt'); items[0].targetText = '你好'; cache('changed.txt', 'Different', 'auto');
    await expect(Promise.resolve().then(() => generateOriginalFormatExport('changed.txt', items))).rejects.toThrow(/原文|位置/);
    delete AppState.fileMetadata['changed.txt'].originalContent;
    await expect(Promise.resolve().then(() => generateOriginalFormatExport('changed.txt', items))).rejects.toThrow(/原始内容/);
  });
});

describe('源文件编辑器保留文本模式与译文', () => {
  const save = async (text, items, mode, editedText) => {
    cache('edit.txt', text, mode); AppState.project.translationItems = items;
    document.body.innerHTML = '<textarea id="sourceEditorContent"></textarea><div id="sourceEditorError"></div>';
    globalThis.DOMCache = { get: id => document.getElementById(id) };
    globalThis.autoSaveManager = { markDirty: vi.fn(), saveProject: vi.fn().mockResolvedValue(undefined) };
    globalThis.updateFileTree = vi.fn(); globalThis.updateTranslationLists = vi.fn(); globalThis.updateCounters = vi.fn();
    globalThis.openModal = vi.fn(); globalThis.closeModal = vi.fn();
    await openSourceEditor('edit.txt');
    if (editedText !== undefined) document.getElementById('sourceEditorContent').value = editedText;
    await saveSourceEditor();
  };
  it('修改全局模式不会改变已导入文件的解析方式', async () => {
    const text = 'hello=world'; const items = parseTextFile(text, 'edit.txt', { mode: 'plain' }); items[0].targetText = '你好=世界'; items[0].status = 'edited';
    settings.textParseMode = 'keyValue'; await save(text, items, 'plain');
    expect(AppState.project.translationItems[0]).toMatchObject({ sourceText: text, targetText: '你好=世界', status: 'edited' });
  });
  it('旧项目保存源文件保持旧键值含义和人工译文', async () => {
    const text = 'menu: Open\n'; const items = [{ id: 'old', sourceText: 'Open', targetText: '人工打开', status: 'edited', context: 'Text key: menu', metadata: { file: 'edit.txt', resourceId: 'menu', position: 'line-1' } }];
    await save(text, items);
    expect(AppState.project.translationItems[0]).toMatchObject({ id: 'old', sourceText: 'Open', targetText: '人工打开' });
    expect(AppState.fileMetadata['edit.txt'].textParseMode).toBe('legacy');
  });
  it('不同 section 的同文同键重新排序后仍保留各自译文', async () => {
    const text = '[menu]\nopen=Open\n[dialog]\nopen=Open'; const items = parseTextFile(text, 'edit.txt', { mode: 'keyValue' });
    items[0].targetText = '菜单打开'; items[1].targetText = '对话框打开'; items.forEach(item => item.status = 'edited');
    await save(text, items, 'keyValue', '[dialog]\nopen=Open\n[menu]\nopen=Open');
    expect(AppState.project.translationItems.map(item => item.targetText)).toEqual(['对话框打开', '菜单打开']);
  });
});
