# 智能翻译工具 - 多格式本地化翻译助手

一个功能强大的本地化翻译工具，支持多种文件格式的翻译和管理。

## ✨ 特性

- 📝 支持多种文件格式（JSON, XLIFF, PO, Excel 等）
- 🎨 现代化的用户界面（Tailwind CSS）
- 🌙 深色模式支持
- 💾 本地存储，无需服务器
- 📊 翻译质量报告
- 🔍 术语库管理
- 📈 翻译进度跟踪

## 🚀 快速开始

### 前置要求

- Node.js (v14 或更高版本)
- npm 或 yarn

### 安装步骤

1. **安装 Node.js**（如果还没有）
   - 查看 [安装指南](docs/安装Node.js指南.md)

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建 CSS**
   ```bash
   npm run build-css
   ```

4. **打开应用**
   - 在浏览器中打开 `public/index.html`

## 📁 项目结构

详细的项目结构说明请查看 [项目结构文档](docs/PROJECT-STRUCTURE.md)

```
html/
├── config/          # 配置文件
├── docs/            # 文档
├── scripts/         # 脚本
├── src/             # 源代码
├── public/          # 发布目录（浏览器打开/部署）
│   ├── lib/         # 第三方库（本地化）
│   ├── index.html   # 主 HTML 文件
│   ├── app.js       # 应用逻辑
│   └── styles.css   # 构建后的 CSS
```

## 🛠️ 开发

### 监听 CSS 变化（开发模式）

```bash
npm run watch-css
```

### 构建生产版本

```bash
npm run build-css
```

## 📦 更新第三方库

### 检查最新版本

```bash
npm run check-versions
```

### 自动更新到最新版本

```bash
npm run auto-update
```

### 手动更新（使用当前配置）

```bash
npm run update-cdn
```

详细说明请查看 [CDN 更新指南](docs/README-CDN-UPDATE.md)

## 📚 文档

- [项目结构](docs/PROJECT-STRUCTURE.md) - 详细的目录结构说明
- [CDN 更新指南](docs/README-CDN-UPDATE.md) - 如何更新第三方库
- [Tailwind CSS 指南](docs/README-TAILWIND.md) - Tailwind CSS 使用说明
- [Node.js 安装指南](docs/安装Node.js指南.md) - Node.js 安装步骤

## 🎯 主要功能

- **文件导入**: 支持拖放或选择文件导入
- **翻译管理**: 可视化的翻译项管理
- **术语库**: 自定义术语库，提高翻译一致性
- **导出功能**: 支持多种格式导出
- **搜索功能**: 快速搜索翻译项
- **分页显示**: 大量数据的分页管理

## 🔧 技术栈

- **前端框架**: 原生 JavaScript
- **样式框架**: Tailwind CSS (本地构建)
- **图标库**: Font Awesome 4.7.0 (本地化)
- **图表库**: Chart.js 4.4.8 (本地化)
- **Excel 处理**: SheetJS 0.20.1 (本地化)

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请查看文档或提交 Issue。


