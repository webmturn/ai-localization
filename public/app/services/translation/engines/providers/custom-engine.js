// ==================== 自定义引擎接入 ====================
// 允许用户配置私有 LLM 端点（Ollama, vLLM, LiteLLM, 自部署等）
// 使用 OpenAI 兼容 API 格式

(function () {
  var STORAGE_KEY = "__customEngines";

  /**
   * 从 localStorage 加载已保存的自定义引擎配置
   */
  function loadCustomEngines() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 保存自定义引擎配置到 localStorage
   */
  function saveCustomEngines(engines) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(engines));
    } catch (e) {
      (loggers.translation || console).debug("CustomEngine save:", e);
    }
  }

  function normalizeCustomEngineId(id) {
    var s = String(id || "").trim().toLowerCase();
    return s.indexOf("custom-") === 0 ? s : "custom-" + s;
  }

  /**
   * 注册一个自定义引擎到 EngineRegistry
   * @param {Object} config - 引擎配置
   * @param {string} config.id - 引擎 ID（如 "custom-ollama"）
   * @param {string} config.name - 显示名称（如 "Ollama (本地)"）
   * @param {string} config.apiUrl - API 端点 URL
   * @param {string} config.model - 模型名称（如 "llama3"）
   * @param {boolean} [config.requiresApiKey] - 是否需要 API Key（默认 false）
   * @param {number} [config.rateLimitPerSecond] - 速率限制
   * @param {number} [config.maxTokens] - 最大 token 数
   * @param {Object} [config.headers] - 自定义请求头
   */
  function registerCustomEngine(config) {
    if (!config || !config.id || !config.apiUrl) {
      (loggers.translation || console).error("CustomEngine: id 和 apiUrl 为必填项");
      return false;
    }

    var engineId = normalizeCustomEngineId(config.id);

    var maxTokens = Number(config.maxTokens) || 4096;
    var extraBodyParams = Object.assign(
      {},
      config.extraBodyParams || {},
      { max_tokens: maxTokens }
    );

    var engineConfig = {
      id: engineId,
      name: config.name || engineId,
      category: "ai",
      apiUrl: config.apiUrl,
      apiKeyField: "customApiKey_" + engineId,
      defaultModel: config.model || "",
      model: config.model || "",
      rateLimitPerSecond: config.rateLimitPerSecond || 2,
      maxTokens: maxTokens,
      apiKeyValidationType: config.requiresApiKey ? "generic" : "none",
      authHeaderBuilder: function (key) {
        return key ? { "Authorization": "Bearer " + key } : {};
      },
      supportsJsonMode: config.supportsJsonMode !== false,
      supportsBatch: config.supportsBatch !== false,
      extraBodyParams: extraBodyParams,
      extraBatchBodyParams: extraBodyParams,
      availableModels: config.model ? [config.model] : [],
      isCustom: true,
      customHeaders: config.headers || {},
    };

    // 自定义引擎（OpenAI 兼容）：自动推导 /models 端点，支持动态获取模型列表
    if (typeof ModelFetcher !== "undefined") {
      var _modelsUrl = ModelFetcher.deriveModelsUrl(config.apiUrl);
      if (_modelsUrl) {
        engineConfig.modelsEndpoint = { url: _modelsUrl };
      }
    }

    // 注册到 EngineRegistry
    if (typeof EngineRegistry !== "undefined") {
      EngineRegistry.register(engineConfig);
      (loggers.translation || console).info("已注册自定义引擎:", engineId);
      return true;
    }

    (loggers.translation || console).warn("EngineRegistry 未就绪，无法注册自定义引擎");
    return false;
  }

  /**
   * 注销自定义引擎
   */
  function unregisterCustomEngine(engineId) {
    engineId = normalizeCustomEngineId(engineId);
    if (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.removeCustom === "function") {
      EngineRegistry.removeCustom(engineId);
    }
    // 从存储中移除
    var engines = loadCustomEngines();
    engines = engines.filter(function (e) { return normalizeCustomEngineId(e.id) !== engineId; });
    saveCustomEngines(engines);
  }

  /**
   * 添加并持久化自定义引擎
   */
  function addCustomEngine(config) {
    if (!registerCustomEngine(config)) return false;

    var engineId = normalizeCustomEngineId(config.id);
    var engines = loadCustomEngines();
    // 更新或新增
    var idx = engines.findIndex(function (e) { return normalizeCustomEngineId(e.id) === engineId; });
    var stored = Object.assign({}, config, { id: engineId });
    if (idx >= 0) {
      engines[idx] = stored;
    } else {
      engines.push(stored);
    }
    saveCustomEngines(engines);
    return true;
  }

  /**
   * 获取所有已注册的自定义引擎
   */
  function getCustomEngines() {
    return loadCustomEngines();
  }

  /**
   * 启动时恢复已保存的自定义引擎
   */
  function restoreCustomEngines() {
    var engines = loadCustomEngines();
    var restored = 0;
    engines.forEach(function (config) {
      if (registerCustomEngine(config)) restored++;
    });
    if (restored > 0) {
      (loggers.translation || console).info("已恢复 " + restored + " 个自定义引擎");
    }
    return restored;
  }

  // 暴露到全局
  window.CustomEngineManager = {
    add: addCustomEngine,
    remove: unregisterCustomEngine,
    getAll: getCustomEngines,
    restore: restoreCustomEngines,
    register: registerCustomEngine,
  };

  // 在 EngineRegistry 就绪后自动恢复
  if (typeof EngineRegistry !== "undefined") {
    try { restoreCustomEngines(); } catch (e) {}
  }
})();
