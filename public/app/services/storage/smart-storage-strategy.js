// ==================== 智能存储降级策略 ====================
/**
 * P2改进：智能存储降级和优化策略
 * 提供自动存储后端选择、数据一致性保证和智能降级机制
 */

/**
 * 智能存储策略管理器
 * @class
 */
class SmartStorageStrategy {
  constructor() {
    /** @type {Array<StorageBackend>} */
    this.availableBackends = [];
    /** @type {StorageBackend|null} */
    this.currentBackend = null;
    /** @type {Map<string, any>} */
    this.migrationQueue = new Map();
    /** @type {boolean} */
    this.autoMigrationEnabled = true;
    /** @type {Object} */
    this.backendCapabilities = {};
    /** @type {Array<StorageHealthCheck>} */
    this.healthChecks = [];
    
    this.initializeBackends();
    this.startHealthMonitoring();
  }

  /**
   * 初始化存储后端
   * @private
   */
  initializeBackends() {
    // 定义存储后端配置
    const backendConfigs = [
      {
        name: 'IndexedDB',
        priority: 1,
        capabilities: {
          structured: true,
          transactions: true,
          indexing: true,
          largeData: true,
          maxSize: 250 * 1024 * 1024, // 250MB typical quota
          async: true,
          persistence: 'durable'
        },
        testFunction: () => this.testIndexedDB(),
        createInstance: (options) => new IndexedDBBackend(options)
      },
      {
        name: 'LocalStorage',
        priority: 2,
        capabilities: {
          structured: false,
          transactions: false,
          indexing: false,
          largeData: false,
          maxSize: 5 * 1024 * 1024, // 5MB typical limit
          async: false,
          persistence: 'local'
        },
        testFunction: () => this.testLocalStorage(),
        createInstance: (options) => new LocalStorageBackend(options)
      },
      {
        name: 'SessionStorage',
        priority: 3,
        capabilities: {
          structured: false,
          transactions: false,
          indexing: false,
          largeData: false,
          maxSize: 5 * 1024 * 1024, // 5MB typical limit
          async: false,
          persistence: 'session'
        },
        testFunction: () => this.testSessionStorage(),
        createInstance: (options) => new SessionStorageBackend(options)
      },
      {
        name: 'MemoryStorage',
        priority: 4,
        capabilities: {
          structured: true,
          transactions: false,
          indexing: false,
          largeData: true,
          maxSize: 100 * 1024 * 1024, // 100MB memory limit
          async: false,
          persistence: 'memory'
        },
        testFunction: () => this.testMemoryStorage(),
        createInstance: (options) => new MemoryStorageBackend(options)
      }
    ];

    // 测试并初始化可用后端
    backendConfigs.forEach(config => {
      try {
        if (config.testFunction()) {
          this.availableBackends.push({
            ...config,
            available: true,
            healthScore: 1.0,
            lastHealthCheck: Date.now()
          });
          this.backendCapabilities[config.name] = config.capabilities;
          console.log(`✅ 存储后端可用: ${config.name}`);
        } else {
          console.warn(`⚠️ 存储后端不可用: ${config.name}`);
        }
      } catch (error) {
        console.error(`❌ 存储后端测试失败: ${config.name}`, error);
      }
    });

    // 按优先级排序
    this.availableBackends.sort((a, b) => a.priority - b.priority);
    
    // 选择最优后端
    this.selectOptimalBackend();
  }

