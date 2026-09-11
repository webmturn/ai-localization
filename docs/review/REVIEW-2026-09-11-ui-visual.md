# 界面 UI 审查 — 2026-09-11 工作树

> 范围：**视觉与可用性**本身 —— 深浅色、对比度、排版/断行、响应式与可访问性、状态反馈的呈现。
> 与已有两份报告互补：`docs/review/REVIEW-2026-09-11-ui-integration.md`（接线与功能流）、`REVIEW-2026-09-11-verification.md`（代码批次复核）。
> **未修改任何受版本控制的文件**；证据脚本在 `.review/mine/ui-*.mjs`。

**方法与证据边界（重要）**：本环境**没有浏览器渲染能力**。因此：
- 「实际观感」类结论取自仓库内归档截图 `docs/screenshots/*.png`（**2026-09-01 版，比 HEAD 早约 10 天**）；
- 「颜色/对比度/类名」类结论取自**编译产物** `public/styles.css`（77 KB，即真实生效的 CSS）与 `config/tailwind.config.js`；
- 「元素级用法」类结论取自对 `public/index.html` 的机械统计。
每条结论都标注了来源；无法判定的（例如遮罩是否真的渲染）单列为「存疑」，不当作缺陷。

| # | 级别 | 问题 | 证据来源 |
|---|---|---|---|
| U1 | **P1** | 深色模式把载体类 `dark-mode` 加在 `<body>` 上，而 `<body>` 自身也用 `dark:` 工具类 → **body 自己的深色样式永不生效**（页面底色/继承文字色留在浅色） | 编译 CSS 语义（`:is(.dark-mode *)` ×91、`.dark-mode .x` ×20+，无自匹配形态） |
| U2 | **P2** | 浅色下灰阶文字与图标对比度不足：`gray-300/white` **1.47**、`gray-400/white` **2.54**、`gray-400/gray-50` **2.43**（AA 需 4.5，非文本需 3.0）；**56 处**此类元素，含空状态引导文案与工具栏图标 | 编译 CSS 取色 + WCAG 公式计算 + `index.html` 统计 |
| U3 | P3 | 右侧面板标签在窄栏内断行："翻译设/置"、"质量报/告"（截图 01） | 截图 01 |
| U4 | P3 | 质量报告模态框内容需滚动才能看全图表（柱状图的 0/10 刻度与 x 轴类别标签被折叠）——图表本身配置正确，是**可视高度**问题 | 截图 02 + `quality/charts.js:181,201-208` |
| U5 | **P2** | 手机端（<640px）**"全部翻译"没有任何入口**：`#translateAllBtn` 是 `hidden sm:flex`，移动底栏与"更多操作"菜单里都没有它（变通：全选 → 翻译） | `index.html:205,41-61,103-107` + 全站按钮接线统计 |
| U6 | **P2** | 翻译进度没有任何可访问性语义：`role="progressbar"`/`aria-valuenow` **0 处**，进度条/百分比/状态文本/逐条日志都不在 live region 内 | `index.html` 全页扫描（仅 `#notification` role=alert 与两处 `aria-live="polite"`） |
| S1 | 存疑 | 归档截图里模态框背景**没有变暗**（02/04 均如此），但代码与编译产物都有 50% 黑遮罩 → 需浏览器确认 | 截图 02/04 vs `index.html` + `styles.css` |

---

## U1（P1）深色模式的载体类放错了元素 —— body 自身永远不进入深色

**事实链**（全部可机械复核）：

1. 主题配置：`config/tailwind.config.js` → `darkMode: ['class', '.dark-mode']`；
2. 编译产物 `public/styles.css` 中，深色变体只有两种形态，**都是后代选择器**：
   ```
   91x   :is(.dark-mode *)          ← Tailwind 生成的 dark: 工具类
   20x+  .dark-mode .<util>         ← 手写组件类
   ```
   （实测：`.dark\:bg-gray-900:is(.dark-mode *){...}`；文件中 `.dark-mode` 188 处、`.dark ` 0 处、`html.dark` 0 处 —— **没有任何"元素自己带类也匹配"的形态**）
