// ==================== 错误管理器预加载 ====================
/**
 * 错误管理器预加载脚本
 * 确保错误管理器在架构初始化之前就可用
 */

// 立即执行，确保错误管理器可用
(function() {
  'use strict';
  
  // 检查是否已经初始化
  if (window.errorManager) {
    (loggers.errors || console).debug('错误管理器已存在，跳过预加载');
    return;
  }
  
  // 如果错误管理器还没有加载，等待它加载
  let checkCount = 0;
  const maxChecks = 50; // 最多检查5秒
  
  const checkErrorManager = () => {
    checkCount++;
    
    if (window.ErrorManager && window.initializeErrorManager) {
      // 错误管理器类已加载，立即初始化
      try {
        if (window.errorManager) {
          (loggers.errors || console).debug('错误管理器已存在，跳过预加载');
          return;
        }
        window.initializeErrorManager();
        (loggers.errors || console).debug('错误管理器预加载初始化完成');
      } catch (error) {
        (loggers.errors || console).error('错误管理器预加载初始化失败:', error);
      }
      return;
    }
    
    if (checkCount < maxChecks) {
      setTimeout(checkErrorManager, 100);
    } else {
      (loggers.errors || console).warn('错误管理器预加载超时，将在架构初始化时处理');
    }
  };
  
  // 开始检查
  setTimeout(checkErrorManager, 100);
})();