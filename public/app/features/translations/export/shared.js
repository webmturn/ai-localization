// 格式化文件大小

// 转义CSV内容
function escapeCsv(text) {
  if (!text) return "";
  return text.toString().replace(/"/g, '""');
}

// 转义XML内容
function escapeXml(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(text) {
  const raw = text === null || text === undefined ? "" : String(text);
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 下载文件
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==================== 暴露到全局 Utils 命名空间 ====================
if (typeof window !== 'undefined') {
  // 确保 Utils 命名空间存在
  if (!window.Utils) {
    window.Utils = {};
  }
  
  // 添加工具函数到 Utils 命名空间
  window.Utils.escapeCsv = escapeCsv;
  window.Utils.escapeXml = escapeXml;
  window.Utils.escapeHtml = escapeHtml;
  window.Utils.downloadFile = downloadFile;
  
  // 同时保持全局函数可用（向后兼容）
  window.escapeCsv = escapeCsv;
  window.escapeXml = escapeXml;
  window.escapeHtml = escapeHtml;
  window.downloadFile = downloadFile;
}
