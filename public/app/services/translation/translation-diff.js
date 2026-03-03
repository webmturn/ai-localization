// ==================== 增量翻译 Diff ====================
// 检测源文件变更，标记需要重新翻译的条目

var TranslationDiff = (function () {
  var SNAPSHOT_KEY = "__translationSnapshots";

  /**
   * 计算文本的简单哈希（与 TM 中保持一致的方式）
   */
  function hashText(text) {
    var s = (text || "").replace(/\s+/g, " ").trim();
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  /**
   * 为当前翻译项创建源文本快照
   * @param {string} snapshotId - 快照 ID（通常为文件名或项目名）
   * @param {Array} items - 翻译项数组
   */
  function createSnapshot(snapshotId, items) {
    var snapshot = {};
    items.forEach(function (item, index) {
      var key = item.id || item.metadata?.resourceId || ("idx-" + index);
      snapshot[key] = {
        hash: hashText(item.sourceText),
        sourceText: (item.sourceText || "").substring(0, 100), // 前 100 字符用于调试
      };
    });

    try {
      var all = _loadAll();
      all[snapshotId] = {
        data: snapshot,
        itemCount: items.length,
        timestamp: Date.now(),
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
    } catch (e) {
      (loggers.translation || console).debug("TranslationDiff createSnapshot:", e);
    }

    return snapshot;
  }

  /**
   * 比较当前翻译项与快照，返回变更列表
   * @param {string} snapshotId - 快照 ID
   * @param {Array} items - 当前翻译项数组
   * @returns {Object} 差异结果
   */
  function compare(snapshotId, items) {
    var all = _loadAll();
    var savedSnapshot = all[snapshotId];

    if (!savedSnapshot) {
      return {
        hasSnapshot: false,
        changed: [],
        added: [],
        removed: [],
        unchanged: [],
        summary: "无历史快照，首次导入",
      };
    }

    var oldData = savedSnapshot.data;
    var changed = [];
    var added = [];
    var unchanged = [];
    var seenKeys = new Set();

    items.forEach(function (item, index) {
      var key = item.id || item.metadata?.resourceId || ("idx-" + index);
      seenKeys.add(key);
      var currentHash = hashText(item.sourceText);

      if (!oldData[key]) {
        added.push({
          index: index,
          key: key,
          item: item,
          type: "added",
        });
      } else if (oldData[key].hash !== currentHash) {
        changed.push({
          index: index,
          key: key,
          item: item,
          type: "changed",
          oldPreview: oldData[key].sourceText,
          newPreview: (item.sourceText || "").substring(0, 100),
        });
      } else {
        unchanged.push({
          index: index,
          key: key,
          item: item,
          type: "unchanged",
        });
      }
    });

    // 检测删除的条目
    var removed = [];
    for (var key in oldData) {
      if (oldData.hasOwnProperty(key) && !seenKeys.has(key)) {
        removed.push({
          key: key,
          type: "removed",
          oldPreview: oldData[key].sourceText,
        });
      }
    }

    var summary = _buildSummary(changed, added, removed, unchanged);

    return {
      hasSnapshot: true,
      changed: changed,
      added: added,
      removed: removed,
      unchanged: unchanged,
      summary: summary,
      snapshotDate: new Date(savedSnapshot.timestamp).toLocaleString(),
    };
  }

  /**
   * 标记需要重新翻译的条目
   * @param {Array} items - 翻译项数组
   * @param {Object} diffResult - compare() 的返回值
   * @param {Object} [options] - 选项
   * @param {boolean} [options.markChanged] - 是否标记变更项为 pending（默认 true）
   * @param {boolean} [options.markAdded] - 是否标记新增项为 pending（默认 true）
   * @returns {number} 被标记的条目数
   */
  function markForRetranslation(items, diffResult, options) {
    options = options || {};
    var markChanged = options.markChanged !== false;
    var markAdded = options.markAdded !== false;
    var marked = 0;

    if (markChanged) {
      diffResult.changed.forEach(function (c) {
        if (items[c.index]) {
          items[c.index].status = "pending";
          items[c.index]._diffStatus = "changed";
          marked++;
        }
      });
    }

    if (markAdded) {
      diffResult.added.forEach(function (a) {
        if (items[a.index]) {
          items[a.index].status = "pending";
          items[a.index]._diffStatus = "added";
          marked++;
        }
      });
    }

    return marked;
  }

  /**
   * 获取所有快照列表
   */
  function listSnapshots() {
    var all = _loadAll();
    var list = [];
    for (var key in all) {
      if (all.hasOwnProperty(key)) {
        list.push({
          id: key,
          itemCount: all[key].itemCount,
          timestamp: all[key].timestamp,
          date: new Date(all[key].timestamp).toLocaleString(),
        });
      }
    }
    return list.sort(function (a, b) { return b.timestamp - a.timestamp; });
  }

  /**
   * 删除快照
   */
  function removeSnapshot(snapshotId) {
    try {
      var all = _loadAll();
      delete all[snapshotId];
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
    } catch (e) {
      // ignore
    }
  }

  /**
   * 清除所有快照
   */
  function clearAll() {
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch (e) {
      // ignore
    }
  }

  // ==================== 内部 ====================

  function _loadAll() {
    try {
      var raw = localStorage.getItem(SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function _buildSummary(changed, added, removed, unchanged) {
    var parts = [];
    if (changed.length) parts.push(changed.length + " 条源文本已变更（需重译）");
    if (added.length) parts.push(added.length + " 条新增");
    if (removed.length) parts.push(removed.length + " 条已删除");
    if (unchanged.length) parts.push(unchanged.length + " 条未变化");
    if (!parts.length) return "无变化";
    return parts.join("，");
  }

  return {
    createSnapshot: createSnapshot,
    compare: compare,
    markForRetranslation: markForRetranslation,
    listSnapshots: listSnapshots,
    removeSnapshot: removeSnapshot,
    clearAll: clearAll,
    // 暴露供测试使用
    _hashText: hashText,
  };
})();

window.TranslationDiff = TranslationDiff;
