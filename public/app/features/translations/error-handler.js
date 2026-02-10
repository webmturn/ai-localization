// ==================== 翻译模块错误处理器 ====================
/**
 * 翻译模块专用错误处理器
 * 替换原有的 formatTranslationError 函数，使用统一的错误管理系统
 */

/**
 * 格式化翻译错误（新版本）
 * @param {Error|Object} errorLike - 错误对象
 * @param {string} engine - 翻译引擎名称
 * @returns {Object} 格式化后的错误信息
 */
function formatTranslationErrorV2(errorLike, engine) {
  // 安全检查：如果错误管理系统不可用，回退到原始实现
  const em = typeof errorManager !== 'undefined' ? errorManager : 
             (window.getServiceSafely ? window.getServiceSafely('errorManager') : null);
  
  if (!em || typeof em.handleError !== 'function' || 
      typeof ERROR_MESSAGES === 'undefined' || typeof ERROR_CODES === 'undefined') {
    // 回退到原始版本（formatTranslationErrorOriginal 由覆盖逻辑保存）
    if (typeof window.formatTranslationErrorOriginal === 'function') {
      return window.formatTranslationErrorOriginal(errorLike, engine);
    }
    // 最终备用：返回基本格式
    const msg = (errorLike && errorLike.message) ? errorLike.message : String(errorLike || '未知错误');
    return { type: 'error', title: '翻译失败', message: msg, detail: msg };
  }

  // 使用新的错误管理系统
  const standardError = em.handleError(errorLike, {
    engine,
    operation: 'translation',
    component: 'actions'
  });
  
  // 转换为旧格式以保持兼容性
  const errorInfo = ERROR_MESSAGES[standardError.code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
  
  let notificationType;
  switch (standardError.severity) {
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
  
  return {
    type: notificationType,
    title: errorInfo.title,
    message: errorInfo.message,
    detail: standardError.message,
    error: standardError,
    solutions: errorInfo.solutions || []
  };
}

/**
 * 批量翻译错误处理器
 * @param {Array} items - 翻译项目列表
 * @param {string} engine - 翻译引擎
 * @param {Function} translateFn - 翻译函数
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 批量翻译结果
 */
async function handleBatchTranslation(items, engine, translateFn, onProgress = null) {
  const collector = new BatchErrorCollector();
  const results = [];
  
  // 验证API密钥
  const settings = SettingsCache.get();
  const apiKeyField = `${engine.toLowerCase()}ApiKey`;
  const apiKey = settings[apiKeyField];
  
  const keyError = ErrorUtils.validateApiKey(apiKey, engine);
  if (keyError) {
    throw keyError;
  }
  
  let completed = 0;
  const total = items.length;
  
  for (let i = 0; i < items.length; i++) {
    try {
      // 检查是否被取消
      if (!AppState.translations.isInProgress) {
        const cancelError = errorManager.createError(ERROR_CODES.USER_CANCELLED);
        collector.addError(i, cancelError, items[i]);
        break;
      }
      
      // 等待暂停状态
      while (AppState.translations.isPaused && AppState.translations.isInProgress) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!AppState.translations.isInProgress) {
        const cancelError = errorManager.createError(ERROR_CODES.USER_CANCELLED);
        collector.addError(i, cancelError, items[i]);
        break;
      }
      
      // 执行翻译
      const result = await safeAsync(
        () => translateFn(items[i]),
        {
          context: { 
            engine, 
            itemIndex: i, 
            item: items[i] 
          },
          retryCount: 2,
          retryDelay: 1000
        }
      );
      
      if (result.success) {
        collector.addSuccess(i, result.data, items[i]);
        results.push({
          success: true,
          index: i,
          result: result.data,
          item: items[i]
        });
      } else {
        collector.addError(i, result.error, items[i]);
        results.push({
          success: false,
          index: i,
          error: result.error,
          item: items[i]
        });
      }
      
      completed++;
      
      // 更新进度
      if (onProgress) {
        const currentText = items[i].sourceText?.length > 50 
          ? items[i].sourceText.substring(0, 50) + "..."
          : items[i].sourceText || '';
        onProgress(completed, total, `[${completed}/${total}] ${currentText}`);
      }
      
    } catch (error) {
      const handledError = errorManager.handleError(error, {
        engine,
        itemIndex: i,
        item: items[i],
        operation: 'batchTranslation'
      });
      
      collector.addError(i, handledError, items[i]);
      results.push({
        success: false,
        index: i,
        error: handledError,
        item: items[i]
      });
      
      // 如果是严重错误，停止批量翻译
      if (handledError.severity === ERROR_SEVERITY.CRITICAL) {
        break;
      }
    }
  }
  
  const summary = collector.getSummary();
  
  // 显示批量翻译结果通知
  if (summary.errorCount > 0) {
    const retryableCount = collector.getRetryableErrors().length;
    showNotification(
      summary.successCount > 0 ? 'warning' : 'error',
      '批量翻译完成',
      `成功: ${summary.successCount}, 失败: ${summary.errorCount}${retryableCount > 0 ? `, 可重试: ${retryableCount}` : ''}`
    );
  } else {
    showNotification('success', '批量翻译完成', `成功翻译 ${summary.successCount} 项`);
  }
  
  return {
    results,
    errors: collector.errors,
    summary
  };
}

/**
 * 网络请求错误处理包装器
 * @param {Function} requestFn - 网络请求函数
 * @param {Object} requestInfo - 请求信息
 * @returns {Promise} 包装后的请求
 */
async function handleNetworkRequest(requestFn, requestInfo = {}) {
  try {
    const response = await requestFn();
    
    // 检查HTTP状态
    if (!response.ok) {
      throw ErrorUtils.analyzeHttpError(response, requestInfo);
    }
    
    return response;
  } catch (error) {
    // 分析网络错误
    if (error instanceof TranslationToolError) {
      throw error;
    }
    
    throw ErrorUtils.analyzeNetworkError(error, requestInfo);
  }
}

/**
 * 翻译响应验证和处理
 * @param {any} response - API响应
 * @param {string} engine - 翻译引擎
 * @returns {string} 翻译结果
 */
function processTranslationResponse(response, engine) {
  // 验证响应
  const validationError = ErrorUtils.validateTranslationResponse(response, engine);
  if (validationError) {
    throw validationError;
  }
  
  // 提取翻译结果
  let translatedText = '';
  
  try {
    const errEngineConfig = typeof EngineRegistry !== 'undefined' ? EngineRegistry.get(engine.toLowerCase()) : null;
    if (errEngineConfig && errEngineConfig.category === 'ai') {
      translatedText = response.choices?.[0]?.message?.content || '';
    } else if (errEngineConfig && errEngineConfig.category === 'traditional') {
      translatedText = response.data?.translations?.[0]?.translatedText || '';
    } else {
      translatedText = response.translatedText || response.result || String(response);
    }
    
    if (!translatedText || typeof translatedText !== 'string') {
      throw errorManager.createError(ERROR_CODES.TRANSLATION_INVALID_RESPONSE,
        `${engine}返回的翻译结果为空或格式不正确`, {
          engine,
          response,
          extractedText: translatedText
        });
    }
    
    return translatedText.trim();
  } catch (error) {
    if (error instanceof TranslationToolError) {
      throw error;
    }
    
    throw errorManager.createError(ERROR_CODES.TRANSLATION_INVALID_RESPONSE,
      `处理${engine}翻译响应时出错: ${error.message}`, {
        engine,
        response,
        originalError: error
      });
  }
}

/**
 * 创建重试策略
 * @param {Object} options - 重试选项
 * @returns {Function} 重试函数
 */
function createRetryStrategy(options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors = [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.API_RATE_LIMITED,
      ERROR_CODES.API_SERVER_ERROR
    ]
  } = options;
  
  return async function retry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // 检查是否可重试
        const standardError = error instanceof TranslationToolError ? 
          error : errorManager.handleError(error, context);
        
        if (!retryableErrors.includes(standardError.code) || attempt === maxRetries - 1) {
          throw standardError;
        }
        
        // 计算延迟时间
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        (loggers.translation || console).debug(`重试第 ${attempt + 1} 次，${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };
}

// ==================== 导出接口 ====================
window.TranslationErrorHandler = {
  formatTranslationErrorV2,
  handleBatchTranslation,
  handleNetworkRequest,
  processTranslationResponse,
  createRetryStrategy
};

// 向后兼容：替换原有的formatTranslationError函数
if (typeof window.formatTranslationError !== 'undefined') {
  window.formatTranslationErrorOriginal = window.formatTranslationError;
}
window.formatTranslationError = formatTranslationErrorV2;