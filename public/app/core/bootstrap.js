// ==================== 应用引导程序 ====================
/**
 * 应用引导程序：与新架构系统集成的启动逻辑
 * 负责DOM初始化、事件绑定和应用启动
 */

let __appDomInitialized = false;

/**
 * DOM内容加载完成后的初始化
 */
async function __onAppDomContentLoaded(bootstrapContext) {
  try {
    var uiBootstrapped = window.ArchDebug
      ? window.ArchDebug.getFlag('uiBootstrapped')
      : false;

    if (uiBootstrapped) return;

    if (window.ArchDebug) {
      window.ArchDebug.setFlag('uiBootstrapped', true, {
        mirrorWindow: false,
      });
    }
  } catch (_) {
    (loggers.startup || console).debug("bootstrap ArchDebug appDomInitialized check:", _);
  }

  if (__appDomInitialized) return;
  __appDomInitialized = true;

  try {
    if (window.ArchDebug) {
      window.ArchDebug.setFlag('appBootstrapContext', bootstrapContext || null, {
        windowKey: '__appBootstrapContext',
        mirrorWindow: false,
      });
    }
  } catch (_) {
    (loggers.startup || console).debug("bootstrap ArchDebug setFlag appDomInitialized:", _);
  }

  (loggers.startup || console).info('🚀 开始应用DOM初始化...');

  try {
    let architectureReady = false;

    // 等待架构系统就绪
    if (typeof waitForArchitecture === 'function') {
      try {
        await waitForArchitecture(5000);
        architectureReady = true;
        (loggers.startup || console).info('✅ 架构系统就绪');
      } catch (error) {
        (loggers.startup || console).warn('⚠️ 架构系统等待超时，继续使用降级服务:', error);
      }
    }

    if (!architectureReady) {
      try {
        if (typeof integrateWithArchitecture === 'function') {
          integrateWithArchitecture();
        } else if (typeof registerFallbackCoreServices === 'function') {
          registerFallbackCoreServices();
        }
      } catch (fallbackError) {
        (loggers.startup || console).warn('⚠️ 降级服务注册失败:', fallbackError);
      }

      try {
        initializeFallbackServices();
      } catch (fallbackError) {
        (loggers.startup || console).warn('⚠️ 降级服务初始化失败:', fallbackError);
      }
    }
    
    // 清理所有缓存
    if (typeof DOMCache !== 'undefined') {
      DOMCache.clear();
    }
    
    // 初始化核心事件监听器
    initializeCoreEventListeners();
    
    // 多标签页检测
    setupMultiTabDetection();
    
    // 初始化应用状态
    initializeApplicationState();
    
    // 启动应用服务
    await startApplicationServices();
    
    (loggers.startup || console).info('✅ 应用DOM初始化完成');
    
  } catch (error) {
    (loggers.startup || console).error('❌ 应用DOM初始化失败:', error);
    
    // 即使初始化失败，也尝试基本的事件绑定
    try {
      initializeCoreEventListeners();
    } catch (fallbackError) {
      (loggers.startup || console).error('❌ 基本事件绑定也失败:', fallbackError);
    }
  }
}

/**
 * 初始化核心事件监听器
 */
