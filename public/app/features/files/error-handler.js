// ==================== 文件处理错误处理器 ====================
/**
 * 文件处理模块专用错误处理器
 * 增强文件解析、验证和处理的错误处理能力
 */

/**
 * 增强版的文件验证函数
 * @param {File|FileList} files - 文件或文件列表
 * @param {Object} options - 验证选项
 * @returns {Object} 验证结果
 */
function validateFilesV2(files, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 50,
    allowedExtensions = [
      'json', 'xliff', 'xlf', 'po', 'pot', 'xml', 'resx', 'ts', 'strings', 'txt', 'csv'
    ],
    allowedMimeTypes = [
      'application/json',
      'application/xml',
      'text/xml',
      'text/plain',
      'text/csv',
      'application/octet-stream'
    ]
  } = options;
  
  const result = {
    valid: [],
    invalid: [],
    warnings: [],
    totalSize: 0
  };
  
  // 转换为数组
  const fileArray = files instanceof FileList ? Array.from(files) : 
                   Array.isArray(files) ? files : [files];
  
  // 检查文件数量
  if (fileArray.length > maxFiles) {
    const error = errorManager.createError(ERROR_CODES.FILE_TOO_LARGE,
      `文件数量 (${fileArray.length}) 超过限制 (${maxFiles})`, {
        fileCount: fileArray.length,
        maxFiles
      });
    result.invalid.push({ file: null, error });
    return result;
  }
  
  fileArray.forEach((file, index) => {
    try {
      // 基本文件对象验证
      const basicError = ErrorUtils.validateFile(file, {
        maxSize,
        allowedTypes: allowedMimeTypes,
        allowedExtensions
      });
      
      if (basicError) {
        result.invalid.push({ file, error: basicError, index });
        return;
      }
      
      // 文件名安全检查
      const nameError = validateFileName(file.name);
      if (nameError) {
        result.invalid.push({ file, error: nameError, index });
        return;
      }
      
      // 检查重复文件
      const duplicate = result.valid.find(v => v.file.name === file.name);
      if (duplicate) {
        result.warnings.push({
          file,
          message: `文件名重复: ${file.name}`,
          index
        });
      }
      
      result.valid.push({ file, index });
      result.totalSize += file.size;
      
    } catch (error) {
      const handledError = errorManager.handleError(error, {
        operation: 'fileValidation',
        fileName: file?.name,
        fileSize: file?.size,
        index
      });
      result.invalid.push({ file, error: handledError, index });
    }
  });
  
  // 检查总大小
  if (result.totalSize > maxSize * fileArray.length) {
    result.warnings.push({
      message: `总文件大小 (${(result.totalSize / 1024 / 1024).toFixed(2)}MB) 较大，可能影响性能`,
      totalSize: result.totalSize
    });
  }
  
  return result;
}

/**
 * 文件名安全验证
 * @param {string} fileName - 文件名
 * @returns {TranslationToolError|null} 验证错误或null
 */
function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '文件名无效', { fileName });
  }
  
  // 检查危险字符
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(fileName)) {
    return errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '文件名包含非法字符', { fileName, dangerousChars: dangerousChars.source });
  }
  
  // 检查长度
  if (fileName.length > 255) {
    return errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '文件名过长', { fileName, length: fileName.length });
  }
  
  // 检查保留名称（Windows）
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(fileName)) {
    return errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '文件名为系统保留名称', { fileName });
  }
  
  return null;
}

/**
 * 增强版的文件读取函数
 * @param {File} file - 文件对象
 * @param {Object} options - 读取选项
 * @returns {Promise<Object>} 读取结果
 */
