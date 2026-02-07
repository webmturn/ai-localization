(function () {
  var App = (window.App = window.App || {});
  App.features = App.features || {};
  App.features.projects = App.features.projects || {};

  function __formatDateLabel(value) {
    try {
      if (!value) return "";
      const d = new Date(value);
      if (!Number.isFinite(d.getTime())) return String(value);
      return d.toLocaleString();
    } catch (e) {
      return "";
    }
  }

  function __openModal(modalId) {
    try {
      if (typeof openModal === "function") return openModal(modalId);
    } catch (_) {
      (loggers.app || console).debug("openModal fallback:", _);
    }
    const modal = DOMCache.get(modalId);
    if (modal) modal.classList.remove("hidden");
  }

  function __closeModal(modalId) {
    try {
      if (typeof closeModal === "function") return closeModal(modalId);
    } catch (_) {
      (loggers.app || console).debug("closeModal fallback:", _);
    }
    const modal = DOMCache.get(modalId);
    if (modal) modal.classList.add("hidden");
  }

  function __switchProjectManagerTab(tabName) {
    try {
      const panelId =
        tabName === "create-import"
          ? "projectManagerCreateImportPanel"
          : "projectManagerListPanel";
      switchTabState(".project-tab", ".project-tab-panel", tabName, {
        activePanelId: panelId,
      });
    } catch (e) {
      (loggers.app || console).error("切换项目管理标签页失败:", e);
    }
  }

  async function __ensureCurrentProjectIndexed() {
    try {
      if (AppState && AppState.project) {
        await storageManager.saveProject(AppState.project);
      }
    } catch (e) {
      (loggers.storage || console).error("确保当前项目进入索引失败:", e);
    }
  }

  function __applyProjectToState(project) {
    if (!project) return;

    AppState.project = project;

    AppState.translations.items = project.translationItems || [];
    AppState.project.translationItems = AppState.translations.items;

    AppState.fileMetadata = project.fileMetadata || {};
    hydrateFileMetadataContentKeys(AppState.project?.id);

    if (project.terminologyList && Array.isArray(project.terminologyList)) {
      AppState.terminology.list = project.terminologyList;
      AppState.terminology.filtered = [...AppState.terminology.list];
      AppState.terminology.currentPage = 1;
      if (typeof updateTerminologyList === "function") updateTerminologyList();
    }

    AppState.translations.selected = -1;
    AppState.translations.currentPage = 1;
    AppState.translations.filtered = [...AppState.translations.items];
    AppState.translations.searchQuery = "";

    try {
      const sourceLanguageEl = DOMCache.get("sourceLanguage");
      const targetLanguageEl = DOMCache.get("targetLanguage");
      if (sourceLanguageEl)
        sourceLanguageEl.value =
          project.sourceLanguage || sourceLanguageEl.value;
      if (targetLanguageEl)
        targetLanguageEl.value =
          project.targetLanguage || targetLanguageEl.value;
    } catch (_) {
      (loggers.app || console).debug("loadProjectToUI language sync:", _);
    }

    if (typeof updateFileTree === "function") updateFileTree();
    if (typeof updateTranslationLists === "function") updateTranslationLists();
    if (typeof updateCounters === "function") updateCounters();

    try {
      const projectStatusEl = DOMCache.get("projectStatus");
      if (projectStatusEl) {
        projectStatusEl.textContent = "已切换";
        projectStatusEl.className =
          "text-success dark:text-emerald-400 font-medium";
      }
    } catch (_) {
      (loggers.app || console).debug("project manager update status:", _);
    }

    try {
      const settingsModal = DOMCache.get("settingsModal");
      if (
        settingsModal &&
        !settingsModal.classList.contains("hidden") &&
        typeof window.loadProjectPromptTemplatesToUI === "function"
      ) {
        window.loadProjectPromptTemplatesToUI();
      }
    } catch (_) {
      (loggers.app || console).debug("project manager loadPromptTemplates:", _);
    }
  }

  async function refreshProjectManagerList() {
    const listEl = DOMCache.get("projectManagerList");
    if (!listEl) return;

    await __ensureCurrentProjectIndexed();

    const projects = await storageManager.listProjects().catch(() => []);
    const activeId = await storageManager
      .getActiveProjectId()
      .catch(() => AppState.project?.id);

    if (!projects || projects.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-sm text-gray-500 dark:text-gray-400 p-3";
      empty.textContent = "暂无项目，请先创建/导入项目。";
      listEl.replaceChildren(empty);
      return;
    }

    const rows = projects.map((p) => {
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between gap-2 p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900";
      row.dataset.projectId = p.id;

      const left = document.createElement("div");
      left.className = "min-w-0";

      const title = document.createElement("div");
      title.className =
        "text-sm font-medium text-gray-900 dark:text-gray-100 truncate";
      title.textContent =
        (p.id === activeId ? "当前：" : "") + (p.name || "未命名");

      const meta = document.createElement("div");
      meta.className = "text-xs text-gray-500 dark:text-gray-400 mt-1";
      meta.textContent = `${p.sourceLanguage || ""} → ${
        p.targetLanguage || ""
      }  ${__formatDateLabel(p.updatedAt)}`.trim();

      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.className = "flex items-center gap-2 flex-shrink-0";

      const btnSwitch = document.createElement("button");
      btnSwitch.className =
        "px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90";
      btnSwitch.textContent = "切换";
      btnSwitch.dataset.action = "switch";

      const btnRename = document.createElement("button");
      btnRename.className =
        "px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800";
      btnRename.textContent = "重命名";
      btnRename.dataset.action = "rename";

      const btnExport = document.createElement("button");
      btnExport.className =
        "px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800";
      btnExport.textContent = "导出";
      btnExport.dataset.action = "export";

      const btnDelete = document.createElement("button");
      btnDelete.className =
        "px-2 py-1 text-xs rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";
      btnDelete.textContent = "删除";
      btnDelete.dataset.action = "delete";

      right.appendChild(btnSwitch);
      right.appendChild(btnRename);
      right.appendChild(btnExport);
      right.appendChild(btnDelete);

      row.appendChild(left);
      row.appendChild(right);
      return row;
    });

    listEl.replaceChildren(...rows);
  }

  async function openProjectManager() {
    await refreshProjectManagerList();
    __switchProjectManagerTab("list");
    __openModal("projectManagerModal");
  }

  async function __switchToProject(projectId) {
    if (!projectId) return;

    const project = await storageManager.loadProjectById(projectId);
    if (!project) {
      showNotification("error", "切换失败", "未找到项目数据");
      return;
    }

    await storageManager.setActiveProjectId(projectId);
    __applyProjectToState(project);

    showNotification(
      "success",
      "已切换项目",
      `当前项目：${project.name || "未命名"}`
    );
  }

  async function __createEmptyProject() {
    const nameInput = DOMCache.get("projectManagerProjectName");
    const sourceLangInput = DOMCache.get("projectManagerSourceLang");
    const targetLangInput = DOMCache.get("projectManagerTargetLang");

    let name = "";
    if (nameInput && typeof nameInput.value === "string") {
      name = nameInput.value.trim();
    }
    if (!name) {
      name = prompt("请输入项目名称", "新项目") || "";
      name = String(name).trim();
    }
    if (!name) return;

    const sourceLanguage =
      (sourceLangInput && sourceLangInput.value) ||
      DOMCache.get("sourceLanguage")?.value ||
      "en";
    const targetLanguage =
      (targetLangInput && targetLangInput.value) ||
      DOMCache.get("targetLanguage")?.value ||
      "zh";

    const project = {
      id: `project-${Date.now()}`,
      name: name.trim() || "未命名",
      sourceLanguage,
      targetLanguage,
      fileFormat: "mixed",
      translationItems: [],
      terminologyList: [],
      fileMetadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (nameInput) nameInput.value = "";
    } catch (_) {
      (loggers.app || console).debug("project manager reset nameInput:", _);
    }

    await storageManager.saveProject(project);
    await storageManager.setActiveProjectId(project.id);
    __applyProjectToState(project);

    await refreshProjectManagerList();
    showNotification("success", "项目已创建", `项目 "${project.name}" 已创建`);
  }

  async function __exportProjectById(projectId) {
    const project = await storageManager.loadProjectById(projectId);
    if (!project) {
      showNotification("warning", "无数据", "未找到可导出的项目");
      return;
    }

    const data = {
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      project,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${project.name || "untitled"}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("success", "导出成功", "项目已导出为 JSON 文件");
  }

  async function __handleImportFile(file) {
    if (!file) return;
    try {
      const raw = await readFileAsync(file);
      const parsed = JSON.parse(raw);
      const project = parsed?.project ? parsed.project : parsed;

      if (
        !project ||
        !project.name ||
        !project.sourceLanguage ||
        !project.targetLanguage
      ) {
        showNotification("error", "导入失败", "项目文件格式不正确");
        return;
      }

      if (!project.id) {
        project.id = `project-${Date.now()}`;
      }

      const existing = await storageManager.loadProjectById(project.id);
      if (existing) {
        const ok = confirm(
          `检测到同 ID 项目（${project.id}）。是否覆盖？\n取消则以新 ID 导入。`
        );
        if (!ok) {
          project.id = `${project.id}-${Date.now()}`;
        }
      }

      project.updatedAt = new Date().toISOString();
      project.createdAt = project.createdAt || new Date().toISOString();

      await storageManager.saveProject(project);
      await storageManager.setActiveProjectId(project.id);
      __applyProjectToState(project);

      await refreshProjectManagerList();
      showNotification(
        "success",
        "导入成功",
        `项目 "${project.name}" 已导入并打开`
      );
    } catch (e) {
      (loggers.app || console).error("导入项目失败:", e);
      showNotification("error", "导入失败", "无法解析项目文件");
    }
  }

  function registerEventListenersProjectManager() {
    const projectManagerBtn = DOMCache.get("projectManagerBtn");
    if (projectManagerBtn) {
      EventManager.add(projectManagerBtn, "click", openProjectManager, {
        tag: "project",
        scope: "projectManager",
        label: "projectManagerBtn:click",
      });
    }

    const projectManagerListTab = DOMCache.get(
      "projectManagerListTab"
    );
    if (projectManagerListTab) {
      EventManager.add(
        projectManagerListTab,
        "click",
        () => __switchProjectManagerTab("list"),
        {
          tag: "project",
          scope: "projectManager:tabs",
          label: "projectManagerListTab:click",
        }
      );
    }

    const projectManagerCreateImportTab = DOMCache.get(
      "projectManagerCreateImportTab"
    );
    if (projectManagerCreateImportTab) {
      EventManager.add(
        projectManagerCreateImportTab,
        "click",
        () => __switchProjectManagerTab("create-import"),
        {
          tag: "project",
          scope: "projectManager:tabs",
          label: "projectManagerCreateImportTab:click",
        }
      );
    }

    const projectManagerCreateBtn = DOMCache.get(
      "projectManagerCreateBtn"
    );
    if (projectManagerCreateBtn) {
      EventManager.add(projectManagerCreateBtn, "click", __createEmptyProject, {
        tag: "project",
        scope: "projectManager",
        label: "projectManagerCreateBtn:click",
      });
    }

    const projectManagerImportBtn = DOMCache.get(
      "projectManagerImportBtn"
    );
    const projectManagerImportFile = DOMCache.get(
      "projectManagerImportFile"
    );

    if (projectManagerImportBtn && projectManagerImportFile) {
      EventManager.add(
        projectManagerImportBtn,
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          projectManagerImportFile.click();
        },
        {
          tag: "project",
          scope: "projectManager",
          label: "projectManagerImportBtn:click",
        }
      );

      EventManager.add(
        projectManagerImportFile,
        "change",
        (e) => {
          const file = e.target.files?.[0];
          if (file) __handleImportFile(file);
          e.target.value = "";
        },
        {
          tag: "project",
          scope: "projectManager",
          label: "projectManagerImportFile:change",
        }
      );
    }

    const projectManagerImportDropZone = DOMCache.get(
      "projectManagerImportDropZone"
    );
    if (projectManagerImportDropZone) {
      EventManager.add(
        projectManagerImportDropZone,
        "click",
        (e) => {
          if (e.target.closest("#projectManagerImportBtn")) return;
          projectManagerImportFile?.click();
        },
        {
          tag: "project",
          scope: "projectManager:dropZone",
          label: "importDropZone:click",
        }
      );

      EventManager.add(
        projectManagerImportDropZone,
        "dragover",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          projectManagerImportDropZone.dataset.active = "true";
        },
        {
          tag: "project",
          scope: "projectManager:dropZone",
          label: "importDropZone:dragover",
        }
      );

      EventManager.add(
        projectManagerImportDropZone,
        "dragleave",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!projectManagerImportDropZone.contains(e.relatedTarget)) {
            projectManagerImportDropZone.dataset.active = "false";
          }
        },
        {
          tag: "project",
          scope: "projectManager:dropZone",
          label: "importDropZone:dragleave",
        }
      );

      EventManager.add(
        projectManagerImportDropZone,
        "drop",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          projectManagerImportDropZone.dataset.active = "false";
          const file = e.dataTransfer?.files?.[0];
          if (file && (file.name.toLowerCase().endsWith(".json") || file.type === "application/json")) {
            __handleImportFile(file);
          } else if (file) {
            showNotification("warning", "格式错误", "请拖拽 .json 项目文件");
          }
        },
        {
          tag: "project",
          scope: "projectManager:dropZone",
          label: "importDropZone:drop",
        }
      );
    }

    const projectManagerRefreshBtn = DOMCache.get(
      "projectManagerRefreshBtn"
    );
    if (projectManagerRefreshBtn) {
      EventManager.add(
        projectManagerRefreshBtn,
        "click",
        async () => {
          __switchProjectManagerTab("list");
          await refreshProjectManagerList();
        },
        {
          tag: "project",
          scope: "projectManager",
          label: "projectManagerRefreshBtn:click",
        }
      );
    }

    const listEl = DOMCache.get("projectManagerList");
    if (listEl) {
      EventManager.add(
        listEl,
        "click",
        async (e) => {
          const btn = e.target.closest("button[data-action]");
          if (!btn || !listEl.contains(btn)) return;

          const row = btn.closest("[data-project-id]");
          const projectId = row?.dataset?.projectId;
          const action = btn.dataset.action;
          if (!projectId) return;

          if (action === "switch") {
            await __switchToProject(projectId);
            __closeModal("projectManagerModal");
            return;
          }

          if (action === "export") {
            await __exportProjectById(projectId);
            return;
          }

          if (action === "rename") {
            const nextName = prompt("请输入新的项目名称");
            if (!nextName) return;
            await storageManager
              .renameProject(projectId, nextName)
              .catch((e) => {
                (loggers.storage || console).error("重命名失败:", e);
              });

            if (AppState.project?.id === projectId) {
              AppState.project.name = nextName;
            }

            await refreshProjectManagerList();
            showNotification("success", "已更新", "项目名称已更新");
            return;
          }

          if (action === "delete") {
            const ok = confirm("确定要删除该项目吗？此操作不可恢复。");
            if (!ok) return;

            await storageManager.deleteProject(projectId).catch((e) => {
              (loggers.storage || console).error("删除项目失败:", e);
            });

            const activeId = await storageManager
              .getActiveProjectId()
              .catch(() => null);
            if (activeId && activeId !== AppState.project?.id) {
              const p = await storageManager
                .loadProjectById(activeId)
                .catch(() => null);
              if (p) __applyProjectToState(p);
            }

            await refreshProjectManagerList();
            showNotification("success", "已删除", "项目已删除");
          }
        },
        {
          tag: "project",
          scope: "projectManager",
          label: "projectManagerList:clickDelegate",
        }
      );
    }
  }

  App.features.projects.openProjectManager = openProjectManager;
  App.features.projects.refreshProjectManagerList = refreshProjectManagerList;

  window.registerEventListenersProjectManager =
    registerEventListenersProjectManager;
})();
