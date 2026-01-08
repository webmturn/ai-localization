# GitHub 发布前完善清单

发布到 GitHub 前建议逐项检查与完善以下内容。

---

## 一、必做项

### 1. 元信息补全

| 项目 | 当前状态 | 建议 |
|------|----------|------|
| **package.json** | `repository.url` 已填为 `https://github.com/webmturn/ai-localization.git`；`author` 已填为 `webmturn <webmturn@gmail.com>`；`keywords` 已含翻译相关 | 若更换维护者，记得更新 `author` |
| **LICENSE** | 已写 “Copyright (c) 2025 webmturn” | 与仓库所有者一致，无需修改 |

### 2. 安全与隐私

| 项目 | 状态 | 说明 |
|------|------|------|
| API Key 存储 | ✅ 无硬编码 | 密钥来自用户输入并加密存 localStorage，代码中无明文 |
| 敏感文件 | ✅ 无 .env 提交 | 未发现 .env 或密钥文件需加入 .gitignore |
| README 安全提示 | ✅ 已写 | README「API Key 配置说明」中已包含：请勿在 Issue、Pull Request 或公开场合粘贴真实 API Key |

### 3. 构建产物与 .gitignore

| 项目 | 状态 |
|------|------|
| `styles.css` | ✅ 已在 .gitignore，构建出的 CSS 不会被提交 |
| `node_modules/` | ✅ 已忽略 |
| `package-lock.json` | ⚠️ 当前被忽略 | 若希望他人复现依赖版本，可考虑**不**忽略 `package-lock.json` 并提交 |

---

## 二、推荐项（提升可发现性与协作体验）

### 4. README 增强

- **英文 README**：增加 `README.en.md` 或把现有 README 翻译一份，便于国际用户和 SEO。
- **徽章**：在 README 顶部加徽章，例如：
  - License (MIT)
  - 可选：npm version、build status（若以后有 CI）
- **截图 / 动图**：增加 1～2 张界面截图或简短 GIF，方便访客快速了解产品。
- **Demo**：若有在线预览（GitHub Pages / 其他），在 README 中写清链接。

### 5. 贡献与社区

| 文件 | 说明 |
|------|------|
| **CONTRIBUTING.md** | 说明如何提 Issue、如何 Fork、分支命名、如何跑测试/构建、代码风格等，减少沟通成本。 |
| **.github/ISSUE_TEMPLATE/** | 配置 Bug 报告、功能建议等 Issue 模板，让 Issue 信息更完整。 |
| **.github/PULL_REQUEST_TEMPLATE.md** | PR 模板（勾选清单、关联 Issue 等），便于审查。 |

### 6. 行为准则与安全策略（可选）

| 文件 | 说明 |
|------|------|
| **CODE_OF_CONDUCT.md** | 社区行为准则，GitHub 会在仓库中显示链接。 |
| **.github/SECURITY.md** | 说明如何负责任地报告安全问题（邮箱或流程），便于安全研究人员联系。 |

### 7. 版本与发布

- **Git 标签**：首次正式发布可打 tag，如 `v1.0.0`，并在 GitHub 的 “Releases” 中写 release notes。
- **Changelog**：建议新增 `CHANGELOG.md`，按版本记录重要变更，便于用户和贡献者查看。

---

## 三、文档与脚本

### 8. 已有文档（可做小调整）

- `docs/QUICK-START.md`、`docs/PROJECT-STRUCTURE.md`、`docs/NodeJS-Install-Guide.md`、`docs/APP-JS-Function-Guide.md` 等已存在；README 的「文档」一节已包含快速开始、项目结构、GitHub 发布清单、Node.js 安装指南等链接。

### 9. 跨平台说明

- 脚本多为 PowerShell（`scripts/*.ps1`，如 `check-node-install.ps1`、`update-cdn.ps1` 等）。README 与 QUICK-START 中已注明：
  - **Windows**：可直接运行 `.\scripts\xxx.ps1` 或 `npm run xxx`；Node 检查脚本为 `.\scripts\check-node-install.ps1`。
  - **macOS / Linux**：需先安装 Node，CSS 构建用 `npm run build-css`；CDN 更新等脚本需 WSL 或自行改写成 shell，或注明“当前仅支持 Windows”。

---

## 四、发布前快速自检

- [ ] `npm install` 与 `npm run build-css` 在全新目录下可成功执行。
- [ ] 在浏览器中打开 `public/index.html`，核心功能（打开文件、翻译、导出）可用。
- [ ] README 中的安装与运行步骤与当前仓库一致。
- [ ] 已确认无个人路径、内网地址、真实密钥等被提交。
- [ ] `package.json` 的 `name` 在 npm 上未被占用（若计划发布 npm 包）；若仅 GitHub 使用可忽略。

---

## 五、总结优先级

| 优先级 | 内容 | 状态 |
|--------|------|------|
| 高 | package.json 的 author、keywords；README 中提醒勿泄露 API Key | ✅ 已完成 |
| 高 | CONTRIBUTING.md | ✅ 已存在 |
| 高 | README 快速开始中强调 `npm install` + `npm run build-css` | ✅ 已完成 |
| 中 | README 增加截图/徽章；文档链接（QUICK-START、Node.js 安装指南等） | ✅ 链接已齐全；截图/徽章按需 |
| 中 | .github Issue/PR 模板 | ✅ 已存在 |
| 低 | 英文 README、CODE_OF_CONDUCT、SECURITY.md、CHANGELOG | 按需 |

按上述清单逐项核对即可更稳妥、专业地发布到 GitHub。
