# 复核报告 — 2026-09-11 修复批次（`bde5937..60c29b0`）

> 对 `docs/review/SUMMARY.md`（下称 SUMMARY）所记录修复批次的**独立复核**：不采信原文结论，全部重新在真实源码上复现。
> **基线一律用 `bde5937`（修复前最后一个提交），不是 `HEAD`** —— 原因见 §B1。
> 门禁复核：`vitest run` → **32 文件 / 504 用例通过**；`check-state`、`check-globals` 通过。
> **下列所有缺陷都位于这套绿色门禁之下。**

**总体判断**：修复方向正确、工程化（测试/门禁/bundle 完整性）明显变好，但导出与校验两处改动
**引入了 3 个 P0 级静默数据损坏**，新增的占位符校验**会误拒正确译文**，另有 1 条真实缺陷被**错误撤回**。
建议 **先修 3 个 P0**（都发生在"用户会保存/导出的产物"上），再处理校验误拒与文档更正。

| # | 级别 | 问题 | 位置 | 本批引入 |
|---|---|---|---|---|
| P0-1 | **P0** | 用户取消时 `partialOutputs` 未还原占位符，把 `«0»` 哨兵**写入 targetText 并标为已翻译**（随后自动保存 + 导出） | `batch.js:224-250` + `ai-engine-base.js:861-874` | **是** |
| P0-2 | **P0** | Android 导出正则跨元素匹配：合法的自闭合 `<string name="x"/>` 会**吞掉下一个元素**，产出非良构 XML 并丢失译文 | `translation-formats.js:272-277,305-309,316,331-333` | **是** |
| P0-3 | **P0** | PO 复数条目的 `msgstr[0]` **不再被写入**（搜索从 `msgid` 下一行开始，而那里是 `msgid_plural`）→ 主译文静默丢失 | `translation-original.js:463-477` | **是** |
| P1-1 | P1 | 源文含占位符 + 模型返回非字符串 → `restore` 抛 TypeError → **整批作废并逐项重译**，新校验完全不生效 | `batch.js:118-120`、`placeholder-guard.js:165-176` | 否（新校验未覆盖） |
| P1-2 | P1 | `50%off` / `100%increase` 仍被当 printf 占位符：**发给模型的文本被改写**，正确译文被判"缺失 %o" | `placeholder-guard.js:25`、`helpers.js:190-200` | 部分（校验接入使其致命） |
| P1-3 | P1 | `validate`/`extractAll` 仍用旧的非贪婪 ICU 正则 → **拒绝正确的复数译文、接受未翻译的英文原文** | `placeholder-guard.js:9,193-235` | **是** |
| P1-4 | P1 | 译文"多出" `&amp;`/`<b>` 即硬失败（模型为 XML 转义属常见且合理） | `helpers.js:190-200` | **是** |
| P1-5 | P1 | 词边界把 CJK 当词字符 → **拉丁术语紧邻中文时不再替换**（默认开启的功能静默失效） | `terminology.js:74,86,88` | **是** |
| P1-6 | P1 | 导出的**每个** `<string>` 都被注入 `formatted="false"`（含纯文本、含 `%1$s`），条件判断形同"恒真" | `translation-formats.js:282-302,412-414` | **是** |
| P1-7 | P1 | PO 导入：**任何带注释的条目都会被丢弃**；标准 xgettext 文件（每条都带 `#:`）直接 `未找到有效的PO条目` | `parsers/po.js:31-35` | 否（既有，但与"PO 已修好"的表述冲突） |
| P1-8 | P1 | JSON「原格式」导出：键名含 `.`/`[` 时**丢失全部该类译文**，键名与真实路径冲突时**摧毁子树** | `parsers/json.js:45`、`translation-original.js:293-338`、`yaml.js:208-212` | 修复不完整 |
| P1-9 | P1 | iOS `.strings`：`\Uxxxx` 键永不匹配（解析端与新的 `__stringsUnescape` 规则不一致）；含字面换行、行尾注释的条目永不更新 | `translation-original.js:580-629`、`parsers/ios-strings.js:94-99` | 部分 |
| P1-10 | P1 | Qt TS 复数：行数与形态数不符的编辑被静默丢弃（UI 仍报"导出成功"）；**无 `position` 的回退分支仍把整段写入每个 `numerusform`** | `translation-original.js:160-178,206-213` | 部分（正是它声称修好的 P0） |
| P2-1 | P2 | 校验失败被当可重试错误：确定性坏结果白烧 3 次请求（实测 3008–3027 ms） | `translate.js:80-86` | 是 |
| P2-2 | P2 | `item.__phGuardMap` 用完不删 → 泄漏进 IndexedDB 与项目导出 JSON（584 B vs 368 B） | `ai-engine-base.js:868` | 是 |
| P2-3 | P2 | 单条路径会剥掉"本身就是代码块"的译文围栏，批量路径不会 → 行为不一致 + 内容丢失 | `ai-engine-base.js:284-288,674` | 是 |
| P2-4 | P2 | `_aiExtractJson`：JSON 前的说明文字含 `{` 即失败 → 拆半重试 + 逐项回退 | `ai-engine-base.js:324-331` | 宽容解析不彻底 |
| P2-5 | P2 | 暂停后取消仍多发 1 个付费请求（`cancelBatch()` 清 `isPaused`，`while` 直接退出）；注释与事实相反 | `ai-engine-base.js:791-806,844-847` | 是（注释） |
| P2-6 | P2 | 批次正常结束后 `isUserCancelled()` 恒 true，新前置检查令独立 `translate()` 零请求抛错（当前无调用方，潜在雷） | `translate.js:44-51` | 是 |
| P2-7 | P2 | CI 的 bundle 闸门同 job 自证且只校验清单："保留清单 + 掏空正文"仍 `exit 0` | `.github/workflows/ci.yml:46-93` | 是 |
| P2-8 | P2 | PO `msgctxt` 被忽略：同名 msgid 的多个条目互相写错/留空 | `translation-original.js:452-525` | 否（既有，审查已列 #9 仍未修） |
| P2-9 | P2 | `deriveModelsUrl` 对新一代 Azure AI Foundry 端点得 `/models/models`；"Azure 风格端点"表述夸大 | `model-fetch.js:118-130` | 否（既有） |
| §B1 | P1 | 用 `git show HEAD:` 当"修复前"基线 → 自比较假阴性，并据此**错误撤回**了一条真实缺陷 | 两处测试:18/:19、SUMMARY §第八批、`CHANGELOG.md:38-43` | 是 |
| §B2 | P1 | SUMMARY 中间数字与树不符（30→28 文件 / 494→469 用例 / 25 个） | SUMMARY:464、`CHANGELOG.md:71` | 是 |
| §B3 | P2 | 死代码恢复指令用 `HEAD:`，路径已不存在（exit 128） | SUMMARY:467,474 | 是 |
| §C2 | P1 | "123 个脚本"（6 处）、"373 用例 / 24 文件"（4 处）等数字过时 | `README.md:79,99,116`、`docs/PROJECT-STRUCTURE.md` 多处 | 是 |
| §C3 | P2 | 懒加载说明不准（bundle 内并无副本；懒加载目标 15 个而非 2/13 个） | SUMMARY:437-441 | 是 |

