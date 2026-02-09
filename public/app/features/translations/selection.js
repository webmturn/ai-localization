function updateSelectionStyles() {
  const options = arguments.length > 0 && arguments[0] ? arguments[0] : {};
  // 默认「不滚动」，只有显式传入 shouldScroll: true（例如键盘导航）时才滚动
  const shouldScroll = options.shouldScroll === true;
  const shouldFocusTextarea = options.shouldFocusTextarea !== false;

  // 更简单、稳定的滚动算法：尽量居中 + 夹紧到顶部/底部，保证整行可见
  const smartScrollToComfortZone = (el, behavior = "smooth") => {
    if (!el) return;

    const container =
      DOMCache.get("translationScrollWrapper") ||
      el.closest(".translation-scroll-wrapper");
    if (!container) {
      el.scrollIntoView({ behavior, block: "center" });
      return;
    }

    const containerHeight = container.clientHeight || 0;
    if (!containerHeight) {
      el.scrollIntoView({ behavior, block: "center" });
      return;
    }

    // 计算 el 相对容器顶部的偏移（使用 offsetTop 链，避免多重 transform 带来的误差）
    let offset = 0;
    let node = el;
    let foundContainer = false;
    while (node && node !== container) {
      offset += node.offsetTop || 0;
      node = node.offsetParent;
      if (node === container) foundContainer = true;
    }
    if (!foundContainer) {
      el.scrollIntoView({ behavior, block: "center" });
      return;
    }

    const itemHeight = el.offsetHeight || 0;
    const current = container.scrollTop;
    const maxScroll = Math.max(0, container.scrollHeight - containerHeight);

    // 如果当前整行已经完全可见，就不滚动，避免抖动
    const visibleTop = current;
    const visibleBottom = current + containerHeight;
    if (offset >= visibleTop && offset + itemHeight <= visibleBottom) return;

    // 理想位置：尽量让条目靠中间
    let target = offset - (containerHeight - itemHeight) / 2;

    // 夹紧到可滚动范围，保证末尾几行不会被压在最下面
    target = Math.max(0, Math.min(maxScroll, target));

    if (Math.abs(target - current) < 2) return;
    container.scrollTo({ top: target, behavior });
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
      ? sourceListEl.querySelectorAll(".responsive-translation-item")
      : [];
    const targetItems = targetListEl
      ? targetListEl.querySelectorAll(".responsive-translation-item")
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
            textarea.focus();
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
      ? mobileListEl.querySelectorAll(".responsive-translation-item")
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
            textarea.focus();
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
      smartScrollToComfortZone(scrollTargetEl, "smooth");
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
  AppState.translations.multiSelected = [];
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
  AppState.translations.multiSelected = Array.from(next);
  AppState.translations.selected = index;
  // 多选切换也不自动滚动，只更新样式
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
}

function selectCurrentPageTranslationItems() {
  const all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  if (all.length === 0) return;

  const itemsPerPage = Number.isFinite(AppState?.translations?.itemsPerPage)
    ? AppState.translations.itemsPerPage
    : 20;
  const currentPage = Number.isFinite(AppState?.translations?.currentPage)
    ? AppState.translations.currentPage
    : 1;

  let filtered = Array.isArray(AppState?.translations?.filtered)
    ? AppState.translations.filtered
    : [];
  if (filtered.length === 0) {
    filtered = Array.isArray(AppState?.translations?.items)
      ? AppState.translations.items
      : all;
  }
  if (filtered.length === 0) return;

  const safePage = Math.max(1, currentPage);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
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

  AppState.translations.multiSelected = uniqueSorted;
  AppState.translations.selected = uniqueSorted[0];
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

  AppState.translations.multiSelected = [];
  AppState.translations.selected = index;
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

    AppState.project.updatedAt = new Date();

    if (oldTargetText !== targetText) {
      autoSaveManager.markDirty();
    }

    // 同步到 AppState.translations.items
    AppState.translations.items = AppState.project.translationItems;

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

  const sourceCountEl = DOMCache.get("sourceCount");
  const targetCountEl = DOMCache.get("targetCount");
  if (sourceCountEl) sourceCountEl.textContent = `${total} 项`;
  if (targetCountEl) targetCountEl.textContent = `${translated}/${total} 项`;
}
