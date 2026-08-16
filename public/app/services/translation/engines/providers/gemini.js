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
  // 动态获取模型列表端点（Gemini OpenAI 兼容端点，过滤 embedding 等）
  // 模型列表不再硬编码，由 ModelFetcher 从 API 自动获取并缓存
  modelsEndpoint: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/models",
  },
});
