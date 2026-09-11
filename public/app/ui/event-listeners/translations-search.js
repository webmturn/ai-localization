function registerEventListenersTranslationSearch(ctx) {
  // ==================== 搜索翻译项功能（优化版） ====================
  const translationSearchInput = ctx?.translationSearchInput;
  const translationSearchInputMobile = ctx?.translationSearchInputMobile;
  const clearTranslationSearch = ctx?.clearTranslationSearch;
  const clearTranslationSearchMobile = ctx?.clearTranslationSearchMobile;
  const translationSearchStats = ctx?.translationSearchStats;
  const translationSearchCount = ctx?.translationSearchCount;
  const translationFindBar = ctx?.translationFindBar;
  const toggleTranslationSearchBtn = ctx?.toggleTranslationSearchBtn;
  const closeTranslationSearchBtn = ctx?.closeTranslationSearchBtn;

  // 搜索翻译项函数（使用统一过滤函数）
  function searchTranslationItems(keyword) {
    const trimmedKeyword = keyword?.trim() || "";
    // 统一将搜索词存入 AppState，供列表渲染/高亮等逻辑复用（经 TranslationViewStore）
    TranslationViewStore.setSearchQuery(trimmedKeyword);

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
    TranslationViewStore.setPage(1);
    updateTranslationLists();
    updateCounters();
  }

  // 使用防抖的搜索函数
  const debouncedSearch = debounce(searchTranslationItems, 300);

  // ==================== 查找条（按需展开） ====================
  // 搜索条默认不展开，列表默认占满高度；由工具栏「搜索」按钮、Ctrl+F（keyboard.js 的
  // focusSearch 动作）展开，Esc / ✕ 收起。
  function openTranslationFindBar() {
    if (!translationFindBar) return false;
    translationFindBar.classList.remove("hidden");
    translationFindBar.classList.add("flex");
    toggleTranslationSearchBtn?.setAttribute("aria-expanded", "true");
    if (translationSearchInput) {
      translationSearchInput.focus();
      if (typeof translationSearchInput.select === "function") {
        translationSearchInput.select();
      }
    }
    return true;
  }

  function closeTranslationFindBar(options) {
    if (!translationFindBar) return false;
    const wasOpen = !translationFindBar.classList.contains("hidden");
    translationFindBar.classList.add("hidden");
    translationFindBar.classList.remove("flex");
    toggleTranslationSearchBtn?.setAttribute("aria-expanded", "false");
    // 关闭即清空筛选：否则列表被过滤却看不到筛选条件，容易被误当成全部条目
    const hadQuery = !!(
      translationSearchInput?.value || translationSearchInputMobile?.value
    );
    if (wasOpen && hadQuery) {
      if (translationSearchInput) translationSearchInput.value = "";
      if (translationSearchInputMobile) translationSearchInputMobile.value = "";
      searchTranslationItems("");
    }
    if (!options || options.restoreFocus !== false) {
      if (
        toggleTranslationSearchBtn &&
        typeof toggleTranslationSearchBtn.focus === "function"
      ) {
        toggleTranslationSearchBtn.focus();
      }
    }
    return true;
  }

  // 暴露给全局快捷键（Ctrl+F 展开、Esc 收起都在 keyboard.js 的动作表里）
  if (window.App) {
    window.App.ui = window.App.ui || {};
    window.App.ui.openTranslationFindBar = openTranslationFindBar;
    window.App.ui.closeTranslationFindBar = closeTranslationFindBar;
  }

  if (toggleTranslationSearchBtn) {
    EventManager.add(
      toggleTranslationSearchBtn,
      "click",
      () => {
        if (translationFindBar && !translationFindBar.classList.contains("hidden")) {
          closeTranslationFindBar();
        } else {
          openTranslationFindBar();
        }
      },
      {
        tag: "translations",
        scope: "translationSearch",
        label: "toggleTranslationSearchBtn:click",
      }
    );
  }

  if (closeTranslationSearchBtn) {
    EventManager.add(
      closeTranslationSearchBtn,
      "click",
      () => closeTranslationFindBar(),
      {
        tag: "translations",
        scope: "translationSearch",
        label: "closeTranslationSearchBtn:click",
      }
    );
  }

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
