import { Blob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let app;
let downloads;
let fileInput;

function load(file) {
  vm.runInContext(readFileSync(file, 'utf8'), app, { filename: file });
}

beforeEach(() => {
  downloads = [];
  const blobs = new Map();
  document.body.innerHTML = '<select id="sourceLanguage"></select><select id="targetLanguage"></select>';
  app = {
    App: { features: {}, parsers: {} },
    AppState: { project: null, fileMetadata: {} },
    Blob,
    document,
    loggers: { app: { error: vi.fn(), debug: vi.fn() }, storage: { error: vi.fn() } },
    DOMCache: { get: id => document.getElementById(id) },
    EventManager: { add: (element, event, callback) => element.addEventListener(event, callback) },
    showNotification: vi.fn(),
    showConfirmDialog: vi.fn().mockResolvedValue(true),
    updateFileTree: vi.fn(),
    updateTranslationLists: vi.fn(),
    updateCounters: vi.fn(),
    updateTerminologyList: vi.fn(),
    hydrateFileMetadataContentKeys: vi.fn(),
    idbGetFileContent: vi.fn().mockResolvedValue(null),
    idbPutFileContent: vi.fn().mockResolvedValue(true),
    buildFileContentKey: (projectId, fileName) => projectId + '::' + fileName,
    storageManager: { saveCurrentProject: vi.fn().mockResolvedValue(true), saveProject: vi.fn().mockResolvedValue(true) },
    TranslationViewStore: { getViewItems: () => app.AppState.project?.translationItems || [] },
    TerminologyStore: {
      getList: () => app.AppState.project?.terminologyList || [],
      loadTerminology: vi.fn(),
    },
    URL: {
      createObjectURL: vi.fn(blob => {
        const key = 'blob:' + blobs.size;
        blobs.set(key, blob);
        return key;
      }),
      revokeObjectURL: vi.fn(),
    },
  };
  app.window = app;
  app.ProjectStore = {
    touchProject: () => { app.AppState.project.updatedAt = '2026-10-11T01:00:00.000Z'; },
    setTerminologyList: list => { app.AppState.project.terminologyList = list; },
    loadProject: project => {
      app.AppState.project = project;
      app.AppState.fileMetadata = project.fileMetadata || {};
    },
  };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ name: this.download, blob: blobs.get(this.href) });
  });
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () { fileInput = this; });
  vm.createContext(app);
  load('public/app/parsers/text.js');
  load('public/app/features/translations/export/translation-original.js');
  load('public/app/features/translations/export/project.js');
});

function seed(originalContent = '# comment\r\nhello=Hello\r\nkeep=Keep\r\n') {
  const items = app.parseTextFile(originalContent, 'messages.txt', { mode: 'auto' });
  items[0].targetText = '你好';
  items[0].status = 'approved';
  items[0].metadata.note = '校对保留';
  const project = {
    id: 'portable', name: '可迁移项目', sourceLanguage: 'en', targetLanguage: 'zh',
    translationItems: items,
    terminologyList: [{ id: 'term', source: 'Hello', target: '你好' }],
    promptTemplate: { systemPrompt: '项目模板' },
    createdAt: '2026-10-10T01:00:00.000Z',
    fileMetadata: {
      'messages.txt': { originalContent, contentKey: 'portable::messages.txt', extension: 'txt', parserId: 'text', textParseMode: 'auto' },
    },
  };
  app.ProjectStore.loadProject(project);
  return project;
}

async function downloadedProject() {
  expect(downloads).toHaveLength(1);
  return JSON.parse(await downloads[0].blob.text());
}

const buildPortable = project => app.App.features.translations.export.buildPortableProject(project);

