function rebuildFilteredTranslationItems(options = {}) {
  const appState = getServiceSafely('appState', 'AppState');
    
  const all = Array.isArray(appState?.project?.translationItems)
    ? appState.project.translationItems
    : [];

  const selectedFile =
    options && Object.prototype.hasOwnProperty.call(options, "selectedFile")
      ? options.selectedFile
      : appState?.translations?.selectedFile;

  let base = selectedFile
    ? all.filter((item) => item?.metadata?.file === selectedFile)
    : all;

  const searchQuery = (appState?.translations?.searchQuery || "")
    .toString()
    .toLowerCase()
    .trim();

  if (searchQuery) {
    base = base.filter((item) => {
      if (!item) return false;
      const sourceText = (item.sourceText || "").toLowerCase();
      const targetText = (item.targetText || "").toLowerCase();
      const context = (item.context || "").toLowerCase();
      const resourceId = ((item.metadata || {}).resourceId || "").toLowerCase();
      return (
        sourceText.includes(searchQuery) ||
        targetText.includes(searchQuery) ||
        context.includes(searchQuery) ||
        resourceId.includes(searchQuery)
      );
    });
  }

  appState.translations.filtered = [...base];
}

function formatTranslationError(errorLike, engine) {
  const rawMessage =
    (errorLike && typeof errorLike === "object" && "message" in errorLike
      ? errorLike.message
      : null) ||
    (errorLike && typeof errorLike === "object" && "error" in errorLike
      ? errorLike.error
      : null) ||
    String(errorLike || "");

  const message = (rawMessage || "").toString();
  const msgLower = message.toLowerCase();

  const status =
    (errorLike && typeof errorLike === "object" && errorLike.status) || null;
  const code =
    (errorLike && typeof errorLike === "object" && errorLike.code) || null;

  const normalizedEngine = (engine || "").toString().toLowerCase();
  const engineLabel =
    normalizedEngine === "openai"
      ? "OpenAI"
      : normalizedEngine === "deepseek"
        ? "DeepSeek"
        : normalizedEngine === "google"
          ? "Google"
          : (engine || "").toString().toUpperCase();

  const isAuthMessage =
    msgLower.includes("api密钥") ||
    msgLower.includes("invalid api key") ||
    msgLower.includes("unauthorized") ||
    msgLower.includes("authentication") ||
    msgLower.includes("forbidden") ||
    msgLower.includes("permission") ||
    msgLower.includes("401") ||
    msgLower.includes("403");

  if (code === "USER_CANCELLED" || message === "用户取消") {
    return {
      type: "info",
      title: "翻译已取消",
      message: "翻译过程已被用户取消",
      detail: message || "用户取消",
    };
  }

  if (code === "TIMEOUT" || msgLower.includes("请求超时") || msgLower.includes("timeout")) {
    return {
      type: "error",
      title: "请求超时",
      message: `请求 ${engineLabel} 超时。请检查网络后重试，或在设置中调大“超时(秒)”。`,
      detail: message,
    };
  }

  if (
    msgLower.includes("failed to fetch") ||
    msgLower.includes("networkerror") ||
    msgLower.includes("load failed") ||
    msgLower.includes("fetch") && msgLower.includes("error")
  ) {
    return {
      type: "error",
      title: "网络请求失败",
      message: `无法连接到 ${engineLabel} 服务。可能原因：网络不可用、代理/防火墙拦截、浏览器跨域限制。请检查网络后重试。`,
      detail: message,
    };
  }

  if (message.includes("API密钥未配置")) {
    return {
      type: "error",
      title: "API密钥未配置",
      message: `请在设置中配置 ${engineLabel} API密钥后重试`,
      detail: message,
    };
  }

  if (message.includes("API密钥格式不正确")) {
    return {
      type: "error",
      title: "API密钥格式不正确",
      message: `当前 ${engineLabel} API密钥格式不正确，请在设置中更新后重试`,
      detail: message,
    };
  }

  if (status === 401 || status === 403 || (isAuthMessage && (status === null || status === undefined))) {
    return {
      type: "error",
      title: "鉴权失败",
      message: `访问 ${engineLabel} 被拒绝（${status || "401/403"}）。请检查 API Key 是否正确、是否过期、以及是否有权限访问所选模型。`,
      detail: message,
    };
  }

  if (status === 429 || msgLower.includes("rate limit") || msgLower.includes("too many requests")) {
    return {
      type: "warning",
      title: "请求过于频繁",
      message: `触发 ${engineLabel} 限流（429）。请稍后重试，或在设置中降低并发/批处理大小。`,
      detail: message,
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      type: "error",
      title: "服务异常",
      message: `${engineLabel} 服务暂时不可用（${status}）。请稍后重试。`,
      detail: message,
    };
  }

  return {
    type: "error",
    title: "翻译失败",
    message: message || "未知错误",
    detail: message || "未知错误",
  };
}

