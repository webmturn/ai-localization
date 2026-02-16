// ==================== 翻译业务逻辑服务 ====================
/**
 * 翻译业务逻辑服务：纯业务逻辑，无UI依赖
 * 解决翻译功能模块高耦合问题，分离关注点
 */

/**
 * 翻译业务逻辑服务类
 */
class TranslationBusinessLogic {
  constructor(dependencies = {}) {
    this.appState = dependencies.appState;
    this.validators = dependencies.validators;
    this.translationService = dependencies.translationService;
    this.errorManager = dependencies.errorManager;
    this.autoSaveManager = dependencies.autoSaveManager;
  }
  
  /**
   * 验证翻译前提条件
   * @param {Object} options - 选项
   * @param {string} options.scope - 翻译范围 ('selected' | 'file' | 'all')
   * @returns {Object} 验证结果和待翻译项
   */
  validateTranslationPreconditions(options = {}) {
    const { scope = 'selected' } = options;
    
    try {
      // 基础验证
      if (this.validators) {
        this.validators.validateNotInProgress();
        this.validators.validateProjectExists();
        this.validators.validateTranslationItems();
      }
      
      // 根据范围进行特定验证
      let itemsToTranslate = [];
      
      if (scope === 'selected') {
        if (this.validators) {
          this.validators.validateItemSelected();
        }
        itemsToTranslate = this.getSelectedItems();
      } else if (scope === 'file') {
        if (this.validators) {
          this.validators.validateFileSelected();
        }
        itemsToTranslate = this.getFileItems();
      } else if (scope === 'all') {
        itemsToTranslate = this.getAllItems();
      }
      
      if (itemsToTranslate.length === 0) {
        throw new Error('没有找到需要翻译的项目');
      }
      
      return {
        success: true,
        items: itemsToTranslate,
        config: this.getTranslationConfig()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error,
        items: [],
        config: null
      };
    }
  }
  
  /**
   * 获取选中的翻译项
   */
  getSelectedItems() {
    if (!this.appState?.project?.translationItems) {
      return [];
    }
    
    const selectedIndices = (this.appState.translations.multiSelected || []).length > 0
      ? Array.from(new Set(this.appState.translations.multiSelected)).sort((a, b) => a - b)
      : [this.appState.translations.selected];
    
    return selectedIndices
      .map(idx => this.appState.project.translationItems[idx])
      .filter(Boolean);
  }
  
  /**
   * 获取当前文件的翻译项
   */
  getFileItems() {
    if (!this.appState?.project?.translationItems) {
      return [];
    }
    
    const selectedFile = this.appState?.translations?.selectedFile;
    if (!selectedFile) {
      return [];
    }
    
    return this.appState.project.translationItems
      .filter(item => item?.metadata?.file === selectedFile)
      .filter(item => item.status === 'pending');
  }
  
  /**
   * 获取所有翻译项
   */
  getAllItems() {
    if (!this.appState?.project?.translationItems) {
      return [];
    }
    
    return this.appState.project.translationItems
      .filter(item => item.status === 'pending');
  }
  
  /**
   * 获取翻译配置
   */
  getTranslationConfig() {
    const sourceLang = this.appState?.project?.sourceLanguage || 'en';
    const targetLang = this.appState?.project?.targetLanguage || 'zh';
    
    // 获取翻译引擎设置
    let engine = typeof EngineRegistry !== 'undefined' ? EngineRegistry.getDefaultEngineId() : 'deepseek';
    try {
      const settings = SettingsCache.get();
      engine = settings.translationEngine || settings.defaultEngine || (typeof EngineRegistry !== 'undefined' ? EngineRegistry.getDefaultEngineId() : 'deepseek');
    } catch (error) {
      // 使用默认引擎
    }
    
    return {
      sourceLang,
      targetLang,
      engine
    };
  }
  
  /**
   * 执行翻译操作
   * @param {Array} items - 要翻译的项目
   * @param {Object} config - 翻译配置
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Object>} 翻译结果
   */
  async executeTranslation(items, config, progressCallback) {
    try {
      // 验证引擎配置
      if (this.validators) {
        this.validators.validateEngineConfig(config.engine);
      }
      
      // 设置翻译状态
      this.setTranslationState({
        isInProgress: true,
        isPaused: false,
        _batchStarted: true,
        _batchCancelled: false,
        lastFailedItems: [],
        lastBatchContext: {
          scope: 'custom',
          sourceLang: config.sourceLang,
          targetLang: config.targetLang,
          engine: config.engine,
          selectedFile: this.appState?.translations?.selectedFile || null
        }
      });
      
      // 执行翻译
      const result = await this.translationService.translateBatch(
        items,
        config.sourceLang,
        config.targetLang,
        config.engine,
        progressCallback
      );
      
      // 处理翻译结果
      this.processTranslationResult(result);
      
      return {
        success: true,
        ...result
      };
      
    } catch (error) {
      this.handleTranslationError(error, config);
      return {
        success: false,
        error: error,
        results: [],
        errors: []
      };
    } finally {
      // 清理状态
      this.setTranslationState({
        isInProgress: false,
        isPaused: false
      });
    }
  }
  
