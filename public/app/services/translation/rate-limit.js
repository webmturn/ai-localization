// 速率限制检查（支持并发安全：通过 _pending 队列串行化等待）
// 引擎限速条目惰性补建：运行时注册的引擎（如保存自定义引擎后不刷新页面）
// 不在构造时的快照中，miss 时从 EngineRegistry（唯一数据源）补建，
// 避免该引擎无限速且 429 共享冷却空转
TranslationService.prototype._ensureRateLimitEntry = function (engine) {
  let limit = this.rateLimits[engine];
  if (limit) return limit;
  try {
    const config = (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.get === "function")
      ? EngineRegistry.get(engine)
      : null;
    const rps = Number(config && config.rateLimitPerSecond) || 3;
    limit = this.rateLimits[engine] = { maxPerSecond: rps, lastRequest: 0 };
  } catch (e) {
    limit = this.rateLimits[engine] = { maxPerSecond: 3, lastRequest: 0 };
  }
  return limit;
};

TranslationService.prototype.checkRateLimit = async function (engine, shouldCancel) {
  const limit = this._ensureRateLimitEntry(engine);

  // 初始化并发队列
  if (!limit._pending) limit._pending = Promise.resolve();

  const minInterval = 1000 / limit.maxPerSecond;

  // 将本次请求排队，确保每次只有一个 worker 计算等待时间
  const checkCancelled = () => {
    if (typeof shouldCancel === "function" && shouldCancel()) {
      throw Object.assign(new Error("用户取消"), { code: "USER_CANCELLED" });
    }
  };
  const waitUntil = async (deadline) => {
    while (deadline > Date.now()) {
      checkCancelled();
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())));
    }
    checkCancelled();
  };
  const pending = limit._pending.catch(() => {}).then(async () => {
    checkCancelled();
    // 如果处于 429 冷却期，等待冷却结束
    if (limit._cooldownUntil) {
      const waitMs = limit._cooldownUntil - Date.now();
      if (waitMs > 0) {
        (loggers.translation || console).debug(
          engine + " 速率限制冷却中，等待 " + Math.ceil(waitMs / 1000) + "s"
        );
        await waitUntil(limit._cooldownUntil);
      }
      limit._cooldownUntil = 0;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - (limit.lastRequest || 0);

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await waitUntil(Date.now() + waitTime);
    }

    checkCancelled();
    limit.lastRequest = Date.now();
  });
  limit._pending = pending.catch(() => {});
  await pending;
};

/**
 * 报告 429 速率限制错误，触发共享冷却
 * @param {string} engine - 引擎 ID
 * @param {number} [retryAfterSec] - 服务器建议的重试等待秒数
 */
TranslationService.prototype.reportRateLimit = function (engine, retryAfterSec) {
  const limit = this._ensureRateLimitEntry(engine);

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
