// 生成XML格式
function generateXML(items, includeOriginal) {
  (loggers.app || console).debug("=== 开始生成XML ===");
  (loggers.app || console).debug("翻译项数量:", items.length);

  // 尝试查找原始文件内容
  const firstItem = items[0];
  const fileName = firstItem?.metadata?.file;

  (loggers.app || console).debug("文件名:", fileName);

  // 打印前几个翻译项的示例
  if (items.length > 0) {
    (loggers.app || console).debug("翻译项示例 (前3个):");
    items.slice(0, 3).forEach((item, i) => {
      (loggers.app || console).debug(`  [${i}] 原文: "${item.sourceText?.substring(0, 50)}..."`);
      (loggers.app || console).debug(`      译文: "${item.targetText?.substring(0, 50)}..."`);
      (loggers.app || console).debug(`      ID: ${item.id}, 状态: ${item.status}`);
    });
  }

  // 如果有原始文件内容，就在原文件基础上替换翻译
  if (fileName && AppState.fileMetadata[fileName]?.originalContent) {
    (loggers.app || console).debug("找到原始文件内容，使用替换模式");
    const originalContent = AppState.fileMetadata[fileName].originalContent;
    const extension = AppState.fileMetadata[fileName].extension;

    (loggers.app || console).debug("文件扩展名:", extension);
    (loggers.app || console).debug("原始内容长度:", originalContent.length);

    // 根据不同格式处理
    if (extension === "xml") {
      if (
        originalContent.includes("<resources") &&
        originalContent.includes("<string name=")
      ) {
        (loggers.app || console).debug("检测到Android strings.xml格式");
        return generateAndroidStringsXML(items, originalContent);
      }
    }

    // 通用XML替换
    (loggers.app || console).debug("使用通用XML替换");
    return replaceXMLContent(items, originalContent);
  }

  // 如果没有原始文件，但看起来是Android strings.xml，则生成resources格式
  if (looksLikeAndroidStringsItems(items)) {
    (loggers.app || console).debug(
      "未找到原始文件内容，但检测到Android strings.xml项目，使用生成resources模式"
    );
    return generateAndroidStringsXMLFromItems(items, includeOriginal);
  }

  // 如果没有原始文件，生成通用格式
  (loggers.app || console).debug("没有原始文件，生成通用XML格式");
  return generateGenericXML(items, includeOriginal);
}

function looksLikeAndroidStringsItems(items) {
  return (
    Array.isArray(items) &&
    items.some((item) => {
      const context = item?.context || "";
      return (
        typeof context === "string" &&
        context.includes("Android string resource:")
      );
    })
  );
}

// 生成通用XML格式（旧的逻辑）
function generateGenericXML(items, includeOriginal) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<translations>\n";

  items.forEach((item, index) => {
    xml += "  <translation";
    if (item.id) {
      xml += ` id="${escapeXml(item.id)}"`;
    }
    xml += ">\n";

    if (includeOriginal && item.sourceText) {
      xml += `    <source>${escapeXml(item.sourceText)}</source>\n`;
    }

    if (item.targetText) {
      xml += `    <target>${escapeXml(item.targetText)}</target>\n`;
    }

    if (item.context) {
      xml += `    <context>${escapeXml(item.context)}</context>\n`;
    }

    if (item.status) {
      xml += `    <status>${escapeXml(item.status)}</status>\n`;
    }

    xml += "  </translation>\n";
  });

  xml += "</translations>";
  return xml;
}

