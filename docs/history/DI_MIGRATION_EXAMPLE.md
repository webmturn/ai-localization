# 架构系统集成 - 完整迁移示例

**文件**: `public/app/features/translations/actions.js`  
**函数**: `translateSelectedFallback()`  
**状态**: ✅ 已部分完成，需要完善

---

## 当前状态分析

### ✅ 已完成的部分

函数 `translateSelectedFallback()` (第584-700行) 已经实现了部分依赖注入：

```javascript
// ✅ 正确使用DI
const validators = getServiceSafely("universalValidators") || 
                   getUniversalValidators();

const resultHandler = getServiceSafely("translationResultHandler") || 
                      getTranslationResultHandler();

const appState = getServiceSafely('appState', 'AppState');
const translationService = getServiceSafely('translationService', 'translationService');
```

### ⚠️ 需要改进的部分

1. **直接访问 localStorage**
   ```javascript
   // ❌ 当前代码
   const settings = safeJsonParse(localStorage.getItem("translatorSettings"), {});
   
   // ✅ 应该通过服务
   const storageManager = getServiceSafely('storageManager', 'storageManager');
   const settings = storageManager?.getSettings() || {};
   ```

2. **直接调用全局函数**
   ```javascript
   // ❌ 当前代码
   showTranslationProgress();
   updateProgress(0, selectedItems.length, "准备翻译...");
   showNotification("error", "服务不可用", "验证器未加载");
   
   // ✅ 应该通过服务
   const notificationService = getServiceSafely('notificationService');
   notificationService.show("error", "服务不可用", "验证器未加载");
   ```

3. **混合使用新旧API**
   ```javascript
   // ⚠️ 需要统一
   updateTranslationControlState();  // 全局函数
   rebuildFilteredTranslationItems(); // 全局函数
   updateTranslationLists(); // 全局函数
   ```

---

## 完整迁移方案

### 步骤 1: 提取所有依赖服务

在函数开头统一获取所有需要的服务：

```javascript
async function translateSelectedFallback(deps = {}) {
  try {
    // ========== 获取所有依赖服务 ==========
    const services = {
      appState: deps.appState || getServiceSafely('appState', 'AppState'),
      translationService: deps.translationService || getServiceSafely('translationService', 'translationService'),
      storageManager: deps.storageManager || getServiceSafely('storageManager', 'storageManager'),
      validators: deps.validators || getServiceSafely('universalValidators') || getUniversalValidators(),
      resultHandler: deps.resultHandler || getServiceSafely('translationResultHandler') || getTranslationResultHandler(),
      uiUpdater: deps.uiUpdater || getServiceSafely('translationUIUpdater'),
      notificationService: deps.notificationService || getServiceSafely('notificationService'),
      errorManager: deps.errorManager || getServiceSafely('errorManager'),
      autoSaveManager: deps.autoSaveManager || getServiceSafely('autoSaveManager')
    };
    
    // 验证必要的服务
    if (!services.validators || typeof services.validators.safeValidate !== 'function') {
      services.notificationService?.show("error", "服务不可用", "验证器未加载");
      return;
    }
    
    if (!services.resultHandler || typeof services.resultHandler.handleTranslationComplete !== 'function') {
      services.notificationService?.show("error", "服务不可用", "结果处理器未加载");
      return;
    }
    
    if (!services.translationService) {
      services.notificationService?.show("error", "服务不可用", "翻译服务未加载");
      return;
    }
    
    // ... 继续使用 services 对象
  } catch (error) {
    const errorManager = getServiceSafely('errorManager');
    errorManager?.handleError(error, { context: 'translateSelectedFallback' });
  }
}
```

### 步骤 2: 使用服务对象替换全局访问

