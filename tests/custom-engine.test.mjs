/**
 * CustomEngineManager 自定义引擎管理测试
 * 覆盖：注册（id 归一化/modelsEndpoint 推导）、持久化、恢复、注销（含模型缓存清理）
 * 依赖：ModelFetcher 真实现（clearCache）；EngineRegistry 用最小桩（custom-engine.js 只用 register/removeCustom）
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

function createRegistryStub() {
  return {
    _map: new Map(),
    register(config) { this._map.set(config.id, config); return this; },
    get(id) { return this._map.get(id) || null; },
    has(id) { return this._map.has(id); },
    removeCustom(id) {
      const c = this._map.get(id);
      if (c && c.isCustom) { this._map.delete(id); return true; }
      return false;
    },
  };
}

beforeAll(() => {
  setupGlobals();
  // custom-engine.js 将 CustomEngineManager 挂到 window 并在 IIFE 内立即恢复已存引擎
  loadSource("public/app/services/translation/model-fetch.js");
  globalThis.EngineRegistry = createRegistryStub();
  loadSource("public/app/services/translation/engines/providers/custom-engine.js");
});

beforeEach(() => {
  try { localStorage.clear(); } catch (e) {}
  EngineRegistry._map.clear();
});

describe("CustomEngineManager.add", () => {
  it("注册并持久化：id 自动补 custom- 前缀，推导 modelsEndpoint", () => {
    const ok = CustomEngineManager.add({
      id: "ollama",
      name: "Ollama (本地)",
      apiUrl: "http://localhost:11434/v1/chat/completions",
      model: "llama3",
    });
    expect(ok).toBe(true);

    // 注册表配置
    expect(EngineRegistry.has("custom-ollama")).toBe(true);
    const cfg = EngineRegistry.get("custom-ollama");
    expect(cfg.isCustom).toBe(true);
    expect(cfg.category).toBe("ai");
    expect(cfg.defaultModel).toBe("llama3");
    expect(cfg.apiKeyValidationType).toBe("none");
    // 从 apiUrl 推导 /models 端点（动态模型列表数据源）
    expect(cfg.modelsEndpoint.url).toBe("http://localhost:11434/v1/models");

    // localStorage 持久化（规范化后的 id）
    const stored = JSON.parse(localStorage.getItem("__customEngines"));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("custom-ollama");
  });

  it("requiresApiKey 时 apiKeyValidationType 为 generic", () => {
    CustomEngineManager.add({
      id: "vllm",
      apiUrl: "http://localhost:8000/v1/chat/completions",
      model: "qwen2.5",
      requiresApiKey: true,
    });
    expect(EngineRegistry.get("custom-vllm").apiKeyValidationType).toBe("generic");
  });

  it("同 id 重复 add 更新而非追加", () => {
    CustomEngineManager.add({ id: "a", apiUrl: "http://a/v1", model: "m1" });
    CustomEngineManager.add({ id: "custom-a", apiUrl: "http://a2/v1", model: "m2" });
    const stored = JSON.parse(localStorage.getItem("__customEngines"));
    expect(stored).toHaveLength(1);
    expect(stored[0].apiUrl).toBe("http://a2/v1");
    expect(EngineRegistry.get("custom-a").defaultModel).toBe("m2");
  });

  it("缺 id 或 apiUrl 返回 false 且不持久化", () => {
    expect(CustomEngineManager.add({ apiUrl: "http://x/v1" })).toBe(false);
    expect(CustomEngineManager.add({ id: "x" })).toBe(false);
    // 从未写入过存储（saveCustomEngines 仅在成功 add 时调用）
    expect(localStorage.getItem("__customEngines")).toBeNull();
  });
});

describe("CustomEngineManager.remove", () => {
  it("注销：注册表移除 + 存储移除 + 模型缓存清理", () => {
    CustomEngineManager.add({
      id: "ollama",
      apiUrl: "http://localhost:11434/v1/chat/completions",
      model: "llama3",
    });
    // 预置模型列表缓存（模拟曾拉取过）
    const cacheKey = "__aiModels_custom-ollama";
    localStorage.setItem(cacheKey, JSON.stringify({ models: [{ id: "llama3" }], fetchedAt: Date.now() }));

    // 传无前缀 id 也能归一化
    CustomEngineManager.remove("ollama");

    expect(EngineRegistry.has("custom-ollama")).toBe(false);
    expect(JSON.parse(localStorage.getItem("__customEngines"))).toHaveLength(0);
    // 缓存清理：避免删除后重建同名引擎（即使换了 URL）命中旧缓存
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it("removeCustom 只允许移除自定义引擎（内置引擎不受影响）", () => {
    EngineRegistry.register({ id: "deepseek", category: "ai", isCustom: false });
    CustomEngineManager.remove("deepseek");
    expect(EngineRegistry.has("deepseek")).toBe(true);
  });
});

describe("CustomEngineManager.restore", () => {
  it("从 localStorage 恢复引擎注册", () => {
    localStorage.setItem("__customEngines", JSON.stringify([
      { id: "custom-a", apiUrl: "http://a/v1", model: "m1" },
      { id: "custom-b", apiUrl: "http://b/v1", model: "m2" },
    ]));
    const restored = CustomEngineManager.restore();
    expect(restored).toBe(2);
    expect(EngineRegistry.has("custom-a")).toBe(true);
    expect(EngineRegistry.has("custom-b")).toBe(true);
    expect(EngineRegistry.get("custom-a").defaultModel).toBe("m1");
  });

  it("空存储恢复 0 个", () => {
    expect(CustomEngineManager.restore()).toBe(0);
  });
});
