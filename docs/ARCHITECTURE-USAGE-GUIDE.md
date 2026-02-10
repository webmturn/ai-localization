# 新架构系统使用指南

## 快速开始

### 1. 基本概念

新的架构系统包含四个核心组件：

- **NamespaceManager**: 管理命名空间，避免全局变量污染
- **DIContainer**: 依赖注入容器，管理服务依赖
- **ModuleManager**: 模块管理器，处理模块加载和依赖
- **ArchitectureInitializer**: 架构初始化器，统一管理初始化流程

### 2. 系统启动流程

```javascript
// 1. public/index.html 优先加载 app.bundle.js（生产），不存在则回退到 app.js（开发）
// 2. app.js 按分层顺序加载脚本（开发模式），app.bundle.js 已内联所有脚本（生产模式）
architectureScripts → coreScripts → serviceScripts → parserScripts → featureScripts → uiScripts → compatScripts → bootstrapScripts

// 3. 架构系统初始化（由 public/app.js 触发）
await window.architectureInitializer.initialize();

// 4. 应用启动入口
await window.__appBootstrap(bootstrapContext);
```

## 使用方式

### 1. 访问服务

```javascript
// 通过依赖注入容器
const errorManager = getService('errorManager');
const translationService = getService('translationService');

// 通过命名空间
const errorManager = getFromNamespace('App.core.errorManager');
const translationService = getFromNamespace('App.services.translation');

// 通过全局架构对象
const errorManager = Architecture.getService('errorManager');
const moduleInfo = Architecture.getModule('translationModule');
```

> 说明：`getService/hasService/getAllServices/checkArchitectureStatus` 由 `public/app/core/dependency-injection.js` 提供。
> `Architecture.getService/getStatus` 等门面方法由 `public/app/core/architecture-initializer.js` 在初始化阶段注入。

### 2. 注册新服务

```javascript
// 注册单例服务
diContainer.registerSingleton('myService', MyService, {
  dependencies: ['errorManager', 'storageManager']
});

// 注册瞬态服务
diContainer.registerTransient('myComponent', MyComponent);

// 注册工厂服务
diContainer.registerFactory('myFactory', (deps) => {
  return new MyService(deps.errorManager);
});
```

### 3. 注册新模块

```javascript
// 注册模块
moduleManager.registerModule('myModule', {
  dependencies: ['errorManager'],
  factory: (deps) => new MyModule(deps.errorManager),
  globalExports: ['myModule'],
  singleton: true
});

// 加载模块
const myModule = await moduleManager.loadModule('myModule');
```

### 4. 创建命名空间

```javascript
// 创建命名空间
namespaceManager.createNamespace('App.myFeature', {
  description: '我的功能模块'
});

// 添加到命名空间
namespaceManager.addToNamespace('App.myFeature', 'myService', myService);
```

## 开发工具

### 1. 系统状态检查

```javascript
// 获取架构状态
const status = Architecture.getStatus();
console.log('架构状态:', status);

// 获取模块状态
const moduleStatus = moduleManager.getSystemStatus();
console.log('模块状态:', moduleStatus);

// 获取服务状态
const serviceStatus = diContainer.getStatus();
console.log('服务状态:', serviceStatus);
```

### 2. 健康检查

```javascript
// 快速健康检查
const health = quickHealthCheck();
if (health.status !== 'healthy') {
  console.warn('系统问题:', health.issues);
}

// 完整系统测试
const testResult = await runErrorSystemTest();
console.log('测试结果:', testResult);
```

### 3. 调试工具

```javascript
// 查看全局变量报告
const globalReport = namespaceManager.getGlobalVariableReport();
console.log('全局变量:', globalReport);

// 查看命名空间报告
const namespaceReport = namespaceManager.getNamespaceReport();
console.log('命名空间:', namespaceReport);

// 导出配置
const config = namespaceManager.exportConfiguration();
console.log('系统配置:', config);
```

## 最佳实践

### 1. 服务定义

```javascript
// 好的做法：使用依赖注入
class MyService {
  constructor(errorManager, storageManager) {
    this.errorManager = errorManager;
    this.storage = storageManager;
  }
  
  async doSomething() {
    try {
      // 业务逻辑
    } catch (error) {
      this.errorManager.handleError(error, { service: 'MyService' });
    }
  }
}

// 注册服务
diContainer.registerSingleton('myService', MyService, {
  dependencies: ['errorManager', 'storageManager']
});
```

