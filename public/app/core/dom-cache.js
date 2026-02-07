// ==================== DOM 缓存管理 ====================
/**
 * 统一的DOM缓存系统（单例模式）
 * 优势：
 * 1. 减少重复DOM查询，提升性能
 * 2. isConnected 有效性检查，防止返回已断开的元素
 * 3. 支持 CSS 选择器缓存（query/queryAll）
 * 4. 批量DOM更新（batchUpdate）+ rAF 调度 + 优先级 + 时间片
 * 5. DocumentFragment 对象池
 * 6. 提供 clear/remove 方法，防止内存泄漏
 * @namespace DOMCache
 */
const DOMCache = {
  /** @type {Map<string, HTMLElement>} ID → 元素缓存 */
  cache: new Map(),
  /** @type {Map<string, {element: Element, lastAccess: number}>} 选择器缓存 */
  _selectorCache: new Map(),
  /** @type {Map<string, Array>} 批量更新队列 */
  _batchQueue: new Map(),
  /** @type {boolean} 是否已调度批量更新 */
  _updateScheduled: false,
  /** @type {DocumentFragment[]} 文档片段对象池 */
  _fragmentPool: [],
  /** @type {Object} 配置选项 */
  _options: {
    maxSelectorCacheSize: 500,
    batchDelay: 16,
  },

  // ======================== ID 缓存 ========================

  /**
   * 获取缓存的DOM元素，如不存在则查询并缓存
   * 包含 isConnected 有效性检查：已断开的元素会被自动清除并重新查询
   * @param {string} id - 元素ID
   * @returns {HTMLElement|undefined} DOM元素
   */
  get(id) {
    const cached = this.cache.get(id);
    if (cached) {
      if (cached.isConnected) return cached;
      this.cache.delete(id);
    }
    const element = document.getElementById(id);
    if (element) {
      this.cache.set(id, element);
    }
    return element || undefined;
  },

  /**
   * 清除所有缓存（ID缓存 + 选择器缓存）
   * @returns {void}
   */
  clear() {
    this.cache.clear();
    this._selectorCache.clear();
  },

  /**
   * 移除指定ID的缓存
   * @param {string} id - 元素ID
   * @returns {boolean} 是否成功删除
   */
  remove(id) {
    return this.cache.delete(id);
  },

  // ======================== CSS 选择器缓存 ========================

  /**
   * 通过CSS选择器查询并缓存单个元素
   * @param {string} selector - CSS选择器
   * @param {Element} [context=document] - 查找上下文
   * @returns {Element|null} DOM元素
   */
  query(selector, context) {
    if (!context) context = document;
    const key = (context === document ? "d" : (context.id || "c")) + ":" + selector;
    const entry = this._selectorCache.get(key);
    if (entry && entry.element && entry.element.isConnected) {
      entry.lastAccess = Date.now();
      return entry.element;
    }
    if (entry) this._selectorCache.delete(key);
    const element = context.querySelector(selector);
    if (element) {
      this._selectorCache.set(key, { element: element, lastAccess: Date.now() });
      this._evictSelectorCache();
    }
    return element;
  },

  /**
   * 通过CSS选择器查询元素列表（不缓存，因为NodeList易变）
   * @param {string} selector - CSS选择器
   * @param {Element} [context=document] - 查找上下文
   * @returns {NodeList} DOM元素列表
   */
  queryAll(selector, context) {
    return (context || document).querySelectorAll(selector);
  },

  /**
   * 淘汰最久未访问的选择器缓存项
   * @private
   */
  _evictSelectorCache() {
    if (this._selectorCache.size <= this._options.maxSelectorCacheSize) return;
    var oldestKey = null;
    var oldestTime = Infinity;
    for (var pair of this._selectorCache) {
      if (pair[1].lastAccess < oldestTime) {
        oldestTime = pair[1].lastAccess;
        oldestKey = pair[0];
      }
    }
    if (oldestKey) this._selectorCache.delete(oldestKey);
  },

  // ======================== 批量 DOM 更新 ========================

  /**
   * 将 DOM 更新加入批处理队列，按 rAF 调度执行
   * @param {string} groupKey - 分组键
   * @param {Function} updateFn - 更新函数，接收 DocumentFragment 参数
   * @param {Object} [options] - 选项
   * @param {string} [options.priority='normal'] - 优先级: 'high' | 'normal' | 'low'
   * @param {boolean} [options.immediate=false] - 是否立即执行
   */
  batchUpdate(groupKey, updateFn, options) {
    var priority = (options && options.priority) || "normal";
    var immediate = !!(options && options.immediate);
    if (!this._batchQueue.has(groupKey)) {
      this._batchQueue.set(groupKey, []);
    }
    this._batchQueue.get(groupKey).push({
      updateFn: updateFn,
      priority: priority,
      timestamp: Date.now(),
    });
    if (immediate) {
      this._flushBatch(groupKey);
    } else {
      this._scheduleBatch();
    }
  },

  /** @private */
  _scheduleBatch() {
    if (this._updateScheduled) return;
    this._updateScheduled = true;
    var self = this;
    var scheduler =
      window.requestAnimationFrame ||
      function (fn) { return setTimeout(fn, self._options.batchDelay); };
    scheduler(function () {
      self._updateScheduled = false;
      self._processBatchQueue();
    });
  },

  /** @private */
  _processBatchQueue() {
    var startTime = performance.now();
    var priorityMap = { high: 3, normal: 2, low: 1 };
    var sorted = Array.from(this._batchQueue.entries()).sort(function (a, b) {
      var ap = Math.max.apply(null, a[1].map(function (u) { return priorityMap[u.priority] || 2; }));
      var bp = Math.max.apply(null, b[1].map(function (u) { return priorityMap[u.priority] || 2; }));
      return bp - ap;
    });
    for (var i = 0; i < sorted.length; i++) {
      this._flushBatch(sorted[i][0]);
      if (performance.now() - startTime > 8) {
        if (this._batchQueue.size > 0) this._scheduleBatch();
        break;
      }
    }
  },

  /** @private */
  _flushBatch(groupKey) {
    var updates = this._batchQueue.get(groupKey);
    if (!updates || updates.length === 0) return;
    var fragment = this.getFragment();
    try {
      for (var i = 0; i < updates.length; i++) {
        try {
          updates[i].updateFn(fragment);
        } catch (e) {
          (loggers.app || console).error("DOMCache batchUpdate error:", e);
        }
      }
    } finally {
      this._batchQueue.delete(groupKey);
      this.recycleFragment(fragment);
    }
  },

  // ======================== DocumentFragment 对象池 ========================

  /**
   * 从对象池获取 DocumentFragment（减少GC压力）
   * @returns {DocumentFragment}
   */
  getFragment() {
    return this._fragmentPool.length > 0
      ? this._fragmentPool.pop()
      : document.createDocumentFragment();
  },

  /**
   * 回收 DocumentFragment 到对象池
   * @param {DocumentFragment} fragment
   */
  recycleFragment(fragment) {
    while (fragment.firstChild) fragment.removeChild(fragment.firstChild);
    if (this._fragmentPool.length < 10) this._fragmentPool.push(fragment);
  },

  // ======================== 统计与配置 ========================

  /**
   * 获取缓存统计信息（调试用）
   * @returns {Object}
   */
  getStats() {
    return {
      idCacheSize: this.cache.size,
      selectorCacheSize: this._selectorCache.size,
      batchQueueSize: this._batchQueue.size,
      fragmentPoolSize: this._fragmentPool.length,
      updateScheduled: this._updateScheduled,
    };
  },

  /**
   * 修改配置选项
   * @param {Object} options - 配置项
   */
  configure(options) {
    if (options) {
      for (var key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          this._options[key] = options[key];
        }
      }
    }
  },
};
