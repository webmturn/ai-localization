// ==================== DOM 缓存管理 ====================
/**
 * 统一的DOM缓存系统（单例模式）
 * 优势：
 * 1. 减少重复DOM查询，提升性能
 * 2. 提供 clear/remove 方法，防止内存泄漏
 * 3. 自动管理缓存生命周期
 */
const DOMCache = {
  cache: new Map(),

  get(id) {
    if (!this.cache.has(id)) {
      const element = document.getElementById(id);
      if (element) {
        this.cache.set(id, element);
      }
    }
    return this.cache.get(id);
  },

  clear() {
    this.cache.clear();
  },

  remove(id) {
    this.cache.delete(id);
  },
};