```javascript
// ========== 验证翻译操作的前置条件 ==========
const validationPassed = services.validators.safeValidate(() => {
  services.validators.validateTranslationOperation({
    requireItemSelection: true,
    requireFileSelection: false
  });
}, { context: 'translateSelected' });

if (!validationPassed) {
  return; // 验证失败，已经显示了错误消息
}

// ========== 获取选中的项目 ==========
const selectedIndices =
  (services.appState.translations.multiSelected || []).length > 0
    ? Array.from(new Set(services.appState.translations.multiSelected)).sort((a, b) => a - b)
    : [services.appState.translations.selected];

const selectedItems = selectedIndices
  .map((idx) => services.appState.project.translationItems?.[idx])
  .filter(Boolean);

if (selectedItems.length === 0) {
  throw new Error("请先选择要翻译的项");
}

// ========== 获取翻译配置 ==========
const sourceLang = services.appState.project.sourceLanguage || "en";
const targetLang = services.appState.project.targetLanguage || "zh";

// ✅ 使用存储管理器获取设置
const settings = services.storageManager?.getSettings() || 
                 safeJsonParse(localStorage.getItem("translatorSettings"), {});

const engine =
  settings.translationEngine ||
  settings.defaultEngine ||
  document.getElementById("translationEngine")?.value ||
  "deepseek";

// ========== 显示进度（通过通知服务） ==========
if (typeof showTranslationProgress === 'function') {
  showTranslationProgress();
}

if (typeof updateProgress === 'function') {
  updateProgress(0, selectedItems.length, "准备翻译...");
}

// ========== 设置翻译状态 ==========
services.appState.translations.isInProgress = true;
services.appState.translations.isPaused = false;
services.appState.translations.lastFailedItems = [];
services.appState.translations.lastBatchContext = {
  scope: "selected",
  sourceLang,
  targetLang,
  engine,
  selectedFile: services.appState?.translations?.selectedFile || null,
};

if (typeof updateTranslationControlState === 'function') {
  updateTranslationControlState();
}
```

### 步骤 3: 使用结果处理器统一处理结果

