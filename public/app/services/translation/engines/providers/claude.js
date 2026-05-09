// ==================== Anthropic Claude 翻译引擎 ====================
// 使用 Claude 的原生 Messages API（/v1/messages）

EngineRegistry.register({
  id: "claude",
  name: "Claude",
  category: "ai",
  apiUrl: "https://api.anthropic.com/v1/messages",
  apiKeyField: "claudeApiKey",
  apiKeyValidationType: "claude",
  defaultModel: "claude-sonnet-4-20250514",
  authHeaderBuilder: function (key) {
    return {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
  },
  supportsJsonMode: false,
  supportsBatch: true,
  extraBodyParams: { max_tokens: 4096 },
  // 批量翻译：JSON 数组输出可能超过 4096，预留 8000
  extraBatchBodyParams: { max_tokens: 8000 },
  rateLimitPerSecond: 3,
  availableModels: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
  ],
  modelLabels: {
    "claude-sonnet-4-20250514": "Claude Sonnet 4 (推荐)",
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
  },

  // Claude Messages API 请求体变换：
  // - 提取 system 角色消息为顶层 system 字段
  // - 移除 messages 中的 system 角色（Claude 不支持）
  // - 移除 response_format（Claude 不支持 JSON mode）
  _transformRequestBody: function (body) {
    var systemParts = [];
    var filtered = [];
    var msgs = body.messages || [];
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i].role === "system") {
        systemParts.push(msgs[i].content);
      } else {
        filtered.push(msgs[i]);
      }
    }
    body.messages = filtered;
    if (systemParts.length > 0) {
      body.system = systemParts.join("\n\n");
    }
    // Claude 不支持 response_format
    delete body.response_format;
    return body;
  },

  // Claude Messages API 响应解析：
  // 响应格式: { content: [{ type: "text", text: "..." }] }
  _parseResponseText: function (data) {
    if (!data || !Array.isArray(data.content)) return "";
    for (var i = 0; i < data.content.length; i++) {
      if (data.content[i].type === "text" && data.content[i].text) {
        return data.content[i].text;
      }
    }
    return "";
  },
});
