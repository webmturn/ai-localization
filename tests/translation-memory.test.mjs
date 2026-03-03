/**
 * 翻译记忆库测试
 * 测试 public/app/services/translation/translation-memory.js
 * 注意：IndexedDB 在 jsdom 中不完全可用，此处仅测试纯函数工具
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/translation-memory.js");
});

describe("TranslationMemory._normalizeText", () => {
  it("去除多余空白并 trim", () => {
    expect(TranslationMemory._normalizeText("  hello   world  ")).toBe("hello world");
  });

  it("统一 CRLF 为 LF", () => {
    expect(TranslationMemory._normalizeText("a\r\nb")).toBe("a b");
  });

  it("空值返回空字符串", () => {
    expect(TranslationMemory._normalizeText(null)).toBe("");
    expect(TranslationMemory._normalizeText(undefined)).toBe("");
  });
});

describe("TranslationMemory._hashString", () => {
  it("相同输入产生相同哈希", () => {
    const h1 = TranslationMemory._hashString("Hello World");
    const h2 = TranslationMemory._hashString("Hello World");
    expect(h1).toBe(h2);
  });

  it("不同输入产生不同哈希", () => {
    const h1 = TranslationMemory._hashString("Hello");
    const h2 = TranslationMemory._hashString("World");
    expect(h1).not.toBe(h2);
  });

  it("返回字符串类型", () => {
    expect(typeof TranslationMemory._hashString("test")).toBe("string");
  });
});

describe("TranslationMemory._similarity", () => {
  it("完全相同返回 100", () => {
    expect(TranslationMemory._similarity("Hello", "Hello")).toBe(100);
  });

  it("标准化后相同也返回 100", () => {
    expect(TranslationMemory._similarity("  Hello  World ", "Hello World")).toBe(100);
  });

  it("完全不同返回 0 或接近 0", () => {
    const score = TranslationMemory._similarity("abc", "xyz");
    expect(score).toBeLessThan(50);
  });

  it("部分相似返回中间值", () => {
    const score = TranslationMemory._similarity("Hello World", "Hello Earth");
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it("空字符串返回 0", () => {
    expect(TranslationMemory._similarity("", "hello")).toBe(0);
    expect(TranslationMemory._similarity("hello", "")).toBe(0);
    expect(TranslationMemory._similarity("", "")).toBe(100); // 标准化后都是空 → 相同
  });

  it("单字符差异的相似度很高", () => {
    const score = TranslationMemory._similarity("Hello World!", "Hello World?");
    expect(score).toBeGreaterThan(90);
  });
});
