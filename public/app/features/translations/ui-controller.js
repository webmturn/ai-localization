// ==================== 翻译UI控制器 ====================
/**
 * 翻译UI控制器：负责翻译功能的UI交互逻辑
 * 与业务逻辑分离，专注于用户界面的控制和更新
 */

/**
 * 翻译UI控制器类
 */
class TranslationUIController {
  constructor(dependencies = {}) {
    this.businessLogic = dependencies.businessLogic;
    this.resultHandler = dependencies.resultHandler;
    this.uiUpdater = dependencies.uiUpdater;
    this.notificationService = dependencies.notificationService;
    this.progressUI = dependencies.progressUI;
    this.eventManager = dependencies.eventManager;
    
    this.isInitialized = false;
    this.currentTranslation = null;
  }
  
  /**
   * 初始化控制器
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }
    
    this.bindEventListeners();
    this.isInitialized = true;
    (loggers.app || console).debug('翻译UI控制器已初始化');
  }
  
  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 监听翻译控制按钮
    this.bindTranslationControls();
    
    // 监听翻译状态变化
    this.bindStateChanges();
    
    // 监听UI更新事件
    this.bindUIEvents();
  }
  
  /**
   * 绑定翻译控制相关事件
   */
  bindTranslationControls() {
    // 翻译选中项
    const translateSelectedBtn = DOMCache.get('translateSelected');
    if (translateSelectedBtn && this.eventManager) {
      this.eventManager.add(translateSelectedBtn, 'click', () => {
        this.handleTranslateSelected();
      }, { tag: 'translation', label: 'translateSelected' });
    }
    
    // 翻译全部
    const translateAllBtn = DOMCache.get('translateAll');
    if (translateAllBtn && this.eventManager) {
      this.eventManager.add(translateAllBtn, 'click', () => {
        this.handleTranslateAll();
      }, { tag: 'translation', label: 'translateAll' });
    }
    
    // 取消翻译
    const cancelBtn = DOMCache.get('cancelTranslation');
    if (cancelBtn && this.eventManager) {
      this.eventManager.add(cancelBtn, 'click', () => {
        this.handleCancelTranslation();
      }, { tag: 'translation', label: 'cancelTranslation' });
    }
    
    // 暂停翻译
    const pauseBtn = DOMCache.get('pauseTranslation');
    if (pauseBtn && this.eventManager) {
      this.eventManager.add(pauseBtn, 'click', () => {
        this.handlePauseTranslation();
      }, { tag: 'translation', label: 'pauseTranslation' });
    }
  }
  
  /**
   * 绑定状态变化事件
   */
  bindStateChanges() {
    // 监听翻译状态变化
    const em = this.eventManager || (typeof EventManager !== 'undefined' ? EventManager : null);
    if (em) {
      em.add(window, 'translationStateChanged', (event) => {
        this.handleStateChange(event.detail);
      }, { tag: 'translation', label: 'window:translationStateChanged' });
      
      // 监听翻译进度变化
      em.add(window, 'translationProgressChanged', (event) => {
        this.handleProgressChange(event.detail);
      }, { tag: 'translation', label: 'window:translationProgressChanged' });
    }
  }
  
  /**
   * 绑定UI事件
   */
  bindUIEvents() {
    // 监听窗口可见性变化
    if (document && this.eventManager) {
      this.eventManager.add(document, 'visibilitychange', () => {
        if (!document.hidden && this.currentTranslation) {
          this.refreshTranslationStatus();
        }
      }, { tag: 'translation', label: 'visibilitychange' });
    }
  }
  
  /**
   * 处理翻译选中项
   */
  async handleTranslateSelected() {
    try {
      await this.executeTranslation('selected');
    } catch (error) {
      this.handleError(error, '翻译选中项');
    }
  }
  
  /**
   * 处理翻译全部
   */
  async handleTranslateAll() {
    try {
      await this.executeTranslation('file');
    } catch (error) {
      this.handleError(error, '翻译全部');
    }
  }
  
