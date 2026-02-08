# Tailwind CSS 本地安装说明

> 仓库：[https://github.com/webmturn/ai-localization](https://github.com/webmturn/ai-localization)

## 📋 前置要求

在开始之前，您需要安装 Node.js（包含 npm）。

### 安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载并安装 LTS 版本（推荐）
3. 验证安装：
   ```bash
   node --version
   npm --version
   ```

详细步骤见 [Node.js 安装指南](NodeJS-Install-Guide.md)。

## 🚀 安装步骤

### 1. 安装依赖

在项目根目录运行：

```bash
npm install
```

这将安装 Tailwind CSS 到 `node_modules` 目录。

### 2. 构建 CSS

#### 一次性构建（生产环境）

```bash
npm run build-css
```

这将：
- 读取 `src/input.css` 文件
- 处理 Tailwind 指令和自定义样式
- 生成优化后的 `public/styles.css` 文件（已压缩）

#### 监听模式（开发环境）

```bash
npm run watch-css
```

这将：
- 自动监听文件变化
- 实时重新构建 CSS
- 适合开发时使用

### 3. 更新 HTML

构建完成后，`public/styles.css` 已经包含了 Tailwind CSS 和所有自定义样式。

**重要**：本项目默认使用本地构建样式（`public/styles.css`），`public/index.html` 中不需要引入 Tailwind CDN。

如果你曾手动添加过 Tailwind CDN 脚本，请移除/注释掉：

```html
<!-- 删除或注释掉这行 -->
<!-- <script src="https://cdn.tailwindcss.com"></script> -->
```

## 📁 项目结构

```
html/
├── public/
│   ├── index.html          # HTML 文件
│   ├── app.js              # 应用入口（按顺序加载 public/app/**）
│   ├── app/                # 应用核心逻辑（模块化代码）
│   └── styles.css          # 构建后的 CSS 文件（由 Tailwind 生成）
├── src/
│   └── input.css          # Tailwind 输入文件（包含所有自定义样式）
├── package.json           # npm 配置文件
└── config/tailwind.config.js     # Tailwind 配置文件
```

## 🔧 配置文件说明

### `tailwind.config.js`

包含 Tailwind 的自定义配置：
- 自定义颜色（primary, secondary 等）
- 自定义字体
- 自定义阴影

### `src/input.css`

包含：
- Tailwind 指令（@tailwind base/components/utilities）
- 所有自定义样式
- Font Awesome 字体配置
- 深色模式样式
- 移动端响应式样式（以下媒体查询块）：
  - `@media (max-width: 639px)` — 移动端设置模态框导航（横向tabs、表单堆叠、toggle保持横向）
  - `@media (max-width: 639px)` — 移动端其他模态框优化（质量报告、术语库、帮助、通知、项目管理）
  - `@media (max-width: 767px)` — 移动端侧边栏底部Sheet样式（遮罩层、圆角、拖拽指示条）
  - `@media (max-width: 767px)` — 移动端整体CSS优化（间距、触控目标、底部安全区）

## 📝 使用说明

### 开发流程

1. **启动监听模式**：
   ```bash
   npm run watch-css
   ```

2. **编辑样式**：
   - 修改 `src/input.css` 中的自定义样式
   - 或修改 `tailwind.config.js` 中的配置
   - 保存后会自动重新构建

3. **在 HTML 中使用 Tailwind 类**：
   ```html
   <div class="bg-primary text-white p-4">
     内容
   </div>
   ```

### 生产部署

1. **构建优化后的 CSS**：
   ```bash
   npm run build-css
   ```

2. **确保 HTML 中没有引入 Tailwind CDN 脚本**（本项目默认不需要）

3. **部署文件**：
   - `public/index.html`
   - `public/styles.css`（构建后的）
   - `public/app.js`
   - `public/app/`
   - 其他资源文件

## ⚠️ 注意事项

1. **不要直接编辑 `public/styles.css`**：这个文件是自动生成的，您的更改会在下次构建时丢失。

2. **编辑 `src/input.css`**：所有自定义样式应该添加到这里。

3. **Git 忽略**：建议将 `node_modules/` 添加到 `.gitignore`：
   ```
   node_modules/
   ```

4. **构建后验证**：构建完成后，在浏览器中打开 `public/index.html` 验证样式是否正常。

## 🎯 优势

使用本地 Tailwind CSS 后：

✅ **无控制台警告**：不再有 "should not be used in production" 警告  
✅ **更小的文件**：只包含实际使用的样式  
✅ **更快的加载**：本地文件，无需网络请求  
✅ **完全控制**：可以自定义所有配置  
✅ **生产就绪**：符合生产环境最佳实践  

## 🆘 常见问题

### Q: 构建后样式丢失？

A: 检查 `config/tailwind.config.js` 中的 `content` 配置，确保包含了所有 HTML 和 JS 文件路径。

### Q: 如何添加新的自定义样式？

A: 在 `src/input.css` 中添加，可以使用 `@layer` 指令组织代码。

### Q: 可以同时使用 CDN 和本地版本吗？

A: 不建议，会导致样式冲突。构建后应该移除 CDN 脚本。

## 📚 更多资源

- [Tailwind CSS 官方文档](https://tailwindcss.com/docs)
- [Tailwind CLI 文档](https://tailwindcss.com/docs/cli)
- [快速开始](QUICK-START.md) · [项目结构](PROJECT-STRUCTURE.md)