---

## 0. 复核方式

- 未修改任何受版本控制文件：`git status --porcelain` 仅 `?? .review/`；探针与子报告保留在 `.review/`（可整体删除）。
- 基线文件用 `git show bde5937:<path>` 取出，与当前版本在**同一环境/同一桩**下分别运行对比。
- 我的探针：`mine/xml-fallback-probe.mjs`、`mine/keyboard-probe.mjs`、`mine/terminology-probe.mjs`、
  `mine/restore-probe.mjs`、`mine/restore-e2e-probe.mjs`、`mine/cancel-probe.mjs`、`mine/pause-probe.mjs`、
  `mine/po-android-probe.mjs`；三个子代理的报告在 `.review/{export,engines,build}/REPORT.md`。

---

## A. P0 —— 会产生错误产物

### P0-1（新引入）取消路径把占位符哨兵写进成品

本批次让引擎把源文占位符替换成 `«N»` 再发给模型（`ai-engine-base.js:861-874`）；正常路径在
`batch.js:109-121` 还原，**但取消分支（`batch.js:224-250`，消费 `error.partialOutputs`）既不还原也不校验**，
直接写入 `item.targetText` 并置 `status = "translated"`。

```
$ node .review/engines/probe2-cancel-partial-restore.mjs
模型收到的第 2 个 chunk 源文: ["Hello «0» number 5"]
targetText: ["译-Hello «0» number 0", … ,"译-Hello «0» number 4",""]   含 «» 的条数: 5
status   : ["translated", …]                                          误标为 translated: 5
# 同一探针走 bde5937 → ["译-Hello %s number 0", …]，0 条被污染
```