  /**
   * 执行翻译操作
   * @param {string} scope - 翻译范围
   */
  async executeTranslation(scope) {
    // 验证前提条件
    const validation = this.businessLogic.validateTranslationPreconditions({ scope });
    if (!validation.success) {
      this.showValidationError(validation.error);
      return;
    }
    
    // 显示进度UI
    this.showTranslationProgress(validation.items.length);
    
    // 更新翻译控制状态
    this.updateTranslationControlState(true);
    
    try {
      // 执行翻译
      this.currentTranslation = {
        scope,
        items: validation.items,
        config: validation.config,
        startTime: Date.now()
      };
      
      const result = await this.businessLogic.executeTranslation(
        validation.items,
        validation.config,
        (completed, total, message) => {
          this.updateProgress(completed, total, message);
        }
      );
      
      // 处理结果
      this.handleTranslationResult(result);
      
    } finally {
      // 清理UI状态
      this.hideTranslationProgress();
      this.updateTranslationControlState(false);
      this.currentTranslation = null;
    }
  }
  
  /**
   * 处理取消翻译
   */
  handleCancelTranslation() {
    if (!this.currentTranslation) {
      return;
    }
    
    this.businessLogic.cancelTranslation();
    this.showNotification('info', '翻译已取消', '翻译过程已被用户取消');
  }
  
  /**
   * 处理暂停翻译
   */
  handlePauseTranslation() {
    if (!this.currentTranslation) {
      return;
    }
    
    const success = this.businessLogic.pauseTranslation();
    if (success) {
      this.showNotification('info', '翻译已暂停', '翻译将在当前请求完成后暂停');
    }
  }
  
  /**
   * 处理翻译结果
   * @param {Object} result - 翻译结果
   */
  handleTranslationResult(result) {
    if (!result.success) {
      this.handleError(result.error, '翻译执行');
      return;
    }
    
    // 使用结果处理器
    if (this.resultHandler && this.resultHandler.handleResults) {
      this.resultHandler.handleResults(result.results, result.errors, this.currentTranslation.config.engine, {
        successTitle: "翻译完成",
        warningTitle: "翻译部分完成",
        operation: `translate_${this.currentTranslation.scope}`
      });
    } else {
      // 备用结果处理
      this.showBasicResult(result);
    }
    
    // 更新UI
    this.updateUI();
  }
  
  /**
   * 显示基本结果（备用方案）
   * @param {Object} result - 翻译结果
   */
  showBasicResult(result) {
    const { results, errors } = result;
    const actualErrors = errors.filter(e => e.error !== "用户取消");
    
    if (actualErrors.length === 0) {
      this.showNotification("success", "翻译完成", `已成功翻译 ${results.length} 项`);
    } else {
      this.showNotification("warning", "翻译部分完成", `成功 ${results.length} 项，失败 ${actualErrors.length} 项`);
    }
  }
  
  /**
   * 显示验证错误
   * @param {Error} error - 验证错误
   */
  showValidationError(error) {
    const message = error.userMessage || error.message || "验证失败";
    this.showNotification("warning", "操作被阻止", message);
  }
  
  /**
   * 显示翻译进度
   * @param {number} totalItems - 总项数
   */
  showTranslationProgress(totalItems) {
    if (typeof showTranslationProgress === 'function') {
      showTranslationProgress();
    }
    
    this.updateProgress(0, totalItems, "准备翻译...");
  }
  
  /**
   * 隐藏翻译进度
   */
  hideTranslationProgress() {
    if (typeof hideTranslationProgress === 'function') {
      hideTranslationProgress();
    }
  }
  
