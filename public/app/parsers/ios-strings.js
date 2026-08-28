// 解析 iOS Localizable.strings 文件。
// 说明：
// - 使用简单 tokenizer（逐字符扫描）而非逐行正则，以支持多行字符串与更稳定的转义处理
// - 跳过 // 与 /* */ 注释
// - 支持常见转义：\n \r \t \\ \"
// 输出：metadata.key=原始 key，metadata.position=起始行号。
function parseIOSStrings(content, fileName) {
  const items = [];

  // 支持多行和转义符的正则表达式
  // 匹配格式: "key" = "value";
  const text = typeof content === "string" ? content : "";
  let i = 0;
  let lineNumber = 1;

  function consumeWhitespaceAndComments() {
    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === " " || ch === "\t" || ch === "\r") {
        i++;
        continue;
      }
      if (ch === "\n") {
        lineNumber++;
        i++;
        continue;
      }

      if (ch === "/" && next === "/") {
        i += 2;
        while (i < text.length && text[i] !== "\n") i++;
        continue;
      }

      if (ch === "/" && next === "*") {
        i += 2;
        while (i < text.length) {
          if (text[i] === "\n") lineNumber++;
          if (text[i] === "*" && text[i + 1] === "/") {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }

      break;
    }
  }

  function readQuotedString() {
    if (text[i] !== '"') return null;
    i++;
    let out = "";
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\n") lineNumber++;

      if (ch === "\\") {
        const esc = text[i + 1];
        if (esc === undefined) {
          i++;
          break;
        }

        if (esc === "n") {
          out += "\n";
          i += 2;
          continue;
        }
        if (esc === "r") {
          out += "\r";
          i += 2;
          continue;
        }
        if (esc === "t") {
          out += "\t";
          i += 2;
          continue;
        }
        if (esc === "\\") {
          out += "\\";
          i += 2;
          continue;
        }
        if (esc === '"') {
          out += '"';
          i += 2;
          continue;
        }
        if (esc === "u" && /^[0-9a-fA-F]{4}/.test(text.slice(i + 2, i + 6))) {
          const hex = text.slice(i + 2, i + 6);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        if (esc === "\n") {
          i += 2;
          continue;
        }

        out += esc;
        i += 2;
        continue;
      }

      if (ch === '"') {
        i++;
        return out;
      }

      out += ch;
      i++;
    }
    return out;
  }

  while (i < text.length) {
    consumeWhitespaceAndComments();
    if (i >= text.length) break;

    const entryLine = lineNumber;
    const key = readQuotedString();
    if (key === null) {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    consumeWhitespaceAndComments();
    if (text[i] !== "=") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    i++;

    consumeWhitespaceAndComments();
    const value = readQuotedString();
    if (value === null) {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    consumeWhitespaceAndComments();
    if (text[i] === ";") i++;

    items.push({
      id: `ios-${items.length + 1}`,
      sourceText: value,
      targetText: "",
      context: `iOS string key: ${key}`,
      status: "pending",
      qualityScore: 0,
      issues: [],
      metadata: {
        file: fileName,
        key: key,
        position: `line-${entryLine}`,
      },
    });
  }

  if (items.length === 0) {
    throw new Error("未找到有效的iOS Strings条目，请检查文件格式");
  }

  return items;
}

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "strings",
    label: "iOS strings",
    extensions: ["strings"],
    parse: parseIOSStrings,
  });
}