3. 应用把载体加在 **body**：`public/app/ui/settings.js:359`（dark）、`:361`（light）、`:368/370`（auto + `matchMedia`）；
4. 而 `<body>` 自己也用了深色工具类：
   ```html
   <body class="bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-50 min-h-screen flex flex-col">
   ```

**结论（CSS 语义可判定）**：`<body>` 不是自己的后代，因此 `dark:bg-gray-900` / `dark:text-gray-50` **永不匹配**。
深色模式下：body 保持 `background-color: rgb(249 250 251)`（gray-50 浅底）与 `color: rgb(31 41 55)`（gray-800 深字），
而所有后代切到深色。

**影响面为什么可能被掩盖、又在哪里露出来**：应用是 `min-h-screen flex flex-col`，其直接子容器 `#appViewport`
背景是**透明**的（jsdom computed 实测 `rgba(0, 0, 0, 0)`），所以：
- 凡是子元素**自绘背景**的区域（工具条、侧栏、列表、状态栏）都正常显示深色；
- 凡是子元素**没有自绘背景/文字色**的位置（容器之间的间隙、内容不足一屏时的剩余区域、任何未设 `text-*` 的文本节点）
  都会露出 body 的**浅底 + 深字** —— 典型表现就是深色界面里出现一条浅色带、或深底上的深色文字。

**修复（推荐做法与连带改动）**：
1. 把载体放到根元素：`document.documentElement.classList.add("dark-mode")`（`remove` 同理）；
   这样 body 成为后代，现有全部 `.dark-mode .x` 规则与 `:is(.dark-mode *)` 规则继续生效，无需改 CSS；
2. **必须同时改** `public/app/features/quality/charts.js:33` —— 它用 `document.body.classList.contains("dark-mode")`
   判断图表配色，载体上移后会恒为 `false`（图表在深色下会继续用浅色网格）。建议改为
   `document.documentElement.classList.contains("dark-mode") || document.body.classList.contains("dark-mode")`；
3. 或者（改动更小但更脆）删掉 `<body>` 上的 `dark:` 工具类，改由一个铺满视口的子容器承担底色与文字色。

**浏览器验证步骤**（本环境无渲染能力，故给出可执行判据）：
切到 主题模式=深色，然后在控制台执行
`getComputedStyle(document.body).backgroundColor` —— 若返回 `rgb(249, 250, 251)`（gray-50）而不是 `rgb(17, 24, 39)`（gray-900），即确认该缺陷。

> 说明：我用真实 `styles.css` + jsdom 做了 computed-style 对照（`.review/mine/ui-darkmode-computed.mjs`），
> 结论是 **jsdom 无法评估这组规则**（加不加 `.dark-mode`，body 与 `.translation-headers` 的计算值都不变 ——
> 或因其选择器引擎不匹配 `:is()`，或因其未能把整份样式表纳入级联；启动日志里有 69 条
> "Could not parse CSS stylesheet"）。因此 U1 依据的是 CSS 选择器语义（确定性），影响面需要在浏览器里确认。

---

## U2（P2）浅色下灰阶文字/图标达不到 WCAG AA

取色自编译 CSS，按 WCAG 2.1 相对亮度公式计算（`mine/ui-contrast.mjs`、`mine/ui-dark-contrast.mjs`）：

```
浅色模式（阈值：正文 4.5，非文本/大字 3.0）
  text-gray-300 / white        1.47   FAIL
  text-gray-400 / white        2.54   FAIL
  text-gray-400 / gray-50      2.43   FAIL
  text-gray-500 / white        4.83   AA ✓
  text-gray-600 / white        7.56   AAA ✓
  text-gray-700 / white       10.31   AAA ✓
  text-primary  / white        5.17   AA ✓     （#2563eb）
  白字 / bg-primary             5.17   AA ✓
  徽章 green-700 / green-100    4.57   AA ✓
  徽章 red-700   / red-100      5.30   AA ✓

深色模式
  gray-100 / gray-800         13.34   AAA ✓
  gray-300 / gray-900         12.04   AAA ✓
  gray-400 / gray-900          6.99   AA ✓
  gray-400 / gray-800          5.78   AA ✓
  gray-500 / gray-800          3.04   AA-large only ✗（小字不达标）
```

