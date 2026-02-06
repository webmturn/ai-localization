// ==================== 统一错误处理器 ====================
/**
 * 统一错误处理器：确保所有错误都通过ErrorManager统一处理
 * 提供全局错误捕获、错误分类和统一的错误处理流程
 */

/**
 * 统一错误处理器类
 */
class UnifiedErrorHandler {
  constructor(dependencies = {}) {
    this.errorManager = dependencies.errorManager;
    this.notificationService = dependencies.notificationService;
    this.isInitialized = false;
    this.errorListeners = new Set();
    this.errorCategories = new Map();
    
    this.setupErrorCategories();
  }
  
  /**
   * 初始化统一错误处理
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }
    
    // 设置全局错误处理器
    this.setupGlobalErrorHandlers();
    
    // 包装现有的错误处理函数
    this.wrapExistingErrorHandlers();
    
    // 设置Promise错误处理
    this.setupPromiseErrorHandling();
    
    this.isInitialized = true;
    console.log('🛡️ 统一错误处理器已初始化');
  }
  
  /**
   * 设置错误分类
   */
  setupErrorCategories() {
    // 网络错误
    this.errorCategories.set('network', {
      patterns: [/fetch/i, /network/i, /timeout/i, /cors/i],
      severity: 'high',
      retryable: true,
      context: 'network'
    });
    
    // 验证错误
    this.errorCategories.set('validation', {
      patterns: [/validation/i, /invalid/i, /required/i, /format/i],
      severity: 'medium',
      retryable: false,
      context: 'validation'
    });
    
    // 存储错误
    this.errorCategories.set('storage', {
      patterns: [/quota/i, /storage/i, /indexeddb/i, /localstorage/i],
      severity: 'high',
      retryable: false,
      context: 'storage'
    });
    
    // 翻译错误
    this.errorCategories.set('translation', {
      patterns: [/translation/i, /翻译/i, /api.*key/i, /engine/i],
      severity: 'medium',
      retryable: true,
      context: 'translation'
    });
    
    // DOM错误
    this.errorCategories.set('dom', {
      patterns: [/element/i, /node/i, /dom/i, /query/i],
      severity: 'low',
      retryable: false,
      context: 'ui'
    });
    
    // 权限错误
    this.errorCategories.set('permission', {
      patterns: [/permission/i, /denied/i, /unauthorized/i, /forbidden/i],
      severity: 'high',
      retryable: false,
      context: 'security'
    });
  }
  
