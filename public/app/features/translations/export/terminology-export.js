// 导出术语库
function exportTerminology() {
  const format = DOMCache.get("exportTerminologyFormat").value;
  const filter = DOMCache.get("exportFilter").value;
  const includeDefinition = DOMCache.get(
    "exportIncludeDefinition"
  ).checked;
  const includeMetadata = DOMCache.get(
    "exportIncludeMetadata"
  ).checked;

  // 根据筛选条件过滤术语
  let termsToExport = [...AppState.terminology.list];
  if (filter !== "all") {
    termsToExport = termsToExport.filter(
      (term) => term.partOfSpeech === filter
    );
  }

  if (termsToExport.length === 0) {
    showNotification("warning", "无数据导出", "没有找到符合筛选条件的术语");
    return;
  }

  // 生成导出内容
  let content = "";
  let filename = `术语库_${new Date().toISOString().split("T")[0]}`;

  switch (format) {
    case "csv":
      content = generateTerminologyCSV(
        termsToExport,
        includeDefinition,
        includeMetadata
      );
      filename += ".csv";
      break;
    case "json":
      content = generateTerminologyJSON(
        termsToExport,
        includeDefinition,
        includeMetadata
      );
      filename += ".json";
      break;
    case "xml":
      content = generateTerminologyXML(
        termsToExport,
        includeDefinition,
        includeMetadata
      );
      filename += ".xml";
      break;
    case "excel":
      // 使用SheetJS生成真正的Excel文件
      generateTerminologyExcel(
        termsToExport,
        includeDefinition,
        includeMetadata
      );
      showNotification(
        "success",
        "导出成功",
        `已导出 ${termsToExport.length} 个术语`
      );
      return; // Excel导出函数内部处理下载
  }

  // 下载文件
  downloadFile(content, filename);
  showNotification(
    "success",
    "导出成功",
    `已导出 ${termsToExport.length} 个术语`
  );
}

// 生成术语库CSV
function generateTerminologyCSV(terms, includeDefinition, includeMetadata) {
  let csv = "源术语,目标术语,词性";
  if (includeDefinition) csv += ",定义";
  if (includeMetadata) csv += ",创建时间";
  csv += "\n";

  terms.forEach((term) => {
    let row = `"${escapeCsv(term.source)}","${escapeCsv(
      term.target
    )}","${escapeCsv(getPartOfSpeechText(term.partOfSpeech))}"`;
    if (includeDefinition) row += `,"${escapeCsv(term.definition || "")}"`;
    if (includeMetadata) row += `,"${new Date().toISOString()}"`;
    csv += row + "\n";
  });

  return csv;
}

// 生成术语库JSON
function generateTerminologyJSON(terms, includeDefinition, includeMetadata) {
  const exportData = terms.map((term) => {
    const data = {
      source: term.source,
      target: term.target,
      partOfSpeech: term.partOfSpeech,
    };

    if (includeDefinition && term.definition) {
      data.definition = term.definition;
    }

    if (includeMetadata) {
      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
    }

    return data;
  });

  return JSON.stringify(exportData, null, 2);
}

// 生成术语库XML
function generateTerminologyXML(terms, includeDefinition, includeMetadata) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<terminology>\n";

  terms.forEach((term) => {
    xml += "  <term>\n";
    xml += `    <source>${escapeXml(term.source)}</source>\n`;
    xml += `    <target>${escapeXml(term.target)}</target>\n`;
    xml += `    <partOfSpeech>${escapeXml(term.partOfSpeech)}</partOfSpeech>\n`;

    if (includeDefinition && term.definition) {
      xml += `    <definition>${escapeXml(term.definition)}</definition>\n`;
    }

    if (includeMetadata) {
      xml += `    <createdAt>${new Date().toISOString()}</createdAt>\n`;
      xml += `    <updatedAt>${new Date().toISOString()}</updatedAt>\n`;
    }

    xml += "  </term>\n";
  });

  xml += "</terminology>";
  return xml;
}

// 生成术语库Excel（使用SheetJS）
function generateTerminologyExcel(terms, includeDefinition, includeMetadata) {
  // 检查SheetJS是否加载（未加载则按需加载）
  if (typeof XLSX === "undefined") {
    try {
      const App = window.App;
      const ensure = App?.services?.ensureSheetJs;
      if (typeof ensure === "function") {
        showNotification("info", "准备导出", "正在加载Excel导出组件...");
        ensure()
          .then(function () {
            try {
              generateTerminologyExcel(terms, includeDefinition, includeMetadata);
            } catch (e) {
              (loggers.app || console).error("generateTerminologyExcel (after load) failed:", e);
              showNotification(
                "error",
                "导出失败",
                e?.message || "Excel文件生成失败"
              );
            }
          })
          .catch(function (e) {
            (loggers.app || console).error("Failed to lazy-load SheetJS:", e);
            showNotification(
              "error",
              "导出失败",
              e?.message || "Excel库加载失败"
            );
          });
        return;
      }
    } catch (_) {
      (loggers.app || console).debug("terminology-export XLSX load:", _);
    }

    showNotification("error", "导出失败", "Excel库未加载，请刷新页面重试");
    return;
  }

  // 准备表格数据
  const data = [];

  // 添加表头
  const headers = ["源术语", "目标术语", "词性"];
  if (includeDefinition) headers.push("定义");
  if (includeMetadata) {
    headers.push("创建时间");
    headers.push("更新时间");
  }
  data.push(headers);

  // 添加数据行
  terms.forEach((term) => {
    const row = [
      term.source || "",
      term.target || "",
      getPartOfSpeechText(term.partOfSpeech) || "",
    ];

    if (includeDefinition) {
      row.push(term.definition || "");
    }

    if (includeMetadata) {
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      row.push(now);
      row.push(now);
    }

    data.push(row);
  });

  // 创建工作簿
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 设置列宽
  const colWidths = [
    { wch: 25 }, // 源术语
    { wch: 25 }, // 目标术语
    { wch: 12 }, // 词性
  ];
  if (includeDefinition) colWidths.push({ wch: 40 }); // 定义
  if (includeMetadata) {
    colWidths.push({ wch: 20 }); // 创建时间
    colWidths.push({ wch: 20 }); // 更新时间
  }
  ws["!cols"] = colWidths;

  // 设置表头样式（粗体）
  const headerRange = XLSX.utils.decode_range(ws["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    // 设置单元格样式（SheetJS Pro特性，免费版可能不生效，但不会报错）
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E0E0E0" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "术语库");

  // 设置工作簿属性
  wb.Props = {
    Title: "术语库",
    Subject: "智能翻译工具术语库",
    Author: "智能翻译工具",
    CreatedDate: new Date(),
  };

  // 生成文件名
  const filename = `术语库_${new Date().toISOString().split("T")[0]}.xlsx`;

  // 导出文件
  try {
    XLSX.writeFile(wb, filename);
  } catch (error) {
    (loggers.app || console).error("Excel导出失败:", error);
    showNotification("error", "导出失败", error.message || "Excel文件生成失败");
  }
}
