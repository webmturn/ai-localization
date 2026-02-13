// ==================== 安全工具模块 ====================

// 简单的加密工具类（使用Web Crypto API）
class SecurityUtils {
  constructor() {
    this._legacySalt = "xml-translator-v1";
    this._saltKey = "__secUtils_salt";
    this._salt = null; // lazy-initialized
  }

  // 获取或生成每安装实例唯一的盐值（存储在 localStorage）
  _getOrCreateSalt() {
    if (this._salt) return this._salt;
    try {
      var stored = localStorage.getItem(this._saltKey);
      if (stored && stored.length >= 16) {
        this._salt = stored;
        return this._salt;
      }
    } catch (_) {}
    // 生成随机盐值
    var arr = crypto.getRandomValues(new Uint8Array(16));
    this._salt = Array.from(arr, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    try { localStorage.setItem(this._saltKey, this._salt); } catch (_) {}
    return this._salt;
  }

  // 生成密钥
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // 加密文本（使用每安装实例唯一的盐值）
  async encrypt(text, password = "default-key") {
    const salt = this._getOrCreateSalt();
    const key = await this.deriveKey(password, salt);
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(text)
    );

    // 将IV和加密数据组合，转为Base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // 分块转换，避免大数组 spread 导致栈溢出
    var chunks = [];
    for (var i = 0; i < combined.length; i += 8192) {
      chunks.push(String.fromCharCode.apply(null, combined.slice(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  }

  // 解密文本（先尝试当前盐值，失败后回退到旧固定盐值以兼容历史数据）
  async decrypt(encryptedText, password = "default-key") {
    // 非 Base64 格式直接返回（未加密的旧数据）
    try { atob(encryptedText); } catch (_) { return encryptedText; }

    const salt = this._getOrCreateSalt();
    // 尝试当前盐值解密
    try {
      return await this._decryptWithSalt(encryptedText, password, salt);
    } catch (_) {}
    // 回退到旧固定盐值（兼容升级前加密的数据）
    if (salt !== this._legacySalt) {
      try {
        return await this._decryptWithSalt(encryptedText, password, this._legacySalt);
      } catch (_) {}
    }
    // 均失败：可能是未加密的旧数据
    (loggers.services || console).warn("解密失败，返回原文（可能是未加密的旧数据）");
    return encryptedText;
  }

  async _decryptWithSalt(encryptedText, password, salt) {
    const key = await this.deriveKey(password, salt);
    const combined = new Uint8Array(
      atob(encryptedText)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  // 输入验证 - XSS防护
  sanitizeInput(input) {
    if (typeof input !== "string") return "";

    // 移除危险字符和标签
    return input
      .replace(/[<>"'`]/g, function (match) {
        const map = {
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "`": "&#x60;",
        };
        return map[match];
      })
      .trim()
      .substring(0, 10000); // 限制最大长度
  }

  // API请求体清理（不转义HTML实体，保留原始字符如 < > " ' 等）
  sanitizeForApi(input) {
    if (typeof input !== "string") return "";

    // 仅去除不可见控制字符（保留换行/制表符），限制长度
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim()
      .substring(0, 10000);
  }

  // 验证API密钥格式
  validateApiKey(key, type = "generic") {
    if (!key || typeof key !== "string") return false;

    key = key.trim();

    switch (type) {
      case "openai":
        // OpenAI: 以sk-开头
        return key.startsWith("sk-") && key.length > 20;
      case "deepseek":
        // DeepSeek: 以sk-开头或其他格式，长度至少20
        return key.length >= 20;
      case "google":
        // Google: 长度通常39字符
        return key.length >= 20 && key.length <= 100;
      default:
        return key.length >= 10;
    }
  }

  // 验证文件大小
  validateFileSize(size, maxSizeMB = 10) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return size <= maxBytes;
  }

  // 验证XML内容
  validateXMLContent(content) {
    if (!content || typeof content !== "string") return false;
    if (content.length > 50 * 1024 * 1024) return false; // 50MB限制

    // 检查是否包含XML特征
    return content.trim().startsWith("<") && content.includes(">");
  }
}

// 创建全局安全工具实例
const securityUtils = new SecurityUtils();
