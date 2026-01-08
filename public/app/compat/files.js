// ==================== 文件处理功能（优化版） ====================

// 读取单个文件
async function readFileAsync(file) {
  const App = window.App;
  const impl = App?.impl?.readFileAsync;
  if (typeof impl === "function") return impl(file);
  const legacy =
    typeof __readFileAsyncImpl === "function" ? __readFileAsyncImpl : null;
  if (typeof legacy === "function") return legacy(file);
  throw new Error(
    "readFileAsync: no implementation found (App.impl.readFileAsync / __readFileAsyncImpl)"
  );
}

// 解析单个文件
async function parseFileAsync(file) {
  const App = window.App;
  const impl = App?.impl?.parseFileAsync;
  if (typeof impl === "function") return impl(file);
  const legacy =
    typeof __parseFileAsyncImpl === "function" ? __parseFileAsyncImpl : null;
  if (typeof legacy === "function") return legacy(file);
  throw new Error(
    "parseFileAsync: no implementation found (App.impl.parseFileAsync / __parseFileAsyncImpl)"
  );
}

// 处理多个文件（优化版）
async function processFiles(files) {
  const App = window.App;
  const impl = App?.impl?.processFiles;
  if (typeof impl === "function") return impl(files);
  const legacy =
    typeof __processFilesImpl === "function" ? __processFilesImpl : null;
  if (typeof legacy === "function") return legacy(files);
  throw new Error(
    "processFiles: no implementation found (App.impl.processFiles / __processFilesImpl)"
  );
}

// 完成文件处理
async function completeFileProcessing(files, newItems) {
  const App = window.App;
  const impl = App?.impl?.completeFileProcessing;
  if (typeof impl === "function") return impl(files, newItems);
  const legacy =
    typeof __completeFileProcessingImpl === "function"
      ? __completeFileProcessingImpl
      : null;
  if (typeof legacy === "function") return legacy(files, newItems);
  throw new Error(
    "completeFileProcessing: no implementation found (App.impl.completeFileProcessing / __completeFileProcessingImpl)"
  );
}
