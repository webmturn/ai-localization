/**
 * 阶段 0 状态显式化契约测试
 *
 * 验收目标：消灭幽灵状态——state.js 声明与运行时一致，
 * 不再出现 `if (!AppState.quality) AppState.quality = {}` 这类动态建切片。
 *
 * 覆盖：
 *   - translations.selectedFile 显式声明
 *   - quality 切片（checkScope / checkConcurrency）显式声明
 *   - ui.autoScrollEnabled 显式声明
 *   - qualityCheckResults 含 scope / fileName 字段
 *   - 阶段 3b：translations.items 兼容别名与 window.qualityCheckResults
 *     全局别名均已删除
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "./setup.mjs";

beforeAll(() => {
  // 直接加载 state.js（不先调 setupGlobals，避免 AppState 桩覆盖真实声明）
  loadSource("public/app/core/state.js");
});

describe("AppState 切片显式声明（阶段 0）", () => {
  it("顶层切片一次性声明齐全", () => {
    for (const key of [
      "project",
      "translations",
      "ui",
      "terminology",
      "fileMetadata",
      "quality",
      "qualityCheckResults",
    ]) {
      expect(key in AppState, `缺少切片 AppState.${key}`).toBe(true);
    }
  });

  it("translations.selectedFile 已声明（null = 全项目视图）", () => {
    expect("selectedFile" in AppState.translations).toBe(true);
    expect(AppState.translations.selectedFile).toBeNull();
  });

  it("quality 切片已声明（checkScope=project / checkConcurrency=8）", () => {
    expect(AppState.quality).toEqual({
      checkScope: "project",
      checkConcurrency: 8,
    });
  });

  it("ui.autoScrollEnabled 已声明（默认 true）", () => {
    expect("autoScrollEnabled" in AppState.ui).toBe(true);
    expect(AppState.ui.autoScrollEnabled).toBe(true);
  });

  it("qualityCheckResults 含 scope / fileName 显式字段", () => {
    const qr = AppState.qualityCheckResults;
    expect("scope" in qr).toBe(true);
    expect("fileName" in qr).toBe(true);
    expect(qr.scope).toBeNull();
    expect(qr.fileName).toBeNull();
  });

  it("window.qualityCheckResults 全局别名已删除（阶段 3b）", () => {
    // 读取方一律经 AppState.qualityCheckResults
    expect(
      typeof window === "undefined" || !("qualityCheckResults" in window)
    ).toBe(true);
  });

  it("translations.items 兼容别名已删除（阶段 3b，视图条目经 TranslationViewStore）", () => {
    expect("items" in AppState.translations).toBe(false);
  });

  it("不存在幽灵 settings 切片（bootstrap 不再动态创建）", () => {
    expect("settings" in AppState).toBe(false);
  });
});
