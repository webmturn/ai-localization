// ==================== 翻译UI更新器 ====================
/**
 * 翻译UI更新器：统一处理翻译相关的UI更新
 * 解决UI更新代码重复问题，提供一致的用户体验
 */

/**
 * 更新翻译相关的UI
 * @param {Object} options - 更新选项
 * @param {string} [options.selectedFile] - 选中的文件
 * @param {boolean} [options.shouldScroll] - 是否滚动到选中项
 * @param {boolean} [options.shouldFocusTextarea] - 是否聚焦到文本区域
 * @param {boolean} [options.preserveSelection] - 是否保持当前选择
 * @param {string} [options.reason] - 更新原因（用于日志）
 */
function updateTranslationUI(options = {}) {
  const {
    selectedFile = null,
    shouldScroll = false,
    shouldFocusTextarea = false,
    preserveSelection = false,
    reason = "翻译操作完成"
  } = options;
  
  try {
    // 使用日志系统记录UI更新
    const logger = window.loggers?.app || console;
    logger.debug?.(`更新翻译UI: ${reason}`) ||
      (typeof isDevelopment !== 'undefined' && isDevelopment && 
       console.log(`🔄 更新翻译UI: ${reason}`));
    
    // 1. 重建过滤后的翻译项列表
    if (typeof rebuildFilteredTranslationItems === 'function') {
      if (selectedFile) {
        rebuildFilteredTranslationItems({ selectedFile });
      } else {
        rebuildFilteredTranslationItems();
      }
    }
    
    // 2. 更新翻译列表显示
    if (typeof updateTranslationLists === 'function') {
      updateTranslationLists();
    }
    
    // 3. 更新计数器
    if (typeof updateCounters === 'function') {
      updateCounters();
    }
    
    // 4. 更新选择样式
    if (typeof updateSelectionStyles === 'function') {
      updateSelectionStyles({ 
        shouldScroll, 
        shouldFocusTextarea,
        preserveSelection
      });
    }
    
    // 5. 更新文件树状态（如果需要）
    if (selectedFile && typeof updateFileTreeSelection === 'function') {
      updateFileTreeSelection(selectedFile);
    }
    
    // 6. 触发UI更新完成事件
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent('translationUIUpdated', {
        detail: { reason, options }
      });
      window.dispatchEvent(event);
    }
    
  } catch (error) {
    console.error('❌ 更新翻译UI失败:', error);
    
    // 使用DI获取错误管理器
    const errorManager = typeof getServiceSafely === 'function' 
      ? getServiceSafely('errorManager', 'errorManager') 
      : window.errorManager;
    if (errorManager) {
      errorManager.handleError(error, {
        context: 'updateTranslationUI',
        recoverable: true
      });
    }
  }
}

/**
 * 更新翻译进度UI
 * @param {Object} progressInfo - 进度信息
 * @param {number} progressInfo.completed - 已完成数量
 * @param {number} progressInfo.total - 总数量
 * @param {string} progressInfo.status - 状态文本
 * @param {boolean} [progressInfo.show] - 是否显示进度
 */
function updateTranslationProgressUI(progressInfo) {
  const { completed, total, status, show = true } = progressInfo;
  
  try {
    if (show) {
      // 显示进度
      if (typeof showTranslationProgress === 'function') {
        showTranslationProgress();
      }
      
      // 更新进度信息
      if (typeof updateProgress === 'function') {
        updateProgress(completed, total, status);
      }
    } else {
      // 隐藏进度
      if (typeof hideTranslationProgress === 'function') {
        hideTranslationProgress();
      }
    }
    
  } catch (error) {
    console.error('❌ 更新翻译进度UI失败:', error);
  }
}

/**
 * 批量更新翻译状态UI
 * @param {Array} items - 翻译项列表
 * @param {string} status - 新状态
 * @param {Object} options - 更新选项
 */
function updateTranslationItemsStatus(items, status, options = {}) {
  const { batchSize = 50, updateUI = true } = options;
  
  try {
    // 分批更新，避免UI阻塞
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    batches.forEach((batch, index) => {
      setTimeout(() => {
        batch.forEach(item => {
          if (item && typeof item === 'object') {
            item.status = status;
          }
        });
        
        // 最后一批时更新UI
        if (updateUI && index === batches.length - 1) {
          updateTranslationUI({ 
            reason: `批量更新状态为: ${status}`,
            preserveSelection: true
          });
        }
      }, index * 10); // 每批间隔10ms
    });
    
  } catch (error) {
    console.error('❌ 批量更新翻译项状态失败:', error);
  }
}

/**
 * 重置翻译UI到初始状态
 * @param {Object} options - 重置选项
 * @param {boolean} [options.clearSelection] - 是否清除选择
 * @param {boolean} [options.resetFilters] - 是否重置过滤器
 */
function resetTranslationUI(options = {}) {
  const { clearSelection = false, resetFilters = false } = options;
  
  try {
    // 隐藏进度显示
    updateTranslationProgressUI({ show: false });
    
    // 清除选择
    if (clearSelection && window.AppState?.translations) {
      window.AppState.translations.selected = -1;
      window.AppState.translations.selectedFile = null;
    }
    
    // 重置过滤器
    if (resetFilters && typeof resetTranslationFilters === 'function') {
      resetTranslationFilters();
    }
    
    // 更新UI
    updateTranslationUI({ 
      reason: "重置翻译UI",
      shouldScroll: false,
      shouldFocusTextarea: false
    });
    
  } catch (error) {
    console.error('❌ 重置翻译UI失败:', error);
  }
}

/**
 * 智能UI更新：根据当前状态决定更新策略
 * @param {Object} context - 上下文信息
 * @param {string} context.operation - 操作类型
 * @param {Object} context.data - 相关数据
 */
function smartUpdateTranslationUI(context = {}) {
  const { operation, data } = context;
  
  try {
    switch (operation) {
      case 'translate_complete':
        updateTranslationUI({
          selectedFile: window.AppState?.translations?.selectedFile,
          shouldScroll: false,
          shouldFocusTextarea: false,
          reason: "翻译完成"
        });
        break;
        
      case 'file_selected':
        updateTranslationUI({
          selectedFile: data?.file,
          shouldScroll: true,
          shouldFocusTextarea: false,
          reason: "文件选择"
        });
        break;
        
      case 'item_selected':
        updateTranslationUI({
          shouldScroll: true,
          shouldFocusTextarea: true,
          preserveSelection: true,
          reason: "项目选择"
        });
        break;
        
      case 'filter_changed':
        updateTranslationUI({
          shouldScroll: false,
          shouldFocusTextarea: false,
          preserveSelection: true,
          reason: "过滤器变更"
        });
        break;
        
      default:
        updateTranslationUI({
          reason: `操作: ${operation}`
        });
    }
    
  } catch (error) {
    console.error('❌ 智能UI更新失败:', error);
    // 降级到基本更新
    updateTranslationUI({ reason: "降级更新" });
  }
}

// ==================== 导出接口 ====================
window.TranslationUIUpdater = {
  update: updateTranslationUI,
  updateProgress: updateTranslationProgressUI,
  updateItemsStatus: updateTranslationItemsStatus,
  reset: resetTranslationUI,
  smartUpdate: smartUpdateTranslationUI
};

// 便捷函数
window.updateTranslationUI = updateTranslationUI;
window.updateTranslationProgressUI = updateTranslationProgressUI;
window.resetTranslationUI = resetTranslationUI;
window.smartUpdateTranslationUI = smartUpdateTranslationUI;