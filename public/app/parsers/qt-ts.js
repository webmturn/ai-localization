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
      const transType = transEl?.getAttribute?.("type") || "";
      if (transType === "obsolete" || transType === "vanished") continue;

      const sourceText = extractQtText(sourceEl);
      if (!sourceText) continue;

      const targetForms = transEl ? [...transEl.getElementsByTagName("numerusform")] : [];

      // 复数形态数量：供导出端判断能否安全地按行拆分回各 <numerusform>。
      // 源语言与目标语言的复数形态数常常不同（如 en 2 种 vs ru 3 种），
      // 数量不一致时导出必须保守处理，否则会把同一段文本写进每个形态、破坏原有译文。
      const countNumerusForms = (el) => {
        if (!el) return 0;
        const forms = el.getElementsByTagName("numerusform");
        return forms ? forms.length : 0;
      };
      const sourceNumerusCount = countNumerusForms(sourceEl);
      const targetNumerusCount = countNumerusForms(transEl);

      const locEls = msg.getElementsByTagName("location");
      const firstLoc = locEls && locEls.length > 0 ? locEls[0] : null;
      const locFilename = firstLoc?.getAttribute?.("filename") || "";
      const locLine = firstLoc?.getAttribute?.("line") || "";

      let contextText = ctxName ? `Qt TS: ${ctxName}` : "Qt TS";
      if (locFilename) {
        contextText += ` @ ${locFilename}${locLine ? ":" + locLine : ""}`;
      }

      const comment = [msg.getElementsByTagName("comment")[0]?.textContent, msg.getElementsByTagName("extracomment")[0]?.textContent].filter(Boolean).join('\n');
      const formCount = Math.max(1, targetForms.length);
      for (let form = 0; form < formCount; form++) {
        const targetText = targetForms.length ? (targetForms[form].textContent || '') : extractQtText(transEl);
        const isTranslated = !!targetText.trim();
        items.push({
          id: `ts-${items.length + 1}`,
          sourceText: sourceText,
          targetText: targetText,
          context: contextText + (targetForms.length ? ` · 复数形式 ${form}` : ''),
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
            sourceNumerusCount: sourceNumerusCount,
            targetNumerusCount: targetNumerusCount,
            pluralIndex: targetForms.length ? form : undefined,
            comment: comment || undefined,
            originalState: transType,
            identity: JSON.stringify(['ts', ctxName, msg.getAttribute('id') || sourceText, msg.getElementsByTagName('comment')[0]?.textContent || '', targetForms.length ? form : null]),
          },
        });
      }
    }
  }

  return items;
}

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "ts",
    label: "Qt TS",
    extensions: ["ts"],
    detectXml: (doc) =>
      ParserRegistry.rootName(doc) === "ts" &&
      ParserRegistry.hasAnyTag(doc, "context", "message", "source"),
    validateSchema: (doc) => {
      if (ParserRegistry.rootName(doc) !== "ts") {
        return { ok: false, reason: "root 不是 <ts>" };
      }
      if (!ParserRegistry.hasAnyTag(doc, "context", "message", "source")) {
        return { ok: false, reason: "缺少 context/message/source" };
      }
      return { ok: true };
    },
    parse: parseQtTs,
  });
}
