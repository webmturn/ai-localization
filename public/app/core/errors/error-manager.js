// ==================== 统一错误管理系统 ====================
/**
 * 错误管理器：提供统一的错误分类、处理和恢复机制
 * 功能：
 * 1. 统一错误代码和分类
 * 2. 错误消息国际化和用户友好化
 * 3. 错误恢复策略
 * 4. 错误日志记录和上报
 * 5. 错误统计和分析
 */

// ==================== 错误代码常量 ====================
const ERROR_CODES = {
  // 网络相关错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CORS_ERROR: 'CORS_ERROR',
  
  // API相关错误
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_FORBIDDEN: 'API_FORBIDDEN',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  API_SERVICE_UNAVAILABLE: 'API_SERVICE_UNAVAILABLE',
  
  // 存储相关错误
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED: 'STORAGE_ACCESS_DENIED',
  STORAGE_CORRUPTED: 'STORAGE_CORRUPTED',
  STORAGE_VERSION_MISMATCH: 'STORAGE_VERSION_MISMATCH',
  
  // 文件处理错误
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_INVALID_FORMAT: 'FILE_INVALID_FORMAT',
  FILE_PARSE_ERROR: 'FILE_PARSE_ERROR',
  FILE_ENCODING_ERROR: 'FILE_ENCODING_ERROR',
  
  // 翻译相关错误
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  TRANSLATION_CANCELLED: 'TRANSLATION_CANCELLED',
  TRANSLATION_PAUSED: 'TRANSLATION_PAUSED',
  TRANSLATION_INVALID_RESPONSE: 'TRANSLATION_INVALID_RESPONSE',
  
  // 用户操作错误
  USER_CANCELLED: 'USER_CANCELLED',
  INVALID_INPUT: 'INVALID_INPUT',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // 系统错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED'
};

// ==================== 错误严重级别 ====================
const ERROR_SEVERITY = {
  LOW: 'low',        // 信息性错误，不影响核心功能
  MEDIUM: 'medium',  // 影响部分功能，但有替代方案
  HIGH: 'high',      // 影响核心功能，需要用户干预
  CRITICAL: 'critical' // 系统级错误，可能导致数据丢失
};

// ==================== 错误分类 ====================
const ERROR_CATEGORIES = {
  NETWORK: 'network',
  API: 'api',
  STORAGE: 'storage',
  FILE: 'file',
  TRANSLATION: 'translation',
  USER: 'user',
  SYSTEM: 'system'
};

// ==================== 自定义错误类 ====================
class TranslationToolError extends Error {
  /**
   * 错误追踪ID计数器
   * @private
   */
  static _errorCounter = 0;
  