// 替换XML内容（通用方法）
function replaceXMLContent(items, originalContent) {
  (loggers.app || console).debug("开始替换XML内容, 翻译项数量:", items.length);

  // 使用DOM解析更准确地替换
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");

    // 检查解析错误
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      (loggers.app || console).warn("XML解析失败，使用文本替换");
      return replaceXMLContentByText(items, originalContent);
    }

    // 新解析条目按节点路径/属性精确回写，避免同文异译串位。
    for (const item of items) {
      const path = item.metadata?.xmlNodePath;
      if (!Array.isArray(path) || !item.targetText) continue;
      let node = xmlDoc.documentElement;
      for (const index of path) node = node?.childNodes[index];
      if (!node) continue;
      const attribute = item.metadata.xmlAttribute;
      if (attribute && node.nodeType === 1 && node.hasAttribute(attribute)) {
        node.setAttribute(attribute, item.targetText);
      } else if (node.nodeType === 3 || node.nodeType === 4) {
        const original = node.nodeValue || '';
        node.nodeValue = (original.match(/^\s*/)?.[0] || '') + item.targetText + (original.match(/\s*$/)?.[0] || '');
      }
    }
    // 旧项目没有节点路径，保留按文本匹配的兼容回退。
    const legacyItems = items.filter(item => !Array.isArray(item.metadata?.xmlNodePath));
    // 遍历所有文本节点
    const walker = document.createTreeWalker(
      xmlDoc.documentElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    const replacements = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        // 查找匹配的翻译项
        const item = legacyItems.find((item) => item.sourceText?.trim() === text);
        if (item && item.targetText) {
          replacements.push({
            node: node,
            sourceText: text,
            targetText: item.targetText,
            originalContent: node.textContent,
          });
        }
      }
    }

    (loggers.app || console).debug(`找到 ${replacements.length} 个匹配的文本节点`);

    // 执行替换
    replacements.forEach(
      ({ node, targetText, originalContent, sourceText }) => {
        // 保持原有的空白字符
        const leadingSpace = originalContent.match(/^\s*/)[0];
        const trailingSpace = originalContent.match(/\s*$/)[0];
        node.textContent = leadingSpace + targetText + trailingSpace;
        (loggers.app || console).debug(`替换: "${sourceText}" -> "${targetText}"`);
      }
    );

    // 序列化回字符串
    const serializer = new XMLSerializer();
    const result = serializer.serializeToString(xmlDoc);

    (loggers.app || console).debug("替换完成");
    return result;
  } catch (error) {
    (loggers.app || console).error("DOM替换失败:", error);
    return replaceXMLContentByText(items, originalContent);
  }
}

// 文本替换方式（备用）
function replaceXMLContentByText(items, originalContent) {
  (loggers.app || console).debug("使用文本替换方式, 翻译项数量:", items.length);
  let result = originalContent;
  let replacedCount = 0;

  // 按照文本长度排序，从长到短，避免短文本被误替换
  const sortedItems = [...items].sort(
    (a, b) => (b.sourceText?.length || 0) - (a.sourceText?.length || 0)
  );

  sortedItems.forEach((item) => {
    if (item.sourceText && item.targetText) {
      // 转义特殊字符用于正则表达式
      const escapedSource = item.sourceText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // 替换标签内的文本
      const regex = new RegExp(`>([^<]*${escapedSource}[^<]*)<`, "g");
      const before = result;

      result = result.replace(regex, (match, p1) => {
        if (p1.trim() === item.sourceText.trim()) {
          (loggers.app || console).debug(
            `文本替换: "${item.sourceText.substring(
              0,
              50
            )}..." -> "${item.targetText.substring(0, 50)}..."`
          );
          replacedCount++;
          return `>${item.targetText}<`;
        }
        return match;
      });
    }
  });

  (loggers.app || console).debug(`文本替换完成, 共替换 ${replacedCount} 个项`);
  return result;
}

function generateAndroidStringsXMLFromItems(items, includeOriginal) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<resources>\n";

  items.forEach((item) => {
    const resourceId = item?.metadata?.resourceId;
    if (!resourceId) return;

    const hasTarget = item?.targetText && item.targetText.trim() !== "";
    const value = hasTarget
      ? item.targetText
      : includeOriginal
      ? item?.sourceText || ""
      : "";

    xml += `    <string name="${escapeXml(String(resourceId))}">${escapeXml(
      String(value)
    )}</string>\n`;
  });

  xml += "</resources>\n";
  return xml;
}

