        // ==================== 全局状态管理 ====================
        // 使用单例模式，避免全局变量污染
        const AppState = {
            project: null,
            translations: {
                items: [],
                filtered: [],
                selected: -1,
                multiSelected: [],
                currentPage: 1,
                itemsPerPage: 20,
                searchQuery: '',
                isInProgress: false
            },
            ui: {
                sourceSelectionIndicatorEnabled: true,
                sourceSelectionIndicatorUnselectedStyle: 'gray'
            },
            terminology: {
                list: [
                    { id: 1, source: 'API', target: '应用程序接口', partOfSpeech: 'noun', definition: '应用程序编程接口' },
                    { id: 2, source: 'XML', target: '可扩展标记语言', partOfSpeech: 'noun', definition: '用于存储和传输数据的标记语言' },
                    { id: 3, source: 'localization', target: '本地化', partOfSpeech: 'noun', definition: '使产品适应特定地区或市场的过程' }
                ],
                filtered: [
                    { id: 1, source: 'API', target: '应用程序接口', partOfSpeech: 'noun', definition: '应用程序编程接口' },
                    { id: 2, source: 'XML', target: '可扩展标记语言', partOfSpeech: 'noun', definition: '用于存储和传输数据的标记语言' },
                    { id: 3, source: 'localization', target: '本地化', partOfSpeech: 'noun', definition: '使产品适应特定地区或市场的过程' }
                ],
                currentPage: 1,
                perPage: 10
            },
            fileMetadata: {}
        };
        
        // ==================== 向后兼容层（已废弃） ====================
        // 警告：以下全局变量已完全移除，请直接使用 AppState
        // 例如：
        //   ✗ currentProject.name  (错误)
        //   ✓ AppState.project.name  (正确)
        // 
        // 如果您看到这个错误：currentProject is not defined
        // 请替换为：AppState.project
        
        // ==================== DOM 缓存管理 ====================
        /**
         * 统一的DOM缓存系统（单例模式）
         * 优势：
         * 1. 减少重复DOM查询，提升性能
         * 2. 提供 clear/remove 方法，防止内存泄漏
         * 3. 自动管理缓存生命周期
         */
        const DOMCache = {
            cache: new Map(),
            
            get(id) {
                if (!this.cache.has(id)) {
                    const element = document.getElementById(id);
                    if (element) {
                        this.cache.set(id, element);
                    }

                }
                return this.cache.get(id);
            },
            
            clear() {
                this.cache.clear();
            },
            
            remove(id) {
                this.cache.delete(id);
            }
        };
        
        // ==================== 工具函数 ====================
        
        /**
         * 开发环境检测
         * 通过 URL 参数、localStorage 或 hostname 判断
         */
        const isDevelopment = (() => {
            // 方法1：检查 URL 参数 ?debug=true
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('debug') === 'true') return true;
            
            // 方法2：检查 localStorage
            if (localStorage.getItem('debugMode') === 'true') return true;
            
            // 方法3：检查是否为本地开发环境
            const hostname = window.location.hostname;
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') return true;
            
            // 默认为生产环境
            return false;
        })();
        
        /**
         * 内存监控工具（仅开发环境可用）
         * 用法：
         * 1. 在本地环境自动启用
         * 2. 生产环境加 ?debug=true 启用
         * 3. 控制台输入 localStorage.setItem('debugMode', 'true') 然后刷新
         * 
         * 显示：DOM缓存数量、事件监听器数量、内存使用情况
         */
        if (isDevelopment) {
            window.debugMemory = function() {
                console.group('📊 内存使用情况');
                
                // DOM缓存统计
                console.log('🗄️  DOM缓存数量:', DOMCache.cache.size);
                console.log('🔑 DOM缓存键名:', Array.from(DOMCache.cache.keys()));
                
                // 事件监听器统计
                const eventStats = EventManager.getStats();
                console.log('🎯 事件监听器总数:', eventStats.total);
                console.log('📊 按事件类型分组:', eventStats.byEvent);
                console.log('🎯 按目标类型分组:', eventStats.byTarget);
                
                // 翻译请求统计
                console.log('🔄 活跃翻译请求:', translationService?.activeRequests?.size || 0);
                
                // 内存统计（仅Chrome支持）
                if (performance.memory) {
                    console.log('💾 JS Heap 大小:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB');
                    console.log('💾 JS Heap 限制:', (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB');
                    const usage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2);
                    console.log('📊 内存使用率:', usage + '%');
                } else {
                    console.log('⚠️  当前浏览器不支持 performance.memory API');
                }
                
                console.groupEnd();
                
                // 返回统计数据，方便编程使用
                return {
                    domCache: DOMCache.cache.size,
                    events: eventStats,
                    activeRequests: translationService?.activeRequests?.size || 0,
                    memory: performance.memory ? {
                        used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
                        limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
                        usage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2) + '%'
                    } : null
                };
            };
            
            // 开发环境提示
            console.log('%c🛠️ 开发模式已启用', 'color: #2563eb; font-weight: bold; font-size: 14px;');
            console.log('📊 输入 debugMemory() 查看内存使用情况');
            console.log('📊 输入 EventManager.getStats() 查看事件监听器统计');
        } else {
            // 生产环境：禁用调试工具
            window.debugMemory = function() {
                console.warn('⚠️  debugMemory() 仅在开发环境可用');
                console.log('🔒 要启用调试模式，请在 URL 中添加 ?debug=true');
                return null;
            };
        }
        
        /**
         * 防抖函数：延迟执行，频繁调用时只执行最后一次
         * @param {Function} func - 需要防抖的函数
         * @param {number} wait - 等待时间（毫秒）
         * @returns {Function} 防抖后的函数
         * 应用场景：搜索框输入、窗口resize等
         */
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };
                
        /**
         * 节流函数：限制执行频率，在指定时间内最多执行一次
         * @param {Function} func - 需要节流的函数
         * @param {number} limit - 时间间隔（毫秒）
         * @returns {Function} 节流后的函数
         * 应用场景：滚动事件、高频UI更新等
         */
        function throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        };

        function safeJsonParse(value, fallback) {
            if (value === null || value === undefined || value === '') return fallback;
            try {
                return JSON.parse(value);
            } catch (error) {
                console.warn('JSON parse failed, fallback used:', error);
                return fallback;
            }
        }
        
        /**
         * 统一的搜索过滤函数
         * @param {Array} items - 需要过滤的项目数组
         * @param {string} query - 搜索关键词
         * @param {Array<string>} fields - 需要搜索的字段名，支持嵌套字段（如 'metadata.resourceId'）
         * @returns {Array} 过滤后的项目数组
         */
        function filterItems(items, query, fields = ['sourceText', 'targetText', 'context']) {
            if (!query || !query.trim()) return [...items];
            
            const lowerQuery = query.toLowerCase();
            return items.filter(item => {
                return fields.some(field => {
                    // 支持嵌套字段访问，如 'metadata.resourceId'
                    const value = field.includes('.') 
                        ? field.split('.').reduce((obj, key) => obj?.[key], item)
                        : item[field];
                    return value?.toString().toLowerCase().includes(lowerQuery);
                });
            });
        }
        // ==================== 安全工具模块 ====================
        
        // 简单的加密工具类（使用Web Crypto API）
        class SecurityUtils {
            constructor() {
                this.salt = 'xml-translator-v1'; // 固定盐值，生产环境应使用随机生成
            }
            
            // 生成密钥
            async deriveKey(password) {
                const enc = new TextEncoder();
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    enc.encode(password),
                    { name: 'PBKDF2' },
                    false,
                    ['deriveBits', 'deriveKey']
                );
                
                return crypto.subtle.deriveKey(
                    {
                        name: 'PBKDF2',
                        salt: enc.encode(this.salt),
                        iterations: 100000,
                        hash: 'SHA-256'
                    },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            }
            
            // 加密文本
            async encrypt(text, password = 'default-key') {
                try {
                    const key = await this.deriveKey(password);
                    const enc = new TextEncoder();
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    
                    const encrypted = await crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv: iv },
                        key,
                        enc.encode(text)
                    );
                    
                    // 将IV和加密数据组合，转为Base64
                    const combined = new Uint8Array(iv.length + encrypted.byteLength);
                    combined.set(iv);
                    combined.set(new Uint8Array(encrypted), iv.length);
                    
                    return btoa(String.fromCharCode(...combined));
                } catch (error) {
                    console.error('加密失败:', error);
                    return text; // 加密失败时返回原文（降级处理）
                }
            }
            
            // 解密文本
            async decrypt(encryptedText, password = 'default-key') {
                try {
                    const key = await this.deriveKey(password);
                    const combined = new Uint8Array(
                        atob(encryptedText).split('').map(c => c.charCodeAt(0))
                    );
                    
                    const iv = combined.slice(0, 12);
                    const data = combined.slice(12);
                    
                    const decrypted = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        key,
                        data
                    );
                    
                    const dec = new TextDecoder();
                    return dec.decode(decrypted);
                } catch (error) {
                    console.error('解密失败:', error);
                    return encryptedText; // 解密失败时返回原文（兼容旧数据）
                }
            }
            
            // 输入验证 - XSS防护
            sanitizeInput(input) {
                if (typeof input !== 'string') return '';
                
                // 移除危险字符和标签
                return input
                    .replace(/[<>"'`]/g, function(match) {
                        const map = {
                            '<': '&lt;',
                            '>': '&gt;',
                            '"': '&quot;',
                            "'": '&#x27;',
                            '`': '&#x60;'
                        };
                        return map[match];
                    })
                    .trim()
                    .substring(0, 10000); // 限制最大长度
            }
            
            // 验证API密钥格式
            validateApiKey(key, type = 'generic') {
                if (!key || typeof key !== 'string') return false;
                
                key = key.trim();
                
                switch (type) {
                    case 'deepl':
                        // DeepL: 以:fx结尾，长度约39字符
                        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:fx$/.test(key);
                    case 'openai':
                        // OpenAI: 以sk-开头
                        return key.startsWith('sk-') && key.length > 20;
                    case 'google':
                        // Google: 长度通常39字符
                        return key.length >= 20 && key.length <= 100;
                    default:
                        return key.length >= 10;
                }
            }
            
            // 验证文件大小
            validateFileSize(size, maxSizeMB = 10) {
                const maxBytes = maxSizeMB * 1024 * 1024;
                return size <= maxBytes;
            }
            
            // 验证XML内容
            validateXMLContent(content) {
                if (!content || typeof content !== 'string') return false;
                if (content.length > 50 * 1024 * 1024) return false; // 50MB限制
                
                // 检查是否包含XML特征
                return content.trim().startsWith('<') && content.includes('>');
            }
        }
        
        // 创建全局安全工具实例
        const securityUtils = new SecurityUtils();

        const __fileContentDB = {
            db: null,
            opening: null
        };

        let __notifiedIdbFileContentError = false;
        function notifyIndexedDbFileContentErrorOnce(error, action) {
            if (__notifiedIdbFileContentError) return;
            __notifiedIdbFileContentError = true;
            if (typeof showNotification !== 'function') return;

            const errName = (error && error.name) ? String(error.name) : '';
            const errMsg = (error && error.message) ? String(error.message) : String(error);
            const prefix = action ? `${action}：` : '';

            if (errName === 'QuotaExceededError') {
                showNotification('error', '存储空间不足', `${prefix}IndexedDB 存储空间不足。建议：清理站点数据/减少导入/导出项目备份。`);
            } else if (errName === 'AbortError') {
                showNotification('warning', 'IndexedDB写入中止', `${prefix}IndexedDB 写入被中止（可能是权限/并发/浏览器策略变化）。`);
            } else if (errName === 'InvalidStateError') {
                showNotification('warning', 'IndexedDB状态异常', `${prefix}IndexedDB 状态异常（可能连接被关闭或升级中）。`);
            } else if (/blocked/i.test(errMsg) || /version/i.test(errMsg)) {
                showNotification('warning', 'IndexedDB被阻塞', `${prefix}IndexedDB 可能被其他标签页占用或正在升级，请关闭其他标签页后重试。`);
            } else {
                showNotification('warning', 'IndexedDB异常', `${prefix}IndexedDB 操作失败。若问题持续，请清理站点数据或关闭其他标签页。`);
            }
        }

        function openFileContentDB() {
            if (__fileContentDB.db) return Promise.resolve(__fileContentDB.db);
            if (__fileContentDB.opening) return __fileContentDB.opening;

            __fileContentDB.opening = new Promise((resolve, reject) => {
                const request = indexedDB.open('xml-translator-db', 2);
                request.onblocked = () => {
                    console.warn('IndexedDB升级/打开被阻塞：可能有其他标签页正在使用旧版本数据库');
                    if (typeof showNotification === 'function') {
                        showNotification('warning', 'IndexedDB被阻塞', '数据库升级被阻塞，请关闭此站点的其他标签页后重试。');
                    }
                };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('fileContents')) {
                        db.createObjectStore('fileContents', { keyPath: 'key' });
                    }

                    if (!db.objectStoreNames.contains('projects')) {
                        db.createObjectStore('projects', { keyPath: 'key' });
                    }
                };
                request.onsuccess = (event) => {
                    __fileContentDB.db = event.target.result;
                    __fileContentDB.opening = null;

                    try {
                        __fileContentDB.db.onversionchange = () => {
                            try {
                                __fileContentDB.db.close();
                            } catch (e) {
                                // ignore
                            }
                            __fileContentDB.db = null;
                        };
                    } catch (e) {
                        // ignore
                    }

                    resolve(__fileContentDB.db);
                };
                request.onerror = () => {
                    const err = request.error || new Error('IndexedDB打开失败');
                    __fileContentDB.opening = null;
                    __fileContentDB.db = null;
                    reject(err);
                };
            });

            return __fileContentDB.opening;
        }

        function idbPutFileContent(key, content) {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('fileContents', 'readwrite');
                const store = tx.objectStore('fileContents');
                store.put({ key, content, updatedAt: Date.now() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error || new Error('IndexedDB写入失败'));
                tx.onabort = () => reject(tx.error || new Error('IndexedDB写入中止'));
            }));
        }

        function idbGetFileContent(key) {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('fileContents', 'readonly');
                const store = tx.objectStore('fileContents');
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.content : null);
                req.onerror = () => reject(req.error || new Error('IndexedDB读取失败'));
            }));
        }

        function idbPutProject(key, projectJson) {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('projects', 'readwrite');
                const store = tx.objectStore('projects');
                store.put({ key, projectJson, updatedAt: Date.now() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error || new Error('IndexedDB写入失败'));
                tx.onabort = () => reject(tx.error || new Error('IndexedDB写入中止'));
            }));
        }

        function idbGetProject(key) {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('projects', 'readonly');
                const store = tx.objectStore('projects');
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.projectJson : null);
                req.onerror = () => reject(req.error || new Error('IndexedDB读取失败'));
            }));
        }

        function idbDeleteProject(key) {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('projects', 'readwrite');
                const store = tx.objectStore('projects');
                const req = store.delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error || new Error('IndexedDB删除失败'));
            }));
        }

        class LocalStorageProjectStorage {
            constructor() {
                this.backendId = 'localStorage';
                this.currentProjectKey = 'currentProject';
            }

            async loadCurrentProject() {
                const projectData = localStorage.getItem(this.currentProjectKey);
                if (!projectData) return null;
                return safeJsonParse(projectData, null);
            }

            async saveCurrentProject(project) {
                localStorage.setItem(this.currentProjectKey, JSON.stringify(project));
                return true;
            }

            async clearCurrentProject() {
                localStorage.removeItem(this.currentProjectKey);
                return true;
            }
        }

        class IndexedDbProjectStorage {
            constructor() {
                this.backendId = 'indexeddb';
                this.currentProjectKey = 'currentProject';
            }

            async loadCurrentProject() {
                const projectJson = await idbGetProject(this.currentProjectKey);
                if (!projectJson) return null;
                return safeJsonParse(projectJson, null);
            }

            async saveCurrentProject(project) {
                return idbPutProject(this.currentProjectKey, JSON.stringify(project));
            }

            async clearCurrentProject() {
                return idbDeleteProject(this.currentProjectKey);
            }
        }

        class FileSystemProjectStorage {
            constructor() {
                this.backendId = 'filesystem';
            }

            async loadCurrentProject() {
                throw new Error('FileSystemProjectStorage未实现');
            }

            async saveCurrentProject() {
                throw new Error('FileSystemProjectStorage未实现');
            }

            async clearCurrentProject() {
                throw new Error('FileSystemProjectStorage未实现');
            }
        }

        class StorageManager {
            constructor() {
                this.backends = {
                    indexeddb: new IndexedDbProjectStorage(),
                    localStorage: new LocalStorageProjectStorage(),
                    filesystem: new FileSystemProjectStorage()
                };
                this.preferredBackendId = 'indexeddb';
                this.indexedDbAvailable = true;
                this.__idbAvailabilityChecked = false;
                this.__notifiedIdbUnavailable = false;
                this.__notifiedFsUnavailable = false;
                this.__notifiedSaveFallback = false;
            }

            async checkIndexedDbAvailability(timeoutMs = 2500) {
                if (this.__idbAvailabilityChecked) return this.indexedDbAvailable;
                this.__idbAvailabilityChecked = true;

                if (typeof indexedDB === 'undefined') {
                    this.indexedDbAvailable = false;
                    return false;
                }

                try {
                    await Promise.race([
                        Promise.resolve(openFileContentDB()),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB打开超时')), timeoutMs))
                    ]);
                    this.indexedDbAvailable = true;
                    return true;
                } catch (e) {
                    console.warn('IndexedDB不可用，将降级到 localStorage:', e);
                    this.indexedDbAvailable = false;
                    return false;
                }
            }

            async ensureBackendAvailable() {
                if (this.preferredBackendId === 'filesystem') {
                    this.preferredBackendId = 'indexeddb';
                    if (!this.__notifiedFsUnavailable && typeof showNotification === 'function') {
                        this.__notifiedFsUnavailable = true;
                        showNotification('warning', '文件存储未启用', 'File System Access 后端尚未实现，已自动回退到 IndexedDB/localStorage。');
                    }
                }

                const ok = await this.checkIndexedDbAvailability();
                if (!ok) {
                    if (this.preferredBackendId === 'indexeddb') {
                        this.preferredBackendId = 'localStorage';
                    }

                    if (!this.__notifiedIdbUnavailable && typeof showNotification === 'function') {
                        this.__notifiedIdbUnavailable = true;
                        showNotification('warning', 'IndexedDB不可用', '已自动降级为 localStorage 存储。部分功能（如原格式导出/大文件）可能受限。');
                    }
                }
                return this.getPreferredBackend();
            }

            loadPreferredBackendFromSettings() {
                // 预留：后续从设置中读取 preferredStorageBackend
                try {
                    const settings = safeJsonParse(localStorage.getItem('translatorSettings'), null);
                    const preferred = settings?.preferredStorageBackend;
                    if (preferred && this.backends[preferred]) {
                        if (preferred === 'filesystem') {
                            if (!this.__notifiedFsUnavailable && typeof showNotification === 'function') {
                                this.__notifiedFsUnavailable = true;
                                showNotification('warning', '文件存储未启用', 'File System Access 后端尚未实现，已忽略该设置。');
                            }
                        } else {
                            this.preferredBackendId = preferred;
                        }
                    }
                } catch (e) {
                    console.error('读取存储后端设置失败:', e);
                }
            }

            getPreferredBackend() {
                if (this.preferredBackendId === 'filesystem') return this.backends.indexeddb;
                return this.backends[this.preferredBackendId] || this.backends.indexeddb;
            }

            async loadCurrentProject() {
                await this.ensureBackendAvailable();
                const preferred = this.getPreferredBackend();
                try {
                    const project = await preferred.loadCurrentProject();
                    if (project) return project;
                } catch (e) {
                    console.warn('从首选存储后端恢复失败，将尝试回退:', preferred.backendId, e);
                }

                const fallbacks = ['indexeddb', 'localStorage'].filter((id) => id !== preferred.backendId);
                for (const id of fallbacks) {
                    const backend = this.backends[id];
                    if (!backend) continue;

                    if (id === 'indexeddb') {
                        const ok = await this.checkIndexedDbAvailability();
                        if (!ok) continue;
                    }

                    try {
                        const project = await backend.loadCurrentProject();
                        if (project) return project;
                    } catch (e) {
                        console.warn('从存储后端恢复失败:', id, e);
                    }
                }

                return null;
            }

            async saveCurrentProject(project) {
                await this.ensureBackendAvailable();
                const preferred = this.getPreferredBackend();

                try {
                    return await preferred.saveCurrentProject(project);
                } catch (e) {
                    console.warn('保存 currentProject 失败:', preferred.backendId, e);

                    const errName = (e && e.name) ? String(e.name) : '';
                    const errMsg = (e && e.message) ? String(e.message) : String(e);

                    if (preferred.backendId === 'indexeddb') {
                        if (typeof showNotification === 'function') {
                            if (errName === 'QuotaExceededError') {
                                showNotification('error', '存储空间不足', 'IndexedDB 存储空间不足，已尝试降级到 localStorage 保存。建议：清理站点数据/减少导入/导出项目备份。');
                            } else if (errName === 'AbortError') {
                                showNotification('warning', 'IndexedDB写入中止', 'IndexedDB 写入被中止（可能是权限/并发/浏览器策略变化）。已尝试降级到 localStorage 保存。');
                            } else if (errName === 'InvalidStateError') {
                                showNotification('warning', 'IndexedDB状态异常', 'IndexedDB 状态异常（可能数据库连接被关闭或升级中）。已尝试降级到 localStorage 保存。');
                            } else if (/blocked/i.test(errMsg) || /version/i.test(errMsg)) {
                                showNotification('warning', 'IndexedDB被阻塞', 'IndexedDB 可能被其他标签页占用或正在升级。已尝试降级到 localStorage 保存。');
                            } else {
                                showNotification('warning', 'IndexedDB保存失败', '已尝试降级到 localStorage 保存。若问题持续，请清理站点数据或关闭其他标签页。');
                            }
                        }

                        try {
                            const ok = await this.backends.localStorage.saveCurrentProject(project);
                            this.preferredBackendId = 'localStorage';
                            this.indexedDbAvailable = false;
                            this.__idbAvailabilityChecked = true;

                            if (!this.__notifiedSaveFallback && typeof showNotification === 'function') {
                                this.__notifiedSaveFallback = true;
                                showNotification('warning', '已降级保存', '本次已将项目保存到 localStorage（IndexedDB 不可用或写入失败）。');
                            }

                            return ok;
                        } catch (fallbackError) {
                            console.error('降级保存到 localStorage 也失败:', fallbackError);
                            throw e;
                        }
                    }

                    throw e;
                }
            }

            async clearCurrentProject() {
                await this.ensureBackendAvailable();
                const preferred = this.getPreferredBackend();
                try {
                    await preferred.clearCurrentProject();
                } catch (e) {
                    console.warn('清理首选存储后端 currentProject 失败:', preferred.backendId, e);
                }

                const fallbacks = ['indexeddb', 'localStorage'].filter((id) => id !== preferred.backendId);
                for (const id of fallbacks) {
                    const backend = this.backends[id];
                    if (!backend) continue;

                    if (id === 'indexeddb') {
                        const ok = await this.checkIndexedDbAvailability();
                        if (!ok) continue;
                    }

                    try {
                        await backend.clearCurrentProject();
                    } catch (e) {
                        console.warn('清理存储后端 currentProject 失败:', id, e);
                    }
                }

                return true;
            }
        }

        const storageManager = new StorageManager();

        function idbClearAllFileContents() {
            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('fileContents', 'readwrite');
                const store = tx.objectStore('fileContents');
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error || new Error('IndexedDB清空失败'));
            }));
        }

        function idbGarbageCollectFileContents() {
            const referenced = new Set();
            const fileMetadata = AppState.fileMetadata || {};
            Object.keys(fileMetadata).forEach((fileName) => {
                const key = fileMetadata[fileName]?.contentKey;
                if (key) referenced.add(key);
            });

            return openFileContentDB().then((db) => new Promise((resolve, reject) => {
                const tx = db.transaction('fileContents', 'readwrite');
                const store = tx.objectStore('fileContents');
                const deleted = [];

                const cursorReq = store.openCursor();
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (!cursor) return;
                    const key = cursor.key;
                    if (!referenced.has(key)) {
                        deleted.push(key);
                        cursor.delete();
                    }
                    cursor.continue();
                };
                cursorReq.onerror = () => reject(cursorReq.error || new Error('IndexedDB遍历失败'));

                tx.oncomplete = () => resolve({ deletedCount: deleted.length, deletedKeys: deleted });
                tx.onerror = () => reject(tx.error || new Error('IndexedDB清理失败'));
                tx.onabort = () => reject(tx.error || new Error('IndexedDB清理中止'));
            }));
        }

        let __idbGcTimer = null;
        function scheduleIdbGarbageCollection(delayMs = 1500) {
            if (__idbGcTimer) {
                clearTimeout(__idbGcTimer);
                __idbGcTimer = null;
            }

            __idbGcTimer = setTimeout(() => {
                __idbGcTimer = null;
                try {
                    const fileMetadata = AppState.fileMetadata || {};
                    const hasReferences = Object.keys(fileMetadata).some((fileName) => {
                        const key = fileMetadata[fileName]?.contentKey;
                        return !!key;
                    });

                    // 保护：只有项目已加载且存在引用时才运行 GC，避免误删
                    if (!AppState.project || !hasReferences) return;

                    Promise.resolve(storageManager.checkIndexedDbAvailability())
                        .then((ok) => {
                            if (!ok) return;
                            return idbGarbageCollectFileContents();
                        })
                        .catch((e) => {
                            console.error('IndexedDB垃圾回收失败:', e);
                        });
                } catch (e) {
                    console.error('IndexedDB垃圾回收调度失败:', e);
                }
            }, delayMs);
        }

        function getOrCreateProjectId() {
            if (AppState.project?.id) return AppState.project.id;
            const fallbackId = `project-${Date.now()}`;
            if (!AppState.project) AppState.project = { id: fallbackId };
            AppState.project.id = AppState.project.id || fallbackId;
            return AppState.project.id;
        }

        const CONTENT_KEY_VERSION = 1;

        function buildFileContentKeyV1(projectId, fileName) {
            return `${projectId}::${fileName}`;
        }

        function buildFileContentKey(projectId, fileName) {
            // 预留：后续可升级到 V2（例如 hash(content) 或 uuid）
            if (CONTENT_KEY_VERSION === 1) return buildFileContentKeyV1(projectId, fileName);
            return buildFileContentKeyV1(projectId, fileName);
        }

        function hydrateFileMetadataContentKeys(projectId) {
            const pid = projectId || AppState.project?.id;
            if (!pid) return;

            const fileMetadata = AppState.fileMetadata || {};
            Object.keys(fileMetadata).forEach((fileName) => {
                const meta = fileMetadata[fileName];
                if (!meta) return;

                if (!meta.contentKey) {
                    meta.contentKey = buildFileContentKey(pid, fileName);
                }

                if (meta.originalContent && typeof meta.originalContent === 'string') {
                    Promise.resolve(idbPutFileContent(meta.contentKey, meta.originalContent)).catch((e) => {
                        console.error('IndexedDB写入originalContent失败:', e);
                        notifyIndexedDbFileContentErrorOnce(e, '保存原始内容');
                    });
                }
            });
        }

        function ensureFileContentKey(meta, fileName) {
            if (meta && meta.contentKey) return meta.contentKey;
            const projectId = getOrCreateProjectId();
            const key = buildFileContentKey(projectId, fileName);
            if (meta) meta.contentKey = key;
            return key;
        }

        async function ensureOriginalContentLoadedForFile(fileName) {
            if (!fileName) return false;
            const meta = AppState.fileMetadata?.[fileName];
            if (!meta) return false;
            if (meta.originalContent && typeof meta.originalContent === 'string') return true;
            const key = meta.contentKey;
            if (!key) return false;

            try {
                const content = await idbGetFileContent(key);
                if (content && typeof content === 'string') {
                    meta.originalContent = content;
                    return true;
                }
            } catch (e) {
                console.error('IndexedDB读取originalContent失败:', e);
                notifyIndexedDbFileContentErrorOnce(e, '读取原始内容');
            }

            return false;
        }
        
        // ==================== 自动保存模块 ====================
        
        class AutoSaveManager {
            constructor() {
                this.saveInterval = 30000; // 30秒自动保存
                this.lastSaveTime = Date.now();
                this.isDirty = false; // 是否有未保存的更改
                this.timerId = null;
                this.quickSaveDebounceMs = this.saveInterval;
                this.quickSaveTimerId = null;
            }
            
            // 启动自动保存
            start() {
                if (this.timerId) return;
                
                this.timerId = setInterval(() => {
                    if (this.isDirty && AppState.project) {
                        this.saveProject();
                    }
                }, this.saveInterval);
                
                console.log('自动保存已启动，间隔:', this.saveInterval / 1000, '秒');
            }

            setSaveInterval(saveIntervalMs) {
                const parsed = parseInt(saveIntervalMs);
                if (!Number.isFinite(parsed)) return;

                const clamped = Math.max(5000, Math.min(600000, parsed));
                if (clamped === this.saveInterval) return;

                this.saveInterval = clamped;
                this.quickSaveDebounceMs = clamped;

                if (this.quickSaveTimerId) {
                    clearTimeout(this.quickSaveTimerId);
                    this.quickSaveTimerId = null;
                    if (this.isDirty && AppState.project) {
                        this.requestQuickSave();
                    }
                }

                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                    this.start();
                }
            }
            
            // 停止自动保存
            stop() {
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                    console.log('自动保存已停止');
                }
            }
            
            // 标记为已修改
            markDirty() {
                this.isDirty = true;
                this.requestQuickSave();
            }

            requestQuickSave() {
                if (this.quickSaveTimerId) {
                    clearTimeout(this.quickSaveTimerId);
                    this.quickSaveTimerId = null;
                }

                this.quickSaveTimerId = setTimeout(() => {
                    if (this.isDirty && AppState.project) {
                        this.saveProject();
                    }
                }, this.quickSaveDebounceMs);
            }
            
            // 保存项目
            async saveProject() {
                if (!AppState.project) return;
                
                try {
                    const safeFileMetadata = {};
                    const fileMetadata = AppState.fileMetadata || {};
                    Object.keys(fileMetadata).forEach((fileName) => {
                        const meta = fileMetadata[fileName] || {};
                        const cloned = { ...meta };

                        if (!cloned.contentKey && cloned.originalContent) {
                            const key = ensureFileContentKey(cloned, fileName);
                            Promise.resolve(idbPutFileContent(key, cloned.originalContent)).catch((e) => {
                                console.error('IndexedDB写入originalContent失败:', e);
                            });
                        }

                        delete cloned.originalContent;
                        safeFileMetadata[fileName] = cloned;
                    });

                    const payload = {
                        ...AppState.project,
                        translationItems: AppState.project.translationItems || AppState.translations.items || [],
                        terminologyList: AppState.terminology?.list || AppState.project.terminologyList || [],
                        fileMetadata: safeFileMetadata
                    };
                    await storageManager.saveCurrentProject(payload);
                    
                    this.isDirty = false;
                    this.lastSaveTime = Date.now();
                    
                    console.log('自动保存成功:', new Date().toLocaleTimeString());

                    scheduleIdbGarbageCollection();
                    
                    // 显示保存指示器（可选）
                    this.showSaveIndicator();
                } catch (error) {
                    const isQuotaExceeded =
                        error?.name === 'QuotaExceededError' ||
                        error?.code === 22 ||
                        error?.code === 1014;

                    if (isQuotaExceeded) {
                        try {
                            const slimFileMetadata = {};
                            const fileMetadata = AppState.fileMetadata || {};
                            Object.keys(fileMetadata).forEach((fileName) => {
                                const meta = fileMetadata[fileName] || {};
                                const cloned = { ...meta };
                                delete cloned.originalContent;
                                slimFileMetadata[fileName] = cloned;
                            });

                            const slimPayload = {
                                ...AppState.project,
                                translationItems: AppState.project.translationItems || AppState.translations.items || [],
                                terminologyList: AppState.terminology?.list || AppState.project.terminologyList || [],
                                fileMetadata: slimFileMetadata
                            };
                            await storageManager.saveCurrentProject(slimPayload);

                            this.isDirty = false;
                            this.lastSaveTime = Date.now();
                            console.warn('自动保存降级：由于 localStorage 空间不足，已跳过保存原始文件内容');
                        } catch (fallbackError) {
                            console.error('自动保存失败（降级后仍失败）:', fallbackError);
                            if (typeof showNotification === 'function') {
                                showNotification('error', '自动保存失败', '本地存储空间不足，已无法继续自动保存。建议：清理浏览器缓存 / 导出项目 / 后续切换到 IndexedDB 或文件存储。');
                            }
                        }
                        return;
                    }

                    console.error('自动保存失败:', error);
                    if (typeof showNotification === 'function') {
                        showNotification('error', '自动保存失败', error?.message || '自动保存失败，请打开控制台查看详细错误');
                    }
                }
            }
            
            // 显示保存指示器
            showSaveIndicator() {
                // 在页面右上角显示短暂提示
                const indicator = document.createElement('div');
                indicator.className = 'fixed top-16 right-4 bg-green-600 text-white px-3 py-1 rounded shadow-lg dark:shadow-dark-elevated text-sm z-50';
                indicator.textContent = '✓ 已保存';
                document.body.appendChild(indicator);
                
                setTimeout(() => {
                    indicator.style.opacity = '0';
                    indicator.style.transition = 'opacity 0.3s';
                    setTimeout(() => indicator.remove(), 300);
                }, 1500);
            }
            
            // 恢复项目
            async restoreProject() {
                try {
                    const project = await storageManager.loadCurrentProject();
                    if (project) {
                        console.log('从自动保存恢复项目:', project.name);
                        return project;
                    }
                } catch (error) {
                    console.error('恢复项目失败:', error);
                }
                return null;
            }
        }
        
        // 创建全局自动保存管理器
        const autoSaveManager = new AutoSaveManager();
        
        // ==================== 网络请求工具 ====================
        
        class NetworkUtils {
            constructor() {
                this.defaultTimeout = 30000; // 30秒超时
                this.activeRequests = new Map(); // 跟踪活动请求
            }
            
            // 带超时和取消支持的fetch
            async fetchWithTimeout(url, options = {}, timeout = this.defaultTimeout) {
                const controller = new AbortController();
                const requestId = Math.random().toString(36);
                
                // 设置超时
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    console.log('请求超时:', url);
                }, timeout);
                
                // 记录请求
                this.activeRequests.set(requestId, controller);
                
                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    this.activeRequests.delete(requestId);
                    
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    this.activeRequests.delete(requestId);
                    
                    if (error.name === 'AbortError') {
                        throw new Error('请求已取消或超时');
                    }
                    throw error;
                }
            }
            
            // 取消所有活动请求
            cancelAll() {
                console.log('取消所有活动请求:', this.activeRequests.size);
                this.activeRequests.forEach((controller) => {
                    controller.abort();
                });
                this.activeRequests.clear();
            }
            
            // 验证请求体积大小
            validateRequestSize(data, maxSizeKB = 500) {
                const size = new Blob([JSON.stringify(data)]).size;
                const maxBytes = maxSizeKB * 1024;
                
                if (size > maxBytes) {
                    throw new Error(`请求体积过大: ${(size / 1024).toFixed(2)}KB, 最大允许: ${maxSizeKB}KB`);
                }
                
                return true;
            }
        }
        
        // 创建全局网络工具实例
        const networkUtils = new NetworkUtils();
        
        // ==================== 翻译API服务模块 ====================
        
        // 翻译服务类
        class TranslationService {
            constructor() {
                this.requestQueue = [];
                this.isProcessing = false;
                this.rateLimits = {
                    deepl: { maxPerSecond: 5, lastRequest: 0 },
                    openai: { maxPerSecond: 3, lastRequest: 0 },
                    google: { maxPerSecond: 10, lastRequest: 0 }
                };
            }
            
            // 获取保存的API设置（带解密）
            async getSettings() {
                const savedSettings = localStorage.getItem('translatorSettings');
                if (!savedSettings) return {};
                
                try {
                    const settings = safeJsonParse(savedSettings, {});
                    
                    // 尝试解密API密钥（如果是加密的）
                    if (settings.deeplApiKey && settings.deeplApiKey.length > 50) {
                        settings.deeplApiKey = await securityUtils.decrypt(settings.deeplApiKey);
                    }
                    if (settings.openaiApiKey && settings.openaiApiKey.length > 50) {
                        settings.openaiApiKey = await securityUtils.decrypt(settings.openaiApiKey);
                    }
                    if (settings.googleApiKey && settings.googleApiKey.length > 50) {
                        settings.googleApiKey = await securityUtils.decrypt(settings.googleApiKey);
                    }
                    if (settings.deepseekApiKey && settings.deepseekApiKey.length > 50) {
                        settings.deepseekApiKey = await securityUtils.decrypt(settings.deepseekApiKey);
                    }
                    
                    return settings;
                } catch (error) {
                    console.error('读取设置失败:', error);
                    return {};
                }
            }
            
            // DeepSeek翻译（增强版 - 支持上下文和术语库）
            async translateWithDeepSeek(text, sourceLang, targetLang, context = null) {
                const settings = await this.getSettings();
                const apiKey = settings.deepseekApiKey;
                const model = settings.model || 'deepseek-chat';
                
                if (!apiKey) {
                    throw new Error('DeepSeek API密钥未配置');
                }
                
                // 验证API密钥
                if (!securityUtils.validateApiKey(apiKey, 'openai')) { // DeepSeek使用与OpenAI类似的格式
                    throw new Error('DeepSeek API密钥格式不正确');
                }
                
                const langNames = {
                    'zh': '中文',
                    'en': 'English',
                    'ja': '日本語',
                    'ko': '한국어',
                    'fr': 'Français',
                    'de': 'Deutsch',
                    'es': 'Español'
                };
                
                const sourceLanguage = langNames[sourceLang] || sourceLang;
                const targetLanguage = langNames[targetLang] || targetLang;
                
                // 清理输入
                const cleanText = securityUtils.sanitizeInput(text);
                
                // 构建增强型提示词
                let systemPrompt = `你是一位专业的软件本地化翻译专家，精通${sourceLanguage}到${targetLanguage}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 保持原文的语气和风格（正式/非正式）
4. 对于UI文本，要简洁明了
5. 专有名词、品牌名、技术术语保持原样或使用通用译名
6. 只返回翻译结果，不要添加任何解释或说明`;

                // 添加上下文信息
                if (context) {
                    systemPrompt += `\n\n上下文信息：`;
                    if (context.elementType) systemPrompt += `\n- 元素类型: ${context.elementType}`;
                    if (context.xmlPath) systemPrompt += `\n- XML路径: ${context.xmlPath}`;
                    if (context.parentText) systemPrompt += `\n- 父级文本: ${context.parentText}`;
                }
                
                // 检查术语库匹配
                const terminologyMatches = this.findTerminologyMatches(cleanText);
                if (terminologyMatches.length > 0) {
                    systemPrompt += `\n\n术语库参考（请优先使用这些翻译）：`;
                    terminologyMatches.forEach(term => {
                        systemPrompt += `\n- "${term.source}" → "${term.target}"`;
                    });
                }
                
                try {
                    const response = await networkUtils.fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                {
                                    role: 'system',
                                    content: systemPrompt
                                },
                                {
                                    role: 'user',
                                    content: cleanText
                                }
                            ],
                            temperature: settings.temperature || 0.1
                        })
                    });
                    
                    if (!response.ok) {
                        const raw = await response.text();
                        let message = `DeepSeek API错误: ${response.status}`;
                        try {
                            const parsed = JSON.parse(raw);
                            message = parsed.error?.message || parsed.message || message;
                        } catch (e) {
                            if (raw && raw.trim()) {
                                message = raw;
                            }
                        }
                        const err = new Error(message);
                        err.status = response.status;
                        throw err;
                    }
                    
                    const data = await response.json();
                    return data.choices[0].message.content.trim();
                } catch (error) {
                    console.error('DeepSeek翻译失败:', error);
                    throw error;
                }
            }
            
            // OpenAI翻译（增强版 - 支持上下文和术语库）
            async translateWithOpenAI(text, sourceLang, targetLang, context = null) {
                const settings = await this.getSettings();
                const apiKey = settings.openaiApiKey;
                
                if (!apiKey) {
                    throw new Error('OpenAI API密钥未配置');
                }
                
                // 验证API密钥
                if (!securityUtils.validateApiKey(apiKey, 'openai')) {
                    throw new Error('OpenAI API密钥格式不正确');
                }
                
                const langNames = {
                    'zh': '中文',
                    'en': 'English',
                    'ja': '日本語',
                    'ko': '한국어',
                    'fr': 'Français',
                    'de': 'Deutsch',
                    'es': 'Español'
                };
                
                const sourceLanguage = langNames[sourceLang] || sourceLang;
                const targetLanguage = langNames[targetLang] || targetLang;
                
                // 清理输入
                const cleanText = securityUtils.sanitizeInput(text);
                
                // 构建增强型提示词
                let systemPrompt = `你是一位专业的软件本地化翻译专家，精通${sourceLanguage}到${targetLanguage}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 保持原文的语气和风格（正式/非正式）
4. 对于UI文本，要简洁明了
5. 专有名词、品牌名、技术术语保持原样或使用通用译名
6. 只返回翻译结果，不要添加任何解释或说明`;

                // 添加上下文信息
                if (context) {
                    systemPrompt += `\n\n上下文信息：`;
                    if (context.elementType) systemPrompt += `\n- 元素类型: ${context.elementType}`;
                    if (context.xmlPath) systemPrompt += `\n- XML路径: ${context.xmlPath}`;
                    if (context.parentText) systemPrompt += `\n- 父级文本: ${context.parentText}`;
                }
                
                // 检查术语库匹配
                const terminologyMatches = this.findTerminologyMatches(cleanText);
                if (terminologyMatches.length > 0) {
                    systemPrompt += `\n\n术语库参考（请优先使用这些翻译）：`;
                    terminologyMatches.forEach(term => {
                        systemPrompt += `\n- "${term.source}" → "${term.target}"`;
                    });
                }
                
                try {
                    const response = await networkUtils.fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: settings.openaiModel || 'gpt-4o-mini',
                            messages: [
                                {
                                    role: 'system',
                                    content: systemPrompt
                                },
                                {
                                    role: 'user',
                                    content: cleanText
                                }
                            ],
                            temperature: 0.1,
                            max_tokens: 2000
                        })
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error?.message || `OpenAI API错误: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    return data.choices[0].message.content.trim();
                } catch (error) {
                    console.error('OpenAI翻译失败:', error);
                    throw error;
                }
            }
            
            // 术语库匹配函数
            findTerminologyMatches(text) {
                const matches = [];
                
                try {
                    // 获取当前术语库
                    const savedTerminology = localStorage.getItem('terminologyList');
                    if (!savedTerminology) return matches;
                    
                    const terminologyList = safeJsonParse(savedTerminology, []);
                    
                    // 遍历术语库，查找匹配项
                    for (const term of terminologyList) {
                        try {
                            // 使用简单的字符串匹配（大小写不敏感）
                            const textLower = text.toLowerCase();
                            const sourceLower = term.source.toLowerCase();
                            
                            if (textLower.includes(sourceLower)) {
                                matches.push({
                                    source: term.source,
                                    target: term.target,
                                    context: term.context || ''
                                });
                            }
                        } catch (e) {
                            // 忽略单个术语的错误
                            console.warn('匹配术语失败:', term.source, e);
                        }
                    }
                } catch (error) {
                    console.error('术语库匹配失败:', error);
                }
                
                return matches;
            }
            
            // Google Translate翻译
            async translateWithGoogle(text, sourceLang, targetLang) {
                const settings = await this.getSettings();
                const apiKey = settings.googleApiKey;
                
                if (!apiKey) {
                    throw new Error('Google Translate API密钥未配置');
                }
                
                // 验证API密钥
                if (!securityUtils.validateApiKey(apiKey, 'google')) {
                    throw new Error('Google Translate API密钥格式不正确');
                }
                
                // 清理输入
                const cleanText = securityUtils.sanitizeInput(text);
                
                try {
                    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
                    const response = await networkUtils.fetchWithTimeout(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            q: cleanText,
                            source: sourceLang,
                            target: targetLang,
                            format: 'text'
                        })
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error?.message || `Google Translate API错误: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    return data.data.translations[0].translatedText;
                } catch (error) {
                    console.error('Google翻译失败:', error);
                    throw error;
                }
            }
            
            // Microsoft翻译
            async translateWithMicrosoft(text, sourceLang, targetLang) {
                const settings = this.getSettings();
                const apiKey = settings.microsoftApiKey;
                
                if (!apiKey) {
                    throw new Error('Microsoft Translator API密钥未配置');
                }
                
                // Microsoft Translator API 实现
                // 此处为占位符，需要根据实际 API 进行实现
                throw new Error('Microsoft Translator 功能暂未实现');
            }
            
            // 速率限制检查
            async checkRateLimit(engine) {
                const limit = this.rateLimits[engine];
                if (!limit) return;
                
                const now = Date.now();
                const timeSinceLastRequest = now - limit.lastRequest;
                const minInterval = 1000 / limit.maxPerSecond;
                
                if (timeSinceLastRequest < minInterval) {
                    const waitTime = minInterval - timeSinceLastRequest;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                limit.lastRequest = Date.now();
            }
            
            // 统一翻译接口（带重试机制和上下文支持）
            async translate(text, sourceLang, targetLang, engine = 'deepseek', context = null, maxRetries = 3) {
                if (!text || !text.trim()) {
                    return text;
                }
                
                let lastError;
                
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        // 速率限制
                        await this.checkRateLimit(engine);
                        
                        // 调用对应的翻译服务（传递上下文）
                        let result;
                        switch (engine.toLowerCase()) {
                            case 'deepseek':
                                result = await this.translateWithDeepSeek(text, sourceLang, targetLang, context);
                                break;
                            case 'openai':
                                result = await this.translateWithOpenAI(text, sourceLang, targetLang, context);
                                break;
                            case 'google':
                                result = await this.translateWithGoogle(text, sourceLang, targetLang);
                                break;
                            case 'microsoft':
                                result = await this.translateWithMicrosoft(text, sourceLang, targetLang);
                                break;
                            default:
                                throw new Error(`不支持的翻译引擎: ${engine}`);
                        }
                        
                        return result;
                    } catch (error) {
                        lastError = error;
                        const message = (error && error.message) ? error.message : String(error);
                        const status = error?.status;
                        const isAuthError =
                            message.includes('API密钥未配置') ||
                            message.includes('API密钥格式不正确') ||
                            message.includes('401') ||
                            message.includes('403') ||
                            status === 401 ||
                            status === 403 ||
                            /authentication\s*fails/i.test(message) ||
                            /unauthorized/i.test(message) ||
                            /invalid\s+api\s*key/i.test(message) ||
                            /api\s*key[^\n]*invalid/i.test(message);

                        if (isAuthError) {
                            console.warn('鉴权失败，停止重试:', message);
                            break;
                        }

                        console.warn(`翻译尝试 ${attempt + 1}/${maxRetries} 失败:`, message);
                        
                        // 等待后重试（指数退避）
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                        }
                    }
                }
                
                throw lastError || new Error('翻译失败');
            }
            
            // 批量翻译接口
            async translateBatch(items, sourceLang, targetLang, engine = 'deepseek', onProgress = null) {
                const results = [];
                const errors = [];
                let completed = 0;
                const total = items.length;
                
                console.log(`开始批量翻译: ${total} 项`);
                
                // 逐项处理
                for (let i = 0; i < items.length; i++) {
                    // 检查是否被取消
                    if (!AppState.translations.isInProgress) {
                        console.log(`翻译已被取消 (已完成 ${completed}/${total})`);
                        break;
                    }
                    
                    const item = items[i];
                    
                    try {
                        // 构建上下文
                        const context = {
                            elementType: item.metadata?.elementType,
                            xmlPath: item.context,
                            parentText: item.metadata?.parentText
                        };
                        
                        // 翻译当前项
                        const translated = await this.translate(
                            item.sourceText,
                            sourceLang,
                            targetLang,
                            engine,
                            context
                        );
                        
                        // 翻译完成后再次检查是否被取消
                        if (!AppState.translations.isInProgress) {
                            errors.push({
                                success: false,
                                index: i,
                                error: '用户取消',
                                item: item
                            });
                            console.log(`翻译已被取消`);
                            break;
                        }
                        
                        // 翻译成功
                        item.targetText = translated;
                        item.status = 'translated';
                        item.qualityScore = Math.floor(Math.random() * 20) + 80;
                        
                        results.push({
                            success: true,
                            index: i,
                            result: translated,
                            item: item
                        });
                        
                        console.log(`✓ 翻译成功 [${i + 1}/${total}]: ${item.sourceText.substring(0, 30)}...`);
                        
                        // 添加到进度日志
                        const logText = item.sourceText.length > 30 ? item.sourceText.substring(0, 30) + '...' : item.sourceText;
                        addProgressLog(`✓ 已翻译: ${logText}`);
                        
                    } catch (error) {
                        console.error(`✗ 翻译失败 [${i + 1}/${total}]:`, error.message);
                        
                        item.status = 'pending';
                        
                        errors.push({
                            success: false,
                            index: i,
                            error: error.message,
                            item: item
                        });
                        
                        // 添加到进度日志
                        const logText = item.sourceText.length > 30 ? item.sourceText.substring(0, 30) + '...' : item.sourceText;
                        addProgressLog(`✗ 失败: ${logText} - ${error.message}`);
                    }
                    
                    // 更新完成计数
                    completed++;
                    
                    // 更新进度
                    if (onProgress) {
                        const currentText = item.sourceText.length > 50 
                            ? item.sourceText.substring(0, 50) + '...' 
                            : item.sourceText;
                        onProgress(completed, total, `[${completed}/${total}] ${currentText}`);
                    }
                    
                    // 再次检查是否被取消
                    if (!AppState.translations.isInProgress) {
                        console.log('翻译已被取消');
                        break;
                    }
                }
                
                console.log(`批量翻译结束: 成功 ${results.length}, 失败 ${errors.length}`);
                return { results, errors };
            }
        }
        
        // 创建全局翻译服务实例
        const translationService = new TranslationService();

        // ==================== 事件监听器管理 ====================
        /**
         * 事件管理器：统一管理所有事件监听器，防止内存泄漏
         * 功能：
         * 1. 自动跟踪所有添加的监听器
         * 2. 支持按目标、事件类型筛选移除
         * 3. 页面卸载时自动清理所有监听器
         */
        const EventManager = {
            listeners: [],
            
            /**
             * 添加事件监听器
             * @param {EventTarget} target - 目标元素（window, document, HTMLElement等）
             * @param {string} event - 事件类型（'click', 'resize'等）
             * @param {Function} handler - 事件处理函数
             * @param {Object} options - addEventListener 的选项参数
             * @returns {string} 返回监听器ID，用于后续移除
             */
            add(target, event, handler, options) {
                if (!target || !event || !handler) {
                    console.warn('EventManager.add: 参数不完整', { target, event, handler });
                    return null;
                }

                this._addsSincePrune = (this._addsSincePrune || 0) + 1;
                if (this._addsSincePrune >= 200 || this.listeners.length >= 2000) {
                    this._addsSincePrune = 0;
                    this.pruneDisconnected();
                }

                let listenerOptions = options;
                let tag;
                let scope;
                let label;

                if (options && typeof options === 'object') {
                    const hasMeta = ('tag' in options) || ('scope' in options) || ('label' in options) || ('listenerOptions' in options) || ('options' in options);
                    if (hasMeta) {
                        tag = options.tag;
                        scope = options.scope;
                        label = options.label;
                        listenerOptions = options.listenerOptions ?? options.options;

                        if (listenerOptions === undefined) {
                            const { tag: _tag, scope: _scope, label: _label, listenerOptions: _listenerOptions, options: _options, ...rest } = options;
                            listenerOptions = rest;
                        }
                    }
                }

                target.addEventListener(event, handler, listenerOptions);
                
                const listenerId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.listeners.push({ 
                    id: listenerId,
                    target, 
                    event, 
                    handler, 
                    options: listenerOptions,
                    tag,
                    scope,
                    label
                });
                
                return listenerId;
            },
            
            /**
             * 移除指定监听器（按ID）
             * @param {string} listenerId - 监听器ID
             * @returns {boolean} 是否成功移除
             */
            removeById(listenerId) {
                const index = this.listeners.findIndex(l => l.id === listenerId);
                if (index === -1) return false;
                
                const listener = this.listeners[index];
                listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                this.listeners.splice(index, 1);
                return true;
            },
            
            /**
             * 移除指定目标的所有监听器
             * @param {EventTarget} target - 目标元素
             * @returns {number} 移除的监听器数量
             */
            removeByTarget(target) {
                const toRemove = this.listeners.filter(l => l.target === target);
                toRemove.forEach(listener => {
                    listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                });
                this.listeners = this.listeners.filter(l => l.target !== target);
                return toRemove.length;
            },
            
            /**
             * 移除指定事件类型的所有监听器
             * @param {string} event - 事件类型
             * @returns {number} 移除的监听器数量
             */
            removeByEvent(event) {
                const toRemove = this.listeners.filter(l => l.event === event);
                toRemove.forEach(listener => {
                    listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                });
                this.listeners = this.listeners.filter(l => l.event !== event);
                return toRemove.length;
            },

            removeByTag(tag) {
                const toRemove = this.listeners.filter(l => l.tag === tag);
                toRemove.forEach(listener => {
                    listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                });
                this.listeners = this.listeners.filter(l => l.tag !== tag);
                return toRemove.length;
            },

            removeByScope(scope) {
                const toRemove = this.listeners.filter(l => l.scope === scope);
                toRemove.forEach(listener => {
                    listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                });
                this.listeners = this.listeners.filter(l => l.scope !== scope);
                return toRemove.length;
            },
            
            /**
             * 移除指定目标和事件类型的监听器
             * @param {EventTarget} target - 目标元素
             * @param {string} event - 事件类型
             * @returns {number} 移除的监听器数量
             */
            remove(target, event) {
                const toRemove = this.listeners.filter(l => 
                    l.target === target && l.event === event
                );
                toRemove.forEach(listener => {
                    listener.target.removeEventListener(listener.event, listener.handler, listener.options);
                });
                this.listeners = this.listeners.filter(l => 
                    !(l.target === target && l.event === event)
                );
                return toRemove.length;
            },
            
            /**
             * 移除所有监听器
             * @returns {number} 移除的监听器数量
             */
            removeAll() {
                const count = this.listeners.length;
                this.listeners.forEach(({ target, event, handler, options }) => {
                    target.removeEventListener(event, handler, options);
                });
                this.listeners = [];
                return count;
            },
            
            /**
             * 清空所有监听器（removeAll 的别名）
             */
            clear() {
                return this.removeAll();
            },

            pruneDisconnected() {
                if (!Array.isArray(this.listeners) || this.listeners.length === 0) return 0;

                const disconnected = this.listeners.filter(l => {
                    const t = l && l.target;
                    return t && typeof t === 'object' && ('isConnected' in t) && t.isConnected === false;
                });

                disconnected.forEach(({ target, event, handler, options }) => {
                    try {
                        target.removeEventListener(event, handler, options);
                    } catch (e) {
                        // ignore
                    }
                });

                this.listeners = this.listeners.filter(l => {
                    const t = l && l.target;
                    return !(t && typeof t === 'object' && ('isConnected' in t) && t.isConnected === false);
                });

                return disconnected.length;
            },
            
            /**
             * 获取当前监听器统计信息
             * @returns {Object} 统计信息
             */
            getStats() {
                const stats = {
                    total: this.listeners.length,
                    byEvent: {},
                    byTarget: {},
                    byTag: {},
                    byScope: {}
                };
                
                this.listeners.forEach(l => {
                    // 按事件类型统计
                    stats.byEvent[l.event] = (stats.byEvent[l.event] || 0) + 1;
                    
                    // 按目标类型统计
                    const targetType = l.target === window ? 'window' 
                                     : l.target === document ? 'document'
                                     : l.target.tagName || 'unknown';
                    stats.byTarget[targetType] = (stats.byTarget[targetType] || 0) + 1;

                    const tagKey = l.tag || 'untagged';
                    stats.byTag[tagKey] = (stats.byTag[tagKey] || 0) + 1;

                    const scopeKey = l.scope || 'unscope';
                    stats.byScope[scopeKey] = (stats.byScope[scopeKey] || 0) + 1;
                });
                
                return stats;
            }
        };

        // DOM 加载完成后执行
        let __appDomInitialized = false;
        async function __onAppDomContentLoaded() {
            if (__appDomInitialized) return;
            __appDomInitialized = true;
            // 清理所有缓存
            DOMCache.clear();
            
            // 添加窗口大小变化监听（使用节流优化，通过EventManager管理）
            EventManager.add(window, 'resize', throttledSyncHeights, { tag: 'app', scope: 'lifecycle', label: 'window:resize' });
            
            // 页面可见性变化时重新同步
            EventManager.add(document, 'visibilitychange', () => {
                if (!document.hidden) {
                    debouncedSyncHeights();
                }
            }, { tag: 'app', scope: 'lifecycle', label: 'document:visibilitychange' });
            
            // 页面卸载时清理资源（防止内存泄漏）
            EventManager.add(window, 'beforeunload', () => {
                console.log('页面卸载，清理资源...');
                EventManager.removeAll();
                DOMCache.clear();
                
                // 取消所有正在进行的翻译请求
                if (translationService) {
                    translationService.cancelAll();
                }
            }, { tag: 'app', scope: 'lifecycle', label: 'window:beforeunload' });
            
            // 初始化事件监听器
            initEventListeners();
            
            // 加载保存的设置
            try {
                await loadSettings();
            } catch (e) {
                console.error('加载设置失败:', e);
            }

            try {
                storageManager.loadPreferredBackendFromSettings();
            } catch (e) {
                console.error('初始化存储后端失败:', e);
            }

            try {
                await storageManager.ensureBackendAvailable();
            } catch (e) {
                console.error('检测存储后端可用性失败:', e);
            }
            
            // 初始化术语库（从 localStorage 恢复或使用示例数据）
            initTerminology();
            
            // 初始化引擎和模型联动
            initEngineModelSync();
            
            // 初始化图表
            initCharts();
            initQualityCheckEventListeners();

            const restoredProject = await autoSaveManager.restoreProject();
            if (restoredProject) {
                AppState.project = restoredProject;
                AppState.translations.items = restoredProject.translationItems || [];
                AppState.project.translationItems = AppState.translations.items;
                AppState.fileMetadata = restoredProject.fileMetadata || {};

                hydrateFileMetadataContentKeys(AppState.project?.id);

                if (restoredProject.terminologyList && Array.isArray(restoredProject.terminologyList)) {
                    AppState.terminology.list = restoredProject.terminologyList;
                    AppState.terminology.filtered = [...AppState.terminology.list];
                    updateTerminologyList();
                }

                AppState.translations.selected = -1;
                AppState.translations.currentPage = 1;
                AppState.translations.filtered = [...AppState.translations.items];
                AppState.translations.searchQuery = '';

                const sourceLanguageEl = document.getElementById('sourceLanguage');
                const targetLanguageEl = document.getElementById('targetLanguage');
                if (sourceLanguageEl) sourceLanguageEl.value = restoredProject.sourceLanguage || 'en';
                if (targetLanguageEl) targetLanguageEl.value = restoredProject.targetLanguage || 'zh';

                updateFileTree();
                updateTranslationLists();
                updateCounters();
                showNotification('success', '项目已恢复', `已从本地存储恢复项目 "${restoredProject.name || '未命名'}"`);
            } else {
                loadSampleProject();
            }

            autoSaveManager.start();
            
            // 初始化术语库
            updateTerminologyList();
            
            // 添加点击外部关闭搜索结果面板的事件
            EventManager.add(document, 'click', function(e) {
                const searchInput = DOMCache.get('searchInput');
                const searchResultsPanel = DOMCache.get('searchResultsPanel');
                
                if (searchInput && searchResultsPanel && !searchInput.contains(e.target) && !searchResultsPanel.contains(e.target)) {
                    searchResultsPanel.classList.add('hidden');
                }
            }, { tag: 'search', scope: 'panel:searchResults', label: 'document:clickOutsideClose' });
        }

        EventManager.add(document, 'DOMContentLoaded', __onAppDomContentLoaded, { tag: 'app', scope: 'lifecycle', label: 'document:DOMContentLoaded' });
        if (document.readyState !== 'loading') {
            __onAppDomContentLoaded();
        }

        // ==================== UI 初始化 ====================
        
        /**
         * 初始化翻译引擎和模型选择器的联动逻辑
         * 功能：
         * 1. 同步工具栏和侧边栏的引擎选择
         * 2. 根据引擎类型动态显示/隐藏模型选项
         * 3. 保存用户选择到 localStorage
         */
        let engineModelSyncInitialized = false;
        function initEngineModelSync() {
            if (engineModelSyncInitialized) return;
            engineModelSyncInitialized = true;
            const engineSelect = document.getElementById('translationEngine');
            const sidebarEngineSelect = document.getElementById('sidebarTranslationEngine');
            const modelDiv = document.getElementById('openaiModelDiv');
            const temperatureDiv = document.getElementById('temperatureDiv');
            const temperatureInput = document.getElementById('temperature');
            const temperatureValue = document.getElementById('temperatureValue');
            
            if (!engineSelect || !sidebarEngineSelect) return;
            
            // 更新UI显示的函数
            function updateEngineUI(selectedEngine) {
                const modelSelect = document.getElementById('modelSelect');
                
                // 根据引擎显示/隐藏对应选项
                if (selectedEngine === 'openai' || selectedEngine === 'deepseek') {
                    modelDiv?.classList.remove('hidden');
                    temperatureDiv?.classList.remove('hidden');
                    
                    // 动态填充模型选项
                    if (modelSelect) {
                        modelSelect.replaceChildren();

                        const optionDefs = selectedEngine === 'openai'
                            ? [
                                { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (快速/经济)' },
                                { value: 'gpt-4o', label: 'GPT-4o (推荐)' },
                                { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (高质量)' },
                                { value: 'gpt-4', label: 'GPT-4 (经典)' }
                            ]
                            : [
                                { value: 'deepseek-chat', label: 'DeepSeek Chat (推荐)' },
                                { value: 'deepseek-coder', label: 'DeepSeek Coder (代码专用)' }
                            ];

                        optionDefs.forEach(({ value, label }) => {
                            const opt = document.createElement('option');
                            opt.value = value;
                            opt.textContent = label;
                            modelSelect.appendChild(opt);
                        });
                        
                        // 尝试恢复保存的模型选择
                        const savedSettings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
                        const savedModel = savedSettings.model || savedSettings.translationModel;
                        if (savedModel && Array.from(modelSelect.options).some(opt => opt.value === savedModel)) {
                            modelSelect.value = savedModel;
                        }

                        const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
                        settings.model = modelSelect.value;
                        settings.translationModel = modelSelect.value;
                        localStorage.setItem('translatorSettings', JSON.stringify(settings));
                    }
                } else {
                    modelDiv?.classList.add('hidden');
                    temperatureDiv?.classList.add('hidden');
                }
                
                // 保存选择
                const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
                settings.translationEngine = selectedEngine;
                settings.defaultEngine = selectedEngine;
                localStorage.setItem('translatorSettings', JSON.stringify(settings));
            }
            
            // 同步两个选择器
            function syncEngineSelects(source, target, value) {
                if (target.value !== value) {
                    target.value = value;
                }
                updateEngineUI(value);
            }
            
            // 工具栏选择器变更事件
            EventManager.add(engineSelect, 'change', function() {
                syncEngineSelects(engineSelect, sidebarEngineSelect, this.value);
            }, { tag: 'engine', scope: 'engineModel', label: 'toolbarEngineSelect:change' });
            
            // 侧边栏选择器变更事件
            EventManager.add(sidebarEngineSelect, 'change', function() {
                syncEngineSelects(sidebarEngineSelect, engineSelect, this.value);
            }, { tag: 'engine', scope: 'engineModel', label: 'sidebarEngineSelect:change' });
            
            // 模型选择器变更事件
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                EventManager.add(modelSelect, 'change', function() {
                    const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
                    settings.model = this.value;
                    settings.translationModel = this.value;
                    localStorage.setItem('translatorSettings', JSON.stringify(settings));
                }, { tag: 'engine', scope: 'engineModel', label: 'modelSelect:change' });
            }
            
            // 温度滑块更新
            if (temperatureInput && temperatureValue) {
                EventManager.add(temperatureInput, 'input', function() {
                    temperatureValue.textContent = this.value;
                }, { tag: 'engine', scope: 'engineModel', label: 'temperature:input' });
            }
            
            // 加载保存的设置
            const savedSettings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
            const initialEngine = savedSettings.translationEngine || savedSettings.defaultEngine || 'deepseek';
            engineSelect.value = initialEngine;
            sidebarEngineSelect.value = initialEngine;
            updateEngineUI(initialEngine);
        }

        let eventListenersInitialized = false;
        function initEventListeners() {
            if (eventListenersInitialized) return;
            eventListenersInitialized = true;

            const sourceList = document.getElementById('sourceList');
            const targetList = document.getElementById('targetList');
            const mobileCombinedList = document.getElementById('mobileCombinedList');
            const fileTree = document.getElementById('fileTree');
            const searchResultsList = document.getElementById('searchResultsList');
            const searchResultsPanel = document.getElementById('searchResultsPanel');
            const terminologyListElement = document.getElementById('terminologyList');

            const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
            EventManager.add(document, 'keydown', function(e) {
                const target = e.target;
                const isEditable = !!(target && (
                    target.isContentEditable ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT'
                ));

                if (e.key === 'Escape') {
                    const visibleModals = Array.from(document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50'))
                        .filter(modal => !modal.classList.contains('hidden'));
                    if (visibleModals.length > 0) {
                        closeModal();
                    } else if ((AppState.translations.multiSelected || []).length > 0) {
                        clearMultiSelection();
                    }
                    return;
                }

                const modKey = isMacPlatform ? e.metaKey : e.ctrlKey;
                if (!modKey) return;
                if (e.repeat) return;

                const key = String(e.key || '').toLowerCase();
                if (e.shiftKey && (key === 'backspace' || key === 'delete')) {
                    if (isEditable) return;
                    e.preventDefault();
                    clearSelectedTargets();
                    return;
                }
                if (key === 'n') {
                    e.preventDefault();
                    openModal('newProjectModal');
                    return;
                }
                if (key === 'o') {
                    e.preventDefault();
                    openProject();
                    return;
                }
                if (key === 's') {
                    e.preventDefault();
                    saveProject();
                    return;
                }
                if (e.altKey && key === 't') {
                    e.preventDefault();
                    openModal('terminologyModal');
                    return;
                }
                if (e.altKey && key === 'q') {
                    e.preventDefault();
                    openModal('qualityReportModal');
                    return;
                }
                if (key === 'f') {
                    e.preventDefault();
                    const desktopSearchInput = document.getElementById('translationSearchInput');
                    const mobileSearchInput = document.getElementById('translationSearchInputMobile');
                    const searchInput = window.innerWidth < 768
                        ? (mobileSearchInput || desktopSearchInput)
                        : (desktopSearchInput || mobileSearchInput);
                    if (searchInput) {
                        if (isEditable && target === searchInput) return;
                        searchInput.focus();
                        if (typeof searchInput.select === 'function') {
                            searchInput.select();
                        }
                    }
                }
            }, { tag: 'app', scope: 'keyboard', label: 'document:keydownHotkeys' });
            
            if (sourceList) {
                // 点击事件委托
                EventManager.add(sourceList, 'click', function(e) {
                    const item = e.target.closest('.responsive-translation-item');
                    if (item && item.dataset.index) {
                        const index = parseInt(item.dataset.index);
                        const multiKey = e.ctrlKey || e.metaKey;
                        if (multiKey) {
                            toggleMultiSelection(index);
                        } else {
                            selectTranslationItem(index);
                        }
                    }
                }, { tag: 'translations', scope: 'list:source', label: 'sourceList:clickDelegate' });
            }
            
            if (targetList) {
                // 点击事件委托
                EventManager.add(targetList, 'click', function(e) {
                    if (e.target && e.target.tagName === 'TEXTAREA') return;
                    const item = e.target.closest('.responsive-translation-item');
                    if (item && item.dataset.index) {
                        const index = parseInt(item.dataset.index);
                        const multiKey = e.ctrlKey || e.metaKey;
                        if (multiKey) {
                            toggleMultiSelection(index);
                        } else {
                            selectTranslationItem(index);
                        }
                    }
                }, { tag: 'translations', scope: 'list:target', label: 'targetList:clickDelegate' });
                
                // textarea input 事件委托
                EventManager.add(targetList, 'input', function(e) {
                    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.index) {
                        updateTranslationItem(parseInt(e.target.dataset.index), e.target.value);
                    }
                }, { tag: 'translations', scope: 'list:target', label: 'targetList:inputDelegate' });
                
                // textarea focus 事件委托
                EventManager.add(targetList, 'focus', function(e) {
                    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.index) {
                        selectTranslationItem(parseInt(e.target.dataset.index), { shouldScroll: false, shouldFocusTextarea: false });
                    }
                }, { tag: 'translations', scope: 'list:target', label: 'targetList:focusDelegate', listenerOptions: true });
            }

            if (mobileCombinedList) {
                // 点击事件委托
                EventManager.add(mobileCombinedList, 'click', function(e) {
                    const rawTarget = e.target;
                    const targetEl = (rawTarget instanceof Element) ? rawTarget : rawTarget?.parentElement;

                    const actionEl = targetEl ? targetEl.closest('[data-action]') : null;
                    if (actionEl && actionEl.dataset.action === 'toggle-extra') {
                        const item = actionEl.closest('.responsive-translation-item');
                        if (!item) return;
                        const extra = item.querySelector('[data-role="extra"]');
                        if (!extra) return;

                        const nextState = actionEl.dataset.state === 'expanded' ? 'collapsed' : 'expanded';
                        actionEl.dataset.state = nextState;
                        actionEl.textContent = nextState === 'expanded' ? '收起' : '更多';
                        extra.classList.toggle('hidden', nextState !== 'expanded');
                        return;
                    }

                    if (targetEl && targetEl.tagName === 'TEXTAREA') {
                        return;
                    }
                    const item = targetEl ? targetEl.closest('.responsive-translation-item') : null;
                    if (item && item.dataset.index) {
                        const index = parseInt(item.dataset.index);
                        const multiKey = e.ctrlKey || e.metaKey;
                        if (multiKey) {
                            toggleMultiSelection(index);
                        } else {
                            selectTranslationItem(index, { shouldFocusTextarea: false });
                        }
                    }
                }, { tag: 'translations', scope: 'list:mobileCombined', label: 'mobileCombinedList:clickDelegate' });

                // textarea input 事件委托
                EventManager.add(mobileCombinedList, 'input', function(e) {
                    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.index) {
                        updateTranslationItem(parseInt(e.target.dataset.index), e.target.value);
                    }
                }, { tag: 'translations', scope: 'list:mobileCombined', label: 'mobileCombinedList:inputDelegate' });

                // textarea focus 事件委托
                EventManager.add(mobileCombinedList, 'focus', function(e) {
                    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.index) {
                        selectTranslationItem(parseInt(e.target.dataset.index), { shouldScroll: false, shouldFocusTextarea: false });
                    }
                }, { tag: 'translations', scope: 'list:mobileCombined', label: 'mobileCombinedList:focusDelegate', listenerOptions: true });
            }

            if (fileTree) {
                EventManager.add(fileTree, 'click', function(e) {
                    const row = e.target.closest('li > div');
                    if (!row || !fileTree.contains(row)) return;

                    fileTree.querySelectorAll('li > div').forEach(el => {
                        el.classList.remove('bg-gray-100', 'dark:bg-gray-800');
                    });
                    row.classList.add('bg-gray-100', 'dark:bg-gray-800');

                    const filename = row.dataset.filename || row.querySelector('span')?.textContent;
                    if (filename) {
                        filterTranslationItemsByFile(filename);
                    }
                }, { tag: 'fileTree', scope: 'panel:fileTree', label: 'fileTree:clickDelegate' });
            }

            if (searchResultsList && searchResultsPanel) {
                EventManager.add(searchResultsList, 'click', function(e) {
                    const item = e.target.closest('.file-search-result-item');
                    if (!item || !searchResultsList.contains(item)) return;
                    const filename = item.dataset.filename;
                    console.log('点击文件:', filename);
                    searchResultsPanel.classList.add('hidden');
                }, { tag: 'search', scope: 'panel:searchResults', label: 'searchResultsList:clickDelegate' });
            }

            if (terminologyListElement) {
                EventManager.add(terminologyListElement, 'click', function(e) {
                    const editBtn = e.target.closest('.edit-term-btn');
                    if (editBtn && terminologyListElement.contains(editBtn)) {
                        const termId = parseInt(editBtn.dataset.id);
                        editTerm(termId);
                        return;
                    }

                    const deleteBtn = e.target.closest('.delete-term-btn');
                    if (deleteBtn && terminologyListElement.contains(deleteBtn)) {
                        const termId = parseInt(deleteBtn.dataset.id);
                        deleteTerm(termId);
                    }
                }, { tag: 'terminology', scope: 'terminology:list', label: 'terminologyList:clickDelegate' });
            }
            
            // 术语库标签页切换
            const terminologyListTab = document.getElementById('terminologyListTab');
            if (terminologyListTab) EventManager.add(terminologyListTab, 'click', () => switchTerminologyTab('list'), { tag: 'terminology', scope: 'terminology:tabs', label: 'terminologyListTab:click' });
            const terminologyImportExportTab = document.getElementById('terminologyImportExportTab');
            if (terminologyImportExportTab) EventManager.add(terminologyImportExportTab, 'click', () => switchTerminologyTab('import-export'), { tag: 'terminology', scope: 'terminology:tabs', label: 'terminologyImportExportTab:click' });
            
            // 术语库导入相关事件
            const importDropArea = document.getElementById('importDropArea');
            const importTerminologyBtn = document.getElementById('importTerminologyBtn');
            
            if (importDropArea) {
                EventManager.add(importDropArea, 'dragover', handleImportDragOver, { tag: 'terminology', scope: 'terminology:import', label: 'importDropArea:dragover' });
                EventManager.add(importDropArea, 'dragleave', handleImportDragLeave, { tag: 'terminology', scope: 'terminology:import', label: 'importDropArea:dragleave' });
                EventManager.add(importDropArea, 'drop', handleImportDrop, { tag: 'terminology', scope: 'terminology:import', label: 'importDropArea:drop' });
                EventManager.add(importDropArea, 'click', () => document.getElementById('importFileInput')?.click(), { tag: 'terminology', scope: 'terminology:import', label: 'importDropArea:clickChooseFile' });
            }

            EventManager.add(document, 'change', function(e) {
                const target = e.target;
                if (target && target.id === 'importFileInput') {
                    handleImportFileSelect({ target });
                }
            }, { tag: 'terminology', scope: 'terminology:import', label: 'document:changeImportFileInput' });
            
            if (importTerminologyBtn) {
                // 确保按钮在页面加载时是禁用的
                importTerminologyBtn.disabled = true;
                EventManager.add(importTerminologyBtn, 'click', importTerminology, { tag: 'terminology', scope: 'terminology:import', label: 'importTerminologyBtn:click' });
            }
            
            // 术语库导出事件
            const exportTerminologyBtn = document.getElementById('exportTerminologyBtn');
            if (exportTerminologyBtn) EventManager.add(exportTerminologyBtn, 'click', exportTerminology, { tag: 'terminology', scope: 'terminology:export', label: 'exportTerminologyBtn:click' });
            
            // 术语库搜索和筛选
            const terminologySearch = document.getElementById('terminologySearch');
            if (terminologySearch) {
                const debouncedTerminologySearch = debounce(filterTerminology, 300);
                EventManager.add(terminologySearch, 'input', debouncedTerminologySearch, { tag: 'terminology', scope: 'terminology:filter', label: 'terminologySearch:input' });
            }
            const terminologyFilter = document.getElementById('terminologyFilter');
            if (terminologyFilter) EventManager.add(terminologyFilter, 'change', filterTerminology, { tag: 'terminology', scope: 'terminology:filter', label: 'terminologyFilter:change' });
            
            // 术语库分页
            const terminologyPrevBtn = document.getElementById('terminologyPrevBtn');
            if (terminologyPrevBtn) EventManager.add(terminologyPrevBtn, 'click', () => handleTerminologyPagination('prev'), { tag: 'terminology', scope: 'terminology:pagination', label: 'terminologyPrevBtn:click' });
            const terminologyNextBtn = document.getElementById('terminologyNextBtn');
            if (terminologyNextBtn) EventManager.add(terminologyNextBtn, 'click', () => handleTerminologyPagination('next'), { tag: 'terminology', scope: 'terminology:pagination', label: 'terminologyNextBtn:click' });
            
            // 添加术语按钮（已存在的）
            const addTermBtn = document.getElementById('addTermBtn');
            if (addTermBtn) {
                EventManager.add(addTermBtn, 'click', () => {
                    document.getElementById('addTermModal').classList.remove('hidden');
                }, { tag: 'terminology', scope: 'terminology:edit', label: 'addTermBtn:click' });
            }
            
            // 保存术语按钮（已存在的）
            const saveTermBtn = document.getElementById('saveTermBtn');
            if (saveTermBtn) EventManager.add(saveTermBtn, 'click', saveTerm, { tag: 'terminology', scope: 'terminology:edit', label: 'saveTermBtn:click' });
            
            // 检查关键元素是否存在
            const elementsToCheck = [
                'fileDropArea', 'fileInput', 'browseFilesBtn',
                'searchInput', 'sourcePrevBtn', 'sourceNextBtn',
                'translateSelectedBtn', 
                'translateAllBtn', 'clearSelectedTargetBtn', 'cancelTranslationBtn', 'exportBtn',
                'confirmExportBtn', 'newProjectBtn', 'createProjectBtn',
                'openProjectBtn', 'saveProjectBtn', 'addTermBtn',
                'saveTermBtn', 'userMenuBtn', 'closeNotification'
            ];
            
            elementsToCheck.forEach(id => {
                const element = document.getElementById(id);
                console.log(`${id}:`, element ? '存在' : '不存在');
            });
            
            // 文件上传相关
            const fileDropArea = document.getElementById('fileDropArea');
            const fileInput = document.getElementById('fileInput');
            const browseFilesBtn = document.getElementById('browseFilesBtn');
            
            if (fileDropArea && fileInput) {
                EventManager.add(fileDropArea, 'dragover', handleDragOver, { tag: 'project', scope: 'fileImport', label: 'fileDropArea:dragover' });
                EventManager.add(fileDropArea, 'dragleave', handleDragLeave, { tag: 'project', scope: 'fileImport', label: 'fileDropArea:dragleave' });
                EventManager.add(fileDropArea, 'drop', handleDrop, { tag: 'project', scope: 'fileImport', label: 'fileDropArea:drop' });
                EventManager.add(fileDropArea, 'click', () => fileInput.click(), { tag: 'project', scope: 'fileImport', label: 'fileDropArea:click' });
            }
            if (browseFilesBtn && fileInput) EventManager.add(browseFilesBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            }, { tag: 'project', scope: 'fileImport', label: 'browseFilesBtn:click' });
            if (fileInput) EventManager.add(fileInput, 'change', handleFileSelect, { tag: 'project', scope: 'fileImport', label: 'fileInput:change' });
            
            // 搜索功能
            const searchInput = document.getElementById('searchInput');
            console.log('初始化搜索功能，searchInput元素:', searchInput);
            
            if (searchInput) {
                // 添加输入事件监听
                const debouncedSearchInput = debounce(handleSearchInput, 300);
                EventManager.add(searchInput, 'input', debouncedSearchInput, { tag: 'search', scope: 'panel:fileSearch', label: 'searchInput:input' });
                console.log('已添加input事件监听器');
                
                // 添加回车键事件监听
                EventManager.add(searchInput, 'keypress', function(e) {
                    console.log('检测到按键:', e.key, 'keyCode:', e.keyCode);
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault();
                        console.log('执行搜索回车处理');
                        handleSearchEnter();
                    }
                }, { tag: 'search', scope: 'panel:fileSearch', label: 'searchInput:keypress' });
                console.log('已添加keypress事件监听器');
            } else {
                console.error('未找到searchInput元素');
            }
            
            // 分页功能
            const sourcePrevBtn = document.getElementById('sourcePrevBtn');
            const sourceNextBtn = document.getElementById('sourceNextBtn');
            
            if (sourcePrevBtn) EventManager.add(sourcePrevBtn, 'click', () => handlePagination('prev'), { tag: 'translations', scope: 'pagination', label: 'sourcePrevBtn:click' });
            if (sourceNextBtn) EventManager.add(sourceNextBtn, 'click', () => handlePagination('next'), { tag: 'translations', scope: 'pagination', label: 'sourceNextBtn:click' });
            
            // 翻译相关按钮
            const translateSelectedBtn = document.getElementById('translateSelectedBtn');
            const translateAllBtn = document.getElementById('translateAllBtn');
            const clearSelectedTargetBtn = document.getElementById('clearSelectedTargetBtn');
            const cancelTranslationBtn = document.getElementById('cancelTranslationBtn');
            
            if (translateSelectedBtn) EventManager.add(translateSelectedBtn, 'click', translateSelected, { tag: 'translations', scope: 'actions', label: 'translateSelectedBtn:click' });
            if (translateAllBtn) EventManager.add(translateAllBtn, 'click', translateAll, { tag: 'translations', scope: 'actions', label: 'translateAllBtn:click' });
            if (clearSelectedTargetBtn) EventManager.add(clearSelectedTargetBtn, 'click', clearSelectedTargets, { tag: 'translations', scope: 'actions', label: 'clearSelectedTargetBtn:click' });
            if (cancelTranslationBtn) EventManager.add(cancelTranslationBtn, 'click', cancelTranslation, { tag: 'translations', scope: 'actions', label: 'cancelTranslationBtn:click' });
            
            // 导出相关
            const exportBtn = document.getElementById('exportBtn');
            const confirmExportBtn = document.getElementById('confirmExportBtn');
            
            if (exportBtn) {
                EventManager.add(exportBtn, 'click', () => {
                    const exportModal = document.getElementById('exportModal');
                    if (exportModal) exportModal.classList.remove('hidden');
                }, { tag: 'export', scope: 'exportModal', label: 'exportBtn:clickOpenModal' });
            }
            if (confirmExportBtn) EventManager.add(confirmExportBtn, 'click', exportTranslation, { tag: 'export', scope: 'exportModal', label: 'confirmExportBtn:click' });
            
            // 项目相关
            const newProjectBtn = document.getElementById('newProjectBtn');
            const createProjectBtn = document.getElementById('createProjectBtn');
            const openProjectBtn = document.getElementById('openProjectBtn');
            const saveProjectBtn = document.getElementById('saveProjectBtn');
            
            if (newProjectBtn) {
                EventManager.add(newProjectBtn, 'click', () => {
                    const newProjectModal = document.getElementById('newProjectModal');
                    if (newProjectModal) newProjectModal.classList.remove('hidden');
                }, { tag: 'project', scope: 'project', label: 'newProjectBtn:clickOpenModal' });
            }
            if (createProjectBtn) EventManager.add(createProjectBtn, 'click', createNewProject, { tag: 'project', scope: 'project', label: 'createProjectBtn:click' });
            if (openProjectBtn) EventManager.add(openProjectBtn, 'click', openProject, { tag: 'project', scope: 'project', label: 'openProjectBtn:click' });
            if (saveProjectBtn) EventManager.add(saveProjectBtn, 'click', saveProject, { tag: 'project', scope: 'project', label: 'saveProjectBtn:click' });
            
            // 术语库相关
            
            // 用户菜单
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (userMenuBtn) EventManager.add(userMenuBtn, 'click', toggleUserMenu, { tag: 'user', scope: 'userMenu', label: 'userMenuBtn:click' });
            
            // 用户菜单项点击事件
            const openSettingsMenu = document.getElementById('openSettingsMenu');
            const openHelpMenu = document.getElementById('openHelpMenu');
            const openAboutMenu = document.getElementById('openAboutMenu');
            
            if (openSettingsMenu) {
                EventManager.add(openSettingsMenu, 'click', (e) => {
                    e.preventDefault();
                    document.getElementById('userMenu')?.classList.add('hidden');
                    openModal('settingsModal');
                }, { tag: 'settings', scope: 'userMenu', label: 'openSettingsMenu:click' });
            }
            
            if (openHelpMenu) {
                EventManager.add(openHelpMenu, 'click', (e) => {
                    e.preventDefault();
                    document.getElementById('userMenu')?.classList.add('hidden');
                    openModal('helpModal');
                }, { tag: 'help', scope: 'userMenu', label: 'openHelpMenu:click' });
            }
            
            if (openAboutMenu) {
                EventManager.add(openAboutMenu, 'click', (e) => {
                    e.preventDefault();
                    document.getElementById('userMenu')?.classList.add('hidden');
                    openModal('aboutModal');
                }, { tag: 'about', scope: 'userMenu', label: 'openAboutMenu:click' });
            }
            
            // 设置标签页切换
            document.querySelectorAll('.settings-tab-btn').forEach(btn => {
                EventManager.add(btn, 'click', function() {
                    const targetTab = this.dataset.tab;
                    
                    // 移除所有按钮的激活状态
                    document.querySelectorAll('.settings-tab-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    
                    // 激活当前按钮
                    this.classList.add('active');
                    
                    // 隐藏所有内容
                    document.querySelectorAll('.settings-tab-content').forEach(content => {
                        content.classList.add('hidden');
                    });
                    
                    // 显示对应内容
                    const targetContent = document.querySelector(`.settings-tab-content[data-tab="${targetTab}"]`);
                    if (targetContent) {
                        targetContent.classList.remove('hidden');
                    }
                }, { tag: 'settings', scope: 'settingsModal', label: 'settingsTabBtn:click' });
            });
            
            // 保存设置按钮
            const saveSettingsBtn = document.getElementById('saveSettings');
            if (saveSettingsBtn) {
                EventManager.add(saveSettingsBtn, 'click', async () => {
                    const rawAutosaveSeconds = parseInt(document.getElementById('autosaveIntervalSeconds')?.value);
                    const autosaveIntervalSeconds = Number.isFinite(rawAutosaveSeconds)
                        ? Math.max(5, Math.min(600, rawAutosaveSeconds))
                        : 30;

                    const autosaveInput = document.getElementById('autosaveIntervalSeconds');
                    if (autosaveInput) autosaveInput.value = autosaveIntervalSeconds;

                    // 保存设置到 localStorage
                    const settings = {
                        // 外观设置
                        themeMode: document.getElementById('themeMode')?.value || 'light',
                        fontSize: document.getElementById('fontSize')?.value || 'medium',
                        itemsPerPage: parseInt(document.getElementById('itemsPerPage')?.value) || 20,
                        sourceSelectionIndicatorEnabled: document.getElementById('sourceSelectionIndicatorEnabled')?.checked ?? true,
                        sourceSelectionIndicatorUnselectedStyle: document.getElementById('sourceSelectionIndicatorUnselectedStyle')?.value || 'gray',
                        autosaveIntervalSeconds,
                        
                        // 翻译引擎设置
                        defaultEngine: document.getElementById('defaultEngine')?.value || 'deepseek',
                        translationEngine: document.getElementById('defaultEngine')?.value || 'deepseek',
                        translationModel: document.getElementById('translationModel')?.value || 'deepseek-chat',
                        model: document.getElementById('translationModel')?.value || 'deepseek-chat',
                        apiTimeout: parseInt(document.getElementById('apiTimeout')?.value) || 30,
                        concurrentLimit: parseInt(document.getElementById('concurrentLimit')?.value) || 5,
                        retryCount: parseInt(document.getElementById('retryCount')?.value) || 2,
                        
                        // 质量检查设置
                        checkTerminology: document.getElementById('checkTerminology')?.checked || true,
                        checkPlaceholders: document.getElementById('checkPlaceholders')?.checked || true,
                        checkPunctuation: document.getElementById('checkPunctuation')?.checked || true,
                        checkLength: document.getElementById('checkLength')?.checked || false,
                        checkNumbers: document.getElementById('checkNumbers')?.checked || true,
                        qualityThreshold: parseInt(document.getElementById('qualityThreshold')?.value) || 70,
                        
                        // 术语库设置
                        autoApplyTerms: document.getElementById('autoApplyTerms')?.checked || true,
                        termMatchMode: document.getElementById('termMatchMode')?.value || 'exact',
                        highlightTerms: document.getElementById('highlightTerms')?.checked || true,
                        duplicateHandling: document.getElementById('duplicateHandling')?.value || 'overwrite',
                        
                        // 文件处理设置
                        maxFileSize: parseInt(document.getElementById('maxFileSize')?.value) || 10,
                        formatXML: document.getElementById('formatXML')?.checked || true,
                        formatXLIFF: document.getElementById('formatXLIFF')?.checked || true,
                        formatJSON: document.getElementById('formatJSON')?.checked || true,
                        formatPO: document.getElementById('formatPO')?.checked || true,
                        formatRESX: document.getElementById('formatRESX')?.checked || true,
                        autoDetectEncoding: document.getElementById('autoDetectEncoding')?.checked || true,
                        autoTranslateOnImport: document.getElementById('autoTranslateOnImport')?.checked || false,
                        
                        // 加密保存 API 密钥
                        deepseekApiKey: '',
                        openaiApiKey: '',
                        googleApiKey: ''
                    };
                    
                    // 加密API密钥
                    const deepseekKey = document.getElementById('deepseekApiKey')?.value;
                    const openaiKey = document.getElementById('openaiApiKey')?.value;
                    const googleKey = document.getElementById('googleApiKey')?.value;
                    
                    if (deepseekKey) {
                        settings.deepseekApiKey = await securityUtils.encrypt(deepseekKey);
                    }
                    if (openaiKey) {
                        settings.openaiApiKey = await securityUtils.encrypt(openaiKey);
                    }
                    if (googleKey) {
                        settings.googleApiKey = await securityUtils.encrypt(googleKey);
                    }
                    
                    localStorage.setItem('translatorSettings', JSON.stringify(settings));
                    
                    // 应用设置
                    applySettings(settings);
                    
                    showNotification('success', '设置已保存', '您的设置已成功保存（API密钥已加密）');
                    closeModal('settingsModal');
                }, { tag: 'settings', scope: 'settingsModal', label: 'saveSettingsBtn:click' });
            }
            
            // 数据管理功能
            const clearCacheBtn = document.getElementById('clearCacheBtn');
            const exportAllBtn = document.getElementById('exportAllBtn');
            const exportSettingsBtn = document.getElementById('exportSettingsBtn');
            const exportTermsBtn = document.getElementById('exportTermsBtn');
            const exportProjectBtn = document.getElementById('exportProjectBtn');
            const importSettingsBtn = document.getElementById('importSettingsBtn');
            const importSettingsFile = document.getElementById('importSettingsFile');
            const clearProjectOnlyBtn = document.getElementById('clearProjectOnlyBtn');
            const clearAllCacheBtn = document.getElementById('clearAllCacheBtn');
            const cancelClearCacheBtn = document.getElementById('cancelClearCacheBtn');
                        
            // 清除缓存
            if (clearCacheBtn) {
                EventManager.add(clearCacheBtn, 'click', () => {
                    openModal('clearCacheModal');
                }, { tag: 'data', scope: 'dataManagement', label: 'clearCacheBtn:clickOpenModal' });
            }

            if (cancelClearCacheBtn) {
                EventManager.add(cancelClearCacheBtn, 'click', () => {
                    closeModal('clearCacheModal');
                }, { tag: 'data', scope: 'dataManagement', label: 'cancelClearCacheBtn:click' });
            }

            if (clearProjectOnlyBtn) {
                EventManager.add(clearProjectOnlyBtn, 'click', async () => {
                    closeModal('clearCacheModal');

                    try {
                        await storageManager.clearCurrentProject();
                    } catch (e) {
                        console.error('清理 currentProject 失败:', e);
                    }

                    Promise.resolve(idbClearAllFileContents())
                        .catch((e) => console.error('清空IndexedDB失败:', e))
                        .finally(() => {
                            showNotification('success', '清除成功', '当前项目数据已清除（设置/术语库已保留）');
                            setTimeout(() => {
                                location.reload();
                            }, 1000);
                        });
                }, { tag: 'data', scope: 'dataManagement', label: 'clearProjectOnlyBtn:click' });
            }

            if (clearAllCacheBtn) {
                EventManager.add(clearAllCacheBtn, 'click', async () => {
                    closeModal('clearCacheModal');

                    try {
                        await storageManager.clearCurrentProject();
                    } catch (e) {
                        console.error('清理 currentProject 失败:', e);
                    }

                    try {
                        localStorage.clear();
                    } catch (e) {
                        console.error('清理 localStorage 失败:', e);
                    }

                    Promise.resolve(idbClearAllFileContents())
                        .catch((e) => console.error('清空IndexedDB失败:', e))
                        .finally(() => {
                            showNotification('success', '清除成功', '所有缓存数据已清除');
                            setTimeout(() => {
                                location.reload();
                            }, 1000);
                        });
                }, { tag: 'data', scope: 'dataManagement', label: 'clearAllCacheBtn:click' });
            }
                        
            // 导出所有数据
            if (exportAllBtn) {
                EventManager.add(exportAllBtn, 'click', async () => {
                    const currentProject = await storageManager.loadCurrentProject().catch(() => null);
                    const allData = {
                        version: '1.0.0',
                        exportDate: new Date().toISOString(),
                        settings: safeJsonParse(localStorage.getItem('translatorSettings'), {}),
                        terminology: safeJsonParse(localStorage.getItem('terminology'), []),
                        projects: safeJsonParse(localStorage.getItem('translationProjects'), []),
                        currentProject
                    };
                                
                    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `translator-all-data-${new Date().getTime()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotification('success', '导出成功', '所有数据已导出为JSON文件');
                }, { tag: 'data', scope: 'dataManagement', label: 'exportAllBtn:click' });
            }
                        
            // 导出当前项目
            if (exportProjectBtn) {
                EventManager.add(exportProjectBtn, 'click', async () => {
                    const project = await storageManager.loadCurrentProject().catch(() => null);
                    if (project) {
                        const data = {
                            version: '1.0.0',
                            exportDate: new Date().toISOString(),
                            project
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `project-${project.name || 'untitled'}-${new Date().getTime()}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showNotification('success', '导出成功', '项目数据已导出');
                    } else {
                        showNotification('warning', '无数据', '当前没有打开的项目');
                    }
                }, { tag: 'data', scope: 'dataManagement', label: 'exportProjectBtn:click' });
            }
                        
            // 导入设置
            if (importSettingsBtn && importSettingsFile) {
                EventManager.add(importSettingsBtn, 'click', () => {
                    importSettingsFile.click();
                }, { tag: 'data', scope: 'dataManagement', label: 'importSettingsBtn:click' });
                            
                EventManager.add(importSettingsFile, 'change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const data = JSON.parse(event.target.result);
                                            
                                // 获取导入选项
                                const includeSettings = document.getElementById('importIncludeSettings')?.checked;
                                const includeTerms = document.getElementById('importIncludeTerms')?.checked;
                                const includeProjects = document.getElementById('importIncludeProjects')?.checked;
                                            
                                let importCount = 0;
                                            
                                // 导入设置
                                if (includeSettings && data.settings) {
                                    localStorage.setItem('translatorSettings', JSON.stringify(data.settings));
                                    loadSettings();
                                    applySettings(data.settings);
                                    importCount++;
                                }
                                            
                                // 导入术语库（合并模式）
                                if (includeTerms && data.terminology) {
                                    const existingTerms = safeJsonParse(localStorage.getItem('terminology'), []);
                                    const mergedTerms = [...existingTerms];
                                                
                                    // 合并术语，根据设置的duplicateHandling处理重复
                                    data.terminology.forEach(newTerm => {
                                        const existingIndex = mergedTerms.findIndex(t => 
                                            t.source.toLowerCase() === newTerm.source.toLowerCase()
                                        );
                                                    
                                        if (existingIndex === -1) {
                                            mergedTerms.push(newTerm);
                                        } else {
                                            // 覆盖模式：更新现有术语
                                            mergedTerms[existingIndex] = newTerm;
                                        }
                                    });
                                                
                                    localStorage.setItem('terminology', JSON.stringify(mergedTerms));
                                    importCount++;
                                }
                                            
                                // 导入项目数据
                                if (includeProjects) {
                                    if (data.currentProject) {
                                        // 导入单个项目
                                        Promise.resolve(storageManager.saveCurrentProject(data.currentProject)).catch((e) => {
                                            console.error('导入 currentProject 失败:', e);
                                        });
                                        importCount++;
                                    } else if (data.project) {
                                        // 导入单个项目（单项目导出格式）
                                        Promise.resolve(storageManager.saveCurrentProject(data.project)).catch((e) => {
                                            console.error('导入 currentProject 失败:', e);
                                        });
                                        importCount++;
                                    } else if (data.projects) {
                                        // 导入项目列表
                                        localStorage.setItem('translationProjects', JSON.stringify(data.projects));
                                        if (data.projects.length > 0) {
                                            Promise.resolve(storageManager.saveCurrentProject(data.projects[0])).catch((e) => {
                                                console.error('导入 currentProject 失败:', e);
                                            });
                                        }
                                        importCount++;
                                    }
                                }
                                            
                                if (importCount > 0) {
                                    showNotification('success', '导入成功', `已导入 ${importCount} 个数据类型`);
                                    if (includeProjects) {
                                        setTimeout(() => {
                                            location.reload();
                                        }, 1500);
                                    }
                                } else {
                                    showNotification('warning', '未导入', '请至少选择一个导入选项');
                                }
                            } catch (error) {
                                console.error('Import error:', error);
                                showNotification('error', '导入失败', '无效的JSON文件格式');
                            }
                        };
                        reader.readAsText(file);
                    }
                    // 清空文件输入，允许重复导入同一文件
                    e.target.value = '';
                }, { tag: 'data', scope: 'dataManagement', label: 'importSettingsFile:change' });
            }
            
            // 关闭模态框
            document.querySelectorAll('.close-modal').forEach(btn => {
                EventManager.add(btn, 'click', closeModal, { tag: 'ui', scope: 'modal', label: 'closeModalBtn:click' });
            });
            
            // 关闭通知
            const closeNotificationBtn = document.getElementById('closeNotification');
            if (closeNotificationBtn) EventManager.add(closeNotificationBtn, 'click', closeNotification, { tag: 'ui', scope: 'notification', label: 'closeNotificationBtn:click' });
            
            // 标签页切换
            const tabs = document.querySelectorAll('aside button');
            tabs.forEach(tab => {
                EventManager.add(tab, 'click', () => {
                    // 移除所有标签页的活动状态
                    tabs.forEach(t => {
                        t.classList.remove('border-b-2', 'border-primary', 'text-primary');
                        t.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
                    });
                    
                    // 添加当前标签页的活动状态
                    tab.classList.add('border-b-2', 'border-primary', 'text-primary');
                    tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
                    
                    // 根据标签页切换内容
                    if (tab.textContent.trim() === '术语库') {
                        document.getElementById('terminologyModal').classList.remove('hidden');
                    } else if (tab.textContent.trim() === '质量检查') {
                        document.getElementById('qualityReportModal').classList.remove('hidden');
                    }
                }, { tag: 'ui', scope: 'tabs', label: 'asideTab:click' });
            });
            
            // 移动端侧边栏切换
            const toggleLeftSidebar = document.getElementById('toggleLeftSidebar');
            const toggleRightSidebar = document.getElementById('toggleRightSidebar');
            const leftSidebar = document.getElementById('leftSidebar');
            const rightSidebar = document.getElementById('rightSidebar');
            
            if (toggleLeftSidebar && leftSidebar) {
                EventManager.add(toggleLeftSidebar, 'click', () => {
                    leftSidebar.classList.toggle('show-sidebar');
                    // 关闭右侧边栏
                    if (rightSidebar && rightSidebar.classList.contains('show-sidebar')) {
                        rightSidebar.classList.remove('show-sidebar');
                    }
                }, { tag: 'ui', scope: 'sidebar', label: 'toggleLeftSidebar:click' });
            }
            
            if (toggleRightSidebar && rightSidebar) {
                EventManager.add(toggleRightSidebar, 'click', () => {
                    rightSidebar.classList.toggle('show-sidebar');
                    // 关闭左侧边栏
                    if (leftSidebar && leftSidebar.classList.contains('show-sidebar')) {
                        leftSidebar.classList.remove('show-sidebar');
                    }
                }, { tag: 'ui', scope: 'sidebar', label: 'toggleRightSidebar:click' });
            }
            
            // ==================== 搜索翻译项功能（优化版） ====================
            const translationSearchInput = DOMCache.get('translationSearchInput');
            const translationSearchInputMobile = DOMCache.get('translationSearchInputMobile');
            const clearTranslationSearch = DOMCache.get('clearTranslationSearch');
            const clearTranslationSearchMobile = DOMCache.get('clearTranslationSearchMobile');
            const translationSearchStats = DOMCache.get('translationSearchStats');
            const translationSearchCount = DOMCache.get('translationSearchCount');
            
            // 搜索翻译项函数（使用统一过滤函数）
            function searchTranslationItems(keyword) {
                const trimmedKeyword = keyword?.trim() || '';
                // 统一将搜索词存入 AppState，供列表渲染/高亮等逻辑复用
                AppState.translations.searchQuery = trimmedKeyword;
                
                if (!trimmedKeyword) {
                    // 清除搜索，显示所有项
                    AppState.translations.filtered = [...AppState.translations.items];
                    translationSearchStats?.classList.add('hidden');
                    clearTranslationSearch?.classList.add('hidden');
                    clearTranslationSearchMobile?.classList.add('hidden');
                } else {
                    // 执行搜索（使用统一的 applySearchFilter 函数）
                    applySearchFilter();
                    
                    // 显示搜索统计
                    if (translationSearchStats) {
                        translationSearchStats.classList.remove('hidden');
                        if (translationSearchCount) {
                            translationSearchCount.textContent = AppState.translations.filtered.length;
                        }
                    }
                    clearTranslationSearch?.classList.remove('hidden');
                    clearTranslationSearchMobile?.classList.remove('hidden');
                }
                
                // 重置到第一页并更新显示
                AppState.translations.currentPage = 1;
                updateTranslationLists();
                updateCounters();
            }
            
            // 使用防抖的搜索函数
            const debouncedSearch = debounce(searchTranslationItems, 300);
            
            // 桌面端搜索输入
            if (translationSearchInput) {
                EventManager.add(translationSearchInput, 'input', (e) => {
                    const keyword = e.target.value;
                    debouncedSearch(keyword);
                    // 同步到移动端
                    if (translationSearchInputMobile) {
                        translationSearchInputMobile.value = keyword;
                    }
                }, { tag: 'translations', scope: 'translationSearch', label: 'translationSearchInput:input' });
            }
            
            // 移动端搜索输入
            if (translationSearchInputMobile) {
                EventManager.add(translationSearchInputMobile, 'input', (e) => {
                    const keyword = e.target.value;
                    debouncedSearch(keyword);
                    // 同步到桌面端
                    if (translationSearchInput) {
                        translationSearchInput.value = keyword;
                    }
                }, { tag: 'translations', scope: 'translationSearch', label: 'translationSearchInputMobile:input' });
            }
            
            // 清除搜索按钮（桌面端）
            if (clearTranslationSearch) {
                EventManager.add(clearTranslationSearch, 'click', () => {
                    if (translationSearchInput) translationSearchInput.value = '';
                    if (translationSearchInputMobile) translationSearchInputMobile.value = '';
                    searchTranslationItems('');
                }, { tag: 'translations', scope: 'translationSearch', label: 'clearTranslationSearch:click' });
            }
            
            // 清除搜索按钮（移动端）
            if (clearTranslationSearchMobile) {
                EventManager.add(clearTranslationSearchMobile, 'click', () => {
                    if (translationSearchInput) translationSearchInput.value = '';
                    if (translationSearchInputMobile) translationSearchInputMobile.value = '';
                    searchTranslationItems('');
                }, { tag: 'translations', scope: 'translationSearch', label: 'clearTranslationSearchMobile:click' });
            }
            
            // 清除所有示例数据
            const clearAllSampleDataBtn = document.getElementById('clearAllSampleData');
            if (clearAllSampleDataBtn) {
                EventManager.add(clearAllSampleDataBtn, 'click', () => {
                    if (confirm('确定要清除所有示例数据吗？包括：\n- 示例项目\n- 翻译项\n- 术语库\n\n此操作不可恢复！')) {
                        // 清空翻译项
                        AppState.translations.items = [];
                        AppState.translations.filtered = [];
                        
                        // 清空术语库
                        AppState.terminology.list = [];
                        AppState.terminology.filtered = [];
                        
                        // 清空项目信息
                        if (AppState.project) {
                            AppState.project.translationItems = [];
                            AppState.project.name = '新项目';
                        }
                        
                        // 清空文件树
                        const fileTree = document.getElementById('fileTree');
                        if (fileTree) {
                            const div = document.createElement('div');
                            div.className = 'p-4 text-center text-gray-400 text-sm';
                            div.textContent = '暂无文件';
                            fileTree.replaceChildren(div);
                        }
                        
                        // 重置文件元数据
                        AppState.fileMetadata = {};
                        
                        // 更新界面
                        updateTranslationLists();
                        updateTerminologyList();
                        
                        // 清空搜索框
                        if (translationSearchInput) translationSearchInput.value = '';
                        if (translationSearchInputMobile) translationSearchInputMobile.value = '';
                        
                        showNotification('success', '清除成功', '所有示例数据已清除');
                    }
                }, { tag: 'data', scope: 'sampleData', label: 'clearAllSampleData:click' });
            }
            
            // 密码显示/隐藏切换
            document.querySelectorAll('.toggle-password').forEach(btn => {
                EventManager.add(btn, 'click', function() {
                    const targetId = this.getAttribute('data-target');
                    const input = document.getElementById(targetId);
                    const icon = this.querySelector('i');
                    
                    if (input && icon) {
                        if (input.type === 'password') {
                            input.type = 'text';
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                        } else {
                            input.type = 'password';
                            icon.classList.remove('fa-eye-slash');
                            icon.classList.add('fa-eye');
                        }
                    }
                }, { tag: 'ui', scope: 'settings', label: 'togglePassword:click' });
            });
            
            // 主题和字体大小实时预览
            const themeMode = document.getElementById('themeMode');
            const fontSize = document.getElementById('fontSize');
            
            if (themeMode) {
                EventManager.add(themeMode, 'change', function() {
                    applySettings({ themeMode: this.value });
                }, { tag: 'settings', scope: 'appearance', label: 'themeMode:change' });
            }
            
            if (fontSize) {
                EventManager.add(fontSize, 'change', function() {
                    applySettings({ fontSize: this.value });
                }, { tag: 'settings', scope: 'appearance', label: 'fontSize:change' });
            }

            const sourceSelectionIndicatorEnabled = document.getElementById('sourceSelectionIndicatorEnabled');
            const sourceSelectionIndicatorUnselectedStyle = document.getElementById('sourceSelectionIndicatorUnselectedStyle');

            if (sourceSelectionIndicatorEnabled) {
                EventManager.add(sourceSelectionIndicatorEnabled, 'change', function() {
                    applySettings({ sourceSelectionIndicatorEnabled: this.checked });
                }, { tag: 'settings', scope: 'appearance', label: 'sourceSelectionIndicatorEnabled:change' });
            }

            if (sourceSelectionIndicatorUnselectedStyle) {
                EventManager.add(sourceSelectionIndicatorUnselectedStyle, 'change', function() {
                    applySettings({ sourceSelectionIndicatorUnselectedStyle: this.value });
                }, { tag: 'settings', scope: 'appearance', label: 'sourceSelectionIndicatorUnselectedStyle:change' });
            }
        }
        
        // 加载保存的设置
        // 加载保存的设置
        async function loadSettings() {
            const savedSettings = localStorage.getItem('translatorSettings');
            if (savedSettings) {
                try {
                    const settings = safeJsonParse(savedSettings, {});
                    
                    // 加载外观设置
                    if (settings.themeMode) {
                        const themeMode = document.getElementById('themeMode');
                        if (themeMode) themeMode.value = settings.themeMode;
                    }
                    if (settings.fontSize) {
                        const fontSize = document.getElementById('fontSize');
                        if (fontSize) fontSize.value = settings.fontSize;
                    }
                    if (settings.itemsPerPage) {
                        const itemsPerPage = document.getElementById('itemsPerPage');
                        if (itemsPerPage) itemsPerPage.value = settings.itemsPerPage;
                        // 同步到 AppState
                        AppState.translations.itemsPerPage = parseInt(settings.itemsPerPage);
                    }

                    if (settings.sourceSelectionIndicatorEnabled !== undefined) {
                        const sourceSelectionIndicatorEnabled = document.getElementById('sourceSelectionIndicatorEnabled');
                        if (sourceSelectionIndicatorEnabled) {
                            sourceSelectionIndicatorEnabled.checked = !!settings.sourceSelectionIndicatorEnabled;
                        }
                    }

                    if (settings.sourceSelectionIndicatorUnselectedStyle) {
                        const sourceSelectionIndicatorUnselectedStyle = document.getElementById('sourceSelectionIndicatorUnselectedStyle');
                        if (sourceSelectionIndicatorUnselectedStyle) {
                            sourceSelectionIndicatorUnselectedStyle.value = settings.sourceSelectionIndicatorUnselectedStyle;
                        }
                    }

                    if (settings.autosaveIntervalSeconds !== undefined) {
                        const autosaveIntervalSeconds = document.getElementById('autosaveIntervalSeconds');
                        if (autosaveIntervalSeconds) autosaveIntervalSeconds.value = settings.autosaveIntervalSeconds;
                    }
                    
                    // 加载翻译引擎设置
                    const savedEngine = settings.defaultEngine || settings.translationEngine;
                    if (savedEngine) {
                        const engine = document.getElementById('defaultEngine');
                        if (engine) engine.value = savedEngine;
                    }
                    const savedModel = settings.translationModel || settings.model;
                    if (savedModel) {
                        const model = document.getElementById('translationModel');
                        if (model) model.value = savedModel;
                    }
                    if (settings.apiTimeout) {
                        const timeout = document.getElementById('apiTimeout');
                        if (timeout) timeout.value = settings.apiTimeout;
                    }
                    if (settings.concurrentLimit) {
                        const concurrent = document.getElementById('concurrentLimit');
                        if (concurrent) concurrent.value = settings.concurrentLimit;
                    }
                    if (settings.retryCount !== undefined) {
                        const retry = document.getElementById('retryCount');
                        if (retry) retry.value = settings.retryCount;
                    }
                    
                    // 加载质量检查设置
                    if (settings.checkTerminology !== undefined) {
                        const check = document.getElementById('checkTerminology');
                        if (check) check.checked = settings.checkTerminology;
                    }
                    if (settings.checkPlaceholders !== undefined) {
                        const check = document.getElementById('checkPlaceholders');
                        if (check) check.checked = settings.checkPlaceholders;
                    }
                    if (settings.checkPunctuation !== undefined) {
                        const check = document.getElementById('checkPunctuation');
                        if (check) check.checked = settings.checkPunctuation;
                    }
                    if (settings.checkLength !== undefined) {
                        const check = document.getElementById('checkLength');
                        if (check) check.checked = settings.checkLength;
                    }
                    if (settings.checkNumbers !== undefined) {
                        const check = document.getElementById('checkNumbers');
                        if (check) check.checked = settings.checkNumbers;
                    }
                    if (settings.qualityThreshold) {
                        const threshold = document.getElementById('qualityThreshold');
                        if (threshold) threshold.value = settings.qualityThreshold;
                    }
                    
                    // 加载术语库设置
                    if (settings.autoApplyTerms !== undefined) {
                        const auto = document.getElementById('autoApplyTerms');
                        if (auto) auto.checked = settings.autoApplyTerms;
                    }
                    if (settings.termMatchMode) {
                        const mode = document.getElementById('termMatchMode');
                        if (mode) mode.value = settings.termMatchMode;
                    }
                    if (settings.highlightTerms !== undefined) {
                        const highlight = document.getElementById('highlightTerms');
                        if (highlight) highlight.checked = settings.highlightTerms;
                    }
                    if (settings.duplicateHandling) {
                        const handling = document.getElementById('duplicateHandling');
                        if (handling) handling.value = settings.duplicateHandling;
                    }
                    
                    // 加载文件处理设置
                    if (settings.maxFileSize) {
                        const maxSize = document.getElementById('maxFileSize');
                        if (maxSize) maxSize.value = settings.maxFileSize;
                    }
                    if (settings.formatXML !== undefined) {
                        const format = document.getElementById('formatXML');
                        if (format) format.checked = settings.formatXML;
                    }
                    if (settings.formatXLIFF !== undefined) {
                        const format = document.getElementById('formatXLIFF');
                        if (format) format.checked = settings.formatXLIFF;
                    }
                    if (settings.formatJSON !== undefined) {
                        const format = document.getElementById('formatJSON');
                        if (format) format.checked = settings.formatJSON;
                    }
                    if (settings.formatPO !== undefined) {
                        const format = document.getElementById('formatPO');
                        if (format) format.checked = settings.formatPO;
                    }
                    if (settings.formatRESX !== undefined) {
                        const format = document.getElementById('formatRESX');
                        if (format) format.checked = settings.formatRESX;
                    }
                    if (settings.autoDetectEncoding !== undefined) {
                        const auto = document.getElementById('autoDetectEncoding');
                        if (auto) auto.checked = settings.autoDetectEncoding;
                    }
                    if (settings.autoTranslateOnImport !== undefined) {
                        const auto = document.getElementById('autoTranslateOnImport');
                        if (auto) auto.checked = settings.autoTranslateOnImport;
                    }
                            
                    // 加载并解密 API 密钥
                    if (settings.deepseekApiKey) {
                        const deepseekKey = document.getElementById('deepseekApiKey');
                        if (deepseekKey) {
                            const decrypted = await securityUtils.decrypt(settings.deepseekApiKey);
                            deepseekKey.value = decrypted;
                        }
                    }
                    if (settings.openaiApiKey) {
                        const openaiKey = document.getElementById('openaiApiKey');
                        if (openaiKey) {
                            const decrypted = await securityUtils.decrypt(settings.openaiApiKey);
                            openaiKey.value = decrypted;
                        }
                    }
                    if (settings.googleApiKey) {
                        const googleKey = document.getElementById('googleApiKey');
                        if (googleKey) {
                            const decrypted = await securityUtils.decrypt(settings.googleApiKey);
                            googleKey.value = decrypted;
                        }
                    }
                    
                    // 应用设置
                    applySettings(settings);
                } catch (e) {
                    console.error('加载设置失败:', e);
                }
            }
        }
        
        // 应用设置
        function applySettings(settings) {
            if (settings.sourceSelectionIndicatorEnabled === undefined && AppState.ui?.sourceSelectionIndicatorEnabled === undefined) {
                AppState.ui.sourceSelectionIndicatorEnabled = true;
            }
            if (!AppState.ui?.sourceSelectionIndicatorUnselectedStyle) {
                AppState.ui.sourceSelectionIndicatorUnselectedStyle = 'gray';
            }

            // 应用主题设置
            if (settings.themeMode) {
                const body = document.body;
                if (settings.themeMode === 'dark') {
                    body.classList.add('dark-mode');
                } else if (settings.themeMode === 'light') {
                    body.classList.remove('dark-mode');
                } else if (settings.themeMode === 'auto') {
                    // 根据系统主题设置
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                        body.classList.add('dark-mode');
                    } else {
                        body.classList.remove('dark-mode');
                    }
                }
            }
            
            // 应用字体大小设置
            if (settings.fontSize) {
                const html = document.documentElement;
                html.classList.remove('text-sm', 'text-base', 'text-lg');
                if (settings.fontSize === 'small') {
                    html.classList.add('text-sm');
                } else if (settings.fontSize === 'large') {
                    html.classList.add('text-lg');
                } else {
                    html.classList.add('text-base');
                }
            }
            
            // 应用每页显示数量设置
            if (settings.itemsPerPage) {
                AppState.translations.itemsPerPage = parseInt(settings.itemsPerPage);
                AppState.translations.currentPage = 1; // 重置到第一页
                // 刷新翻译列表
                if (AppState.translations.items.length > 0) {
                    updateTranslationLists();
                }
            }

            if (settings.sourceSelectionIndicatorEnabled !== undefined) {
                AppState.ui.sourceSelectionIndicatorEnabled = !!settings.sourceSelectionIndicatorEnabled;
                if (AppState.translations.items.length > 0) {
                    updateTranslationLists();
                }
            }

            if (settings.sourceSelectionIndicatorUnselectedStyle) {
                AppState.ui.sourceSelectionIndicatorUnselectedStyle = settings.sourceSelectionIndicatorUnselectedStyle;
                if (AppState.translations.items.length > 0) {
                    updateTranslationLists();
                }
            }

            if (settings.autosaveIntervalSeconds !== undefined) {
                const seconds = parseInt(settings.autosaveIntervalSeconds);
                if (Number.isFinite(seconds) && typeof autoSaveManager?.setSaveInterval === 'function') {
                    autoSaveManager.setSaveInterval(seconds * 1000);
                }
            }
        }
        
        // 初始化图表
        function initCharts() {
            const ChartCtor = window.Chart;
            if (typeof ChartCtor !== 'function') return;

            const accuracyEl = document.getElementById('accuracyChart');
            if (!accuracyEl || typeof accuracyEl.getContext !== 'function') return;

            const accuracyCtx = accuracyEl.getContext('2d');
            if (!accuracyCtx) return;

            if (qualityCheckCharts.accuracy) {
                qualityCheckCharts.accuracy.destroy();
            }
            qualityCheckCharts.accuracy = new ChartCtor(accuracyCtx, {
                type: 'radar',
                data: {
                    labels: ['准确性', '流畅度', '术语一致性', '格式保留', '上下文适应'],
                    datasets: [{
                        label: '翻译质量',
                        data: [95, 90, 85, 98, 92],
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
                        pointRadius: 3
                    }]
                },
                options: {
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                stepSize: 20
                            }
                        }
                    }
                }
            });
            
            // 一致性图表
            const consistencyEl = document.getElementById('consistencyChart');
            if (!consistencyEl || typeof consistencyEl.getContext !== 'function') return;

            const consistencyCtx = consistencyEl.getContext('2d');
            if (!consistencyCtx) return;

            if (qualityCheckCharts.consistency) {
                qualityCheckCharts.consistency.destroy();
            }
            qualityCheckCharts.consistency = new ChartCtor(consistencyCtx, {
                type: 'bar',
                data: {
                    labels: ['术语一致性', '风格一致性', '格式一致性'],
                    datasets: [{
                        label: '一致性评分',
                        data: [85, 92, 98],
                        backgroundColor: [
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(16, 185, 129, 0.7)',
                            'rgba(37, 99, 235, 0.7)'
                        ],
                        borderColor: [
                            'rgba(245, 158, 11, 1)',
                            'rgba(16, 185, 129, 1)',
                            'rgba(37, 99, 235, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }

        // 初始化术语库（从 localStorage 恢复）
        function initTerminology() {
            try {
                // 尝试从 localStorage 加载术语库
                const savedTerminology = localStorage.getItem('terminologyList');
                
                if (savedTerminology) {
                    const parsedTerminology = safeJsonParse(savedTerminology, []);
                    if (Array.isArray(parsedTerminology) && parsedTerminology.length > 0) {
                        // 使用保存的术语库
                        AppState.terminology.list = parsedTerminology;
                        AppState.terminology.filtered = [...parsedTerminology];
                        console.log(`从 localStorage 加载了 ${parsedTerminology.length} 个术语`);
                    } else {
                        // localStorage 中没有有效数据，使用默认示例术语
                        console.log('使用默认示例术语库');
                        // AppState.terminology 已经有示例数据，不需要额外设置
                    }
                } else {
                    // localStorage 中没有数据，使用默认示例术语
                    console.log('首次使用，加载示例术语库');
                    // AppState.terminology 已经有示例数据，不需要额外设置
                }
            } catch (error) {
                console.error('加载术语库失败:', error);
                // 出错时使用默认示例数据
            }
        }

        // 加载示例项目
        function loadSampleProject() {
            // 模拟项目数据
            AppState.project = {
                id: 'sample-project-1',
                name: '示例项目',
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                fileFormat: 'xml',
                translationItems: [
                    {
                        id: 'item-1',
                        sourceText: 'Welcome to our application',
                        targetText: '欢迎使用我们的应用',
                        context: '应用启动欢迎语',
                        status: 'translated',
                        qualityScore: 98,
                        issues: [],
                        metadata: { position: 'app.welcome' }
                    },
                    {
                        id: 'item-2',
                        sourceText: 'Please login to continue',
                        targetText: '请登录以继续',
                        context: '登录提示',
                        status: 'translated',
                        qualityScore: 95,
                        issues: [],
                        metadata: { position: 'auth.login.prompt' }
                    },
                    {
                        id: 'item-3',
                        sourceText: 'The API endpoint requires authentication.',
                        targetText: 'API端点需要身份验证。',
                        context: 'API错误消息',
                        status: 'translated',
                        qualityScore: 85,
                        issues: [{ type: '术语不一致', severity: 'medium' }],
                        metadata: { position: 'api.error.auth' }
                    },
                    {
                        id: 'item-4',
                        sourceText: 'Please refer to the documentation for more details.',
                        targetText: '请参考文档以获取更多详细信息。',
                        context: '帮助提示',
                        status: 'translated',
                        qualityScore: 80,
                        issues: [{ type: '冗余表达', severity: 'high' }],
                        metadata: { position: 'help.documentation' }
                    },
                    {
                        id: 'item-5',
                        sourceText: 'You have successfully updated your profile.',
                        targetText: '',
                        context: '成功消息',
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { position: 'profile.update.success' }
                    },
                    {
                        id: 'item-6',
                        sourceText: 'Please enter a valid email address.',
                        targetText: '',
                        context: '表单验证错误',
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { position: 'form.error.email' }
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // 同步 AppState
            AppState.translations.items = AppState.project.translationItems;
            AppState.translations.filtered = [...AppState.project.translationItems];
            
            // 更新UI
            updateFileTree();
            updateTranslationLists();
            updateCounters();
            
            // 显示通知
            showNotification('success', '项目已加载', '示例项目已成功加载');

            autoSaveManager.markDirty();
            autoSaveManager.saveProject();
        }

        // 文件拖放处理
        function setDropAreaActive(target, active) {
            const el = typeof target === 'string' ? document.getElementById(target) : target;
            if (!el) return;

            el.dataset.active = active ? 'true' : 'false';
            if (active) {
                el.classList.remove('border-gray-300', 'dark:border-gray-600');
                el.classList.add('border-primary', 'bg-blue-50', 'dark:bg-blue-500/10');
            } else {
                el.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-500/10');
                el.classList.add('border-gray-300', 'dark:border-gray-600');
            }
        }

        const __devEnabled = (typeof isDevelopment === 'boolean' && isDevelopment)
            || (typeof isDevelopment === 'function' && isDevelopment());
        if (__devEnabled) {
            window.__setDropAreaActive = setDropAreaActive;
        }

        function handleDragOver(e) {
            e.preventDefault();
            setDropAreaActive('fileDropArea', true);
        }

        function handleDragLeave(e) {
            e.preventDefault();
            setDropAreaActive('fileDropArea', false);
        }

        function handleDrop(e) {
            e.preventDefault();
            setDropAreaActive('fileDropArea', false);
            
            if (e.dataTransfer.files.length) {
                // 将 FileList 转换为数组，保持一致性
                const filesArray = Array.from(e.dataTransfer.files);
                processFiles(filesArray);
            }
        }

        function handleFileSelect(e) {
            if (e.target.files.length) {
                // 先将 FileList 转换为数组，防止清空输入框后 files 被清空
                const filesArray = Array.from(e.target.files);
                
                // 验证文件大小（10MB限制）
                const invalidFiles = filesArray.filter(file => !securityUtils.validateFileSize(file.size, 10));
                if (invalidFiles.length > 0) {
                    showNotification('error', '文件过大', `以下文件超过10MB限制：${invalidFiles.map(f => f.name).join(', ')}`);
                    e.target.value = '';
                    return;
                }
                
                processFiles(filesArray);
                // 清空文件输入框，允许重复选择同一文件
                e.target.value = '';
            }
        }

        // ==================== 文件处理功能（优化版） ====================
        
        // 读取单个文件
        async function readFileAsync(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
                reader.readAsText(file);
            });
        }
        
        // 解析单个文件
        async function parseFileAsync(file) {
            try {
                // 显示处理提示
                showNotification('info', '解析文件', `正在解析文件: ${file.name}`);
                
                const fileExtension = file.name.split('.').pop().toLowerCase();

                const content = await readFileAsync(file);
                
                // 只对XML类文件进行XML验证
                const xmlExtensions = ['xml', 'xlf', 'xliff', 'resx'];
                if (xmlExtensions.includes(fileExtension)) {
                    if (!securityUtils.validateXMLContent(content)) {
                        throw new Error('文件内容不是有效的XML格式或过大');
                    }
                }
                
                // 保存文件元数据（到 AppState）
                const projectId = AppState.__pendingImportProjectId || getOrCreateProjectId();
                const contentKey = buildFileContentKey(projectId, file.name);
                AppState.fileMetadata[file.name] = {
                    size: file.size,
                    lastModified: file.lastModified,
                    type: file.type || 'text/xml',
                    originalContent: content,  // 保存原始文件内容
                    contentKey,
                    extension: fileExtension
                };

                try {
                    await idbPutFileContent(contentKey, content); 
                } catch (e) {
                    console.error('导入时写入IndexedDB失败:', e);
                    notifyIndexedDbFileContentErrorOnce(e, '导入时保存原始内容');
                }
                
                console.log(`开始解析文件: ${file.name} (${fileExtension}), 大小: ${file.size} bytes`);
                
                // 根据文件类型解析内容
                let items = [];
                
                try {
                    const parserMap = {
                        'xml': () => {
                            if (content.includes('<resources') && content.includes('<string name=')) {
                                console.log('检测到Android strings.xml格式');
                                return parseAndroidStrings(content, file.name);
                            }
                            console.log('使用通用XML解析器');
                            return parseGenericXML(content, file.name);
                        },
                        'xlf': () => {
                            console.log('检测到XLIFF格式');
                            return parseXLIFF(content, file.name);
                        },
                        'xliff': () => {
                            console.log('检测到XLIFF格式');
                            return parseXLIFF(content, file.name);
                        },
                        'strings': () => {
                            console.log('检测到iOS strings格式');
                            return parseIOSStrings(content, file.name);
                        },
                        'resx': () => {
                            console.log('检测到RESX格式');
                            return parseRESX(content, file.name);
                        },
                        'po': () => {
                            console.log('检测到PO格式');
                            return parsePO(content, file.name);
                        },
                        'json': () => {
                            console.log('检测到JSON格式');
                            return parseJSON(content, file.name);
                        }
                    };
                    
                    const parser = parserMap[fileExtension];
                    if (parser) {
                        items = parser();
                    } else {
                        console.log('使用文本文件解析器');
                        items = parseTextFile(content, file.name);
                    }
                } catch (parseError) {
                    console.error(`特定解析器失败，使用备用方法:`, parseError);
                    items = parseTextFile(content, file.name);
                }
                
                console.log(`文件 ${file.name} 解析完成，找到 ${items.length} 个翻译项`);
                showNotification('success', '文件解析成功', `文件 ${file.name} 已成功解析，找到 ${items.length} 个翻译项`);
                
                return { success: true, items, fileName: file.name };
                
            } catch (error) {
                console.error(`解析文件 ${file.name} 时出错:`, error);
                showNotification('error', '文件解析错误', `无法解析文件 ${file.name}: ${error.message}`);
                
                // 返回错误信息项
                return {
                    success: false,
                    items: [{
                        id: `error-${Date.now()}`,
                        sourceText: `文件解析错误: ${file.name}`,
                        targetText: '',
                        context: error.message,
                        status: 'pending',
                        qualityScore: 0,
                        issues: ['FILE_PARSE_ERROR'],
                        metadata: { 
                            file: file.name, 
                            position: 'error'
                        }
                    }],
                    fileName: file.name
                };
            }
        }
        
        // 处理多个文件（优化版）
        async function processFiles(files) {
            showNotification('info', '处理文件', `正在处理 ${files.length} 个文件...`);
            
            try {
                AppState.fileMetadata = {};
                AppState.__pendingImportProjectId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                // 并行处理所有文件
                const results = await Promise.allSettled(
                    Array.from(files).map(file => parseFileAsync(file))
                );
                
                // 收集所有解析结果
                const newItems = [];
                let successCount = 0;
                
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        newItems.push(...result.value.items);
                        if (result.value.success) successCount++;
                    }
                });
                
                console.log(`所有文件处理完成: 成功 ${successCount}/${files.length} 个，解析 ${newItems.length} 个翻译项`);
                
                // 完成文件处理
                await completeFileProcessing(files, newItems);
                
            } catch (error) {
                console.error('处理文件时出错:', error);
                showNotification('error', '处理错误', `文件处理过程中出现错误: ${error.message}`);
            }
        }
        
        // 完成文件处理
        async function completeFileProcessing(files, newItems) {
            console.log('completeFileProcessing 被调用', { filesCount: files.length, itemsCount: newItems.length });
            
            // 如果没有成功解析的项，显示警告
            if (newItems.length === 0) {
                showNotification('warning', '无可用翻译项', '无法从上传的文件中提取翻译内容');
                return;
            }
            
            // 导入文件时，直接替换整个项目（不追加）
            console.log('创建新项目，替换现有内容');
            const importProjectId = AppState.__pendingImportProjectId || ('new-project-' + Date.now());
            AppState.project = {
                id: importProjectId,
                name: '未命名项目',
                sourceLanguage: document.getElementById('sourceLanguage').value,
                targetLanguage: document.getElementById('targetLanguage').value,
                fileFormat: 'mixed',
                translationItems: newItems,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            hydrateFileMetadataContentKeys(importProjectId);
            AppState.__pendingImportProjectId = null;
            
            // 同步 AppState 翻译状态
            AppState.translations.items = newItems;
            AppState.translations.filtered = [...newItems];
            AppState.translations.selected = -1;
            AppState.translations.currentPage = 1;
            
            // 显示成功通知
            showNotification('success', '文件已导入', `${files.length} 个文件已成功导入，共提取 ${newItems.length} 个翻译项`);
            
            console.log('调用 updateFileTree，项目信息:', AppState.project);
            // 更新文件树（在创建/更新项目之后）
            updateFileTree();
            
            // 更新UI
            updateTranslationLists();
            updateCounters();
            
            // 更新项目状态
            document.getElementById('projectStatus').textContent = '已更新';
            document.getElementById('projectStatus').className = 'text-success dark:text-emerald-400 font-medium';

            autoSaveManager.markDirty();
            try {
                await autoSaveManager.saveProject();
            } catch (e) {
                console.error('导入后持久化失败:', e);
            }
        }
        
        // ==================== XML 解析功能（优化版） ====================
        
        // 解析通用XML文件（使用 TreeWalker 优化）
        function parseGenericXML(content, fileName) {
            const items = [];
            
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, 'application/xml');
                
                // 检查是否有解析错误
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    console.warn('XML解析出错，尝试使用备用方法:', parserError.textContent);
                    return parseXMLWithRegex(content, fileName);
                }
                
                // 使用 TreeWalker 遍历所有文本节点（比递归更高效）
                const walker = document.createTreeWalker(
                    xmlDoc.documentElement,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            const text = node.textContent?.trim() || '';
                            // 过滤空白和过短的文本
                            return text.length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                        }
                    }
                );
                
                let node;
                let index = 0;
                while (node = walker.nextNode()) {
                    const text = node.textContent.trim();
                    
                    // 获取父节点路径
                    let path = '';
                    let current = node.parentElement;
                    const pathParts = [];
                    
                    while (current && current !== xmlDoc.documentElement) {
                        pathParts.unshift(current.nodeName);
                        current = current.parentElement;
                    }
                    
                    if (pathParts.length > 0) {
                        path = '/' + pathParts.join('/');
                    }
                    
                    items.push({
                        id: `xml-${++index}`,
                        sourceText: text,
                        targetText: '',
                        context: `From ${fileName}${path}`,
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            path: path,
                            position: `node-${index}`
                        }
                    });
                }
                
                // 如果没有找到任何文本节点，尝试使用正则表达式
                if (items.length === 0) {
                    console.warn('DOM解析未找到文本节点，尝试使用正则表达式');
                    return parseXMLWithRegex(content, fileName);
                }
                
                return items;
            } catch (error) {
                console.error('解析XML文件时出错:', error);
                return parseXMLWithRegex(content, fileName);
            }
        }
        
        // 使用正则表达式解析XML（备用方法）
        function parseXMLWithRegex(content, fileName) {
            const items = [];
            
            try {
                // 移除XML注释
                let cleanContent = content.replace(/<!--[\s\S]*?-->/g, '');
                
                // 尝试提取标签之间的文本
                const textRegex = new RegExp('>([^<]+)</', 'g');
                let match;
                let textIndex = 1;
                
                while ((match = textRegex.exec(cleanContent)) !== null) {
                    const text = match[1].trim();
                    // 只保留有意义的文本（长度大于1且不全是空白字符）
                    if (text.length > 1 && !/^\s*$/.test(text)) {
                        items.push({
                            id: `xml-regex-${textIndex}`,
                            sourceText: text,
                            targetText: '',
                            context: `From ${fileName} (text node ${textIndex})`,
                            status: 'pending',
                            qualityScore: 0,
                            issues: [],
                            metadata: { 
                                file: fileName, 
                                position: `text-${textIndex}`
                            }
                        });
                        textIndex++;
                    }
                }
                
                // 如果还是没有找到文本，尝试提取CDATA内容
                if (items.length === 0) {
                    const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
                    let cdataMatch;
                    let cdataIndex = 1;
                    
                    while ((cdataMatch = cdataRegex.exec(content)) !== null) {
                        const cdataText = cdataMatch[1].trim();
                        if (cdataText.length > 0) {
                            items.push({
                                id: `xml-cdata-${cdataIndex}`,
                                sourceText: cdataText,
                                targetText: '',
                                context: `From ${fileName} (CDATA ${cdataIndex})`,
                                status: 'pending',
                                qualityScore: 0,
                                issues: [],
                                metadata: { 
                                    file: fileName, 
                                    position: `cdata-${cdataIndex}`
                                }
                            });
                            cdataIndex++;
                        }
                    }
                }
                
                // 如果仍然没有找到文本，添加整个文件内容作为一个翻译项
                if (items.length === 0) {
                    const fileText = content.substring(0, 1000) + (content.length > 1000 ? '...' : '');
                    items.push({
                        id: `xml-file-1`,
                        sourceText: fileText,
                        targetText: '',
                        context: `Entire file content from ${fileName}`,
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            position: 'entire-file'
                        }
                    });
                }
                
                return items;
            } catch (error) {
                console.error('使用正则表达式解析XML时出错:', error);
                // 返回一个包含错误信息的翻译项
                return [{
                    id: 'xml-error-1',
                    sourceText: `无法解析XML文件: ${fileName}`,
                    targetText: '',
                    context: '解析错误',
                    status: 'pending',
                    qualityScore: 0,
                    issues: ['XML_PARSE_ERROR'],
                    metadata: { 
                        file: fileName, 
                        position: 'error'
                    }
                }];
            }
        }
        
        // 解析Android strings.xml文件
        function parseAndroidStrings(content, fileName) {
            const items = [];
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'application/xml');
            
            // 检查解析错误
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XML解析错误: ' + parserError.textContent);
            }
            
            // 查找所有<string>元素
            const stringElements = xmlDoc.getElementsByTagName('string');
            for (let i = 0; i < stringElements.length; i++) {
                const element = stringElements[i];
                const name = element.getAttribute('name');
                const text = element.textContent.trim();
                
                if (name && text) {
                    items.push({
                        id: `android-${i + 1}`,
                        sourceText: text,
                        targetText: '',
                        context: `Android string resource: ${name}`,
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            resourceId: name,
                            position: `line-${i + 1}`
                        }
                    });
                }
            }
            
            // 查找所有<string-array>元素
            const arrayElements = xmlDoc.getElementsByTagName('string-array');
            for (let i = 0; i < arrayElements.length; i++) {
                const arrayName = arrayElements[i].getAttribute('name');
                const itemElements = arrayElements[i].getElementsByTagName('item');
                
                for (let j = 0; j < itemElements.length; j++) {
                    const text = itemElements[j].textContent.trim();
                    
                    if (text) {
                        items.push({
                            id: `android-array-${i + 1}-${j + 1}`,
                            sourceText: text,
                            targetText: '',
                            context: `Android string array: ${arrayName}[${j}]`,
                            status: 'pending',
                            qualityScore: 0,
                            issues: [],
                            metadata: { 
                                file: fileName, 
                                resourceId: `${arrayName}[${j}]`,
                                position: `line-${i + 1}-${j + 1}`
                            }
                        });
                    }
                }
            }
            
            return items;
        }
        
        // 解析XLIFF文件
        function parseXLIFF(content, fileName) {
            const items = [];
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'application/xml');
            
            // 检查解析错误
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XLIFF解析错误: ' + parserError.textContent);
            }
            
            // 查找所有trans-unit元素
            const transUnits = xmlDoc.getElementsByTagName('trans-unit');
            for (let i = 0; i < transUnits.length; i++) {
                const unit = transUnits[i];
                const id = unit.getAttribute('id') || `unit-${i + 1}`;
                
                // 查找source元素
                const sourceElement = unit.getElementsByTagName('source')[0];
                const sourceText = sourceElement ? sourceElement.textContent.trim() : '';
                
                // 查找target元素（如果存在）
                const targetElement = unit.getElementsByTagName('target')[0];
                const targetText = targetElement ? targetElement.textContent.trim() : '';
                
                if (sourceText) {
                    items.push({
                        id: `xliff-${i + 1}`,
                        sourceText: sourceText,
                        targetText: targetText,
                        context: `XLIFF unit: ${id}`,
                        status: targetText ? 'translated' : 'pending',
                        qualityScore: targetText ? 85 : 0, // 假设已有翻译的质量分数为85
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            unitId: id,
                            position: `unit-${i + 1}`
                        }
                    });
                }
            }
            
            return items;
        }
        
        // 解析iOS Localizable.strings文件
        function parseIOSStrings(content, fileName) {
            const items = [];
            
            // 支持多行和转义符的正则表达式
            // 匹配格式: "key" = "value";
            const lines = content.split('\n');
            let lineNumber = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                lineNumber++;
                
                // 跳过注释和空行
                if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
                    continue;
                }
                
                // 匹配 "key" = "value"; 格式
                const match = line.match(/^\s*"([^"]+)"\s*=\s*"([^"]*)";?\s*$/);
                if (match) {
                    const key = match[1];
                    const value = match[2];
                    
                    items.push({
                        id: `ios-${items.length + 1}`,
                        sourceText: value || key, // 如果value为空，使用key作为源文本
                        targetText: '',
                        context: `iOS string key: ${key}`,
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            key: key,
                            position: `line-${lineNumber}`
                        }
                    });
                }
            }
            
            if (items.length === 0) {
                throw new Error('未找到有效的iOS Strings条目，请检查文件格式');
            }
            
            return items;
        }
        
        // 解析RESX文件
        function parseRESX(content, fileName) {
            const items = [];
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'application/xml');
            
            // 检查解析错误
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('RESX解析错误: ' + parserError.textContent);
            }
            
            // 查找所有data元素
            const dataElements = xmlDoc.getElementsByTagName('data');
            for (let i = 0; i < dataElements.length; i++) {
                const data = dataElements[i];
                const name = data.getAttribute('name');
                
                // 查找value子元素
                const valueElement = data.getElementsByTagName('value')[0];
                const valueText = valueElement ? valueElement.textContent : '';
                
                if (name && valueText) {
                    items.push({
                        id: `resx-${i + 1}`,
                        sourceText: valueText,
                        targetText: '',
                        context: `RESX resource: ${name}`,
                        status: 'pending',
                        qualityScore: 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            resourceId: name,
                            position: `item-${i + 1}`
                        }
                    });
                }
            }
            
            return items;
        }
        
        // 解析PO文件
        function parsePO(content, fileName) {
            const items = [];
                    
            // 按空行分割条目
            const entries = content.split(/\n\s*\n/);
                    
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i].trim();
                if (!entry || entry.startsWith('#')) continue;
                        
                // 支持多行msgid和msgstr
                // 匹配 msgid "..."
                const msgidMatch = entry.match(/msgid\s+"([^"]*)"/);
                // 匹配 msgstr "..."
                const msgstrMatch = entry.match(/msgstr\s+"([^"]*)"/);
                        
                // 处理多行字符串（继续在下一行）
                let msgid = msgidMatch ? msgidMatch[1] : '';
                let msgstr = msgstrMatch ? msgstrMatch[1] : '';
                        
                // 匹配多行字符串 "..."
                const multilineRegex = /"([^"]*)"/g;
                const msgidSection = entry.match(/msgid[\s\S]*?(?=msgstr|$)/);
                const msgstrSection = entry.match(/msgstr[\s\S]*/);
                        
                if (msgidSection) {
                    const msgidLines = [];
                    let match;
                    while ((match = multilineRegex.exec(msgidSection[0])) !== null) {
                        msgidLines.push(match[1]);
                    }
                    if (msgidLines.length > 0) {
                        msgid = msgidLines.join('');
                    }
                }
                        
                if (msgstrSection) {
                    const msgstrLines = [];
                    let match;
                    multilineRegex.lastIndex = 0; // 重置正则索引
                    while ((match = multilineRegex.exec(msgstrSection[0])) !== null) {
                        msgstrLines.push(match[1]);
                    }
                    if (msgstrLines.length > 0) {
                        msgstr = msgstrLines.join('');
                    }
                }
                        
                // 跳过空的msgid（通常是头部元数据）
                if (msgid && msgid.trim()) {
                    items.push({
                        id: `po-${items.length + 1}`,
                        sourceText: msgid,
                        targetText: msgstr || '',
                        context: `PO entry: ${i + 1}`,
                        status: msgstr ? 'translated' : 'pending',
                        qualityScore: msgstr ? 85 : 0,
                        issues: [],
                        metadata: { 
                            file: fileName, 
                            entryId: i + 1,
                            position: `entry-${i + 1}`
                        }
                    });
                }
            }
                    
            if (items.length === 0) {
                throw new Error('未找到有效的PO条目，请检查文件格式');
            }
                    
            return items;
        }
        
        // 解析JSON文件
        function parseJSON(content, fileName) {
            const items = [];
            
            try {
                const json = JSON.parse(content);
                
                // 递归遍历JSON对象
                function traverseObject(obj, path = '') {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            const value = obj[key];
                            const currentPath = path ? `${path}.${key}` : key;
                            
                            if (typeof value === 'string') {
                                items.push({
                                    id: `json-${items.length + 1}`,
                                    sourceText: value,
                                    targetText: '',
                                    context: `JSON path: ${currentPath}`,
                                    status: 'pending',
                                    qualityScore: 0,
                                    issues: [],
                                    metadata: { 
                                        file: fileName, 
                                        path: currentPath,
                                        position: `key-${items.length + 1}`
                                    }
                                });
                            } else if (typeof value === 'object' && value !== null) {
                                traverseObject(value, currentPath);
                            }
                        }
                    }
                }
                
                traverseObject(json);
                
            } catch (error) {
                throw new Error('JSON解析错误: ' + error.message);
            }
            
            return items;
        }
        
        // 解析文本文件（备用方法）
        function parseTextFile(content, fileName) {
            const items = [];
            
            // 按行分割
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // 忽略空行
                if (line.length === 0) continue;
                
                items.push({
                    id: `text-${i + 1}`,
                    sourceText: line,
                    targetText: '',
                    context: `Text line ${i + 1}`,
                    status: 'pending',
                    qualityScore: 0,
                    issues: [],
                    metadata: { 
                        file: fileName, 
                        position: `line-${i + 1}`
                    }
                });
            }
            
            return items;
        }

        // 更新文件树
        function updateFileTree(files) {
            console.log('updateFileTree 被调用', { files, project: AppState.project });
            const fileTree = document.getElementById('fileTree');
            
            // 如果有新上传的文件，直接处理
            let uploadedFiles = [];
            if (files && files.length > 0) {
                uploadedFiles = Array.from(files);
            }
            
            // 如果没有项目或翻译项，且没有新上传的文件，显示提示
            if ((!AppState.project || !AppState.project.translationItems.length) && uploadedFiles.length === 0) {
                console.log('没有项目或翻译项，显示默认提示');
                const li = document.createElement('li');
                li.className = 'text-gray-500 dark:text-gray-400 text-sm italic p-4 text-center';
                li.textContent = '暂无文件';
                fileTree.replaceChildren(li);
                return;
            }
            
            // 提取唯一的文件名
            const uniqueFiles = new Set();
            
            // 添加新上传的文件
            uploadedFiles.forEach(file => {
                uniqueFiles.add(file.name);

                // 立即保存 size 等基础元数据，确保文件树能显示“文件大小”
                const extension = file.name.split('.').pop().toLowerCase();
                if (!AppState.fileMetadata[file.name]) {
                    AppState.fileMetadata[file.name] = {
                        size: file.size,
                        lastModified: file.lastModified,
                        type: file.type || 'text/plain',
                        extension
                    };
                } else if (typeof AppState.fileMetadata[file.name].size !== 'number' && typeof file.size === 'number') {
                    AppState.fileMetadata[file.name].size = file.size;
                }
            });
            
            // 添加现有项目中的文件
            if (AppState.project) {
                AppState.project.translationItems.forEach(item => {
                    if (item.metadata && item.metadata.file) {
                        uniqueFiles.add(item.metadata.file);
                    }
                });
            }
            
            console.log('提取到的唯一文件名:', Array.from(uniqueFiles));
            
            // 如果没有文件名，显示默认文件
            if (uniqueFiles.size === 0) {
                uniqueFiles.add('default.xml');

                // 占位示例文件：确保大小展示稳定
                if (!AppState.fileMetadata['default.xml']) {
                    AppState.fileMetadata['default.xml'] = {
                        size: 0,
                        lastModified: Date.now(),
                        type: 'text/xml',
                        extension: 'xml'
                    };
                } else if (typeof AppState.fileMetadata['default.xml'].size !== 'number') {
                    AppState.fileMetadata['default.xml'].size = 0;
                }
            }
            
            const fragment = document.createDocumentFragment();
            uniqueFiles.forEach(filename => {
                const extension = filename.split('.').pop().toLowerCase();
                let icon = 'fa-file';
                
                // 根据文件类型选择图标
                if (extension === 'xml') icon = 'fa-file-code-o';
                else if (extension === 'json') icon = 'fa-file-code-o';
                else if (extension === 'xliff') icon = 'fa-file-text-o';
                else if (extension === 'strings') icon = 'fa-file-text-o';
                else if (extension === 'resx') icon = 'fa-file-text-o';
                else if (extension === 'po') icon = 'fa-file-text-o';
                
                const li = document.createElement('li');
                li.className = 'mb-1';

                const row = document.createElement('div');
                row.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer';
                row.dataset.filename = filename;

                const iconEl = document.createElement('i');
                iconEl.className = `fa ${icon} text-gray-500 dark:text-gray-400 mr-2`;

                const nameEl = document.createElement('span');
                nameEl.className = 'text-sm truncate text-gray-800 dark:text-gray-100';
                nameEl.textContent = filename;

                const sizeEl = document.createElement('span');
                sizeEl.className = 'ml-auto text-xs text-gray-400 dark:text-gray-500';
                sizeEl.textContent = getFileSize(filename);

                row.appendChild(iconEl);
                row.appendChild(nameEl);
                row.appendChild(sizeEl);
                li.appendChild(row);
                fragment.appendChild(li);
            });

            fileTree.replaceChildren(fragment);
        }
        
        // 获取文件大小（从 AppState 获取）
        function getFileSize(filename) {
            // 从 AppState.fileMetadata 中获取文件大小
            if (AppState.fileMetadata[filename] && typeof AppState.fileMetadata[filename].size === 'number') {
                const bytes = AppState.fileMetadata[filename].size;
                return formatFileSize(bytes);
            }

            // 没有 size 元数据时，不再回退到“项数”，避免误导
            return '—';
        }
        
        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        }

        // 根据文件过滤翻译项
        function filterTranslationItemsByFile(filename) {
            // 显示通知
            showNotification('info', '文件选中', `已选择文件: ${filename}`);
            
            // 过滤当前项目的翻译项
            AppState.translations.filtered = AppState.project.translationItems.filter(item =>
                item.metadata?.file === filename
            );
            
            // 重置到第一页
            AppState.translations.currentPage = 1;
            
            // 更新翻译列表
            updateTranslationLists();
        }

        // ==================== 性能优化工具函数 ====================
        // 优化目标：
        // 1. 减少高频DOM查询：使用DOMCache缓存常用DOM元素
        // 2. 减少频繁函数调用：使用debounce/throttle限制syncTranslationHeights调用
        // 3. 优化渲染性能：使用requestAnimationFrame和批量读写分离
        // 4. 分页显示：每页itemsPerPage条，避免一次渲染过多DOM
        // 5. 使用DocumentFragment批量插入减少重排
                
        // 注意：debounce 和 throttle 已在文件开头统一定义，这里不再重复
        
        // 更新同步高度函数（优化版 - 使用防抖和缓存）
        function syncTranslationHeights() {
            try {
                // 移动端使用合并列表，不需要双列高度同步
                if (window.innerWidth < 768) {
                    return;
                }

                const sourceItems = document.querySelectorAll('#sourceList .responsive-translation-item');
                const targetItems = document.querySelectorAll('#targetList .responsive-translation-item');
                
                if (sourceItems.length !== targetItems.length || sourceItems.length === 0) {
                    return;
                }
                
                // 获取屏幕尺寸以确定最小高度
                const isMobile = window.innerWidth < 768;
                const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
                const isLandscape = window.matchMedia("(orientation: landscape)").matches;
                
                let baseMinHeight = 60;
                
                if (isMobile) {
                    baseMinHeight = 70;
                } else if (isTablet) {
                    baseMinHeight = 80;
                } else {
                    baseMinHeight = 90;
                }
                
                // 横屏且高度有限的情况
                if (isLandscape && window.innerHeight < 600) {
                    baseMinHeight = 50;
                }
                
                // 使用 requestAnimationFrame 和批量读写分离减少重排
                requestAnimationFrame(() => {
                    const heights = [];
                    
                    sourceItems.forEach((sourceItem, index) => {
                        const targetItem = targetItems[index];
                        if (!sourceItem || !targetItem) return;
                        
                        const sourceContent = sourceItem.querySelector('.item-content');
                        const targetContent = targetItem.querySelector('textarea') || 
                                             targetItem.querySelector('.item-content');
                        
                        if (!sourceContent || !targetContent) return;
                        
                        const sourceHeight = Math.max(sourceContent.scrollHeight, baseMinHeight);
                        const targetHeight = Math.max(targetContent.scrollHeight, baseMinHeight);
                        const maxHeight = Math.max(sourceHeight, targetHeight);
                        
                        heights.push({ sourceItem, targetItem, sourceContent, targetContent, maxHeight });
                    });
                    
                    heights.forEach(({ sourceItem, targetItem, sourceContent, targetContent, maxHeight }) => {
                        sourceItem.style.height = maxHeight + 'px';
                        targetItem.style.height = maxHeight + 'px';
                        
                        if (sourceContent.style) {
                            sourceContent.style.minHeight = maxHeight + 'px';
                        }
                        if (targetContent.style) {
                            targetContent.style.minHeight = maxHeight + 'px';
                        }
                    });
                });
                
            } catch (error) {
                console.error('同步高度时出错:', error);
            }
        }
        
        // 创建防抖版本的同步函数（300ms防抖）
        const debouncedSyncHeights = debounce(syncTranslationHeights, 300);
        
        // 创建节流版本的同步函数（100ms节流）
        const throttledSyncHeights = throttle(syncTranslationHeights, 100);

        // ==================== 翻译列表更新功能（优化版） ====================
        
        // 获取状态样式类
        function getStatusClass(status) {
            const statusMap = {
                'pending': 'text-gray-500 dark:text-gray-400',
                'translated': 'text-green-600 dark:text-emerald-400',
                'edited': 'text-blue-600 dark:text-blue-400',
                'approved': 'text-purple-600 dark:text-purple-400'
            };
            return statusMap[status] || 'text-gray-500 dark:text-gray-400';
        }
        
        // 创建翻译项 DOM 元素（使用事件委托，不再单独绑定）
        function createTranslationItemElement(item, originalIndex, isPrimarySelected, isSource) {
            const div = document.createElement('div');
            const isMultiSelected = (AppState.translations.multiSelected || []).includes(originalIndex);
            const isSelected = isPrimarySelected || isMultiSelected;

            if (isSource) {
                if (AppState.ui.sourceSelectionIndicatorEnabled) {
                    const unselectedIsTransparent = AppState.ui.sourceSelectionIndicatorUnselectedStyle === 'transparent';
                    div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 border-l-4 ${
                        isSelected
                            ? 'border-l-blue-600 dark:border-l-blue-500 selected bg-blue-50 dark:bg-blue-900/20'
                            : (unselectedIsTransparent ? 'border-l-transparent dark:border-l-transparent' : 'border-l-gray-300 dark:border-l-gray-600')
                    } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors`;
                } else {
                    div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
                        isSelected ? 'selected bg-blue-50 dark:bg-blue-900/20' : ''
                    }`;
                }
            } else {
                div.className = `responsive-translation-item border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
                    isSelected ? 'selected bg-blue-50 dark:bg-blue-900/20' : ''
                }`;
            }
            div.dataset.index = originalIndex;
            
            const statusClass = getStatusClass(item.status);
            const sourceText = item.sourceText || '';
            const targetText = item.targetText || '';
            const context = item.context || '';
            
            // 获取搜索关键词（从 AppState）
            const searchQuery = AppState.translations.searchQuery;
            
            if (isSource) {
                // 源文列表
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-stretch w-full h-full';

                const left = document.createElement('div');
                left.className = 'flex-1 min-w-0';

                const contentEl = document.createElement('div');
                contentEl.className = 'item-content border border-transparent rounded flex flex-col';

                const p = document.createElement('p');
                p.className = 'text-sm md:text-base font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100';
                const highlighted = highlightText(sourceText, searchQuery);
                p.appendChild(highlighted);
                contentEl.appendChild(p);

                if (context) {
                    const p2 = document.createElement('p');
                    p2.className = 'text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 break-words';
                    p2.textContent = context;
                    contentEl.appendChild(p2);
                }

                if (item.metadata?.resourceId) {
                    const p3 = document.createElement('p');
                    p3.className = 'text-xs text-gray-400 dark:text-gray-500 mt-1 break-words';
                    p3.textContent = `ID: ${item.metadata.resourceId}`;
                    contentEl.appendChild(p3);
                }

                left.appendChild(contentEl);

                const right = document.createElement('div');
                right.className = 'flex flex-col items-end ml-2';
                const status = document.createElement('span');
                status.className = `text-xs font-semibold ${statusClass} px-2 py-0.5 rounded-full whitespace-nowrap`;
                status.textContent = getStatusText(item.status);
                right.appendChild(status);

                wrapper.appendChild(left);
                wrapper.appendChild(right);
                div.appendChild(wrapper);
            } else {
                // 译文列表
                const textarea = document.createElement('textarea');
                textarea.className = `w-full h-full border ${isPrimarySelected ? 'border-blue-500' : 'border-transparent'} rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none break-words bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`;
                textarea.dataset.index = originalIndex;
                textarea.style.fontFamily = 'inherit';
                textarea.value = targetText;
                
                // 不再单独绑定事件，使用事件委托
                
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-stretch w-full h-full';
                const left = document.createElement('div');
                left.className = 'flex-1 min-w-0';
                const contentEl = document.createElement('div');
                contentEl.className = 'item-content h-full';
                contentEl.appendChild(textarea);
                left.appendChild(contentEl);
                wrapper.appendChild(left);
                div.appendChild(wrapper);
            }
            
            // 不再单独绑定点击事件，使用事件委托
            
            return div;
        }

        // 创建移动端合并翻译项（原文 + 可编辑译文同一条）
        function createMobileCombinedTranslationItemElement(item, originalIndex, isPrimarySelected) {
            const div = document.createElement('div');
            const isMultiSelected = (AppState.translations.multiSelected || []).includes(originalIndex);
            const isSelected = isPrimarySelected || isMultiSelected;
            div.className = `responsive-translation-item border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors p-2 ${
                isSelected ? 'selected bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`;
            div.dataset.index = originalIndex;

            const statusClass = getStatusClass(item.status);
            const sourceText = item.sourceText || '';
            const targetText = item.targetText || '';
            const context = item.context || '';
            const searchQuery = AppState.translations.searchQuery;

            const hasExtraInfo = !!(context || item.metadata?.resourceId);

            const top = document.createElement('div');
            top.className = 'flex items-start justify-between gap-2';

            const left = document.createElement('div');
            left.className = 'min-w-0 flex-1';

            const p = document.createElement('p');
            p.className = 'text-sm font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100';
            p.appendChild(highlightText(sourceText, searchQuery));
            left.appendChild(p);

            let extra = null;
            if (hasExtraInfo) {
                extra = document.createElement('div');
                extra.className = 'mt-1 hidden';
                extra.dataset.role = 'extra';

                if (context) {
                    const p2 = document.createElement('p');
                    p2.className = 'text-xs text-gray-500 dark:text-gray-400 break-words';
                    p2.textContent = context;
                    extra.appendChild(p2);
                }

                if (item.metadata?.resourceId) {
                    const p3 = document.createElement('p');
                    p3.className = 'text-xs text-gray-400 dark:text-gray-500 mt-1 break-words';
                    p3.textContent = `ID: ${item.metadata.resourceId}`;
                    extra.appendChild(p3);
                }

                left.appendChild(extra);
            }

            const right = document.createElement('div');
            right.className = 'flex flex-col items-end gap-1';
            const status = document.createElement('span');
            status.className = `text-xs font-semibold ${statusClass} px-2 py-0.5 rounded-full whitespace-nowrap`;
            status.textContent = getStatusText(item.status);
            right.appendChild(status);

            if (hasExtraInfo) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-full text-right';
                btn.dataset.action = 'toggle-extra';
                btn.dataset.state = 'collapsed';
                btn.textContent = '更多';
                right.appendChild(btn);
            }

            top.appendChild(left);
            top.appendChild(right);

            const bottom = document.createElement('div');
            bottom.className = 'mt-2';
            const textarea = document.createElement('textarea');
            textarea.className = `w-full border ${isPrimarySelected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'} rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none break-words bg-white dark:bg-gray-900 p-2 text-sm text-gray-900 dark:text-gray-100`;
            textarea.dataset.index = String(originalIndex);
            textarea.rows = 3;
            textarea.value = targetText;
            bottom.appendChild(textarea);

            div.appendChild(top);
            div.appendChild(bottom);

            return div;
        }
        
        // 创建空状态元素
        function createEmptyStateElement(message) {
            const div = document.createElement('div');
            div.className = 'text-gray-500 dark:text-gray-400 text-sm italic p-4 text-center';
            div.textContent = message;
            return div;
        }
        
        // 更新翻译列表（优化版 - 使用DOM缓存）
        function updateTranslationLists() {
            console.log('更新翻译列表开始');
            
            try {
                // 直接使用 DOMCache 获取元素
                const sourceList = DOMCache.get('sourceList');
                const targetList = DOMCache.get('targetList');
                const mobileCombinedList = DOMCache.get('mobileCombinedList');
                const isMobile = window.innerWidth < 768;
                
                if (isMobile) {
                    if (!mobileCombinedList) {
                        console.error('移动端合并列表元素未找到');
                        return;
                    }
                } else {
                    if (!sourceList || !targetList) {
                        console.error('源列表或目标列表元素未找到');
                        return;
                    }
                }

                // 检查数据
                if (!AppState.project?.translationItems?.length) {
                    console.log('没有翻译项数据');
                    if (sourceList) {
                        sourceList.replaceChildren(createEmptyStateElement('暂无翻译项'));
                    }
                    if (targetList) {
                        targetList.replaceChildren(createEmptyStateElement('暂无翻译项'));
                    }
                    if (mobileCombinedList) {
                        mobileCombinedList.replaceChildren(createEmptyStateElement('暂无翻译项'));
                    }
                    updatePaginationUI(0, 0, 0, 1, 1);
                    return;
                }

                // 计算分页（使用 AppState）
                const itemsPerPage = AppState.translations.itemsPerPage;
                const currentPage = AppState.translations.currentPage;
                let filteredItems = AppState.translations.filtered;
                const translationItems = AppState.translations.items;
                
                // 使用 filteredItems
                if (filteredItems.length === 0 && translationItems.length > 0) {
                    filteredItems = [...translationItems];
                    AppState.translations.filtered = filteredItems;
                }
                
                const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
                const itemsToShow = filteredItems.slice(startIndex, endIndex);
                
                console.log('当前页:', currentPage, '总页数:', totalPages, '显示范围:', startIndex + 1, '-', endIndex);
                
                // 使用 DocumentFragment 提高性能
                const sourceFragment = document.createDocumentFragment();
                const targetFragment = document.createDocumentFragment();
                const mobileFragment = document.createDocumentFragment();
                
                if (itemsToShow.length === 0) {
                    sourceFragment.appendChild(createEmptyStateElement('没有找到匹配的翻译项'));
                    targetFragment.appendChild(createEmptyStateElement('没有找到匹配的翻译项'));
                    mobileFragment.appendChild(createEmptyStateElement('没有找到匹配的翻译项'));
                } else {
                    itemsToShow.forEach(item => {
                        if (!item) return;
                        
                        const originalIndex = AppState.project.translationItems.indexOf(item);
                        const isPrimarySelected = originalIndex === AppState.translations.selected;
                        
                        sourceFragment.appendChild(createTranslationItemElement(item, originalIndex, isPrimarySelected, true));
                        targetFragment.appendChild(createTranslationItemElement(item, originalIndex, isPrimarySelected, false));
                        mobileFragment.appendChild(createMobileCombinedTranslationItemElement(item, originalIndex, isPrimarySelected));
                    });
                }
                
                // 一次性更新 DOM（清空后添加）
                console.log('DOM更新开始');
                if (sourceList) {
                    sourceList.replaceChildren(sourceFragment);
                }
                if (targetList) {
                    targetList.replaceChildren(targetFragment);
                }
                if (mobileCombinedList) {
                    mobileCombinedList.replaceChildren(mobileFragment);
                }

                if (isMobile && mobileCombinedList && AppState.translations.selected !== -1) {
                    const selectedEl = mobileCombinedList.querySelector(`.responsive-translation-item[data-index="${AppState.translations.selected}"]`);
                    if (selectedEl) {
                        selectedEl.scrollIntoView({ block: 'center' });
                    }
                }
                
                // 更新分页
                updatePaginationUI(filteredItems.length, startIndex + 1, endIndex, currentPage, totalPages);
                
                // 翻页/过滤后立即同步高度，避免延迟导致布局抖动
                syncTranslationHeights();
                
                console.log('翻译列表更新完成');
            } catch (error) {
                console.error('更新翻译列表时出错:', error);
                const sourceList = DOMCache.get('sourceList');
                const targetList = DOMCache.get('targetList');
                const errorText = `错误: ${(error && error.message) ? error.message : String(error)}`;
                if (sourceList) {
                    const el = document.createElement('div');
                    el.className = 'text-red-500 dark:text-red-300 p-4';
                    el.textContent = errorText;
                    sourceList.replaceChildren(el);
                }
                if (targetList) {
                    const el = document.createElement('div');
                    el.className = 'text-red-500 dark:text-red-300 p-4';
                    el.textContent = errorText;
                    targetList.replaceChildren(el);
                }
                updatePaginationUI(0, 0, 0, 1, 1);
            }
        }
        
        // 高亮文本中的搜索关键词
        function highlightText(text, searchQuery) {
            const fragment = document.createDocumentFragment();
            const rawText = (text === null || text === undefined) ? '' : String(text);
            const rawQuery = (searchQuery === null || searchQuery === undefined) ? '' : String(searchQuery);
            const query = rawQuery.trim();

            if (!query) {
                fragment.appendChild(document.createTextNode(rawText));
                return fragment;
            }

            const haystack = rawText;
            const needle = query;
            const haystackLower = haystack.toLowerCase();
            const needleLower = needle.toLowerCase();

            let pos = 0;
            while (pos < haystack.length) {
                const idx = haystackLower.indexOf(needleLower, pos);
                if (idx === -1) {
                    fragment.appendChild(document.createTextNode(haystack.slice(pos)));
                    break;
                }

                if (idx > pos) {
                    fragment.appendChild(document.createTextNode(haystack.slice(pos, idx)));
                }

                const mark = document.createElement('mark');
                mark.className = 'bg-yellow-200 text-gray-900 dark:bg-yellow-900 dark:text-yellow-200 px-0.5 rounded';
                mark.textContent = haystack.slice(idx, idx + needle.length);
                fragment.appendChild(mark);

                pos = idx + needle.length;
            }

            return fragment;
        }
        
        // 查找第一个匹配的翻译项
        function findFirstMatchingItem(searchQuery) {
            try {
                if (!AppState.project || !Array.isArray(AppState.project.translationItems) || !searchQuery) {
                    return -1;
                }
                
                console.log('在', AppState.project.translationItems.length, '个翻译项中查找:', searchQuery);
                
                for (let i = 0; i < AppState.project.translationItems.length; i++) {
                    const item = AppState.project.translationItems[i];
                    if (!item) continue;
                    
                    // 搜索原文、译文、上下文和元数据（包括resourceId）
                    const sourceText = (item.sourceText || '').toLowerCase();
                    const targetText = (item.targetText || '').toLowerCase();
                    const context = (item.context || '').toLowerCase();
                    const metadata = item.metadata || {};
                    const resourceId = (metadata.resourceId || '').toLowerCase();
                    
                    const isMatch = sourceText.includes(searchQuery) || 
                                  targetText.includes(searchQuery) || 
                                  context.includes(searchQuery) ||
                                  resourceId.includes(searchQuery);
                    
                    if (isMatch) {
                        console.log('找到匹配项:', i, item.sourceText, item.metadata?.resourceId);
                        return i;
                    }
                }
                
                console.log('未找到匹配项');
                return -1;
            } catch (error) {
                console.error('查找匹配项时出错:', error);
                return -1;
            }
        }
        
        // 显示搜索结果面板
        // 显示文件搜索结果（只搜索文件名）
        function showFileSearchResults(searchQuery) {
            try {
                const searchResultsPanel = document.getElementById('searchResultsPanel');
                const searchResultsList = document.getElementById('searchResultsList');
                const searchResultsFooter = document.getElementById('searchResultsFooter');
                const searchResultsCount = document.getElementById('searchResultsCount');

                if (!searchResultsPanel || !searchResultsList) return;
                
                // 如果搜索查询为空，隐藏结果面板
                if (!searchQuery || searchQuery.trim() === '') {
                    searchResultsPanel.classList.add('hidden');
                    return;
                }
                
                // 提取唯一的文件名
                const uniqueFiles = new Set();
                if (AppState.project && AppState.project.translationItems) {
                    AppState.project.translationItems.forEach(item => {
                        if (item.metadata && item.metadata.file) {
                            uniqueFiles.add(item.metadata.file);
                        }
                    });
                }
                
                // 搜索匹配的文件
                const query = searchQuery.toLowerCase().trim();
                const matchingFiles = Array.from(uniqueFiles).filter(filename => 
                    filename.toLowerCase().includes(query)
                );
                
                console.log('文件搜索结果数量:', matchingFiles.length);
                
                // 更新结果数量
                if (searchResultsCount) {
                    searchResultsCount.textContent = matchingFiles.length;
                }
                
                // 生成结果列表HTML
                if (matchingFiles.length === 0) {
                    const div = document.createElement('div');
                    div.className = 'px-4 py-3 text-gray-500 dark:text-gray-400 text-sm';
                    div.textContent = `没有找到包含"${query}"的文件`;
                    searchResultsList.replaceChildren(div);
                } else {
                    const fragment = document.createDocumentFragment();
                    matchingFiles.forEach((filename, index) => {
                        const extension = filename.split('.').pop().toLowerCase();
                        let icon = 'fa-file';
                        
                        // 根据文件类型选择图标
                        if (extension === 'xml') icon = 'fa-file-code-o';
                        else if (extension === 'json') icon = 'fa-file-code-o';
                        else if (extension === 'xliff') icon = 'fa-file-text-o';
                        else if (extension === 'strings') icon = 'fa-file-text-o';
                        else if (extension === 'resx') icon = 'fa-file-text-o';
                        else if (extension === 'po') icon = 'fa-file-text-o';
                        
                        const item = document.createElement('div');
                        item.className = 'file-search-result-item px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors';
                        item.dataset.filename = filename;

                        const row = document.createElement('div');
                        row.className = 'flex items-center';

                        const iconEl = document.createElement('i');
                        iconEl.className = `fa ${icon} text-gray-500 dark:text-gray-400 mr-2`;

                        const flex = document.createElement('div');
                        flex.className = 'flex-1';
                        const p = document.createElement('p');
                        p.className = 'text-sm';
                        p.appendChild(highlightText(filename, query));
                        flex.appendChild(p);

                        const count = document.createElement('span');
                        count.className = 'text-xs text-gray-400 ml-2';
                        count.textContent = `${index + 1}/${matchingFiles.length}`;

                        row.appendChild(iconEl);
                        row.appendChild(flex);
                        row.appendChild(count);
                        item.appendChild(row);
                        fragment.appendChild(item);
                    });

                    searchResultsList.replaceChildren(fragment);
                }
                
                // 显示结果面板
                searchResultsPanel.classList.remove('hidden');
                if (searchResultsFooter) {
                    searchResultsFooter.classList.remove('hidden');
                }
                
            } catch (error) {
                console.error('显示文件搜索结果时出错:', error);
            }
        }
        
        // 跳转到搜索结果
        function navigateToSearchResult(index) {
            try {
                console.log('跳转到搜索结果索引:', index);
                
                // 隐藏搜索结果面板
                const searchResultsPanel = document.getElementById('searchResultsPanel');
                searchResultsPanel.classList.add('hidden');
                
                // 选择对应的翻译项
                selectTranslationItem(index);
                
                // 显示成功通知
                const item = AppState.project.translationItems[index];
                if (item) {
                    showNotification('success', '跳转成功', `已跳转到: ${truncateText(item.sourceText, 30)}`);
                }
                
            } catch (error) {
                console.error('跳转到搜索结果时出错:', error);
                showNotification('error', '跳转失败', '无法跳转到指定的翻译项');
            }
        }
        
        // 处理搜索回车键
        function handleSearchEnter() {
            try {
                console.log('=== 开始处理搜索回车 ===');
                
                const searchInput = document.getElementById('searchInput');
                const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
                
                console.log('搜索查询:', searchQuery);
                console.log('当前项目状态:', AppState.project ? '存在' : '不存在');
                console.log('翻译项数量:', AppState.project ? AppState.project.translationItems.length : 0);
                
                if (!searchQuery) {
                    console.log('搜索查询为空，不执行跳转');
                    showNotification('info', '搜索提示', '请输入搜索关键词');
                    return;
                }
                
                if (!AppState.project || !AppState.project.translationItems || AppState.project.translationItems.length === 0) {
                    console.log('没有可用的翻译项进行搜索');
                    showNotification('warning', '无翻译项', '请先上传文件或创建项目');
                    return;
                }
                
                // 查找第一个匹配的翻译项
                const matchIndex = findFirstMatchingItem(searchQuery);
                
                console.log('查找结果索引:', matchIndex);
                
                if (matchIndex !== -1) {
                    console.log('找到匹配项，选择索引:', matchIndex);
                    console.log('匹配项内容:', AppState.project.translationItems[matchIndex]);
                    
                    // 跳转到匹配的翻译项
                    navigateToSearchResult(matchIndex);
                } else {
                    console.log('未找到匹配项');
                    showNotification('warning', '未找到匹配项', `没有找到包含"${searchQuery}"的翻译项`);
                }
            } catch (error) {
                console.error('处理搜索回车时出错:', error);
                console.error('错误堆栈:', error.stack);
                showNotification('error', '搜索错误', `执行搜索跳转时发生错误: ${error.message}`);
            }
        }
        
        // 滚动到指定的翻译项
        function scrollToItem(index) {
            try {
                // 移动端：滚动合并列表
                if (window.innerWidth < 768) {
                    const mobileCombinedList = document.getElementById('mobileCombinedList');
                    if (!mobileCombinedList) {
                        console.error('移动端滚动目标元素未找到');
                        return;
                    }

                    setTimeout(() => {
                        const mobileItem = mobileCombinedList.querySelector(`[data-index="${index}"]`);
                        if (mobileItem) {
                            mobileItem.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    }, 50);

                    return;
                }

                const sourceList = document.getElementById('sourceList');
                const targetList = document.getElementById('targetList');
                
                if (!sourceList || !targetList) {
                    console.error('滚动目标元素未找到');
                    return;
                }
                
                console.log('尝试滚动到索引:', index);
                
                // 等待DOM更新完成
                setTimeout(() => {
                    const sourceItem = sourceList.querySelector(`[data-index="${index}"]`);
                    const targetItem = targetList.querySelector(`[data-index="${index}"]`);
                    
                    console.log('找到滚动目标:', !!sourceItem, !!targetItem);
                    
                    if (sourceItem) {
                        // 先确保元素在视口中
                        sourceItem.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                    
                    if (targetItem) {
                        // 先确保元素在视口中
                        targetItem.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }, 50);
                
            } catch (error) {
                console.error('滚动到翻译项时出错:', error);
            }
        }
        
        // 应用搜索过滤
        // 应用搜索过滤（优化版 - 添加缓存机制）
        let searchCache = new Map(); // 搜索结果缓存
        let lastSearchQuery = ''; // 上次搜索查询
        
        function applySearchFilter() {
            try {
                if (!AppState.project || !AppState.project.translationItems || AppState.project.translationItems.length === 0) {
                    AppState.translations.filtered = [];
                    return;
                }

                const searchQuery = (AppState.translations.searchQuery || '').toString();
                
                if (!searchQuery.trim()) {
                    // 如果没有搜索查询，显示所有翻译项
                    AppState.translations.filtered = [...AppState.project.translationItems];
                    searchCache.clear();
                    lastSearchQuery = '';
                } else {
                    const query = searchQuery.toLowerCase().trim();
                    
                    let filteredItems;
                    // 检查缓存
                    if (searchCache.has(query)) {
                        filteredItems = searchCache.get(query);
                        console.log('使用缓存的搜索结果:', filteredItems.length);
                    } else {
                        // 应用搜索过滤
                        filteredItems = AppState.project.translationItems.filter(item => {
                            if (!item) return false;
                            
                            // 搜索原文、译文、上下文和元数据（包括resourceId）
                            const sourceText = (item.sourceText || '').toLowerCase();
                            const targetText = (item.targetText || '').toLowerCase();
                            const context = (item.context || '').toLowerCase();
                            const metadata = item.metadata || {};
                            const resourceId = (metadata.resourceId || '').toLowerCase();
                            
                            return sourceText.includes(query) || 
                                   targetText.includes(query) || 
                                   context.includes(query) ||
                                   resourceId.includes(query);
                        });
                        
                        // 缓存结果（最多缓存50条）
                        if (searchCache.size >= 50) {
                            // 删除最旧的缓存
                            const firstKey = searchCache.keys().next().value;
                            searchCache.delete(firstKey);
                        }
                        searchCache.set(query, filteredItems);
                    }
                    
                    AppState.translations.filtered = filteredItems;
                    lastSearchQuery = query;
                }
                
                console.log('搜索过滤完成，结果数量:', AppState.translations.filtered.length);
                
                // 重置到第一页
                AppState.translations.currentPage = 1;
            } catch (error) {
                console.error('应用搜索过滤时出错:', error);
                AppState.translations.filtered = AppState.project ? [...AppState.project.translationItems] : [];
            }
        }
        
        // 更新分页UI
        function updatePaginationUI(totalItems, startRange, endRange, currentPage, totalPages) {
            const sourcePagination = document.getElementById('sourcePagination');
            const targetPagination = document.getElementById('targetPagination');
            const itemsPerPage = AppState.translations.itemsPerPage; // 使用 AppState 中的设置
            
            try {
                // 更新源文本分页信息
                const sourceStartRange = document.getElementById('sourceStartRange');
                const sourceEndRange = document.getElementById('sourceEndRange');
                const sourceTotalItems = document.getElementById('sourceTotalItems');
                const sourcePageInfo = document.getElementById('sourcePageInfo');
                
                if (sourceStartRange) sourceStartRange.textContent = totalItems > 0 ? startRange : 0;
                if (sourceEndRange) sourceEndRange.textContent = totalItems > 0 ? endRange : 0;
                if (sourceTotalItems) sourceTotalItems.textContent = totalItems;
                if (sourcePageInfo) sourcePageInfo.textContent = `第 ${currentPage} 页`;
                
                // 更新分页按钮状态
                const sourcePrevBtn = document.getElementById('sourcePrevBtn');
                const sourceNextBtn = document.getElementById('sourceNextBtn');
                
                if (sourcePrevBtn) sourcePrevBtn.disabled = currentPage === 1;
                if (sourceNextBtn) sourceNextBtn.disabled = currentPage === totalPages;
                
                // 显示或隐藏分页控件
                const paginationContainer = document.getElementById('paginationContainer');
                console.log(`分页信息: 总项数=${totalItems}, 每页项数=${itemsPerPage}, 是否显示=${totalItems > itemsPerPage}`);

                if (paginationContainer) {
                    if (totalItems > itemsPerPage) {
                        paginationContainer.classList.remove('hidden');
                    } else {
                        paginationContainer.classList.add('hidden');
                    }
                }
            } catch (error) {
                console.error('更新分页UI时出错:', error);
            }
        }
        
        // 处理搜索输入（只搜索文件，不影响翻译列表）
        function handleSearchInput() {
            const input = DOMCache.get('searchInput') || document.getElementById('searchInput');
            if (!input) return;
            const searchQuery = input.value;
            
            // 只显示文件搜索结果面板，不更新翻译列表
            showFileSearchResults(searchQuery);
        }
        
        // 处理分页导航
        function handlePagination(direction) {
            try {
                console.log('分页导航开始，方向:', direction);
                console.log('当前页:', AppState.translations.currentPage);
                console.log('过滤后项目数:', AppState.translations.filtered.length);
                
                const itemsPerPage = AppState.translations.itemsPerPage;
                const filteredItems = AppState.translations.filtered;
                const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
                console.log('总页数:', totalPages);
                
                if (direction === 'prev' && AppState.translations.currentPage > 1) {
                    AppState.translations.currentPage--;
                    console.log('切换到上一页，新页码:', AppState.translations.currentPage);
                } else if (direction === 'next' && AppState.translations.currentPage < totalPages) {
                    AppState.translations.currentPage++;
                    console.log('切换到下一页，新页码:', AppState.translations.currentPage);
                } else {
                    console.log('无法切换页面，已到达边界');
                }
                
                updateTranslationLists();
            } catch (error) {
                console.error('处理分页导航时出错:', error);
                showNotification('error', '分页错误', '切换页面时发生错误');
            }
        }

        function updateSelectionStyles() {
            const options = arguments.length > 0 && arguments[0] ? arguments[0] : {};
            const shouldScroll = options.shouldScroll !== false;
            const shouldFocusTextarea = options.shouldFocusTextarea !== false;

            const isMobile = window.innerWidth < 768;
            const primaryIndex = AppState.translations.selected;
            const selectedSet = new Set(AppState.translations.multiSelected || []);
            if (primaryIndex !== -1) selectedSet.add(primaryIndex);

            if (!isMobile) {
                const sourceItems = document.querySelectorAll('#sourceList .responsive-translation-item');
                const targetItems = document.querySelectorAll('#targetList .responsive-translation-item');

                sourceItems.forEach((item) => {
                    const idx = parseInt(item.dataset.index);
                    const active = selectedSet.has(idx);
                    item.classList.toggle('selected', active);
                    item.classList.toggle('bg-blue-50', active);
                    item.classList.toggle('dark:bg-blue-900/20', active);

                    item.classList.remove(
                        'border-l-4',
                        'border-l-blue-600',
                        'dark:border-l-blue-500',
                        'border-l-gray-300',
                        'dark:border-l-gray-600',
                        'border-l-transparent',
                        'dark:border-l-transparent'
                    );

                    if (AppState.ui.sourceSelectionIndicatorEnabled) {
                        const unselectedIsTransparent = AppState.ui.sourceSelectionIndicatorUnselectedStyle === 'transparent';
                        item.classList.add('border-l-4');

                        if (active) {
                            item.classList.add('border-l-blue-600', 'dark:border-l-blue-500');
                        } else {
                            if (unselectedIsTransparent) {
                                item.classList.add('border-l-transparent', 'dark:border-l-transparent');
                            } else {
                                item.classList.add('border-l-gray-300', 'dark:border-l-gray-600');
                            }
                        }
                    }
                    if (active && idx === primaryIndex && shouldScroll) {
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });

                targetItems.forEach((item) => {
                    const idx = parseInt(item.dataset.index);
                    const active = selectedSet.has(idx);
                    item.classList.toggle('selected', active);
                    item.classList.toggle('bg-blue-50', active);
                    item.classList.toggle('dark:bg-blue-900/20', active);

                    const textarea = item.querySelector('textarea');
                    if (textarea) {
                        if (idx === primaryIndex) {
                            textarea.classList.remove('border-transparent');
                            textarea.classList.add('border-blue-500');
                            if (shouldFocusTextarea) {
                                textarea.focus();
                            }
                        } else {
                            textarea.classList.remove('border-blue-500');
                            textarea.classList.add('border-transparent');
                        }
                    }
                });
            } else {
                const mobileItems = document.querySelectorAll('#mobileCombinedList .responsive-translation-item');
                mobileItems.forEach((item) => {
                    const idx = parseInt(item.dataset.index);
                    const active = selectedSet.has(idx);
                    item.classList.toggle('selected', active);
                    item.classList.toggle('bg-blue-50', active);
                    item.classList.toggle('border-blue-300', active);
                    item.classList.toggle('dark:bg-blue-900/20', active);
                    item.classList.toggle('dark:border-blue-700', active);
                    item.classList.toggle('bg-white', !active);
                    item.classList.toggle('dark:bg-gray-800', !active);

                    const textarea = item.querySelector('textarea');
                    if (textarea) {
                        if (idx === primaryIndex) {
                            textarea.classList.remove('border-gray-200', 'dark:border-gray-700');
                            textarea.classList.add('border-blue-500');
                            if (shouldFocusTextarea) {
                                textarea.focus();
                            }
                        } else {
                            textarea.classList.remove('border-blue-500');
                            textarea.classList.add('border-gray-200', 'dark:border-gray-700');
                        }
                    }

                    if (active && idx === primaryIndex && shouldScroll) {
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }

            setTimeout(syncTranslationHeights, 100);
        }

        function clearMultiSelection() {
            AppState.translations.multiSelected = [];
            updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
        }

        function toggleMultiSelection(index) {
            const selected = AppState.translations.multiSelected || [];
            const next = new Set(selected);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            AppState.translations.multiSelected = Array.from(next);
            AppState.translations.selected = index;
            updateSelectionStyles({ shouldScroll: true, shouldFocusTextarea: false });
        }

        // 选择翻译项（优化版 - 只更新样式，不重渲染）
        function selectTranslationItem(index) {
            const options = arguments.length > 1 && arguments[1] ? arguments[1] : {};
            const shouldScroll = options.shouldScroll !== false;
            const shouldFocusTextarea = options.shouldFocusTextarea !== false;

            // 避免重复选择同一个翻译项，防止无限循环
            if (AppState.translations.selected === index && (AppState.translations.multiSelected || []).length === 0) {
                return;
            }

            AppState.translations.multiSelected = [];
            AppState.translations.selected = index;
            updateSelectionStyles({ shouldScroll, shouldFocusTextarea });
        }

        // 更新翻译项
        function updateTranslationItem(index, targetText) {
            if (AppState.project && AppState.project.translationItems[index]) {
                const item = AppState.project.translationItems[index];
                const oldStatus = item.status;
                const oldTargetText = item.targetText || '';
                item.targetText = targetText;
                
                // 只有当译文不为空时才设置为已编辑，避免清空时也标记为已编辑
                if (targetText && targetText.trim()) {
                    item.status = 'edited';
                } else {
                    // 如果译文被清空，恢复为待翻译状态
                    item.status = 'pending';
                }
                
                AppState.project.updatedAt = new Date();

                if (oldTargetText !== targetText) {
                    autoSaveManager.markDirty();
                }
                
                // 同步到 AppState.translations.items
                AppState.translations.items = AppState.project.translationItems;
                
                // 更新计数器
                updateCounters();
                
                // 只有当状态改变时才更新状态标签，避免每次输入都重渲染
                if (oldStatus !== item.status) {
                    updateStatusBadge(index, item.status);
                }
            }
        }
        
        // 更新单个项的状态标签（不重渲染整个列表）
        function updateStatusBadge(index, newStatus) {
            const sourceList = document.getElementById('sourceList');
            const mobileCombinedList = document.getElementById('mobileCombinedList');
            if (!sourceList && !mobileCombinedList) return;
            
            if (sourceList) {
                const sourceItems = sourceList.querySelectorAll('.responsive-translation-item');
                sourceItems.forEach(item => {
                    if (parseInt(item.dataset.index) === index) {
                        const badge = item.querySelector('span.text-xs');
                        if (badge) {
                            // 更新文本
                            badge.textContent = getStatusText(newStatus);
                            
                            // 更新颜色类
                            badge.className = `text-xs font-semibold ${getStatusClass(newStatus)} px-2 py-0.5 rounded-full whitespace-nowrap`;
                        }
                    }
                });
            }

            if (mobileCombinedList) {
                const mobileItems = mobileCombinedList.querySelectorAll('.responsive-translation-item');
                mobileItems.forEach(item => {
                    if (parseInt(item.dataset.index) === index) {
                        const badge = item.querySelector('span.text-xs');
                        if (badge) {
                            badge.textContent = getStatusText(newStatus);
                            badge.className = `text-xs font-semibold ${getStatusClass(newStatus)} px-2 py-0.5 rounded-full whitespace-nowrap`;
                        }
                    }
                });
            }
        }

        // 更新计数器
        function updateCounters() {
            if (!AppState.project) return;
            
            const items = AppState.project.translationItems || [];
            const total = items.length;
            const translated = items.filter(item => 
                item.status === 'translated' || item.status === 'edited' || item.status === 'approved'
            ).length;

            const sourceCountEl = document.getElementById('sourceCount');
            const targetCountEl = document.getElementById('targetCount');
            if (sourceCountEl) sourceCountEl.textContent = `${total} 项`;
            if (targetCountEl) targetCountEl.textContent = `${translated}/${total} 项`;
        }

        function clearSelectedTargets() {
            if (AppState.translations.selected === -1 || !AppState.project) {
                showNotification('warning', '未选择项', '请先选择要清除译文的项');
                return;
            }

            const selectedIndices = (AppState.translations.multiSelected || []).length > 0
                ? Array.from(new Set(AppState.translations.multiSelected)).sort((a, b) => a - b)
                : [AppState.translations.selected];

            let cleared = 0;
            for (const idx of selectedIndices) {
                const item = AppState.project.translationItems?.[idx];
                if (!item) continue;
                item.qualityScore = 0;
                updateTranslationItem(idx, '');
                cleared++;
            }

            if (cleared > 0) {
                autoSaveManager.markDirty();
            }

            const searchQuery = AppState.translations.searchQuery;
            if (!searchQuery || searchQuery.trim() === '') {
                AppState.translations.filtered = [...AppState.project.translationItems];
            } else {
                applySearchFilter();
            }

            updateTranslationLists();
            updateCounters();
            updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });

            if (selectedIndices.length > 1) {
                showNotification('success', '清除完成', `已清除 ${cleared} 项译文`);
            } else {
                showNotification('success', '清除完成', '已清除选中项译文');
            }
        }

        // 翻译选中项
        async function translateSelected() {
            if (AppState.translations.selected === -1 || !AppState.project) {
                showNotification('warning', '未选择项', '请先选择要翻译的项');
                return;
            }

            const selectedIndices = (AppState.translations.multiSelected || []).length > 0
                ? Array.from(new Set(AppState.translations.multiSelected)).sort((a, b) => a - b)
                : [AppState.translations.selected];
            const selectedItems = selectedIndices
                .map(idx => AppState.project.translationItems?.[idx])
                .filter(Boolean);

            if (selectedItems.length === 0) {
                showNotification('warning', '未选择项', '请先选择要翻译的项');
                return;
            }

            showTranslationProgress();
            updateProgress(0, selectedItems.length, '准备翻译...');

            const sourceLang = AppState.project.sourceLanguage || 'en';
            const targetLang = AppState.project.targetLanguage || 'zh';

            const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
            const engine = settings.translationEngine || settings.defaultEngine || document.getElementById('translationEngine')?.value || 'deepseek';

            AppState.translations.isInProgress = true;

            let translationCount = 0;
            const batchUpdateInterval = 20;
            const updateUIIfNeeded = () => {
                translationCount++;
                if (translationCount % batchUpdateInterval === 0) {
                    const searchQuery = AppState.translations.searchQuery;
                    if (!searchQuery || searchQuery.trim() === '') {
                        AppState.translations.filtered = [...AppState.project.translationItems];
                    } else {
                        applySearchFilter();
                    }
                    updateTranslationLists();
                    updateCounters();
                }
            };

            try {
                const { results, errors } = await translationService.translateBatch(
                    selectedItems,
                    sourceLang,
                    targetLang,
                    engine,
                    (completed, total, message) => {
                        updateProgress(completed, total, message);
                        updateUIIfNeeded();
                    }
                );

                hideTranslationProgress();

                const actualErrors = errors.filter(e => e.error !== '用户取消');
                const cancelledCount = errors.filter(e => e.error === '用户取消').length;

                if (!AppState.translations.isInProgress && cancelledCount > 0) {
                    showNotification('info', '翻译已取消', `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`);
                } else if (actualErrors.length === 0) {
                    showNotification('success', '翻译完成', `已成功翻译 ${results.length} 项`);
                } else {
                    showNotification('warning', '翻译部分完成', `成功 ${results.length} 项，失败 ${actualErrors.length} 项`);
                }

                autoSaveManager.markDirty();

                const searchQuery = AppState.translations.searchQuery;
                if (!searchQuery || searchQuery.trim() === '') {
                    AppState.translations.filtered = [...AppState.project.translationItems];
                } else {
                    applySearchFilter();
                }

                updateTranslationLists();
                updateCounters();
                updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });

            } catch (error) {
                hideTranslationProgress();
                if (!error?.__notified) {
                    showNotification('error', '翻译失败', error.message);
                }
            } finally {
                AppState.translations.isInProgress = false;
            }
        }

        // 翻译所有项
        async function translateAll() {
            if (!AppState.project || !AppState.project.translationItems.length) {
                showNotification('warning', '无翻译项', '请先上传文件');
                return;
            }
            
            // 获取待翻译的项
            const pendingItems = AppState.project.translationItems.filter(item => 
                item.status === 'pending'
            );
            
            if (pendingItems.length === 0) {
                showNotification('info', '无需翻译', '所有项都已翻译完成');
                return;
            }
            
            // 显示翻译进度模态框
            showTranslationProgress();
            
            // 设置进度初始值
            updateProgress(0, pendingItems.length, '准备翻译...');
            
            // 获取语言设置
            const sourceLang = AppState.project.sourceLanguage || 'en';
            const targetLang = AppState.project.targetLanguage || 'zh';
            
            // 获取翻译引擎
            const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
            const engine = settings.translationEngine || settings.defaultEngine || document.getElementById('translationEngine')?.value || 'deepseek';
            
            // 开始批量翻译
            AppState.translations.isInProgress = true;
            
            // 批量翻译时禁用UI更新，只在结束时更新一次
            let translationCount = 0;
            const batchUpdateInterval = 20; // 每20条更新一次UI
            
            const updateUIIfNeeded = () => {
                translationCount++;
                // 每20条更新一次UI，提供适度的视觉反馈
                if (translationCount % batchUpdateInterval === 0) {
                    console.log(`批量更新UI: 已翻译 ${translationCount} 条`);
                    const searchQuery = AppState.translations.searchQuery;
                    if (!searchQuery || searchQuery.trim() === '') {
                        AppState.translations.filtered = [...AppState.project.translationItems];
                    } else {
                        applySearchFilter();
                    }
                    updateTranslationLists();
                    updateCounters();
                }
            };
            
            try {
                // 调用批量翻译
                const { results, errors } = await translationService.translateBatch(
                    pendingItems,
                    sourceLang,
                    targetLang,
                    engine,
                    // 进度回调函数
                    (completed, total, message) => {
                        updateProgress(completed, total, message);
                        // 每20条更新一次UI，而不是每条都更新
                        updateUIIfNeeded();
                    }
                );
                
                // 翻译完成或取消
                hideTranslationProgress();
                
                // 统计实际错误（排除用户取消）
                const actualErrors = errors.filter(e => e.error !== '用户取消');
                const cancelledCount = errors.filter(e => e.error === '用户取消').length;
                
                if (!AppState.translations.isInProgress && cancelledCount > 0) {
                    // 用户取消
                    showNotification('info', '翻译已取消', `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`);
                } else if (actualErrors.length === 0) {
                    // 全部成功
                    showNotification('success', '翻译完成', `已成功翻译 ${results.length} 项`);
                } else {
                    // 部分失败
                    showNotification('warning', '翻译部分完成', `成功 ${results.length} 项，失败 ${actualErrors.length} 项`);
                }
                
                // 标记为已修改，触发自动保存
                autoSaveManager.markDirty();
                
                // 翻译完成后执行最后一次完整更新
                console.log('批量翻译完成，执行最后更新...');
                const searchQuery = AppState.translations.searchQuery;
                if (!searchQuery || searchQuery.trim() === '') {
                    AppState.translations.filtered = [...AppState.project.translationItems];
                } else {
                    applySearchFilter();
                }
                updateTranslationLists();
                updateCounters();
                
            } catch (error) {
                hideTranslationProgress();
                showNotification('error', '翻译失败', error.message);
                console.error('批量翻译错误:', error);
            } finally {
                AppState.translations.isInProgress = false;
            }
        }

        // 取消翻译
        function cancelTranslation() {
            AppState.translations.isInProgress = false;
            
            // 取消所有活动的网络请求
            networkUtils.cancelAll();
            
            hideTranslationProgress();
            showNotification('info', '翻译已取消', '翻译过程已被用户取消');
        }

        // 显示翻译进度模态框
        function showTranslationProgress() {
            document.getElementById('translationProgressModal').classList.remove('hidden');
            document.getElementById('progressBar').style.width = '0%';
            document.getElementById('progressPercentage').textContent = '0%';
            document.getElementById('progressStatus').textContent = '准备翻译...';
            const log = document.getElementById('progressLog');
            if (log) log.replaceChildren();
        }

        // 隐藏翻译进度模态框
        function hideTranslationProgress() {
            document.getElementById('translationProgressModal').classList.add('hidden');
        }

        // 更新进度
        function updateProgress(current, total, status) {
            const percentage = Math.floor((current / total) * 100);
            document.getElementById('progressBar').style.width = `${percentage}%`;
            document.getElementById('progressPercentage').textContent = `${percentage}%`;
            document.getElementById('progressStatus').textContent = status;
        }

        // 添加进度日志
        function addProgressLog(message) {
            const log = document.getElementById('progressLog');
            const li = document.createElement('li');
            li.className = 'slide-in';
            li.textContent = message;
            log.appendChild(li);
            log.scrollTop = log.scrollHeight;
        }

        // 翻译功能（使用真实API）
        async function translateText(text, sourceLang = 'en', targetLang = 'zh', context = null) {
            if (!text || !text.trim()) {
                return text;
            }
            
            let engine = 'deepseek';
            try {
                // 获取翻译引擎
                const settings = safeJsonParse(localStorage.getItem('translatorSettings'), {});
                engine = (settings.translationEngine || settings.defaultEngine || document.getElementById('translationEngine')?.value || 'deepseek').toLowerCase();
                
                // 调用翻译服务（传递上下文）
                const translated = await translationService.translate(text, sourceLang, targetLang, engine, context);
                return translated;
            } catch (error) {
                console.error('翻译失败:', error);
                
                // 显示错误通知
                const message = (error && error.message) ? error.message : String(error);
                if (message.includes('API密钥未配置')) {
                    showNotification('error', 'API密钥未配置', `请在设置中配置 ${engine.toUpperCase()} API密钥`);
                } else if (/authentication\s*fails/i.test(message) || /unauthorized/i.test(message) || /api\s*key[^\n]*invalid/i.test(message)) {
                    showNotification('error', 'API密钥无效', `当前 ${engine.toUpperCase()} API密钥无效，请在设置中更新后重试`);
                } else {
                    showNotification('error', '翻译失败', message);
                }

                error.__notified = true;
                throw error;
            }
        }
        
        // 备用的模拟翻译功能（仅用于演示）
        function mockTranslate(text) {
            // 简单的模拟翻译，当API调用失败时使用
            const translations = {
                'Welcome to our application': '欢迎使用我们的应用',
                'Please login to continue': '请登录以继续',
                'The API endpoint requires authentication.': 'API端点需要身份验证。',
                'Please refer to the documentation for more details.': '请参考文档以获取更多详细信息。',
                'You have successfully updated your profile.': '您已成功更新个人资料。',
                'Please enter a valid email address.': '请输入有效的电子邮件地址。',
                'Hello, world!': '你好，世界！',
                'This is a sample XML file for demonstration purposes.': '这是一个用于演示目的的示例XML文件。',
                'This is a sample JSON file.': '这是一个示例JSON文件。',
                'Sample text from': '来自的示例文本'
            };
            
            // 检查是否有预定义的翻译
            for (const [key, value] of Object.entries(translations)) {
                if (text.includes(key)) {
                    return text.replace(key, value);
                }
            }
            
            // 如果没有预定义的翻译，返回带有标记的原文
            return `[翻译] ${text}`;
        }

        // 导出翻译
        async function exportTranslation() {
            // 检查是否有翻译项
            if (!AppState.translations.items || AppState.translations.items.length === 0) {
                showNotification('warning', '无翻译项', '没有可导出的翻译内容，请先上传文件');
                return;
            }
            
            const format = document.getElementById('exportFormat').value;
            // 使用单选按钮，检查哪个选项被选中
            const onlyTranslated = document.getElementById('exportOnlyTranslated').checked;
            const includeOriginal = document.getElementById('exportIncludeOriginal').checked;
            
            console.log('导出前总翻译项数量:', AppState.translations.items.length);
            console.log('仅导出已翻译项选项:', onlyTranslated);
            console.log('包含原文选项:', includeOriginal);
            
            // 过滤翻译项
            let itemsToExport = [...AppState.translations.items];
            
            // 如果选择了“仅导出已翻译项”，则过滤掉未翻译的项
            if (onlyTranslated) {
                const beforeFilter = itemsToExport.length;
                
                console.log('=== 开始过滤，仅导出已翻译项 ===');
                console.log('过滤前项数:', beforeFilter);
                
                // 打印前5个项的状态
                console.log('前5个项的状态:');
                itemsToExport.slice(0, 5).forEach((item, idx) => {
                    console.log(`  [${idx}] status="${item.status}", hasTarget=${!!(item.targetText && item.targetText.trim())}, text="${item.sourceText?.substring(0,30)}..."`);
                });
                
                itemsToExport = itemsToExport.filter(item => {
                    const hasTranslation = item.targetText && item.targetText.trim() !== '';
                    const isTranslated = item.status === 'translated' || item.status === 'edited' || item.status === 'approved';
                    const pass = hasTranslation && isTranslated;
                    
                    // 记录被过滤掉的项（仅前3个）
                    if (!pass && itemsToExport.indexOf(item) < 3) {
                        console.log(`  ✗ 过滤掉: status="${item.status}", hasTranslation=${hasTranslation}, text="${item.sourceText?.substring(0,30)}..."`);
                    }
                    
                    return pass;
                });
                
                console.log(`过滤后: ${beforeFilter} -> ${itemsToExport.length} 项`);
                console.log('=== 过滤完成 ===');
            }
            
            if (itemsToExport.length === 0) {
                showNotification('warning', '无可导出项', '没有符合条件的翻译项，请先完成翻译');
                return;
            }

            if (format === 'original') {
                try {
                    const filesMap = new Map();
                    itemsToExport.forEach((item) => {
                        const fileName = item?.metadata?.file || 'unknown';
                        if (!filesMap.has(fileName)) filesMap.set(fileName, []);
                        filesMap.get(fileName).push(item);
                    });

                    if (filesMap.size === 0) {
                        showNotification('warning', '无可导出文件', '没有找到可导出的文件信息');
                        return;
                    }

                    let exportedCount = 0;
                    let failedCount = 0;
                    const missingOriginalFiles = [];

                    for (const [fileName, fileItems] of filesMap.entries()) {
                        if (fileName && fileName !== 'unknown') {
                            await ensureOriginalContentLoadedForFile(fileName);
                        }

                        const meta = AppState.fileMetadata?.[fileName] || {};
                        const hasOriginal = !!(meta.originalContent && typeof meta.originalContent === 'string');
                        if (fileName && fileName !== 'unknown' && !hasOriginal) {
                            missingOriginalFiles.push(fileName);
                        }

                        const exportResult = generateOriginalFormatExport(fileName, fileItems);
                        if (!exportResult) {
                            failedCount++;
                            continue;
                        }

                        downloadFile(exportResult.content, exportResult.filename);
                        exportedCount++;
                    }

                    closeModal('exportModal');

                    if (missingOriginalFiles.length > 0 && typeof showNotification === 'function') {
                        const preview = missingOriginalFiles.slice(0, 3).join(', ');
                        const more = missingOriginalFiles.length > 3 ? ` 等 ${missingOriginalFiles.length} 个文件` : '';
                        showNotification('warning', '原格式导出受限', `部分文件缺少原始内容，将使用通用导出：${preview}${more}`);
                    }

                    const optionText = onlyTranslated ? '仅已翻译项' : '包含原文';
                    if (failedCount > 0) {
                        showNotification('warning', '导出完成', `成功导出 ${exportedCount} 个文件，失败 ${failedCount} 个（${optionText}）`);
                    } else {
                        showNotification('success', '导出成功', `已成功按原格式导出 ${exportedCount} 个文件（${optionText}）`);
                    }
                } catch (error) {
                    console.error('导出错误:', error);
                    showNotification('error', '导出失败', `导出过程中出现错误: ${error.message}`);
                }

                return;
            }

            if (format === 'xml' || format === 'xliff' || format === 'json') {
                const firstFileName = itemsToExport?.[0]?.metadata?.file;
                if (firstFileName) {
                    await ensureOriginalContentLoadedForFile(firstFileName);

                    const meta = AppState.fileMetadata?.[firstFileName] || {};
                    if (!meta.originalContent && typeof showNotification === 'function') {
                        showNotification('warning', '通用导出', '未找到原始文件内容，将使用通用导出生成结果（可能无法完全保持原格式）。');
                    }
                }
            }
            
            // 生成导出内容
            let content = '';
            const projectName = AppState.project?.name || 'translation';
            let filename = `${projectName}_${format}_${new Date().getTime()}.${format}`;
            
            try {
                if (format === 'xml') {
                    content = generateXML(itemsToExport, includeOriginal);
                } else if (format === 'json') {
                    content = generateJSON(itemsToExport, includeOriginal);
                } else if (format === 'xliff') {
                    content = generateXLIFF(itemsToExport, includeOriginal);
                } else if (format === 'csv') {
                    content = generateCSV(itemsToExport, includeOriginal);
                }
                
                // 创建下载链接
                downloadFile(content, filename);
                
                // 隐藏模态框
                closeModal('exportModal');
                
                // 显示通知
                const optionText = onlyTranslated ? '仅已翻译项' : '包含原文';
                showNotification('success', '导出成功', `已成功导出 ${itemsToExport.length} 项翻译为 ${format.toUpperCase()} 格式（${optionText}）`);
            } catch (error) {
                console.error('导出错误:', error);
                showNotification('error', '导出失败', `导出过程中出现错误: ${error.message}`);
            }
        }

        function generateOriginalFormatExport(fileName, items) {
            const normalizedFileName = (fileName && fileName !== 'unknown') ? fileName : `export-${Date.now()}`;

            const meta = AppState.fileMetadata?.[fileName] || {};
            const extFromMeta = (meta.extension || '').toLowerCase();
            const extFromName = normalizedFileName.includes('.') ? normalizedFileName.split('.').pop().toLowerCase() : '';
            const extension = extFromMeta || extFromName;
            const baseName = normalizedFileName.includes('.') ? normalizedFileName.substring(0, normalizedFileName.lastIndexOf('.')) : normalizedFileName;
            const originalContent = meta.originalContent;

            if (!extension) {
                return null;
            }

            if (!originalContent && extension !== 'csv') {
                // 缺失提示在 exportTranslation 中做汇总，避免刷屏
            }

            if (extension === 'xml') {
                const content = generateXML(items, true);
                return { content, filename: `${baseName}-translated.xml` };
            }

            if (extension === 'xlf' || extension === 'xliff') {
                const content = generateXLIFF(items, true);
                return { content, filename: `${baseName}-translated.${extension}` };
            }

            if (extension === 'json') {
                const content = generateJSONFromOriginal(items, normalizedFileName);
                return { content, filename: `${baseName}-translated.json` };
            }

            if (extension === 'resx') {
                const content = generateRESXFromOriginal(items, normalizedFileName);
                return { content, filename: `${baseName}-translated.resx` };
            }

            if (extension === 'po') {
                const content = generatePOFromOriginal(items, normalizedFileName);
                return { content, filename: `${baseName}-translated.po` };
            }

            if (extension === 'strings') {
                const content = generateIOSStringsFromOriginal(items, normalizedFileName);
                return { content, filename: `${baseName}-translated.strings` };
            }

            return null;
        }

        // 生成XML格式
        function generateXML(items, includeOriginal) {
            console.log('=== 开始生成XML ===');
            console.log('翻译项数量:', items.length);
            
            // 尝试查找原始文件内容
            const firstItem = items[0];
            const fileName = firstItem?.metadata?.file;
            
            console.log('文件名:', fileName);
            
            // 打印前几个翻译项的示例
            if (items.length > 0) {
                console.log('翻译项示例 (前3个):');
                items.slice(0, 3).forEach((item, i) => {
                    console.log(`  [${i}] 原文: "${item.sourceText?.substring(0, 50)}..."`);
                    console.log(`      译文: "${item.targetText?.substring(0, 50)}..."`);
                    console.log(`      ID: ${item.id}, 状态: ${item.status}`);
                });
            }
            
            // 如果有原始文件内容，就在原文件基础上替换翻译
            if (fileName && AppState.fileMetadata[fileName]?.originalContent) {
                console.log('找到原始文件内容，使用替换模式');
                const originalContent = AppState.fileMetadata[fileName].originalContent;
                const extension = AppState.fileMetadata[fileName].extension;
                
                console.log('文件扩展名:', extension);
                console.log('原始内容长度:', originalContent.length);
                
                // 根据不同格式处理
                if (extension === 'xml') {
                    if (originalContent.includes('<resources') && originalContent.includes('<string name=')) {
                        console.log('检测到Android strings.xml格式');
                        return generateAndroidStringsXML(items, originalContent);
                    }
                }
                
                // 通用XML替换
                console.log('使用通用XML替换');
                return replaceXMLContent(items, originalContent);
            }

            // 如果没有原始文件，但看起来是Android strings.xml，则生成resources格式
            if (looksLikeAndroidStringsItems(items)) {
                console.log('未找到原始文件内容，但检测到Android strings.xml项目，使用生成resources模式');
                return generateAndroidStringsXMLFromItems(items, includeOriginal);
            }
            
            // 如果没有原始文件，生成通用格式
            console.log('没有原始文件，生成通用XML格式');
            return generateGenericXML(items, includeOriginal);
        }

        function looksLikeAndroidStringsItems(items) {
            return Array.isArray(items) && items.some(item => {
                const context = item?.context || '';
                return typeof context === 'string' && context.includes('Android string resource:');
            });
        }
        
        // 生成通用XML格式（旧的逻辑）
        function generateGenericXML(items, includeOriginal) {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<translations>\n';
            
            items.forEach((item, index) => {
                xml += '  <translation';
                if (item.id) {
                    xml += ` id="${escapeXml(item.id)}"`;
                }
                xml += '>\n';
                
                if (includeOriginal && item.sourceText) {
                    xml += `    <source>${escapeXml(item.sourceText)}</source>\n`;
                }
                
                if (item.targetText) {
                    xml += `    <target>${escapeXml(item.targetText)}</target>\n`;
                }
                
                if (item.context) {
                    xml += `    <context>${escapeXml(item.context)}</context>\n`;
                }
                
                if (item.status) {
                    xml += `    <status>${escapeXml(item.status)}</status>\n`;
                }
                
                xml += '  </translation>\n';
            });
            
            xml += '</translations>';
            return xml;
        }
        
        // 替换XML内容（通用方法）
        function replaceXMLContent(items, originalContent) {
            console.log('开始替换XML内容, 翻译项数量:', items.length);
            
            // 使用DOM解析更准确地替换
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(originalContent, 'application/xml');
                
                // 检查解析错误
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    console.warn('XML解析失败，使用文本替换');
                    return replaceXMLContentByText(items, originalContent);
                }
                
                // 遍历所有文本节点
                const walker = document.createTreeWalker(
                    xmlDoc.documentElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                
                const replacements = [];
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent?.trim();
                    if (text && text.length > 0) {
                        // 查找匹配的翻译项
                        const item = items.find(item => item.sourceText?.trim() === text);
                        if (item && item.targetText) {
                            replacements.push({
                                node: node,
                                sourceText: text,
                                targetText: item.targetText,
                                originalContent: node.textContent
                            });
                        }
                    }
                }
                
                console.log(`找到 ${replacements.length} 个匹配的文本节点`);
                
                // 执行替换
                replacements.forEach(({ node, targetText, originalContent, sourceText }) => {
                    // 保持原有的空白字符
                    const leadingSpace = originalContent.match(/^\s*/)[0];
                    const trailingSpace = originalContent.match(/\s*$/)[0];
                    node.textContent = leadingSpace + targetText + trailingSpace;
                    console.log(`替换: "${sourceText}" -> "${targetText}"`);
                });
                
                // 序列化回字符串
                const serializer = new XMLSerializer();
                const result = serializer.serializeToString(xmlDoc);
                
                console.log('替换完成');
                return result;
                
            } catch (error) {
                console.error('DOM替换失败:', error);
                return replaceXMLContentByText(items, originalContent);
            }
        }
        
        // 文本替换方式（备用）
        function replaceXMLContentByText(items, originalContent) {
            console.log('使用文本替换方式, 翻译项数量:', items.length);
            let result = originalContent;
            let replacedCount = 0;
            
            // 按照文本长度排序，从长到短，避免短文本被误替换
            const sortedItems = [...items].sort((a, b) => 
                (b.sourceText?.length || 0) - (a.sourceText?.length || 0)
            );
            
            sortedItems.forEach(item => {
                if (item.sourceText && item.targetText) {
                    // 转义特殊字符用于正则表达式
                    const escapedSource = item.sourceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // 替换标签内的文本
                    const regex = new RegExp(`>([^<]*${escapedSource}[^<]*)<`, 'g');
                    const before = result;
                    
                    result = result.replace(regex, (match, p1) => {
                        if (p1.trim() === item.sourceText.trim()) {
                            console.log(`文本替换: "${item.sourceText.substring(0, 50)}..." -> "${item.targetText.substring(0, 50)}..."`);
                            replacedCount++;
                            return `>${item.targetText}<`;
                        }
                        return match;
                    });
                }
            });
            
            console.log(`文本替换完成, 共替换 ${replacedCount} 个项`);
            return result;
        }

        function generateAndroidStringsXMLFromItems(items, includeOriginal) {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<resources>\n';

            items.forEach((item) => {
                const resourceId = item?.metadata?.resourceId;
                if (!resourceId) return;

                const hasTarget = item?.targetText && item.targetText.trim() !== '';
                const value = hasTarget
                    ? item.targetText
                    : (includeOriginal ? (item?.sourceText || '') : '');

                xml += `    <string name="${escapeXml(String(resourceId))}">${escapeXml(String(value))}</string>\n`;
            });

            xml += '</resources>\n';
            return xml;
        }
        
        // 生成Android strings.xml格式
        function generateAndroidStringsXML(items, originalContent) {
            console.log('处理Android strings.xml, 翻译项数量:', items.length);
            let result = originalContent;
            let replacedCount = 0;
            
            items.forEach(item => {
                if (item.targetText && item.targetText.trim() !== '') {
                    // 获取原始的resourceId（name属性值）
                    const resourceId = item.metadata?.resourceId;
                    if (!resourceId) {
                        console.warn(`跳过无resourceId的项: ${item.id}`);
                        return;
                    }
                    
                    // 转义特殊字符
                    const escapedId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // 匹配 <string name="id">原文</string> 格式
                    const regex = new RegExp(
                        `(<string[^>]*name="${escapedId}"[^>]*>)([^<]*)(</string>)`,
                        'g'
                    );
                    
                    const before = result;
                    result = result.replace(regex, (match, opening, content, closing) => {
                        console.log(`✓ 替换Android资源: name="${resourceId}" -> "${item.targetText.substring(0,30)}..."`);
                        replacedCount++;
                        return `${opening}${escapeXml(item.targetText)}${closing}`;
                    });
                    
                    if (result === before) {
                        console.warn(`✗ 未找到匹配: name="${resourceId}"`);
                    }
                }
            });
            
            console.log(`Android strings.xml 替换完成, 共替换 ${replacedCount} 个项`);
            return result;
        }

        // 生成JSON格式
        function generateJSON(items, includeOriginal) {
            const data = items.map((item, index) => {
                const obj = {};
                
                if (item.id) {
                    obj.id = item.id;
                }
                
                if (includeOriginal && item.sourceText) {
                    obj.source = item.sourceText;
                }
                
                if (item.targetText) {
                    obj.target = item.targetText;
                }
                
                if (item.context) {
                    obj.context = item.context;
                }
                
                if (item.status) {
                    obj.status = item.status;
                }
                
                return obj;
            });
            
            return JSON.stringify(data, null, 2);
        }

        function generateJSONFromOriginal(items, fileName) {
            const meta = AppState.fileMetadata?.[fileName] || {};
            const originalContent = meta.originalContent;
            if (!originalContent) {
                return generateJSON(items, true);
            }

            try {
                const json = JSON.parse(originalContent);

                function setValueByPath(obj, path, value) {
                    if (!path || typeof path !== 'string') return;
                    const parts = path.split('.');
                    let current = obj;

                    for (let i = 0; i < parts.length - 1; i++) {
                        const key = parts[i];
                        if (!current || typeof current !== 'object') return;
                        current = current[key];
                    }

                    const lastKey = parts[parts.length - 1];
                    if (!current || typeof current !== 'object') return;
                    current[lastKey] = value;
                }

                items.forEach((item) => {
                    const path = item?.metadata?.path;
                    const targetText = item?.targetText;
                    if (!path) return;
                    if (!targetText || !targetText.trim()) return;
                    setValueByPath(json, path, targetText);
                });

                return JSON.stringify(json, null, 2);
            } catch (e) {
                console.error('更新JSON失败:', e);
                return generateJSON(items, true);
            }
        }

        function generateRESXFromOriginal(items, fileName) {
            const meta = AppState.fileMetadata?.[fileName] || {};
            const originalContent = meta.originalContent;
            if (!originalContent) {
                return generateXML(items, true);
            }

            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(originalContent, 'application/xml');
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    return generateXML(items, true);
                }

                items.forEach((item) => {
                    const name = item?.metadata?.resourceId;
                    const targetText = item?.targetText;
                    if (!name) return;
                    if (!targetText || !targetText.trim()) return;

                    const escapedName = (window.CSS && typeof window.CSS.escape === 'function')
                        ? window.CSS.escape(name)
                        : String(name).replace(/["\\]/g, '\\$&');
                    const data = xmlDoc.querySelector(`data[name="${escapedName}"]`);
                    if (!data) return;
                    const valueEl = data.querySelector('value');
                    if (!valueEl) return;
                    valueEl.textContent = targetText;
                });

                const serializer = new XMLSerializer();
                return serializer.serializeToString(xmlDoc);
            } catch (e) {
                console.error('更新RESX失败:', e);
                return generateXML(items, true);
            }
        }

        function generatePOFromOriginal(items, fileName) {
            const meta = AppState.fileMetadata?.[fileName] || {};
            const originalContent = meta.originalContent;
            if (!originalContent) {
                return generateCSV(items, true);
            }

            try {
                let result = originalContent;

                items.forEach((item) => {
                    const msgid = item?.sourceText;
                    const msgstr = item?.targetText;
                    if (!msgid || !msgid.trim()) return;
                    if (!msgstr || !msgstr.trim()) return;

                    const escapedMsgid = msgid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const replaceRegex = new RegExp(`(msgid\\s+"${escapedMsgid}"[\\s\\S]*?msgstr\\s+)"[^"]*"`, 'g');
                    const escapedMsgstr = msgstr.replace(/"/g, '\\"');
                    result = result.replace(replaceRegex, `$1"${escapedMsgstr}"`);
                });

                return result;
            } catch (e) {
                console.error('更新PO失败:', e);
                return generateCSV(items, true);
            }
        }

        function generateIOSStringsFromOriginal(items, fileName) {
            const meta = AppState.fileMetadata?.[fileName] || {};
            const originalContent = meta.originalContent;
            if (!originalContent) {
                return generateCSV(items, true);
            }

            try {
                const lines = originalContent.split('\n');
                const map = new Map();

                items.forEach((item) => {
                    const key = item?.metadata?.key;
                    const value = item?.targetText;
                    if (!key) return;
                    if (!value || !value.trim()) return;
                    map.set(key, value);
                });

                const updated = lines.map((line) => {
                    const match = line.match(/^\s*\"([^\"]+)\"\s*=\s*\"([^\"]*)\";?\s*$/);
                    if (!match) return line;
                    const key = match[1];
                    if (!map.has(key)) return line;
                    const newValue = map.get(key).replace(/\"/g, '\\"');
                    return line.replace(/(=\s*\")[^\"]*(\";?\s*)$/, `$1${newValue}$2`);
                });

                return updated.join('\n');
            } catch (e) {
                console.error('更新iOS Strings失败:', e);
                return generateCSV(items, true);
            }
        }

        // 生成CSV格式
        function generateCSV(items, includeOriginal) {
            let csv = '';
            
            // 添加表头
            if (includeOriginal) {
                csv = 'ID,Source,Target,Context,Status\n';
            } else {
                csv = 'ID,Target,Context,Status\n';
            }
            
            items.forEach((item, index) => {
                const row = [];
                
                // ID
                row.push(`"${escapeCsv(item.id || `item-${index + 1}`)}"`);  
                
                // Source (如果包含原文)
                if (includeOriginal) {
                    row.push(`"${escapeCsv(item.sourceText || '')}"`);  
                }
                
                // Target
                row.push(`"${escapeCsv(item.targetText || '')}"`);  
                
                // Context
                row.push(`"${escapeCsv(item.context || '')}"`);  
                
                // Status
                row.push(`"${escapeCsv(item.status || 'untranslated')}"`);  
                
                csv += row.join(',') + '\n';
            });
            
            return csv;
        }

        // 生成XLIFF格式
        function generateXLIFF(items, includeOriginal) {
            // 尝试查找原始文件内容
            const firstItem = items[0];
            const fileName = firstItem?.metadata?.file;
                        
            // 如果有原始 XLIFF 文件，就更新它
            if (fileName && AppState.fileMetadata[fileName]?.originalContent &&
                (AppState.fileMetadata[fileName].extension === 'xliff' || AppState.fileMetadata[fileName].extension === 'xlf')) {
                return updateXLIFFContent(items, AppState.fileMetadata[fileName].originalContent);
            }
            
            // 否则生成新的 XLIFF
            return generateNewXLIFF(items);
        }
        
        // 更新原始 XLIFF 内容
        function updateXLIFFContent(items, originalContent) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(originalContent, 'application/xml');
                
                // 查找所有 trans-unit 元素
                const transUnits = xmlDoc.querySelectorAll('trans-unit');
                
                transUnits.forEach(transUnit => {
                    const source = transUnit.querySelector('source');
                    if (!source) return;
                    
                    const sourceText = source.textContent?.trim();
                    
                    // 查找匹配的翻译项
                    const item = items.find(item => item.sourceText?.trim() === sourceText);
                    
                    if (item && item.targetText) {
                        // 更新或创建 target 元素
                        let target = transUnit.querySelector('target');
                        if (!target) {
                            target = xmlDoc.createElement('target');
                            source.parentNode.insertBefore(target, source.nextSibling);
                        }
                        
                        target.textContent = item.targetText;
                        
                        // 设置状态
                        if (item.status === 'translated' || item.status === 'edited' || item.status === 'approved') {
                            target.setAttribute('state', 'translated');
                        }
                        
                        if (item.status === 'approved') {
                            transUnit.setAttribute('approved', 'yes');
                        }
                    }
                });
                
                // 序列化回字符串
                const serializer = new XMLSerializer();
                return serializer.serializeToString(xmlDoc);
                
            } catch (error) {
                console.error('更新XLIFF失败:', error);
                return generateNewXLIFF(items);
            }
        }
        
        // 生成新的 XLIFF
        function generateNewXLIFF(items) {
            const sourceLang = AppState.project?.sourceLanguage || document.getElementById('sourceLanguage')?.value || 'en';
            const targetLang = AppState.project?.targetLanguage || document.getElementById('targetLanguage')?.value || 'zh';
            
            let xliff = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xliff += '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n';
            xliff += `  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">\n`;
            xliff += '    <body>\n';
            
            items.forEach((item, index) => {
                const transUnitId = item.id || `trans-${index + 1}`;
                xliff += `      <trans-unit id="${escapeXml(transUnitId)}"`;
                
                // 添加状态属性
                if (item.status === 'approved') {
                    xliff += ` approved="yes"`;
                }
                
                xliff += '>\n';
                
                // Source
                if (item.sourceText) {
                    xliff += `        <source>${escapeXml(item.sourceText)}</source>\n`;
                }
                
                // Target
                if (item.targetText) {
                    const state = item.status === 'translated' || item.status === 'edited' || item.status === 'approved' ? 'translated' : 'needs-translation';
                    xliff += `        <target state="${state}">${escapeXml(item.targetText)}</target>\n`;
                }
                
                // Context
                if (item.context) {
                    xliff += `        <note>${escapeXml(item.context)}</note>\n`;
                }
                
                xliff += '      </trans-unit>\n';
            });
            
            xliff += '    </body>\n';
            xliff += '  </file>\n';
            xliff += '</xliff>';
            return xliff;
        }

        // 创建新项目
        function createNewProject() {
            const name = document.getElementById('projectName').value.trim();
            const sourceLang = document.getElementById('projectSourceLang').value;
            const targetLang = document.getElementById('projectTargetLang').value;
            
            if (!name) {
                showNotification('warning', '缺少项目名称', '请输入项目名称');
                return;
            }
            
            // 检查是否有未保存的项目
            if (AppState.project && AppState.translations.items.length > 0) {
                if (!confirm('当前项目尚未保存，是否继续创建新项目？未保存的数据将丢失。')) {
                    return;
                }
            }
            
            // 清空现有数据
            AppState.translations.items = [];
            AppState.translations.selected = -1;
            AppState.translations.currentPage = 1;
            AppState.translations.filtered = [];
            AppState.translations.searchQuery = '';
            
            // 创建新项目
            AppState.project = {
                id: 'project-' + Date.now(),
                name: name,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                fileFormat: 'mixed',
                translationItems: [],
                terminologyList: [...AppState.terminology.list],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // 更新UI
            updateFileTree();
            updateTranslationLists();
            updateCounters();
            
            // 更新语言选择
            document.getElementById('sourceLanguage').value = sourceLang;
            document.getElementById('targetLanguage').value = targetLang;
            
            // 清空输入框
            document.getElementById('projectName').value = '';
            
            // 隐藏模态框
            closeModal();
            
            // 显示通知
            showNotification('success', '项目已创建', `项目 "${name}" 已成功创建`);

            autoSaveManager.markDirty();
            autoSaveManager.saveProject();
        }

        // 打开项目
        function openProject() {
            // 创建文件选择器
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const projectData = JSON.parse(event.target.result);
                        
                        // 验证项目数据
                        if (!projectData.name || !projectData.sourceLanguage || !projectData.targetLanguage) {
                            showNotification('error', '无效的项目文件', '项目文件格式不正确');
                            return;
                        }
                        
                        // 检查是否有未保存的项目
                        if (AppState.project && AppState.translations.items.length > 0) {
                            if (!confirm('当前项目尚未保存，是否继续打开新项目？未保存的数据将丢失。')) {
                                return;
                            }
                        }
                        
                        // 加载项目数据
                        AppState.project = projectData;
                        AppState.translations.items = projectData.translationItems || [];
                        AppState.project.translationItems = AppState.translations.items;
                        
                        // 加载文件元数据
                        if (projectData.fileMetadata) {
                            AppState.fileMetadata = projectData.fileMetadata;
                        } else {
                            AppState.fileMetadata = {};
                        }

                        hydrateFileMetadataContentKeys(AppState.project?.id);
                        
                        // 如果项目中有术语库，加载它
                        if (projectData.terminologyList && Array.isArray(projectData.terminologyList)) {
                            AppState.terminology.list = projectData.terminologyList;
                            AppState.terminology.filtered = [...AppState.terminology.list];
                            updateTerminologyList();
                        }
                        
                        // 重置状态
                        AppState.translations.selected = -1;
                        AppState.translations.currentPage = 1;
                        AppState.translations.filtered = [...AppState.translations.items];
                        AppState.translations.searchQuery = '';
                        
                        // 更新UI
                        document.getElementById('sourceLanguage').value = projectData.sourceLanguage;
                        document.getElementById('targetLanguage').value = projectData.targetLanguage;
                        updateFileTree();
                        updateTranslationLists();
                        updateCounters();
                        
                        // 显示通知
                        showNotification('success', '项目已打开', `项目 "${projectData.name}" 已成功加载`);

                        autoSaveManager.markDirty();
                        autoSaveManager.saveProject();
                    } catch (error) {
                        console.error('打开项目失败:', error);
                        showNotification('error', '打开失败', '无法解析项目文件，请确保文件格式正确');
                    }
                };
                
                reader.onerror = function() {
                    showNotification('error', '读取失败', '无法读取项目文件');
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        }

        // 保存项目
        async function saveProject() {
            if (!AppState.project) {
                showNotification('warning', '无项目', '请先创建或打开项目');
                return;
            }
            
            // 更新项目数据
            AppState.project.updatedAt = new Date().toISOString();
            AppState.project.translationItems = AppState.translations.items;
            AppState.project.terminologyList = AppState.terminology.list;

            // 保存原始内容到IndexedDB，项目文件仅保存引用（contentKey）
            hydrateFileMetadataContentKeys(AppState.project?.id);
            const safeFileMetadata = {};
            const fileMetadata = AppState.fileMetadata || {};
            Object.keys(fileMetadata).forEach((fileName) => {
                const meta = fileMetadata[fileName] || {};
                const cloned = { ...meta };
                delete cloned.originalContent;
                safeFileMetadata[fileName] = cloned;
            });
            
            // 创建项目数据对象
            const projectData = {
                id: AppState.project.id,
                name: AppState.project.name,
                sourceLanguage: AppState.project.sourceLanguage,
                targetLanguage: AppState.project.targetLanguage,
                fileFormat: AppState.project.fileFormat || 'mixed',
                translationItems: AppState.translations.items,
                terminologyList: AppState.terminology.list,
                fileMetadata: safeFileMetadata,
                createdAt: AppState.project.createdAt,
                updatedAt: AppState.project.updatedAt,
                version: '1.0.0'
            };

            // P2: 手动保存时也 flush currentProject，减少刷新/关闭导致未落盘
            try {
                await storageManager.saveCurrentProject(projectData);
            } catch (e) {
                console.error('手动保存时持久化 currentProject 失败:', e);
            }
            
            // 转换为JSON字符串
            const jsonStr = JSON.stringify(projectData, null, 2);
            
            // 创建Blob对象
            const blob = new Blob([jsonStr], { type: 'application/json' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${AppState.project.name}.json`;
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 显示通知
            showNotification('success', '项目已保存', `项目 "${AppState.project.name}" 已成功保存`);
        }

        // 保存术语（更新现有函数）
        function saveTerm() {
            const sourceTerm = document.getElementById('sourceTerm').value.trim();
            const targetTerm = document.getElementById('targetTerm').value.trim();
            const partOfSpeech = document.getElementById('partOfSpeech').value;
            const termDefinition = document.getElementById('termDefinition').value.trim();
            
            if (!sourceTerm || !targetTerm) {
                showNotification('warning', '缺少术语', '请输入源术语和目标术语');
                return;
            }
            
            const saveBtn = document.getElementById('saveTermBtn');
            const isEditing = saveBtn.dataset.editingId;
            
            if (isEditing) {
                // 更新现有术语
                const termId = parseInt(isEditing);
                const termIndex = AppState.terminology.list.findIndex(t => t.id === termId);
                
                if (termIndex !== -1) {
                    AppState.terminology.list[termIndex] = {
                        ...AppState.terminology.list[termIndex],
                        source: sourceTerm,
                        target: targetTerm,
                        partOfSpeech: partOfSpeech,
                        definition: termDefinition
                    };
                    
                    showNotification('success', '更新成功', `术语 "${sourceTerm}" 已更新`);
                }
                
                // 清除编辑状态
                delete saveBtn.dataset.editingId;
                saveBtn.textContent = '保存';
            } else {
                // 添加新术语
                const newTerm = {
                    id: AppState.terminology.list.length > 0 ? Math.max(...AppState.terminology.list.map(t => t.id)) + 1 : 1,
                    source: sourceTerm,
                    target: targetTerm,
                    partOfSpeech: partOfSpeech,
                    definition: termDefinition
                };
                
                AppState.terminology.list.push(newTerm);
                showNotification('success', '添加成功', `术语 "${sourceTerm}" 已成功添加`);
            }
            
            // 保存到 localStorage
            try {
                localStorage.setItem('terminologyList', JSON.stringify(AppState.terminology.list));
            } catch (e) {
                console.error('保存术语库失败:', e);
            }
            
            // 重置表单
            document.getElementById('sourceTerm').value = '';
            document.getElementById('targetTerm').value = '';
            document.getElementById('partOfSpeech').value = 'noun';
            document.getElementById('termDefinition').value = '';
            
            // 更新列表
            filterTerminology();
            
            // 关闭添加术语模态框（不关闭术语库管理模态框）
            closeModal('addTermModal');
        }
        
        // 全局变量用于存储待导入的文件
        let pendingImportFile = null;
        
        // 处理导入文件选择
        function handleImportFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 保存文件引用
            pendingImportFile = file;
            
            console.log('文件已选择:', file.name);
            
            // 获取导入按钮并启用它
            const importTerminologyBtn = document.getElementById('importTerminologyBtn');
            if (importTerminologyBtn) {
                console.log('启用导入按钮');
                importTerminologyBtn.disabled = false;
                importTerminologyBtn.classList.remove('disabled:opacity-50', 'disabled:cursor-not-allowed');
            } else {
                console.error('未找到导入按钮元素');
            }
            
            // 显示文件信息
            const importDropArea = document.getElementById('importDropArea');
            const importFileInput = document.getElementById('importFileInput');
            if (importDropArea) {
                const icon = document.createElement('i');
                icon.className = 'fa fa-file-text text-2xl text-primary mb-2';

                const nameEl = document.createElement('p');
                nameEl.className = 'text-sm font-medium text-gray-700 dark:text-gray-200';
                nameEl.textContent = file.name;

                const sizeEl = document.createElement('p');
                sizeEl.className = 'text-xs text-gray-500 dark:text-gray-400';
                sizeEl.textContent = formatFileSize(file.size);

                const btn = document.createElement('button');
                btn.id = 'changeImportFileBtn';
                btn.className = 'mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors';
                btn.textContent = '更换文件';

                importDropArea.replaceChildren(icon, nameEl, sizeEl, btn);

                if (importFileInput) {
                    importFileInput.classList.add('hidden');
                    importDropArea.appendChild(importFileInput);
                    EventManager.add(btn, 'click', () => importFileInput.click());
                }
            }
            
            // 显示文件已选择的通知
            showNotification('success', '文件已选择', `已选择文件: ${file.name} (${formatFileSize(file.size)})`);
        }
        
        // 导入术语
        function importTerminology() {
            try {
                console.log('开始导入术语库...');
                
                // 使用全局变量中保存的文件
                if (!pendingImportFile) {
                    showNotification('warning', '未选择文件', '请选择要导入的文件');
                    return;
                }
                
                const file = pendingImportFile;
                const importTerminologyBtn = document.getElementById('importTerminologyBtn');
                
                console.log('导入文件:', file.name);
                const importFormat = document.getElementById('importFormat').value;
                const overwrite = document.getElementById('importOverwrite').checked;
                
                console.log('导入设置:', { format: importFormat, overwrite: overwrite });
                
                // 显示进度条
                const importProgress = document.getElementById('importProgress');
                const importProgressBar = document.getElementById('importProgressBar');
                const importPercentage = document.getElementById('importPercentage');
                const importStatus = document.getElementById('importStatus');
                
                if (importProgress) {
                    importProgress.classList.remove('hidden');
                    importProgressBar.style.width = '0%';
                    importPercentage.textContent = '0%';
                    importStatus.textContent = '准备导入...';
                }
                
                // 模拟文件读取
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    console.log('文件读取完成，内容长度:', e.target.result.length);
                    try {
                        let importedTerms = [];
                        let fileContent = e.target.result;
                        
                        // 根据文件格式解析
                        if (importFormat === 'json' || (importFormat === 'auto' && file.name.endsWith('.json'))) {
                            const jsonData = JSON.parse(fileContent);
                            if (Array.isArray(jsonData)) {
                                importedTerms = jsonData.map((term, index) => ({
                                    id: Date.now() + index,
                                    source: term.source || term.term || term.key,
                                    target: term.target || term.translation || term.value,
                                    partOfSpeech: term.partOfSpeech || term.pos || 'other',
                                    definition: term.definition || term.description || ''
                                })).filter(term => term.source && term.target);
                            }
                        } else if (importFormat === 'csv' || (importFormat === 'auto' && file.name.endsWith('.csv'))) {
                            const lines = fileContent.split('\n').filter(line => line.trim());
                            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                            
                            for (let i = 1; i < lines.length; i++) {
                                const values = lines[i].split(',');
                                const term = {};
                                
                                headers.forEach((header, index) => {
                                    term[header] = values[index]?.trim() || '';
                                });
                                
                                if (term.source && term.target) {
                                    importedTerms.push({
                                        id: Date.now() + i,
                                        source: term.source,
                                        target: term.target,
                                        partOfSpeech: term.partofspeech || term.pos || 'other',
                                        definition: term.definition || term.description || ''
                                    });
                                }
                            }
                        } else {
                            throw new Error('不支持的文件格式');
                        }
                        
                        console.log('成功解析术语数量:', importedTerms.length);
                        
                        if (importedTerms.length === 0) {
                            throw new Error('文件中没有找到有效的术语数据');
                        }
                        
                        // 更新进度
                        importProgressBar.style.width = '50%';
                        importPercentage.textContent = '50%';
                        importStatus.textContent = `解析完成，准备导入 ${importedTerms.length} 个术语...`;
                        
                        // 模拟导入延迟
                        setTimeout(() => {
                            if (overwrite) {
                                AppState.terminology.list = importedTerms;
                            } else {
                                // 合并，避免重复
                                const existingSources = new Set(AppState.terminology.list.map(t => t.source.toLowerCase()));
                                const newTerms = importedTerms.filter(t => !existingSources.has(t.source.toLowerCase()));
                                AppState.terminology.list = [...AppState.terminology.list, ...newTerms];
                            }
                            
                            // 更新过滤列表和分页
                            AppState.terminology.filtered = [...AppState.terminology.list];
                            AppState.terminology.currentPage = 1;
                            
                            // 保存到 localStorage
                            try {
                                localStorage.setItem('terminologyList', JSON.stringify(AppState.terminology.list));
                                console.log('术语库已保存到 localStorage');
                            } catch (e) {
                                console.error('保存术语库失败:', e);
                            }
                            
                            // 更新显示
                            updateTerminologyList();
                            
                            // 完成进度
                            importProgressBar.style.width = '100%';
                            importPercentage.textContent = '100%';
                            importStatus.textContent = '导入完成！';
                            
                            showNotification('success', '导入成功', `成功导入 ${importedTerms.length} 个术语`);
                            
                            // 重置文件输入
                            setTimeout(() => {
                                pendingImportFile = null; // 清空文件引用
                                importProgress.classList.add('hidden');
                                importTerminologyBtn.disabled = true;
                                
                                // 重置导入区域
                                const importDropArea = document.getElementById('importDropArea');
                                if (importDropArea) {
                                    const icon = document.createElement('i');
                                    icon.className = 'fa fa-cloud-upload text-3xl text-gray-400 dark:text-gray-500 mb-3';

                                    const p1 = document.createElement('p');
                                    p1.className = 'text-sm text-gray-600 dark:text-gray-300 mb-1';
                                    p1.textContent = '拖拽文件到此处或点击选择文件';

                                    const p2 = document.createElement('p');
                                    p2.className = 'text-xs text-gray-500 dark:text-gray-400 mb-3';
                                    p2.textContent = '支持 CSV、JSON、XLSX 格式';

                                    const btn = document.createElement('button');
                                    btn.id = 'browseImportFileBtn';
                                    btn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm';
                                    btn.textContent = '选择文件';

                                    importDropArea.replaceChildren(icon, p1, p2, btn);

                                    const input = document.getElementById('importFileInput');
                                    if (input) {
                                        input.classList.add('hidden');
                                        importDropArea.appendChild(input);
                                        EventManager.add(btn, 'click', () => input.click());
                                    }
                                }
                            }, 1000);
                        }, 1000);
                        
                    } catch (error) {
                        console.error('导入失败:', error);
                        console.error('错误堆栈:', error.stack);
                        showNotification('error', '导入失败', `导入文件时出错: ${error.message}`);
                        
                        if (importProgress) {
                            importProgress.classList.add('hidden');
                        }
                    }
                };
                
                reader.onerror = function(e) {
                    console.error('文件读取失败:', e);
                    showNotification('error', '文件读取失败', '无法读取选中的文件');
                    
                    if (importProgress) {
                        importProgress.classList.add('hidden');
                    }
                };
                
                // 开始读取文件
                reader.readAsText(file);
                
            } catch (error) {
                console.error('导入术语库时出错:', error);
                showNotification('error', '导入失败', `导入过程中发生错误: ${error.message}`);
            }
        }
        
        // 处理导入拖放事件
        function handleImportDragOver(e) {
            e.preventDefault();
            e.stopPropagation();
            setDropAreaActive(e.currentTarget, true);
        }
        
        function handleImportDragLeave(e) {
            e.preventDefault();
            e.stopPropagation();
            setDropAreaActive(e.currentTarget, false);
        }
        
        function handleImportDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            setDropAreaActive(e.currentTarget, false);
            
            if (e.dataTransfer.files.length) {
                const importFileInput = document.getElementById('importFileInput');
                if (importFileInput) {
                    importFileInput.files = e.dataTransfer.files;
                    handleImportFileSelect({ target: importFileInput });
                }
            }
        }
        
        // 切换术语库标签页
        function switchTerminologyTab(tabName) {
            // 更新标签按钮状态
            document.querySelectorAll('.terminology-tab').forEach(tab => {
                tab.classList.remove('active', 'bg-primary', 'text-white', 'border-primary');
                tab.classList.add('bg-gray-50', 'dark:bg-gray-900', 'text-gray-700', 'dark:text-gray-200', 'border-gray-300', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                
                if (tab.dataset.tab === tabName) {
                    tab.classList.add('active', 'bg-primary', 'text-white', 'border-primary');
                    tab.classList.remove('bg-gray-50', 'dark:bg-gray-900', 'text-gray-700', 'dark:text-gray-200', 'border-gray-300', 'dark:border-gray-600', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                }
            });
            
            // 显示对应面板
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
                panel.classList.add('hidden');
            });
            
            const activePanel = document.getElementById(`terminology${tabName === 'list' ? 'List' : 'ImportExport'}Panel`);
            if (activePanel) {
                activePanel.classList.remove('hidden');
                activePanel.classList.add('active');
            }
            
            // 如果是列表标签页，刷新列表
            if (tabName === 'list') {
                updateTerminologyList();
            }
        }
        
        // 更新术语列表
        function updateTerminologyList() {
            const terminologyListElement = document.getElementById('terminologyList');
            if (!terminologyListElement) return;
            
            // 使用 AppState 获取数据
            const terminologyList = AppState.terminology.list;
            const currentTerminologyPage = AppState.terminology.currentPage;
            const terminologyPerPage = AppState.terminology.perPage;
            const filteredTerminology = AppState.terminology.filtered;
            
            // 计算分页
            const startIndex = (currentTerminologyPage - 1) * terminologyPerPage;
            const endIndex = Math.min(startIndex + terminologyPerPage, filteredTerminology.length);
            const itemsToShow = filteredTerminology.slice(startIndex, endIndex);
            
            if (itemsToShow.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 4;
                td.className = 'px-4 py-8 text-center text-gray-500 dark:text-gray-400';

                const icon = document.createElement('i');
                icon.className = 'fa fa-search text-3xl text-gray-300 dark:text-gray-600 mb-2 block';

                const p1 = document.createElement('p');
                p1.textContent = '没有找到匹配的术语';

                const p2 = document.createElement('p');
                p2.className = 'text-sm mt-1';
                p2.textContent = '尝试使用不同的搜索词或筛选条件';

                td.appendChild(icon);
                td.appendChild(p1);
                td.appendChild(p2);
                tr.appendChild(td);
                terminologyListElement.replaceChildren(tr);
            } else {
                const fragment = document.createDocumentFragment();
                itemsToShow.forEach(term => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-600';

                    const td1 = document.createElement('td');
                    td1.className = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium';
                    td1.textContent = term.source;

                    const td2 = document.createElement('td');
                    td2.className = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100';
                    td2.textContent = term.target;

                    const td3 = document.createElement('td');
                    td3.className = 'px-4 py-3 text-sm text-gray-500 dark:text-gray-400';
                    td3.textContent = getPartOfSpeechText(term.partOfSpeech);

                    const td4 = document.createElement('td');
                    td4.className = 'px-4 py-3 text-sm text-gray-500 dark:text-gray-400';

                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-term-btn text-primary hover:text-primary/80 mr-3';
                    editBtn.dataset.id = String(term.id);
                    editBtn.textContent = '编辑';

                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-term-btn text-danger hover:text-danger/80';
                    delBtn.dataset.id = String(term.id);
                    delBtn.textContent = '删除';

                    td4.appendChild(editBtn);
                    td4.appendChild(delBtn);

                    tr.appendChild(td1);
                    tr.appendChild(td2);
                    tr.appendChild(td3);
                    tr.appendChild(td4);
                    fragment.appendChild(tr);
                });
                terminologyListElement.replaceChildren(fragment);
            }
            
            // 更新分页信息
            updateTerminologyPagination();
        }
        
        // 获取词性文本
        function getPartOfSpeechText(pos) {
            const posMap = {
                'noun': '名词',
                'verb': '动词',
                'adjective': '形容词',
                'adverb': '副词',
                'other': '其他'
            };
            return posMap[pos] || pos;
        }
        
        // 更新术语分页信息
        function updateTerminologyPagination() {
            // 使用 AppState 获取数据
            const filteredTerminology = AppState.terminology.filtered;
            const terminologyPerPage = AppState.terminology.perPage;
            const currentTerminologyPage = AppState.terminology.currentPage;
            
            const totalPages = Math.max(1, Math.ceil(filteredTerminology.length / terminologyPerPage));
            
            // 更新计数
            const totalItems = filteredTerminology.length;
            const startIndex = totalItems === 0 ? 0 : (currentTerminologyPage - 1) * terminologyPerPage + 1;
            const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + terminologyPerPage - 1, totalItems);
            
            const terminologyCount = document.getElementById('terminologyCount');
            if (terminologyCount) {
                terminologyCount.textContent = `显示 ${startIndex}-${endIndex} 条，共 ${totalItems} 条`;
            }
            
            // 更新页码
            const currentPageElement = document.getElementById('terminologyCurrentPage');
            if (currentPageElement) {
                currentPageElement.textContent = currentTerminologyPage;
            }
            
            // 更新按钮状态
            const prevBtn = document.getElementById('terminologyPrevBtn');
            const nextBtn = document.getElementById('terminologyNextBtn');
            
            if (prevBtn) {
                prevBtn.disabled = totalItems === 0 || currentTerminologyPage <= 1;
            }
            
            if (nextBtn) {
                nextBtn.disabled = totalItems === 0 || currentTerminologyPage >= totalPages;
            }
        }
        
        // 处理术语分页
        function handleTerminologyPagination(direction) {
            const filteredTerminology = AppState.terminology.filtered;
            const terminologyPerPage = AppState.terminology.perPage;
            const totalPages = Math.max(1, Math.ceil(filteredTerminology.length / terminologyPerPage));
            const currentTerminologyPage = AppState.terminology.currentPage;
            
            if (direction === 'prev' && currentTerminologyPage > 1) {
                AppState.terminology.currentPage = currentTerminologyPage - 1;
            } else if (direction === 'next' && currentTerminologyPage < totalPages) {
                AppState.terminology.currentPage = currentTerminologyPage + 1;
            }
            
            updateTerminologyList();
        }
        
        // 过滤术语
        function filterTerminology() {
            const searchInput = document.getElementById('terminologySearch');
            const filterSelect = document.getElementById('terminologyFilter');
            
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const filterValue = filterSelect ? filterSelect.value : 'all';
            
            AppState.terminology.filtered = AppState.terminology.list.filter(term => {
                // 搜索过滤
                const matchesSearch = !searchTerm || 
                    term.source.toLowerCase().includes(searchTerm) ||
                    term.target.toLowerCase().includes(searchTerm) ||
                    (term.definition && term.definition.toLowerCase().includes(searchTerm));
                
                // 词性过滤
                const matchesFilter = filterValue === 'all' || term.partOfSpeech === filterValue;
                
                return matchesSearch && matchesFilter;
            });
            
            AppState.terminology.currentPage = 1;
            updateTerminologyList();
        }
        
        // 编辑术语
        function editTerm(termId) {
            const term = AppState.terminology.list.find(t => t.id === termId);
            if (!term) return;
            
            // 填充编辑模态框
            document.getElementById('sourceTerm').value = term.source;
            document.getElementById('targetTerm').value = term.target;
            document.getElementById('partOfSpeech').value = term.partOfSpeech;
            document.getElementById('termDefinition').value = term.definition || '';
            
            // 显示编辑模态框
            document.getElementById('addTermModal').classList.remove('hidden');
            
            // 暂时保存正在编辑的术语ID
            const saveBtn = document.getElementById('saveTermBtn');
            saveBtn.dataset.editingId = termId;
            saveBtn.textContent = '更新术语';
        }
        
        // 删除术语
        function deleteTerm(termId) {
            if (confirm('确定要删除这个术语吗？')) {
                const index = AppState.terminology.list.findIndex(t => t.id === termId);
                if (index !== -1) {
                    AppState.terminology.list.splice(index, 1);
                    
                    // 保存到 localStorage
                    try {
                        localStorage.setItem('terminologyList', JSON.stringify(AppState.terminology.list));
                    } catch (e) {
                        console.error('保存术语库失败:', e);
                    }
                    
                    filterTerminology(); // 重新过滤并更新列表
                    showNotification('success', '删除成功', '术语已成功删除');
                }
            }
        }
        
        // 导出术语库
        function exportTerminology() {
            const format = document.getElementById('exportTerminologyFormat').value;
            const filter = document.getElementById('exportFilter').value;
            const includeDefinition = document.getElementById('exportIncludeDefinition').checked;
            const includeMetadata = document.getElementById('exportIncludeMetadata').checked;
            
            // 根据筛选条件过滤术语
            let termsToExport = [...AppState.terminology.list];
            if (filter !== 'all') {
                termsToExport = termsToExport.filter(term => term.partOfSpeech === filter);
            }
            
            if (termsToExport.length === 0) {
                showNotification('warning', '无数据导出', '没有找到符合筛选条件的术语');
                return;
            }
            
            // 生成导出内容
            let content = '';
            let filename = `术语库_${new Date().toISOString().split('T')[0]}`;
            
            switch (format) {
                case 'csv':
                    content = generateTerminologyCSV(termsToExport, includeDefinition, includeMetadata);
                    filename += '.csv';
                    break;
                case 'json':
                    content = generateTerminologyJSON(termsToExport, includeDefinition, includeMetadata);
                    filename += '.json';
                    break;
                case 'xml':
                    content = generateTerminologyXML(termsToExport, includeDefinition, includeMetadata);
                    filename += '.xml';
                    break;
                case 'excel':
                    // 使用SheetJS生成真正的Excel文件
                    generateTerminologyExcel(termsToExport, includeDefinition, includeMetadata);
                    showNotification('success', '导出成功', `已导出 ${termsToExport.length} 个术语`);
                    return; // Excel导出函数内部处理下载
            }
            
            // 下载文件
            downloadFile(content, filename);
            showNotification('success', '导出成功', `已导出 ${termsToExport.length} 个术语`);
        }
        
        // 生成术语库CSV
        function generateTerminologyCSV(terms, includeDefinition, includeMetadata) {
            let csv = '源术语,目标术语,词性';
            if (includeDefinition) csv += ',定义';
            if (includeMetadata) csv += ',创建时间';
            csv += '\n';
            
            terms.forEach(term => {
                let row = `"${escapeCsv(term.source)}","${escapeCsv(term.target)}","${escapeCsv(getPartOfSpeechText(term.partOfSpeech))}"`;
                if (includeDefinition) row += `,"${escapeCsv(term.definition || '')}"`;
                if (includeMetadata) row += `,"${new Date().toISOString()}"`;
                csv += row + '\n';
            });
            
            return csv;
        }
        
        // 生成术语库JSON
        function generateTerminologyJSON(terms, includeDefinition, includeMetadata) {
            const exportData = terms.map(term => {
                const data = {
                    source: term.source,
                    target: term.target,
                    partOfSpeech: term.partOfSpeech
                };
                
                if (includeDefinition && term.definition) {
                    data.definition = term.definition;
                }
                
                if (includeMetadata) {
                    data.createdAt = new Date().toISOString();
                    data.updatedAt = new Date().toISOString();
                }
                
                return data;
            });
            
            return JSON.stringify(exportData, null, 2);
        }
        
        // 生成术语库XML
        function generateTerminologyXML(terms, includeDefinition, includeMetadata) {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<terminology>\n';
            
            terms.forEach(term => {
                xml += '  <term>\n';
                xml += `    <source>${escapeXml(term.source)}</source>\n`;
                xml += `    <target>${escapeXml(term.target)}</target>\n`;
                xml += `    <partOfSpeech>${escapeXml(term.partOfSpeech)}</partOfSpeech>\n`;
                
                if (includeDefinition && term.definition) {
                    xml += `    <definition>${escapeXml(term.definition)}</definition>\n`;
                }
                
                if (includeMetadata) {
                    xml += `    <createdAt>${new Date().toISOString()}</createdAt>\n`;
                    xml += `    <updatedAt>${new Date().toISOString()}</updatedAt>\n`;
                }
                
                xml += '  </term>\n';
            });
            
            xml += '</terminology>';
            return xml;
        }
        
        // 生成术语库Excel（使用SheetJS）
        function generateTerminologyExcel(terms, includeDefinition, includeMetadata) {
            // 检查SheetJS是否加载
            if (typeof XLSX === 'undefined') {
                showNotification('error', '导出失败', 'Excel库未加载，请刷新页面重试');
                return;
            }
            
            // 准备表格数据
            const data = [];
            
            // 添加表头
            const headers = ['源术语', '目标术语', '词性'];
            if (includeDefinition) headers.push('定义');
            if (includeMetadata) {
                headers.push('创建时间');
                headers.push('更新时间');
            }
            data.push(headers);
            
            // 添加数据行
            terms.forEach(term => {
                const row = [
                    term.source || '',
                    term.target || '',
                    getPartOfSpeechText(term.partOfSpeech) || ''
                ];
                
                if (includeDefinition) {
                    row.push(term.definition || '');
                }
                
                if (includeMetadata) {
                    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    row.push(now);
                    row.push(now);
                }
                
                data.push(row);
            });
            
            // 创建工作簿
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // 设置列宽
            const colWidths = [
                { wch: 25 }, // 源术语
                { wch: 25 }, // 目标术语
                { wch: 12 }, // 词性
            ];
            if (includeDefinition) colWidths.push({ wch: 40 }); // 定义
            if (includeMetadata) {
                colWidths.push({ wch: 20 }); // 创建时间
                colWidths.push({ wch: 20 }); // 更新时间
            }
            ws['!cols'] = colWidths;
            
            // 设置表头样式（粗体）
            const headerRange = XLSX.utils.decode_range(ws['!ref']);
            for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!ws[cellAddress]) continue;
                
                // 设置单元格样式（SheetJS Pro特性，免费版可能不生效，但不会报错）
                ws[cellAddress].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "E0E0E0" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
            
            // 创建工作簿
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '术语库');
            
            // 设置工作簿属性
            wb.Props = {
                Title: '术语库',
                Subject: '智能翻译工具术语库',
                Author: '智能翻译工具',
                CreatedDate: new Date()
            };
            
            // 生成文件名
            const filename = `术语库_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            // 导出文件
            try {
                XLSX.writeFile(wb, filename);
            } catch (error) {
                console.error('Excel导出失败:', error);
                showNotification('error', '导出失败', error.message || 'Excel文件生成失败');
            }
        }
        
        // 格式化文件大小
        
        
        // 转义CSV内容
        function escapeCsv(text) {
            if (!text) return '';
            return text.toString().replace(/"/g, '""');
        }
        
        // 转义XML内容
        function escapeXml(text) {
            if (!text) return '';
            return text.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
        
        // 下载文件
        function downloadFile(content, filename) {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // 切换用户菜单
        let userMenuOutsideClickListenerId = null;
        function toggleUserMenu(e) {
            e.stopPropagation(); // 阻止事件冒泡
            const menu = document.getElementById('userMenu');
            if (!menu) return;
            const isHidden = menu.classList.contains('hidden');
            
            if (isHidden) {
                // 打开菜单
                menu.classList.remove('hidden');
                
                // 添加全局点击事件监听器，点击外部关闭菜单
                setTimeout(() => {
                    if (!userMenuOutsideClickListenerId) {
                        userMenuOutsideClickListenerId = EventManager.add(document, 'click', closeUserMenuOnClickOutside, { tag: 'user', scope: 'userMenu', label: 'document:clickCloseUserMenu' });
                    }
                }, 0);
            } else {
                // 关闭菜单
                menu.classList.add('hidden');
                if (userMenuOutsideClickListenerId) {
                    EventManager.removeById(userMenuOutsideClickListenerId);
                    userMenuOutsideClickListenerId = null;
                }
            }
        }
        
        // 点击外部关闭用户菜单
        function closeUserMenuOnClickOutside(e) {
            const menu = document.getElementById('userMenu');
            const menuBtn = document.getElementById('userMenuBtn');
            
            // 如果点击的不是菜单内部，则关闭菜单
            if (menu && !menu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
                menu.classList.add('hidden');
                if (userMenuOutsideClickListenerId) {
                    EventManager.removeById(userMenuOutsideClickListenerId);
                    userMenuOutsideClickListenerId = null;
                }
            }
        }

        // 打开模态框
        function openModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
            }
        }

        // 关闭模态框
        function closeModal(eventOrModalId) {
            // 如果传入的是字符串，则作为模态框ID处理
            if (typeof eventOrModalId === 'string') {
                const modal = document.getElementById(eventOrModalId);
                if (modal) {
                    modal.classList.add('hidden');
                }
                return;
            }
            
            // 如果有事件对象，尝试找到最近的模态框
            if (eventOrModalId && eventOrModalId.target) {
                const modalToClose = eventOrModalId.target.closest('.fixed.inset-0.bg-black.bg-opacity-50');
                if (modalToClose) {
                    modalToClose.classList.add('hidden');
                    return;
                }
            }
            
            // 如果没有参数，只关闭最顶层的模态框（最后一个可见的）
            const visibleModals = Array.from(document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50'))
                .filter(modal => !modal.classList.contains('hidden'));
            
            if (visibleModals.length > 0) {
                // 只关闭最后一个（z-index最高的）
                visibleModals[visibleModals.length - 1].classList.add('hidden');
            }
        }

        // 显示通知
        function showNotification(type, title, message) {
            const notification = document.getElementById('notification');
            const icon = document.getElementById('notificationIcon');
            const iconInner = document.getElementById('notificationIconInner');
            const notificationTitle = document.getElementById('notificationTitle');
            const notificationMessage = document.getElementById('notificationMessage');
            
            // 设置通知类型
            let iconClass = 'fa-info-circle';
            let bgClass = 'bg-blue-50 dark:bg-blue-500/10';
            let textClass = 'text-blue-800 dark:text-blue-100';
            
            if (type === 'success') {
                iconClass = 'fa-check-circle';
                bgClass = 'bg-green-50 dark:bg-emerald-500/20';
                textClass = 'text-green-800 dark:text-emerald-400';
            } else if (type === 'warning') {
                iconClass = 'fa-exclamation-triangle';
                bgClass = 'bg-yellow-50 dark:bg-amber-900';
                textClass = 'text-yellow-800 dark:text-amber-100';
            } else if (type === 'error') {
                iconClass = 'fa-exclamation-circle';
                bgClass = 'bg-red-50 dark:bg-red-500/10';
                textClass = 'text-red-800 dark:text-red-300';
            }
            
            // 设置图标
            icon.className = `flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${bgClass} ${textClass} mr-3`;
            iconInner.className = `fa ${iconClass}`;
            
            // 设置标题和消息
            notificationTitle.textContent = title;
            notificationMessage.textContent = message;
            
            // 显示通知（从左侧滑入）
            notification.classList.remove('-translate-x-full', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
            
            // 添加到body类，可能需要调整布局
            document.body.classList.add('has-notification');
            
            // 自动隐藏通知
            clearTimeout(notification.hideTimeout);
            notification.hideTimeout = setTimeout(() => {
                closeNotification();
            }, 5000);
        }

        // 关闭通知
        function closeNotification() {
            const notification = document.getElementById('notification');
            notification.classList.remove('translate-x-0', 'opacity-100');
            notification.classList.add('-translate-x-full', 'opacity-0');
            
            // 移除body类
            document.body.classList.remove('has-notification');
        }

        // 工具函数：转义HTML
        function escapeHtml(text) {
            const raw = (text === null || text === undefined) ? '' : String(text);
            return raw
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // 工具函数：截断文本
        function truncateText(text, maxLength) {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        }

        // 工具函数：获取状态文本
        function getStatusText(status) {
            switch (status) {
                case 'translated': return '已翻译';
                case 'edited': return '已编辑';
                case 'approved': return '已批准';
                case 'pending': return '待翻译';
                default: return status;
            }
        }
        
        // ==================== 质量检查功能 ====================
                
        let qualityCheckCharts = { accuracy: null, consistency: null };
        let qualityCheckResults = {
            overallScore: 0,
            translatedCount: 0,
            totalCount: 0,
            issues: [],
            termMatches: 0,
            lastCheckTime: null
        };
                
        // 质量检查缓存
        const qualityCheckCache = new Map();
        let isCheckingQuality = false;
                
        let qualityCheckEventListenersInitialized = false;
        function initQualityCheckEventListeners() {
            if (qualityCheckEventListenersInitialized) return;
            qualityCheckEventListenersInitialized = true;

            const runQualityCheckBtn = document.getElementById('runQualityCheckBtn');
            if (runQualityCheckBtn) EventManager.add(runQualityCheckBtn, 'click', runQualityCheck, { tag: 'quality', scope: 'qualityReport', label: 'runQualityCheckBtn:click' });
            const issueFilterSeverity = document.getElementById('issueFilterSeverity');
            if (issueFilterSeverity) EventManager.add(issueFilterSeverity, 'change', filterIssues, { tag: 'quality', scope: 'qualityReport', label: 'issueFilterSeverity:change' });
            const issueFilterType = document.getElementById('issueFilterType');
            if (issueFilterType) EventManager.add(issueFilterType, 'change', filterIssues, { tag: 'quality', scope: 'qualityReport', label: 'issueFilterType:change' });
            const resetIssueFilterBtn = document.getElementById('resetIssueFilter');
            if (resetIssueFilterBtn) EventManager.add(resetIssueFilterBtn, 'click', resetIssueFilter, { tag: 'quality', scope: 'qualityReport', label: 'resetIssueFilterBtn:click' });
            const exportQualityReportBtn = document.getElementById('exportQualityReport');
            if (exportQualityReportBtn) EventManager.add(exportQualityReportBtn, 'click', exportQualityReportData, { tag: 'quality', scope: 'qualityReport', label: 'exportQualityReportBtn:click' });
        }
        
        // 重置筛选条件
        function resetIssueFilter() {
            document.getElementById('issueFilterSeverity').value = 'all';
            document.getElementById('issueFilterType').value = 'all';
            filterIssues();
        }
                
        // 运行质量检查（优化版）
        async function runQualityCheck() {
            if (isCheckingQuality) {
                showNotification('warning', '检查中', '质量检查正在进行中，请稍候');
                return;
            }
                    
            if (!AppState.project || !AppState.project.translationItems || AppState.project.translationItems.length === 0) {
                showNotification('warning', '无数据', '请先加载项目或添加翻译项');
                return;
            }
                    
            isCheckingQuality = true;
            const items = AppState.project.translationItems;
            const progressBar = document.getElementById('checkProgressBar');
            const progressPercent = document.getElementById('checkProgressPercent');
            const progressStatus = document.getElementById('checkProgressStatus');
            const progressContainer = document.getElementById('qualityCheckProgress');
            const runBtn = document.getElementById('runQualityCheckBtn');
                    
            // 禁用按钮
            if (runBtn) {
                runBtn.disabled = true;
                const icon = document.createElement('i');
                icon.className = 'fa fa-spinner fa-spin mr-2';
                runBtn.replaceChildren(icon, document.createTextNode('检查中...'));
            }
                    
            // 显示进度条
            progressContainer.classList.remove('hidden');
                    
            // 重置结果
            qualityCheckResults = {
                overallScore: 0,
                translatedCount: 0,
                totalCount: items.length,
                issues: [],
                termMatches: 0,
                lastCheckTime: new Date()
            };
                    
            try {
                // 使用分批处理，每批处理 50 个项目
                const batchSize = 50;
                const batches = Math.ceil(items.length / batchSize);
                        
                for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
                    const start = batchIndex * batchSize;
                    const end = Math.min(start + batchSize, items.length);
                    const batch = items.slice(start, end);
                            
                    // 处理当前批次
                    const batchResults = await processBatch(batch);
                            
                    // 合并结果
                    qualityCheckResults.translatedCount += batchResults.translatedCount;
                    qualityCheckResults.issues.push(...batchResults.issues);
                    qualityCheckResults.termMatches += batchResults.termMatches;
                            
                    // 更新进度
                    const progress = Math.round((end / items.length) * 100);
                    progressBar.style.width = `${progress}%`;
                    progressPercent.textContent = `${progress}%`;
                    progressStatus.textContent = `已检查 ${end}/${items.length} 项...`;
                            
                    // 让浏览器有机会更新UI
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                        
                // 计算总体评分
                calculateOverallScore();
                        
                // 隐藏进度条
                setTimeout(() => {
                    progressContainer.classList.add('hidden');
                            
                    // 更新UI
                    updateQualityReportUI();
                            
                    showNotification('success', '检查完成', `已完成 ${items.length} 项翻译的质量检查，发现 ${qualityCheckResults.issues.length} 个问题`);
                }, 300);
                        
            } catch (error) {
                console.error('质量检查错误:', error);
                showNotification('error', '检查失败', `质量检查过程中出错: ${error.message}`);
                progressContainer.classList.add('hidden');
            } finally {
                isCheckingQuality = false;
                        
                // 恢复按钮
                if (runBtn) {
                    runBtn.disabled = false;
                    const icon = document.createElement('i');
                    icon.className = 'fa fa-refresh mr-2';
                    runBtn.replaceChildren(icon, document.createTextNode('重新检查'));
                }
            }
        }
                
        // 批处理函数
        async function processBatch(items) {
            const batchResults = {
                translatedCount: 0,
                issues: [],
                termMatches: 0
            };
                    
            // 并行处理批次中的所有项目
            const promises = items.map(item => checkTranslationItemCached(item));
            const results = await Promise.all(promises);
                    
            // 汇总结果
            results.forEach(result => {
                if (result.isTranslated) {
                    batchResults.translatedCount++;
                }
                batchResults.issues.push(...result.issues);
                batchResults.termMatches += result.termMatches;
            });
                    
            return batchResults;
        }
                
        // 带缓存的检查函数
        async function checkTranslationItemCached(item) {
            // 生成缓存键
            const cacheKey = `${item.id}-${item.sourceText}-${item.targetText}`;
                    
            // 检查缓存
            if (qualityCheckCache.has(cacheKey)) {
                return qualityCheckCache.get(cacheKey);
            }
                    
            // 执行检查
            const result = await checkTranslationItemOptimized(item);
                    
            // 存入缓存（最多缓存 1000 个项目）
            if (qualityCheckCache.size < 1000) {
                qualityCheckCache.set(cacheKey, result);
            }
                    
            return result;
        }
                
        // 优化的检查函数
        async function checkTranslationItemOptimized(item) {
            const result = {
                isTranslated: false,
                issues: [],
                termMatches: 0
            };
                    
            // 检查1：空译文检查
            if (!item.targetText || item.targetText.trim() === '') {
                if (item.sourceText && item.sourceText.trim() !== '') {
                    result.issues.push({
                        itemId: item.id,
                        sourceText: item.sourceText,
                        targetText: '',
                        type: 'empty',
                        typeName: '空译文',
                        severity: 'high',
                        description: '该项尚未翻译'
                    });
                }
                return result;
            }
                    
            result.isTranslated = true;
                    
            // 预计算常用值
            const sourceLength = item.sourceText.length;
            const targetLength = item.targetText.length;
            const lengthRatio = sourceLength > 0 ? targetLength / sourceLength : 0;
                    
            // 检查2：长度检查（优化阈值）
            if (lengthRatio < 0.3 || lengthRatio > 3) {
                result.issues.push({
                    itemId: item.id,
                    sourceText: item.sourceText,
                    targetText: item.targetText,
                    type: 'length',
                    typeName: '长度异常',
                    severity: lengthRatio < 0.2 || lengthRatio > 4 ? 'high' : 'medium',
                    description: `译文长度比例异常（${lengthRatio.toFixed(2)}x）`
                });
            }
                    
            // 检查3：术语一致性检查（仅检查前100个术语）
            if (AppState.terminology.list && AppState.terminology.list.length > 0) {
                const termsToCheck = AppState.terminology.list.slice(0, 100);
                        
                for (const term of termsToCheck) {
                    // 使用简单的字符串匹配而不是正则
                    const sourceLower = item.sourceText.toLowerCase();
                    const termSourceLower = term.source.toLowerCase();
                            
                    if (sourceLower.includes(termSourceLower)) {
                        result.termMatches++;
                                
                        const targetLower = item.targetText.toLowerCase();
                        const termTargetLower = term.target.toLowerCase();
                                
                        if (!targetLower.includes(termTargetLower)) {
                            result.issues.push({
                                itemId: item.id,
                                sourceText: item.sourceText,
                                targetText: item.targetText,
                                type: 'terminology',
                                typeName: '术语不一致',
                                severity: 'medium',
                                description: `应使用术语“${term.target}”替代“${term.source}”`
                            });
                        }
                        break; // 每个项目只检查一次术语匹配
                    }
                }
            }
                    
            // 检查4：变量检查（优化的正则）
            const variableChecks = [
                { pattern: /\{\{[^}]+\}\}/g, name: '{{}}' },
                { pattern: /\{[^}]+\}/g, name: '{}' },
                { pattern: /%[sd]/g, name: '%s/%d' }
            ];
                    
            for (const check of variableChecks) {
                const sourceVars = item.sourceText.match(check.pattern);
                const targetVars = item.targetText.match(check.pattern);
                const sourceCount = sourceVars ? sourceVars.length : 0;
                const targetCount = targetVars ? targetVars.length : 0;
                        
                if (sourceCount !== targetCount) {
                    result.issues.push({
                        itemId: item.id,
                        sourceText: item.sourceText,
                        targetText: item.targetText,
                        type: 'variable',
                        typeName: '变量丢失',
                        severity: 'high',
                        description: `${check.name}变量数量不匹配：原文${sourceCount}个，译文${targetCount}个`
                    });
                    break; // 发现问题后不再检查其他类型
                }
            }
                    
            // 检查5：HTML标签检查（简化版）
            const sourceTagCount = (item.sourceText.match(/<[^>]+>/g) || []).length;
            const targetTagCount = (item.targetText.match(/<[^>]+>/g) || []).length;
                    
            if (sourceTagCount > 0 && sourceTagCount !== targetTagCount) {
                result.issues.push({
                    itemId: item.id,
                    sourceText: item.sourceText,
                    targetText: item.targetText,
                    type: 'format',
                    typeName: '标签数量不匹配',
                    severity: 'medium',
                    description: `HTML标签数量不匹配：原文${sourceTagCount}个，译文${targetTagCount}个`
                });
            }
                    
            return result;
        }
        
        // 转义正则表达式特殊字符
        function escapeRegex(text) {
            return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        // 计算总体评分
        function calculateOverallScore() {
            const totalItems = qualityCheckResults.totalCount;
            const translatedItems = qualityCheckResults.translatedCount;
            const issues = qualityCheckResults.issues;
            
            if (totalItems === 0) {
                qualityCheckResults.overallScore = 0;
                return;
            }
            
            // 基础分：翻译完成度
            let score = (translatedItems / totalItems) * 60;
            
            // 质量分：根据问题扣分
            const highIssues = issues.filter(i => i.severity === 'high').length;
            const mediumIssues = issues.filter(i => i.severity === 'medium').length;
            const lowIssues = issues.filter(i => i.severity === 'low').length;
            
            const qualityPenalty = (highIssues * 3) + (mediumIssues * 1.5) + (lowIssues * 0.5);
            const qualityScore = Math.max(0, 40 - qualityPenalty);
            
            score += qualityScore;
            
            qualityCheckResults.overallScore = Math.min(100, Math.round(score));
        }
        
        // 更新质量报告UI
        function updateQualityReportUI() {
            const results = qualityCheckResults;
            
            // 更新概览统计
            document.getElementById('overallScore').textContent = `${results.overallScore}/100`;
            document.getElementById('overallScoreBar').style.width = `${results.overallScore}%`;
            
            const translatedPercent = results.totalCount > 0 ? Math.round((results.translatedCount / results.totalCount) * 100) : 0;
            document.getElementById('translatedCount').textContent = `${results.translatedCount}/${results.totalCount}`;
            document.getElementById('translatedBar').style.width = `${translatedPercent}%`;
            
            document.getElementById('issuesCount').textContent = results.issues.length;
            
            const highIssues = results.issues.filter(i => i.severity === 'high').length;
            const mediumIssues = results.issues.filter(i => i.severity === 'medium').length;
            const lowIssues = results.issues.filter(i => i.severity === 'low').length;
            
            document.getElementById('highIssues').textContent = highIssues;
            document.getElementById('mediumIssues').textContent = mediumIssues;
            document.getElementById('lowIssues').textContent = lowIssues;
            
            const termConsistency = results.termMatches > 0 ? 100 : 0;
            document.getElementById('termConsistency').textContent = `${termConsistency}%`;
            document.getElementById('termMatches').textContent = results.termMatches;
            
            // 更新最后检查时间
            if (results.lastCheckTime) {
                const timeStr = results.lastCheckTime.toLocaleString('zh-CN');
                document.getElementById('lastCheckTime').textContent = timeStr;
            }
            
            // 更新问题列表
            updateIssuesTable();
            
            // 更新图表
            updateQualityCharts();
        }
        
        // 更新问题列表（优化版）
        function updateIssuesTable(filter = { severity: 'all', type: 'all' }) {
            const tbody = document.getElementById('issuesTableBody');
            const issueCountBadge = document.getElementById('issueCountBadge');
            const issues = qualityCheckResults.issues;

            if (!tbody) return;

            EventManager.pruneDisconnected();

            // 表格每次重绘会替换 DOM；清理旧按钮的监听器记录，避免 EventManager.listeners 累积
            const oldFocusButtons = tbody.querySelectorAll('button[data-action="focusTranslationItem"]');
            oldFocusButtons.forEach(btn => {
                EventManager.removeByTarget(btn);
            });
            
            // 过滤问题
            let filteredIssues = issues;
            
            if (filter.severity !== 'all') {
                filteredIssues = filteredIssues.filter(i => i.severity === filter.severity);
            }
            
            if (filter.type !== 'all') {
                filteredIssues = filteredIssues.filter(i => i.type === filter.type);
            }
            
            // 更新问题数量徽章
            if (issueCountBadge) {
                const totalIssues = qualityCheckResults.issues.length;
                const filteredCount = filteredIssues.length;
                
                if (filter.severity !== 'all' || filter.type !== 'all') {
                    // 显示筛选后的数量
                    issueCountBadge.textContent = `${filteredCount} / ${totalIssues} 个问题`;
                    issueCountBadge.className = 'px-2.5 py-1 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 text-xs font-semibold rounded-full';
                } else {
                    // 显示总数
                    issueCountBadge.textContent = `${totalIssues} 个问题`;
                    issueCountBadge.className = totalIssues > 0 
                        ? 'px-2.5 py-1 bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full'
                        : 'px-2.5 py-1 bg-green-100 dark:bg-emerald-500/20 text-green-700 dark:text-emerald-400 text-xs font-semibold rounded-full';
                }
            }
            
            if (filteredIssues.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 6;
                td.className = 'px-4 py-8 text-center text-gray-500 dark:text-gray-400';

                const icon = document.createElement('i');
                icon.className = 'fa fa-check-circle text-3xl text-green-300 dark:text-green-400 mb-2 block';

                const p1 = document.createElement('p');
                p1.textContent = '暂无问题';

                const p2 = document.createElement('p');
                p2.className = 'text-sm mt-1';
                p2.textContent = '所有翻译项均通过质量检查';

                td.appendChild(icon);
                td.appendChild(p1);
                td.appendChild(p2);
                tr.appendChild(td);

                tbody.replaceChildren(tr);
                return;
            }
            
            // 使用文档片段批量插入，减少DOM操作
            const fragment = document.createDocumentFragment();
            
            // 只显示前 200 个问题，避免大量DOM导致卡顿
            const maxDisplay = 200;
            const displayIssues = filteredIssues.slice(0, maxDisplay);
            
            displayIssues.forEach(issue => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                
                const severityClass = {
                    'high': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
                    'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
                    'low': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                }[issue.severity];
                
                const severityText = {
                    'high': '高',
                    'medium': '中',
                    'low': '低'
                }[issue.severity];
                
                const td1 = document.createElement('td');
                td1.className = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate';
                td1.title = issue.sourceText;
                td1.textContent = truncateText(issue.sourceText, 50);

                const td2 = document.createElement('td');
                td2.className = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate';
                td2.title = issue.targetText;
                td2.textContent = truncateText(issue.targetText, 50);

                const td3 = document.createElement('td');
                td3.className = 'px-4 py-3 text-sm text-gray-900 dark:text-gray-100';
                td3.textContent = issue.typeName;

                const td4 = document.createElement('td');
                td4.className = 'px-4 py-3 text-sm';
                const span = document.createElement('span');
                span.className = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityClass}`;
                span.textContent = severityText;
                td4.appendChild(span);

                const td5 = document.createElement('td');
                td5.className = 'px-4 py-3 text-sm text-gray-600 dark:text-gray-300';
                td5.textContent = issue.description;

                const td6 = document.createElement('td');
                td6.className = 'px-4 py-3 text-sm text-gray-500 dark:text-gray-400';
                const btn = document.createElement('button');
                btn.className = 'text-primary hover:text-primary/80';
                btn.type = 'button';
                btn.dataset.action = 'focusTranslationItem';
                btn.textContent = '查看';
                EventManager.add(btn, 'click', () => focusTranslationItem(issue.itemId), { tag: 'quality', scope: 'qualityReport', label: `issueFocusBtn:${issue.itemId}:click` });
                td6.appendChild(btn);

                tr.appendChild(td1);
                tr.appendChild(td2);
                tr.appendChild(td3);
                tr.appendChild(td4);
                tr.appendChild(td5);
                tr.appendChild(td6);
                
                fragment.appendChild(tr);
            });
            
            // 一次性更新DOM
            tbody.replaceChildren(fragment);
            
            // 如果有更多问题，显示提示
            if (filteredIssues.length > maxDisplay) {
                const tr = document.createElement('tr');
                tr.className = 'bg-yellow-50 dark:bg-yellow-900/20 border-t-2 border-yellow-200 dark:border-yellow-700';

                const td = document.createElement('td');
                td.colSpan = 6;
                td.className = 'px-4 py-4 text-center';

                const container = document.createElement('div');
                container.className = 'flex flex-col items-center gap-2';

                const icon = document.createElement('i');
                icon.className = 'fa fa-exclamation-triangle text-yellow-500 dark:text-amber-400 text-2xl';

                const p1 = document.createElement('p');
                p1.className = 'text-sm font-medium text-gray-700 dark:text-gray-200';
                p1.appendChild(document.createTextNode('还有 '));
                const count = document.createElement('span');
                count.className = 'text-lg font-bold text-yellow-600 dark:text-amber-400';
                count.textContent = String(filteredIssues.length - maxDisplay);
                p1.appendChild(count);
                p1.appendChild(document.createTextNode(' 个问题未显示'));

                const p2 = document.createElement('p');
                p2.className = 'text-xs text-gray-600 dark:text-gray-400';
                const filterIcon = document.createElement('i');
                filterIcon.className = 'fa fa-filter mr-1';
                p2.appendChild(filterIcon);
                p2.appendChild(document.createTextNode('请使用上方的 '));
                const strong = document.createElement('span');
                strong.className = 'font-semibold text-primary';
                strong.textContent = '“筛选条件”';
                p2.appendChild(strong);
                p2.appendChild(document.createTextNode(' 下拉框细化查看'));

                container.appendChild(icon);
                container.appendChild(p1);
                container.appendChild(p2);
                td.appendChild(container);
                tr.appendChild(td);
                tbody.appendChild(tr);
            }
        }
        
        // 过滤问题（节流版）
        const filterIssuesThrottled = throttle(function() {
            const severity = document.getElementById('issueFilterSeverity').value;
            const type = document.getElementById('issueFilterType').value;
            
            updateIssuesTable({ severity, type });
        }, 300);
        
        function filterIssues() {
            filterIssuesThrottled();
        }
        
        // 定位到翻译项
        function focusTranslationItem(itemId) {
            // 关闭质量报告模态框
            closeModal('qualityReportModal');
            
            // 根据 itemId 找到对应的 index
            const index = AppState.project.translationItems.findIndex(item => item.id === itemId);
            
            if (index === -1) {
                console.error('未找到翻译项:', itemId);
                return;
            }
            
            // 计算该项所在的页码
            const itemsPerPage = AppState.translations.itemsPerPage;
            const targetPage = Math.floor(index / itemsPerPage) + 1;
            
            // 如果不在当前页，先切换到目标页
            if (AppState.translations.currentPage !== targetPage) {
                console.log(`切换到第 ${targetPage} 页以显示索引 ${index} 的项`);
                AppState.translations.currentPage = targetPage;
                updateTranslationLists();
            }
            
            // 选中该翻译项
            selectTranslationItem(index);
            
            // 等待 DOM 更新后滚动并高亮
            setTimeout(() => {
                const sourceList = document.getElementById('sourceList');
                const targetList = document.getElementById('targetList');
                const sourceItem = sourceList ? sourceList.querySelector(`[data-index="${index}"]`) : null;
                const targetItem = targetList ? targetList.querySelector(`[data-index="${index}"]`) : null;
                
                if (sourceItem && targetItem) {
                    // 滚动到可视区域
                    sourceItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // 添加高亮效果
                    sourceItem.classList.add('bg-yellow-100', 'dark:bg-yellow-900/20');
                    targetItem.classList.add('bg-yellow-100', 'dark:bg-yellow-900/20');
                    
                    // 3秒后移除高亮
                    setTimeout(() => {
                        sourceItem.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/20');
                        targetItem.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/20');
                    }, 3000);
                } else {
                    console.error('未找到 DOM 元素:', index, '当前页:', AppState.translations.currentPage, '目标页:', targetPage);
                }
            }, 500); // 增加延迟以确保DOM完全更新
        }
        
        // 更新质量图表
        function updateQualityCharts() {
            const results = qualityCheckResults;
            const issues = results.issues;
            
            // 计算各项指标
            const emptyIssues = issues.filter(i => i.type === 'empty').length;
            const termIssues = issues.filter(i => i.type === 'terminology').length;
            const formatIssues = issues.filter(i => i.type === 'format').length;
            const lengthIssues = issues.filter(i => i.type === 'length').length;
            const varIssues = issues.filter(i => i.type === 'variable').length;
            
            const totalChecked = results.translatedCount;
            
            const accuracyScore = totalChecked > 0 ? Math.round((1 - emptyIssues / totalChecked) * 100) : 100;
            const termScore = totalChecked > 0 ? Math.round((1 - termIssues / totalChecked) * 100) : 100;
            const formatScore = totalChecked > 0 ? Math.round((1 - formatIssues / totalChecked) * 100) : 100;
            const lengthScore = totalChecked > 0 ? Math.round((1 - lengthIssues / totalChecked) * 100) : 100;
            const varScore = totalChecked > 0 ? Math.round((1 - varIssues / totalChecked) * 100) : 100;

            const isDarkMode = document.body.classList.contains('dark-mode');
            const chartTextColor = isDarkMode ? '#e5e7eb' : '#374151';
            const chartGridColor = isDarkMode ? 'rgba(229, 231, 235, 0.2)' : 'rgba(55, 65, 81, 0.2)';
            
            // 更新准确性图表
            const ChartCtor = window.Chart;
            if (typeof ChartCtor !== 'function') return;

            const accuracyEl = document.getElementById('accuracyChart');
            if (!accuracyEl || typeof accuracyEl.getContext !== 'function') return;
            const accuracyCtx = accuracyEl.getContext('2d');
            if (!accuracyCtx) return;
            if (qualityCheckCharts.accuracy) {
                qualityCheckCharts.accuracy.destroy();
            }
            qualityCheckCharts.accuracy = new ChartCtor(accuracyCtx, {
                type: 'radar',
                data: {
                    labels: ['准确性', '术语一致性', '格式保持', '长度合理', '变量完整'],
                    datasets: [{
                        label: '翻译质量',
                        data: [accuracyScore, termScore, formatScore, lengthScore, varScore],
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
                        pointRadius: 3
                    }]
                },
                options: {
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { stepSize: 20, color: chartTextColor, backdropColor: 'transparent' },
                            grid: { color: chartGridColor },
                            angleLines: { color: chartGridColor },
                            pointLabels: { color: chartTextColor }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
            
            // 更新一致性图表
            const consistencyEl = document.getElementById('consistencyChart');
            if (!consistencyEl || typeof consistencyEl.getContext !== 'function') return;
            const consistencyCtx = consistencyEl.getContext('2d');
            if (!consistencyCtx) return;
            if (qualityCheckCharts.consistency) {
                qualityCheckCharts.consistency.destroy();
            }
            qualityCheckCharts.consistency = new ChartCtor(consistencyCtx, {
                type: 'bar',
                data: {
                    labels: ['术语一致性', '格式一致性', '变量一致性'],
                    datasets: [{
                        label: '一致性评分',
                        data: [termScore, formatScore, varScore],
                        backgroundColor: [
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(16, 185, 129, 0.7)',
                            'rgba(37, 99, 235, 0.7)'
                        ],
                        borderColor: [
                            'rgba(245, 158, 11, 1)',
                            'rgba(16, 185, 129, 1)',
                            'rgba(37, 99, 235, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        x: {
                            ticks: { color: chartTextColor },
                            grid: { color: chartGridColor }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color: chartTextColor },
                            grid: { color: chartGridColor }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
        
        // 导出质量报告
        function exportQualityReportData() {
            const results = qualityCheckResults;
            
            const report = {
                generatedAt: new Date().toISOString(),
                projectName: AppState.project?.name || '未命名项目',
                summary: {
                    overallScore: results.overallScore,
                    totalItems: results.totalCount,
                    translatedItems: results.translatedCount,
                    issuesCount: results.issues.length,
                    termMatches: results.termMatches
                },
                issues: results.issues.map(issue => ({
                    sourceText: issue.sourceText,
                    targetText: issue.targetText,
                    type: issue.typeName,
                    severity: issue.severity,
                    description: issue.description
                }))
            };
            
            const content = JSON.stringify(report, null, 2);
            const filename = `quality-report-${AppState.project?.name || 'project'}-${Date.now()}.json`;
            
            downloadFile(content, filename);
            showNotification('success', '导出成功', '质量报告已导出');
        }
        

