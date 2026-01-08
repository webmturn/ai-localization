function parseQtTs(content, fileName) {
  const items = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "application/xml");

  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Qt TS解析错误 (${fileName}): ` + parserError.textContent);
  }

  function extractQtText(element) {
    if (!element) return "";
    const numerusForms = element.getElementsByTagName("numerusform");
    if (numerusForms && numerusForms.length > 0) {
      let out = "";
      for (let i = 0; i < numerusForms.length; i++) {
        const t = (numerusForms[i].textContent || "").trim();
        if (!t) continue;
        out += (out ? "\n" : "") + t;
      }
      return out.trim();
    }
    // 使用 textContent：
    // - 会自动把 &amp; 解码为 &
    // - 更符合 Qt Linguist 中实际显示/翻译的文本语义
    return (element.textContent || "").trim();
  }

  const contexts = xmlDoc.getElementsByTagName("context");
  for (let c = 0; c < contexts.length; c++) {
    const ctx = contexts[c];
    const ctxName = (
      ctx.getElementsByTagName("name")[0]?.textContent || ""
    ).trim();

    const messages = ctx.getElementsByTagName("message");
    for (let m = 0; m < messages.length; m++) {
      const msg = messages[m];
      const sourceEl = msg.getElementsByTagName("source")[0];
      const transEl = msg.getElementsByTagName("translation")[0];

      const sourceText = extractQtText(sourceEl);
      if (!sourceText) continue;

      const targetText = extractQtText(transEl);
      const transType = transEl?.getAttribute?.("type") || "";
      const isTranslated = !!(targetText && targetText.trim().length > 0);

      const locEls = msg.getElementsByTagName("location");
      const firstLoc = locEls && locEls.length > 0 ? locEls[0] : null;
      const locFilename = firstLoc?.getAttribute?.("filename") || "";
      const locLine = firstLoc?.getAttribute?.("line") || "";

      let contextText = ctxName ? `Qt TS: ${ctxName}` : "Qt TS";
      if (locFilename) {
        contextText += ` @ ${locFilename}${locLine ? ":" + locLine : ""}`;
      }

      items.push({
        id: `ts-${items.length + 1}`,
        sourceText: sourceText,
        targetText: targetText,
        context: contextText,
        status:
          isTranslated && transType !== "unfinished" ? "translated" : "pending",
        qualityScore: isTranslated ? 85 : 0,
        issues: [],
        metadata: {
          file: fileName,
          contextName: ctxName,
          locationFilename: locFilename,
          locationLine: locLine,
          position: `context-${c + 1}-message-${m + 1}`,
        },
      });
    }
  }

  return items;
}
