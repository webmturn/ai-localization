// ==================== 文件处理功能（现代化版本） ====================
/**
 * 文件处理功能兼容层
 * 使用现代DI系统，简化兼容性逻辑
 */

// 读取单个文件（现代化版本）
async function readFileAsync(file) {
  // 优先使用DI系统
  if (typeof getServiceSafely === 'function') {
    const fileService = getServiceSafely('fileManager', null);
    if (fileService?.readFileAsync) {
      return await fileService.readFileAsync(file);
    }
  }
  
  // 备用：使用App命名空间
  if (window.App?.impl?.readFileAsync) {
    return await window.App.impl.readFileAsync(file);
  }
  
  // 最后备用：直接调用legacy实现
  if (typeof __readFileAsyncImpl === "function") {
    return await __readFileAsyncImpl(file);
  }
  
  throw new Error("readFileAsync: 未找到文件读取实现");
}

// 解析单个文件（现代化版本）
async function parseFileAsync(file) {
  // 优先使用DI系统
  if (typeof getServiceSafely === 'function') {
    const parserService = getServiceSafely('parserManager', null);
    if (parserService?.parseFileAsync) {
      return await parserService.parseFileAsync(file);
    }
  }
  
  // 备用：使用App命名空间
  if (window.App?.impl?.parseFileAsync) {
    return await window.App.impl.parseFileAsync(file);
  }
  
  // 最后备用：直接调用legacy实现
  if (typeof __parseFileAsyncImpl === "function") {
    return await __parseFileAsyncImpl(file);
  }
  
  throw new Error("parseFileAsync: 未找到文件解析实现");
}

// 处理多个文件（现代化版本）
async function processFiles(files) {
  // 优先使用DI系统
  if (typeof getServiceSafely === 'function') {
    const fileProcessor = getServiceSafely('fileProcessor', null);
    if (fileProcessor?.processFiles) {
      return await fileProcessor.processFiles(files);
    }
  }
  
  // 备用：使用App命名空间
  if (window.App?.impl?.processFiles) {
    return await window.App.impl.processFiles(files);
  }
  
  // 最后备用：直接调用legacy实现
  if (typeof __processFilesImpl === "function") {
    return await __processFilesImpl(files);
  }
  
  throw new Error("processFiles: 未找到文件处理实现");
}

// 完成文件处理（现代化版本）
async function completeFileProcessing(files, newItems) {
  // 优先使用DI系统
  if (typeof getServiceSafely === 'function') {
    const fileProcessor = getServiceSafely('fileProcessor', null);
    if (fileProcessor?.completeFileProcessing) {
      return await fileProcessor.completeFileProcessing(files, newItems);
    }
  }
  
  // 备用：使用App命名空间
  if (window.App?.impl?.completeFileProcessing) {
    return await window.App.impl.completeFileProcessing(files, newItems);
  }
  
  // 最后备用：直接调用legacy实现
  if (typeof __completeFileProcessingImpl === "function") {
    return await __completeFileProcessingImpl(files, newItems);
  }
  
  throw new Error("completeFileProcessing: 未找到文件处理完成实现");
}
