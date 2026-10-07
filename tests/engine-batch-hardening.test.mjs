/**
 * 引擎批量路径回归测试（本次修复新增）
 *
 * 覆盖两个此前未被测试覆盖的缺陷：
 *  1. 模型返回等长的非字符串/空项时，坏结果会被当成成功译文写入 item.targetText
 *  2. 暂停（pauseBatch）在 AI 批量路径上是死代码 —— waitWhilePaused 从未被调用，
 *     暂停后剩余 chunk 仍会被继续发出
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/core/batch-progress-store.js");
  loadSource("public/app/services/translation/placeholder-guard.js");
  loadSource("public/app/services/translation/helpers.js");
  // TranslationService 类必须先于 batch.js / terminology.js 加载
  // （它们通过 TranslationService.prototype 挂载方法）
  loadSource("public/app/services/translation/service-class.js");
  // rate-limit.js 提供 _ensureRateLimitEntry / checkRateLimit（逐个回退路径会用到）
  loadSource("public/app/services/translation/rate-limit.js");
  loadSource("public/app/services/translation/batch.js");
  loadSource("public/app/services/translation/terminology.js");
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
      return "test-batch";
    },
    getModelCapability() {
      return { supportsJsonMode: true, supportsBatch: true, isReasoningModel: false };
    },
  };
  // 复刻真实实现（含 10000 字符截断）
  globalThis.securityUtils = {
    sanitizeForApi: (t) =>
      typeof t === "string"
        ? t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().substring(0, 10000)
        : "",
    validateApiKey: () => true,
  };
});

// TranslationService 由 service-class.js 以 class 声明提供：
// vm.runInThisContext 下 class 不挂载到 globalThis，但跨脚本共享词法绑定，
// 因此可直接引用（与 engine-cross-cutting.test.mjs 的做法一致）。
function makeService() {
  return new TranslationService();
}

function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: "id-" + i,
    sourceText: "source-" + i,
    targetText: "",
    status: "pending",
    metadata: { key: "key-" + i, file: "test.json" },
  }));
}

function makeHarness(opts = {}) {
  const { responder, maxItems = 10, delay = 0 } = opts;
  const svc = makeService();
  globalThis.AppState = {
    project: { id: "p1", translationItems: [] },
    translations: { isInProgress: false, isPaused: false, progress: {} },
    ui: {},
    terminology: { entries: [] },
  };
  globalThis.TerminologyStore = { getList: () => [], setList() {}, mergeTerms() {} };
  globalThis.SettingsCache = { get: () => ({}), save() {}, update() {} };
  globalThis.loggers = new Proxy({}, { get: () => new Proxy({}, { get: () => () => {} }) });

  globalThis.EngineRegistry.register({
    id: "test-batch",
    name: "TestBatch",
    category: "ai",
    apiUrl: "https://fake.test/v1/chat/completions",
    apiKeyField: "testApiKey",
    apiKeyValidationType: "none",
    defaultModel: "test-model",
    supportsJsonMode: false,
    supportsBatch: true,
    rateLimitPerSecond: 100,
  });

  const dispatched = [];
  globalThis.networkUtils = {
    fetchWithTimeout: async (url, o) => {
      const body = JSON.parse(o.body);
      const lastMsg = body.messages[body.messages.length - 1].content;
      const payload = JSON.parse(lastMsg.substring(lastMsg.indexOf('{"items"')));
      dispatched.push(payload.items.map((i) => i.source));
      if (delay) await new Promise((r) => setTimeout(r, delay));
      const translations = responder(payload.items).map((text, index) => ({ id: payload.items[index].id, text }));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ translations }) }, finish_reason: "stop" }],
        }),
      };
    },
    cancelAll: () => {},
  };

  svc.getSettings = async () => ({
    model: "test-model",
    aiBatchMaxItems: maxItems,
    aiBatchMaxChars: 20000,
    aiConversationEnabled: false,
    apiTimeout: 30,
    retryCount: 1,
  });
  svc.checkRateLimit = async () => {};

  return { dispatched, svc };
}

beforeEach(() => {
  globalThis._aiLongTextNotified = false;
  if (globalThis.BatchProgressStore) {
    BatchProgressStore._cancelled = false;
    BatchProgressStore._started = false;
  }
});

describe("批量结果校验（回归：坏结果曾被当作成功译文写入 targetText）", () => {
  it("对象项不再被写入 targetText（此前是 [object Object]）", async () => {
    const items = makeItems(3);
    const h = makeHarness({ responder: (its) => its.map((i) => ({ text: "译-" + i.source })) });
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    // 三项都应失败而不是被写成对象
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(3);
    for (const it of items) {
      expect(it.status).toBe("pending");
      expect(it.targetText).toBe("");
    }
  });

  it("null 项被记为失败", async () => {
    const items = makeItems(3);
    const h = makeHarness({ responder: (its) => its.map((i, idx) => (idx === 1 ? null : "译-" + i.source)) });
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    expect(results).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(items[0].targetText).toBe("译-source-0");
    expect(items[2].targetText).toBe("译-source-2");
    expect(items[1].targetText).toBe("");
    expect(items[1].status).toBe("pending");
  });

  it("空串项被记为失败", async () => {
    const items = makeItems(2);
    const h = makeHarness({ responder: (its) => its.map((i, idx) => (idx === 0 ? "" : "译-" + i.source)) });
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    expect(errors).toHaveLength(1);
    expect(items[0].targetText).toBe("");
    expect(items[1].targetText).toBe("译-source-1");
  });

  it("占位符损坏的译文被记为失败（此前无任何校验）", async () => {
    const items = makeItems(1);
    items[0].sourceText = "Hello %s";
    const h = makeHarness({ responder: () => ["你好，朋友"] }); // 丢了 %s
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(items[0].targetText).toBe("");
  });

  it("正常字符串译文照常成功，且占位符被还原", async () => {
    const items = makeItems(1);
    items[0].sourceText = "Hello %s";
    const h = makeHarness({
      // 引擎会把 %s 替换成安全标记后发给模型，模型原样保留 → 还原回 %s
      responder: (its) => its.map((i) => i.source.replace("%s", "«0»")),
    });
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(1);
    expect(items[0].status).toBe("translated");
    expect(items[0].targetText).toContain("%s");
  });
});

describe("暂停在 AI 批量路径生效（回归：waitWhilePaused 曾是死代码）", () => {
  it("暂停后不再派发新的 chunk 请求", async () => {
    const items = makeItems(20); // 5 项/chunk → 4 chunks
    const h = makeHarness({
      maxItems: 5,
      delay: 120,
      responder: (its) => its.map((i) => "译-" + i.source),
    });
    BatchProgressStore.beginBatch({ scope: "all" });

    const pending = h.svc.translateBatch(items, "en", "zh", "test-batch", null);
    await new Promise((r) => setTimeout(r, 40));
    BatchProgressStore.pauseBatch(); // 用户点暂停
    const atPause = h.dispatched.length;

    // 暂停期间等待一段时间，期间不应有新请求
    await new Promise((r) => setTimeout(r, 200));
    const duringPause = h.dispatched.length;

    BatchProgressStore.resumeBatch();
    await pending;

    // 暂停生效：等待期间派发数不再增长
    expect(duringPause).toBe(atPause);
    // 恢复后全部完成
    expect(items.every((i) => i.status === "translated")).toBe(true);
  });
});

// 回归：模型不遵守"只返回 JSON"的约定时，旧实现直接 JSON.parse 失败 →
// 触发自适应拆半重试（请求数放大 4–5 倍）→ 最终整批中止并回退逐项翻译。
// 现在应能宽容解析代码围栏 / 裸数组 / 前后夹带说明文字。
describe("模型返回非规范 JSON 时的宽容解析（回归）", () => {
  function makeRawHarness(contentBuilder) {
    // 直接返回原始字符串作为 message.content，绕过 harness 的 JSON.stringify
    const h = makeHarness({ responder: () => [] });
    globalThis.networkUtils.fetchWithTimeout = async (url, o) => {
      const body = JSON.parse(o.body);
      const lastMsg = body.messages[body.messages.length - 1].content;
      const payload = JSON.parse(lastMsg.substring(lastMsg.indexOf('{"items"')));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          choices: [
            { message: { content: contentBuilder(payload.items) }, finish_reason: "stop" },
          ],
        }),
      };
    };
    return h;
  }

  const shapes = [
    ["代码围栏 ```json", (its) => "```json\n" + JSON.stringify({ translations: its.map((i) => "译-" + i.source) }) + "\n```"],
    ["代码围栏无语言标记", (its) => "```\n" + JSON.stringify({ translations: its.map((i) => "译-" + i.source) }) + "\n```"],
    ["前后夹带说明文字", (its) => "好的，以下是翻译结果：\n" + JSON.stringify({ translations: its.map((i) => "译-" + i.source) }) + "\n希望有帮助"],
    ["裸数组", (its) => JSON.stringify(its.map((i) => "译-" + i.source))],
    ["别名 items 键", (its) => JSON.stringify({ items: its.map((i) => "译-" + i.source) })],
  ];

  for (const [label, build] of shapes) {
    it(`${label} 能正常翻译（不再整批中止）`, async () => {
      const items = makeItems(3);
      const h = makeRawHarness(build);
      BatchProgressStore.beginBatch({ scope: "all" });
      const { results, errors } = await h.svc.translateBatch(
        items, "en", "zh", "test-batch", null
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      expect(items.map((i) => i.targetText)).toEqual([
        "译-source-0", "译-source-1", "译-source-2",
      ]);
    });
  }

  it("真正的乱码仍然失败（不误判为成功）", async () => {
    const items = makeItems(2);
    const h = makeRawHarness(() => "这不是 JSON，只是普通文字");
    BatchProgressStore.beginBatch({ scope: "all" });
    const { results, errors } = await h.svc.translateBatch(
      items, "en", "zh", "test-batch", null
    );
    expect(results).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
