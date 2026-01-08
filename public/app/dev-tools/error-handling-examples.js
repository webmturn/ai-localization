// ==================== 错误处理系统使用示例（开发工具） ====================
// 从 examples/error-handling-examples.js 移动至 dev-tools 目录，仅在开发环境使用

/**
 * 这个文件包含了新错误处理系统的实际使用示例
 * 展示如何在现有代码中集成和使用统一的错误处理
 */

// ==================== 示例1: 翻译功能错误处理 ====================

/**
 * 使用新错误处理系统的翻译函数示例
 */
async function translateWithErrorHandling(text, sourceLang, targetLang, engine) {
  try {
    // 1. 输入验证
    if (!text || typeof text !== 'string') {
      throw errorManager.createError(ERROR_CODES.INVALID_INPUT, 
        '翻译文本不能为空', { text, sourceLang, targetLang, engine });
    }
    
    // 2. API密钥验证
    const settings = JSON.parse(localStorage.getItem('translatorSettings') || '{}');
    const apiKeyField = `${engine.toLowerCase()}ApiKey`;
    const apiKey = settings[apiKeyField];
    
    const keyError = ErrorUtils.validateApiKey(apiKey, engine);
    if (keyError) {
      throw keyError;
    }
    
    // 3. 使用安全的网络请求
    const result = await safeAsync(
      async () => {
        const response = await networkUtilsV2.fetchWithErrorHandling(
          getTranslationApiUrl(engine),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              text,
              source_language: sourceLang,
              target_language: targetLang
            })
          },
          30000 // 30秒超时
        );
        
        const data = await response.json();
        return TranslationErrorHandler.processTranslationResponse(data, engine);
      },
      {
        retryCount: 3,
        retryDelay: 1000,
        context: {
          operation: 'translation',
          engine,
          textLength: text.length
        }
      }
    );
    
    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
    
  } catch (error) {
    // 4. 统一错误处理
    const handledError = errorManager.handleError(error, {
      operation: 'translation',
      engine,
      textLength: text?.length
    });
    
    // 5. 根据错误类型决定是否重新抛出
    if (handledError.severity === ERROR_SEVERITY.CRITICAL) {
      throw handledError;
    }
    
    return null; // 返回null表示翻译失败但不是致命错误
  }
}

// ==================== 示例2: 批量文件处理 ====================

/**
 * 批量处理文件的错误处理示例
 */
async function processBatchFiles(files, onProgress = null) {
  // 参数验证
  if (!files) {
    throw errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '文件参数不能为空', { files });
  }
  
  // 转换为数组
  const fileArray = Array.isArray(files) ? files : 
                   (files instanceof FileList) ? Array.from(files) : [files];
  
  if (fileArray.length === 0) {
    throw errorManager.createError(ERROR_CODES.INVALID_INPUT,
      '没有文件需要处理', { fileCount: 0 });
  }
  
  // 1. 文件验证
  const validation = FileErrorHandler.validateFilesV2(fileArray, {
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 50,
    allowedExtensions: ['json', 'xml', 'po', 'xliff']
  });
  
  if (validation.invalid.length > 0) {
    // 显示验证错误
    validation.invalid.forEach(({ file, error }) => {
      console.error(`文件验证失败: ${file?.name || '未知文件'}`, error.message);
    });
    
    // 如果所有文件都无效，抛出错误
    if (validation.valid.length === 0) {
      throw errorManager.createError(ERROR_CODES.FILE_INVALID_FORMAT,
        '没有有效的文件可以处理', { 
          totalFiles: fileArray.length,
          invalidCount: validation.invalid.length 
        });
    }
  }
  
  // 2. 使用批量错误收集器
  const collector = new BatchErrorCollector();
  const results = [];
  
  // 3. 处理有效文件
  for (let i = 0; i < validation.valid.length; i++) {
    const { file, index } = validation.valid[i];
    
    try {
      // 更新进度
      if (onProgress) {
        onProgress(i, validation.valid.length, `处理文件: ${file.name}`);
      }
      
      // 安全读取文件
      const fileData = await FileErrorHandler.readFileV2(file, {
        encoding: 'auto',
        maxSize: 50 * 1024 * 1024
      });
      
      // 安全解析文件
      const parseResult = await FileErrorHandler.parseFileV2(
        fileData.content, 
        file.name,
        { strict: false, maxItems: 10000 }
      );
      
      collector.addSuccess(index, parseResult, file);
      results.push({
        file,
        success: true,
        data: parseResult
      });
      
    } catch (error) {
      collector.addError(index, error, file);
      results.push({
        file,
        success: false,
        error
      });
    }
  }
  
  // 4. 生成处理报告
  const summary = collector.getSummary();
  
  if (summary.errorCount > 0) {
    const retryableCount = collector.getRetryableErrors().length;
    showNotification(
      summary.successCount > 0 ? 'warning' : 'error',
      '批量文件处理完成',
      `成功: ${summary.successCount}, 失败: ${summary.errorCount}${retryableCount > 0 ? `, 可重试: ${retryableCount}` : ''}`
    );
  } else {
    showNotification('success', '批量处理完成', `成功处理 ${summary.successCount} 个文件`);
  }
  
  return {
    results,
    summary,
    retryableErrors: collector.getRetryableErrors()
  };
}

