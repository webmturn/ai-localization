// ==================== OpenAI 翻译引擎 ====================
// 仅配置差异，通用逻辑由 AIEngineBase 提供

EngineRegistry.register({
  id: "openai",
  name: "OpenAI",
  category: "ai",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiKeyField: "openaiApiKey",
  apiKeyValidationType: "openai",
  defaultModel: "gpt-4o-mini",
  authHeaderBuilder: function (key) {
    return { "Authorization": "Bearer " + key };
  },
  supportsJsonMode: true,
  jsonModeUnsupportedModels: [/^o[13](?:[-_]|$)/i],
  modelCapabilities: [
    {
      match: /^o[13](?:[-_]|$)/i,
      supportsJsonMode: false,
      isReasoningModel: true,
      disablesTemperature: true,
      usesMaxCompletionTokens: true,
      mergesSystemIntoUser: true,
      hints: [
        "OpenAI 推理模型会自动关闭 JSON mode",
        "请求会自动移除 temperature、改用 max_completion_tokens，并合并 system 提示",
      ],
    },
  ],
  supportsBatch: true,
  // 单条翻译：单段输出通常 < 1000 token，4096 覆盖长段落
  extraBodyParams: { max_tokens: 4096 },
  // 批量翻译：一个 chunk 最多 100 项，预留 16000 防止 JSON 截断（gpt-4o 上限 16384）
  extraBatchBodyParams: { max_tokens: 16000 },
  // gpt-4o 系 RPM 达 10000，3 → 15 提升批量吞吐（受 checkRateLimit 令牌桶节流）
  rateLimitPerSecond: 15,
  // 动态获取模型列表端点（过滤 embedding/whisper/tts 等非 chat 模型）
  // 模型列表不再硬编码，由 ModelFetcher 从 API 自动获取并缓存
  modelsEndpoint: {
    url: "https://api.openai.com/v1/models",
  },

  // OpenAI 推理模型（o1/o3 系列）请求体差异适配：
  _transformRequestBody: function (body) {
    if (!body || !body.model) return body;
    var capability = typeof EngineRegistry !== "undefined" && typeof EngineRegistry.getModelCapability === "function"
      ? EngineRegistry.getModelCapability("openai", body.model)
      : { isReasoningModel: /^o[13](?:[-_]|$)/i.test(body.model) };
    var isReasoningModel = !!capability.isReasoningModel;
    if (!isReasoningModel) return body;

    if ("temperature" in body) {
      delete body.temperature;
    }
    if (body.max_tokens !== undefined) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    }
    if (body.response_format && body.response_format.type === "json_object") {
      delete body.response_format;
    }
    if (Array.isArray(body.messages)) {
      var systemParts = [];
      var filtered = [];
      for (var i = 0; i < body.messages.length; i++) {
        var msg = body.messages[i];
        if (msg && msg.role === "system") {
          systemParts.push(msg.content || "");
        } else if (msg) {
          filtered.push(msg);
        }
      }
      if (systemParts.length > 0) {
        var systemText = systemParts.filter(Boolean).join("\n\n");
        var firstUserIndex = -1;
        for (var ui = 0; ui < filtered.length; ui++) {
          if (filtered[ui].role === "user") {
            firstUserIndex = ui;
            break;
          }
        }
        if (firstUserIndex >= 0) {
          filtered[firstUserIndex] = Object.assign({}, filtered[firstUserIndex], {
            content: systemText + "\n\n" + (filtered[firstUserIndex].content || ""),
          });
        } else {
          filtered.unshift({ role: "user", content: systemText });
        }
      }
      body.messages = filtered;
    }
    return body;
  },
});
