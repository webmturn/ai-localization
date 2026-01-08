// 解析文本文件（备用方法）
// 用于无法识别具体格式时的兜底解析。
// 支持：
// - key=value / key: value
// - 两列 TSV: key<TAB>value
// - 简单 CSV: key,value（仅按第一处逗号分割，适用于常见简单 CSV）
// 规则：
// - 忽略空行、注释行（#, //, ;）以及 INI section（[section]）
// - 行尾 "\\" 表示续行：会把下一行拼接到当前 value/文本之后
// 输出：
// - items[].metadata.resourceId：可识别 key 时写入
// - items[].metadata.position：行号（line-N）
function parseTextFile(content, fileName) {
  const items = [];

  // 按行分割
  const text = typeof content === "string" ? content : "";
  const lines = text.split("\n");

  function stripWrappingQuotes(s) {
    const t = (s ?? "").trim();
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }

  function parseDelimitedTwoColumns(line) {
    const l = line;
    if (l.includes("\t")) {
      const parts = l.split("\t");
      if (parts.length >= 2) {
        return {
          key: stripWrappingQuotes(parts[0]),
          value: stripWrappingQuotes(parts.slice(1).join("\t")),
        };
      }
    }

    const commaIdx = l.indexOf(",");
    if (commaIdx > -1) {
      const left = l.slice(0, commaIdx);
      const right = l.slice(commaIdx + 1);
      if (left.trim() && right.trim()) {
        return {
          key: stripWrappingQuotes(left),
          value: stripWrappingQuotes(right),
        };
      }
    }

    return null;
  }

  let pending = null;

  function flushPending() {
    if (!pending) return;

    if (pending.type === "kv") {
      const key = pending.key;
      const value = pending.value;
      items.push({
        id: `text-${items.length + 1}`,
        sourceText: value || key,
        targetText: "",
        context: `Text key: ${key}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          resourceId: key,
          position: `line-${pending.lineNumber}`,
        },
      });
    } else {
      items.push({
        id: `text-${items.length + 1}`,
        sourceText: pending.value,
        targetText: "",
        context: `Text line ${pending.lineNumber}`,
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: {
          file: fileName,
          position: `line-${pending.lineNumber}`,
        },
      });
    }

    pending = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNumber = i + 1;

    if (pending && pending.continue) {
      const next = trimmed;
      pending.value += next;
      pending.continue = rawLine.endsWith("\\");
      if (pending.continue) {
        pending.value = pending.value.slice(0, -1);
      }
      if (!pending.continue) flushPending();
      continue;
    }

    if (trimmed.length === 0) {
      flushPending();
      continue;
    }

    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith("//") ||
      trimmed.startsWith(";")
    ) {
      flushPending();
      continue;
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      flushPending();
      continue;
    }

    let kv = null;
    const eqIdx = rawLine.indexOf("=");
    const colonIdx = rawLine.indexOf(":");
    if (eqIdx > 0) {
      const key = rawLine.slice(0, eqIdx).trim();
      const value = rawLine.slice(eqIdx + 1).trim();
      if (key)
        kv = {
          key: stripWrappingQuotes(key),
          value: stripWrappingQuotes(value),
        };
    } else if (colonIdx > 0) {
      const key = rawLine.slice(0, colonIdx).trim();
      const value = rawLine.slice(colonIdx + 1).trim();
      if (key)
        kv = {
          key: stripWrappingQuotes(key),
          value: stripWrappingQuotes(value),
        };
    } else {
      kv = parseDelimitedTwoColumns(rawLine);
    }

    if (kv && kv.key) {
      flushPending();
      let val = kv.value ?? "";
      const cont = rawLine.endsWith("\\");
      if (cont) val = val.slice(0, -1);
      pending = {
        type: "kv",
        key: kv.key,
        value: val,
        lineNumber,
        continue: cont,
      };
      if (!pending.continue) flushPending();
      continue;
    }

    flushPending();
    let val = trimmed;
    const cont = rawLine.endsWith("\\");
    if (cont) val = val.slice(0, -1);
    pending = {
      type: "text",
      value: val,
      lineNumber,
      continue: cont,
    };
    if (!pending.continue) flushPending();
  }

  flushPending();

  return items;
}
