/**
 * TranslationViewStore 契约测试：AppState.translations 视图态字段的唯一写入方
 * 覆盖：稳定视图条目引用（setViewItems/getViewItems）、swap 不触碰、
 * 各意图 API、resetView/clearView 行为、与 ProjectStore 的协作
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals(); // 提供 AppState 桩
  // 补齐 translations 视图态完整结构（不含 items——阶段 3b 已删除该兼容别名）
  globalThis.AppState.translations = {
    filtered: [],
    selected: -1,
    multiSelected: [],
    currentPage: 1,
    itemsPerPage: 20,
    searchQuery: "",
    selectedFile: null,
  };
  loadSource("public/app/core/translation-view-store.js");
  loadSource("public/app/core/project-store.js");
});

/** 每个用例前重置状态 */
function resetState() {
  AppState.project = null;
  AppState.fileMetadata = {};
  AppState.translations.filtered = [];
  AppState.translations.selected = -1;
  AppState.translations.multiSelected = [];
  AppState.translations.currentPage = 1;
  AppState.translations.searchQuery = "";
  AppState.translations.selectedFile = null;
  TranslationViewStore._viewItems = [];
}

beforeEach(resetState);

const item = (id, file) => ({
  id,
  sourceText: `src-${id}`,
  targetText: "",
  status: "pending",
  metadata: file ? { file } : undefined,
});

describe("setViewItems / getViewItems（稳定引用）", () => {
  it("setViewItems 设置稳定引用（阶段 3b 起唯一视图条目数据源）", () => {
    const items = [item(1), item(2)];
    const ret = TranslationViewStore.setViewItems(items);
    expect(ret).toBe(items);
    expect(TranslationViewStore.getViewItems()).toBe(items);
    // 兼容别名已删除：translations 切片不再出现 items 字段
    expect("items" in AppState.translations).toBe(false);
  });

  it("非数组输入安全降级为空数组", () => {
    TranslationViewStore.setViewItems(null);
    expect(TranslationViewStore.getViewItems()).toEqual([]);
  });

  it("ProjectStore.loadProject 经 setViewItems 建立稳定引用", () => {
    const items = [item(1)];
    ProjectStore.loadProject({ id: "p1", translationItems: items });
    expect(TranslationViewStore.getViewItems()).toBe(items);
  });
});

describe("swap 不触碰稳定引用（质量检查场景）", () => {
  it("swapTranslationItems 期间 getViewItems 仍指向全量列表", () => {
    const full = [item(1, "a.json"), item(2, "b.json")];
    ProjectStore.loadProject({ id: "p2", translationItems: full });

    const subset = [full[1]];
    const prev = ProjectStore.swapTranslationItems(subset);

    // canonical 被换出
    expect(AppState.project.translationItems).toBe(subset);
    // 稳定视图引用不受影响（渲染/持久化仍看全量）
    expect(TranslationViewStore.getViewItems()).toBe(full);

    // 恢复后一致
    ProjectStore.swapTranslationItems(prev);
    expect(AppState.project.translationItems).toBe(full);
    expect(TranslationViewStore.getViewItems()).toBe(full);
  });
});

describe("setTranslationItems / replaceFileItems 同步稳定引用", () => {
  it("setTranslationItems 更新稳定引用", () => {
    ProjectStore.loadProject({ id: "p3" });
    const items = [item(1), item(2)];
    ProjectStore.setTranslationItems(items);
    expect(TranslationViewStore.getViewItems()).toBe(items);
  });

  it("replaceFileItems 更新稳定引用与过滤视图", () => {
    ProjectStore.loadProject({
      id: "p4",
      translationItems: [item(1, "a.json"), item(2, "b.json")],
    });
    const merged = ProjectStore.replaceFileItems("a.json", [item(3, "a.json")]);
    expect(TranslationViewStore.getViewItems()).toBe(merged);
    expect(TranslationViewStore.getFiltered()).toEqual(merged);
  });
});

describe("视图态意图 API", () => {
  it("setFilter 写入过滤列表", () => {
    const f = [item(1)];
    TranslationViewStore.setFilter(f);
    expect(TranslationViewStore.getFiltered()).toBe(f);
    TranslationViewStore.setFilter(null);
    expect(TranslationViewStore.getFiltered()).toEqual([]);
  });

  it("setSelection / getSelected", () => {
    TranslationViewStore.setSelection(3);
    expect(TranslationViewStore.getSelected()).toBe(3);
    TranslationViewStore.setSelection(-1);
    expect(TranslationViewStore.getSelected()).toBe(-1);
  });

  it("setMultiSelection / getMultiSelected", () => {
    TranslationViewStore.setMultiSelection([1, 2]);
    expect(TranslationViewStore.getMultiSelected()).toEqual([1, 2]);
    TranslationViewStore.setMultiSelection(undefined);
    expect(TranslationViewStore.getMultiSelected()).toEqual([]);
  });

  it("setPage / getCurrentPage", () => {
    TranslationViewStore.setPage(5);
    expect(TranslationViewStore.getCurrentPage()).toBe(5);
  });

  it("setSearchQuery / getSearchQuery（null 归一为空串）", () => {
    TranslationViewStore.setSearchQuery("hello");
    expect(TranslationViewStore.getSearchQuery()).toBe("hello");
    TranslationViewStore.setSearchQuery(null);
    expect(TranslationViewStore.getSearchQuery()).toBe("");
  });

  it("setItemsPerPage / getItemsPerPage", () => {
    TranslationViewStore.setItemsPerPage(50);
    expect(TranslationViewStore.getItemsPerPage()).toBe(50);
  });

  it("setSelectedFile / getSelectedFile（null 归一）", () => {
    TranslationViewStore.setSelectedFile("a.json");
    expect(TranslationViewStore.getSelectedFile()).toBe("a.json");
    TranslationViewStore.setSelectedFile(undefined);
    expect(TranslationViewStore.getSelectedFile()).toBeNull();
  });
});

