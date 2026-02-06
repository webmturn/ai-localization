// ==================== DOM优化管理器 ====================
/**
 * DOM优化管理器：提升DOM操作性能
 * 实现DOM元素缓存、批量更新、虚拟滚动等优化技术
 */

/**
 * DOM优化管理器类
 */
class DOMOptimizationManager {
  constructor() {
    this.elementCache = new Map();
    this.batchQueue = new Map();
    this.updateScheduled = false;
    this.observers = new Map();
    this.fragmentPool = [];
    this.options = {
      batchDelay: 16, // 16ms for 60fps
      cacheTimeout: 300000, // 5分钟缓存超时
      maxCacheSize: 1000,
      enableVirtualScrolling: true
    };
  }
  
  /**
   * 获取缓存的DOM元素
   * @param {string} selector - CSS选择器
   * @param {Element} context - 上下文元素
   * @returns {Element|null} DOM元素
   */
  getCachedElement(selector, context = document) {
    const cacheKey = `${context === document ? 'doc' : context.id || 'ctx'}_${selector}`;
    
    // 检查缓存
    const cached = this.elementCache.get(cacheKey);
    if (cached && this.isElementValid(cached.element)) {
      cached.lastAccess = Date.now();
      return cached.element;
    }
    
    // 查找元素并缓存
    const element = context.querySelector(selector);
    if (element) {
      this.cacheElement(cacheKey, element);
    }
    
    return element;
  }
  
  /**
   * 获取缓存的DOM元素列表
   * @param {string} selector - CSS选择器
   * @param {Element} context - 上下文元素
   * @returns {NodeList} DOM元素列表
   */
  getCachedElements(selector, context = document) {
    const cacheKey = `${context === document ? 'doc' : context.id || 'ctx'}_${selector}_all`;
    
    // 检查缓存
    const cached = this.elementCache.get(cacheKey);
    if (cached && this.areElementsValid(cached.elements)) {
      cached.lastAccess = Date.now();
      return cached.elements;
    }
    
    // 查找元素列表并缓存
    const elements = context.querySelectorAll(selector);
    if (elements.length > 0) {
      this.cacheElements(cacheKey, elements);
    }
    
    return elements;
  }
  
  /**
   * 缓存单个元素
   * @param {string} key - 缓存键
   * @param {Element} element - DOM元素
   */
  cacheElement(key, element) {
    // 清理过期缓存
    this.cleanupExpiredCache();
    
    // 检查缓存大小限制
    if (this.elementCache.size >= this.options.maxCacheSize) {
      this.evictOldestCache();
    }
    
    this.elementCache.set(key, {
      element,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      type: 'single'
    });
  }
  
  /**
   * 缓存元素列表
   * @param {string} key - 缓存键
   * @param {NodeList} elements - DOM元素列表
   */
  cacheElements(key, elements) {
    this.cleanupExpiredCache();
    
    if (this.elementCache.size >= this.options.maxCacheSize) {
      this.evictOldestCache();
    }
    
    this.elementCache.set(key, {
      elements: Array.from(elements),
      createdAt: Date.now(),
      lastAccess: Date.now(),
      type: 'multiple'
    });
  }
  
  /**
   * 检查元素是否有效
   * @param {Element} element - DOM元素
   * @returns {boolean} 是否有效
   */
  isElementValid(element) {
    return element && element.isConnected && document.contains(element);
  }
  
  /**
   * 检查元素列表是否有效
   * @param {Array} elements - DOM元素数组
   * @returns {boolean} 是否有效
   */
  areElementsValid(elements) {
    return elements && elements.length > 0 && 
           elements.every(el => this.isElementValid(el));
  }
  
  /**
   * 批量DOM更新
   * @param {string} groupKey - 分组键
   * @param {Function} updateFn - 更新函数
   * @param {Object} options - 选项
   */
  batchUpdate(groupKey, updateFn, options = {}) {
    const { priority = 'normal', immediate = false } = options;
    
    // 添加到批处理队列
    if (!this.batchQueue.has(groupKey)) {
      this.batchQueue.set(groupKey, []);
    }
    
    this.batchQueue.get(groupKey).push({
      updateFn,
      priority,
      timestamp: Date.now()
    });
    
    // 立即执行或调度执行
    if (immediate) {
      this.flushBatchUpdates(groupKey);
    } else {
      this.scheduleBatchUpdate();
    }
  }
  
