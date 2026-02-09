// ==================== 翻译列表更新功能（优化版） ====================

function __devLog() {
  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      var logger = (typeof loggers !== "undefined" && loggers.app) || console;
      (logger.debug || logger.log).apply(logger, arguments);
    } catch (_) {
      // dev-only console.log wrapper - safe to ignore
    }
  }
}

function __waitForTranslationsRendered(minVersion, timeoutMs = 800) {
  const current = AppState?.translations?.renderVersion || 0;
  if (current >= minVersion) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;      resolve();
    };

    const timer = setTimeout(() => {
      try {
        document.removeEventListener("translations:rendered", onRendered);
      } catch (_) {
        (loggers.app || console).debug("render removeEventListener:", _);
      }
      finish();
    }, timeoutMs);

    const onRendered = (e) => {
      const v = e?.detail?.version;
      if (typeof v === "number" && v >= minVersion) {
        clearTimeout(timer);
        document.removeEventListener("translations:rendered", onRendered);
        finish();
      }
    };

    document.addEventListener("translations:rendered", onRendered);
  });
}

// 获取状态样式类
var __statusClassMap = {
  pending: "text-gray-500 dark:text-gray-400",
  translated: "text-green-600 dark:text-emerald-400",
  edited: "text-blue-600 dark:text-blue-400",
  approved: "text-purple-600 dark:text-purple-400",
};
function getStatusClass(status) {
  return __statusClassMap[status] || "text-gray-500 dark:text-gray-400";
}

