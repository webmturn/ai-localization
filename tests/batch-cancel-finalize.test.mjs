/**
 * 批量路径收尾逻辑回归测试（P0/P1 修复）
 *
 * 覆盖两个此前未被任何用例覆盖、且都会「静默产出错误结果」的路径：
 *  1. 用户取消时 batch.js 消费 error.partialOutputs 完全不还原占位符 —— 引擎侧已把 %s 换成 «0»，
 *     于是 «0» 被原样写进 targetText 并标记为 translated（随后自动保存 + 导出）。
 *  2. 源文含占位符 + 模型返回非字符串时，PlaceholderGuard.restore 抛 TypeError，
 *     把整批（可能已付费的）结果一起作废并逐项重译。
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/core/batch-progress-store.js");
  loadSource("public/app/services/translation/placeholder-guard.js");
  loadSource("public/app/services/translation/helpers.js");
  loadSource("public/app/services/translation/service-class.js");
  loadSource("public/app/services/translation/rate-limit.js");
  loadSource("public/app/services/translation/batch.js");
  loadSource("public/app/services/translation/terminology.js");
  loadSource("public/app/services/translation/translate.js");
  loadSource("public/app/services/translation/engines/base/ai-engine-base.js");

  globalThis.EngineRegistry = {
    _engines: new Map(),
    register(cfg) {
      this._engines.set(cfg.id, cfg);
      return this;
    },
    get(id) {
      return this._engines.get(id) || null;
    },
    getDefaultEngineId() {
      return "test-finalize";
    },
    getModelCapability() {
      return { supportsJsonMode: true, supportsBatch: true, isReasoningModel: false };
    },
  };
  globalThis.securityUtils = {
    sanitizeForApi: (t) =>
      typeof t === "string"
        ? t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().substring(0, 10000)
        : "",
    validateApiKey: () => true,
  };
});

function makeItems(n, withPlaceholder) {
  return Array.from({ length: n }, (_, i) => ({
    id: "id-" + i,
    sourceText: withPlaceholder ? `Hello %s number ${i}` : `source-${i}`,
    targetText: "",
    status: "pending",
    metadata: { key: "key-" + i, file: "test.json" },
  }));
}

function makeService() {
  globalThis.AppState = {
    project: { id: "p1", translationItems: [] },
    translations: { isInProgress: false, isPaused: false, progress: {} },
    ui: {},
    terminology: { entries: [] },
  };
  globalThis.TerminologyStore = { getList: () => [], setList() {}, mergeTerms() {} };
  globalThis.SettingsCache = { get: () => ({}), save() {}, update() {} };
  globalThis.loggers = new Proxy({}, { get: () => new Proxy({}, { get: () => () => {} }) });
  const svc = new TranslationService();
  svc.getSettings = async () => ({
    model: "test-model",
    aiBatchMaxItems: 10,
    aiBatchMaxChars: 20000,
    aiConversationEnabled: false,
    apiTimeout: 30,
    retryCount: 1,
  });
  svc.checkRateLimit = async () => {};
  return svc;
}

const okResponse = (translations) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({
    choices: [{ message: { content: JSON.stringify({ translations }) }, finish_reason: "stop" }],
  }),
});

beforeEach(() => {
  globalThis._aiLongTextNotified = false;
  BatchProgressStore._cancelled = false;
  BatchProgressStore._started = false;
});

describe("取消路径也必须做占位符还原与结果校验（P0 回归）", () => {
  it("partialOutputs 中的 «N» 哨兵会被还原为真实占位符，坏结果被拒绝", async () => {
    const items = makeItems(4, true); // 源文都含 %s
    const svc = makeService();
    let requests = 0;

    globalThis.networkUtils = {
      // 模拟「第一个 chunk 已返回、用户在第二个 chunk 取消」：引擎抛出带 partialOutputs 的取消错误
      fetchWithTimeout: async () => {
        requests++;
        const err = new Error("用户取消");
        err.code = "USER_CANCELLED";
        err.partialOutputs = [
          "译-Hello «0» number 0", // 正常（含哨兵，应被还原）
          { text: "坏结果" },       // 非字符串（应被拒绝）
          "",                       // 空串（应被拒绝）
          "译-Hello «0» number 3",
        ];
        throw err;
      },
      fetchWithDedupe: async (...a) => globalThis.networkUtils.fetchWithTimeout(...a),
      cancelAll: () => {},
    };

    // 让引擎把源文保护后再发给模型，从而在 item 上留下 __phGuardMap
    EngineRegistry.register({
      id: "test-finalize",
      name: "TestFinalize",
      category: "ai",
      apiUrl: "https://fake.test/v1/chat/completions",
      apiKeyField: "testApiKey",
      apiKeyValidationType: "none",
      defaultModel: "test-model",
      supportsJsonMode: false,
      supportsBatch: true,
      rateLimitPerSecond: 100,
    });

    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await svc.translateBatch(items, "en", "zh", "test-finalize", null);

    // 成功项：真实占位符已还原，且不含哨兵
    expect(results.map((r) => r.index).sort()).toEqual([0, 3]);
    expect(items[0].targetText).toBe("译-Hello %s number 0");
    expect(items[3].targetText).toBe("译-Hello %s number 3");
    for (const it of items) {
      expect(String(it.targetText)).not.toContain("«");
    }
    expect(items[0].status).toBe("translated");

    // 坏结果：被拒绝并记为失败，绝不当成已翻译
    expect(errors.map((e) => e.index).sort()).toEqual([1, 2]);
    expect(errors.every((e) => e.code === "INVALID_TRANSLATION_RESULT")).toBe(true);
    expect(items[1].status).toBe("pending");
    expect(items[1].targetText).toBe("");
    expect(items[2].status).toBe("pending");

    // 映射用完即弃：不随条目进入持久化/项目导出
    expect(items.every((it) => !("__phGuardMap" in it))).toBe(true);
    expect(requests).toBe(1);
  });
});

describe("非字符串结果不再作废整批（P1 回归）", () => {
  it("源文含占位符 + 模型返回对象：逐条记失败，且不触发逐项回退", async () => {
    const items = makeItems(3, true);
    const svc = makeService();
    let requests = 0;

    globalThis.networkUtils = {
      fetchWithTimeout: async (url, o) => {
        requests++;
        const body = JSON.parse(o.body);
        const lastMsg = body.messages[body.messages.length - 1].content;
        const payload = JSON.parse(lastMsg.substring(lastMsg.indexOf('{"items"')));
        // 模型返回「等长但坏」的结果
        return okResponse(payload.items.map(() => ({ text: "对象结果" })));
      },
      fetchWithDedupe: async (...a) => globalThis.networkUtils.fetchWithTimeout(...a),
      cancelAll: () => {},
    };

    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await svc.translateBatch(items, "en", "zh", "test-finalize", null);

    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.code === "INVALID_TRANSLATION_RESULT")).toBe(true);
    expect(items.every((i) => i.status === "pending" && i.targetText === "")).toBe(true);
    // 关键：只有 1 次批量请求。修复前会抛 TypeError → 整批作废 → 逐项重译（3 次单条请求）
    expect(requests).toBe(1);
  });
});
