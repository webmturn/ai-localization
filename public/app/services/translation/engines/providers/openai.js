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
  // 单条翻译：单段输出通常 < 1000 token，2000 足够
  extraBodyParams: { max_tokens: 2000 },
  // 批量翻译：一个 chunk 最多 40 项 × 数百 token，预留 8000 防止 JSON 截断
  extraBatchBodyParams: { max_tokens: 8000 },
  rateLimitPerSecond: 3,
  availableModels: [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    // 推理系列（自动适配 max_completion_tokens / 移除 temperature 与 response_format）
    "o1",
    "o1-mini",
    "o1-preview",
    "o3",
    "o3-mini",
  ],
  // UI 友好名称（缺省回退到 model id）
  modelLabels: {
    "gpt-4o-mini": "GPT-4o mini (快速/经济)",
    "gpt-4o": "GPT-4o (推荐)",
    "gpt-4.1-mini": "GPT-4.1 mini",
    "gpt-4.1": "GPT-4.1",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4 (经典)",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "o1": "o1 (推理)",
    "o1-mini": "o1 mini (推理/经济)",
    "o1-preview": "o1 preview (推理)",
    "o3": "o3 (推理)",
    "o3-mini": "o3 mini (推理/经济)",
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
