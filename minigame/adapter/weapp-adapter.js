// weapp-adapter.js —— 微信小游戏环境适配层
// 模拟浏览器全局:window/document/Image/canvas/addEventListener/fetch/AudioContext
// 使 three.js 与现有 H5 游戏代码在小游戏环境直接运行。
// 参考微信官方 weapp-adapter 思想,针对本项目定制。

// ---------- 基础常量(部分小游戏环境未实现) ----------
if (typeof GLOBAL === 'undefined') var GLOBAL = globalThis;
if (typeof WINDOW === 'undefined') var WINDOW = globalThis;
// 真正的全局对象:微信小游戏为 GameGlobal(真机/开发者工具),浏览器为 globalThis
var _global = (typeof GameGlobal !== 'undefined') ? GameGlobal : globalThis;

// 小游戏基础库提供:wx, setTimeout, setInterval, requestAnimationFrame, performance, console

// ---------- 事件系统(canvas/element 通用) ----------
class WeappEventTarget {
  constructor() { this._listeners = {}; }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    const arr = this._listeners[type];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  dispatchEvent(evt) {
    const arr = this._listeners[evt.type];
    if (!arr) return true;
    // touch 事件带 touches/changedTouches;键盘事件直接透传
    for (const fn of arr.slice()) {
      try { fn(evt); } catch (e) { console.error('[adapter] listener error', e); }
    }
    return true;
  }
}

// ---------- Canvas ----------
function createCanvas() {
  const c = wx.createCanvas();
  // first canvas = 上屏 canvas
  const wrapped = c;
  if (!wrapped.addEventListener) {
    wrapped.addEventListener = WeappEventTarget.prototype.addEventListener.bind(wrapped);
    wrapped.removeEventListener = WeappEventTarget.prototype.removeEventListener.bind(wrapped);
    wrapped.dispatchEvent = WeappEventTarget.prototype.dispatchEvent.bind(wrapped);
  }
  // three.js 需要 clientWidth/clientHeight
  if (wrapped.clientWidth === undefined) {
    Object.defineProperty(wrapped, 'clientWidth', {
      get() { return wrapped.width; },
    });
    Object.defineProperty(wrapped, 'clientHeight', {
      get() { return wrapped.height; },
    });
  }
  if (!wrapped.style) wrapped.style = {};
  if (!wrapped.getBoundingClientRect) {
    wrapped.getBoundingClientRect = () => ({ left: 0, top: 0, width: wrapped.width, height: wrapped.height, right: wrapped.width, bottom: wrapped.height });
  }
  return wrapped;
}

const canvas = createCanvas(); // 上屏 canvas:本项目交给 three.js 作 WebGL 渲染目标

// 离屏 2D canvas:UI 层绘制目标(再以 CanvasTexture 贴入 HUD 场景)
function createUICanvas() {
  return createCanvas();
}

// WebGL 离屏 canvas(备用;当前架构未用)
function createGLCanvas() {
  return createCanvas();
}

// ---------- Image ----------
function createImage() {
  return wx.createImage();
}

// ---------- document shim ----------
const document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas();
    if (tag === 'img' || tag === 'image') return createImage();
    // 通用 element:支持基础样式/文本,由 UI 层接管,不真正渲染
    return {
      tagName: tag.toUpperCase(),
      style: {},
      textContent: '',
      innerHTML: '',
      children: [],
      addEventListener() {}, removeEventListener() {},
      appendChild() {}, remove() {},
      setAttribute() {}, getContext: null,
    };
  },
  getElementById(id) { return elementRegistry[id] || null; },
  createElementNS(ns, tag) { return this.createElement(tag); },
  addEventListener(type, fn) { _global.addEventListener(type, fn); },
  removeEventListener(type, fn) { _global.removeEventListener(type, fn); },
  body: { appendChild() {}, removeChild() {}, style: {} },
  documentElement: { style: {} },
};

// 游戏 UI 层注册"伪 DOM 元素":game.js 通过 getElementById 读写它们,
// UI 层(canvas 绘制)轮询这些对象的状态来绘制。
const elementRegistry = {};
function registerElement(id, el) { elementRegistry[id] = el; }
function makeVirtualEl(id) {
  const el = {
    id,
    style: {},
    textContent: '',
    classList: {
      _set: new Set(),
      add(...cs) { cs.forEach(c => this._set.add(c)); },
      remove(...cs) { cs.forEach(c => this._set.delete(c)); },
      toggle(c, force) {
        if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else force ? this._set.add(c) : this._set.delete(c);
      },
      contains(c) { return this._set.has(c); },
    },
    addEventListener(type, fn) {
      if (type === 'click') el._onclick = fn;
    },
  };
  registerElement(id, el);
  return el;
}

