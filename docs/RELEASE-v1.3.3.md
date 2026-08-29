# v1.3.3 发布说明

**发布日期**: 2026-08-30  
**标签**: [v1.3.3](https://github.com/webmturn/ai-localization/releases/tag/v1.3.3)

---

## 🚀 概览

v1.3.3 聚焦三件事：批量翻译吞吐提升、AppState 状态所有权确权重构（5 阶段）、翻译列表交互体验修复。

**核心亮点：**
- ⚡ 批量翻译并发分块：AI 批量路径不再串行请求，吞吐显著提升
- 🏗️ AppState 状态所有权确权：全部切片唯一 Owner Store + CI 静态守护
- 🖱️ 选中滚动动画 / 点击聚焦译文框 / 搜索跨页跳转
- ✏️ 源文件编辑器：文件树内编辑原始内容，重解析保留既有译文
- 🧪 测试用例 173 → 295

---

## ⚡ 批量翻译性能

### 并发分块（ai-engine-base.js）

- 会话记忆关闭时按引擎限速适度并发（上限 3，受 `checkRateLimit` 令牌桶统一节流，不突破引擎 RPS）
- 会话记忆开启时保持串行（跨 chunk 历史链顺序依赖）
- 结果严格按 items 顺序组装；自适应拆半重试与取消 partialOutputs 前缀语义在并发下不变

### 限速与输出上限上调

| 引擎 | rateLimitPerSecond | 批量 max_tokens |
|------|--------------------|-----------------|
| DeepSeek | 3 → 10 | 8192（不变） |
| OpenAI | 3 → 15 | 8000 → 16000 |
| Claude | 3 → 8 | 8192（不变） |
| Gemini | 0.25（不变） | — |

### JS bundle 压缩（terser）

构建产物 1.16MB → 579KB（-50%）；DOMContentLoaded 256ms → 50ms（-80%）。

---

## 🏗️ AppState 状态所有权确权（5 阶段）

全部切片收敛为唯一 Owner Store，业务代码禁止裸写切片字段（CI 静态守护）：

| Store | 切片 | 关键 API |
|-------|------|----------|
| `ProjectStore` | project / fileMetadata | loadProject / setTranslationItems / replaceFileItems / getTranslationItems |
| `TerminologyStore` | terminology | addTerm / updateTerm / mergeTerms / getList（运行时唯一数据源） |
| `TranslationViewStore` | translations 视图态 | setSelection / setFilter / setPage / getViewItems（视图条目唯一数据源） |
| `BatchProgressStore` | translations 批量进度态 | beginBatch / cancelBatch / reportProgress / isUserCancelled（取消协议） |

- **消灭幽灵状态**：state.js 显式声明全部切片；`_batchStarted/_batchCancelled` 未声明字段收编为取消协议
- **删除兼容别名**：`AppState.translations.items` 与 `window.qualityCheckResults`（读取方全部迁移）
- **质量检查依赖注入**：术语上下文由 run() 入口快照注入，checks.js 不再直读 Store
- **CI 守护**：`npm run check-state`（写入守护）+ `npm run check-globals`（全局函数冻结）

---

## 🖱️ 交互体验修复

### 选中项滚动动画（三处根因连环修复）

1. 浏览器原生 smooth 滚动在 `prefers-reduced-motion` 环境（Windows 关闭"显示动画效果"）被忽略 → 新增 **rAF 自绘动画** `animateScrollTo`（easeOutCubic、距离驱动时长 180-450ms、可打断不排队）
2. `offsetParent` 链在 `position:static` 滚动容器下永远命不中容器（所有滚动都落入瞬跳兜底）→ 改用 **getBoundingClientRect 几何换算**
3. 滚动策略从"跳到视口中央"改为**最小揭示**（已可见不动、越界才滚到刚好可见并留一行上下文），连续键盘导航为行级步进

### 点击条目聚焦译文框

点击原文行 / 译文行非输入区 / 移动端卡片，光标直接进入对应译文框，可立即输入译文。

### 搜索跳转（含跨页）

搜索回车跳转显式滚动到目标条目；目标在其它页时**自动翻页**、等待渲染后动画滚动定位。

---

## ✏️ 其他功能与修复

- **源文件编辑器**：文件树"编辑源文件"弹窗（等宽字体、Ctrl+Enter 保存、语法校验、按 key 回填译文保留既有翻译）
- **应用内对话框**：10 处原生 prompt()/confirm() 替换为统一确认/输入组件（深色模式、Esc/Enter、焦点恢复）
- **YAML 升级（js-yaml 4.1.0）**：多行块/数组/锚点/多文档完整支持，导出走 jsyaml.dump
- **XLIFF 命名空间前缀**：`<xliff:trans-unit>` 前缀文件可正常解析
- **PO 复数导出**：msgstr[0]/msgstr[1] 双写，复数语言往返不丢译文
- **深色模式对比度审计**：20 个场景 WCAG 扫描，低对比度元素清零
- **品牌视觉统一**：主 CTA `.btn-brand` 渐变 + 焦点环，空状态引导，统计卡片色条
- **文件树文件级进度徽章** + 文件删除功能（VS Code 风格 hover 操作菜单）
- **CSV 公式注入防护**（= + - @ 前缀转义）

---

## 🧪 质量保障

- 测试用例 **173 → 295**（新增四大 Store 契约、AppState 显式声明、动画滚动、并发/取消、格式解析）
- CI 双检查：状态所有权守护 + 全局函数冻结
- 全部 UI 修复经浏览器实测（多视口、桌面双栏与移动端路径）

---

## 📦 升级说明

```bash
git pull
npm install
npm run build
```

构建产物（`app.bundle.js` / `styles.css`）不入库，必须构建后使用。详细变更见 [CHANGELOG.md](../CHANGELOG.md)。
