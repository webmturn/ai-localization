// ==================== YAML 解析器（js-yaml 增强版） ====================
// 使用 js-yaml 4.1.0（本地化 lib/js-yaml/js-yaml.min.js）提供完整 YAML 支持：
// - 嵌套对象、数组、多行块（| / >）、锚点/别名、多文档
// - 完整解析库不可用时明确报错，避免复杂 YAML 被静默误解析
// 支持格式：Rails i18n、扁平键值对、嵌套对象

// ==================== 降级：内置简单解析器（js-yaml 不可用时） ====================
function __parseYAMLSimple(content, fileName) {
  const items = [];
  try {
    const lines = content.split('\n');
    const stack = [{ indent: -1, path: '' }];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const indent = line.search(/\S/);
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // 剥离内联注释（引号值不处理）
      if (value && !value.startsWith('"') && !value.startsWith("'")) {
        const hashIdx = value.indexOf(' #');
        if (hashIdx !== -1) value = value.substring(0, hashIdx).trim();
      }

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parentPath = stack[stack.length - 1].path;
      const currentPath = parentPath ? parentPath + '.' + key : key;

      if (value && !value.startsWith('|') && !value.startsWith('>')) {
        let cleanValue = value;
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          cleanValue = value.slice(1, -1);
        }
        if (cleanValue && cleanValue !== '~' && cleanValue !== 'null') {
          items.push({
            id: 'yaml-' + (items.length + 1),
            sourceText: cleanValue,
            targetText: '',
            context: 'YAML path: ' + currentPath,
            status: 'pending',
            qualityScore: 0,
            issues: [],
            metadata: {
              file: fileName,
              path: currentPath,
              line: i + 1,
              position: 'line-' + (i + 1),
            },
          });
        }
      }
      stack.push({ indent, path: currentPath });
    }
  } catch (error) {
    throw new Error('YAML解析错误: ' + error.message);
  }
  return items;
}

// ==================== 主解析入口（js-yaml 完整版） ====================
/**
 * 解析 YAML 文件
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @returns {Promise<Array>} 翻译项数组
 */
async function parseYAML(content, fileName) {
  // 尝试加载 js-yaml；失败时降级简单解析器
  try {
    if (typeof window === 'undefined' || typeof window.jsyaml === 'undefined') {
      const ensure = window.App?.services?.ensureJsYaml;
      if (typeof ensure === 'function') {
        await ensure();
      }
    }
  } catch (e) {
    throw new Error('YAML 解析库加载失败：' + e.message);
  }

  if (typeof window === 'undefined' || typeof window.jsyaml === 'undefined') {
    throw new Error('YAML 解析库不可用，请重试加载页面');
  }

  const items = [];
  try {
    const documents = window.jsyaml.loadAll(content);
    const ancestors = new Set();

    // 递归提取字符串值
    function traverse(value, path, tokens, documentIndex) {
      if (typeof value === 'string') {
        if (!value.trim()) return;
        items.push({
          id: 'yaml-' + (items.length + 1),
          sourceText: value,
          targetText: '',
          context: (documents.length > 1 ? 'YAML document ' + (documentIndex + 1) + ' · ' : 'YAML path: ') + (path || '$'),
          status: 'pending',
          qualityScore: 0,
          issues: [],
          metadata: {
            file: fileName,
            path: path,
            pathTokens: tokens,
            documentIndex,
            documentCount: documents.length,
            identity: JSON.stringify(['yaml', documentIndex, tokens]),
            position: 'document-' + (documentIndex + 1) + '-path-' + path,
          },
        });
        return;
      }
      if (value === null || value === undefined) return;
      if (typeof value === 'number' || typeof value === 'boolean') return;
      if (typeof value === 'object') {
        if (ancestors.has(value)) throw new Error('不支持循环引用的 YAML 锚点');
        ancestors.add(value);
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          traverse(value[i], path + '[' + i + ']', tokens.concat(i), documentIndex);
        }
        ancestors.delete(value);
        return;
      }
      if (typeof value === 'object') {
        for (const k of Object.keys(value)) {
          const nextPath = path ? path + '.' + k : k;
          traverse(value[k], nextPath, tokens.concat(k), documentIndex);
        }
        ancestors.delete(value);
      }
    }

    documents.forEach((data, i) => traverse(data, '', [], i));
  } catch (error) {
    throw new Error('YAML解析错误: ' + error.message);
  }
  return items;
}

