let eventListenersInitialized = false;
function initEventListeners() {
  if (eventListenersInitialized) return;
  eventListenersInitialized = true;

  const sourceList = document.getElementById("sourceList");
  const targetList = document.getElementById("targetList");
  const mobileCombinedList = document.getElementById("mobileCombinedList");
  const fileTree = document.getElementById("fileTree");
  const searchResultsList = document.getElementById("searchResultsList");
  const searchResultsPanel = document.getElementById("searchResultsPanel");
  const terminologyListElement = document.getElementById("terminologyList");

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
      console.error("注册快捷键失败:", err);
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

// 加载保存的设置
// 加载保存的设置
