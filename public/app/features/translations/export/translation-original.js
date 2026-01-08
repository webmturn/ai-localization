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
        for (let n = 0; n < numerusForms.length; n++) {
          numerusForms[n].textContent = targetText;
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
    console.error("更新Qt TS失败:", e);
    return generateNewQtTsFromItems(items);
  }
}

function generateNewQtTsFromItems(items) {
  const targetLang =
    AppState.project?.targetLanguage ||
    document.getElementById("targetLanguage")?.value ||
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

    function setValueByPath(obj, path, value) {
      if (!path || typeof path !== "string") return;
      const parts = path.split(".");
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!current || typeof current !== "object") return;
        current = current[key];
      }

      const lastKey = parts[parts.length - 1];
      if (!current || typeof current !== "object") return;
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
    console.error("更新JSON失败:", e);
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
    console.error("更新RESX失败:", e);
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
    let result = originalContent;

    items.forEach((item) => {
      const msgid = item?.sourceText;
      const msgstr = item?.targetText;
      if (!msgid || !msgid.trim()) return;
      if (!msgstr || !msgstr.trim()) return;

      const escapedMsgid = msgid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const replaceRegex = new RegExp(
        `(msgid\\s+\"${escapedMsgid}\"[\\s\\S]*?msgstr\\s+)\"[^\"]*\"`,
        "g"
      );
      const escapedMsgstr = msgstr.replace(/\"/g, '\\"');
      result = result.replace(replaceRegex, `$1\"${escapedMsgstr}\"`);
    });

    return result;
  } catch (e) {
    console.error("更新PO失败:", e);
    return generateCSV(items, true);
  }
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

    const updated = lines.map((line) => {
      const match = line.match(/^\s*\"([^\"]+)\"\s*=\s*\"([^\"]*)\";?\s*$/);
      if (!match) return line;
      const key = match[1];
      if (!map.has(key)) return line;
      const newValue = map.get(key).replace(/\"/g, '\\"');
      return line.replace(/(=\s*\")[^\"]*(\";?\s*)$/, `$1${newValue}$2`);
    });

    return updated.join("\n");
  } catch (e) {
    console.error("更新iOS Strings失败:", e);
    return generateCSV(items, true);
  }
}
