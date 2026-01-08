// 更新文件树
function updateFileTree(files) {
  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      console.log("updateFileTree 被调用", {
        files,
        project: AppState.project,
      });
    } catch (_) {}
  }
  const fileTree = document.getElementById("fileTree");

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
        console.log("没有项目或翻译项，显示默认提示");
      } catch (_) {}
    }
    const li = document.createElement("li");
    li.className =
      "text-gray-500 dark:text-gray-400 text-sm italic p-4 text-center";
    li.textContent = "暂无文件";
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
  } catch (_) {}

  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      console.log("提取到的唯一文件名:", Array.from(uniqueFiles));
    } catch (_) {}
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
      "flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer";
    row.dataset.filename = filename;

    const iconEl = document.createElement("i");
    iconEl.className = `fa ${icon} text-gray-500 dark:text-gray-400 mr-2`;

    const nameEl = document.createElement("span");
    nameEl.className = "text-sm truncate text-gray-800 dark:text-gray-100";
    nameEl.textContent = filename;

    const sizeEl = document.createElement("span");
    sizeEl.className = "ml-auto text-xs text-gray-400 dark:text-gray-500";
    sizeEl.textContent = getFileSize(filename);

    row.appendChild(iconEl);
    row.appendChild(nameEl);
    row.appendChild(sizeEl);
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
