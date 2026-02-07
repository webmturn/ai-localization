// 文件解析入口（实现体）。
// 职责：
// - 读取文件内容，并做轻量标准化（去 BOM、统一换行）以降低各解析器的边界差异
// - 对 XML 类扩展名做安全校验（过大/非法 XML 直接拒绝）
// - 保存文件元数据与原始内容（AppState + IndexedDB），便于后续回溯/重解析
// - 按扩展名选择解析器；XML 文件优先基于结构识别格式，解析失败时回退到文本兜底解析（parseTextFile）
function detectXmlFormat(content) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "application/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      return {
        type: "invalid",
        reason: parserError.textContent || "XML parse error",
        doc: xmlDoc,
      };
    }

    const root = xmlDoc.documentElement;
    const rootName = (root?.localName || root?.nodeName || "").toLowerCase();
    const namespace = (root?.namespaceURI || "").toLowerCase();

    const hasTag = (tagName) =>
      xmlDoc.getElementsByTagName(tagName).length > 0 ||
      xmlDoc.getElementsByTagName(tagName.toUpperCase()).length > 0;
    const hasAnyTag = (...tags) => tags.some((tag) => hasTag(tag));

    const hasXliffV1 = hasTag("trans-unit") && hasTag("source");
    const hasXliffV2 = hasTag("unit") && hasTag("segment") && hasTag("source");

    if (
      rootName === "resources" &&
      hasAnyTag("string", "string-array", "plurals")
    ) {
      return { type: "android", doc: xmlDoc };
    }

    if (
      rootName === "xliff" ||
      namespace.includes("xliff") ||
      hasXliffV1 ||
      hasXliffV2
    ) {
      return { type: "xliff", doc: xmlDoc };
    }

    if (rootName === "ts" && hasAnyTag("context", "message", "source")) {
      return { type: "ts", doc: xmlDoc };
    }

    if (rootName === "root" && hasTag("data") && hasTag("value")) {
      return { type: "resx", doc: xmlDoc };
    }

    return { type: "generic", doc: xmlDoc };
  } catch (error) {
    return { type: "generic", reason: error.message };
  }
}

