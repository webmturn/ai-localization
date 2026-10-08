// 文本兜底：auto 只识别明确的 key=value，plain 按行保留全部非空文本，
// keyValue 显式支持 =、:、Tab、逗号和续行。引号中的反斜杠按字面保留，
// 不宣称支持 Java properties / INI 等格式的完整转义语义。
// legacy 只用于已保存的旧项目，保持旧解析规则；新导入不自动采用。
function parseTextFile(content, fileName, options = {}) {
  const mode = ['auto', 'plain', 'keyValue', 'legacy'].includes(options.mode) ? options.mode : 'auto';
  const text = String(content ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  const unwrap = value => {
    const trimmed = value.trim();
    return /^(["']).*\1$/s.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  };
  const layoutFor = (start, end, kind, delimiter, quote, section) => ({
    textMode: mode, textKind: kind, textLineStart: start + 1, textLineEnd: end + 1, textSection: section,
    textPrefix: kind === 'keyValue' ? lines[start].slice(0, delimiter + 1) + (lines[start].slice(delimiter + 1).match(/^[ \t]*/)?.[0] || '') : mode === 'legacy' ? (lines[start].match(/^[ \t]*/)?.[0] || '') : '',
    textSuffix: kind === 'keyValue' || mode === 'legacy' ? (lines[end].match(/[ \t]*$/)?.[0] || '') : '',
    textQuote: quote,
  });
  const delimiterFor = line => {
    if (mode !== 'legacy') {
      const leading = line.match(/^[ \t]*/)?.[0].length || 0;
      let from = leading;
      const quote = line[leading];
      if (quote === '"' || quote === "'") {
        for (let i = leading + 1; i < line.length; i++) {
          if (line[i] !== quote) continue;
          const escapes = line.slice(0, i).match(/\\+$/)?.[0].length || 0;
          if (escapes % 2 === 0) { from = i + 1; break; }
        }
      }
      const candidates = (mode === 'auto' ? ['='] : ['=', ':', '\t', ',']).map(separator => line.indexOf(separator, from)).filter(index => index > 0);
      return candidates.length ? Math.min(...candidates) : -1;
    }
    const eq = line.indexOf('=');
    if (eq > 0) return eq;
    const colon = line.indexOf(':');
    if (colon > 0) return colon;
    const tab = line.indexOf('\t');
    return tab >= 0 ? tab : line.indexOf(',');
  };

  if (mode === 'legacy') {
    const items = __parseTextLegacy(text, fileName);
    let section = '', scan = 0;
    for (const item of items) {
      const start = Number(item.metadata.position.slice(5)) - 1;
      while (scan < start) {
        if (/^\[.*\]$/.test(lines[scan].trim())) section = lines[scan].trim().slice(1, -1);
        scan++;
      }
      let end = start;
      while (lines[end]?.endsWith('\\') && end + 1 < lines.length) end++;
      const kind = item.metadata.resourceId ? 'keyValue' : 'plain';
      const delimiter = kind === 'keyValue' ? delimiterFor(lines[start]) : -1;
      const rawValue = kind === 'keyValue' ? lines[start].slice(delimiter + 1).trim() : '';
      const quote = /^(["']).*\1$/s.test(rawValue) ? rawValue[0] : '';
      Object.assign(item.metadata, layoutFor(start, end, kind, delimiter, quote, section));
      item.metadata.identity = JSON.stringify(kind === 'keyValue' ? ['text-key', section, item.metadata.resourceId] : ['text-line', start + 1]);
      if (kind === 'keyValue' && section) item.context += ` · section: ${section}`;
      scan = end + 1;
    }
    return items;
  }

  const items = [];
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i], trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (mode !== 'plain') {
      if (/^(#|\/\/|;)/.test(trimmed)) continue;
      if (/^\[.*\]$/.test(trimmed)) { section = trimmed.slice(1, -1); continue; }
    }
    const start = i;
    let delimiter = mode === 'plain' ? -1 : delimiterFor(rawLine);
    const rawKey = delimiter > 0 ? rawLine.slice(0, delimiter).trim() : '';
    if (mode === 'auto' && !/^[\p{L}\p{N}_.$\[\]-]+$/u.test(rawKey) && !/^(["']).+\1$/.test(rawKey)) delimiter = -1;
    const key = delimiter > 0 ? unwrap(rawKey) : '';
    const kind = key ? 'keyValue' : 'plain';
    let rawValue = key ? rawLine.slice(delimiter + 1).trim() : rawLine;
    if (key) {
      let continuation = (rawLine.match(/\\+$/)?.[0].length || 0) % 2 === 1;
      if (continuation && i + 1 >= lines.length) throw new Error(`键值文本的续行缺少下一行（第 ${i + 1} 行）`);
      if (continuation) rawValue = rawValue.slice(0, -1);
      while (continuation && i + 1 < lines.length) {
        const next = lines[++i].trim();
        continuation = (lines[i].match(/\\+$/)?.[0].length || 0) % 2 === 1;
        if (continuation && i + 1 >= lines.length) throw new Error(`键值文本的续行缺少下一行（第 ${i + 1} 行）`);
        rawValue += continuation ? next.slice(0, -1) : next;
      }
    }
    const sourceText = key ? unwrap(rawValue) : rawValue;
    if (!sourceText.trim()) continue;
    const quote = key && /^(["']).*\1$/s.test(rawValue.trim()) ? rawValue.trim()[0] : '';
    items.push({
      id: `text-${items.length + 1}`, sourceText, targetText: '',
      context: key ? `Text key: ${key}` + (section ? ` · section: ${section}` : '') : `Text line ${start + 1}`,
      status: 'pending', qualityScore: 0, issues: [],
      metadata: {
        file: fileName, ...(key ? { resourceId: key } : {}), position: `line-${start + 1}`,
        identity: JSON.stringify(key ? ['text-key', section, key] : ['text-line', start + 1]),
        ...layoutFor(start, i, kind, delimiter, quote, section),
      },
    });
  }
  return items;
}

// 保留旧项目的已知解析含义，避免升级后冒号/逗号键值被改成整行原文。
function __parseTextLegacy(content, fileName) {
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
