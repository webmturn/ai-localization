# 2025-02-05 架构修复和优化记录

## 本次会话修复的问题

### 🐛 Bug 修复（6个）

#### 1. Map.keys().forEach TypeError
- **文件**: `public/app/core/module-manager.js:94`
- **问题**: `Map.keys()` 返回的是迭代器，不能直接调用 `.forEach()`
- **修复**: 改用 `for...of` 循环
```javascript
// 修复前
this.modules.keys().forEach(moduleName => visit(moduleName));

// 修复后
for (const moduleName of this.modules.keys()) {
  visit(moduleName);
}
```

#### 2. Proxy 覆盖导致无限循环
- **文件**: `public/app/core/dependency-injection.js`
- **问题**: `integrateWithArchitecture()` 函数使用 Proxy 覆盖 `window` 上的全局变量，导致循环依赖
- **修复**: 移除 Proxy 覆盖，保持原有全局变量不变

#### 3. initializeProjectData() 未调用
- **文件**: `public/app/core/bootstrap.js:270`
- **问题**: 应用启动时未调用项目数据初始化函数
- **修复**: 在 `startApplicationServices()` 中添加 `await initializeProjectData()` 调用

#### 4. 术语库模态框不显示数据
- **文件**: 多个
  - `public/app/features/translations/export/terminology-list.js`
  - `public/app/features/translations/export/ui.js`
  - `public/app/ui/event-listeners/data-and-ui.js`
- **问题**: 术语库模态框打开时未刷新列表
- **修复**: 在模态框打开时调用 `updateTerminologyList()` 和 `updateTerminologyPagination()`

#### 5. 右侧栏引擎模型设置未初始化
- **文件**: `public/app/ui/engine-model-sync.js`
- **问题**: `initEngineModelSync()` 函数定义了但未调用
- **修复**: 添加 DOM 加载后自动调用

#### 6. 术语库数据初始化未调用
- **文件**: `public/app/features/terminology/init.js`
- **问题**: `initTerminology()` 函数定义了但未调用
- **修复**: 添加 DOM 加载后自动调用

---

## 🏗️ 架构优化

### 1. DI 容器统一
- **变更**: 移除了 `globalDIContainer` 和 `globalServiceLocator`
- **现状**: 统一使用 `diContainer` 和 `serviceLocator`
- **位置**: `public/app/core/dependency-injection.js`

### 2. 服务注册合并
- **变更**: `registerCoreServices()` 现在调用各模块的 `configure*Services()` 函数
- **优点**: 避免重复代码，统一服务注册入口

### 3. 工具函数统一到 Utils 命名空间
- **文件**: `public/app/features/translations/export/shared.js`
- **新增导出**:
  - `Utils.escapeCsv()`
  - `Utils.escapeXml()`
  - `Utils.escapeHtml()`
  - `Utils.downloadFile()`
- **兼容性**: 同时保持全局函数可用

---

## 🧹 清理

### 删除的调试文件
- `public/debug-init.html`
- `public/debug-load.html`
- `public/debug-step.html`

### 移除的调试日志
- `architecture-initializer.js` 中的详细步骤日志
- `terminology-list.js` 中的调试日志

---

## 📋 架构现状

### DI 容器使用方式
```javascript
// 获取服务
const errorManager = getService('errorManager');

// 检查服务是否存在
if (hasService('translationService')) {
  const service = getService('translationService');
}

// 注册新服务
registerService('myService', myImplementation, { singleton: true });
```

### 工具函数使用方式
```javascript
// 推荐：通过 Utils 命名空间
const escaped = Utils.escapeCsv(text);
Utils.downloadFile(content, filename);

// 兼容：全局函数
const escaped = escapeCsv(text);
downloadFile(content, filename);
```

---

## 🔧 开发者注意事项

1. **新服务注册**: 使用 `configure*Services()` 函数或 `registerCoreServices()`
2. **工具函数**: 优先使用 `Utils.xxx()` 命名空间
3. **初始化函数**: 确保在 DOM 加载后自动调用或在 bootstrap 中显式调用
4. **避免全局变量**: 使用命名空间或 DI 容器管理依赖

---

## 📊 测试验证

修复后应验证以下功能：
- [ ] 应用正常启动，无控制台错误
- [ ] 刷新页面后项目数据正确恢复
- [ ] 术语库模态框打开时正确显示术语列表
- [ ] 右侧栏翻译引擎和模型设置正确显示
- [ ] 导出功能正常工作
