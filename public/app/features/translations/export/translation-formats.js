// 生成XML格式
function generateXML(items, includeOriginal) {
  console.log("=== 开始生成XML ===");
  console.log("翻译项数量:", items.length);

  // 尝试查找原始文件内容
  const firstItem = items[0];
  const fileName = firstItem?.metadata?.file;

  console.log("文件名:", fileName);

  // 打印前几个翻译项的示例
  if (items.length > 0) {
    console.log("翻译项示例 (前3个):");
    items.slice(0, 3).forEach((item, i) => {
      console.log(`  [${i}] 原文: "${item.sourceText?.substring(0, 50)}..."`);
      console.log(`      译文: "${item.targetText?.substring(0, 50)}..."`);
      console.log(`      ID: ${item.id}, 状态: ${item.status}`);
    });
  }

  // 如果有原始文件内容，就在原文件基础上替换翻译
  if (fileName && AppState.fileMetadata[fileName]?.originalContent) {
    console.log("找到原始文件内容，使用替换模式");
    const originalContent = AppState.fileMetadata[fileName].originalContent;
    const extension = AppState.fileMetadata[fileName].extension;

    console.log("文件扩展名:", extension);
    console.log("原始内容长度:", originalContent.length);

    // 根据不同格式处理
    if (extension === "xml") {
      if (
        originalContent.includes("<resources") &&
        originalContent.includes("<string name=")
      ) {
        console.log("检测到Android strings.xml格式");
        return generateAndroidStringsXML(items, originalContent);
      }
    }

    // 通用XML替换
    console.log("使用通用XML替换");
    return replaceXMLContent(items, originalContent);
  }

  // 如果没有原始文件，但看起来是Android strings.xml，则生成resources格式
  if (looksLikeAndroidStringsItems(items)) {
    console.log(
      "未找到原始文件内容，但检测到Android strings.xml项目，使用生成resources模式"
    );
    return generateAndroidStringsXMLFromItems(items, includeOriginal);
  }

  // 如果没有原始文件，生成通用格式
  console.log("没有原始文件，生成通用XML格式");
  return generateGenericXML(items, includeOriginal);
}

function looksLikeAndroidStringsItems(items) {
  return (
    Array.isArray(items) &&
    items.some((item) => {
      const context = item?.context || "";
      return (
        typeof context === "string" &&
        context.includes("Android string resource:")
      );
    })
  );
}

// 生成通用XML格式（旧的逻辑）
function generateGenericXML(items, includeOriginal) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<translations>\n";

  items.forEach((item, index) => {
    xml += "  <translation";
    if (item.id) {
      xml += ` id="${escapeXml(item.id)}"`;
    }
    xml += ">\n";

    if (includeOriginal && item.sourceText) {
      xml += `    <source>${escapeXml(item.sourceText)}</source>\n`;
    }

    if (item.targetText) {
      xml += `    <target>${escapeXml(item.targetText)}</target>\n`;
    }

    if (item.context) {
      xml += `    <context>${escapeXml(item.context)}</context>\n`;
    }

    if (item.status) {
      xml += `    <status>${escapeXml(item.status)}</status>\n`;
    }

    xml += "  </translation>\n";
  });

  xml += "</translations>";
  return xml;
}

// 替换XML内容（通用方法）
function replaceXMLContent(items, originalContent) {
  console.log("开始替换XML内容, 翻译项数量:", items.length);

  // 使用DOM解析更准确地替换
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");

    // 检查解析错误
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.warn("XML解析失败，使用文本替换");
      return replaceXMLContentByText(items, originalContent);
    }

    // 遍历所有文本节点
    const walker = document.createTreeWalker(
      xmlDoc.documentElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    const replacements = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        // 查找匹配的翻译项
        const item = items.find((item) => item.sourceText?.trim() === text);
        if (item && item.targetText) {
          replacements.push({
            node: node,
            sourceText: text,
            targetText: item.targetText,
            originalContent: node.textContent,
          });
        }
      }
    }

    console.log(`找到 ${replacements.length} 个匹配的文本节点`);

    // 执行替换
    replacements.forEach(
      ({ node, targetText, originalContent, sourceText }) => {
        // 保持原有的空白字符
        const leadingSpace = originalContent.match(/^\s*/)[0];
        const trailingSpace = originalContent.match(/\s*$/)[0];
        node.textContent = leadingSpace + targetText + trailingSpace;
        console.log(`替换: "${sourceText}" -> "${targetText}"`);
      }
    );

    // 序列化回字符串
    const serializer = new XMLSerializer();
    const result = serializer.serializeToString(xmlDoc);

    console.log("替换完成");
    return result;
  } catch (error) {
    console.error("DOM替换失败:", error);
    return replaceXMLContentByText(items, originalContent);
  }
}