**用量（`index.html` 机械统计，区分浅色与 `dark:` 前缀）**：

```
text-gray-400   浅色-only 54 处      dark:text-gray-400 141 处
text-gray-500   浅色-only 115 处     dark:text-gray-500  15 处
text-gray-300   浅色-only  5 处      dark:text-gray-300 169 处
其中 56 处（20 个 <i> 图标 + 36 个文本元素）在浅色下使用 gray-300/400
```

**最典型的受害元素**是**空状态引导文案**（首次使用者的第一屏说明）：

```html
L328  <p class="text-xs text-gray-400 dark:text-gray-500 text-center">上传本地化文件开始翻译，<br>或加载示例项目快速体验</p>
L335  <p class="text-xs text-gray-400 dark:text-gray-500 text-center">上传本地化文件开始翻译</p>
```

浅色 2.54、深色 3.04 —— **两种主题都低于小字号 AA（4.5）**，而它是 `text-xs`（最小字号）。
同组的空状态图标 `text-gray-300 dark:text-gray-600`（L326/L333）浅色仅 **1.47**，连非文本 3.0 都不到。

**修复建议**：
- 承载信息的次要文字统一提到 `text-gray-500`（浅色 4.83 ✓）；空状态引导文案这类"要读"的内容建议 `text-gray-600`（7.56）；
- 深色端避免 `dark:text-gray-500`（3.04），改用 `dark:text-gray-400`（5.78）；
- 纯装饰图标可保留 `text-gray-400`，但应补 `aria-hidden="true"`；有语义的图标（工具栏按钮图标）应随之提亮到 gray-500 以上。

---

## U3（P3）右侧面板标签在窄栏内断行

截图 01 中右栏标签渲染为 **"翻译设 / 置"、"质量报 / 告"**（图标在左，文字折成两行），
而"术语库"（三字）不折行 —— 典型的容器宽度不足 + 未禁止断行。
**修复**：标签按钮加 `whitespace-nowrap`，或给文字容器 `min-w-fit`/缩小到 `text-xs`；
若采用竖排图标+文字布局，建议统一 `flex-col` 而不是让文字自然折行。

---

## U4（P3）质量报告模态框把图表"截"在可视区之外

截图 02 中柱状图只看到 y=20 以上，**看不到 0/10 刻度与 x 轴类别标签**。核对代码后确认这**不是图表缺陷**：

```js
charts.js:181   labels: consistencyLabels,        // 类别标签有提供
charts.js:201-208  scales: { y: { beginAtZero: true, max: 100 } }
charts.js:75-106   radar: min: 0, max: 100
```

即标签与零基线都在配置里，只是模态框内容高度超过可视区（`max-h-[90vh]` + 内部滚动），
用户滚动前看到的是一张"缺标签"的图。
**修复**：给图表容器改为随视口的高度（如 `h-[clamp(180px,32vh,280px)]`），
或把图表区上移到统计卡片之后的可视范围内；亦可把两张图并排改为可折叠。

---

## U5（P2）手机端"全部翻译"不可达

全站按钮接线统计（`.review/ui-static/inventory.json` 的 139 个按钮）显示，只有两个按钮接到 `translate*` 动作：

```
translateSelectedBtn   index.html:202   工具栏「翻译选中项」
translateAllBtn        index.html:205   工具栏「翻译所有项」
```

而 `#translateAllBtn` 的 class 是 `toolbar-btn hidden sm:flex …` —— **<640px 隐藏**。
移动端能用的相关控件只有：

```
底栏   #mobileTranslateBtn  → translateSelected（"翻译"，等于"翻译选中"）
底栏   #mobileSelectAllBtn  → 全选当前页
"更多操作"菜单（#mobileMoreBtn）→ 打开项目 / 项目管理 / 保存项目 / 设置 / 帮助 / 关于
                                  以及 清除译文 / 清除示例
```

