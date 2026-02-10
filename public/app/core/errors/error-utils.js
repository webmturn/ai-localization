// ==================== 错误处理工具函数 ====================
/**
 * 错误处理工具函数：提供常用的错误处理模式和包装器
 * 功能：
 * 1. 异步操作错误包装
 * 2. 重试机制
 * 3. 错误边界
 * 4. 错误恢复策略
 */

// ==================== 异步操作错误包装器 ====================

/**
 * 安全执行异步函数，自动处理错误
 * @param {Function} asyncFn - 异步函数
 * @param {Object} options - 选项
 * @returns {Promise<{success: boolean, data?: any, error?: TranslationToolError}>}
 */
async function safeAsync(asyncFn, options = {}) {
  const {
    context = {},
    fallbackValue = null,
    suppressError = false,
    retryCount = 0,
    retryDelay = 1000
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const result = await asyncFn();
      return { success: true, data: result };
    } catch (error) {
      lastError = error;
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      // 处理错误
      const handledError = suppressError ? null : errorManager.handleError(lastError, {
        ...context,
        function: asyncFn.name,
        attempt: attempt + 1,
        maxAttempts: retryCount + 1
      });
      
      return {
        success: false,
        data: fallbackValue,
        error: handledError
      };
    }
  }
  
  // 这种情况理论上不会发生，但为了类型安全
  return {
    success: false,
    data: fallbackValue,
    error: suppressError ? null : errorManager.handleError(lastError || new Error('未知错误'), context)
  };
}

/**
 * 包装函数，自动处理错误和重试
 * @param {Function} fn - 要包装的函数
 * @param {Object} options - 选项
 * @returns {Function} 包装后的函数
 */
function withErrorHandling(fn, options = {}) {
  const {
    context = {},
    retryCount = 0,
    retryDelay = 1000,
    fallbackValue = null,
    suppressError = false
  } = options;
  
  return async function(...args) {
    return await safeAsync(
      () => fn.apply(this, args),
      { context, retryCount, retryDelay, fallbackValue, suppressError }
    );
  };
}

// ==================== 网络请求错误处理 ====================

/**
 * 网络请求错误分析器
 * @param {Error} error - 网络错误
 * @param {Object} requestInfo - 请求信息
 * @returns {TranslationToolError} 标准化错误
 */
function analyzeNetworkError(error, requestInfo = {}) {
  const { url, method = 'GET', timeout = 30000 } = requestInfo;
  
  // 超时错误
  if (error.name === 'AbortError' || error.code === 'TIMEOUT') {
    return errorManager.createError(ERROR_CODES.TIMEOUT, null, {
      originalError: error,
      url,
      method,
      timeout
    });
  }
  
  // 网络连接错误
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError')) {
    return errorManager.createError(ERROR_CODES.NETWORK_ERROR, null, {
      originalError: error,
      url,
      method
    });
  }
  
  // CORS错误
  if (error.message?.includes('CORS') || 
      error.message?.includes('cross-origin')) {
    return errorManager.createError(ERROR_CODES.CORS_ERROR, null, {
      originalError: error,
      url,
      method
    });
  }
  
  return errorManager.createError(ERROR_CODES.NETWORK_ERROR, error.message, {
    originalError: error,
    url,
    method
  });
}

/**
 * HTTP响应错误分析器
 * @param {Response} response - HTTP响应
 * @param {Object} requestInfo - 请求信息
 * @returns {TranslationToolError} 标准化错误
 */
function analyzeHttpError(response, requestInfo = {}) {
  const { url, method = 'GET', engine } = requestInfo;
  const status = response.status;
  
  let code;
  let message;
  
  switch (status) {
    case 401:
      code = ERROR_CODES.API_UNAUTHORIZED;
      message = `访问被拒绝 (401)，请检查API密钥是否正确`;
      break;
    case 403:
      code = ERROR_CODES.API_FORBIDDEN;
      message = `访问被禁止 (403)，请检查API密钥权限`;
      break;
    case 429:
      code = ERROR_CODES.API_RATE_LIMITED;
      message = `请求频率过高 (429)，请稍后重试`;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      code = ERROR_CODES.API_SERVER_ERROR;
      message = `服务器错误 (${status})，请稍后重试`;
      break;
    default:
      code = ERROR_CODES.API_SERVER_ERROR;
      message = `HTTP错误 (${status})`;
  }
  
  return errorManager.createError(code, message, {
    status,
    url,
    method,
    engine,
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    }
  });
}

// ==================== API错误处理 ====================

