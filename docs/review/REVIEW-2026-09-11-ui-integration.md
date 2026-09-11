# 界面功能整合审查 — 2026-09-11 工作树

> 范围：`public/index.html`（2631 行 / 396 个 id / 139 个 button）+ `public/app/ui/**` + 各 feature 面板的**功能整合**：
> 每个交互控件是否真的连到可用代码、动作是否落在正确的对象上、状态是否传到了界面、跨面板是否一致。
> **未修改任何受版本控制的文件**（`git status --porcelain` 仅 `?? .review/`）。
> 相关背景：`docs/review/ui-wiring.md`（上一轮静态接线报告）、`docs/review/REVIEW-2026-09-11-verification.md`（本批次代码复核）。

**结论一句话**：整体接线是健康的 —— 真实页面在 jsdom 中干净启动、396 个 id 零重复、上一轮报告的 4 个悬挂 DOM id 已全部消除、
进度/暂停/取消/重试与导出流程均端到端可用。仍有 **2 个 P1 级界面缺陷**（一个可见按钮完全无功能；进度模态框唯一的"关闭"其实是取消付费翻译），
以及 1 个永不更新的徽章、1 处文案与实现相矛盾。

| # | 级别 | 问题 | 位置 |
|---|---|---|---|
| A1 | P1 | 列头两个"筛选"按钮是**死控件**：可见、可聚焦、有 hover 样式与图标，但全项目无任何处理函数，也没有对应功能 | `public/index.html:305`（`#filterSourceBtn`）、`:314`（`#filterTargetBtn`） |
| A2 | P1 | 翻译进度模态框右上角的 **"关闭"按钮实际执行"取消翻译"**（破坏性、无确认）；该模态框没有任何非破坏性关闭方式 | `public/index.html:663` + `public/app/ui/event-listeners/file-panels.js:403-407` |
| A3 | P2 | `#qualityIssueBadge`（质量报告标签页徽章）**永不更新**，而同一数值另有 `#issueCountBadge` 在被更新 | `public/index.html:398` vs `public/app/features/quality/ui.js:203-217` |
| A4 | P2 | 快捷键帮助文案与实现矛盾：文案称"在所有页面自动生效"，实测**编辑态下 18 个快捷键有 16 个不可达** | `public/index.html:1906,2212` vs `public/app/ui/event-listeners/keyboard.js:387-396` |
| A5 | P3 | `TranslationUIController.handlePauseTranslation` **无任何调用方**；暂停走 `actions.js:pauseTranslation`，与取消（经控制器）不对称 | `public/app/features/translations/ui-controller.js:186` |
| A6 | P3 | `#sourcePagination` / `#targetPagination` 是从未被引用的残留标记（真正的分页容器是 `#paginationContainer`） | `public/index.html:363,372` vs `:358` |
| A7 | P3 | 一次导入弹出 **6 条通知**，其中 3 条语义重复（"已切换为新项目"/"已自动创建项目"/"已创建项目并导入"）；通知队列上限 5，用户可能看不到"文件解析成功" | `features/files/*` + `notification.js:3,56-70` |
| A8 | P3（观察） | 质量报告"定位"会选中条目并关闭报告，但**不聚焦**译文框（可能是有意设计，仅记录） | `features/quality/ui.js:166-189,526` |

---

## 0. 方法（三层，互相印证）

1. **静态交叉引用**：用属性边界感知的正则从 `index.html` 抽出全部 id/data-*/button/inline handler；
   从 140 个 JS 文件抽出 684 处字面量查找（`DOMCache.get` 584、`getElementById` 58、`openModal` 18、`closeModal` 13、
   `closest('#id')` 6、模板/属性动态 6、`DOMCache.query` 1），逐一判定"查找无元素"与"元素无读取方"。
2. **真实页面启动**：`public/index.html` + `public/app.bundle.js`（614 333 B）在 jsdom 中按正常路径启动
   （复用 `.review/ui-runtime/lib/env.mjs` 的桩：fetch/XHR/IndexedDB/matchMedia 等）。
3. **逐控件点击扫描**（我的 `mine/ui-click-sweep.mjs`）：对全部 141 个 button 逐个真实 `click()`，记录
   「自身 DOM 路径上是否存在 click 监听器（排除 body/document/window，故容器委托算已接）」
   「点击后是否有可观察效果（DOM 变更 / 被监视的 23 个动作全局 / 模态框可见性变化）」「是否抛错或新增错误日志」；
   异常项再**每次全新启动**复测（避免串行点击造成状态串味）。

---

## A. 确认的缺陷

### A1（P1）两个"筛选"按钮是死控件

