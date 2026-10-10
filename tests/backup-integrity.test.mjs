import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadSource, setupGlobals } from './setup.mjs';

beforeAll(() => {
  setupGlobals();
  loadSource('public/app/services/auto-save-manager.js');
  loadSource('public/app/features/translations/export/project.js');
  loadSource('public/app/ui/event-listeners/data-management.js');
});

let manager;
let downloads;
let handlers;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const project = (id, name = id) => ({
  id, name, sourceLanguage: 'en', targetLanguage: 'zh',
  translationItems: [{ id: 'one', sourceText: 'Hello', targetText: '保存的旧译文' }],
  terminologyList: [], fileMetadata: {},
});

beforeEach(() => {
  vi.useFakeTimers();
  downloads = [];
  handlers = {};
  globalThis.AppState = { project: project('current'), fileMetadata: {}, translations: {} };
  globalThis.TranslationViewStore = { getViewItems: () => AppState.project?.translationItems || [] };
  globalThis.TerminologyStore = { getList: () => [{ source: 'Hello', target: '你好' }] };
  globalThis.buildFileContentKey = (id, name) => `${id}::${name}`;
  globalThis.idbPutFileContent = vi.fn().mockResolvedValue(true);
  globalThis.idbGetFileContent = vi.fn().mockResolvedValue(null);
  globalThis.notifyIndexedDbFileContentErrorOnce = vi.fn();
  globalThis.scheduleIdbGarbageCollection = vi.fn();
  globalThis.showNotification = vi.fn();
  globalThis.storageManager = {
    saveProject: vi.fn().mockResolvedValue(true),
    saveCurrentProject: vi.fn().mockResolvedValue(true),
    loadCurrentProject: vi.fn().mockResolvedValue(null),
    listProjects: vi.fn().mockResolvedValue([]),
    getActiveProjectId: vi.fn().mockResolvedValue(null),
    loadProjectById: vi.fn().mockResolvedValue(null),
  };
  manager = new window.autoSaveManager.constructor();
  vi.spyOn(manager, 'showSaveIndicator').mockImplementation(() => {});
  globalThis.DOMCache = { get: (id) => ['exportAllBtn', 'exportProjectBtn'].includes(id) ? { id } : null };
  globalThis.EventManager = { add: (element, event, handler) => { handlers[element.id] = handler; } };
  globalThis.SettingsCache = { get: () => ({ theme: 'dark' }) };
  URL.createObjectURL = vi.fn((blob) => { downloads.push(blob); return 'blob:backup'; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  manager.stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('自动保存原文与异步编辑完整性', () => {
  it('已有 contentKey 写入失败时重试，并在项目中保留原文的唯一副本', async () => {
    AppState.fileMetadata = { 'a.txt': { contentKey: 'current::a.txt', originalContent: 'Hello\n' } };
    idbPutFileContent.mockRejectedValueOnce(new Error('unavailable'));
    await manager.saveProject();
    expect(idbPutFileContent).toHaveBeenCalledWith('current::a.txt', 'Hello\n');
    expect(storageManager.saveCurrentProject.mock.calls[0][0].fileMetadata['a.txt'].originalContent).toBe('Hello\n');
    expect(AppState.fileMetadata['a.txt'].originalContent).toBe('Hello\n');
    expect(manager.isDirty).toBe(false);

    await manager.saveProject();
    expect(idbPutFileContent).toHaveBeenCalledTimes(2);
    expect(storageManager.saveCurrentProject.mock.calls[1][0].fileMetadata['a.txt'].originalContent).toBeUndefined();
    expect(AppState.fileMetadata['a.txt'].originalContent).toBe('Hello\n');
  });

  it('空文件原文也尝试存储，失败后保留空字符串', async () => {
    AppState.fileMetadata = { 'empty.txt': { originalContent: '' } };
    idbPutFileContent.mockRejectedValueOnce(new Error('unavailable'));
    await manager.saveProject();
    expect(idbPutFileContent).toHaveBeenCalledWith('current::empty.txt', '');
    expect(storageManager.saveCurrentProject.mock.calls[0][0].fileMetadata['empty.txt']).toEqual({
      originalContent: '', contentKey: 'current::empty.txt',
    });
  });

  it('原文写失败且本地空间不足时，不通过删除唯一原文伪报成功', async () => {
    AppState.fileMetadata = { 'a.txt': { contentKey: 'current::a.txt', originalContent: 'Hello' } };
    idbPutFileContent.mockRejectedValueOnce(new Error('unavailable'));
    storageManager.saveCurrentProject.mockRejectedValueOnce(Object.assign(new Error('full'), { name: 'QuotaExceededError' }));
    await manager.saveProject();
    expect(storageManager.saveCurrentProject).toHaveBeenCalledTimes(1);
    expect(storageManager.saveCurrentProject.mock.calls[0][0].fileMetadata['a.txt'].originalContent).toBe('Hello');
    expect(manager.getStats()).toMatchObject({ isDirty: true, isSaving: false, saveCount: 0, errorCount: 1 });
    expect(manager.showSaveIndicator).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith('error', '自动保存失败', expect.stringContaining('请先导出项目备份'));

    await manager.saveProject();
    expect(manager.getStats()).toMatchObject({ isDirty: false, saveCount: 1 });
    expect(storageManager.saveCurrentProject.mock.calls[1][0].fileMetadata['a.txt'].originalContent).toBeUndefined();
  });

  it('等待原文存储期间的编辑保留 dirty，下一次保存包含新译文', async () => {
    const pending = deferred();
    AppState.fileMetadata = { 'a.txt': { originalContent: 'Hello' } };
    idbPutFileContent.mockReturnValueOnce(pending.promise);
    const saving = manager.saveProject();
    AppState.project.translationItems[0].targetText = '正在校对的新译文';
    manager.markDirty();
    pending.resolve(true);
    await saving;
    expect(storageManager.saveCurrentProject.mock.calls[0][0].translationItems[0].targetText).toBe('保存的旧译文');
    expect(manager.isDirty).toBe(true);
    expect(manager.showSaveIndicator).not.toHaveBeenCalled();
    await manager.saveProject();
    expect(storageManager.saveCurrentProject.mock.calls[1][0].translationItems[0].targetText).toBe('正在校对的新译文');
    expect(manager.isDirty).toBe(false);
  });

  it('异步期间切换项目时，旧项目原文引用不混入新项目 ID', async () => {
    const pending = deferred();
    AppState.fileMetadata = { 'a.txt': { originalContent: 'A' }, 'b.txt': { originalContent: 'B' } };
    idbPutFileContent.mockReturnValueOnce(pending.promise);
    const saving = manager.saveProject();
    AppState.project = project('next');
    AppState.fileMetadata = {};
    pending.resolve(true);
    await saving;
    expect(idbPutFileContent.mock.calls).toEqual([['current::a.txt', 'A'], ['current::b.txt', 'B']]);
    expect(storageManager.saveCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'current' }), expect.any(Object));
    expect(storageManager.saveCurrentProject.mock.calls[0][1].shouldSetActive()).toBe(false);
    expect(storageManager.saveProject).not.toHaveBeenCalled();
    expect(manager.isDirty).toBe(true);
  });

  it('同 ID 的项目重新载入成新对象时，也不把旧对象视为当前项目', async () => {
    const pending = deferred();
    AppState.fileMetadata = { 'a.txt': { originalContent: 'Old content' } };
    idbPutFileContent.mockReturnValueOnce(pending.promise);
    const saving = manager.saveProject();
    AppState.project = project('current', '重新载入的项目');
    AppState.fileMetadata = {};
    pending.resolve(true);
    await saving;
    expect(storageManager.saveCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'current' }), expect.any(Object));
    expect(storageManager.saveCurrentProject.mock.calls[0][1].shouldSetActive()).toBe(false);
    expect(storageManager.saveProject).not.toHaveBeenCalled();
    expect(manager.isDirty).toBe(true);
  });
});

