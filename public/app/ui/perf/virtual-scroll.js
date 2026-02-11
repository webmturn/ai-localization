// ==================== 虚拟滚动管理器 ====================
// 当翻译项数量超过阈值时，自动启用虚拟滚动替代分页，
// 只渲染可视区域内的行 + 缓冲区，大幅减少 DOM 节点数。

var VirtualScrollManager = (function () {
  var ESTIMATED_ROW_HEIGHT = 90;
  var BUFFER_ROWS = 5;
  var AUTO_ENABLE_THRESHOLD = Infinity; // 不自动启用，保留分页模式
  var instance = null;

  function VSM() {
    this.enabled = false;
    this._container = null;
    this._scrollHandler = null;
    this._rafPending = false;
    this._lastStart = -1;
    this._lastEnd = -1;
    this._heightCache = Object.create(null);
    this._totalItemCount = 0;
    this._renderInProgress = false;
  }

  // ── 公共 API ──

  VSM.prototype.isEnabled = function () {
    return this.enabled;
  };

  /**
   * 根据当前数据量自动决定是否启用虚拟滚动
   */
  VSM.prototype.autoToggle = function () {
    var count = this._getFilteredCount();
    if (count >= AUTO_ENABLE_THRESHOLD && !this.enabled) {
      this.enable();
    } else if (count < AUTO_ENABLE_THRESHOLD && this.enabled) {
      this.disable();
    }
    // 数据变化时清除缓存
    if (count !== this._totalItemCount) {
      this._totalItemCount = count;
      this._heightCache = Object.create(null);
      this._lastStart = -1;
      this._lastEnd = -1;
    }
  };

  VSM.prototype.enable = function () {
    if (this.enabled) return;
    this.enabled = true;
    this._container = DOMCache.get("translationScrollWrapper");
    if (!this._container) return;

    var self = this;
    this._scrollHandler = function () {
      if (self._rafPending || self._renderInProgress) return;
      self._rafPending = true;
      requestAnimationFrame(function () {
        self._rafPending = false;
        self._onScroll();
      });
    };

    this._container.addEventListener("scroll", this._scrollHandler, {
      passive: true,
    });

    // 隐藏分页
    var pagination = DOMCache.get("paginationContainer");
    if (pagination) pagination.style.display = "none";

    this._onScroll();
  };

  VSM.prototype.disable = function () {
    if (!this.enabled) return;
    this.enabled = false;

    if (this._container && this._scrollHandler) {
      this._container.removeEventListener("scroll", this._scrollHandler);
    }
    this._scrollHandler = null;

    // 恢复分页
    var pagination = DOMCache.get("paginationContainer");
    if (pagination) pagination.style.display = "";

    // 清除列表上的虚拟滚动 padding
    this._clearSpacers();

    this._lastStart = -1;
    this._lastEnd = -1;
    this._heightCache = Object.create(null);
    this._totalItemCount = 0;
  };

  /**
   * 获取当前可见范围 { start, end }
   * 供 updateTranslationLists 使用
   */
  VSM.prototype.getVisibleRange = function () {
    if (!this.enabled || !this._container) return null;
    return this._calcRange();
  };

  /**
   * 获取 top / bottom spacer 高度
   */
  VSM.prototype.getSpacers = function (start, end) {
    var top = this._getOffsetForIndex(start);
    var bottom = this._getTotalHeight() - this._getOffsetForIndex(end);
    return { top: Math.max(0, top), bottom: Math.max(0, bottom) };
  };

  /**
   * 渲染后调用：测量实际行高并缓存
   */
  VSM.prototype.measureRenderedHeights = function () {
    if (!this.enabled) return;

    var isMobile =
      typeof isMobileViewport === "function" && isMobileViewport();
    var list = isMobile
      ? DOMCache.get("mobileCombinedList")
      : DOMCache.get("sourceList");
    if (!list) return;

    var items = list.querySelectorAll(".responsive-translation-item");
    var start = this._lastStart;
    if (start < 0) start = 0;

    for (var i = 0; i < items.length; i++) {
      var h = items[i].offsetHeight;
      if (h > 0) {
        this._heightCache[start + i] = h;
      }
    }
  };

  /**
   * 滚动到指定的过滤列表索引位置
   */
  VSM.prototype.scrollToFilteredIndex = function (filteredIndex) {
    if (!this.enabled || !this._container) return;

    var offset = this._getOffsetForIndex(filteredIndex);
    var viewportHeight = this._container.clientHeight;
    // 居中显示
    var target = Math.max(0, offset - viewportHeight / 3);

    this._container.scrollTo({ top: target, behavior: "smooth" });
  };

  /**
   * 清除高度缓存（数据变更时）
   */
  VSM.prototype.invalidate = function () {
    this._heightCache = Object.create(null);
    this._lastStart = -1;
    this._lastEnd = -1;
    this._totalItemCount = 0;
  };

  // ── 内部方法 ──

  VSM.prototype._getFilteredCount = function () {
    var filtered = AppState && AppState.translations && AppState.translations.filtered;
    return Array.isArray(filtered) ? filtered.length : 0;
  };

  VSM.prototype._getRowHeight = function (index) {
    return this._heightCache[index] || ESTIMATED_ROW_HEIGHT;
  };

  VSM.prototype._getTotalHeight = function () {
    var count = this._getFilteredCount();
    var total = 0;
    for (var i = 0; i < count; i++) {
      total += this._getRowHeight(i);
    }
    return total;
  };

  VSM.prototype._getOffsetForIndex = function (index) {
    var offset = 0;
    var count = this._getFilteredCount();
    var end = Math.min(index, count);
    for (var i = 0; i < end; i++) {
      offset += this._getRowHeight(i);
    }
    return offset;
  };

  VSM.prototype._calcRange = function () {
    var scrollTop = this._container.scrollTop;
    var viewportHeight = this._container.clientHeight;
    var count = this._getFilteredCount();

    if (count === 0) return { start: 0, end: 0 };

    // 查找起始索引
    var offset = 0;
    var start = 0;
    for (var i = 0; i < count; i++) {
      var h = this._getRowHeight(i);
      if (offset + h > scrollTop) {
        start = i;
        break;
      }
      offset += h;
      if (i === count - 1) start = count;
    }

    // 查找结束索引
    var end = start;
    var visible = 0;
    for (var j = start; j < count; j++) {
      visible += this._getRowHeight(j);
      end = j + 1;
      if (visible >= viewportHeight) break;
    }

    // 加缓冲
    start = Math.max(0, start - BUFFER_ROWS);
    end = Math.min(count, end + BUFFER_ROWS);

    return { start: start, end: end };
  };

  VSM.prototype._onScroll = function () {
    var range = this._calcRange();

    // 已渲染范围仍覆盖可见区域则跳过
    if (
      range.start >= this._lastStart &&
      range.end <= this._lastEnd &&
      this._lastStart >= 0
    ) {
      return;
    }

    this._lastStart = range.start;
    this._lastEnd = range.end;

    // 触发列表重渲染
    this._renderInProgress = true;
    try {
      if (typeof updateTranslationLists === "function") {
        updateTranslationLists();
      }
    } finally {
      this._renderInProgress = false;
    }
  };

  VSM.prototype._applySpacers = function (topPx, bottomPx) {
    var isMobile =
      typeof isMobileViewport === "function" && isMobileViewport();

    if (isMobile) {
      var mobile = DOMCache.get("mobileCombinedList");
      if (mobile) {
        mobile.style.paddingTop = topPx + "px";
        mobile.style.paddingBottom = bottomPx + "px";
      }
    } else {
      var source = DOMCache.get("sourceList");
      var target = DOMCache.get("targetList");
      if (source) {
        source.style.paddingTop = topPx + "px";
        source.style.paddingBottom = bottomPx + "px";
      }
      if (target) {
        target.style.paddingTop = topPx + "px";
        target.style.paddingBottom = bottomPx + "px";
      }
    }
  };

  VSM.prototype._clearSpacers = function () {
    this._applySpacers(0, 0);
  };

  // ── 单例 ──

  VSM.getInstance = function () {
    if (!instance) {
      instance = new VSM();
    }
    return instance;
  };

  return VSM;
})();
