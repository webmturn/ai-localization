// ==================== 动画滚动（全局共享） ====================
// 不依赖浏览器原生 behavior:"smooth"——在 prefers-reduced-motion: reduce
// 环境（如 Windows 关闭"显示动画效果"）下浏览器会忽略 smooth 直接瞬跳，
// 导致选中项滚动无动画。此处用 requestAnimationFrame 插值（easeOutCubic）
// 自绘动画，任何环境表现一致；新滚动请求到来时自动取消进行中的动画
// （快速键盘导航不排队、不抖动）。
var __scrollAnim = { raf: 0 };

function animateScrollTo(container, target) {
  if (!container) return;
  var max = Math.max(0, container.scrollHeight - container.clientHeight);
  var goal = Math.max(0, Math.min(max, Number(target) || 0));
  var start = container.scrollTop;
  var delta = goal - start;

  if (Math.abs(delta) < 2) {
    container.scrollTop = goal;
    return;
  }

  // 距离驱动时长（约 0.55ms/px），钳制 180–450ms：短距离轻盈、长距离可感知
  var duration = Math.max(180, Math.min(450, Math.abs(delta) * 0.55));
  var t0 = 0;

  if (__scrollAnim.raf && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(__scrollAnim.raf);
  }

  var step = function (ts) {
    if (!t0) t0 = ts;
    var p = Math.min(1, (ts - t0) / duration);
    var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic：先快后缓
    container.scrollTop = start + delta * eased;
    if (p < 1) {
      __scrollAnim.raf = requestAnimationFrame(step);
    } else {
      __scrollAnim.raf = 0;
    }
  };
  __scrollAnim.raf = requestAnimationFrame(step);
}

