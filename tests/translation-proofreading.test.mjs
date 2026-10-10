import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadSource, setupGlobals} from './setup.mjs';

beforeAll(() => {
  setupGlobals();
  globalThis.AppState = {project: null, translations: {filtered: [], selected: -1, multiSelected: [], currentPage: 1, itemsPerPage: 20, searchQuery: '', statusFilter: 'all', selectedFile: null}, ui: {sourceSelectionIndicatorEnabled: true}, fileMetadata: {}};
  globalThis.DOMCache = {get: id => document.getElementById(id), queryAll: (selector, root = document) => Array.from(root.querySelectorAll(selector)), batchUpdate: (_key, fn) => fn()};
  globalThis.SettingsCache = {_settings: {translationEngine: 'deepseek', translationModel: 'deepseek-chat'}, get() {return this._settings;}, update(mutator) {mutator(this._settings);}};
  globalThis.EngineRegistry = {get: () => ({name: 'DeepSeek', category: 'ai'}), getDefaultEngineId: () => 'deepseek'};
  globalThis.BatchProgressStore = {isBatchInProgress: () => false};
  globalThis.autoSaveManager = {markDirty: vi.fn()};
  globalThis.isMobileViewport = () => false;
  globalThis.syncTranslationHeights = vi.fn();
  globalThis.highlightTextWithTerms = (text) => document.createTextNode(text);
  globalThis.searchCache = new Map();
  globalThis.isDevelopment = false;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  loadSource('public/app/core/translation-view-store.js');
  loadSource('public/app/core/project-store.js');
  loadSource('public/app/features/translations/status.js');
  loadSource('public/app/features/translations/search.js');
  loadSource('public/app/features/translations/selection.js');
  loadSource('public/app/features/translations/render.js');
  loadSource('public/app/ui/file-tree.js');
  loadSource('public/app/ui/translation-workspace.js');
});

const makeItem = (id, file = 'a.json', targetText = '', status = 'pending') => ({id, sourceText: `Source ${id}`, targetText, status, context: '', metadata: {file}});
beforeEach(() => {
  BatchProgressStore.isBatchInProgress = () => false;
  document.body.innerHTML = `<ul id="fileTree"></ul><div id="sourceList"></div><div id="targetList"></div><div id="mobileCombinedList"></div><span id="sourceCount"></span><span id="targetCount"></span>
    <div id="translationScrollWrapper"></div>
    <div id="paginationContainer"><span id="sourceStartRange"></span><span id="sourceEndRange"></span><span id="sourceTotalItems"></span><span id="paginationFilterHint"></span>
      <select id="paginationPageSize"><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option><option value="100">100</option></select>
      <div class="pagination-navigation"><button id="sourcePrevBtn"></button><input id="sourcePageInput"><span id="sourceTotalPages"></span><button id="sourceNextBtn"></button></div>
    </div><select id="itemsPerPage"><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option><option value="100">100</option></select>`;
  ProjectStore.clearProject();
  TranslationViewStore.setItemsPerPage(20);
  ProjectStore.loadProject({id: 'project', translationItems: Array.from({length: 24}, (_, i) => makeItem(i)), updatedAt: ''});
  TranslationViewStore.setSelectedFile('a.json');
  invalidateSearchCache();
  applySearchFilter();
  autoSaveManager.markDirty.mockClear();
  SettingsCache._settings.itemsPerPage = 20;
});

