// ==================== 通用验证工具 ====================
/**
 * 通用验证工具：统一处理各种验证逻辑
 * 解决验证代码重复问题，提供一致的错误处理
 */

/**
 * 翻译相关验证器
 */
class TranslationValidators {
  /**
   * 验证项目是否存在
   * @throws {Error} 项目不存在时抛出错误
   */
  static validateProjectExists() {
    if (!window.AppState?.project) {
      const error = new Error('请先上传文件或打开项目');
      error.code = 'PROJECT_NOT_FOUND';
      error.userMessage = '请先上传文件或打开项目';
      throw error;
    }
  }
  
  /**
   * 验证翻译项是否存在
   * @throws {Error} 翻译项不存在或无效时抛出错误
   */
  static validateTranslationItems() {
    this.validateProjectExists();
    
    const items = window.AppState.project.translationItems;
    if (!Array.isArray(items)) {
      const error = new Error('翻译项数据异常');
      error.code = 'INVALID_TRANSLATION_ITEMS';
      error.userMessage = '翻译项数据异常，请重新加载项目';
      throw error;
    }
    
    if (items.length === 0) {
      const error = new Error('没有可翻译的项目');
      error.code = 'NO_TRANSLATION_ITEMS';
      error.userMessage = '当前项目没有可翻译的内容';
      throw error;
    }
  }
  
  /**
   * 验证是否有选中的翻译项
   * @throws {Error} 没有选中项时抛出错误
   */
  static validateItemSelected() {
    this.validateProjectExists();
    
    const selected = window.AppState.translations?.selected;
    if (selected === -1 || selected === undefined || selected === null) {
      const error = new Error('请先选择要翻译的项');
      error.code = 'NO_ITEM_SELECTED';
      error.userMessage = '请先选择要翻译的项';
      throw error;
    }
  }
  
  /**
   * 验证是否有选中的文件
   * @throws {Error} 没有选中文件时抛出错误
   */
  static validateFileSelected() {
    const selectedFile = window.AppState?.translations?.selectedFile;
    if (!selectedFile) {
      const error = new Error('请先选择文件');
      error.code = 'NO_FILE_SELECTED';
      error.userMessage = '请先在左侧文件列表选择要翻译的文件';
      throw error;
    }
  }
  
  /**
   * 验证翻译配置
   * @param {Object} config - 翻译配置
   * @param {string} config.sourceLang - 源语言
   * @param {string} config.targetLang - 目标语言
   * @param {string} config.engine - 翻译引擎
   * @throws {Error} 配置无效时抛出错误
   */
  static validateTranslationConfig(config) {
    const { sourceLang, targetLang, engine } = config;
    
    if (!sourceLang) {
      const error = new Error('请选择源语言');
      error.code = 'NO_SOURCE_LANG';
      error.userMessage = '请选择源语言';
      throw error;
    }
    
    if (!targetLang) {
      const error = new Error('请选择目标语言');
      error.code = 'NO_TARGET_LANG';
      error.userMessage = '请选择目标语言';
      throw error;
    }
    
    if (sourceLang === targetLang) {
      const error = new Error('源语言和目标语言不能相同');
      error.code = 'SAME_LANGUAGES';
      error.userMessage = '源语言和目标语言不能相同';
      throw error;
    }
    
    if (!engine) {
      const error = new Error('请选择翻译引擎');
      error.code = 'NO_ENGINE';
      error.userMessage = '请选择翻译引擎';
      throw error;
    }
  }
  
  /**
   * 验证翻译引擎配置
   * @param {string} engine - 翻译引擎名称
   * @throws {Error} 引擎配置无效时抛出错误
   */
  static validateEngineConfig(engine) {
    const settings = window.AppState?.settings?.translation;
    if (!settings) {
      const error = new Error('翻译设置未初始化');
      error.code = 'NO_TRANSLATION_SETTINGS';
      error.userMessage = '翻译设置未初始化，请刷新页面';
      throw error;
    }
    
    switch (engine) {
      case 'openai':
        if (!settings.openaiApiKey) {
          const error = new Error('请配置OpenAI API密钥');
          error.code = 'NO_OPENAI_KEY';
          error.userMessage = '请在设置中配置OpenAI API密钥';
          throw error;
        }
        break;
        
      case 'google':
        if (!settings.googleApiKey) {
          const error = new Error('请配置Google API密钥');
          error.code = 'NO_GOOGLE_KEY';
          error.userMessage = '请在设置中配置Google Translate API密钥';
          throw error;
        }
        break;
        
      case 'deepseek':
        if (!settings.deepseekApiKey) {
          const error = new Error('请配置DeepSeek API密钥');
          error.code = 'NO_DEEPSEEK_KEY';
          error.userMessage = '请在设置中配置DeepSeek API密钥';
          throw error;
        }
        break;
        
      default:
        const error = new Error(`不支持的翻译引擎: ${engine}`);
        error.code = 'UNSUPPORTED_ENGINE';
        error.userMessage = `不支持的翻译引擎: ${engine}`;
        throw error;
    }
  }
  
  /**
   * 验证批量翻译条件
   * @param {Array} items - 要翻译的项目
   * @throws {Error} 条件不满足时抛出错误
   */
  static validateBatchTranslation(items) {
    this.validateProjectExists();
    this.validateTranslationItems();
    
    if (!Array.isArray(items) || items.length === 0) {
      const error = new Error('没有选择要翻译的项目');
      error.code = 'NO_ITEMS_TO_TRANSLATE';
      error.userMessage = '请选择要翻译的项目';
      throw error;
    }
    
    // 检查是否有未翻译的项目
    const untranslatedItems = items.filter(item => !item.targetText || item.targetText.trim() === '');
    if (untranslatedItems.length === 0) {
      const error = new Error('所有项目都已翻译');
      error.code = 'ALL_ITEMS_TRANSLATED';
      error.userMessage = '所有选中的项目都已翻译完成';
      throw error;
    }
  }
  
