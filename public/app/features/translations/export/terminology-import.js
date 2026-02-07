// 全局变量用于存储待导入的文件
let pendingImportFile = null;

// 处理导入文件选择
function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 保存文件引用
  pendingImportFile = file;

  (loggers.app || console).debug("文件已选择:", file.name);

  // 获取导入按钮并启用它
  const importTerminologyBtn = DOMCache.get("importTerminologyBtn");
  if (importTerminologyBtn) {
    (loggers.app || console).debug("启用导入按钮");
    importTerminologyBtn.disabled = false;
    importTerminologyBtn.classList.remove(
      "disabled:opacity-50",
      "disabled:cursor-not-allowed"
    );
  } else {
    (loggers.app || console).error("未找到导入按钮元素");
  }

  // 显示文件信息
  const importDropArea = DOMCache.get("importDropArea");
  const importFileInput = DOMCache.get("importFileInput");
  if (importDropArea) {
    const icon = document.createElement("i");
    icon.className = "fa fa-file-text text-2xl text-primary mb-2";

    const nameEl = document.createElement("p");
    nameEl.className = "text-sm font-medium text-gray-700 dark:text-gray-200";
    nameEl.textContent = file.name;

    const sizeEl = document.createElement("p");
    sizeEl.className = "text-xs text-gray-500 dark:text-gray-400";
    sizeEl.textContent = formatFileSize(file.size);

    const btn = document.createElement("button");
    btn.id = "changeImportFileBtn";
    btn.className =
      "mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors";
    btn.textContent = "更换文件";

    importDropArea.replaceChildren(icon, nameEl, sizeEl, btn);

    if (importFileInput) {
      importFileInput.classList.add("hidden");
      importDropArea.appendChild(importFileInput);
      EventManager.add(btn, "click", () => importFileInput.click());
    }
  }

  // 显示文件已选择的通知
  showNotification(
    "success",
    "文件已选择",
    `已选择文件: ${file.name} (${formatFileSize(file.size)})`
  );
}

