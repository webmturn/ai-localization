// ==================== YAML 解析器（js-yaml 增强版） ====================
// 使用 js-yaml 4.1.0（本地化 lib/js-yaml/js-yaml.min.js）提供完整 YAML 支持：
// - 嵌套对象、数组、多行块（| / >）、锚点/别名、多文档
// - js-yaml 不可用（加载失败）时自动降级为内置简单解析器（仅基础格式）
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
    (window.loggers?.app || console).warn('js-yaml 加载失败，使用内置简单解析器:', e);
    return __parseYAMLSimple(content, fileName);
  }

  if (typeof window === 'undefined' || typeof window.jsyaml === 'undefined') {
    return __parseYAMLSimple(content, fileName);
  }

  const items = [];
  try {
    const data = window.jsyaml.load(content);
    if (data === null || data === undefined) return items;

    // 递归提取字符串值
    function traverse(value, path, lineHint) {
      if (typeof value === 'string') {
        items.push({
          id: 'yaml-' + (items.length + 1),
          sourceText: value,
          targetText: '',
          context: 'YAML path: ' + path,
          status: 'pending',
          qualityScore: 0,
          issues: [],
          metadata: {
            file: fileName,
            path: path,
            position: 'path-' + path,
          },
        });
        return;
      }
      if (value === null || value === undefined) return;
      if (typeof value === 'number' || typeof value === 'boolean') return;

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          traverse(value[i], path + '[' + i + ']', lineHint);
        }
        return;
      }
      if (typeof value === 'object') {
        for (const k of Object.keys(value)) {
          const nextPath = path ? path + '.' + k : k;
          traverse(value[k], nextPath, lineHint);
        }
      }
    }

    traverse(data, '', 0);
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

  // 按路径分组
  const processed = new Map();
  for (const item of items) {
    const path = item.metadata?.path || '';
    if (!path) continue;
    const value = item.targetText || item.sourceText;
    if (!value) continue;
    processed.set(path, value);
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

  // 构建嵌套结构（支持数组路径 [i]；路径以 $ 为根，需跳过根符号）
  // 根级数组（如 $[0]、$[0].name）需要容器本身是数组，因此先探测再决定 result 形态。
  const hasRootArray = [...processed.keys()].some((p) => /^\$\[\d+\]/.test(String(p)));
  const result = hasRootArray ? [] : {};
  const isIndexPart = (p) => /^\[?\d+\]?$/.test(String(p == null ? '' : p).trim());

  for (const [path, value] of processed) {
    // 与 parsers/json.js 保持一致：路径形如 $.app.title、$.menu[0].label、$[0].name。
    // 旧实现不跳过 "$"，会把全部内容错误地嵌套在一个名为 "$" 的顶层键下。
    // 注意只剥掉「单独的 $」，不能剥掉 "$[0]" 里的 $（否则根级数组会丢段）。
    const parts = String(path)
      .split('.')
      .filter((p) => p !== '')
      .map((p) => (p === '$' ? '' : p.startsWith('$[') ? p.slice(1) : p))
      .filter((p) => p !== '');
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
  return window.jsyaml.dump(result, options2);
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