/**
 * API密钥验证
 * @param {string} apiKey - API密钥
 * @param {string} engine - 引擎名称
 * @returns {TranslationToolError|null} 验证错误或null
 */
function validateApiKey(apiKey, engine) {
  if (!apiKey || typeof apiKey !== 'string') {
    return errorManager.createError(ERROR_CODES.API_KEY_MISSING, 
      `请配置${engine}的API密钥`, { engine });
  }
  
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return errorManager.createError(ERROR_CODES.API_KEY_MISSING, 
      `${engine}的API密钥不能为空`, { engine });
  }
  
  // 基本格式验证（优先使用 securityUtils，回退到正则）
  const engineLower = engine.toLowerCase();
  if (typeof securityUtils !== 'undefined' && typeof securityUtils.validateApiKey === 'function') {
    const engineCfg = typeof EngineRegistry !== 'undefined' ? EngineRegistry.get(engineLower) : null;
    const validationType = engineCfg ? (engineCfg.apiKeyValidationType || engineLower) : engineLower;
    if (!securityUtils.validateApiKey(trimmedKey, validationType)) {
      return errorManager.createError(ERROR_CODES.API_KEY_INVALID,
        `${engine}的API密钥格式不正确`, { engine, keyLength: trimmedKey.length });
    }
  } else {
    const formatValidators = {
      openai: /^sk-[a-zA-Z0-9]{48,}$/,
      deepseek: /^sk-[a-zA-Z0-9]{48,}$/,
      google: /^[a-zA-Z0-9_-]{20,}$/
    };
    const validator = formatValidators[engineLower];
    if (validator && !validator.test(trimmedKey)) {
      return errorManager.createError(ERROR_CODES.API_KEY_INVALID,
        `${engine}的API密钥格式不正确`, { engine, keyLength: trimmedKey.length });
    }
  }
  
  return null;
}

/**
 * 翻译响应验证
 * @param {any} response - API响应
 * @param {string} engine - 引擎名称
 * @returns {TranslationToolError|null} 验证错误或null
 */
function validateTranslationResponse(response, engine) {
  if (!response) {
    return errorManager.createError(ERROR_CODES.TRANSLATION_INVALID_RESPONSE,
      `${engine}返回空响应`, { engine, response });
  }
  
  // 检查响应格式
  if (typeof response !== 'object') {
    return errorManager.createError(ERROR_CODES.TRANSLATION_INVALID_RESPONSE,
      `${engine}响应格式不正确`, { engine, responseType: typeof response });
  }
  
  // 检查错误字段
  if (response.error) {
    const errorMessage = typeof response.error === 'string' ? 
      response.error : response.error.message || '未知API错误';
    
    return errorManager.createError(ERROR_CODES.TRANSLATION_FAILED,
      `${engine}翻译失败: ${errorMessage}`, { engine, apiError: response.error });
  }
  
  return null;
}

// ==================== 存储错误处理 ====================

/**
 * 存储操作错误分析器
 * @param {Error} error - 存储错误
 * @param {string} operation - 操作类型
 * @returns {TranslationToolError} 标准化错误
 */
function analyzeStorageError(error, operation = 'unknown') {
  const errorName = error.name;
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorName === 'QuotaExceededError') {
    return errorManager.createError(ERROR_CODES.STORAGE_QUOTA_EXCEEDED, null, {
      originalError: error,
      operation
    });
  }
  
  if (errorName === 'AbortError') {
    return errorManager.createError(ERROR_CODES.STORAGE_ACCESS_DENIED, 
      '存储操作被中止', { originalError: error, operation });
  }
  
  if (errorName === 'InvalidStateError') {
    return errorManager.createError(ERROR_CODES.STORAGE_ACCESS_DENIED, 
      '存储状态异常', { originalError: error, operation });
  }
  
  if (errorMessage.includes('blocked') || errorMessage.includes('version')) {
    return errorManager.createError(ERROR_CODES.STORAGE_VERSION_MISMATCH, 
      '存储版本冲突', { originalError: error, operation });
  }
  
  return errorManager.createError(ERROR_CODES.STORAGE_ACCESS_DENIED, 
    error.message, { originalError: error, operation });
}

// ==================== 文件处理错误 ====================

/**
 * 文件验证
 * @param {File} file - 文件对象
 * @param {Object} options - 验证选项
 * @returns {TranslationToolError|null} 验证错误或null
 */