describe('校对视图行为回归', () => {
  it('XML 标记安全显示、实体可读，模型内容保持完整', () => {
    const item = makeItem(0);
    item.sourceText = 'Hello &amp; <g id="name">world</g><script>test</script>';
    item.metadata.inlineMarkup = true;
    const row = createTranslationItemElement(item, 0, false, true);
    expect(row.querySelector('p').textContent).toBe('Hello & <g #name>world</g><script>test</script>');
    expect(row.querySelectorAll('.translation-inline-token')).toHaveLength(4);
    expect(row.querySelectorAll('g, script')).toHaveLength(0);
    expect(item.sourceText).toBe('Hello &amp; <g id="name">world</g><script>test</script>');
  });
  it('桌面与移动端显示注释、引用和原始状态详情', () => {
    const item = makeItem(0);
    item.metadata.comment = 'Counter hint'; item.metadata.references = ['main.c:12']; item.metadata.originalState = 'fuzzy'; item.metadata.pluralIndex = 0;
    const desktop = createTranslationItemElement(item, 0, false, true);
    const mobile = createMobileCombinedTranslationItemElement(item, 0, false);
    for (const row of [desktop, mobile]) {
      const details = row.querySelector('.translation-resource-details');
      expect(details.textContent).toContain('Counter hint'); expect(details.textContent).toContain('main.c:12');
      expect(details.textContent).toContain('fuzzy'); expect(details.textContent).toContain('复数形式：0');
    }
  });
  it('分页显示总页数及末页范围，单页和空结果保留统计', () => {
    TranslationViewStore.setPage(2);
    updateTranslationLists();
    expect(document.getElementById('sourcePageInput').value).toBe('2');
    expect(document.getElementById('sourceTotalPages').textContent).toBe('2');
    expect(document.getElementById('sourceStartRange').textContent).toBe('21');
    expect(document.getElementById('sourceEndRange').textContent).toBe('24');
    expect(document.getElementById('sourceNextBtn').disabled).toBe(true);
    TranslationViewStore.setFilter(AppState.translations.filtered.slice(0, 3));
    updateTranslationLists();
    expect(document.getElementById('paginationContainer').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('paginationContainer').dataset.singlePage).toBe('true');
    expect(document.querySelector('.pagination-navigation').getAttribute('aria-hidden')).toBe('true');
    TranslationViewStore.setFilter([]);
    updateTranslationLists();
    expect(document.getElementById('sourceTotalItems').textContent).toBe('0');
    expect(document.getElementById('sourceStartRange').textContent).toBe('0');
    expect(document.getElementById('sourcePageInput').disabled).toBe(true);
  });

  it('页码跳转约束边界，非法输入恢复当前页，并清除页外选择', () => {
    updateTranslationLists();
    selectTranslationItem(0, {shouldFocusTextarea: false});
    expect(App.ui.translationWorkspace.jumpToPage('99')).toBe(true);
    expect(AppState.translations.currentPage).toBe(2);
    expect(AppState.translations.selected).toBe(-1);
    expect(document.querySelector('#targetList textarea').dataset.index).toBe('20');
    document.getElementById('sourcePageInput').value = 'abc';
    expect(App.ui.translationWorkspace.jumpToPage('abc')).toBe(false);
    expect(document.getElementById('sourcePageInput').value).toBe('2');
    expect(App.ui.translationWorkspace.jumpToPage('1.5')).toBe(false);
    App.ui.translationWorkspace.jumpToPage('0');
    expect(AppState.translations.currentPage).toBe(1);
    expect(document.getElementById('translationScrollWrapper').scrollTop).toBe(0);
  });

  it('每页数量变化保留阅读所在页，同步保存与设置控件', () => {
    TranslationViewStore.setPage(2);
    updateTranslationLists();
    selectTranslationItem(23, {shouldFocusTextarea: false});
    App.ui.translationWorkspace.changePageSize('10');
    expect(AppState.translations.currentPage).toBe(3);
    expect(AppState.translations.selected).toBe(23);
    expect(document.querySelector('#targetList textarea').dataset.index).toBe('20');
    expect(SettingsCache.get().itemsPerPage).toBe(10);
    expect(document.getElementById('itemsPerPage').value).toBe('10');
    expect(document.getElementById('paginationPageSize').value).toBe('10');
    expect(App.ui.translationWorkspace.changePageSize('0')).toBe(false);
    expect(AppState.translations.itemsPerPage).toBe(10);
  });

  it('每页数量变化仍遵循当前文件、文本搜索及校对筛选', () => {
    ProjectStore.setTranslationItems([makeItem(1, 'a.json', 'Hello', 'approved'), makeItem(2, 'a.json', 'Hello', 'translated'), makeItem(3, 'b.json', 'Hello', 'approved')]);
    invalidateSearchCache();
    TranslationViewStore.setSearchQuery('Hello');
    TranslationViewStore.setStatusFilter('reviewed');
    applySearchFilter();
    App.ui.translationWorkspace.changePageSize('50');
    expect(AppState.translations.filtered.map(item => item.id)).toEqual([1]);
    expect(AppState.translations.searchQuery).toBe('Hello');
    expect(AppState.translations.statusFilter).toBe('reviewed');
    expect(AppState.translations.selectedFile).toBe('a.json');
    expect(document.getElementById('paginationFilterHint').classList.contains('hidden')).toBe(false);
  });
  it('翻译进行中禁止校对标记，结束后恢复行按钮', () => {
    const item = AppState.project.translationItems[0];
    item.targetText = '译文'; item.status = 'translated';
    BatchProgressStore.isBatchInProgress = () => true;
    updateTranslationLists();
    expect(document.querySelector('#targetList [data-action="toggle-reviewed"]').disabled).toBe(true);
    App.ui.translationWorkspace.toggleReviewed(0);
    expect(item.status).toBe('translated');
    BatchProgressStore.isBatchInProgress = () => false;
    App.ui.translationWorkspace.refresh();
    expect(document.querySelector('#targetList [data-action="toggle-reviewed"]').disabled).toBe(false);
  });
  it('Ctrl 多选包含原单选条目，取消最后一项后禁用选中操作', () => {
    updateTranslationLists();
    selectTranslationItem(0, {shouldFocusTextarea: false});
    toggleMultiSelection(1);
    expect(AppState.translations.multiSelected).toEqual([0, 1]);
    toggleMultiSelection(1);
    expect(AppState.translations.multiSelected).toEqual([0]);
    toggleMultiSelection(0);
    expect(AppState.translations.multiSelected).toEqual([]);
    expect(AppState.translations.selected).toBe(-1);
  });
  it('无匹配搜索保持空结果，渲染空状态，禁止全选回退到其他文件', () => {
    ProjectStore.setTranslationItems([...AppState.project.translationItems, makeItem(99, 'b.json')]);
    TranslationViewStore.setSearchQuery('missing query');
    applySearchFilter();
    updateTranslationLists();
    expect(AppState.translations.filtered).toEqual([]);
    expect(document.querySelectorAll('#targetList textarea')).toHaveLength(0);
    expect(document.getElementById('sourceList').textContent).toContain('清除筛选');
    selectCurrentPageTranslationItems();
    expect(AppState.translations.multiSelected).toEqual([]);
    document.querySelector('.translation-reset-filters').click();
    expect(AppState.translations.filtered).toHaveLength(24);
    expect(AppState.translations.filtered.every(item => item.metadata.file === 'a.json')).toBe(true);
  });

  it('译文导航跨页，反向跨页，并在文件边界停止', () => {
    updateTranslationLists();
    expect(App.ui.translationWorkspace.navigate(19, 1)).toBe(true);
    expect(AppState.translations.currentPage).toBe(2);
    expect(document.activeElement.dataset.index).toBe('20');
    expect(App.ui.translationWorkspace.navigate(20, -1)).toBe(true);
    expect(AppState.translations.currentPage).toBe(1);
    expect(document.activeElement.dataset.index).toBe('19');
    expect(App.ui.translationWorkspace.navigate(23, 1)).toBe(false);
    expect(App.ui.translationWorkspace.navigate(0, -1)).toBe(false);
  });

  it('跨页导航遵循搜索结果顺序，不跳到被过滤的条目', () => {
    TranslationViewStore.setItemsPerPage(2);
    TranslationViewStore.setFilter([AppState.project.translationItems[1], AppState.project.translationItems[7], AppState.project.translationItems[22]]);
    updateTranslationLists();
    expect(App.ui.translationWorkspace.navigate(7, 1)).toBe(true);
    expect(AppState.translations.currentPage).toBe(2);
    expect(document.activeElement.dataset.index).toBe('22');
    TranslationViewStore.setItemsPerPage(20);
  });

  it('校对筛选与文本搜索组合，已校对不包含空译文', () => {
    ProjectStore.setTranslationItems([makeItem(1, 'a.json', 'Hello', 'translated'), makeItem(2, 'a.json', 'Hello', 'approved'), makeItem(3, 'a.json', '', 'approved'), makeItem(4, 'b.json', 'Hello', 'approved')]);
    invalidateSearchCache();
    TranslationViewStore.setSearchQuery('Hello');
    TranslationViewStore.setStatusFilter('reviewed');
    applySearchFilter();
    expect(AppState.translations.filtered.map(item => item.id)).toEqual([2]);
    TranslationViewStore.setStatusFilter('unreviewed');
    applySearchFilter();
    expect(AppState.translations.filtered.map(item => item.id)).toEqual([1]);
  });

  it('标记已校对保存状态，待校对视图移除该条并定位下一条', () => {
    ProjectStore.setTranslationItems([makeItem(1, 'a.json', '译文一', 'translated'), makeItem(2, 'a.json', '译文二', 'translated')]);
    invalidateSearchCache();
    TranslationViewStore.setStatusFilter('unreviewed');
    applySearchFilter();
    updateTranslationLists();
    App.ui.translationWorkspace.toggleReviewed(0);
    expect(AppState.project.translationItems[0].status).toBe('approved');
    expect(AppState.translations.filtered.map(item => item.id)).toEqual([2]);
    expect(document.activeElement.dataset.index).toBe('1');
    expect(autoSaveManager.markDirty).toHaveBeenCalledOnce();
  });

  it('空译文不能标记已校对；修改已校对译文撤销标记，重复相同内容保持标记', () => {
    App.ui.translationWorkspace.toggleReviewed(0);
    expect(AppState.project.translationItems[0].status).toBe('pending');
    const item = AppState.project.translationItems[1];
    item.targetText = '原译文'; item.status = 'approved';
    updateTranslationLists();
    updateTranslationItem(1, '原译文');
    expect(item.status).toBe('approved');
    updateTranslationItem(1, '改后的译文');
    expect(item.status).toBe('edited');
    expect(document.querySelector('#targetList [data-index="1"] .translation-status').textContent).toBe('已编辑');
  });

  it('切换项目重置状态筛选，避免把新项目藏在旧筛选下', () => {
    TranslationViewStore.setStatusFilter('reviewed');
    ProjectStore.loadProject({id: 'next', translationItems: [makeItem(40)]});
    expect(AppState.translations.statusFilter).toBe('all');
  });

  it('修订带有旧译文的待翻译资源时，文件进度立即同步', () => {
    ProjectStore.setTranslationItems([makeItem(1, 'a.json', '模糊译文', 'pending'), makeItem(2, 'a.json', '', 'pending')]);
    updateFileTree();
    expect(document.querySelector('#fileTree [title="0/2 已翻译"]').textContent).toBe('0%');
    updateTranslationItem(0, '确认译文');
    expect(document.querySelector('#fileTree [title="1/2 已翻译"]').textContent).toBe('50%');
    expect(document.querySelector('#fileTree [data-filename="a.json"]').classList.contains('bg-blue-50')).toBe(true);
    updateTranslationItem(0, '');
    expect(document.querySelector('#fileTree [title="0/2 已翻译"]').textContent).toBe('0%');
    TranslationViewStore.setSelectedFile(null);
    updateFileTree();
    expect(document.querySelector('#fileTree [data-filename="a.json"]').classList.contains('bg-blue-50')).toBe(false);
  });

  it('直接确认已有译文的待翻译资源时，文件进度同步校对状态', () => {
    ProjectStore.setTranslationItems([makeItem(1, 'a.json', '已确认译文', 'pending')]);
    invalidateSearchCache(); applySearchFilter(); updateTranslationLists(); updateFileTree();
    App.ui.translationWorkspace.toggleReviewed(0);
    expect(document.querySelector('#fileTree [title="1/1 已翻译"]').textContent).toBe('100%');
    expect(document.querySelector('#fileTree [data-filename="a.json"]').classList.contains('bg-blue-50')).toBe(true);
    expect(AppState.project.translationItems[0].status).toBe('approved');
  });
});
