/**
 * 引擎横切修复回归测试
 * 覆盖：
 * 1. 限速惰性补建（_ensureRateLimitEntry）：运行时注册引擎同样受限速与 429 冷却
 * 2. Claude stop_reason 截断检测（_aiIsTruncatedBatchResponse）
 * 3. OpenAI o 系正则 [1-9]（jsonModeUnsupportedModels / modelCapabilities 匹配）
 * 4. google-translate _buildRequest 复用 config.apiUrl 单源
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  // engine-registry + providers（register 依赖 EngineRegistry/loggers）
  loadSource("public/app/services/translation/engines/engine-registry.js");
  loadSource("public/app/services/translation/engines/providers/openai.js");
  loadSource("public/app/services/translation/engines/providers/google-translate.js");
  // ai-engine-base：_aiIsTruncatedBatchResponse（顶层纯函数，可独立加载）
  loadSource("public/app/services/translation/engines/base/ai-engine-base.js");
  // TranslationService 类 + 原型方法（checkRateLimit/reportRateLimit/_ensureRateLimitEntry）
  loadSource("public/app/services/translation/service-class.js");
  loadSource("public/app/services/translation/rate-limit.js");
});

describe("限速惰性补建 _ensureRateLimitEntry", () => {
  let svc;

  beforeEach(() => {
    svc = new TranslationService();
  });

  it("构造时已注册引擎在快照中", () => {
    expect(svc.rateLimits.deepseek.maxPerSecond).toBe(10);
  });

  it("运行时新增引擎：checkRateLimit 惰性补建条目（不再空转）", () => {
    // 模拟保存自定义引擎后不刷新页面：注册表有、快照无
    EngineRegistry.register({ id: "custom-late", category: "ai", rateLimitPerSecond: 2, isCustom: true });
    expect(svc.rateLimits["custom-late"]).toBeUndefined();

    const limit = svc._ensureRateLimitEntry("custom-late");
    expect(limit.maxPerSecond).toBe(2);
    expect(svc.rateLimits["custom-late"].maxPerSecond).toBe(2);
  });

  it("运行时新增引擎：reportRateLimit 冷却同样生效（429 风暴修复）", () => {
    EngineRegistry.register({ id: "custom-late2", category: "ai", rateLimitPerSecond: 5, isCustom: true });
    svc.reportRateLimit("custom-late2", 60);
    const limit = svc.rateLimits["custom-late2"];
    expect(limit).toBeDefined();
    expect(limit._cooldownUntil).toBeGreaterThan(Date.now());
  });

  it("未注册引擎回退默认 3 RPS，不抛错", () => {
    const limit = svc._ensureRateLimitEntry("ghost-engine");
    expect(limit.maxPerSecond).toBe(3);
  });

  it("小数 RPS 引擎补建后保持原值（Gemini 0.25 强制串行依据）", () => {
    EngineRegistry.register({ id: "custom-frac", category: "ai", rateLimitPerSecond: 0.25, isCustom: true });
    expect(svc._ensureRateLimitEntry("custom-frac").maxPerSecond).toBe(0.25);
  });
});

describe("Claude stop_reason 截断检测", () => {
  it("顶层 stop_reason=max_tokens 判定为截断（Claude 原生格式）", () => {
    expect(_aiIsTruncatedBatchResponse({ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"trans" }] })).toBe(true);
  });

  it("stop_reason=end_turn 不误判", () => {
    expect(_aiIsTruncatedBatchResponse({ stop_reason: "end_turn", content: [] })).toBe(false);
  });

  it("OpenAI finish_reason=length 仍命中", () => {
    expect(_aiIsTruncatedBatchResponse({ choices: [{ finish_reason: "length" }] })).toBe(true);
  });

  it("正常响应不误判", () => {
    expect(_aiIsTruncatedBatchResponse({ choices: [{ finish_reason: "stop" }], content: [] })).toBe(false);
  });
});

describe("OpenAI o 系正则（jsonModeUnsupportedModels / modelCapabilities）", () => {
  const oModels = ["o1", "o1-mini", "o3-mini", "o4", "o4-mini"];
  const nonOModels = ["gpt-4o", "gpt-4o-mini", "chatgpt-4o-latest"];

  it("o1-o4 系全部识别为推理模型（触发温度移除/max_completion_tokens/合并 system）", () => {
    for (const m of oModels) {
      const cap = EngineRegistry.getModelCapability("openai", m);
      expect(cap.isReasoningModel, m + " 应为推理模型").toBe(true);
      expect(cap.disablesTemperature, m + " 应移除温度").toBe(true);
      expect(cap.usesMaxCompletionTokens, m + " 应用 max_completion_tokens").toBe(true);
      expect(cap.supportsJsonMode, m + " 不应强制 JSON mode").toBe(false);
    }
  });

  it("非 o 系模型不受影响", () => {
    for (const m of nonOModels) {
      const cap = EngineRegistry.getModelCapability("openai", m);
      expect(cap.isReasoningModel, m + " 不应为推理模型").toBe(false);
    }
  });
});

describe("google-translate 单源 URL", () => {
  it("_buildRequest 复用 config.apiUrl（改一处即生效）", () => {
    const cfg = EngineRegistry.get("google");
    const req = cfg._buildRequest("hello", "en", "zh", "test-key", {});
    expect(req.url).toBe(cfg.apiUrl);
    expect(req.headers["X-Goog-Api-Key"]).toBe("test-key");
  });

  it("apiUrl 修改后请求 URL 跟随（单源验证）", () => {
    const cfg = EngineRegistry.get("google");
    const original = cfg.apiUrl;
    try {
      cfg.apiUrl = "https://example.com/translate";
      const req = cfg._buildRequest("hello", "en", "zh", "k", {});
      expect(req.url).toBe("https://example.com/translate");
    } finally {
      cfg.apiUrl = original;
    }
  });
});