  /**
   * 设置翻译状态
   * @param {Object} state - 状态对象
   */
  setTranslationState(state) {
    if (!this.appState?.translations) {
      return;
    }
    
    Object.keys(state).forEach(key => {
      this.appState.translations[key] = state[key];
    });
  }
  
  /**
   * 处理翻译结果
   * @param {Object} result - 翻译结果
   */
  processTranslationResult(result) {
    const { results, errors } = result;
    
    // 更新失败项列表
    const actualErrors = errors.filter(e => e.error !== "用户取消");
    this.setTranslationState({
      lastFailedItems: actualErrors.map(e => e?.item).filter(Boolean)
    });
    
    // 标记项目需要保存
    if (results.length > 0 && this.autoSaveManager) {
      this.autoSaveManager.markDirty();
    }
    
    // 更新项目时间戳
    if (this.appState?.project && results.length > 0) {
      this.appState.project.updatedAt = new Date();
    }
  }
  
  /**
   * 处理翻译错误
   * @param {Error} error - 错误对象
   * @param {Object} config - 翻译配置
   */
  handleTranslationError(error, config) {
    if (this.errorManager) {
      this.errorManager.handleError(error, {
        context: 'translation.business',
        engine: config?.engine,
        recoverable: true
      });
    } else {
      (loggers.translation || console).error('翻译业务逻辑错误:', error);
    }
  }
  
  /**
   * 取消翻译
   */
  cancelTranslation() {
    this.setTranslationState({
      isInProgress: false,
      isPaused: false,
      _batchCancelled: true,
      _batchStarted: false
    });
    
    // 取消网络请求
    if (this.translationService && typeof this.translationService.cancelAll === 'function') {
      this.translationService.cancelAll();
    }
  }
  
  /**
   * 暂停翻译
   */
  pauseTranslation() {
    if (!this.appState?.translations?.isInProgress) {
      return false;
    }
    
    if (this.appState.translations.isPaused) {
      return false;
    }
    
    this.setTranslationState({
      isPaused: true
    });
    
    return true;
  }
  
  /**
   * 恢复翻译
   */
  resumeTranslation() {
    if (!this.appState?.translations?.isInProgress || !this.appState?.translations?.isPaused) {
      return false;
    }
    
    this.setTranslationState({
      isPaused: false
    });
    
    return true;
  }
  
  /**
   * 重试失败的翻译
   * @param {Function} progressCallback - 进度回调
   */
  async retryFailedTranslations(progressCallback) {
    const failedItems = this.appState?.translations?.lastFailedItems || [];
    if (failedItems.length === 0) {
      throw new Error('没有失败的翻译项需要重试');
    }
    
    const config = this.getTranslationConfig();
    return this.executeTranslation(failedItems, config, progressCallback);
  }
  
  /**
   * 获取翻译统计信息
   */
  getTranslationStats() {
    if (!this.appState?.project?.translationItems) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0
      };
    }
    
    const items = this.appState.project.translationItems;
    const total = items.length;
    const completed = items.filter(item => item.status === 'completed' || (item.targetText && item.targetText.trim())).length;
    const pending = items.filter(item => item.status === 'pending').length;
    const failed = this.appState?.translations?.lastFailedItems?.length || 0;
    
    return {
      total,
      completed,
      pending,
      failed,
      completionRate: total > 0 ? (completed / total * 100).toFixed(1) : '0'
    };
  }
  
  /**
   * 清理翻译状态
   */
  cleanup() {
    this.cancelTranslation();
    this.setTranslationState({
      lastFailedItems: [],
      lastBatchContext: null
    });
  }
}

/**
 * 创建翻译业务逻辑服务工厂函数
 */
function createTranslationBusinessLogic(dependencies = {}) {
  return new TranslationBusinessLogic(dependencies);
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationBusinessLogic, createTranslationBusinessLogic };
} else {
  // 浏览器环境，暴露到全局
  window.TranslationBusinessLogic = TranslationBusinessLogic;
  window.createTranslationBusinessLogic = createTranslationBusinessLogic;
}