function initializeCoreEventListeners() {
  // 获取事件管理器
  const eventManager = window.getService ? window.getService('eventManager') : window.EventManager;
  
  if (!eventManager) {
    (loggers.startup || console).warn('⚠️ 事件管理器未找到，使用原生事件绑定');
    initializeFallbackEventListeners();
    return;
  }
  
  // 添加窗口大小变化监听（使用节流优化）
  eventManager.add(
    window,
    "resize",
    function () {
      // 使用架构系统获取函数
      const syncHeights = window.getFromNamespace?.('App.ui.syncHeights') || 
                         window.throttledSyncHeights;
      
      if (typeof syncHeights === "function") {
        return syncHeights.apply(this, arguments);
      }
    },
    { tag: "app", scope: "lifecycle", label: "window:resize" }
  );

  // 页面可见性变化时重新同步
  eventManager.add(
    document,
    "visibilitychange",
    () => {
      if (!document.hidden) {
        const syncHeights = window.getFromNamespace?.('App.ui.debouncedSyncHeights') || 
                           window.debouncedSyncHeights;
        
        if (typeof syncHeights === "function") {
          syncHeights();
        }
      }
    },
    { tag: "app", scope: "lifecycle", label: "document:visibilitychange" }
  );

  // 页面卸载时清理资源（防止内存泄漏）
  eventManager.add(
    window,
    "beforeunload",
    () => {
      (loggers.startup || console).debug("🧹 页面卸载，清理资源...");
      cleanupApplicationResources();
    },
    { tag: "app", scope: "lifecycle", label: "window:beforeunload" }
  );

  // 添加点击外部关闭搜索结果面板的事件
  eventManager.add(
    document,
    "click",
    function (e) {
      const searchInput = DOMCache?.get("searchInput");
      const searchResultsPanel = DOMCache?.get("searchResultsPanel");

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

/**
 * 初始化备用事件监听器（当事件管理器不可用时）
 */
function initializeFallbackEventListeners() {
  (loggers.startup || console).info('🔄 使用备用事件监听器');
  
  // 基本的窗口大小变化监听
  window.addEventListener('resize', function() {
    if (typeof throttledSyncHeights === "function") {
      throttledSyncHeights();
    }
  });
  
  // 基本的页面可见性变化监听
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && typeof debouncedSyncHeights === "function") {
      debouncedSyncHeights();
    }
  });
  
  // 基本的页面卸载监听
  window.addEventListener('beforeunload', function() {
    (loggers.startup || console).debug("🧹 页面卸载，清理资源...");
    cleanupApplicationResources();
  });
}

/**
 * 初始化应用状态
 */
function initializeApplicationState() {
  (loggers.startup || console).info('📊 初始化应用状态...');
  
  try {
    // 使用依赖注入获取应用状态
    const appState = getServiceSafely('appState', 'AppState');
    
    // 确保基本状态结构存在
    if (!appState.translations) {
      appState.translations = {
        items: [],
        selected: -1,
        selectedFile: null,
        currentPage: 1,
        filtered: [],
        searchQuery: "",
        isInProgress: false,
        isPaused: false,
        lastFailedItems: []
      };
    }
    
    if (!appState.settings) {
      appState.settings = {
        translation: {}
      };
    }
    
    if (!appState.fileMetadata) {
      appState.fileMetadata = {};
    }
    
    (loggers.startup || console).info('✅ 应用状态初始化完成');
  } catch (error) {
    (loggers.startup || console).error('❌ 应用状态初始化失败:', error);
    
    // 备用方案：创建基本的全局状态
    if (typeof window.AppState === 'undefined') {
      (loggers.startup || console).warn('⚠️ AppState未定义，创建基本状态');
      window['AppState'] = {
        project: null,
        translations: {
          items: [],
          selected: -1,
          selectedFile: null,
          currentPage: 1,
          filtered: [],
          searchQuery: "",
          isInProgress: false,
          isPaused: false,
          lastFailedItems: []
        },
        settings: {
          translation: {}
        },
        fileMetadata: {}
      };
    }
  }
}

/**
 * 启动应用服务（使用新的服务启动管理器）
 */
