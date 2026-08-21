// wx-shim.js —— 测试用微信小游戏 API 模拟层（仅测试页面加载）
// 目标:让 minigame/adapter/weapp-adapter.js 与打包后的 game.js 能在浏览器里跑起来,
// 并给测试脚本提供可控的触摸注入(wx._fireTouch)。
//
// 注意:真实微信环境里没有 document;adapter 会安装自己的 document shim。
// 为了让"虚拟元素"(makeVirtualEl/registerElement → document.getElementById)在浏览器里生效,
// 本 shim 的第一行先保存真实 document(__realDoc),随后由 boot 脚本把 window.document
// 置为 undefined,强制 adapter 安装 shim document。测试页自身 DOM 一律走 __realDoc。
window.__realDoc = document;

(function () {
  'use strict';
  var realDoc = window.__realDoc;
  var created = [];            // 所有 createCanvas 产物(首个=上屏)
  var touchHandlers = { start: [], end: [], move: [] };
  var errorLog = [];
  var consoleError = console.error.bind(console);

  // 记录页面错误(含 console.error),供测试断言"零报错"
  function recordError(what) {
    errorLog.push(String(what));
    try { consoleError('[TEST-ERR]', what); } catch (e) { /* ignore */ }
  }
  realDoc.addEventListener('error', function (e) {
    recordError('page-error: ' + String((e && e.message) || e));
  });
  realDoc.defaultView.addEventListener('unhandledrejection', function (e) {
    recordError('rejection: ' + String((e && e.reason && e.reason.message) || (e && e.reason) || e));
  });
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    var s = args.map(String).join(' ');
    // 游戏内联的 console.error 是调试输出,不视为错误;但记入日志供检查
    window.__consoleLog = window.__consoleLog || [];
    window.__consoleLog.push(s);
    consoleError.apply(console, args);
  };

  function makeCanvas(onscreen) {
    var c = realDoc.createElement('canvas');
    if (onscreen) {
      var slot = realDoc.getElementById('canvas-slot');
      if (slot) slot.appendChild(c);
    }
    // adapter 触摸桥会把普通对象 dispatch 到 canvas;原生 dispatchEvent 只收 Event,
    // 这里包装成"普通对象→合成 Event",保证 wx.onTouchStart 桥接不炸
    var nativeDisp = c.dispatchEvent.bind(c);
    c.dispatchEvent = function (evt) {
      if (evt && evt instanceof Event) return nativeDisp(evt);
      var e = new Event(evt && evt.type || 'event');
      for (var k in evt) { if (k !== 'type') { try { e[k] = evt[k]; } catch (err) { /* ignore */ } } }
      return nativeDisp(e);
    };
    return c;
  }

  // 真实微信里 g.dispatchEvent 是 adapter 的 WeappEventTarget(收普通对象);
  // 浏览器 window.dispatchEvent 只收 Event → 同样包装(adapter 桥接会向 window 派发普通对象)
  var nativeWinDisp = realDoc.defaultView.dispatchEvent.bind(realDoc.defaultView);
  realDoc.defaultView.dispatchEvent = function (evt) {
    if (evt && evt instanceof Event) return nativeWinDisp(evt);
    var e = new Event(evt && evt.type || 'event');
    for (var k in evt) { if (k !== 'type') { try { e[k] = evt[k]; } catch (err) { /* ignore */ } } }
    return nativeWinDisp(e);
  };

  // headless 浏览器无用户手势时 AudioContext.resume() 会 reject → 吞掉,避免污染错误计数
  var AC = realDoc.defaultView.AudioContext || realDoc.defaultView.webkitAudioContext;
  if (AC && AC.prototype) {
    var origResume = AC.prototype.resume;
    if (origResume) {
      AC.prototype.resume = function () {
        try {
          var p = origResume.apply(this, arguments);
          if (p && typeof p.catch === 'function') p.catch(function () {});
          return p;
        } catch (e) { return Promise.resolve(); }
      };
    }
  }

  window.wx = {
    _created: created,
    _touchHandlers: touchHandlers,
    _errors: errorLog,
    createCanvas: function () {
      var c = makeCanvas(created.length === 0);
      created.push(c);
      return c;
    },
    createImage: function () { return realDoc.createElement('img'); },
    getSystemInfoSync: function () {
      // 测试统一用小屏 + dpr 1,降低 SwiftShader 软渲染开销
      return { screenWidth: 360, screenHeight: 640, pixelRatio: 1 };
    },
    onTouchStart: function (fn) { touchHandlers.start.push(fn); },
    onTouchEnd: function (fn) { touchHandlers.end.push(fn); },
    onTouchMove: function (fn) { touchHandlers.move.push(fn); },
    getFileSystemManager: function () {
      return {
        readFile: function (opts) {
          var url = String(opts.filePath || '').replace(/^\//, '');
          realDoc.defaultView.fetch(url).then(function (r) {
            if (!r.ok) { if (opts.fail) opts.fail(new Error('404 ' + url)); return; }
            r.arrayBuffer().then(function (buf) {
              if (opts.success) opts.success({ data: buf });
            }).catch(function (e) { if (opts.fail) opts.fail(e); });
          }).catch(function (e) { if (opts.fail) opts.fail(e); });
        },
      };
    },
    createWebAudioContext: function () {
      var AC = realDoc.defaultView.AudioContext || realDoc.defaultView.webkitAudioContext;
      return AC ? new AC() : null;
    },
    onShow: function () {},
    onHide: function () {},
    onError: function (fn) { realDoc.defaultView.addEventListener('error', fn); },
    // ---- 测试注入:模拟一次触摸事件(走 wx.onTouch* 注册的真实链路) ----
    _fireTouch: function (type, touches, changedTouches) {
      var evt = {
        touches: (touches || []).map(function (t) { return { x: t.x, y: t.y, identifier: t.identifier || 1 }; }),
        changedTouches: (changedTouches || []).map(function (t) { return { x: t.x, y: t.y, identifier: t.identifier || 1 }; }),
      };
      (touchHandlers[type] || []).forEach(function (fn) {
        try { fn(evt); } catch (e) { recordError('wx touch handler error: ' + (e && e.message || e)); }
      });
    },
    // 便捷:完整一次点按(start+end 同坐标)
    _tap: function (x, y) {
      window.wx._fireTouch('start', [{ x: x, y: y }], []);
      window.wx._fireTouch('end', [], [{ x: x, y: y }]);
    },
    // 便捷:一次滑动(start→end)
    _swipe: function (x0, y0, x1, y1) {
      window.wx._fireTouch('start', [{ x: x0, y: y0 }], []);
      window.wx._fireTouch('move', [{ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }], []);
      window.wx._fireTouch('end', [], [{ x: x1, y: y1 }]);
    },
  };
})();
