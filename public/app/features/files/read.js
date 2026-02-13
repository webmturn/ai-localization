async function __readFileAsyncImpl(file) {
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
    } catch (_) {
      return true;
    }
  };

  const __detectBomEncoding = typeof ParserUtils !== 'undefined'
    ? ParserUtils.detectBom
    : (bytes) => {
        if (!bytes || bytes.length < 2) return "";
        if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
        if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
        if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
        return "";
      };

  const __guessUtf16WithoutBom = (bytes) => {
    if (!bytes || bytes.length < 4) return "";

    const sampleLen = Math.min(bytes.length, 4096);
    let evenNulls = 0;
    let oddNulls = 0;
    let evenCount = 0;
    let oddCount = 0;

    for (let i = 0; i < sampleLen; i++) {
      if (i % 2 === 0) {
        evenCount++;
        if (bytes[i] === 0x00) evenNulls++;
      } else {
        oddCount++;
        if (bytes[i] === 0x00) oddNulls++;
      }
    }

    const evenRatio = evenCount ? evenNulls / evenCount : 0;
    const oddRatio = oddCount ? oddNulls / oddCount : 0;

    if (oddRatio > 0.3 && evenRatio < 0.05) return "utf-16le";
    if (evenRatio > 0.3 && oddRatio < 0.05) return "utf-16be";
    return "";
  };

  const __decode = (bytes, encoding, fatal) => {
    try {
      const decoder = new TextDecoder(encoding, { fatal: !!fatal });
      return decoder.decode(bytes);
    } catch (_) {
      return null;
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

        const autoDetect = __getAutoDetectEncoding();
        const bom = __detectBomEncoding(bytes);
        const utf16Guess = !bom && autoDetect ? __guessUtf16WithoutBom(bytes) : "";

        let text = null;
        const primaryEncoding = bom || utf16Guess || "";
        if (primaryEncoding) {
          text = __decode(bytes, primaryEncoding, false);
        }

        if (text == null) {
          if (!autoDetect) {
            text = __decode(bytes, "utf-8", false);
          } else {
            const utf8 = __decode(bytes, "utf-8", true);
            if (utf8 != null) {
              text = utf8;
            } else {
              const fallbacks = [
                "gb18030",
                "gbk",
                "shift_jis",
                "big5",
                "windows-1252",
                "iso-8859-1",
              ];
              for (let i = 0; i < fallbacks.length; i++) {
                const decoded = __decode(bytes, fallbacks[i], false);
                if (decoded == null) continue;
                text = decoded;
                break;
              }
              if (text == null) {
                text = __decode(bytes, "utf-8", false);
              }
            }
          }
        }

        if (typeof text !== "string") {
          reject(new Error(`读取文件 ${file.name} 失败`));
          return;
        }

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
