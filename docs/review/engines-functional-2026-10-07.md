**翻译引擎功能审查 · 2026-10-07**

此报告保留修复前的审查证据。已确认的 12 项问题现已修复，见[修复记录与验证](D:/laster/html/docs/review/engines-fixes-2026-10-07.md)。

审查对象为当前工作区 `D:/laster/html`，包含已有的桌面 UI 调整。覆盖 DeepSeek、OpenAI、Gemini、Claude、Google Translate，以及 OpenAI 兼容自定义引擎。确认 12 项功能问题：3 项 P1（优先处理，涉及错误结果或默认引擎不可用），9 项 P2（配置与操作行为不符合预期）。本次只创建审查报告和复现脚本，未修改应用源代码。

验证方式：检查真实源文件；运行 18 组引擎流程探针和 7 组隔离浏览器操作；重跑现有 43 个测试文件、635 项测试，全部通过。探针使用测试密钥、模拟 HTTP 响应或模拟传输，不访问付费翻译接口，不读取用户的项目或密钥。引擎探针仅替换传输与必要的外部依赖，保留实际注册表、服务、请求组装、结果处理和限速实现。浏览器没有脚本异常。Gemini 的模型停用状态另外核对了 Google 官方文档。

现有测试通过不代表以下缺陷不存在；这些复现覆盖了测试未检查的设置联动、响应顺序和排队取消场景。

| 功能 | 审查结果 |
| --- | --- |
| 内置引擎和自定义引擎的单条请求、响应解析 | 模拟正常响应通过；Gemini 默认模型已停用，真实服务不能据此认定可用 |
| AI 批量翻译、占位符保护与恢复 | 正常响应通过；等长错序结果仍可被错误写入 |
| 空值、对象、空译文、丢失结构占位符 | 批量路径已能拒绝，未将无效结果标记成功 |
| 401/403 鉴权错误、402 配额耗尽 | 单条路径均只请求一次，停止重试 |
| 500 暂时失败、429 冷却重试 | 模拟失败后恢复通过；429 的 1 秒 Retry-After 被遵守 |
| 项目 Prompt、Key 上下文、相邻上下文、Priming、会话历史 | 组合探针通过；跨两个 chunk 保留会话顺序 |
| 暂停、自适应拆批、取消后的结果恢复 | 现有相关回归测试通过；取消发生在限速排队期间仍会派发新请求 |
| 设置、侧栏、模型和温度同步 | 存在未保存即生效、取消不回滚、保存旧引擎等问题 |
| 连接测试与模型获取 | 对同一份未保存密钥，两项功能行为不一致 |
| 自定义引擎的创建、密钥加密、JSON mode、刷新恢复 | 浏览器验证通过；编辑端点或模型后旧模型缓存未失效 |
| 并发数量、不重试、翻译记忆自动应用 | AI 批量并发不遵守用户上限；不重试不能正常保存；AI 批量跳过记忆查询 |

**确认的问题（按优先级排列）**

1. **[P1] 等长错序的批量响应会写入错误条目。** 请求三个原文 `Source 0/1/2`，模拟模型返回逆序的三个译文，结果为成功 3、失败 0，`Source 0` 被写入 `T:Source 2`，`Source 2` 被写入 `T:Source 0`。引擎只检查数组长度，上层按位置写入并保存翻译记忆。请求和响应都缺少用于校验归属的条目 ID。应使用稳定 ID 的结构化结果，校验重复、缺失和未知 ID 后再写入，保留无法确认归属的条目供重试。位置：[响应校验](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:1059)、[按位置写入](D:/laster/html/public/app/services/translation/batch.js:107)、[记忆保存](D:/laster/html/public/app/services/translation/batch.js:184)。证据：`batch-row-mapping`。

2. **[P1] 不完整的输入或输出仍可被作为成功译文接受。** 单条接口返回 `finish_reason: "length"` 和半段译文时，服务直接返回该译文；批量输入 10031 字符时，只发送 10000 字符，尾部标记被丢弃，最终仍标记 `translated`。AI 长文本会弹出一次警告，但不能阻止不完整内容成为可导出的成功结果。批量已检查输出截断，单条没有同等检查；输入端也应拆分长文本或明确拒绝，不能截断后完整记账。位置：[单条结果解析](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:659)、[输入截断](D:/laster/html/public/app/services/security-utils.js:172)、[批量输入处理](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:875)。证据：`single-truncated-output-accepted`、`long-source-truncated-accepted`。