  /**
   * 测试IndexedDB可用性
   * @private
   * @returns {boolean} 是否可用
   */
  testIndexedDB() {
    if (!window.indexedDB) return false;
    
    try {
      // 快速测试
      const testReq = indexedDB.open('__test_db__', 1);
      testReq.onsuccess = () => {
        testReq.result.close();
        indexedDB.deleteDatabase('__test_db__');
      };
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试LocalStorage可用性
   * @private
   * @returns {boolean} 是否可用
   */
  testLocalStorage() {
    try {
      if (!window.localStorage) return false;
      
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return value === 'test';
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试SessionStorage可用性
   * @private
   * @returns {boolean} 是否可用
   */
  testSessionStorage() {
    try {
      if (!window.sessionStorage) return false;
      
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      const value = sessionStorage.getItem(testKey);
      sessionStorage.removeItem(testKey);
      return value === 'test';
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试内存存储可用性
   * @private
   * @returns {boolean} 是否可用
   */
  testMemoryStorage() {
    return true; // 内存存储总是可用
  }

  /**
   * 选择最优存储后端
   * @private
   */
  selectOptimalBackend() {
    if (this.availableBackends.length === 0) {
      console.error('❌ 没有可用的存储后端');
      return;
    }

    // 选择健康分数最高的最优先后端
    const optimal = this.availableBackends
      .filter(backend => backend.available && backend.healthScore > 0.5)
      .sort((a, b) => {
        // 优先级相同时，选择健康分数更高的
        if (a.priority === b.priority) {
          return b.healthScore - a.healthScore;
        }
        return a.priority - b.priority;
      })[0];

    if (optimal && optimal !== this.currentBackend) {
      this.switchBackend(optimal);
    }
  }

  /**
   * 切换存储后端
   * @private
   * @param {StorageBackend} newBackend - 新的存储后端
   */
  async switchBackend(newBackend) {
    const oldBackend = this.currentBackend;
    
    console.log(`🔄 切换存储后端: ${oldBackend?.name || 'none'} → ${newBackend.name}`);
    
    try {
      // 创建新后端实例
      const instance = newBackend.createInstance({
        database: 'translation_tool_db',
        version: 1
      });

      // 如果有旧后端，执行数据迁移
      if (oldBackend && this.autoMigrationEnabled) {
        await this.migrateData(oldBackend, newBackend);
      }

      this.currentBackend = newBackend;
      this.currentBackend.instance = instance;
      
      console.log(`✅ 存储后端切换完成: ${newBackend.name}`);
      
      // 触发后端切换事件
      this.dispatchEvent('backendChanged', {
        oldBackend: oldBackend?.name,
        newBackend: newBackend.name,
        capabilities: newBackend.capabilities
      });
      
    } catch (error) {
      console.error(`❌ 存储后端切换失败:`, error);
      
      // 降级到下一个可用后端
      this.degradeToNextBackend(newBackend);
    }
  }

  /**
   * 数据迁移
   * @private
   * @param {StorageBackend} from - 源后端
   * @param {StorageBackend} to - 目标后端
   */
  async migrateData(from, to) {
    console.log(`📦 开始数据迁移: ${from.name} → ${to.name}`);
    
    try {
      // 获取源后端的所有数据
      const data = await this.exportAllData(from);
      
      if (data && Object.keys(data).length > 0) {
        // 导入到新后端
        await this.importAllData(to, data);
        console.log(`✅ 数据迁移完成: ${Object.keys(data).length} 项`);
      } else {
        console.log(`ℹ️ 无数据需要迁移`);
      }
      
    } catch (error) {
      console.error(`❌ 数据迁移失败:`, error);
      
      // 将数据加入迁移队列，稍后重试
      this.migrationQueue.set(`${from.name}_to_${to.name}`, {
        from: from.name,
        to: to.name,
        attempts: 0,
        lastAttempt: Date.now()
      });
    }
  }

  /**
   * 导出所有数据
   * @private
   * @param {StorageBackend} backend - 存储后端
   * @returns {Promise<Object>} 导出的数据
   */
  async exportAllData(backend) {
    const exportedData = {};
    
    try {
      // 根据后端类型使用不同的导出策略
      switch (backend.name) {
        case 'IndexedDB':
          return await this.exportIndexedDBData(backend);
        case 'LocalStorage':
          return this.exportWebStorageData(localStorage);
        case 'SessionStorage':
          return this.exportWebStorageData(sessionStorage);
        case 'MemoryStorage':
          return backend.instance ? backend.instance.exportAll() : {};
        default:
          return {};
      }
    } catch (error) {
      console.error(`导出数据失败 (${backend.name}):`, error);
      return {};
    }
  }

  /**
   * 导出Web Storage数据
   * @private
   * @param {Storage} storage - 存储对象
   * @returns {Object} 导出的数据
   */
  exportWebStorageData(storage) {
    const data = {};
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('translation_tool_')) {
        try {
          const value = storage.getItem(key);
          data[key] = JSON.parse(value);
        } catch (error) {
          // 如果不是JSON，直接存储字符串值
          data[key] = storage.getItem(key);
        }
      }
    }
    
    return data;
  }

  /**
   * 导入所有数据
   * @private
   * @param {StorageBackend} backend - 目标后端
   * @param {Object} data - 要导入的数据
   */
  async importAllData(backend, data) {
    const entries = Object.entries(data);
    
    for (const [key, value] of entries) {
      try {
        await this.storeData(backend, key, value);
      } catch (error) {
        console.error(`导入数据失败 (${key}):`, error);
      }
    }
  }

  /**
   * 存储数据到指定后端
   * @private
   * @param {StorageBackend} backend - 存储后端
   * @param {string} key - 键
   * @param {any} value - 值
   */
  async storeData(backend, key, value) {
    if (!backend.instance) {
      throw new Error(`Backend ${backend.name} not initialized`);
    }
    
    switch (backend.name) {
      case 'IndexedDB':
        return await backend.instance.setItem(key, value);
      case 'LocalStorage':
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        break;
      case 'SessionStorage':
        sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        break;
      case 'MemoryStorage':
        backend.instance.setItem(key, value);
        break;
    }
  }

  /**
   * 降级到下一个后端
   * @private
   * @param {StorageBackend} failedBackend - 失败的后端
   */
  degradeToNextBackend(failedBackend) {
    // 标记失败后端为不健康
    failedBackend.healthScore = 0;
    failedBackend.available = false;
    
    // 寻找下一个可用后端
    const nextBackend = this.availableBackends.find(backend => 
      backend !== failedBackend && 
      backend.available && 
      backend.healthScore > 0.5
    );
    
    if (nextBackend) {
      console.log(`🔻 降级到后端: ${nextBackend.name}`);
      this.switchBackend(nextBackend);
    } else {
      console.error('❌ 没有可用的备用存储后端');
      
      // 触发存储不可用事件
      this.dispatchEvent('storageUnavailable', {
        failedBackend: failedBackend.name,
        availableBackends: this.availableBackends.filter(b => b.available).map(b => b.name)
      });
    }
  }

  /**
   * 开始健康监控
   * @private
   */
  startHealthMonitoring() {
    // 每30秒检查一次存储健康状态
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);
    
    // 每5分钟重试失败的迁移
    setInterval(() => {
      this.retryFailedMigrations();
    }, 5 * 60 * 1000);
  }

  /**
   * 执行健康检查
   * @private
   */
  async performHealthChecks() {
    for (const backend of this.availableBackends) {
      if (!backend.available) continue;
      
      try {
        const healthScore = await this.checkBackendHealth(backend);
        backend.healthScore = healthScore;
        backend.lastHealthCheck = Date.now();
        
        if (healthScore < 0.3 && backend === this.currentBackend) {
          console.warn(`⚠️ 当前存储后端健康度低: ${backend.name} (${healthScore.toFixed(2)})`);
          // 考虑切换到更健康的后端
          this.selectOptimalBackend();
        }
      } catch (error) {
        console.error(`存储健康检查失败: ${backend.name}`, error);
        backend.healthScore = 0;
        backend.available = false;
      }
    }
  }

  /**
   * 检查后端健康度
   * @private
   * @param {StorageBackend} backend - 存储后端
   * @returns {Promise<number>} 健康分数 0-1
   */
  async checkBackendHealth(backend) {
    let healthScore = 1.0;
    
    try {
      // 测试基本可用性
      const testKey = `__health_check_${Date.now()}__`;
      const testValue = { test: true, timestamp: Date.now() };
      
      const startTime = performance.now();
      
      // 写入测试
      await this.storeData(backend, testKey, testValue);
      
      // 读取测试  
      const readValue = await this.retrieveData(backend, testKey);
      
      // 删除测试
      await this.deleteData(backend, testKey);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // 根据响应时间调整健康分数
      if (responseTime > 1000) {
        healthScore *= 0.7; // 响应慢
      } else if (responseTime > 500) {
        healthScore *= 0.85;
      }
      
      // 验证数据一致性
      if (!readValue || readValue.test !== testValue.test) {
        healthScore *= 0.5; // 数据不一致
      }
      
    } catch (error) {
      healthScore = 0; // 完全不可用
    }
    
    return Math.max(0, Math.min(1, healthScore));
  }

  /**
   * 从后端检索数据
   * @private
   * @param {StorageBackend} backend - 存储后端
   * @param {string} key - 键
   * @returns {Promise<any>} 数据值
   */
  async retrieveData(backend, key) {
    switch (backend.name) {
      case 'IndexedDB':
        return await backend.instance.getItem(key);
      case 'LocalStorage':
        const localValue = localStorage.getItem(key);
        return localValue ? JSON.parse(localValue) : null;
      case 'SessionStorage':
        const sessionValue = sessionStorage.getItem(key);
        return sessionValue ? JSON.parse(sessionValue) : null;
      case 'MemoryStorage':
        return backend.instance.getItem(key);
      default:
        return null;
    }
  }

  /**
   * 从后端删除数据
   * @private
   * @param {StorageBackend} backend - 存储后端
   * @param {string} key - 键
   */
  async deleteData(backend, key) {
    switch (backend.name) {
      case 'IndexedDB':
        return await backend.instance.removeItem(key);
      case 'LocalStorage':
        localStorage.removeItem(key);
        break;
      case 'SessionStorage':
        sessionStorage.removeItem(key);
        break;
      case 'MemoryStorage':
        backend.instance.removeItem(key);
        break;
    }
  }

  /**
   * 重试失败的迁移
   * @private
   */
  async retryFailedMigrations() {
    const now = Date.now();
    
    for (const [migrationId, migration] of this.migrationQueue) {
      // 如果上次尝试超过10分钟且尝试次数少于3次
      if (now - migration.lastAttempt > 10 * 60 * 1000 && migration.attempts < 3) {
        const fromBackend = this.availableBackends.find(b => b.name === migration.from);
        const toBackend = this.availableBackends.find(b => b.name === migration.to);
        
        if (fromBackend && toBackend && toBackend.available) {
          console.log(`🔄 重试数据迁移: ${migration.from} → ${migration.to} (第${migration.attempts + 1}次)`);
          
          try {
            await this.migrateData(fromBackend, toBackend);
            this.migrationQueue.delete(migrationId);
          } catch (error) {
            migration.attempts++;
            migration.lastAttempt = now;
            console.error(`迁移重试失败:`, error);
          }
        }
      } else if (migration.attempts >= 3) {
        // 超过最大重试次数，放弃迁移
        console.warn(`⚠️ 放弃数据迁移: ${migration.from} → ${migration.to}`);
        this.migrationQueue.delete(migrationId);
      }
    }
  }

  /**
   * 触发事件
   * @private
   * @param {string} eventName - 事件名称
   * @param {Object} detail - 事件详情
   */
  dispatchEvent(eventName, detail) {
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent(`storage${eventName}`, { detail });
      window.dispatchEvent(event);
    }
  }

  /**
   * 获取当前存储策略状态
   * @returns {StorageStrategyStatus} 状态信息
   */
  getStatus() {
    return {
      currentBackend: this.currentBackend?.name || null,
      currentCapabilities: this.currentBackend?.capabilities || null,
      availableBackends: this.availableBackends.map(b => ({
        name: b.name,
        available: b.available,
        healthScore: b.healthScore,
        capabilities: b.capabilities,
        priority: b.priority
      })),
      migrationQueue: Array.from(this.migrationQueue.values()),
      autoMigrationEnabled: this.autoMigrationEnabled,
      lastHealthCheck: Math.max(...this.availableBackends.map(b => b.lastHealthCheck || 0))
    };
  }

  /**
   * 手动触发后端选择
   */
  optimizeBackend() {
    this.selectOptimalBackend();
  }

  /**
   * 启用/禁用自动迁移
   * @param {boolean} enabled - 是否启用
   */
  setAutoMigration(enabled) {
    this.autoMigrationEnabled = enabled;
    console.log(`🔄 自动数据迁移${enabled ? '已启用' : '已禁用'}`);
  }
}

// ==================== 存储后端实现 ====================

/**
 * 高性能IndexedDB存储后端
 */
class IndexedDBBackend {
  constructor(options) {
    this.options = options;
    this.dbName = options.database || 'translation_tool_db';
    this.version = options.version || 1;
    this.db = null;
    
    // 性能优化：添加内存缓存和批处理
    this.cache = new Map();
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchSize = 10;
    this.cacheSize = 100; // 最大缓存条目数
  }

  async init() {
    if (this.db) return; // 避免重复初始化
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        
        // 添加数据库连接错误处理
        this.db.onerror = (event) => {
          console.error('IndexedDB连接错误:', event);
        };
        
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('data')) {
          const store = db.createObjectStore('data', { keyPath: 'key' });
          // 添加索引优化查询性能
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async setItem(key, value) {
    // 性能优化：更新缓存
    this.updateCache(key, value);
    
    // 添加到批处理队列
    this.addToBatch('put', key, value);
    
    return Promise.resolve();
  }

  async getItem(key) {
    // 性能优化：优先从缓存读取
    if (this.cache.has(key)) {
      const cachedItem = this.cache.get(key);
      // 检查缓存是否过期（1小时）
      if (Date.now() - cachedItem.timestamp < 3600000) {
        return cachedItem.value;
      } else {
        this.cache.delete(key);
      }
    }
    
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        const value = result ? result.value : undefined;
        
        // 性能优化：缓存读取的数据
        if (value !== undefined) {
          this.updateCache(key, value);
        }
        
        resolve(value);
      };
    });
  }

