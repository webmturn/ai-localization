// 文件解析入口（实现体）。
// 职责：
// - 读取文件内容，并做轻量标准化（去 BOM、统一换行）以降低各解析器的边界差异
// - 对 XML 类扩展名做安全校验（过大/非法 XML 直接拒绝）
// - 保存文件元数据与原始内容（AppState + IndexedDB），便于后续回溯/重解析
// - options.silent：不弹 toast；options.skipPersist：只解析条目，不写 metadata/IndexedDB（源文件编辑器用）
// - 经 ParserRegistry 分发：XML 系扩展名优先结构探测，其余按扩展名直配，未认领走文本兜底（parseTextFile）
//   新增格式 = 新增 parser 文件（末尾自注册）+ app.js parserScripts 加一行，本文件零改动
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

    const hit = ParserRegistry.detectXml(xmlDoc);
    return hit ? { type: hit.id, doc: xmlDoc } : { type: "generic", doc: xmlDoc };
  } catch (error) {
    return { type: "generic", reason: error.message };
  }
}

async function __parseFileAsyncImpl(file, options) {
  const opts = options || {};
  const silent = !!opts.silent;
  const skipPersist = !!opts.skipPersist;
  const warnings = [];
  try {
    // 显示处理提示（源文件重解析等场景可 silent，避免叠 toast）
    if (!silent) {
      showNotification("info", "解析文件", `正在解析文件: ${file.name}`);
    }

    const fileExtension = file.name.split(".").pop().toLowerCase();

    // 文件格式开关检查（format* 设置项）：关闭的格式直接拒绝，不进入解析/兜底回退
    try {
      const s = typeof SettingsCache !== "undefined" && SettingsCache.get ? SettingsCache.get() : {};
      const extFormatKey = {
        xml: "xml", xlf: "xliff", xliff: "xliff", ts: "ts", resx: "resx",
        strings: "strings", po: "po", pot: "po", json: "json",
        yaml: "yaml", yml: "yaml", csv: "csv", tsv: "csv",
      }[fileExtension];
      if (extFormatKey) {
        const settingKey = { strings: "IOSStrings", ts: "QtTS", xml: "XML", xliff: "XLIFF", resx: "RESX", po: "PO", json: "JSON", yaml: "YAML", csv: "CSV" }[extFormatKey];
        const enabled = s["format" + settingKey] !== false;
        if (!enabled) {
          if (!silent) {
            showNotification("warning", "格式已禁用", "已在设置中禁用 " + fileExtension.toUpperCase() + " 格式解析（文件处理设置）");
          }
          return null;
        }
      } else if (!ParserRegistry.getByExtension(fileExtension) && s.formatTextFallback === false) {
        // 未知扩展名走文本兜底，受 formatTextFallback 控制
        if (!silent) {
          showNotification("warning", "文本解析已禁用", "已在设置中禁用文本兜底解析（文件处理设置）");
        }
        return null;
      }
    } catch (e) {
      (loggers.app || console).debug("format setting check:", e);
    }

    const content = await __readFileAsyncImpl(file, { encoding: opts.encoding, warnings });

    const normalizedContent = (typeof content === "string" ? content : "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");

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
    // XML 系扩展名由注册表派生：基础 xml + 所有声明了结构探测的解析器认领的扩展名
    const xmlFamilyExtensions = ["xml"].concat(
      ParserRegistry.getDetectableExtensions()
    );
    if (xmlFamilyExtensions.includes(fileExtension)) {
      if (!securityUtils.validateXMLContent(normalizedContent)) {
        throw new Error("文件内容不是有效的XML格式或过大");
      }
    }

    (loggers.app || console).debug(
      `开始解析文件: ${file.name} (${fileExtension}), 大小: ${file.size} bytes`
    );

    // 根据文件类型解析内容：XML 系扩展名走结构探测，其余经注册表扩展名直配
    let items = [];
    let textParseMode;

    // 标记「XML 本身损坏」这类错误：必须向上抛出，绝不能再退化成纯文本解析。
    // 否则畸形 XML 会被逐行当成文本条目导入（垃圾数据），而界面还提示导入成功。
    class MalformedXmlError extends Error {
      constructor(message) {
        super(message);
        this.name = "MalformedXmlError";
        this.code = "MALFORMED_XML";
      }
    }

    try {
      // XML 系格式：结构探测优先；结构未命中按扩展名提示；校验失败回退通用XML。
      const parseXmlByDetectedFormat = () => {
        const warnFallback = (message) => {
          (loggers.app || console).warn(message);
          // silent 门控：源文件编辑器等静默重解析场景不弹 toast，避免叠加提示
          if (!silent) {
            showNotification("warning", "XML解析提示", message);
          }
        };

        // 结构探测（parsererror 直接抛错，走文件级错误路径）
        const detection = detectXmlFormat(normalizedContent);
        if (detection.type === "invalid") {
          throw new MalformedXmlError(
            `XML解析失败: ${detection.reason || "无效XML"}`
          );
        }

        let chosen =
          detection.type === "generic"
            ? null
            : ParserRegistry.getById(detection.type);
        if (chosen) {
          (loggers.app || console).debug(`结构识别: ${chosen.label}`);
        } else {
          // 结构未命中但扩展名明确指向某格式（如 .xlf/.resx）：按扩展名提示解析
          const hint = ParserRegistry.getByExtension(fileExtension);
          if (hint) {
            warnFallback(
              `${file.name} 结构识别未命中，尝试按扩展名解析(${hint.id.toUpperCase()})。`
            );
            chosen = hint;
          }
        }

        if (!chosen) {
          (loggers.app || console).debug("结构识别: 通用XML");
          return parseGenericXML(normalizedContent, file.name);
        }

        // detectXmlFormat 异常分支可能无 doc：补一次解析供校验使用
        let xmlDoc = detection.doc;
        if (!xmlDoc) {
          xmlDoc = new DOMParser().parseFromString(
            normalizedContent,
            "application/xml"
          );
        }

        // 结构校验失败 → 回退通用XML
        if (typeof chosen.validateSchema === "function") {
          const check = chosen.validateSchema(xmlDoc);
          if (!check || !check.ok) {
            warnFallback(
              `${file.name} ${chosen.label}结构校验失败: ${(check && check.reason) || "结构校验失败"}，已回退到通用XML解析。`
            );
            return parseGenericXML(normalizedContent, file.name);
          }
        }

        // 已识别格式的空结果合法，不能把禁译资源重新作为通用 XML 导入。
        const parsed = chosen.parse(normalizedContent, file.name);
        return parsed || [];
      };

      const parser = ParserRegistry.getByExtension(fileExtension);
      if (xmlFamilyExtensions.includes(fileExtension)) {
        items = await parseXmlByDetectedFormat();
      } else if (parser) {
        (loggers.app || console).debug(`检测到${parser.label}格式`);
        // await 兼容同步/异步解析器（parseYAML 需动态加载 js-yaml）
        items = await parser.parse(normalizedContent, file.name);
      } else {
        (loggers.app || console).debug("使用文本文件解析器");
        const requestedMode = opts.textParseMode || (typeof SettingsCache !== 'undefined' ? SettingsCache.get()?.textParseMode : '') || 'auto';
        textParseMode = ['auto', 'plain', 'keyValue', 'legacy'].includes(requestedMode) ? requestedMode : 'auto';
        items = parseTextFile(normalizedContent, file.name, { mode: textParseMode });
      }
    } catch (parseError) {
      // 畸形 XML 必须直接失败：退化为纯文本会产生垃圾条目并谎报成功
      if (parseError instanceof MalformedXmlError || parseError?.code === "MALFORMED_XML") {
        (loggers.app || console).error("XML 文件损坏，已中止导入:", parseError);
        throw parseError;
      }
      // XML 系文件的内容若本身不是良构 XML（各解析器都会报 "XML解析错误/parsererror"），
      // 同样不能退化为纯文本。
      if (xmlFamilyExtensions.includes(fileExtension)) {
        let looksMalformed = false;
        try {
          const doc = new DOMParser().parseFromString(normalizedContent, "application/xml");
          looksMalformed = !!doc.querySelector("parsererror");
        } catch (e) {
          looksMalformed = false;
        }
        if (looksMalformed) {
          const err = new MalformedXmlError(
            `XML解析失败: 文件不是良构 XML（${file.name}）`
          );
          (loggers.app || console).error("XML 文件损坏，已中止导入:", parseError);
          throw err;
        }
      }
      // 已知格式的语法错误必须保留为失败，不能把结构/指令当作翻译文本。
      throw parseError;
    }

    if (items && items.length > 0) {
      const keyCounts = new Map();
      const getKey = (item) => item?.metadata?.identity ||
        String(
          item?.metadata?.resourceId ||
            item?.metadata?.key ||
            item?.metadata?.path ||
            item?.metadata?.unitId ||
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

    // 成功解析后才替换缓存，失败重导入保留原文件与已有译文。
    if (!skipPersist) {
      const projectId = AppState.project?.id || getOrCreateProjectId();
      const contentKey = buildFileContentKey(projectId, file.name);
      ProjectStore.setFileMetadata(file.name, {
        size: file.size, lastModified: file.lastModified,
        type: file.type || "text/plain", originalContent: content,
        contentKey, extension: fileExtension,
        ...(textParseMode ? { parserId: 'text', textParseMode } : {}),
      });
      try {
        await idbPutFileContent(contentKey, content);
      } catch (e) {
        (loggers.storage || console).error("导入时写入IndexedDB失败:", e);
        notifyIndexedDbFileContentErrorOnce(e, "导入时保存原始内容");
      }
    }
    (loggers.app || console).info(`文件 ${file.name} 解析完成，找到 ${items.length} 个翻译项`);
    if (!silent) {
      showNotification(
        "success",
        "文件解析成功",
        `文件 ${file.name} 已成功解析，找到 ${items.length} 个翻译项`
      );
    }

    return { success: true, items, fileName: file.name, warnings, ...(textParseMode ? { textParseMode } : {}) };
  } catch (error) {
    (loggers.app || console).error(`解析文件 ${file.name} 时出错:`, error);
    if (!silent) {
      showNotification(
        "error",
        "文件解析错误",
        `无法解析文件 ${file.name}: ${error.message}`
      );
    }

    // 错误是文件诊断，不是可翻译资源。
    return {
      success: false,
      items: [],
      error: error.message,
      fileName: file.name,
      warnings,
    };
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.parseFileAsync = __parseFileAsyncImpl;
})();
