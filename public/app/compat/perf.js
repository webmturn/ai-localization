// ==================== 性能优化工具函数 ====================
/**
 * 性能优化的同步高度函数
 * 使用现代架构系统，简化兼容性逻辑
 */

// 同步翻译高度（现代化版本）
function syncTranslationHeights(afterSync) {
  // 优先使用DI系统获取实现
  if (typeof getServiceSafely === 'function') {
    const perfService = getServiceSafely('performanceMonitor', 'performanceMonitor');
    if (perfService?.syncTranslationHeights) {
      return perfService.syncTranslationHeights(afterSync);
    }
  }
  
  // 备用：使用全局实现
  if (window.App?.impl?.syncTranslationHeights) {
    return window.App.impl.syncTranslationHeights(afterSync);
  }
  
  // 最后备用：直接调用legacy实现
  if (typeof __syncTranslationHeightsImpl === "function") {
    return __syncTranslationHeightsImpl(afterSync);
  }
  
  (loggers.app || console).warn('syncTranslationHeights: 未找到实现，跳过同步');
}

// 使用通用防抖节流函数，避免与事件绑定管理器混淆
const debouncedSyncHeights = window.debounce ? window.debounce(syncTranslationHeights, 300) : syncTranslationHeights;
const throttledSyncHeights = window.throttle ? window.throttle(syncTranslationHeights, 100) : syncTranslationHeights;