function __truncateForNotification(text, maxLen) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

function showSplitNotification(type, title, message, detail) {
  const msg = (message || "").toString();
  const det = (detail || "").toString();

  const shortMsg = __truncateForNotification(msg, 90);
  showNotification(type, title, shortMsg);

  const shouldShowDetail = det && det.trim() && det.trim() !== msg.trim();
  const isLong = msg.length > 90 || det.length > 0;
  if (shouldShowDetail || isLong) {
    const detailText = __truncateForNotification(det || msg, 220);
    showNotification("info", "详细信息", detailText);
  }
}

// 查找替换功能已拆分到 find-replace.js

function clearSelectedTargets() {
  const appState = getServiceSafely('appState', 'AppState');
    
  if (appState.translations.selected === -1 || !appState.project) {
    // 使用验证器
    if (typeof TranslationValidators !== 'undefined') {
      try {
        TranslationValidators.validateItemSelected();
      } catch (error) {
        const errorManager = getServiceSafely('errorManager', 'errorManager');
        if (errorManager) {
          errorManager.handleError(error, { context: 'clearSelectedTargets' });
        } else {
          showNotification("warning", "未选择项", "请先选择要清除译文的项");
        }
      }
    } else {
      showNotification("warning", "未选择项", "请先选择要清除译文的项");
    }
    return;
  }

  const selectedIndices =
    (appState.translations.multiSelected || []).length > 0
      ? Array.from(new Set(appState.translations.multiSelected)).sort(
          (a, b) => a - b,
        )
      : [appState.translations.selected];

  let cleared = 0;
  for (const idx of selectedIndices) {
    const item = appState.project.translationItems?.[idx];
    if (!item) continue;
    item.qualityScore = 0;
    updateTranslationItem(idx, "");
    cleared++;
  }

  if (cleared > 0) {
    const autoSave = getServiceSafely('autoSaveManager', 'autoSaveManager');
    if (autoSave) {
      autoSave.markDirty();
    }
  }

  // 使用统一的UI更新器
  if (typeof updateTranslationUI === 'function') {
    updateTranslationUI({ reason: "清除译文完成" });
  } else {
    rebuildFilteredTranslationItems();
    updateTranslationLists();
    updateCounters();
    updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
  }

  if (selectedIndices.length > 1) {
    showNotification("success", "清除完成", `已清除 ${cleared} 项译文`);
  } else {
    showNotification("success", "清除完成", "已清除选中项译文");
  }
}

// 翻译选中项
async function translateSelected() {
  // 使用新的分层架构
  const controller = getTranslationUIController();
  if (controller) {
    await controller.handleTranslateSelected();
  } else {
    // 备用逻辑：使用原有实现
    await translateSelectedFallback();
  }
}