// ---------- 全局对象补齐(微信真机/工具全局是 GameGlobal) ----------
const g = _global;
// 基础库 3.x 起 window/document 等属性是只读 getter,直接赋值会抛
// "Cannot set property document of #<Window> which has only a getter"
// 安全写入:先试普通赋值,失败再试 defineProperty,仍失败仅告警不中断。
function forceSet(obj, key, value) {
  if (obj[key] === value) return; // 已是目标值(runtime 内置实现已兼容)
  try { obj[key] = value; } catch (e) { /* 严格模式下 getter-only 赋值会抛 */ }
  if (obj[key] === value) return;
  try {
    Object.defineProperty(obj, key, { value, writable: true, configurable: true });
  } catch (e2) {
    console.warn('[adapter] 无法覆盖全局属性 ' + key + '，沿用运行时内置实现:', e2 && e2.message);
  }
}
if (!g.addEventListener) {
  g._winTarget = new WeappEventTarget();
  g.addEventListener = (t, f) => g._winTarget.addEventListener(t, f);
  g.removeEventListener = (t, f) => g._winTarget.removeEventListener(t, f);
  g.dispatchEvent = (e) => g._winTarget.dispatchEvent(e);
}
if (!g.innerWidth) Object.defineProperty(g, 'innerWidth', { get() { return canvas.width; }, configurable: true });
if (!g.innerHeight) Object.defineProperty(g, 'innerHeight', { get() { return canvas.height; }, configurable: true });
if (!g.devicePixelRatio) forceSet(g, 'devicePixelRatio', wx.getSystemInfoSync().pixelRatio || 2);
if (!g.location) forceSet(g, 'location', { search: '', href: '' });
if (!g.URLSearchParams) {
  g.URLSearchParams = class {
    constructor(q) { this._q = String(q || '').replace(/^\?/, ''); }
    has() { return false; }
    get() { return null; }
  };
}
// 强制覆盖:微信运行时的 document/window 可能是残缺桩,必须换成我们的完整 shim
forceSet(g, 'document', document);
forceSet(g, 'createElement', document.createElement);
forceSet(g, 'Image', createImage);
forceSet(g, 'HTMLCanvasElement', class HTMLCanvasElement {});
forceSet(g, 'window', g);
// 双写保险:某些环境 globalThis 与 GameGlobal 不同
try {
  if (globalThis !== g) {
    forceSet(globalThis, 'document', document);
    forceSet(globalThis, 'window', g);
    forceSet(globalThis, 'Image', createImage);
  }
} catch (e) { /* 静默 */ }

// 常用全局兜底:音频节流用 performance.now();three.js 偶查 navigator
if (!g.performance) forceSet(g, 'performance', { now: () => Date.now() });
if (!g.navigator) forceSet(g, 'navigator', { userAgent: '' });

// ---------- touch 事件桥接:wx.onTouch* → 标准 touch 事件 ----------
function wxTouchesToStd(evt) {
  return {
    touches: (evt.touches || []).map(t => ({ clientX: t.x, clientY: t.y, identifier: t.identifier })),
    changedTouches: (evt.changedTouches || []).map(t => ({ clientX: t.x, clientY: t.y, identifier: t.identifier })),
    preventDefault() {}, stopPropagation() {},
  };
}
wx.onTouchStart((evt) => {
  const e = { type: 'touchstart', ...wxTouchesToStd(evt), timeStamp: Date.now() };
  canvas.dispatchEvent(e);
  g.dispatchEvent({ ...e, target: canvas });
});
wx.onTouchEnd((evt) => {
  const e = { type: 'touchend', ...wxTouchesToStd(evt), timeStamp: Date.now() };
  canvas.dispatchEvent(e);
  g.dispatchEvent({ ...e, target: canvas });
});
wx.onTouchMove((evt) => {
  const e = { type: 'touchmove', ...wxTouchesToStd(evt), timeStamp: Date.now() };
  canvas.dispatchEvent(e);
});

// ---------- fetch shim(用于音频采样加载) ----------
if (!g.fetch) {
  g.fetch = async (url) => {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: '/' + String(url).replace(/^\.?\//, ''),
        success: (res) => resolve({
          ok: true, status: 200,
          arrayBuffer: () => Promise.resolve(res.data),
          json: () => Promise.resolve(JSON.parse(res.data)),
        }),
        fail: (err) => resolve({ ok: false, status: 404, arrayBuffer: () => Promise.reject(err) }),
      });
    });
  };
}

// ---------- AudioContext shim ----------
// 优先用 wx.createWebAudioContext(基础库 2.19+),接口与 W3C 基本一致
if (!g.AudioContext && wx.createWebAudioContext) {
  g.AudioContext = function AudioContext() { return wx.createWebAudioContext(); };
}

// ---------- 导出给 game.js(CJS);同时挂 globalThis 供打包后的 ESM 模块访问 ----------
const exports_obj = {
  canvas, document, createCanvas, createUICanvas, createGLCanvas, createImage,
  registerElement, makeVirtualEl,
  WeappEventTarget,
};
globalThis.__weapp = exports_obj;
if (_global !== globalThis) { try { _global.__weapp = exports_obj; } catch (e) {} }
module.exports = exports_obj;
