// ==================== CSV 解析器 ====================
/**
 * CSV 解析器：支持解析 CSV/TSV 格式的本地化文件
 * 支持格式：
 * - 标准 CSV (逗号分隔)
 * - TSV (制表符分隔)
 * - 自定义分隔符
 */

/**
 * 解析 CSV 文件
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @param {Object} options - 解析选项
 * @returns {Array} 翻译项数组
 */
function parseCSV(content, fileName, options = {}) {
  const {
    delimiter = ',',
    hasHeader = true,
    sourceColumn = 0,
    targetColumn = 1,
    idColumn = -1,
    contextColumn = -1
  } = options;
  
  const items = [];
  
  try {
    const lines = parseCSVLines(content, delimiter);
    
    // 跳过空文件
    if (lines.length === 0) {
      return items;
    }
    
    // 处理表头
    let startRow = 0;
    let headers = [];
    
    if (hasHeader && lines.length > 0) {
      headers = lines[0];
      startRow = 1;
    }
    
    // 自动检测列
    let srcCol = sourceColumn;
    let tgtCol = targetColumn;
    let idCol = idColumn;
    let ctxCol = contextColumn;
    
    if (hasHeader) {
      const headerLower = headers.map(h => h.toLowerCase().trim());
      
      // 自动检测源语言列
      const srcNames = ['source', 'src', 'original', 'en', 'english', 'key', 'msgid'];
      for (let i = 0; i < headerLower.length; i++) {
        if (srcNames.some(n => headerLower[i].includes(n))) {
          srcCol = i;
          break;
        }
      }
      
      // 自动检测目标语言列
      const tgtNames = ['target', 'tgt', 'translation', 'translated', 'zh', 'chinese', 'value', 'msgstr'];
      for (let i = 0; i < headerLower.length; i++) {
        if (tgtNames.some(n => headerLower[i].includes(n))) {
          tgtCol = i;
          break;
        }
      }
      
      // 自动检测ID列
      const idNames = ['id', 'key', 'name', 'identifier'];
      for (let i = 0; i < headerLower.length; i++) {
        if (idNames.some(n => headerLower[i] === n)) {
          idCol = i;
          break;
        }
      }
      
      // 自动检测上下文列
      const ctxNames = ['context', 'ctx', 'comment', 'note', 'description'];
      for (let i = 0; i < headerLower.length; i++) {
        if (ctxNames.some(n => headerLower[i].includes(n))) {
          ctxCol = i;
          break;
        }
      }
    }
    
    // 解析数据行
    for (let i = startRow; i < lines.length; i++) {
      const row = lines[i];
      
      // 跳过空行
      if (row.length === 0 || (row.length === 1 && !row[0].trim())) {
        continue;
      }
      
      const sourceText = row[srcCol]?.trim() || '';
      const targetText = row[tgtCol]?.trim() || '';
      const id = idCol >= 0 ? row[idCol]?.trim() : '';
      const context = ctxCol >= 0 ? row[ctxCol]?.trim() : '';
      
      // 跳过空源文本
      if (!sourceText) continue;
      
      items.push({
        id: id || `csv-${items.length + 1}`,
        sourceText: sourceText,
        targetText: targetText,
        context: context || `CSV row: ${i + 1}`,
        status: targetText ? 'translated' : 'pending',
        qualityScore: targetText ? 85 : 0,
        issues: [],
        metadata: {
          file: fileName,
          row: i + 1,
          sourceColumn: srcCol,
          targetColumn: tgtCol,
          position: `row-${i + 1}`
        }
      });
    }
    
  } catch (error) {
    throw new Error(`CSV解析错误: ${error.message}`);
  }
  
  return items;
}

/**
 * 解析 CSV 行（处理引号和换行）
 * @param {string} content - CSV 内容
 * @param {string} delimiter - 分隔符
 * @returns {Array<Array<string>>} 二维数组
 */
function parseCSVLines(content, delimiter = ',') {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // 转义的引号
          currentField += '"';
          i++;
        } else {
          // 结束引号
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentLine.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        currentLine.push(currentField);
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
      } else if (char === '\r') {
        // 忽略 CR
      } else {
        currentField += char;
      }
    }
  }
  
  // 处理最后一个字段
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * 导出 CSV 格式
 * @param {Array} items - 翻译项数组
 * @param {Object} options - 导出选项
 * @returns {string} CSV 内容
 */
function exportCSV(items, options = {}) {
  const {
    delimiter = ',',
    includeHeader = true,
    includeId = true,
    includeContext = true
  } = options;
  
  const lines = [];
  
  // 添加表头
  if (includeHeader) {
    const headers = [];
    if (includeId) headers.push('ID');
    headers.push('Source', 'Target');
    if (includeContext) headers.push('Context');
    lines.push(headers.map(h => escapeCSVField(h, delimiter)).join(delimiter));
  }
  
  // 添加数据行
  for (const item of items) {
    const row = [];
    if (includeId) row.push(item.id || '');
    row.push(item.sourceText || '');
    row.push(item.targetText || '');
    if (includeContext) row.push(item.context || '');
    lines.push(row.map(f => escapeCSVField(f, delimiter)).join(delimiter));
  }
  
  return lines.join('\n');
}

/**
 * 转义 CSV 字段
 * @param {string} field - 字段值
 * @param {string} delimiter - 分隔符
 * @returns {string} 转义后的字段
 */
function escapeCSVField(field, delimiter = ',') {
  if (!field) return '';
  
  const str = String(field);
  
  // 如果包含特殊字符，需要用引号包裹
  if (str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * 解析 TSV 文件（制表符分隔）
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @returns {Array} 翻译项数组
 */
function parseTSV(content, fileName) {
  return parseCSV(content, fileName, { delimiter: '\t' });
}

// 暴露到全局
window.parseCSV = parseCSV;
window.parseCSVLines = parseCSVLines;
window.exportCSV = exportCSV;
window.escapeCSVField = escapeCSVField;
window.parseTSV = parseTSV;
