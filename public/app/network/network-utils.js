// ==================== 网络请求工具 ====================

class NetworkUtils {
  constructor() {
    this.defaultTimeout = 30000; // 30秒超时
    this.activeRequests = new Map(); // 跟踪活动请求
  }

  // 带超时和取消支持的fetch
  async fetchWithTimeout(url, options = {}, timeout = this.defaultTimeout) {
    const controller = new AbortController();
    const requestId = Math.random().toString(36);

    let didTimeout = false;

    // 设置超时
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      console.log("请求超时:", url);
    }, timeout);

    // 记录请求
    this.activeRequests.set(requestId, controller);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      if (error.name === "AbortError") {
        if (didTimeout) {
          const err = new Error("请求超时");
          err.code = "TIMEOUT";
          err.isTimeout = true;
          err.url = url;
          throw err;
        }
        const err = new Error("用户取消");
        err.name = "AbortError";
        err.code = "USER_CANCELLED";
        err.url = url;
        throw err;
      }
      throw error;
    }
  }

  // 取消所有活动请求
  cancelAll() {
    console.log("取消所有活动请求:", this.activeRequests.size);
    this.activeRequests.forEach((controller) => {
      controller.abort();
    });
    this.activeRequests.clear();
  }

  // 验证请求体积大小
  validateRequestSize(data, maxSizeKB = 500) {
    const size = new Blob([JSON.stringify(data)]).size;
    const maxBytes = maxSizeKB * 1024;

    if (size > maxBytes) {
      throw new Error(
        `请求体积过大: ${(size / 1024).toFixed(2)}KB, 最大允许: ${maxSizeKB}KB`
      );
    }

    return true;
  }
}

// 创建全局网络工具实例
const networkUtils = new NetworkUtils();
