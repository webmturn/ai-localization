// ==================== 滚动工具函数（共享） ====================
// 从 selection.js 和 render.js 中提取的重复滚动逻辑

/**
 * 智能滚动到舒适区域：尽量让目标元素居中可见，已可见时不滚动
 * 使用 getBoundingClientRect 替代 offsetTop 链，更准确
 *
 * @param {HTMLElement} el - 目标元素
 * @param {Object} [options]
 * @param {string} [options.behavior="smooth"] - 滚动行为 ("smooth"|"instant"|"auto")
 * @param {HTMLElement} [options.container] - 滚动容器（默认自动查找 translationScrollWrapper）
 * @param {number} [options.margin=0] - 额外边距（px），0 表示居中模式
 */
function scrollToComfortZone(el, options) {
  if (!el) return;

  var opts = options || {};
  var behavior = opts.behavior || "smooth";

  var container =
    opts.container ||
    DOMCache.get("translationScrollWrapper") ||
    el.closest(".translation-scroll-wrapper");

  if (!container) {
    el.scrollIntoView({ behavior: behavior, block: "center" });
    return;
  }

  var containerHeight = container.clientHeight || 0;
  if (!containerHeight) {
    el.scrollIntoView({ behavior: behavior, block: "center" });
    return;
  }

  // 使用 getBoundingClientRect 计算相对位置，比 offsetTop 链更可靠
  var containerRect = container.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();

  var itemHeight = elRect.height || 0;
  var current = container.scrollTop;
  var maxScroll = Math.max(0, container.scrollHeight - containerHeight);

  // 相对容器顶部的偏移
  var relativeTop = elRect.top - containerRect.top + current;

  var margin = opts.margin || 0;

  if (margin > 0) {
    // 边距模式：只在元素超出可见舒适区时滚动（用于搜索跳转等）
    var visibleTop = current + margin;
    var visibleBottom = current + containerHeight - margin;
    var itemTop = relativeTop;
    var itemBottom = relativeTop + itemHeight;

    if (itemTop >= visibleTop && itemBottom <= visibleBottom) return;

    var target = current;
    if (itemBottom > visibleBottom) {
      target = itemBottom - containerHeight + margin;
    } else if (itemTop < visibleTop) {
      target = itemTop - margin;
    }

    target = Math.max(0, Math.min(maxScroll, target));
    if (Math.abs(target - current) < 2) return;
    container.scrollTo({ top: target, behavior: behavior });
  } else {
    // 居中模式：元素完全可见时不滚动，否则居中显示
    var visTop = current;
    var visBottom = current + containerHeight;
    if (relativeTop >= visTop && relativeTop + itemHeight <= visBottom) return;

    var target = relativeTop - (containerHeight - itemHeight) / 2;
    target = Math.max(0, Math.min(maxScroll, target));
    if (Math.abs(target - current) < 2) return;
    container.scrollTo({ top: target, behavior: behavior });
  }
}

/**
 * 去抖滚动：快速连续调用时只执行最后一次，并切换为 instant 行为
 * 适用于键盘导航（↑/↓）快速按键时避免多次 smooth 动画排队
 */
var _scrollDebounceTimer = null;
var _scrollDebounceCount = 0;
var _scrollDebounceResetTimer = null;

function scrollToComfortZoneDebounced(el, options) {
  if (!el) return;

  _scrollDebounceCount++;

  // 清除之前的定时器
  if (_scrollDebounceTimer) {
    clearTimeout(_scrollDebounceTimer);
    _scrollDebounceTimer = null;
  }

  // 重置连续计数器
  if (_scrollDebounceResetTimer) {
    clearTimeout(_scrollDebounceResetTimer);
  }
  _scrollDebounceResetTimer = setTimeout(function () {
    _scrollDebounceCount = 0;
  }, 300);

  // 快速连续按键（第2次起）：立即执行 instant 滚动
  if (_scrollDebounceCount > 1) {
    var opts = Object.assign({}, options || {}, { behavior: "instant" });
    scrollToComfortZone(el, opts);
    return;
  }

  // 首次按键：使用小延迟，如果后续没有更多按键则 smooth 滚动
  _scrollDebounceTimer = setTimeout(function () {
    scrollToComfortZone(el, options);
    _scrollDebounceTimer = null;
  }, 16);
}
