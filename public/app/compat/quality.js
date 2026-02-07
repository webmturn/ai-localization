// ==================== 质量检查功能 ====================

function __ensureQualityModuleLoaded() {
  try {
    const App = window.App;
    const ensure = App?.services?.ensureQualityModule;
    if (typeof ensure === "function") return ensure();
  } catch (_) {
    (loggers.app || console).debug("compat quality module loader:", _);
  }
  return Promise.reject(new Error("Quality module loader not available"));
}

// 重置筛选条件
function resetIssueFilter() {
  const App = window.App;
  const impl = App?.impl?.resetIssueFilter;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __resetIssueFilterImpl === "function"
      ? __resetIssueFilterImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      resetIssueFilter();
    } catch (e) {
      (loggers.app || console).error("resetIssueFilter (after load) failed:", e);
    }
  });
}

// 运行质量检查（优化版）
async function runQualityCheck() {
  const App = window.App;
  const impl = App?.impl?.runQualityCheck;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __runQualityCheckImpl === "function" ? __runQualityCheckImpl : null;
  if (typeof legacy === "function") return legacy();
  await __ensureQualityModuleLoaded();
  return runQualityCheck();
}

// 批处理函数
async function processBatch(items) {
  const App = window.App;
  const impl = App?.impl?.processBatch;
  if (typeof impl === "function") return impl(items);
  const legacy =
    typeof __processBatchImpl === "function" ? __processBatchImpl : null;
  if (typeof legacy === "function") return legacy(items);
  await __ensureQualityModuleLoaded();
  return processBatch(items);
}

// 带缓存的检查函数
async function checkTranslationItemCached(item) {
  const App = window.App;
  const impl = App?.impl?.checkTranslationItemCached;
  if (typeof impl === "function") return impl(item);
  const legacy =
    typeof __checkTranslationItemCachedImpl === "function"
      ? __checkTranslationItemCachedImpl
      : null;
  if (typeof legacy === "function") return legacy(item);
  await __ensureQualityModuleLoaded();
  return checkTranslationItemCached(item);
}

// 优化的检查函数
async function checkTranslationItemOptimized(item) {
  const App = window.App;
  const impl = App?.impl?.checkTranslationItemOptimized;
  if (typeof impl === "function") return impl(item);
  const legacy =
    typeof __checkTranslationItemOptimizedImpl === "function"
      ? __checkTranslationItemOptimizedImpl
      : null;
  if (typeof legacy === "function") return legacy(item);
  await __ensureQualityModuleLoaded();
  return checkTranslationItemOptimized(item);
}

// 转义正则表达式特殊字符
function escapeRegex(text) {
  const App = window.App;
  const impl = App?.impl?.escapeRegex;
  if (typeof impl === "function") return impl(text);
  const legacy =
    typeof __escapeRegexImpl === "function" ? __escapeRegexImpl : null;
  if (typeof legacy === "function") return legacy(text);
  __ensureQualityModuleLoaded().then(function () {
    try {
      escapeRegex(text);
    } catch (e) {
      (loggers.app || console).error("escapeRegex (after load) failed:", e);
    }
  });
}

// 计算总体评分
function calculateOverallScore() {
  const App = window.App;
  const impl = App?.impl?.calculateOverallScore;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __calculateOverallScoreImpl === "function"
      ? __calculateOverallScoreImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      calculateOverallScore();
    } catch (e) {
      (loggers.app || console).error("calculateOverallScore (after load) failed:", e);
    }
  });
}

// 更新质量报告UI
function updateQualityReportUI() {
  const App = window.App;
  const impl = App?.impl?.updateQualityReportUI;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __updateQualityReportUIImpl === "function"
      ? __updateQualityReportUIImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      updateQualityReportUI();
    } catch (e) {
      (loggers.app || console).error("updateQualityReportUI (after load) failed:", e);
    }
  });
}

// 更新问题列表（优化版）
function updateIssuesTable(filter = { severity: "all", type: "all" }) {
  const App = window.App;
  const impl = App?.impl?.updateIssuesTable;
  if (typeof impl === "function") return impl(filter);
  const legacy =
    typeof __updateIssuesTableImpl === "function"
      ? __updateIssuesTableImpl
      : null;
  if (typeof legacy === "function") return legacy(filter);
  __ensureQualityModuleLoaded().then(function () {
    try {
      updateIssuesTable(filter);
    } catch (e) {
      (loggers.app || console).error("updateIssuesTable (after load) failed:", e);
    }
  });
}

// 过滤问题（节流版）
const filterIssuesThrottled = throttle(function () {
  const severity = DOMCache.get("issueFilterSeverity").value;
  const type = DOMCache.get("issueFilterType").value;

  updateIssuesTable({ severity, type });
}, 300);

function filterIssues() {
  filterIssuesThrottled();
}

// 定位到翻译项
function focusTranslationItem(itemId) {
  const App = window.App;
  const impl = App?.impl?.focusTranslationItem;
  if (typeof impl === "function") return impl(itemId);
  const legacy =
    typeof __focusTranslationItemImpl === "function"
      ? __focusTranslationItemImpl
      : null;
  if (typeof legacy === "function") return legacy(itemId);
  __ensureQualityModuleLoaded().then(function () {
    try {
      focusTranslationItem(itemId);
    } catch (e) {
      (loggers.app || console).error("focusTranslationItem (after load) failed:", e);
    }
  });
}

// 更新质量图表
function updateQualityCharts() {
  const App = window.App;
  const impl = App?.impl?.updateQualityCharts;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __updateQualityChartsImpl === "function"
      ? __updateQualityChartsImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      updateQualityCharts();
    } catch (e) {
      (loggers.app || console).error("updateQualityCharts (after load) failed:", e);
    }
  });
}

// 导出质量报告
function exportQualityReportData() {
  const App = window.App;
  const impl = App?.impl?.exportQualityReportData;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __exportQualityReportDataImpl === "function"
      ? __exportQualityReportDataImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      exportQualityReportData();
    } catch (e) {
      (loggers.app || console).error("exportQualityReportData (after load) failed:", e);
    }
  });
}

// 导出质量报告（PDF）
function exportQualityReportPdf() {
  const App = window.App;
  const impl = App?.impl?.exportQualityReportPdf;
  if (typeof impl === "function") return impl();
  const legacy =
    typeof __exportQualityReportPdfImpl === "function"
      ? __exportQualityReportPdfImpl
      : null;
  if (typeof legacy === "function") return legacy();
  __ensureQualityModuleLoaded().then(function () {
    try {
      exportQualityReportPdf();
    } catch (e) {
      (loggers.app || console).error("exportQualityReportPdf (after load) failed:", e);
    }
  });
}