function validateXmlSchema(type, content, xmlDoc) {
  try {
    const doc =
      xmlDoc ||
      new DOMParser().parseFromString(content || "", "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      return { ok: false, reason: parserError.textContent || "XML parse error" };
    }

    const rootName =
      (doc.documentElement?.localName || doc.documentElement?.nodeName || "")
        .toLowerCase();
    const hasTag = (tagName) =>
      doc.getElementsByTagName(tagName).length > 0 ||
      doc.getElementsByTagName(tagName.toUpperCase()).length > 0;
    const hasAnyTag = (...tags) => tags.some((tag) => hasTag(tag));

    if (type === "android") {
      if (rootName !== "resources") {
        return { ok: false, reason: "root 不是 <resources>" };
      }
      if (!hasAnyTag("string", "string-array", "plurals")) {
        return { ok: false, reason: "缺少 string/string-array/plurals" };
      }
      return { ok: true };
    }

    if (type === "xliff") {
      const hasXliffV1 = hasTag("trans-unit") && hasTag("source");
      const hasXliffV2 = hasTag("unit") && hasTag("segment") && hasTag("source");
      return hasXliffV1 || hasXliffV2
        ? { ok: true }
        : { ok: false, reason: "缺少 trans-unit/source 或 unit/segment/source" };
    }

    if (type === "ts") {
      if (rootName !== "ts") {
        return { ok: false, reason: "root 不是 <ts>" };
      }
      return hasAnyTag("context", "message", "source")
        ? { ok: true }
        : { ok: false, reason: "缺少 context/message/source" };
    }

    if (type === "resx") {
      if (rootName !== "root") {
        return { ok: false, reason: "root 不是 <root>" };
      }
      return hasTag("data") && hasTag("value")
        ? { ok: true }
        : { ok: false, reason: "缺少 data/value" };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}
async function __parseFileAsyncImpl(file) {
  try {
    // 显示处理提示
    showNotification("info", "解析文件", `正在解析文件: ${file.name}`);

    const fileExtension = file.name.split(".").pop().toLowerCase();

    const content = await __readFileAsyncImpl(file);

    const normalizedContent = (typeof content === "string" ? content : "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");

    const warnings = [];
    const addWarning = (type, message, detail, meta = {}) => {
      warnings.push({
        type,
        file: file.name,
        message,
        detail,
        ...meta,
      });
    };

    const replacementMatches = normalizedContent.match(/\uFFFD/g);
    if (replacementMatches && replacementMatches.length > 0) {
      addWarning(
        "encoding",
        `检测到 ${replacementMatches.length} 个替换字符(�)，可能存在编码异常`,
        "建议在设置中调整文件编码或关闭自动识别",
        { count: replacementMatches.length }
      );
    }

    const controlMatches = normalizedContent.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
    if (controlMatches && controlMatches.length > 0) {
      addWarning(
        "control",
        `检测到 ${controlMatches.length} 个非法控制字符`,
        "可能影响解析与导出，请检查源文件",
        { count: controlMatches.length }
      );
    }

    // 只对XML类文件进行XML验证
    const xmlExtensions = ["xml", "xlf", "xliff", "resx", "ts"];
    if (xmlExtensions.includes(fileExtension)) {
      if (!securityUtils.validateXMLContent(normalizedContent)) {
        throw new Error("文件内容不是有效的XML格式或过大");
      }
    }

    // 保存文件元数据（到 AppState）
    if (!AppState.fileMetadata) AppState.fileMetadata = {};
    const projectId = AppState.project?.id || getOrCreateProjectId();
    const contentKey = buildFileContentKey(projectId, file.name);
    AppState.fileMetadata[file.name] = {
      size: file.size,
      lastModified: file.lastModified,
      type: file.type || "text/xml",
      originalContent: content, // 保存原始文件内容
      contentKey,
      extension: fileExtension,
    };

    try {
      await idbPutFileContent(contentKey, content);
    } catch (e) {
      (loggers.storage || console).error("导入时写入IndexedDB失败:", e);
      notifyIndexedDbFileContentErrorOnce(e, "导入时保存原始内容");
    }

    (loggers.app || console).debug(
      `开始解析文件: ${file.name} (${fileExtension}), 大小: ${file.size} bytes`
    );

    // 根据文件类型解析内容
    let items = [];

    try {
      const parseXmlByDetectedFormat = () => {
        const detection = detectXmlFormat(normalizedContent);
        const extensionHints = {
          xlf: "xliff",
          xliff: "xliff",
          ts: "ts",
          resx: "resx",
        };
        const schemaLabels = {
          android: "Android strings.xml",
          xliff: "XLIFF",
          ts: "Qt TS",
          resx: "RESX",
        };

        const warnFallback = (message) => {
          (loggers.app || console).warn(message);
          showNotification("warning", "XML解析提示", message);
        };

        const ensureSchema = (type, xmlDoc) => {
          const label = schemaLabels[type] || type.toUpperCase();
          const check = validateXmlSchema(type, normalizedContent, xmlDoc);
          if (!check.ok) {
            warnFallback(
              `${file.name} ${label}结构校验失败: ${check.reason}，已回退到通用XML解析。`
            );
            return false;
          }
          return true;
        };

        const parseWithGuard = (label, parserFn) => {
          const parsed = parserFn();
          if (!parsed || parsed.length === 0) {
            warnFallback(
              `${file.name} ${label}解析未找到可翻译项，已回退到通用XML解析。`
            );
            return parseGenericXML(normalizedContent, file.name);
          }
          return parsed;
        };

        if (detection.type === "invalid") {
          throw new Error(`XML解析失败: ${detection.reason || "无效XML"}`);
        }

        const hintedType = extensionHints[fileExtension];
        if (hintedType && detection.type === "generic") {
          warnFallback(
            `${file.name} 结构识别未命中，尝试按扩展名解析(${hintedType.toUpperCase()})。`
          );
          if (!ensureSchema(hintedType, detection.doc)) {
            return parseGenericXML(normalizedContent, file.name);
          }
          if (hintedType === "xliff") {
            return parseWithGuard("XLIFF", () =>
              parseXLIFF(normalizedContent, file.name)
            );
          }
          if (hintedType === "ts") {
            return parseWithGuard("Qt TS", () =>
              parseQtTs(normalizedContent, file.name)
            );
          }
          if (hintedType === "resx") {
            return parseWithGuard("RESX", () =>
              parseRESX(normalizedContent, file.name)
            );
          }
        }

        if (detection.type === "android") {
          (loggers.app || console).debug("结构识别: Android strings.xml");
          if (!ensureSchema("android", detection.doc)) {
            return parseGenericXML(normalizedContent, file.name);
          }
          return parseWithGuard("Android strings.xml", () =>
            parseAndroidStrings(normalizedContent, file.name)
          );
        }
        if (detection.type === "xliff") {
          (loggers.app || console).debug("结构识别: XLIFF");
          if (!ensureSchema("xliff", detection.doc)) {
            return parseGenericXML(normalizedContent, file.name);
          }
          return parseWithGuard("XLIFF", () =>
            parseXLIFF(normalizedContent, file.name)
          );
        }
        if (detection.type === "ts") {
          (loggers.app || console).debug("结构识别: Qt TS");
          if (!ensureSchema("ts", detection.doc)) {
            return parseGenericXML(normalizedContent, file.name);
          }
          return parseWithGuard("Qt TS", () =>
            parseQtTs(normalizedContent, file.name)
          );
        }
        if (detection.type === "resx") {
          (loggers.app || console).debug("结构识别: RESX");
          if (!ensureSchema("resx", detection.doc)) {
            return parseGenericXML(normalizedContent, file.name);
          }
          return parseWithGuard("RESX", () =>
            parseRESX(normalizedContent, file.name)
          );
        }
        (loggers.app || console).debug("结构识别: 通用XML");
        return parseGenericXML(normalizedContent, file.name);
      };

      const parserMap = {
        xml: parseXmlByDetectedFormat,
        xlf: parseXmlByDetectedFormat,
        xliff: parseXmlByDetectedFormat,
        ts: parseXmlByDetectedFormat,
        resx: parseXmlByDetectedFormat,
        strings: () => {
          (loggers.app || console).debug("检测到iOS strings格式");
          return parseIOSStrings(normalizedContent, file.name);
        },
        po: () => {
          (loggers.app || console).debug("检测到PO格式");
          return parsePO(normalizedContent, file.name);
        },
        json: () => {
          (loggers.app || console).debug("检测到JSON格式");
          return parseJSON(normalizedContent, file.name);
        },
      };

      const parser = parserMap[fileExtension];
      if (parser) {
        items = parser();
      } else {
        (loggers.app || console).debug("使用文本文件解析器");
        items = parseTextFile(normalizedContent, file.name);
      }
    } catch (parseError) {
      (loggers.app || console).error(`特定解析器失败，使用备用方法:`, parseError);
      items = parseTextFile(normalizedContent, file.name);
    }

    if (items && items.length > 0) {
      const keyCounts = new Map();
      const getKey = (item) =>
        String(
          item?.metadata?.resourceId ||
            item?.metadata?.key ||
            item?.metadata?.path ||
            item?.metadata?.unitId ||
            item?.metadata?.contextName ||
            item?.id ||
            ""
        ).trim();

      for (const item of items) {
        const key = getKey(item);
        if (!key) continue;
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }

      const duplicateKeys = Array.from(keyCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key);

      if (duplicateKeys.length > 0) {
        addWarning(
          "duplicate",
          `检测到 ${duplicateKeys.length} 个重复 key`,
          `示例: ${duplicateKeys.slice(0, 5).join(", ")}`,
          { count: duplicateKeys.length, samples: duplicateKeys.slice(0, 5) }
        );
      }
    }

    (loggers.app || console).info(`文件 ${file.name} 解析完成，找到 ${items.length} 个翻译项`);
    showNotification(
      "success",
      "文件解析成功",
      `文件 ${file.name} 已成功解析，找到 ${items.length} 个翻译项`
    );

    return { success: true, items, fileName: file.name, warnings };
  } catch (error) {
    (loggers.app || console).error(`解析文件 ${file.name} 时出错:`, error);
    showNotification(
      "error",
      "文件解析错误",
      `无法解析文件 ${file.name}: ${error.message}`
    );

    // 返回错误信息项
    return {
      success: false,
      items: [
        {
          id: `error-${Date.now()}`,
          sourceText: `文件解析错误: ${file.name}`,
          targetText: "",
          context: error.message,
          status: "pending",
          qualityScore: 0,
          issues: ["FILE_PARSE_ERROR"],
          metadata: {
            file: file.name,
            position: "error",
          },
        },
      ],
      fileName: file.name,
      warnings: typeof warnings !== "undefined" ? warnings : [],
    };
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.parseFileAsync = __parseFileAsyncImpl;
})();
