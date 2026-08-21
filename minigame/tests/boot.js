// boot.js —— 测试引导(须在 wx-shim.js 之后、被测代码之前加载)
// 1) 以"微信 require"方式加载真实 adapter(与 smoketest.html 同手法:new Function 包装 CJS);
// 2) 包装 adapter 的 makeVirtualEl/registerElement,把虚拟元素登记到 window.__registry;
// 3) 让浏览器 document.getElementById 先查虚拟元素,再回落真实 DOM。
//    这样 game.js / ui.js 里 `document.getElementById('hud')` 在浏览器里也能命中虚拟元素,
//    与微信环境(adapter 安装 shim document)行为等价。
(function () {
  'use strict';
  window.__registry = window.__registry || {};

  // 1) 同步加载 adapter
  var code = null;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../adapter/weapp-adapter.js', false);
    xhr.send();
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('adapter HTTP ' + xhr.status);
    code = xhr.responseText;
  } catch (e) {
    window.__bootError = 'adapter load failed: ' + (e && e.message || e);
  }
  if (code) {
    var mod = { exports: {} };
    var fn;
    try { fn = new Function('module', 'exports', 'require', code); }
    catch (e) { window.__bootError = 'adapter parse failed: ' + (e && e.message || e); }
    if (fn) {
      try {
        fn(mod, mod.exports, function (id) { throw new Error('adapter 不应 require 其他模块: ' + id); });
      } catch (e) {
        window.__bootError = 'adapter eval failed: ' + (e && e.message || e);
      }
    }
  }
  window.__weapp = window.__weapp || (mod && mod.exports) || null;
  if (!window.__weapp || typeof window.__weapp.makeVirtualEl !== 'function') {
    window.__bootError = window.__bootError || 'adapter exports missing makeVirtualEl';
  }

  // 2)+3) 虚拟元素登记与寻址
  if (window.__weapp) {
    var origMake = window.__weapp.makeVirtualEl;
    window.__weapp.makeVirtualEl = function (id) {
      var el = origMake(id);
      window.__registry[id] = el;
      return el;
    };
    var origReg = window.__weapp.registerElement;
    window.__weapp.registerElement = function (id, el) {
      window.__registry[id] = el;
      return origReg(id, el);
    };
    var realGet = document.getElementById.bind(document);
    document.getElementById = function (id) {
      if (Object.prototype.hasOwnProperty.call(window.__registry, id)) return window.__registry[id];
      return realGet(id);
    };
  }
})();
