function setDropAreaActive(target, active) {
  const el =
    typeof target === "string" ? DOMCache.get(target) : target;
  if (!el) return;

  el.dataset.active = active ? "true" : "false";
  if (active) {
    el.classList.remove("border-gray-300", "dark:border-gray-600");
    el.classList.add("border-primary", "bg-blue-50", "dark:bg-blue-500/10");
  } else {
    el.classList.remove("border-primary", "bg-blue-50", "dark:bg-blue-500/10");
    el.classList.add("border-gray-300", "dark:border-gray-600");
  }
}

const __devEnabled =
  (typeof isDevelopment === "boolean" && isDevelopment) ||
  (typeof isDevelopment === "function" && isDevelopment());
if (__devEnabled) {
  try {
    if (window.ArchDebug) {
      window.ArchDebug.setFlag('setDropAreaActive', setDropAreaActive, {
        windowKey: '__setDropAreaActive',
        mirrorWindow: false,
      });
    } else {
      window.__setDropAreaActive = setDropAreaActive;
    }
  } catch (_) {
    try {
      if (!window.ArchDebug) {
        window.__setDropAreaActive = setDropAreaActive;
      }
    } catch (_) {
      (loggers.app || console).debug("fileDrop global register:", _);
    }
  }
}

function handleDragOver(e) {
  e.preventDefault();
  setDropAreaActive("fileDropArea", true);
}

function handleDragLeave(e) {
  e.preventDefault();
  setDropAreaActive("fileDropArea", false);
}

function handleDrop(e) {
  e.preventDefault();
  setDropAreaActive("fileDropArea", false);

  if (e.dataTransfer.files.length) {
    // 将 FileList 转换为数组，保持一致性
    const filesArray = Array.from(e.dataTransfer.files);

    // 验证文件大小（10MB限制），与 handleFileSelect 保持一致
    const invalidFiles = filesArray.filter(
      (file) => !securityUtils.validateFileSize(file.size, 10)
    );
    if (invalidFiles.length > 0) {
      showNotification(
        "error",
        "文件过大",
        `以下文件超过10MB限制：${invalidFiles.map((f) => f.name).join(", ")}`
      );
      return;
    }

    processFiles(filesArray);
  }
}

function handleFileSelect(e) {
  if (e.target.files.length) {
    // 先将 FileList 转换为数组，防止清空输入框后 files 被清空
    const filesArray = Array.from(e.target.files);

    // 验证文件大小（10MB限制）
    const invalidFiles = filesArray.filter(
      (file) => !securityUtils.validateFileSize(file.size, 10)
    );
    if (invalidFiles.length > 0) {
      showNotification(
        "error",
        "文件过大",
        `以下文件超过10MB限制：${invalidFiles.map((f) => f.name).join(", ")}`
      );
      e.target.value = "";
      return;
    }

    processFiles(filesArray);
    // 清空文件输入框，允许重复选择同一文件
    e.target.value = "";
  }
}
