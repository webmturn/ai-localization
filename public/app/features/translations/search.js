let searchCache = new Map(); // 搜索结果缓存
let lastSearchQuery = ""; // 上次搜索查询
let lastSearchScope = ""; // 上次搜索范围（按文件）
let _searchDataVersion = 0; // 数据变更版本号
let _searchItemsRef = null; // 跟踪 translationItems 数组引用

/**
 * 使搜索缓存失效（在翻译项内容变更后调用）
 * 调用场景：翻译完成、编辑译文、查找替换、清除译文、导入文件等
 */
function invalidateSearchCache() {
  if (searchCache.size > 0) {
    searchCache.clear();
    lastSearchQuery = "";
  }
  _searchDataVersion++;
}

// __devLog 已在 render.js 中定义，此处不再重复

function applySearchFilter(options) {
  try {
    if (
      !AppState.project ||
      !AppState.project.translationItems ||
      AppState.project.translationItems.length === 0
    ) {
      TranslationViewStore.setFilter([]);
      return;
    }

    const allItems = AppState.project.translationItems;

    // 数据源引用变化时（导入新文件、切换项目）自动失效缓存
    if (_searchItemsRef !== allItems) {
      _searchItemsRef = allItems;
      searchCache.clear();
      lastSearchQuery = "";
    }

    const selectedFile = AppState?.translations?.selectedFile;
    const scopeKey = selectedFile ? `file:${selectedFile}` : "project:all";
    if (scopeKey !== lastSearchScope) {
      searchCache.clear();
      lastSearchQuery = "";
      lastSearchScope = scopeKey;
    }

    const baseItems = selectedFile
      ? allItems.filter((item) => item?.metadata?.file === selectedFile)
      : allItems;

    const searchQuery = (AppState.translations.searchQuery || "").toString();

    if (!searchQuery.trim()) {
      TranslationViewStore.setFilter([...baseItems]);
      searchCache.clear();
      lastSearchQuery = "";
    } else {
      const query = searchQuery.toLowerCase().trim();

      const cacheKey = `${scopeKey}::${query}`;

      let filteredItems;
      // 检查缓存
      if (searchCache.has(cacheKey)) {
        filteredItems = searchCache.get(cacheKey);
        __devLog("使用缓存的搜索结果:", filteredItems.length);
      } else {
        // 应用搜索过滤
        filteredItems = baseItems.filter((item) => {
          if (!item) return false;

          // 搜索原文、译文、上下文和元数据（包括resourceId）
          const sourceText = (item.sourceText || "").toLowerCase();
          const targetText = (item.targetText || "").toLowerCase();
          const context = (item.context || "").toLowerCase();
          const metadata = item.metadata || {};
          const resourceId = (metadata.resourceId || "").toLowerCase();

          return (
            sourceText.includes(query) ||
            targetText.includes(query) ||
            context.includes(query) ||
            resourceId.includes(query)
          );
        });

        // 缓存结果（最多缓存50条）
        if (searchCache.size >= 50) {
          // 删除最旧的缓存
          const firstKey = searchCache.keys().next().value;
          searchCache.delete(firstKey);
        }
        searchCache.set(cacheKey, filteredItems);
      }

      TranslationViewStore.setFilter(filteredItems);
      lastSearchQuery = query;
    }

    const statusFilter = AppState.translations.statusFilter || "all";
    if (statusFilter !== "all") {
      TranslationViewStore.setFilter(AppState.translations.filtered.filter((item) => {
        return TranslationViewStore.matchesStatus(item);
      }));
    }
    __devLog("搜索过滤完成，结果数量:", AppState.translations.filtered.length);

    // 重置到第一页
    const totalPages = Math.max(1, Math.ceil(AppState.translations.filtered.length / AppState.translations.itemsPerPage));
    TranslationViewStore.setPage(options?.preservePage ? Math.min(AppState.translations.currentPage, totalPages) : 1);
  } catch (error) {
    (loggers.app || console).error("应用搜索过滤时出错:", error);
    // 出错时也不扩大到其他文件或把空结果替换为全项目。
    TranslationViewStore.setFilter([]);
  }
}