"取消并保留已完成结果"正是用户会继续保存/导出的路径：损坏文本进 IndexedDB，并经导出器写回文件，
界面却提示"翻译已取消 · 已翻译 5 项"。
**修复**：抽出"还原 + 术语 + 校验"finalizer，主循环与取消分支共用（约 10 行）。

### P0-2（新引入）Android 导出正则跨元素边界 → 非良构文件 + 译文丢失

`translation-formats.js:272-277` 的 `<string ...>` 内容组是 `([\s\S]*?)`，遇到**合法的自闭合**元素就会吞掉下一个元素：

```
$ node .review/export/repro.mjs      # 见 .review/mine/export-repro-out.txt
IN : <string name="a">Hello</string> / <string name="empty"/> / <string name="b">KONG</string>
OUT: <string name="a">Hello</string>
     <string formatted="false" name="empty"/>KONG</string>      well-formed: false   ← 译文 b 丢失
HEAD(bde5937): well-formed: true（旧 `[^<]*` 跨不过标签，所以这是新引入的）
```

同源问题还导致数组 `<item/>` 把译文写进**错误**的 item（`<item>T-for-B</item>` 落到 C 的位置，C 的译文丢失），
以及 `<item/>T0</item>` 这种非良构输出。现有测试无一使用自闭合标签（`grep 'self-clos' tests/*.mjs` → 0）。
**修复**：加 `(?:(?!<item\b)[\s\S])*?` 之类的边界守卫 + 显式自闭合分支，或改为 DOM 解析改写。

### P0-3（新引入）PO 复数的主译文不再写入

`translation-original.js:463-477` 从 `msgid` 的下一行开始找 `msgstr`；而复数条目的下一行是 `msgid_plural`，
于是返回 `null`、**主译文被静默丢弃**（无警告）：

```
$ node .review/export/repro.mjs
CURRENT: msgid "%n file" / msgid_plural "%n files" / msgstr[0] "old one" / msgstr[1] "MEN"
HEAD    : … / msgstr[0] "XIN" / msgstr[1] "MEN"        ← 旧版会写 msgstr[0]，新版不写
```

`CHANGELOG.md:130` 仍宣称 msgstr[0]+msgstr[1] 都会更新 —— 现在是假的。
**修复**：定位 msgstr 时也跳过 `^\s*msgid_plural\s`（以及 `^\s*#`），一行级改动。

---

## B. P1 —— 静默失效或误拒

### B-1 非字符串 + 含占位符 → 整批作废（新校验被绕过）

`batch.js:118-120` 先 `restore`，`:131` 才做类型校验；`restore` 对非字符串调用 `result.indexOf`：

```
$ node .review/mine/restore-probe.mjs
object/number/boolean -> THREW TypeError: result.indexOf is not a function
array                 -> THREW TypeError: result.replace is not a function
object + 空 map（源文无占位符）-> 不抛（所以现有用例测不到）

$ node .review/mine/restore-e2e-probe.mjs
源文无占位符：3 条优雅失败 INVALID_TRANSLATION_RESULT，1 次请求
源文含 %s   ：整批作废 → "批量翻译失败，将回退为逐项翻译: result.indexOf is not a function" → 逐项重译
```

