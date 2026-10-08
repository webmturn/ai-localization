async function __readFileAsyncImpl(file, options = {}) {
  // 文件大小限制（maxFileSize 设置项，MB，默认 10）
  try {
    const settings = SettingsCache.get() || {};
    const raw = parseInt(settings.maxFileSize);
    const maxMB = Number.isFinite(raw) ? Math.max(1, Math.min(100, raw)) : 10;
    if (file && typeof file.size === "number" && file.size > maxMB * 1024 * 1024) {
      throw new Error("文件大小超过限制（" + maxMB + "MB）：" + (file.name || "未知文件"));
    }
  } catch (e) {
    if (e && e.message && e.message.indexOf("超过限制") !== -1) throw e;
  }

  const __readAsTextFallback = () =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
      reader.readAsText(file);
    });

  if (typeof TextDecoder !== "function") {
    return __readAsTextFallback();
  }

  const __getAutoDetectEncoding = () => {
    try {
      const settings = SettingsCache.get();
      if (settings && settings.autoDetectEncoding !== undefined) {
        return !!settings.autoDetectEncoding;
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result;
        const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : null;
        if (!bytes) {
          __readAsTextFallback().then(resolve).catch(reject);
          return;
        }

        const settings = (typeof SettingsCache !== 'undefined' ? SettingsCache.get() : {}) || {};
        const decoded = ParserUtils.decodeFileBytes(bytes, {
          encoding: options.encoding || settings.fileEncoding || 'auto',
          autoDetect: __getAutoDetectEncoding(),
        });
        if (decoded.uncertain && Array.isArray(options.warnings)) {
          options.warnings.push({ type: 'encoding', file: file.name, encoding: decoded.encoding,
            message: '已尝试按 ' + decoded.encoding + ' 解码，请核对原文；如有乱码，请在文件处理设置中指定编码。' });
        }
        const text = decoded.text;
        resolve(text);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error(`读取文件 ${file.name} 失败`));
    try {
      reader.readAsArrayBuffer(file);
    } catch (e) {
      __readAsTextFallback().then(resolve).catch(reject);
    }
  });
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.readFileAsync = __readFileAsyncImpl;
})();
