# 功能审查报告 — 汇总

> **修复状态（2026-09-10 更新）**：本报告中的 **P0 全部 5 项、P1 全部 5 项**，以及 P2 的
> 键盘守卫、`ui-controller.js` 错误 id 均已修复并补充回归测试；另修复了
> `PlaceholderGuard` 的 printf 误报。修复清单与验证方式见文末「修复记录」。
> 其余 P2 项（Android 数组/复数条目、PO 转义、iOS `.strings`、YAML 空对象、
> 术语库 CSV 再导入、XLIFF 2.0 命名空间等）仍未修复，保留在分报告中。

**项目**：`translation-tool` v1.3.3（纯前端本地化翻译工具，原生 JS + Tailwind）
**审查日期**：2026-09-10
**方法**：源码走查 + 在 Node/vm 与 jsdom 中加载真实源码做对抗性复现。所有结论均经过实际运行验证。

## 覆盖率与证据

| 报告 | 范围 | 规模 | 发现数 |
|---|---|---|---|
| [parsers-export.md](./parsers-export.md) | 14 种格式解析器 + 译文导出回写 | 997 行 | 27 |
| [engines.md](./engines.md) | 6 个翻译引擎 + 批量/限速/重试/取消/占位符 | 756 行 | 12 |
| [ui-wiring.md](./ui-wiring.md) | index.html ↔ JS 的 DOM 接线完整性 | 492 行 | 7 组 |

基线：`npm test` **373 用例 / 24 文件全部通过**；`check-state`、`check-globals` 通过。
**关键背景**：这 373 个用例全部通过，但下列缺陷一个都没被捕获 —— 缺陷集中在
**parse → 编辑 → 导出 → 再解析**、**模型异常返回**、**取消/暂停时序** 这三类未被测试覆盖的路径上。

---

## P0 — 静默数据损坏（用户会拿到错误的文件，且界面提示"成功"）

### 1. JSON「原格式」导出写入 0 条译文
`parsers/json.js:52` 以 `traverseValue(json, "$")` 起根，路径形如 `$.app.title`；
而 `translation-original.js:266-288` 的 `setValueByPath` 按 `.` 切分后逐级取键，
第一个键就是 `"$"` → `json["$"]` 为 undefined → 每个条目都提前 return。

**后果**：导出的 JSON 与输入语义完全相同，一个译文都没写进去，而 UI 报告导出成功。
（已独立复核：解析器 docstring 自称"以 `$` 为根"，导出器却不认 `$`。）

### 2. XLIFF 源文含实体/内联标签时，译文永远写不回去
`parsers/xliff.js:20-31` 为保留内联标记，把**序列化后的 XML**存为 `sourceText`
（如 `Fish &amp; Chips`、`Click <g id="1">here</g> now`）；
而导出器 `translation-formats.js:391-394` 用 `source.textContent`（已解码、已剥标签）去比对 →
永不相等 → target 永不写入，且**无任何警告**。真实 XLIFF 文件普遍带实体与内联标签。

### 3. Qt TS 复数消息在"只导出、不修改"的情况下被破坏
`parsers/qt-ts.js:13-22` 把所有 `<numerusform>` 摊平成一个用 `\n` 连接的条目；
导出时 `translation-original.js:150-157` 又把这段文本写进**每一个** numerusform。
结果：原本正确的复数翻译被替换成重复拼接的同一串文本。

### 4. 术语库自动替换造成子串误伤（默认开启）
`terminology.js` 的 `__terminologyReplaceIgnoreCase` 做**无词边界**的子串替换。
实测（真实源码 + 真实 `applyTerminologyToTranslation`）：

```
This category contains a cat.  →  This 猫egory contains a 猫.
Please open the node.          →  Please open the 否de.
Set the width and height.      →  Set the w标识th and height.
```

`autoApplyTerms` 默认开启，且它作用于**每一条**译文（`batch.js:118-120`、`translate.js` 同理）。
现有测试只用了 `API` / `XML` / `C++` 这类不会出现在其他词内部的术语，因此完全没暴露。

### 5. 重复源文全部拿到第一条的译文
`translation-formats.js:394`（XLIFF）、`:137`（通用 XML）用 `items.find(...)` 按**源文文本**匹配。
"Open"/"Cancel"/"OK" 这类重复串会全部写成第一条的译文。（Android 因按 resourceId 匹配而无此问题。）

---

## P1 — 承诺的行为未生效

