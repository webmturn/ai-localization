// ==================== 翻译API服务模块 ====================

// 翻译服务类
class TranslationService {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;

    // 速率限制：从 EngineRegistry 动态初始化（向后兼容硬编码值）
    this.rateLimits = {};
    this._initRateLimits();

    // AI 引擎会话历史（通用）
    this.aiConversations = new Map();
    // 向后兼容：旧代码可能引用 deepseekConversations
    this.deepseekConversations = this.aiConversations;
  }

  _initRateLimits() {
    // 从注册表获取所有引擎的速率限制
    try {
      var engines = EngineRegistry.getAllEngines();
      for (var i = 0; i < engines.length; i++) {
        var eng = engines[i];
        this.rateLimits[eng.id] = {
          maxPerSecond: eng.rateLimitPerSecond || 3,
          lastRequest: 0,
        };
      }
    } catch (_) {
      // EngineRegistry 未就绪时使用默认值
    }
    // 确保至少有默认引擎
    if (!this.rateLimits.deepseek) this.rateLimits.deepseek = { maxPerSecond: 3, lastRequest: 0 };
    if (!this.rateLimits.openai) this.rateLimits.openai = { maxPerSecond: 3, lastRequest: 0 };
    if (!this.rateLimits.google) this.rateLimits.google = { maxPerSecond: 10, lastRequest: 0 };
  }
}
