// 创建新项目
async function createNewProject() {
  const name = DOMCache.get("projectName").value.trim();
  const sourceLang = DOMCache.get("projectSourceLang").value;
  const targetLang = DOMCache.get("projectTargetLang").value;

  if (!name) {
    showNotification("warning", "缺少项目名称", "请输入项目名称");
    return;
  }

  // 检查是否有未保存的项目
  if (AppState.project && TranslationViewStore.getViewItems().length > 0) {
    const ok = await showConfirmDialog({
      title: "新建项目",
      message: "当前项目尚未保存，是否继续创建新项目？未保存的数据将丢失。",
      confirmText: "继续创建",
      danger: true,
    });
    if (!ok) return;
  }

  // 经 ProjectStore 创建并载入新项目（loadProject 内部统一重置 translations 视图）
  ProjectStore.createProject({
    id: "project-" + Date.now(),
    name: name,
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
    fileFormat: "mixed",
    translationItems: [],
    terminologyList: [...TerminologyStore.getList()],
  });

  // 更新UI
  updateFileTree();
  updateTranslationLists();
  updateCounters();

  // 更新语言选择
  DOMCache.get("sourceLanguage").value = sourceLang;
  DOMCache.get("targetLanguage").value = targetLang;

  // 清空输入框
  DOMCache.get("projectName").value = "";

  // 隐藏模态框
  closeModal();

  // 显示通知
  showNotification("success", "项目已创建", `项目 "${name}" 已成功创建`);

  autoSaveManager.markDirty();
  autoSaveManager.saveProject();

  try {
    const settingsModal = DOMCache.get("settingsModal");
    if (
      settingsModal &&
      !settingsModal.classList.contains("hidden") &&
      typeof window.loadProjectPromptTemplatesToUI === "function"
    ) {
      window.loadProjectPromptTemplatesToUI();
    }
  } catch (e) {
    (loggers.app || console).debug("project loadPromptTemplates:", e);
  }
}

// 打开项目
function openProject() {
  // 创建文件选择器
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.setAttribute("aria-label", "打开项目文件");
  input.title = "打开项目文件";

  EventManager.add(input, "change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    readFileAsync(file)
      .then(async (raw) => {
        let projectData;
        try {
          projectData = JSON.parse(raw);
        } catch (e) {
          (loggers.app || console).error("打开项目失败:", e);
          showNotification("error", "打开失败", "无法解析项目文件");
          return;
        }

        // 验证项目数据
        if (
          !projectData.name ||
          !projectData.sourceLanguage ||
          !projectData.targetLanguage
        ) {
          showNotification("error", "无效的项目文件", "项目文件格式不正确");
          return;
        }

        // 检查是否有未保存的项目
        if (AppState.project && TranslationViewStore.getViewItems().length > 0) {
          const ok = await showConfirmDialog({
            title: "打开项目",
            message: "当前项目尚未保存，是否继续打开新项目？未保存的数据将丢失。",
            confirmText: "继续打开",
            danger: true,
          });
          if (!ok) return;
        }

        // 经 ProjectStore 统一载入项目（含 translations 视图同步、fileMetadata、contentKey 水合）
        ProjectStore.loadProject(projectData);

        // 如果项目中有术语库，加载它（经 TerminologyStore；内部重置视图并同步快照）
        if (
          projectData.terminologyList &&
          Array.isArray(projectData.terminologyList)
        ) {
          TerminologyStore.loadTerminology(projectData.terminologyList);
          updateTerminologyList();
        }

        // 更新UI
        DOMCache.get("sourceLanguage").value =
          projectData.sourceLanguage;
        DOMCache.get("targetLanguage").value =
          projectData.targetLanguage;
        updateFileTree();
        updateTranslationLists();
        updateCounters();

        // 显示通知
        showNotification(
          "success",
          "项目已打开",
          `项目 "${projectData.name}" 已成功加载`
        );

        try {
          const settingsModal = DOMCache.get("settingsModal");
          if (
            settingsModal &&
            !settingsModal.classList.contains("hidden") &&
            typeof window.loadProjectPromptTemplatesToUI === "function"
          ) {
            window.loadProjectPromptTemplatesToUI();
          }
        } catch (e) {
          (loggers.app || console).debug("project import loadPromptTemplates:", e);
        }
      })
      .catch((e) => {
        (loggers.app || console).error("读取项目文件失败:", e);
        showNotification("error", "读取失败", "无法读取项目文件");
      });
  }, { label: "openProject:fileInput:change" });

  input.click();
}

