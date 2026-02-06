// ==================== 文件内容键管理 ====================
// 从 storage-manager.js 拆分出来的独立模块
// 提供项目ID管理、内容键生成、文件元数据水合、原始内容加载等

function getOrCreateProjectId() {
  if (AppState.project?.id) return AppState.project.id;
  const fallbackId = `project-${Date.now()}`;
  if (!AppState.project) AppState.project = { id: fallbackId };
  AppState.project.id = AppState.project.id || fallbackId;
  return AppState.project.id;
}

const CONTENT_KEY_VERSION = 1;

function buildFileContentKeyV1(projectId, fileName) {
  return `${projectId}::${fileName}`;
}

function buildFileContentKey(projectId, fileName) {
  // 预留：后续可升级到 V2（例如 hash(content) 或 uuid）
  if (CONTENT_KEY_VERSION === 1)
    return buildFileContentKeyV1(projectId, fileName);
  return buildFileContentKeyV1(projectId, fileName);
}

function hydrateFileMetadataContentKeys(projectId) {
  const pid = projectId || AppState.project?.id;
  if (!pid) return;

  const fileMetadata = AppState.fileMetadata || {};
  Object.keys(fileMetadata).forEach((fileName) => {
    const meta = fileMetadata[fileName];
    if (!meta) return;

    if (!meta.contentKey) {
      meta.contentKey = buildFileContentKey(pid, fileName);
    }

    if (meta.originalContent && typeof meta.originalContent === "string") {
      Promise.resolve(
        idbPutFileContent(meta.contentKey, meta.originalContent)
      ).catch((e) => {
        (window.loggers?.storage || console).error("IndexedDB写入originalContent失败:", e);
        notifyIndexedDbFileContentErrorOnce(e, "保存原始内容");
      });
    }
  });
}

function ensureFileContentKey(meta, fileName) {
  if (meta && meta.contentKey) return meta.contentKey;
  const projectId = getOrCreateProjectId();
  const key = buildFileContentKey(projectId, fileName);
  if (meta) meta.contentKey = key;
  return key;
}

async function ensureOriginalContentLoadedForFile(fileName) {
  if (!fileName) return false;
  const meta = AppState.fileMetadata?.[fileName];
  if (!meta) return false;
  if (meta.originalContent && typeof meta.originalContent === "string")
    return true;
  const key = meta.contentKey;
  if (!key) return false;

  try {
    const content = await idbGetFileContent(key);
    if (content && typeof content === "string") {
      meta.originalContent = content;
      return true;
    }
  } catch (e) {
    (window.loggers?.storage || console).error("IndexedDB读取originalContent失败:", e);
    notifyIndexedDbFileContentErrorOnce(e, "读取原始内容");
  }

  return false;
}