  /**
   * 更新进度
   * @param {number} completed - 已完成数
   * @param {number} total - 总数
   * @param {string} message - 状态消息
   */
  updateProgress(completed, total, message) {
    if (typeof updateProgress === 'function') {
      updateProgress(completed, total, message);
    }
    
    // 触发进度事件
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent('translationProgressChanged', {
        detail: { completed, total, message }
      });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * 更新翻译控制状态
   * @param {boolean} isInProgress - 是否正在进行
   */
  updateTranslationControlState(isInProgress) {
    if (typeof updateTranslationControlState === 'function') {
      updateTranslationControlState();
    }
    
    // 直接更新按钮状态
    const translateBtn = DOMCache.get('translateSelected');
    const translateAllBtn = DOMCache.get('translateAll');
    const cancelBtn = DOMCache.get('cancelTranslation');
    const pauseBtn = DOMCache.get('pauseTranslation');
    
    if (translateBtn) translateBtn.disabled = isInProgress;
    if (translateAllBtn) translateAllBtn.disabled = isInProgress;
    if (cancelBtn) cancelBtn.style.display = isInProgress ? 'block' : 'none';
    if (pauseBtn) pauseBtn.style.display = isInProgress ? 'block' : 'none';
  }
  
  /**
   * 更新UI
   */
  updateUI() {
    if (this.uiUpdater && this.uiUpdater.update) {
      this.uiUpdater.update({ reason: "翻译完成" });
    } else if (typeof updateTranslationUI === 'function') {
      updateTranslationUI({ reason: "翻译完成" });
    }
  }
  
  /**
   * 处理状态变化
   * @param {Object} state - 状态信息
   */
  handleStateChange(state) {
    // 响应翻译状态变化
    if (state.isInProgress !== undefined) {
      this.updateTranslationControlState(state.isInProgress);
    }
  }
  
  /**
   * 处理进度变化
   * @param {Object} progress - 进度信息
   */
  handleProgressChange(progress) {
    // 可以在这里添加额外的进度UI更新逻辑
    (loggers.app || console).debug('翻译进度更新:', progress);
  }
  
  /**
   * 刷新翻译状态
   */
  refreshTranslationStatus() {
    const stats = this.businessLogic.getTranslationStats();
    (loggers.app || console).debug('翻译统计:', stats);
    
    // 可以在这里更新状态显示
  }
  
  /**
   * 显示通知
   * @param {string} type - 类型
   * @param {string} title - 标题
   * @param {string} message - 消息
   */
  showNotification(type, title, message) {
    if (this.notificationService && this.notificationService.show) {
      this.notificationService.show(type, title, message);
    } else if (typeof showNotification === 'function') {
      showNotification(type, title, message);
    } else {
      (loggers.app || console).info(`${type.toUpperCase()}: ${title} - ${message}`);
    }
  }
  
  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {string} context - 上下文
   */
  handleError(error, context) {
    (loggers.app || console).error(`翻译UI错误 (${context}):`, error);
    
    const message = error.userMessage || error.message || "未知错误";
    this.showNotification("error", `${context}失败`, message);
  }
  
  /**
   * 获取翻译统计信息（用于UI显示）
   */
  getStats() {
    return this.businessLogic.getTranslationStats();
  }
  
  /**
   * 重试失败的翻译
   */
  async retryFailedTranslations() {
    try {
      this.showTranslationProgress(0); // 暂时显示未知数量
      
      const result = await this.businessLogic.retryFailedTranslations((completed, total, message) => {
        this.updateProgress(completed, total, message);
      });
      
      this.handleTranslationResult(result);
      
    } catch (error) {
      this.handleError(error, '重试翻译');
    } finally {
      this.hideTranslationProgress();
    }
  }
  
  /**
   * 清理控制器
   */
  cleanup() {
    if (this.eventManager) {
      this.eventManager.removeByTag('translation');
    }
    
    this.businessLogic.cleanup();
    this.currentTranslation = null;
    this.isInitialized = false;
    
    (loggers.app || console).debug('翻译UI控制器已清理');
  }
}

/**
 * 创建翻译UI控制器工厂函数
 */
function createTranslationUIController(dependencies = {}) {
  return new TranslationUIController(dependencies);
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationUIController, createTranslationUIController };
} else {
  // 浏览器环境，暴露到全局
  window.TranslationUIController = TranslationUIController;
  window.createTranslationUIController = createTranslationUIController;
}
