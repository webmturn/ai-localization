/**
 * AIEngineBase.translateBatch 并发与顺序测试
 *
 * 验证性能优化后的行为：
 * 1. 会话记忆关闭时 chunk 并发处理（受引擎 RPS 限制，上限 3）
 * 2. 返回结果严格按 items 顺序（并发完成顺序与 chunk 顺序解耦）
 * 3. 会话记忆开启时退化为串行（历史链顺序依赖）
 * 4. 自适应拆半重试在并发下仍保持顺序
 * 5. 取消时 partialOutputs 保持"按 chunk 顺序的前缀"语义
 *
 * 注意：vm.runInThisContext 中顶层 const 不挂载到 globalThis（与浏览器
 * 多 <script> 共享全局词法环境不同），因此 EngineRegistry / securityUtils
 * 以 stub 形式提供（ai-engine-base.js 内部仅使用 register/get/getModelCapability
 * 与 sanitizeForApi/validateApiKey）。
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  // 批量进度 Store（取消协议 Owner；引擎 waitWhilePaused/isUserCancelled 依赖）
  loadSource("public/app/core/batch-progress-store.js");
  loadSource("public/app/services/translation/helpers.js");
  loadSource("public/app/services/translation/engines/base/ai-engine-base.js");

  // EngineRegistry stub（const 声明无法跨 vm 脚本共享）
  globalThis.EngineRegistry = {
    _engines: new Map(),
    register(cfg) {
      this._engines.set(cfg.id, cfg);
      return this;
    },
    get(id) {
      return this._engines.get(id) || null;
    },
    getModelCapability(engineId, model) {
      const cfg = this.get(engineId);
      return {
        supportsJsonMode: !!(cfg && cfg.supportsJsonMode !== false),
        supportsBatch: !!(cfg && cfg.supportsBatch !== false),
        isReasoningModel: false,
      };
    },
  };

  // securityUtils stub（const 声明同理）
  globalThis.securityUtils = {
    sanitizeForApi: (t) => (typeof t === "string" ? t : ""),
    validateApiKey: () => true,
  };
});

function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: "id-" + i,
    sourceText: "source-" + i,
    metadata: { key: "key-" + i, file: "test.json" },
  }));
}

/**
 * 构造测试环境
 * @param {Object} opts
 * @param {boolean} [opts.conversation=false] 是否开启会话记忆（强制串行）
 * @param {number} [opts.maxItems=3] 每个 chunk 的最大条目数
 * @param {Function} [opts.responder] 自定义响应函数 (items) => translations | throws
 * @param {number} [opts.delay=10] 模拟请求耗时（ms）
 */
function makeHarness(opts = {}) {
  const { conversation = false, maxItems = 3, delay = 10 } = opts;
  const responder =
    opts.responder ||
    ((items) => items.map((it) => "TR:" + it.source));

  globalThis.AppState = {
    project: { id: "p1", translationItems: [] },
    translations: { _batchStarted: true, isInProgress: true, _batchCancelled: false },
    ui: {},
    terminology: { entries: [] },
  };

  globalThis.EngineRegistry.register({
    id: "test-batch",
    name: "TestBatch",
    category: "ai",
    apiUrl: "https://fake.test/v1/chat/completions",
    apiKeyValidationType: "none",
    defaultModel: "test-model",
    supportsJsonMode: false,
    supportsBatch: true,
    rateLimitPerSecond: 10,
  });

  let inFlight = 0;
  let maxInFlight = 0;
  let requests = 0;

  globalThis.networkUtils = {
    fetchWithTimeout: async (url, opts2) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      requests++;
      const body = JSON.parse(opts2.body);
      const lastMsg = body.messages[body.messages.length - 1].content;
      const payload = JSON.parse(lastMsg.substring(lastMsg.indexOf('{"items"')));
      let translations;
      try {
        translations = responder(payload.items);
      } catch (e) {
        inFlight--;
        throw e;
      }
      if (translations && typeof translations.then === "function") {
        try {
          translations = await translations;
        } catch (e) {
          inFlight--;
          throw e;
        }
      }
      await new Promise((r) => setTimeout(r, delay));
      inFlight--;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ translations }) } }],
        }),
      };
    },
  };

  const service = {
    aiConversations: new Map(),
    getSettings: async () => ({
      model: "test-model",
      aiBatchMaxItems: maxItems,
      aiBatchMaxChars: 20000,
      aiConversationEnabled: conversation,
      aiConversationScope: "project",
      apiTimeout: 30,
    }),
    checkRateLimit: async () => {},
  };

  return {
    service,
    stats: () => ({ maxInFlight, requests }),
    cancel: () => {
      // 取消协议经 BatchProgressStore（阶段 5：幽灵字段直写已收编）
      BatchProgressStore.cancelBatch();
    },
  };
}

