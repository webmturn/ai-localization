// ==================== 翻译API服务模块 ====================

// 翻译服务类
class TranslationService {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.rateLimits = {
      openai: { maxPerSecond: 3, lastRequest: 0 },
      deepseek: { maxPerSecond: 3, lastRequest: 0 },
      google: { maxPerSecond: 10, lastRequest: 0 },
    };

    this.deepseekConversations = new Map();
  }
}
