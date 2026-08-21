// game.js —— 微信小游戏入口(build.js 生成;源 = game.template.js + build_src/)
// 架构:上屏 canvas → three.js WebGL;UI 画在离屏 2D canvas → CanvasTexture 贴入 HUD 场景叠加渲染
'use strict';
const adapter = require('./adapter/weapp-adapter.js');
const screenCanvas = adapter.canvas; // 上屏,WebGL

// 尽早注册全局错误回调:真机启动失败不再"打不开/黑屏",而是弹窗给出原因。
// wx.onError 捕获未捕获异常,wx.onUnhandledRejection 捕获未处理 Promise 拒绝。
function __fatal(title, msg) {
  try {
    wx.showModal({
      title: title,
      content: String(msg).slice(0, 300),
      showCancel: false,
    });
  } catch (e) { /* 弹窗失败则静默 */ }
}
try {
  wx.onError((msg) => __fatal('运行错误', msg));
  wx.onUnhandledRejection && wx.onUnhandledRejection((res) => __fatal('异步错误', (res && (res.reason || res.message)) || res));
} catch (e) { /* 旧基础库无此 API 则忽略 */ }

const sys = wx.getSystemInfoSync();
const DPR = sys.pixelRatio || 2;
screenCanvas.width = sys.screenWidth * DPR;
screenCanvas.height = sys.screenHeight * DPR;

// [BUNDLE_HERE]

// ---------- UI(离屏 2D) ----------
const ui = createUI(sys.screenWidth, sys.screenHeight, DPR);

// ---------- HUD 场景(CanvasTexture 叠加层) ----------
const uiTex = new THREE.CanvasTexture(ui.canvas);
uiTex.colorSpace = THREE.SRGBColorSpace;
const hudScene = new THREE.Scene();
const hudCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
const hudPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: uiTex, transparent: true, depthTest: false, depthWrite: false })
);
hudPlane.position.z = -0.5;
hudPlane.scale.set(1, screenCanvas.height / screenCanvas.width, 1); // 全屏铺满:宽=1,高按纵横比
hudScene.add(hudPlane);

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ canvas: screenCanvas, antialias: true });
renderer.setPixelRatio(1); // 已手动乘 DPR
renderer.setSize(screenCanvas.width, screenCanvas.height, false);
renderer.autoClear = false;

// ---------- 游戏对象 ----------
const world = createWorld();
const ox = createOx();
world.scene.add(ox.root);
const track = createTrack();
world.scene.add(track.group);
const items = createItems();
world.scene.add(items.group);
const dust = createDust(world.scene);

const player = createPlayer(
  items,
  (it) => {
    game.state.coins += 1;
    items.stats.collected++;
    if (it.type === 'bell') { sfx.bell(); game.addEnergy(CONFIG.energy.bell); sfx.bellVoice(); }
    else { sfx.collect(); game.addEnergy(CONFIG.energy.hay); sfx.hayFunny(); }
  },
  (it) => { if (game.isRunning()) game.gameover(player); },
  (it) => { if (game.isRunning()) game.smash(it); }
);
const game = createGame(world, ox, track, items, player);

// ---------- 开始/重开/妈妈 ----------
function startGame() {
  initAudio();
  dust.reset();
  game.start(player);
}
ui.els['btn-start']._onclick = () => startGame();
ui.els['btn-restart']._onclick = () => startGame();
ui.els['btn-mama']._onclick = () => { initAudio(); if (game.isRunning()) game.tryMama(); };

// ---------- 触摸控制 ----------
let tx = 0, ty = 0, tT = 0;
wx.onTouchStart((e) => {
  const t0 = e.touches[0];
  tx = t0.x; ty = t0.y; tT = Date.now();
});
wx.onTouchEnd((e) => {
  const t0 = e.changedTouches[0];
  const x = t0.x, y = t0.y;
  if (ui.onTap(x, y)) return; // 命中 UI 按钮
  if (game.isRunning()) {
    const dx = x - tx, dy = y - ty;
    if (Date.now() - tT > 600) return;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { initAudio(); player.jump(); sfx.jump(); sfx.jumpVoice(); return; }
    if (Math.abs(dx) > Math.abs(dy)) player.moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) { initAudio(); player.jump(); sfx.jump(); sfx.jumpVoice(); }
    else { initAudio(); player.slide(); sfx.slide(); }
  }
});

// ---------- 生命周期 ----------
wx.onShow(() => {});
wx.onHide(() => {});

// ---------- 主循环 ----------
const clock = { last: Date.now() };
function frame() {
  const now = Date.now();
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;
  const t = now / 1000;

  world.update(dt, t, game.state.lastDz);
  game.update(dt, t, player, dust);

  renderer.clear();
  renderer.render(world.scene, world.camera);
  ui.render(t);
  uiTex.needsUpdate = true;
  renderer.render(hudScene, hudCam);

  requestAnimationFrame(frame);
}
frame();
