async function exportTranslation() {
  // 检查是否有翻译项
  if (
    !AppState.translations.items ||
    AppState.translations.items.length === 0
  ) {
    showNotification(
      "warning",
      "无翻译项",
      "没有可导出的翻译内容，请先上传文件"
    );
    return;
  }

  const format = document.getElementById("exportFormat").value;
  // 使用单选按钮，检查哪个选项被选中
  const onlyTranslated = document.getElementById(
    "exportOnlyTranslated"
  ).checked;
  const includeOriginal = document.getElementById(
    "exportIncludeOriginal"
  ).checked;

  console.log("导出前总翻译项数量:", AppState.translations.items.length);
  console.log("仅导出已翻译项选项:", onlyTranslated);
  console.log("包含原文选项:", includeOriginal);

  // 过滤翻译项
  let itemsToExport = [...AppState.translations.items];

  // 如果选择了“仅导出已翻译项”，则过滤掉未翻译的项
  if (onlyTranslated) {
    const beforeFilter = itemsToExport.length;

    console.log("=== 开始过滤，仅导出已翻译项 ===");
    console.log("过滤前项数:", beforeFilter);

    // 打印前5个项的状态
    console.log("前5个项的状态:");
    itemsToExport.slice(0, 5).forEach((item, idx) => {
      console.log(
        `  [${idx}] status="${item.status}", hasTarget=${!!(
          item.targetText && item.targetText.trim()
        )}, text="${item.sourceText?.substring(0, 30)}..."`
      );
    });

    itemsToExport = itemsToExport.filter((item) => {
      const hasTranslation = item.targetText && item.targetText.trim() !== "";
      const isTranslated =
        item.status === "translated" ||
        item.status === "edited" ||
        item.status === "approved";
      const pass = hasTranslation && isTranslated;

      // 记录被过滤掉的项（仅前3个）
      if (!pass && itemsToExport.indexOf(item) < 3) {
        console.log(
          `  ✗ 过滤掉: status="${
            item.status
          }", hasTranslation=${hasTranslation}, text="${item.sourceText?.substring(
            0,
            30
          )}..."`
        );
      }

      return pass;
    });

    console.log(`过滤后: ${beforeFilter} -> ${itemsToExport.length} 项`);
    console.log("=== 过滤完成 ===");
  }

  if (itemsToExport.length === 0) {
    showNotification(
      "warning",
      "无可导出项",
      "没有符合条件的翻译项，请先完成翻译"
    );
    return;
  }

  if (format === "original") {
    try {
      const filesMap = new Map();
      itemsToExport.forEach((item) => {
        const fileName = item?.metadata?.file || "unknown";
        if (!filesMap.has(fileName)) filesMap.set(fileName, []);
        filesMap.get(fileName).push(item);
      });

      if (filesMap.size === 0) {
        showNotification("warning", "无可导出文件", "没有找到可导出的文件信息");
        return;
      }

      let exportedCount = 0;
      let failedCount = 0;
      const missingOriginalFiles = [];

      for (const [fileName, fileItems] of filesMap.entries()) {
        if (fileName && fileName !== "unknown") {
          await ensureOriginalContentLoadedForFile(fileName);
        }

        const meta = AppState.fileMetadata?.[fileName] || {};
        const hasOriginal = !!(
          meta.originalContent && typeof meta.originalContent === "string"
        );
        if (fileName && fileName !== "unknown" && !hasOriginal) {
          missingOriginalFiles.push(fileName);
        }

        const exportResult = generateOriginalFormatExport(fileName, fileItems);
        if (!exportResult) {
          failedCount++;
          continue;
        }

        downloadFile(exportResult.content, exportResult.filename);
        exportedCount++;
      }

      closeModal("exportModal");

      if (
        missingOriginalFiles.length > 0 &&
        typeof showNotification === "function"
      ) {
        const preview = missingOriginalFiles.slice(0, 3).join(", ");
        const more =
          missingOriginalFiles.length > 3
            ? ` 等 ${missingOriginalFiles.length} 个文件`
            : "";
        showNotification(
          "warning",
          "原格式导出受限",
          `部分文件缺少原始内容，将使用通用导出：${preview}${more}`
        );
      }

      const optionText = onlyTranslated ? "仅已翻译项" : "包含原文";
      if (failedCount > 0) {
        showNotification(
          "warning",
          "导出完成",
          `成功导出 ${exportedCount} 个文件，失败 ${failedCount} 个（${optionText}）`
        );
      } else {
        showNotification(
          "success",
          "导出成功",
          `已成功按原格式导出 ${exportedCount} 个文件（${optionText}）`
        );
      }
    } catch (error) {
      console.error("导出错误:", error);
      showNotification(
        "error",
        "导出失败",
        `导出过程中出现错误: ${error.message}`
      );
    }

    return;
  }

  if (format === "xml" || format === "xliff" || format === "json") {
    const firstFileName = itemsToExport?.[0]?.metadata?.file;
    if (firstFileName) {
      await ensureOriginalContentLoadedForFile(firstFileName);

      const meta = AppState.fileMetadata?.[firstFileName] || {};
      if (!meta.originalContent && typeof showNotification === "function") {
        showNotification(
          "warning",
          "通用导出",
          "未找到原始文件内容，将使用通用导出生成结果（可能无法完全保持原格式）。"
        );
      }
    }
  }

  // 生成导出内容
  let content = "";
  const projectName = AppState.project?.name || "translation";
  let filename = `${projectName}_${format}_${new Date().getTime()}.${format}`;

  try {
    if (format === "xml") {
      content = generateXML(itemsToExport, includeOriginal);
    } else if (format === "json") {
      content = generateJSON(itemsToExport, includeOriginal);
    } else if (format === "xliff") {
      content = generateXLIFF(itemsToExport, includeOriginal);
    } else if (format === "csv") {
      content = generateCSV(itemsToExport, includeOriginal);
    }

    // 创建下载链接
    downloadFile(content, filename);

    // 隐藏模态框
    closeModal("exportModal");

    // 显示通知
    const optionText = onlyTranslated ? "仅已翻译项" : "包含原文";
    showNotification(
      "success",
      "导出成功",
      `已成功导出 ${
        itemsToExport.length
      } 项翻译为 ${format.toUpperCase()} 格式（${optionText}）`
    );
  } catch (error) {
    console.error("导出错误:", error);
    showNotification(
      "error",
      "导出失败",
      `导出过程中出现错误: ${error.message}`
    );
  }
}
