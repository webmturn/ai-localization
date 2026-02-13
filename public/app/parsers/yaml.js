// ==================== YAML 解析器 ====================
/**
 * YAML 解析器：支持解析 YAML 格式的本地化文件
 * 支持格式：
 * - Rails i18n 格式
 * - 扁平键值对格式
 * - 嵌套对象格式
 */

/**
 * 解析 YAML 文件
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @returns {Array} 翻译项数组
 */
function parseYAML(content, fileName) {
  const items = [];
  
  try {
    // 简单的 YAML 解析器（支持基本格式）
    const lines = content.split('\n');
    const stack = [{ indent: -1, path: '' }];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // 计算缩进
      const indent = line.search(/\S/);
      
      // 解析键值对
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      // 更新路径栈
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      const parentPath = stack[stack.length - 1].path;
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      
      // 如果有值，添加为翻译项
      if (value && !value.startsWith('|') && !value.startsWith('>')) {
        // 移除引号
        let cleanValue = value;
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          cleanValue = value.slice(1, -1);
        }
        
        // 跳过数组标记和特殊值
        if (cleanValue && cleanValue !== '~' && cleanValue !== 'null') {
          items.push({
            id: `yaml-${items.length + 1}`,
            sourceText: cleanValue,
            targetText: '',
            context: `YAML path: ${currentPath}`,
            status: 'pending',
            qualityScore: 0,
            issues: [],
            metadata: {
              file: fileName,
              path: currentPath,
              line: i + 1,
              position: `line-${i + 1}`
            }
          });
        }
      }
      
      // 添加到栈
      stack.push({ indent, path: currentPath });
    }
    
  } catch (error) {
    throw new Error(`YAML解析错误: ${error.message}`);
  }
  
  return items;
}

/**
 * 导出 YAML 格式
 * @param {Array} items - 翻译项数组
 * @param {Object} options - 导出选项
 * @returns {string} YAML 内容
 */
function exportYAML(items, options = {}) {
  const { indent = 2, useQuotes = true } = options;
  const lines = [];
  const processed = new Map();
  
  // 按路径分组
  for (const item of items) {
    const path = item.metadata?.path || item.context?.replace('YAML path: ', '');
    if (!path) continue;
    
    const value = item.targetText || item.sourceText;
    if (!value) continue;
    
    processed.set(path, value);
  }
  
  // 构建嵌套结构
  const result = {};
  for (const [path, value] of processed) {
    const keys = path.split('.');
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  // 转换为 YAML
  function toYAML(obj, level = 0) {
    const prefix = ' '.repeat(level * indent);
    const lines = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${prefix}${key}:`);
        lines.push(toYAML(value, level + 1));
      } else {
        const escapedValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const quotedValue = useQuotes ? `"${escapedValue}"` : value;
        lines.push(`${prefix}${key}: ${quotedValue}`);
      }
    }
    
    return lines.join('\n');
  }
  
  return toYAML(result);
}

// 暴露到全局
window.parseYAML = parseYAML;
window.exportYAML = exportYAML;