### 6. 暂停按钮在 AI 批量路径上是死代码
`ai-engine-base.js:689` 定义了 `waitWhilePaused`，**全文件仅此一处出现，无任何调用点**
（我已 grep 独立复核）。chunk worker 循环 `:1047-1068` 只看 `batchFailed` 和队列长度。
实测：20 条 / 4 chunk，暂停后仍有 **3 个 chunk 请求被发出**，整批在暂停状态下跑完。
用户暂停一个昂贵的长批次以止损，实际仍会全额发出。

### 7. 取消后仍继续请求（并触发指数退避重试）
`translate.js:40` 的重试循环内没有任何取消检查（我已独立复核：无 `isUserCancelled` / `USER_CANCELLED`）。
实测：取消后仍发出 4 次请求，其中 2 次来自退避重试（约 1.1 s / 3.1 s），
结果全部被 `processOne` 在 await 之后丢弃。付费引擎上等于白烧配额，进度条还会再转 1–3.4 s。

### 8. 占位符完整性校验从未启用
`PlaceholderGuard.validate` 被导出、也有测试，但**生产代码从不调用它**
（仅 `protect` / `restore` 被调用于 `batch.js:111-113`、`translate.js:35,59`）。
即：模型漏掉或改坏 `{0}` / `%s` 时，译文照样被写入并标记为已翻译，只有事后手动跑质量报告才可能发现。
（子代理还在 `placeholder-guard.js` 发现**误报**：普通百分比文本会被当成占位符处理，以致送给模型前就被改写。）

### 9. 超长条目被截断后仍标记为"已翻译"
`security-utils.js:179` 的 `sanitizeForApi` 硬截断到 10000 字符。
实测：12000 字符的源文，模型**实际只收到 10000 字符**，译完即被当作该条目的完整译文提交。
项目确实会弹一次 toast 警告（`_aiNotifyLongTextOnce`）——比完全静默好，但截断结果仍被当作成品落库。

### 10. 取消/暂停之外：`BatchResumeManager` 是死代码
`batch-resume.js` 有完整实现、被写进 bundle、还有专门的测试文件，
但**全项目没有任何调用点**（仅测试引用）。README 把"断点续传"列为特性 ——
实际续传能力来自自动保存恢复，与这个模块无关。

---

## P2 — 健壮性与 UI 接线

- **批量结果按数组下标信任**：模型返回等长但顺序错位的数组会**静默错配译文**；
  返回对象数组（`[{text:"..."}]`）会被当作合法结果存入 `targetText`（实测 `typeof !== "string"`），
  最终渲染/导出为 `[object Object]`；`null` / `""` 同样被当作成功。
  提示词已明确要求"按顺序一一对应的字符串数组"，故这是防御层缺失而非必然触发。
- **键盘守卫缺陷（影响面最广的 UI 问题）**：`keyboard.js:355-363` 在 `runAction` 的
  可编辑性判断**之前**无条件 `preventDefault()`。实测在任意输入框内：
  `Shift+Enter` 被取消**并触发全量翻译**；`Ctrl+A` 全选被吞且无任何动作；`Ctrl+F` 抢走焦点；
  `Ctrl+,` 等会在半写的编辑器上弹出模态框。提升守卫位置即可一次修好大部分。
- **8 处 DOM 查找 ID 写错**：`ui-controller.js:55,63,71,79,314-317` 查 `translateSelected`
  等，真实 ID 均带 `Btn` 后缀（`index.html:202,205,663,686`）。该代码已进入 bundle 生效，
  仅因 `progress.js` 有一份正确实现而掩盖。
- **2 个真正无响应的按钮**：`#filterSourceBtn`（`index.html:305`）、`#filterTargetBtn`（`:314`）
  —— 这两个字符串在全项目中仅出现在 HTML 定义处，无任何 JS 读取，点击无任何效果。
