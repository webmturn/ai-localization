// 解析 RESX 文件。
// - 提取 <data name="..."> 下的 <value> 文本作为源文本
// - <value> 缺失或为空时，回退使用 name 作为源文本（避免丢项）
// - 若存在 <comment>，写入 metadata.comment 作为辅助信息
function parseRESX(content, fileName) {
  const items = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "application/xml");

  // 检查解析错误
  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`RESX解析错误 (${fileName}): ` + parserError.textContent);
  }

  // 查找所有data元素
  const dataElements = xmlDoc.getElementsByTagName("data");
  for (let i = 0; i < dataElements.length; i++) {
    const data = dataElements[i];
    const name = data.getAttribute("name");

    // 查找value子元素
    const valueElement = data.getElementsByTagName("value")[0];
    const valueText = valueElement ? valueElement.textContent : "";

    const commentElement = data.getElementsByTagName("comment")[0];
    const commentText = commentElement ? commentElement.textContent : "";

    if (name) {
      const sourceText = valueText && valueText.trim() ? valueText : name;
      items.push({
        id: `resx-${i + 1}`,
        sourceText: sourceText,
        targetText: "",
        context: `RESX resource: ${name}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          resourceId: name,
          comment: commentText || undefined,
          position: `item-${i + 1}`,
        },
      });
    }
  }

  return items;
}

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "resx",
    label: "RESX",
    extensions: ["resx"],
    detectXml: (doc) =>
      ParserRegistry.rootName(doc) === "root" &&
      ParserRegistry.hasTag(doc, "data") &&
      ParserRegistry.hasTag(doc, "value"),
    validateSchema: (doc) => {
      if (ParserRegistry.rootName(doc) !== "root") {
        return { ok: false, reason: "root 不是 <root>" };
      }
      if (!(ParserRegistry.hasTag(doc, "data") && ParserRegistry.hasTag(doc, "value"))) {
        return { ok: false, reason: "缺少 data/value" };
      }
      return { ok: true };
    },
    parse: parseRESX,
  });
}