  async removeItem(key) {
    // 性能优化：从缓存移除
    this.cache.delete(key);
    
    // 添加到批处理队列
    this.addToBatch('delete', key);
    
    return Promise.resolve();
  }

  /**
   * 更新内存缓存
   * @private
   */
  updateCache(key, value) {
    // 控制缓存大小
    if (this.cache.size >= this.cacheSize) {
      // 删除最旧的条目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * 添加到批处理队列
   * @private
   */
  addToBatch(operation, key, value = null) {
    this.batchQueue.push({ operation, key, value, timestamp: Date.now() });
    
    // 如果队列满了或设置了定时器，立即执行批处理
    if (this.batchQueue.length >= this.batchSize) {
      this.executeBatch();
    } else if (!this.batchTimer) {
      // 设置延迟执行批处理
      this.batchTimer = setTimeout(() => {
        this.executeBatch();
      }, 100);
    }
  }

  /**
   * 执行批处理操作
   * @private
   */
  async executeBatch() {
    if (this.batchQueue.length === 0) return;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (!this.db) await this.init();
    
    const operations = this.batchQueue.splice(0);
    
    try {
      const transaction = this.db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      
      operations.forEach(({ operation, key, value }) => {
        try {
          switch (operation) {
            case 'put':
              store.put({ key, value, timestamp: Date.now() });
              break;
            case 'delete':
              store.delete(key);
              break;
          }
        } catch (error) {
          console.warn(`批处理操作失败: ${operation} ${key}`, error);
        }
      });
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      
    } catch (error) {
      console.error('批处理执行失败:', error);
    }
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 强制执行待处理的批操作
   */
  async flush() {
    await this.executeBatch();
  }
}

/**
 * LocalStorage存储后端
 */
class LocalStorageBackend {
  constructor(options) {
    this.options = options;
    this.prefix = options.prefix || 'translation_tool_';
  }

  setItem(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serialized);
    } catch (error) {
      throw new Error(`LocalStorage setItem failed: ${error.message}`);
    }
  }

  getItem(key) {
    try {
      const serialized = localStorage.getItem(this.prefix + key);
      return serialized ? JSON.parse(serialized) : undefined;
    } catch (error) {
      console.warn(`LocalStorage getItem failed for key ${key}:`, error);
      return undefined;
    }
  }

  removeItem(key) {
    localStorage.removeItem(this.prefix + key);
  }

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * SessionStorage存储后端
 */
class SessionStorageBackend {
  constructor(options) {
    this.options = options;
    this.prefix = options.prefix || 'translation_tool_';
  }

  setItem(key, value) {
    try {
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(this.prefix + key, serialized);
    } catch (error) {
      throw new Error(`SessionStorage setItem failed: ${error.message}`);
    }
  }

  getItem(key) {
    try {
      const serialized = sessionStorage.getItem(this.prefix + key);
      return serialized ? JSON.parse(serialized) : undefined;
    } catch (error) {
      console.warn(`SessionStorage getItem failed for key ${key}:`, error);
      return undefined;
    }
  }

  removeItem(key) {
    sessionStorage.removeItem(this.prefix + key);
  }

  clear() {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach(key => sessionStorage.removeItem(key));
  }
}

/**
 * 内存存储后端
 */
class MemoryStorageBackend {
  constructor(options) {
    this.storage = new Map();
    this.options = options;
  }

  setItem(key, value) {
    this.storage.set(key, value);
  }

  getItem(key) {
    return this.storage.get(key);
  }

  removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }

  exportAll() {
    const data = {};
    for (const [key, value] of this.storage) {
      data[key] = value;
    }
    return data;
  }
}

// ==================== 类型定义 ====================

/**
 * @typedef {Object} StorageBackend
 * @property {string} name - 后端名称
 * @property {number} priority - 优先级
 * @property {Object} capabilities - 能力配置
 * @property {Function} testFunction - 测试函数
 * @property {Function} createInstance - 创建实例函数
 * @property {boolean} available - 是否可用
 * @property {number} healthScore - 健康分数
 * @property {number} lastHealthCheck - 最后健康检查时间
 * @property {Object} [instance] - 实例对象
 */

/**
 * @typedef {Object} StorageStrategyStatus
 * @property {string|null} currentBackend - 当前后端名称
 * @property {Object|null} currentCapabilities - 当前后端能力
 * @property {Array<Object>} availableBackends - 可用后端列表
 * @property {Array<Object>} migrationQueue - 迁移队列
 * @property {boolean} autoMigrationEnabled - 是否启用自动迁移
 * @property {number} lastHealthCheck - 最后健康检查时间
 */

// ==================== 全局实例 ====================
const smartStorageStrategy = new SmartStorageStrategy();

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartStorageStrategy, smartStorageStrategy };
} else {
  // 浏览器环境
  window.SmartStorageStrategy = SmartStorageStrategy;
  window.smartStorageStrategy = smartStorageStrategy;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.services', 'SmartStorageStrategy', SmartStorageStrategy);
      namespaceManager.addToNamespace('App.services', 'smartStorageStrategy', smartStorageStrategy);
    } catch (error) {
      console.warn('智能存储策略命名空间注册失败:', error.message);
    }
  }
}

console.log('💾 智能存储降级策略已加载');
