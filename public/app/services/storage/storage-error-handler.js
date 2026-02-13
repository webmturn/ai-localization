// ==================== 存储错误处理器 ====================
/**
 * 存储错误处理器：统一处理存储相关的错误
 * 消除存储错误处理代码重复，提供一致的错误处理体验
 */

/**
 * 存储错误处理器类
 */
class StorageErrorHandler {
  constructor() {
    this.notifiedErrors = new Set();
  }
  
  /**
   * 处理IndexedDB文件内容错误（防重复通知）
   * @param {Error} error - 错误对象
   * @param {string} action - 操作名称
   */
  handleIndexedDBFileContentError(error, action) {
    const errorKey = `idb_file_content_${error.name || 'unknown'}`;
    if (this.notifiedErrors.has(errorKey)) {
      return;
    }
    
    this.notifiedErrors.add(errorKey);
    
    const errName = error && error.name ? String(error.name) : "";
    const errMsg = error && error.message ? String(error.message) : String(error);
    const prefix = action ? `${action}：` : "";

    if (errName === "QuotaExceededError") {
      this.showNotification(
        "error",
        "存储空间不足",
        `${prefix}IndexedDB 存储空间不足。建议：清理站点数据/减少导入/导出项目备份。`
      );
    } else if (errName === "AbortError") {
      this.showNotification(
        "warning",
        "IndexedDB写入中止",
        `${prefix}IndexedDB 写入被中止（可能是权限/并发/浏览器策略变化）。`
      );
    } else if (errName === "InvalidStateError") {
      this.showNotification(
        "warning",
        "IndexedDB状态异常",
        `${prefix}IndexedDB 状态异常（可能连接被关闭或升级中）。`
      );
    } else if (/blocked/i.test(errMsg) || /version/i.test(errMsg)) {
      this.showNotification(
        "warning",
        "IndexedDB被阻塞",
        `${prefix}IndexedDB 可能被其他标签页占用或正在升级，请关闭其他标签页后重试。`
      );
    } else {
      this.showNotification(
        "warning",
        "IndexedDB异常",
        `${prefix}IndexedDB 操作失败。若问题持续，请清理站点数据或关闭其他标签页。`
      );
    }
  }
  
  /**
   * 处理存储配额错误
   * @param {Error} error - 错误对象
   * @param {string} context - 上下文信息
   */
  handleQuotaError(error, context = "存储操作") {
    const errorKey = `quota_error_${context}`;
    if (this.notifiedErrors.has(errorKey)) {
      return;
    }
    
    this.notifiedErrors.add(errorKey);
    
    this.showNotification(
      "error",
      "存储空间不足",
      `${context}失败：浏览器存储空间已满。请清理浏览器数据或减少项目大小。`,
      {
        actions: [
          {
            text: "清理指南",
            action: () => this.showStorageCleanupGuide()
          }
        ]
      }
    );
  }
  
  /**
   * 处理存储权限错误
   * @param {Error} error - 错误对象
   * @param {string} context - 上下文信息
   */
  handlePermissionError(error, context = "存储操作") {
    const errorKey = `permission_error_${context}`;
    if (this.notifiedErrors.has(errorKey)) {
      return;
    }
    
    this.notifiedErrors.add(errorKey);
    
    this.showNotification(
      "error",
      "存储权限不足",
      `${context}失败：浏览器阻止了存储操作。请检查隐私设置或尝试刷新页面。`
    );
  }
  
  /**
   * 处理存储版本冲突错误
   * @param {Error} error - 错误对象
   * @param {string} context - 上下文信息
   */
  handleVersionError(error, context = "存储操作") {
    const errorKey = `version_error_${context}`;
    if (this.notifiedErrors.has(errorKey)) {
      return;
    }
    
    this.notifiedErrors.add(errorKey);
    
    this.showNotification(
      "warning",
      "存储版本冲突",
      `${context}：检测到存储版本冲突。建议关闭其他标签页后刷新页面。`,
      {
        actions: [
          {
            text: "刷新页面",
            action: () => window.location.reload()
          }
        ]
      }
    );
  }
  
  /**
   * 处理网络存储错误
   * @param {Error} error - 错误对象
   * @param {string} context - 上下文信息
   */
  handleNetworkStorageError(error, context = "网络存储") {
    this.showNotification(
      "error",
      "网络存储失败",
      `${context}失败：${error.message}。请检查网络连接后重试。`
    );
  }
  