// 导入术语
async function importTerminology() {
  try {
    (loggers.app || console).debug("开始导入术语库...");

    // 使用全局变量中保存的文件
    if (!pendingImportFile) {
      showNotification("warning", "未选择文件", "请选择要导入的文件");
      return;
    }

    const file = pendingImportFile;
    const importTerminologyBtn = DOMCache.get(
      "importTerminologyBtn"
    );

    (loggers.app || console).debug("导入文件:", file.name);
    const importFormat = DOMCache.get("importFormat").value;
    const overwrite = DOMCache.get("importOverwrite").checked;

    (loggers.app || console).debug("导入设置:", { format: importFormat, overwrite: overwrite });

    // 显示进度条
    const importProgress = DOMCache.get("importProgress");
    const importProgressBar = DOMCache.get("importProgressBar");
    const importPercentage = DOMCache.get("importPercentage");
    const importStatus = DOMCache.get("importStatus");

    if (importProgress) {
      importProgress.classList.remove("hidden");
      importProgressBar.style.width = "0%";
      importPercentage.textContent = "0%";
      importStatus.textContent = "准备导入...";
    }

    let fileContent = "";
    try {
      fileContent = await readFileAsync(file);
    } catch (e) {
      (loggers.app || console).error("文件读取失败:", e);
      showNotification("error", "文件读取失败", "无法读取选中的文件");

      if (importProgress) {
        importProgress.classList.add("hidden");
      }
      return;
    }

    (loggers.app || console).debug("文件读取完成，内容长度:", fileContent.length);
    const __persistTerminologyList = async () => {
      let savedToProject = false;
      try {
        if (AppState && AppState.project) {
          AppState.project.terminologyList = AppState.terminology.list;
        }

        if (
          typeof autoSaveManager !== "undefined" &&
          autoSaveManager &&
          typeof autoSaveManager.saveProject === "function"
        ) {
          await autoSaveManager.saveProject();
          savedToProject = true;
        }
      } catch (e) {
        (loggers.storage || console).error("保存术语到项目存储失败:", e);
      }

      if (!savedToProject) {
        try {
          if (
            AppState &&
            AppState.project &&
            typeof storageManager !== "undefined" &&
            storageManager &&
            typeof storageManager.saveCurrentProject === "function"
          ) {
            const fileMetadata =
              (AppState.project && AppState.project.fileMetadata) ||
              AppState.fileMetadata ||
              {};
            const safeFileMetadata = {};
            Object.keys(fileMetadata).forEach((fileName) => {
              const meta = fileMetadata[fileName] || {};
              const cloned = { ...meta };
              delete cloned.originalContent;
              safeFileMetadata[fileName] = cloned;
            });

            const payload = {
              ...AppState.project,
              translationItems:
                AppState.project.translationItems ||
                AppState.translations.items ||
                [],
              terminologyList: AppState.terminology.list,
              fileMetadata: safeFileMetadata,
            };

            await storageManager.saveCurrentProject(payload);
          }
        } catch (e) {
          (loggers.storage || console).error("保存术语到项目存储失败:", e);
        }
      }
    };

    const __nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => resolve()));
    let importedTerms = [];

    // 根据文件格式解析
    if (
      importFormat === "json" ||
      (importFormat === "auto" && file.name.endsWith(".json"))
    ) {
      const jsonData = JSON.parse(fileContent);
      if (Array.isArray(jsonData)) {
        importedTerms = jsonData
          .map((term, index) => ({
            id: Date.now() + index,
            source: term.source || term.term || term.key,
            target: term.target || term.translation || term.value,
            partOfSpeech: term.partOfSpeech || term.pos || "other",
            definition: term.definition || term.description || "",
          }))
          .filter((term) => term.source && term.target);
      }
    } else if (
      importFormat === "csv" ||
      (importFormat === "auto" && file.name.endsWith(".csv"))
    ) {
      const lines = fileContent.split("\n").filter((line) => line.trim());
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const term = {};

        headers.forEach((header, index) => {
          term[header] = values[index]?.trim() || "";
        });

        if (term.source && term.target) {
          importedTerms.push({
            id: Date.now() + i,
            source: term.source,
            target: term.target,
            partOfSpeech: term.partofspeech || term.pos || "other",
            definition: term.definition || term.description || "",
          });
        }
      }
    } else {
      throw new Error("不支持的文件格式");
    }

    (loggers.app || console).debug("成功解析术语数量:", importedTerms.length);

    if (importedTerms.length === 0) {
      throw new Error("文件中没有找到有效的术语数据");
    }

    // 更新进度
    importProgressBar.style.width = "50%";
    importPercentage.textContent = "50%";
    importStatus.textContent = `解析完成，准备导入 ${importedTerms.length} 个术语...`;

    (async () => {
      await __nextFrame();

      importProgressBar.style.width = "70%";
      importPercentage.textContent = "70%";
      importStatus.textContent = "写入术语数据...";

      if (overwrite) {
        AppState.terminology.list = importedTerms;
      } else {
        const existingSources = new Set(
          AppState.terminology.list.map((t) => t.source.toLowerCase())
        );
        const newTerms = importedTerms.filter(
          (t) => !existingSources.has(t.source.toLowerCase())
        );
        AppState.terminology.list = [...AppState.terminology.list, ...newTerms];
      }

      AppState.terminology.filtered = [...AppState.terminology.list];
      AppState.terminology.currentPage = 1;

      importProgressBar.style.width = "85%";
      importPercentage.textContent = "85%";
      importStatus.textContent = "保存到项目存储...";

      await __persistTerminologyList();

      importProgressBar.style.width = "95%";
      importPercentage.textContent = "95%";
      importStatus.textContent = "更新列表显示...";

      updateTerminologyList();

      await __nextFrame();
      importProgressBar.style.width = "100%";
      importPercentage.textContent = "100%";
      importStatus.textContent = "导入完成！";

      showNotification(
        "success",
        "导入成功",
        `成功导入 ${importedTerms.length} 个术语`
      );

      await __nextFrame();
      pendingImportFile = null;
      importProgress.classList.add("hidden");
      importTerminologyBtn.disabled = true;

      const importDropArea = DOMCache.get("importDropArea");
      if (importDropArea) {
        const icon = document.createElement("i");
        icon.className =
          "fa fa-cloud-upload text-3xl text-gray-400 dark:text-gray-500 mb-3";

        const p1 = document.createElement("p");
        p1.className = "text-sm text-gray-600 dark:text-gray-300 mb-1";
        p1.textContent = "拖拽文件到此处或点击选择文件";

        const p2 = document.createElement("p");
        p2.className = "text-xs text-gray-500 dark:text-gray-400 mb-3";
        p2.textContent = "支持 CSV、JSON、XLSX 格式";

        const btn = document.createElement("button");
        btn.id = "browseImportFileBtn";
        btn.className =
          "px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm";
        btn.textContent = "选择文件";

        importDropArea.replaceChildren(icon, p1, p2, btn);

        const input = DOMCache.get("importFileInput");
        if (input) {
          input.classList.add("hidden");
          importDropArea.appendChild(input);
          EventManager.add(btn, "click", () => input.click());
        }
      }
    })().catch((error) => {
      (loggers.app || console).error("导入失败:", error);
      showNotification(
        "error",
        "导入失败",
        `导入文件时出错: ${error.message}`
      );

      if (importProgress) {
        importProgress.classList.add("hidden");
      }
    });
  } catch (error) {
    (loggers.app || console).error("导入术语库时出错:", error);
    showNotification(
      "error",
      "导入失败",
      `导入过程中发生错误: ${error.message}`
    );
  }
}

// 处理导入拖放事件
function handleImportDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  setDropAreaActive(e.currentTarget, true);
}

function handleImportDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  setDropAreaActive(e.currentTarget, false);
}

function handleImportDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  setDropAreaActive(e.currentTarget, false);

  if (e.dataTransfer.files.length) {
    const importFileInput = DOMCache.get("importFileInput");
    if (importFileInput) {
      importFileInput.files = e.dataTransfer.files;
      handleImportFileSelect({ target: importFileInput });
    }
  }
}
