// ==================== 请求去重管理器 ====================
/**
 * 请求去重管理器：避免重复网络请求
 * 实现请求缓存、重复请求合并、智能失效策略
 */

/**
 * 请求去重管理器类
 */
class RequestDeduplicationManager {
  constructor(options = {}) {
    this.options = {
      defaultTTL: 300000, // 5分钟默认缓存时间
      maxCacheSize: 1000,
      enableCache: true,
      enableDeduplication: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestStats = {
      total: 0,
      cached: 0,
      deduplicated: 0,
      failed: 0,
      retried: 0
    };
  }
  
  /**
   * 执行请求（带去重和缓存）
   * @param {string} key - 请求唯一标识
   * @param {Function} requestFn - 请求函数
   * @param {Object} options - 选项
   * @returns {Promise} 请求结果
   */
  async request(key, requestFn, options = {}) {
    const {
      ttl = this.options.defaultTTL,
      useCache = this.options.enableCache,
      deduplicate = this.options.enableDeduplication,
      retries = this.options.retryAttempts,
      priority = 'normal',
      tags = []
    } = options;
    
    this.requestStats.total++;
    
    // 检查缓存
    if (useCache && this.hasValidCache(key)) {
      this.requestStats.cached++;
      return this.getCachedResult(key);
    }
    
    // 检查是否有相同的待处理请求
    if (deduplicate && this.pendingRequests.has(key)) {
      this.requestStats.deduplicated++;
      return this.pendingRequests.get(key);
    }
    
    // 创建请求Promise
    const requestPromise = this.executeRequest(key, requestFn, {
      ttl,
      useCache,
      retries,
      priority,
      tags
    });
    
    // 记录待处理请求
    if (deduplicate) {
      this.pendingRequests.set(key, requestPromise);
    }
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // 清理待处理请求
      if (deduplicate) {
        this.pendingRequests.delete(key);
      }
    }
  }
  
  /**
   * 执行实际请求
   * @param {string} key - 请求键
   * @param {Function} requestFn - 请求函数
   * @param {Object} options - 选项
   * @returns {Promise} 请求结果
   */
  async executeRequest(key, requestFn, options) {
    const { ttl, useCache, retries, priority, tags } = options;
    let lastError = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 执行请求
        const startTime = Date.now();
        const result = await requestFn();
        const duration = Date.now() - startTime;
        
        // 缓存成功结果
        if (useCache) {
          this.cacheResult(key, result, ttl, {
            timestamp: startTime,
            duration,
            tags,
            priority
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.requestStats.failed++;
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          this.requestStats.retried++;
          await this.delay(this.options.retryDelay * (attempt + 1));
          console.log(`🔄 请求重试 ${attempt + 1}/${retries}: ${key}`);
        }
      }
    }
    
    // 所有重试都失败了
    throw lastError;
  }
  