  /**
   * 处理通用存储错误
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   * @param {string} options.context - 上下文
   * @param {string} options.operation - 操作类型
   * @param {boolean} options.recoverable - 是否可恢复
   */
  handleGenericStorageError(error, options = {}) {
    const {
      context = "存储操作",
      operation = "unknown",
      recoverable = false
    } = options;
    
    // 使用DI获取错误管理器
    const errorManager = typeof getServiceSafely === 'function' 
      ? getServiceSafely('errorManager', 'errorManager') 
      : window.errorManager;
    
    if (errorManager) {
      const handled = errorManager.handleError(error, {
        context: `storage.${operation}`,
        recoverable: recoverable,
        metadata: { context, operation }
      });
      
      if (handled.shouldNotify) {
        this.showNotification("error", "存储错误", handled.userMessage);
      }
    } else {
      // 备用错误处理
      (loggers.storage || console).error(`存储错误 (${context}):`, error);
      this.showNotification("error", "存储错误", `${context}失败：${error.message || "未知错误"}`);
    }
  }
  
  /**
   * 智能错误处理：根据错误类型自动选择处理方式
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   */
  handleError(error, options = {}) {
    const { context = "存储操作", operation = "unknown" } = options;
    
    if (!error) return;
    
    const errorName = error.name || "";
    const errorMessage = error.message || "";
    
    // 根据错误类型智能处理
    if (errorName === "QuotaExceededError" || /quota/i.test(errorMessage)) {
      this.handleQuotaError(error, context);
    } else if (errorName === "SecurityError" || /security/i.test(errorMessage)) {
      this.handlePermissionError(error, context);
    } else if (/version|blocked/i.test(errorMessage)) {
      this.handleVersionError(error, context);
    } else if (/network|fetch/i.test(errorMessage)) {
      this.handleNetworkStorageError(error, context);
    } else if (["AbortError", "InvalidStateError", "VersionError"].includes(errorName)) {
      this.handleIndexedDBFileContentError(error, context);
    } else {
      this.handleGenericStorageError(error, { context, operation });
    }
  }
  
  /**
   * 显示通知
   * @param {string} type - 通知类型
   * @param {string} title - 标题
   * @param {string} message - 消息
   * @param {Object} options - 选项
   */
  showNotification(type, title, message, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const uiOptions = {};

    if (opts && typeof opts.action === 'function') {
      uiOptions.action = opts.action;
      uiOptions.actionLabel = opts.actionLabel;
    } else if (Array.isArray(opts.actions) && opts.actions.length > 0) {
      const first = opts.actions[0];
      if (first && typeof first.action === 'function') {
        uiOptions.action = first.action;
        uiOptions.actionLabel = first.text;
      }
    }

    if (typeof showNotification === 'function') {
      const hasUiOptions = Object.keys(uiOptions).length > 0;
      showNotification(type, title, message, hasUiOptions ? uiOptions : undefined);
    } else {
      (loggers.storage || console).info(`${type.toUpperCase()}: ${title} - ${message}`);
    }
    
    // 处理额外操作
    if (opts.actions && Array.isArray(opts.actions)) {
      // 这里可以扩展显示操作按钮的功能
      (loggers.storage || console).debug("可用操作:", opts.actions.map(a => a.text));
    }
  }
  
  /**
   * 显示存储清理指南
   */
  showStorageCleanupGuide() {
    const guide = `
清理浏览器存储空间的方法：

1. 清除浏览器缓存和数据
2. 删除不需要的下载文件
3. 导出重要项目数据后删除
4. 使用浏览器开发工具清理存储

具体步骤请参考浏览器帮助文档。
    `.trim();
    
    if (typeof showModal === 'function') {
      showModal("存储清理指南", guide);
    } else {
      alert(guide);
    }
  }
  
  /**
   * 重置通知状态（允许重新显示之前的错误）
   */
  resetNotificationState() {
    this.notifiedErrors.clear();
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats() {
    return {
      notifiedErrorTypes: Array.from(this.notifiedErrors),
      totalNotifiedErrors: this.notifiedErrors.size
    };
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageErrorHandler };
} else {
  // 浏览器环境，优先注册到DI系统，再暴露到全局
  window.StorageErrorHandler = StorageErrorHandler;
  
  // 创建全局实例
  const storageErrorHandler = new StorageErrorHandler();
  window.storageErrorHandler = storageErrorHandler;
  
  // 尝试注册到DI系统
  if (typeof window.diContainer !== 'undefined') {
    try {
      window.diContainer.registerFactory('storageErrorHandler', () => storageErrorHandler);
    } catch (error) {
      (loggers.storage || console).warn('StorageErrorHandler DI注册失败:', error.message);
    }
  }
}
