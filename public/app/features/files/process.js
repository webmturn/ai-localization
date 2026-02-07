async function __processFilesImpl(files) {
  showNotification("info", "处理文件", `正在处理 ${files.length} 个文件...`);

  try {
    const isSampleProject = !!AppState.project?.__isSampleProject;
    if (isSampleProject) {
      try {
        AppState.project = null;
      } catch (_) {
        (loggers.app || console).debug("processFiles reset project:", _);
      }

      try {
        AppState.fileMetadata = {};
      } catch (_) {
        (loggers.app || console).debug("processFiles reset fileMetadata:", _);
      }

      try {
        AppState.translations.items = [];
        AppState.translations.filtered = [];
        AppState.translations.selected = -1;
        AppState.translations.currentPage = 1;
      } catch (_) {
        (loggers.app || console).debug("processFiles reset translations:", _);
      }

      showNotification(
        "info",
        "已切换为新项目",
        "检测到当前为示例项目，已自动创建新项目并导入文件。"
      );
    }

    const hadProject = !!AppState.project?.id;
    if (!hadProject) {
      const importProjectId = `project-${Date.now()}`;
      const sourceLanguage =
        DOMCache.get("sourceLanguage")?.value || "en";
      const targetLanguage =
        DOMCache.get("targetLanguage")?.value || "zh";

      AppState.fileMetadata = {};
      AppState.project = {
        id: importProjectId,
        name: "未命名项目",
        sourceLanguage,
        targetLanguage,
        fileFormat: "mixed",
        translationItems: [],
        terminologyList: AppState.terminology?.list || [],
        fileMetadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      AppState.translations.items = [];
      AppState.translations.filtered = [];
      AppState.translations.selected = -1;
      AppState.translations.currentPage = 1;

      AppState.__autoCreatedProjectOnImport = true;
      showNotification(
        "info",
        "已自动创建项目",
        "检测到当前未打开项目，已自动创建新项目并导入文件。"
      );
    } else {
      if (!AppState.fileMetadata) {
        AppState.fileMetadata = AppState.project?.fileMetadata || {};
      }
    }

    // 并行处理所有文件
    const results = await Promise.allSettled(
      Array.from(files).map((file) => __parseFileAsyncImpl(file))
    );

    // 收集所有解析结果
    const newItems = [];
    let successCount = 0;
    const warnings = [];

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        newItems.push(...result.value.items);
        if (result.value.success) successCount++;
        if (Array.isArray(result.value.warnings)) {
          warnings.push(...result.value.warnings);
        }
      }
    });

    (loggers.app || console).info(
      `所有文件处理完成: 成功 ${successCount}/${files.length} 个，解析 ${newItems.length} 个翻译项`
    );

    // 完成文件处理
    await __completeFileProcessingImpl(files, newItems, warnings);
  } catch (error) {
    (loggers.app || console).error("处理文件时出错:", error);
    showNotification(
      "error",
      "处理错误",
      `文件处理过程中出现错误: ${error.message}`
    );
  }
}

