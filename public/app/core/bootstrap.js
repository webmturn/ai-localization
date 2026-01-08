let __appDomInitialized = false;
async function __onAppDomContentLoaded() {
  if (__appDomInitialized) return;
  __appDomInitialized = true;
  // 清理所有缓存
  DOMCache.clear();

  // 添加窗口大小变化监听（使用节流优化，通过EventManager管理）
  EventManager.add(
    window,
    "resize",
    function () {
      // Note: throttledSyncHeights is defined in a later-loaded split file.
      // Use typeof guard to avoid ReferenceError during early initialization.
      if (typeof throttledSyncHeights === "function") {
        return throttledSyncHeights.apply(this, arguments);
      }
    },
    { tag: "app", scope: "lifecycle", label: "window:resize" }
  );

  // 页面可见性变化时重新同步
  EventManager.add(
    document,
    "visibilitychange",
    () => {
      if (!document.hidden) {
        // Note: debouncedSyncHeights is defined in a later-loaded split file.
        if (typeof debouncedSyncHeights === "function") {
          debouncedSyncHeights();
        }
      }
    },
    { tag: "app", scope: "lifecycle", label: "document:visibilitychange" }
  );

  // 页面卸载时清理资源（防止内存泄漏）
  EventManager.add(
    window,
    "beforeunload",
    () => {
      console.log("页面卸载，清理资源...");
      EventManager.removeAll();
      DOMCache.clear();

      // 取消所有正在进行的翻译请求
      if (translationService) {
        translationService.cancelAll();
      }
    },
    { tag: "app", scope: "lifecycle", label: "window:beforeunload" }
  );

  // 初始化事件监听器
  initEventListeners();

  // 加载保存的设置
  try {
    await loadSettings();
  } catch (e) {
    console.error("加载设置失败:", e);
  }

  try {
    storageManager.loadPreferredBackendFromSettings();
  } catch (e) {
    console.error("初始化存储后端失败:", e);
  }

  try {
    await storageManager.ensureBackendAvailable();
  } catch (e) {
    console.error("检测存储后端可用性失败:", e);
  }

  // 初始化引擎和模型联动
  initEngineModelSync();

  const restoredProject = await autoSaveManager.restoreProject();
  if (restoredProject) {
    AppState.project = restoredProject;
    AppState.translations.items = restoredProject.translationItems || [];
    AppState.project.translationItems = AppState.translations.items;
    AppState.fileMetadata = restoredProject.fileMetadata || {};

    hydrateFileMetadataContentKeys(AppState.project?.id);

    AppState.translations.selected = -1;
    AppState.translations.currentPage = 1;
    AppState.translations.filtered = [...AppState.translations.items];
    AppState.translations.searchQuery = "";

    const sourceLanguageEl = document.getElementById("sourceLanguage");
    const targetLanguageEl = document.getElementById("targetLanguage");
    if (sourceLanguageEl)
      sourceLanguageEl.value = restoredProject.sourceLanguage || "en";
    if (targetLanguageEl)
      targetLanguageEl.value = restoredProject.targetLanguage || "zh";

    updateFileTree();
    updateTranslationLists();
    updateCounters();
    showNotification(
      "success",
      "项目已恢复",
      `已从本地存储恢复项目 "${restoredProject.name || "未命名"}"`
    );
  } else {
    loadSampleProject();
  }

  // 初始化术语库（优先使用项目内术语，其次回退到 legacy localStorage 或示例数据）
  initTerminology();
  updateTerminologyList();

  autoSaveManager.start();

  // 添加点击外部关闭搜索结果面板的事件
  EventManager.add(
    document,
    "click",
    function (e) {
      const searchInput = DOMCache.get("searchInput");
      const searchResultsPanel = DOMCache.get("searchResultsPanel");

      if (
        searchInput &&
        searchResultsPanel &&
        !searchInput.contains(e.target) &&
        !searchResultsPanel.contains(e.target)
      ) {
        searchResultsPanel.classList.add("hidden");
      }
    },
    {
      tag: "search",
      scope: "panel:searchResults",
      label: "document:clickOutsideClose",
    }
  );
}

window.__appBootstrap = __onAppDomContentLoaded;
