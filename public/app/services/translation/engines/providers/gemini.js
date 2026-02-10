// ==================== Google Gemini 翻译引擎 ====================
// 使用 Gemini 的 OpenAI 兼容端点

EngineRegistry.register({
  id: "gemini",
  name: "Gemini",
  category: "ai",
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  apiKeyField: "geminiApiKey",
  apiKeyValidationType: "generic",
  defaultModel: "gemini-2.0-flash",
  authHeaderBuilder: function (key) {
    return { "Authorization": "Bearer " + key };
  },
  supportsJsonMode: true,
  supportsBatch: true,
  extraBodyParams: {},
  rateLimitPerSecond: 0.25,
});