  /**
   * 调度批量更新
   */
  scheduleBatchUpdate() {
    if (this.updateScheduled) {
      return;
    }
    
    this.updateScheduled = true;
    
    // 使用 requestAnimationFrame 或 setTimeout
    const scheduler = window.requestAnimationFrame || 
                     ((fn) => setTimeout(fn, this.options.batchDelay));
    
    scheduler(() => {
      this.updateScheduled = false;
      this.processBatchQueue();
    });
  }
  
  /**
   * 处理批量更新队列
   */
  processBatchQueue() {
    const startTime = performance.now();
    
    // 按优先级排序
    const sortedGroups = Array.from(this.batchQueue.entries()).sort((a, b) => {
      const aPriority = this.getGroupPriority(a[1]);
      const bPriority = this.getGroupPriority(b[1]);
      return bPriority - aPriority;
    });
    
    for (const [groupKey, updates] of sortedGroups) {
      this.flushBatchUpdates(groupKey);
      
      // 时间片控制：如果处理时间超过8ms，延后处理剩余任务
      if (performance.now() - startTime > 8) {
        if (this.batchQueue.size > 0) {
          this.scheduleBatchUpdate();
        }
        break;
      }
    }
  }
  
  /**
   * 获取分组优先级
   * @param {Array} updates - 更新列表
   * @returns {number} 优先级分数
   */
  getGroupPriority(updates) {
    const priorityMap = { high: 3, normal: 2, low: 1 };
    return updates.reduce((max, update) => {
      const priority = priorityMap[update.priority] || 2;
      return Math.max(max, priority);
    }, 0);
  }
  
  /**
   * 执行特定分组的批量更新
   * @param {string} groupKey - 分组键
   */
  flushBatchUpdates(groupKey) {
    const updates = this.batchQueue.get(groupKey);
    if (!updates || updates.length === 0) {
      return;
    }
    
    // 使用文档片段优化DOM操作
    const fragment = this.getDocumentFragment();
    let fragmentUsed = false;
    
    try {
      for (const { updateFn } of updates) {
        try {
          const result = updateFn(fragment);
          if (result === true) {
            fragmentUsed = true;
          }
        } catch (error) {
          console.error('批量更新执行失败:', error);
        }
      }
      
      // 如果使用了文档片段，需要将其添加到DOM中
      if (fragmentUsed && fragment.hasChildNodes()) {
        // 这里需要具体的插入逻辑，由调用方决定
        console.warn('文档片段已准备就绪，需要调用方插入到DOM中');
      }
      
    } finally {
      // 清理队列和回收文档片段
      this.batchQueue.delete(groupKey);
      this.recycleDocumentFragment(fragment);
    }
  }
  
  /**
   * 获取文档片段（对象池）
   * @returns {DocumentFragment} 文档片段
   */
  getDocumentFragment() {
    if (this.fragmentPool.length > 0) {
      return this.fragmentPool.pop();
    }
    return document.createDocumentFragment();
  }
  
  /**
   * 回收文档片段
   * @param {DocumentFragment} fragment - 文档片段
   */
  recycleDocumentFragment(fragment) {
    // 清空片段内容
    while (fragment.firstChild) {
      fragment.removeChild(fragment.firstChild);
    }
    
    // 回收到对象池（限制数量）
    if (this.fragmentPool.length < 10) {
      this.fragmentPool.push(fragment);
    }
  }
  
  /**
   * 创建虚拟滚动管理器
   * @param {Element} container - 容器元素
   * @param {Object} options - 配置选项
   * @returns {Object} 虚拟滚动管理器
   */
  createVirtualScrollManager(container, options = {}) {
    const {
      itemHeight = 50,
      buffer = 5,
      renderItem = null
    } = options;
    
    if (!this.options.enableVirtualScrolling) {
      return null;
    }
    
    return new DOMVirtualScrollManager(container, {
      itemHeight,
      buffer,
      renderItem,
      domManager: this
    });
  }
  