**静态**：`filterSourceBtn` / `filterTargetBtn` 两个字符串在全项目中**各只出现 1 次**，就是 HTML 里的定义本身
（`public/index.html:305`、`:314`），JS/样式/bundle 中均为 0 次。

**运行时**（点击扫描，jsdom 真实页面）：

```
=== A. buttons with NO click listener on their own DOM path : 3 ===
  VISIBLE  button#filterSourceBtn.text-xs.md:text-sm "筛选原文"
  hidden   button#filterTargetBtn.text-xs.md:text-sm "筛选译文"
```

两个按钮点击后只有 1 次 DOM 变更，那是 `document.body` 上 `data-and-ui.js:465-485` 的
`.btn-click-spin-trigger` 旋转特效（该监听器只对带该类名的元素生效），**没有任何业务效果**；
全项目也不存在"按原文/译文列筛选"的功能（`search.js` 只按搜索词过滤 `sourceText/targetText/context/resourceId`）。
（`#filterTargetBtn` 在 jsdom 中显示 hidden 只是因为 `hidden md:flex` 依赖媒体查询，桌面端是可见的。）

**影响**：一个带筛选图标、可聚焦、hover 有反馈的按钮，用户点了永远没有反应；`title`/`aria-label` 还明确承诺了"筛选原文/筛选译文"。
**修复**：二选一 —— ①实现列筛选（把 `TranslationViewStore.setFilter` 的输入改为"仅原文命中/仅译文命中/两者"三种模式，按钮切换模式并高亮）；
②删除这两个按钮，避免虚假承诺。

### A2（P1）进度模态框的"关闭"其实是"取消翻译"，且没有真正的关闭方式

```
index.html:663  <button id="cancelTranslationBtn" ... title="关闭" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
file-panels.js:403-407   EventManager.add(cancelTranslationBtn, "click", cancelTranslation, ...)
```

- 该按钮 **不是** `.close-modal`，因此不参与 `data-and-ui.js:103-109` 的通用关闭委托；
- 应用内没有"点遮罩关闭模态框"的通用实现（只有 `confirm-dialog.js:115` 有自己的遮罩关闭）；
- 模态框底部按钮行为 `index.html:685-695`：暂停 / 继续 / 重试失败 —— **没有"取消翻译"按钮**；
  而常驻的内联进度条却有三个专用按钮（`#inlinePauseBtn` / `#inlineResumeBtn` / `#inlineCancelBtn`，`index.html:277-283`）。

**影响**：批处理进行中，用户想"把日志窗口收起来"而点右上角 ✕ → 实际触发 `cancelTranslation`，**中止正在付费的翻译**，且无二次确认；
反过来，想取消翻译的用户在这个模态框里找不到写着"取消翻译"的按钮。无障碍标签"关闭"也与破坏性行为不符。

**系统化复核（17 个模态框全量扫描，`mine/ui-modal-lifecycle.mjs`）**：

```
modals: 17           全部可用 openModal() 打开
× / .close-modal 缺失        : 0
× 存在但未关闭              : 1  → translationProgressModal   ← 唯一例外，正是本项
Escape 未关闭               : 0  （17/17 都能用 Escape 关闭）
点击遮罩可关闭              : 0  （全应用统一不支持，属一致设计）
```

即：**进度框是唯一"× 不执行关闭"的模态框**；用户并非完全被困（Escape 可以关，批处理结束时也会自动隐藏），
但唯一可见的关闭控件执行的是破坏性动作 —— 这正是本项要修的点。
**修复**：给该 ✕ 加 `close-modal`（或改为调用 `closeModal()`），另在按钮行补一个明确的"取消翻译"（可复用 `App.ui.showConfirmDialog` 做确认）。

### A3（P2）`#qualityIssueBadge` 永不更新

```
index.html:398   <span class="tab-badge hidden" id="qualityIssueBadge">0</span>
全项目 JS 引用：0 次（静态扫描 140 个文件；bundle 内同样为 0）
```

同一数值在质量面板里由另一个元素维护：`features/quality/ui.js:203-217` 更新 `#issueCountBadge`
（`${totalIssues} 个问题`，并按是否有问题切换红/绿样式）。也就是说"问题数"已经在状态里，只是没有同步到标签页徽章。
**影响**：质量报告标签页上的徽章永远隐藏、永远显示 0；用户切到该标签前看不到提示。
**修复**：在 `__updateIssuesTableImpl` 更新 `#issueCountBadge` 的同一处，把总数写进 `#qualityIssueBadge` 并按 `totalIssues > 0` 切换 `hidden`；
质量结果被清空时同步隐藏。

