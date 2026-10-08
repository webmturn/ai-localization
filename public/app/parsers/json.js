// 解析 JSON 文件。
// 规则：
// - 递归遍历对象与数组（数组路径使用 [index]）
// - 仅把 string 值提取为翻译项；null/undefined 直接跳过
// 输出：context/metadata.path 为 JSONPath-like 路径（以 $ 为根），
//       同时输出 metadata.pathTokens（键/下标数组）供导出端无歧义地还原。
//
// 为什么要 pathTokens：键名本身可能含 `.` 或 `[`（如 `menu.file.open`、`a[0]`），
// 只靠 `path` 字符串无法区分「一个含点的键」与「两层嵌套」，
// 导出的回写就会丢失译文甚至摧毁子树。path 里这类字符会被转义（`\.` / `\[`），
// 但导出端优先使用 pathTokens。
function parseJSON(content, fileName) {
  const items = [];

  try {
    const json = JSON.parse(content);

    /** 键名转义：反斜杠、点、左方括号（与导出端 parseJsonPath 的解析规则对应） */
    function escapePathKey(key) {
      return String(key)
        .replace(/\\/g, "\\\\")
        .replace(/\./g, "\\.")
        .replace(/\[/g, "\\[");
    }

    // 递归遍历JSON对象
    function traverseValue(value, path = "", tokens = []) {
      if (typeof value === "string") {
        if (!value.trim()) return;
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
            pathTokens: tokens.slice(),
            position: `key-${items.length + 1}`,
          },
        });
        return;
      }

      if (value === null || value === undefined) return;

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          traverseValue(value[i], `${path}[${i}]`, tokens.concat([i]));
        }
        return;
      }

      if (typeof value === "object") {
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            const currentPath = path ? `${path}.${escapePathKey(key)}` : escapePathKey(key);
            traverseValue(value[key], currentPath, tokens.concat([key]));
          }
        }
      }
    }

    traverseValue(json, "$", []);
  } catch (error) {
    throw new Error("JSON解析错误: " + error.message);
  }

  return items;
}

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "json",
    label: "JSON",
    extensions: ["json"],
    parse: parseJSON,
  });
}
