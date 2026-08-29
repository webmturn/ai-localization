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

      // 批量进度态经 BatchProgressStore（beginBatch 复位取消协议并写入上下文）
      BatchProgressStore.beginBatch({
        scope: 'custom',
        sourceLang: config.sourceLang,
        targetLang: config.targetLang,
        engine: config.engine,
        selectedFile: this.appState?.translations?.selectedFile || null
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
      BatchProgressStore.endBatch();
    }
  }
  
  /**
   * 设置翻译状态（兼容入口：批量进度态迁移至 BatchProgressStore 后，
   * 本方法仅保留 lastFailedItems 一类语义；新代码请直接使用 BatchProgressStore）
   * @param {Object} state - 状态对象
   */
  setTranslationState(state) {
    if (!this.appState?.translations) {
      return;
    }

    if (Array.isArray(state?.lastFailedItems)) {
      BatchProgressStore.recordFailedItems(state.lastFailedItems);
    }
  }

  /**
   * 处理翻译结果
   * @param {Object} result - 翻译结果
   */
  processTranslationResult(result) {
    const { results, errors } = result;

    // 更新失败项列表（经 BatchProgressStore）
    const actualErrors = errors.filter(e => e.error !== "用户取消");
    BatchProgressStore.recordFailedItems(
      actualErrors.map(e => e?.item).filter(Boolean)
    );

    // 标记项目需要保存
    if (results.length > 0 && this.autoSaveManager) {
      this.autoSaveManager.markDirty();
    }
    if (results.length > 0 && typeof invalidateSearchCache === "function") {
      invalidateSearchCache();
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
    // 批量进度态经 BatchProgressStore（cancelBatch 置取消协议标记）
    BatchProgressStore.cancelBatch();

    // 取消网络请求
    if (this.translationService && typeof this.translationService.cancelAll === 'function') {
      this.translationService.cancelAll();
    }
  }
  
  /**
   * 暂停翻译
   */
  pauseTranslation() {
    if (!BatchProgressStore.isBatchInProgress()) {
      return false;
    }

    if (BatchProgressStore.isBatchPaused()) {
      return false;
    }

    BatchProgressStore.pauseBatch();

    return true;
  }

  /**
   * 恢复翻译
   */
  resumeTranslation() {
    if (!BatchProgressStore.isBatchInProgress() || !BatchProgressStore.isBatchPaused()) {
      return false;
    }

    BatchProgressStore.resumeBatch();

    return true;
  }

  /**
   * 重试失败的翻译
   * @param {Function} progressCallback - 进度回调
   */
  async retryFailedTranslations(progressCallback) {
    const failedItems = BatchProgressStore.getLastFailedItems();
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
    const failed = BatchProgressStore.getLastFailedItems().length;
    
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
