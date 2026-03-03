// ==================== 翻译记忆库 (Translation Memory) ====================
// 跨项目存储和复用已翻译条目，支持精确匹配和模糊匹配

var TranslationMemory = (function () {
  var DB_NAME = "translation-memory-db";
  var DB_VERSION = 1;
  var STORE_NAME = "entries";

  var _db = null;
  var _opening = null;

  // ==================== 工具函数 ====================

  /**
   * 计算字符串的简单哈希值（用于精确匹配快速查找）
   */
  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return hash.toString(36);
  }

  /**
   * 标准化文本（去除多余空白，统一换行）
   */
  function normalizeText(text) {
    return (text || "").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  }

  /**
   * Levenshtein 编辑距离（用于模糊匹配）
   */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (a.length > b.length) { var t = a; a = b; b = t; }

    var aLen = a.length, bLen = b.length;
    // 超长文本跳过模糊匹配
    if (aLen > 500 || bLen > 500) return Math.abs(aLen - bLen);

    var prev = new Array(aLen + 1);
    var curr = new Array(aLen + 1);
    for (var i = 0; i <= aLen; i++) prev[i] = i;

    for (var j = 1; j <= bLen; j++) {
      curr[0] = j;
      for (var i = 1; i <= aLen; i++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[i] = Math.min(
          prev[i] + 1,      // 删除
          curr[i - 1] + 1,  // 插入
          prev[i - 1] + cost // 替换
        );
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[aLen];
  }

  /**
   * 相似度（0-100），基于编辑距离
   */
  function similarity(a, b) {
    var na = normalizeText(a);
    var nb = normalizeText(b);
    if (na === nb) return 100;
    if (!na || !nb) return 0;
    var dist = levenshtein(na, nb);
    var maxLen = Math.max(na.length, nb.length);
    return Math.round((1 - dist / maxLen) * 100);
  }

  // ==================== 数据库操作 ====================

  function openDB() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;

    _opening = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
          store.createIndex("lookup", ["sourceHash", "sourceLang", "targetLang"], { unique: false });
          store.createIndex("langPair", ["sourceLang", "targetLang"], { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = function (event) {
        _db = event.target.result;
        _opening = null;
        _db.onversionchange = function () {
          try { _db.close(); } catch (e) {}
          _db = null;
        };
        resolve(_db);
      };

      request.onerror = function () {
        _opening = null;
        reject(request.error || new Error("翻译记忆库数据库打开失败"));
      };
    });

    return _opening;
  }

  function withStore(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(STORE_NAME, mode);
          var store = tx.objectStore(STORE_NAME);
          fn(store, resolve, reject);
          tx.onerror = function () { reject(tx.error); };
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  // ==================== 公共 API ====================

  return {
    /**
     * 保存翻译对到记忆库
     */
    save: function (sourceText, targetText, sourceLang, targetLang, meta) {
      if (!sourceText || !targetText) return Promise.resolve(null);
      var normalized = normalizeText(sourceText);
      var hash = hashString(normalized + "|" + sourceLang + "|" + targetLang);
      var now = Date.now();
      meta = meta || {};

      // 先检查是否已存在（精确匹配）
      return this.lookupExact(sourceText, sourceLang, targetLang).then(function (existing) {
        return withStore("readwrite", function (store, resolve, reject) {
          if (existing) {
            // 更新已有记录
            existing.targetText = targetText;
            existing.updatedAt = now;
            existing.usageCount = (existing.usageCount || 0) + 1;
            if (meta.engine) existing.engine = meta.engine;
            if (meta.quality) existing.quality = meta.quality;
            if (meta.project) existing.lastProject = meta.project;
            var req = store.put(existing);
            req.onsuccess = function () { resolve(existing); };
          } else {
            // 新增记录
            var entry = {
              sourceText: normalized,
              targetText: targetText,
              sourceLang: sourceLang,
              targetLang: targetLang,
              sourceHash: hash,
              engine: meta.engine || "",
              quality: meta.quality || 85,
              usageCount: 1,
              lastProject: meta.project || "",
              createdAt: now,
              updatedAt: now,
            };
            var req = store.add(entry);
            req.onsuccess = function () {
              entry.id = req.result;
              resolve(entry);
            };
          }
        });
      });
    },

    /**
     * 批量保存翻译对
     */
    saveBatch: function (pairs, sourceLang, targetLang, meta) {
      var self = this;
      var saved = 0;
      var chain = Promise.resolve();
      pairs.forEach(function (pair) {
        chain = chain.then(function () {
          return self.save(pair.sourceText, pair.targetText, sourceLang, targetLang, meta).then(function () {
            saved++;
          });
        });
      });
      return chain.then(function () { return saved; });
    },

    /**
     * 精确匹配查找
     */
    lookupExact: function (sourceText, sourceLang, targetLang) {
      var normalized = normalizeText(sourceText);
      var hash = hashString(normalized + "|" + sourceLang + "|" + targetLang);

      return withStore("readonly", function (store, resolve) {
        var index = store.index("lookup");
        var req = index.openCursor(IDBKeyRange.only([hash, sourceLang, targetLang]));
        var found = null;
        req.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            // 校验实际文本（防哈希碰撞）
            if (normalizeText(cursor.value.sourceText) === normalized) {
              found = cursor.value;
            }
            cursor.continue();
          } else {
            resolve(found);
          }
        };
      });
    },

    /**
     * 模糊匹配查找（返回相似度 >= threshold 的条目）
     */
    fuzzyMatch: function (sourceText, sourceLang, targetLang, threshold) {
      threshold = threshold || 70;
      var normalized = normalizeText(sourceText);
      if (!normalized) return Promise.resolve([]);

      return withStore("readonly", function (store, resolve) {
        var index = store.index("langPair");
        var req = index.openCursor(IDBKeyRange.only([sourceLang, targetLang]));
        var matches = [];
        var scanned = 0;
        var MAX_SCAN = 5000; // 限制扫描数量

        req.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor && scanned < MAX_SCAN) {
            scanned++;
            var entry = cursor.value;
            var score = similarity(normalized, entry.sourceText);
            if (score >= threshold) {
              matches.push({
                entry: entry,
                similarity: score,
              });
            }
            cursor.continue();
          } else {
            // 按相似度降序排列
            matches.sort(function (a, b) { return b.similarity - a.similarity; });
            resolve(matches.slice(0, 10)); // 最多返回10个
          }
        };
      });
    },

    /**
     * 查找（先精确，无匹配则模糊）
     */
    lookup: function (sourceText, sourceLang, targetLang, fuzzyThreshold) {
      var self = this;
      return this.lookupExact(sourceText, sourceLang, targetLang).then(function (exact) {
        if (exact) {
          return { match: exact, type: "exact", similarity: 100 };
        }
        if (fuzzyThreshold === 0) return null; // 禁用模糊匹配
        return self.fuzzyMatch(sourceText, sourceLang, targetLang, fuzzyThreshold || 70).then(function (fuzzy) {
          if (fuzzy.length > 0) {
            return { match: fuzzy[0].entry, type: "fuzzy", similarity: fuzzy[0].similarity, alternatives: fuzzy.slice(1) };
          }
          return null;
        });
      });
    },

    /**
     * 获取统计信息
     */
    getStats: function () {
      return withStore("readonly", function (store, resolve) {
        var stats = { total: 0, languages: new Set(), engines: new Set() };
        var req = store.openCursor();
        req.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            stats.total++;
            stats.languages.add(cursor.value.sourceLang);
            stats.languages.add(cursor.value.targetLang);
            if (cursor.value.engine) stats.engines.add(cursor.value.engine);
            cursor.continue();
          } else {
            stats.languages = Array.from(stats.languages);
            stats.engines = Array.from(stats.engines);
            resolve(stats);
          }
        };
      });
    },

    /**
     * 导出为 TMX 格式
     */
    exportTMX: function () {
      return withStore("readonly", function (store, resolve) {
        var entries = [];
        var req = store.openCursor();
        req.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            entries.push(cursor.value);
            cursor.continue();
          } else {
            var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<tmx version="1.4">\n';
            xml += '  <header creationtool="translation-tool" creationtoolversion="1.2.2" segtype="sentence" o-tmf="translation-tool" adminlang="zh" srclang="*all*" datatype="plaintext"/>\n';
            xml += '  <body>\n';
            entries.forEach(function (e) {
              var srcEscaped = e.sourceText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              var tgtEscaped = e.targetText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              xml += '    <tu>\n';
              xml += '      <tuv xml:lang="' + e.sourceLang + '"><seg>' + srcEscaped + '</seg></tuv>\n';
              xml += '      <tuv xml:lang="' + e.targetLang + '"><seg>' + tgtEscaped + '</seg></tuv>\n';
              xml += '    </tu>\n';
            });
            xml += '  </body>\n';
            xml += '</tmx>';
            resolve(xml);
          }
        };
      });
    },

    /**
     * 清空记忆库
     */
    clear: function () {
      return withStore("readwrite", function (store, resolve) {
        var req = store.clear();
        req.onsuccess = function () { resolve(); };
      });
    },

    /**
     * 获取条目总数
     */
    count: function () {
      return withStore("readonly", function (store, resolve) {
        var req = store.count();
        req.onsuccess = function () { resolve(req.result); };
      });
    },

    // 暴露工具函数供测试使用
    _normalizeText: normalizeText,
    _hashString: hashString,
    _similarity: similarity,
  };
})();

window.TranslationMemory = TranslationMemory;
