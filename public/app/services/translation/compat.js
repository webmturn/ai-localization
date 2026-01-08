TranslationService.prototype.cancelAll = function () {
  if (
    typeof networkUtils !== "undefined" &&
    networkUtils &&
    typeof networkUtils.cancelAll === "function"
  ) {
    networkUtils.cancelAll();
  }
};

try {
  Object.defineProperty(TranslationService.prototype, "activeRequests", {
    get: function () {
      return typeof networkUtils !== "undefined" && networkUtils
        ? networkUtils.activeRequests
        : undefined;
    },
    configurable: true,
  });
} catch (e) {
  // ignore
}
