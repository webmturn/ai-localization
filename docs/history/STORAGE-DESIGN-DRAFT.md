# 存储方案草案（多后端：localStorage / IndexedDB / File System Access）

> 本文档为项目内部设计草案，与 Node.js 安装无关。当前项目已实现 IndexedDB + localStorage 的存储方案。

## 目标

在不影响现有功能的前提下，支持多种存储后端共存，并可通过设置选择启用的存储方式，以解决 `localStorage` 容量有限（尤其是大 XML/大项目）的问题。

## 方案 A（推荐）：IndexedDB 作为项目主存储 + localStorage 存设置 + 可选文件存储

- localStorage：仅存
  - 用户设置（如 `translatorSettings`）
  - 用户选择的存储后端（如 `preferredStorageBackend`）
  - 小型状态（如 `debugMode`）
- IndexedDB：作为默认的"项目自动保存"后端（容量更大、无需额外权限）
- File System Access API：作为高级可选项（用户主动开启/授权），用于超大项目或希望像桌面软件一样"直接写文件"的体验

优点：

- 默认稳定、容量足够、用户无感
- 只有真正需要时才引入文件权限与文件句柄管理
- 复杂度可控

## 方案 B（更强但更复杂）：三者可随时切换并自动迁移

- 在设置中允许随时切换 storage backend
- 切换时提供迁移/冲突处理

风险：

- 数据容易分叉（A 后端和 B 后端的数据不一致）
- 需要更完整的迁移、回退、冲突策略与 UI 提示

## 核心架构：抽象存储接口 + StorageManager

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

## 迁移策略（建议做成显式动作）

- 当用户在设置里切换后端时，提供按钮：
  - "从当前后端迁移到新后端"
- 迁移逻辑：
  - 从旧后端 `loadCurrentProject()`
  - 写入新后端 `saveCurrentProject()`
  - 成功后更新 `preferredStorageBackend`

## 启动恢复优先级（避免恢复错项目）

1. 优先使用用户设置的后端（preferred）
2. 失败回退到 IndexedDB
3. 再失败回退到 localStorage
4. 都没有则加载示例项目

## UI 建议

- 设置项：存储方式
  - localStorage（兼容/容量小，适合轻量项目）
  - IndexedDB（推荐/容量大）
  - File System（超大项目/需要授权）
- 切换后提示：是否迁移数据
- 显示当前后端状态：可用性、最近保存时间、失败提示
