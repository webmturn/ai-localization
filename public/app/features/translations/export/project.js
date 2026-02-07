// 创建新项目
function createNewProject() {
  const name = DOMCache.get("projectName").value.trim();
  const sourceLang = DOMCache.get("projectSourceLang").value;
  const targetLang = DOMCache.get("projectTargetLang").value;

  if (!name) {
    showNotification("warning", "缺少项目名称", "请输入项目名称");
    return;
  }

  // 检查是否有未保存的项目
  if (AppState.project && AppState.translations.items.length > 0) {
    if (
      !confirm("当前项目尚未保存，是否继续创建新项目？未保存的数据将丢失。")
    ) {
      return;
    }
  }

  // 清空现有数据
  AppState.translations.items = [];
  AppState.translations.selected = -1;
  AppState.translations.currentPage = 1;
  AppState.translations.filtered = [];
  AppState.translations.searchQuery = "";

  // 创建新项目
  AppState.project = {
    id: "project-" + Date.now(),
    name: name,
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
    fileFormat: "mixed",
    translationItems: [],
    terminologyList: [...AppState.terminology.list],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
  } catch (_) {
    (loggers.app || console).debug("project loadPromptTemplates:", _);
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

  input.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    readFileAsync(file)
      .then((raw) => {
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
        if (AppState.project && AppState.translations.items.length > 0) {
          if (
            !confirm(
              "当前项目尚未保存，是否继续打开新项目？未保存的数据将丢失。"
            )
          ) {
            return;
          }
        }

        // 加载项目数据
        AppState.project = projectData;
        AppState.translations.items = projectData.translationItems || [];
        AppState.project.translationItems = AppState.translations.items;

        // 加载文件元数据
        if (projectData.fileMetadata) {
          AppState.fileMetadata = projectData.fileMetadata;
        } else {
          AppState.fileMetadata = {};
        }

        hydrateFileMetadataContentKeys(AppState.project?.id);

        // 如果项目中有术语库，加载它
        if (
          projectData.terminologyList &&
          Array.isArray(projectData.terminologyList)
        ) {
          AppState.terminology.list = projectData.terminologyList;
          AppState.terminology.filtered = [...AppState.terminology.list];
          updateTerminologyList();
        }

        // 重置状态
        AppState.translations.selected = -1;
        AppState.translations.currentPage = 1;
        AppState.translations.filtered = [...AppState.translations.items];
        AppState.translations.searchQuery = "";

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
        } catch (_) {
          (loggers.app || console).debug("project import loadPromptTemplates:", _);
        }
      })
      .catch((e) => {
        (loggers.app || console).error("读取项目文件失败:", e);
        showNotification("error", "读取失败", "无法读取项目文件");
      });
  };

  input.click();
}

// 保存项目
async function saveProject() {
  if (!AppState.project) {
    showNotification("warning", "无项目", "请先创建或打开项目");
    return;
  }

  // 更新项目数据
  AppState.project.updatedAt = new Date().toISOString();
  AppState.project.translationItems = AppState.translations.items;
  AppState.project.terminologyList = AppState.terminology.list;

  // 保存原始内容到IndexedDB，项目文件仅保存引用（contentKey）
  hydrateFileMetadataContentKeys(AppState.project?.id);
  const safeFileMetadata = {};
  const fileMetadata = AppState.fileMetadata || {};
  Object.keys(fileMetadata).forEach((fileName) => {
    const meta = fileMetadata[fileName] || {};
    const cloned = { ...meta };
    delete cloned.originalContent;
    safeFileMetadata[fileName] = cloned;
  });

  // 创建项目数据对象
  const projectData = {
    id: AppState.project.id,
    name: AppState.project.name,
    sourceLanguage: AppState.project.sourceLanguage,
    targetLanguage: AppState.project.targetLanguage,
    fileFormat: AppState.project.fileFormat || "mixed",
    translationItems: AppState.translations.items,
    terminologyList: AppState.terminology.list,
    promptTemplate: AppState.project.promptTemplate,
    fileMetadata: safeFileMetadata,
    createdAt: AppState.project.createdAt,
    updatedAt: AppState.project.updatedAt,
    version: "1.0.0",
  };

  let persistedOk = true;
  try {
    await storageManager.saveCurrentProject(projectData);
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
  a.download = `${AppState.project.name}.json`;

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
      `项目 "${AppState.project.name}" 已成功保存`
    );
  } else {
    showNotification(
      "warning",
      "项目已下载",
      "项目文件已下载，但未能写入本地项目列表（请检查存储权限/空间，或尝试清理缓存后重试）。"
    );
  }
}