1000 条的文件上，一个坏结果可能把 ~25 次批量请求退化成 ~1000 次单条请求。
**修复**：`restore` 开头 `if (typeof translated !== "string") return translated;`，或先校验再还原。

### B-2 `50%off` 类文本仍被当占位符，并**判错正确译文**

```
$ node .review/engines/probe5-batch-protect-side-effects.mjs
源文 "50%off today only" → 模型实际收到 ["50«0»ff today only"]      ← 发给模型的文本被改写
模型正常翻译            → errors 1 INVALID_TRANSLATION_RESULT:占位符不匹配（缺失 %o）
```

`100%increase` 同理（缺失 `%i`）。本批次只修了"带空格"的形态（`Save 50% off`），紧贴字母的仍命中。
**修复**：加词边界，如 `/(?<![\w%])%(?:\d+\$)?[-+0#]*(?:\d+)?(?:\.\d+)?[diouxXeEfgGcspn%@](?!\w)/g`。

### B-3 ICU：`protect` 用新扫描器，`validate` 用旧正则 → **偏好未翻译**

```
B1 模型保留标记（译文=英文原文）→ 通过校验，status=translated   ← 未翻译被接受
B2 模型正确翻译分支            → 失败：缺失 {count, plural, one{# item}（多出 …{# 项}
```

**修复**：`extractAll` 复用同一套花括号配对扫描（或对 `protect(src).map` 比对）。

### B-4 "多出"实体/标签即硬失败

```
源文 "Terms & Conditions" → 模型返回 "条款 &amp; 条件"（为 XML 转义）
→ INVALID_TRANSLATION_RESULT:占位符不匹配（多出 &amp;）   实际请求 3 次 / 3027 ms
```

导出器本身也会转义，模型转义并非错误。**修复**：仅 `missing` 致命，`entity`/`htmlTag` 的"多出"降级为警告。

### B-5（新引入）拉丁术语紧邻中文时静默失效

`WORD_CHAR = /[\p{L}\p{N}_]/u` 把汉字算作词字符，于是 CJK↔拉丁交界被判为"词内"
（`node .review/mine/terminology-probe.mjs head|cur`）：

| 输入（术语→目标） | `bde5937` | 当前 |
|---|---|---|
| `请安装SDK后再试`（SDK→软件开发工具包） | 请安装软件开发工具包后再试 | **原样不变** ❌ |
| `请使用file管理器`（file→文件） | 请使用文件管理器 | **原样不变** ❌ |
| `解析XML文件` / `用户id不可见` | 替换 | **原样不变** ❌ |
| `用户 id 不可见` / `Install the SDK first` | 替换 | 替换 ✅ |
| `This category contains a cat.` | This 猫egory… ❌ | category ✅ |

汉字与拉丁字母之间**确实是**词边界。`tests/terminology.test.mjs:173` 的用例名写着"被空格/**中文**隔开时仍能命中"，
但断言只覆盖空格 —— 实现与自述意图相反且无测试拦截。
**修复**：`WORD_CHAR` 排除 CJK，或把 CJK 邻居显式视为边界。

### B-6（新引入）每个 `<string>` 都被注入 `formatted="false"`

`safeAndroidValue` 只要"值能解析成 XML 片段"就置 `hasMarkup:true`，而**纯文本永远能解析**，于是条件恒真：

```
$ node .review/mine/po-android-probe.mjs
<string formatted="false" name="app_name">我的应用</string>
<string formatted="false" name="greeting">你好</string>
<string formatted="false" name="with_markup">点击<b>这里</b></string>     formatted= 出现 3 次
```

原意是"仅含内联标记时才加"，实际改动了用户文件里的**每一个**字符串。`formatted="false"` 的语义是
**禁用字符串格式化**，含 `%1$s` 的字符串可能因此不再被替换 —— 至少属于未请求的全局改动。
**修复**：以"元素子节点存在"为判据，而不是"片段解析成功"。

### B-7 PO 导入：带注释的条目一律丢失

