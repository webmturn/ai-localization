// ==================== 传统翻译引擎基类 ====================
// 用于非 AI 翻译引擎（如 Google Translate）的通用逻辑

var TraditionalEngineBase = {

  /**
   * 单条翻译（传统翻译 API）
   * @param {string} engineId - 引擎 ID
   * @param {string} text - 待翻译文本
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {TranslationService} service - 翻译服务实例
   * @returns {Promise<string>} 翻译结果
   */
  translateSingle: async function (engineId, text, sourceLang, targetLang, service) {
    var config = EngineRegistry.get(engineId);
    if (!config) throw new Error("未知的翻译引擎: " + engineId);

    // 子引擎需实现 _buildRequest 和 _parseResponse
    if (!config._buildRequest || !config._parseResponse) {
      throw new Error("传统引擎 " + engineId + " 未实现 _buildRequest/_parseResponse");
    }

    var settings = await service.getSettings();
    var apiKey = settings[config.apiKeyField];

    var cacheEnabled = !!settings.translationRequestCacheEnabled;
    var rawCacheTtl = parseInt(settings.translationRequestCacheTTLSeconds);
    var cacheTtlSeconds = Number.isFinite(rawCacheTtl)
      ? Math.max(1, Math.min(600, rawCacheTtl))
      : 5;

    // 校验 API Key
    if (!apiKey) {
      var err1 = new Error(config.name + " API密钥未配置");
      err1.code = "API_KEY_MISSING";
      err1.provider = engineId;
      throw err1;
    }
    if (!securityUtils.validateApiKey(apiKey, config.apiKeyValidationType || engineId)) {
      var err2 = new Error(config.name + " API密钥格式不正确");
      err2.code = "API_KEY_INVALID";
      err2.provider = engineId;
      throw err2;
    }

    var cleanText = securityUtils.sanitizeForApi(text);

    // 由引擎配置构建请求
    var reqConfig = config._buildRequest(cleanText, sourceLang, targetLang, apiKey, settings);

    try {
      var response = await networkUtils.fetchWithDedupe(
        reqConfig.url,
        {
          method: reqConfig.method || "POST",
          headers: reqConfig.headers,
          body: reqConfig.body ? JSON.stringify(reqConfig.body) : undefined,
        },
        {
          timeout: (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000,
          dedupe: true,
          cache: cacheEnabled,
          cacheTTL: cacheTtlSeconds * 1000,
        }
      );

      if (!response.ok) {
        var raw = await response.text();
        var message = config.name + " API错误: " + response.status;
        try {
          var parsed = JSON.parse(raw);
          message = parsed.error?.message || parsed.message || message;
        } catch (e) {
          if (raw && raw.trim()) message = raw;
        }
        var errResp = new Error(message);
        errResp.status = response.status;
        errResp.provider = engineId;
        errResp.url = reqConfig.url;
        throw errResp;
      }

      var data = await response.json();
      return config._parseResponse(data);
    } catch (error) {
      (loggers.translation || console).error(config.name + "翻译失败:", error);
      throw error;
    }
  },
};
