import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import vm from "vm";
import fs from "fs";
import path from "path";

let TMAutoApply;
let mockTM;

beforeAll(() => {
  // Mock TranslationMemory
  mockTM = {
    lookupExact: vi.fn(),
    fuzzyMatch: vi.fn(),
    save: vi.fn(),
    saveBatch: vi.fn(),
  };

  const code = fs.readFileSync(
    path.resolve("public/app/services/translation/tm-auto-apply.js"),
    "utf-8"
  );
  const ctx = {
    window: {},
    console,
    TranslationMemory: mockTM,
    loggers: { translation: console },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  TMAutoApply = ctx.window.TMAutoApply;
});

beforeEach(() => {
  vi.clearAllMocks();
  TMAutoApply.resetStats();
  TMAutoApply.setEnabled(true);
});

describe("TMAutoApply.lookup", () => {
  it("精确匹配命中时返回 hit=true, exact=true", async () => {
    mockTM.lookupExact.mockResolvedValue({ targetText: "你好" });
    const r = await TMAutoApply.lookup("Hello", "en", "zh");
    expect(r.hit).toBe(true);
    expect(r.exact).toBe(true);
    expect(r.translation).toBe("你好");
    expect(r.similarity).toBe(1.0);
  });

  it("精确未命中但模糊匹配命中", async () => {
    mockTM.lookupExact.mockResolvedValue(null);
    mockTM.fuzzyMatch.mockResolvedValue([
      { targetText: "你好世界", sourceText: "Hello World", similarity: 0.85 },
    ]);
    const r = await TMAutoApply.lookup("Hello World!", "en", "zh");
    expect(r.hit).toBe(true);
    expect(r.exact).toBe(false);
    expect(r.translation).toBe("你好世界");
    expect(r.similarity).toBe(0.85);
  });

  it("无匹配时返回 hit=false", async () => {
    mockTM.lookupExact.mockResolvedValue(null);
    mockTM.fuzzyMatch.mockResolvedValue([]);
    const r = await TMAutoApply.lookup("Something new", "en", "zh");
    expect(r.hit).toBe(false);
    expect(r.translation).toBeNull();
  });

  it("禁用时直接返回 hit=false", async () => {
    TMAutoApply.setEnabled(false);
    const r = await TMAutoApply.lookup("Hello", "en", "zh");
    expect(r.hit).toBe(false);
    expect(mockTM.lookupExact).not.toHaveBeenCalled();
  });

  it("TM 抛异常时优雅降级", async () => {
    mockTM.lookupExact.mockRejectedValue(new Error("IDB error"));
    const r = await TMAutoApply.lookup("Hello", "en", "zh");
    expect(r.hit).toBe(false);
  });
});

describe("TMAutoApply.save", () => {
  it("保存翻译条目到 TM", async () => {
    mockTM.save.mockResolvedValue();
    await TMAutoApply.save("Hello", "你好", "en", "zh", "deepseek");
    expect(mockTM.save).toHaveBeenCalledWith({
      sourceText: "Hello",
      targetText: "你好",
      sourceLang: "en",
      targetLang: "zh",
      engine: "deepseek",
    });
  });

  it("空源文或空译文不保存", async () => {
    await TMAutoApply.save("", "你好", "en", "zh");
    await TMAutoApply.save("Hello", "", "en", "zh");
    expect(mockTM.save).not.toHaveBeenCalled();
  });

  it("禁用时不保存", async () => {
    TMAutoApply.setEnabled(false);
    await TMAutoApply.save("Hello", "你好", "en", "zh");
    expect(mockTM.save).not.toHaveBeenCalled();
  });
});

describe("TMAutoApply.saveBatch", () => {
  it("批量保存翻译条目", async () => {
    mockTM.saveBatch.mockResolvedValue();
    await TMAutoApply.saveBatch(
      [
        { sourceText: "Hello", targetText: "你好" },
        { sourceText: "World", targetText: "世界" },
      ],
      "en", "zh", "openai"
    );
    expect(mockTM.saveBatch).toHaveBeenCalledTimes(1);
    const entries = mockTM.saveBatch.mock.calls[0][0];
    expect(entries.length).toBe(2);
    expect(entries[0].engine).toBe("openai");
  });

  it("过滤掉空源文/译文", async () => {
    mockTM.saveBatch.mockResolvedValue();
    await TMAutoApply.saveBatch(
      [
        { sourceText: "Hello", targetText: "你好" },
        { sourceText: "", targetText: "空" },
        { sourceText: "OK", targetText: "" },
      ],
      "en", "zh"
    );
    const entries = mockTM.saveBatch.mock.calls[0][0];
    expect(entries.length).toBe(1);
  });
});

describe("TMAutoApply.getStats", () => {
  it("统计精确命中次数", async () => {
    mockTM.lookupExact.mockResolvedValue({ targetText: "a" });
    await TMAutoApply.lookup("x", "en", "zh");
    await TMAutoApply.lookup("y", "en", "zh");
    const s = TMAutoApply.getStats();
    expect(s.exactHits).toBe(2);
  });

  it("resetStats 清零统计", async () => {
    mockTM.lookupExact.mockResolvedValue({ targetText: "a" });
    await TMAutoApply.lookup("x", "en", "zh");
    TMAutoApply.resetStats();
    expect(TMAutoApply.getStats().exactHits).toBe(0);
  });
});
