// ==================== 翻译引擎注册表 ====================
// 管理所有翻译引擎的注册、分类、查找和自定义引擎支持

const EngineRegistry = {
  /** @type {Map<string, Object>} engineId → config */
  _engines: new Map(),

  /** 引擎分类定义 */
  _categories: {
    ai: { label: "AI 翻译", order: 1 },
    traditional: { label: "传统翻译", order: 2 },
  },

  /**
   * 注册一个翻译引擎
   * @param {Object} config - 引擎配置
   * @param {string} config.id - 引擎唯一标识
   * @param {string} config.name - 显示名称
   * @param {string} config.category - 分类: "ai" | "traditional"
   * @param {string} config.apiUrl - API 端点 URL
   * @param {string} config.apiKeyField - settings 中存储 API Key 的字段名
   * @param {string} [config.apiKeyValidationType] - securityUtils.validateApiKey 的 type 参数
   * @param {string} config.defaultModel - 默认模型名
   * @param {Function} config.authHeaderBuilder - (apiKey) => headerObject
   * @param {boolean} [config.supportsJsonMode=true] - 是否支持 JSON 输出模式
   * @param {boolean} [config.supportsBatch=true] - 是否支持批量翻译
   * @param {Object} [config.extraBodyParams={}] - 额外的请求体参数
   * @param {number} [config.rateLimitPerSecond=3] - 每秒最大请求数
   * @param {boolean} [config.isCustom=false] - 是否为用户自定义引擎
   * @returns {EngineRegistry}
   */
  register: function (config) {
    if (!config || !config.id) {
      (loggers.translation || console).error("EngineRegistry.register: config must have an id");
      return this;
    }
    // 填充默认值
    var merged = {
      apiKeyValidationType: config.id,
      supportsJsonMode: true,
      supportsBatch: true,
      extraBodyParams: {},
      rateLimitPerSecond: 3,
      isCustom: false,
    };
    var keys = Object.keys(config);
    for (var i = 0; i < keys.length; i++) {
      merged[keys[i]] = config[keys[i]];
    }
    this._engines.set(merged.id, merged);
    return this;
  },

  /**
   * 获取指定引擎配置
   * @param {string} engineId
   * @returns {Object|null}
   */
  get: function (engineId) {
    return this._engines.get(engineId) || null;
  },

  /**
   * 检查引擎是否已注册
   * @param {string} engineId
   * @returns {boolean}
   */
  has: function (engineId) {
    return this._engines.has(engineId);
  },

  /**
   * 获取指定分类下的所有引擎
   * @param {string} category - "ai" | "traditional"
   * @returns {Object[]}
   */
  getByCategory: function (category) {
    var result = [];
    this._engines.forEach(function (config) {
      if (config.category === category) result.push(config);
    });
    return result;
  },

  /**
   * 获取所有已注册引擎
   * @returns {Object[]}
   */
  getAllEngines: function () {
    var result = [];
    this._engines.forEach(function (config) {
      result.push(config);
    });
    return result;
  },

  /**
   * 获取所有分类及其引擎列表（用于 UI 渲染）
   * @returns {Array<{id: string, label: string, order: number, engines: Object[]}>}
   */
  getCategories: function () {
    var self = this;
    return Object.keys(this._categories).map(function (id) {
      var info = self._categories[id];
      return {
        id: id,
        label: info.label,
        order: info.order,
        engines: self.getByCategory(id),
      };
    }).sort(function (a, b) { return a.order - b.order; });
  },

  /**
   * 注册用户自定义引擎
   * @param {Object} userConfig
   * @param {string} userConfig.id - 自定义 ID（若无则自动生成）
   * @param {string} userConfig.name - 显示名称
   * @param {string} userConfig.apiUrl - API 端点
   * @param {string} [userConfig.model] - 默认模型
   * @param {string} [userConfig.authType="bearer"] - 认证方式: "bearer" | "x-api-key"
   * @param {boolean} [userConfig.supportsJsonMode=true]
   * @param {number} [userConfig.rateLimitPerSecond=3]
   * @returns {Object} 注册后的完整配置
   */
  registerCustom: function (userConfig) {
    var id = userConfig.id || ("custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    var authType = userConfig.authType || "bearer";
    var config = {
      id: id,
      name: userConfig.name || id,
      category: "ai",
      apiUrl: userConfig.apiUrl || "",
      apiKeyField: "customApiKey_" + id,
      apiKeyValidationType: "generic",
      defaultModel: userConfig.model || "",
      authType: authType,
      authHeaderBuilder: function (key) {
        if (authType === "x-api-key") {
          return { "x-api-key": key };
        }
        return { "Authorization": "Bearer " + key };
      },
      supportsJsonMode: userConfig.supportsJsonMode !== false,
      supportsBatch: userConfig.supportsBatch !== false,
      extraBodyParams: userConfig.extraBodyParams || {},
      rateLimitPerSecond: userConfig.rateLimitPerSecond || 3,
      isCustom: true,
    };
    this.register(config);
    return config;
  },

  /**
   * 移除自定义引擎
   * @param {string} engineId
   * @returns {boolean}
   */
  removeCustom: function (engineId) {
    var config = this._engines.get(engineId);
    if (config && config.isCustom) {
      this._engines.delete(engineId);
      return true;
    }
    return false;
  },

  /**
   * 获取所有自定义引擎的配置（用于持久化）
   * @returns {Object[]}
   */
  getCustomEngines: function () {
    var result = [];
    this._engines.forEach(function (config) {
      if (config.isCustom) {
        result.push({
          id: config.id,
          name: config.name,
          apiUrl: config.apiUrl,
          model: config.defaultModel,
          authType: config.authType || "bearer",
          supportsJsonMode: config.supportsJsonMode,
          supportsBatch: config.supportsBatch,
          rateLimitPerSecond: config.rateLimitPerSecond,
        });
      }
    });
    return result;
  },

  /**
   * 获取默认引擎 ID（首个 AI 引擎，若无则首个任意引擎）
   * @returns {string}
   */
  getDefaultEngineId: function () {
    var aiEngines = this.getByCategory("ai");
    if (aiEngines.length > 0) return aiEngines[0].id;
    var all = this.getAllEngines();
    return all.length > 0 ? all[0].id : "deepseek";
  },

  /**
   * 从持久化数据恢复自定义引擎
   * @param {Object[]} customEngines
   */
  restoreCustomEngines: function (customEngines) {
    if (!Array.isArray(customEngines)) return;
    for (var i = 0; i < customEngines.length; i++) {
      try {
        this.registerCustom(customEngines[i]);
      } catch (_) {
        (loggers.translation || console).warn("EngineRegistry: 恢复自定义引擎失败:", _);
      }
    }
  },
};