// 生成Android strings.xml格式
// 覆盖三类资源，均按 metadata.resourceId 精确定位：
//   <string name="x">        → resourceId = "x"
//   <string-array name="a">  → resourceId = "a:0" / "a:1" …（并带 arrayName/arrayIndex）
//   <plurals name="p">       → resourceId = "p[one]" / "p[other]" …
// 数组用 "name:index" 是因为 <item> 没有可用于定位的属性，必须靠下标寻址；
// 旧数据可能仍是 "a[0]" 形式，故下面保留该回退分支。
// 值使用「反序列化 → 作为子节点插入」的方式写回，从而保留 <b>、<xliff:g> 等内联标记
// （解析器存进 sourceText 的正是序列化形式；此前用 [^<]* 匹配，含内联标记的字符串
//  一律匹配不到，数组/复数条目更是完全不处理）。
function generateAndroidStringsXML(items, originalContent) {
  (loggers.app || console).debug("处理Android strings.xml, 翻译项数量:", items.length);
  let result = originalContent;
  let replacedCount = 0;

  // 把序列化片段还原成可插入的节点（失败则退回纯文本，保证不注入未转义内容）
  function parseFragment(doc, text) {
    try {
      const wrapped = doc.parseFromString(
        '<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">' +
          String(text) +
          "</resources>",
        "application/xml"
      );
      if (!wrapped || wrapped.querySelector("parsererror")) return null;
      return wrapped.documentElement;
    } catch (e) {
      return null;
    }
  }

  // 把值安全地写入 XML：可能含内联标记（解析器存的是序列化片段）。
  //  - 纯文本 → XML 转义（此前直接拼接原值，含 < & 的译文会破坏文档结构）
  //  - 含标记 → 逐个文本节点转义，标签原样保留
  // 注意 hasMarkup 的判据是「片段里真的有元素节点」：纯文本同样能被解析成合法片段，
  // 若据此置位，会导致每个 <string> 都被注入 formatted="false"（P1 回归）。
  function safeAndroidValue(doc, text) {
    const raw = String(text == null ? "" : text);
    const frag = parseFragment(doc, raw);
    if (frag && frag.childNodes && frag.childNodes.length > 0) {
      const nodes = Array.prototype.slice.call(frag.childNodes);
      const hasElement = nodes.some(function (n) {
        return n.nodeType === 1;
      });
      let out = "";
      for (const node of nodes) {
        if (node.nodeType === 3) {
          out += escapeXml(node.nodeValue);
        } else if (node.nodeType === 1) {
          out += node.outerHTML !== undefined
            ? node.outerHTML
            : new XMLSerializer().serializeToString(node);
        }
      }
      return { value: out, hasMarkup: hasElement };
    }
    // 纯文本（或不是合法 XML）：整体转义
    return { value: escapeXml(raw), hasMarkup: false };
  }

  /**
   * 定位目标元素并替换其内容。
   *
   * P0 回归：容器既可能成对出现，也可能是**合法的自闭合形式**（`<string name="x"/>`）。
   * 旧实现只写 `>…</tag>`，遇到自闭合元素时会跨过它去匹配**下一个** `</tag>`，
   * 把后面的元素连同译文一起吞掉（产出非良构 XML 且丢失译文）。
   * 因此这里用「成对 / 自闭合」二选一的匹配，自闭合元素按需展开成成对形式。
   *
   * @param {string} tagName - string / string-array / plurals
   * @param {string} name - 已转义的 name 属性值
   * @param {"string"|"arrayIndex"|"quantity"} kind - 定位方式
   * @param {number|string|null} indexValue - 下标或 quantity
   * @param {string} newValue - 译文
   * @param {Object} [opts] - { injectFormatted: boolean }
   */
  function replaceSelfClosingOrPaired(tagName, name, kind, indexValue, newValue, opts) {
    const options = opts || {};
    const doc = new DOMParser();
    const safe = safeAndroidValue(doc, newValue);
    const re = new RegExp(
      "<(" + tagName + ")(?=[\\s>])([^>]*\\bname=\"" + name + "\"[^>]*?)" +
        "(\\/>|>([\\s\\S]*?)<\\/" + tagName + ">)",
      "g"
    );

    result = result.replace(re, function (match, tag, attrs, tail, inner) {
      const selfClosing = tail === "/>";
      const content = selfClosing ? "" : inner || "";

      // 含内联标记时必须声明 formatted="false"，否则 Android 会剥离标记
      let openAttrs = attrs;
      if (options.injectFormatted && safe.hasMarkup && !/\bformatted=/.test(openAttrs)) {
        openAttrs = ' formatted="false"' + openAttrs;
      }
      const open = "<" + tag + openAttrs + ">";

      if (kind === "arrayIndex") {
        // <item> 无定位属性 → 按下标寻址。自闭合的 <item/> 必须同样计入下标，
        // 否则下标整体前移，译文会被写进错误的条目。
        const itemRe = /<item\b([^>]*?)(\/>|>([\s\S]*?)<\/item>)/g;
        let seen = -1;
        let hit = false;
        const newInner = content.replace(itemRe, function (im, itemAttrs) {
          seen++;
          if (seen !== indexValue) return im;
          hit = true;
          replacedCount++;
          return "<item" + itemAttrs + ">" + safe.value + "</item>";
        });
        if (!hit) return match;
        return open + newInner + "</" + tag + ">";
      }

      if (kind === "quantity") {
        // plurals：按 quantity 寻址（同样兼容自闭合的 <item quantity="one"/>）
        const itemRe = new RegExp(
          "<item\\b([^>]*?\\bquantity=\"" + indexValue + "\"[^>]*?)" +
            "(\\/>|>([\\s\\S]*?)<\\/item>)"
        );
        if (!itemRe.test(content)) return match;
        const newInner = content.replace(itemRe, function (_im, itemAttrs) {
          replacedCount++;
          return "<item" + itemAttrs + ">" + safe.value + "</item>";
        });
        return open + newInner + "</" + tag + ">";
      }

      // 普通 <string>：自闭合元素本身没有内容，展开成成对形式写入译文
      replacedCount++;
      return open + safe.value + "</" + tag + ">";
    });
  }

  items.forEach((item) => {
    if (!item.targetText || item.targetText.trim() === "") return;
    const resourceId = item.metadata?.resourceId;
    if (!resourceId) {
      (loggers.app || console).warn(`跳过无resourceId的项: ${item.id}`);
      return;
    }

    const newValue = item.targetText;
    const before = result;
    const escName = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 0) 字符串数组：解析器已提供 arrayName/arrayIndex 时直接寻址
    const meta = item.metadata || {};
    if (meta.arrayName != null && meta.arrayIndex != null) {
      replaceSelfClosingOrPaired(
        "string-array", escName(String(meta.arrayName)), "arrayIndex",
        parseInt(meta.arrayIndex, 10), newValue
      );
      if (result === before) {
        (loggers.app || console).warn(`✗ 未找到匹配: resourceId="${resourceId}"`);
      }
      return;
    }
    // 1) 兼容旧数据：string-array 用 name[index] 表示。
    // 必须先于下面的 "name:index" 判断，否则复数资源（resourceId 形如 "p[one]"）
    // 在名称含冒号时会被误判为数组。
    let m = resourceId.match(/^(.+?)\[(\d+)\]$/);
    if (m) {
      replaceSelfClosingOrPaired(
        "string-array", escName(m[1]), "arrayIndex", parseInt(m[2], 10), newValue
      );
      if (result === before) {
        (loggers.app || console).warn(`✗ 未找到匹配: resourceId="${resourceId}"`);
      }
      return;
    }

    // 1.5) 字符串数组（解析器当前输出）：name:index。
    // 限定名称不含冒号/方括号，避免与其它形态混淆。
    m = resourceId.match(/^([A-Za-z_][\w.]*):(\d+)$/);
    if (m) {
      replaceSelfClosingOrPaired(
        "string-array", escName(m[1]), "arrayIndex", parseInt(m[2], 10), newValue
      );
      if (result === before) {
        (loggers.app || console).warn(`✗ 未找到匹配: resourceId="${resourceId}"`);
      }
      return;
    }

    // 2) plurals：name[quantity]（quantity 为 one/two/few/many/other 等词）
    m = resourceId.match(/^(.+?)\[([A-Za-z_]+)\]$/);
    if (m) {
      replaceSelfClosingOrPaired("plurals", escName(m[1]), "quantity", m[2], newValue);
      if (result === before) {
        (loggers.app || console).warn(`✗ 未找到匹配: resourceId="${resourceId}"`);
      }
      return;
    }

    // 3) 普通 <string name="x">（含自闭合 <string name="x"/>）
    replaceSelfClosingOrPaired("string", escName(resourceId), "string", null, newValue, {
      injectFormatted: true,
    });

    if (result === before) {
      (loggers.app || console).warn(`✗ 未找到匹配: name="${resourceId}"`);
    }
  });

  (loggers.app || console).debug(`Android strings.xml 替换完成, 共替换 ${replacedCount} 个项`);
  return result;
}