async function readDownload(index = 0) {
  const blob = downloads[index];
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe('设置数据管理完整备份', () => {
  it('导出当前项目使用尚未自动保存的译文和内存原文', async () => {
    vi.useRealTimers();
    AppState.project.translationItems[0].targetText = '最新校对';
    AppState.fileMetadata = { 'a.txt': { originalContent: 'Hello\n', contentKey: 'current::a.txt' } };
    storageManager.loadCurrentProject.mockResolvedValue(project('current', '保存的旧项目'));
    registerEventListenersDataManagement({});
    await handlers.exportProjectBtn();
    const data = await readDownload();
    expect(data.project.translationItems[0].targetText).toBe('最新校对');
    expect(data.project.fileMetadata['a.txt'].originalContent).toBe('Hello\n');
    expect(data.project.terminologyList).toEqual([{ source: 'Hello', target: '你好' }]);
    expect(storageManager.loadCurrentProject).not.toHaveBeenCalled();
  });

  it('导出全部补齐历史原文，同时以当前编辑替换历史同 ID 快照', async () => {
    vi.useRealTimers();
    AppState.project.name = '当前新名称';
    AppState.project.translationItems[0].targetText = '当前编辑';
    AppState.fileMetadata = { 'live.txt': { originalContent: 'Live' } };
    const historical = project('older');
    historical.fileMetadata = { 'old.txt': { contentKey: 'older::old.txt' } };
    storageManager.listProjects.mockResolvedValue([{ id: 'older', name: '旧项目' }, { id: 'current', name: '保存的旧名称' }]);
    storageManager.loadProjectById.mockImplementation(async (id) => id === 'older' ? historical : project(id));
    idbGetFileContent.mockResolvedValue('Historical original');
    registerEventListenersDataManagement({});
    await handlers.exportAllBtn();
    const data = await readDownload();
    expect(data.projectsData).toHaveLength(2);
    expect(data.projectsData.find((p) => p.id === 'older').fileMetadata['old.txt'].originalContent).toBe('Historical original');
    expect(data.projectsData.find((p) => p.id === 'current').translationItems[0].targetText).toBe('当前编辑');
    expect(data.currentProject).toEqual(data.projectsData.find((p) => p.id === 'current'));
    expect(data.projectsIndex.find((p) => p.id === 'current').name).toBe('当前新名称');
    expect(data.activeProjectId).toBe('current');
    expect(data.terminologyList).toEqual([{ source: 'Hello', target: '你好' }]);
    expect(storageManager.loadProjectById.mock.calls).toEqual([['older']]);
    expect(historical.fileMetadata['old.txt'].originalContent).toBeUndefined();
  });

  it('新项目尚未进入历史索引时，也包含在全部备份和索引中', async () => {
    vi.useRealTimers();
    AppState.fileMetadata = { 'empty.txt': { originalContent: '' } };
    registerEventListenersDataManagement({});
    await handlers.exportAllBtn();
    const data = await readDownload();
    expect(data.projectsData.map((p) => p.id)).toEqual(['current']);
    expect(data.projectsIndex.map((p) => p.id)).toEqual(['current']);
    expect(data.currentProject.fileMetadata['empty.txt'].originalContent).toBe('');
  });

  it('没有打开项目时，全部备份仍携带点击时的独立术语库', async () => {
    vi.useRealTimers();
    AppState.project = null;
    const terms = [{ id: 901, source: 'NoProjectTerm', target: '无项目术语' }];
    TerminologyStore.getList = () => terms;
    const pending = deferred();
    storageManager.listProjects.mockReturnValue(pending.promise);
    registerEventListenersDataManagement({});
    const exporting = handlers.exportAllBtn();
    terms[0].target = '点击后编辑';
    pending.resolve([]);
    await exporting;
    const data = await readDownload();
    expect(data.currentProject).toBeNull();
    expect(data.projectsData).toEqual([]);
    expect(data.terminologyList).toEqual([{ id: 901, source: 'NoProjectTerm', target: '无项目术语' }]);
  });

  it('备份等待历史原文时，新编辑不会混入点击时的项目快照', async () => {
    vi.useRealTimers();
    const pending = deferred();
    AppState.fileMetadata = { 'live.txt': { originalContent: 'Live' } };
    const historical = project('older');
    historical.fileMetadata = { 'old.txt': { contentKey: 'older::old.txt' } };
    storageManager.listProjects.mockResolvedValue([{ id: 'older', name: '历史项目' }]);
    storageManager.loadProjectById.mockResolvedValue(historical);
    idbGetFileContent.mockReturnValue(pending.promise);
    registerEventListenersDataManagement({});
    const exporting = handlers.exportAllBtn();
    AppState.project.translationItems[0].targetText = '点击后才编辑的译文';
    AppState.fileMetadata['live.txt'].originalContent = 'Changed after click';
    pending.resolve('Historical');
    await exporting;
    const data = await readDownload();
    expect(data.currentProject.translationItems[0].targetText).toBe('保存的旧译文');
    expect(data.currentProject.fileMetadata['live.txt'].originalContent).toBe('Live');
  });

  it.each(['exportProjectBtn', 'exportAllBtn'])('%s 缺少原文时停止完整备份并告知文件名', async (button) => {
    AppState.fileMetadata = { 'missing.txt': { contentKey: 'current::missing.txt' } };
    registerEventListenersDataManagement({});
    await handlers[button]();
    expect(downloads).toHaveLength(0);
    expect(showNotification).toHaveBeenCalledWith('error', '导出失败', expect.stringContaining('missing.txt'));
  });

  it('历史项目读取失败时，不下载伪完整的全部备份', async () => {
    storageManager.listProjects.mockResolvedValue([{ id: 'missing', name: '无法读取的历史项目' }]);
    registerEventListenersDataManagement({});
    await handlers.exportAllBtn();
    expect(downloads).toHaveLength(0);
    expect(showNotification).toHaveBeenCalledWith('error', '导出失败', expect.stringContaining('无法读取的历史项目'));
  });

  it('索引读取失败时显示错误，不能以空索引继续导出', async () => {
    storageManager.listProjects.mockRejectedValue(new Error('索引读取失败'));
    registerEventListenersDataManagement({});
    await handlers.exportAllBtn();
    expect(downloads).toHaveLength(0);
    expect(showNotification).toHaveBeenCalledWith('error', '导出失败', '索引读取失败');
  });
});