beforeEach(() => {
  // 每个用例重置通知标记（模块级 var 挂在 globalThis 上）
  globalThis._aiLongTextNotified = false;
  // 重置取消协议内部标记（防止上一用例的取消状态泄漏）
  if (globalThis.BatchProgressStore) {
    BatchProgressStore._cancelled = false;
    BatchProgressStore._started = false;
  }
});

describe("translateBatch 并发优化", () => {
  it("会话记忆关闭时：chunk 并发处理（≥2 并行）且结果严格按 items 顺序", async () => {
    const items = makeItems(12); // 5+5+2 = 3 chunks
    const h = makeHarness({ maxItems: 5 });

    const result = await AIEngineBase.translateBatch(
      "test-batch", items, "en", "zh", {}, h.service
    );

    expect(result).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(result[i]).toBe("TR:source-" + i);
    }
    expect(h.stats().requests).toBe(3);
    // 并发确实发生（而非串行）
    expect(h.stats().maxInFlight).toBeGreaterThanOrEqual(2);
    // 不超过并发上限 3
    expect(h.stats().maxInFlight).toBeLessThanOrEqual(3);
  });

  it("会话记忆开启时：强制串行（maxInFlight === 1）且结果有序", async () => {
    const items = makeItems(12);
    const h = makeHarness({ maxItems: 5, conversation: true });

    const result = await AIEngineBase.translateBatch(
      "test-batch", items, "en", "zh", {}, h.service
    );

    expect(result).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(result[i]).toBe("TR:source-" + i);
    }
    expect(h.stats().requests).toBe(3);
    expect(h.stats().maxInFlight).toBe(1);
  });

  it("单 chunk 场景不退化", async () => {
    const items = makeItems(3);
    const h = makeHarness({ maxItems: 10 });

    const result = await AIEngineBase.translateBatch(
      "test-batch", items, "en", "zh", {}, h.service
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("TR:source-0");
    expect(h.stats().requests).toBe(1);
  });

  it("自适应拆半重试在并发下保持顺序", async () => {
    const items = makeItems(8);
    // 超过 2 项的 chunk 一律报"JSON 解析失败"（自适应错误）→ 应持续拆半直到 ≤2 项
    const h = makeHarness({
      maxItems: 5,
      responder: (payloadItems) => {
        if (payloadItems.length > 2) {
          const e = new Error("JSON 解析失败: fake");
          e.code = "BATCH_JSON_PARSE_FAILED";
          throw e;
        }
        return payloadItems.map((it) => "TR:" + it.source);
      },
    });

    const result = await AIEngineBase.translateBatch(
      "test-batch", items, "en", "zh", {}, h.service
    );

    expect(result).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(result[i]).toBe("TR:source-" + i);
    }
    // 初始 2 个 chunk(5+3) 都失败并拆分 → 请求数 > 初始 chunk 数
    expect(h.stats().requests).toBeGreaterThan(2);
  });

  it("取消时 partialOutputs 保持按 chunk 顺序的前缀", async () => {
    const items = makeItems(8); // 5+3
    const h = makeHarness({
      maxItems: 5,
      delay: 10,
      responder: (payloadItems) => {
        // 第一个 chunk（含 source-0）快速成功，其余挂起以便触发取消
        if (payloadItems[0]?.source === "source-0") {
          return payloadItems.map((it) => "TR:" + it.source);
        }
        return new Promise((resolve) => {
          setTimeout(() => resolve(payloadItems.map((it) => "TR:" + it.source)), 2000);
        });
      },
    });

    const pending = AIEngineBase.translateBatch(
      "test-batch", items, "en", "zh", {}, h.service
    );

    // 等待第一个 chunk（source-0..4）完成并落槽
    await new Promise((r) => setTimeout(r, 80));
    h.cancel();

    await expect(pending).rejects.toMatchObject({ code: "USER_CANCELLED" });
    await expect(pending).rejects.toMatchObject({
      partialOutputs: ["TR:source-0", "TR:source-1", "TR:source-2", "TR:source-3", "TR:source-4"],
    });
  });
});