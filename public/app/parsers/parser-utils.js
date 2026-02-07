// ==================== 解析器工具类 ====================
/**
 * 解析器工具类：提供通用的解析辅助功能
 * 增强解析能力，统一错误处理
 */

/**
 * 解析器工具类
 */
class ParserUtils {
  /**
   * 检测文件编码
   * @param {ArrayBuffer} buffer - 文件缓冲区
   * @returns {string} 编码名称
   */
  static detectEncoding(buffer) {
    const bytes = new Uint8Array(buffer);
    
    // UTF-8 BOM
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return 'utf-8';
    }
    
    // UTF-16 LE BOM
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return 'utf-16le';
    }
    
    // UTF-16 BE BOM
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return 'utf-16be';
    }
    
    // UTF-32 LE BOM
    if (bytes[0] === 0xFF && bytes[1] === 0xFE && bytes[2] === 0x00 && bytes[3] === 0x00) {
      return 'utf-32le';
    }
    
    // 默认 UTF-8
    return 'utf-8';
  }
  
  /**
   * 清理文本内容
   * @param {string} text - 原始文本
   * @returns {string} 清理后的文本
   */
  static cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')  // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/^\uFEFF/, '')   // 移除 BOM
      .trim();
  }
  
  /**
   * 提取 XML 文本内容（保留内联标签）
   * @param {Element} element - XML 元素
   * @returns {string} 文本内容
   */
  static extractXMLContent(element) {
    if (!element) return '';
    
    const serializer = new XMLSerializer();
    let content = '';
    
    for (const node of element.childNodes) {
      content += serializer.serializeToString(node);
    }
    
    return content.trim() || element.textContent?.trim() || '';
  }
  
  /**
   * 检测 XML 文件类型
   * @param {string} content - XML 内容
   * @returns {string} 文件类型
   */
  static detectXMLType(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    
    if (doc.querySelector('parsererror')) {
      return 'invalid';
    }
    
    const root = doc.documentElement;
    const rootName = root?.tagName?.toLowerCase();
    
    // XLIFF
    if (rootName === 'xliff') {
      return 'xliff';
    }
    
    // Android Resources
    if (rootName === 'resources' && root.querySelector('string')) {
      return 'android';
    }
    
    // iOS Strings (PLIST)
    if (rootName === 'plist') {
      return 'ios-plist';
    }
    
    // Qt TS
    if (rootName === 'ts') {
      return 'qt-ts';
    }
    
    // .NET RESX
    if (rootName === 'root' && root.querySelector('data[name]')) {
      return 'resx';
    }
    
    return 'generic-xml';
  }
  
  /**
   * 验证 JSON 结构
   * @param {string} content - JSON 内容
   * @returns {Object} 验证结果
   */
  static validateJSON(content) {
    try {
      const parsed = JSON.parse(content);
      return {
        valid: true,
        type: Array.isArray(parsed) ? 'array' : 'object',
        keys: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        position: this._extractJSONErrorPosition(error.message)
      };
    }
  }
  
  /**
   * 提取 JSON 错误位置
   * @private
   */
  static _extractJSONErrorPosition(message) {
    const match = message.match(/position (\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  
  /**
   * 检测 PO 文件格式
   * @param {string} content - PO 内容
   * @returns {Object} 格式信息
   */
  static detectPOFormat(content) {
    const hasPlural = content.includes('msgid_plural');
    const hasContext = content.includes('msgctxt');
    const encoding = content.match(/"Content-Type:.*charset=([^\\]+)/)?.[1] || 'utf-8';
    
    return {
      hasPlural,
      hasContext,
      encoding,
      messageCount: (content.match(/^msgid\s+"/gm) || []).length
    };
  }
  
  /**
   * 标准化翻译项
   * @param {Object} item - 翻译项
   * @param {string} format - 格式类型
   * @param {string} fileName - 文件名
   * @returns {Object} 标准化的翻译项
   */
  static normalizeItem(item, format, fileName) {
    return {
      id: item.id || `${format}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceText: item.sourceText || '',
      targetText: item.targetText || '',
      context: item.context || '',
      status: item.targetText ? 'translated' : 'pending',
      qualityScore: item.targetText ? 85 : 0,
      issues: [],
      metadata: {
        file: fileName,
        format: format,
        ...item.metadata
      }
    };
  }
  
  /**
   * 批量标准化翻译项
   * @param {Array} items - 翻译项数组
   * @param {string} format - 格式类型
   * @param {string} fileName - 文件名
   * @returns {Array} 标准化的翻译项数组
   */
  static normalizeItems(items, format, fileName) {
    return items.map((item, index) => {
      const normalized = this.normalizeItem(item, format, fileName);
      if (!normalized.id || normalized.id.startsWith(`${format}-`)) {
        normalized.id = `${format}-${index + 1}`;
      }
      return normalized;
    });
  }
  
  /**
   * 合并重复项
   * @param {Array} items - 翻译项数组
   * @returns {Array} 合并后的数组
   */
  static mergeeDuplicates(items) {
    const seen = new Map();
    const result = [];
    
    for (const item of items) {
      const key = item.sourceText;
      if (seen.has(key)) {
        // 保留有翻译的版本
        const existing = seen.get(key);
        if (!existing.targetText && item.targetText) {
          result[result.indexOf(existing)] = item;
          seen.set(key, item);
        }
      } else {
        seen.set(key, item);
        result.push(item);
      }
    }
    
    return result;
  }
  
  /**
   * 过滤空项
   * @param {Array} items - 翻译项数组
   * @returns {Array} 过滤后的数组
   */
  static filterEmpty(items) {
    return items.filter(item => 
      item.sourceText && item.sourceText.trim().length > 0
    );
  }
  
  /**
   * 统计解析结果
   * @param {Array} items - 翻译项数组
   * @returns {Object} 统计信息
   */
  static getStats(items) {
    const total = items.length;
    const translated = items.filter(i => i.status === 'translated').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const empty = items.filter(i => !i.sourceText?.trim()).length;
    
    return {
      total,
      translated,
      pending,
      empty,
      progress: total > 0 ? Math.round((translated / total) * 100) : 0
    };
  }
}

/**
 * 增强版解析器管理器
 */
class EnhancedParserManager {
  constructor() {
    this.parsers = new Map();
    this.formatDetectors = [];
    this._registerDefaultParsers();
  }
  
  /**
   * 注册默认解析器
   * @private
   */
  _registerDefaultParsers() {
    // 注册格式检测器
    this.registerFormatDetector((content, fileName) => {
      const ext = fileName.split('.').pop().toLowerCase();
      
      const extMap = {
        'json': 'json',
        'xliff': 'xliff',
        'xlf': 'xliff',
        'po': 'po',
        'pot': 'po',
        'strings': 'ios-strings',
        'ts': 'qt-ts',
        'resx': 'resx',
        'xml': 'xml',
        'txt': 'text'
      };
      
      return extMap[ext] || null;
    });
    
    // 注册内容检测器
    this.registerFormatDetector((content) => {
      // JSON 检测
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          JSON.parse(content);
          return 'json';
        } catch (e) {
          // JSON parse probe - expected to fail for non-JSON
        }
      }
      
      // XML 检测
      if (content.trim().startsWith('<?xml') || content.trim().startsWith('<')) {
        return ParserUtils.detectXMLType(content);
      }
      
      // PO 检测
      if (content.includes('msgid') && content.includes('msgstr')) {
        return 'po';
      }
      
      // iOS Strings 检测
      if (content.match(/^\s*"[^"]+"\s*=\s*"[^"]*"\s*;/m)) {
        return 'ios-strings';
      }
      
      return null;
    });
  }
  
  /**
   * 注册格式检测器
   * @param {Function} detector - 检测函数
   */
  registerFormatDetector(detector) {
    this.formatDetectors.push(detector);
  }
  
  /**
   * 注册解析器
   * @param {string} format - 格式名称
   * @param {Function} parser - 解析函数
   */
  registerParser(format, parser) {
    this.parsers.set(format, parser);
  }
  
  /**
   * 检测文件格式
   * @param {string} content - 文件内容
   * @param {string} fileName - 文件名
   * @returns {string|null} 格式名称
   */
  detectFormat(content, fileName) {
    for (const detector of this.formatDetectors) {
      const format = detector(content, fileName);
      if (format) return format;
    }
    return null;
  }
  
  /**
   * 解析文件
   * @param {string} content - 文件内容
   * @param {string} fileName - 文件名
   * @param {Object} options - 解析选项
   * @returns {Object} 解析结果
   */
  parse(content, fileName, options = {}) {
    const startTime = performance.now();
    
    try {
      // 清理内容
      const cleanedContent = ParserUtils.cleanText(content);
      
      // 检测格式
      const format = options.format || this.detectFormat(cleanedContent, fileName);
      if (!format) {
        throw new Error(`无法识别文件格式: ${fileName}`);
      }
      
      // 获取解析器
      let items = [];
      
      // 使用全局解析函数
      switch (format) {
        case 'json':
          if (typeof parseJSON === 'function') {
            items = parseJSON(cleanedContent, fileName);
          }
          break;
        case 'xliff':
          if (typeof parseXLIFF === 'function') {
            items = parseXLIFF(cleanedContent, fileName);
          }
          break;
        case 'android':
          if (typeof parseAndroidXML === 'function') {
            items = parseAndroidXML(cleanedContent, fileName);
          }
          break;
        case 'ios-strings':
          if (typeof parseIOSStrings === 'function') {
            items = parseIOSStrings(cleanedContent, fileName);
          }
          break;
        case 'po':
          if (typeof parsePO === 'function') {
            items = parsePO(cleanedContent, fileName);
          }
          break;
        case 'qt-ts':
          if (typeof parseQtTS === 'function') {
            items = parseQtTS(cleanedContent, fileName);
          }
          break;
        case 'resx':
          if (typeof parseRESX === 'function') {
            items = parseRESX(cleanedContent, fileName);
          }
          break;
        case 'generic-xml':
        case 'xml':
          if (typeof parseGenericXML === 'function') {
            items = parseGenericXML(cleanedContent, fileName);
          }
          break;
        case 'text':
          if (typeof parseText === 'function') {
            items = parseText(cleanedContent, fileName);
          }
          break;
        default:
          throw new Error(`不支持的文件格式: ${format}`);
      }
      
      // 过滤空项
      if (options.filterEmpty !== false) {
        items = ParserUtils.filterEmpty(items);
      }
      
      // 合并重复项
      if (options.mergeDuplicates) {
        items = ParserUtils.mergeeDuplicates(items);
      }
      
      const endTime = performance.now();
      
      return {
        success: true,
        format,
        items,
        stats: ParserUtils.getStats(items),
        parseTime: Math.round(endTime - startTime)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        format: null,
        items: [],
        stats: { total: 0, translated: 0, pending: 0, empty: 0, progress: 0 }
      };
    }
  }
}

// 创建全局实例
const parserUtils = new ParserUtils();
const enhancedParserManager = new EnhancedParserManager();

// 暴露到全局
window.ParserUtils = ParserUtils;
window.EnhancedParserManager = EnhancedParserManager;
window.parserUtils = parserUtils;
window.enhancedParserManager = enhancedParserManager;
