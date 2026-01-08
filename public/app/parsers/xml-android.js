// 解析 Android strings.xml 文件。
// 支持：
// - <string>
// - <string-array>/<item>
// - <plurals>/<item quantity="...">
// 规则：
// - translatable="false" 的资源会被跳过
// - 为保留内联标记/占位符，字符串值使用 XMLSerializer 序列化子节点
// 输出：metadata.resourceId=资源 name（数组/复数会带下标/quantity）。

function parseAndroidStrings(content, fileName) {
  const items = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "application/xml");

  // 检查解析错误
  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`XML解析错误 (${fileName}): ` + parserError.textContent);
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

  function isTranslatable(element) {
    const attr = element ? element.getAttribute("translatable") : null;
    if (attr === null || attr === undefined) return true;
    const v = String(attr).toLowerCase();
    return !(v === "false" || v === "0");
  }

  // 查找所有<string>元素
  const stringElements = xmlDoc.getElementsByTagName("string");
  for (let i = 0; i < stringElements.length; i++) {
    const element = stringElements[i];
    if (!isTranslatable(element)) continue;
    const name = element.getAttribute("name");
    const text = serializeChildren(element);

    if (name) {
      const sourceText = text && text.trim() ? text : name;
      items.push({
        id: `android-${i + 1}`,
        sourceText: sourceText,
        targetText: "",
        context: `Android string resource: ${name}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          resourceId: name,
          position: `line-${i + 1}`,
        },
      });
    }
  }

  // 查找所有<string-array>元素
  const arrayElements = xmlDoc.getElementsByTagName("string-array");
  for (let i = 0; i < arrayElements.length; i++) {
    const arrayName = arrayElements[i].getAttribute("name");
    const itemElements = arrayElements[i].getElementsByTagName("item");

    for (let j = 0; j < itemElements.length; j++) {
      const text = serializeChildren(itemElements[j]);

      if (arrayName) {
        const sourceText = text && text.trim() ? text : `${arrayName}[${j}]`;
        items.push({
          id: `android-array-${i + 1}-${j + 1}`,
          sourceText: sourceText,
          targetText: "",
          context: `Android string array: ${arrayName}[${j}]`,
          status: "pending",
          qualityScore: 0,
          issues: [],
          metadata: {
            file: fileName,
            resourceId: `${arrayName}[${j}]`,
            position: `line-${i + 1}-${j + 1}`,
          },
        });
      }
    }
  }

  // 查找所有<plurals>元素
  const pluralsElements = xmlDoc.getElementsByTagName("plurals");
  for (let i = 0; i < pluralsElements.length; i++) {
    const plurals = pluralsElements[i];
    if (!isTranslatable(plurals)) continue;
    const pluralsName = plurals.getAttribute("name");
    const itemElements = plurals.getElementsByTagName("item");
    if (!pluralsName) continue;

    for (let j = 0; j < itemElements.length; j++) {
      const itemEl = itemElements[j];
      const quantity = itemEl.getAttribute("quantity") || String(j);
      const text = serializeChildren(itemEl);
      const sourceText =
        text && text.trim() ? text : `${pluralsName}[${quantity}]`;

      items.push({
        id: `android-plurals-${i + 1}-${j + 1}`,
        sourceText: sourceText,
        targetText: "",
        context: `Android plurals: ${pluralsName}[${quantity}]`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          resourceId: `${pluralsName}[${quantity}]`,
          position: `plurals-${i + 1}-${j + 1}`,
        },
      });
    }
  }

  return items;
}