  /**
   * 设置全局错误处理器
   */
  setupGlobalErrorHandlers() {
    // JavaScript错误处理
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error || event.message, {
        source: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        event: event
      });
    });
    
    // Promise拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason, {
        source: 'promise',
        promise: event.promise,
        event: event
      });
    });
    
    // 自定义错误事件监听
    window.addEventListener('applicationError', (event) => {
      this.handleApplicationError(event.detail.error, event.detail.context);
    });
  }
  
  /**
   * 包装现有的错误处理函数
   */
  wrapExistingErrorHandlers() {
    // 包装console.error
    if (typeof console.error === 'function') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // 调用原始函数
        originalConsoleError.apply(console, args);
        
        // 统一错误处理
        if (args.length > 0 && args[0] instanceof Error) {
          this.handleError(args[0], { source: 'console', args: args.slice(1) });
        }
      };
    }
    
    // 包装setTimeout和setInterval的错误
    this.wrapAsyncFunctions();
  }
  
  /**
   * 包装异步函数的错误处理
   */
  wrapAsyncFunctions() {
    // 包装setTimeout
    if (typeof window.setTimeout === 'function') {
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        const wrappedCallback = (...callbackArgs) => {
          try {
            return callback.apply(this, callbackArgs);
          } catch (error) {
            this.handleError(error, { source: 'setTimeout', delay });
          }
        };
        return originalSetTimeout(wrappedCallback, delay, ...args);
      };
    }
    
    // 包装addEventListener
    if (typeof EventTarget !== 'undefined' && EventTarget.prototype.addEventListener) {
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        const wrappedListener = (event) => {
          try {
            return listener.call(this, event);
          } catch (error) {
            window.unifiedErrorHandler?.handleError(error, { 
              source: 'eventListener', 
              type, 
              target: this 
            });
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      };
    }
  }
  
  /**
   * 设置Promise错误处理
   */
  setupPromiseErrorHandling() {
    // 包装Promise构造函数
    if (typeof Promise !== 'undefined') {
      const OriginalPromise = Promise;
      
      // 包装Promise.prototype.catch
      const originalCatch = OriginalPromise.prototype.catch;
      OriginalPromise.prototype.catch = function(onRejected) {
        const wrappedRejected = (reason) => {
          // 统一错误处理
          window.unifiedErrorHandler?.handleError(reason, { source: 'promise.catch' });
          
          // 调用原始处理器
          if (typeof onRejected === 'function') {
            return onRejected(reason);
          }
          throw reason;
        };
        
        return originalCatch.call(this, wrappedRejected);
      };
    }
  }
  
  /**
   * 处理全局错误
   * @param {Error|string} error - 错误对象或消息
   * @param {Object} context - 上下文信息
   */
  handleGlobalError(error, context = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.handleError(errorObj, { ...context, global: true });
  }
  
  /**
   * 处理Promise拒绝
   * @param {any} reason - 拒绝原因
   * @param {Object} context - 上下文信息
   */
  handlePromiseRejection(reason, context = {}) {
    const errorObj = reason instanceof Error ? reason : new Error(String(reason));
    this.handleError(errorObj, { ...context, promise: true });
  }
  
  /**
   * 处理应用程序错误
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  handleApplicationError(error, context = {}) {
    this.handleError(error, { ...context, application: true });
  }
  
  /**
   * 统一错误处理入口
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  handleError(error, context = {}) {
    try {
      // 分类错误
      const category = this.categorizeError(error);
      
      // 增强上下文信息
      const enhancedContext = {
        ...context,
        category: category.name,
        severity: category.severity,
        retryable: category.retryable,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      // 使用ErrorManager处理
      if (this.errorManager) {
        this.errorManager.handleError(error, enhancedContext);
      } else {
        // 备用处理
        this.fallbackErrorHandling(error, enhancedContext);
      }
      
      // 通知监听器
      this.notifyErrorListeners(error, enhancedContext);
      
      // 根据错误类型决定是否显示用户通知
      this.handleUserNotification(error, enhancedContext);
      
    } catch (handlingError) {
      // 错误处理本身出错，使用最基本的处理方式
      console.error('错误处理器本身出错:', handlingError);
      console.error('原始错误:', error);
    }
  }
  
  /**
   * 错误分类
   * @param {Error} error - 错误对象
   * @returns {Object} 错误分类信息
   */
  categorizeError(error) {
    const message = error.message || error.toString();
    
    for (const [categoryName, categoryInfo] of this.errorCategories) {
      const isMatch = categoryInfo.patterns.some(pattern => {
        return pattern.test(message) || pattern.test(error.name || '');
      });
      
      if (isMatch) {
        return {
          name: categoryName,
          ...categoryInfo
        };
      }
    }
    
    // 默认分类
    return {
      name: 'unknown',
      severity: 'medium',
      retryable: false,
      context: 'general'
    };
  }
  
  /**
   * 备用错误处理
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  fallbackErrorHandling(error, context) {
    console.error('统一错误处理 (备用):', error);
    console.error('错误上下文:', context);
    
    // 基本的用户通知
    if (context.severity === 'high' && this.notificationService) {
      this.notificationService.show('error', '系统错误', '发生了一个严重错误，请刷新页面重试');
    }
  }
  
  /**
   * 处理用户通知
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  handleUserNotification(error, context) {
    // 只对用户可见的错误显示通知
    const shouldNotifyUser = this.shouldNotifyUser(error, context);
    
    if (!shouldNotifyUser || !this.notificationService) {
      return;
    }
    
    const notification = this.createUserNotification(error, context);
    this.notificationService.show(notification.type, notification.title, notification.message);
  }
  
  /**
   * 判断是否应该通知用户
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否通知用户
   */
  shouldNotifyUser(error, context) {
    // 开发模式下不通知用户
    if (typeof isDevelopment !== 'undefined' && isDevelopment) {
      return false;
    }
    
    // 根据错误来源决定
    if (context.source === 'console' || context.source === 'global') {
      return context.severity === 'high';
    }
    
    // 网络错误总是通知用户
    if (context.category === 'network') {
      return true;
    }
    
    // 存储错误通知用户
    if (context.category === 'storage') {
      return true;
    }
    
    // 验证错误通常不需要通知
    if (context.category === 'validation') {
      return false;
    }
    
    // 默认：高严重性错误通知用户
    return context.severity === 'high';
  }
  
  /**
   * 创建用户通知
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   * @returns {Object} 通知对象
   */
  createUserNotification(error, context) {
    const notifications = {
      network: {
        type: 'error',
        title: '网络错误',
        message: '网络连接出现问题，请检查网络后重试'
      },
      storage: {
        type: 'error',
        title: '存储错误',
        message: '数据存储出现问题，可能是存储空间不足'
      },
      translation: {
        type: 'warning',
        title: '翻译错误',
        message: '翻译服务出现问题，请稍后重试'
      },
      permission: {
        type: 'error',
        title: '权限错误',
        message: '没有执行此操作的权限'
      },
      unknown: {
        type: 'error',
        title: '系统错误',
        message: '发生了未知错误，请刷新页面重试'
      }
    };
    
    return notifications[context.category] || notifications.unknown;
  }
  
  /**
   * 添加错误监听器
   * @param {Function} listener - 监听函数
   */
  addErrorListener(listener) {
    this.errorListeners.add(listener);
  }
  
  /**
   * 移除错误监听器
   * @param {Function} listener - 监听函数
   */
  removeErrorListener(listener) {
    this.errorListeners.delete(listener);
  }
  
  /**
   * 通知错误监听器
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  notifyErrorListeners(error, context) {
    for (const listener of this.errorListeners) {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('错误监听器执行失败:', listenerError);
      }
    }
  }
  
  /**
   * 触发应用程序错误事件
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  static triggerApplicationError(error, context = {}) {
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent('applicationError', {
        detail: { error, context }
      });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * 获取错误统计信息
   */
  getStats() {
    return {
      categories: Array.from(this.errorCategories.keys()),
      listeners: this.errorListeners.size,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.errorListeners.clear();
    this.isInitialized = false;
    console.log('🧹 统一错误处理器已清理');
  }
}

