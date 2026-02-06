# P1-2 移除重复代码 - 实施计划

**任务**: P1 - 移除重复代码  
**目标**: 使用已创建的通用处理器  
**日期**: 2026-02-06  
**状态**: 🚀 开始实施

---

## 📋 重复代码识别

### 1. UI更新代码重复

**模式**:
```javascript
rebuildFilteredTranslationItems();
updateTranslationLists();
updateCounters();
updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
```

**出现位置** (9处):
- `actions.js:480` - 批量更新
- `actions.js:558` - 批量更新
- `actions.js:677-680` - translateSelectedFallback
- `actions.js:839-842` - translateAll
- `actions.js:1082-1084` - retryFailedTranslations
- `actions.js:1157-1159` - 另一处

**解决方案**: 使用 `updateTranslationUI()` from `ui-updates.js`

---

### 2. 翻译结果处理代码重复

**模式**:
```javascript
const actualErrors = errors.filter((e) => e.error !== "用户取消");
const cancelledCount = errors.filter((e) => e.error === "用户取消").length;

AppState.translations.lastFailedItems = actualErrors.map((e) => e?.item).filter(Boolean);

if (!AppState.translations.isInProgress && cancelledCount > 0) {
  showNotification("info", "翻译已取消", `已翻译 ${results.length} 项...`);
} else if (actualErrors.length === 0) {
  showNotification("success", "翻译完成", `已成功翻译 ${results.length} 项`);
} else {
  // 显示部分完成通知
}
```

**出现位置** (至少3处):
- `translateSelectedFallback` 函数
- `translateAll` 函数  
- `retryFailedTranslations` 函数

**解决方案**: 使用 `TranslationResultHandler.handleTranslationResults()`

---

### 3. 验证逻辑重复

**模式**:
```javascript
if (!AppState.project || !Array.isArray(AppState.project.translationItems)) {
  showNotification("warning", "无项目", "请先上传文件或打开项目");
  return;
}
```

**出现位置**: 多个翻译相关函数

**解决方案**: 使用 `UniversalValidators.validateTranslationOperation()`

---

## 🎯 实施步骤

### 步骤 1: 替换 UI 更新代码

#### 1.1 在 actions.js 中导入/获取 UI 更新器

在文件顶部或函数内部：
```javascript
// 获取UI更新器
const uiUpdater = typeof getServiceSafely === 'function'
  ? getServiceSafely('translationUIUpdater')
  : null;
```

#### 1.2 替换所有重复的 UI 更新调用

**替换前**:
```javascript
rebuildFilteredTranslationItems();
updateTranslationLists();
updateCounters();
updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
```

**替换后**:
```javascript
// 使用统一的UI更新器
if (typeof updateTranslationUI === 'function') {
  updateTranslationUI({
    shouldScroll: false,
    shouldFocusTextarea: false,
    reason: '翻译完成'
  });
} else {
  // 备用逻辑
  rebuildFilteredTranslationItems();
  updateTranslationLists();
  updateCounters();
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
}
```

**或者更简洁**:
```javascript
updateTranslationUI({
  shouldScroll: false,
  shouldFocusTextarea: false,
  reason: '翻译完成'
});
```

---

### 步骤 2: 使用结果处理器

#### 2.1 已完成的函数

以下函数已经使用了 `resultHandler.handleTranslationComplete()`:
- ✅ `translateSelectedFallback()` - 第698行
- ✅ `translateAll()` - 第860行

#### 2.2 需要更新的函数

检查 `retryFailedTranslations()` 是否也使用了结果处理器。

---

### 步骤 3: 应用验证器

在所有翻译函数开头添加验证：

```javascript
// 使用统一验证器
const validators = typeof getServiceSafely === 'function'
  ? getServiceSafely('universalValidators')
  : null;

if (validators) {
  const validationPassed = validators.safeValidate(() => {
    validators.validateTranslationOperation({
      requireItemSelection: true,
      requireFileSelection: false
    });
  }, { context: 'functionName' });
  
  if (!validationPassed) {
    return; // 验证失败，已经显示了错误消息
  }
}
```

---

## 🔧 具体修改清单

### 文件: `public/app/features/translations/actions.js`

#### 修改 1: 第677-680行 (translateSelectedFallback)

**位置**: 批量更新逻辑

**当前代码**:
```javascript
const updateUIIfNeeded = () => {
  translationCount++;
  if (translationCount % batchUpdateInterval === 0) {
    rebuildFilteredTranslationItems();
    updateTranslationLists();
    updateCounters();
  }
};
```

**修改为**:
```javascript
const updateUIIfNeeded = () => {
  translationCount++;
  if (translationCount % batchUpdateInterval === 0) {
    if (typeof updateTranslationUI === 'function') {
      updateTranslationUI({
        shouldScroll: false,
        shouldFocusTextarea: false,
        preserveSelection: true,
        reason: '批量翻译进度更新'
      });
    }
  }
};
```

#### 修改 2: 第839-842行 (translateAll)

**位置**: 批量更新逻辑

**当前代码**:
```javascript
const updateUIIfNeeded = () => {
  translationCount++;
  if (translationCount % batchUpdateInterval === 0) {
    console.log(`批量更新UI: 已翻译 ${translationCount} 条`);
    rebuildFilteredTranslationItems({ selectedFile });
    updateTranslationLists();
    updateCounters();
  }
};
```

**修改为**:
```javascript
const updateUIIfNeeded = () => {
  translationCount++;
  if (translationCount % batchUpdateInterval === 0) {
    const logger = window.loggers?.app || console;
    logger.debug?.(`批量更新UI: 已翻译 ${translationCount} 条`);
    
    if (typeof updateTranslationUI === 'function') {
      updateTranslationUI({
        selectedFile,
        shouldScroll: false,
        shouldFocusTextarea: false,
        preserveSelection: true,
        reason: '批量翻译进度更新'
      });
    }
  }
};
```

#### 修改 3: 检查 retryFailedTranslations

需要找到这个函数并应用相同的模式。

---

## 📊 预期效果

### 代码减少

- **UI更新代码**: 从 ~40行 减少到 ~10行 (减少75%)
- **结果处理代码**: 从 ~60行 减少到 ~15行 (减少75%)
- **验证代码**: 从 ~30行 减少到 ~10行 (减少67%)

### 总计减少

- **预计减少代码行数**: ~100行
- **函数调用统一**: 9处 UI 更新使用同一接口
- **可维护性**: 大幅提升，修改一处即可

---

## ✅ 验证清单

完成修改后需要验证：

- [ ] 所有翻译函数正常工作
- [ ] UI 更新正确显示
- [ ] 错误处理正确
- [ ] 通知消息显示正确
- [ ] 进度更新正常
- [ ] 没有回归问题

---

## 🚀 开始实施

立即开始修改 `actions.js` 文件...

