// ==================== 通用验证器 V2 ====================
/**
 * 统一的验证器类
 * 消除重复的验证逻辑，提供统一的验证接口
 * 使用依赖注入架构，支持测试和模块化
 */

class UniversalValidators {
  constructor(dependencies = {}) {
    // 使用依赖注入获取服务
    this.appState = dependencies.appState || this.getService('appState', 'AppState');
    this.errorManager = dependencies.errorManager || this.getService('errorManager');
  }

  /**
   * 安全获取服务的辅助方法
   * @param {string} serviceName - 服务名
   * @param {string} fallbackGlobal - 备用全局变量名
   * @returns {*} 服务实例
   */
  getService(serviceName, fallbackGlobal = null) {
    if (typeof getServiceSafely === 'function') {
      return getServiceSafely(serviceName, fallbackGlobal);
    }
    
    // 备用方案：直接从全局获取
    if (fallbackGlobal && window[fallbackGlobal]) {
      return window[fallbackGlobal];
    }
    
    return null;
  }

  /**
   * 创建验证错误
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {string} userMessage - 用户友好消息
   * @returns {Error} 验证错误
   */
  createValidationError(code, message, userMessage = null) {
    const error = new Error(message);
    error.code = code;
    error.userMessage = userMessage || message;
    error.isValidationError = true;
    return error;
  }

  /**
   * 验证项目是否存在
   * @throws {Error} 项目不存在时抛出错误
   */
  validateProjectExists() {
    if (!this.appState?.project) {
      throw this.createValidationError(
        'PROJECT_NOT_FOUND',
        '项目未找到',
        '请先上传文件或打开项目'
      );
    }
  }

  /**
   * 验证翻译项是否存在且有效
   * @throws {Error} 翻译项无效时抛出错误
   */
  validateTranslationItems() {
    this.validateProjectExists();
    
    const items = this.appState.project.translationItems;
    if (!Array.isArray(items)) {
      throw this.createValidationError(
        'INVALID_TRANSLATION_ITEMS',
        '翻译项数据异常',
        '翻译项数据格式无效'
      );
    }

    if (items.length === 0) {
      throw this.createValidationError(
        'NO_TRANSLATION_ITEMS',
        '没有翻译项',
        '当前项目没有可翻译的内容'
      );
    }
  }

  /**
   * 验证是否选中了翻译项
   * @throws {Error} 未选中项目时抛出错误
   */
  validateItemSelected() {
    this.validateProjectExists();
    
    const selected = this.appState.translations?.selected;
    if (selected === -1 || selected === undefined || selected === null) {
      throw this.createValidationError(
        'NO_ITEM_SELECTED',
        '未选择翻译项',
        '请先选择要翻译的项'
      );
    }
  }

  /**
   * 验证是否选中了文件
   * @throws {Error} 未选中文件时抛出错误
   */
  validateFileSelected() {
    const selectedFile = this.appState?.translations?.selectedFile;
    if (!selectedFile) {
      throw this.createValidationError(
        'NO_FILE_SELECTED',
        '未选择文件',
        '请先在左侧文件列表选择要翻译的文件'
      );
    }
  }

  /**
   * 验证翻译不在进行中
   * @throws {Error} 翻译正在进行时抛出错误
   */
  validateNotInProgress() {
    if (this.appState?.translations?.isInProgress) {
      throw this.createValidationError(
        'TRANSLATION_IN_PROGRESS',
        '翻译正在进行中',
        '请等待当前翻译完成'
      );
    }
  }

  /**
   * 验证翻译引擎配置
   * @param {string} engine - 引擎名称
   * @throws {Error} 引擎配置无效时抛出错误
   */
  validateEngineConfig(engine) {
    // 从 SettingsCache（localStorage）读取，而非 AppState.settings.translation
    const settings = (typeof SettingsCache !== 'undefined' && SettingsCache.get())
      || this.appState?.settings?.translation;
    if (!settings) {
      throw this.createValidationError(
        'NO_TRANSLATION_SETTINGS',
        '翻译设置未初始化',
        '请先配置翻译设置'
      );
    }

    if (!engine) {
      throw this.createValidationError(
        'NO_ENGINE_SPECIFIED',
        '未指定翻译引擎',
        '请选择翻译引擎'
      );
    }

    // 验证API密钥等配置
    if (this.requiresApiKey(engine)) {
      var engineConfig = typeof EngineRegistry !== 'undefined' ? EngineRegistry.get(engine) : null;
      var apiKeyField = engineConfig ? engineConfig.apiKeyField : (engine + 'ApiKey');
      const apiKey = settings[apiKeyField] || settings.apiKey;
      if (!apiKey) {
        var engineName = engineConfig ? engineConfig.name : engine;
        throw this.createValidationError(
          'MISSING_API_KEY',
          `${engineName} API密钥未配置`,
          `请在设置中配置 ${engineName} 的API密钥`
        );
      }
    }
  }