```javascript
// ========== 执行翻译 ==========
const { results, errors } = await services.translationService.translateBatch(
  selectedItems,
  sourceLang,
  targetLang,
  engine,
  {
    onProgress: (completed, total) => {
      if (typeof updateProgress === 'function') {
        updateProgress(completed, total);
      }
    },
  }
);

// ========== 隐藏进度 ==========
if (typeof hideTranslationProgress === 'function') {
  hideTranslationProgress();
}

// ========== 使用结果处理器处理结果 ==========
if (services.resultHandler) {
  services.resultHandler.handleTranslationComplete({
    results,
    errors,
    engine,
    context: {
      scope: 'selected',
      sourceLang,
      targetLang
    }
  });
} else {
  // 备用：手动处理结果
  const actualErrors = errors.filter((e) => e.error !== "用户取消");
  const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
  
  services.appState.translations.lastFailedItems = actualErrors
    .map((e) => e?.item)
    .filter(Boolean);

  if (!services.appState.translations.isInProgress && cancelledCount > 0) {
    services.notificationService?.show(
      "info",
      "翻译已取消",
      `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
    );
  } else if (actualErrors.length === 0) {
    services.notificationService?.show(
      "success",
      "翻译完成",
      `已成功翻译 ${results.length} 项`
    );
  } else {
    services.notificationService?.show(
      "warning",
      "翻译部分完成",
      `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
    );
  }
}

// ========== 标记需要自动保存 ==========
if (services.autoSaveManager) {
  services.autoSaveManager.markDirty();
}

// ========== 更新UI ==========
if (services.uiUpdater && typeof services.uiUpdater.update === 'function') {
  services.uiUpdater.update({
    shouldScroll: false,
    shouldFocusTextarea: false
  });
} else {
  // 备用：调用全局函数
  if (typeof rebuildFilteredTranslationItems === 'function') {
    rebuildFilteredTranslationItems();
  }
  if (typeof updateTranslationLists === 'function') {
    updateTranslationLists();
  }
  if (typeof updateCounters === 'function') {
    updateCounters();
  }
  if (typeof updateSelectionStyles === 'function') {
    updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
  }
}
```

---

## 完整的迁移后代码

```javascript
/**
 * 翻译选中的项目（改进版，使用依赖注入）
 * @param {Object} deps - 依赖注入对象
 * @returns {Promise<void>}
 */
async function translateSelectedFallback(deps = {}) {
  try {
    // ========== 1. 获取所有依赖服务 ==========
    const services = {
      appState: deps.appState || getServiceSafely('appState', 'AppState'),
      translationService: deps.translationService || getServiceSafely('translationService', 'translationService'),
      storageManager: deps.storageManager || getServiceSafely('storageManager', 'storageManager'),
      validators: deps.validators || getServiceSafely('universalValidators') || getUniversalValidators(),
      resultHandler: deps.resultHandler || getServiceSafely('translationResultHandler') || getTranslationResultHandler(),
      uiUpdater: deps.uiUpdater || getServiceSafely('translationUIUpdater'),
      notificationService: deps.notificationService || getServiceSafely('notificationService'),
      errorManager: deps.errorManager || getServiceSafely('errorManager'),
      autoSaveManager: deps.autoSaveManager || getServiceSafely('autoSaveManager')
    };
    
    // ========== 2. 验证必要的服务 ==========
    if (!services.validators || typeof services.validators.safeValidate !== 'function') {
      services.notificationService?.show("error", "服务不可用", "验证器未加载");
      return;
    }
    
    if (!services.resultHandler || typeof services.resultHandler.handleTranslationComplete !== 'function') {
      services.notificationService?.show("error", "服务不可用", "结果处理器未加载");
      return;
    }
    
    if (!services.translationService) {
      services.notificationService?.show("error", "服务不可用", "翻译服务未加载");
      return;
    }
    
    // ========== 3. 验证翻译操作的前置条件 ==========
    const validationPassed = services.validators.safeValidate(() => {
      services.validators.validateTranslationOperation({
        requireItemSelection: true,
        requireFileSelection: false
      });
    }, { context: 'translateSelected' });
    
    if (!validationPassed) {
      return;
    }
    
    // ========== 4. 获取选中的项目 ==========
    const selectedIndices =
      (services.appState.translations.multiSelected || []).length > 0
        ? Array.from(new Set(services.appState.translations.multiSelected)).sort((a, b) => a - b)
        : [services.appState.translations.selected];
    
    const selectedItems = selectedIndices
      .map((idx) => services.appState.project.translationItems?.[idx])
      .filter(Boolean);

    if (selectedItems.length === 0) {
      throw new Error("请先选择要翻译的项");
    }

    // ========== 5. 获取翻译配置 ==========
    const sourceLang = services.appState.project.sourceLanguage || "en";
    const targetLang = services.appState.project.targetLanguage || "zh";
    const settings = services.storageManager?.getSettings() || 
                     safeJsonParse(localStorage.getItem("translatorSettings"), {});
    const engine =
      settings.translationEngine ||
      settings.defaultEngine ||
      document.getElementById("translationEngine")?.value ||
      "deepseek";

    // ========== 6. 显示进度 ==========
    if (typeof showTranslationProgress === 'function') {
      showTranslationProgress();
    }
    if (typeof updateProgress === 'function') {
      updateProgress(0, selectedItems.length, "准备翻译...");
    }

    // ========== 7. 设置翻译状态 ==========
    services.appState.translations.isInProgress = true;
    services.appState.translations.isPaused = false;
    services.appState.translations.lastFailedItems = [];
    services.appState.translations.lastBatchContext = {
      scope: "selected",
      sourceLang,
      targetLang,
      engine,
      selectedFile: services.appState?.translations?.selectedFile || null,
    };
    
    if (typeof updateTranslationControlState === 'function') {
      updateTranslationControlState();
    }

    // ========== 8. 执行翻译 ==========
    const { results, errors } = await services.translationService.translateBatch(
      selectedItems,
      sourceLang,
      targetLang,
      engine,
      {
        onProgress: (completed, total) => {
          if (typeof updateProgress === 'function') {
            updateProgress(completed, total);
          }
        },
      }
    );

    // ========== 9. 隐藏进度 ==========
    if (typeof hideTranslationProgress === 'function') {
      hideTranslationProgress();
    }

    // ========== 10. 处理翻译结果 ==========
    if (services.resultHandler) {
      services.resultHandler.handleTranslationComplete({
        results,
        errors,
        engine,
        context: {
          scope: 'selected',
          sourceLang,
          targetLang
        }
      });
    } else {
      // 备用处理逻辑
      const actualErrors = errors.filter((e) => e.error !== "用户取消");
      const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
      
      services.appState.translations.lastFailedItems = actualErrors
        .map((e) => e?.item)
        .filter(Boolean);

      if (!services.appState.translations.isInProgress && cancelledCount > 0) {
        services.notificationService?.show(
          "info",
          "翻译已取消",
          `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
        );
      } else if (actualErrors.length === 0) {
        services.notificationService?.show(
          "success",
          "翻译完成",
          `已成功翻译 ${results.length} 项`
        );
      } else {
        services.notificationService?.show(
          "warning",
          "翻译部分完成",
          `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
        );
      }
    }

    // ========== 11. 标记需要自动保存 ==========
    if (services.autoSaveManager) {
      services.autoSaveManager.markDirty();
    }

    // ========== 12. 更新UI ==========
    if (services.uiUpdater && typeof services.uiUpdater.update === 'function') {
      services.uiUpdater.update({
        shouldScroll: false,
        shouldFocusTextarea: false
      });
    } else {
      if (typeof rebuildFilteredTranslationItems === 'function') {
        rebuildFilteredTranslationItems();
      }
      if (typeof updateTranslationLists === 'function') {
        updateTranslationLists();
      }
      if (typeof updateCounters === 'function') {
        updateCounters();
      }
      if (typeof updateSelectionStyles === 'function') {
        updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
      }
    }
    
  } catch (error) {
    // ========== 错误处理 ==========
    const errorManager = deps.errorManager || getServiceSafely('errorManager');
    
    if (typeof hideTranslationProgress === 'function') {
      hideTranslationProgress();
    }
    
    if (errorManager) {
      errorManager.handleError(error, {
        context: 'translateSelectedFallback',
        severity: 'high'
      });
    } else {
      console.error('翻译选中项失败:', error);
      const notificationService = getServiceSafely('notificationService');
      notificationService?.show(
        "error",
        "翻译失败",
        error.message || "发生未知错误"
      );
    }
    
    // 恢复状态
    const appState = deps.appState || getServiceSafely('appState', 'AppState');
    if (appState) {
      appState.translations.isInProgress = false;
      appState.translations.isPaused = false;
    }
    
    if (typeof updateTranslationControlState === 'function') {
      updateTranslationControlState();
    }
  }
}
```

---

## 测试代码

### 单元测试

```javascript
describe('translateSelectedFallback', () => {
  it('should translate selected items with dependency injection', async () => {
    // Mock services
    const mockServices = {
      appState: {
        project: {
          translationItems: [
            { sourceText: 'Hello', targetText: '' }
          ],
          sourceLanguage: 'en',
          targetLanguage: 'zh'
        },
        translations: {
          selected: 0,
          multiSelected: [],
          isInProgress: false,
          isPaused: false,
          lastFailedItems: []
        }
      },
      translationService: {
        translateBatch: jest.fn().mockResolvedValue({
          results: [{ sourceText: 'Hello', targetText: '你好' }],
          errors: []
        })
      },
      validators: {
        safeValidate: jest.fn((fn) => { fn(); return true; }),
        validateTranslationOperation: jest.fn()
      },
      resultHandler: {
        handleTranslationComplete: jest.fn()
      },
      notificationService: {
        show: jest.fn()
      },
      autoSaveManager: {
        markDirty: jest.fn()
      },
      uiUpdater: {
        update: jest.fn()
      }
    };

    // Call function with mocked dependencies
    await translateSelectedFallback(mockServices);

    // Assertions
    expect(mockServices.validators.safeValidate).toHaveBeenCalled();
    expect(mockServices.translationService.translateBatch).toHaveBeenCalled();
    expect(mockServices.resultHandler.handleTranslationComplete).toHaveBeenCalled();
    expect(mockServices.autoSaveManager.markDirty).toHaveBeenCalled();
    expect(mockServices.uiUpdater.update).toHaveBeenCalled();
  });
});
```

---

## 迁移检查清单

- [x] 提取所有依赖服务到函数参数
- [x] 使用服务对象替换全局变量访问
- [x] 使用服务对象替换全局函数调用
- [x] 添加服务可用性验证
- [x] 保留向后兼容的备用方案
- [x] 添加完整的错误处理
- [x] 添加单元测试示例
- [ ] 实际应用到代码中
- [ ] 进行集成测试
- [ ] 更新相关文档

---

**最后更新**: 2026-02-06  
**状态**: 方案完成，待实施
