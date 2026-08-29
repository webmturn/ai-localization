// ==================== 翻译结果处理器 V2 ====================
/**
 * 统一的翻译结果处理器
 * 消除代码重复，提供统一的翻译结果处理接口
 * 使用依赖注入架构，支持测试和模块化
 */

class TranslationResultHandler {
  constructor(dependencies = {}) {
    // 使用依赖注入获取服务
    this.appState = dependencies.appState || this.getService('appState', 'AppState');
    this.errorManager = dependencies.errorManager || this.getService('errorManager');
    this.performanceMonitor = dependencies.performanceMonitor || this.getService('performanceMonitor');
  }

  /**
   * 安全获取服务的辅助方法
   * @param {string} serviceName - 服务名
   * @param {string} fallbackGlobal - 备用全局变量名
   * @returns {*} 服务实例
   */
  getService(serviceName, fallbackGlobal = null) {
    if (typeof getServiceSafely === 'function') {
      return getServiceSafely(serviceName, fallbackGlobal);
    }
    
    // 备用方案：直接从全局获取
    if (fallbackGlobal && window[fallbackGlobal]) {
      return window[fallbackGlobal];
    }
    
    return null;
  }

  /**
   * 处理翻译结果
   * @param {Array} results - 成功的翻译结果
   * @param {Array} errors - 翻译错误列表
   * @param {string} engine - 翻译引擎
   * @param {Object} context - 上下文信息
   * @returns {Object} 处理结果统计
   */
  handleTranslationResults(results = [], errors = [], engine = 'unknown', context = {}) {
    const startTime = this.performanceMonitor ? performance.now() : null;
    
    try {
      // 分析错误类型
      const actualErrors = errors.filter((e) => e.error !== "用户取消");
      const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
      
      // 更新应用状态中的失败项列表
      this.updateFailedItemsList(actualErrors);
      
      // 显示结果通知
      this.showResultNotification(results, actualErrors, cancelledCount, engine, context);
      
      // 记录统计信息
      const stats = {
        successCount: results.length,
        errorCount: actualErrors.length,
        cancelledCount,
        totalCount: results.length + errors.length
      };
      
      // 性能监控
      if (this.performanceMonitor && startTime) {
        this.performanceMonitor.measure('handleTranslationResults', startTime);
      }
      
      // 记录操作日志
      this.logTranslationOperation(context.operation || 'translate', stats);
      
      return {
        ...stats,
        actualErrors,
        processed: true
      };
      
    } catch (error) {
      (loggers.translation || console).error('处理翻译结果失败:', error);
      
      if (this.errorManager) {
        this.errorManager.handleError(error, {
          context: 'handleTranslationResults',
          engine,
          resultCount: results.length,
          errorCount: errors.length
        });
      }
      
      // 显示备用错误通知
      if (typeof showNotification === 'function') {
        showNotification('error', '结果处理失败', '翻译结果处理时发生错误');
      }
      
      return {
        successCount: results.length,
        errorCount: errors.length,
        cancelledCount: 0,
        totalCount: results.length + errors.length,
        actualErrors: errors,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * 更新失败项列表（经 BatchProgressStore）
   * @param {Array} actualErrors - 实际错误列表
   */
  updateFailedItemsList(actualErrors) {
    try {
      BatchProgressStore.recordFailedItems(
        actualErrors.map((e) => e?.item).filter(Boolean)
      );
    } catch (error) {
      (loggers.translation || console).warn('更新失败项列表失败:', error);
    }
  }

  /**
   * 显示结果通知
   * @param {Array} results - 成功结果
   * @param {Array} actualErrors - 实际错误
   * @param {number} cancelledCount - 取消数量
   * @param {string} engine - 翻译引擎
   * @param {Object} context - 上下文信息
   */
  showResultNotification(results, actualErrors, cancelledCount, engine, context) {
    if (typeof showNotification !== 'function') {
      (loggers.app || console).warn('showNotification 函数不可用');
      return;
    }

    const isInProgress = BatchProgressStore.isBatchInProgress();
    const {
      successTitle = "翻译完成",
      warningTitle = "翻译部分完成",
      cancelTitle = "翻译已取消"
    } = context;

    // 用户主动取消的情况
    if (!isInProgress && cancelledCount > 0) {
      showNotification(
        "info",
        cancelTitle,
        `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
      );
    } 
    // 完全成功的情况
    else if (actualErrors.length === 0) {
      showNotification(
        "success",
        successTitle,
        `已成功翻译 ${results.length} 项`
      );
    } 
    // 部分成功的情况
    else {
      showNotification(
        "warning",
        warningTitle,
        `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
      );

      // 显示第一个错误的详细信息
      if (actualErrors.length > 0) {
        const firstErr = actualErrors[0];
        const errorDetail = this.formatTranslationError(firstErr, engine);
        
        if (typeof showSplitNotification === 'function' && errorDetail) {
          showSplitNotification(
            "warning", 
            `失败原因：${errorDetail.title}`, 
            errorDetail.message, 
            errorDetail.detail
          );
        }
      }
    }
  }

  /**
   * 格式化翻译错误
   * @param {Object} error - 错误对象
   * @param {string} engine - 翻译引擎
   * @returns {Object} 格式化的错误信息
   */
  formatTranslationError(error, engine) {
    try {
      // 如果全局函数可用，使用它
      if (typeof formatTranslationError === 'function') {
        return formatTranslationError(error, engine);
      }

      // 备用格式化逻辑
      return {
        type: 'warning',
        title: '翻译失败',
        message: error.error || error.message || '未知错误',
        detail: error.detail || `引擎: ${engine}`
      };
    } catch (err) {
      (loggers.translation || console).warn('格式化翻译错误失败:', err);
      return {
        type: 'error',
        title: '错误处理失败',
        message: '无法格式化错误信息',
        detail: ''
      };
    }
  }

  /**
   * 记录翻译操作日志
   * @param {string} operation - 操作类型
   * @param {Object} stats - 统计信息
   */
  logTranslationOperation(operation, stats) {
    try {
      const message = `📊 ${operation} 统计: 成功 ${stats.successCount}, 失败 ${stats.errorCount}, 取消 ${stats.cancelledCount}`;
      (loggers.translation || console).info(message);
    } catch (error) {
      (loggers.translation || console).warn('记录操作日志失败:', error);
    }
  }

  /**
   * 批量更新UI
   * @param {Object} options - UI更新选项
   */
  updateTranslationUI(options = {}) {
    try {
      const {
        selectedFile = null,
        shouldScroll = false,
        shouldFocusTextarea = false,
        reason = "翻译完成"
      } = options;

      // 重建过滤的翻译项
      if (typeof rebuildFilteredTranslationItems === 'function') {
        if (selectedFile) {
          rebuildFilteredTranslationItems({ selectedFile });
        } else {
          rebuildFilteredTranslationItems();
        }
      }

      // 更新翻译列表显示
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

      (loggers.app || console).debug(`UI更新完成 (${reason})`);

    } catch (error) {
      (loggers.app || console).error('UI更新失败:', error);
      
      if (this.errorManager) {
        this.errorManager.handleError(error, { 
          context: 'updateTranslationUI',
          reason: options.reason 
        });
      }
    }
  }

  /**
   * 清理翻译界面状态
   * @param {Object} options - 清理选项
   */
  cleanupTranslationUI(options = {}) {
    try {
      const { clearSelection = false } = options;

      // 隐藏翻译进度
      if (typeof updateTranslationProgressUI === 'function') {
        updateTranslationProgressUI({ show: false });
      }

      // 清除选择状态（经 TranslationViewStore 意图式 API）
      if (clearSelection && this.appState?.translations) {
        TranslationViewStore.setSelection(-1);
        TranslationViewStore.setSelectedFile(null);
      }

      // 重置过滤器（如果需要）
      if (options.resetFilters && this.appState?.translations) {
        TranslationViewStore.setSearchQuery("");
        // 可以添加更多重置逻辑
      }

    } catch (error) {
      (loggers.app || console).error('清理翻译界面失败:', error);
    }
  }

  /**
   * 处理翻译完成后的通用操作
   * @param {string} operation - 操作类型
   * @param {Array} results - 翻译结果
   * @param {Array} errors - 错误列表
   * @param {string} engine - 翻译引擎
   * @param {Object} options - 额外选项
   */
  handleTranslationComplete(operation, results, errors, engine, options = {}) {
    try {
      // 处理翻译结果并显示通知
      const stats = this.handleTranslationResults(results, errors, engine, {
        operation,
        ...options
      });

      // 标记需要自动保存
      if (typeof autoSaveManager !== 'undefined' && autoSaveManager.markDirty) {
        autoSaveManager.markDirty();
      }
      if (typeof invalidateSearchCache === "function") invalidateSearchCache();

      // 更新UI
      this.updateTranslationUI({
        selectedFile: this.appState?.translations?.selectedFile,
        shouldScroll: false,
        shouldFocusTextarea: false,
        reason: operation
      });

      return stats;

    } catch (error) {
      (loggers.translation || console).error(`处理${operation}完成失败:`, error);
      
      if (this.errorManager) {
        this.errorManager.handleError(error, {
          context: 'handleTranslationComplete',
          operation,
          resultCount: results.length,
          errorCount: errors.length
        });
      }
      
      throw error;
    }
  }
}

// ==================== 全局实例和兼容性 ====================

// 创建全局实例（支持依赖注入）
let globalTranslationResultHandler = null;

/**
 * 获取翻译结果处理器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {TranslationResultHandler} 处理器实例
 */
function getTranslationResultHandler(dependencies = {}) {
  if (!globalTranslationResultHandler) {
    globalTranslationResultHandler = new TranslationResultHandler(dependencies);
  }
  return globalTranslationResultHandler;
}

/**
 * 统一的翻译结果处理函数（向后兼容）
 * @param {Array} results - 翻译结果
 * @param {Array} errors - 错误列表
 * @param {string} engine - 翻译引擎
 * @param {Object} context - 上下文
 * @returns {Object} 处理结果统计
 */
function handleTranslationResults(results, errors, engine, context = {}) {
  const handler = getTranslationResultHandler();
  return handler.handleTranslationResults(results, errors, engine, context);
}

/**
 * 统一的UI更新函数（向后兼容）
 * @param {Object} options - 更新选项
 */
function updateTranslationUI(options = {}) {
  const handler = getTranslationResultHandler();
  return handler.updateTranslationUI(options);
}

/**
 * 处理翻译完成的统一函数
 * @param {string} operation - 操作类型
 * @param {Array} results - 翻译结果
 * @param {Array} errors - 错误列表
 * @param {string} engine - 翻译引擎
 * @param {Object} options - 选项
 */
function handleTranslationComplete(operation, results, errors, engine, options = {}) {
  const handler = getTranslationResultHandler();
  return handler.handleTranslationComplete(operation, results, errors, engine, options);
}

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    TranslationResultHandler, 
    getTranslationResultHandler,
    handleTranslationResults,
    updateTranslationUI,
    handleTranslationComplete
  };
} else {
  // 浏览器环境
  window.TranslationResultHandler = TranslationResultHandler;
  window.getTranslationResultHandler = getTranslationResultHandler;
  window.handleTranslationResults = handleTranslationResults;
  window.updateTranslationUI = updateTranslationUI;
  window.handleTranslationComplete = handleTranslationComplete;
  
  // 注册到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      if (typeof namespaceManager.getNamespace === 'function' &&
          !namespaceManager.getNamespace('App.features.translations') &&
          typeof namespaceManager.createNamespace === 'function') {
        namespaceManager.createNamespace('App.features.translations', {
          description: '翻译功能模块',
          modules: {}
        });
      }
      namespaceManager.addToNamespace('App.features.translations', 'TranslationResultHandler', TranslationResultHandler);
      namespaceManager.addToNamespace('App.features.translations', 'handleTranslationResults', handleTranslationResults);
      namespaceManager.addToNamespace('App.features.translations', 'updateTranslationUI', updateTranslationUI);
    } catch (error) {
      (loggers.app || console).warn('翻译结果处理器命名空间注册失败:', error.message);
    }
  }
}

(loggers.app || console).debug('翻译结果处理器 V2 已加载');