// 改进版翻译选中项实现
async function translateSelectedFallback() {
  try {
    // 使用统一验证器和结果处理器
    const validators =
      getServiceSafely("universalValidators") ||
      (typeof getUniversalValidators === "function" ? getUniversalValidators() : null);
    const resultHandler =
      getServiceSafely("translationResultHandler") ||
      (typeof getTranslationResultHandler === "function"
        ? getTranslationResultHandler()
        : null);

    if (!validators || typeof validators.safeValidate !== "function") {
      showNotification("error", "服务不可用", "验证器未加载");
      return;
    }
    if (!resultHandler || typeof resultHandler.handleTranslationComplete !== "function") {
      showNotification("error", "服务不可用", "结果处理器未加载");
      return;
    }
    
    // 验证翻译操作的前置条件
    const validationPassed = validators.safeValidate(() => {
      validators.validateTranslationOperation({
        requireItemSelection: true,
        requireFileSelection: false
      });
    }, { context: 'translateSelected' });
    
    if (!validationPassed) {
      return; // 验证失败，已经显示了错误消息
    }
    
    // 使用DI获取应用状态和服务
    const appState = getServiceSafely('appState', 'AppState');
    const translationService =
      getServiceSafely('translationService', 'translationService') ||
      (typeof window !== "undefined" ? window.translationService : null);
    
    if (!translationService) {
      showNotification("error", "服务不可用", "翻译服务未加载");
      return;
    }

    const selectedIndices =
      (appState.translations.multiSelected || []).length > 0
        ? Array.from(new Set(appState.translations.multiSelected)).sort((a, b) => a - b)
        : [appState.translations.selected];
    
    const selectedItems = selectedIndices
      .map((idx) => appState.project.translationItems?.[idx])
      .filter(Boolean);

    if (selectedItems.length === 0) {
      throw new Error("请先选择要翻译的项");
    }

    // 获取翻译配置
    const sourceLang = appState.project.sourceLanguage || "en";
    const targetLang = appState.project.targetLanguage || "zh";
    const settings = SettingsCache.get();
    const engine =
      settings.translationEngine ||
      settings.defaultEngine ||
      DOMCache.get("translationEngine")?.value ||
      "deepseek";

    // 显示进度
    showTranslationProgress();
    updateProgress(0, selectedItems.length, "准备翻译...");

    // 设置翻译状态
    appState.translations.isInProgress = true;
    appState.translations.isPaused = false;
    appState.translations.lastFailedItems = [];
    appState.translations.lastBatchContext = {
      scope: "selected",
      sourceLang,
      targetLang,
      engine,
      selectedFile: appState?.translations?.selectedFile || null,
    };
    updateTranslationControlState();

    let translationCount = 0;
    const batchUpdateInterval = 20;
    const updateUIIfNeeded = () => {
      translationCount++;
      if (translationCount % batchUpdateInterval === 0) {
        // 使用统一的UI更新器（移除重复代码）
        if (typeof updateTranslationUI === 'function') {
          updateTranslationUI({
            shouldScroll: false,
            shouldFocusTextarea: false,
            preserveSelection: true,
            reason: '翻译进度更新'
          });
        } else {
          // 备用逻辑
          rebuildFilteredTranslationItems();
          updateTranslationLists();
          updateCounters();
        }
      }
    };

    try {
      const { results, errors } = await translationService.translateBatch(
        selectedItems,
        sourceLang,
        targetLang,
        engine,
        (completed, total, message) => {
          updateProgress(completed, total, message);
          updateUIIfNeeded();
        },
      );

      hideTranslationProgress();

      // 使用统一的翻译结果处理器处理完成逻辑
      resultHandler.handleTranslationComplete(
        'translateSelected', 
        results, 
        errors, 
        engine, 
        {
          successTitle: "翻译完成",
          warningTitle: "翻译部分完成"
        }
      );

    } finally {
      // 确保清理状态
      appState.translations.isInProgress = false;
      updateTranslationControlState();
    }
  } catch (error) {
    (loggers.translation || console).error('翻译选中项失败:', error);
    
    // 使用错误管理器处理错误
    const errorManager = getServiceSafely('errorManager');
    if (errorManager) {
      errorManager.handleError(error, {
        context: 'translateSelected',
        operation: 'translation'
      });
    } else {
      showNotification("error", "翻译失败", error.message || "未知错误");
    }
    
    // 清理状态
    const appState = getServiceSafely('appState', 'AppState');
    if (appState) {
      appState.translations.isInProgress = false;
    }
    updateTranslationControlState();
  }
}

