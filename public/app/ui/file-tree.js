// 更新文件树
function updateFileTree(files) {
  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      (loggers.app || console).info("updateFileTree 被调用", {
        files,
        project: AppState.project,
      });
    } catch (e) {
      (loggers.app || console).debug("fileTree dispatch event:", e);
    }
  }
  const fileTree = DOMCache.get("fileTree");

  ProjectStore.ensureFileMetadata();

  // 如果有新上传的文件，直接处理
  let uploadedFiles = [];
  if (files && files.length > 0) {
    uploadedFiles = Array.from(files);
  }

  const hasAnyMetadata =
    (AppState &&
      AppState.fileMetadata &&
      Object.keys(AppState.fileMetadata).length > 0) ||
    (AppState &&
      AppState.project &&
      AppState.project.fileMetadata &&
      Object.keys(AppState.project.fileMetadata).length > 0);

  // 如果没有项目或翻译项，且没有新上传的文件，显示提示
  if (
    (!AppState.project || !AppState.project.translationItems.length) &&
    uploadedFiles.length === 0 &&
    !hasAnyMetadata
  ) {
    if (typeof isDevelopment !== "undefined" && isDevelopment) {
      try {
        (loggers.app || console).info("没有项目或翻译项，显示默认提示");
      } catch (e) {
        // dev-only log - safe to ignore
      }
    }
    const li = document.createElement("li");
    li.className = "p-6 text-center";
    li.innerHTML =
      '<div class="flex flex-col items-center gap-2">' +
        '<i class="fa-regular fa-folder-open text-3xl text-gray-300 dark:text-gray-600"></i>' +
        '<p class="text-sm text-gray-500 dark:text-gray-400">暂无文件</p>' +
        '<p class="text-xs text-gray-400 dark:text-gray-500">拖拽文件到上方区域或点击浏览</p>' +
      '</div>';
    fileTree.replaceChildren(li);
    return;
  }

  // 提取唯一的文件名
  const uniqueFiles = new Set();

  // 添加新上传的文件
  uploadedFiles.forEach((file) => {
    uniqueFiles.add(file.name);

    // 立即保存 size 等基础元数据，确保文件树能显示“文件大小”（经 ProjectStore 写入）
    const extension = file.name.split(".").pop().toLowerCase();
    if (!AppState.fileMetadata[file.name]) {
      ProjectStore.setFileMetadata(file.name, {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || "text/plain",
        extension,
      });
    } else if (
      typeof AppState.fileMetadata[file.name].size !== "number" &&
      typeof file.size === "number"
    ) {
      ProjectStore.patchFileMetadata(file.name, { size: file.size });
    }
  });

  // 添加现有项目中的文件
  if (AppState.project) {
    AppState.project.translationItems.forEach((item) => {
      if (item.metadata && item.metadata.file) {
        uniqueFiles.add(item.metadata.file);
      }
    });
  }

  // 添加已导入文件元数据中的文件（即使没有翻译项也要显示）
  try {
    const fm =
      (AppState && AppState.fileMetadata) ||
      (AppState && AppState.project && AppState.project.fileMetadata) ||
      {};
    Object.keys(fm).forEach((fileName) => {
      if (fileName) uniqueFiles.add(fileName);
    });
  } catch (e) {
    (loggers.app || console).debug("fileTree extractFiles:", e);
  }

  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      (loggers.app || console).info("提取到的唯一文件名:", Array.from(uniqueFiles));
    } catch (e) {
      // dev-only log - safe to ignore
    }
  }

  // 如果没有文件名，显示默认文件
  if (uniqueFiles.size === 0) {
    uniqueFiles.add("default.xml");

    // 占位示例文件：确保大小展示稳定（经 ProjectStore 写入）
    if (!AppState.fileMetadata["default.xml"]) {
      ProjectStore.setFileMetadata("default.xml", {
        size: 0,
        lastModified: Date.now(),
        type: "text/xml",
        extension: "xml",
      });
    } else if (typeof AppState.fileMetadata["default.xml"].size !== "number") {
      ProjectStore.patchFileMetadata("default.xml", { size: 0 });
    }
  }

  // 单次遍历统计各文件翻译进度（避免每文件 O(n) 重复扫描）
  const fileProgress = {};
  try {
    const allItems = AppState?.project?.translationItems || [];
    for (let pi = 0; pi < allItems.length; pi++) {
      const it = allItems[pi];
      const fn = it?.metadata?.file;
      if (!fn) continue;
      if (!fileProgress[fn]) fileProgress[fn] = { total: 0, translated: 0 };
      fileProgress[fn].total++;
      if (it.targetText && String(it.targetText).trim()) {
        fileProgress[fn].translated++;
      }
    }
  } catch (e) {
    (loggers.app || console).debug("fileProgress scan:", e);
  }

  const fragment = document.createDocumentFragment();
  uniqueFiles.forEach((filename) => {
    const extension = filename.split(".").pop().toLowerCase();
    let icon = "fa-file";

    // 根据文件类型选择图标
    if (extension === "xml") icon = "fa-file-code-o";
    else if (extension === "json") icon = "fa-file-code-o";
    else if (extension === "xliff") icon = "fa-file-text-o";
    else if (extension === "strings") icon = "fa-file-text-o";
    else if (extension === "resx") icon = "fa-file-text-o";
    else if (extension === "po") icon = "fa-file-text-o";

    const li = document.createElement("li");
    li.className = "mb-1";

    const row = document.createElement("div");
    row.className =
      "flex items-center p-2 pr-8 sm:pr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group relative overflow-hidden";
    row.dataset.filename = filename;

    const iconEl = document.createElement("i");
    iconEl.className = `fa ${icon} text-gray-500 dark:text-gray-400 mr-2`;

    const nameEl = document.createElement("span");
    nameEl.className = "text-sm truncate text-gray-800 dark:text-gray-100";
    nameEl.textContent = filename;

    const sizeEl = document.createElement("span");
    sizeEl.className =
      "ml-auto text-xs text-gray-400 dark:text-gray-500 " +
      // 桌面 hover 时淡出隐藏，操作菜单滑入其位置（VS Code 风格）
      "transition-all duration-150 sm:group-hover:opacity-0";
    sizeEl.textContent = getFileSize(filename);

    // 翻译进度徽章（已译百分比；与大小一起在 hover 时淡出让位给操作菜单）
    const prog = fileProgress[filename];
    const progressEl = document.createElement("span");
    if (prog && prog.total > 0) {
      const done = prog.translated >= prog.total;
      progressEl.className =
        "ml-2 text-xs font-medium tabular-nums " +
        (done
          ? "text-emerald-600 dark:text-emerald-400"
          : prog.translated > 0
          ? "text-blue-600 dark:text-blue-400"
          : "text-gray-400 dark:text-gray-500");
      const pct =
        prog.total > 0 ? Math.round((prog.translated / prog.total) * 100) : 0;
      progressEl.textContent = pct + "%";
      progressEl.title =
        prog.translated + "/" + prog.total + " 已翻译";
    }

    // ===== 文件操作菜单：桌面端 hover 从右向左滑入，移动端常显 =====
    // 结构与常见文件管理器一致：操作按钮固定于行右侧，滑入时平滑覆盖
    const actionsEl = document.createElement("div");
    actionsEl.className =
      "absolute right-0 top-0 h-full flex items-center gap-0.5 px-1 " +
      // 背景与 hover 行背景一致（滑入时遮住文件名/大小末尾）
      "bg-gray-100 dark:bg-gray-700 " +
      // 默认（移动端优先）：常显
      "translate-x-0 opacity-100 " +
      // sm+（桌面）：藏于行右侧外，hover 行时从右向左滑入
      "sm:translate-x-full sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 " +
      "transition-all duration-150 ease-out";
    actionsEl.dataset.fileActions = "true";

    // 编辑源文件：仅在有原始内容或 IndexedDB 引用时显示（示例项目无源文件）
    const fileMeta =
      (AppState.fileMetadata && AppState.fileMetadata[filename]) ||
      (AppState.project &&
        AppState.project.fileMetadata &&
        AppState.project.fileMetadata[filename]) ||
      {};
    const canEditSource =
      typeof fileMeta.originalContent === "string" || !!fileMeta.contentKey;
    if (canEditSource) {
      const editBtn2 = document.createElement("button");
      editBtn2.type = "button";
      editBtn2.className =
        "p-1 rounded text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20";
      editBtn2.title = "编辑源文件 " + filename;
      editBtn2.setAttribute("aria-label", "编辑源文件 " + filename);
      editBtn2.dataset.action = "edit";
      editBtn2.dataset.filename = filename;
      const editIcon2 = document.createElement("i");
      editIcon2.className = "fa-regular fa-pen-to-square text-xs";
      editBtn2.appendChild(editIcon2);
      actionsEl.appendChild(editBtn2);
    }

    // 删除按钮
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "p-1 rounded text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";
    removeBtn.title = "删除文件 " + filename;
    removeBtn.setAttribute("aria-label", "删除文件 " + filename);
    removeBtn.dataset.action = "remove";
    removeBtn.dataset.filename = filename;
    const removeIcon = document.createElement("i");
    removeIcon.className = "fa-regular fa-trash-can text-xs";
    removeBtn.appendChild(removeIcon);
    actionsEl.appendChild(removeBtn);

    row.appendChild(iconEl);
    row.appendChild(nameEl);
    // 进度百分比紧随文件名（方案 B：重要信息靠内），大小贴右缘
    if (progressEl && progressEl.textContent) row.appendChild(progressEl);
    row.appendChild(sizeEl);
    row.appendChild(actionsEl);
    li.appendChild(row);
    fragment.appendChild(li);
  });

  fileTree.replaceChildren(fragment);
}