### A4（P2）快捷键帮助文案与编辑态守卫相矛盾

本批次给 `keyboard.js` 加了 `isEditableContext` 守卫（`:387-396`：编辑态只放行 `saveProject`/`cancelTranslation`/`escape`）。
用真实 `DEFAULT_SHORTCUTS` 逐条测量（我的 `mine/shortcut-coverage.mjs`，并在守卫处插桩确认判定值）：

```
shortcut               keys                  focus in textarea            focus on body
saveProject            ctrl+s                RAN                          RAN
cancelTranslation      ctrl+.                RAN                          RAN
openSettings           ctrl+,                skipped (editable=true)      RAN
newProject             ctrl+alt+n            skipped                      RAN
openProject            ctrl+o                skipped                      RAN
focusSearch            ctrl+f                skipped                      RAN
translateSelected      ctrl+enter            skipped                      RAN
translateAll           shift+enter           skipped                      RAN
selectCurrentPage      ctrl+a                skipped                      RAN
clearTargets           ctrl+shift+backspace  skipped                      RAN(prevented)
prevItem/nextItem      ctrl+alt+↑/↓          skipped                      RAN(prevented)
prevPage/nextPage      ctrl+alt+[ / ]        skipped                      RAN
openTerminology        ctrl+alt+t            skipped                      RAN
runQualityCheck        ctrl+alt+r            skipped                      RAN
openQualityReport      ctrl+alt+q            skipped                      RAN
→ 编辑态不可达：16 / 18
```

而界面文案仍承诺全局生效：

- `index.html:1906`："快捷键在所有页面自动生效。可点击「修改」录制新按键…"
- `index.html:2212`："快捷键 `Ctrl/⌘ + ,` 可快速打开设置。"（编辑态下已不可用）
- 快捷键设置面板（`#shortcutsList`，`ui/event-listeners/settings.js:11+`）逐条列出这些键，没有任何"仅非编辑状态"的提示。

**影响**：这个应用的主要焦点位置就是译文 `textarea` 列表；用户在编辑时按 `Ctrl+F`/`Ctrl+,`/`Ctrl+Alt+T`/`Ctrl+Alt+↓`
全部静默失效（键不再被吞，这点是好的），而界面与帮助文案都说它们应该生效。
**修复**：二选一 —— ①细粒度化守卫：只拦与文本编辑冲突的组合（`Ctrl+A`、`Ctrl+Enter`、`Shift+Enter`、`Ctrl+F`），
放行 `Ctrl+Alt+*` 家族；②保留现守卫，但更正这两处文案，并在快捷键面板里给受限项加"编辑中不触发"的标注。

### A5（P3）`handlePauseTranslation` 是死方法

`ui-controller.js:186` 定义了 `handlePauseTranslation`，全项目**无任何调用方**（取消则不同：`actions.js:663` 会调用
`controller.handleCancelTranslation()`）。按钮实际走 `actions.js:680 pauseTranslation()` 直接操作 `BatchProgressStore`。
两者目前效果一致，但**不对称**：以后若在控制器的暂停方法里补逻辑（例如 UI 文案/埋点），不会生效。
**修复**：`pauseTranslation()` 改为调用控制器方法（与取消保持一致），或删除该死方法。

### A6（P3）两个残留的分页标记

`#sourcePagination`（`index.html:363`）与 `#targetPagination`（`:372`，且带 `hidden`）从未被任何 JS 或样式引用；
真正的分页容器是 `#paginationContainer`（`:358`，`search.js` 4 处 + `virtual-scroll.js` 2 处引用，负责显隐与页码更新）。
两者是列头里的历史残留（`sourcePagination` 的子元素 `#sourceStartRange/#sourcePageInfo/#sourcePrevBtn` 等才是被更新的对象）。
**修复**：删除 `#targetPagination`（空且隐藏）；`#sourcePagination` 作为被更新控件的包装可以保留，但建议加注释说明其非容器身份。

---

## B. 复核为**正常**的部分（本次未能攻破）

- **启动健康**：jsdom 中按真实路径启动 822 ms，`readyState=complete`，
  **0 个 window error / 0 个 unhandled rejection / 0 次 console.error**，只有 1 条预期告警（无 IndexedDB 的健康检查降级）
  与 jsdom 自身的 CSS 解析噪音；3 个资源全部加载成功（含 614 333 B 的 bundle）。
  启动后注册 **226 个监听器**（click 144、change 24、input 13、keydown 3…），112 个不同点击目标。