```
$ node .review/mine/po-android-probe.mjs
标准 xgettext 风格（每条带 #:）→ parsePO THREW: 未找到有效的PO条目，请检查文件格式
$ node .review/mine/po-comment-variants.mjs
#: / #, / #. / # 注释后的条目 → 全部被丢弃（2 条只剩 1 条）
```

`parsers/po.js` 本批次未改动（既有缺陷），但 SUMMARY 称"PO 解释器…注释…均正确"，
而本批次的 PO 导出修复只在"手写无注释 fixture"上验证过。
**修复**：注释行应作为下一条目的前缀被收集，而不是打断条目解析。

### B-8 JSON「原格式」导出的键名歧义

`parsers/json.js:45` 用 `path + "." + key` 拼路径，键名里的 `.`/`[` 不转义，导出端再按 `.`/`[` 拆开：

```
$ node .review/export/repro.mjs
IN : {"menu.file.open":"Open","menu.file.save":"Save","home":"Home"}
OUT: { "menu.file.open": "Open", "menu.file.save": "Save", "home": "SHOUYE" }   ← 2/3 译文丢失（文件与输入几乎一致）
IN : {"a.b":"x","a":{"b":{"c":"z"}}}  → OUT: {"a.b":"x","a":{"b":"T-dotted"}}     ← 子树被摧毁
```

`exportYAML` 共用同一歧义（`yaml.js:208-212`）。**修复**：路径 token 化（`["menu","file","open"]`）或转义键名。

### B-9 iOS `.strings` 的三处永不更新

`\Uxxxx` 键在解析端被写成 `U4f60…`（丢了反斜杠），而新的 `__stringsUnescape` 会保留 `\U` → 永不匹配；
另有两处既有问题：值含**字面换行**、行尾带注释（`"k" = "v"; // note`）的条目同样永不更新。

### B-10 Qt TS 复数：编辑被丢弃 + 回退分支仍有旧 P0

行数与形态数不符的编辑只打印 `console.warn`，而 `translation-entry.js:151` 仍报"导出成功"（实测 3/3 丢弃，
**含"正确的 2 行 + 末尾换行"这种编辑**）；更关键的是 `translation-original.js:206-213` 的**无 `position` 回退分支
仍把整段拼接文本写进每一个 `<numerusform>`** —— 正是本批次声称修好的那个 P0。

---

## C. P2 组（简列）

校验失败白烧 3 次请求（P2-1）；`__phGuardMap` 残留进持久化与项目导出（P2-2）；
单条路径剥掉"本身是代码块"的围栏而批量路径不剥（P2-3）；说明文字含 `{` 就让宽容解析失败（P2-4）；
暂停中取消多发 1 次请求且注释与事实相反（P2-5）；批次结束后独立 `translate()` 被误判为用户取消（P2-6，潜在）；
CI 闸门同 job 自证、掏空正文仍通过（P2-7）；PO `msgctxt` 被忽略（P2-8，审查 #9 仍未修）；
Azure 新端点 `/models/models`（P2-9）；此外 iOS 重复键、Android 无 `quantity` 的 `<item>`、
以及"导出告警只进 console 而调用方恒报成功"（`logger-config.js:83-85`）也都属实。

---

## D. 验证方法学问题

### D-1（P1）"HEAD 对照"是自比较，并导致一条真实缺陷被错误撤回

`tests/keyboard-editing-guard.test.mjs:18`、`tests/ui-controller-binding.test.mjs:19` 用
`execSync("git show HEAD:" + FILE)` 取"修复前"版本，但测试与修复**同属提交 `90066aa`**，运行时 `HEAD` 已是修复后代码：

```
HEAD: {"prevented":false,"calls":[]}
CUR : {"prevented":false,"calls":[]}      ← 与 SUMMARY §第七批 表格（HEAD prevented=true）矛盾
```

用真基线重跑（`node .review/mine/keyboard-probe.mjs`）确认原结论**是对的**：`bde5937` 在 textarea 内
`Shift+Enter` → `prevented=true` 且触发 `translateAll`；`Ctrl+A` → 吞掉默认行为且无动作；当前均正确，
且非编辑态与 Ctrl+S 未被改坏。

