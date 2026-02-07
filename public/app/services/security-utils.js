// ==================== 安全工具模块 ====================

// 简单的加密工具类（使用Web Crypto API）
class SecurityUtils {
  constructor() {
    this.salt = "xml-translator-v1"; // 固定盐值，生产环境应使用随机生成
  }

  // 生成密钥
  async deriveKey(password) {
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
        salt: enc.encode(this.salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // 加密文本
  async encrypt(text, password = "default-key") {
    try {
      const key = await this.deriveKey(password);
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

      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      (loggers.services || console).error("加密失败:", error);
      return text; // 加密失败时返回原文（降级处理）
    }
  }

  // 解密文本
  async decrypt(encryptedText, password = "default-key") {
    try {
      const key = await this.deriveKey(password);
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
    } catch (error) {
      (loggers.services || console).error("解密失败:", error);
      return encryptedText; // 解密失败时返回原文（兼容旧数据）
    }
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