- **id 完整性**：396 个 id **零重复**（两种独立抽取方式一致；朴素的 `\bid=` 正则会因 `data-*-id` 误报 26 个）。
- **悬挂查找已清零**：上一轮报告中的 4 个（`translateSelected`/`translateAll`/`cancelTranslation`/`pauseTranslation`）已消除；
  本轮静态清单里 3 个"疑似悬挂"经逐一核查**全是启发式误报**：
  ①`terminology${tabName==="list"?"List":"ImportExport"}Panel` 展开正确，且 `#terminologyListPanel`(:827)/`#terminologyImportExportPanel`(:882) 都存在；
  ②`storage-error-handler.js:271` 是 `showModal("存储清理指南", guide)` —— 标题字符串，不是 id；
  ③`settings.js:161` 是逗号选择器 `#settingsModal nav, #settingsModal .settings-nav`，`DOMCache.query` 走 `querySelectorAll`，正常。
- **翻译控制的按钮状态机**：`pause/resume/retryFailed` 的 `disabled` 与内联条的 `hidden` 全部由
  `progress.js:39-72` 依据 `BatchProgressStore` 推导；批处理生命周期（`beginBatch`/`endBatch`/`recordFailedItems`/`cancelBatch`）
  由 `services/translation/business-logic.js` 独占 —— 状态与视图同源，未发现第二处裸写。
- **导出流程端到端可用**：点击 `#exportBtn` 打开导出模态框 → 点击 `#confirmExportBtn` →
  实际提示 `success | 导出成功 | 已成功按原格式导出 1 个文件（包含原文）`（伴随的 IndexedDB 告警是 jsdom 无 indexedDB 所致，非应用缺陷）。
- **通知系统**：队列 push/drain 实现完整（`notification.js:56-70` 入队 + `:220-229` 关闭时出队重放，上限 5，带 `#notificationQueueBadge` 计数）；
  `#notificationActionBtn` 采用"显示带操作的通知时才绑定"的方式（`:102-111`，`opts.action` 为函数），属于按需接线而非漏接。
- **分页与内联按钮的"无反应"是正确的**：单页时 `#sourcePrevBtn/#sourceNextBtn` 均为 `disabled=true` 且容器隐藏；
  空闲时 `#inlineCancelBtn` 所在容器 `hidden`，不在用户可达范围。
- **术语库/质量/引擎等懒加载面板**：`ensureQualityModule()` / `ensureTerminologyImportExportModule()` 被调用后
  相关实现函数（`__runQualityCheckImpl`、`importTerminology`、`exportTerminology` 等 13 个）全部就位，额外加载 10 个脚本、0 错误。

---

## B2. 功能流整合（第二部分：跨面板与生命周期）

这一部分把"一条动作是否贯通到状态与视图"逐条跑通（全部为真实页面 jsdom 驱动，每项独立启动）。

### B2.1 模态框生命周期（17/17 全量）

见 A2 中的表格：全部可打开；**16/17 的 × 能关闭**（唯一例外是进度框，见 A2）；**17/17 都能用 Escape 关闭**；
0 个支持点击遮罩关闭（全应用一致，不视为缺陷）。另注：模态框打开时 `document.body` 不加任何滚动锁类
（`overflow` 为空），属于一致的设计取舍，仅记录。

### B2.2 设置项：保存 → 持久化 → 即时生效

`#saveSettings`（`index.html:2115`，绑定于 `ui/event-listeners/settings.js:280+`）路径实测：

```
控制项                  UI 值    保存后 SettingsCache    一致
themeMode              light    light                   ✓
fontSize               small    small                   ✓
itemsPerPage           10       10                      ✓
autoScrollEnabled      false    false                   ✓
formatJSON             false    false                   ✓
console errors: 0   window errors: 0
外观即时生效：改变 fontSize 后 <html> class 变为 "text-sm"（无需保存即预览）
```

另外静态核对了设置项的**读写闭环**（`mine/settings-closure.mjs`）：设置保存路径写入 **50 个键**，
每一个都能在 `public/app` 的其他文件里找到读取处 —— **0 个"能改但没人读"的死开关**。

### B2.3 核心流：导入 → 解析 → 状态 → 列表/计数

用 UI 自己走的入口 `App.impl.processFiles([file])` 导入一个 3 条目的 JSON（`mine/ui-import-flow.mjs`）：

```
                      变化前            导入后
translationItems      6                 3            （示例项目被自动替换为新项目）
translations.filtered 6                 3
列表 textarea 行数     6                 3
#sourceCount          "6 项"            "3 项"
#targetCount          "4/6 项"          "0/3 项"
通知                   —                 处理文件 / 已切换为新项目 / 已自动创建项目 /
                                        解析文件 / 文件解析成功（3 个翻译项）/ 已创建项目并导入
console errors: 0    window errors: 0
导出交接：点击 #exportBtn 打开导出框，格式选项 ["original","xml","xliff","json","yaml","csv"]
```

