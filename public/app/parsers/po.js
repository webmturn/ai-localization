// 解析PO文件
// 支持：
// - msgctxt（上下文）
// - msgid / msgid_plural
// - msgstr / msgstr[n]（复数形式）
// - 多行字符串拼接与常见转义（\n, \t, \", \\）
// 复数形式分别成为可编辑条目；metadata.msgid/pluralIndex 用于精确回写。
function parsePO(content, fileName) {
  const items = [];
  const declaredPluralCount = Math.min(16, parseInt(content.match(/nplurals\s*=\s*(\d+)/)?.[1], 10) || 0);

  function unescapePoString(s) {
    if (!s) return "";
    // 单次遍历替换，避免多次 replace 的顺序问题：
    // 例如字面序列 \\n 必须还原为 \\n 文本，而不是被 \\n 规则误转成换行
    var ESCAPE_MAP = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };
    return s.replace(/\\([nrt"\\])/g, function (m, c) {
      return ESCAPE_MAP[c] != null ? ESCAPE_MAP[c] : m;
    });
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
    // 不能因为条目以注释开头就整条跳过：xgettext 生成的 PO 里每个条目都带
    // `#: 引用位置` / `#. 提取注释`，整条跳过会让标准 PO 文件解析出 0 条（直接抛错），
    // 或在一部分条目带注释时静默丢条目。注释由下面的逐行循环跳过，
    // 纯注释块最终因 msgid 为空被过滤掉。
    if (!entry) continue;

    const lines = entry.split("\n");
    let msgctxt = "";
    let msgid = "";
    let msgidPlural = "";
    const msgstr = {};
    let currentField = null;
    let currentIndex = 0;
    const comments = [], references = [], flags = [];

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].trim();
      if (!line) continue;
      if (line.startsWith("#")) {
        if (line.startsWith("#:")) references.push(line.slice(2).trim());
        else if (line.startsWith("#,")) flags.push(...line.slice(2).split(',').map(f => f.trim()));
        else if (!line.startsWith("#~")) comments.push(line.replace(/^#\.?\s?/, ''));
        continue;
      }

      if (!/^(?:(?:msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+)?(?:"(?:\\.|[^"\\])*"\s*)+$/.test(line)) {
        throw new Error('PO 字符串语法错误：' + line.slice(0, 100));
      }

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
        if (currentIndex > 15) throw new Error('PO 复数形式下标超过支持范围');
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
        continue;
      }
      throw new Error('PO 语法错误：' + line.slice(0, 100));
    }

    // 跳过空的msgid（通常是头部元数据）
    if (msgid && msgid.trim()) {
      const pluralCount = msgidPlural ? Math.max(1, declaredPluralCount, ...Object.keys(msgstr).map(n => Number(n) + 1)) : 1;
      for (let form = 0; form < pluralCount; form++) {
        const target = msgstr[form] || "";
        items.push({
          id: `po-${items.length + 1}`,
          sourceText: form > 0 ? msgidPlural : msgid,
          targetText: target,
          context: (msgctxt ? `PO context: ${msgctxt}` : `PO entry: ${i + 1}`) + (msgidPlural ? ` · 复数形式 ${form}` : ''),
          status: target.trim() && !flags.includes('fuzzy') ? "translated" : "pending",
          qualityScore: target ? 85 : 0,
          issues: [],
          metadata: {
            file: fileName,
            entryId: i + 1,
            msgctxt: msgctxt || undefined,
            msgid,
            pluralIndex: msgidPlural ? form : undefined,
            pluralCount: msgidPlural ? pluralCount : undefined,
            plural: msgidPlural || undefined,
            pluralTarget: msgstr[1] != null ? msgstr[1] : undefined,
            comment: comments.filter(Boolean).join('\n') || undefined,
            references,
            originalState: flags.join(', '),
            identity: JSON.stringify(['po', msgctxt, msgid, msgidPlural ? form : null]),
            position: `entry-${i + 1}`,
          },
        });
      }
    }
  }

  if (items.length === 0) {
    throw new Error("未找到有效的PO条目，请检查文件格式");
  }

  return items;
}

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "po",
    label: "PO",
    extensions: ["po", "pot"],
    parse: parsePO,
  });
}
