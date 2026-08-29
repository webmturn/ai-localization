// ==================== 翻译视图状态存储（TranslationViewStore） ====================
// AppState.translations 切片中"视图态"字段的唯一写入方（Owner）：
// filtered / selected / multiSelected / currentPage / searchQuery / itemsPerPage / selectedFile。
//
// 背景：此前 10 个文件、37 处直接裸写 translations 视图态字段，无所有权边界，
// 任何模块都能改视图选择/过滤/分页。本 Store 以"意图式 API"收编全部写入。
//
// translations 切片子域三分治：
// - canonical 条目：AppState.project.translationItems（Owner: ProjectStore）；
//   视图稳定引用由本 Store 的 _viewItems 承载（阶段 3b 已删除
//   AppState.translations.items 兼容别名，渲染/持久化一律经 getViewItems()）；
// - 视图态：上述 7 个字段（Owner: 本 Store）；
// - 批量进度态：isInProgress / isPaused / progress / lastFailedItems /
//   lastBatchContext 暂留 actions.js / progress.js（本阶段观察，不归本 Store）。
//
// 稳定视图条目引用（显式设计）：
// - 本 Store 内部持有 _viewItems，由 ProjectStore 在 loadProject /
//   setTranslationItems / replaceFileItems 时经 setViewItems() 设置；
// - ProjectStore.swapTranslationItems（质量检查临时换出 canonical 条目）不触碰它，
//   因此检查期间渲染仍看到全量列表——此前依赖"预期的别名断裂"，现为显式设计；
// - 渲染与持久化一律经 getViewItems() 读取。
//
// 约定：业务代码禁止再直接写 translations 视图态字段，一律经由本 Store
// （CI 静态检查 scripts/check-state-ownership.mjs 守护）。

const TranslationViewStore = {
  // 稳定的视图条目引用（唯一的视图条目数据源；swap 窗口期间仍为全量列表）
  _viewItems: [],

  // ──────────────── getters（读取一律走这里） ────────────────

  /** @returns {Array} 视图条目（稳定引用，质量检查 swap 期间不被换出） */
  getViewItems() {
    return this._viewItems;
  },

  /** @returns {Array} 过滤后的视图列表 */
  getFiltered() {
    return AppState.translations.filtered;
  },

  /** @returns {number} 主选中索引（-1 = 未选中） */
  getSelected() {
    return AppState.translations.selected;
  },

  /** @returns {number[]} 多选索引列表 */
  getMultiSelected() {
    return AppState.translations.multiSelected;
  },

  /** @returns {number} 当前页码 */
  getCurrentPage() {
    return AppState.translations.currentPage;
  },

  /** @returns {string} 搜索关键词 */
  getSearchQuery() {
    return AppState.translations.searchQuery;
  },

  /** @returns {number} 每页条数 */
  getItemsPerPage() {
    return AppState.translations.itemsPerPage;
  },

  /** @returns {string|null} 当前选中的文件（null = 全项目） */
  getSelectedFile() {
    return AppState.translations.selectedFile;
  },

  // ──────────────── 意图式 API（写入一律走这里） ────────────────

  /**
   * 设置视图条目的稳定引用（ProjectStore 载入/替换条目时调用）。
   *
   * @param {Array} items - 条目数组（保持原引用，不复制）
   * @returns {Array} 写入后的条目数组
   */
  setViewItems(items) {
    const list = Array.isArray(items) ? items : [];
    this._viewItems = list;
    return list;
  },

  /**
   * 写入过滤后的视图列表。
   *
   * @param {Array} items - 过滤结果（保持原引用，不复制）
   * @returns {Array} 写入后的过滤列表
   */
  setFilter(items) {
    AppState.translations.filtered = Array.isArray(items) ? items : [];
    return AppState.translations.filtered;
  },

  /**
   * 设置主选中索引。
   *
   * @param {number} index - 索引（-1 = 取消选中）
   * @returns {number} 写入后的索引
   */
  setSelection(index) {
    AppState.translations.selected = index;
    return AppState.translations.selected;
  },

  /**
   * 整体替换多选索引列表。
   *
   * @param {number[]} arr - 索引数组
   * @returns {number[]} 写入后的多选列表
   */
  setMultiSelection(arr) {
    AppState.translations.multiSelected = Array.isArray(arr) ? arr : [];
    return AppState.translations.multiSelected;
  },

  /**
   * 设置当前页码（边界判断由调用方结合 getFiltered/getItemsPerPage 完成）。
   *
   * @param {number} page - 页码
   * @returns {number} 写入后的页码
   */
  setPage(page) {
    AppState.translations.currentPage = page;
    return AppState.translations.currentPage;
  },

  /**
   * 设置搜索关键词（null/undefined 归一为空串）。
   *
   * @param {string} query - 关键词
   * @returns {string} 写入后的关键词
   */
  setSearchQuery(query) {
    AppState.translations.searchQuery = query == null ? "" : query;
    return AppState.translations.searchQuery;
  },

  /**
   * 设置每页条数（用户设置项，不随项目清空）。
   *
   * @param {number} count - 每页条数
   * @returns {number} 写入后的每页条数
   */
  setItemsPerPage(count) {
    AppState.translations.itemsPerPage = count;
    return AppState.translations.itemsPerPage;
  },

  /**
   * 设置当前选中的文件（文件树过滤视图）。
   *
   * @param {string|null} fileName - 文件名（null = 全项目）
   * @returns {string|null} 写入后的选中文件
   */
  setSelectedFile(fileName) {
    AppState.translations.selectedFile = fileName == null ? null : fileName;
    return AppState.translations.selectedFile;
  },

  /**
   * 重置视图到初始分页状态：filtered 恢复为全量视图条目，
   * selected/currentPage/searchQuery 复位。
   * 不触碰 multiSelected / selectedFile / itemsPerPage 与稳定条目引用
   * （与 ProjectStore.loadProject 的历史重置语义一致）。
   */
  resetView() {
    AppState.translations.filtered = [...this._viewItems];
    AppState.translations.selected = -1;
    AppState.translations.currentPage = 1;
    AppState.translations.searchQuery = "";
  },

  /**
   * 全清空（ProjectStore.clearProject 用）：稳定引用、
   * filtered / selected / multiSelected / currentPage / searchQuery /
   * selectedFile 全部复位。相比旧 clearProject 额外清理遗留的
   * multiSelected / selectedFile（项目已不存在，陈旧选中无意义）。
   * 保留 itemsPerPage（用户设置项，非按项目视图态）。
   */
  clearView() {
    this._viewItems = [];
    AppState.translations.filtered = [];
    AppState.translations.selected = -1;
    AppState.translations.multiSelected = [];
    AppState.translations.currentPage = 1;
    AppState.translations.searchQuery = "";
    AppState.translations.selectedFile = null;
  },
};

// 暴露到全局（供各模块与单元测试直达）
if (typeof window !== "undefined") {
  window.TranslationViewStore = TranslationViewStore;
}

// ==================== 开发模式写审计 ====================
// 复用 dev-tools.js 的 installSliceOwnershipAudit：任何绕过 TranslationViewStore
// 的 AppState.translations 顶层赋值都会打印带调用栈的告警（仅开发模式）。
// 属性级写入（AppState.translations.<字段> = ...）由 CI 静态检查守护。
if (typeof installSliceOwnershipAudit === "function") {
  installSliceOwnershipAudit("TranslationViewStore", TranslationViewStore, [
    "translations",
  ]);
}
