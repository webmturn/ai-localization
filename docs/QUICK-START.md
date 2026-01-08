# 快速开始指南

> 仓库：[https://github.com/webmturn/ai-localization](https://github.com/webmturn/ai-localization)

> **⚠️ 首次使用必读**：必须先执行 `npm install` 和 `npm run build-css`，否则打开页面将无样式。`public/styles.css` 由构建生成，未提交到仓库。

## 🚀 5 分钟快速上手

### 1. 安装 Node.js（如果还没有）

**Windows:**
- 访问 [Node.js 官网](https://nodejs.org/)
- 下载并安装 LTS 版本
- 或使用 Node 安装检查脚本：`.\scripts\check-node-install.ps1`（仅检查是否已安装，不执行安装）

**验证安装:**
```bash
node --version
npm --version
```

### 2. 安装项目依赖

```bash
npm install
```

### 3. 构建 CSS

```bash
npm run build-css
```

### 4. 打开应用

直接在浏览器中打开 `public/index.html` 文件即可使用！

## 📋 常用命令速查

| 命令 | 说明 |
|------|------|
| `npm run build-css` | 构建生产版本的 CSS |
| `npm run watch-css` | 监听 CSS 变化（开发模式） |
| `npm run check-versions` | 检查第三方库最新版本 |
| `npm run auto-update` | 自动更新到最新版本 |
| `npm run update-cdn` | 更新本地 CDN 资源 |

## 🔧 开发工作流

### 日常开发

1. **启动监听模式**
   ```bash
   npm run watch-css
   ```

2. **编辑文件**
   - 修改 `src/input.css` 添加自定义样式
   - 修改 `public/index.html` 调整页面结构
   - 修改 `public/app/` 下对应模块调整功能逻辑（`public/app.js` 仅负责按顺序加载脚本）

3. **CSS 会自动重新构建**（如果 watch-css 在运行）

### 更新第三方库

1. **检查更新**
   ```bash
   npm run check-versions
   ```

2. **自动更新**
   ```bash
   npm run auto-update
   ```

## 📁 重要文件说明

- **`public/index.html`** - 主页面文件
- **`public/app.js`** - 应用入口（按顺序加载 `public/app/**`）
- **`public/app/`** - 应用核心逻辑（模块化代码）
- **`src/input.css`** - 样式源文件（在这里添加自定义样式）
- **`public/styles.css`** - 构建后的 CSS（自动生成，不要手动编辑）
- **`config/tailwind.config.js`** - Tailwind 配置
- **`config/cdn-versions.json`** - 第三方库版本配置

## ❓ 常见问题

### Q: CSS 没有更新？
A: 确保运行了 `npm run build-css` 或 `npm run watch-css`

### Q: 脚本执行失败？
A: 检查 PowerShell 执行策略，可能需要运行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: 为什么翻译一开始就失败，提示“API密钥未配置/格式不正确”？

A: 你选择的翻译引擎需要配置对应的 API Key。

- 例如选择 **OpenAI/Google/DeepSeek** 时，需要在“设置”中填写对应的 Key。
- **严格模式行为**：所选引擎缺 Key/Key 无效时，批量翻译会立即中止并提示一次（不会逐条刷屏）。

### Q: 如何添加新的样式？
A: 编辑 `src/input.css` 文件，添加自定义 CSS 或使用 Tailwind 类

### Q: 如何更新第三方库？
A: 运行 `npm run auto-update` 自动更新，或手动编辑 `config/cdn-versions.json`

## 📚 更多信息

- [Node.js 安装指南](NodeJS-Install-Guide.md)
- [项目结构说明](PROJECT-STRUCTURE.md)
- [CDN 更新指南](README-CDN-UPDATE.md)
- [Tailwind CSS 指南](README-TAILWIND.md)
- [GitHub 发布清单](GITHUB-RELEASE-CHECKLIST.md)
- [app 模块与函数说明](APP-JS-Function-Guide.md)（维护/二次开发）