// 翻译所有项
async function translateAll() {
  // 使用新的分层架构
  const controller = getTranslationUIController();
  if (controller) {
    await controller.handleTranslateAll();
  } else {
    // 备用逻辑：使用原有实现
    await translateAllFallback();
  }
}

// 改进版翻译全部实现
async function translateAllFallback() {
  try {
    // 使用统一验证器和结果处理器
    const validators =
      getServiceSafely("universalValidators") ||
      (typeof getUniversalValidators === "function" ? getUniversalValidators() : null);
    const resultHandler =
      getServiceSafely("translationResultHandler") ||
      (typeof getTranslationResultHandler === "function"
        ? getTranslationResultHandler()
        : null);

    if (!validators || typeof validators.safeValidate !== "function") {
      showNotification("error", "服务不可用", "验证器未加载");
      return;
    }
    if (!resultHandler || typeof resultHandler.handleTranslationComplete !== "function") {
      showNotification("error", "服务不可用", "结果处理器未加载");
      return;
    }
    
    // 验证翻译操作的前置条件
    const validationPassed = validators.safeValidate(() => {
      validators.validateTranslationOperation({
        requireFileSelection: true
      });
    }, { context: 'translateAll' });
    
    if (!validationPassed) {
      return; // 验证失败，已经显示了错误消息
    }
    
    // 使用DI获取应用状态和服务
    const appState = getServiceSafely('appState', 'AppState');
    const translationService =
      getServiceSafely('translationService', 'translationService') ||
      (typeof window !== "undefined" ? window.translationService : null);
    
    if (!translationService) {
      showNotification("error", "服务不可用", "翻译服务未加载");
      return;
    }

    const selectedFile = appState?.translations?.selectedFile;

    // 获取待翻译的项
    const pendingItems = appState.project.translationItems
      .filter((item) => item?.metadata?.file === selectedFile)
      .filter((item) => item.status === "pending");

    if (pendingItems.length === 0) {
      showNotification("info", "无需翻译", "所有项都已翻译完成");
      return;
    }

    // 获取翻译配置
    const sourceLang = appState.project.sourceLanguage || "en";
    const targetLang = appState.project.targetLanguage || "zh";
    const settings = SettingsCache.get();
    const engine = settings.translationEngine || settings.defaultEngine || 
                  DOMCache.get("translationEngine")?.value || "deepseek";

    // 显示进度
    showTranslationProgress();
    updateProgress(0, pendingItems.length, "准备翻译...");

    // 设置翻译状态
    appState.translations.isInProgress = true;
    appState.translations.isPaused = false;
    appState.translations.lastFailedItems = [];
    appState.translations.lastBatchContext = {
      scope: "file",
      sourceLang,
      targetLang,
      engine,
      selectedFile: selectedFile || null,
    };
    updateTranslationControlState();

    let translationCount = 0;
    const batchUpdateInterval = 20;
    const updateUIIfNeeded = () => {
      translationCount++;
      if (translationCount % batchUpdateInterval === 0) {
        // 使用日志系统替代 console.log
        const logger = window.loggers?.app || console;
        logger.debug?.(`批量更新UI: 已翻译 ${translationCount} 条`);

        // 使用统一的UI更新器（移除重复代码）
        if (typeof updateTranslationUI === 'function') {
          updateTranslationUI({
            selectedFile,
            shouldScroll: false,
            shouldFocusTextarea: false,
            preserveSelection: true,
            reason: '翻译进度更新'
          });
        } else {
          // 备用逻辑
          rebuildFilteredTranslationItems({ selectedFile });
          updateTranslationLists();
          updateCounters();
        }
      }
    };

    try {
      const { results, errors } = await translationService.translateBatch(
        pendingItems,
        sourceLang,
        targetLang,
        engine,
        (completed, total, message) => {
          updateProgress(completed, total, message);
          updateUIIfNeeded();
        },
      );

      hideTranslationProgress();

      // 使用统一的翻译结果处理器处理完成逻辑
      resultHandler.handleTranslationComplete(
        'translateAll', 
        results, 
        errors, 
        engine, 
        {
          successTitle: "翻译完成",
          warningTitle: "翻译部分完成",
          selectedFile: selectedFile
        }
      );

    } finally {
      // 确保清理状态
      window.AppState.translations.isInProgress = false;
      window.AppState.translations.isPaused = false;
      updateTranslationControlState();
    }
  } catch (error) {
    (loggers.translation || console).error('翻译全部失败:', error);
    showNotification("error", "翻译失败", error.message || "未知错误");
    window.AppState.translations.isInProgress = false;
    window.AppState.translations.isPaused = false;
    updateTranslationControlState();
  }
}

