function generateOriginalFormatExport(fileName, items) {
  const normalizedFileName =
    fileName && fileName !== "unknown" ? fileName : `export-${Date.now()}`;

  const meta = AppState.fileMetadata?.[fileName] || {};
  const extFromMeta = (meta.extension || "").toLowerCase();
  const extFromName = normalizedFileName.includes(".")
    ? normalizedFileName.split(".").pop().toLowerCase()
    : "";
  const extension = extFromMeta || extFromName;
  const baseName = normalizedFileName.includes(".")
    ? normalizedFileName.substring(0, normalizedFileName.lastIndexOf("."))
    : normalizedFileName;
  const originalContent = meta.originalContent;

  if (!extension) {
    return null;
  }

  if (!originalContent && extension !== "csv") {
    // 缺失提示在 exportTranslation 中做汇总，避免刷屏
  }

  if (extension === "xml") {
    const content = generateXML(items, true);
    return { content, filename: `${baseName}-translated.xml` };
  }

  if (extension === "xlf" || extension === "xliff") {
    const content = generateXLIFF(items, true);
    return { content, filename: `${baseName}-translated.${extension}` };
  }

  if (extension === "json") {
    const content = generateJSONFromOriginal(items, normalizedFileName);
    return { content, filename: `${baseName}-translated.json` };
  }

  if (extension === "resx") {
    const content = generateRESXFromOriginal(items, normalizedFileName);
    return { content, filename: `${baseName}-translated.resx` };
  }

  if (extension === "po") {
    const content = generatePOFromOriginal(items, normalizedFileName);
    return { content, filename: `${baseName}-translated.po` };
  }

  if (extension === "strings") {
    const content = generateIOSStringsFromOriginal(items, normalizedFileName);
    return { content, filename: `${baseName}-translated.strings` };
  }

  if (extension === "ts") {
    const content = generateQtTsFromOriginal(items, normalizedFileName);
    return { content, filename: `${baseName}-translated.ts` };
  }

  return null;
}

function __withXmlDeclarationAndDoctypeTs(serialized, originalContent) {
  const xmlDeclMatch = (originalContent || "").match(/^<\?xml[^>]*\?>/);
  const xmlDecl = xmlDeclMatch ? xmlDeclMatch[0] : "";
  const doctypeMatch = (originalContent || "").match(/<!DOCTYPE\s+TS[^>]*>/i);
  const doctype = doctypeMatch ? doctypeMatch[0] : "";

  let out = typeof serialized === "string" ? serialized : "";

  if (xmlDecl && !out.startsWith("<?xml")) {
    out = `${xmlDecl}\n${out}`;
  }

  if (doctype && !/<!DOCTYPE\s+TS/i.test(out)) {
    if (out.startsWith("<?xml")) {
      const end = out.indexOf("?>");
      if (end !== -1) {
        const head = out.slice(0, end + 2);
        const tail = out.slice(end + 2).replace(/^\n+/, "");
        out = `${head}\n${doctype}\n${tail}`;
      } else {
        out = `${doctype}\n${out}`;
      }
    } else {
      out = `${doctype}\n${out}`;
    }
  }

  return out;
}