function updateSelectionStyles() {
  const options = arguments.length > 0 && arguments[0] ? arguments[0] : {};
  // 默认「不滚动」，只有显式传入 shouldScroll: true（例如键盘导航）时才滚动
  const shouldScroll = options.shouldScroll === true;
  const shouldFocusTextarea = options.shouldFocusTextarea !== false;

  // 最小揭示滚动：仅当条目越界时滚动到刚好可见（留约一行上下文），
  // 已完全可见则不动。避免"每次选中都跳到视口中央"的大幅跳动。
  // 偏移用 getBoundingClientRect 几何换算——offsetParent 链在
  // position:static 的滚动容器下会跳过容器本身，永远找不到父级（已实测），
  // 导致此前所有滚动都落入 scrollIntoView 兜底（瞬跳 + 居中）。
  const smartScrollToComfortZone = (el) => {
    if (!el) return;

    const container =
      DOMCache.get("translationScrollWrapper") ||
      el.closest(".translation-scroll-wrapper");
    // 降级路径（无容器/无高度）：scrollIntoView 兜底（罕见）
    if (!container || !container.clientHeight) {
      el.scrollIntoView({ block: "nearest" });
      return;
    }

    // 几何法计算 el 在容器内容坐标系中的位置（与定位层级无关）
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top + container.scrollTop;

    const containerHeight = container.clientHeight;
    const itemHeight = el.offsetHeight || 0;
    const current = container.scrollTop;
    const maxScroll = Math.max(0, container.scrollHeight - containerHeight);

    // 如果当前整行已经完全可见，就不滚动，避免抖动
    if (offset >= current && offset + itemHeight <= current + containerHeight) {
      return;
    }

    // 最小滚动量 + 一行上下文边距（约一个条目高度，封顶 120px）
    const margin = Math.min(120, itemHeight || 96);
    let target;
    if (offset + itemHeight > current + containerHeight) {
      // 条目在视口下方：向上滚到刚好露出，下方多留一行
      target = offset + itemHeight - containerHeight + margin;
    } else {
      // 条目在视口上方：向下滚到刚好露出，上方多留一行
      target = offset - margin;
    }

    // 夹紧到可滚动范围
    target = Math.max(0, Math.min(maxScroll, target));

    if (Math.abs(target - current) < 2) return;
    animateScrollTo(container, target);
  };

  const isMobile = isMobileViewport();
  const primaryIndex = AppState.translations.selected;
  const selectedSet = new Set(AppState.translations.multiSelected || []);
  if (primaryIndex !== -1) selectedSet.add(primaryIndex);

  let scrollTargetEl = null;

  if (!isMobile) {
    const sourceListEl = DOMCache.get("sourceList");
    const targetListEl = DOMCache.get("targetList");
    const sourceItems = sourceListEl
      ? DOMCache.queryAll(".responsive-translation-item", sourceListEl)
      : [];
    const targetItems = targetListEl
      ? DOMCache.queryAll(".responsive-translation-item", targetListEl)
      : [];

    const indicatorEnabled = AppState.ui.sourceSelectionIndicatorEnabled;
    const unselectedIsTransparent = indicatorEnabled &&
      AppState.ui.sourceSelectionIndicatorUnselectedStyle === "transparent";

    sourceItems.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      const active = selectedSet.has(idx);
      item.classList.toggle("selected", active);
      item.classList.toggle("bg-blue-50", active);
      item.classList.toggle("dark:bg-blue-900/20", active);

      if (indicatorEnabled) {
        item.classList.toggle("border-l-4", true);
        item.classList.toggle("border-l-blue-600", active);
        item.classList.toggle("dark:border-l-blue-500", active);
        item.classList.toggle("border-l-transparent", !active && unselectedIsTransparent);
        item.classList.toggle("dark:border-l-transparent", !active && unselectedIsTransparent);
        item.classList.toggle("border-l-gray-300", !active && !unselectedIsTransparent);
        item.classList.toggle("dark:border-l-gray-600", !active && !unselectedIsTransparent);
      } else {
        item.classList.remove(
          "border-l-4", "border-l-blue-600", "dark:border-l-blue-500",
          "border-l-gray-300", "dark:border-l-gray-600",
          "border-l-transparent", "dark:border-l-transparent"
        );
      }
      if (active && idx === primaryIndex && shouldScroll) {
        scrollTargetEl = item;
      }
    });

    targetItems.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      const active = selectedSet.has(idx);
      item.classList.toggle("selected", active);
      item.classList.toggle("bg-blue-50", active);
      item.classList.toggle("dark:bg-blue-900/20", active);

      const textarea = item.querySelector("textarea");
      if (textarea) {
        if (idx === primaryIndex) {
          textarea.classList.remove("border-transparent");
          textarea.classList.add("border-blue-500");
          if (shouldFocusTextarea) {
            // preventScroll：避免浏览器原生聚焦滚动与 animateScrollTo 动画打架
            textarea.focus({ preventScroll: true });
          }
        } else {
          textarea.classList.remove("border-blue-500");
          textarea.classList.add("border-transparent");
        }
      }
    });
  } else {
    const mobileListEl = DOMCache.get("mobileCombinedList");
    const mobileItems = mobileListEl
      ? DOMCache.queryAll(".responsive-translation-item", mobileListEl)
      : [];
    mobileItems.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      const active = selectedSet.has(idx);
      item.classList.toggle("selected", active);
      item.classList.toggle("bg-blue-50", active);
      item.classList.toggle("border-blue-300", active);
      item.classList.toggle("dark:bg-blue-900/20", active);
      item.classList.toggle("dark:border-blue-700", active);
      item.classList.toggle("bg-white", !active);
      item.classList.toggle("dark:bg-gray-800", !active);

      const textarea = item.querySelector("textarea");
      if (textarea) {
        if (idx === primaryIndex) {
          textarea.classList.remove("border-gray-200", "dark:border-gray-700");
          textarea.classList.add("border-blue-500");
          if (shouldFocusTextarea) {
            // preventScroll：避免浏览器原生聚焦滚动与 animateScrollTo 动画打架
            textarea.focus({ preventScroll: true });
          }
        } else {
          textarea.classList.remove("border-blue-500");
          textarea.classList.add("border-gray-200", "dark:border-gray-700");
        }
      }

      if (active && idx === primaryIndex && shouldScroll) {
        scrollTargetEl = item;
      }
    });
  }

  const scrollContainer = DOMCache.get("translationScrollWrapper");
  const prevScrollTop =
    scrollContainer && !shouldScroll ? scrollContainer.scrollTop : null;

  if (shouldScroll && scrollTargetEl) {
    // 选择变更不会改变内容高度，跳过 syncTranslationHeights 避免高度重置导致屏闪
    requestAnimationFrame(() => {
      if (!scrollTargetEl.isConnected) return;
      smartScrollToComfortZone(scrollTargetEl);
    });
    return;
  }

  if (scrollContainer && prevScrollTop !== null && !shouldScroll) {
    // 非滚动场景：保持滚动位置不变
    requestAnimationFrame(() => {
      if (!scrollContainer.isConnected) return;
      scrollContainer.scrollTop = prevScrollTop;
    });
    return;
  }
}

function clearMultiSelection() {
  TranslationViewStore.setMultiSelection([]);
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
}

function toggleMultiSelection(index) {
  const selected = AppState.translations.multiSelected || [];
  const next = new Set(selected);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  TranslationViewStore.setMultiSelection(Array.from(next));
  TranslationViewStore.setSelection(index);
  // 多选切换也不自动滚动，只更新样式
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
}

