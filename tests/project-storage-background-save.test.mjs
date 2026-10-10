import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let manager;
let app;
let primary;
let fallback;

function backend(backendId) {
  const records = new Map([
    ['currentProject', { id: 'current', name: '当前项目' }],
    ['__meta__:activeProjectId', 'current'],
    ['__meta__:projectsIndex', [{ id: 'current', name: '当前项目' }]],
  ]);
  return {
    backendId, records,
    saveJson: vi.fn(async (key, value) => { records.set(key, JSON.parse(JSON.stringify(value))); return true; }),
    loadJson: vi.fn(async key => records.get(key) ?? null),
  };
}

beforeEach(() => {
  app = {
    console,
    loggers: { storage: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    showNotification: vi.fn(),
    storageErrorHandler: { handleError: vi.fn() },
  };
  vm.createContext(app);
  vm.runInContext(readFileSync('public/app/services/storage/storage-manager.js', 'utf8') + '\nthis.manager = storageManager;', app);
  manager = app.manager;
  primary = backend('indexeddb');
  fallback = backend('localStorage');
  manager.backends = { indexeddb: primary, localStorage: fallback };
  manager.preferredBackendId = 'indexeddb';
  manager.ensureBackendAvailable = vi.fn().mockResolvedValue(true);
  manager.__persistPreferredBackend = vi.fn();
});

const oldSnapshot = () => ({ id: 'previous', name: '此前项目', sourceLanguage: 'en', targetLanguage: 'zh', translationItems: [{ targetText: '保存中的译文', status: 'approved' }] });

function expectCurrentPreserved(storage) {
  expect(storage.records.get('currentProject')).toEqual({ id: 'current', name: '当前项目' });
  expect(storage.records.get('__meta__:activeProjectId')).toBe('current');
}

describe('后台项目快照保存', () => {
  it('setActive:false 更新旧项目及索引，保留当前项目和活跃 ID', async () => {
    await manager.saveProject(oldSnapshot(), { setActive: false });
    expect(primary.records.get('project:previous').translationItems[0].status).toBe('approved');
    expect(primary.records.get('__meta__:projectsIndex').map(project => project.id)).toEqual(['current', 'previous']);
    expectCurrentPreserved(primary);
  });

  it('默认保存仍更新当前项目与活跃 ID', async () => {
    await manager.saveProject(oldSnapshot());
    expect(primary.records.get('currentProject').id).toBe('previous');
    expect(primary.records.get('__meta__:activeProjectId')).toBe('previous');
  });

  it('写项目快照的等待期间切换项目，动态检查阻止 legacy 与 active 回写', async () => {
    let isCurrent = true;
    const saveJson = primary.saveJson.getMockImplementation();
    primary.saveJson.mockImplementation(async (key, value) => {
      const result = await saveJson(key, value);
      if (key === 'project:previous') isCurrent = false;
      return result;
    });
    await manager.saveCurrentProject(oldSnapshot(), { shouldSetActive: () => isCurrent });
    expect(primary.records.get('project:previous').name).toBe('此前项目');
    expectCurrentPreserved(primary);
  });

  it('legacy 写入的等待期间切换，active 写入前再次检查', async () => {
    let isCurrent = true;
    const saveJson = primary.saveJson.getMockImplementation();
    primary.saveJson.mockImplementation(async (key, value) => {
      const result = await saveJson(key, value);
      if (key === 'currentProject') isCurrent = false;
      return result;
    });
    await manager.saveCurrentProject(oldSnapshot(), { shouldSetActive: () => isCurrent });
    expect(primary.records.get('__meta__:activeProjectId')).toBe('current');
    expect(primary.saveJson.mock.calls.map(([key]) => key)).not.toContain('__meta__:activeProjectId');
  });

  it('文件夹存储同步备用后端时也保留两侧活跃项目', async () => {
    const filesystem = backend('filesystem');
    manager.backends.filesystem = filesystem;
    manager.preferredBackendId = 'filesystem';
    await manager.saveProject(oldSnapshot(), { setActive: false });
    expectCurrentPreserved(filesystem);
    expectCurrentPreserved(primary);
    expect(filesystem.records.get('project:previous').name).toBe('此前项目');
    expect(primary.records.get('project:previous').name).toBe('此前项目');
    expect(primary.records.get('__meta__:projectsIndex').map(project => project.id)).toEqual(['current', 'previous']);
  });

  it('文件夹默认保存仍同步备用后端的当前项目与活跃 ID', async () => {
    const filesystem = backend('filesystem');
    manager.backends.filesystem = filesystem;
    manager.preferredBackendId = 'filesystem';
    await manager.saveProject(oldSnapshot());
    expect(filesystem.records.get('currentProject').id).toBe('previous');
    expect(filesystem.records.get('__meta__:activeProjectId')).toBe('previous');
    expect(primary.records.get('currentProject').id).toBe('previous');
    expect(primary.records.get('__meta__:activeProjectId')).toBe('previous');
  });

  it('文件夹存储等待期间切换，备用后端写 active 前也检查', async () => {
    let isCurrent = true;
    const filesystem = backend('filesystem');
    manager.backends.filesystem = filesystem;
    manager.preferredBackendId = 'filesystem';
    const saveJson = filesystem.saveJson.getMockImplementation();
    filesystem.saveJson.mockImplementation(async (key, value) => {
      const result = await saveJson(key, value);
      if (key === '__meta__:projectsIndex') isCurrent = false;
      return result;
    });
    await manager.saveProject(oldSnapshot(), { shouldSetActive: () => isCurrent });
    expectCurrentPreserved(primary);
    expect(primary.records.get('project:previous').name).toBe('此前项目');
  });

  it('IDB 降级保存保留 setActive:false，不因切回 localStorage 激活旧项目', async () => {
    primary.saveJson.mockRejectedValue(new Error('IDB unavailable'));
    await manager.saveCurrentProject(oldSnapshot(), { setActive: false });
    expect(manager.preferredBackendId).toBe('localStorage');
    expect(fallback.records.get('project:previous').translationItems[0].targetText).toBe('保存中的译文');
    expectCurrentPreserved(primary);
    expectCurrentPreserved(fallback);
    expect(app.showNotification).toHaveBeenCalledWith('warning', '已降级保存', expect.any(String));
  });

  it('默认 IDB 降级仍更新 localStorage 当前项目与活跃 ID', async () => {
    primary.saveJson.mockRejectedValue(new Error('IDB unavailable'));
    await manager.saveCurrentProject(oldSnapshot());
    expect(fallback.records.get('currentProject').id).toBe('previous');
    expect(fallback.records.get('__meta__:activeProjectId')).toBe('previous');
  });
});
