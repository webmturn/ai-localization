// ==================== Google Gemini 翻译引擎 ====================
// 使用 Gemini 的 OpenAI 兼容端点

EngineRegistry.register({
  id: "gemini",
  name: "Gemini",
  category: "ai",
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  apiKeyField: "geminiApiKey",
  apiKeyValidationType: "gemini",
  defaultModel: "gemini-2.0-flash",
  authHeaderBuilder: function (key) {
    return { "Authorization": "Bearer " + key };
  },
  supportsJsonMode: true,
  supportsBatch: true,
  extraBodyParams: { max_tokens: 2000 },
  extraBatchBodyParams: { max_tokens: 8000 },
  rateLimitPerSecond: 0.25,
  availableModels: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  modelLabels: {
    "gemini-2.0-flash": "Gemini 2.0 Flash (推荐)",
    "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "gemini-1.5-flash": "Gemini 1.5 Flash",
  },
});
