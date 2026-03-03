// ==================== 批量翻译断点续传 ====================
// 将批量翻译进度持久化到 localStorage，中断后可从断点恢复

var BatchResumeManager = (function () {
  var STORAGE_KEY = "__batchResume";
  var MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时过期

  /**
   * 保存批量翻译进度
   * @param {string} batchId - 批次 ID（通常基于文件名+时间戳）
   * @param {Object} state - 进度状态
   */
  function saveProgress(batchId, state) {
    try {
      var data = _loadAll();
      data[batchId] = {
        completedIndices: state.completedIndices || [],
        totalCount: state.totalCount || 0,
        engine: state.engine || "",
        sourceLang: state.sourceLang || "",
        targetLang: state.targetLang || "",
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      (loggers.translation || console).debug("BatchResume saveProgress:", e);
    }
  }

  /**
   * 标记单个条目为已完成
   */
  function markCompleted(batchId, index) {
    try {
      var data = _loadAll();
      if (!data[batchId]) return;
      if (!data[batchId].completedIndices.includes(index)) {
        data[batchId].completedIndices.push(index);
        data[batchId].timestamp = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      (loggers.translation || console).debug("BatchResume markCompleted:", e);
    }
  }

  /**
   * 获取待恢复的批次进度
   * @returns {Object|null} 进度对象或 null
   */
  function getProgress(batchId) {
    try {
      var data = _loadAll();
      var entry = data[batchId];
      if (!entry) return null;
      // 检查过期
      if (Date.now() - entry.timestamp > MAX_AGE_MS) {
        clearProgress(batchId);
        return null;
      }
      return entry;
    } catch (e) {
      return null;
    }
  }

  /**
   * 获取未完成的索引列表
   * @param {string} batchId - 批次 ID
   * @param {number} totalCount - 总条目数
   * @returns {number[]} 未完成的索引
   */
  function getPendingIndices(batchId, totalCount) {
    var progress = getProgress(batchId);
    if (!progress) return null;
    var completed = new Set(progress.completedIndices);
    var pending = [];
    for (var i = 0; i < totalCount; i++) {
      if (!completed.has(i)) pending.push(i);
    }
    return pending;
  }

  /**
   * 清除指定批次的进度
   */
  function clearProgress(batchId) {
    try {
      var data = _loadAll();
      delete data[batchId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      (loggers.translation || console).debug("BatchResume clearProgress:", e);
    }
  }

  /**
   * 清除所有过期的批次进度
   */
  function cleanupExpired() {
    try {
      var data = _loadAll();
      var now = Date.now();
      var cleaned = false;
      for (var key in data) {
        if (data.hasOwnProperty(key) && now - data[key].timestamp > MAX_AGE_MS) {
          delete data[key];
          cleaned = true;
        }
      }
      if (cleaned) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 生成批次 ID
   * @param {Array} items - 翻译项数组
   * @param {string} engine - 引擎 ID
   * @returns {string} 批次 ID
   */
  function generateBatchId(items, engine) {
    var itemCount = items.length;
    var firstSource = (items[0] && items[0].sourceText || "").substring(0, 50);
    var lastSource = (items[itemCount - 1] && items[itemCount - 1].sourceText || "").substring(0, 50);
    return engine + ":" + itemCount + ":" + firstSource + "|" + lastSource;
  }

  /**
   * 检查是否有可恢复的进度
   */
  function hasResumableProgress(batchId) {
    var progress = getProgress(batchId);
    if (!progress) return false;
    return progress.completedIndices.length > 0 && progress.completedIndices.length < progress.totalCount;
  }

  /**
   * 获取恢复信息摘要
   */
  function getResumeSummary(batchId) {
    var progress = getProgress(batchId);
    if (!progress) return null;
    var completed = progress.completedIndices.length;
    var total = progress.totalCount;
    var elapsed = Date.now() - progress.timestamp;
    var minutesAgo = Math.floor(elapsed / 60000);
    return {
      completed: completed,
      total: total,
      remaining: total - completed,
      percent: Math.round((completed / total) * 100),
      minutesAgo: minutesAgo,
      engine: progress.engine,
    };
  }

  // ==================== 内部 ====================

  function _loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // 启动时清理过期数据
  try { cleanupExpired(); } catch (e) {}

  return {
    saveProgress: saveProgress,
    markCompleted: markCompleted,
    getProgress: getProgress,
    getPendingIndices: getPendingIndices,
    clearProgress: clearProgress,
    cleanupExpired: cleanupExpired,
    generateBatchId: generateBatchId,
    hasResumableProgress: hasResumableProgress,
    getResumeSummary: getResumeSummary,
  };
})();

window.BatchResumeManager = BatchResumeManager;