// 获取文件大小（从 AppState 获取）
function getFileSize(filename) {
  // 从 AppState.fileMetadata 中获取文件大小
  if (
    AppState.fileMetadata[filename] &&
    typeof AppState.fileMetadata[filename].size === "number"
  ) {
    const bytes = AppState.fileMetadata[filename].size;
    return formatFileSize(bytes);
  }

  // 没有 size 元数据时，不再回退到“项数”，避免误导
  return "—";
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ==================== 删除项目文件 ====================
// 从当前项目中移除指定文件：清理文件内容缓存、文件元数据与该文件的全部翻译项
async function removeFileFromProject(filename) {
  if (!filename) return;

  const ok = await showConfirmDialog({
    title: "删除文件",
    message:
      '确定要从项目中删除文件 "' + filename + '" 吗？\n' +
      "该文件的所有翻译项也将一并移除，此操作不可恢复。",
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;

  try {
    // 1. 清理 IndexedDB / localStorage 中的文件内容缓存
    const meta = AppState.fileMetadata?.[filename];
    if (meta && meta.contentKey) {
      try {
        if (typeof idbDeleteFileContent === "function") {
          await idbDeleteFileContent(meta.contentKey);
        }
      } catch (e) {
        (loggers.storage || console).warn("删除文件内容缓存失败:", filename, e);
      }
    }

    // 2. 删除文件元数据（经 ProjectStore，含 project.fileMetadata 派生引用维护）
    ProjectStore.removeFileMetadata(filename);

    // 3. 移除该文件的全部翻译项（经 ProjectStore 同步 translations 视图）
    if (AppState.project) {
      ProjectStore.replaceFileItems(filename, []);
    } else {
      // 无项目时仅清空翻译视图（与旧行为一致）
      ProjectStore.setTranslationItems([]);
      TranslationViewStore.setFilter([]);
    }

    // 4. 清理选中状态（经 TranslationViewStore）
    if (AppState.translations.selectedFile === filename) {
      TranslationViewStore.setSelectedFile(null);
    }
    TranslationViewStore.setSelection(-1);
    TranslationViewStore.setPage(1);
    TranslationViewStore.setSearchQuery("");

    // 5. 持久化项目
    if (typeof storageManager !== "undefined" && storageManager && AppState.project) {
      try {
        await storageManager.saveProject(AppState.project);
      } catch (e) {
        (loggers.storage || console).warn("删除文件后保存项目失败:", e);
      }
    }

    // 6. 刷新 UI
    try {
      if (typeof updateFileTree === "function") updateFileTree();
      if (typeof updateTranslationLists === "function") updateTranslationLists();
      if (typeof updateCounters === "function") updateCounters();
    } catch (e) {
      (loggers.app || console).debug("删除文件后刷新 UI:", e);
    }

    showNotification("success", "文件已删除", "已从项目中移除 " + filename);
  } catch (e) {
    (loggers.app || console).error("删除文件失败:", e);
    showNotification("error", "删除失败", "删除文件时出现错误");
  }
}

// 根据文件过滤翻译项
function filterTranslationItemsByFile(filename) {
  // 显示通知
  showNotification("info", "文件选中", `已选择文件: ${filename}`);

  // translations 切片已在 state.js 显式声明（阶段 0），无需动态建切片
  TranslationViewStore.setSelectedFile(filename);

  // 过滤当前项目的翻译项
  TranslationViewStore.setFilter(
    AppState.project.translationItems.filter(
      (item) => item.metadata?.file === filename
    )
  );

  // 重置到第一页
  TranslationViewStore.setPage(1);

  // 更新翻译列表
  updateTranslationLists();
}