**同一污染导致 parse.js 的真实修复被撤回**（SUMMARY §第八批 / `CHANGELOG.md:38-43`）。
三个独立复核（本报告 `mine/xml-fallback-probe.mjs`、子代理 `export/probe-parse.mjs`、`build/parse-probe.mjs`）
一致：用完整解析栈 + **真实** `securityUtils`（它只是 `startsWith("<") && includes(">")`，**不是**良构性检查），
`bde5937` 对畸形 `.xml/.xlf/.resx/.ts`、未绑定命名空间前缀等输入一律 `success=true` + `textFallback=1`
（导入垃圾文本条目并提示成功），当前一律 `success=false` + `textFallback=0`。**原缺陷成立、修复真实。**
撤回理由的两条推理也不成立：`parse.js:168` 的 `throw` 在 `:154` 的 try 内、由 `:237` 的 catch 接住。
**建议**：对照一律钉死提交号（`bde5937` / `90066aa^`），或在测试中断言基线源码确实不含修复标记。

### D-2（P1）SUMMARY 中间数字与树不符

`SUMMARY.md:464`/`CHANGELOG.md:71` 称"30 → 28 文件、494 → 469 用例、删除 25 个"。实测测试文件数：
`bde5937` 24 → `90066aa` 34 → `4d0fb9e` 32 → `HEAD` 32；被删两文件内 `it()` 共 12+12 = **24**。

### D-3（P2）恢复指令已失效

SUMMARY:467/474 的 `git cat-file -s HEAD:<path>` / `git checkout HEAD -- <path>` 已不可用
（`fatal: path … does not exist in 'HEAD'`，exit 128）；换成 `90066aa` 与文档字节数一致（6532/5301/4921/4504）。

---

## E. 文档失真

- **C1（P1）**：`CHANGELOG.md:38-43` 与 SUMMARY §第八批必须改为"真实修复"（并说明这是用户可见的行为变更：
  畸形 XML 从"导入成功"变成明确报错）。`tests/parser-registry.test.mjs:267-284` 的用例正确，保留。
  同时 `CHANGELOG.md:130`（msgstr[0] 也会更新）现已为假，需一并更正。
- **C2（P1）**：实测 `app.js` 声明 **125** 条路径（0 缺失）、bundle **121** 个模块、测试 **32 文件 / 504 用例**。
  文档仍是"123 个脚本"（`README.md:79,99`、`PROJECT-STRUCTURE.md:37,78,343`）与"373 用例 / 24 文件"
  （`README.md:116`、`PROJECT-STRUCTURE.md:50,314,345`）；`PROJECT-STRUCTURE.md:60,66` 仍列已删的
  `batch-resume.test.mjs` / `translation-diff.test.mjs`，`:316` 仍把"断点续传""TM/Diff"列为当前覆盖。
  `CHANGELOG.md:81` 声称文档数字已修正 —— 但没有任何文档写到 504。
- **C3（P2）**：SUMMARY:437-441 说 bundle 内"也有一份副本"，实测**没有**（`__poEscape`/`__setXliffTargetContent`
  在 bundle 中不存在）；导出 ensure 列的是 **3** 个文件，全项目懒加载目标共 **15** 个。
- **C4（P3）**：`public/index.html:2615` 注释"（1 个文件 vs 106 个）"；SUMMARY 的 571.3 / 571.1 KB 自相矛盾
  （该值是字符数，文件实际 614 333 字节）；`PROJECT-STRUCTURE.md` 目录计数偏旧。

---

## F. 复核为**成立**的结论

- **工程化**：504/32 通过；`check-state`、`check-globals`（223）通过；改动文件 `node --check` 0 失败；
  bundle 121 模块且 terser 压缩后清单保留；`package-lock.json` 187/187 指向 `registry.npmjs.org`
  （无 `file:`/私有源），与 `npm ci` 自洽；`.gitignore` 放行 lockfile 正确。
