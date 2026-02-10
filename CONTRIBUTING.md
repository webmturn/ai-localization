# 贡献指南

感谢你对本项目的关注！欢迎通过 Issue 和 Pull Request 参与贡献。

**仓库地址**：<https://github.com/webmturn/ai-localization>

## 如何贡献

### 报告问题 (Issue)

- **Bug 报告**：请说明环境（系统、浏览器、Node 版本）、复现步骤和预期/实际行为。
- **功能建议**：请简要描述需求和使用场景。
- **安全相关问题**：请勿在公开 Issue 中粘贴 API Key、密钥等敏感信息。

### 提交代码 (Pull Request)

1. **Fork** 本仓库到你的账号下。
2. 基于 **main**（或当前默认分支）创建分支，建议命名：`fix/简短描述` 或 `feat/简短描述`。
3. 在本地安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
4. 修改代码后，确认在浏览器中打开 `public/index.html` 能正常使用相关功能。
5. 提交时请写清 commit 信息，PR 描述中说明改动目的和测试情况。
6. 提交 PR 到本仓库的对应分支，等待维护者 review。

### 开发相关

- **CSS**：使用 Tailwind CSS，源文件在 `src/input.css`，构建输出到 `public/styles.css`。开发时可使用 `npm run watch-css` 监听变化。
- **JS Bundle**：`npm run build-bundle` 合并 106 个 JS 为 `public/app.bundle.js`。修改 JS 后需重新构建。
- **脚本**：项目中有 PowerShell 脚本（`scripts/*.ps1`），主要在 Windows 下使用；其他平台可参考文档或自行改写等效命令。
- **文档**：重要逻辑或配置变更请同步更新 `docs/` 下相关文档或 README。

## 行为准则

- 尊重他人，理性讨论。
- 不提交恶意代码、后门或违反许可证的内容。

再次感谢你的贡献！