async function readFileV2(file, options = {}) {
  const {
    encoding = 'auto',
    maxSize = 50 * 1024 * 1024, // 50MB
    timeout = 30000
  } = options;
  
  // 验证文件
  const validationError = ErrorUtils.validateFile(file, { maxSize });
  if (validationError) {
    throw validationError;
  }
  
  try {
    // 使用超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      let content;
      
      if (encoding === 'auto') {
        // 自动检测编码
        content = await detectEncodingAndRead(file, controller.signal);
      } else {
        // 指定编码读取
        content = await readFileWithEncoding(file, encoding, controller.signal);
      }
      
      clearTimeout(timeoutId);
      
      return {
        content,
        size: file.size,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        encoding: content.encoding || encoding
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw errorManager.createError(ERROR_CODES.TIMEOUT,
          '文件读取超时', { fileName: file.name, timeout });
      }
      
      throw error;
    }
    
  } catch (error) {
    if (error instanceof TranslationToolError) {
      throw error;
    }
    
    throw ErrorUtils.analyzeParseError(error, file.name, 'read');
  }
}

/**
 * 自动检测编码并读取文件
 * @param {File} file - 文件对象
 * @param {AbortSignal} signal - 中止信号
 * @returns {Promise<Object>} 读取结果
 */
async function detectEncodingAndRead(file, signal) {
  // 读取文件头部用于编码检测
  const headerSize = Math.min(1024, file.size);
  const headerBlob = file.slice(0, headerSize);
  const headerBuffer = await headerBlob.arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  
  let detectedEncoding = 'utf-8';
  let hasBOM = false;
  
  // 检测BOM
  if (headerBytes.length >= 3) {
    if (headerBytes[0] === 0xEF && headerBytes[1] === 0xBB && headerBytes[2] === 0xBF) {
      detectedEncoding = 'utf-8';
      hasBOM = true;
    } else if (headerBytes[0] === 0xFF && headerBytes[1] === 0xFE) {
      detectedEncoding = 'utf-16le';
      hasBOM = true;
    } else if (headerBytes[0] === 0xFE && headerBytes[1] === 0xFF) {
      detectedEncoding = 'utf-16be';
      hasBOM = true;
    }
  }
  
  // 如果没有BOM，尝试检测编码
  if (!hasBOM) {
    detectedEncoding = detectTextEncoding(headerBytes);
  }
  
  // 读取完整文件
  const content = await readFileWithEncoding(file, detectedEncoding, signal);
  
  return {
    ...content,
    encoding: detectedEncoding,
    hasBOM
  };
}

/**
 * 使用指定编码读取文件
 * @param {File} file - 文件对象
 * @param {string} encoding - 编码
 * @param {AbortSignal} signal - 中止信号
 * @returns {Promise<Object>} 读取结果
 */
async function readFileWithEncoding(file, encoding, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        let content = reader.result;
        
        // 移除BOM
        if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        
        resolve({
          content,
          encoding,
          size: file.size
        });
      } catch (error) {
        reject(ErrorUtils.analyzeParseError(error, file.name, 'encoding'));
      }
    };
    
    reader.onerror = () => {
      reject(ErrorUtils.analyzeParseError(reader.error, file.name, 'read'));
    };
    
    reader.onabort = () => {
      reject(errorManager.createError(ERROR_CODES.USER_CANCELLED,
        '文件读取被取消', { fileName: file.name }));
    };
    
    // 监听中止信号
    if (signal) {
      signal.addEventListener('abort', () => {
        reader.abort();
      });
    }
    
    // 根据编码选择读取方式
    if (encoding === 'binary') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, encoding);
    }
  });
}

/**
 * 简单的文本编码检测
 * @param {Uint8Array} bytes - 字节数组
 * @returns {string} 检测到的编码
 */