async function startApplicationServices() {
  (loggers.startup || console).info('🔧 启动应用服务...');

  try {
    // 确保所有服务已注册到DI容器
    registerAllServices();

    const architectureInitialized = window.ArchDebug
      ? window.ArchDebug.getFlag('architectureInitialized')
      : window.Architecture?.initializer?.initialized;
    const diMissingCore =
      !window.diContainer ||
      !window.diContainer.has('errorManager') ||
      !window.diContainer.has('appState');

    if (!architectureInitialized && diMissingCore && typeof initializeCoreServices === 'function') {
      try {
        await initializeCoreServices();
      } catch (error) {
        (loggers.startup || console).warn('⚠️ 服务启动管理器初始化失败:', error);
      }
    }

    // 初始化事件监听器（UI层）
    if (typeof initEventListeners === 'function') {
      initEventListeners();
    }

    // 加载保存的设置
    if (typeof loadSettings === 'function') {
      await loadSettings();
    }

    if (
      typeof storageManager !== 'undefined' &&
      storageManager?.loadPreferredBackendFromSettings
    ) {
      storageManager.loadPreferredBackendFromSettings();
    }
    if (typeof window.updateStorageBackendStatus === 'function') {
      window.updateStorageBackendStatus();
    }

    // 初始化UI组件
    if (typeof initializeUI === 'function') {
      initializeUI();
    }

    // 初始化项目数据（恢复保存的项目或加载示例项目）
    await initializeProjectData();

    (loggers.startup || console).info('✅ 应用服务启动完成');
  } catch (error) {
    (loggers.startup || console).error('❌ 应用服务启动失败:', error);

    // 记录错误到架构助手（如果存在）
    if (typeof getArchitectureHelpers === 'function') {
      const helpers = getArchitectureHelpers();
      helpers.logError(error, {
        context: 'startApplicationServices',
      });
    }

    // 降级：确保基本功能可用
    initializeFallbackServices();
  }
}

/**
 * 注册所有核心服务到DI容器
 * 这是应用的主要服务注册入口
 */