describe("resetView", () => {
  it("重置 filtered/selected/currentPage/searchQuery，保留 multiSelected/selectedFile/itemsPerPage 与稳定引用", () => {
    const items = [item(1), item(2)];
    ProjectStore.loadProject({ id: "p5", translationItems: items });

    // 制造脏视图态
    TranslationViewStore.setFilter([items[0]]);
    TranslationViewStore.setSelection(1);
    TranslationViewStore.setPage(3);
    TranslationViewStore.setSearchQuery("kw");
    TranslationViewStore.setMultiSelection([0]);
    TranslationViewStore.setSelectedFile("a.json");
    TranslationViewStore.setItemsPerPage(30);

    TranslationViewStore.resetView();

    expect(TranslationViewStore.getFiltered()).toEqual(items);
    expect(TranslationViewStore.getSelected()).toBe(-1);
    expect(TranslationViewStore.getCurrentPage()).toBe(1);
    expect(TranslationViewStore.getSearchQuery()).toBe("");
    // 不触碰的字段
    expect(TranslationViewStore.getMultiSelected()).toEqual([0]);
    expect(TranslationViewStore.getSelectedFile()).toBe("a.json");
    expect(TranslationViewStore.getItemsPerPage()).toBe(30);
    expect(TranslationViewStore.getViewItems()).toBe(items);
  });

  it("ProjectStore.loadProject 触发 resetView（项目切换重置视图）", () => {
    ProjectStore.loadProject({ id: "p6", translationItems: [item(1)] });
    TranslationViewStore.setSelection(2);
    TranslationViewStore.setSearchQuery("x");

    const items2 = [item(9)];
    ProjectStore.loadProject({ id: "p7", translationItems: items2 });

    expect(TranslationViewStore.getSelected()).toBe(-1);
    expect(TranslationViewStore.getSearchQuery()).toBe("");
    expect(TranslationViewStore.getFiltered()).toEqual(items2);
    expect(TranslationViewStore.getViewItems()).toBe(items2);
  });

  it("ProjectStore.resetTranslationView 经 resetView", () => {
    ProjectStore.loadProject({ id: "p8", translationItems: [item(1)] });
    TranslationViewStore.setSelection(4);
    TranslationViewStore.setPage(2);
    ProjectStore.resetTranslationView();
    expect(TranslationViewStore.getSelected()).toBe(-1);
    expect(TranslationViewStore.getCurrentPage()).toBe(1);
  });
});

describe("clearView", () => {
  it("全清空视图态（含稳定引用），保留 itemsPerPage", () => {
    ProjectStore.loadProject({ id: "p9", translationItems: [item(1)] });
    TranslationViewStore.setSelection(1);
    TranslationViewStore.setMultiSelection([0]);
    TranslationViewStore.setSearchQuery("kw");
    TranslationViewStore.setSelectedFile("a.json");
    TranslationViewStore.setItemsPerPage(40);

    TranslationViewStore.clearView();

    expect(TranslationViewStore.getViewItems()).toEqual([]);
    expect(TranslationViewStore.getFiltered()).toEqual([]);
    expect(TranslationViewStore.getSelected()).toBe(-1);
    expect(TranslationViewStore.getMultiSelected()).toEqual([]);
    expect(TranslationViewStore.getCurrentPage()).toBe(1);
    expect(TranslationViewStore.getSearchQuery()).toBe("");
    expect(TranslationViewStore.getSelectedFile()).toBeNull();
    // 用户设置项保留
    expect(TranslationViewStore.getItemsPerPage()).toBe(40);
  });

  it("ProjectStore.clearProject 经 clearView", () => {
    ProjectStore.loadProject({ id: "p10", translationItems: [item(1)] });
    TranslationViewStore.setSelection(1);
    TranslationViewStore.setSelectedFile("a.json");

    ProjectStore.clearProject();

    expect(AppState.project).toBeNull();
    expect(TranslationViewStore.getViewItems()).toEqual([]);
    expect(TranslationViewStore.getFiltered()).toEqual([]);
    expect(TranslationViewStore.getSelected()).toBe(-1);
    expect(TranslationViewStore.getMultiSelected()).toEqual([]);
    expect(TranslationViewStore.getSelectedFile()).toBeNull();
  });
});
