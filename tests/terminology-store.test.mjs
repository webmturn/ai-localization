/**
 * TerminologyStore 契约测试：AppState.terminology 切片的唯一写入方
 * 覆盖：载入/合并/增删改/清空、分页、过滤、项目快照同步、localStorage 快照
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals(); // 提供 AppState 桩
  // 补齐 terminology 切片完整结构（setupGlobals 桩只含 entries）
  globalThis.AppState.terminology = {
    list: [],
    filtered: [],
    currentPage: 1,
    perPage: 10,
  };
  globalThis.AppState.project = null;
  // ProjectStore 桩：记录 setTerminologyList 调用
  globalThis.ProjectStore = {
    _calls: [],
    setTerminologyList(list) {
      this._calls.push(list);
      if (globalThis.AppState.project) {
        globalThis.AppState.project.terminologyList = list;
      }
      return list;
    },
  };
  // localStorage 桩
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  loadSource("public/app/core/terminology-store.js");
});

/** 每个用例前重置状态 */
function resetState() {
  AppState.terminology.list = [];
  AppState.terminology.filtered = [];
  AppState.terminology.currentPage = 1;
  AppState.project = null;
  ProjectStore._calls = [];
  localStorage.clear();
}

beforeEach(resetState);

const term = (id, source, target) => ({
  id,
  source,
  target,
  partOfSpeech: "noun",
  definition: "",
});

describe("loadTerminology", () => {
  it("整体替换列表并重置视图", () => {
    const list = [term(1, "API", "应用程序接口")];
    TerminologyStore.loadTerminology(list);
    expect(TerminologyStore.getList()).toBe(list);
    expect(TerminologyStore.getFiltered()).toEqual(list);
    expect(TerminologyStore.getCurrentPage()).toBe(1);
  });

  it("同步项目快照（经 ProjectStore.setTerminologyList）", () => {
    AppState.project = { id: "p1" };
    const list = [term(1, "API", "接口")];
    TerminologyStore.loadTerminology(list);
    expect(ProjectStore._calls.length).toBe(1);
    expect(AppState.project.terminologyList).toBe(list);
  });

  it("非数组输入安全降级为空列表", () => {
    TerminologyStore.loadTerminology(null);
    expect(TerminologyStore.getList()).toEqual([]);
  });

  it("persistLocal 选项回写 localStorage", () => {
    const list = [term(1, "API", "接口")];
    TerminologyStore.loadTerminology(list, { persistLocal: true });
    expect(JSON.parse(localStorage.getItem("terminologyList"))).toEqual(list);
  });
});

describe("mergeTerms", () => {
  it("追加新源术语，重复时默认覆盖", () => {
    TerminologyStore.loadTerminology([term(1, "API", "旧译")]);
    const merged = TerminologyStore.mergeTerms([
      term(2, "API", "新译"),
      term(3, "XML", "可扩展标记语言"),
    ]);
    expect(merged.length).toBe(2);
    expect(merged.find((t) => t.source === "API").target).toBe("新译");
  });

  it("overwriteDuplicates=false 时跳过重复", () => {
    TerminologyStore.loadTerminology([term(1, "API", "旧译")]);
    const merged = TerminologyStore.mergeTerms([term(2, "API", "新译")], {
      overwriteDuplicates: false,
    });
    expect(merged.length).toBe(1);
    expect(merged[0].target).toBe("旧译");
  });

  it("判重大小写不敏感", () => {
    TerminologyStore.loadTerminology([term(1, "api", "接口")]);
    const merged = TerminologyStore.mergeTerms([term(2, "API", "新译")]);
    expect(merged.length).toBe(1);
  });
});

describe("addTerm / updateTerm / removeTerm", () => {
  it("addTerm 自动分配 id（max+1）", () => {
    TerminologyStore.loadTerminology([term(5, "A", "甲")]);
    const added = TerminologyStore.addTerm({ source: "B", target: "乙" });
    expect(added.id).toBe(6);
    expect(TerminologyStore.getList().length).toBe(2);
  });

  it("updateTerm 合并 patch 并返回命中状态", () => {
    TerminologyStore.loadTerminology([term(1, "API", "旧译")]);
    expect(TerminologyStore.updateTerm(1, { target: "新译" })).toBe(true);
    expect(TerminologyStore.getList()[0].target).toBe("新译");
    expect(TerminologyStore.getList()[0].source).toBe("API");
    expect(TerminologyStore.updateTerm(999, { target: "x" })).toBe(false);
  });

  it("removeTerm 删除并返回命中状态", () => {
    TerminologyStore.loadTerminology([term(1, "API", "接口"), term(2, "XML", "标记")]);
    expect(TerminologyStore.removeTerm(1)).toBe(true);
    expect(TerminologyStore.getList().length).toBe(1);
    expect(TerminologyStore.removeTerm(999)).toBe(false);
  });

  it("增删改均同步项目快照与 localStorage", () => {
    AppState.project = { id: "p1" };
    TerminologyStore.addTerm({ source: "A", target: "甲" });
    expect(ProjectStore._calls.length).toBe(1);
    expect(localStorage.getItem("terminologyList")).toBeTruthy();

    TerminologyStore.updateTerm(1, { target: "乙" });
    expect(ProjectStore._calls.length).toBe(2);

    TerminologyStore.removeTerm(1);
    expect(ProjectStore._calls.length).toBe(3);
    expect(JSON.parse(localStorage.getItem("terminologyList"))).toEqual([]);
  });
});

describe("clearTerminology", () => {
  it("清空列表与视图，不同步快照", () => {
    AppState.project = { id: "p1" };
    TerminologyStore.loadTerminology([term(1, "API", "接口")]);
    ProjectStore._calls = [];
    TerminologyStore.clearTerminology();
    expect(TerminologyStore.getList()).toEqual([]);
    expect(TerminologyStore.getFiltered()).toEqual([]);
    expect(ProjectStore._calls.length).toBe(0);
  });
});

describe("setPage / applyFilter / resetFilter", () => {
  it("setPage 更新页码", () => {
    TerminologyStore.setPage(3);
    expect(TerminologyStore.getCurrentPage()).toBe(3);
  });

  it("applyFilter 应用谓词并重置页码", () => {
    TerminologyStore.loadTerminology([
      term(1, "API", "接口"),
      term(2, "XML", "标记"),
    ]);
    TerminologyStore.setPage(2);
    const filtered = TerminologyStore.applyFilter((t) => t.source === "API");
    expect(filtered.length).toBe(1);
    expect(TerminologyStore.getCurrentPage()).toBe(1);
  });

  it("resetFilter 恢复全量视图", () => {
    TerminologyStore.loadTerminology([term(1, "API", "接口"), term(2, "XML", "标记")]);
    TerminologyStore.applyFilter(() => false);
    expect(TerminologyStore.getFiltered().length).toBe(0);
    TerminologyStore.resetFilter();
    expect(TerminologyStore.getFiltered().length).toBe(2);
  });
});
