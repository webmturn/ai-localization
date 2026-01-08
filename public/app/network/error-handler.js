// ==================== 网络模块错误处理器 ====================
/**
 * 网络模块专用错误处理器
 * 增强原有的 NetworkUtils 类，添加统一的错误处理
 */

/**
 * 增强版的NetworkUtils类
 */
class NetworkUtilsV2 extends NetworkUtils {
  constructor() {
    super();
    this.requestStats = new Map(); // 请求统计
    this.circuitBreaker = new Map(); // 熔断器
  }
  
  /**
   * 增强版的fetch请求，包含完整的错误处理
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @param {number} timeout - 超时时间
   * @returns {Promise<Response>} 响应对象
   */
  async fetchWithErrorHandling(url, options = {}, timeout = this.defaultTimeout) {
    const requestInfo = {
      url,
      method: options.method || 'GET',
      timeout,
      timestamp: Date.now()
    };
    
    // 检查熔断器
    if (this._isCircuitBreakerOpen(url)) {
      throw errorManager.createError(ERROR_CODES.API_SERVICE_UNAVAILABLE,
        '服务暂时不可用（熔断器开启）', { url, circuitBreaker: true });
    }
    
    try {
      // 记录请求开始
      this._recordRequestStart(url);
      
      // 执行请求
      const response = await this.fetchWithTimeout(url, options, timeout);
      
      // 记录成功
      this._recordRequestSuccess(url);
      
      // 检查HTTP状态
      if (!response.ok) {
        const httpError = ErrorUtils.analyzeHttpError(response, requestInfo);
        this._recordRequestError(url, httpError);
        throw httpError;
      }
      
      return response;
      
    } catch (error) {
      // 分析和记录错误
      let standardError;
      if (error instanceof TranslationToolError) {
        standardError = error;
      } else {
        standardError = ErrorUtils.analyzeNetworkError(error, requestInfo);
      }
      
      this._recordRequestError(url, standardError);
      
      // 更新熔断器状态
      this._updateCircuitBreaker(url, standardError);
      
      throw standardError;
    }
  }
  
  /**
   * 批量请求处理
   * @param {Array} requests - 请求列表
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 请求结果
   */
  async batchRequest(requests, options = {}) {
    const {
      concurrency = 3,
      retryCount = 2,
      onProgress = null
    } = options;
    
    const collector = new BatchErrorCollector();
    const results = [];
    
    // 分批处理请求
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (request, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        try {
          const result = await safeAsync(
            () => this.fetchWithErrorHandling(request.url, request.options, request.timeout),
            {
              context: { 
                requestIndex: globalIndex,
                url: request.url,
                method: request.options?.method || 'GET'
              },
              retryCount,
              retryDelay: 1000
            }
          );
          
          if (result.success) {
            collector.addSuccess(globalIndex, result.data, request);
            return { index: globalIndex, success: true, data: result.data };
          } else {
            collector.addError(globalIndex, result.error, request);
            return { index: globalIndex, success: false, error: result.error };
          }
          
        } catch (error) {
          const handledError = errorManager.handleError(error, {
            requestIndex: globalIndex,
            request
          });
          collector.addError(globalIndex, handledError, request);
          return { index: globalIndex, success: false, error: handledError };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 更新进度
      if (onProgress) {
        onProgress(results.length, requests.length);
      }
    }
    
    return {
      results,
      summary: collector.getSummary()
    };
  }
  
  /**
   * 获取请求统计信息
   * @param {string} url - URL（可选）
   * @returns {Object} 统计信息
   */
  getRequestStats(url = null) {
    if (url) {
      return this.requestStats.get(url) || {
        total: 0,
        success: 0,
        error: 0,
        lastRequest: null,
        lastError: null
      };
    }
    
    const allStats = {
      total: 0,
      success: 0,
      error: 0,
      byUrl: {}
    };
    
    this.requestStats.forEach((stats, url) => {
      allStats.total += stats.total;
      allStats.success += stats.success;
      allStats.error += stats.error;
      allStats.byUrl[url] = stats;
    });
    
    return allStats;
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.requestStats.clear();
    this.circuitBreaker.clear();
  }
  
  // ==================== 私有方法 ====================
  
  _recordRequestStart(url) {
    const stats = this.requestStats.get(url) || {
      total: 0,
      success: 0,
      error: 0,
      lastRequest: null,
      lastError: null
    };
    
    stats.total++;
    stats.lastRequest = Date.now();
    this.requestStats.set(url, stats);
  }
  
  _recordRequestSuccess(url) {
    const stats = this.requestStats.get(url);
    if (stats) {
      stats.success++;
      this.requestStats.set(url, stats);
    }
  }
  
  _recordRequestError(url, error) {
    const stats = this.requestStats.get(url);
    if (stats) {
      stats.error++;
      stats.lastError = {
        timestamp: Date.now(),
        code: error.code,
        message: error.message
      };
      this.requestStats.set(url, stats);
    }
  }
  
  _isCircuitBreakerOpen(url) {
    const breaker = this.circuitBreaker.get(url);
    if (!breaker) return false;
    
    const now = Date.now();
    
    // 如果在冷却期内，检查是否可以重试
    if (breaker.state === 'open' && now - breaker.lastFailure > breaker.cooldownPeriod) {
      breaker.state = 'half-open';
      this.circuitBreaker.set(url, breaker);
      return false;
    }
    
    return breaker.state === 'open';
  }
  
  _updateCircuitBreaker(url, error) {
    const now = Date.now();
    let breaker = this.circuitBreaker.get(url) || {
      state: 'closed',
      failureCount: 0,
      lastFailure: null,
      threshold: 5,
      cooldownPeriod: 60000 // 1分钟
    };
    
    // 如果是可恢复的错误，增加失败计数
    if (error.recoverable && [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.API_SERVER_ERROR
    ].includes(error.code)) {
      breaker.failureCount++;
      breaker.lastFailure = now;
      
      // 达到阈值，开启熔断器
      if (breaker.failureCount >= breaker.threshold) {
        breaker.state = 'open';
        console.warn(`熔断器开启: ${url} (失败次数: ${breaker.failureCount})`);
      }
    } else if (breaker.state === 'half-open') {
      // 半开状态下成功，关闭熔断器
      breaker.state = 'closed';
      breaker.failureCount = 0;
    }
    
    this.circuitBreaker.set(url, breaker);
  }
}

/**
 * 创建重试策略的网络请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @param {Object} retryOptions - 重试选项
 * @returns {Promise<Response>} 响应对象
 */
async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    backoffFactor = 2,
    timeout = 30000
  } = retryOptions;
  
  const networkUtils = new NetworkUtilsV2();
  const retryStrategy = TranslationErrorHandler.createRetryStrategy({
    maxRetries,
    baseDelay,
    backoffFactor: backoffFactor,
    retryableErrors: [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.API_RATE_LIMITED,
      ERROR_CODES.API_SERVER_ERROR
    ]
  });
  
  return await retryStrategy(
    () => networkUtils.fetchWithErrorHandling(url, options, timeout),
    { url, method: options.method || 'GET' }
  );
}