  /**
   * 检查引擎是否需要API密钥
   * @param {string} engine - 引擎名称
   * @returns {boolean} 是否需要API密钥
   */
  requiresApiKey(engine) {
    // 通过 EngineRegistry 判断：所有注册的引擎都需要 API Key
    if (typeof EngineRegistry !== 'undefined' && EngineRegistry.has(engine)) {
      return true;
    }
    // 向后兼容硬编码列表
    const apiKeyEngines = ['openai', 'deepseek', 'anthropic', 'google', 'gemini', 'claude'];
    return apiKeyEngines.includes(engine.toLowerCase());
  }

  /**
   * 验证语言对设置
   * @throws {Error} 语言设置无效时抛出错误
   */
  validateLanguagePair() {
    const project = this.appState?.project;
    if (!project) {
      throw this.createValidationError(
        'PROJECT_NOT_FOUND',
        '项目未找到'
      );
    }

    if (!project.sourceLanguage) {
      throw this.createValidationError(
        'NO_SOURCE_LANGUAGE',
        '未设置源语言',
        '请设置源语言'
      );
    }

    if (!project.targetLanguage) {
      throw this.createValidationError(
        'NO_TARGET_LANGUAGE',
        '未设置目标语言',
        '请设置目标语言'
      );
    }

    if (project.sourceLanguage === project.targetLanguage) {
      throw this.createValidationError(
        'SAME_SOURCE_TARGET_LANGUAGE',
        '源语言和目标语言相同',
        '源语言和目标语言不能相同'
      );
    }
  }

  /**
   * 验证文本内容
   * @param {string} text - 待验证的文本
   * @param {Object} options - 验证选项
   * @throws {Error} 文本无效时抛出错误
   */
  validateTextContent(text, options = {}) {
    const {
      minLength = 0,
      maxLength = 10000,
      allowEmpty = false,
      fieldName = '文本'
    } = options;

    if (!allowEmpty && (!text || text.trim().length === 0)) {
      throw this.createValidationError(
        'EMPTY_TEXT',
        `${fieldName}为空`,
        `请输入${fieldName}内容`
      );
    }

    if (text && text.length < minLength) {
      throw this.createValidationError(
        'TEXT_TOO_SHORT',
        `${fieldName}长度不足`,
        `${fieldName}至少需要${minLength}个字符`
      );
    }

    if (text && text.length > maxLength) {
      throw this.createValidationError(
        'TEXT_TOO_LONG',
        `${fieldName}长度超限`,
        `${fieldName}不能超过${maxLength}个字符`
      );
    }
  }

  /**
   * 组合验证：验证翻译操作的前置条件
   * @param {Object} options - 验证选项
   * @throws {Error} 验证失败时抛出错误
   */
  validateTranslationOperation(options = {}) {
    const {
      requireItemSelection = false,
      requireFileSelection = false,
      engine = null
    } = options;

    // 基本验证
    this.validateProjectExists();
    this.validateTranslationItems();
    this.validateNotInProgress();
    this.validateLanguagePair();

    // 可选验证
    if (requireItemSelection) {
      this.validateItemSelected();
    }

    if (requireFileSelection) {
      this.validateFileSelected();
    }

    if (engine) {
      this.validateEngineConfig(engine);
    }
  }

  /**
   * 安全验证执行器 - 捕获验证错误并处理
   * @param {Function} validationFn - 验证函数
   * @param {Object} context - 错误上下文
   * @returns {boolean} 验证是否通过
   */
  safeValidate(validationFn, context = {}) {
    try {
      validationFn();
      return true;
    } catch (error) {
      if (error.isValidationError) {
        // 处理验证错误
        this.handleValidationError(error, context);
      } else {
        // 处理其他错误
        (loggers.app || console).error('验证过程中发生未知错误:', error);
        if (this.errorManager) {
          this.errorManager.handleError(error, context);
        }
      }
      return false;
    }
  }

  /**
   * 处理验证错误
   * @param {Error} error - 验证错误
   * @param {Object} context - 错误上下文
   */
  handleValidationError(error, context = {}) {
    // 显示用户友好的错误消息
    if (typeof showNotification === 'function') {
      showNotification('warning', '验证失败', error.userMessage || error.message);
    }

    // 记录到错误管理器
    if (this.errorManager) {
      this.errorManager.handleError(error, {
        ...context,
        isValidationError: true
      });
    }

    // 控制台输出详细信息（开发模式）
    (loggers.app || console).warn(`验证失败 [${error.code}]:`, error.message, context);
  }
}

// ==================== 存储验证器 ====================
class StorageValidators extends UniversalValidators {
  /**
   * 验证存储后端可用性
   * @param {string} backendType - 后端类型
   * @throws {Error} 后端不可用时抛出错误
   */
  validateStorageBackend(backendType) {
    const storageManager = this.getService('storageManager');
    if (!storageManager) {
      throw this.createValidationError(
        'NO_STORAGE_MANAGER',
        '存储管理器不可用'
      );
    }

    if (!storageManager.isBackendAvailable(backendType)) {
      throw this.createValidationError(
        'BACKEND_UNAVAILABLE',
        `存储后端 ${backendType} 不可用`,
        '存储功能暂时不可用，请稍后重试'
      );
    }
  }

