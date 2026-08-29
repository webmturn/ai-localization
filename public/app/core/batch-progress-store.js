// ==================== 批量翻译进度存储（BatchProgressStore） ====================
// AppState.translations 切片中"批量进度态"字段的唯一写入方（Owner）：
// isInProgress / isPaused / progress / lastFailedItems / lastBatchContext。
//
// 背景：此前这些字段散落在 actions.js / business-logic.js /
// result-handler-v2.js 共 25 处裸写，另有 _batchStarted / _batchCancelled
// 两个**未声明幽灵字段**（state.js 无声明）承载跨模块取消协议——
// services/translation/engines/base/ai-engine-base.js 依赖三字段组合
// 判断"用户取消 vs 正常结束"。本 Store 将取消协议收编为显式内部字段
// （_started / _cancelled），对外暴露 isUserCancelled() 语义 getter，
// 协议单点文档化，杜绝清理"看似私有"字段时静默失效。
//
// 语义边界（与 TranslationViewStore 相区分）：
// - 视图态（用户看到的）→ TranslationViewStore；
// - 批量进度态（运行中的进程态）→ 本 Store；
// 两者同属 translations 切片的不同子域，互不越界。
//
// 约定：业务代码禁止再直接写批量进度态字段，一律经由本 Store
// （CI 静态检查 scripts/check-state-ownership.mjs 守护，含
// _batchStarted / _batchCancelled 幽灵字段复活防护）。
//
// 兼容性：ai-engine-base.js 的取消检测历史依赖
// `_batchCancelled === true` 或 `_batchStarted && !isInProgress` 组合，
// 本 Store 维持同语义的内部字段并按需镜像写入 AppState（过渡期），
// 旧测试桩（直写 translations._batchCancelled 等）不受影响。

const BatchProgressStore = {
  // ──────────────── getters（读取一律走这里） ────────────────

  /** @returns {boolean} 批量翻译是否进行中 */
  isBatchInProgress() {
    return !!AppState.translations.isInProgress;
  },

  /** @returns {boolean} 批量翻译是否暂停 */
  isBatchPaused() {
    return !!AppState.translations.isPaused;
  },

  /** @returns {Object} 进度快照 { current, total, status } */
  getProgress() {
    return AppState.translations.progress || { current: 0, total: 0, status: "" };
  },

  /** @returns {Array} 最近一次批量的失败项列表 */
  getLastFailedItems() {
    return AppState.translations.lastFailedItems || [];
  },

  /** @returns {Object|null} 最近一次批量的上下文（scope/engine/语言对等） */
  getLastBatchContext() {
    return AppState.translations.lastBatchContext || null;
  },

  /**
   * 用户取消检测（跨模块取消协议的语义化封装）。
   * 协议（与旧 _batchStarted/_batchCancelled 组合判断语义一致）：
   *   - 显式取消：beginBatch 后 cancelBatch 置位 _cancelled → true
   *   - 隐式取消：批量曾启动（_started）且 isInProgress 已变 false → true
   *   - 从未启动批量或正常运行中 → false
   * @returns {boolean}
   */
  isUserCancelled() {
    if (this._cancelled === true) return true;
    return !!(this._started && AppState.translations.isInProgress === false);
  },

  // ──────────────── 意图式 API（写入一律走这里） ────────────────

  /**
   * 批量开始（translateSelected / translateAll / retryFailed 场景统一入口）。
   * 复位取消标记、失败列表，写入批量上下文。
   *
   * @param {Object} [context] - 批量上下文（scope / sourceLang / targetLang / engine / selectedFile）
   * @returns {Object|null} 写入后的 lastBatchContext
   */
  beginBatch(context) {
    AppState.translations.isInProgress = true;
    AppState.translations.isPaused = false;
    AppState.translations.lastFailedItems = [];
    AppState.translations.lastBatchContext = context || null;
    this._started = true;
    this._cancelled = false;
    // 镜像旧协议字段（过渡期：ai-engine-base.js 检测逻辑改读本 Store 后删除）
    AppState.translations._batchStarted = true;
    AppState.translations._batchCancelled = false;
    return AppState.translations.lastBatchContext;
  },

  /**
   * 批量正常结束（finally 清理场景）：复位进行/暂停标记。
   * 不清 lastFailedItems / lastBatchContext（重试入口要读）。
   */
  endBatch() {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
  },

  /**
   * 用户取消：复位进行/暂停标记并置取消位，供引擎层中断判定。
   */
  cancelBatch() {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    this._cancelled = true;
    this._started = false;
    // 镜像旧协议字段（过渡期）
    AppState.translations._batchCancelled = true;
    AppState.translations._batchStarted = false;
  },

  /** 暂停批量（等待当前请求完成后挂起）。 */
  pauseBatch() {
    AppState.translations.isPaused = true;
  },

  /** 继续批量。 */
  resumeBatch() {
    AppState.translations.isPaused = false;
  },

  /**
   * 报告进度（progress.js updateProgress 的状态写入部分）。
   *
   * @param {number} current - 已完成数
   * @param {number} total - 总数
   * @param {string} [status] - 状态描述
   * @returns {Object} 写入后的进度对象
   */
  reportProgress(current, total, status) {
    AppState.translations.progress = {
      current: Number.isFinite(current) ? current : 0,
      total: Number.isFinite(total) ? total : 0,
      status: status || "",
    };
    return AppState.translations.progress;
  },

  /**
   * 记录失败项（resultHandler / 重试逻辑写入，供 retryFailedTranslations 读取）。
   *
   * @param {Array} items - 失败条目（通常为 errors.map(e => e.item).filter(Boolean)）
   * @returns {Array} 写入后的失败项列表
   */
  recordFailedItems(items) {
    AppState.translations.lastFailedItems = Array.isArray(items) ? items : [];
    return AppState.translations.lastFailedItems;
  },

  /**
   * 全清空（ProjectStore.clearProject 场景经 TranslationViewStore.clearView
   * 联动；本 Store 独立提供，用于项目清空时复位批量态与取消协议）。
   */
  clearBatch() {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    AppState.translations.progress = { current: 0, total: 0, status: "" };
    AppState.translations.lastFailedItems = [];
    AppState.translations.lastBatchContext = null;
    this._started = false;
    this._cancelled = false;
    AppState.translations._batchStarted = false;
    AppState.translations._batchCancelled = false;
  },
};

// 暴露到全局（供各模块与单元测试直达）
if (typeof window !== "undefined") {
  window.BatchProgressStore = BatchProgressStore;
}

// ==================== 开发模式写审计 ====================
// 复用 dev-tools.js 的 installSliceOwnershipAudit：任何绕过 BatchProgressStore
// 的 AppState.translations 顶层赋值都会打印带调用栈的告警（仅开发模式）。
// 属性级写入（AppState.translations.<字段> = ...）由 CI 静态检查守护。
if (typeof installSliceOwnershipAudit === "function") {
  installSliceOwnershipAudit("BatchProgressStore", BatchProgressStore, [
    "translations",
  ]);
}
