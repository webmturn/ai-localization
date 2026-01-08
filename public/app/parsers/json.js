// 解析 JSON 文件。
// 规则：
// - 递归遍历对象与数组（数组路径使用 [index]）
// - 仅把 string 值提取为翻译项；null/undefined 直接跳过
// 输出：context/metadata.path 为 JSONPath-like 路径（以 $ 为根）。
function parseJSON(content, fileName) {
  const items = [];

  try {
    const json = JSON.parse(content);

    // 递归遍历JSON对象
    function traverseValue(value, path = "") {
      if (typeof value === "string") {
        items.push({
          id: `json-${items.length + 1}`,
          sourceText: value,
          targetText: "",
          context: `JSON path: ${path}`,
          status: "pending",
          qualityScore: 0,
          issues: [],
          metadata: {
            file: fileName,
            path: path,
            position: `key-${items.length + 1}`,
          },
        });
        return;
      }

      if (value === null || value === undefined) return;

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const nextPath = `${path}[${i}]`;
          traverseValue(value[i], nextPath);
        }
        return;
      }

      if (typeof value === "object") {
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            const currentPath = path ? `${path}.${key}` : key;
            traverseValue(value[key], currentPath);
          }
        }
      }
    }

    traverseValue(json, "$");
  } catch (error) {
    throw new Error("JSON解析错误: " + error.message);
  }

  return items;
}
