// ==================== 存储模块错误处理器 ====================
/**
 * 存储模块专用错误处理器
 * 替换原有的存储错误处理逻辑，使用统一的错误管理系统
 */

/**
 * 增强版的IndexedDB错误通知函数
 * 替换原有的 notifyIndexedDbFileContentErrorOnce
 */
function notifyStorageErrorV2(error, action, options = {}) {
  const {
    context = {}
  } = options;

  const fallbackNotify = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.notifyIndexedDbFileContentErrorOnceOriginal === 'function') {
        return window.notifyIndexedDbFileContentErrorOnceOriginal(error, action);
      }
    } catch (_) {}

    try {
      if (typeof showNotification === 'function') {
        showNotification('warning', '存储异常', `${action || '存储操作'}失败，请重试或刷新页面。`);
      }
    } catch (_) {}

    try {
      (window.loggers?.storage || console).warn('notifyStorageErrorV2 fallback:', action, error);
    } catch (_) {}
    return { shouldNotify: false };
  };
  
  if (typeof ErrorUtils === 'undefined' || !ErrorUtils || typeof errorManager === 'undefined' || !errorManager) {
    return fallbackNotify();
  }
  
  // 使用统一错误管理系统
  let standardError;
  try {
    standardError = ErrorUtils.analyzeStorageError(error, action);
  } catch (e) {
    return fallbackNotify();
  }
  
  // 记录错误上下文
  const errorContext = {
    ...context,
    action,
    operation: 'storage',
    component: 'storage-manager'
  };
  
  // 处理错误（这会自动显示通知和解决方案）
  let handledError;
  try {
    handledError = errorManager.handleError(standardError, errorContext);
  } catch (e) {
    return fallbackNotify();
  }
  
  return handledError;
}

/**
 * 安全的IndexedDB操作包装器
 * @param {Function} operation - IndexedDB操作函数
 * @param {Object} options - 选项
 * @returns {Promise} 操作结果
 */
async function safeIndexedDBOperation(operation, options = {}) {
  const {
    operationName = 'unknown',
    fallbackValue = null,
    retryCount = 2,
    context = {}
  } = options;
  
  return await safeAsync(operation, {
    context: {
      ...context,
      operation: 'indexedDB',
      operationName
    },
    fallbackValue,
    retryCount,
    retryDelay: 1000
  });
}

/**
 * 增强版的文件内容存储函数
 * @param {string} key - 存储键
 * @param {any} content - 内容
 * @returns {Promise<boolean>} 存储结果
 */
async function putFileContentSafe(key, content) {
  const operation = async () => {
    const db = await openFileContentDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("fileContents", "readwrite");
      const store = tx.objectStore("fileContents");
      
      // 检查内容大小
      const contentSize = new Blob([JSON.stringify(content)]).size;
      if (contentSize > 50 * 1024 * 1024) { // 50MB
        throw errorManager.createError(ERROR_CODES.FILE_TOO_LARGE,
          `文件内容过大 (${(contentSize / 1024 / 1024).toFixed(2)}MB)`, {
            contentSize,
            key
          });
      }
      
      const request = store.put({ key, content, updatedAt: Date.now() });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("IndexedDB写入失败"));
      
      tx.onabort = () => reject(tx.error || new Error("IndexedDB事务中止"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB事务失败"));
    });
  };
  
  const result = await safeIndexedDBOperation(operation, {
    operationName: 'putFileContent',
    context: { key, contentType: typeof content }
  });
  
  return result.success ? result.data : false;
}

/**
 * 增强版的文件内容读取函数
 * @param {string} key - 存储键
 * @returns {Promise<any>} 文件内容
 */
async function getFileContentSafe(key) {
  const operation = async () => {
    const db = await openFileContentDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("fileContents", "readonly");
      const store = tx.objectStore("fileContents");
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.content : null);
      };
      
      request.onerror = () => reject(request.error || new Error("IndexedDB读取失败"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB事务失败"));
    });
  };
  
  const result = await safeIndexedDBOperation(operation, {
    operationName: 'getFileContent',
    fallbackValue: null,
    context: { key }
  });
  
  return result.success ? result.data : null;
}

