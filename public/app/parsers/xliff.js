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
    return (out || element.textContent || "").trim();
  }

  // 查找所有trans-unit元素
  const transUnits = xmlDoc.getElementsByTagName("trans-unit");
  if (transUnits && transUnits.length > 0) {
    for (let i = 0; i < transUnits.length; i++) {
      const unit = transUnits[i];
      const id = unit.getAttribute("id") || `unit-${i + 1}`;

      const sourceElement = unit.getElementsByTagName("source")[0];
      const targetElement = unit.getElementsByTagName("target")[0];

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

  const units = xmlDoc.getElementsByTagName("unit");
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitId = unit.getAttribute("id") || `unit-${i + 1}`;
    const segments = unit.getElementsByTagName("segment");
    if (segments && segments.length > 0) {
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        const sourceElement = seg.getElementsByTagName("source")[0];
        const targetElement = seg.getElementsByTagName("target")[0];
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
      const sourceElement = unit.getElementsByTagName("source")[0];
      const targetElement = unit.getElementsByTagName("target")[0];
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