  /**
   * 验证项目数据完整性
   * @param {Object} project - 项目数据
   * @throws {Error} 数据无效时抛出错误
   */
  validateProjectData(project) {
    if (!project) {
      throw this.createValidationError(
        'INVALID_PROJECT_DATA',
        '项目数据无效'
      );
    }

    if (!project.name) {
      throw this.createValidationError(
        'NO_PROJECT_NAME',
        '项目名称缺失'
      );
    }

    if (!Array.isArray(project.translationItems)) {
      throw this.createValidationError(
        'INVALID_TRANSLATION_ITEMS',
        '翻译项数据格式无效'
      );
    }
  }
}

// ==================== 文件验证器 ====================
class FileValidators extends UniversalValidators {
  /**
   * 验证文件类型
   * @param {File} file - 文件对象
   * @param {Array} allowedTypes - 允许的文件类型
   * @throws {Error} 文件类型不支持时抛出错误
   */
  validateFileType(file, allowedTypes = []) {
    if (!file) {
      throw this.createValidationError(
        'NO_FILE',
        '未选择文件'
      );
    }

    if (allowedTypes.length > 0) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        throw this.createValidationError(
          'UNSUPPORTED_FILE_TYPE',
          `不支持的文件类型: ${fileExtension}`,
          `支持的文件类型: ${allowedTypes.join(', ')}`
        );
      }
    }
  }

  /**
   * 验证文件大小
   * @param {File} file - 文件对象
   * @param {number} maxSize - 最大文件大小（字节）
   * @throws {Error} 文件过大时抛出错误
   */
  validateFileSize(file, maxSize = 10 * 1024 * 1024) {
    if (!file) {
      throw this.createValidationError('NO_FILE', '未选择文件');
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      
      throw this.createValidationError(
        'FILE_TOO_LARGE',
        `文件过大: ${fileSizeMB}MB`,
        `文件大小不能超过 ${maxSizeMB}MB`
      );
    }
  }
}

// ==================== 全局实例和兼容性 ====================

let globalValidatorInstance = null;
let globalStorageValidatorInstance = null;
let globalFileValidatorInstance = null;

/**
 * 获取通用验证器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {UniversalValidators} 验证器实例
 */
function getUniversalValidators(dependencies = {}) {
  if (!globalValidatorInstance) {
    globalValidatorInstance = new UniversalValidators(dependencies);
  }
  return globalValidatorInstance;
}

/**
 * 获取存储验证器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {StorageValidators} 存储验证器实例
 */
function getStorageValidators(dependencies = {}) {
  if (!globalStorageValidatorInstance) {
    globalStorageValidatorInstance = new StorageValidators(dependencies);
  }
  return globalStorageValidatorInstance;
}

/**
 * 获取文件验证器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {FileValidators} 文件验证器实例
 */
function getFileValidators(dependencies = {}) {
  if (!globalFileValidatorInstance) {
    globalFileValidatorInstance = new FileValidators(dependencies);
  }
  return globalFileValidatorInstance;
}

// 向后兼容的翻译验证器类
class TranslationValidators extends UniversalValidators {
  static validateProjectExists() {
    return getUniversalValidators().validateProjectExists();
  }

  static validateTranslationItems() {
    return getUniversalValidators().validateTranslationItems();
  }

  static validateItemSelected() {
    return getUniversalValidators().validateItemSelected();
  }

  static validateFileSelected() {
    return getUniversalValidators().validateFileSelected();
  }

  static validateNotInProgress() {
    return getUniversalValidators().validateNotInProgress();
  }

  static validateEngineConfig(engine) {
    return getUniversalValidators().validateEngineConfig(engine);
  }

  static validateTranslationOperation(options) {
    return getUniversalValidators().validateTranslationOperation(options);
  }
}

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    UniversalValidators,
    StorageValidators,
    FileValidators,
    TranslationValidators,
    getUniversalValidators,
    getStorageValidators,
    getFileValidators
  };
} else {
  // 浏览器环境
  window.UniversalValidators = UniversalValidators;
  window.StorageValidators = StorageValidators;
  window.FileValidators = FileValidators;
  window.TranslationValidators = TranslationValidators;
  window.getUniversalValidators = getUniversalValidators;
  window.getStorageValidators = getStorageValidators;
  window.getFileValidators = getFileValidators;
  
  // 注册到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      if (typeof namespaceManager.getNamespace === 'function' &&
          !namespaceManager.getNamespace('App.validators') &&
          typeof namespaceManager.createNamespace === 'function') {
        namespaceManager.createNamespace('App.validators', {
          description: '验证器模块',
          modules: {}
        });
      }
      namespaceManager.addToNamespace('App.validators', 'UniversalValidators', UniversalValidators);
      namespaceManager.addToNamespace('App.validators', 'TranslationValidators', TranslationValidators);
      namespaceManager.addToNamespace('App.validators', 'StorageValidators', StorageValidators);
      namespaceManager.addToNamespace('App.validators', 'FileValidators', FileValidators);
    } catch (error) {
      (loggers.app || console).warn('验证器命名空间注册失败:', error.message);
    }
  }
}

(loggers.app || console).debug('通用验证器 V2 已加载');
