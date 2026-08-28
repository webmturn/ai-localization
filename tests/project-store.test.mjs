/**
 * ProjectStore 测试：AppState.project / fileMetadata 切片的唯一写入方契约
 * 覆盖：载入/创建/清空、别名引用一致性、文件元数据增删改、条目替换
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals(); // 提供 AppState 桩（含 translations/terminology 切片）
  loadSource("public/app/core/project-store.js");
});

/** 每个用例前重置 AppState 到干净状态（直接改字段，不重新赋值 const AppState） */
function resetState() {
  AppState.project = null;
  AppState.fileMetadata = {};
  AppState.translations.items = [];
  AppState.translations.filtered = [];
  AppState.translations.selected = -1;
  AppState.translations.currentPage = 1;
  AppState.translations.searchQuery = "";
}

beforeEach(resetState);

describe("loadProject", () => {
  it("写入 project 并同步 translations 视图与 fileMetadata", () => {
    const items = [{ id: "1", sourceText: "a" }];
    const fm = { "a.json": { size: 10 } };
    ProjectStore.loadProject({
      id: "p1",
      name: "测试",
      translationItems: items,
      fileMetadata: fm,
    });

    expect(AppState.project.id).toBe("p1");
    // canonical 与派生引用同数组
    expect(AppState.project.translationItems).toBe(items);
    expect(AppState.translations.items).toBe(items);
    // fileMetadata 别名一致
    expect(AppState.fileMetadata).toBe(fm);
    expect(AppState.project.fileMetadata).toBe(AppState.fileMetadata);
    // 视图重置
    expect(AppState.translations.selected).toBe(-1);
    expect(AppState.translations.currentPage).toBe(1);
    expect(AppState.translations.filtered).toEqual(items);
    expect(AppState.translations.searchQuery).toBe("");
  });

  it("缺省字段安全（无 translationItems/fileMetadata）", () => {
    ProjectStore.loadProject({ id: "p2" });
    expect(AppState.project.translationItems).toEqual([]);
    expect(AppState.translations.items).toBe(AppState.project.translationItems);
    expect(AppState.fileMetadata).toEqual({});
  });

  it("传入 null 清空项目", () => {
    ProjectStore.loadProject({ id: "p3", translationItems: [{ id: "x" }] });
    ProjectStore.loadProject(null);
    expect(AppState.project).toBeNull();
    expect(AppState.translations.items).toEqual([]);
    expect(AppState.fileMetadata).toEqual({});
  });
});

describe("createProject", () => {
  it("生成完整项目结构并载入", () => {
    const p = ProjectStore.createProject({
      id: "p-new",
      name: "新项目",
      sourceLanguage: "en",
      targetLanguage: "zh",
    });
    expect(p.id).toBe("p-new");
    expect(p.name).toBe("新项目");
    expect(p.translationItems).toEqual([]);
    expect(p.fileMetadata).toEqual({});
    expect(typeof p.createdAt).toBe("string");
    expect(AppState.project).toBe(p);
  });

  it("extra 字段透传（如 __isSampleProject）", () => {
    const p = ProjectStore.createProject({
      id: "p-sample",
      extra: { __isSampleProject: true },
    });
    expect(p.__isSampleProject).toBe(true);
  });

  it("缺省 id 自动生成", () => {
    const p = ProjectStore.createProject({});
    expect(p.id).toMatch(/^project-/);
  });
});

describe("clearProject", () => {
  it("清空 project、fileMetadata 与 translations 视图", () => {
    ProjectStore.loadProject({
      id: "p4",
      translationItems: [{ id: "1" }],
      fileMetadata: { "f.xml": { size: 1 } },
    });
    AppState.translations.selected = 3;
    AppState.translations.searchQuery = "abc";

    ProjectStore.clearProject();

    expect(AppState.project).toBeNull();
    expect(AppState.fileMetadata).toEqual({});
    expect(AppState.translations.items).toEqual([]);
    expect(AppState.translations.filtered).toEqual([]);
    expect(AppState.translations.selected).toBe(-1);
    expect(AppState.translations.searchQuery).toBe("");
  });
});

describe("ensureProject", () => {
  it("已有项目时直接返回现有 id", () => {
    ProjectStore.loadProject({ id: "existing" });
    expect(ProjectStore.ensureProject("fallback")).toBe("existing");
  });

  it("无项目时以 fallbackId 兜底创建", () => {
    const id = ProjectStore.ensureProject("fallback-id");
    expect(id).toBe("fallback-id");
    expect(AppState.project.id).toBe("fallback-id");
  });
});

