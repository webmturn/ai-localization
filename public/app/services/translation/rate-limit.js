// 速率限制检查
TranslationService.prototype.checkRateLimit = async function (engine) {
  const limit = this.rateLimits[engine];
  if (!limit) return;

  const now = Date.now();
  const timeSinceLastRequest = now - limit.lastRequest;
  const minInterval = 1000 / limit.maxPerSecond;

  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  limit.lastRequest = Date.now();
};
