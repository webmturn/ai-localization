/**
 * ModelFetcher 模型列表拉取服务测试
 * 覆盖：响应解析（OpenAI/Claude/Gemini 格式）、默认过滤、URL 推导、缓存读写、fetch 流程
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/model-fetch.js");
});

beforeEach(() => {
  try { localStorage.clear(); } catch (e) {}
  globalThis.fetch = undefined;
});

afterEach(() => {
  delete globalThis.fetch;
});

describe("ModelFetcher.parseModelsResponse", () => {
  it("解析 OpenAI 兼容格式 { data: [{ id }] }", () => {
    const data = { data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] };
    const models = ModelFetcher.parseModelsResponse(data);
    expect(models).toEqual([
      { id: "gpt-4o", label: "gpt-4o" },
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
    ]);
  });

  it("解析带 display_name 的 Claude 格式", () => {
    const data = {
      data: [
        { id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4" },
        { id: "claude-3-5-haiku-20241022", display_name: "Claude 3.5 Haiku" },
      ],
    };
    const models = ModelFetcher.parseModelsResponse(data);
    expect(models[0]).toEqual({ id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" });
    expect(models[1].label).toBe("Claude 3.5 Haiku");
  });

  it("解析 Gemini 原生格式 { models: [{ name: models/... }] } 并去掉前缀", () => {
    const data = {
      models: [
        { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
        { name: "models/gemini-1.5-pro" },
      ],
    };
    const models = ModelFetcher.parseModelsResponse(data);
    expect(models[0]).toEqual({ id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" });
    expect(models[1]).toEqual({ id: "gemini-1.5-pro", label: "gemini-1.5-pro" });
  });

  it("空/非法数据返回空数组", () => {
    expect(ModelFetcher.parseModelsResponse(null)).toEqual([]);
    expect(ModelFetcher.parseModelsResponse({})).toEqual([]);
    expect(ModelFetcher.parseModelsResponse({ data: [] })).toEqual([]);
    expect(ModelFetcher.parseModelsResponse({ data: [{ id: "" }] })).toEqual([]);
  });
});

describe("ModelFetcher.defaultModelFilter", () => {
  it("保留 chat 模型", () => {
    expect(ModelFetcher.defaultModelFilter({ id: "gpt-4o" })).toBe(true);
    expect(ModelFetcher.defaultModelFilter({ id: "deepseek-chat" })).toBe(true);
    expect(ModelFetcher.defaultModelFilter({ id: "gemini-2.0-flash" })).toBe(true);
    expect(ModelFetcher.defaultModelFilter({ id: "claude-sonnet-4-20250514" })).toBe(true);
  });

  it("过滤 embedding/whisper/tts/image 等非 chat 模型", () => {
    expect(ModelFetcher.defaultModelFilter({ id: "text-embedding-3-small" })).toBe(false);
    expect(ModelFetcher.defaultModelFilter({ id: "whisper-1" })).toBe(false);
    expect(ModelFetcher.defaultModelFilter({ id: "tts-1" })).toBe(false);
    expect(ModelFetcher.defaultModelFilter({ id: "dall-e-3" })).toBe(false);
    expect(ModelFetcher.defaultModelFilter({ id: "text-moderation-latest" })).toBe(false);
    expect(ModelFetcher.defaultModelFilter({ id: "gpt-4o-realtime-preview" })).toBe(false);
  });
});

describe("ModelFetcher.deriveModelsUrl", () => {
  it("OpenAI 兼容 /v1/chat/completions → /v1/models", () => {
    expect(ModelFetcher.deriveModelsUrl("https://api.example.com/v1/chat/completions"))
      .toBe("https://api.example.com/v1/models");
  });

  it("无 /v1 路径 → origin/models", () => {
    expect(ModelFetcher.deriveModelsUrl("https://api.example.com/chat/completions"))
      .toBe("https://api.example.com/models");
  });

  it("Ollama 本地端点 → /v1/models", () => {
    expect(ModelFetcher.deriveModelsUrl("http://localhost:11434/v1/chat/completions"))
      .toBe("http://localhost:11434/v1/models");
  });

  it("空/非法 URL 返回空字符串", () => {
    expect(ModelFetcher.deriveModelsUrl("")).toBe("");
    expect(ModelFetcher.deriveModelsUrl(null)).toBe("");
    expect(ModelFetcher.deriveModelsUrl("not-a-url")).toBe("");
  });
});

describe("ModelFetcher 缓存", () => {
  it("写入后可读取，未过期", () => {
    // 直接通过 fetch 流程写入缓存（模拟成功拉取）
    const models = [{ id: "gpt-4o", label: "gpt-4o" }];
    const key = ModelFetcher._CACHE_PREFIX + "openai";
    localStorage.setItem(key, JSON.stringify({ models, fetchedAt: Date.now() }));
    expect(ModelFetcher.getCachedModels("openai")).toEqual(models);
  });

  it("过期缓存返回 null", () => {
    const key = ModelFetcher._CACHE_PREFIX + "openai";
    localStorage.setItem(key, JSON.stringify({ models: [{ id: "x" }], fetchedAt: Date.now() - ModelFetcher._DEFAULT_TTL - 1000 }));
    expect(ModelFetcher.getCachedModels("openai")).toBeNull();
  });

  it("clearCache 删除缓存", () => {
    const key = ModelFetcher._CACHE_PREFIX + "deepseek";
    localStorage.setItem(key, JSON.stringify({ models: [], fetchedAt: Date.now() }));
    ModelFetcher.clearCache("deepseek");
    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe("ModelFetcher.fetchModels", () => {
  it("未注册引擎返回错误", async () => {
    const result = await ModelFetcher.fetchModels("no-such-engine");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("未知的翻译引擎");
  });

  it("成功拉取并缓存（OpenAI 格式 + 过滤）", async () => {
    // 注册一个测试引擎
    globalThis.EngineRegistry = {
      get: () => ({
        id: "testai",
        name: "TestAI",
        apiKeyField: "testAiApiKey",
        apiKeyValidationType: "generic",
        isCustom: false,
        modelsEndpoint: { url: "https://api.test.dev/v1/models" },
      }),
    };
    globalThis.SettingsCache = {
      get: () => ({ testAiApiKey: "sk-test-123" }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "model-a" },
          { id: "model-b" },
          { id: "text-embedding-3-small" },
        ],
      }),
    });

    const result = await ModelFetcher.fetchModels("testai", "sk-test-123");
    expect(result.ok).toBe(true);
    expect(result.models.map((m) => m.id)).toEqual(["model-a", "model-b"]);
    // 已写入缓存
    expect(ModelFetcher.getCachedModels("testai").length).toBe(2);

    delete globalThis.EngineRegistry;
    delete globalThis.SettingsCache;
  });

  it("HTTP 错误返回错误信息", async () => {
    globalThis.EngineRegistry = {
      get: () => ({
        id: "testai",
        name: "TestAI",
        apiKeyField: "testAiApiKey",
        apiKeyValidationType: "generic",
        modelsEndpoint: { url: "https://api.test.dev/v1/models" },
      }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "invalid api key" } }),
    });

    const result = await ModelFetcher.fetchModels("testai", "sk-bad");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("invalid api key");

    delete globalThis.EngineRegistry;
  });

  it("未配置 API Key 且需要 Key 时提示先配置", async () => {
    globalThis.EngineRegistry = {
      get: () => ({
        id: "testai",
        name: "TestAI",
        apiKeyField: "testAiApiKey",
        apiKeyValidationType: "generic",
        modelsEndpoint: { url: "https://api.test.dev/v1/models" },
      }),
    };
    globalThis.SettingsCache = { get: () => ({}) };
    const result = await ModelFetcher.fetchModels("testai");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("API Key");

    delete globalThis.EngineRegistry;
    delete globalThis.SettingsCache;
  });

  it("无需 Key 的引擎（如本地 Ollama）可直接拉取", async () => {
    globalThis.EngineRegistry = {
      get: () => ({
        id: "custom-ollama",
        name: "Ollama",
        apiKeyField: "customApiKey_custom-ollama",
        apiKeyValidationType: "none",
        isCustom: true,
        apiUrl: "http://localhost:11434/v1/chat/completions",
        modelsEndpoint: { url: "http://localhost:11434/v1/models" },
      }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "llama3" }, { id: "qwen2.5" }] }),
    });

    const result = await ModelFetcher.fetchModels("custom-ollama", "");
    expect(result.ok).toBe(true);
    expect(result.models.length).toBe(2);

    delete globalThis.EngineRegistry;
  });
});

describe("ModelFetcher.fetchModelsForConfig", () => {
  it("表单预取场景：临时 config（isCustom + apiUrl）自动推导 /models 端点拉取", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "llama3" }, { id: "qwen2.5" }] }),
    });

    const tempConfig = {
      apiUrl: "http://localhost:11434/v1/chat/completions",
      isCustom: true,
      apiKeyValidationType: "none",
      customHeaders: {},
    };
    const result = await ModelFetcher.fetchModelsForConfig(tempConfig, "");
    expect(result.ok).toBe(true);
    expect(result.models.map((m) => m.id)).toEqual(["llama3", "qwen2.5"]);
    // 请求打到从 apiUrl 推导出的 /models 端点
    expect(globalThis.fetch.mock.calls[0][0]).toBe("http://localhost:11434/v1/models");
  });

  it("不写缓存（缓存按 engineId 组织，写缓存职责归 fetchModels）", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m1" }] }),
    });
    await ModelFetcher.fetchModelsForConfig({
      apiUrl: "http://localhost:11434/v1",
      isCustom: true,
      apiKeyValidationType: "none",
    }, "");
    expect(localStorage.getItem(ModelFetcher._CACHE_PREFIX + "custom-x")).toBeNull();
  });

  it("需要 Key 但未提供时提示先配置（无 name 时兜底『该引擎』）", async () => {
    const result = await ModelFetcher.fetchModelsForConfig({
      apiUrl: "http://x.dev/v1",
      isCustom: true,
      apiKeyValidationType: "generic",
    }, "");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("请先配置");
    expect(result.error).toContain("该引擎");
  });

  it("config 缺失直接报错", async () => {
    const result = await ModelFetcher.fetchModelsForConfig(null);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("引擎配置缺失");
  });

  it("customHeaders 注入请求头（本地代理私有 token 场景）", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m1" }] }),
    });
    await ModelFetcher.fetchModelsForConfig({
      apiUrl: "http://localhost:9000/v1",
      isCustom: true,
      apiKeyValidationType: "none",
      customHeaders: { "X-Proxy-Token": "t1" },
    }, "");
    const headers = globalThis.fetch.mock.calls[0][1].headers;
    expect(headers["X-Proxy-Token"]).toBe("t1");
  });
});