function registerAllServices() {
  if (!window.diContainer) {
    (loggers.startup || console).warn('⚠️ DI容器不可用，跳过服务注册');
    return;
  }
  
  const logger = window.loggers?.startup || console;
  logger.debug?.('📦 开始注册所有服务...');

  try {
    // ============ 核心服务 ============

    // 注册应用状态（最基础的服务）
    if (!window.diContainer.has('appState')) {
      window.diContainer.registerSingleton('appState', () => window.AppState, {
        tags: ['core', 'state']
      });
    }

    // 注册错误管理器
    if (!window.diContainer.has('errorManager')) {
      window.diContainer.registerSingleton('errorManager', () => {
        if (!window.errorManager && typeof ErrorManager !== 'undefined') {
          window.errorManager = new ErrorManager();
        }
        return window.errorManager;
      }, {
        tags: ['core', 'error']
      });
    }

    // 注册日志系统
    if (!window.diContainer.has('logger')) {
      window.diContainer.registerSingleton('logger', () => window.loggers || console, {
        tags: ['core', 'logging']
      });
    }

    // ============ 存储服务 ============

    // 注册存储管理器
    if (!window.diContainer.has('storageManager')) {
      window.diContainer.registerSingleton('storageManager', () => window.storageManager, {
        dependencies: ['errorManager'],
        tags: ['storage', 'persistence']
      });
    }

    // 注册自动保存管理器
    if (!window.diContainer.has('autoSaveManager')) {
      window.diContainer.registerSingleton('autoSaveManager', () => window.autoSaveManager, {
        dependencies: ['storageManager', 'appState'],
        tags: ['storage', 'autosave']
      });
    }

    // backupSyncManager 已移至开发模式按需加载

    // ============ 翻译服务 ============

    // 注册翻译服务
    if (!window.diContainer.has('translationService')) {
      window.diContainer.registerSingleton('translationService', () => window.translationService, {
        dependencies: ['errorManager', 'networkUtils', 'storageManager'],
        tags: ['translation', 'api']
      });
    }

    // 注册翻译业务逻辑
    if (!window.diContainer.has('translationBusinessLogic')) {
      window.diContainer.registerSingleton('translationBusinessLogic', () => {
        return window.translationBusinessLogic;
      }, {
        dependencies: ['appState', 'translationService', 'errorManager'],
        tags: ['translation', 'business']
      });
    }

    // 注册翻译UI控制器
    if (!window.diContainer.has('translationUIController')) {
      window.diContainer.registerSingleton('translationUIController', () => {
        return window.translationUIController;
      }, {
        dependencies: ['appState', 'translationBusinessLogic'],
        tags: ['translation', 'ui']
      });
    }

    // 注册翻译结果处理器
    if (!window.diContainer.has('translationResultHandler')) {
      window.diContainer.registerFactory('translationResultHandler', () => {
        if (typeof getTranslationResultHandler === 'function') {
          return getTranslationResultHandler();
        }
        return window.TranslationResultHandler;
      }, {
        dependencies: ['appState', 'errorManager'],
        tags: ['translation', 'results']
      });
    }

    // 注册翻译UI更新器
    if (!window.diContainer.has('translationUIUpdater')) {
      window.diContainer.registerFactory('translationUIUpdater', () => {
        return window.TranslationUIUpdater;
      }, {
        tags: ['translation', 'ui']
      });
    }

    // ============ 验证器服务 ============

    // 注册通用验证器
    if (!window.diContainer.has('universalValidators')) {
      window.diContainer.registerFactory('universalValidators', () => {
        if (typeof getUniversalValidators === 'function') {
          return getUniversalValidators();
        }
        if (typeof window.UniversalValidators === 'function') {
          return new window.UniversalValidators();
        }
        return null;
      }, {
        dependencies: ['appState', 'errorManager'],
        tags: ['validation', 'core']
      });
    }

    // 注册翻译验证器
    if (!window.diContainer.has('translationValidators')) {
      window.diContainer.registerFactory('translationValidators', () => window.TranslationValidators, {
        tags: ['validation', 'translation']
      });
    }

    // ============ DOM和UI服务 ============

    // 注册DOM优化管理器
    if (!window.diContainer.has('domOptimizationManager')) {
      window.diContainer.registerSingleton('domOptimizationManager', () => window.domOptimizationManager, {
        tags: ['dom', 'performance']
      });
    }

    // 注册DOM缓存
    if (!window.diContainer.has('domCache')) {
      window.diContainer.registerSingleton('domCache', () => window.DOMCache, {
        tags: ['dom', 'cache']
      });
    }

    // 注册事件管理器
    if (!window.diContainer.has('eventManager')) {
      window.diContainer.registerSingleton('eventManager', () => {
        // EventManager 是对象字面量（单例），不是 class，不能 new
        if (!window.eventManager && typeof EventManager !== 'undefined') {
          window.eventManager = EventManager;
        }
        return window.eventManager;
      }, {
        tags: ['events', 'core']
      });
    }

    // 注册事件绑定管理器（已移至可选加载，仅在存在时注册）
    if (!window.diContainer.has('eventBindingManager') && typeof window.eventBindingManager !== 'undefined') {
      window.diContainer.registerSingleton('eventBindingManager', () => window.eventBindingManager, {
        dependencies: ['eventManager'],
        tags: ['events', 'binding']
      });
    }

    // 注册通知服务
    if (!window.diContainer.has('notificationService')) {
      window.diContainer.registerSingleton('notificationService', () => ({
        show: window.showNotification || console.log,
        showSplit: window.showSplitNotification || console.log,
        close: window.closeNotification || (() => {})
      }), {
        tags: ['ui', 'notification']
      });
    }

    // ============ 网络和性能服务 ============

    // 注册网络工具
    if (!window.diContainer.has('networkUtils')) {
      window.diContainer.registerSingleton('networkUtils', () => {
        return window.networkUtilsV2 || window.NetworkUtils || window.networkUtils;
      }, {
        dependencies: ['errorManager'],
        tags: ['network', 'http']
      });
    }

    // 注册性能监控器
    if (!window.diContainer.has('performanceMonitor')) {
      window.diContainer.registerSingleton('performanceMonitor', () => {
        if (!window.performanceMonitor && typeof PerformanceMonitor !== 'undefined') {
          window.performanceMonitor = new PerformanceMonitor();
        }
        return window.performanceMonitor;
      }, {
        tags: ['performance', 'monitoring']
      });
    }

    // runtimeTypeChecker 已移至开发模式按需加载

    logger.debug?.('✅ 所有服务注册完成');

    // 输出注册摘要
    const serviceCount = window.diContainer.services?.size || 0;
    logger.info?.(`📦 共注册 ${serviceCount} 个服务`);

  } catch (error) {
    (loggers.startup || console).error('❌ 服务注册失败:', error);
    throw error;
  }
}