  /**
   * 观察DOM变化
   * @param {Element} target - 目标元素
   * @param {Function} callback - 回调函数
   * @param {Object} options - 观察选项
   * @returns {string} 观察器ID
   */
  observeChanges(target, callback, options = {}) {
    if (!window.MutationObserver) {
      return null;
    }
    
    const observerId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const observer = new MutationObserver((mutations) => {
      // 使用批量更新处理变化
      this.batchUpdate(`mutation_${observerId}`, () => {
        callback(mutations);
      }, { priority: 'low' });
    });
    
    const observerOptions = {
      childList: true,
      subtree: true,
      ...options
    };
    
    observer.observe(target, observerOptions);
    
    this.observers.set(observerId, {
      observer,
      target,
      callback,
      options: observerOptions
    });
    
    return observerId;
  }
  
  /**
   * 停止观察DOM变化
   * @param {string} observerId - 观察器ID
   */
  unobserveChanges(observerId) {
    const observerData = this.observers.get(observerId);
    if (observerData) {
      observerData.observer.disconnect();
      this.observers.delete(observerId);
    }
  }
  
  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    const now = Date.now();
    const timeout = this.options.cacheTimeout;
    
    for (const [key, cached] of this.elementCache.entries()) {
      if (now - cached.lastAccess > timeout) {
        this.elementCache.delete(key);
      }
    }
  }
  
  /**
   * 清理最老的缓存项
   */
  evictOldestCache() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, cached] of this.elementCache.entries()) {
      if (cached.lastAccess < oldestTime) {
        oldestTime = cached.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.elementCache.delete(oldestKey);
    }
  }
  
  /**
   * 清除所有缓存
   */
  clearCache() {
    this.elementCache.clear();
  }
  
  /**
   * 获取性能统计
   */
  getStats() {
    return {
      cacheSize: this.elementCache.size,
      batchQueueSize: this.batchQueue.size,
      observersCount: this.observers.size,
      fragmentPoolSize: this.fragmentPool.size,
      updateScheduled: this.updateScheduled
    };
  }
  
  /**
   * 配置选项
   * @param {Object} options - 配置选项
   */
  configure(options) {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * 清理资源
   */
  dispose() {
    // 清理所有观察器
    for (const [id] of this.observers) {
      this.unobserveChanges(id);
    }
    
    // 清理缓存和队列
    this.clearCache();
    this.batchQueue.clear();
    this.fragmentPool.length = 0;
    
    console.log('🧹 DOM优化管理器已清理');
  }
}

/**
 * DOM虚拟滚动管理器类（旧版本，保留兼容性）
 */
class DOMVirtualScrollManager {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.itemHeight = options.itemHeight || 50;
    this.buffer = options.buffer || 5;
    this.renderItem = options.renderItem;
    this.domManager = options.domManager;
    
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.init();
  }
  
  init() {
    this.updateContainerHeight();
    this.bindEvents();
    this.render();
  }
  
  updateContainerHeight() {
    this.containerHeight = this.container.clientHeight;
  }
  
  bindEvents() {
    this.container.addEventListener('scroll', () => {
      this.handleScroll();
    });
    
    window.addEventListener('resize', () => {
      this.updateContainerHeight();
      this.render();
    });
  }
  
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.calculateVisibleRange();
    this.render();
  }
  
  calculateVisibleRange() {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    
    this.visibleStart = Math.max(0, start - this.buffer);
    this.visibleEnd = Math.min(this.items.length, start + visibleCount + this.buffer);
  }
  
  setItems(items) {
    this.items = items;
    this.calculateVisibleRange();
    this.render();
  }
  
  render() {
    if (!this.renderItem) {
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    // 创建占位元素
    const topSpacer = document.createElement('div');
    topSpacer.style.height = `${this.visibleStart * this.itemHeight}px`;
    fragment.appendChild(topSpacer);
    
    // 渲染可见项
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const itemElement = this.renderItem(this.items[i], i);
      if (itemElement) {
        fragment.appendChild(itemElement);
      }
    }
    
    // 底部占位元素
    const bottomSpacerHeight = (this.items.length - this.visibleEnd) * this.itemHeight;
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    fragment.appendChild(bottomSpacer);
    
    // 清空容器并添加新内容
    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOMOptimizationManager, DOMVirtualScrollManager };
} else {
  // 浏览器环境，暴露到全局
  window.DOMOptimizationManager = DOMOptimizationManager;
  window.DOMVirtualScrollManager = DOMVirtualScrollManager;
  
  // 创建全局实例
  window.domOptimizationManager = new DOMOptimizationManager();
  
  console.log('🔧 DOM优化管理器已加载');
}
