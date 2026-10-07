**翻译引擎功能修复 · 2026-10-07**

已修复[功能审查报告](D:/laster/html/docs/review/engines-functional-2026-10-07.md)中确认的 12 项问题，保留之前的桌面布局、校对区域和分页调整。

| 编号 | 修复后的行为 |
| --- | --- |
| F1 | AI 批量请求为每个条目提供独立 id，响应按 id 对应原文；拒绝重复、遗漏、未知 id。响应倒序、资源 key 或 id 重复也不会错位。旧模板返回无标识数组时拆为单项处理，避免按位置接受有歧义的结果。 |
| F2 | API 清理保留超过 10000 字符的完整原文，删除静默截断及对应警告。单条和批量均检查输出截断信号，未完成的译文不会标记成功。超出厂商输入限制时由 API 明确报错。 |
| F3 | Gemini 默认模型更新为 gemini-3.6-flash。已保存的 Gemini 2.0 Flash 模型值自动迁移，旧模型缓存中的停用型号不会出现在下拉框中。 |
| F4 | 请求在限速等待后、实际发送前、结果返回后检查取消状态；冷却等待可取消。批量代次避免取消后立即重启时旧排队请求恢复发送；取消不会破坏后续限速队列。 |
| F5 | 完整设置中的引擎、模型、温度只更新表单草稿。温度范围适配不会改写侧栏或当前配置，保存时统一应用，取消后重开恢复保存值。修复初始化时默认温度覆盖保存值的问题。 |
| F6 | 每次首次打开完整设置读取当前保存配置。侧栏切换引擎后，设置表单随之更新，保存不会恢复旧引擎。嵌套资源窗口返回时保留已有草稿。 |
| F7 | 不重试保存为 0，仍执行首次请求；重试次数表示首次失败后的追加尝试次数。 |
| F8 | 从 API 获取模型优先使用表单刚输入的密钥，未输入时读取已保存的密钥，与连接测试一致。 |
| F9 | 新模型列表不含默认型号时选中有效的首项；保存时再次校验当前选项，避免空选择回退到不可用默认值。获取模型只刷新设置草稿，点击保存后才应用到当前翻译。 |
| F10 | 自定义引擎修改 URL、模型、鉴权方式或请求头时清除旧模型缓存；仅改显示名称保留缓存。 |
| F11 | AI 批量同时遵守用户并发上限、引擎限速和现有最多 3 个分块请求的限制；会话模式继续串行。设置提示对应实际上限。 |
| F12 | AI 批量先查询翻译记忆，校验后的精确命中直接复用，只有未命中条目进入 API；结果保留原索引、进度总数和占位符校验。 |

Gemini 替代型号依据 [Google 官方停用与替代模型表](https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.0-models)。

**验证**

- 全量自动化测试：44 个文件、660 项测试通过，其中新增 25 项针对请求身份、完整性、取消、重试、并发、记忆复用和缓存更新的回归测试。
- 11 个隔离浏览器场景通过，无页面脚本异常；包括设置取消与重开、整体保存、嵌套窗口保留草稿、温度隔离、新密钥请求、有效模型选择、自定义引擎编辑与刷新恢复、侧栏同步、Gemini 迁移及打开设置保持第 3 页。
- CSS 和 JavaScript 构建通过；状态所有权、全局函数冻结检查和 diff 空白检查通过。全局检查仅保留原有重复挂载提示。
- DeepSeek、OpenAI、Claude、Gemini、OpenAI 兼容自定义引擎的批量请求和占位符恢复均有模拟响应回归覆盖。没有调用真实付费翻译接口；实际服务连接仍取决于用户配置和厂商可用性。

回归测试：[engine-audit-regressions.test.mjs](D:/laster/html/tests/engine-audit-regressions.test.mjs)、[custom-engine.test.mjs](D:/laster/html/tests/custom-engine.test.mjs)。浏览器断言脚本：[verify-ui-fixed.mjs](D:/laster/html/.review/engine-functional-audit-2026-10-07/verify-ui-fixed.mjs)，结果：[ui-fixed.json](D:/laster/html/.review/engine-functional-audit-2026-10-07/ui-fixed.json)。

```powershell
npm.cmd test -- --reporter=dot
npm.cmd run build
npm.cmd run check-state
npm.cmd run check-globals
$env:PLAYWRIGHT_BROWSERS_PATH='D:\laster\html\.review\desktop-ui-audit-2026-10-07\browsers'
node .review/engine-functional-audit-2026-10-07/verify-ui-fixed.mjs
```