// ==================== 分层架构辅助函数 ====================

/**
 * 获取翻译UI控制器
 */
function getTranslationUIController() {
  // 优先使用已初始化的全局实例
  if (window.translationUIController && typeof window.translationUIController.handleTranslateSelected === 'function') {
    return window.translationUIController;
  }

  // 尝试从DI系统获取
  let controller = getServiceSafely('translationUIController', null);
  
  // 验证返回的是实例而非类构造函数
  if (controller && typeof controller.handleTranslateSelected === 'function') {
    return controller;
  }

  // 懒初始化：如果控制器尚未创建，尝试初始化
  if (typeof initializeTranslationControllers === 'function') {
    initializeTranslationControllers();
    if (window.translationUIController && typeof window.translationUIController.handleTranslateSelected === 'function') {
      return window.translationUIController;
    }
  }

  return null;
}

/**
 * 获取翻译业务逻辑服务
 */
function getTranslationBusinessLogic() {
  // 优先使用DI系统
  let businessLogic = getServiceSafely('translationBusinessLogic', null);
    
  // 备用：使用全局实例
  if (!businessLogic && window.translationBusinessLogic) {
    businessLogic = window.translationBusinessLogic;
  }
  
  return businessLogic;
}

/**
 * 初始化分层架构控制器（如果需要）
 */
function initializeTranslationControllers() {
  // 检查是否已经初始化
  if (window.translationUIController && window.translationBusinessLogic) {
    return;
  }
  
  try {
    // 获取依赖
    const dependencies = {
      appState: getServiceSafely('appState', 'AppState'),
      validators: getServiceSafely('translationValidators', 'TranslationValidators'),
      translationService: getServiceSafely('translationService', 'translationService'),
      errorManager: getServiceSafely('errorManager', 'errorManager'),
      autoSaveManager: getServiceSafely('autoSaveManager', 'autoSaveManager'),
      resultHandler: getServiceSafely('translationResultHandler', null),
      uiUpdater: getServiceSafely('translationUIUpdater', 'TranslationUIUpdater'),
      notificationService: getServiceSafely('notificationService', null),
      eventManager: getServiceSafely('eventManager', 'eventManager')
    };
    
    // 创建业务逻辑服务
    if (typeof createTranslationBusinessLogic === 'function' && !window.translationBusinessLogic) {
      window.translationBusinessLogic = createTranslationBusinessLogic(dependencies);
    }
    
    // 创建UI控制器
    if (typeof createTranslationUIController === 'function' && !window.translationUIController) {
      window.translationUIController = createTranslationUIController({
        ...dependencies,
        businessLogic: window.translationBusinessLogic
      });
      
      // 初始化控制器
      window.translationUIController.initialize();
    }
    
    (loggers.translation || console).info('🎯 翻译分层架构控制器已初始化');
    
  } catch (error) {
    (loggers.translation || console).warn('⚠️ 翻译分层架构初始化失败，使用备用方案:', error);
  }
}

// ==================== 原有函数重构 ====================