// ==================== 示例3: 存储操作错误处理 ====================

/**
 * 安全的项目保存示例
 */
async function saveProjectSafely(projectData, projectKey = 'currentProject') {
  try {
    // 1. 数据验证
    if (!projectData || typeof projectData !== 'object') {
      throw errorManager.createError(ERROR_CODES.INVALID_INPUT,
        '项目数据无效', { projectData, projectKey });
    }
    
    // 2. 检查存储健康状态
    const health = await StorageErrorHandler.checkStorageHealth();
    
    if (health.issues.length > 0) {
      console.warn('存储健康检查发现问题:', health.issues);
      
      // 如果存储空间不足，尝试清理
      if (health.issues.some(issue => issue.includes('存储空间'))) {
        console.log('尝试清理存储空间...');
        await StorageErrorHandler.cleanupStorage({
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
          maxItems: 50
        });
      }
    }
    
    // 3. 安全保存项目
    const saveResult = await safeAsync(
      () => StorageErrorHandler.putProjectSafe(projectKey, projectData),
      {
        retryCount: 3,
        retryDelay: 1000,
        context: {
          operation: 'saveProject',
          projectKey,
          dataSize: JSON.stringify(projectData).length
        }
      }
    );
    
    if (saveResult.success) {
      showNotification('success', '项目保存成功', `项目已保存到 ${projectKey}`);
      return true;
    } else {
      throw saveResult.error;
    }
    
  } catch (error) {
    const handledError = errorManager.handleError(error, {
      operation: 'saveProject',
      projectKey
    });
    
    // 如果是存储配额问题，提供降级保存选项
    if (handledError.code === ERROR_CODES.STORAGE_QUOTA_EXCEEDED) {
      return await saveProjectWithFallback(projectData, projectKey);
    }
    
    return false;
  }
}

/**
 * 降级保存策略
 */
async function saveProjectWithFallback(projectData, projectKey) {
  try {
    // 创建精简版项目数据
    const slimData = {
      ...projectData,
      // 移除大型数据
      originalContent: undefined,
      fileMetadata: undefined
    };
    
    const result = await StorageErrorHandler.putProjectSafe(projectKey + '_slim', slimData);
    
    if (result) {
      showNotification('warning', '项目已精简保存', 
        '由于存储空间限制，已保存精简版项目数据');
      return true;
    }
    
    // 最后尝试localStorage
    localStorage.setItem(projectKey + '_backup', JSON.stringify(slimData));
    showNotification('warning', '项目已备份到本地存储', 
      '请及时导出项目数据以防丢失');
    return true;
    
  } catch (fallbackError) {
    errorManager.handleError(fallbackError, {
      operation: 'fallbackSave',
      projectKey
    });
    return false;
  }
}

// ==================== 示例4: 网络请求重试和熔断 ====================

/**
 * 带有智能重试和熔断的API调用示例
 */
async function callApiWithCircuitBreaker(url, options = {}, retryOptions = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    backoffFactor = 2,
    circuitBreakerThreshold = 5
  } = retryOptions;
  
  try {
    // 使用增强版网络工具
    const response = await networkUtilsV2.fetchWithErrorHandling(url, options);
    
    // 检查响应状态
    if (!response.ok) {
      throw ErrorUtils.analyzeHttpError(response, { url, ...options });
    }
    
    return await response.json();
    
  } catch (error) {
    // 检查是否应该触发熔断器
    const stats = networkUtilsV2.getRequestStats(url);
    
    if (stats.error >= circuitBreakerThreshold) {
      console.warn(`API ${url} 错误次数过多，建议检查服务状态`);
      
      showNotification('warning', 'API服务异常', 
        `${url} 连续失败 ${stats.error} 次，请检查网络或服务状态`);
    }
    
    throw error;
  }
}