// 生成JSON格式
function generateJSON(items, includeOriginal) {
  const data = items.map((item, index) => {
    const obj = {};

    if (item.id) {
      obj.id = item.id;
    }

    if (includeOriginal && item.sourceText) {
      obj.source = item.sourceText;
    }

    if (item.targetText) {
      obj.target = item.targetText;
    }

    if (item.context) {
      obj.context = item.context;
    }

    if (item.status) {
      obj.status = item.status;
    }

    return obj;
  });

  return JSON.stringify(data, null, 2);
}

// 生成CSV格式
function generateCSV(items, includeOriginal) {
  let csv = "";

  // 添加表头
  if (includeOriginal) {
    csv = "ID,Source,Target,Context,Status\n";
  } else {
    csv = "ID,Target,Context,Status\n";
  }

  items.forEach((item, index) => {
    const row = [];

    // ID
    row.push(`"${escapeCsv(item.id || `item-${index + 1}`)}"`);

    // Source (如果包含原文)
    if (includeOriginal) {
      row.push(`"${escapeCsv(item.sourceText || "")}"`);
    }

    // Target
    row.push(`"${escapeCsv(item.targetText || "")}"`);

    // Context
    row.push(`"${escapeCsv(item.context || "")}"`);

    // Status
    row.push(`"${escapeCsv(item.status || "untranslated")}"`);

    csv += row.join(",") + "\n";
  });

  return csv;
}

