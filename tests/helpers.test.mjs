/**
 * 翻译共享工具函数测试
 * 测试 public/app/services/translation/helpers.js
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/helpers.js");
});

describe("translationGetItemKey", () => {
  it("返回 metadata.resourceId（优先级最高）", () => {
    const item = { id: "fallback", metadata: { resourceId: "res-1", key: "k" } };
    expect(translationGetItemKey(item)).toBe("res-1");
  });

  it("返回 metadata.key（次优先）", () => {
    const item = { id: "fallback", metadata: { key: "my-key" } };
    expect(translationGetItemKey(item)).toBe("my-key");
  });

  it("返回 metadata.path", () => {
    const item = { metadata: { path: "/a/b" } };
    expect(translationGetItemKey(item)).toBe("/a/b");
  });

  it("返回 item.id 作为兜底", () => {
    const item = { id: "item-42", metadata: {} };
    expect(translationGetItemKey(item)).toBe("item-42");
  });

  it("null/undefined 返回空字符串", () => {
    expect(translationGetItemKey(null)).toBe("");
    expect(translationGetItemKey(undefined)).toBe("");
  });
});

describe("translationGetFileBase", () => {
  it("提取文件名（正斜杠）", () => {
    const item = { metadata: { file: "src/locales/en.json" } };
    expect(translationGetFileBase(item)).toBe("en.json");
  });

  it("提取文件名（反斜杠）", () => {
    const item = { metadata: { file: "C:\\locales\\zh.po" } };
    expect(translationGetFileBase(item)).toBe("zh.po");
  });

  it("无路径时返回文件名本身", () => {
    const item = { metadata: { file: "strings.xml" } };
    expect(translationGetFileBase(item)).toBe("strings.xml");
  });

  it("无 metadata.file 时返回空字符串", () => {
    expect(translationGetFileBase({ metadata: {} })).toBe("");
    expect(translationGetFileBase({})).toBe("");
  });
});

describe("translationGetFileType", () => {
  it("提取扩展名并小写化", () => {
    expect(translationGetFileType({ metadata: { file: "app.JSON" } })).toBe("json");
    expect(translationGetFileType({ metadata: { file: "res.XLIFF" } })).toBe("xliff");
  });

  it("无 file 时返回空字符串", () => {
    expect(translationGetFileType({ metadata: {} })).toBe("");
    expect(translationGetFileType({})).toBe("");
  });
});

describe("translationToSnippet", () => {
  it("短文本不截断", () => {
    expect(translationToSnippet("Hello world", 50)).toBe("Hello world");
  });

  it("长文本截断并加省略号", () => {
    const text = "a".repeat(100);
    const result = translationToSnippet(text, 10);
    expect(result).toBe("a".repeat(10) + "...");
  });

  it("空值返回空字符串", () => {
    expect(translationToSnippet(null, 10)).toBe("");
    expect(translationToSnippet("", 10)).toBe("");
  });

  it("多余空白被压缩", () => {
    expect(translationToSnippet("  hello   world  ", 50)).toBe("hello world");
  });
});

describe("translationIsApiKeyError", () => {
  it("识别 API_KEY_MISSING code", () => {
    expect(translationIsApiKeyError({ code: "API_KEY_MISSING" })).toBe(true);
  });

  it("识别 API_KEY_INVALID code", () => {
    expect(translationIsApiKeyError({ code: "API_KEY_INVALID" })).toBe(true);
  });

  it("识别中文密钥错误消息", () => {
    expect(translationIsApiKeyError({ message: "API密钥未配置" })).toBe(true);
    expect(translationIsApiKeyError({ message: "未配置翻译密钥" })).toBe(true);
  });

  it("识别英文 API key 错误消息", () => {
    expect(translationIsApiKeyError({ message: "api key is missing" })).toBe(true);
    expect(translationIsApiKeyError({ message: "API key not configured" })).toBe(true);
    expect(translationIsApiKeyError({ message: "api key invalid" })).toBe(true);
  });

  it("普通错误返回 false", () => {
    expect(translationIsApiKeyError({ message: "Network error" })).toBe(false);
    expect(translationIsApiKeyError({ message: "Timeout" })).toBe(false);
  });
});

describe("translationIsUserCancelled", () => {
  it("识别 USER_CANCELLED code", () => {
    expect(translationIsUserCancelled({ code: "USER_CANCELLED" })).toBe(true);
  });

  it("识别中文取消消息", () => {
    expect(translationIsUserCancelled({ message: "用户取消" })).toBe(true);
    expect(translationIsUserCancelled({ message: "请求已取消" })).toBe(true);
  });

  it("isInProgress=true 时 AbortError 不视为取消", () => {
    expect(translationIsUserCancelled({ name: "AbortError" }, true)).toBe(false);
  });

  it("isInProgress=false 时 AbortError 视为取消", () => {
    expect(translationIsUserCancelled({ name: "AbortError" }, false)).toBe(true);
  });
});

describe("translationMarkAllAsErrors", () => {
  it("将所有项标记为 pending 并添加错误记录", () => {
    const items = [
      { id: 1, status: "translating" },
      { id: 2, status: "translating" },
    ];
    const errors = [];
    translationMarkAllAsErrors(items, errors, "测试错误");

    expect(errors).toHaveLength(2);
    expect(items[0].status).toBe("pending");
    expect(items[1].status).toBe("pending");
    expect(errors[0]).toMatchObject({ success: false, index: 0, error: "测试错误" });
    expect(errors[1]).toMatchObject({ success: false, index: 1, error: "测试错误" });
  });

  it("传递额外字段", () => {
    const items = [{ id: 1, status: "translating" }];
    const errors = [];
    translationMarkAllAsErrors(items, errors, "err", { code: "ERR_CODE", provider: "test" });

    expect(errors[0].code).toBe("ERR_CODE");
    expect(errors[0].provider).toBe("test");
  });
});