状态、计数、列表 DOM、文件树四条通道同步更新，无错误。**但一次导入产生 6 条通知**，其中 3 条语义重复（见 A7）。

### B2.4 质量检查 → 问题表 → 徽章 → 定位跳转

```
点击 #runQualityCheckBtn（懒加载模块按需就位）
  AppState.qualityCheckResults.issues : 3
  #issuesTableBody 行数                : 3
  #issueCountBadge                     : "3 个问题"      ← 面板徽章更新
  #qualityIssueBadge                   : "0"、仍 hidden  ← 标签页徽章未更新（A3 实证）
点击问题行内「定位」(button[data-action="focusTranslationItem"], itemId=item-3)
  AppState.translations.selected      : -1 → 2           ← 正确定位到该条目
  质量报告模态框                        : 自动关闭
  译文 textarea 焦点                    : 未聚焦（A8，仅记录）
console errors: 2（均为 "Failed to create chart: can't acquire context" —— jsdom 无 canvas，非应用缺陷）
```

### A7（P3）一次导入 6 条通知、3 条重复，且队列上限会截断

`notification.js:3` 的 `NOTIFICATION_QUEUE_LIMIT = 5`，而导入一条文件推送了 6 条；
其中"已切换为新项目"/"已自动创建项目"/"已创建项目并导入"表达的是同一件事（自动建项目）。
`notification.js:56-70` 在当前通知可见时入队并只显示 `+N` 角标、每条最多停留 1200 ms，
因此用户很可能**看不到"文件解析成功（找到 3 个翻译项）"这条关键信息**。
**修复**：合并为 1–2 条（例如"已创建新项目并导入 1 个文件（3 个条目）"，示例项目替换作为副标题），或把去重逻辑放进通知层。

### A8（P3，观察）"定位"不聚焦译文框

`quality/ui.js:166-189` 的委托点击只调用 `__focusTranslationItemImpl(itemId)`（→ 选中 + 滚动），
未聚焦目标 textarea；应用在"点击列表条目"路径上是有聚焦行为的（`selectTranslationItem(..., {shouldFocusTextarea:true})`）。
两处行为不一致，但"定位"语义上只需要定位，故仅记录为观察项，建议明确取舍。

---

## C. 排查后**推翻**的怀疑（如实记录，避免误报进入结论）

1. **"未选择条目时点击『翻译选中』完全静默"** —— 一度以为 `showValidationError` 没有出口。
   实际是通知**队列**行为：`notification.js:50-71` 在当前通知可见时把新通知入队（`#notificationQueueBadge` 显示 +N），
   我读取 DOM 文本时最新提示还没轮到显示。`showValidationError` (`ui-controller.js:242-245`) 走的是与其它提示相同的通道，
   **不是缺陷**。
2. **"`#notificationActionBtn` 从不绑定监听器"** —— 我用 `{onAction}` 触发的，而应用约定是 `opts.action`（`notification.js:102`），
   参数键写错导致假阴性，**不是缺陷**。
3. **"`#targetPagination` 从不更新 = 分页功能缺失"** —— 真正的容器是 `#paginationContainer`，分页本身工作正常；
   该项降级为"残留标记"（A6）。
4. **"进度模态框无法关闭 = 完全被困"** —— 批处理结束/取消后模态框会自动隐藏（`hideTranslationProgress`），
   所以 A2 的准确表述是"**唯一的主动关闭方式具有破坏性且标签错误**"，而非完全无法关闭。

---

## D. 建议修复顺序

1. **A1**：给两个筛选按钮接上真实筛选（或在同一次提交里删掉），这是唯一"用户点了永远没反应"的可见控件。
2. **A2**：进度模态框的 ✕ 恢复为"关闭"，新增独立的"取消翻译"按钮（建议带确认）—— 涉及付费操作，优先级紧随 A1。
3. **A3**：把问题总数同步到 `#qualityIssueBadge`（3 行改动，与 `#issueCountBadge` 同一处更新）。
4. **A4**：先定策略（细粒度守卫 或 更正文案），再补一条"编辑态 + 非编辑态"的快捷键覆盖用例锁定该策略。
5. **A5 / A6**：删除死方法与残留标记（顺手清理，避免下次接线审计再被误报）。
6. **A7**：合并导入路径的三条重复通知（顺手把队列上限 5 与一次 6 条的现实对齐）。
7. **A8**：明确"定位"是否应聚焦译文框，并在两处路径上保持一致。
