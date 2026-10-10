import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function createRestoreContext(project, savedTerms = null) {
  const silent = { error() {}, warn() {}, info() {}, debug() {} };
  const local = new Map(savedTerms === null ? [] : [['terminologyList', JSON.stringify(savedTerms)]]);
  const context = {
    AppState: {
      project: null, fileMetadata: {}, translations: {},
      terminology: {
        list: [{ id: 1, source: 'Sample', target: '示例术语' }],
        filtered: [], currentPage: 1,
      },
    },
    loggers: { app: silent, startup: silent },
    document: {
      readyState: 'loading',
      addEventListener(type, handler) { this.initTerms = handler; },
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value),
    },
    safeJsonParse: (value, fallback) => {
      try { return JSON.parse(value); } catch { return fallback; }
    },
    TranslationViewStore: { setViewItems() {}, resetView() {} },
    DOMCache: { get: () => null },
    updateTerminologyList: vi.fn(),
    autoSaveManager: { restoreProject: async () => project },
  };
  context.window = context;
  vm.createContext(context);
  for (const name of [
    'core/project-store.js',
    'core/terminology-store.js',
    'features/terminology/init.js',
    'core/bootstrap.js',
  ]) {
    vm.runInContext(readFileSync(resolve(import.meta.dirname, '../public/app', name), 'utf8'), context);
  }
  return context;
}

function savedProject(terms) {
  const project = {
    id: 'from-backup', name: '备份项目', sourceLanguage: 'en', targetLanguage: 'zh',
    translationItems: [], fileMetadata: {},
  };
  if (terms !== undefined) project.terminologyList = terms;
  return project;
}

describe('异步恢复项目时的术语库一致性', () => {
  it('清空环境仅导入项目后，恢复项目术语替换先初始化的示例术语', async () => {
    const unique = [{ id: 800, source: 'BackupOnly', target: '备份独有术语' }];
    const project = savedProject(unique);
    const context = createRestoreContext(project);
    context.document.initTerms();
    expect(context.TerminologyStore.getList()[0].source).toBe('Sample');
    await context.initializeProjectData();
    expect(context.TerminologyStore.getList()).toEqual(unique);
    expect(context.TerminologyStore.getFiltered()).toEqual(unique);
    expect(context.updateTerminologyList).toHaveBeenCalledTimes(1);
    // 再保存项目时由运行时快照回写，不能把备份内术语覆写成示例术语。
    context.ProjectStore.setTerminologyList(context.TerminologyStore.getList());
    expect(context.AppState.project.terminologyList).toEqual(unique);
  });

  it('恢复项目术语覆盖项目恢复前载入的不同全局术语库', async () => {
    const projectTerms = [{ id: 800, source: 'Project', target: '项目术语' }];
    const context = createRestoreContext(savedProject(projectTerms), [{ id: 1, source: 'Global', target: '全局术语' }]);
    context.document.initTerms();
    expect(context.TerminologyStore.getList()[0].source).toBe('Global');
    await context.initializeProjectData();
    expect(context.TerminologyStore.getList()).toEqual(projectTerms);
    expect(context.AppState.project.terminologyList).toBe(context.TerminologyStore.getList());
  });

  it('项目明确保存空术语库时，恢复后清空示例或全局术语', async () => {
    const context = createRestoreContext(savedProject([]), [{ id: 1, source: 'Global', target: '全局术语' }]);
    context.document.initTerms();
    await context.initializeProjectData();
    expect(context.TerminologyStore.getList()).toEqual([]);
    expect(context.TerminologyStore.getFiltered()).toEqual([]);
    expect(context.AppState.project.terminologyList).toEqual([]);
    expect(context.updateTerminologyList).toHaveBeenCalledTimes(1);
  });

  it('不含术语字段的旧项目继续使用已初始化的全局术语', async () => {
    const globalTerms = [{ id: 1, source: 'Global', target: '全局术语' }];
    const context = createRestoreContext(savedProject(undefined), globalTerms);
    context.document.initTerms();
    await context.initializeProjectData();
    expect(context.TerminologyStore.getList()).toEqual(globalTerms);
    expect(context.updateTerminologyList).not.toHaveBeenCalled();
  });
});
