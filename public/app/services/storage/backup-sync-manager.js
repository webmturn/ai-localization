// ==================== 存储同步和备份管理器 ====================
/**
 * P2改进：存储同步和备份功能
 * 提供数据备份、跨设备同步和数据恢复功能
 */

/**
 * 备份同步管理器
 * @class
 */
class BackupSyncManager {
  constructor() {
    /** @type {Map<string, BackupEntry>} */
    this.backups = new Map();
    /** @type {boolean} */
    this.autoBackupEnabled = true;
    /** @type {number} */
    this.backupInterval = 5 * 60 * 1000; // 5分钟
    /** @type {number} */
    this.maxBackups = 10;
    /** @type {Object} */
    this.syncConfig = {
      enabled: false,
      endpoint: null,
      token: null,
      deviceId: this.generateDeviceId()
    };
    /** @type {Array<SyncConflict>} */
    this.conflicts = [];
    
    this.initializeManager();
  }

  /**
   * 初始化管理器
   * @private
   */
  initializeManager() {
    // 加载现有备份
    this.loadBackupIndex();
    
    // 启动自动备份
    if (this.autoBackupEnabled) {
      this.startAutoBackup();
    }
    
    // 监听存储变化事件
    this.setupStorageListeners();
    
    console.log('💾 备份同步管理器已初始化');
  }

  /**
   * 加载备份索引
   * @private
   */
  async loadBackupIndex() {
    try {
      const indexData = localStorage.getItem('backup_index');
      if (indexData) {
        const index = JSON.parse(indexData);
        Object.entries(index).forEach(([id, backup]) => {
          this.backups.set(id, {
            ...backup,
            created: new Date(backup.created),
            lastModified: new Date(backup.lastModified)
          });
        });
        console.log(`📋 已加载 ${this.backups.size} 个备份记录`);
      }
    } catch (error) {
      console.error('加载备份索引失败:', error);
    }
  }

  /**
   * 保存备份索引
   * @private
   */
  saveBackupIndex() {
    try {
      const index = {};
      this.backups.forEach((backup, id) => {
        index[id] = {
          ...backup,
          created: backup.created.toISOString(),
          lastModified: backup.lastModified.toISOString()
        };
      });
      localStorage.setItem('backup_index', JSON.stringify(index));
    } catch (error) {
      console.error('保存备份索引失败:', error);
    }
  }

  /**
   * 启动自动备份
   * @private
   */
  startAutoBackup() {
    setInterval(() => {
      this.performAutoBackup();
    }, this.backupInterval);
    
    console.log(`⏰ 自动备份已启动，间隔: ${this.backupInterval / 1000}秒`);
  }

  /**
   * 执行自动备份
   * @private
   */
  async performAutoBackup() {
    try {
      // 检查是否有数据变化
      const hasChanges = await this.detectDataChanges();
      
      if (hasChanges) {
        const backupId = await this.createBackup({
          type: 'auto',
          description: '自动备份',
          includeSettings: true,
          includeTranslations: true,
          includeProjects: true
        });
        
        console.log(`🔄 自动备份已创建: ${backupId}`);
      }
    } catch (error) {
      console.error('自动备份失败:', error);
    }
  }

  /**
   * 检测数据变化
   * @private
   * @returns {Promise<boolean>} 是否有变化
   */
  async detectDataChanges() {
    try {
      // 获取当前数据的哈希值
      const currentHash = await this.calculateDataHash();
      const lastBackupHash = this.getLastBackupHash();
      
      return currentHash !== lastBackupHash;
    } catch (error) {
      console.warn('检测数据变化失败:', error);
      return true; // 出错时保守地认为有变化
    }
  }

  /**
   * 计算数据哈希值
   * @private
   * @returns {Promise<string>} 哈希值
   */
  async calculateDataHash() {
    const data = await this.collectAllData();
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString();
  }

  /**
   * 获取最后备份的哈希值
   * @private
   * @returns {string|null} 哈希值
   */
  getLastBackupHash() {
    const backupArray = Array.from(this.backups.values());
    const latestBackup = backupArray
      .sort((a, b) => b.created.getTime() - a.created.getTime())[0];
    
    return latestBackup?.dataHash || null;
  }

