# Node.js 安装指南

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
   - 关闭当前命令行窗口
   - 重新打开 PowerShell 或命令提示符
   - 运行以下命令验证：
     ```powershell
     node --version
     npm --version
     ```
   - 如果显示版本号，说明安装成功！

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

# 检查安装路径
where node
```

预期输出示例：
```
v20.11.0
10.2.4
C:\Program Files\nodejs\node.exe
```

## 🎯 安装完成后

安装 Node.js 后，返回项目目录并运行：

```powershell
# 进入项目目录（如果还没有）
cd C:\Users\webyuan\Desktop\html

# 安装 Tailwind CSS 依赖
npm install

# 构建 CSS
npm run build-css
```

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
- npm 文档：https://docs.npmjs.com/
- Node.js 中文网：https://nodejs.cn/

## 🎉 安装完成后

安装完成后，请告诉我，我会帮您继续完成 Tailwind CSS 的设置！


## 存储方案草案（多后端：localStorage / IndexedDB / File System Access）

### 目标

在不影响现有功能的前提下，支持多种存储后端共存，并可通过设置选择启用的存储方式，以解决 `localStorage` 容量有限（尤其是大 XML/大项目）的问题。

### 方案 A（推荐）：IndexedDB 作为项目主存储 + localStorage 存设置 + 可选文件存储

- localStorage：仅存
  - 用户设置（如 `translatorSettings`）
  - 用户选择的存储后端（如 `preferredStorageBackend`）
  - 小型状态（如 `debugMode`）
- IndexedDB：作为默认的“项目自动保存”后端（容量更大、无需额外权限）
- File System Access API：作为高级可选项（用户主动开启/授权），用于超大项目或希望像桌面软件一样“直接写文件”的体验

优点：

- 默认稳定、容量足够、用户无感
- 只有真正需要时才引入文件权限与文件句柄管理
- 复杂度可控

### 方案 B（更强但更复杂）：三者可随时切换并自动迁移

- 在设置中允许随时切换 storage backend
- 切换时提供迁移/冲突处理

风险：

- 数据容易分叉（A 后端和 B 后端的数据不一致）
- 需要更完整的迁移、回退、冲突策略与 UI 提示

### 核心架构：抽象存储接口 + StorageManager

定义统一接口（概念示例）：

- `isAvailable(): Promise<boolean>`
- `loadCurrentProject(): Promise<Project|null>`
- `saveCurrentProject(project: Project): Promise<void>`
- `clearCurrentProject(): Promise<void>`
- `getBackendName(): string`

分别实现：

- LocalStorageProjectStorage
- IndexedDbProjectStorage
- FileSystemProjectStorage

由 StorageManager 负责：

- 读取用户偏好（`preferredStorageBackend`）并选择激活后端
- 调用激活后端完成 save/load
- 统一回退策略（例如 filesystem 不可用则回退到 indexeddb）

### 迁移策略（建议做成显式动作）

- 当用户在设置里切换后端时，提供按钮：
  - “从当前后端迁移到新后端”
- 迁移逻辑：
  - 从旧后端 `loadCurrentProject()`
  - 写入新后端 `saveCurrentProject()`
  - 成功后更新 `preferredStorageBackend`

### 启动恢复优先级（避免恢复错项目）

1. 优先使用用户设置的后端（preferred）
2. 失败回退到 IndexedDB
3. 再失败回退到 localStorage
4. 都没有则加载示例项目

### UI 建议

- 设置项：存储方式
  - localStorage（兼容/容量小，适合轻量项目）：
  - IndexedDB（推荐/容量大）
  - File System（超大项目/需要授权）
- 切换后提示：是否迁移数据
- 显示当前后端状态：可用性、最近保存时间、失败提示

