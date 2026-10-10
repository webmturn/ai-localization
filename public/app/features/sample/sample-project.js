function loadSampleProject() {
  // 模拟项目数据（经 ProjectStore 统一载入：同步 translations 视图与 fileMetadata 别名）
  // 示例也提供真实源文件，保存、重新解析和原格式导出使用相同资源结构。
  const project = {
    __isSampleProject: true,
    id: "sample-project-1",
    name: "示例项目",
    sourceLanguage: "en",
    targetLanguage: "zh",
    fileFormat: "json",
    translationItems: [
      {
        id: "item-1",
        sourceText: "Welcome to our application",
        targetText: "欢迎使用我们的应用",
        context: "应用启动欢迎语",
        status: "translated",
        qualityScore: 98,
        issues: [],
        metadata: { file: "sample-project.json", position: "app.welcome" },
      },
      {
        id: "item-2",
        sourceText: "Please login to continue",
        targetText: "请登录以继续",
        context: "登录提示",
        status: "translated",
        qualityScore: 95,
        issues: [],
        metadata: { file: "sample-project.json", position: "auth.login.prompt" },
      },
      {
        id: "item-3",
        sourceText: "The API endpoint requires authentication.",
        targetText: "API端点需要身份验证。",
        context: "API错误消息",
        status: "translated",
        qualityScore: 85,
        issues: [{ type: "术语不一致", severity: "medium" }],
        metadata: { file: "sample-project.json", position: "api.error.auth" },
      },
      {
        id: "item-4",
        sourceText: "Please refer to the documentation for more details.",
        targetText: "请参考文档以获取更多详细信息。",
        context: "帮助提示",
        status: "translated",
        qualityScore: 80,
        issues: [{ type: "冗余表达", severity: "high" }],
        metadata: { file: "sample-project.json", position: "help.documentation" },
      },
      {
        id: "item-5",
        sourceText: "You have successfully updated your profile.",
        targetText: "",
        context: "成功消息",
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: { file: "sample-project.json", position: "profile.update.success" },
      },
      {
        id: "item-6",
        sourceText: "Please enter a valid email address.",
        targetText: "",
        context: "表单验证错误",
        status: "pending",
        qualityScore: 0,
        issues: [],
        metadata: { file: "sample-project.json", position: "form.error.email" },
      },
    ],
    fileMetadata: {
      "sample-project.json": {
        type: "application/json",
        extension: "json",
        parserId: "json",
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const resources = {};
  project.translationItems.forEach((item, index) => {
    const tokens = item.metadata.position.split(".");
    let parent = resources;
    for (const token of tokens.slice(0, -1)) {
      parent[token] = parent[token] || {};
      parent = parent[token];
    }
    parent[tokens[tokens.length - 1]] = item.sourceText;
    Object.assign(item.metadata, {
      pathTokens: tokens,
      path: "$." + tokens.join("."),
      position: "key-" + (index + 1),
    });
  });
  const meta = project.fileMetadata["sample-project.json"];
  meta.originalContent = JSON.stringify(resources, null, 2);
  meta.size = new Blob([meta.originalContent]).size;
  ProjectStore.loadProject(project);

  // 更新UI
  updateFileTree();
  updateTranslationLists();
  updateCounters();

  // 显示通知
  showNotification("success", "项目已加载", "示例项目已成功加载");

  autoSaveManager.markDirty();
  autoSaveManager.saveProject();
}

// 文件拖放处理
