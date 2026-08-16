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
  // 官方无严格 RPM 限制（TPM 按模型），3 → 10 提升批量吞吐；令牌桶仍会节流
  rateLimitPerSecond: 10,
  // 动态获取模型列表端点（OpenAI 兼容 /models）
  // 模型列表不再硬编码，由 ModelFetcher 从 API 自动获取并缓存
  modelsEndpoint: {
    url: "https://api.deepseek.com/v1/models",
  },
});