// 生成XLIFF格式
function generateXLIFF(items, includeOriginal) {
  // 尝试查找原始文件内容
  const firstItem = items[0];
  const fileName = firstItem?.metadata?.file;

  // 如果有原始 XLIFF 文件，就更新它
  if (
    fileName &&
    AppState.fileMetadata[fileName]?.originalContent &&
    (AppState.fileMetadata[fileName].extension === "xliff" ||
      AppState.fileMetadata[fileName].extension === "xlf")
  ) {
    return updateXLIFFContent(
      items,
      AppState.fileMetadata[fileName].originalContent
    );
  }

  // 否则生成新的 XLIFF
  return generateNewXLIFF(items);
}

// 把译文写入 XLIFF <target>：
//  - 若译文是合法 XML 片段（含 <g>、<x/> 等内联标记）→ 插入真实节点，保留内联结构
//  - 否则按纯文本写入（由序列化器负责转义，避免二次转义）
function __setXliffTargetContent(xmlDoc, target, value) {
  const text = value == null ? "" : String(value);
  // 先清空
  while (target.firstChild) target.removeChild(target.firstChild);

  if (text.indexOf("<") !== -1) {
    try {
      const ns = xmlDoc.documentElement.namespaceURI || null;
      const wrapped = new DOMParser().parseFromString(
        '<root xmlns="' + (ns || "") + '">' + text + "</root>",
        "application/xml"
      );
      if (wrapped && !wrapped.querySelector("parsererror")) {
        const nodes = Array.prototype.slice.call(wrapped.documentElement.childNodes);
        nodes.forEach(function (n) {
          target.appendChild(xmlDoc.importNode(n, true));
        });
        return;
      }
    } catch (e) {
      // 落到纯文本分支
    }
  }
  target.textContent = text;
}