function detectTextEncoding(bytes) {
  // 检查是否为UTF-8
  let isUTF8 = true;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte > 127) {
      // 检查UTF-8多字节序列
      if ((byte & 0xE0) === 0xC0) {
        // 2字节序列
        if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) {
          isUTF8 = false;
          break;
        }
        i++;
      } else if ((byte & 0xF0) === 0xE0) {
        // 3字节序列
        if (i + 2 >= bytes.length || 
            (bytes[i + 1] & 0xC0) !== 0x80 || 
            (bytes[i + 2] & 0xC0) !== 0x80) {
          isUTF8 = false;
          break;
        }
        i += 2;
      } else if ((byte & 0xF8) === 0xF0) {
        // 4字节序列
        if (i + 3 >= bytes.length || 
            (bytes[i + 1] & 0xC0) !== 0x80 || 
            (bytes[i + 2] & 0xC0) !== 0x80 || 
            (bytes[i + 3] & 0xC0) !== 0x80) {
          isUTF8 = false;
          break;
        }
        i += 3;
      } else {
        isUTF8 = false;
        break;
      }
    }
  }
  
  if (isUTF8) {
    return 'utf-8';
  }
  
  // 简单检测：如果包含很多高位字节，可能是GBK或其他编码
  const highByteCount = bytes.filter(b => b > 127).length;
  const highByteRatio = highByteCount / bytes.length;
  
  if (highByteRatio > 0.3) {
    return 'gbk'; // 或其他本地编码
  }
  
  return 'utf-8'; // 默认UTF-8
}

/**
 * 增强版的文件解析函数
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @param {Object} options - 解析选项
 * @returns {Promise<Object>} 解析结果
 */
async function parseFileV2(content, fileName, options = {}) {
  const {
    format = 'auto',
    strict = false,
    maxItems = 10000
  } = options;
  
  try {
    // 内容预处理
    const preprocessed = preprocessFileContent(content, fileName);
    
    // 格式检测或使用指定格式
    const detectedFormat = format === 'auto' ? 
      detectFileFormat(preprocessed.content, fileName) : format;
    
    // 选择解析器
    const parser = getParser(detectedFormat);
    if (!parser) {
      throw errorManager.createError(ERROR_CODES.FILE_INVALID_FORMAT,
        `不支持的文件格式: ${detectedFormat}`, {
          fileName,
          detectedFormat,
          supportedFormats: getSupportedFormats()
        });
    }
    
    // 执行解析
    const parseResult = await safeAsync(
      () => parser(preprocessed.content, fileName, { strict, maxItems }),
      {
        context: {
          fileName,
          format: detectedFormat,
          contentLength: preprocessed.content.length
        },
        retryCount: 0 // 解析不重试
      }
    );
    
    if (!parseResult.success) {
      throw parseResult.error;
    }
    
    const items = parseResult.data;
    
    // 验证解析结果
    if (!Array.isArray(items)) {
      throw errorManager.createError(ERROR_CODES.FILE_PARSE_ERROR,
        '解析结果格式不正确', {
          fileName,
          format: detectedFormat,
          resultType: typeof items
        });
    }
    
    // 检查项目数量
    if (items.length > maxItems) {
      throw errorManager.createError(ERROR_CODES.FILE_TOO_LARGE,
        `翻译项数量 (${items.length}) 超过限制 (${maxItems})`, {
          fileName,
          itemCount: items.length,
          maxItems
        });
    }
    
    return {
      items,
      format: detectedFormat,
      metadata: {
        fileName,
        itemCount: items.length,
        encoding: preprocessed.encoding,
        size: content.length,
        parseTime: Date.now()
      }
    };
    
  } catch (error) {
    if (error instanceof TranslationToolError) {
      throw error;
    }
    
    throw ErrorUtils.analyzeParseError(error, fileName, format);
  }
}

/**
 * 文件内容预处理
 * @param {string} content - 原始内容
 * @param {string} fileName - 文件名
 * @returns {Object} 预处理结果
 */