// 下载和迁移必须自带原文件，不能依赖另一浏览器无法访问的 IndexedDB 引用。
App.features.translations = App.features.translations || {};
App.features.translations.export = App.features.translations.export || {};
App.features.translations.export.buildPortableProject = async function (project) {
  if (!project || typeof project !== "object") throw new Error("没有可导出的项目");
  // 在第一次等待前固定快照，避免期间编辑或切换项目混入下载的数据。
  const snapshot = JSON.parse(JSON.stringify(project));
  const fileMetadata = snapshot.fileMetadata || {};
  const missingFiles = [];
  await Promise.all(Object.keys(fileMetadata).map(async (fileName) => {
    const meta = fileMetadata[fileName];
    if (meta && typeof meta.originalContent === "string") return;
    try {
      if (meta?.contentKey && typeof idbGetFileContent === "function") {
        const content = await idbGetFileContent(meta.contentKey);
        if (typeof content === "string") {
          meta.originalContent = content;
          return;
        }
      }
    } catch (e) {
      (loggers.storage || console).error(`导出项目时读取 ${fileName} 原始内容失败:`, e);
    }
    missingFiles.push(fileName);
  }));
  if (missingFiles.length) {
    throw new Error(`以下文件缺少原始内容：${missingFiles.join("、")}。请先导出译文副本，再重新导入原文件后重试，避免同名导入覆盖当前校对结果。`);
  }
  return snapshot;
};

// 保存项目
async function saveProject() {
  if (!AppState.project) {
    showNotification("warning", "无项目", "请先创建或打开项目");
    return;
  }
  const sourceProject = AppState.project;

  // 更新项目数据（视图条目引用与 project.translationItems 由 ProjectStore 维持同步，无需重同步）
  ProjectStore.touchProject();
  // 术语快照由 TerminologyStore 在每次变更时经 ProjectStore 同步；此处兜底对齐
  ProjectStore.setTerminologyList(TerminologyStore.getList());

  // 项目文件包含原文件，内部保存仍以 contentKey 为主。
  let projectData;
  try {
    projectData = await App.features.translations.export.buildPortableProject({
      ...AppState.project,
      fileFormat: AppState.project.fileFormat || "mixed",
      // 持久化读视图稳定引用（质量检查 swap 窗口期间仍为全量，与旧别名行为一致）
      translationItems: TranslationViewStore.getViewItems(),
      terminologyList: TerminologyStore.getList(),
      promptTemplate: AppState.project.promptTemplate,
      fileMetadata: AppState.fileMetadata || {},
      version: "1.1.0",
    });
  } catch (e) {
    (loggers.storage || console).error("打包完整项目失败:", e);
    showNotification("error", "项目保存失败", e.message || "无法读取原始文件内容");
    return;
  }

  const safeFileMetadata = {};
  for (const [fileName, meta] of Object.entries(projectData.fileMetadata || {})) {
    const cloned = { ...meta };
    const key = cloned.contentKey || buildFileContentKey(projectData.id, fileName);
    cloned.contentKey = key;
    try {
      await idbPutFileContent(key, cloned.originalContent);
      delete cloned.originalContent;
    } catch (e) {
      // 引用存在不代表缓存写入成功；保留原文可让本地存储的降级保存继续恢复。
      (loggers.storage || console).error("手动保存时写入原始内容失败:", e);
    }
    safeFileMetadata[fileName] = cloned;
  }

  let persistedOk = true;
  try {
    const localPayload = { ...projectData, fileMetadata: safeFileMetadata };
    const shouldSetActive = () => AppState.project === sourceProject;
    if (shouldSetActive()) {
      await storageManager.saveCurrentProject(localPayload, { shouldSetActive });
    } else {
      // 原文读取或写入期间切换了项目，旧快照只能更新历史项目，不能切回活跃项目。
      await storageManager.saveCurrentProject(localPayload, { setActive: false, shouldSetActive });
    }
  } catch (e) {
    persistedOk = false;
    (loggers.storage || console).error("手动保存时持久化 currentProject 失败:", e);
  }

  // 转换为JSON字符串
  const jsonStr = JSON.stringify(projectData, null, 2);

  // 创建Blob对象
  const blob = new Blob([jsonStr], { type: "application/json" });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectData.name}.json`;

  // 触发下载
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 显示通知
  if (persistedOk) {
    showNotification(
      "success",
      "项目已保存",
      `项目 "${projectData.name}" 已成功保存`
    );
  } else {
    showNotification(
      "warning",
      "项目已下载",
      "项目文件已下载，但未能写入本地项目列表（请检查存储权限/空间，或尝试清理缓存后重试）。"
    );
  }
}