// 创建翻译项 DOM 元素（使用事件委托，不再单独绑定）
function createTranslationItemElement(
  item,
  originalIndex,
  isPrimarySelected,
  isSource
) {
  const div = document.createElement("div");
  const isMultiSelected = (AppState.translations.multiSelected || []).includes(
    originalIndex
  );
  const isSelected = isPrimarySelected || isMultiSelected;

  if (isSource) {
    if (AppState.ui.sourceSelectionIndicatorEnabled) {
      const unselectedIsTransparent =
        AppState.ui.sourceSelectionIndicatorUnselectedStyle === "transparent";
      div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 border-l-4 ${
        isSelected
          ? "border-l-blue-600 dark:border-l-blue-500 selected bg-blue-50 dark:bg-blue-900/20"
          : unselectedIsTransparent
          ? "border-l-transparent dark:border-l-transparent"
          : "border-l-gray-300 dark:border-l-gray-600"
      } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors`;
    } else {
      div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
        isSelected ? "selected bg-blue-50 dark:bg-blue-900/20" : ""
      }`;
    }
  } else {
    div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
      isSelected ? "selected bg-blue-50 dark:bg-blue-900/20" : ""
    }`;
  }
  div.dataset.index = originalIndex;
  if (item && item.id !== undefined && item.id !== null) {
    div.dataset.id = String(item.id);
  }

  const statusClass = getStatusClass(item.status);
  const sourceText = item.sourceText || "";
  const targetText = item.targetText || "";
  const context = item.context || "";

  // 获取搜索关键词（从 AppState）
  const searchQuery = AppState.translations.searchQuery;

  if (isSource) {
    // 源文列表
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-stretch w-full h-full";

    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";

    const contentEl = document.createElement("div");
    contentEl.className =
      "item-content border border-transparent rounded flex flex-col";

    const p = document.createElement("p");
    p.className =
      "text-sm md:text-base font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100";
    const highlighted = highlightText(sourceText, searchQuery);
    p.appendChild(highlighted);
    contentEl.appendChild(p);

    if (context) {
      const p2 = document.createElement("p");
      p2.className =
        "text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 break-words";
      p2.textContent = context;
      contentEl.appendChild(p2);
    }

    if (item.metadata?.resourceId) {
      const p3 = document.createElement("p");
      p3.className =
        "text-xs text-gray-400 dark:text-gray-500 mt-1 break-words";
      p3.textContent = `ID: ${item.metadata.resourceId}`;
      contentEl.appendChild(p3);
    }

    left.appendChild(contentEl);

    const right = document.createElement("div");
    right.className = "flex flex-col items-end ml-2";
    const status = document.createElement("span");
    status.className = `text-xs font-semibold ${statusClass} px-2 py-0.5 rounded-full whitespace-nowrap`;
    status.textContent = getStatusText(item.status);
    right.appendChild(status);

    wrapper.appendChild(left);
    wrapper.appendChild(right);
    div.appendChild(wrapper);
  } else {
    // 译文列表
    const textarea = document.createElement("textarea");
    textarea.className = `w-full h-full border ${
      isPrimarySelected ? "border-blue-500" : "border-transparent"
    } rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none break-words bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`;
    textarea.setAttribute("aria-label", "译文编辑");
    textarea.title = "译文编辑";
    textarea.dataset.index = originalIndex;
    if (item && item.id !== undefined && item.id !== null) {
      textarea.dataset.id = String(item.id);
    }
    textarea.style.fontFamily = "inherit";
    textarea.value = targetText;

    // 不再单独绑定事件，使用事件委托

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-stretch w-full h-full";
    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";
    const contentEl = document.createElement("div");
    contentEl.className = "item-content h-full";
    contentEl.appendChild(textarea);
    left.appendChild(contentEl);
    wrapper.appendChild(left);
    div.appendChild(wrapper);
  }

  // 不再单独绑定点击事件，使用事件委托

  return div;
}

// 创建移动端合并翻译项（原文 + 可编辑译文同一条）
function createMobileCombinedTranslationItemElement(
  item,
  originalIndex,
  isPrimarySelected
) {
  const div = document.createElement("div");
  const isMultiSelected = (AppState.translations.multiSelected || []).includes(
    originalIndex
  );
  const isSelected = isPrimarySelected || isMultiSelected;
  div.className = `responsive-translation-item border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors px-2.5 py-2 ${
    isSelected
      ? "selected bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
  }`;
  div.dataset.index = originalIndex;
  if (item && item.id !== undefined && item.id !== null) {
    div.dataset.id = String(item.id);
  }

  const statusClass = getStatusClass(item.status);
  const sourceText = item.sourceText || "";
  const targetText = item.targetText || "";
  const context = item.context || "";
  const searchQuery = AppState.translations.searchQuery;

  const hasExtraInfo = !!(context || item.metadata?.resourceId);

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-1.5";

  const left = document.createElement("div");
  left.className = "min-w-0 flex-1";

  const p = document.createElement("p");
  p.className =
    "text-[13px] leading-snug font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100";
  p.appendChild(highlightText(sourceText, searchQuery));
  left.appendChild(p);

  let extra = null;
  if (hasExtraInfo) {
    extra = document.createElement("div");
    extra.className = "mt-1 hidden";
    extra.dataset.role = "extra";

    if (context) {
      const p2 = document.createElement("p");
      p2.className = "text-xs text-gray-500 dark:text-gray-400 break-words";
      p2.textContent = context;
      extra.appendChild(p2);
    }

    if (item.metadata?.resourceId) {
      const p3 = document.createElement("p");
      p3.className =
        "text-xs text-gray-400 dark:text-gray-500 mt-1 break-words";
      p3.textContent = `ID: ${item.metadata.resourceId}`;
      extra.appendChild(p3);
    }

    left.appendChild(extra);
  }

  const right = document.createElement("div");
  right.className = "flex flex-col items-end gap-0.5 flex-shrink-0";
  const status = document.createElement("span");
  status.className = `text-[10px] font-semibold ${statusClass} px-1.5 py-px rounded-full whitespace-nowrap`;
  status.textContent = getStatusText(item.status);
  right.appendChild(status);

  if (hasExtraInfo) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-full text-right";
    btn.dataset.action = "toggle-extra";
    btn.dataset.state = "collapsed";
    btn.textContent = "更多";
    right.appendChild(btn);
  }

  top.appendChild(left);
  top.appendChild(right);

  const bottom = document.createElement("div");
  bottom.className = "mt-1.5";
  const textarea = document.createElement("textarea");
  textarea.className = `w-full border ${
    isPrimarySelected
      ? "border-blue-500"
      : "border-gray-200 dark:border-gray-700"
  } rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none break-words bg-white dark:bg-gray-900 px-2 py-1.5 text-[13px] leading-snug text-gray-900 dark:text-gray-100 placeholder:text-gray-400`;
  textarea.setAttribute("aria-label", "译文编辑");
  textarea.title = "译文编辑";
  textarea.placeholder = "输入译文...";
  textarea.dataset.index = String(originalIndex);
  if (item && item.id !== undefined && item.id !== null) {
    textarea.dataset.id = String(item.id);
  }
  textarea.rows = 2;
  textarea.value = targetText;
  bottom.appendChild(textarea);

  div.appendChild(top);
  div.appendChild(bottom);

  return div;
}

// 创建空状态元素
function createEmptyStateElement(message) {
  const div = document.createElement("div");
  div.className =
    "text-gray-500 dark:text-gray-400 text-sm italic p-4 text-center";
  div.textContent = message;
  return div;
}

// 更新翻译列表（优化版 - 使用DOM缓存）
function updateTranslationLists() {
  __devLog("更新翻译列表开始");

  try {
    // 直接使用 DOMCache 获取元素
    const sourceList = DOMCache.get("sourceList");
    const targetList = DOMCache.get("targetList");
    const mobileCombinedList = DOMCache.get("mobileCombinedList");
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      if (!mobileCombinedList) {
        (loggers.app || console).error("移动端合并列表元素未找到");
        return;
      }
    } else {
      if (!sourceList || !targetList) {
        (loggers.app || console).error("源列表或目标列表元素未找到");
        return;
      }
    }

    // 检查数据
    if (!AppState.project?.translationItems?.length) {
      __devLog("没有翻译项数据");
      if (sourceList) {
        sourceList.replaceChildren(createEmptyStateElement("暂无翻译项"));
      }
      if (targetList) {
        targetList.replaceChildren(createEmptyStateElement("暂无翻译项"));
      }
      if (mobileCombinedList) {
        mobileCombinedList.replaceChildren(
          createEmptyStateElement("暂无翻译项")
        );
      }
      updatePaginationUI(0, 0, 0, 1, 1);
      return;
    }

    // 构建 id -> index 映射（仅在数据源变化时重建，避免每次渲染都 O(n)）
    if (AppState.translations._idToIndexSource !== AppState.project.translationItems) {
      const idToIndex = Object.create(null);
      for (let i = 0; i < AppState.project.translationItems.length; i++) {
        const item = AppState.project.translationItems[i];
        if (!item) continue;
        const id = item.id;
        if (id === undefined || id === null) continue;
        idToIndex[String(id)] = i;
      }
      AppState.translations.idToIndex = idToIndex;
      AppState.translations._idToIndexSource = AppState.project.translationItems;
    }

    // 计算分页（使用 AppState）
    const itemsPerPage = AppState.translations.itemsPerPage;
    const currentPage = AppState.translations.currentPage;
    let filteredItems = AppState.translations.filtered;
    const translationItems = AppState.translations.items;

    // 使用 filteredItems
    if (filteredItems.length === 0 && translationItems.length > 0) {
      filteredItems = [...translationItems];
      AppState.translations.filtered = filteredItems;
    }

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
    const itemsToShow = filteredItems.slice(startIndex, endIndex);

    __devLog(
      "当前页:",
      currentPage,
      "总页数:",
      totalPages,
      "显示范围:",
      startIndex + 1,
      "-",
      endIndex
    );

    // 仅为当前可见视图创建 DOM，跳过不可见视图（减少 ~50% DOM 操作）
    const sourceFragment = isMobile ? null : document.createDocumentFragment();
    const targetFragment = isMobile ? null : document.createDocumentFragment();
    const mobileFragment = isMobile ? document.createDocumentFragment() : null;

    if (itemsToShow.length === 0) {
      const emptyEl = createEmptyStateElement("没有找到匹配的翻译项");
      if (isMobile) {
        mobileFragment.appendChild(emptyEl);
      } else {
        sourceFragment.appendChild(emptyEl);
        targetFragment.appendChild(
          createEmptyStateElement("没有找到匹配的翻译项")
        );
      }
    } else {
      const idToIndex = AppState.translations.idToIndex;
      const allItems = AppState.project.translationItems;
      itemsToShow.forEach((item) => {
        if (!item) return;

        const originalIndex =
          item.id !== undefined && item.id !== null
            ? idToIndex[String(item.id)] ?? allItems.indexOf(item)
            : allItems.indexOf(item);
        const isPrimarySelected =
          originalIndex === AppState.translations.selected;

        if (isMobile) {
          mobileFragment.appendChild(
            createMobileCombinedTranslationItemElement(
              item,
              originalIndex,
              isPrimarySelected
            )
          );
        } else {
          sourceFragment.appendChild(
            createTranslationItemElement(
              item,
              originalIndex,
              isPrimarySelected,
              true
            )
          );
          targetFragment.appendChild(
            createTranslationItemElement(
              item,
              originalIndex,
              isPrimarySelected,
              false
            )
          );
        }
      });
    }

    // 一次性更新 DOM（仅更新可见视图）
    __devLog("DOM更新开始");
    if (!isMobile && sourceList) {
      sourceList.replaceChildren(sourceFragment);
    }
    if (!isMobile && targetList) {
      targetList.replaceChildren(targetFragment);
    }
    if (isMobile && mobileCombinedList) {
      mobileCombinedList.replaceChildren(mobileFragment);
    }

    if (
      isMobile &&
      mobileCombinedList &&
      AppState.translations.selected !== -1
    ) {
      const selectedEl = mobileCombinedList.querySelector(
        `.responsive-translation-item[data-index="${AppState.translations.selected}"]`
      );
      if (selectedEl) {
        const container =
          DOMCache.get("translationScrollWrapper") ||
          selectedEl.closest(".translation-scroll-wrapper");
        if (!container) {
          selectedEl.scrollIntoView({ block: "nearest" });
        } else {
          const containerHeight = container.clientHeight || 0;
          if (!containerHeight) {
            selectedEl.scrollIntoView({ block: "nearest" });
          } else {
            let offsetTop = 0;
            let node = selectedEl;
            while (node && node !== container) {
              offsetTop += node.offsetTop || 0;
              node = node.offsetParent;
            }
            const itemHeight = selectedEl.offsetHeight || 0;
            const current = container.scrollTop;
            const maxScroll = Math.max(
              0,
              container.scrollHeight - containerHeight
            );
            const margin = Math.min(80, containerHeight * 0.15);
            const itemTop = offsetTop;
            const itemBottom = offsetTop + itemHeight;
            const visibleTop = current + margin;
            const visibleBottom = current + containerHeight - margin;
            let target = current;
            if (itemBottom > visibleBottom) {
              target = itemBottom - containerHeight + margin;
            } else if (itemTop < visibleTop) {
              target = itemTop - margin;
            } else {
              return;
            }
            target = Math.max(0, Math.min(maxScroll, target));
            if (Math.abs(target - current) >= 2) {
              container.scrollTo({ top: target, behavior: "smooth" });
            }
          }
        }
      }
    }

    // 更新分页
    updatePaginationUI(
      filteredItems.length,
      startIndex + 1,
      endIndex,
      currentPage,
      totalPages
    );

    // 翻页/过滤后立即同步高度，避免延迟导致布局抖动
    syncTranslationHeights();

    AppState.translations.renderVersion =
      (AppState.translations.renderVersion || 0) + 1;
    try {
      document.dispatchEvent(
        new CustomEvent("translations:rendered", {
          detail: {
            version: AppState.translations.renderVersion,
            page: currentPage,
            startIndex,
            endIndex,
          },
        })
      );
    } catch (e) {
      // ignore
    }

    __devLog("翻译列表更新完成");
  } catch (error) {
    (loggers.app || console).error("更新翻译列表时出错:", error);
    const sourceList = DOMCache.get("sourceList");
    const targetList = DOMCache.get("targetList");
    const errorText = `错误: ${
      error && error.message ? error.message : String(error)
    }`;
    if (sourceList) {
      const el = document.createElement("div");
      el.className = "text-red-500 dark:text-red-300 p-4";
      el.textContent = errorText;
      sourceList.replaceChildren(el);
    }
    if (targetList) {
      const el = document.createElement("div");
      el.className = "text-red-500 dark:text-red-300 p-4";
      el.textContent = errorText;
      targetList.replaceChildren(el);
    }
    updatePaginationUI(0, 0, 0, 1, 1);
  }
}

// 高亮文本中的搜索关键词
function highlightText(text, searchQuery) {
  const fragment = document.createDocumentFragment();
  const rawText = text === null || text === undefined ? "" : String(text);
  const rawQuery =
    searchQuery === null || searchQuery === undefined
      ? ""
      : String(searchQuery);
  const query = rawQuery.trim();

  if (!query) {
    fragment.appendChild(document.createTextNode(rawText));
    return fragment;
  }

  const haystack = rawText;
  const needle = query;
  const haystackLower = haystack.toLowerCase();
  const needleLower = needle.toLowerCase();

  let pos = 0;
  while (pos < haystack.length) {
    const idx = haystackLower.indexOf(needleLower, pos);
    if (idx === -1) {
      fragment.appendChild(document.createTextNode(haystack.slice(pos)));
      break;
    }

    if (idx > pos) {
      fragment.appendChild(document.createTextNode(haystack.slice(pos, idx)));
    }

    const mark = document.createElement("mark");
    mark.className =
      "bg-yellow-200 text-gray-900 dark:bg-yellow-900 dark:text-yellow-200 px-0.5 rounded";
    mark.textContent = haystack.slice(idx, idx + needle.length);
    fragment.appendChild(mark);

    pos = idx + needle.length;
  }

  return fragment;
}

// 查找第一个匹配的翻译项
function findFirstMatchingItem(searchQuery) {
  try {
    if (
      !AppState.project ||
      !Array.isArray(AppState.project.translationItems) ||
      !searchQuery
    ) {
      return -1;
    }

    __devLog(
      "在",
      AppState.project.translationItems.length,
      "个翻译项中查找:",
      searchQuery
    );

    for (let i = 0; i < AppState.project.translationItems.length; i++) {
      const item = AppState.project.translationItems[i];
      if (!item) continue;

      // 搜索原文、译文、上下文和元数据（包括resourceId）
      const sourceText = (item.sourceText || "").toLowerCase();
      const targetText = (item.targetText || "").toLowerCase();
      const context = (item.context || "").toLowerCase();
      const metadata = item.metadata || {};
      const resourceId = (metadata.resourceId || "").toLowerCase();

      const isMatch =
        sourceText.includes(searchQuery) ||
        targetText.includes(searchQuery) ||
        context.includes(searchQuery) ||
        resourceId.includes(searchQuery);

      if (isMatch) {
        __devLog("找到匹配项:", i, item.sourceText, item.metadata?.resourceId);
        return i;
      }
    }

    __devLog("未找到匹配项");
    return -1;
  } catch (error) {
    (loggers.app || console).error("查找匹配项时出错:", error);
    return -1;
  }
}

// 显示搜索结果面板
// 显示文件搜索结果（只搜索文件名）
function showFileSearchResults(searchQuery) {
  try {
    const searchResultsPanel = DOMCache.get("searchResultsPanel");
    const searchResultsList = DOMCache.get("searchResultsList");
    const searchResultsFooter = DOMCache.get("searchResultsFooter");
    const searchResultsCount = DOMCache.get("searchResultsCount");

    if (!searchResultsPanel || !searchResultsList) return;

    // 如果搜索查询为空，隐藏结果面板
    if (!searchQuery || searchQuery.trim() === "") {
      searchResultsPanel.classList.add("hidden");
      return;
    }

    // 提取唯一的文件名
    const uniqueFiles = new Set();
    if (AppState.project && AppState.project.translationItems) {
      AppState.project.translationItems.forEach((item) => {
        if (item.metadata && item.metadata.file) {
          uniqueFiles.add(item.metadata.file);
        }
      });
    }

    // 搜索匹配的文件
    const query = searchQuery.toLowerCase().trim();
    const matchingFiles = Array.from(uniqueFiles).filter((filename) =>
      filename.toLowerCase().includes(query)
    );

    __devLog("文件搜索结果数量:", matchingFiles.length);

    // 更新结果数量
    if (searchResultsCount) {
      searchResultsCount.textContent = matchingFiles.length;
    }

    // 生成结果列表HTML
    if (matchingFiles.length === 0) {
      const div = document.createElement("div");
      div.className = "px-4 py-3 text-gray-500 dark:text-gray-400 text-sm";
      div.textContent = `没有找到包含"${query}"的文件`;
      searchResultsList.replaceChildren(div);
    } else {
      const fragment = document.createDocumentFragment();
      matchingFiles.forEach((filename, index) => {
        const extension = filename.split(".").pop().toLowerCase();
        let icon = "fa-file";

        // 根据文件类型选择图标
        if (extension === "xml") icon = "fa-file-code-o";
        else if (extension === "json") icon = "fa-file-code-o";
        else if (extension === "xliff") icon = "fa-file-text-o";
        else if (extension === "strings") icon = "fa-file-text-o";
        else if (extension === "resx") icon = "fa-file-text-o";
        else if (extension === "po") icon = "fa-file-text-o";

        const item = document.createElement("div");
        item.className =
          "file-search-result-item px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors";
        item.dataset.filename = filename;

        const row = document.createElement("div");
        row.className = "flex items-center";

        const iconEl = document.createElement("i");
        iconEl.className = `fa ${icon} text-gray-500 dark:text-gray-400 mr-2`;

        const flex = document.createElement("div");
        flex.className = "flex-1";
        const p = document.createElement("p");
        p.className = "text-sm";
        p.appendChild(highlightText(filename, query));
        flex.appendChild(p);

        const count = document.createElement("span");
        count.className = "text-xs text-gray-400 ml-2";
        count.textContent = `${index + 1}/${matchingFiles.length}`;

        row.appendChild(iconEl);
        row.appendChild(flex);
        row.appendChild(count);
        item.appendChild(row);
        fragment.appendChild(item);
      });

      searchResultsList.replaceChildren(fragment);
    }

    // 显示结果面板
    searchResultsPanel.classList.remove("hidden");
    if (searchResultsFooter) {
      searchResultsFooter.classList.remove("hidden");
    }
  } catch (error) {
    (loggers.app || console).error("显示文件搜索结果时出错:", error);
  }
}

// 跳转到搜索结果
function navigateToSearchResult(index) {
  try {
    __devLog("跳转到搜索结果索引:", index);

    // 隐藏搜索结果面板
    const searchResultsPanel = DOMCache.get("searchResultsPanel");
    searchResultsPanel.classList.add("hidden");

    // 选择对应的翻译项
    selectTranslationItem(index);

    // 显示成功通知
    const item = AppState.project.translationItems[index];
    if (item) {
      showNotification(
        "success",
        "跳转成功",
        `已跳转到: ${truncateText(item.sourceText, 30)}`
      );
    }
  } catch (error) {
    (loggers.app || console).error("跳转到搜索结果时出错:", error);
    showNotification("error", "跳转失败", "无法跳转到指定的翻译项");
  }
}

// 处理搜索回车键
function handleSearchEnter() {
  try {
    __devLog("=== 开始处理搜索回车 ===");

    const searchInput = DOMCache.get("searchInput");
    const searchQuery = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    __devLog("搜索查询:", searchQuery);
    __devLog("当前项目状态:", AppState.project ? "存在" : "不存在");
    __devLog(
      "翻译项数量:",
      AppState.project ? AppState.project.translationItems.length : 0
    );

    if (!searchQuery) {
      __devLog("搜索查询为空，不执行跳转");
      showNotification("info", "搜索提示", "请输入搜索关键词");
      return;
    }

    if (
      !AppState.project ||
      !AppState.project.translationItems ||
      AppState.project.translationItems.length === 0
    ) {
      __devLog("没有可用的翻译项进行搜索");
      showNotification("warning", "无翻译项", "请先上传文件或创建项目");
      return;
    }

    // 查找第一个匹配的翻译项
    const matchIndex = findFirstMatchingItem(searchQuery);

    __devLog("查找结果索引:", matchIndex);

    if (matchIndex !== -1) {
      __devLog("找到匹配项，选择索引:", matchIndex);
      __devLog("匹配项内容:", AppState.project.translationItems[matchIndex]);

      // 跳转到匹配的翻译项
      navigateToSearchResult(matchIndex);
    } else {
      __devLog("未找到匹配项");
      showNotification(
        "warning",
        "未找到匹配项",
        `没有找到包含"${searchQuery}"的翻译项`
      );
    }
  } catch (error) {
    (loggers.app || console).error("处理搜索回车时出错:", error);
    showNotification(
      "error",
      "搜索错误",
      `执行搜索跳转时发生错误: ${error.message}`
    );
  }
}

// 滚动到指定的翻译项
async function scrollToItem(index) {
  try {
    const smartScrollToComfortZone = (el, behavior = "smooth") => {
      if (!el) return;
      const container =
        DOMCache.get("translationScrollWrapper") ||
        el.closest(".translation-scroll-wrapper");
      if (!container) {
        el.scrollIntoView({ behavior, block: "nearest" });
        return;
      }

      const containerHeight = container.clientHeight || 0;
      if (!containerHeight) {
        el.scrollIntoView({ behavior, block: "nearest" });
        return;
      }

      let offsetTop = 0;
      let node = el;
      while (node && node !== container) {
        offsetTop += node.offsetTop || 0;
        node = node.offsetParent;
      }

      const itemHeight = el.offsetHeight || 0;
      const current = container.scrollTop;
      const maxScroll = Math.max(0, container.scrollHeight - containerHeight);
      const margin = Math.min(80, containerHeight * 0.15);

      const itemTop = offsetTop;
      const itemBottom = offsetTop + itemHeight;

      const visibleTop = current + margin;
      const visibleBottom = current + containerHeight - margin;

      let target = current;

      if (itemBottom > visibleBottom) {
        target = itemBottom - containerHeight + margin;
      } else if (itemTop < visibleTop) {
        target = itemTop - margin;
      } else {
        return;
      }

      target = Math.max(0, Math.min(maxScroll, target));
      if (Math.abs(target - current) < 2) return;

      container.scrollTo({ top: target, behavior });
    };

    const tryScroll = () => {
      // 移动端：滚动合并列表
      if (window.innerWidth < 768) {
        const mobileCombinedList =
          DOMCache.get("mobileCombinedList");
        if (!mobileCombinedList) {
          (loggers.app || console).error("移动端滚动目标元素未找到");
          return true;
        }

        const mobileItem = mobileCombinedList.querySelector(
          `.responsive-translation-item[data-index="${index}"]`
        );
        if (mobileItem) {
          smartScrollToComfortZone(mobileItem, "smooth");
          return true;
        }

        return false;
      }

      const sourceList = DOMCache.get("sourceList");
      const targetList = DOMCache.get("targetList");

      if (!sourceList || !targetList) {
        (loggers.app || console).error("滚动目标元素未找到");
        return true;
      }

      const sourceItem = sourceList.querySelector(`[data-index="${index}"]`);
      const targetItem = targetList.querySelector(`[data-index="${index}"]`);

      if (sourceItem) {
        smartScrollToComfortZone(sourceItem, "smooth");
      }
      if (targetItem) {
        smartScrollToComfortZone(targetItem, "smooth");
      }

      return !!(sourceItem || targetItem);
    };

    if (tryScroll()) return;

    const beforeVersion = AppState?.translations?.renderVersion || 0;
    await __waitForTranslationsRendered(beforeVersion + 1, 800);
    tryScroll();
  } catch (error) {
    (loggers.app || console).error("滚动到翻译项时出错:", error);
  }
}

// 应用搜索过滤
// 应用搜索过滤（优化版 - 添加缓存机制）