/**
 * 向后兼容的备用函数
 */
function registerFallbackCoreServices() {
  registerAllServices();
}

/**
 * 启动核心服务
 */
async function startCoreServices() {
  (loggers.startup || console).info('⚙️ 启动核心服务...');
  
  // 核心服务列表（按依赖顺序）
  const services = [
    'errorManager',
    'appState', 
    'storageManager',
    'translationService',
    'domOptimizationManager',
    'performanceMonitor',
    'eventManager',
    'networkUtils',
    'autoSaveManager',
    'domCache'
  ];
  
  for (const serviceName of services) {
    try {
      const service = getServiceSafely(serviceName, null);
      
      // 如果服务有初始化方法，调用它
      if (service && typeof service.initialize === 'function') {
        await service.initialize();
      }
      
      (loggers.startup || console).debug(`✅ 服务 ${serviceName} 启动成功`);
    } catch (error) {
      (loggers.startup || console).warn(`⚠️ 服务 ${serviceName} 启动失败:`, error);
    }
  }
}

/**
 * 初始化备用服务（当架构系统不可用时）
 */
function initializeFallbackServices() {
  (loggers.startup || console).info('🔄 初始化备用服务...');
  
  // 确保基本的错误处理可用
  if (!window.errorManager && typeof ErrorManager !== 'undefined') {
    window.errorManager = new ErrorManager();
  }
  
  // 确保基本的验证器可用
  if (!window.TranslationValidators && typeof TranslationValidators !== 'undefined') {
    // 验证器已通过脚本加载
  }
  
  // 确保基本的结果处理器可用
  if (!window.handleTranslationResults && typeof handleTranslationResults !== 'undefined') {
    // 结果处理器已通过脚本加载
  }
}

/**
 * 初始化项目数据
 */
async function initializeProjectData() {
  try {
    // 尝试恢复项目
    let restoredProject = null;
    
    if (typeof autoSaveManager !== 'undefined' && autoSaveManager.restoreProject) {
      restoredProject = await autoSaveManager.restoreProject();
    }
    
    if (restoredProject) {
      // 恢复项目数据
      AppState.project = restoredProject;
      AppState.translations.items = restoredProject.translationItems || [];
      AppState.project.translationItems = AppState.translations.items;
      AppState.fileMetadata = restoredProject.fileMetadata || {};

      // 恢复文件元数据
      if (typeof hydrateFileMetadataContentKeys === 'function') {
        hydrateFileMetadataContentKeys(AppState.project?.id);
      }

      // 重置状态
      AppState.translations.selected = -1;
      AppState.translations.currentPage = 1;
      AppState.translations.filtered = [...AppState.translations.items];
      AppState.translations.searchQuery = "";

      // 设置语言选择器
      const sourceLanguageEl = DOMCache.get("sourceLanguage");
      const targetLanguageEl = DOMCache.get("targetLanguage");
      if (sourceLanguageEl) {
        sourceLanguageEl.value = restoredProject.sourceLanguage || "en";
      }
      if (targetLanguageEl) {
        targetLanguageEl.value = restoredProject.targetLanguage || "zh";
      }

      // 更新UI
      if (typeof updateFileTree === 'function') updateFileTree();
      if (typeof updateTranslationLists === 'function') updateTranslationLists();
      if (typeof updateCounters === 'function') updateCounters();
      
      if (typeof showNotification === 'function') {
        showNotification(
          "success",
          "项目已恢复",
          `已从本地存储恢复项目 "${restoredProject.name || "未命名"}"`
        );
      }
    } else {
      // 加载示例项目
      if (typeof loadSampleProject === 'function') {
        loadSampleProject();
      }
    }
  } catch (error) {
    (loggers.startup || console).error('❌ 初始化项目数据失败:', error);
    
    // 加载示例项目作为备用
    if (typeof loadSampleProject === 'function') {
      try {
        loadSampleProject();
      } catch (fallbackError) {
        (loggers.startup || console).error('❌ 加载示例项目也失败:', fallbackError);
      }
    }
  }
}

