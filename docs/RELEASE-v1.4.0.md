# v1.4.0 · 校对工作区、引擎修复与帮助中心

发布日期：2026-10-07

项目：[webmturn/ai-localization](https://github.com/webmturn/ai-localization)

版本：[v1.4.0](https://github.com/webmturn/ai-localization/releases/tag/v1.4.0)

本版围绕「打开文件 → 批量翻译 → 逐条校对 → 检查与导出」更新工作区，让当前文件、处理范围、校对状态和常用操作更容易确认。同时修复翻译结果错位、取消失效、设置草稿覆盖及资源导出中的数据问题。

## 桌面与校对体验

- 支持校对优先与经典三栏布局，面板默认状态、列表密度、主题和字体可在偏好中调整。
- 优化项目与文件信息、工具栏、资源入口、状态筛选、分页和页码跳转。
- 通过待翻译、待校对和已校对安排处理顺序，支持连续编辑、批量校对及查找替换。
- 自定义引擎入口位于引擎设置中，翻译记忆可从工作区与帮助说明打开。

![v1.4.0 桌面校对工作区](https://raw.githubusercontent.com/webmturn/ai-localization/v1.4.0/docs/screenshots/01-main-interface.png)

## 翻译与交付可靠性

- AI 批量结果按独立条目 id 匹配，拒绝重复、遗漏和未知 id，避免将译文写给错误原文。
- 不再静默截断超过 10000 字符的原文；输出被截断时记为失败。
- 取消检查覆盖排队、限速等待、发送与返回，旧批次不会在重启后恢复请求。
- 设置草稿支持保存和取消，模型获取读取新填写的密钥；0 次追加重试、并发上限和模型缓存按配置生效。
- 批量翻译优先复用精确翻译记忆，未命中的条目才进入 API。
- 修复 JSON、YAML、XLIFF、Android、PO、Qt TS 和 iOS Strings 的确认导出问题，以及占位符与术语处理问题。

## 帮助与关于

- 帮助中心包含 13 个栏目、61 条说明和 18 项当前生效的快捷键。
- 覆盖项目文件、翻译校对、引擎、AI 增强、Prompt、术语、记忆、质量、导出、偏好和备份。
- 桌面使用主题目录，手机使用主题选择；保留阅读位置与问答状态，说明可跳转到相关设置。
- 关于页与包版本同步，提供源码、更新日志、反馈入口和版本信息复制。

![帮助中心功能总览](https://raw.githubusercontent.com/webmturn/ai-localization/v1.4.0/docs/screenshots/07-help-center.png)

## 使用与升级

发布附件 `ai-localization-v1.4.0-web.zip` 是已构建的网页版本。解压后打开 `public/index.html`，或将 `public/` 目录部署到静态服务器。无需重新安装 npm 依赖。

从源码运行时，使用 Node.js 20.19+、22.12+ 或 24+，执行：

```bash
npm ci
npm run build
```

升级前可在「偏好 → 数据管理」备份项目与设置。旧版 Windows 桌面预览安装包仍位于 v1.1.0 发布页；本次附件为网页版本。

## 验证

- 45 个测试文件、684 项单元与契约测试通过。
- CSS、JavaScript 和生产构建通过；状态所有权与全局函数检查通过。
- 本地隔离浏览器覆盖引擎设置、校对分页、帮助关于，以及桌面、手机、深浅主题与大字体。
- 翻译接口使用模拟响应验证，没有使用真实密钥调用付费服务。

完整变更见 [CHANGELOG](https://github.com/webmturn/ai-localization/blob/v1.4.0/CHANGELOG.md)。