即：**手机上没有任何控件能触发"翻译全部"**。存在变通路径（先"全选"再"翻译"），且外接键盘仍可用
`Shift+Enter`（非编辑态下有效），所以定级 P2 而非 P1。
**修复**：把"全部翻译"加进 `#mobileMoreBtn` 菜单（该菜单已有非破坏性条目，且 `data-management.js:815`
的循环会自动为新条目接上"点击后收起"），或让工具栏在窄屏换行而不是直接隐藏。

---

## U6（P2）翻译进度对辅助技术完全不可见

全页扫描结果：`role="progressbar"` 与 `aria-valuenow` **0 处**；页面里只有 3 个可访问性播报点：

```
index.html:2397  #notification            role="alert" aria-live="assertive" aria-atomic="true"   ✓
index.html:1487  #fetchModelsStatus       aria-live="polite"                                     ✓
index.html:2581  #ceFetchModelsStatus     aria-live="polite"                                     ✓
```

而批量翻译的进度反馈元素一个都不在其中：

```
#progressBar / #progressPercentage / #progressStatus / #progressLog       （模态框内）
#inlineProgressBar / #inlineProgressCount / #inlineProgressStatus          （常驻内联条）
```

对屏幕阅读器用户而言：点"翻译"之后到结束 toast 之间**没有任何进度信息**（`showTranslationProgress`
只改视觉，不改可访问性树）。完成/失败 toast 因为 `role="alert"` 会被播报，所以不是"完全无反馈"。
**修复**：给进度条加 `role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="N"`
（`updateProgress` 里同步 `aria-valuenow` 即可，`progress.js:75-90` 已是唯一写入点）；
若要播报文字进度，用一个 `aria-live="polite"` 的隐藏文本并按 10% 粒度更新，避免逐条刷屏。

---

## 复核为**正常**的部分
- **深色类名与实现一致**：CSS 用 `.dark-mode`（188 处），JS 也切换 `.dark-mode`（`settings.js:359/361/368/370`），
  并含 `auto → matchMedia('(prefers-color-scheme: dark)')` 分支；未发现 `.dark` 与 `.dark-mode` 混用。
- **品牌色可达标**：`primary #2563eb` 与白字 5.17（AA），主按钮、链接、选中标签的颜色都达标；
  语义色徽章（绿/红）4.57/5.30 达标。
- **深色正文对比度充足**：gray-100/300/400 on gray-800/900 全部 5.78–13.34，达标。
- **模态框遮罩在代码侧正确**：17 个 `*Modal` 容器 + `#confirmDialog` 共 **18/18** 个对话框容器都是
  `fixed inset-0 bg-black bg-opacity-50 …`（逐行核对），且 `styles.css` 中 `.bg-black` 与 `.bg-opacity-50` 都存在（见 S1 的存疑说明）。
- **图表配置正确**：类别标签、零基线、0–100 量程都在代码里（U4 因此只算布局问题）。
- **无外部字体依赖**：`fontFamily` 全为系统字体栈（含 `PingFang SC` / `Microsoft YaHei`），中文回退合理。

---

## 第二部分：静态样式一致性审计（子代理复核 + 我逐条复算）

子代理（`.review/ui-style/REPORT.md`，10 个可复跑脚本 + 原始 stdout）做了一轮全量样式一致性统计。其**头条结论**是
"元素级 light-only 背景/文字缺 `dark:` 变体的数量 = 0"，这与本报告 **U1 不冲突也不等价**：
它查的是"每个元素身上是否有 dark 变体"，U1 查的是"**承载 `.dark-mode` 的那个元素自身**的 dark 工具类能否匹配"
（依据编译后的选择器形态 `:is(.dark-mode *)`）。U1 依然成立。
下面每条我都独立复算过（脚本与命令已保留）。

