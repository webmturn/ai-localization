# Node.js 安装指南

本指南用于在本项目中运行 `npm install` 与 `npm run build-css` 前安装 Node.js。  
**仓库**：[https://github.com/webmturn/ai-localization](https://github.com/webmturn/ai-localization)

## 🚀 方法一：官方安装程序（推荐）

### Windows 安装步骤

1. **访问 Node.js 官网**
   - 打开浏览器，访问：https://nodejs.org/
   - 或直接访问中文站点：https://nodejs.org/zh-cn/

2. **下载 LTS 版本**
   - 点击绿色的 "LTS" 按钮（推荐用于生产环境）
   - 当前推荐版本：v20.x.x 或 v18.x.x
   - 下载 Windows Installer (.msi) 文件

3. **运行安装程序**
   - 双击下载的 `.msi` 文件
   - 点击 "Next" 继续
   - 接受许可协议
   - 选择安装路径（默认即可）
   - **重要**：确保勾选 "Add to PATH" 选项
   - 点击 "Install" 开始安装
   - 等待安装完成

4. **验证安装**
   - 关闭当前命令行窗口，重新打开 PowerShell 或命令提示符
   - 运行以下命令验证：
     ```powershell
     node --version
     npm --version
     ```
   - 如果显示版本号，说明安装成功。若已在本项目目录下，也可运行 `.\scripts\check-node-install.ps1` 检查是否已安装 Node（仅检查，不执行安装）。

## 🔧 方法二：使用包管理器（高级用户）

### 使用 Chocolatey（如果已安装）

```powershell
choco install nodejs-lts
```

### 使用 Winget（Windows 10/11）

```powershell
winget install OpenJS.NodeJS.LTS
```

## ✅ 安装后验证

安装完成后，**请重新打开 PowerShell**，然后运行：

```powershell
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查安装路径（Windows）
where node
```

预期输出示例：
```
v20.11.0
10.2.4
C:\Program Files\nodejs\node.exe
```

在本项目根目录下也可运行 `.\scripts\check-node-install.ps1` 做快速检查（仅检测是否已安装，不执行安装）。

## 🎯 安装完成后

安装 Node.js 后，进入**你的项目目录**，按 [快速开始](QUICK-START.md) 或 README 执行：

```powershell
# 进入项目目录（替换为你的实际路径）
cd 你的项目目录

# 安装依赖
npm install

# 构建 CSS（必须，否则页面无样式）
npm run build-css
```

然后在浏览器中打开 `public/index.html` 即可使用。

## ⚠️ 常见问题

### 问题 1：安装后仍然提示 "找不到 node"

**解决方案**：
1. 关闭所有命令行窗口
2. 重新打开 PowerShell
3. 如果还是不行，检查环境变量：
   - 右键 "此电脑" → "属性" → "高级系统设置" → "环境变量"
   - 在 "系统变量" 中找到 "Path"
   - 确保包含：`C:\Program Files\nodejs\`

### 问题 2：权限错误

**解决方案**：
- 以管理员身份运行 PowerShell
- 或使用用户目录安装（不推荐）

### 问题 3：安装速度慢

**解决方案**：
- 使用国内镜像（安装完成后配置）：
  ```powershell
  npm config set registry https://registry.npmmirror.com
  ```

## 📚 更多资源

- Node.js 官网：https://nodejs.org/
- Node.js 中文：https://nodejs.org/zh-cn/
- npm 文档：https://docs.npmjs.com/
- Node.js 中文网：https://nodejs.cn/

---

安装完成后，请按 [快速开始](QUICK-START.md) 完成依赖安装与 CSS 构建，再在浏览器中打开 `public/index.html` 使用应用。
