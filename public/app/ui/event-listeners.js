let eventListenersInitialized = false;
function initEventListeners() {
  if (eventListenersInitialized) return;
  eventListenersInitialized = true;

  const sourceList = DOMCache.get("sourceList");
  const targetList = DOMCache.get("targetList");
  const mobileCombinedList = DOMCache.get("mobileCombinedList");
  const fileTree = DOMCache.get("fileTree");
  const searchResultsList = DOMCache.get("searchResultsList");
  const searchResultsPanel = DOMCache.get("searchResultsPanel");
  const terminologyListElement = DOMCache.get("terminologyList");

  const ctxTranslationSearchInput = DOMCache.get("translationSearchInput");
  const ctxTranslationSearchInputMobile = DOMCache.get(
    "translationSearchInputMobile"
  );
  const ctxClearTranslationSearch = DOMCache.get("clearTranslationSearch");
  const ctxClearTranslationSearchMobile = DOMCache.get(
    "clearTranslationSearchMobile"
  );
  const ctxTranslationSearchStats = DOMCache.get("translationSearchStats");
  const ctxTranslationSearchCount = DOMCache.get("translationSearchCount");

  const ctx = {
    sourceList,
    targetList,
    mobileCombinedList,
    fileTree,
    searchResultsList,
    searchResultsPanel,
    terminologyListElement,
    translationSearchInput: ctxTranslationSearchInput,
    translationSearchInputMobile: ctxTranslationSearchInputMobile,
    clearTranslationSearch: ctxClearTranslationSearch,
    clearTranslationSearchMobile: ctxClearTranslationSearchMobile,
    translationSearchStats: ctxTranslationSearchStats,
    translationSearchCount: ctxTranslationSearchCount,
  };

  if (typeof window.registerEventListenersKeyboard === "function") {
    try {
      window.registerEventListenersKeyboard(ctx);
    } catch (err) {
      (loggers.app || console).error("注册快捷键失败:", err);
    }
  }
  registerEventListenersTranslationLists(ctx);
  registerEventListenersFilePanels(ctx);
  registerEventListenersTerminology(ctx);
  registerEventListenersSettings(ctx);
  registerEventListenersTranslationSearch(ctx);
  registerEventListenersDataAndUi(ctx);
  if (typeof initQualityCheckEventListeners === "function") {
    initQualityCheckEventListeners();
  }
  if (typeof registerEventListenersProjectManager === "function") {
    registerEventListenersProjectManager(ctx);
  }
}