// 取消翻译
function cancelTranslation() {
  const controller = getTranslationUIController();
  if (controller) {
    controller.handleCancelTranslation();
  } else {
    // 备用逻辑
    const appState = getServiceSafely('appState', 'AppState');
      
    appState.translations.isInProgress = false;
    appState.translations.isPaused = false;

    // 取消所有活动的网络请求
    const networkUtils = getServiceSafely('networkUtils', 'networkUtils');
    if (networkUtils) {
      networkUtils.cancelAll();
    }

    hideTranslationProgress();
    updateTranslationControlState();
    showNotification("info", "翻译已取消", "翻译过程已被用户取消");
  }
}

function pauseTranslation() {
  if (!AppState.translations.isInProgress) {
    showNotification("info", "无进行中的任务", "当前没有可暂停的翻译任务");
    return;
  }
  if (AppState.translations.isPaused) return;
  AppState.translations.isPaused = true;
  updateTranslationControlState();
  const { current, total } = AppState.translations.progress || {};
  updateProgress(current || 0, total || 0, "暂停中（等待当前请求完成）");
  addProgressLog({
    level: "warn",
    message: "已发送暂停请求，将在当前请求完成后暂停。",
  });
}

function resumeTranslation() {
  if (!AppState.translations.isInProgress) {
    showNotification("info", "无进行中的任务", "当前没有可继续的翻译任务");
    return;
  }
  if (!AppState.translations.isPaused) return;
  AppState.translations.isPaused = false;
  updateTranslationControlState();
  const { current, total } = AppState.translations.progress || {};
  updateProgress(current || 0, total || 0, "继续翻译...");
  addProgressLog({ level: "info", message: "继续翻译" });
}

async function retryFailedTranslations() {
  if (AppState.translations.isInProgress) {
    showNotification("warning", "任务进行中", "请先等待当前翻译任务完成");
    return;
  }

  const failedItems = Array.isArray(AppState.translations.lastFailedItems)
    ? AppState.translations.lastFailedItems.filter(Boolean)
    : [];
  if (failedItems.length === 0) {
    showNotification("info", "无失败项", "暂无可重试的翻译项");
    return;
  }

  const ctx = AppState.translations.lastBatchContext || {};
  const sourceLang = ctx.sourceLang || AppState.project?.sourceLanguage || "en";
  const targetLang = ctx.targetLang || AppState.project?.targetLanguage || "zh";
  const engine =
    ctx.engine ||
    DOMCache.get("translationEngine")?.value ||
    "deepseek";
  const selectedFile = ctx.selectedFile || AppState?.translations?.selectedFile;

  showTranslationProgress();
  updateProgress(0, failedItems.length, "准备重试...");

  AppState.translations.isInProgress = true;
  AppState.translations.isPaused = false;
  updateTranslationControlState();

    let translationCount = 0;
    const batchUpdateInterval = 20;
    const updateUIIfNeeded = () => {
      translationCount++;
      if (translationCount % batchUpdateInterval === 0) {
        // 使用统一的UI更新器（移除重复代码）
        if (typeof updateTranslationUI === 'function') {
          updateTranslationUI({
            selectedFile,
            shouldScroll: false,
            shouldFocusTextarea: false,
            preserveSelection: true,
            reason: '重试翻译进度更新'
          });
        } else {
          // 备用逻辑
          if (selectedFile) {
            rebuildFilteredTranslationItems({ selectedFile });
          } else {
            rebuildFilteredTranslationItems();
          }
          updateTranslationLists();
          updateCounters();
        }
      }
    };

  try {
    const { results, errors } = await translationService.translateBatch(
      failedItems,
      sourceLang,
      targetLang,
      engine,
      (completed, total, message) => {
        updateProgress(completed, total, message);
        updateUIIfNeeded();
      },
    );

    hideTranslationProgress();

    // 使用翻译结果处理器（V2 改进版）
    const resultHandler = getServiceSafely('translationResultHandler');

    if (resultHandler && typeof resultHandler.handleTranslationResults === 'function') {
      // 使用类方法处理结果
      resultHandler.handleTranslationResults(results, errors, engine, {
        successTitle: "重试完成",
        warningTitle: "重试部分完成",
        cancelTitle: "翻译已取消",
        operation: "retryFailedTranslations"
      });
    } else if (typeof handleTranslationResults === 'function') {
      // 使用全局函数处理结果
      handleTranslationResults(results, errors, engine, {
        successTitle: "重试完成",
        warningTitle: "重试部分完成",
        operation: "retryFailedTranslations"
      });
    } else {
      // 最后的备用逻辑（保持向后兼容）
      const actualErrors = errors.filter((e) => e.error !== "用户取消");
      const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
      AppState.translations.lastFailedItems = actualErrors
        .map((e) => e?.item)
        .filter(Boolean);

      if (!AppState.translations.isInProgress && cancelledCount > 0) {
        showNotification(
          "info",
          "翻译已取消",
          `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
        );
      } else if (actualErrors.length === 0) {
        showNotification(
          "success",
          "重试完成",
          `已成功翻译 ${results.length} 项`
        );
      } else {
        const firstErr = actualErrors[0];
        const f = formatTranslationError(firstErr, engine);
        showNotification(
          "warning",
          "重试部分完成",
          `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
        );
        showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
      }
    }

    autoSaveManager.markDirty();
    
    // 使用通用的UI更新函数（如果可用）
    if (typeof updateTranslationUI === 'function') {
      updateTranslationUI({
        selectedFile: selectedFile,
        shouldScroll: false,
        shouldFocusTextarea: false,
        reason: "重试翻译完成"
      });
    } else {
      // 降级到原有的UI更新逻辑
      if (selectedFile) {
        rebuildFilteredTranslationItems({ selectedFile });
      } else {
        rebuildFilteredTranslationItems();
      }
      updateTranslationLists();
      updateCounters();
      updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
    }
  } catch (error) {
    hideTranslationProgress();
    const f = formatTranslationError(error, engine);
    showSplitNotification(f.type, f.title, f.message, f.detail);
    (loggers.translation || console).error("重试翻译错误:", error);
  } finally {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    updateTranslationControlState();
  }
}

