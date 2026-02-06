// ==================== DOM 缓存管理 ====================
/**
 * 统一的DOM缓存系统（单例模式）
 * 优势：
 * 1. 减少重复DOM查询，提升性能
 * 2. 提供 clear/remove 方法，防止内存泄漏
 * 3. 自动管理缓存生命周期
 * @namespace DOMCache
 */
const DOMCache = {
  /** @type {Map<string, HTMLElement>} */
  cache: new Map(),

  /**
   * 获取缓存的DOM元素，如不存在则查询并缓存
   * @param {string} id - 元素ID
   * @returns {HTMLElement|undefined} DOM元素
   */
  get(id) {
    if (!this.cache.has(id)) {
      const element = document.getElementById(id);
      if (element) {
        this.cache.set(id, element);
      }
    }
    return this.cache.get(id);
  },

  /**
   * 清除所有缓存
   * @returns {void}
   */
  clear() {
    this.cache.clear();
  },

  /**
   * 移除指定ID的缓存
   * @param {string} id - 元素ID
   * @returns {boolean} 是否成功删除
   */
  remove(id) {
    return this.cache.delete(id);
  },
};
