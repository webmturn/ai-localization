// ==================== 翻译API服务模块 ====================

// 翻译服务类

// 创建全局翻译服务实例
const translationService = new TranslationService();

try {
  if (typeof window !== "undefined") {
    window.translationService = translationService;
  }
} catch (_) {
  (loggers.translation || console).debug("translationService global register:", _);
}

try {
  if (typeof window !== "undefined" && window.App && window.App.services) {
    window.App.services.translationService = translationService;
  }
} catch (_) {
  (loggers.translation || console).debug("translationService App.services register:", _);
}
