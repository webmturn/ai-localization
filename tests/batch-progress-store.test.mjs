/**
 * BatchProgressStore 契约测试：AppState.translations 批量进度态字段的唯一写入方
 * 覆盖：begin/end/cancel/pause/resume 生命周期、reportProgress 数值守卫、
 * recordFailedItems、isUserCancelled 取消协议三态、clearBatch、镜像协议字段
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals(); // 提供 AppState 桩
  // 补齐 translations 批量进度态完整结构（阶段 5 起由 BatchProgressStore 确权）
  globalThis.AppState.translations = Object.assign(
    globalThis.AppState.translations,
    {
      filtered: [],
      selected: -1,
      multiSelected: [],
      currentPage: 1,
      itemsPerPage: 20,
      searchQuery: "",
      selectedFile: null,
      isInProgress: false,
      isPaused: false,
      progress: { current: 0, total: 0, status: "" },
      lastFailedItems: [],
      lastBatchContext: null,
    }
  );
  loadSource("public/app/core/batch-progress-store.js");
});

/** 每个用例前重置状态 */
function resetState() {
  AppState.translations.isInProgress = false;
  AppState.translations.isPaused = false;
  AppState.translations.progress = { current: 0, total: 0, status: "" };
  AppState.translations.lastFailedItems = [];
  AppState.translations.lastBatchContext = null;
  BatchProgressStore._started = false;
  BatchProgressStore._cancelled = false;
  AppState.translations._batchStarted = false;
  AppState.translations._batchCancelled = false;
}

beforeEach(resetState);

const ctx = {
  scope: "selected",
  sourceLang: "en",
  targetLang: "zh",
  engine: "deepseek",
  selectedFile: "a.json",
};

describe("beginBatch / endBatch 生命周期", () => {
  it("beginBatch 写入进行中标记与上下文，清空失败列表", () => {
    const ret = BatchProgressStore.beginBatch(ctx);
    expect(ret).toBe(ctx);
    expect(BatchProgressStore.isBatchInProgress()).toBe(true);
    expect(BatchProgressStore.isBatchPaused()).toBe(false);
    expect(BatchProgressStore.getLastBatchContext()).toBe(ctx);
    expect(BatchProgressStore.getLastFailedItems()).toEqual([]);
    // 镜像协议字段（ai-engine-base 兜底路径依赖）
    expect(AppState.translations._batchStarted).toBe(true);
    expect(AppState.translations._batchCancelled).toBe(false);
  });

  it("beginBatch 缺省上下文归一为 null", () => {
    expect(BatchProgressStore.beginBatch()).toBeNull();
  });

  it("endBatch 复位进行/暂停标记，保留失败项与上下文（重试入口要读）", () => {
    BatchProgressStore.beginBatch(ctx);
    BatchProgressStore.recordFailedItems([{ id: 1 }]);
    BatchProgressStore.endBatch();
    expect(BatchProgressStore.isBatchInProgress()).toBe(false);
    expect(BatchProgressStore.isBatchPaused()).toBe(false);
    expect(BatchProgressStore.getLastFailedItems()).toEqual([{ id: 1 }]);
    expect(BatchProgressStore.getLastBatchContext()).toBe(ctx);
  });
});

describe("cancelBatch / isUserCancelled 取消协议", () => {
  it("显式取消：cancelBatch 置取消位，isUserCancelled 为 true", () => {
    BatchProgressStore.beginBatch(ctx);
    BatchProgressStore.cancelBatch();
    expect(BatchProgressStore.isUserCancelled()).toBe(true);
    expect(BatchProgressStore.isBatchInProgress()).toBe(false);
    // 镜像协议字段
    expect(AppState.translations._batchCancelled).toBe(true);
    expect(AppState.translations._batchStarted).toBe(false);
  });

  it("隐式取消：批量曾启动（_started）后 isInProgress 变 false", () => {
    BatchProgressStore.beginBatch(ctx);
    // 模拟外部异常清理：仅复位 isInProgress（不经 endBatch）
    BatchProgressStore.endBatch();
    // beginBatch 后未 cancel，但 _started 仍为 true（endBatch 不清除）
    expect(BatchProgressStore._started).toBe(true);
    expect(BatchProgressStore.isUserCancelled()).toBe(true);
  });

  it("正常运行中不误判取消", () => {
    BatchProgressStore.beginBatch(ctx);
    expect(BatchProgressStore.isUserCancelled()).toBe(false);
  });

  it("从未启动批量时不误判取消", () => {
    expect(BatchProgressStore.isUserCancelled()).toBe(false);
  });

  it("endBatch 后再次 beginBatch 复位取消状态", () => {
    BatchProgressStore.beginBatch(ctx);
    BatchProgressStore.cancelBatch();
    BatchProgressStore.beginBatch(ctx);
    expect(BatchProgressStore.isUserCancelled()).toBe(false);
    expect(BatchProgressStore.isBatchInProgress()).toBe(true);
  });
});

describe("pauseBatch / resumeBatch", () => {
  it("暂停与恢复互斥切换", () => {
    BatchProgressStore.beginBatch(ctx);
    BatchProgressStore.pauseBatch();
    expect(BatchProgressStore.isBatchPaused()).toBe(true);
    BatchProgressStore.resumeBatch();
    expect(BatchProgressStore.isBatchPaused()).toBe(false);
  });
});

describe("reportProgress / recordFailedItems", () => {
  it("reportProgress 写入进度快照（含状态文案）", () => {
    const ret = BatchProgressStore.reportProgress(3, 10, "翻译中");
    expect(ret).toEqual({ current: 3, total: 10, status: "翻译中" });
    expect(BatchProgressStore.getProgress().current).toBe(3);
  });

  it("reportProgress 非数值安全归零", () => {
    BatchProgressStore.reportProgress(NaN, undefined, undefined);
    expect(BatchProgressStore.getProgress()).toEqual({
      current: 0,
      total: 0,
      status: "",
    });
  });

  it("recordFailedItems 写入失败项列表（非数组降级空数组）", () => {
    const failed = [{ id: 1 }, { id: 2 }];
    expect(BatchProgressStore.recordFailedItems(failed)).toBe(failed);
    expect(BatchProgressStore.recordFailedItems(null)).toEqual([]);
  });
});

describe("clearBatch 全清空", () => {
  it("复位全部批量进度态与取消协议", () => {
    BatchProgressStore.beginBatch(ctx);
    BatchProgressStore.recordFailedItems([{ id: 1 }]);
    BatchProgressStore.reportProgress(5, 10, "进行中");

    BatchProgressStore.clearBatch();

    expect(BatchProgressStore.isBatchInProgress()).toBe(false);
    expect(BatchProgressStore.isBatchPaused()).toBe(false);
    expect(BatchProgressStore.getProgress()).toEqual({
      current: 0,
      total: 0,
      status: "",
    });
    expect(BatchProgressStore.getLastFailedItems()).toEqual([]);
    expect(BatchProgressStore.getLastBatchContext()).toBeNull();
    expect(BatchProgressStore.isUserCancelled()).toBe(false);
  });
});
