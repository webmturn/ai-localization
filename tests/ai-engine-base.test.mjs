/**
 * AIEngineBase 温度钳制测试
 * 验证 _aiClampTemperature：按引擎 temperatureRange 限制，未设置时默认 0-2
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/engines/base/ai-engine-base.js");
});

describe("_aiClampTemperature", () => {
  it("默认范围 0-2：未声明 range 时按 0-2 钳制", () => {
    expect(_aiClampTemperature({}, 1.5)).toBe(1.5);
    expect(_aiClampTemperature({}, 3)).toBe(2);
    expect(_aiClampTemperature({}, -1)).toBe(0);
  });

  it("Claude 0-1：超上限钳制到 1", () => {
    const cfg = { temperatureRange: { min: 0, max: 1 } };
    expect(_aiClampTemperature(cfg, 1.5)).toBe(1);
    expect(_aiClampTemperature(cfg, 0.5)).toBe(0.5);
    expect(_aiClampTemperature(cfg, -0.2)).toBe(0);
  });

  it("未设置温度时使用默认值 0.3，并按范围钳制", () => {
    expect(_aiClampTemperature({}, null)).toBe(0.3);
    expect(_aiClampTemperature({}, undefined)).toBe(0.3);
    const cfg = { temperatureRange: { min: 0.5, max: 1 } };
    expect(_aiClampTemperature(cfg, null)).toBe(0.5); // 0.3 低于 min → 钳到 0.5
  });

  it("非法输入回退默认 0.3", () => {
    expect(_aiClampTemperature({}, "abc")).toBe(0.3);
    expect(_aiClampTemperature({}, NaN)).toBe(0.3);
  });

  it("自定义引擎默认 0-2，可通过 range 覆盖", () => {
    expect(_aiClampTemperature({ temperatureRange: { min: 0, max: 2 } }, 2.5)).toBe(2);
    expect(_aiClampTemperature({ temperatureRange: { min: 0, max: 1 } }, 0.9)).toBe(0.9);
  });
});

describe("_aiResolveModel", () => {
  it("自定义引擎跳过白名单：动态选择的模型（不在 availableModels）直接采用", () => {
    const cfg = {
      id: "custom-ollama",
      isCustom: true,
      defaultModel: "llama3",
      // availableModels 仅含表单配置的单个模型
      availableModels: ["llama3"],
    };
    expect(_aiResolveModel({ model: "qwen2.5" }, cfg)).toBe("qwen2.5");
  });

  it("自定义引擎未选模型时回退 defaultModel", () => {
    const cfg = { id: "custom-ollama", isCustom: true, defaultModel: "llama3", availableModels: ["llama3"] };
    expect(_aiResolveModel({}, cfg)).toBe("llama3");
    expect(_aiResolveModel({ model: "" }, cfg)).toBe("llama3");
  });

  it("程序化引擎（非自定义）白名单外仍回退 defaultModel", () => {
    const cfg = { id: "prog", defaultModel: "m1", availableModels: ["m1", "m2"] };
    expect(_aiResolveModel({ model: "m3" }, cfg)).toBe("m1");
    expect(_aiResolveModel({ model: "m2" }, cfg)).toBe("m2");
  });

  it("无 availableModels 时直接采用 settings.model，为空回退 defaultModel", () => {
    expect(_aiResolveModel({ model: "any-model" }, { id: "openai", defaultModel: "gpt-4o" })).toBe("any-model");
    expect(_aiResolveModel({}, { id: "openai", defaultModel: "gpt-4o" })).toBe("gpt-4o");
  });
});