// 更新原始 XLIFF 内容
function updateXLIFFContent(items, originalContent) {
  try {
    // 命名空间感知的查询：querySelectorAll("trans-unit") 在带默认命名空间的
    // XLIFF 文档（1.2 的 urn:oasis:names:tc:xliff:document:1.2、2.0 的同族命名空间）
    // 上匹配不到任何元素，导致导出整体变成空操作。统一改用 getElementsByTagNameNS("*", ...)。
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalContent, "application/xml");

    const nsAll = (root, tag) => {
      const list = root.getElementsByTagNameNS("*", tag);
      return list ? Array.prototype.slice.call(list) : [];
    };

    const serializer = new XMLSerializer();

    // 与 parsers/xliff.js 的 serializeChildren 保持一致：
    // 导出侧必须用「序列化后的子节点」去比对，因为解析器存进 sourceText 的正是这个形式
    // （含实体、<g> 等内联标记）。此前用 source.textContent（已解码、已剥标签）比对，
    // 导致任何带实体或内联标记的源文永远匹配不上，译文静默丢失。
    function serializeChildren(element) {
      if (!element) return "";
      let out = "";
      const nodes = element.childNodes || [];
      for (let i = 0; i < nodes.length; i++) {
        out += serializer.serializeToString(nodes[i]);
      }
      out = out.replace(/\sxmlns(?:="[^"]*"|:[\w-]+="[^"]*")/g, "");
      return (out || element.textContent || "").trim();
    }

    const normalize = (s) => (s == null ? "" : String(s).replace(/\s+/g, " ").trim());

    // 收集待更新的 (source, target) 对，兼容 XLIFF 1.2 <trans-unit> 与 2.0 <unit>/<segment>
    const pairs = [];
    const pushPair = (unitEl, sourceEl, targetEl, position) => {
      if (!sourceEl) return;
      pairs.push({
        unitId: unitEl ? unitEl.getAttribute("id") : null,
        position,
        sourceEl,
        targetEl,
        serialized: serializeChildren(sourceEl),
        textContent: normalize(sourceEl.textContent),
      });
    };

    const transUnits = nsAll(xmlDoc, "trans-unit");
    if (transUnits.length > 0) {
      transUnits.forEach((tu, index) => {
        pushPair(tu, nsAll(tu, "source")[0], nsAll(tu, "target")[0], `unit-${index + 1}`);
      });
    } else {
      nsAll(xmlDoc, "unit").forEach((unit, index) => {
        const segments = nsAll(unit, "segment");
        if (segments.length > 0) {
          segments.forEach((seg, segmentIndex) => {
            pushPair(unit, nsAll(seg, "source")[0], nsAll(seg, "target")[0], `unit-${index + 1}-segment-${segmentIndex + 1}`);
          });
        } else {
          pushPair(unit, nsAll(unit, "source")[0], nsAll(unit, "target")[0], `unit-${index + 1}`);
        }
      });
    }

    if (pairs.length === 0) return generateNewXLIFF(items);

    const translated = items.filter(
      (it) => it && it.targetText && String(it.targetText).trim()
    );
    const legacyTranslated = translated.filter(it => !it.metadata?.position);

    // 按 unitId 建索引（XLIFF 1.2 每个 trans-unit 唯一；2.0 同 unit 的多个 segment 用队列顺序消费）。
    // 有了 id 定位，重复源文（"Open"/"Cancel"/"OK"）才不会全部写成同一条译文。
    const byUnitId = new Map();
    legacyTranslated.forEach((it) => {
      const id = it?.metadata?.unitId;
      if (id == null) return;
      const key = String(id);
      if (!byUnitId.has(key)) byUnitId.set(key, []);
      byUnitId.get(key).push(it);
    });

    const used = new Set();
    const takenByUnitId = new Map();

    pairs.forEach((pair) => {
      let item = translated.find(it => it.metadata?.position === pair.position) || null;

      if (!item && pair.unitId != null && byUnitId.has(String(pair.unitId))) {
        const queue = byUnitId.get(String(pair.unitId));
        const usedCount = takenByUnitId.get(String(pair.unitId)) || 0;
        if (usedCount < queue.length) {
          item = queue[usedCount];
          takenByUnitId.set(String(pair.unitId), usedCount + 1);
        }
      }

      if (!item) {
        // 文本回退：优先按序列化形式精确匹配，再按规范化文本匹配。
        // find + used 集合：避免重复源文全部命中同一条（旧实现的另一个缺陷）。
        item =
          legacyTranslated.find(
            (it) => !used.has(it) && serializeChildrenFromString(it.sourceText) === pair.serialized
          ) ||
          legacyTranslated.find(
            (it) => !used.has(it) && normalize(it.sourceText) === pair.textContent
          ) ||
          null;
      }

      if (!item) return;
      used.add(item);

      // 更新或创建 target 元素
      let target = pair.targetEl;
      if (!target) {
        target = xmlDoc.createElementNS(
          pair.sourceEl.namespaceURI || xmlDoc.documentElement.namespaceURI,
          "target"
        );
        pair.sourceEl.parentNode.insertBefore(target, pair.sourceEl.nextSibling);
      }
      // 写入译文：targetText 可能是「含内联标记的序列化片段」（解析器存的就是这个形式，
      // 例如 '请点击 <g id="1">这里</g>'）。
      // 直接赋 textContent 会把标记转义成字面量 &lt;g&gt;，破坏 XLIFF 内联结构；
      // 因此先尝试按 XML 片段解析，成功则替换为真实节点，失败再退回纯文本。
      __setXliffTargetContent(xmlDoc, target, item.targetText);

      // 设置状态
      if (
        item.status === "translated" ||
        item.status === "edited" ||
        item.status === "approved"
      ) {
        target.setAttribute("state", "translated");
      }

      if (item.status === "approved") {
        const unitEl = pair.sourceEl.closest
          ? pair.sourceEl.closest("trans-unit, unit")
          : null;
        if (unitEl) unitEl.setAttribute("approved", "yes");
      }
    });

    // 序列化回字符串
    const outSerializer = new XMLSerializer();
    return outSerializer.serializeToString(xmlDoc);
  } catch (error) {
    (loggers.app || console).error("更新XLIFF失败:", error);
    return generateNewXLIFF(items);
  }
}

