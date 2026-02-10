// ==================== Anthropic Claude 翻译引擎 ====================
// 使用 Claude 的原生 Messages API（/v1/messages）

EngineRegistry.register({
  id: "claude",
  name: "Claude",
  category: "ai",
  apiUrl: "https://api.anthropic.com/v1/messages",
  apiKeyField: "claudeApiKey",
  apiKeyValidationType: "generic",
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
  rateLimitPerSecond: 3,

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
