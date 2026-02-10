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
  supportsBatch: true,
  extraBodyParams: {},
  rateLimitPerSecond: 3,
});
