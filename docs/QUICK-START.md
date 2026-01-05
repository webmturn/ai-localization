# 快速开始指南

## 🚀 5 分钟快速上手

### 1. 安装 Node.js（如果还没有）

**Windows:**
- 访问 [Node.js 官网](https://nodejs.org/)
- 下载并安装 LTS 版本
- 或使用提供的快速安装脚本：`.\scripts\快速安装.ps1`

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
   - 修改 `public/app.js` 调整功能逻辑

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
- **`public/app.js`** - 应用核心逻辑
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

### Q: 如何添加新的样式？
A: 编辑 `src/input.css` 文件，添加自定义 CSS 或使用 Tailwind 类

### Q: 如何更新第三方库？
A: 运行 `npm run auto-update` 自动更新，或手动编辑 `config/cdn-versions.json`

## 📚 更多信息

- [项目结构说明](PROJECT-STRUCTURE.md)
- [CDN 更新指南](README-CDN-UPDATE.md)
- [Tailwind CSS 指南](README-TAILWIND.md)

