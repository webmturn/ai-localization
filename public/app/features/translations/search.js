let searchCache = new Map(); // 搜索结果缓存
let lastSearchQuery = ""; // 上次搜索查询
let lastSearchScope = ""; // 上次搜索范围（按文件）

// __devLog 已在 render.js 中定义，此处不再重复

function applySearchFilter() {
  try {
    if (
      !AppState.project ||
      !AppState.project.translationItems ||
      AppState.project.translationItems.length === 0
    ) {
      AppState.translations.filtered = [];
      return;
    }

    const allItems = AppState.project.translationItems;
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
      AppState.translations.filtered = [...baseItems];
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

      AppState.translations.filtered = filteredItems;
      lastSearchQuery = query;
    }

    __devLog("搜索过滤完成，结果数量:", AppState.translations.filtered.length);

    // 重置到第一页
    AppState.translations.currentPage = 1;
  } catch (error) {
    (loggers.app || console).error("应用搜索过滤时出错:", error);
    AppState.translations.filtered = AppState.project
      ? [...AppState.project.translationItems]
      : [];
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
      const sourcePageInfo = DOMCache.get("sourcePageInfo");

      if (sourceStartRange)
        sourceStartRange.textContent = totalItems > 0 ? startRange : 0;
      if (sourceEndRange)
        sourceEndRange.textContent = totalItems > 0 ? endRange : 0;
      if (sourceTotalItems) sourceTotalItems.textContent = totalItems;
      if (sourcePageInfo) sourcePageInfo.textContent = `第 ${currentPage} 页`;

      // 更新分页按钮状态
      const sourcePrevBtn = DOMCache.get("sourcePrevBtn");
      const sourceNextBtn = DOMCache.get("sourceNextBtn");

      if (sourcePrevBtn) sourcePrevBtn.disabled = currentPage === 1;
      if (sourceNextBtn) sourceNextBtn.disabled = currentPage === totalPages;

      // 显示或隐藏分页控件
      const paginationContainer = DOMCache.get("paginationContainer");
      __devLog(
        `分页信息: 总项数=${totalItems}, 每页项数=${itemsPerPage}, 是否显示=${
          totalItems > itemsPerPage
        }`
      );

      if (paginationContainer) {
        if (totalItems > itemsPerPage) {
          paginationContainer.classList.remove("hidden");
        } else {
          paginationContainer.classList.add("hidden");
        }
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
  try {
    __devLog("分页导航开始，方向:", direction);
    __devLog("当前页:", AppState.translations.currentPage);
    __devLog("过滤后项目数:", AppState.translations.filtered.length);

    const itemsPerPage = AppState.translations.itemsPerPage;
    const filteredItems = AppState.translations.filtered;
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    __devLog("总页数:", totalPages);

    if (direction === "prev" && AppState.translations.currentPage > 1) {
      AppState.translations.currentPage--;
      __devLog("切换到上一页，新页码:", AppState.translations.currentPage);
    } else if (
      direction === "next" &&
      AppState.translations.currentPage < totalPages
    ) {
      AppState.translations.currentPage++;
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