// 更新分页UI
function updatePaginationUI(
  totalItems,
  startRange,
  endRange,
  currentPage,
  totalPages
) {
  const itemsPerPage = AppState.translations.itemsPerPage; // 使用 AppState 中的设置

  // 使用 batchUpdate 将 8 个 DOM 写入合并到同一帧
  DOMCache.batchUpdate("pagination", function () {
    try {
      // 更新源文本分页信息
      const sourceStartRange = DOMCache.get("sourceStartRange");
      const sourceEndRange = DOMCache.get("sourceEndRange");
      const sourceTotalItems = DOMCache.get("sourceTotalItems");
      const sourcePageInput = DOMCache.get("sourcePageInput");
      const sourceTotalPages = DOMCache.get("sourceTotalPages");
      const pageCount = Math.max(1, totalPages);

      if (sourceStartRange)
        sourceStartRange.textContent = totalItems > 0 ? startRange : 0;
      if (sourceEndRange)
        sourceEndRange.textContent = totalItems > 0 ? endRange : 0;
      if (sourceTotalItems) sourceTotalItems.textContent = totalItems;
      if (sourceTotalPages) sourceTotalPages.textContent = pageCount;
      if (sourcePageInput) {
        sourcePageInput.value = currentPage;
        sourcePageInput.disabled = totalItems === 0 || pageCount === 1;
        sourcePageInput.title = `输入 1–${pageCount} 的页码，按 Enter 跳转`;
      }
      const pageSize = DOMCache.get("paginationPageSize");
      if (pageSize) pageSize.value = itemsPerPage;
      DOMCache.get("paginationFilterHint")?.classList.toggle("hidden", !AppState.translations.searchQuery && (!AppState.translations.statusFilter || AppState.translations.statusFilter === "all"));

      // 更新分页按钮状态
      const sourcePrevBtn = DOMCache.get("sourcePrevBtn");
      const sourceNextBtn = DOMCache.get("sourceNextBtn");

      if (sourcePrevBtn) sourcePrevBtn.disabled = currentPage === 1;
      if (sourceNextBtn) sourceNextBtn.disabled = currentPage >= totalPages;

      // 单页及空结果保留统计；隐藏翻页操作但保留其空间，筛选时底部不跳动。
      const paginationContainer = DOMCache.get("paginationContainer");
      __devLog(
        `分页信息: 总项数=${totalItems}, 每页项数=${itemsPerPage}, 是否显示=${
          totalItems > itemsPerPage
        }`
      );

      if (paginationContainer) {
        paginationContainer.classList.remove("hidden");
        paginationContainer.dataset.singlePage = String(pageCount === 1);
        const navigation = paginationContainer.querySelector(".pagination-navigation");
        navigation?.setAttribute("aria-hidden", String(pageCount === 1));
        if (navigation) navigation.inert = pageCount === 1;
      }
    } catch (error) {
      (loggers.app || console).error("更新分页UI时出错:", error);
    }
  });
}

// 处理搜索输入（只搜索文件，不影响翻译列表）
function handleSearchInput() {
  const input =
    DOMCache.get("searchInput");
  if (!input) return;
  const searchQuery = input.value;

  // 只显示文件搜索结果面板，不更新翻译列表
  showFileSearchResults(searchQuery);
}

// 处理分页导航
function handlePagination(direction) {
  if (typeof App !== "undefined" && App.ui.translationWorkspace?.jumpToPage) {
    App.ui.translationWorkspace.jumpToPage(AppState.translations.currentPage + (direction === "prev" ? -1 : 1));
    return;
  }
  try {
    __devLog("分页导航开始，方向:", direction);
    __devLog("当前页:", AppState.translations.currentPage);
    __devLog("过滤后项目数:", AppState.translations.filtered.length);

    const itemsPerPage = AppState.translations.itemsPerPage;
    const filteredItems = AppState.translations.filtered;
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    __devLog("总页数:", totalPages);

    if (direction === "prev" && AppState.translations.currentPage > 1) {
      TranslationViewStore.setPage(AppState.translations.currentPage - 1);
      __devLog("切换到上一页，新页码:", AppState.translations.currentPage);
    } else if (
      direction === "next" &&
      AppState.translations.currentPage < totalPages
    ) {
      TranslationViewStore.setPage(AppState.translations.currentPage + 1);
      __devLog("切换到下一页，新页码:", AppState.translations.currentPage);
    } else {
      __devLog("无法切换页面，已到达边界");
    }

    updateTranslationLists();
  } catch (error) {
    (loggers.app || console).error("处理分页导航时出错:", error);
    showNotification("error", "分页错误", "切换页面时发生错误");
  }
}