async function __completeFileProcessingImpl(files, newItems, warnings = []) {
  (loggers.app || console).debug("completeFileProcessing 被调用", {
    filesCount: files.length,
    itemsCount: newItems.length,
  });

  // 即使解析出 0 个翻译项，也要保留“已导入文件”的元数据与文件树显示
  if (!newItems || newItems.length === 0) {
    showNotification(
      "warning",
      "无可用翻译项",
      "已导入文件，但未提取到可翻译内容。"
    );
  }

  const projectId = AppState.project?.id;
  const projectName = AppState.project?.name || "未命名项目";
  if (!projectId) {
    (loggers.app || console).warn("导入完成时未找到 projectId，将尝试创建/修复 projectId");
  }

  const importedFileNames = new Set(
    (files || []).map((f) => f && f.name).filter(Boolean)
  );

  // 清理“无文件时的占位 default.xml”，避免占位项混入真实导入文件列表/元数据
  // 仅在明确是占位（size=0 且无 contentKey/originalContent）且本次未导入同名文件时才删除
  try {
    if (!importedFileNames.has("default.xml")) {
      const meta = AppState.fileMetadata?.["default.xml"];
      const looksLikePlaceholder =
        meta &&
        meta.size === 0 &&
        !meta.contentKey &&
        !meta.originalContent &&
        (!meta.lastModified || typeof meta.lastModified === "number");
      if (looksLikePlaceholder) {
        delete AppState.fileMetadata["default.xml"];
        if (AppState.project?.fileMetadata) {
          try {
            delete AppState.project.fileMetadata["default.xml"];
          } catch (_) {
            (loggers.app || console).debug("delete default.xml metadata:", _);
          }
        }
      }
    }
  } catch (_) {
    (loggers.app || console).debug("processFiles sample cleanup:", _);
  }

  const existingItems =
    AppState.project?.translationItems || AppState.translations.items || [];
  const keptItems = existingItems.filter((it) => {
    const fn = it?.metadata?.file;
    if (!fn) return true;
    return !importedFileNames.has(fn);
  });
  const mergedItems = [...keptItems, ...(newItems || [])];

  if (AppState.project) {
    AppState.project.translationItems = mergedItems;
    AppState.project.fileMetadata = AppState.fileMetadata || {};
    AppState.project.updatedAt = new Date().toISOString();
  }

  if (projectId) hydrateFileMetadataContentKeys(projectId);
  AppState.__pendingImportProjectId = null;

  // 同步 AppState 翻译状态
  AppState.translations.items = mergedItems;
  AppState.translations.filtered = [...mergedItems];
  AppState.translations.selected = -1;
  AppState.translations.currentPage = 1;

  // 显示成功通知
  if (AppState.__autoCreatedProjectOnImport) {
    showNotification(
      "success",
      "已创建项目并导入",
      `已自动创建项目 "${projectName}"，并导入 ${files.length} 个文件（${newItems.length} 个翻译项）`
    );
  } else {
    showNotification(
      "success",
      "文件已导入",
      `已导入到项目 "${projectName}"：${files.length} 个文件（${newItems.length} 个翻译项）`
    );
  }
  AppState.__autoCreatedProjectOnImport = false;

  if (warnings && warnings.length > 0) {
    const byType = warnings.reduce((acc, warn) => {
      const key = warn.type || "unknown";
      acc[key] = acc[key] || [];
      acc[key].push(warn);
      return acc;
    }, {});

    if (byType.encoding) {
      const count = byType.encoding.reduce((sum, w) => sum + (w.count || 0), 0);
      showNotification(
        "warning",
        "编码异常提示",
        `检测到 ${byType.encoding.length} 个文件存在编码异常（共 ${count || "?"} 个替换字符）`
      );
    }
    if (byType.control) {
      const count = byType.control.reduce((sum, w) => sum + (w.count || 0), 0);
      showNotification(
        "warning",
        "非法字符提示",
        `检测到 ${byType.control.length} 个文件包含控制字符（共 ${count || "?"} 个）`
      );
    }
    if (byType.duplicate) {
      const samples = byType.duplicate
        .flatMap((w) => (Array.isArray(w.samples) ? w.samples : []))
        .slice(0, 5);
      const sampleText = samples.length > 0 ? `，示例：${samples.join(", ")}` : "";
      showNotification(
        "warning",
        "重复 Key 提示",
        `检测到 ${byType.duplicate.length} 个文件存在重复 key${sampleText}`
      );
    }
  }

  (loggers.app || console).debug("调用 updateFileTree，项目信息:", AppState.project);
  // 更新文件树（在创建/更新项目之后）
  updateFileTree();

  // 更新UI
  updateTranslationLists();
  updateCounters();

  // 更新项目状态
  try {
    const projectStatusEl = DOMCache.get("projectStatus");
    if (projectStatusEl) {
      projectStatusEl.textContent = "已更新";
      projectStatusEl.className =
        "text-success dark:text-emerald-400 font-medium";
    }
  } catch (_) {
    (loggers.app || console).debug("processFiles update projectStatus:", _);
  }

  autoSaveManager.markDirty();
  try {
    await autoSaveManager.saveProject();
  } catch (e) {
    (loggers.storage || console).error("导入后持久化失败:", e);
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.processFiles = __processFilesImpl;
  App.impl.completeFileProcessing = __completeFileProcessingImpl;
})();
