import { Blob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let app, downloads, events;
const load = file => vm.runInContext(readFileSync(file, 'utf8'), app, { filename: file });
beforeEach(() => {
  document.body.innerHTML = '<div id="projectManagerList"><div data-project-id="current"><button data-action="export">导出</button></div></div>';
  events = new Map(); downloads = [];
  const blobs = new Map();
  app = {
    App: { features: {}, ui: {} }, AppState: { project: null, fileMetadata: {} }, document, Blob,
    DOMCache: { get: id => document.getElementById(id) },
    EventManager: { add(target, type, fn) { events.set(target.id + ':' + type, fn); } },
    TranslationViewStore: { getViewItems: () => app.AppState.project?.translationItems || [] },
    TerminologyStore: { getList: () => app.AppState.project?.terminologyList || [] },
    storageManager: { loadProjectById: vi.fn(), saveProject: vi.fn() },
    idbGetFileContent: vi.fn().mockResolvedValue(null),
    showNotification: vi.fn(),
    loggers: { app: { error: vi.fn(), debug: vi.fn() }, storage: { error: vi.fn() } },
    URL: { createObjectURL(blob) { const url = 'blob:' + blobs.size; blobs.set(url, blob); return url; }, revokeObjectURL: vi.fn() },
    updateFileTree: vi.fn(), updateTranslationLists: vi.fn(), updateCounters: vi.fn(),
    autoSaveManager: { markDirty: vi.fn(), saveProject: vi.fn() },
  };
  app.ProjectStore = { loadProject(project) { app.AppState.project = project; app.AppState.fileMetadata = project.fileMetadata; } };
  app.window = app;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(blobs.get(this.href)); });
  vm.createContext(app);
  load('public/app/features/translations/export/project.js');
  load('public/app/features/projects/manager.js');
  app.registerEventListenersProjectManager();
});
const exportProject = id => {
  document.querySelector('[data-project-id]').dataset.projectId = id;
  return events.get('projectManagerList:click')({ target: document.querySelector('[data-action="export"]') });
};
const project = id => ({ id, name: id, translationItems: [{ id: 'row', sourceText: 'Hello', targetText: '旧译文', status: 'translated' }], fileMetadata: { 'a.txt': { contentKey: id + '::a.txt', originalContent: 'Hello\r\n' } } });

describe('项目管理导出完整快照', () => {
  it('活跃项目取当前校对编辑和术语，不导出旧持久化副本', async () => {
    const current = project('current');
    current.translationItems[0].targetText = '最新校对'; current.translationItems[0].status = 'approved';
    current.terminologyList = [{ source: 'Hello', target: '你好' }];
    app.ProjectStore.loadProject(current);
    app.storageManager.loadProjectById.mockResolvedValue(project('current'));
    await exportProject('current');
    const data = JSON.parse(await downloads[0].text());
    expect(data.project.translationItems[0]).toMatchObject({ targetText: '最新校对', status: 'approved' });
    expect(data.project.terminologyList).toEqual(current.terminologyList);
    expect(data.project.fileMetadata['a.txt'].originalContent).toBe('Hello\r\n');
    expect(app.storageManager.loadProjectById).not.toHaveBeenCalled();
  });
  it('历史项目读取自己的原文缓存，不混入当前项目', async () => {
    app.ProjectStore.loadProject(project('current'));
    const old = project('history'); delete old.fileMetadata['a.txt'].originalContent;
    app.storageManager.loadProjectById.mockResolvedValue(old);
    app.idbGetFileContent.mockResolvedValue('Historical source');
    await exportProject('history');
    const data = JSON.parse(await downloads[0].text());
    expect(data.project.id).toBe('history');
    expect(data.project.fileMetadata['a.txt'].originalContent).toBe('Historical source');
    expect(app.idbGetFileContent).toHaveBeenCalledWith('history::a.txt');
    expect(old.fileMetadata['a.txt'].originalContent).toBeUndefined();
  });
  it('原文缺失时不下载残缺项目，当前校对保持不变', async () => {
    const current = project('current'); delete current.fileMetadata['a.txt'].originalContent;
    app.ProjectStore.loadProject(current);
    await exportProject('current');
    expect(downloads).toEqual([]);
    expect(app.showNotification).toHaveBeenLastCalledWith('error', '项目导出失败', expect.stringContaining('a.txt'));
    expect(current.translationItems[0].targetText).toBe('旧译文');
  });
});

describe('示例项目的真实资源结构', () => {
  it('示例原文与解析路径一致，完整项目和原格式导出均可恢复', async () => {
    load('public/app/parsers/json.js');
    load('public/app/features/sample/sample-project.js');
    app.loadSampleProject();
    const sample = app.AppState.project;
    const portable = await app.App.features.translations.export.buildPortableProject(sample);
    const meta = portable.fileMetadata['sample-project.json'];
    const parsed = app.parseJSON(meta.originalContent, 'sample-project.json');
    expect(parsed.map(item => item.sourceText)).toEqual(sample.translationItems.map(item => item.sourceText));
    expect(parsed.map(item => item.metadata.pathTokens)).toEqual(sample.translationItems.map(item => item.metadata.pathTokens));
    expect(meta.size).toBe(new Blob([meta.originalContent]).size);
    expect(sample.fileFormat).toBe('json');
    expect(JSON.parse(meta.originalContent).app.welcome).toBe(sample.translationItems[0].sourceText);
  });
});