// 把已存进 item.sourceText 的「序列化片段」做同样的规范化处理，
// 使其可与文档内重新序列化出来的结果直接比较。
function serializeChildrenFromString(text) {
  if (text == null) return "";
  return String(text).replace(/\sxmlns(?:="[^"]*"|:[\w-]+="[^"]*")/g, "").trim();
}

// 生成新的 XLIFF
function generateNewXLIFF(items) {
  const sourceLang =
    AppState.project?.sourceLanguage ||
    DOMCache.get("sourceLanguage")?.value ||
    "en";
  const targetLang =
    AppState.project?.targetLanguage ||
    DOMCache.get("targetLanguage")?.value ||
    "zh";

  let xliff = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xliff +=
    '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n';
  xliff += `  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">\n`;
  xliff += "    <body>\n";

  items.forEach((item, index) => {
    const transUnitId = item.id || `trans-${index + 1}`;
    xliff += `      <trans-unit id="${escapeXml(transUnitId)}"`;

    // 添加状态属性
    if (item.status === "approved") {
      xliff += ` approved="yes"`;
    }

    xliff += ">\n";

    // Source
    if (item.sourceText) {
      xliff += `        <source>${escapeXml(item.sourceText)}</source>\n`;
    }

    // Target
    if (item.targetText) {
      const state =
        item.status === "translated" ||
        item.status === "edited" ||
        item.status === "approved"
          ? "translated"
          : "needs-translation";
      xliff += `        <target state="${state}">${escapeXml(
        item.targetText
      )}</target>\n`;
    }

    // Context
    if (item.context) {
      xliff += `        <note>${escapeXml(item.context)}</note>\n`;
    }

    xliff += "      </trans-unit>\n";
  });

  xliff += "    </body>\n";
  xliff += "  </file>\n";
  xliff += "</xliff>";
  return xliff;
}
