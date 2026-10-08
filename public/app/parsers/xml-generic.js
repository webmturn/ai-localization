// ==================== XML 解析功能（优化版） ====================
// 说明：
// - 提取文本、CDATA 及常见可翻译属性，按节点路径定位并支持单字符
// - 跳过 <script>/<style> 内的文本，避免把代码/样式当作可翻译内容
// - 非法 XML 明确失败；空文档不把 XML 结构作为翻译条目

// 解析通用XML文件（使用 TreeWalker 优化）
function parseGenericXML(content, fileName) {
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML 解析错误：' + doc.querySelector('parsererror').textContent);
  const items = [];
  const add = (value, node, attribute) => {
    const sourceText = value.trim();
    if (!sourceText) return;
    const nodePath = [];
    let current = node;
    while (current !== doc.documentElement && current.parentNode) {
      nodePath.unshift([...current.parentNode.childNodes].indexOf(current));
      current = current.parentNode;
    }
    const element = attribute ? node : node.parentElement;
    const names = [];
    for (let el = element; el; el = el.parentElement) {
      const key = el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('key');
      names.unshift(el.nodeName + (key ? '[' + key + ']' : ''));
    }
    const path = '/' + names.join('/') + (attribute ? '/@' + attribute : '');
    items.push({ id: 'xml-' + (items.length + 1), sourceText, targetText: '',
      context: 'XML: ' + path, status: 'pending', qualityScore: 0, issues: [],
      metadata: { file: fileName, path, xmlNodePath: nodePath, xmlAttribute: attribute || undefined,
        identity: JSON.stringify(['xml', nodePath, attribute || null]), position: 'node-' + (items.length + 1) } });
  };
  const visit = element => {
    if (['script', 'style'].includes((element.localName || '').toLowerCase())) return;
    for (const name of ['title', 'label', 'placeholder', 'alt', 'tooltip', 'description', 'aria-label']) {
      if (element.hasAttribute(name)) add(element.getAttribute(name), element, name);
    }
    for (const node of element.childNodes) {
      if (node.nodeType === 1) visit(node);
      else if (node.nodeType === 3 || node.nodeType === 4) add(node.nodeValue || '', node);
    }
  };
  visit(doc.documentElement);
  return items;
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
    (loggers.app || console).error("使用正则表达式解析XML时出错:", error);
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