### 2. 模块定义

```javascript
// 好的做法：明确依赖
const myModule = defineModule({
  dependencies: ['errorManager', 'eventManager'],
  factory: (deps) => {
    return {
      init() {
        deps.eventManager.add(window, 'resize', this.handleResize);
      },
      
      handleResize() {
        // 处理窗口大小变化
      },
      
      dispose() {
        deps.eventManager.removeAll();
      }
    };
  },
  globalExports: ['myModule']
});
```

### 3. 错误处理

```javascript
// 好的做法：使用统一错误处理
async function myAsyncFunction() {
  return await safeAsync(async () => {
    // 可能出错的操作
    const result = await someAsyncOperation();
    return result;
  }, {
    context: { function: 'myAsyncFunction' },
    retryCount: 3,
    retryDelay: 1000
  });
}
```

### 4. 命名空间使用

```javascript
// 好的做法：使用命名空间而不是全局变量
// 避免
window.myGlobalFunction = function() {};

// 推荐
namespaceManager.addToNamespace('App.utils', 'myFunction', function() {});

// 或者使用安全的全局变量创建
createSafeGlobal('myFunction', function() {}, {
  namespace: 'App.utils'
});
```

## 常见问题

### 1. 服务未找到

```javascript
// 问题：服务未注册
const service = getService('unknownService'); // 返回 null

// 解决：检查服务是否注册
if (hasService('unknownService')) {
  const service = getService('unknownService');
} else {
  console.warn('服务未注册: unknownService');
}
```

### 2. 循环依赖

```javascript
// 问题：循环依赖
moduleManager.registerModule('moduleA', {
  dependencies: ['moduleB']  // moduleB依赖moduleA
});

// 解决：重新设计依赖关系或使用延迟加载
moduleManager.registerModule('moduleA', {
  dependencies: [],
  factory: () => ({
    init() {
      // 延迟获取moduleB
      const moduleB = moduleManager.getModule('moduleB');
    }
  })
});
```

### 3. 初始化失败

```javascript
// 监听初始化事件
window.addEventListener('architectureInitialized', (event) => {
  console.log('架构初始化完成:', event.detail);
});

// 处理初始化失败
try {
  await initializeArchitecture();
} catch (error) {
  console.error('架构初始化失败:', error);
  // 降级处理
  initializeFallbackMode();
}
```

## 性能优化

### 1. 懒加载

```javascript
// 注册懒加载模块
moduleManager.registerModule('heavyModule', {
  lazy: true,
  factory: () => import('./heavy-module.js')
});

// 按需加载
const heavyModule = await moduleManager.loadModule('heavyModule');
```

### 2. 服务预热

```javascript
// 预热关键服务
const criticalServices = ['errorManager', 'eventManager', 'storageManager'];
criticalServices.forEach(service => {
  diContainer.resolve(service);
});
```

### 3. 性能监控

```javascript
// 启用性能监控
await initializeArchitecture({
  enablePerformanceMonitoring: true
});

// 查看性能报告
const report = getInitializationReport();
console.log('初始化耗时:', report.totalDuration);
```

## 测试支持

### 1. 单元测试

```javascript
// 创建测试容器
const testContainer = diContainer.createChild();

// 注册模拟服务
testContainer.registerValue('errorManager', mockErrorManager);

// 测试服务
const service = testContainer.resolve('myService');
```

### 2. 集成测试

```javascript
// 运行架构测试
const testResult = await runErrorSystemTest();
expect(testResult.summary.passRate).toBeGreaterThan(90);
```

## 迁移指南

### 1. 从旧系统迁移

```javascript
// 旧代码
window.myService = new MyService();

// 新代码
diContainer.registerSingleton('myService', MyService);
const myService = getService('myService');
```

### 2. 渐进式升级

```javascript
// 保持向后兼容
if (typeof window.formatTranslationError !== 'undefined') {
  window.formatTranslationErrorOriginal = window.formatTranslationError;
}
window.formatTranslationError = formatTranslationErrorV2;
```

这个新的架构系统提供了强大的模块化、依赖管理和错误处理能力，同时保持了良好的向后兼容性和开发体验。