  /**
   * 验证翻译是否正在进行
   * @throws {Error} 翻译正在进行时抛出错误
   */
  static validateNotInProgress() {
    if (window.AppState?.translations?.isInProgress) {
      const error = new Error('翻译正在进行中');
      error.code = 'TRANSLATION_IN_PROGRESS';
      error.userMessage = '请等待当前翻译完成';
      throw error;
    }
  }
  
  /**
   * 组合验证：翻译前的完整检查
   * @param {Object} config - 翻译配置
   * @param {Array} items - 要翻译的项目
   */
  static validateBeforeTranslation(config, items) {
    this.validateNotInProgress();
    this.validateTranslationConfig(config);
    this.validateEngineConfig(config.engine);
    this.validateBatchTranslation(items);
  }
}

/**
 * 文件相关验证器
 */
class FileValidators {
  /**
   * 验证文件大小
   * @param {File} file - 文件对象
   * @param {number} maxSize - 最大大小（字节）
   * @throws {Error} 文件过大时抛出错误
   */
  static validateFileSize(file, maxSize = 10 * 1024 * 1024) { // 默认10MB
    if (file.size > maxSize) {
      const error = new Error(`文件过大: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      error.code = 'FILE_TOO_LARGE';
      error.userMessage = `文件大小超过限制 (${(maxSize / 1024 / 1024).toFixed(2)}MB)`;
      throw error;
    }
  }
  
  /**
   * 验证文件类型
   * @param {File} file - 文件对象
   * @param {Array} allowedTypes - 允许的文件类型
   * @throws {Error} 文件类型不支持时抛出错误
   */
  static validateFileType(file, allowedTypes = []) {
    if (allowedTypes.length === 0) {
      return; // 如果没有限制，则通过
    }
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      const error = new Error(`不支持的文件类型: .${fileExtension}`);
      error.code = 'UNSUPPORTED_FILE_TYPE';
      error.userMessage = `支持的文件类型: ${allowedTypes.join(', ')}`;
      throw error;
    }
  }
  
  /**
   * 验证文件内容
   * @param {string} content - 文件内容
   * @throws {Error} 文件内容无效时抛出错误
   */
  static validateFileContent(content) {
    if (!content || typeof content !== 'string') {
      const error = new Error('文件内容为空或无效');
      error.code = 'INVALID_FILE_CONTENT';
      error.userMessage = '文件内容为空或格式不正确';
      throw error;
    }
    
    if (content.trim().length === 0) {
      const error = new Error('文件内容为空');
      error.code = 'EMPTY_FILE_CONTENT';
      error.userMessage = '文件内容为空';
      throw error;
    }
  }
}

/**
 * 存储相关验证器
 */
class StorageValidators {
  /**
   * 验证存储可用性
   * @throws {Error} 存储不可用时抛出错误
   */
  static validateStorageAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      const storageError = new Error('本地存储不可用');
      storageError.code = 'STORAGE_UNAVAILABLE';
      storageError.userMessage = '浏览器存储功能不可用，请检查隐私设置';
      throw storageError;
    }
  }
  
  /**
   * 验证存储空间
   * @param {number} requiredSpace - 需要的空间（字节）
   * @throws {Error} 存储空间不足时抛出错误
   */
  static async validateStorageSpace(requiredSpace = 1024 * 1024) { // 默认1MB
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const available = estimate.quota - estimate.usage;
        
        if (available < requiredSpace) {
          const error = new Error('存储空间不足');
          error.code = 'INSUFFICIENT_STORAGE';
          error.userMessage = `需要 ${(requiredSpace / 1024 / 1024).toFixed(2)}MB 空间，可用 ${(available / 1024 / 1024).toFixed(2)}MB`;
          throw error;
        }
      } catch (error) {
        console.warn('无法检查存储空间:', error);
      }
    }
  }
}

/**
 * 通用验证工具函数
 */
class ValidationUtils {
  /**
   * 安全执行验证函数
   * @param {Function} validator - 验证函数
   * @param {string} context - 验证上下文
   * @returns {boolean} 验证是否通过
   */
  static safeValidate(validator, context = 'validation') {
    try {
      validator();
      return true;
    } catch (error) {
      // 使用DI获取错误管理器
      const errorManager = typeof getServiceSafely === 'function' 
        ? getServiceSafely('errorManager', 'errorManager') 
        : window.errorManager;
      
      if (errorManager) {
        errorManager.handleError(error, { context });
      } else {
        console.error(`验证失败 (${context}):`, error);
        if (typeof showNotification === 'function') {
          showNotification('warning', '验证失败', error.userMessage || error.message);
        }
      }
      return false;
    }
  }
  
  /**
   * 批量验证
   * @param {Array} validators - 验证函数数组
   * @param {string} context - 验证上下文
   * @returns {boolean} 所有验证是否都通过
   */
  static validateAll(validators, context = 'batch_validation') {
    for (const validator of validators) {
      if (!this.safeValidate(validator, context)) {
        return false;
      }
    }
    return true;
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TranslationValidators,
    FileValidators,
    StorageValidators,
    ValidationUtils
  };
} else {
  // 浏览器环境，暴露到全局
  window.TranslationValidators = TranslationValidators;
  window.FileValidators = FileValidators;
  window.StorageValidators = StorageValidators;
  window.ValidationUtils = ValidationUtils;
}