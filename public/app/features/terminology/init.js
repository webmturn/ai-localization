function initTerminology() {
  try {
    if (
      AppState &&
      AppState.project &&
      AppState.project.terminologyList &&
      Array.isArray(AppState.project.terminologyList) &&
      AppState.project.terminologyList.length > 0
    ) {
      AppState.terminology.list = AppState.project.terminologyList;
      AppState.terminology.filtered = [...AppState.terminology.list];
      AppState.terminology.currentPage = 1;
      return;
    }

    // 尝试从 localStorage 加载术语库
    let savedTerminology = localStorage.getItem("terminologyList");

    if (!savedTerminology) {
      const legacyTerminology = localStorage.getItem("terminology");
      if (legacyTerminology) {
        try {
          const parsedLegacy = safeJsonParse(legacyTerminology, []);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            savedTerminology = JSON.stringify(parsedLegacy);
          }
        } catch (e) {
          (loggers.app || console).error("迁移旧术语库失败:", e);
        }
      }
    }

    if (savedTerminology) {
      const parsedTerminology = safeJsonParse(savedTerminology, []);
      if (Array.isArray(parsedTerminology) && parsedTerminology.length > 0) {
        // 使用保存的术语库
        AppState.terminology.list = parsedTerminology;
        AppState.terminology.filtered = [...parsedTerminology];
        AppState.terminology.currentPage = 1;

        try {
          if (AppState && AppState.project) {
            AppState.project.terminologyList = parsedTerminology;
          }
        } catch (e) {
          (loggers.app || console).error("同步术语到项目状态失败:", e);
        }

        (loggers.app || console).debug(
          `从 localStorage 加载了 ${parsedTerminology.length} 个术语`
        );
      } else {
        // localStorage 中没有有效数据，使用默认示例术语
        (loggers.app || console).debug("使用默认示例术语库");
        // AppState.terminology 已经有示例数据，不需要额外设置
      }
    } else {
      // localStorage 中没有数据，使用默认示例术语
      (loggers.app || console).debug("首次使用，加载示例术语库");
      // AppState.terminology 已经有示例数据，不需要额外设置
    }
  } catch (error) {
    (loggers.app || console).error("加载术语库失败:", error);
    // 出错时使用默认示例数据
  }
}

// 暴露到全局并在 DOM 加载后自动初始化
window.initTerminology = initTerminology;

// DOM 加载完成后自动初始化术语库
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTerminology);
} else {
  setTimeout(initTerminology, 0);
}

// 加载示例项目