- **死代码移除**：`TranslationDiff`/`BatchResumeManager` 零功能引用，bundle 与 `index.html` 无残留，基线文件已同步。
- **导出/解析**（子代理对抗性验证后仍成立）：PO `__poEscape`/`__poSplitLines`（500 次模糊测试 0 失败）、
  PO 含 `\n`/`\t`/`\\` 的 msgid；iOS 已实现的那部分转义、CRLF、整行注释；Android 数组/复数/CDATA/实体/幂等、
  `resourceId` 改为 `a:0` 未被任何消费方破坏；XLIFF 全路径（group 嵌套、重复 unitId、`xml:space`、
  `<mrk>`/`<x/>`、2.0 segment、三遍幂等）；XLIFF 无静默失配案例。
- **引擎**：宽容 JSON 提取（围栏/前后文字/裸数组/别名键）；`deriveModelsUrl` 查询串保留；`__phGuardMap` 每轮刷新（无过期套用）。
- **UI**：`ui-controller.js` 改为"有意不绑定"是正确判断 —— `file-panels.js:248-271,403-413` 是这 4 个按钮的绑定方，
  且 `handleTranslateSelected/All` 仍被 `actions.js` 调用，不存在新死代码。
- **诚实度**：SUMMARY 主动记录的两处验证缺口真实存在，且**可以补上**（见 §G）。

---

## G. 把 SUMMARY 自认的两处"验证缺口"补成数值证据

关键在于**确定性**：把并发压到 1、在第一个请求在飞时触发，而不是靠真实时序竞态。

**取消**（`node .review/mine/cancel-probe.mjs head|cur <maxRetries>`，`setTimeout` 立即执行以跳过退避）

| maxRetries | `bde5937` 取消后仍发出的请求 | 当前 |
|---|---|---|
| 3 | 3（并把 500 一路重试完） | **1**，抛 `USER_CANCELLED` |
| 5 | 5 | **1**，抛 `USER_CANCELLED` |

**暂停**（`node .review/mine/pause-probe.mjs head|cur`，12 条 / 4 chunk / 并发 1，chunk1 在飞时暂停）

| 版本 | 暂停窗口内派发的 chunk 请求 | 恢复后总计 | 结果 |
|---|---|---|---|
| `bde5937` | **3**（整批照发） | 3 | 12 条全部翻译，0 错误 |
| 当前 | **1**（仅在飞的那个） | 3 | 12 条全部翻译，0 错误 |

即"暂停是死代码、取消后仍继续请求"的判断成立、两处修复有效且未破坏正常流程（子代理用不同参数独立复现同一方向）。

---

## H. 建议处理顺序

1. **P0-1 / P0-2 / P0-3**：取消分支共用 finalizer；Android 正则加边界守卫（或改 DOM）；PO 定位 msgstr 时跳过 `msgid_plural`。
   三者都会产出**错误文件**，且都由本批次引入。
2. **B-1**：`restore` 加类型守卫（一行）+ 补"含占位符 + 非字符串结果"用例。
3. **B-2 / B-3 / B-4**：printf 加词边界；`extractAll` 与 `protect` 统一 ICU 扫描；仅 `missing` 致命 ——
   这三条都会**误拒正确译文**，建议连同 P2-1（校验失败不重试）一起定策。
4. **B-5 / B-6**：`WORD_CHAR` 排除 CJK；`formatted="false"` 仅在真有内联标记时注入。
5. **B-7 / B-8 / B-9 / B-10**：PO 注释条目、JSON 键名歧义、iOS `\U`/换行/尾注、Qt TS 复数编辑与回退分支。
6. **D-1 / E-C1**：更正 CHANGELOG（parse.js 恢复为"修复"、msgstr[0] 条目改为"已知回归"）与 SUMMARY §第八批；
   把两处测试的 `HEAD` 基线钉死为 `bde5937`。
7. **E-C2 / C3 / C4 / D-2 / D-3**：按实测数字刷新 README / PROJECT-STRUCTURE / SUMMARY。
8. **P2 组**：清 `__phGuardMap`、CI 闸门改为固定清单比对、PO `msgctxt`、Azure 新端点等。
