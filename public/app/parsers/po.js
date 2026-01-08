// 解析PO文件
// 支持：
// - msgctxt（上下文）
// - msgid / msgid_plural
// - msgstr / msgstr[n]（复数形式）
// - 多行字符串拼接与常见转义（\n, \t, \", \\）
// 输出：sourceText=msgid，targetText=msgstr[0]，metadata.msgctxt / plural 提供辅助定位。
function parsePO(content, fileName) {
  const items = [];

  function unescapePoString(s) {
    if (!s) return "";
    return s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  function collectQuotedParts(line) {
    const parts = [];
    const re = /"((?:\\.|[^"\\])*)"/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      parts.push(unescapePoString(m[1]));
    }
    return parts.join("");
  }

  // 按空行分割条目
  const entries = content.split(/\n\s*\n/);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry || entry.startsWith("#")) continue;

    const lines = entry.split("\n");
    let msgctxt = "";
    let msgid = "";
    let msgidPlural = "";
    const msgstr = {};
    let currentField = null;
    let currentIndex = 0;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trim();
      if (!line) continue;
      if (line.startsWith("#")) continue;

      let m;
      if ((m = line.match(/^msgctxt\s+/))) {
        currentField = "msgctxt";
        msgctxt = collectQuotedParts(line);
        continue;
      }
      if ((m = line.match(/^msgid_plural\s+/))) {
        currentField = "msgid_plural";
        msgidPlural = collectQuotedParts(line);
        continue;
      }
      if ((m = line.match(/^msgid\s+/))) {
        currentField = "msgid";
        msgid = collectQuotedParts(line);
        continue;
      }
      if ((m = line.match(/^msgstr\[(\d+)\]\s+/))) {
        currentField = "msgstr";
        currentIndex = parseInt(m[1], 10);
        msgstr[currentIndex] = collectQuotedParts(line);
        continue;
      }
      if ((m = line.match(/^msgstr\s+/))) {
        currentField = "msgstr";
        currentIndex = 0;
        msgstr[currentIndex] = collectQuotedParts(line);
        continue;
      }

      if (line.startsWith('"')) {
        const more = collectQuotedParts(line);
        if (currentField === "msgctxt") msgctxt += more;
        else if (currentField === "msgid") msgid += more;
        else if (currentField === "msgid_plural") msgidPlural += more;
        else if (currentField === "msgstr") {
          msgstr[currentIndex] = (msgstr[currentIndex] || "") + more;
        }
      }
    }

    const target = (msgstr[0] || "").trim();

    // 跳过空的msgid（通常是头部元数据）
    if (msgid && msgid.trim()) {
      items.push({
        id: `po-${items.length + 1}`,
        sourceText: msgid,
        targetText: target,
        context: msgctxt ? `PO context: ${msgctxt}` : `PO entry: ${i + 1}`,
        status: target ? "translated" : "pending",
        qualityScore: target ? 85 : 0,
        issues: [],
        metadata: {
          file: fileName,
          entryId: i + 1,
          msgctxt: msgctxt || undefined,
          plural: msgidPlural || undefined,
          position: `entry-${i + 1}`,
        },
      });
    }
  }

  if (items.length === 0) {
    throw new Error("未找到有效的PO条目，请检查文件格式");
  }

  return items;
}
