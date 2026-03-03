/**
 * 安全工具类测试
 * 测试 public/app/services/security-utils.js
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/security-utils.js");
});

describe("SecurityUtils.validateApiKey", () => {
  let su;

  beforeAll(() => {
    su = new SecurityUtils();
  });

  // --- 通用验证 ---
  it("null/undefined/空字符串返回 false", () => {
    expect(su.validateApiKey(null)).toBe(false);
    expect(su.validateApiKey(undefined)).toBe(false);
    expect(su.validateApiKey("")).toBe(false);
  });

  it("非字符串返回 false", () => {
    expect(su.validateApiKey(12345)).toBe(false);
    expect(su.validateApiKey({})).toBe(false);
  });

  it("过短的 key 返回 false（generic 模式 < 10）", () => {
    expect(su.validateApiKey("abc")).toBe(false);
    expect(su.validateApiKey("123456789")).toBe(false);
  });

  it("generic 模式 >= 10 字符通过", () => {
    expect(su.validateApiKey("1234567890")).toBe(true);
    expect(su.validateApiKey("a".repeat(50))).toBe(true);
  });

  // --- OpenAI ---
  it("openai: 以 sk- 开头且 > 20 字符通过", () => {
    expect(su.validateApiKey("sk-" + "a".repeat(48), "openai")).toBe(true);
  });

  it("openai: 不以 sk- 开头失败", () => {
    expect(su.validateApiKey("pk-" + "a".repeat(48), "openai")).toBe(false);
  });

  it("openai: 太短失败", () => {
    expect(su.validateApiKey("sk-short", "openai")).toBe(false);
  });

  // --- DeepSeek ---
  it("deepseek: >= 20 字符通过", () => {
    expect(su.validateApiKey("a".repeat(20), "deepseek")).toBe(true);
  });

  it("deepseek: < 20 字符失败", () => {
    expect(su.validateApiKey("a".repeat(19), "deepseek")).toBe(false);
  });

  // --- Google ---
  it("google: 20-100 字符通过", () => {
    expect(su.validateApiKey("a".repeat(20), "google")).toBe(true);
    expect(su.validateApiKey("a".repeat(100), "google")).toBe(true);
  });

  it("google: 超过 100 字符失败", () => {
    expect(su.validateApiKey("a".repeat(101), "google")).toBe(false);
  });

  // --- Gemini ---
  it("gemini: AIza 开头 + 30-100 字符通过", () => {
    expect(su.validateApiKey("AIza" + "b".repeat(35), "gemini")).toBe(true);
  });

  it("gemini: 不以 AIza 开头失败", () => {
    expect(su.validateApiKey("XXXX" + "b".repeat(35), "gemini")).toBe(false);
  });

  it("gemini: 太短失败", () => {
    expect(su.validateApiKey("AIza" + "b".repeat(10), "gemini")).toBe(false);
  });

  // --- Claude ---
  it("claude: sk-ant- 开头 + >= 20 字符通过", () => {
    expect(su.validateApiKey("sk-ant-" + "c".repeat(100), "claude")).toBe(true);
  });

  it("claude: 不以 sk-ant- 开头失败", () => {
    expect(su.validateApiKey("sk-xyz-" + "c".repeat(100), "claude")).toBe(false);
  });

  it("claude: 太短失败", () => {
    expect(su.validateApiKey("sk-ant-abc", "claude")).toBe(false);
  });

  // --- None (自定义引擎) ---
  it("none: 任何值都通过（包括空值）", () => {
    expect(su.validateApiKey(null, "none")).toBe(true);
    expect(su.validateApiKey("", "none")).toBe(true);
    expect(su.validateApiKey(undefined, "none")).toBe(true);
    expect(su.validateApiKey("any-key", "none")).toBe(true);
  });
});

describe("SecurityUtils.sanitizeInput", () => {
  let su;

  beforeAll(() => {
    su = new SecurityUtils();
  });

  it("转义 HTML 特殊字符", () => {
    expect(su.sanitizeInput("<script>alert('xss')</script>")).not.toContain("<script>");
  });

  it("空值返回空字符串", () => {
    expect(su.sanitizeInput(null)).toBe("");
    expect(su.sanitizeInput(undefined)).toBe("");
  });

  it("普通文本不变", () => {
    expect(su.sanitizeInput("Hello World")).toBe("Hello World");
  });
});