// ==================== 便捷函数 ====================

/**
 * 安全执行函数（自动错误处理）
 * @param {Function} fn - 要执行的函数
 * @param {Object} context - 上下文信息
 * @returns {any} 函数执行结果
 */
function safeExecute(fn, context = {}) {
  try {
    return fn();
  } catch (error) {
    if (window.unifiedErrorHandler) {
      window.unifiedErrorHandler.handleError(error, { ...context, safe: true });
    } else {
      console.error('安全执行失败:', error);
    }
    return null;
  }
}

/**
 * 安全执行异步函数
 * @param {Function} asyncFn - 要执行的异步函数
 * @param {Object} context - 上下文信息
 * @returns {Promise} Promise结果
 */
async function safeExecuteAsync(asyncFn, context = {}) {
  try {
    return await asyncFn();
  } catch (error) {
    if (window.unifiedErrorHandler) {
      window.unifiedErrorHandler.handleError(error, { ...context, safe: true, async: true });
    } else {
      console.error('安全异步执行失败:', error);
    }
    return null;
  }
}

/**
 * 创建错误处理装饰器
 * @param {Object} context - 默认上下文
 * @returns {Function} 装饰器函数
 */
function createErrorDecorator(context = {}) {
  return function(fn) {
    return function(...args) {
      return safeExecute(() => fn.apply(this, args), context);
    };
  };
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    UnifiedErrorHandler, 
    safeExecute, 
    safeExecuteAsync, 
    createErrorDecorator 
  };
} else {
  // 浏览器环境，暴露到全局
  window.UnifiedErrorHandler = UnifiedErrorHandler;
  window.safeExecute = safeExecute;
  window.safeExecuteAsync = safeExecuteAsync;
  window.createErrorDecorator = createErrorDecorator;
}
