// ==================== DeepSeek 翻译引擎 ====================
// 仅配置差异，通用逻辑由 AIEngineBase 提供

EngineRegistry.register({
  id: "deepseek",
  name: "DeepSeek",
  category: "ai",
  apiUrl: "https://api.deepseek.com/v1/chat/completions",
  apiKeyField: "deepseekApiKey",
  apiKeyValidationType: "deepseek",
  defaultModel: "deepseek-chat",
  authHeaderBuilder: function (key) {
    return { "Authorization": "Bearer " + key };
  },
  supportsJsonMode: true,
  jsonModeUnsupportedModels: ["deepseek-reasoner"],
  modelCapabilities: [
    {
      match: "deepseek-reasoner",
      supportsJsonMode: false,
      isReasoningModel: true,
      hints: [
        "DeepSeek Reasoner 不支持强制 JSON mode，系统会自动关闭 response_format",
      ],
    },
  ],
  supportsBatch: true,
  extraBodyParams: { max_tokens: 2000 },
  extraBatchBodyParams: { max_tokens: 8000 },
  rateLimitPerSecond: 3,
  availableModels: [
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  modelLabels: {
    "deepseek-chat": "DeepSeek Chat (推荐)",
    "deepseek-reasoner": "DeepSeek Reasoner (推理)",
  },
});
