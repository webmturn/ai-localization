// ==================== 网络请求工具 ====================

class NetworkUtils {
  constructor() {
    this.defaultTimeout = 30000; // 30秒超时
    this.activeRequests = new Map(); // 跟踪活动请求
    this.pendingRequests = new Map(); // 请求去重：相同请求复用结果
    this.requestCache = new Map(); // 请求缓存
    this.cacheTimeout = 5000; // 缓存5秒

    this.dedupeStats = {
      total: 0,
      cacheHits: 0,
      dedupeHits: 0,
    };
  }
  
  /**
   * 生成请求的唯一标识符
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {string} 请求标识符
   */
  _generateRequestKey(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body || '';
    return `${method}:${url}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
  }
  
  /**
   * 检查缓存是否有效
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存数据或null
   */
  _getCachedResponse(key) {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      try {
        if (cached.data && typeof cached.data.clone === "function") {
          return cached.data.clone();
        }
      } catch (_) {
        (loggers.services || console).debug("networkUtils cache clone:", _);
      }
      return cached.data;
    }
    this.requestCache.delete(key);
    return null;
  }
  
  /**
   * 设置响应缓存
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   */
  _setCachedResponse(key, data, ttlMs) {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : this.cacheTimeout;
    const now = Date.now();
    this.requestCache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
    
    // 清理过期缓存（限制缓存大小）
    if (this.requestCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.requestCache) {
        if (!v || !v.expiresAt || now > v.expiresAt) {
          this.requestCache.delete(k);
        }
      }
    }
  }

  _publishStats() {
    try {
      if (typeof window !== "undefined" && window.ArchDebug) {
        window.ArchDebug.setFlag("networkUtilsStats", this.getStats(), {
          mirrorWindow: false,
        });
      }
    } catch (_) {
      (loggers.services || console).debug("networkUtils ArchDebug flag:", _);
    }
  }

  // 带超时和取消支持的fetch
  async fetchWithTimeout(url, options = {}, timeout = this.defaultTimeout) {
    const controller = new AbortController();
    const requestId = Math.random().toString(36);

    let didTimeout = false;

    // 设置超时
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      (loggers.services || console).warn("请求超时:", url);
    }, timeout);

    // 记录请求
    this.activeRequests.set(requestId, controller);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      if (error.name === "AbortError") {
        if (didTimeout) {
          const err = new Error("请求超时");
          err.code = "TIMEOUT";
          err.isTimeout = true;
          err.url = url;
          throw err;
        }
        const err = new Error("用户取消");
        err.name = "AbortError";
        err.code = "USER_CANCELLED";
        err.url = url;
        throw err;
      }
      throw error;
    }
  }

  // 取消所有活动请求
  cancelAll() {
    (loggers.services || console).debug("取消所有活动请求:", this.activeRequests.size);
    this.activeRequests.forEach((controller) => {
      controller.abort();
    });
    this.activeRequests.clear();
  }

  // 验证请求体积大小
  validateRequestSize(data, maxSizeKB = 500) {
    const size = new Blob([JSON.stringify(data)]).size;
    const maxBytes = maxSizeKB * 1024;

    if (size > maxBytes) {
      throw new Error(
        `请求体积过大: ${(size / 1024).toFixed(2)}KB, 最大允许: ${maxSizeKB}KB`
      );
    }

    return true;
  }
  
  /**
   * 带去重功能的fetch请求
   * 相同的请求会复用正在进行的请求结果
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @param {Object} config - 配置选项
   * @param {number} [config.timeout] - 超时时间
   * @param {boolean} [config.dedupe=true] - 是否启用去重
   * @param {boolean} [config.cache=false] - 是否启用缓存
   * @returns {Promise<Response>} 响应对象
   */
  async fetchWithDedupe(url, options = {}, config = {}) {
    const { 
      timeout = this.defaultTimeout, 
      dedupe = true, 
      cache = false,
      cacheTTL = undefined,
    } = config;

    const ttlMs = Number.isFinite(cacheTTL) && cacheTTL > 0 ? cacheTTL : this.cacheTimeout;
    
    const requestKey = this._generateRequestKey(url, options);

    this.dedupeStats.total++;
    this._publishStats();
    
    // 检查缓存
    if (cache) {
      const cachedResponse = this._getCachedResponse(requestKey);
      if (cachedResponse) {
        this.dedupeStats.cacheHits++;
        this._publishStats();
        return cachedResponse;
      }
    }
    
    // 检查是否有相同的请求正在进行
    if (dedupe && this.pendingRequests.has(requestKey)) {
      this.dedupeStats.dedupeHits++;
      this._publishStats();
      const pending = this.pendingRequests.get(requestKey);
      return pending.then((response) => {
        try {
          return response && typeof response.clone === "function"
            ? response.clone()
            : response;
        } catch (_) {
          return response;
        }
      });
    }
    
    // 创建新请求
    const requestPromise = this.fetchWithTimeout(url, options, timeout)
      .then(response => {
        let master = response;
        try {
          master = response.clone();
        } catch (_) {
          master = response;
        }

        // 缓存响应
        if (cache) {
          this._setCachedResponse(requestKey, master, ttlMs);
        }

        this._publishStats();

        return master;
      })
      .finally(() => {
        // 请求完成后移除
        this.pendingRequests.delete(requestKey);
        this._publishStats();
      });
    
    // 记录请求
    if (dedupe) {
      this.pendingRequests.set(requestKey, requestPromise);
    }

    return requestPromise.then((response) => {
      try {
        return response && typeof response.clone === "function"
          ? response.clone()
          : response;
      } catch (_) {
        return response;
      }
    });
  }
  
  /**
   * 获取请求统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      activeRequests: this.activeRequests.size,
      pendingDedupe: this.pendingRequests.size,
      cachedResponses: this.requestCache.size,
      totalRequests: this.dedupeStats.total,
      cacheHits: this.dedupeStats.cacheHits,
      dedupeHits: this.dedupeStats.dedupeHits
    };
  }
  
  /**
   * 清除所有缓存
   */
  clearCache() {
    this.requestCache.clear();
  }
}

// 创建全局网络工具实例
const networkUtils = new NetworkUtils();
