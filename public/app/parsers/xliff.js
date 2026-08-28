// 解析 XLIFF 文件。
// 支持：
// - XLIFF 1.2：<trans-unit>
// - XLIFF 2.0：<unit>/<segment>
// 说明：
// - 为保留内联标记（如 <g>、<x/> 等），source/target 使用 XMLSerializer 序列化子节点
// 输出：metadata.unitId 用于定位单元。
function parseXLIFF(content, fileName) {
  const items = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "application/xml");

  // 检查解析错误
  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`XLIFF解析错误 (${fileName}): ` + parserError.textContent);
  }

  const serializer = new XMLSerializer();
  function serializeChildren(element) {
    if (!element) return "";
    let out = "";
    const nodes = element.childNodes || [];
    for (let i = 0; i < nodes.length; i++) {
      out += serializer.serializeToString(nodes[i]);
    }
    // 清洗序列化时注入的命名空间声明（如 <g xmlns="urn:oasis:...">），
    // 保证源文本与原文标记一致，占位符保护可正确匹配
    out = out.replace(/\sxmlns(?:="[^"]*"|:[\w-]+="[^"]*")/g, "");
    return (out || element.textContent || "").trim();
  }

  // 查找所有trans-unit元素
  const transUnits = xmlDoc.getElementsByTagNameNS("*", "trans-unit");
  if (transUnits && transUnits.length > 0) {
    for (let i = 0; i < transUnits.length; i++) {
      const unit = transUnits[i];
      const id = unit.getAttribute("id") || `unit-${i + 1}`;

      const sourceElement = unit.getElementsByTagNameNS("*", "source")[0];
      const targetElement = unit.getElementsByTagNameNS("*", "target")[0];

      const sourceText = serializeChildren(sourceElement);
      const targetText = serializeChildren(targetElement);

      if (sourceText) {
        items.push({
          id: `xliff-${i + 1}`,
          sourceText: sourceText,
          targetText: targetText,
          context: `XLIFF unit: ${id}`,
          status: targetText ? "translated" : "pending",
          qualityScore: targetText ? 85 : 0,
          issues: [],
          metadata: {
            file: fileName,
            unitId: id,
            position: `unit-${i + 1}`,
          },
        });
      }
    }
    return items;
  }

  const units = xmlDoc.getElementsByTagNameNS("*", "unit");
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitId = unit.getAttribute("id") || `unit-${i + 1}`;
    const segments = unit.getElementsByTagNameNS("*", "segment");
    if (segments && segments.length > 0) {
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        const sourceElement = seg.getElementsByTagNameNS("*", "source")[0];
        const targetElement = seg.getElementsByTagNameNS("*", "target")[0];
        const sourceText = serializeChildren(sourceElement);
        const targetText = serializeChildren(targetElement);
        if (!sourceText) continue;

        items.push({
          id: `xliff-${items.length + 1}`,
          sourceText: sourceText,
          targetText: targetText,
          context: `XLIFF unit: ${unitId}`,
          status: targetText ? "translated" : "pending",
          qualityScore: targetText ? 85 : 0,
          issues: [],
          metadata: {
            file: fileName,
            unitId: unitId,
            position: `unit-${i + 1}-segment-${s + 1}`,
          },
        });
      }
    } else {
      const sourceElement = unit.getElementsByTagNameNS("*", "source")[0];
      const targetElement = unit.getElementsByTagNameNS("*", "target")[0];
      const sourceText = serializeChildren(sourceElement);
      const targetText = serializeChildren(targetElement);
      if (!sourceText) continue;
      items.push({
        id: `xliff-${items.length + 1}`,
        sourceText: sourceText,
        targetText: targetText,
        context: `XLIFF unit: ${unitId}`,
        status: targetText ? "translated" : "pending",
        qualityScore: targetText ? 85 : 0,
        issues: [],
        metadata: {
          file: fileName,
          unitId: unitId,
          position: `unit-${i + 1}`,
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
    id: "xliff",
    label: "XLIFF",
    extensions: ["xliff", "xlf"],
    detectXml: (doc) =>
      ParserRegistry.rootName(doc) === "xliff" ||
      ParserRegistry.rootNamespace(doc).indexOf("xliff") !== -1 ||
      (ParserRegistry.hasTag(doc, "trans-unit") && ParserRegistry.hasTag(doc, "source")) ||
      (ParserRegistry.hasTag(doc, "unit") && ParserRegistry.hasTag(doc, "segment") && ParserRegistry.hasTag(doc, "source")),
    validateSchema: (doc) => {
      const ok =
        (ParserRegistry.hasTag(doc, "trans-unit") && ParserRegistry.hasTag(doc, "source")) ||
        (ParserRegistry.hasTag(doc, "unit") && ParserRegistry.hasTag(doc, "segment") && ParserRegistry.hasTag(doc, "source"));
      return ok
        ? { ok: true }
        : { ok: false, reason: "缺少 trans-unit/source 或 unit/segment/source" };
    },
    parse: parseXLIFF,
  });
}