// 进度UI函数已拆分到 progress.js

// 翻译功能（使用真实API）
async function translateText(
  text,
  sourceLang = "en",
  targetLang = "zh",
  context = null,
) {
  if (!text || !text.trim()) {
    return text;
  }

  let engine = "deepseek";
  try {
    // 获取翻译引擎
    const settings = SettingsCache.get();
    engine = (
      settings.translationEngine ||
      settings.defaultEngine ||
      DOMCache.get("translationEngine")?.value ||
      "deepseek"
    ).toLowerCase();

    // 调用翻译服务（传递上下文）
    const translated = await translationService.translate(
      text,
      sourceLang,
      targetLang,
      engine,
      context,
    );
    return translated;
  } catch (error) {
    (loggers.translation || console).error("翻译失败:", error);

    const f = formatTranslationError(error, engine);
    showSplitNotification(f.type, f.title, f.message, f.detail);

    error.__notified = true;
    throw error;
  }
}

// 备用的模拟翻译功能（仅用于演示）
function mockTranslate(text) {
  // 简单的模拟翻译，当API调用失败时使用
  const translations = {
    "Welcome to our application": "欢迎使用我们的应用",
    "Please login to continue": "请登录以继续",
    "The API endpoint requires authentication.": "API端点需要身份验证。",
    "Please refer to the documentation for more details.":
      "请参考文档以获取更多详细信息。",
    "You have successfully updated your profile.": "您已成功更新个人资料。",
    "Please enter a valid email address.": "请输入有效的电子邮件地址。",
    "Hello, world!": "你好，世界！",
    "This is a sample XML file for demonstration purposes.":
      "这是一个用于演示目的的示例XML文件。",
    "This is a sample JSON file.": "这是一个示例JSON文件。",
    "Sample text from": "来自的示例文本",
  };

  // 检查是否有预定义的翻译
  for (const [key, value] of Object.entries(translations)) {
    if (text.includes(key)) {
      return text.replace(key, value);
    }
  }

  // 如果没有预定义的翻译，返回带有标记的原文
  return `[翻译] ${text}`;
}

// 导出翻译