function selectCurrentPageTranslationItems() {
  const all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  if (all.length === 0) return;

  let filtered = Array.isArray(AppState?.translations?.filtered)
    ? AppState.translations.filtered
    : [];
  if (filtered.length === 0) {
    filtered =
      typeof TranslationViewStore !== "undefined"
        ? TranslationViewStore.getViewItems()
        : all;
  }
  if (filtered.length === 0) return;

  // 虚拟滚动模式：选择当前可见范围内的项
  var vsm = typeof VirtualScrollManager !== 'undefined' ? VirtualScrollManager.getInstance() : null;
  var startIndex, endIndex;

  if (vsm && vsm.isEnabled()) {
    var vRange = vsm.getVisibleRange();
    startIndex = vRange ? vRange.start : 0;
    endIndex = vRange ? vRange.end : 0;
  } else {
    const itemsPerPage = Number.isFinite(AppState?.translations?.itemsPerPage)
      ? AppState.translations.itemsPerPage
      : 20;
    const currentPage = Number.isFinite(AppState?.translations?.currentPage)
      ? AppState.translations.currentPage
      : 1;
    const safePage = Math.max(1, currentPage);
    startIndex = (safePage - 1) * itemsPerPage;
    endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
  }

  const itemsToShow = filtered.slice(startIndex, endIndex);
  if (itemsToShow.length === 0) return;

  const idToIndex = AppState?.translations?.idToIndex;
  const indices = [];

  for (const item of itemsToShow) {
    if (!item) continue;

    let idx = -1;
    const id = item.id;
    if (idToIndex && id !== undefined && id !== null) {
      const mapped = idToIndex[String(id)];
      if (Number.isFinite(mapped)) idx = mapped;
    }
    if (idx === -1) {
      idx = all.indexOf(item);
    }
    if (idx === -1 && id !== undefined && id !== null) {
      idx = all.findIndex((it) => it && String(it.id) === String(id));
    }

    if (Number.isFinite(idx) && idx >= 0) {
      indices.push(idx);
    }
  }

  const uniqueSorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  if (uniqueSorted.length === 0) return;

  TranslationViewStore.setMultiSelection(uniqueSorted);
  TranslationViewStore.setSelection(uniqueSorted[0]);
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
}

// 选择翻译项（优化版 - 只更新样式，不重渲染）
function selectTranslationItem(index) {
  const options = arguments.length > 1 && arguments[1] ? arguments[1] : {};
  const shouldScroll =
    options.shouldScroll === true && AppState.ui?.autoScrollEnabled !== false;
  const shouldFocusTextarea = options.shouldFocusTextarea !== false;

  // 避免重复选择同一个翻译项，防止无限循环
  if (
    AppState.translations.selected === index &&
    (AppState.translations.multiSelected || []).length === 0
  ) {
    return;
  }

  TranslationViewStore.setMultiSelection([]);
  TranslationViewStore.setSelection(index);
  updateSelectionStyles({ shouldScroll, shouldFocusTextarea });
}

// 更新翻译项
function updateTranslationItem(index, targetText) {
  if (AppState.project && AppState.project.translationItems[index]) {
    const item = AppState.project.translationItems[index];
    const oldStatus = item.status;
    const oldTargetText = item.targetText || "";
    item.targetText = targetText;

    // 只有当译文不为空时才设置为已编辑，避免清空时也标记为已编辑
    if (targetText && targetText.trim()) {
      item.status = "edited";
    } else {
      // 如果译文被清空，恢复为待翻译状态
      item.status = "pending";
    }

    // 经 ProjectStore 统一更新时间戳（ISO 字符串，与其他写入点一致）
    ProjectStore.touchProject();

    if (oldTargetText !== targetText) {
      autoSaveManager.markDirty();
      if (typeof invalidateSearchCache === "function") invalidateSearchCache();
    }

    // 视图条目引用与 project.translationItems 由 ProjectStore 维持同步，无需重同步

    // 更新计数器
    updateCounters();

    // 只有当状态改变时才更新状态标签，避免每次输入都重渲染
    if (oldStatus !== item.status) {
      updateStatusBadge(index, item.status);
    }
  }
}

// 更新单个项的状态标签（不重渲染整个列表）
function updateStatusBadge(index, newStatus) {
  const sourceList = DOMCache.get("sourceList");
  const mobileCombinedList = DOMCache.get("mobileCombinedList");
  if (!sourceList && !mobileCombinedList) return;

  const statusText = getStatusText(newStatus);
  const statusClassName = `text-xs font-semibold ${getStatusClass(newStatus)} px-2 py-0.5 rounded-full whitespace-nowrap`;

  // 使用 batchUpdate 合并状态标签的 DOM 写入
  DOMCache.batchUpdate("status-badge", function () {
    if (sourceList) {
      const item = sourceList.querySelector(`.responsive-translation-item[data-index="${index}"]`);
      if (item) {
        const badge = item.querySelector("span.text-xs");
        if (badge) {
          badge.textContent = statusText;
          badge.className = statusClassName;
        }
      }
    }

    if (mobileCombinedList) {
      const item = mobileCombinedList.querySelector(`.responsive-translation-item[data-index="${index}"]`);
      if (item) {
        const badge = item.querySelector("span.text-xs");
        if (badge) {
          badge.textContent = statusText;
          badge.className = statusClassName;
        }
      }
    }
  });
}

// 更新计数器
function updateCounters() {
  if (!AppState.project) return;

  const items = AppState.project.translationItems || [];
  const total = items.length;
  const translated = items.filter(
    (item) =>
      item.status === "translated" ||
      item.status === "edited" ||
      item.status === "approved"
  ).length;

  // 使用 batchUpdate 合并计数器 DOM 写入（每次编辑都会触发）
  DOMCache.batchUpdate("counters", function () {
    const sourceCountEl = DOMCache.get("sourceCount");
    const targetCountEl = DOMCache.get("targetCount");
    if (sourceCountEl) sourceCountEl.textContent = `${total} 项`;
    if (targetCountEl) targetCountEl.textContent = `${translated}/${total} 项`;
  });
}