describe('手动保存的可迁移项目 JSON', () => {
  it('下载含原文件、译文、校对状态和资源元数据，本地保存保持轻量引用', async () => {
    const original = seed();
    await app.saveProject();
    const saved = await downloadedProject();
    expect(saved.fileMetadata['messages.txt'].originalContent).toBe(original.fileMetadata['messages.txt'].originalContent);
    expect(saved.translationItems).toEqual(original.translationItems);
    expect(saved.terminologyList).toEqual(original.terminologyList);
    expect(saved.promptTemplate).toEqual(original.promptTemplate);
    expect(downloads[0].name).toBe('可迁移项目.json');
    const local = app.storageManager.saveCurrentProject.mock.calls[0][0];
    expect(local.fileMetadata['messages.txt'].originalContent).toBeUndefined();
    expect(local.fileMetadata['messages.txt'].contentKey).toBe('portable::messages.txt');
    expect(original.fileMetadata['messages.txt'].originalContent).toContain('# comment');
  });

  it('原文仅在 IndexedDB 时等待读取完成后下载，不产生缺原文快照', async () => {
    const project = seed();
    const original = project.fileMetadata['messages.txt'].originalContent;
    delete project.fileMetadata['messages.txt'].originalContent;
    let resolveContent;
    app.idbGetFileContent.mockImplementation(() => new Promise(resolve => { resolveContent = resolve; }));
    const saving = app.saveProject();
    await Promise.resolve();
    expect(downloads).toEqual([]);
    resolveContent(original);
    await saving;
    expect((await downloadedProject()).fileMetadata['messages.txt'].originalContent).toBe(original);
    expect(app.idbGetFileContent).toHaveBeenCalledWith('portable::messages.txt');
  });

  it('在没有旧 IndexedDB 的环境打开下载项目后仍可按原格式导出', async () => {
    seed();
    await app.saveProject();
    const raw = await downloads[0].blob.text();
    app.AppState = { project: null, fileMetadata: {} };
    app.idbGetFileContent.mockResolvedValue(null);
    app.readFileAsync = vi.fn().mockResolvedValue(raw);
    app.openProject();
    Object.defineProperty(fileInput, 'files', { value: [new File([raw], 'project.json')] });
    fileInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(app.AppState.project?.name).toBe('可迁移项目'));
    const restored = app.AppState.project;
    expect(restored.translationItems[0].status).toBe('approved');
    expect(restored.translationItems[0].metadata.note).toBe('校对保留');
    const exported = app.generateOriginalFormatExport('messages.txt', restored.translationItems);
    expect(exported.content).toBe('# comment\r\nhello=你好\r\nkeep=Keep\r\n');
    expect(app.idbGetFileContent).not.toHaveBeenCalled();
  });

  it('本地存储写入失败仍下载完整项目，并显示明确警告', async () => {
    seed();
    app.storageManager.saveCurrentProject.mockRejectedValue(new Error('storage unavailable'));
    await app.saveProject();
    expect((await downloadedProject()).fileMetadata['messages.txt'].originalContent).toContain('hello=Hello');
    expect(app.showNotification).toHaveBeenLastCalledWith('warning', '项目已下载', expect.stringContaining('未能写入本地项目列表'));
  });

  it('IndexedDB 写入失败时内部降级保存保留原文，下载仍完整', async () => {
    const project = seed();
    app.idbPutFileContent.mockRejectedValue(new Error('IDB blocked'));
    await app.saveProject();
    const local = app.storageManager.saveCurrentProject.mock.calls[0][0];
    expect(local.fileMetadata['messages.txt'].originalContent).toBe(project.fileMetadata['messages.txt'].originalContent);
    expect((await downloadedProject()).fileMetadata['messages.txt'].originalContent).toBe(project.fileMetadata['messages.txt'].originalContent);
  });

  it.each([null, undefined, 123])('原文件内容缺失 (%s) 时不下载看似完整的项目', async missing => {
    const project = seed();
    delete project.fileMetadata['messages.txt'].originalContent;
    app.idbGetFileContent.mockResolvedValue(missing);
    await app.saveProject();
    expect(downloads).toEqual([]);
    expect(app.showNotification).toHaveBeenLastCalledWith('error', expect.any(String), expect.stringContaining('messages.txt'));
    expect(app.AppState.project.translationItems[0].targetText).toBe('你好');
  });

  it('原文件缓存读取失败时保留当前编辑并显示文件名，不下载残缺备份', async () => {
    const project = seed();
    delete project.fileMetadata['messages.txt'].originalContent;
    app.idbGetFileContent.mockRejectedValue(new Error('IDB blocked'));
    await app.saveProject();
    expect(downloads).toEqual([]);
    expect(app.showNotification).toHaveBeenLastCalledWith('error', expect.any(String), expect.stringContaining('messages.txt'));
    expect(app.AppState.project.translationItems[0].status).toBe('approved');
  });

  it('读取原文期间切换项目，下载的文件名和数据仍来自开始保存时的项目', async () => {
    const project = seed();
    const original = project.fileMetadata['messages.txt'].originalContent;
    delete project.fileMetadata['messages.txt'].originalContent;
    let resolveContent;
    app.idbGetFileContent.mockImplementation(() => new Promise(resolve => { resolveContent = resolve; }));
    const saving = app.saveProject();
    await Promise.resolve();
    project.translationItems[0].targetText = '之后的编辑';
    app.ProjectStore.loadProject({ id: 'next', name: '另一个项目', translationItems: [], fileMetadata: {} });
    resolveContent(original);
    await saving;
    const saved = await downloadedProject();
    expect(saved.name).toBe('可迁移项目');
    expect(saved.translationItems[0].targetText).toBe('你好');
    expect(downloads[0].name).toBe('可迁移项目.json');
    expect(app.AppState.project.name).toBe('另一个项目');
    expect(app.storageManager.saveCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'portable', name: '可迁移项目' }), expect.objectContaining({ setActive: false, shouldSetActive: expect.any(Function) }));
    expect(app.storageManager.saveCurrentProject.mock.calls[0][1].shouldSetActive()).toBe(false);
    expect(app.storageManager.saveProject).not.toHaveBeenCalled();
  });
});

describe('可迁移项目打包辅助函数', () => {
  it('空原文件也是有效内容，且不会修改输入项目', async () => {
    const project = { id: 'empty', translationItems: [], fileMetadata: { 'empty.txt': { originalContent: '', contentKey: 'empty::empty.txt' } } };
    const portable = await buildPortable(project);
    expect(portable.fileMetadata['empty.txt'].originalContent).toBe('');
    expect(portable).not.toBe(project);
    expect(portable.fileMetadata).not.toBe(project.fileMetadata);
    expect(app.idbGetFileContent).not.toHaveBeenCalled();
  });

  it('没有资源文件的新项目可正常打包', async () => {
    expect(await buildPortable({ id: 'new', translationItems: [], fileMetadata: {} })).toEqual({ id: 'new', translationItems: [], fileMetadata: {} });
  });

  it('只有文件元数据没有原文及缓存引用时明确要求重新导入', async () => {
    await expect(buildPortable({ id: 'old', fileMetadata: { 'lost.yml': { extension: 'yml' } } })).rejects.toThrow(/lost\.yml.*重新导入/);
  });
});