| # | 级别 | 问题 | 我的复核结论 |
|---|---|---|---|
| U7 | P2 | `#exportTerminologyBtn`（`index.html:969`）是全页**唯一**的 `bg-green-600` CTA：`bg-green-600` 仅 1 处、`bg-green-700` 1 处，而其他主 CTA 用 `btn-brand` 共 26 处；圆角 `rounded` 而非规范 `rounded-md`，且没有 `text-sm`（16px vs 其他 CTA 的 14px） | 核实 ✓。另**复算对比度：白字 on `green-600` = 3.30:1 → 低于 AA 4.5**（仅够大字） |
| U8 | P2 | `#clearCacheBtn`（`index.html:2099`）的 `border-red-200` 没有 dark 变体 → 深色下变成"灰底 + 浅红边框"，破坏性语义丢失 | 核实 ✓；同族 `:2140/:2143/:2518` 都写了 `dark:border-red-800` |
| U9 | P2 | 颜色 token 漂移：`text-blue-600` 9 处（设置页标签等）而 `text-primary` 用了 53 处；因配置里没有深色 primary 阴影色，又出现 `dark:text-blue-400` 9 处 | 核实 ✓（渲染结果相同，属可维护性/dark 一致性隐患） |
| U10 | P2 | 5 个密码可见性切换按钮（`:1415,1425,1435,1445,1455`）写了 `focus:outline-none` 却**没有** `focus:ring-*` 替代 | 核实 ✓（我核对了 `:1415` 完整 class）；顺带：它们是 `p-1` 图标按钮，命中区约 24px，低于触屏 44px 建议。全页 90 处 `focus:outline-none` 中绝大多数与 `focus:ring-*` 同时出现，属正常 |
| U11 | P3 | 排版/圆角漂移：同一套 `btn-brand + rounded-md + px-4 py-2` 里 7 处带 `text-sm`、7 处不带（14px vs 16px）；`btn-brand` 混用 3 种圆角；35 个表单控件外壳相同但字号不一致（40 个继承 16px、15 个 `text-sm`） | 采纳（子代理给了逐行清单） |
| U12 | P3 | 4 处分隔线 `border-t border-gray-200` 缺 dark 变体，而 81 处同类有 | 采纳 |
| U13 | P3 | 主题配置里 `secondary`/`accent`/`light`、`shadow-brand`/`shadow-inner-lg`、`font-sans` 使用 **0 次**（`primary` 与 `shadow-dark-elevated` 是活的） | 采纳（死 token，属配置收敛） |

**同时推翻子代理提交的一条"疑似"（重要，避免误修）**：

> 子代理提出：`public/app.bundle.js` 的 `@bundle-modules` 清单里列了 `app/features/quality/charts.js`，
> 但正文里 0 处 `new Chart`/`getContext`，怀疑"质量图表可能从不执行"。

**不成立**。我打印了清单并检索了 bundle：`@bundle-modules`（121 项）里含 "quality" 的只有
`app/ui/event-listeners/quality.js` 与 `app/compat/quality.js`；`app/features/quality/charts.js` 确实出现在 bundle 中，
但位置是 **`App.services.ensureQualityModule()` 的懒加载路径数组**（`core/utils.js` 是急加载文件）：

```
... e.services.ensureQualityModule=function(){ ... r=["app/features/quality/checks.js",
    "app/features/quality/scoring.js","app/features/quality/charts.js", ...] ...
```

即：charts.js 本来就**不在急加载清单里**（`app.js` 中 `quality/` 相关只有 `ui/event-listeners/quality.js` 与 `compat/quality.js`），
其代码不出现在正文是**设计如此**；我在第一部分实测过：调用 `ensureQualityModule()` 后 6 个 quality 脚本才从磁盘加载并生效。
因此无需修复，也再次提醒：**bundle 里的"路径字符串"不等于"已打包模块"**（这正是我此前代码复核里那条
"CI 闸门只校验清单、校验不了正文"的同一类混淆）。

---

## 第三部分：响应式与可访问性审计（子代理复核 + 我逐条验证）

