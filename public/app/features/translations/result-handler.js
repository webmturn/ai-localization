// ==================== 翻译结果处理器 ====================
/**
 * 翻译结果处理器：统一处理翻译完成后的结果
 * 解决代码重复问题，提供一致的用户体验
 */

/**
 * 处理翻译结果
 * @param {Array} results - 成功的翻译结果
 * @param {Array} errors - 翻译错误列表
 * @param {string} engine - 翻译引擎名称
 * @param {Object} context - 上下文信息
 * @param {string} [context.successTitle] - 成功时的标题
 * @param {string} [context.warningTitle] - 部分成功时的标题
 * @param {string} [context.operation] - 操作名称（用于日志）
 * @returns {Object} 处理结果统计
 */
function handleTranslationResults(results, errors, engine, context = {}) {
  const {
    successTitle = "翻译完成",
    warningTitle = "翻译部分完成",
    operation = "translation"
  } = context;
  
  // 分离实际错误和用户取消
  const actualErrors = errors.filter((e) => e.error !== "用户取消");
  const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
  
  // 更新失败项列表
  if (window.AppState && window.AppState.translations) {
    window.AppState.translations.lastFailedItems = actualErrors
      .map((e) => e?.item)
      .filter(Boolean);
  }
  
  // 记录统计信息
  const stats = {
    successCount: results.length,
    errorCount: actualErrors.length,
    cancelledCount: cancelledCount,
    totalCount: results.length + errors.length
  };
  
  // 使用日志系统记录
  const logger = window.loggers?.app || console;
  logger.info?.(`${operation} 完成: 成功 ${stats.successCount}, 失败 ${stats.errorCount}, 取消 ${stats.cancelledCount}`) ||
    console.log(`📊 ${operation} 统计: 成功 ${stats.successCount}, 失败 ${stats.errorCount}, 取消 ${stats.cancelledCount}`);
  
  // 显示通知
  if (!window.AppState?.translations?.isInProgress && cancelledCount > 0) {
    // 用户主动取消
    showNotification(
      "info",
      "翻译已取消",
      `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
    );
  } else if (actualErrors.length === 0) {
    // 全部成功
    showNotification(
      "success",
      successTitle,
      `已成功翻译 ${results.length} 项`
    );
  } else {
    // 部分成功
    const firstErr = actualErrors[0];
    const f = formatTranslationError(firstErr, engine);
    
    showNotification(
      "warning",
      warningTitle,
      `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
    );
    
    // 显示详细错误信息
    if (typeof showSplitNotification === 'function') {
      showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
    }
  }
  
  return stats;
}

/**
 * 处理翻译错误（兼容现有的formatTranslationError函数）
 * @param {Object} error - 错误对象
 * @param {string} engine - 翻译引擎
 * @returns {Object} 格式化的错误信息
 */
function formatTranslationError(error, engine) {
  // 如果全局已有formatTranslationError函数，使用它
  if (typeof window.formatTranslationError === 'function') {
    return window.formatTranslationError(error, engine);
  }
  
  // 否则提供基本的错误格式化
  return {
    type: "warning",
    title: "翻译失败",
    message: error.error || "未知错误",
    detail: error.details || `引擎: ${engine}`
  };
}

/**
 * 批量翻译进度处理器
 * @param {number} completed - 已完成数量
 * @param {number} total - 总数量
 * @param {string} status - 状态信息
 */
function handleTranslationProgress(completed, total, status = "翻译中...") {
  const percentage = Math.round((completed / total) * 100);
  
  // 更新进度显示
  if (typeof updateProgress === 'function') {
    updateProgress(completed, total, status);
  }
  
  // 使用日志系统记录进度
  const logger = window.loggers?.app || console;
  if (completed % 10 === 0 || completed === total) {
    logger.debug?.(`翻译进度: ${completed}/${total} (${percentage}%)`) ||
      (typeof isDevelopment !== 'undefined' && isDevelopment && 
       console.log(`📈 翻译进度: ${completed}/${total} (${percentage}%)`));
  }
}

/**
 * 翻译操作的通用错误处理
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 * @param {string} context.operation - 操作名称
 * @param {string} context.engine - 翻译引擎
 */
function handleTranslationError(error, context = {}) {
  const { operation = "翻译", engine = "未知" } = context;
  
  // 使用DI获取错误管理器
  const errorManager = typeof getServiceSafely === 'function' 
    ? getServiceSafely('errorManager', 'errorManager') 
    : window.errorManager;
  
  if (errorManager) {
    const handled = errorManager.handleError(error, {
      context: `translation.${operation}`,
      engine: engine,
      recoverable: true
    });
    
    if (handled.shouldNotify) {
      showNotification("error", `${operation}失败`, handled.userMessage);
    }
  } else {
    // 备用错误处理
    console.error(`${operation}失败:`, error);
    showNotification("error", `${operation}失败`, error.message || "未知错误");
  }
}

/**
 * 统一的翻译完成后UI更新
 * @param {Object} options - 更新选项
 * @param {string} [options.selectedFile] - 选中的文件
 * @param {boolean} [options.shouldScroll] - 是否滚动
 * @param {boolean} [options.shouldFocusTextarea] - 是否聚焦文本框
 */
function updateTranslationUI(options = {}) {
  const {
    selectedFile = null,
    shouldScroll = false,
    shouldFocusTextarea = false
  } = options;
  
  try {
    // 重建过滤的翻译项
    if (selectedFile) {
      rebuildFilteredTranslationItems({ selectedFile });
    } else {
      rebuildFilteredTranslationItems();
    }
    
    // 更新列表显示
    if (typeof updateTranslationLists === 'function') {
      updateTranslationLists();
    }
    
    // 更新计数器
    if (typeof updateCounters === 'function') {
      updateCounters();
    }
    
    // 更新选择样式
    if (typeof updateSelectionStyles === 'function') {
      updateSelectionStyles({ shouldScroll, shouldFocusTextarea });
    }
    
    // 使用DI获取自动保存管理器
    const autoSave = typeof getServiceSafely === 'function' 
      ? getServiceSafely('autoSaveManager', 'autoSaveManager') 
      : window.autoSaveManager;
    if (autoSave) {
      autoSave.markDirty();
    }
    
  } catch (error) {
    console.error('UI更新失败:', error);
    const errMgr = typeof getServiceSafely === 'function' 
      ? getServiceSafely('errorManager', 'errorManager') 
      : window.errorManager;
    if (errMgr) {
      errMgr.handleError(error, { context: 'updateTranslationUI' });
    }
  }
}

// ==================== 导出函数 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleTranslationResults,
    formatTranslationError,
    handleTranslationProgress,
    handleTranslationError,
    updateTranslationUI
  };
} else {
  // 浏览器环境，暴露到全局
  window.handleTranslationResults = handleTranslationResults;
  window.handleTranslationProgress = handleTranslationProgress;
  window.handleTranslationError = handleTranslationError;
  window.updateTranslationUI = updateTranslationUI;
}