/**
 * 增强版的项目存储函数
 * @param {string} key - 项目键
 * @param {Object} projectJson - 项目数据
 * @returns {Promise<boolean>} 存储结果
 */
async function putProjectSafe(key, projectJson) {
  const operation = async () => {
    // 验证项目数据
    if (!projectJson || typeof projectJson !== 'object') {
      throw errorManager.createError(ERROR_CODES.INVALID_INPUT,
        '项目数据格式不正确', { key, projectJson });
    }
    
    // 检查项目大小
    const projectSize = new Blob([JSON.stringify(projectJson)]).size;
    if (projectSize > 100 * 1024 * 1024) { // 100MB
      throw errorManager.createError(ERROR_CODES.FILE_TOO_LARGE,
        `项目数据过大 (${(projectSize / 1024 / 1024).toFixed(2)}MB)`, {
          projectSize,
          key
        });
    }
    
    const db = await openFileContentDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      const store = tx.objectStore("projects");
      
      const request = store.put({ 
        key, 
        projectJson, 
        updatedAt: Date.now(),
        version: '1.1.0' // 添加版本信息
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("IndexedDB写入失败"));
      
      tx.onabort = () => reject(tx.error || new Error("IndexedDB事务中止"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB事务失败"));
    });
  };
  
  const result = await safeIndexedDBOperation(operation, {
    operationName: 'putProject',
    context: { key, projectSize: JSON.stringify(projectJson).length }
  });
  
  return result.success ? result.data : false;
}

/**
 * 存储空间清理策略
 * @param {Object} options - 清理选项
 * @returns {Promise<Object>} 清理结果
 */
async function cleanupStorage(options = {}) {
  const {
    maxAge = 30 * 24 * 60 * 60 * 1000, // 30天
    maxItems = 100,
    dryRun = false
  } = options;
  
  const result = {
    cleaned: 0,
    freed: 0,
    errors: []
  };
  
  try {
    const db = await openFileContentDB();
    
    // 清理旧的文件内容
    const fileContentResult = await cleanupObjectStore(db, 'fileContents', {
      maxAge,
      maxItems,
      dryRun
    });
    
    result.cleaned += fileContentResult.cleaned;
    result.freed += fileContentResult.freed;
    result.errors.push(...fileContentResult.errors);
    
    // 清理旧的项目
    const projectResult = await cleanupObjectStore(db, 'projects', {
      maxAge,
      maxItems: Math.floor(maxItems / 2), // 项目保留更少
      dryRun
    });
    
    result.cleaned += projectResult.cleaned;
    result.freed += projectResult.freed;
    result.errors.push(...projectResult.errors);
    
    if (!dryRun && result.cleaned > 0) {
      showNotification('info', '存储清理完成', 
        `清理了 ${result.cleaned} 项，释放约 ${(result.freed / 1024 / 1024).toFixed(2)}MB 空间`);
    }
    
  } catch (error) {
    const handledError = errorManager.handleError(error, {
      operation: 'cleanupStorage',
      options
    });
    result.errors.push(handledError);
  }
  
  return result;
}

/**
 * 清理对象存储
 * @param {IDBDatabase} db - 数据库实例
 * @param {string} storeName - 存储名称
 * @param {Object} options - 清理选项
 * @returns {Promise<Object>} 清理结果
 */
async function cleanupObjectStore(db, storeName, options = {}) {
  const { maxAge, maxItems, dryRun } = options;
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, dryRun ? 'readonly' : 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const items = request.result || [];
      const toDelete = [];
      
      // 按更新时间排序
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      
      items.forEach((item, index) => {
        const age = now - (item.updatedAt || 0);
        
        // 删除过期或超出数量限制的项目
        if (age > maxAge || index >= maxItems) {
          toDelete.push(item);
        }
      });
      
      if (dryRun) {
        const freed = toDelete.reduce((sum, item) => {
          return sum + new Blob([JSON.stringify(item)]).size;
        }, 0);
        
        resolve({
          cleaned: toDelete.length,
          freed,
          errors: []
        });
        return;
      }
      
      // 执行删除
      let deleted = 0;
      let freed = 0;
      const errors = [];
      
      if (toDelete.length === 0) {
        resolve({ cleaned: 0, freed: 0, errors: [] });
        return;
      }
      
      toDelete.forEach(item => {
        const deleteRequest = store.delete(item.key);
        
        deleteRequest.onsuccess = () => {
          deleted++;
          freed += new Blob([JSON.stringify(item)]).size;
          
          if (deleted === toDelete.length) {
            resolve({ cleaned: deleted, freed, errors });
          }
        };
        
        deleteRequest.onerror = () => {
          errors.push(errorManager.createError(ERROR_CODES.STORAGE_ACCESS_DENIED,
            `删除项目失败: ${item.key}`, { item, error: deleteRequest.error }));
          
          deleted++;
          if (deleted === toDelete.length) {
            resolve({ cleaned: deleted - errors.length, freed, errors });
          }
        };
      });
    };
    
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 存储健康检查
 * @returns {Promise<Object>} 健康检查结果
 */
async function checkStorageHealth() {
  const health = {
    indexedDB: { available: false, quota: 0, usage: 0 },
    localStorage: { available: false, quota: 0, usage: 0 },
    issues: [],
    recommendations: []
  };
  
  try {
    // 检查IndexedDB
    if ('indexedDB' in window) {
      health.indexedDB.available = true;
      
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) {
          health.indexedDB.quota = estimate.quota || 0;
          health.indexedDB.usage = estimate.usage || 0;
          
          const usagePercent = (health.indexedDB.usage / health.indexedDB.quota) * 100;
          if (usagePercent > 80) {
            health.issues.push('IndexedDB存储空间使用率过高');
            health.recommendations.push('建议清理旧数据或导出项目备份');
          }
        }
      } catch (error) {
        health.issues.push('无法获取IndexedDB存储信息');
      }
    } else {
      health.issues.push('浏览器不支持IndexedDB');
      health.recommendations.push('建议升级浏览器或使用现代浏览器');
    }
    
    // 检查localStorage
    if ('localStorage' in window) {
      health.localStorage.available = true;
      
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // 估算localStorage使用量
        let usage = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            usage += localStorage[key].length + key.length;
          }
        }
        health.localStorage.usage = usage;
        health.localStorage.quota = 5 * 1024 * 1024; // 估算5MB限制
        
        const usagePercent = (usage / health.localStorage.quota) * 100;
        if (usagePercent > 80) {
          health.issues.push('localStorage存储空间使用率过高');
          health.recommendations.push('建议清理localStorage数据');
        }
        
      } catch (error) {
        health.issues.push('localStorage访问受限');
        health.recommendations.push('检查浏览器隐私设置');
      }
    } else {
      health.issues.push('浏览器不支持localStorage');
    }
    
  } catch (error) {
    health.issues.push(`存储健康检查失败: ${error.message}`);
  }
  
  return health;
}

// ==================== 导出接口 ====================
window.StorageErrorHandler = {
  notifyStorageErrorV2,
  safeIndexedDBOperation,
  putFileContentSafe,
  getFileContentSafe,
  putProjectSafe,
  cleanupStorage,
  checkStorageHealth
};

// 向后兼容：保留 notifyStorageErrorV2 作为可直接调用的增强版接口，
// 但不再覆盖 notifyIndexedDbFileContentErrorOnce —— 该函数已在 idb-operations.js
// 中内置"优先委托 storageErrorHandler"的逻辑，无需外部替换。
window.notifyStorageErrorV2 = notifyStorageErrorV2;