describe("文件元数据操作", () => {
  it("setFileMetadata 写入并维护 project.fileMetadata 别名", () => {
    ProjectStore.loadProject({ id: "p5" });
    const meta = { size: 100 };
    ProjectStore.setFileMetadata("a.json", meta);
    expect(AppState.fileMetadata["a.json"]).toBe(meta);
    expect(AppState.project.fileMetadata["a.json"]).toBe(meta);
  });

  it("patchFileMetadata 合并字段到现有 meta", () => {
    ProjectStore.loadProject({ id: "p6" });
    ProjectStore.setFileMetadata("b.xml", { size: 10, type: "text/xml" });
    ProjectStore.patchFileMetadata("b.xml", { size: 20 });
    expect(AppState.fileMetadata["b.xml"].size).toBe(20);
    expect(AppState.fileMetadata["b.xml"].type).toBe("text/xml");
  });

  it("removeFileMetadata 同时删除两处引用", () => {
    ProjectStore.loadProject({ id: "p7" });
    ProjectStore.setFileMetadata("c.po", { size: 5 });
    ProjectStore.removeFileMetadata("c.po");
    expect(AppState.fileMetadata["c.po"]).toBeUndefined();
    expect(AppState.project.fileMetadata["c.po"]).toBeUndefined();
  });

  it("ensureFileMetadata 惰性初始化并对齐别名", () => {
    ProjectStore.loadProject({ id: "p8" });
    AppState.fileMetadata = null; // 模拟异常缺失
    const fm = ProjectStore.ensureFileMetadata();
    expect(fm).toEqual({});
    expect(AppState.project.fileMetadata).toBe(fm);
  });

  it("resetFileMetadata 整体替换", () => {
    ProjectStore.loadProject({ id: "p9" });
    const map = { "d.json": { size: 1 } };
    ProjectStore.resetFileMetadata(map);
    expect(AppState.fileMetadata).toBe(map);
    expect(AppState.project.fileMetadata).toBe(map);
  });
});

describe("翻译条目操作", () => {
  it("replaceFileItems 替换指定文件条目并同步视图", () => {
    ProjectStore.loadProject({
      id: "p10",
      translationItems: [
        { id: "1", metadata: { file: "a.json" } },
        { id: "2", metadata: { file: "b.json" } },
      ],
    });
    const merged = ProjectStore.replaceFileItems("a.json", [
      { id: "1-new", metadata: { file: "a.json" } },
    ]);
    expect(merged.map((it) => it.id)).toEqual(["2", "1-new"]);
    expect(AppState.project.translationItems).toBe(merged);
    expect(AppState.translations.items).toBe(merged);
    expect(AppState.translations.filtered).toEqual(merged);
  });

  it("replaceFileItems 无项目时抛错", () => {
    expect(() => ProjectStore.replaceFileItems("a.json", [])).toThrow(
      "当前没有打开的项目"
    );
  });

  it("setTranslationItems 整体替换并同步视图", () => {
    ProjectStore.loadProject({ id: "p11" });
    const items = [{ id: "x" }, { id: "y" }];
    ProjectStore.setTranslationItems(items);
    expect(AppState.project.translationItems).toBe(items);
    expect(AppState.translations.items).toBe(items);
  });

  it("resetTranslationView 重置分页与选中", () => {
    ProjectStore.loadProject({ id: "p12", translationItems: [{ id: "1" }] });
    AppState.translations.selected = 5;
    AppState.translations.currentPage = 3;
    ProjectStore.resetTranslationView();
    expect(AppState.translations.selected).toBe(-1);
    expect(AppState.translations.currentPage).toBe(1);
    expect(AppState.translations.filtered).toEqual(AppState.translations.items);
  });

  it("touchProject 更新 updatedAt", () => {
    ProjectStore.loadProject({ id: "p13" });
    const before = AppState.project.updatedAt;
    ProjectStore.touchProject();
    expect(AppState.project.updatedAt).not.toBe(before);
  });
});

describe("属性级确权（第三阶段）", () => {
  it("renameProject 命中当前项目时更新 name", () => {
    ProjectStore.loadProject({ id: "p14", name: "旧名" });
    const ok = ProjectStore.renameProject("p14", "新名");
    expect(ok).toBe(true);
    expect(AppState.project.name).toBe("新名");
  });

  it("renameProject 未命中当前项目时不写入", () => {
    ProjectStore.loadProject({ id: "p15", name: "当前" });
    const ok = ProjectStore.renameProject("other-id", "别的名字");
    expect(ok).toBe(false);
    expect(AppState.project.name).toBe("当前");
  });

  it("renameProject 无项目时安全返回 false", () => {
    expect(ProjectStore.renameProject("p16", "x")).toBe(false);
  });

  it("setTerminologyList 写入 project.terminologyList", () => {
    ProjectStore.loadProject({ id: "p17" });
    const terms = [{ id: 1, source: "API", target: "接口" }];
    const ret = ProjectStore.setTerminologyList(terms);
    expect(ret).toBe(terms);
    expect(AppState.project.terminologyList).toBe(terms);
  });

  it("setTerminologyList 无项目时返回 null 且不抛错", () => {
    expect(ProjectStore.setTerminologyList([{ id: 1 }])).toBeNull();
  });

  it("setTerminologyList 传 null/undefined 时写入空数组", () => {
    ProjectStore.loadProject({ id: "p18" });
    ProjectStore.setTerminologyList(null);
    expect(AppState.project.terminologyList).toEqual([]);
  });
});