// ==================== 示例5: 用户操作错误边界 ====================

/**
 * 为用户操作创建错误边界
 */
function createUserActionHandler(actionName, actionFn) {
  return createErrorBoundary(actionFn, {
    fallback: null,
    onError: (error) => {
      // 根据错误严重程度决定处理方式
      if (error.severity === ERROR_SEVERITY.LOW) {
        // 低级错误，只记录日志
        console.log(`用户操作 ${actionName} 产生轻微错误:`, error.message);
      } else if (error.severity === ERROR_SEVERITY.MEDIUM) {
        // 中级错误，显示警告但不阻断操作
        showNotification('warning', `${actionName} 部分失败`, error.message);
      } else {
        // 高级错误，显示错误并可能需要用户干预
        showNotification('error', `${actionName} 失败`, error.message);
        
        // 如果有解决方案，显示给用户
        if (error.details?.solutions?.length > 0) {
          const solutions = error.details.solutions.join('\n');
          setTimeout(() => {
            showNotification('info', '建议解决方案', solutions);
          }, 1000);
        }
      }
    },
    context: { userAction: actionName }
  });
}

// 使用示例
const safeTranslateAction = createUserActionHandler('翻译文本', translateWithErrorHandling);
const safeSaveAction = createUserActionHandler('保存项目', saveProjectSafely);

// ==================== 示例6: 错误监控和分析 ====================

/**
 * 错误监控仪表板
 */
function createErrorDashboard() {
  const dashboard = {
    // 获取错误概览
    getOverview() {
      const stats = errorManager.getErrorStats();
      const networkStats = networkUtilsV2.getRequestStats();
      
      return {
        totalErrors: stats.total,
        errorsByCategory: stats.byCategory,
        errorsBySeverity: stats.bySeverity,
        recentErrors: stats.recent.slice(0, 5),
        networkRequests: {
          total: networkStats.total,
          success: networkStats.success,
          error: networkStats.error,
          successRate: networkStats.total > 0 ? 
            (networkStats.success / networkStats.total * 100).toFixed(2) + '%' : '0%'
        }
      };
    },
    
    // 生成错误报告
    generateReport() {
      const overview = this.getOverview();
      
      console.log('📊 错误处理系统报告');
      console.log('==================');
      console.log(`总错误数: ${overview.totalErrors}`);
      console.log(`网络请求成功率: ${overview.networkRequests.successRate}`);
      console.log('\n按类别分布:');
      Object.entries(overview.errorsByCategory).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
      console.log('\n按严重程度分布:');
      Object.entries(overview.errorsBySeverity).forEach(([severity, count]) => {
        console.log(`  ${severity}: ${count}`);
      });
      
      if (overview.recentErrors.length > 0) {
        console.log('\n最近错误:');
        overview.recentErrors.forEach((error, index) => {
          console.log(`  ${index + 1}. [${error.severity}] ${error.code}: ${error.message}`);
        });
      }
      
      return overview;
    },
    
    // 导出详细报告
    exportDetailedReport() {
      errorManager.exportErrorLog();
      console.log('详细错误日志已导出');
    },
    
    // 清理旧数据
    cleanup() {
      errorManager.clearErrorHistory();
      networkUtilsV2.resetStats();
      console.log('错误历史已清理');
    }
  };
  
  return dashboard;
}

// ==================== 导出示例函数 ====================
window.ErrorHandlingExamples = {
  translateWithErrorHandling,
  processBatchFiles,
  saveProjectSafely,
  callApiWithCircuitBreaker,
  createUserActionHandler,
  createErrorDashboard
};

// 创建全局错误监控仪表板
window.errorDashboard = createErrorDashboard();

// 在控制台中提供快捷访问
console.log('🔧 错误处理示例已加载！');
console.log('可用示例:');
console.log('  - ErrorHandlingExamples.translateWithErrorHandling()');
console.log('  - ErrorHandlingExamples.processBatchFiles()');
console.log('  - ErrorHandlingExamples.saveProjectSafely()');
console.log('  - errorDashboard.generateReport()');
console.log('  - runErrorHandlingDemo() // 运行完整演示');

// 辅助函数
function getTranslationApiUrl(engine) {
  const urls = {
    openai: 'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    google: 'https://translation.googleapis.com/language/translate/v2'
  };
  return urls[engine.toLowerCase()] || urls.openai;
}

