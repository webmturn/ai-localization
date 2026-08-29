# 项目目录结构

> 仓库：[https://github.com/webmturn/ai-localization](https://github.com/webmturn/ai-localization)  
> 最后更新：2026-08-30（v1.3.3）

## 📁 完整目录树

```
html/
├── config/                          # 配置文件
│   ├── cdn-versions.json                # CDN 资源版本配置
│   ├── common-terms-50.json             # 可选：初始/示例术语数据
│   └── tailwind.config.js               # Tailwind CSS 配置
│
├── docs/                            # 文档
│   ├── INDEX.md                         # 文档索引（入口）
│   ├── API-REFERENCE.md                 # 核心服务和工具 API 参考
│   ├── APP-JS-Function-Guide.md         # app 模块与函数说明
│   ├── ARCHITECTURE-USAGE-GUIDE.md      # 架构系统使用指南
│   ├── ERROR-HANDLING-GUIDE.md          # 错误处理指南
│   ├── ERROR-HANDLING-QUICK-START.md    # 错误处理快速开始
│   ├── ERROR-HANDLING-USAGE-EXAMPLES.md # 错误处理使用示例
│   ├── GITHUB-RELEASE-CHECKLIST.md      # GitHub 发布前检查清单
│   ├── NodeJS-Install-Guide.md          # Node.js 安装指南
│   ├── PROJECT-STRUCTURE.md             # 项目结构说明（本文件）
│   ├── QUICK-START.md                   # 快速上手指南
│   ├── README-CDN-UPDATE.md             # CDN 更新指南
│   ├── README-TAILWIND.md               # Tailwind CSS 使用说明
│   ├── RELEASE-v1.0.0.md                # v1.0.0 发布说明
│   ├── RELEASE-v1.1.0.md                # v1.1.0 发布说明
│   ├── RELEASE-v1.2.0.md                # v1.2.0 发布说明
│   ├── RELEASE-v1.3.3.md                # v1.3.3 发布说明
│   ├── TESTING-AND-PRODUCTION.md        # 测试与生产环境
│   └── history/                         # 归档/过程文档（修复报告等）
│
├── scripts/                         # 构建与工具脚本
│   ├── build-bundle.js                  # JS 打包脚本（合并 123 个 JS 为 app.bundle.js，terser 压缩）
│   ├── build-production.mjs             # 生产构建（Node 版）
│   ├── build-production.ps1             # 生产构建脚本（PowerShell）
│   ├── check-state-ownership.mjs        # ⭐ 状态所有权静态检查（AppState 切片写入守护，CI）
│   ├── check-global-functions.mjs       # ⭐ 全局函数冻结检查（基线化 window 挂载，CI）
│   ├── tools.mjs                        # 整合工具（Node检查/版本检查/CDN更新/配置）
│   ├── migrate-fa-v6.mjs                # Font Awesome 迁移工具
│   ├── tools.ps1                        # 整合脚本（Node检查/版本检查/CDN更新）
│   ├── update-cdn.ps1                   # CDN 更新入口
│   ├── check-latest-versions.ps1        # 版本检查入口
│   ├── auto-update-versions.ps1         # 自动更新配置入口
│   └── check-node-install.ps1           # Node 安装检查
│
├── tests/                           # ⭐ 单元/契约测试（Vitest，295 个用例）
│   ├── setup.mjs                        # 测试环境（loadSource/setupGlobals 桩）
│   ├── state-explicit.test.mjs          # AppState 显式声明契约
│   ├── project-store.test.mjs           # ProjectStore 契约
│   ├── terminology-store.test.mjs       # TerminologyStore 契约
│   ├── translation-view-store.test.mjs  # TranslationViewStore 契约
│   ├── batch-progress-store.test.mjs    # BatchProgressStore 契约
│   ├── animate-scroll.test.mjs          # rAF 动画滚动契约
│   ├── ai-engine-base.test.mjs          # 引擎温度钳制
│   ├── ai-engine-base-batch.test.mjs    # 批量并发/取消/partialOutputs
│   ├── batch-resume.test.mjs            # 断点续传
│   ├── parser-registry.test.mjs         # 解析器注册表
│   ├── parsers-formats.test.mjs         # 各格式解析
│   ├── parser-utils.test.mjs            # 解析工具
│   ├── placeholder-guard.test.mjs       # 占位符保护
│   ├── translation-memory.test.mjs      # 翻译记忆
│   ├── translation-diff.test.mjs        # 增量 Diff
│   ├── tm-auto-apply.test.mjs           # TM 自动应用
│   ├── terminology.test.mjs             # 术语匹配
│   ├── model-fetch.test.mjs             # 模型列表拉取
│   ├── helpers.test.mjs                 # 翻译工具函数
│   └── security-utils.test.mjs          # 安全工具
│
├── src/                             # 源代码
│   └── input.css                        # Tailwind CSS 输入文件（含移动端响应式样式）
│
├── public/                          # 发布目录（浏览器打开/部署）
│   ├── index.html                       # 主 HTML 文件
│   ├── app.js                           # 开发模式入口（按顺序加载 123 个脚本）
│   ├── app.bundle.js                    # 生产 bundle（构建生成，勿手动编辑）
│   ├── styles.css                       # 构建后的 CSS（Tailwind 生成，勿手动编辑）
│   ├── favicon.svg                      # 网站图标
│   │
│   ├── lib/                             # 第三方库（本地化）
│   │   ├── chart.js/                        # Chart.js 4.5.1
│   │   ├── font-awesome/                    # Font Awesome 4.7.0
│   │   ├── js-yaml/                         # js-yaml 4.1.0（YAML 完整解析/导出）
│   │   └── sheetjs/                         # SheetJS 0.20.1
│   │
│   └── app/                             # ⭐ 应用核心逻辑（11个子目录）
│       ├── core/                        # 核心系统（14个文件 + 2个子目录）
│       │   ├── bootstrap.js                 # 应用引导（DOM初始化、服务注册、启动）
│       │   ├── state.js                     # AppState 全局状态定义（全部切片显式声明）
│       │   ├── utils.js                     # 工具函数（debounce/throttle/getServiceSafely等）
│       │   ├── dom-cache.js                 # DOMCache 单例（ID/选择器缓存）
│       │   ├── logger-config.js             # 日志分级系统（loggers 对象、LOG_LEVELS）
│       │   ├── dev-tools.js                 # 开发模式工具（写审计 installSliceOwnershipAudit）
│       │   ├── event-manager.js             # EventManager 统一事件监听管理
│       │   ├── event-binding-manager.js     # 事件绑定管理器（防重复绑定）
│       │   ├── performance-monitor.js       # 性能监控器
│       │   ├── dom-optimization-manager.js  # DOM 优化管理器（批量操作）
│       │   ├── service-startup-manager.js   # 服务启动管理器
│       │   │
│       │   ├── ⭐ 状态所有权 Store（AppState 各切片唯一写入方）
│       │   │   ├── project-store.js             # ProjectStore：project/fileMetadata 切片
│       │   │   ├── terminology-store.js         # TerminologyStore：术语库切片（运行时唯一数据源）
│       │   │   ├── translation-view-store.js    # TranslationViewStore：翻译视图态（选中/过滤/分页）+ 稳定条目引用
│       │   │   └── batch-progress-store.js      # BatchProgressStore：批量进度态 + 用户取消协议（isUserCancelled）
│       │   │
│       │   ├── architecture/            # 架构系统（6个文件）
│       │   │   ├── dependency-injection.js      # DI容器 + 服务注册
│       │   │   ├── architecture-initializer.js  # 架构初始化器
│       │   │   ├── architecture-integration-helpers.js # 集成辅助
│       │   │   ├── architecture-debug.js        # 架构调试工具
│       │   │   ├── module-manager.js            # 模块管理器（依赖解析）
│       │   │   └── namespace-manager.js         # 命名空间管理
│       │   │
│       │   └── errors/                  # 错误处理系统（5个文件）
│       │       ├── error-manager.js             # ErrorManager + ERROR_CODES
│       │       ├── error-manager-preload.js     # 错误管理器预加载
│       │       ├── error-utils.js               # ErrorUtils（validateApiKey等）
│       │       ├── error-integration.js         # 错误系统集成
│       │       └── error-production.js          # 生产环境错误处理
│       │
│       ├── features/                    # 功能模块
│       │   ├── translations/            # 翻译功能（12个文件 + export/）
│       │   │   ├── actions.js               # 翻译操作（选中/全部/取消/重试）
│       │   │   ├── render.js                # 翻译列表渲染
│       │   │   ├── selection.js             # 选择状态管理
│       │   │   ├── search.js                # 翻译搜索/过滤
│       │   │   ├── find-replace.js          # 查找替换
│       │   │   ├── progress.js              # 进度UI
│       │   │   ├── ui-updates.js            # 翻译UI更新
│       │   │   ├── ui-controller.js         # TranslationUIController
│       │   │   ├── result-handler-v2.js     # 翻译结果处理器
│       │   │   ├── error-handler.js         # 翻译错误处理
│       │   │   ├── status.js                # 翻译状态
│       │   │   ├── export.js                # 导出入口
│       │   │   └── export/                  # 导出子模块（9个文件）
│       │   │       ├── project.js               # 项目导出
│       │   │       ├── shared.js                # 共享导出工具
│       │   │       ├── ui.js                    # 导出UI
│       │   │       ├── translation-entry.js     # 翻译条目导出
│       │   │       ├── translation-formats.js   # 翻译格式导出
│       │   │       ├── translation-original.js  # 原文导出
│       │   │       ├── terminology-export.js    # 术语导出
│       │   │       ├── terminology-import.js    # 术语导入
│       │   │       └── terminology-list.js      # 术语列表
│       │   │
│       │   ├── quality/                 # 质量检查（6个文件）
│       │   │   ├── run.js                   # 质量检查执行
│       │   │   ├── checks.js                # 基础检查项
│       │   │   ├── scoring.js               # 评分系统
│       │   │   ├── ui.js                    # 质量检查UI
│       │   │   ├── charts.js                # 质量图表
│       │   │   └── export.js                # 质量报告导出
│       │   │
│       │   ├── files/                   # 文件处理（5个文件）
│       │   │   ├── read.js                  # 文件读取
│       │   │   ├── parse.js                 # 文件解析（经 ParserRegistry 调度）
│       │   │   ├── process.js               # 文件处理流程
│       │   │   ├── source-editor.js         # ⭐ 源文件编辑器（文件树编辑原始内容，重解析保留译文）
│       │   │   └── error-handler.js         # 文件错误处理
│       │   │
│       │   ├── projects/                # 项目管理
│       │   │   └── manager.js               # 项目 CRUD + 导入导出
│       │   │
│       │   ├── terminology/             # 术语管理
│       │   │   └── init.js                  # 术语库初始化
│       │   │
│       │   └── sample/                  # 示例数据
│       │       └── sample-project.js        # 示例项目生成
│       │
│       ├── services/                    # 服务层
│       │   ├── translation-service.js       # TranslationService 主入口
│       │   ├── auto-save-manager.js         # 自动保存管理器
│       │   ├── security-utils.js            # 加密/解密/API Key 验证
│       │   │
│       │   ├── translation/             # 翻译引擎（9个文件 + engines/）
│       │   │   ├── service-class.js         # TranslationService 类定义
│       │   │   ├── translate.js             # 统一翻译接口（带重试）
│       │   │   ├── batch.js                 # 批量翻译调度
│       │   │   ├── helpers.js               # 翻译共享工具函数（getItemKey/toSnippet/错误分类等）
│       │   │   ├── settings.js              # SettingsCache + 翻译设置管理
│       │   │   ├── business-logic.js        # TranslationBusinessLogic
│       │   │   ├── terminology.js           # 翻译时术语匹配
│       │   │   ├── rate-limit.js            # API 速率限制
│       │   │   ├── compat.js                # 兼容层
│       │   │   └── engines/             # 翻译引擎系统
│       │   │       ├── engine-registry.js       # EngineRegistry 引擎注册表
│       │   │       ├── base/                    # 引擎基类
│       │   │       │   ├── ai-engine-base.js        # AI 引擎基类（单条+批量+钩子）
│       │   │       │   └── traditional-engine-base.js # 传统引擎基类
│       │   │       └── providers/               # 引擎提供者
│       │   │           ├── deepseek.js              # DeepSeek
│       │   │           ├── openai.js                # OpenAI (GPT-4o)
│       │   │           ├── gemini.js                # Gemini (Google AI)
│       │   │           ├── claude.js                # Claude (Anthropic)
│       │   │           └── google-translate.js      # Google Translate
│       │   │
│       │   └── storage/                 # 存储管理（5个文件）
│       │       ├── storage-manager.js       # 存储管理器（多后端调度）
│       │       ├── idb-operations.js        # IndexedDB 底层操作
│       │       ├── file-content-keys.js     # 文件内容键管理
│       │       ├── storage-error-handler.js # 存储错误处理
│       │       └── error-handler.js         # 存储错误处理（统一）
│       │
│       ├── ui/                          # UI 层
│       │   ├── settings.js                  # 设置面板加载/初始化
│       │   ├── engine-model-sync.js         # 引擎-模型同步
│       │   ├── file-tree.js                 # 文件树组件（文件级进度徽章 + 删除/编辑源文件操作）
│       │   ├── file-drop.js                 # 文件拖放
│       │   ├── notification.js              # 通知/Toast 组件
│       │   ├── confirm-dialog.js            # ⭐ 通用确认/输入对话框（替代原生 prompt/confirm）
│       │   ├── charts.js                    # 图表辅助
│       │   ├── event-listeners.js           # 事件监听器入口
│       │   │
│       │   ├── perf/                    # 性能相关UI（2个文件）
│       │   │   ├── sync-heights.js          # 翻译行高度同步
│       │   │   └── virtual-scroll.js        # 虚拟滚动管理器
│       │   │
│       │   └── event-listeners/         # 事件监听器模块（11个文件）
│       │       ├── settings.js                  # 设置保存/加载
│       │       ├── settings-ai-engine.js        # AI 引擎高级设置（Priming/会话/上下文）
│       │       ├── settings-prompt-templates.js # Prompt 模板管理
│       │       ├── data-and-ui.js               # UI 交互监听器
│       │       ├── data-management.js           # 数据管理（导入/导出/清空）
│       │       ├── file-panels.js               # 文件面板交互
│       │       ├── keyboard.js                  # 键盘快捷键
│       │       ├── quality.js                   # 质量检查交互
│       │       ├── terminology.js               # 术语管理交互
│       │       ├── translations-lists.js        # 翻译列表交互
│       │       └── translations-search.js       # 翻译搜索交互
│       │
│       ├── parsers/                     # 文件格式解析器（13个文件）
│       │   ├── parser-registry.js           # ⭐ ParserRegistry 注册表（格式注册/分发，OCP 扩展）
│       │   ├── parser-utils.js              # 解析器工具
│       │   ├── json.js                      # JSON
│       │   ├── yaml.js                      # YAML
│       │   ├── csv.js                       # CSV
│       │   ├── po.js                        # PO/POT (gettext)
│       │   ├── xliff.js                     # XLIFF
│       │   ├── xml-android.js               # Android strings.xml
│       │   ├── xml-generic.js               # 通用 XML
│       │   ├── resx.js                      # .NET RESX
│       │   ├── ios-strings.js               # iOS .strings
│       │   ├── qt-ts.js                     # Qt TS
│       │   └── text.js                      # 纯文本
│       │
│       ├── network/                     # 网络层（2个文件）
│       │   ├── network-utils.js             # NetworkUtils（fetch+去重+缓存）
│       │   └── error-handler.js             # 网络错误处理
│       │
│       ├── utils/                       # 工具类（2个文件）
│       │   ├── validators-v2.js             # UniversalValidators V2
│       │   └── dom-cache-integration.js     # DOMCache 集成辅助
│       │
│       ├── types/                       # 类型定义
│       │   └── core-types.js                # 核心类型（JSDoc）
│       │
│       ├── compat/                      # 兼容层（3个文件）
│       │   ├── files.js                     # 文件兼容
│       │   ├── perf.js                      # 性能兼容
│       │   └── quality.js                   # 质量检查兼容
│       │
│       ├── dev-tools/                   # 开发/测试工具（4个文件）
│       │   ├── error-demo.js                # 错误系统演示
│       │   ├── error-test.js                # 错误系统测试
│       │   ├── error-system-test.js         # 错误系统单元测试
│       │   └── error-handling-examples.js   # 错误处理示例
│       │
│       └── legacy/                      # 遗留代码
│           └── README.md                    # 遗留代码说明
│
├── .github/                        # GitHub 配置
│   ├── ISSUE_TEMPLATE/                 # Issue 模板
│   └── PULL_REQUEST_TEMPLATE.md       # PR 模板
│
├── CHANGELOG.md        # 更新日志（所有版本变更记录）
├── CONTRIBUTING.md      # 贡献指南
├── LICENSE              # MIT 许可证
├── README.md            # 项目说明
├── package.json         # npm 项目配置
├── package-lock.json    # npm 锁定文件
└── .gitignore           # Git 忽略配置
```

## 目录详细说明

### `config/` — 配置文件
- **`cdn-versions.json`**: 管理第三方库的版本和 CDN URL
- **`common-terms-50.json`**: 可选，初始/示例术语数据（50条通用术语）
- **`tailwind.config.js`**: Tailwind CSS 的自定义配置

### `docs/` — 文档
核心文档和归档文档。入口为 `INDEX.md`。

### `scripts/` — 构建与工具脚本

| 脚本 | 说明 |
|------|------|
| `build-bundle.js` | **JS 打包脚本**：合并 123 个 JS 为 `app.bundle.js`（terser 压缩，`npm run build-bundle`） |
| `check-state-ownership.mjs` | ⭐ **状态所有权静态检查**：AppState 各切片写入绕过 Owner Store 即报错（`npm run check-state`） |
| `check-global-functions.mjs` | ⭐ **全局函数冻结检查**：基线外新增 window 挂载即报错（`npm run check-globals`，`--update` 更新基线） |
| `build-production.mjs` / `build-production.ps1` | 生产构建 |
| `tools.mjs` / `tools.ps1` | 整合工具（Node检查/版本检查/CDN更新/配置） |
| `update-cdn.ps1` | CDN 更新入口（可传 `-CheckOnly`） |
| `check-latest-versions.ps1` | 检查第三方库最新版本 |
| `auto-update-versions.ps1` | 自动更新 cdn-versions.json |
| `check-node-install.ps1` | Node.js 安装检查（仅检查不安装） |
| `migrate-fa-v6.mjs` | Font Awesome 迁移工具 |

### `tests/` — 单元/契约测试

- 测试框架：**Vitest**（`npm test`），共 **295 个用例 / 20 个文件**
- 环境：`tests/setup.mjs` 提供 `loadSource`（vm 加载源文件）与 `setupGlobals`（AppState/loggers 桩）
- 契约测试覆盖：四大状态 Store（project/terminology/translation-view/batch-progress）、AppState 显式声明、动画滚动、批量并发与取消、断点续传、解析器注册表与各格式、占位符保护、TM/Diff、安全工具

### `public/app/` — 应用核心逻辑

| 子目录 | 文件数 | 说明 |
|--------|--------|------|
| `core/` | 14 + 6 + 5 = 25 | 启动引导、状态、日志、事件、DI、错误处理、**4 个状态所有权 Store** |
| `features/translations/` | 12 + 9 = 21 | 翻译操作、渲染、搜索、导出 |
| `features/quality/` | 7 | 质量检查、评分、图表、导出 |
| `features/files/` | 5 | 文件读取、解析、处理、**源文件编辑器** |
| `features/projects/` | 1 | 项目管理 |
| `features/terminology/` | 1 | 术语库初始化 |
| `services/` | 3 + 9 + 8 + 5 = 25 | 翻译服务（EngineRegistry + 5 providers + custom）、存储、安全、自动保存 |
| `ui/` | 8 + 2 + 11 = 21 | 设置、文件树、通知、确认对话框、虚拟滚动、事件监听器 |
| `parsers/` | 13 | **ParserRegistry 注册表** + 12种文件格式解析器 |
| `network/` | 2 | 网络请求工具 |
| `utils/` | 2 | 验证器、DOMCache集成 |
| `types/` | 1 | 核心类型定义 |
| `compat/` | 3 | 兼容层 |
| `dev-tools/` | 4 | 开发/测试工具 |

## 🚀 常用命令

```bash
npm install            # 安装依赖
npm run build          # 一键构建（CSS + JS Bundle）
npm run build-css      # 构建 CSS（生产）
npm run build-bundle   # 合并 123 个 JS 为 bundle
npm run watch-css      # 监听 CSS 变化（开发）
npm test               # ⭐ 运行全量测试（295 个用例）
npm run check-state    # ⭐ 状态所有权静态检查（CI）
npm run check-globals  # ⭐ 全局函数冻结检查（CI）
npm run update-cdn     # 更新 CDN 资源
npm run check-versions # 检查第三方库最新版本
npm run auto-update    # 自动更新版本号
```

## 🔄 工作流程

1. **开发时**:
   - 编辑 `src/input.css` 添加自定义样式
   - 运行 `npm run watch-css` 监听变化
   - 编辑 `public/index.html` 和 `public/app/` 下对应模块
   - 如需调整加载顺序，编辑 `public/app.js`

2. **更新第三方库**:
   - `npm run check-versions` 查看是否有更新
   - `npm run auto-update` 自动更新

3. **生产构建**:
   - `npm run build` 生成 CSS + JS Bundle
   - 部署 `public/` 目录（包含 `app.bundle.js` 和 `styles.css`）

## 📌 注意事项

1. **不要手动编辑 `public/styles.css` 和 `public/app.bundle.js`** — 自动生成，下次构建时覆盖
2. **自定义样式写在 `src/input.css`**
3. **配置文件在 `config/`**，脚本在 `scripts/`
4. **`public/app/legacy/`** — 遗留代码目录，不再使用，仅保留备查
