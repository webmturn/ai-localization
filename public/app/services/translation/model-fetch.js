// ==================== 模型列表拉取服务 (ModelFetcher) ====================
// 从 AI 引擎的 /models 端点动态获取可用模型列表（唯一数据源，替代硬编码列表）
// 功能：
// 1. 按引擎配置的 modelsEndpoint 拉取远程模型列表（OpenAI 兼容 /models 或各厂商原生端点）
// 2. 结果缓存到 localStorage（默认 7 天），避免每次打开设置页重复请求
// 3. 未拉取过时 UI 回退到引擎 defaultModel 单选项，提示用户点击"从 API 获取"
// 4. 自定义引擎：由 apiUrl 自动推导 /models 端点（OpenAI 兼容约定）

var ModelFetcher = (function () {
  var CACHE_PREFIX = "__aiModels_";
  var DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天
  var REQUEST_TIMEOUT = 15000; // 15 秒

  // ==================== 缓存 ====================

  function _cacheKey(engineId) {
    return CACHE_PREFIX + engineId;
  }

  function _readCache(engineId) {
    try {
      var raw = localStorage.getItem(_cacheKey(engineId));
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.models)) return null;
      if (!data.fetchedAt || Date.now() - data.fetchedAt > DEFAULT_TTL) return null;
      return data.models;
    } catch (e) {
      return null;
    }
  }

  function _writeCache(engineId, models) {
    try {
      localStorage.setItem(
        _cacheKey(engineId),
        JSON.stringify({ models: models, fetchedAt: Date.now() })
      );
    } catch (e) {
      (loggers.translation || console).debug("ModelFetcher cache write:", e);
    }
  }

  // ==================== 响应解析 ====================

  /**
   * 从响应 JSON 中提取模型列表
   * 支持 OpenAI 兼容格式 { data: [{ id, display_name?, owned_by? }] }
   * 和 Claude 格式 { data: [{ id, display_name }] }
   * @returns {Array<{id: string, label: string}>}
   */
  function parseModelsResponse(data) {
    var raw = data && Array.isArray(data.data) ? data.data : null;
    if (!raw) {
      // Gemini 原生格式 { models: [{ name: "models/gemini-...", displayName }] }
      var native = data && Array.isArray(data.models) ? data.models : null;
      if (native) {
        return native
          .map(function (m) {
            var id = m && (m.name || m.id || "");
            if (typeof id === "string" && id.indexOf("models/") === 0) id = id.slice(7);
            return id ? { id: id, label: m.displayName || m.display_name || id } : null;
          })
          .filter(Boolean);
      }
      return [];
    }
    return raw
      .map(function (m) {
        var id = m && (m.id || m.name || "");
        if (!id) return null;
        if (typeof id === "string" && id.indexOf("models/") === 0) id = id.slice(7);
        return { id: id, label: m.display_name || m.displayName || id };
      })
      .filter(Boolean);
  }

  /**
   * 默认模型过滤：排除明显不可用于文本翻译的模型
   * （嵌入、语音、图像、音频、审核、实时等）
   */
  function defaultModelFilter(model) {
    var id = String(model && model.id || "").toLowerCase();
    if (!id) return false;
    return !/(embedding|whisper|tts|dall-?e|moderat|transcrib|translat(?:ion|e)|image|audio|realtime|rerank|reranker)/i.test(id);
  }

  /**
   * 解析引擎的模型端点配置
   * 若引擎 config 未声明 modelsEndpoint，尝试为自定义引擎从 apiUrl 推导
   */
  function _resolveEndpoint(config) {
    if (config && config.modelsEndpoint && config.modelsEndpoint.url) {
      return config.modelsEndpoint;
    }
    // 自定义引擎（OpenAI 兼容）：由 apiUrl 推导 base + /models
    if (config && config.isCustom && config.apiUrl) {
      var url = deriveModelsUrl(config.apiUrl);
      if (url) return { url: url };
    }
    return null;
  }

  /**
   * 从 OpenAI 兼容的 apiUrl 推导 /models 端点
   * 例如：
   *   https://api.example.com/v1/chat/completions → https://api.example.com/v1/models
   *   https://api.example.com/chat/completions     → https://api.example.com/models
   *   https://api.example.com/v1                   → https://api.example.com/v1/models
   */
  function deriveModelsUrl(apiUrl) {
    if (!apiUrl) return "";
    try {
      var u = new URL(apiUrl);
      var path = u.pathname.replace(/\/+$/, "");
      // 去掉常见 completion 路径后缀
      path = path.replace(/\/chat\/completions$/i, "").replace(/\/completions$/i, "");
      // 去掉 /v1beta、/v1 之外的版本段
      var origin = u.origin;
      if (/\/v\d+(?:[a-z]*)$/i.test(path)) return origin + path + "/models";
      return origin + path + "/models";
    } catch (e) {
      return "";
    }
  }

  // ==================== 拉取 ====================

  function _buildHeaders(config, endpoint, apiKey) {
    var headers = { "Content-Type": "application/json" };
    // 自定义引擎额外请求头
    if (config && config.customHeaders && typeof config.customHeaders === "object") {
      Object.keys(config.customHeaders).forEach(function (k) {
        headers[k] = config.customHeaders[k];
      });
    }
    if (endpoint.buildHeaders && typeof endpoint.buildHeaders === "function") {
      var custom = endpoint.buildHeaders(apiKey, config) || {};
      Object.keys(custom).forEach(function (k) {
        headers[k] = custom[k];
      });
      return headers;
    }
    // 默认：Bearer
    if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
    return headers;
  }

  /**
   * 从 API 拉取某引擎的模型列表
   * @param {string} engineId - 引擎 ID
   * @param {string|null} [apiKey] - API Key（可省略，自动从设置读取）
   * @returns {Promise<{ok: boolean, models?: Array, error?: string}>}
   */
  async function fetchModels(engineId, apiKey) {
    var config = (typeof EngineRegistry !== "undefined") ? EngineRegistry.get(engineId) : null;
    if (!config) return { ok: false, error: "未知的翻译引擎: " + engineId };

    var endpoint = _resolveEndpoint(config);
    if (!endpoint || !endpoint.url) {
      return { ok: false, error: config.name + " 不支持远程获取模型列表" };
    }

    // 读取 API Key（未显式传入时从设置读取）
    var key = apiKey;
    if (key === undefined || key === null) {
      key = _readApiKey(config);
    }
    // 自动解密加密的 Key（加密后的 Base64 通常远长于原始 Key，50 为安全阈值）
    if (key && typeof key === "string" && key.length > 50) {
      try {
        if (typeof securityUtils !== "undefined" && securityUtils.decrypt) {
          var decrypted = await securityUtils.decrypt(key);
          if (decrypted) key = decrypted;
        }
      } catch (e) {
        (loggers.translation || console).debug("ModelFetcher decrypt apiKey:", e);
      }
    }

    var noKeyNeeded = config.apiKeyValidationType === "none" || config.apiKeyValidationType === "no-auth";
    if (!noKeyNeeded && !key) {
      return { ok: false, error: "请先在设置中配置 " + config.name + " 的 API Key" };
    }

    try {
      var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT) : null;

      var fetchFn = (typeof window !== "undefined" && window.fetch)
        ? window.fetch.bind(window)
        : (typeof globalThis !== "undefined" && globalThis.fetch ? globalThis.fetch.bind(globalThis) : null);
      if (!fetchFn) {
        if (timer) clearTimeout(timer);
        return { ok: false, error: "当前环境不支持网络请求（fetch 不可用）" };
      }

      var resp = await fetchFn(endpoint.url, {
        method: endpoint.method || "GET",
        headers: _buildHeaders(config, endpoint, key || undefined),
        signal: controller ? controller.signal : undefined,
      });
      if (timer) clearTimeout(timer);

      if (!resp.ok) {
        var errText = "";
        try { errText = (await resp.text()) || ""; } catch (e) {}
        var detail = "";
        try {
          var parsed = JSON.parse(errText);
          detail = (parsed && (parsed.error && parsed.error.message)) || parsed.message || "";
        } catch (e) { detail = errText.slice(0, 120); }
        return {
          ok: false,
          error: config.name + " 模型列表获取失败 (HTTP " + resp.status + ")" + (detail ? ": " + detail : ""),
          status: resp.status,
        };
      }

      var data = await resp.json();
      var models = parseModelsResponse(data);
      if (models.length === 0) {
        return { ok: false, error: config.name + " 返回的模型列表为空" };
      }

      // 过滤
      var filterFn = (endpoint.filter && typeof endpoint.filter === "function")
        ? endpoint.filter
        : defaultModelFilter;
      models = models.filter(function (m) { return filterFn(m); });

      // 去重
      var seen = {};
      models = models.filter(function (m) {
        if (seen[m.id]) return false;
        seen[m.id] = true;
        return true;
      });

      _writeCache(engineId, models);
      return { ok: true, models: models };
    } catch (e) {
      var msg = e && e.name === "AbortError"
        ? "请求超时（" + Math.round(REQUEST_TIMEOUT / 1000) + " 秒）"
        : (e && e.message) || String(e);
      return { ok: false, error: config.name + " 模型列表获取失败: " + msg };
    }
  }

  /**
   * 从 SettingsCache 读取引擎 API Key（加密的自动解密）
   */
  function _readApiKey(config) {
    try {
      var settings = (typeof SettingsCache !== "undefined" && SettingsCache.get) ? SettingsCache.get() : null;
      if (!settings) return "";
      var key = settings[config.apiKeyField];
      if (!key) return "";
      // 加密后的 Base64 通常远长于原始 Key，50 为安全阈值（与 settings.js 一致）
      if (key.length > 50 && typeof securityUtils !== "undefined" && securityUtils.decrypt) {
        // 解密是异步的，这里同步场景先返回原值由调用方处理
        return key;
      }
      return key;
    } catch (e) {
      return "";
    }
  }

  /**
   * 异步读取已解密的 API Key（优先于 _readApiKey）
   */
  async function readDecryptedApiKey(config) {
    try {
      if (typeof translationService !== "undefined" && translationService && typeof translationService.getSettings === "function") {
        var settings = await translationService.getSettings();
        if (settings && settings[config.apiKeyField]) return settings[config.apiKeyField];
      }
    } catch (e) {}
    return _readApiKey(config);
  }

  /**
   * 获取缓存的模型列表（未过期）
   */
  function getCachedModels(engineId) {
    return _readCache(engineId);
  }

  /**
   * 清空某引擎的模型缓存
   */
  function clearCache(engineId) {
    try { localStorage.removeItem(_cacheKey(engineId)); } catch (e) {}
  }

  // ==================== 公共 API ====================

  return {
    fetchModels: fetchModels,
    getCachedModels: getCachedModels,
    clearCache: clearCache,
    readDecryptedApiKey: readDecryptedApiKey,
    deriveModelsUrl: deriveModelsUrl,
    parseModelsResponse: parseModelsResponse,
    defaultModelFilter: defaultModelFilter,
    _CACHE_PREFIX: CACHE_PREFIX,
    _DEFAULT_TTL: DEFAULT_TTL,
  };
})();

// 暴露到全局（浏览器环境）
if (typeof window !== "undefined") {
  window.ModelFetcher = ModelFetcher;
}
// 导出（测试环境）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ModelFetcher: ModelFetcher };
}