  /**
   * 生成唯一的错误追踪ID
   * @returns {string} 错误追踪ID (格式: ERR-YYYYMMDD-HHMMSS-XXXX)
   */
  static generateTraceId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const counter = String(++TranslationToolError._errorCounter).padStart(4, '0');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ERR-${date}-${time}-${counter}-${random}`;
  }
  
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TranslationToolError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.traceId = TranslationToolError.generateTraceId(); // 错误追踪ID
    this.severity = this._determineSeverity(code);
    this.category = this._determineCategory(code);
    this.recoverable = this._isRecoverable(code);
    
    // 保留原始错误堆栈
    if (details.originalError && details.originalError.stack) {
      this.originalStack = details.originalError.stack;
    }
  }
  
  _determineSeverity(code) {
    const severityMap = {
      [ERROR_CODES.USER_CANCELLED]: ERROR_SEVERITY.LOW,
      [ERROR_CODES.TRANSLATION_PAUSED]: ERROR_SEVERITY.LOW,
      [ERROR_CODES.FILE_TOO_LARGE]: ERROR_SEVERITY.MEDIUM,
      [ERROR_CODES.API_RATE_LIMITED]: ERROR_SEVERITY.MEDIUM,
      [ERROR_CODES.NETWORK_ERROR]: ERROR_SEVERITY.MEDIUM,
      [ERROR_CODES.API_KEY_MISSING]: ERROR_SEVERITY.HIGH,
      [ERROR_CODES.API_KEY_INVALID]: ERROR_SEVERITY.HIGH,
      [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: ERROR_SEVERITY.HIGH,
      [ERROR_CODES.STORAGE_CORRUPTED]: ERROR_SEVERITY.CRITICAL,
      [ERROR_CODES.INTERNAL_ERROR]: ERROR_SEVERITY.CRITICAL
    };
    
    return severityMap[code] || ERROR_SEVERITY.MEDIUM;
  }
  
  _determineCategory(code) {
    if (code.startsWith('API_')) return ERROR_CATEGORIES.API;
    if (code.startsWith('STORAGE_')) return ERROR_CATEGORIES.STORAGE;
    if (code.startsWith('FILE_')) return ERROR_CATEGORIES.FILE;
    if (code.startsWith('TRANSLATION_')) return ERROR_CATEGORIES.TRANSLATION;
    if (code.includes('NETWORK') || code.includes('CONNECTION')) return ERROR_CATEGORIES.NETWORK;
    if (code === ERROR_CODES.USER_CANCELLED) return ERROR_CATEGORIES.USER;
    return ERROR_CATEGORIES.SYSTEM;
  }
  
  _isRecoverable(code) {
    const nonRecoverableCodes = [
      ERROR_CODES.STORAGE_CORRUPTED,
      ERROR_CODES.INTERNAL_ERROR,
      ERROR_CODES.FEATURE_NOT_SUPPORTED
    ];
    return !nonRecoverableCodes.includes(code);
  }
  
  toJSON() {
    return {
      traceId: this.traceId,
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      category: this.category,
      recoverable: this.recoverable,
      stack: this.stack,
      originalStack: this.originalStack
    };
  }
  
  /**
   * 获取用于日志显示的格式化字符串
   * @returns {string}
   */
  toLogString() {
    return `[${this.traceId}] ${this.code}: ${this.message}`;
  }
}

// ==================== 错误消息映射 ====================
const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: {
    title: '网络连接失败',
    message: '无法连接到服务器，请检查网络连接后重试',
    solutions: [
      '检查网络连接是否正常',
      '确认防火墙或代理设置',
      '稍后重试'
    ]
  },
  [ERROR_CODES.TIMEOUT]: {
    title: '请求超时',
    message: '请求处理时间过长，已自动取消',
    solutions: [
      '检查网络连接速度',
      '在设置中增加超时时间',
      '减少批处理大小'
    ]
  },
  [ERROR_CODES.API_KEY_MISSING]: {
    title: 'API密钥未配置',
    message: '请先配置翻译引擎的API密钥',
    solutions: [
      '在设置中配置API密钥',
      '确认密钥格式正确',
      '检查密钥权限'
    ]
  },
  [ERROR_CODES.API_KEY_INVALID]: {
    title: 'API密钥无效',
    message: '当前API密钥格式不正确或已过期',
    solutions: [
      '检查密钥格式是否正确',
      '确认密钥是否过期',
      '重新生成API密钥'
    ]
  },
  [ERROR_CODES.API_RATE_LIMITED]: {
    title: '请求频率过高',
    message: '触发了API限流，请稍后重试',
    solutions: [
      '等待一段时间后重试',
      '在设置中降低并发数',
      '减少批处理大小'
    ]
  },
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: {
    title: '存储空间不足',
    message: '浏览器存储空间已满，无法保存数据',
    solutions: [
      '清理浏览器缓存和数据',
      '导出项目备份',
      '删除不需要的项目'
    ]
  },
  [ERROR_CODES.FILE_TOO_LARGE]: {
    title: '文件过大',
    message: '文件大小超出限制，无法处理',
    solutions: [
      '分割大文件为多个小文件',
      '压缩文件内容',
      '联系管理员提高限制'
    ]
  },
  [ERROR_CODES.FILE_PARSE_ERROR]: {
    title: '文件解析失败',
    message: '文件格式不正确或内容损坏',
    solutions: [
      '检查文件格式是否正确',
      '尝试用文本编辑器打开文件',
      '重新导出原始文件'
    ]
  },
  [ERROR_CODES.TRANSLATION_CANCELLED]: {
    title: '翻译已取消',
    message: '翻译过程已被用户取消',
    solutions: []
  },
  [ERROR_CODES.USER_CANCELLED]: {
    title: '操作已取消',
    message: '操作已被用户取消',
    solutions: []
  },
  [ERROR_CODES.UNKNOWN_ERROR]: {
    title: '未知错误',
    message: '发生了未知错误，请重试',
    solutions: [
      '刷新页面重试',
      '检查浏览器控制台',
      '联系技术支持'
    ]
  }
};

// ==================== 错误管理器类 ====================
class ErrorManager {
  constructor() {
    this.errorHistory = [];
    this.errorStats = new Map();
    this.maxHistorySize = 100;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    
    // 绑定全局错误处理
    this._bindGlobalErrorHandlers();
  }
  
  /**
   * 创建标准化错误
   */
  createError(code, customMessage = null, details = {}) {
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
    const message = customMessage || errorInfo.message;
    
    return new TranslationToolError(code, message, {
      ...details,
      solutions: errorInfo.solutions || []
    });
  }
  
  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    let standardError;
    
    // 标准化错误对象
    if (error instanceof TranslationToolError) {
      standardError = error;
    } else {
      standardError = this._normalizeError(error, context);
    }
    
    // 记录错误
    this._logError(standardError, context);
    
    // 更新统计
    this._updateStats(standardError);
    
    // 显示用户通知
    this._showErrorNotification(standardError);
    
    // 尝试错误恢复
    this._attemptRecovery(standardError, context);
    
    return standardError;
  }
  
  /**
   * 标准化错误对象
   */
  _normalizeError(error, context) {
    // 根据错误特征判断错误类型
    const errorString = String(error?.message || error || '').toLowerCase();
    const status = error?.status;
    const name = error?.name;
    
    let code = ERROR_CODES.UNKNOWN_ERROR;
    let details = { originalError: error, context };
    
    // 网络错误
    if (name === 'AbortError' && context.userCancelled) {
      code = ERROR_CODES.USER_CANCELLED;
    } else if (name === 'AbortError' || errorString.includes('abort')) {
      code = ERROR_CODES.TIMEOUT;
    } else if (errorString.includes('failed to fetch') || 
               errorString.includes('network') ||
               errorString.includes('connection')) {
      code = ERROR_CODES.NETWORK_ERROR;
    }
    
    // API错误
    else if (status === 401 || status === 403) {
      code = errorString.includes('key') ? ERROR_CODES.API_KEY_INVALID : ERROR_CODES.API_UNAUTHORIZED;
    } else if (status === 429) {
      code = ERROR_CODES.API_RATE_LIMITED;
    } else if (status >= 500) {
      code = ERROR_CODES.API_SERVER_ERROR;
    }
    
    // 存储错误
    else if (name === 'QuotaExceededError') {
      code = ERROR_CODES.STORAGE_QUOTA_EXCEEDED;
    } else if (errorString.includes('indexeddb') || errorString.includes('storage')) {
      code = ERROR_CODES.STORAGE_ACCESS_DENIED;
    }
    
    // 文件错误
    else if (errorString.includes('parse') || errorString.includes('解析')) {
      code = ERROR_CODES.FILE_PARSE_ERROR;
    } else if (errorString.includes('encoding') || errorString.includes('编码')) {
      code = ERROR_CODES.FILE_ENCODING_ERROR;
    }
    
    // API密钥错误
    else if (errorString.includes('api密钥') || errorString.includes('api key')) {
      if (errorString.includes('未配置') || errorString.includes('missing')) {
        code = ERROR_CODES.API_KEY_MISSING;
      } else if (errorString.includes('格式') || errorString.includes('invalid')) {
        code = ERROR_CODES.API_KEY_INVALID;
      }
    }

    // 如果仍然是 UNKNOWN_ERROR，但原始错误里带有已知的错误代码，则沿用原始错误代码
    if (code === ERROR_CODES.UNKNOWN_ERROR) {
      const originalCode = error?.code || error?.details?.originalError?.code;
      if (originalCode && Object.values(ERROR_CODES).includes(originalCode)) {
        code = originalCode;
      }
    }
    
    return this.createError(code, error?.message, details);
  }
  
  /**
   * 记录错误日志
   */
  _logError(error, context) {
    const logEntry = {
      ...error.toJSON(),
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this._getUserId()
    };
    
    // 添加到历史记录
    this.errorHistory.unshift(logEntry);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
    
    // 控制台输出
    const logLevel = this._getLogLevel(error.severity);
    console[logLevel](`[ErrorManager] ${error.code}: ${error.message}`, {
      error: logEntry,
      stack: error.stack
    });
    
    // 可选：发送到远程日志服务
    if (error.severity === ERROR_SEVERITY.CRITICAL) {
      this._reportError(logEntry);
    }
  }
  
  /**
   * 更新错误统计
   */
  _updateStats(error) {
    const statsKey = `${error.category}_${error.code}`;
    const current = this.errorStats.get(statsKey) || { count: 0, lastOccurred: null };
    this.errorStats.set(statsKey, {
      count: current.count + 1,
      lastOccurred: new Date(),
      code: error.code,
      category: error.category,
      severity: error.severity
    });
  }
  
  /**
   * 显示错误通知
   */
  _showErrorNotification(error) {
    const errorInfo = ERROR_MESSAGES[error.code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
    
    // 确定通知类型
    let notificationType;
    switch (error.severity) {
      case ERROR_SEVERITY.LOW:
        notificationType = 'info';
        break;
      case ERROR_SEVERITY.MEDIUM:
        notificationType = 'warning';
        break;
      case ERROR_SEVERITY.HIGH:
      case ERROR_SEVERITY.CRITICAL:
        notificationType = 'error';
        break;
      default:
        notificationType = 'warning';
    }
    
    // 添加到通知队列
    this.notificationQueue.push({
      type: notificationType,
      title: errorInfo.title,
      message: errorInfo.message,
      solutions: errorInfo.solutions,
      error: error
    });
    
    this._processNotificationQueue();
  }
  
  /**
   * 处理通知队列
   */
  async _processNotificationQueue() {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      
      // 显示主要通知
      this._displayNotification(notification);
      
      // 等待一段时间再显示下一个通知
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * 显示通知（支持依赖注入）
   */
  _displayNotification(notification) {
    // 优先使用全局的showNotification函数
    if (typeof window.showNotification === 'function') {
      window.showNotification(notification.type, notification.title, notification.message);
      
      // 如果有解决方案，显示详细信息
      if (notification.solutions && notification.solutions.length > 0) {
        const solutionsText = '建议解决方案：\n' + 
          notification.solutions.map((s, i) => `${i + 1}. ${s}`).join('\n');
        
        setTimeout(() => {
          window.showNotification('info', '解决方案', solutionsText);
        }, 1000);
      }
    }
    // 如果没有通知函数，使用控制台输出
    else {
      const level = notification.type === 'error' ? 'error' : 
                   notification.type === 'warning' ? 'warn' : 'info';
      console[level](`[${notification.title}] ${notification.message}`);
      
      if (notification.solutions && notification.solutions.length > 0) {
        console.info('建议解决方案:', notification.solutions);
      }
    }
  }
  
  /**
   * 尝试错误恢复
   */
  _attemptRecovery(error, context) {
    if (!error.recoverable) {
      return false;
    }
    
    const recoveryStrategies = {
      [ERROR_CODES.NETWORK_ERROR]: () => this._retryWithBackoff(context),
      [ERROR_CODES.TIMEOUT]: () => this._retryWithIncreasedTimeout(context),
      [ERROR_CODES.API_RATE_LIMITED]: () => this._retryWithDelay(context, 5000),
      [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: () => this._cleanupStorage(),
      [ERROR_CODES.FILE_PARSE_ERROR]: () => this._tryAlternativeParser(context)
    };
    
    const strategy = recoveryStrategies[error.code];
    if (strategy) {
      try {
        return strategy();
      } catch (recoveryError) {
        console.warn('错误恢复失败:', recoveryError);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * 绑定全局错误处理
   */
  _bindGlobalErrorHandlers() {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const error = this.handleError(event.reason, { 
        type: 'unhandledPromiseRejection',
        promise: event.promise 
      });
      
      // 阻止默认的控制台错误输出
      if (error.severity !== ERROR_SEVERITY.CRITICAL) {
        event.preventDefault();
      }
    });
    
    // 捕获全局JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleError(event.error || event.message, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      byCategory: {},
      bySeverity: {},
      byCode: {},
      recent: this.errorHistory.slice(0, 10)
    };
    
    this.errorStats.forEach((stat, key) => {
      stats.byCategory[stat.category] = (stats.byCategory[stat.category] || 0) + stat.count;
      stats.bySeverity[stat.severity] = (stats.bySeverity[stat.severity] || 0) + stat.count;
      stats.byCode[stat.code] = (stats.byCode[stat.code] || 0) + stat.count;
    });
    
    return stats;
  }
  
  /**
   * 导出错误日志
   */
  exportErrorLog() {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      userAgent: navigator.userAgent,
      url: window.location.href,
      stats: this.getErrorStats(),
      history: this.errorHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * 清理错误历史
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.errorStats.clear();
  }
  
  // ==================== 私有辅助方法 ====================
  
  _getLogLevel(severity) {
    switch (severity) {
      case ERROR_SEVERITY.LOW: return 'info';
      case ERROR_SEVERITY.MEDIUM: return 'warn';
      case ERROR_SEVERITY.HIGH: return 'error';
      case ERROR_SEVERITY.CRITICAL: return 'error';
      default: return 'warn';
    }
  }
  
  _getUserId() {
    // 生成或获取匿名用户ID（用于错误统计）
    let userId = localStorage.getItem('anonymous_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('anonymous_user_id', userId);
    }
    return userId;
  }
  
  _reportError(logEntry) {
    // 可选：发送错误报告到远程服务
    // 这里只是示例，实际实现需要根据具体需求
    console.info('Critical error reported:', logEntry);
  }
  
  async _retryWithBackoff(context, maxRetries = 3) {
    // 指数退避重试策略
    for (let i = 0; i < maxRetries; i++) {
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        if (context.retryFunction) {
          return await context.retryFunction();
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        console.log(`重试 ${i + 1}/${maxRetries} 失败，${delay * 2}ms后再次尝试...`);
      }
    }
    throw new Error('所有重试均失败');
  }
  
  async _retryWithDelay(context, delay) {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (context.retryFunction) {
      return await context.retryFunction();
    }
  }
  
  async _retryWithIncreasedTimeout(context) {
    // 增加超时时间重试
    if (context.retryFunction) {
      return await context.retryFunction();
    }
    return false;
  }
  
  async _tryAlternativeParser(context) {
    // 尝试替代解析器
    if (context.alternativeParser) {
      return await context.alternativeParser();
    }
    return false;
  }
  
  _cleanupStorage() {
    // 清理存储空间的策略
    try {
      // 清理旧的错误日志
      const oldLogs = localStorage.getItem('error_logs');
      if (oldLogs) {
        localStorage.removeItem('error_logs');
      }
      
      // 可以添加更多清理逻辑
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ==================== 全局错误管理器实例 ====================
let errorManager;

/**
 * 初始化错误管理器
 */
function initializeErrorManager() {
  if (!errorManager) {
    errorManager = new ErrorManager();
    
    // 将错误管理器暴露到全局
    window.errorManager = errorManager;
    
    // 提供便捷的全局错误处理函数
    window.handleError = (error, context) => errorManager.handleError(error, context);
    window.createError = (code, message, details) => errorManager.createError(code, message, details);
    
    console.log('✅ 错误管理器初始化完成');
  }
  
  return errorManager;
}

// ==================== 统一错误处理函数 ====================

/**
 * 统一的异步操作错误处理包装器
 * @param {Function} asyncFunction - 异步函数
 * @param {Object} context - 上下文信息
 * @returns {Promise} 包装后的Promise
 */
async function withErrorHandling(asyncFunction, context = {}) {
  try {
    return await asyncFunction();
  } catch (error) {
    const handledError = errorManager.handleError(error, context);
    
    // 如果错误不可恢复，重新抛出
    if (!handledError.recoverable) {
      throw handledError;
    }
    
    return null;
  }
}

/**
 * 统一的翻译操作错误处理
 * @param {Function} translationFunction - 翻译函数
 * @param {Object} context - 翻译上下文
 * @returns {Promise} 翻译结果
 */
async function withTranslationErrorHandling(translationFunction, context = {}) {
  return withErrorHandling(translationFunction, {
    ...context,
    category: 'translation',
    retryable: true
  });
}

/**
 * 统一的存储操作错误处理
 * @param {Function} storageFunction - 存储函数
 * @param {Object} context - 存储上下文
 * @returns {Promise} 存储结果
 */
async function withStorageErrorHandling(storageFunction, context = {}) {
  return withErrorHandling(storageFunction, {
    ...context,
    category: 'storage',
    retryable: true
  });
}

/**
 * 统一的网络请求错误处理
 * @param {Function} networkFunction - 网络请求函数
 * @param {Object} context - 网络上下文
 * @returns {Promise} 请求结果
 */
async function withNetworkErrorHandling(networkFunction, context = {}) {
  return withErrorHandling(networkFunction, {
    ...context,
    category: 'network',
    retryable: true,
    maxRetries: 3
  });
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ErrorManager,
    TranslationToolError,
    ERROR_CODES,
    ERROR_SEVERITY,
    ERROR_CATEGORIES,
    initializeErrorManager,
    withErrorHandling,
    withTranslationErrorHandling,
    withStorageErrorHandling,
    withNetworkErrorHandling
  };
} else {
  // 浏览器环境，暴露到全局
  window.ErrorManager = ErrorManager;
  window.TranslationToolError = TranslationToolError;
  window.ERROR_CODES = ERROR_CODES;
  window.ERROR_SEVERITY = ERROR_SEVERITY;
  window.ERROR_CATEGORIES = ERROR_CATEGORIES;
  window.initializeErrorManager = initializeErrorManager;
  window.withErrorHandling = withErrorHandling;
  window.withTranslationErrorHandling = withTranslationErrorHandling;
  window.withStorageErrorHandling = withStorageErrorHandling;
  window.withNetworkErrorHandling = withNetworkErrorHandling;
}