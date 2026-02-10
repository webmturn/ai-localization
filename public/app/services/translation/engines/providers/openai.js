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
  supportsBatch: true,
  extraBodyParams: { max_tokens: 2000 },
  rateLimitPerSecond: 3,
});