// 文本替换方式（备用）
function replaceXMLContentByText(items, originalContent) {
  console.log("使用文本替换方式, 翻译项数量:", items.length);
  let result = originalContent;
  let replacedCount = 0;

  // 按照文本长度排序，从长到短，避免短文本被误替换
  const sortedItems = [...items].sort(
    (a, b) => (b.sourceText?.length || 0) - (a.sourceText?.length || 0)
  );

  sortedItems.forEach((item) => {
    if (item.sourceText && item.targetText) {
      // 转义特殊字符用于正则表达式
      const escapedSource = item.sourceText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // 替换标签内的文本
      const regex = new RegExp(`>([^<]*${escapedSource}[^<]*)<`, "g");
      const before = result;

      result = result.replace(regex, (match, p1) => {
        if (p1.trim() === item.sourceText.trim()) {
          console.log(
            `文本替换: "${item.sourceText.substring(
              0,
              50
            )}..." -> "${item.targetText.substring(0, 50)}..."`
          );
          replacedCount++;
          return `>${item.targetText}<`;
        }
        return match;
      });
    }
  });

  console.log(`文本替换完成, 共替换 ${replacedCount} 个项`);
  return result;
}

function generateAndroidStringsXMLFromItems(items, includeOriginal) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<resources>\n";

  items.forEach((item) => {
    const resourceId = item?.metadata?.resourceId;
    if (!resourceId) return;

    const hasTarget = item?.targetText && item.targetText.trim() !== "";
    const value = hasTarget
      ? item.targetText
      : includeOriginal
      ? item?.sourceText || ""
      : "";

    xml += `    <string name="${escapeXml(String(resourceId))}">${escapeXml(
      String(value)
    )}</string>\n`;
  });

  xml += "</resources>\n";
  return xml;
}

// 生成Android strings.xml格式
function generateAndroidStringsXML(items, originalContent) {
  console.log("处理Android strings.xml, 翻译项数量:", items.length);
  let result = originalContent;
  let replacedCount = 0;

  items.forEach((item) => {
    if (item.targetText && item.targetText.trim() !== "") {
      // 获取原始的resourceId（name属性值）
      const resourceId = item.metadata?.resourceId;
      if (!resourceId) {
        console.warn(`跳过无resourceId的项: ${item.id}`);
        return;
      }

      // 转义特殊字符
      const escapedId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // 匹配 <string name="id">原文</string> 格式
      const regex = new RegExp(
        `(<string[^>]*name="${escapedId}"[^>]*>)([^<]*)(</string>)`,
        "g"
      );

      const before = result;
      result = result.replace(regex, (match, opening, content, closing) => {
        console.log(
          `✓ 替换Android资源: name="${resourceId}" -> "${item.targetText.substring(
            0,
            30
          )}..."`
        );
        replacedCount++;
        return `${opening}${escapeXml(item.targetText)}${closing}`;
      });

      if (result === before) {
        console.warn(`✗ 未找到匹配: name="${resourceId}"`);
      }
    }
  });

  console.log(`Android strings.xml 替换完成, 共替换 ${replacedCount} 个项`);
  return result;
}

// 生成JSON格式
function generateJSON(items, includeOriginal) {
  const data = items.map((item, index) => {
    const obj = {};

    if (item.id) {
      obj.id = item.id;
    }

    if (includeOriginal && item.sourceText) {
      obj.source = item.sourceText;
    }

    if (item.targetText) {
      obj.target = item.targetText;
    }

    if (item.context) {
      obj.context = item.context;
    }

    if (item.status) {
      obj.status = item.status;
    }

    return obj;
  });

  return JSON.stringify(data, null, 2);
}