function generateQtTsFromOriginal(items, fileName) {
  const meta = AppState.fileMetadata?.[fileName] || {};
  const originalContent = meta.originalContent;
  if (!originalContent) {
    return generateNewQtTsFromItems(items);
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      return generateNewQtTsFromItems(items);
    }

    function isTranslatedItem(item) {
      if (!item) return false;
      const t = item.targetText;
      if (!t || !t.trim()) return false;
      return (
        item.status === "translated" ||
        item.status === "edited" ||
        item.status === "approved"
      );
    }

    function parsePosition(pos) {
      if (!pos || typeof pos !== "string") return null;
      const m = pos.match(/^context-(\d+)-message-(\d+)$/);
      if (!m) return null;
      return {
        contextIndex: parseInt(m[1], 10),
        messageIndex: parseInt(m[2], 10),
      };
    }

    const contexts = xmlDoc.getElementsByTagName("context");

    // 先尝试按 metadata.position 精确定位（避免仅导出已翻译项时错位）
    let usedPositionMapping = false;
    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      if (!isTranslatedItem(item)) continue;

      const pos = parsePosition(item?.metadata?.position);
      if (!pos) continue;
      if (pos.contextIndex < 1 || pos.messageIndex < 1) continue;
      const ctx = contexts[pos.contextIndex - 1];
      if (!ctx) continue;
      const messages = ctx.getElementsByTagName("message");
      const msg = messages[pos.messageIndex - 1];
      if (!msg) continue;

      const transEl = msg.getElementsByTagName("translation")[0];
      if (!transEl) continue;
      const targetText = item.targetText;
      if (!targetText || !targetText.trim()) continue;

      const numerusForms = transEl.getElementsByTagName("numerusform");
      if (numerusForms && numerusForms.length > 0) {
        // 复数消息：解析时把各 <numerusform> 用 \n 连接成一个条目，因此导出必须按 \n 拆回。
        // 此前把整段拼接文本写进每一个形态，导致「只导出、不改动」也会破坏原有复数译文。
        //
        // 关于形态数：源语言与目标语言的复数形态数常常不同（en 2 种 vs ru 3 种 / ar 6 种），
        // 解析时按「目标」形态记录在 metadata.targetNumerusCount。若译文段数等于
        // 解析时记录的形态数，说明用户就是按各形态逐行给出的（解析器存的就是这个形态），
        // 可按序写回；否则保守保留原形态内容，绝不把同一段文本铺进每个形态。
        // 优先用 metadata（解析时的权威计数），DOM 计数仅作回退。
        const expectedForms =
          Number(item?.metadata?.targetNumerusCount) > 0
            ? Number(item.metadata.targetNumerusCount)
            : numerusForms.length;
        const parts = String(targetText).split("\n");
        const canSplitPerForm =
          parts.length === expectedForms && numerusForms.length === expectedForms;
        if (canSplitPerForm) {
          for (let n = 0; n < numerusForms.length; n++) {
            numerusForms[n].textContent = parts[n];
          }
        } else {
          (loggers.app || console).warn(
            "Qt TS 复数形态数不匹配，保留原译文形态：" +
              numerusForms.length + " 个形态 vs " + parts.length + " 段译文" +
              "（解析时记录 " + expectedForms + "）" +
              (item?.metadata?.contextName ? "（context: " + item.metadata.contextName + "）" : "")
          );
        }
      } else {
        transEl.textContent = targetText;
      }

      if (transEl.getAttribute("type") === "unfinished") {
        transEl.removeAttribute("type");
      }

      usedPositionMapping = true;
    }

    // 回退：如果 items 里没有 position（或完全没命中），用顺序方式尽力更新
    if (!usedPositionMapping) {
      let flatIndex = 0;
      for (let c = 0; c < contexts.length; c++) {
        const ctx = contexts[c];
        const messages = ctx.getElementsByTagName("message");
        for (let m = 0; m < messages.length; m++) {
          const msg = messages[m];
          const item = items[flatIndex++];
          if (!isTranslatedItem(item)) continue;

          const transEl = msg.getElementsByTagName("translation")[0];
          if (!transEl) continue;
          const targetText = item.targetText;
          if (!targetText || !targetText.trim()) continue;

          const numerusForms = transEl.getElementsByTagName("numerusform");
          if (numerusForms && numerusForms.length > 0) {
            for (let n = 0; n < numerusForms.length; n++) {
              numerusForms[n].textContent = targetText;
            }
          } else {
            transEl.textContent = targetText;
          }

          if (transEl.getAttribute("type") === "unfinished") {
            transEl.removeAttribute("type");
          }
        }
      }
    }

    const serializer = new XMLSerializer();
    const serialized = serializer.serializeToString(xmlDoc);
    return __withXmlDeclarationAndDoctypeTs(serialized, originalContent);
  } catch (e) {
    (loggers.app || console).error("更新Qt TS失败:", e);
    return generateNewQtTsFromItems(items);
  }
}