- **`#qualityIssueBadge`**（`index.html:398`）从未被更新，永久隐藏。
- 其余见各分报告：Android 数组/复数/内联标记条目被丢弃、PO 导出未转义（含换行即产生非法 PO）、
  iOS `.strings` 导出漏更新且尾随 `\` 会删除下一条、YAML 对非 JSON/YAML 条目导出空 `{}`、
  术语库 CSV 无法再导入（中文表头）、畸形 XML 退化成垃圾条目却提示成功、XLIFF 2.0 导出整体 no-op、
  XLIFF 重复导出双重转义、`TranslationDiff` 归一化空白导致纯空白变更不可见、
  `ModelFetcher.deriveModelsUrl` 丢弃查询串。

---

## 明确验证为正常的部分

- **编码处理**：UTF-16LE+BOM、UTF-8 BOM、GBK、空文件均正确；CRLF 归一化正常。
- **XML 转义安全**：`escapeXml` 替换顺序正确，通用 XML / XLIFF / Android / 术语库 XML
  **无法通过译文注入标签**；`escapeCsv` 的所有调用点都自行加引号，CSV 引号翻倍正确。
- **解析器基础能力**：Android resourceId 匹配、RESX 实体解码与 `xml:space` 保留、
  Qt TS 非复数条目、PO 基础/复数/注释/表头、iOS 分词转义、CSV 引号字段与内嵌换行、
  术语库 JSON 往返 —— 均正确。
- **UI 接线**：**0 个重复 id**、**0 个内联 `on*` 处理器**、0 个悬空 `aria-*`/`for`/锚点、
  9 个 `data-*` 钩子全部有真实读取方、4 个 `<link>` 资源全部存在、
  **123 个脚本 0 个解析期前向引用**、应用在 jsdom 中可正常启动（0 运行时错误）。
- **引擎层正常项**：chunk 并发上限与 RPS 节流、有序结果槽在并发下保持顺序、
  自适应拆半重试、取消时 `partialOutputs` 保持前缀语义、API Key 未泄漏进日志/DOM。

---

## 建议的修复优先级

1. **`setValueByPath` 支持 `$` 根与 `[n]` 下标** —— 一行级修复，恢复 JSON 原格式导出（当前完全不可用）。
2. **术语替换加词边界**（或改为按词/按最长优先匹配）—— 影响每一条译文，默认开启。
3. **XLIFF 源文匹配改为"序列化文本 ↔ 序列化文本"**，并为 XLIFF 2.0 使用命名空间感知查询。
4. **暂停/取消真正生效**：AI chunk 任务入口 await `waitWhilePaused()`；`translate.js` 重试循环加取消检查。
5. **收紧结果校验**：批量路径断言每项为非空字符串；接入 `PlaceholderGuard.validate`。
6. **键盘守卫提升到 `preventDefault` 之前**，并给 `translateAll`/`translateSelected` 补可编辑性守卫。
7. Qt TS 复数保序导出、重复源文改按 id/resourceId 匹配、修 `ui-controller.js` 的 4 个 ID。

> 修复时建议**先补测试再改代码**：本次 27+12 项缺陷几乎全部落在原有 373 个用例未覆盖的
> 往返与时序路径上，补上这些用例才能防止回归。

---

## 修复记录（2026-09-10）

### 已修复

| # | 缺陷 | 修复位置 | 验证方式 |
|---|---|---|---|
| 1 | JSON 原格式导出写入 0 条译文 | `translation-original.js` 新增 `parseJsonPath`，支持 `$` 根、`.key`、`[n]` | `export-original-roundtrip.test.mjs` 7 个 JSON 用例 |
| 2 | 术语替换子串误伤 | `terminology.js` 加 `isReplacementSite` 词边界（`\p{L}\p{N}_`，含 CJK 回退范围） | `terminology.test.mjs` 新增 8 个边界用例 |
| 3 | XLIFF 实体/内联标签译文丢失 | `translation-formats.js` 改为「序列化文本↔序列化文本」比对 + `unitId` 定位 + 命名空间感知查询 | `export-original-roundtrip.test.mjs` 4 个 XLIFF 用例 |
| 4 | XLIFF 2.0 导出空操作 | 同上（`getElementsByTagNameNS` 遍历 `unit`/`segment`） | 同上，含 2.0 用例 |
| 5 | 重复源文共用第一条译文 | 按 `metadata.unitId` 建队列定位，文本回退用 `used` 集合去重 | 同上，含重复源文用例 |
| 6 | 暂停在 AI 批量路径失效 | `ai-engine-base.js` 在 `processChunkTask` 入口 `await waitWhilePaused()` | `engine-batch-hardening.test.mjs` 暂停用例（断言暂停期间零派发） |
| 7 | 取消后仍继续请求/重试 | `translate.js` 派发前与退避后加取消检查；`helpers.js` 新增 `translationIsCancelled` | 新增 helper 用例 + 现有取消用例 |
| 8 | 坏结果被当作成功译文 | `helpers.js` 新增 `translationValidateResult`；`batch.js` 校验后再写入 | `engine-batch-hardening.test.mjs` 4 个校验用例 |
| 9 | 占位符校验从未启用 | `batch.js`/`translate.js` 接入 `PlaceholderGuard.validate` | 同上（占位符损坏 → 记为失败） |
| 10 | 批量路径未做占位符保护 | `ai-engine-base.js` 发送前 `protect`，映射存于 `item.__phGuardMap`，`batch.js` 据此还原 | 同上（`%s` 成功往返） |
| 11 | printf 误报（`50% off` → `50«0»ff`） | `placeholder-guard.js` 标志集去掉字面空格 | `placeholder-guard.test.mjs` 新增 4 个用例 |
| 12 | 键盘守卫顺序缺陷 | `keyboard.js` 新增 `isEditableContext`，`preventDefault` 仅在动作真正执行时调用；`translateAll`/`translateSelected` 补守卫 | 源码级修复（未新增 jsdom 交互用例） |
| 13 | `ui-controller.js` 4 个错误 DOM id | 加 `Btn` 后缀，与 `index.html`/`file-panels.js` 对齐 | 源码级修复 |
| 14 | Qt TS 复数被写坏 | `qt-ts.js` 记录形态数；`translation-original.js` 仅在段数匹配时按序写入，否则保守保留 | `export-original-roundtrip.test.mjs` 3 个 Qt TS 用例 |

### 第二批修复（继续处理分报告中的其余项）

| # | 缺陷 | 修复位置 | 验证方式 |
|---|---|---|---|
| 15 | PO 导出只转义双引号：换行→非法 PO、`\t`/`\`/尾随反斜杠破坏结构 | `translation-original.js` 新增 `__poEscape` + 按 `\n` 断行的 `__poSplitLines`；msgid 改为「解码后精确比对」（支持续行拼接），修复含 `\n` 的 msgid 永不匹配 | `export-po-strings.test.mjs` 8 个用例 |
| 16 | iOS `.strings` 导出：`[^"]*` 遇 `\"` 截断→含转义引号/多行值永不更新；尾随 `\` 吞引号并破坏下一条 | `translation-original.js` 改为转义感知的行正则 + `__stringsEscape`/`__stringsUnescape` | 同上 6 个用例 |
| 17 | Android 导出：`[^<]*` 匹配不到含内联标记的字符串；`string-array`/`plurals` 条目全部静默丢弃；原值未转义 | `translation-formats.js` 重写为三类资源分别寻址（`name` / `name:index` / `name[quantity]`），值经 `safeAndroidValue` 逐文本节点转义，含标记时自动加 `formatted="false"`；解析器补充 `arrayName`/`arrayIndex` 与 `name:index` 形式 | `export-android.test.mjs` 12 个用例 |
| 18 | 术语库 CSV 用中文表头导出，导致自家文件无法再导入 | `terminology-export.js` 表头改为 `source,target,partOfSpeech,definition,createdAt`；词性导出 key 而非本地化显示名；字段按 RFC 4180 加引号 | `terminology-csv-roundtrip.test.mjs` 10 个用例 |
| 19 | YAML 导出：路径未跳过 `$` 根→全部内容嵌套在 `"$"` 下；无 `metadata.path` 的条目（PO/XLIFF/Android/RESX/iOS/CSV 来源）静默 dump `{}` | `yaml.js` 过滤根符号；无路径且有条目时抛错并提示改用匹配格式 | `export-yaml.test.mjs` 9 个用例 |
| 20 | 畸形 XML 被「解析器异常→回退纯文本」吞掉，变成垃圾条目却提示导入成功 | `parse.js` 新增 `MalformedXmlError`，XML 系文件的畸形内容直接失败，不再退化 | `parser-registry.test.mjs` 新增 5 个用例 |

### 测试结果（第二批修复后）

- 测试套件：**30 个文件 / 470 个用例全部通过**（本轮新增 50 个）
- `check-state`、`check-globals` 通过
- `public/app.bundle.js` 已重建：123/123 模块，完整性清单校验通过

### 我在本轮修复中自己引入并已纠正的问题

在修改 `parsers/yaml.js` 时，我的一次编辑**误删了 `for (let i = 0; i < parts.length; i++) {` 这行循环头**，
导致大括号失衡、文件无法编译（`Illegal return statement` / brace depth −1）。
我发现后通过对比 `git cat-file blob HEAD:...` 确认 **HEAD 版本是可正常编译的**，
即该错误由我的编辑引入而非既有问题，随后补回循环头并加了 9 个 YAML 用例防止再次发生。
所有改动文件现已逐一通过 `node --check`。

### 第三批修复（收尾：解析健壮性、端点推导与死代码结论）

| # | 缺陷 | 修复位置 | 验证方式 |
|---|---|---|---|
| 21 | 模型返回代码围栏 / 前后夹带文字 / 裸数组时 `JSON.parse` 直接失败 → 触发自适应拆半重试（请求数放大 4–5 倍）→ 整批中止并回退逐项 | `ai-engine-base.js` 新增 `_aiExtractJson`（围栏剥离 → 括号配对扫描）与 `_aiCoerceTranslations`（兼容 `translations`/`items`/`result`/裸数组）；单条路径新增 `_aiStripCodeFence` | `engine-batch-hardening.test.mjs` 新增 6 个用例（5 种形态 + 乱码仍失败） |
| 22 | `ModelFetcher.deriveModelsUrl` 用 `origin + path` 重建地址，**查询串被整段丢弃** → 依赖 `api-version` 的 Azure 风格端点永远拉取失败 | `model-fetch.js` 保留 `u.search`；Azure `/openai/deployments/` 端点直接返回空串（该路径下不存在 `/models`），避免发出注定失败的请求 | `model-fetch.test.mjs` 新增 3 个用例 |

### 撤回一条缺陷结论

**`TranslationDiff` 的空白归一化不是缺陷。** 复查发现：
- 该行为已被现有用例**显式锁定**（`translation-diff.test.mjs`「标准化空白后哈希一致」），属既定契约；
- 归一化口径与 `translation-memory.js` 的 `_normalizeText` 相同 —— 若改成保留空白，两者会不一致，
  导致 TM「存的是 A 形、查的是 B 形」而永远无法命中，反而引入更严重的问题。

因此我**不修改**该行为，改为补一个用例锁定「diff 与 TM 的规范化口径一致」。

### 新发现的死代码（未删除，见下方待确认项）

`TranslationDiff` 与 `BatchResumeManager` 全项目**只有自身文件与测试引用**（脚本扫描确认零生产调用点），
但都被写进 `app.js` 的急加载列表并进入 bundle，合计约 380 行。

需要澄清的是：**README 第 22 行「批量翻译暂停/取消/重试（断点续传）」并非虚假宣传** ——
「重试」由 `retryFailedTranslationBtn` → `BatchProgressStore.lastFailedItems` 完整实现；
「断点续传」效果由**自动保存**（`autoSaveManager` + IndexedDB，重开页面经
`initializeProjectData()` 恢复）达成。`BatchResumeManager` 只是同名但从未接线的冗余实现。

### 第五批：对全部改动的批判性自审

对已提交的全部改动做了一轮"找自己的错"式复查（而不是复述成果），发现并修复了 4 个问题。

#### ⚠️ 其中一项是我此前修复引入的**功能回归**（最重要）

第 2 项修复（术语词边界）在修掉英文误伤的同时，**悄悄让中文术语库整体失效**：

| 术语 | 文本 | 修复前(HEAD) | 我的第 2 项修复 | 本次自审后 |
|---|---|---|---|---|
| 文件→file | 打开文件 | 打开file | **打开文件** ❌ | 打开file ✅ |
| 取消→Cancel | 点击取消按钮 | 点击Cancel按钮 | **点击取消按钮** ❌ | 点击Cancel按钮 ✅ |
| 保存→Save | 保存成功 | Save成功 | **保存成功** ❌ | Save成功 ✅ |
| cat→猫 | This category… | This 猫egory… ❌ | This category… ✅ | This category… ✅ |
| no→否 | open the node | 否de ❌ | node ✅ | node ✅ |

原因：词边界规则对 CJK 也生效，而中文不写空格、连续汉字之间没有可判定边界，
于是「打开文件」里的「文件」永远命中不了。

**修法**：边界规则只用于**不含 CJK** 的术语；CJK 术语按子串匹配。
这样英文误伤与中文失效两者同时解决（CJK 术语也不会嵌在拉丁单词内部，无副作用）。
两处行为均已加用例锁定。

> 教训记录：我当时的用例只覆盖了「中文术语不命中更长汉字串」这一新行为，
> 把它当作"已知取舍"锁定了下来，却没有与 HEAD 做**行为对比** ——
> 如果当时做一次前后对照，这个回归在第一轮就会暴露。本次自审正是靠前后对照发现的。

#### 其余 3 项

| 问题 | 说明 | 处理 |
|---|---|---|
| YAML 根级数组输出错误 | `$[0]`/`$[0].name`（parseJSON 对根级数组的真实产物）被写成 `{"$": [...]}`；原因是我过滤根符号时把 `$[0]` 整段删掉了 | 只剥「单独的 `$`」，保留 `$[0]` 的下标段；根级数组时容器用数组 |
| `exportYAML(null)` 抛裸 `TypeError` | 非数组入参在 `for...of` 处抛 "items is not iterable"，无上下文 | 加类型守卫：null/undefined 按空处理，其他类型抛带类型名的错误 |
| `PlaceholderGuard` 跨标记匹配 | `{{{a}}}` 中 `doubleBrace` 会跨过已生成的标记，吞掉多余 `}`（往返仍正确，但结果不干净） | 匹配跨度内含标记边界字符时跳过；补用例 |

#### 复查确认无问题的部分

- `_aiExtractJson`：20 个对抗性输入（字符串内含 `{}`、转义引号、多对象、截断、别名键…）全部符合预期
- `translationValidateResult` / `translationIsCancelled`：17 + 5 个边界（`0`/`false`/`[]`/`{}`/空原文/抛异常）全部正确
- `PlaceholderGuard` 往返：13 个刁钻用例（ICU 内嵌套 ICU、含引号、多行、未配平、标记字符）全部无损
- 无遗留调试痕迹（无 `PROBE`/`debugger`，`console.log` 命中均为既有 dev-tools）

### 第六批：第二次复核（前后行为对照）

第一轮自审靠手写探针；这一轮改用**与 HEAD 逐输入对照**的方法，对高风险模块批量比对行为差异。
结果：发现 3 个问题（其中 1 个是我第一批修复里的真实遗漏），并纠正了我自己的**探针错误**。

#### ⚠️ 1. 最重要：我的对照探针本身写错了（方法学问题）

第一次对照 XLIFF 时得到"HEAD 与当前 8/8 完全相同"，我差点据此认为修复没生效。
复查发现是**我的探针漏了 `sourceText` 字段** —— 没有 `sourceText` 的条目永远匹配不上，
两个版本于是"一致地什么都不做"，差异被抹平。

修正探针后（补上 `sourceText` + `metadata.unitId`）：

| 用例 | HEAD | 当前 |
|---|---|---|
| 实体 `Fish &amp; Chips` | 不写回 | **写回** ✅ |
| 实体 `A &lt; B` | 不写回 | **写回** ✅ |
| 内联 `<g>` 标记 | 不写回 | **写回** ✅ |
| 重复源文 Open×2 | 两条都写"打开" | **分别写"打开"/"开启"** ✅ |
| 无 unitId / 错误 unitId / 空译文 | 一致 | 一致（无回归）✅ |

**11 组中 5 组变化，且全部为修复方向**。这个教训很值得记：**对照测试如果没有让被测路径真正跑起来，
"没有差异"就是假阴性**，比没有对照更危险。

#### 2. Qt TS 复数导出未使用解析时记录的形态数（真实遗漏）

解析器已写入 `targetNumerusCount`，但导出端仍用 **DOM 形态数**，我新加的元数据形同虚设。
在"目标语言形态数 ≠ 源语言"的场景（en 2 种 vs ru 3 种 / ar 6 种）下，`sourceNumerusCount`
恒为 0（`<source>` 里没有 `numerusform`），真正的权威计数是 target 侧 —— 必须用 metadata 对齐。
已改为**优先 metadata，DOM 仅作回退**，并补俄语 3 形态用例锁定。

#### 3. Android 资源 id 分支顺序隐患 + 注释过期

- 我把数组 id 从 `a[0]` 改成 `a:0` 后，`:(\d+)` 分支排在 `[n]` 分支之前；
  若复数资源名含冒号（如 `p:q`）会被误判为数组。已把 `[n]` 分支提前，
  并把 `:(\d+)` 限定为 `^([A-Za-z_][\w.]*):(\d+)$`。
- 顺带修正：导出器头注释仍写 `resourceId = "a[0]"`，与实现不符；已更新并说明
  旧数据的 `a[0]` 形式走兼容分支（已加用例）。

#### 本轮新增的永久用例

- `export-android-ids.test.mjs`（7）：新/旧数组 id 形态、`arrayName/arrayIndex`、
  名称含冒号、复数不被误判、数组与复数混用
- `export-qtts-plurals.test.mjs`（5）：元数据写入、按形态写回、数量不符时保守保留、
  非复数消息、**俄语 3 形态对齐**

### 第七批：DOM 依赖模块的交互级对照

前两轮对照只覆盖了能脱离浏览器独立加载的模块；本轮为 `keyboard.js` / `ui-controller.js`
建了 **jsdom 沙箱对照**（同一份 DOM，分别加载 HEAD 与当前版本，观测副作用）。

#### keyboard.js：修复效果与"未改坏"双向确认

| 场景 | HEAD | 当前 |
|---|---|---|
| textarea 内 `Shift+Enter` | `prevented=true`，**触发 translateAll** | `prevented=false`，不触发 ✅ |
| input 内 `Ctrl+A` | `prevented=true`（吞掉全选） | `prevented=false` ✅ |
| textarea 内 `Ctrl+Enter` | 不触发 | 不触发 ✅ |
| 非编辑态 `Shift+Enter` / `Ctrl+Enter` | 触发 | **仍触发** ✅（未改坏） |
| contentEditable / select | — | 同样受保护 ✅ |

#### ⚠️ ui-controller.js：我第一批的"修复"本身有害，已改为更安全的形态

这是本轮最重要的发现。

`ui-controller.js` 里 `DOMCache.get('translateSelected')` 等**无后缀 id** 永远取不到元素
（真实 id 都带 `Btn`），所以这 4 个绑定一直静默失效 —— 我第一批把 id 改成正确值，
并把它当作纯收益写进了报告。**这个判断是错的**：

`ui/event-listeners/file-panels.js` 已经在绑定这 4 个按钮。改对 id 后同一个按钮会挂上
**两个 click 处理器**（`translateSelected` 与 `handleTranslateSelected`）。虽然
`validateNotInProgress()` 可能挡住第二次批量，但那依赖两次调用之间的时序，
一旦通过就是**两次真实 API 批量翻译**，代价是钱。

**已改为**：`bindTranslationControls()` 保留为空实现并写明原因，明确
`file-panels.js` 是唯一绑定方。`updateTranslationControlState()` 里的正确 id **保留** ——
它只设置 `disabled/display`，不涉及事件绑定，属于纯收益。

> 这轮的教训与上一轮互补：上一轮是「对照没跑起来 → 假阴性」，
> 这一轮是「只看到 bug 修好了，没检查修复的**副作用**」。

#### 本轮新增的永久用例

- `keyboard-editing-guard.test.mjs`（9）：编辑态/非编辑态、contentEditable、select、
  以及"其余快捷键不再被吞默认行为"的批量断言
- `ui-controller-binding.test.mjs`（4）：控制器不重复绑定、file-panels 为唯一绑定方、
  状态更新仍用正确 id

### 第八批：撤销一条被夸大的缺陷结论（重要更正）

对 `parse.js` 做交互级对照（完整解析栈 + jsdom，HEAD vs 当前）后，
**我此前"畸形 XML 被静默降级为纯文本"的结论被证伪**，此处更正。

证据：给 `parseTextFile` 打桩计数，对 5 种畸形输入（`.xml`/`.xlf`/`.resx`/`.ts`/未声明命名空间前缀）
各跑 HEAD 与当前版本：

```
bad.xml   HEAD: textFallback=0  FAIL "XML解析失败: unclosed tag: string"
          CUR : textFallback=0  FAIL 同上
bad.xlf   HEAD: textFallback=0  FAIL "unclosed tag: unclosed"
          CUR : textFallback=0  FAIL 同上
ns.xml    HEAD: textFallback=0  FAIL "unbound namespace prefix"
          CUR : textFallback=0  FAIL 同上
```

**`textFallback=0`：退化路径从未被走到**，两版行为完全一致。

原因：`detectXmlFormat()` 对任何 `parsererror` 直接返回 `invalid`，而
`parseXmlByDetectedFormat` 在该分支 `throw` —— 这个 throw 从**外层 try 直接冒出**，
根本不进入我修改的那个 `catch`。另外两条设想路径也已逐一排除：

| 设想中的可达路径 | 实测结果 |
|---|---|
| `detectXmlFormat` 返回 `invalid` | catch 之前即抛出，两版一致 |
| 格式已识别但解析器抛错（命名空间前缀） | 仍由 `detectXmlFormat` 判为 invalid，两版一致 |
| `validateXMLContent` 拒绝**良构** XML | 该检查在 try **之外**，抛出即冒泡，两版一致 |

**结论**：`parse.js` 新增的 `MalformedXmlError` 与 catch 分支**当前没有任何净行为效果**，
是我自己加的防御性代码。它无害（fail-closed、错误信息更清晰），
但**不是"修复了一个真实缺陷"**。CHANGELOG 中该条已从「修复」改为「防御性加固」。

> 这是本次审查中我第 5 次纠正自己。这次与前几次性质不同：
> 前几次是"读代码下结论"或"对照没跑起来"，这次是**把"理论上可能"当成了"实际发生"** ——
> 原结论纯由代码阅读得出（看到 catch 里回退文本就断定会发生），
> 未像其他项那样先做经验性复现。**未复现的结论不应被写成已完成的修复。**

### 测试结果（最终）

- 测试套件：**32 个文件 / 504 个用例全部通过**
- `check-state`、`check-globals`（223 个挂载）通过
- 全部改动文件 `node --check` 0 失败
- bundle：**121/121 模块**完整性校验通过，571.1 KB
- 引用完整性：`app.js` 125 条路径 0 缺失；13 个懒加载目标 0 缺失；4 个已删文件无残留引用

### 三轮对照复核的方法学小结

| 轮次 | 方法 | 暴露的问题 |
|---|---|---|
| 第五批 | 手写探针 + 单测 | 术语 CJK 回归、YAML 根数组、入参类型 |
| 第六批 | 与 HEAD 逐输入对照 | 探针假阴性（漏 `sourceText`）、Qt TS 未用元数据、Android 分支顺序 |
| 第七批 | jsdom 沙箱交互对照 | **我的修复本身有副作用**（重复绑定） |

三轮各暴露一类不同性质的问题：**回归、假阴性、修复副作用**。
单靠任何一种方法都发现不了全部 —— 这是本次最值得记录的结论。

### 需要留意的两点

1. **导出相关模块是懒加载的**。`translation-original.js` / `translation-formats.js` 不在
   `app.js` 的 123 个急加载脚本内，而是导出时经 `ensureTranslationsExportModule()` →
   `loadScriptOnce()` 从磁盘按需注入。因此这两处的修复是通过**磁盘源文件**生效的
   （bundle 内也有一份副本，但被懒加载版本覆盖）。若将来改为「只分发 bundle」，
   必须把这两个模块也并入急加载列表，否则导出功能会静默失效。

2. **`batch.js` 的等长错配问题只做了「坏值拦截」**。模型返回**等长但顺序错位**的数组时，
   条目仍按位置赋值 —— 这是提示词约定的「按顺序一一对应的字符串数组」所依赖的假设。
   本次新增了类型/空值/占位符校验，但**没有**改用 key 匹配，因此顺序错位仍会静默错配。
   彻底修复需要让模型回传 key 并按其匹配（改动提示词契约），建议单独评估。

### 第四批（收尾）

| # | 缺陷 | 修复位置 | 验证方式 |
|---|---|---|---|
| 23 | ICU 嵌套花括号只保护首段：`{count, plural, one{# item} other{# items}}` 被非贪婪正则截到第一个 `}`，模型收到 `«0» other{# items}}` 这种结构已破坏的半截文本 | `placeholder-guard.js` 新增 `scanBalancedBraces`（括号配对 + 字符串字面量感知）与 `looksLikeIcu`（要求顶层逗号 + plural/select/selectordinal 关键字），ICU 改由扫描器处理，其余模式保持原样 | `placeholder-guard.test.mjs` 新增 9 个用例（plural/select/=0/混排/重复/未配平/普通括号/双花括号/译文改写） |
| 24 | XLIFF `<target>` 用 `textContent` 赋值，把内联 `<g>` 标记转义成字面量 `&lt;g&gt;`，破坏内联结构 | `translation-formats.js` 新增 `__setXliffTargetContent`：含 `<` 时按 XML 片段解析并 `importNode` 插入真实节点，否则退回纯文本 | `export-original-roundtrip.test.mjs` 新增 5 个幂等性用例 |

**顺带修正了我的一个测试期望**：XLIFF 里文本内容中的 `"` 被转义成 `&quot;` 是**正确行为**
（属性用单引号时无需转义），我最初的用例把它当成缺陷，已改为使用合法 XLIFF 并加注释说明。

### 已删除的死代码（选项 1）

`TranslationDiff`、`BatchResumeManager` 及各自的测试文件已删除，并从 `app.js` 急加载列表移除：

- 源码 121 个脚本（原 123），bundle 571.3 KB
- 全局挂载基线 **225 → 223**（`node scripts/check-global-functions.mjs --update` 收缩）
- 测试文件 30 → 28，用例 494 → 469（删除的 25 个用例只覆盖这两个死模块自身）
- 探针验证：bundle 中已不含 `TranslationDiff` / `BatchResumeManager`

**可完全恢复**（已用 `git cat-file -s HEAD:<path>` 逐文件确认）：
```
public/app/services/translation/translation-diff.js   6532 bytes
public/app/services/translation/batch-resume.js       5301 bytes
tests/translation-diff.test.mjs                       4921 bytes
tests/batch-resume.test.mjs                           4504 bytes
```
如需恢复：`git checkout HEAD -- <上述路径>`，再把这 2 行加回 `public/app.js` 并重跑 `--update`。

README 中「断点续传」的表述已改为与实现一致的说明（重试失败项 + 自动保存持久化进度）。

### 仍未修复（剩余项）

- **YAML 导出丢弃非字符串叶子**（数字/布尔/null）：这是「仅翻译字符串」数据模型的固有取舍，
  属特性缺口而非缺陷，建议作为独立需求评估。
- **`batch.js` 等长顺序错位**仍会静默错配：需让模型回传 key 并按其匹配（改动提示词契约）。