// ==================== 导出 YAML（js-yaml 完整版） ====================
/**
 * 导出 YAML 格式
 * @param {Array} items - 翻译项数组
 * @param {Object} options - 导出选项
 * @returns {Promise<string>} YAML 内容
 */
async function exportYAML(items, options = {}) {
  const { indent = 2, useQuotes = true } = options;

  // 确保 js-yaml 可用
  try {
    if (typeof window === 'undefined' || typeof window.jsyaml === 'undefined') {
      const ensure = window.App?.services?.ensureJsYaml;
      if (typeof ensure === 'function') {
        await ensure();
      }
    }
  } catch (e) {
    // 降级：保留旧导出逻辑（此处直接抛错提示，由调用方处理）
    throw new Error('js-yaml 不可用，无法导出 YAML');
  }
  if (typeof window === 'undefined' || typeof window.jsyaml === 'undefined') {
    throw new Error('js-yaml 不可用，无法导出 YAML');
  }

  // 入参保护：非数组输入此前会在 for...of 处抛裸 TypeError
  // （"items is not iterable"），调用方拿到的是无上下文的错误。
  if (items === null || items === undefined) items = [];
  if (!Array.isArray(items)) {
    throw new Error('YAML 导出需要传入数组，实际收到 ' + typeof items);
  }

  // 按路径分组（优先使用解析器输出的 pathTokens，避免键名含 `.`/`[` 时的歧义）
  const processed = new Map();
  for (const item of items) {
    const rawTokens = item.metadata?.pathTokens;
    const tokens =
      Array.isArray(rawTokens)
        ? rawTokens.map((t) => (typeof t === 'number' ? t : String(t)))
        : null;
    const path = item.metadata?.path || '';
    if (!tokens && !path) continue;
    const value = item.targetText || item.sourceText;
    if (!value) continue;
    const documentIndex = Number.isInteger(item.metadata?.documentIndex) ? item.metadata.documentIndex : 0;
    const key = documentIndex + ':' + (tokens ? 'T:' + JSON.stringify(tokens) : 'P:' + path);
    processed.set(key, { tokens, path, value, documentIndex });
  }

  // 没有任何条目带路径信息时，直接报错而不是导出空对象 {}。
  // 这些条目来自 PO / XLIFF / Android / RESX / iOS / CSV 等格式（它们的 metadata 里
  // 只有 key/resourceId，没有 YAML/JSON 那样的点分路径），
  // 之前的实现会静默 dump({})，用户拿到的是一个空文件却提示导出成功。
  if (processed.size === 0 && Array.isArray(items) && items.length > 0) {
    throw new Error(
      "YAML 导出需要 items 带有 metadata.path（仅 JSON/YAML 来源具备）；" +
        "当前 " + items.length + " 个条目均无路径信息，请改用与源文件匹配的导出格式"
    );
  }

  /** 把「以 $ 为根、键名中转义 \. 与 \[」的路径切成段 */
  const splitPathParts = (path) => {
    let s = String(path);
    if (s.startsWith('$')) s = s.slice(1);
    const parts = [];
    let cur = '';
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\' && i + 1 < s.length) {
        cur += s[i + 1];
        i += 2;
        continue;
      }
      if (ch === '.') {
        if (cur !== '') parts.push(cur);
        cur = '';
        i++;
        continue;
      }
      if (ch === '[') {
        if (cur !== '') parts.push(cur);
        cur = '';
        const end = s.indexOf(']', i);
        if (end === -1) return parts;
        parts.push(s.slice(i, end + 1)); // 保留 "[n]" 形态，交给下面的分支处理
        i = end + 1;
        continue;
      }
      cur += ch;
      i++;
    }
    if (cur !== '') parts.push(cur);
    return parts;
  };

  // 构建嵌套结构（支持数组下标；根级数组需要容器本身是数组，因此先探测）
  const entries = [...processed.values()];
  const documentCount = Math.max(1, ...items.map(item => Number(item.metadata?.documentCount) || 1), ...entries.map(e => e.documentIndex + 1));
  const documents = Array.from({ length: documentCount }, (_, index) => entries.some(e => e.documentIndex === index &&
    (e.tokens ? typeof e.tokens[0] === 'number' : /^\$\[\d+\]/.test(String(e.path)))) ? [] : {});
  const isIndexPart = (p) => /^\[?\d+\]?$/.test(String(p == null ? '' : p).trim());

  for (const entry of entries) {
    const value = entry.value;
    const result = documents[entry.documentIndex];
    if (entry.tokens) {
      if (!entry.tokens.length) { documents[entry.documentIndex] = value; continue; }
      let current = result;
      entry.tokens.forEach((part, index) => {
        if (index === entry.tokens.length - 1) Object.defineProperty(current, part, { value, writable: true, enumerable: true, configurable: true });
        else {
          if (!Object.prototype.hasOwnProperty.call(current, part)) Object.defineProperty(current, part, { value: typeof entry.tokens[index + 1] === 'number' ? [] : {}, writable: true, enumerable: true, configurable: true });
          current = current[part];
        }
      });
      continue;
    }
    // 有 pathTokens 时直接用真实键/下标（无歧义）；否则回退到路径字符串解析
    const parts = entry.tokens
      ? entry.tokens.map((t) => (typeof t === 'number' ? `[${t}]` : String(t)))
      : splitPathParts(entry.path);
    if (parts.length === 0) continue;
    let current = result;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const arrMatch = part.match(/^(.*)\[(\d+)\]$/);
      const isLast = i === parts.length - 1;

      if (arrMatch) {
        const key = arrMatch[1];
        const idx = parseInt(arrMatch[2], 10);

        if (key === '') {
          // 根级数组：容器本身就是数组
          if (isLast) {
            current[idx] = value;
          } else {
            if (!current[idx]) current[idx] = isIndexPart(parts[i + 1]) ? [] : {};
            current = current[idx];
          }
        } else {
          if (!Array.isArray(current[key])) current[key] = [];
          if (isLast) {
            current[key][idx] = value;
          } else {
            if (!current[key][idx]) current[key][idx] = isIndexPart(parts[i + 1]) ? [] : {};
            current = current[key][idx];
          }
        }
      } else {
        if (isLast) {
          current[part] = value;
        } else {
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = isIndexPart(parts[i + 1]) ? [] : {};
          }
          current = current[part];
        }
      }
    }
  }

  const indentStr = ' '.repeat(indent);
  const options2 = { indent: indent };
  if (useQuotes) options2.forceQuotes = true;
  return documents.map(result => window.jsyaml.dump(result, options2)).join('---\n');
}

// 暴露到全局（同步兼容包装：老调用方仍可调用，返回 Promise 时需 await）
window.parseYAML = parseYAML;
window.exportYAML = exportYAML;
window.__parseYAMLSimple = __parseYAMLSimple;

// ==================== 注册到解析器注册表 ====================
// typeof 守卫：本文件被单独加载（单元测试/复用）时跳过注册
if (typeof ParserRegistry !== "undefined" && typeof ParserRegistry.register === "function") {
  ParserRegistry.register({
    id: "yaml",
    label: "YAML",
    extensions: ["yaml", "yml"],
    parse: parseYAML,
  });
}
