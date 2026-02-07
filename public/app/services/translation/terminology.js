// 术语库匹配函数
TranslationService.prototype.findTerminologyMatches = function (text) {
  const matches = [];

  try {
    const terminologyList =
      (AppState &&
      AppState.project &&
      Array.isArray(AppState.project.terminologyList)
        ? AppState.project.terminologyList
        : null) ||
      (AppState &&
      AppState.terminology &&
      Array.isArray(AppState.terminology.list)
        ? AppState.terminology.list
        : []);
    if (!terminologyList || terminologyList.length === 0) return matches;

    // 遍历术语库，查找匹配项
    for (const term of terminologyList) {
      try {
        // 使用简单的字符串匹配（大小写不敏感）
        const textLower = text.toLowerCase();
        const sourceLower = term.source.toLowerCase();

        if (textLower.includes(sourceLower)) {
          matches.push({
            source: term.source,
            target: term.target,
            context: term.context || "",
          });
        }
      } catch (e) {
        // 忽略单个术语的错误
        (loggers.translation || console).warn("匹配术语失败:", term.source, e);
      }
    }
  } catch (error) {
    (loggers.translation || console).error("术语库匹配失败:", error);
  }

  return matches;
};