  /**
   * 创建备份
   * @param {BackupOptions} options - 备份选项
   * @returns {Promise<string>} 备份ID
   */
  async createBackup(options = {}) {
    const {
      type = 'manual',
      description = '手动备份',
      includeSettings = true,
      includeTranslations = true,
      includeProjects = true,
      includeQuality = false
    } = options;

    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date();
      
      // 收集数据
      const data = await this.collectAllData({
        includeSettings,
        includeTranslations,
        includeProjects,
        includeQuality
      });
      
      // 计算数据哈希
      const dataHash = await this.calculateDataHash();
      
      // 压缩数据
      const compressedData = this.compressData(data);
      
      // 创建备份记录
      const backup = {
        id: backupId,
        type,
        description,
        created: timestamp,
        lastModified: timestamp,
        size: this.calculateSize(compressedData),
        dataHash,
        checksum: this.calculateChecksum(compressedData),
        metadata: {
          version: '1.0',
          deviceId: this.syncConfig.deviceId,
          userAgent: navigator.userAgent,
          itemCount: this.countDataItems(data)
        }
      };
      
      // 存储备份数据
      await this.storeBackupData(backupId, compressedData);
      
      // 添加到备份列表
      this.backups.set(backupId, backup);
      
      // 清理旧备份
      await this.cleanupOldBackups();
      
      // 保存索引
      this.saveBackupIndex();
      
      console.log(`✅ 备份创建成功: ${backupId} (${backup.size} bytes)`);
      
      return backupId;
      
    } catch (error) {
      console.error('创建备份失败:', error);
      throw error;
    }
  }

  /**
   * 收集所有数据
   * @private
   * @param {Object} options - 收集选项
   * @returns {Promise<Object>} 收集的数据
   */
  async collectAllData(options = {}) {
    const data = {};
    
    if (options.includeSettings) {
      data.settings = await this.collectSettings();
    }
    
    if (options.includeTranslations) {
      data.translations = await this.collectTranslations();
    }
    
    if (options.includeProjects) {
      data.projects = await this.collectProjects();
    }
    
    if (options.includeQuality) {
      data.quality = await this.collectQuality();
    }
    
    return data;
  }

  /**
   * 收集设置数据
   * @private
   * @returns {Promise<Object>} 设置数据
   */
  async collectSettings() {
    const settings = {};
    
    // 从localStorage收集设置
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('setting_')) {
        settings[key] = localStorage.getItem(key);
      }
    }
    
    return settings;
  }

  /**
   * 收集翻译数据
   * @private
   * @returns {Promise<Object>} 翻译数据
   */
  async collectTranslations() {
    const translations = {};
    
    // 从localStorage收集翻译相关数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('translation_') || key.startsWith('project_'))) {
        try {
          translations[key] = JSON.parse(localStorage.getItem(key));
        } catch (error) {
          translations[key] = localStorage.getItem(key);
        }
      }
    }
    
    return translations;
  }

  /**
   * 收集项目数据
   * @private
   * @returns {Promise<Object>} 项目数据
   */
  async collectProjects() {
    const projects = {};
    
    // 从localStorage收集项目数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('project_')) {
        try {
          projects[key] = JSON.parse(localStorage.getItem(key));
        } catch (error) {
          projects[key] = localStorage.getItem(key);
        }
      }
    }
    
    return projects;
  }

  /**
   * 收集质量数据
   * @private
   * @returns {Promise<Object>} 质量数据
   */
  async collectQuality() {
    const quality = {};
    
    // 从localStorage收集质量相关数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('quality_')) {
        try {
          quality[key] = JSON.parse(localStorage.getItem(key));
        } catch (error) {
          quality[key] = localStorage.getItem(key);
        }
      }
    }
    
    return quality;
  }

  /**
   * 恢复备份
   * @param {string} backupId - 备份ID
   * @param {RestoreOptions} options - 恢复选项
   * @returns {Promise<boolean>} 是否成功
   */
  async restoreBackup(backupId, options = {}) {
    const {
      overwriteExisting = false,
      restoreSettings = true,
      restoreTranslations = true,
      restoreProjects = true,
      restoreQuality = false
    } = options;

    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        throw new Error(`备份不存在: ${backupId}`);
      }
      
      console.log(`🔄 开始恢复备份: ${backupId}`);
      
      // 加载备份数据
      const compressedData = await this.loadBackupData(backupId);
      
      // 验证数据完整性
      const checksum = this.calculateChecksum(compressedData);
      if (checksum !== backup.checksum) {
        throw new Error('备份数据校验失败');
      }
      
      // 解压缩数据
      const data = this.decompressData(compressedData);
      
      // 恢复数据
      if (restoreSettings && data.settings) {
        await this.restoreSettings(data.settings, overwriteExisting);
      }
      
      if (restoreTranslations && data.translations) {
        await this.restoreTranslations(data.translations, overwriteExisting);
      }
      
      if (restoreProjects && data.projects) {
        await this.restoreProjects(data.projects, overwriteExisting);
      }
      
      if (restoreQuality && data.quality) {
        await this.restoreQuality(data.quality, overwriteExisting);
      }
      
      console.log(`✅ 备份恢复成功: ${backupId}`);
      
      // 触发恢复完成事件
      this.dispatchEvent('backupRestored', {
        backupId,
        backup,
        restoredData: Object.keys(data)
      });
      
      return true;
      
    } catch (error) {
      console.error(`❌ 恢复备份失败: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * 恢复设置
   * @private
   * @param {Object} settings - 设置数据
   * @param {boolean} overwrite - 是否覆盖
   */
  async restoreSettings(settings, overwrite = false) {
    for (const [key, value] of Object.entries(settings)) {
      if (overwrite || !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
      }
    }
  }

  /**
   * 恢复翻译数据
   * @private
   * @param {Object} translations - 翻译数据
   * @param {boolean} overwrite - 是否覆盖
   */
  async restoreTranslations(translations, overwrite = false) {
    for (const [key, value] of Object.entries(translations)) {
      if (overwrite || !localStorage.getItem(key)) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, valueStr);
      }
    }
  }

  /**
   * 恢复项目数据
   * @private
   * @param {Object} projects - 项目数据
   * @param {boolean} overwrite - 是否覆盖
   */
  async restoreProjects(projects, overwrite = false) {
    for (const [key, value] of Object.entries(projects)) {
      if (overwrite || !localStorage.getItem(key)) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, valueStr);
      }
    }
  }

  /**
   * 删除备份
   * @param {string} backupId - 备份ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteBackup(backupId) {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        return false;
      }
      
      // 删除备份数据
      await this.deleteBackupData(backupId);
      
      // 从备份列表中移除
      this.backups.delete(backupId);
      
      // 保存索引
      this.saveBackupIndex();
      
      console.log(`🗑️ 已删除备份: ${backupId}`);
      
      return true;
    } catch (error) {
      console.error(`删除备份失败: ${backupId}`, error);
      return false;
    }
  }

  /**
   * 清理旧备份
   * @private
   */
  async cleanupOldBackups() {
    const backupArray = Array.from(this.backups.values());
    
    if (backupArray.length <= this.maxBackups) {
      return;
    }
    
    // 按创建时间排序，保留最新的
    const sortedBackups = backupArray
      .sort((a, b) => b.created.getTime() - a.created.getTime());
    
    const toDelete = sortedBackups.slice(this.maxBackups);
    
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }
    
    console.log(`🧹 已清理 ${toDelete.length} 个旧备份`);
  }

  /**
   * 获取备份列表
   * @returns {Array<BackupEntry>} 备份列表
   */
  getBackups() {
    return Array.from(this.backups.values())
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * 设置监听器
   * @private
   */
  setupStorageListeners() {
    // 监听存储事件
    window.addEventListener('storage', (event) => {
      if (event.key && (
        event.key.startsWith('translation_') ||
        event.key.startsWith('project_') ||
        event.key.startsWith('setting_')
      )) {
        // 数据变化，可能需要备份
        this.scheduleBackup();
      }
    });
  }

  /**
   * 计划备份
   * @private
   */
  scheduleBackup() {
    // 防抖处理，避免频繁备份
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout);
    }
    
    this.backupTimeout = setTimeout(() => {
      this.performAutoBackup();
    }, 30000); // 30秒后备份
  }

  // ==================== 工具方法 ====================

  /**
   * 生成设备ID
   * @private
   */
  generateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * 生成备份ID
   * @private
   */
  generateBackupId() {
    return 'backup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 压缩数据
   * @private
   */
  compressData(data) {
    // 简单的JSON压缩（实际应用中可以使用更好的压缩算法）
    return JSON.stringify(data);
  }

  /**
   * 解压缩数据
   * @private
   */
  decompressData(compressedData) {
    return JSON.parse(compressedData);
  }

  /**
   * 计算大小
   * @private
   */
  calculateSize(data) {
    return new Blob([data]).size;
  }

  /**
   * 计算校验和
   * @private
   */
  calculateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * 计算数据项数量
   * @private
   */
  countDataItems(data) {
    let count = 0;
    for (const section of Object.values(data)) {
      if (typeof section === 'object' && section !== null) {
        count += Object.keys(section).length;
      }
    }
    return count;
  }

  /**
   * 存储备份数据
   * @private
   */
  async storeBackupData(backupId, data) {
    localStorage.setItem(`backup_data_${backupId}`, data);
  }

  /**
   * 加载备份数据
   * @private
   */
  async loadBackupData(backupId) {
    const data = localStorage.getItem(`backup_data_${backupId}`);
    if (!data) {
      throw new Error(`备份数据不存在: ${backupId}`);
    }
    return data;
  }

  /**
   * 删除备份数据
   * @private
   */
  async deleteBackupData(backupId) {
    localStorage.removeItem(`backup_data_${backupId}`);
  }

  /**
   * 触发事件
   * @private
   */
  dispatchEvent(eventName, detail) {
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent(`backup${eventName}`, { detail });
      window.dispatchEvent(event);
    }
  }
}

// ==================== 类型定义 ====================

/**
 * @typedef {Object} BackupEntry
 * @property {string} id - 备份ID
 * @property {string} type - 备份类型
 * @property {string} description - 描述
 * @property {Date} created - 创建时间
 * @property {Date} lastModified - 最后修改时间
 * @property {number} size - 大小
 * @property {string} dataHash - 数据哈希
 * @property {string} checksum - 校验和
 * @property {Object} metadata - 元数据
 */

/**
 * @typedef {Object} BackupOptions
 * @property {string} [type] - 备份类型
 * @property {string} [description] - 描述
 * @property {boolean} [includeSettings] - 包含设置
 * @property {boolean} [includeTranslations] - 包含翻译
 * @property {boolean} [includeProjects] - 包含项目
 * @property {boolean} [includeQuality] - 包含质量数据
 */

/**
 * @typedef {Object} RestoreOptions
 * @property {boolean} [overwriteExisting] - 覆盖现有数据
 * @property {boolean} [restoreSettings] - 恢复设置
 * @property {boolean} [restoreTranslations] - 恢复翻译
 * @property {boolean} [restoreProjects] - 恢复项目
 * @property {boolean} [restoreQuality] - 恢复质量数据
 */

// ==================== 全局实例 ====================
const backupSyncManager = new BackupSyncManager();

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackupSyncManager, backupSyncManager };
} else {
  // 浏览器环境
  window.BackupSyncManager = BackupSyncManager;
  window.backupSyncManager = backupSyncManager;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.services', 'BackupSyncManager', BackupSyncManager);
      namespaceManager.addToNamespace('App.services', 'backupSyncManager', backupSyncManager);
    } catch (error) {
      console.warn('备份同步管理器命名空间注册失败:', error.message);
    }
  }
}

console.log('📦 存储备份同步管理器已加载');