  /**
   * 检查是否有有效缓存
   * @param {string} key - 请求键
   * @returns {boolean} 是否有有效缓存
   */
  hasValidCache(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取缓存结果
   * @param {string} key - 请求键
   * @returns {any} 缓存的结果
   */
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached) {
      cached.accessCount++;
      cached.lastAccess = Date.now();
      return cached.data;
    }
    return null;
  }
  
  /**
   * 缓存请求结果
   * @param {string} key - 请求键
   * @param {any} data - 结果数据
   * @param {number} ttl - 生存时间
   * @param {Object} metadata - 元数据
   */
  cacheResult(key, data, ttl, metadata = {}) {
    // 清理过期缓存
    this.cleanupExpiredCache();
    
    // 检查缓存大小限制
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictCache();
    }
    
    const now = Date.now();
    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccess: now,
      accessCount: 1,
      ...metadata
    });
  }
  
  /**
   * 生成请求键
   * @param {string} method - HTTP方法
   * @param {string} url - 请求URL
   * @param {Object} params - 请求参数
   * @param {Object} headers - 请求头
   * @returns {string} 请求键
   */
  generateKey(method, url, params = {}, headers = {}) {
    const normalizedParams = this.normalizeParams(params);
    const normalizedHeaders = this.normalizeHeaders(headers);
    
    const keyData = {
      method: method.toUpperCase(),
      url,
      params: normalizedParams,
      headers: normalizedHeaders
    };
    
    return this.hashObject(keyData);
  }
  
  /**
   * 规范化请求参数
   * @param {Object} params - 参数对象
   * @returns {Object} 规范化的参数
   */
  normalizeParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    
    const normalized = {};
    const sortedKeys = Object.keys(params).sort();
    
    for (const key of sortedKeys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        normalized[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
    
    return normalized;
  }
  
  /**
   * 规范化请求头
   * @param {Object} headers - 请求头对象
   * @returns {Object} 规范化的请求头
   */
  normalizeHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return {};
    }
    
    const normalized = {};
    const ignoreHeaders = ['authorization', 'cookie', 'x-request-id'];
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (!ignoreHeaders.includes(lowerKey) && value !== undefined) {
        normalized[lowerKey] = String(value);
      }
    }
    
    return normalized;
  }
  
  /**
   * 计算对象哈希
   * @param {Object} obj - 要哈希的对象
   * @returns {string} 哈希值
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(36);
  }
  
  /**
   * 清除特定缓存
   * @param {string} key - 请求键
   */
  clearCache(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * 按标签清除缓存
   * @param {string|Array} tags - 标签
   */
  clearCacheByTags(tags) {
    const targetTags = Array.isArray(tags) ? tags : [tags];
    
    for (const [key, cached] of this.cache.entries()) {
      if (cached.tags && cached.tags.some(tag => targetTags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    const now = Date.now();
    
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 缓存淘汰策略（LRU）
   */
  evictCache() {
    if (this.cache.size === 0) {
      return;
    }
    
    let oldestKey = null;
    let oldestTime = Date.now();
    
    // 找到最少访问的缓存项
    for (const [key, cached] of this.cache.entries()) {
      const score = cached.lastAccess - (cached.accessCount * 10000);
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * 取消待处理请求
   * @param {string} key - 请求键
   */
  cancelRequest(key) {
    if (this.pendingRequests.has(key)) {
      // 注意：实际上Promise无法真正取消，这里只是从待处理列表中移除
      this.pendingRequests.delete(key);
      return true;
    }
    return false;
  }
  
  /**
   * 取消所有待处理请求
   */
  cancelAllRequests() {
    const count = this.pendingRequests.size;
    this.pendingRequests.clear();
    return count;
  }
  
  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} 延迟Promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const cacheStats = {
      size: this.cache.size,
      hitRate: this.requestStats.total > 0 ? 
               (this.requestStats.cached / this.requestStats.total * 100).toFixed(2) + '%' : '0%',
      deduplicationRate: this.requestStats.total > 0 ? 
                        (this.requestStats.deduplicated / this.requestStats.total * 100).toFixed(2) + '%' : '0%'
    };
    
    return {
      requests: { ...this.requestStats },
      cache: cacheStats,
      pending: this.pendingRequests.size,
      memory: this.estimateMemoryUsage()
    };
  }
  
  /**
   * 估算内存使用
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      totalSize += key.length * 2; // 字符串大小
      totalSize += JSON.stringify(cached.data).length * 2; // 数据大小
      totalSize += 200; // 元数据估算
    }
    
    return {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
  
  /**
   * 配置选项
   * @param {Object} options - 新选项
   */
  configure(options) {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.requestStats = {
      total: 0,
      cached: 0,
      deduplicated: 0,
      failed: 0,
      retried: 0
    };
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.cache.clear();
    this.pendingRequests.clear();
    this.resetStats();
    console.log('🧹 请求去重管理器已清理');
  }
}

/**
 * 创建HTTP请求装饰器
 * @param {RequestDeduplicationManager} manager - 去重管理器
 * @returns {Function} 装饰器函数
 */
function createHttpDecorator(manager) {
  return function decorateHttpRequest(originalFetch) {
    return async function(url, options = {}) {
      const method = options.method || 'GET';
      const params = options.params || {};
      const headers = options.headers || {};
      
      // 生成请求键
      const key = manager.generateKey(method, url, params, headers);
      
      // 使用去重管理器执行请求
      return manager.request(key, () => originalFetch(url, options), {
        ttl: options.ttl,
        useCache: options.useCache,
        deduplicate: options.deduplicate,
        retries: options.retries,
        priority: options.priority,
        tags: options.tags
      });
    };
  };
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RequestDeduplicationManager, createHttpDecorator };
} else {
  // 浏览器环境，暴露到全局
  window.RequestDeduplicationManager = RequestDeduplicationManager;
  window.createHttpDecorator = createHttpDecorator;
  
  // 创建全局实例
  window.requestDeduplicationManager = new RequestDeduplicationManager();
}
