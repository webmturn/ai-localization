// ==================== 通用确认/输入对话框 ====================
// 替换原生 prompt()/confirm()：统一模态框体验，支持深色模式与键盘交互
// 用法：
//   showConfirmDialog({ title, message, confirmText, cancelText, danger }) -> Promise<boolean>
//   showPromptDialog({ title, message, defaultValue, placeholder, validate }) -> Promise<string|null>
(function () {
  var App = (window.App = window.App || {});
  App.ui = App.ui || {};

  var _active = false;        // 防重入：同一时间只允许一个对话框
  var _resolver = null;       // 当前 Promise resolver
  var _previousFocus = null;  // 打开前焦点元素
  var _mode = "confirm";      // "confirm" | "prompt"
  var _validate = null;       // prompt 校验函数

  function __el(id) {
    try {
      return typeof DOMCache !== "undefined" && DOMCache.get
        ? DOMCache.get(id)
        : document.getElementById(id);
    } catch (e) {
      return document.getElementById(id);
    }
  }

  function __setText(id, text) {
    var el = __el(id);
    if (el) el.textContent = text == null ? "" : String(text);
  }

  function __close(result) {
    if (!_active) return;
    _active = false;
    var dialog = __el("confirmDialog");
    if (dialog) dialog.classList.add("hidden");
    var input = __el("confirmDialogInput");
    if (input) input.value = "";
    var errEl = __el("confirmDialogError");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    var resolver = _resolver;
    _resolver = null;
    _mode = "confirm";
    _validate = null;
    // 恢复焦点
    if (_previousFocus && typeof _previousFocus.focus === "function") {
      try { _previousFocus.focus(); } catch (e) {}
    }
    _previousFocus = null;
    if (resolver) resolver(result);
  }

  function __submit() {
    if (_mode === "prompt") {
      var input = __el("confirmDialogInput");
      var raw = input ? input.value : "";
      if (_validate) {
        var errMsg = null;
        try { errMsg = _validate(raw); } catch (e) { errMsg = String(e && e.message || e); }
        if (errMsg) {
          var errEl = __el("confirmDialogError");
          if (errEl) {
            errEl.textContent = String(errMsg);
            errEl.classList.remove("hidden");
          }
          try { input && input.focus(); } catch (e) {}
          return;
        }
      }
      __close(raw);
    } else {
      __close(true);
    }
  }

  function __setup(dialog, okBtn, cancelBtn, input, errEl) {
    if (!dialog || dialog.dataset.confirmBound === "1") return;
    dialog.dataset.confirmBound = "1";

    var onClickOk = function () { __submit(); };
    var onClickCancel = function () { __close(_mode === "prompt" ? null : false); };
    var onKeydown = function (e) {
      if (!_active) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        __close(_mode === "prompt" ? null : false);
      } else if (e.key === "Enter") {
        // 输入模式下 Enter 提交；确认模式下 Enter 也视为确定
        if (e.target && (e.target.id === "confirmDialogInput" || e.target.id === "confirmDialogOk")) {
          e.preventDefault();
          __submit();
        }
      }
    };

    if (typeof EventManager !== "undefined" && EventManager.add) {
      EventManager.add(okBtn, "click", onClickOk, {
        tag: "ui", scope: "confirmDialog", label: "confirmDialogOk:click",
      });
      EventManager.add(cancelBtn, "click", onClickCancel, {
        tag: "ui", scope: "confirmDialog", label: "confirmDialogCancel:click",
      });
    } else {
      okBtn.addEventListener("click", onClickOk);
      cancelBtn.addEventListener("click", onClickCancel);
    }
    document.addEventListener("keydown", onKeydown);
    // 关闭后清理键盘监听
    dialog.addEventListener(
      "click",
      function (e) {
        if (e.target === dialog) __close(_mode === "prompt" ? null : false);
      },
      { once: true }
    );
    // 记录清理函数（当前实现依赖 EventManager 的 scope 去重，keydown 监听保留但由 _active 门控）
  }

  function __openDialog(opts) {
    var dialog = __el("confirmDialog");
    var okBtn = __el("confirmDialogOk");
    var cancelBtn = __el("confirmDialogCancel");
    var input = __el("confirmDialogInput");
    var errEl = __el("confirmDialogError");
    if (!dialog || !okBtn || !cancelBtn) {
      // 对话框 DOM 缺失时降级为原生 confirm/prompt，保证功能可用
      if (_mode === "prompt") {
        var fallback = window.prompt ? window.prompt(opts.message || "", opts.defaultValue || "") : null;
        _resolver = null;
        return Promise.resolve(fallback == null ? null : String(fallback));
      }
      var ok = window.confirm ? window.confirm(opts.message || "") : false;
      _resolver = null;
      return Promise.resolve(!!ok);
    }

    _previousFocus = document.activeElement;

    __setText("confirmDialogTitle", opts.title || (opts.danger ? "确认操作" : "提示"));
    __setText("confirmDialogMessage", opts.message || "");
    okBtn.textContent = opts.confirmText || "确定";
    cancelBtn.textContent = opts.cancelText || "取消";
    if (opts.danger) {
      okBtn.className =
        "px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm";
    } else {
      okBtn.className =
        "px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90";
    }

    if (_mode === "prompt") {
      input.classList.remove("hidden");
      input.placeholder = opts.placeholder || "";
      input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
      errEl.classList.add("hidden");
      errEl.textContent = "";
    } else {
      input.classList.add("hidden");
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }

    __setup(dialog, okBtn, cancelBtn, input, errEl);
    dialog.classList.remove("hidden");
    _active = true;

    // 聚焦
    setTimeout(function () {
      try {
        if (_mode === "prompt") input.focus();
        else okBtn.focus();
      } catch (e) {}
    }, 30);

    return new Promise(function (resolve) {
      _resolver = resolve;
    });
  }

  /**
   * 确认对话框
   * @param {Object} opts { title, message, confirmText, cancelText, danger }
   * @returns {Promise<boolean>}
   */
  function showConfirmDialog(opts) {
    opts = opts || {};
    _mode = "confirm";
    return __openDialog(opts);
  }

  /**
   * 输入对话框
   * @param {Object} opts { title, message, defaultValue, placeholder, validate }
   *   validate: (value: string) => string|null|undefined （返回错误信息则阻止提交）
   * @returns {Promise<string|null>}
   */
  function showPromptDialog(opts) {
    opts = opts || {};
    _mode = "prompt";
    _validate = typeof opts.validate === "function" ? opts.validate : null;
    return __openDialog(opts);
  }

  App.ui.showConfirmDialog = showConfirmDialog;
  App.ui.showPromptDialog = showPromptDialog;
  window.showConfirmDialog = showConfirmDialog;
  window.showPromptDialog = showPromptDialog;
})();
