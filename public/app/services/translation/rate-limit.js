// 速率限制检查（支持并发安全：通过 _pending 队列串行化等待）
TranslationService.prototype.checkRateLimit = async function (engine) {
  const limit = this.rateLimits[engine];
  if (!limit) return;

  // 初始化并发队列
  if (!limit._pending) limit._pending = Promise.resolve();

  const minInterval = 1000 / limit.maxPerSecond;

  // 将本次请求排队，确保每次只有一个 worker 计算等待时间
  limit._pending = limit._pending.then(async () => {
    // 如果处于 429 冷却期，等待冷却结束
    if (limit._cooldownUntil) {
      const waitMs = limit._cooldownUntil - Date.now();
      if (waitMs > 0) {
        (loggers.translation || console).debug(
          engine + " 速率限制冷却中，等待 " + Math.ceil(waitMs / 1000) + "s"
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      limit._cooldownUntil = 0;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - (limit.lastRequest || 0);

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    limit.lastRequest = Date.now();
  });

  await limit._pending;
};

/**
 * 报告 429 速率限制错误，触发共享冷却
 * @param {string} engine - 引擎 ID
 * @param {number} [retryAfterSec] - 服务器建议的重试等待秒数
 */
TranslationService.prototype.reportRateLimit = function (engine, retryAfterSec) {
  const limit = this.rateLimits[engine];
  if (!limit) return;

  // 默认冷却 30 秒，或使用服务器提供的 Retry-After
  const cooldownMs = ((retryAfterSec && retryAfterSec > 0) ? retryAfterSec : 30) * 1000;
  const until = Date.now() + cooldownMs;

  // 只延长冷却，不缩短
  if (!limit._cooldownUntil || until > limit._cooldownUntil) {
    limit._cooldownUntil = until;
    (loggers.translation || console).warn(
      engine + " 触发 429 速率限制，全局冷却 " + Math.ceil(cooldownMs / 1000) + "s"
    );
  }
};