function generateNewQtTsFromItems(items) {
  const targetLang =
    AppState.project?.targetLanguage ||
    DOMCache.get("targetLanguage")?.value ||
    "zh";

  const byContext = new Map();
  (items || []).forEach((item) => {
    if (!item) return;
    const ctxName = item?.metadata?.contextName || "Context";
    if (!byContext.has(ctxName)) byContext.set(ctxName, []);
    byContext.get(ctxName).push(item);
  });

  const doc = document.implementation.createDocument("", "TS", null);
  const root = doc.documentElement;
  root.setAttribute("version", "2.1");
  root.setAttribute("language", targetLang);

  for (const [ctxName, ctxItems] of byContext.entries()) {
    const ctxEl = doc.createElement("context");
    const nameEl = doc.createElement("name");
    nameEl.textContent = ctxName;
    ctxEl.appendChild(nameEl);

    for (let i = 0; i < ctxItems.length; i++) {
      const item = ctxItems[i];
      const msgEl = doc.createElement("message");
      const sourceEl = doc.createElement("source");
      sourceEl.textContent = item?.sourceText || "";
      const transEl = doc.createElement("translation");
      if (item?.targetText && item.targetText.trim()) {
        transEl.textContent = item.targetText;
      } else {
        transEl.setAttribute("type", "unfinished");
      }
      msgEl.appendChild(sourceEl);
      msgEl.appendChild(transEl);
      ctxEl.appendChild(msgEl);
    }

    root.appendChild(ctxEl);
  }

  const serializer = new XMLSerializer();
  const body = serializer.serializeToString(doc);
  return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE TS>\n${body}`;
}

function generateJSONFromOriginal(items, fileName) {
  const meta = AppState.fileMetadata?.[fileName] || {};
  const originalContent = meta.originalContent;
  if (!originalContent) {
    return generateJSON(items, true);
  }

  try {
    const json = JSON.parse(originalContent);

    // 解析 parseJSON 产出的路径（以 $ 为根，如 $.app.title、$.menu[0]、$[0].name）
    // 为键/下标序列。注意必须跳过根符号 $，否则 json["$"] 为 undefined，
    // 会导致所有条目提前返回、导出的文件不含任何译文。
    function parseJsonPath(path) {
      if (!path || typeof path !== "string") return null;
      const tokens = [];
      let i = 0;
      // 跳过根符号
      if (path[i] === "$") i++;
      while (i < path.length) {
        const ch = path[i];
        if (ch === ".") {
          i++;
          continue;
        }
        if (ch === "[") {
          const end = path.indexOf("]", i);
          if (end === -1) return null;
          const idx = Number(path.slice(i + 1, end));
          if (!Number.isInteger(idx) || idx < 0) return null;
          tokens.push(idx);
          i = end + 1;
          continue;
        }
        // 读取一段键名（到下一个 . 或 [ 为止）
        let j = i;
        while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
        const key = path.slice(i, j);
        if (!key) return null;
        tokens.push(key);
        i = j;
      }
      return tokens.length > 0 ? tokens : null;
    }

    function setValueByPath(obj, path, value) {
      const tokens = parseJsonPath(path);
      if (!tokens) return;
      let current = obj;

      for (let i = 0; i < tokens.length - 1; i++) {
        if (current === null || typeof current !== "object") return;
        current = current[tokens[i]];
      }

      const lastKey = tokens[tokens.length - 1];
      if (current === null || typeof current !== "object") return;
      current[lastKey] = value;
    }

    items.forEach((item) => {
      const path = item?.metadata?.path;
      const targetText = item?.targetText;
      if (!path) return;
      if (!targetText || !targetText.trim()) return;
      setValueByPath(json, path, targetText);
    });

    return JSON.stringify(json, null, 2);
  } catch (e) {
    (loggers.app || console).error("更新JSON失败:", e);
    return generateJSON(items, true);
  }
}

function generateRESXFromOriginal(items, fileName) {
  const meta = AppState.fileMetadata?.[fileName] || {};
  const originalContent = meta.originalContent;
  if (!originalContent) {
    return generateXML(items, true);
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      return generateXML(items, true);
    }

    items.forEach((item) => {
      const name = item?.metadata?.resourceId;
      const targetText = item?.targetText;
      if (!name) return;
      if (!targetText || !targetText.trim()) return;

      const escapedName =
        window.CSS && typeof window.CSS.escape === "function"
          ? window.CSS.escape(name)
          : String(name).replace(/["\\]/g, "\\$&");
      const data = xmlDoc.querySelector(`data[name="${escapedName}"]`);
      if (!data) return;
      const valueEl = data.querySelector("value");
      if (!valueEl) return;
      valueEl.textContent = targetText;
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  } catch (e) {
    (loggers.app || console).error("更新RESX失败:", e);
    return generateXML(items, true);
  }
}

function generatePOFromOriginal(items, fileName) {
  const meta = AppState.fileMetadata?.[fileName] || {};
  const originalContent = meta.originalContent;
  if (!originalContent) {
    return generateCSV(items, true);
  }

  try {
    return __replacePoMsgstr(originalContent, items);
  } catch (e) {
    (loggers.app || console).error("更新PO失败:", e);
    return generateCSV(items, true);
  }
}

// 转义 PO 字符串字面量内容。
// 此前只转义了双引号：换行被原样写入 → 生成非法 PO；制表符/反斜杠同样破坏结构
// （"C:\temp\new" 会变成 C:<TAB>emp<LF>ew，尾随反斜杠会吃掉结尾引号）。
function __poEscape(text) {
  return String(text == null ? "" : text)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

// 按原文换行风格重建 msgstr 块，保持多行 continuation 结构。
function __poSplitLines(escaped) {
  const MAX = 76;
  if (escaped.length <= MAX) return [escaped];
  const parts = [];
  let rest = escaped;
  while (rest.length > MAX) {
    let cut = -1;
    // 优先在 \n 转义之后断开，保证语义分组（且不会把 \ 与 n 拆开）
    const candidate = rest.lastIndexOf("\\n", MAX);
    if (candidate > 0) cut = candidate + 2;
    else {
      // 退而求其次：在空格处断开
      const sp = rest.lastIndexOf(" ", MAX);
      cut = sp > 0 ? sp + 1 : MAX;
    }
    // 不要把转义序列从中间截断（例如 \\ 或 \t）
    let safe = cut;
    let backslashes = 0;
    for (let i = safe - 1; i >= 0 && rest[i] === "\\"; i--) backslashes++;
    if (backslashes % 2 === 1) safe = safe - 1;
    if (safe <= 0) safe = cut;
    parts.push(rest.slice(0, safe));
    rest = rest.slice(safe);
  }
  if (rest) parts.push(rest);
  return parts;
}

// 替换某条 msgid 对应的 msgstr 块（含多行 continuation），未匹配返回 null。
function __poReplaceMsgstrBlock(content, msgid, msgstr) {
  const lines = String(content).split("\n");
  const targetEscaped = __poEscape(msgid);

  // 解出 PO 字符串字面量（支持 "a" "b" 续行拼接），供 msgid 精确比对
  const unquote = (s) => {
    const matches = String(s).match(/"((?:\\.|[^"\\])*)"/g);
    if (!matches) return null;
    return matches.map((m) => m.slice(1, -1)).join("");
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idMatch = line.match(/^(\s*msgid\s+)((?:"(?:\\.|[^"\\])*"\s*)+)\s*$/);
    if (!idMatch) continue;

    const fileMsgidEscaped = unquote(idMatch[2]);
    if (fileMsgidEscaped === null) continue;
    if (fileMsgidEscaped !== targetEscaped) continue;

    // 该 msgid 之后紧跟的第一个 msgstr（跳过注释与 msgctxt）
    let j = i + 1;
    while (j < lines.length && /^\s*$/.test(lines[j])) j++;
    if (j >= lines.length) return null;
    const strMatch = lines[j].match(/^(\s*msgstr(?:\[\d+\])?\s+)((?:"(?:\\.|[^"\\])*"\s*)+)\s*$/);
    if (!strMatch) return null;

    const prefix = strMatch[1];
    const blockStart = j;
    let blockEnd = j;
    // 吃掉后续的 continuation 行（与原文保持一致地缩进）
    let k = j + 1;
    while (k < lines.length && /^\s*"(?:\\.|[^"\\])*"\s*$/.test(lines[k])) {
      blockEnd = k;
      k++;
    }
    const continuationCount = blockEnd - blockStart; // 原块除首行外还有几行

    const escaped = __poEscape(msgstr);
    const segments = __poSplitLines(escaped);

    const newLines = [prefix + '"' + segments[0] + '"'];
    // 尽量维持原有的多行形态
    for (let s = 1; s < Math.max(segments.length, continuationCount + 1); s++) {
      const seg = segments[s] || "";
      newLines.push('"' + seg + '"');
    }

    lines.splice(blockStart, blockEnd - blockStart + 1, ...newLines);
    return lines.join("\n");
  }
  return null;
}

// PO 导出：按 msgid 精确匹配（支持续行拼接与转义），并按需重建复数形式
function __replacePoMsgstr(content, items) {
  let result = content;
  for (const item of items || []) {
    const msgid = item?.sourceText;
    const msgstr = item?.targetText;
    if (!msgid || !String(msgid).trim()) continue;
    if (!msgstr || !String(msgstr).trim()) continue;

    const replaced = __poReplaceMsgstrBlock(result, msgid, msgstr);
    if (replaced != null) result = replaced;

    const plural = item?.metadata?.pluralTarget;
    if (plural != null && String(plural).trim()) {
      const replacedPlural = __poReplaceMsgstrBlockWithIndex(result, msgid, 1, plural);
      if (replacedPlural != null) result = replacedPlural;
    }
  }
  return result;
}

// 替换 msgstr[N] 形式（复数），语义同 __poReplaceMsgstrBlock
function __poReplaceMsgstrBlockWithIndex(content, msgid, index, msgstr) {
  const lines = String(content).split("\n");
  const targetEscaped = __poEscape(msgid);
  const unquote = (s) => {
    const matches = String(s).match(/"((?:\\.|[^"\\])*)"/g);
    if (!matches) return null;
    return matches.map((m) => m.slice(1, -1)).join("");
  };

  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(/^(\s*msgid\s+)((?:"(?:\\.|[^"\\])*"\s*)+)\s*$/);
    if (!idMatch) continue;
    if (unquote(idMatch[2]) !== targetEscaped) continue;

    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*msgid\s/.test(lines[j])) break; // 进入下一条消息
      const m = lines[j].match(/^(\s*msgstr\[(\d+)\]\s+)((?:"(?:\\.|[^"\\])*"\s*)+)\s*$/);
      if (!m) continue;
      if (parseInt(m[2], 10) !== index) continue;

      let blockEnd = j;
      let k = j + 1;
      while (k < lines.length && /^\s*"(?:\\.|[^"\\])*"\s*$/.test(lines[k])) {
        blockEnd = k;
        k++;
      }
      const segments = __poSplitLines(__poEscape(msgstr));
      const newLines = [m[1] + '"' + segments[0] + '"'];
      for (let s = 1; s < segments.length; s++) newLines.push('"' + segments[s] + '"');
      lines.splice(j, blockEnd - j + 1, ...newLines);
      return lines.join("\n");
    }
  }
  return null;
}

function generateIOSStringsFromOriginal(items, fileName) {
  const meta = AppState.fileMetadata?.[fileName] || {};
  const originalContent = meta.originalContent;
  if (!originalContent) {
    return generateCSV(items, true);
  }

  try {
    const lines = originalContent.split("\n");
    const map = new Map();

    items.forEach((item) => {
      const key = item?.metadata?.key;
      const value = item?.targetText;
      if (!key) return;
      if (!value || !value.trim()) return;
      map.set(key, value);
    });

    // 匹配 "key" = "value"; —— 两侧字符串都允许转义引号（\"），
    // 旧写法用 [^"]+ / [^"]* 会在遇到 \" 时截断，导致含转义引号或多行值的条目
    // 永远匹配不到（译文被静默丢弃）。
    const LINE_RE = /^(\s*)"((?:\\.|[^"\\])*)"(\s*=\s*)"((?:\\.|[^"\\])*)"(\s*;?\s*)$/;

    const updated = lines.map((line) => {
      const match = line.match(LINE_RE);
      if (!match) return line;
      const key = __stringsUnescape(match[2]);
      if (!map.has(key)) return line;
      const newValue = __stringsEscape(map.get(key));
      return match[1] + '"' + match[2] + '"' + match[3] + '"' + newValue + '"' + match[5];
    });

    return updated.join("\n");
  } catch (e) {
    (loggers.app || console).error("更新iOS Strings失败:", e);
    return generateCSV(items, true);
  }
}

// .strings 转义（与解析器解码规则对应）：
// 反斜杠、双引号、换行、制表符、回车。缺失转义会让值提前结束，
// 尾随反斜杠更会吞掉收尾引号并连带破坏下一条键值对。
function __stringsEscape(text) {
  return String(text == null ? "" : text)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// .strings 解码（用于把文件里的 key 还原成真实字符串以便比对）
function __stringsUnescape(text) {
  return String(text == null ? "" : text).replace(
    /\\(.)/g,
    function (_, ch) {
      if (ch === "n") return "\n";
      if (ch === "r") return "\r";
      if (ch === "t") return "\t";
      if (ch === '"') return '"';
      if (ch === "\\") return "\\";
      if (ch === "U") return "\\U";
      return ch;
    }
  );
}