/**
 * 网络连接检查
 * @returns {Promise<Object>} 连接状态
 */
async function checkNetworkConnectivity() {
  const result = {
    online: navigator.onLine,
    latency: null,
    bandwidth: null,
    issues: [],
    recommendations: []
  };
  
  try {
    // 测试延迟
    const start = performance.now();
    await fetch('/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000)
    });
    result.latency = performance.now() - start;
    
    if (result.latency > 2000) {
      result.issues.push('网络延迟较高');
      result.recommendations.push('检查网络连接质量');
    }
    
  } catch (error) {
    result.issues.push('网络连接测试失败');
    result.recommendations.push('检查网络连接是否正常');
  }
  
  // 检查连接类型（如果支持）
  if ('connection' in navigator) {
    const connection = navigator.connection;
    result.bandwidth = connection.downlink;
    result.connectionType = connection.effectiveType;
    
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      result.issues.push('网络连接速度较慢');
      result.recommendations.push('考虑在更好的网络环境下使用');
    }
  }
  
  return result;
}

/**
 * 请求拦截器
 */
class RequestInterceptor {
  constructor() {
    this.interceptors = [];
  }
  
  /**
   * 添加请求拦截器
   * @param {Function} interceptor - 拦截器函数
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.push(interceptor);
  }
  
  /**
   * 执行拦截器
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 处理后的选项
   */
  async executeInterceptors(url, options) {
    let processedOptions = { ...options };
    
    for (const interceptor of this.interceptors) {
      try {
        processedOptions = await interceptor(url, processedOptions) || processedOptions;
      } catch (error) {
        console.warn('请求拦截器执行失败:', error);
      }
    }
    
    return processedOptions;
  }
}

// 创建全局请求拦截器实例
const requestInterceptor = new RequestInterceptor();

// 添加默认拦截器：API密钥验证
requestInterceptor.addRequestInterceptor(async (url, options) => {
  // 如果是翻译API请求，验证API密钥
  if (url.includes('openai.com') || url.includes('deepseek.com') || url.includes('googleapis.com')) {
    const headers = options.headers || {};
    const authHeader = headers.Authorization || headers.authorization;
    
    if (!authHeader) {
      throw errorManager.createError(ERROR_CODES.API_KEY_MISSING,
        'API请求缺少认证头', { url });
    }
  }
  
  return options;
});

// ==================== 导出接口 ====================
window.NetworkErrorHandler = {
  NetworkUtilsV2,
  fetchWithRetry,
  checkNetworkConnectivity,
  RequestInterceptor,
  requestInterceptor
};

// 创建增强版的网络工具实例
window.networkUtilsV2 = new NetworkUtilsV2();

// 向后兼容
if (typeof NetworkUtils !== 'undefined') {
  window.NetworkUtilsOriginal = NetworkUtils;
}
window.NetworkUtils = NetworkUtilsV2;