3. **[P1] Gemini 默认模型已经停用。** 注册表仍默认使用 `gemini-2.0-flash`；未获取模型列表的用户会直接使用它进行连接测试和翻译。Google 官方确认该模型在 2026-06-01 停用。应更换为仍可用的文本模型，并处理旧设置迁移；动态列表没有旧默认模型时，应选择有效项，而不能再退回停用模型。位置：[默认模型](D:/laster/html/public/app/services/translation/engines/providers/gemini.js:11)。依据：[Google 官方停用公告](https://ai.google.dev/gemini-api/docs/changelog#june-1-2026)、[模型生命周期表](https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.0-models)。未使用真实密钥再次调用停用模型。

4. **[P2] 在限速等待期间取消，等待结束后仍会发出请求。** 单条和 AI 批量都在进入等待前检查取消，但 `checkRateLimit()` 返回后、网络派发前没有再次检查。探针先让请求进入等待，再取消并释放等待，两条路径都实际派发了 1 个取消后的请求。批量最终计为取消，但请求已经发出；单条还会返回成功译文。`cancelAll()` 只能终止当时已发出的请求，不能阻止以后才派发的请求。应使等待可取消，并在每个网络派发前检查所属批次是否仍有效。位置：[单条等待后直接派发](D:/laster/html/public/app/services/translation/translate.js:54)、[批量等待](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:856)、[批量派发](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:975)。证据：`cancel-during-rate-wait-single/batch`。

5. **[P2] 设置窗口的模型与温度修改在保存前生效，取消后造成引擎、模型不匹配。** 初始为 DeepSeek / `deepseek-chat` / 1.6。在设置中选择 OpenAI / `gpt-4o`，温度改为 0.8，再点击取消：活动引擎仍为 DeepSeek，模型已变成 `gpt-4o`，温度已经持久化为 0.8，侧栏仍显示 `deepseek-chat`。捕获下一次实际组装的请求，确认是向 DeepSeek 地址发送 `model: "gpt-4o"`。应为设置窗口保留独立草稿，保存时一次提交引擎与模型，取消时丢弃草稿。位置：[设置模型的即时保存](D:/laster/html/public/app/ui/engine-model-sync.js:651)、[设置温度的即时保存](D:/laster/html/public/app/ui/engine-model-sync.js:710)、[请求模型解析](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:387)。证据：`cancel-settings-model-and-temperature`。

6. **[P2] 侧栏切换引擎没有更新完整设置，随后保存设置会切回旧引擎。** 在侧栏从 DeepSeek 切换到 OpenAI，活动配置与侧栏均为 OpenAI；打开完整设置时，默认引擎仍为 DeepSeek。点击保存后，活动引擎恢复 DeepSeek。打开设置不会重新加载当前引擎，侧栏切换也只同步两个工作区下拉框。应在打开设置时按当前活动配置初始化草稿，并通过统一同步入口更新显示。位置：[侧栏联动](D:/laster/html/public/app/ui/engine-model-sync.js:521)、[设置保存读取旧控件](D:/laster/html/public/app/ui/event-listeners/settings.js:340)、[打开设置窗口](D:/laster/html/public/app/features/translations/export/ui.js:68)。证据：`sidebar-switch-then-save-settings-reverts-engine`。

7. **[P2] “不重试”无法正确保存，底层零值也跳过首次请求。** 在设置选择“不重试”即 `0` 后保存，持久化值为 `2`，原因是 `parseInt(...) || 2` 把零当成缺省值。另一个独立复现将服务的 `retryCount` 设为 0，得到请求 0 次、直接抛“翻译失败”；因为循环把重试次数当成总尝试次数。值为 1 时也只尝试 1 次，没有界面承诺的首次请求加 1 次重试。应明确 `retryCount` 为失败后的附加尝试次数：总尝试数为 `1 + retryCount`，保存时保留 0。位置：[保存零值](D:/laster/html/public/app/ui/event-listeners/settings.js:378)、[重试循环](D:/laster/html/public/app/services/translation/translate.js:40)。证据：`retry-no-retry-ui-save`、`retry-zero`。

8. **[P2] 获取模型列表忽略刚输入但未保存的 API Key。** 在空密钥配置中输入测试密钥：点击获取模型，显示“请先配置 DeepSeek 的 API Key”，网络请求为 0；随后点击连接测试，同一密钥成功发送 1 个模拟请求并显示连接正常。模型获取只读取持久化配置，连接测试则读取表单值。应复用同一套表单配置快照，成功获取模型后也不要把其他未保存的设置提交。位置：[获取模型的密钥读取](D:/laster/html/public/app/ui/engine-model-sync.js:468)、[连接测试的表单密钥](D:/laster/html/public/app/ui/event-listeners/settings.js:126)。证据：`new-api-key-model-fetch-versus-connection-test`。

9. **[P2] 返回的模型列表没有旧默认模型时，下拉框变空，保存又恢复旧模型。** 模拟 `/models` 返回唯一可用的 `deepseek-new-model`。侧栏正确选择该项，完整设置下拉却变空，点击保存后持久化值恢复 `deepseek-chat`。设置联动只判断默认值是否存在于引擎配置，没有判断它是否还在新选项中，给 select 设置不存在的值导致空选中。应依次选择有效的旧值、有效默认值、第一项；保存时再次校验选项归属。位置：[默认值回退](D:/laster/html/public/app/ui/engine-model-sync.js:359)、[保存时回退旧模型](D:/laster/html/public/app/ui/event-listeners/settings.js:346)。证据：`fetched-list-without-default-leaves-blank-model`。此问题会放大已停用默认模型的影响。

10. **[P2] 自定义引擎更换端点或模型后，旧模型缓存继续覆盖新配置。** 创建 `old.test` / `old-model` 并缓存模型列表，在表单改为 `new.test` / `new-model` 后保存：注册表更新为新端点和新默认模型，但活动模型及侧栏仍是 `old-model`。缓存仅按引擎 ID 保存，编辑时没有清理；模型选择器又优先读取缓存。应在端点或模型配置变更时使缓存失效，或者让缓存包含端点与鉴权配置的身份信息。位置：[更新引擎](D:/laster/html/public/app/services/translation/engines/providers/custom-engine.js:127)、[缓存优先](D:/laster/html/public/app/ui/engine-model-sync.js:48)。证据：`custom-update-retains-old-model-cache`、`custom-edit-url-model-keeps-stale-cache`。删除引擎会清缓存，编辑不会。

11. **[P2] AI 批量请求不遵守用户设置的并发上限。** 使用 DeepSeek、15 条、每批 5 条、用户并发 1，在实际限速实现下模拟 450ms 响应：最大同时在途请求为 3，而非 1。AI 批量只读取注册表 RPS 并钳制到 3；用户 `concurrentLimit` 只在逐条路径使用。应取用户上限、引擎上限和系统上限的最小值。会话模式仍应保持串行。位置：[AI 并发决定](D:/laster/html/public/app/services/translation/engines/base/ai-engine-base.js:809)、[逐条路径用户上限](D:/laster/html/public/app/services/translation/batch.js:333)。证据：`ai-concurrent-limit-one`。

12. **[P2] AI 批量翻译绕过翻译记忆的精确匹配。** 同一条文本已存在用户确认的精确记忆译文。DeepSeek 路径查询记忆 0 次、发请求 1 次，写入 API 新译文；Google Translate 路径查询 1 次、发请求 0 次，使用记忆译文。AI 分支在查询逻辑之前提前返回，只有批量完成后的记忆保存。应在分流到各引擎前统一查询并应用有效精确匹配，仅将未命中的条目送入翻译接口，并保持进度与原条目映射。位置：[AI 提前分流](D:/laster/html/public/app/services/translation/batch.js:38)、[记忆查询仅在逐条路径](D:/laster/html/public/app/services/translation/batch.js:382)。证据：`tm-exact-match-provider-difference`。

**修复顺序建议**

先处理 F1/F2/F3，避免译文错位、内容不完整和默认服务不可用；随后将 F5/F6/F8/F9/F10 一起纳入配置与模型同步修复；最后处理 F4/F7/F11/F12 的取消、重试、并发和记忆复用。每项修复应增加对应回归测试，保留已有占位符校验、批量拆分、暂停和会话顺序保护。

**尚未验证的边界**

真实服务的跨域、代理、账户模型权限、配额、实际译文质量没有使用用户密钥验证。Claude 请求头只含 `x-api-key` 与 `anthropic-version`，未见浏览器直连标识；Anthropic 官方 TypeScript SDK 在允许浏览器使用时会加入 `anthropic-dangerous-direct-browser-access: true`，因此 Claude 浏览器直连兼容性应专门核对。这是基于实现与官方 SDK 的推断，不计入上述 12 项确认问题。依据：[Anthropic 官方 SDK 请求头实现](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/client.ts)。

**复现资料**

- [引擎探针结果](D:/laster/html/.review/engine-functional-audit-2026-10-07/engine-probes.json)
- [浏览器操作结果](D:/laster/html/.review/engine-functional-audit-2026-10-07/ui-probes.json)
- [引擎复现脚本](D:/laster/html/.review/engine-functional-audit-2026-10-07/probe-engine.mjs)
- [浏览器复现脚本](D:/laster/html/.review/engine-functional-audit-2026-10-07/probe-ui.mjs)

浏览器脚本使用本地静态服务器和单独的浏览器上下文，阻止外部网络请求；模型列表和连接测试使用测试响应。脚本所用密钥均为人工构造的测试字符串。结果文件分别包含 18 组引擎检查和 7 组浏览器检查，没有探针异常或浏览器脚本异常。
