function registerEventListenersTranslationSearch(ctx) {
  // ==================== 搜索翻译项功能（优化版） ====================
  const translationSearchInput = ctx?.translationSearchInput;
  const translationSearchInputMobile = ctx?.translationSearchInputMobile;
  const clearTranslationSearch = ctx?.clearTranslationSearch;
  const clearTranslationSearchMobile = ctx?.clearTranslationSearchMobile;
  const translationSearchStats = ctx?.translationSearchStats;
  const translationSearchCount = ctx?.translationSearchCount;

  // 搜索翻译项函数（使用统一过滤函数）
  function searchTranslationItems(keyword) {
    const trimmedKeyword = keyword?.trim() || "";
    // 统一将搜索词存入 AppState，供列表渲染/高亮等逻辑复用
    AppState.translations.searchQuery = trimmedKeyword;

    if (!trimmedKeyword) {
      // 清除搜索，显示所有项
      applySearchFilter();
      translationSearchStats?.classList.add("hidden");
      clearTranslationSearch?.classList.add("hidden");
      clearTranslationSearchMobile?.classList.add("hidden");
    } else {
      // 执行搜索（使用统一的 applySearchFilter 函数）
      applySearchFilter();

      // 显示搜索统计
      if (translationSearchStats) {
        translationSearchStats.classList.remove("hidden");
        if (translationSearchCount) {
          translationSearchCount.textContent =
            AppState.translations.filtered.length;
        }
      }
      clearTranslationSearch?.classList.remove("hidden");
      clearTranslationSearchMobile?.classList.remove("hidden");
    }

    // 重置到第一页并更新显示
    AppState.translations.currentPage = 1;
    updateTranslationLists();
    updateCounters();
  }

  // 使用防抖的搜索函数
  const debouncedSearch = debounce(searchTranslationItems, 300);

  // 桌面端搜索输入
  if (translationSearchInput) {
    EventManager.add(
      translationSearchInput,
      "input",
      (e) => {
        const keyword = e.target.value;
        debouncedSearch(keyword);
        // 同步到移动端
        if (translationSearchInputMobile) {
          translationSearchInputMobile.value = keyword;
        }
      },
      {
        tag: "translations",
        scope: "translationSearch",
        label: "translationSearchInput:input",
      }
    );
  }

  // 移动端搜索输入
  if (translationSearchInputMobile) {
    EventManager.add(
      translationSearchInputMobile,
      "input",
      (e) => {
        const keyword = e.target.value;
        debouncedSearch(keyword);
        // 同步到桌面端
        if (translationSearchInput) {
          translationSearchInput.value = keyword;
        }
      },
      {
        tag: "translations",
        scope: "translationSearch",
        label: "translationSearchInputMobile:input",
      }
    );
  }

  // 清除搜索按钮（桌面端）
  if (clearTranslationSearch) {
    EventManager.add(
      clearTranslationSearch,
      "click",
      () => {
        if (translationSearchInput) translationSearchInput.value = "";
        if (translationSearchInputMobile)
          translationSearchInputMobile.value = "";
        searchTranslationItems("");
      },
      {
        tag: "translations",
        scope: "translationSearch",
        label: "clearTranslationSearch:click",
      }
    );
  }

  // 清除搜索按钮（移动端）
  if (clearTranslationSearchMobile) {
    EventManager.add(
      clearTranslationSearchMobile,
      "click",
      () => {
        if (translationSearchInput) translationSearchInput.value = "";
        if (translationSearchInputMobile)
          translationSearchInputMobile.value = "";
        searchTranslationItems("");
      },
      {
        tag: "translations",
        scope: "translationSearch",
        label: "clearTranslationSearchMobile:click",
      }
    );
  }
}