/**
 * 清理应用资源
 */
function cleanupApplicationResources() {
  try {
    // 清理事件管理器（使用 getServiceSafely 避免抛异常中断后续清理）
    const eventManager = window.getServiceSafely ? window.getServiceSafely('eventManager', 'EventManager') : window.EventManager;
    if (eventManager && typeof eventManager.removeAll === 'function') {
      eventManager.removeAll();
    }

    // 清理DOM缓存
    if (typeof DOMCache !== 'undefined' && DOMCache.clear) {
      DOMCache.clear();
    }

    // 取消所有正在进行的翻译请求（使用 getServiceSafely 避免抛异常中断后续清理）
    const translationService = window.getServiceSafely ? window.getServiceSafely('translationService', 'translationService') : window.translationService;
    if (translationService && typeof translationService.cancelAll === 'function') {
      translationService.cancelAll();
    }

    // 停止自动保存
    if (typeof autoSaveManager !== 'undefined' && autoSaveManager.stop) {
      autoSaveManager.stop();
    }

    // 关闭多标签页检测频道
    if (window.__multiTabChannel) {
      try { window.__multiTabChannel.close(); } catch (_) { /* channel close - safe to ignore */ }
      window.__multiTabChannel = null;
    }

    // 清理命名空间管理器（停止全局变量监控定时器）
    if (window.namespaceManager && typeof window.namespaceManager.cleanup === 'function') {
      window.namespaceManager.cleanup();
    }

    // 清理模块系统
    if (window.moduleManager && typeof window.moduleManager.cleanup === 'function') {
      window.moduleManager.cleanup();
    }

    // 清理依赖注入容器
    if (window.diContainer && typeof window.diContainer.dispose === 'function') {
      window.diContainer.dispose();
    }

    (loggers.startup || console).debug('✅ 应用资源清理完成');
    
  } catch (error) {
    (loggers.startup || console).error('❌ 清理应用资源失败:', error);
  }
}

/**
 * 多标签页检测（防止 FileSystem 存储竞态）
 */
function setupMultiTabDetection() {
  try {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel('xml-translator-tab-sync');
    let otherTabWarned = false;

    channel.onmessage = (event) => {
      if (event.data?.type === 'tab-ping') {
        // 收到其他标签页的探测，回复确认
        channel.postMessage({ type: 'tab-pong' });
      }
      if (event.data?.type === 'tab-pong' && !otherTabWarned) {
        otherTabWarned = true;
        if (typeof showNotification === 'function') {
          showNotification(
            'warning',
            '多标签页提醒',
            '检测到其他标签页正在使用本应用，同时编辑可能导致数据不同步。建议仅在一个标签页中操作。'
          );
        }
      }
    };

    // 发送探测消息
    channel.postMessage({ type: 'tab-ping' });

    // 页面卸载时关闭频道
    window.addEventListener('beforeunload', () => {
      channel.close();
    });

    window.__multiTabChannel = channel;
  } catch (error) {
    (loggers.startup || console).debug('多标签页检测初始化失败:', error);
  }
}

/**
 * 应用启动入口点
 */
window.__appBootstrap = __onAppDomContentLoaded;