子代理（`.review/ui-a11y/REPORT.md`，17 个可复跑脚本 + 原始输出）做了响应式与 a11y 全量静态审计。
**它独立复现了我的 U5（手机端"全部翻译"不可达）**，并补齐了焦点管理与移动端抽屉这两类我未覆盖的问题。
下面每条都经我复算（脚本：`.review/mine/ui-a11y-verify.mjs`）。

| # | 级别 | 问题 | 我的复核 |
|---|---|---|---|
| R1 | **P1** | 移动端抽屉"移出屏幕但仍在 Tab 序列"：`#leftSidebar`(`:122`)/`#rightSidebar`(`:378`) 只用 `transform -translate-x-full / translate-x-full`（+ `md:translate-x-0`），容器是 `fixed inset-0` 且**没有 `hidden`** | 核实 ✓（我打印了两者的 class token：无 `hidden`；全项目 `inert` 属性 **0** 个）→ <768px 时 Tab 会走进不可见抽屉（左 3 / 右 10 个可聚焦后代） |
| R2 | **P1** | `#notification`(`:2397`) 关闭后仅 `opacity-0` + 移出屏幕（`notification.js:203-205`），其内 `#closeNotification`(`:2413`) 仍可 Tab 到 | 采纳（同一类"不可见但可聚焦"） |
| R3 | **P1** | 4 个对话框绕过唯一做焦点管理的 `openModal()`，改用裸 `classList.remove("hidden")`：`#newProjectModal`(`file-panels.js:510`)、`#exportModal`(`:438`)、`#addTermModal`(`terminology.js:356`)、`#translationProgressModal`(`progress.js:211`) → 无初始焦点、无 Tab 陷阱、关闭不还原焦点；背景从不设 `inert`/`aria-hidden` | 采纳（`aria-hidden` 全页仅 4 个、`inert` 0 个） |
| R4 | P2（=我的 U5） | 子代理的关键佐证：`#mobileTranslateBtn` 的处理器里 `translateAll` 分支是**死代码**（`data-and-ui.js:367-372` 先判 `translateSelected` 必为真） | 核实 ✓ —— 说明移动端"翻译全部"是**想做但没接上**，而非不需要；可据此直接把它接进 `#mobileMoreMenu` |
| R5 | P2 | 4 个 range 滑块**完全没有焦点指示**：`src/input.css:1475-1483` 在基础规则上 `outline:none`，11 个自定义 `:focus` 选择器都不覆盖 `range`（含设置页主控件 `#temperature`） | 采纳（自定义 CSS 在 `src/input.css`，编译进 `styles.css`） |
| R6 | P2 | "取消 outline 且无替代 ring"的控件共 6 个：5 个密码切换按钮（`:1415…:1455`）+ `#toolbarEngineCategoryFilter`(`:213`) | 核实 ✓（`:213` 的 class 为 `…focus:outline-none cursor-pointer…`，无 `focus:ring-*`） |
| R7 | P2 | 19 个异步状态表面从不被播报（在我 U6 基础上给出逐元素清单与写入代码行） | 采纳（我复核 `role="progressbar"` 0、`aria-valuenow` 0、`aria-live` 仅 3） |
| R8 | P2 | 嵌套对话框摧毁父级 Tab 陷阱（陷阱是单一全局对象，`export/ui.js:171,203` 会先移除上一个）；设置页内 3 处嵌套 + 术语库 1 处 | 采纳，但**子代理标注为源码推断、未运行时验证**，我同意列为待运行时确认 |
| R9 | P2 | 4 个 textarea 无可访问名（`#projectPromptTemplate*` `:1713/1723/1733/1743`） | 采纳 |
| R10 | P2 | 仅用颜色表达状态：行选中用 `bg-blue-50`，全项目 `aria-selected/checked/pressed` **0 个**；质量报告只有分数没有结论文本 | 核实 ✓（0 个） |
| R11 | P3 | 145 个 `<i>` 图标**0 个** `aria-hidden`；60 个 `<label>` 无 `for`；5 个 API Key 输入仅靠 placeholder；8 个图标按钮命中区 <32px；`target="_blank"` 6 处仅 1 处带 `rel` | 核实 ✓（145/0、6/1）；移动底栏按钮本身达标（`min-h-[44px] min-w-[44px]`） |