function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = [],
    allowedExtensions = []
  } = options;
  
  if (!file || !(file instanceof File)) {
    return errorManager.createError(ERROR_CODES.INVALID_INPUT, 
      '无效的文件对象', { file });
  }
  
  // 检查文件大小
  if (file.size > maxSize) {
    return errorManager.createError(ERROR_CODES.FILE_TOO_LARGE, 
      `文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超过限制 ${(maxSize / 1024 / 1024).toFixed(2)}MB`, {
        fileSize: file.size,
        maxSize,
        fileName: file.name
      });
  }
  
  // 检查文件类型
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return errorManager.createError(ERROR_CODES.FILE_INVALID_FORMAT, 
      `不支持的文件类型: ${file.type}`, {
        fileType: file.type,
        allowedTypes,
        fileName: file.name
      });
  }
  
  // 检查文件扩展名
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return errorManager.createError(ERROR_CODES.FILE_INVALID_FORMAT, 
        `不支持的文件扩展名: ${extension}`, {
          extension,
          allowedExtensions,
          fileName: file.name
        });
    }
  }
  
  return null;
}

/**
 * 文件解析错误分析器
 * @param {Error} error - 解析错误
 * @param {string} fileName - 文件名
 * @param {string} format - 文件格式
 * @returns {TranslationToolError} 标准化错误
 */
function analyzeParseError(error, fileName, format) {
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('encoding') || errorMessage.includes('编码')) {
    return errorManager.createError(ERROR_CODES.FILE_ENCODING_ERROR, 
      `文件编码错误: ${error.message}`, {
        originalError: error,
        fileName,
        format
      });
  }
  
  if (errorMessage.includes('xml') || errorMessage.includes('parse')) {
    return errorManager.createError(ERROR_CODES.FILE_PARSE_ERROR, 
      `文件解析失败: ${error.message}`, {
        originalError: error,
        fileName,
        format
      });
  }
  
  return errorManager.createError(ERROR_CODES.FILE_PARSE_ERROR, 
    error.message, {
      originalError: error,
      fileName,
      format
    });
}

// ==================== 错误边界 ====================

/**
 * 创建错误边界函数
 * @param {Function} fn - 要保护的函数
 * @param {Object} options - 选项
 * @returns {Function} 受保护的函数
 */
function createErrorBoundary(fn, options = {}) {
  const {
    fallback = null,
    onError = null,
    context = {}
  } = options;
  
  return function(...args) {
    try {
      const result = fn.apply(this, args);
      
      // 如果返回Promise，处理异步错误
      if (result && typeof result.then === 'function') {
        return result.catch(error => {
          const handledError = errorManager.handleError(error, {
            ...context,
            function: fn.name,
            args: args.length
          });
          
          if (onError) {
            onError(handledError);
          }
          
          return fallback;
        });
      }
      
      return result;
    } catch (error) {
      const handledError = errorManager.handleError(error, {
        ...context,
        function: fn.name,
        args: args.length
      });
      
      if (onError) {
        onError(handledError);
      }
      
      return fallback;
    }
  };
}

// ==================== 批量操作错误处理 ====================

/**
 * 批量操作错误收集器
 */
class BatchErrorCollector {
  constructor() {
    this.errors = [];
    this.successes = [];
  }
  
  /**
   * 添加成功结果
   */
  addSuccess(index, result, item = null) {
    this.successes.push({
      index,
      result,
      item,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 添加错误结果
   */
  addError(index, error, item = null) {
    const standardError = error instanceof TranslationToolError ? 
      error : errorManager.handleError(error, { batchIndex: index, item });
    
    this.errors.push({
      index,
      error: standardError,
      item,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * 获取汇总结果
   */
  getSummary() {
    const total = this.successes.length + this.errors.length;
    return {
      total,
      successCount: this.successes.length,
      errorCount: this.errors.length,
      successRate: total > 0 ? (this.successes.length / total) : 0,
      errors: this.errors,
      successes: this.successes
    };
  }
  
  /**
   * 获取可重试的错误
   */
  getRetryableErrors() {
    return this.errors.filter(e => e.error.recoverable);
  }
  
  /**
   * 清空收集器
   */
  clear() {
    this.errors = [];
    this.successes = [];
  }
}

// ==================== 导出接口 ====================
window.ErrorUtils = {
  safeAsync,
  withErrorHandling,
  analyzeNetworkError,
  analyzeHttpError,
  validateApiKey,
  validateTranslationResponse,
  analyzeStorageError,
  validateFile,
  analyzeParseError,
  createErrorBoundary,
  BatchErrorCollector
};

// 便捷函数
window.safeAsync = safeAsync;
window.withErrorHandling = withErrorHandling;
window.BatchErrorCollector = BatchErrorCollector;