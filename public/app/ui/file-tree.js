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

  if (!AppState.fileMetadata) AppState.fileMetadata = {};

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

    // 立即保存 size 等基础元数据，确保文件树能显示“文件大小”
    const extension = file.name.split(".").pop().toLowerCase();
    if (!AppState.fileMetadata[file.name]) {
      AppState.fileMetadata[file.name] = {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || "text/plain",
        extension,
      };
    } else if (
      typeof AppState.fileMetadata[file.name].size !== "number" &&
      typeof file.size === "number"
    ) {
      AppState.fileMetadata[file.name].size = file.size;
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

    // 占位示例文件：确保大小展示稳定
    if (!AppState.fileMetadata["default.xml"]) {
      AppState.fileMetadata["default.xml"] = {
        size: 0,
        lastModified: Date.now(),
        type: "text/xml",
        extension: "xml",
      };
    } else if (typeof AppState.fileMetadata["default.xml"].size !== "number") {
      AppState.fileMetadata["default.xml"].size = 0;
    }
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

    // 2. 删除文件元数据
    if (AppState.fileMetadata && AppState.fileMetadata[filename]) {
      delete AppState.fileMetadata[filename];
    }
    if (AppState.project?.fileMetadata && AppState.project.fileMetadata[filename]) {
      delete AppState.project.fileMetadata[filename];
    }

    // 3. 移除该文件的全部翻译项
    if (AppState.project) {
      AppState.project.translationItems = (
        AppState.project.translationItems || []
      ).filter((item) => item?.metadata?.file !== filename);
    }
    AppState.translations.items = AppState.project?.translationItems || [];
    AppState.translations.filtered = [...AppState.translations.items];

    // 4. 清理选中状态
    if (AppState.translations.selectedFile === filename) {
      AppState.translations.selectedFile = null;
    }
    AppState.translations.selected = -1;
    AppState.translations.currentPage = 1;
    AppState.translations.searchQuery = "";

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

  if (!AppState.translations) AppState.translations = {};
  AppState.translations.selectedFile = filename;

  // 过滤当前项目的翻译项
  AppState.translations.filtered = AppState.project.translationItems.filter(
    (item) => item.metadata?.file === filename
  );

  // 重置到第一页
  AppState.translations.currentPage = 1;

  // 更新翻译列表
  updateTranslationLists();
}