function preprocessFileContent(content, fileName) {
  let processed = content;
  const info = {
    encoding: 'utf-8',
    hasBOM: false,
    lineEndings: 'mixed',
    fileName // 使用fileName参数
  };
  
  // 检测和移除BOM
  if (processed.charCodeAt(0) === 0xFEFF) {
    processed = processed.slice(1);
    info.hasBOM = true;
  }
  
  // 统一换行符
  const crlfCount = (processed.match(/\r\n/g) || []).length;
  const lfCount = (processed.match(/(?<!\r)\n/g) || []).length;
  const crCount = (processed.match(/\r(?!\n)/g) || []).length;
  
  if (crlfCount > lfCount && crlfCount > crCount) {
    info.lineEndings = 'crlf';
  } else if (lfCount > crCount) {
    info.lineEndings = 'lf';
  } else if (crCount > 0) {
    info.lineEndings = 'cr';
  }
  
  // 统一为LF
  processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 移除文件末尾的空白字符
  processed = processed.trimEnd();
  
  return {
    content: processed,
    original: content,
    ...info
  };
}

/**
 * 根据文件名和内容检测文件格式
 * @param {string} content - 文件内容
 * @param {string} fileName - 文件名
 * @returns {string} 检测到的格式
 */
function detectFileFormat(content, fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const extMap = {
    json: 'json',
    xlf: 'xliff', xliff: 'xliff',
    po: 'po', pot: 'po',
    resx: 'resx',
    ts: 'qt-ts',
    strings: 'ios-strings',
    yaml: 'yaml', yml: 'yaml',
    csv: 'csv', tsv: 'csv',
  };

  if (ext in extMap) return extMap[ext];

  // XML content detection
  if (ext === 'xml' || (content && content.trimStart().startsWith('<'))) {
    if (typeof detectXmlFormat === 'function') {
      var detection = detectXmlFormat(content);
      var typeMap = { android: 'xml-android', xliff: 'xliff', ts: 'qt-ts', resx: 'resx' };
      if (detection.type in typeMap) return typeMap[detection.type];
    }
  }

  return 'text';
}

/**
 * 根据格式名获取对应的解析器函数
 * @param {string} format - 格式名称
 * @returns {Function|null} 解析器函数
 */
function getParser(format) {
  var parsers = {
    'json': typeof parseJSON === 'function' ? parseJSON : null,
    'xliff': typeof parseXLIFF === 'function' ? parseXLIFF : null,
    'po': typeof parsePO === 'function' ? parsePO : null,
    'xml-android': typeof parseAndroidStrings === 'function' ? parseAndroidStrings : null,
    'resx': typeof parseRESX === 'function' ? parseRESX : null,
    'qt-ts': typeof parseQtTs === 'function' ? parseQtTs : null,
    'ios-strings': typeof parseIOSStrings === 'function' ? parseIOSStrings : null,
    'yaml': typeof parseYAML === 'function' ? parseYAML : null,
    'csv': typeof parseCSV === 'function' ? parseCSV : null,
    'text': typeof parseTextFile === 'function' ? parseTextFile : null,
  };
  return parsers[format] || null;
}

/**
 * 获取支持的文件格式列表
 * @returns {Array<string>} 支持的格式
 */
function getSupportedFormats() {
  return [
    'json',
    'xliff',
    'po',
    'xml-android',
    'resx',
    'qt-ts',
    'ios-strings',
    'yaml',
    'text',
    'csv'
  ];
}

// ==================== 导出接口 ====================
window.FileErrorHandler = {
  validateFilesV2,
  validateFileName,
  readFileV2,
  parseFileV2,
  detectEncodingAndRead,
  preprocessFileContent,
  getSupportedFormats
};

// 向后兼容
if (typeof window.validateFiles !== 'undefined') {
  window.validateFilesOriginal = window.validateFiles;
}
if (typeof window.readFile !== 'undefined') {
  window.readFileOriginal = window.readFile;
}
if (typeof window.parseFile !== 'undefined') {
  window.parseFileOriginal = window.parseFile;
}

window.validateFiles = validateFilesV2;
window.readFile = readFileV2;
window.parseFile = parseFileV2;