// 生成CSV格式
function generateCSV(items, includeOriginal) {
  let csv = "";

  // 添加表头
  if (includeOriginal) {
    csv = "ID,Source,Target,Context,Status\n";
  } else {
    csv = "ID,Target,Context,Status\n";
  }

  items.forEach((item, index) => {
    const row = [];

    // ID
    row.push(`"${escapeCsv(item.id || `item-${index + 1}`)}"`);

    // Source (如果包含原文)
    if (includeOriginal) {
      row.push(`"${escapeCsv(item.sourceText || "")}"`);
    }

    // Target
    row.push(`"${escapeCsv(item.targetText || "")}"`);

    // Context
    row.push(`"${escapeCsv(item.context || "")}"`);

    // Status
    row.push(`"${escapeCsv(item.status || "untranslated")}"`);

    csv += row.join(",") + "\n";
  });

  return csv;
}

// 生成XLIFF格式
function generateXLIFF(items, includeOriginal) {
  // 尝试查找原始文件内容
  const firstItem = items[0];
  const fileName = firstItem?.metadata?.file;

  // 如果有原始 XLIFF 文件，就更新它
  if (
    fileName &&
    AppState.fileMetadata[fileName]?.originalContent &&
    (AppState.fileMetadata[fileName].extension === "xliff" ||
      AppState.fileMetadata[fileName].extension === "xlf")
  ) {
    return updateXLIFFContent(
      items,
      AppState.fileMetadata[fileName].originalContent
    );
  }

  // 否则生成新的 XLIFF
  return generateNewXLIFF(items);
}

// 更新原始 XLIFF 内容
function updateXLIFFContent(items, originalContent) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");

    // 查找所有 trans-unit 元素
    const transUnits = xmlDoc.querySelectorAll("trans-unit");

    transUnits.forEach((transUnit) => {
      const source = transUnit.querySelector("source");
      if (!source) return;

      const sourceText = source.textContent?.trim();

      // 查找匹配的翻译项
      const item = items.find((item) => item.sourceText?.trim() === sourceText);

      if (item && item.targetText) {
        // 更新或创建 target 元素
        let target = transUnit.querySelector("target");
        if (!target) {
          target = xmlDoc.createElement("target");
          source.parentNode.insertBefore(target, source.nextSibling);
        }

        target.textContent = item.targetText;

        // 设置状态
        if (
          item.status === "translated" ||
          item.status === "edited" ||
          item.status === "approved"
        ) {
          target.setAttribute("state", "translated");
        }

        if (item.status === "approved") {
          transUnit.setAttribute("approved", "yes");
        }
      }
    });

    // 序列化回字符串
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  } catch (error) {
    console.error("更新XLIFF失败:", error);
    return generateNewXLIFF(items);
  }
}

// 生成新的 XLIFF
function generateNewXLIFF(items) {
  const sourceLang =
    AppState.project?.sourceLanguage ||
    document.getElementById("sourceLanguage")?.value ||
    "en";
  const targetLang =
    AppState.project?.targetLanguage ||
    document.getElementById("targetLanguage")?.value ||
    "zh";

  let xliff = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xliff +=
    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n';
  xliff += `  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">\n`;
  xliff += "    <body>\n";

  items.forEach((item, index) => {
    const transUnitId = item.id || `trans-${index + 1}`;
    xliff += `      <trans-unit id="${escapeXml(transUnitId)}"`;

    // 添加状态属性
    if (item.status === "approved") {
      xliff += ` approved="yes"`;
    }

    xliff += ">\n";

    // Source
    if (item.sourceText) {
      xliff += `        <source>${escapeXml(item.sourceText)}</source>\n`;
    }

    // Target
    if (item.targetText) {
      const state =
        item.status === "translated" ||
        item.status === "edited" ||
        item.status === "approved"
          ? "translated"
          : "needs-translation";
      xliff += `        <target state="${state}">${escapeXml(
        item.targetText
      )}</target>\n`;
    }

    // Context
    if (item.context) {
      xliff += `        <note>${escapeXml(item.context)}</note>\n`;
    }

    xliff += "      </trans-unit>\n";
  });

  xliff += "    </body>\n";
  xliff += "  </file>\n";
  xliff += "</xliff>";
  return xliff;
}