**一并澄清一处两来源冲突**：早前后台清单把 `index.html:2621` 记作"1 个内联 `on*=` 处理器"，而 a11y 子代理报"0 个"。
实测：**HTML 内联 `on*` 属性确实 0 个**；那条是内联加载脚本里的 **JS 属性赋值** `s.onerror = function () { … }`（`:2621`），
两个来源并不矛盾，前者只是标签写错了。

**复核为正常**（子代理列出、我抽查一致）：0 个 `role="button"`、0 个不可聚焦的点击目标、
ARIA 引用无悬挂、id 无重复、18/18 对话框的 `role/aria-modal/aria-labelledby` 正确、
无全局 outline 抑制（`.btn-brand:focus-visible` 存在）、17 个模态框都可滚动、
移动端对 `#openProjectBtn`/`#userMenuBtn`/`#translationEngine`/`#translationSearchInput` 有等价入口。

**方法局限（子代理已声明，我认同）**：R8（焦点陷阱丢失）与命中区尺寸均为**静态推断**，未在浏览器/运行时实测。

---

## 存疑（需在浏览器确认，未计入缺陷）

- **S1 模态框背景似乎没有变暗**：归档截图 02/04 中，模态框之外的区域亮度与主界面截图 01 基本相同（白底、按钮仍是饱和蓝），
  而标记与编译产物都表明应有 50% 黑遮罩（`rgba(0,0,0,.5)`）。可能是文档截图在合成时移除了遮罩，也可能是渲染问题。
  判据：在浏览器打开任一模态框后执行
  `getComputedStyle(document.getElementById('exportModal')).backgroundColor` → 期望 `rgba(0, 0, 0, 0.5)`；
  若为 `rgba(0, 0, 0, 0)` 则确认遮罩未生效（届时属于 P2：模态框与背景缺乏视觉分离）。
- **S2 截图时效**：`docs/screenshots/*.png` 为 2026-09-01 版（早于 HEAD 约 10 天）。U3/U4 以及全部"观感"结论以此为限，
  建议在下次发版前用新截图替换，避免文档与实现继续漂移。

---

## 建议修复顺序

1. **U1**：`dark-mode` 载体上移到 `<html>`，并同步修 `charts.js:33` 的判断 —— 这是唯一影响"整页底色"的问题。
2. **R1 / R2 / R3**：三处"不可见但仍可聚焦 / 无焦点管理"是纯增量修复（加 `inert`+`aria-hidden`、关闭后 `visibility:hidden`、
   4 处改用 `openModal()`），却直接影响键盘与读屏用户，建议与 U1 同批处理。
3. **U2 / U7**：把承载信息的 gray-300/400 提到 gray-500/600（最优先是空状态引导文案）；
   `#exportTerminologyBtn` 改为 `btn-brand`（同时解决 3.30:1 的白字对比度与一致性）。
4. **U5 / R4 / U6 / R7**：手机端补"全部翻译"入口（`#mobileTranslateBtn` 里的死分支就是现成线索）；
   进度条补 `role="progressbar"` + `aria-valuenow`，并按 R7 的清单决定哪些状态需要 live 播报。
5. **U8 / U10 / R5 / R6 / R9**：补 `dark:border-red-*`；给 6 个"取消 outline 无替代"的控件与 4 个 range 滑块
   加 `focus-visible:ring-*`；给 4 个 Prompt 模板 textarea 补可访问名。
6. **U3 / U4 / U9 / U11 / U12 / U13 / R10 / R11**：标签 `whitespace-nowrap`、图表容器随视口高度、
   颜色与排版 token 收敛、死 token 清理、图标补 `aria-hidden`、选中态补 `aria-selected`。
7. **S1**：用浏览器核实遮罩与 R8（嵌套焦点陷阱）；顺手用新截图替换 `docs/screenshots/`（当前截图早于 HEAD 约 10 天）。
