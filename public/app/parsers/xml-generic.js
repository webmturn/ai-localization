// ==================== XML 解析功能（优化版） ====================
// 说明：
// - 优先使用 DOMParser + TreeWalker 提取文本节点，构造可读路径用于定位
// - 跳过 <script>/<style> 内的文本，避免把代码/样式当作可翻译内容
// - DOM 解析失败或未找到文本时，回退到正则/CDATA 兜底解析

// 解析通用XML文件（使用 TreeWalker 优化）
function parseGenericXML(content, fileName) {
  const items = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "application/xml");

    // 检查是否有解析错误
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.warn("XML解析出错，尝试使用备用方法:", parserError.textContent);
      return parseXMLWithRegex(content, fileName);
    }

    // 使用 TreeWalker 遍历所有文本节点（比递归更高效）
    const walker = document.createTreeWalker(
      xmlDoc.documentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parentName =
            node?.parentElement?.nodeName?.toLowerCase?.() || "";
          if (parentName === "script" || parentName === "style") {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent?.trim() || "";
          // 过滤空白和过短的文本
          return text.length > 1
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    let node;
    let index = 0;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();

      // 获取父节点路径
      let path = "";
      let current = node.parentElement;
      const pathParts = [];

      while (current && current !== xmlDoc.documentElement) {
        const nameAttr =
          current.getAttribute?.("name") ||
          current.getAttribute?.("id") ||
          current.getAttribute?.("key") ||
          current.getAttribute?.("resourceId") ||
          current.getAttribute?.("resname") ||
          "";
        pathParts.unshift(
          nameAttr
            ? `${current.nodeName}[@name=\"${nameAttr}\"]`
            : current.nodeName
        );
        current = current.parentElement;
      }

      if (pathParts.length > 0) {
        path = "/" + pathParts.join("/");
      }

      items.push({
        id: `xml-${++index}`,
        sourceText: text,
        targetText: "",
        context: `From ${fileName}${path}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          path: path,
          position: `node-${index}`,
        },
      });
    }

    // 如果没有找到任何文本节点，尝试使用正则表达式
    if (items.length === 0) {
      console.warn("DOM解析未找到文本节点，尝试使用正则表达式");
      return parseXMLWithRegex(content, fileName);
    }

    return items;
  } catch (error) {
    console.error("解析XML文件时出错:", error);
    return parseXMLWithRegex(content, fileName);
  }
}

// 使用正则表达式解析XML（备用方法）
function parseXMLWithRegex(content, fileName) {
  const items = [];

  try {
    // 移除XML注释
    let cleanContent = content.replace(/<!--[\s\S]*?-->/g, "");

    // 尝试提取标签之间的文本
    const textRegex = new RegExp(">([^<]+)</", "g");
    let match;
    let textIndex = 1;

    while ((match = textRegex.exec(cleanContent)) !== null) {
      const text = match[1].trim();
      // 只保留有意义的文本（长度大于1且不全是空白字符）
      if (text.length > 1 && !/^\s*$/.test(text)) {
        items.push({
          id: `xml-regex-${textIndex}`,
          sourceText: text,
          targetText: "",
          context: `From ${fileName} (text node ${textIndex})`,
          status: "pending",
          qualityScore: 0,
          issues: [],
          metadata: {
            file: fileName,
            position: `text-${textIndex}`,
          },
        });
        textIndex++;
      }
    }

    // 如果还是没有找到文本，尝试提取CDATA内容
    if (items.length === 0) {
      const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
      let cdataMatch;
      let cdataIndex = 1;

      while ((cdataMatch = cdataRegex.exec(content)) !== null) {
        const cdataText = cdataMatch[1].trim();
        if (cdataText.length > 0) {
          items.push({
            id: `xml-cdata-${cdataIndex}`,
            sourceText: cdataText,
            targetText: "",
            context: `From ${fileName} (CDATA ${cdataIndex})`,
            status: "pending",
            qualityScore: 0,
            issues: [],
            metadata: {
              file: fileName,
              position: `cdata-${cdataIndex}`,
            },
          });
          cdataIndex++;
        }
      }
    }

    // 如果仍然没有找到文本，添加整个文件内容作为一个翻译项
    if (items.length === 0) {
      const fileText =
        content.substring(0, 1000) + (content.length > 1000 ? "..." : "");
      items.push({
        id: `xml-file-1`,
        sourceText: fileText,
        targetText: "",
        context: `Entire file content from ${fileName}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          position: "entire-file",
        },
      });
    }

    return items;
  } catch (error) {
    console.error("使用正则表达式解析XML时出错:", error);
    // 返回一个包含错误信息的翻译项
    return [
      {
        id: "xml-error-1",
        sourceText: `无法解析XML文件: ${fileName}`,
        targetText: "",
        context: "解析错误",
        status: "pending",
        qualityScore: 0,
        issues: ["XML_PARSE_ERROR"],
        metadata: {
          file: fileName,
          position: "error",
        },
      },
    ];
  }
}
