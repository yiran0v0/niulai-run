// main.js —— 引导 / 主循环 / 输入绑定 / 自检
// Loop Engineering：window.__game 暴露运行状态；?t=1 时隐藏标题、
// 自动开局，selftest 用无渲染模拟验证操控、碰撞、状态机与重开。
import * as THREE from '../vendor/three.module.js';
import { createWorld } from './world.js';
import { createOx } from './ox.js';
import { createTrack } from './track.js';
import { createItems } from './items.js';
import { createPlayer, bindControls } from './player.js';
import { createGame } from './game.js';
import { sfx, initAudio } from './audio.js';
import { createDust } from './particles.js';
import { CONFIG } from './config.js';

window.__gameErrors = [];
window.addEventListener('error', (e) => {
  window.__gameErrors.push(String(e.message || e));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__gameErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason));
});

const canvas = document.getElementById('game');
const qParams = new URLSearchParams(location.search);
// 自检/headless 模式用 pixelRatio 1，加速 SwiftShader 软渲染
const isTest = qParams.has('t');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTest });
renderer.setPixelRatio(isTest ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

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
    if (it.type === 'bell') { sfx.bell(); sfx.bellVoice(); game.addEnergy(CONFIG.energy.bell); }
    else { sfx.collect(); sfx.hayFunny(); game.addEnergy(CONFIG.energy.hay); }
  },
  (it) => { if (game.isRunning()) game.gameover(player); },
  (it) => { if (game.isRunning()) game.smash(it); }
);
const game = createGame(world, ox, track, items, player);

window.__game = {
  get state() { return game.state.state; },
  get score() { return Math.floor(game.state.score); },
  get coins() { return game.state.coins; },
  get dist() { return game.state.dist; },
  get speed() { return game.state.speed; },
  frames: 0, drawCalls: 0,
};

// ---------- 界面与输入 ----------
function startGame() {
  initAudio();
  dust.reset();
  game.start(player);
}
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
const btnMama = document.getElementById('btn-mama');
btnMama.addEventListener('click', () => { initAudio(); if (game.isRunning()) game.tryMama(); });
btnMama.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); if (game.isRunning()) game.tryMama(); }, { passive: false });
bindControls({
  left: () => game.isRunning() && player.moveLane(-1),
  right: () => game.isRunning() && player.moveLane(1),
  jump: () => { if (game.isRunning()) { initAudio(); player.jump(); sfx.jump(); } },
  slide: () => { if (game.isRunning()) { initAudio(); player.slide(); sfx.slide(); } },
  mama: () => { initAudio(); if (game.isRunning()) game.tryMama(); },
});

addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  world.camera.aspect = window.innerWidth / window.innerHeight;
  world.camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = performance.now() / 1000;
  world.update(dt, t, game.state.lastDz);
  game.update(dt, t, player, dust);
  renderer.render(world.scene, world.camera);
  window.__game.frames++;
  window.__game.drawCalls = renderer.info.render.calls;
  requestAnimationFrame(frame);
}
frame();

// ---------- 自检模式：?t=1 ----------
if (isTest) {
  // 隐藏标题面板直接展示场景；测试视口
  const st = document.getElementById('screen-start');
  if (st) st.style.display = 'none';
  if (qParams.get('view') === 'side') {
    world.cameraOverride = { pos: [5.5, 2.0, -3.0], look: [0, 1.0, 0] };
  }
  // 自动开局，截图能看到跑动中的 HUD
  setTimeout(() => game.start(player), 250);

  setTimeout(() => {
    const g = window.__game;
    const out = { errors: window.__gameErrors, frames: g.frames, drawCalls: g.drawCalls, webgl: !!renderer.getContext() };

    // ---- 无渲染模拟：操控 / 推进 / 碰撞 / 重开 ----
    try {
      game.start(player);
      let simT = 0, jumped = false, slid = false, laneSwitched = false;
      for (let i = 0; i < 900; i++) {
        simT += 1 / 60;
        if (i === 30) { player.jump(); jumped = player.state.vy > 0; }
        if (i === 90) { player.moveLane(-1); }
        if (i === 120) { player.moveLane(1); laneSwitched = Math.abs(player.state.x - 0) < 3; }
        if (i === 150) { player.slide(); slid = player.state.sliding > 0; }
        game.update(1 / 60, simT, player);
        if (game.state.state === 'GAMEOVER') break; // 被随机障碍撞死也算流程正确，但记录
      }
      out.sim = {
        state: game.state.state,
        dist: +game.state.dist.toFixed(1),
        speed: +game.state.speed.toFixed(1),
        jumped, slid, laneSwitched,
      };

      // ---- 碰撞单元测试：假障碍放在脸上 ----
      game.start(player);
      player.state.lane = 1; player.state.x = 0;
      items.active.length = 0;
      items.active.push({ type: 'stump', node: { position: { y: 0 }, rotation: { y: 0 } }, x: 0, z: 0, w: 1.2, h: 0.9, d: 1.2, ground: true, deadly: true });
      game.update(1 / 60, 1, player);
      out.collisionHit = game.state.state === 'GAMEOVER';

      // ---- 收集单元测试 ----
      game.start(player);
      items.active.length = 0;
      items.active.push({ type: 'hay', node: { position: { y: 0.35 }, rotation: { y: 0 } }, x: 0, z: 0, w: 0.7, h: 0.7, d: 0.7, ground: false, lowY: 0, collectible: true, spin: true });
      game.update(1 / 60, 2, player);
      out.collectOk = game.state.coins === 1 && items.active.length === 0;

      // ---- 妈妈技能单元测试：攒能量 → 触发冲刺 → 撞碎障碍不死亡 ----
      game.start(player);
      game.addEnergy(100);
      out.mamaTrigger = game.tryMama() === true && game.state.dash > 0;
      items.active.length = 0;
      items.active.push({ type: 'stump', node: { position: { y: 0 }, rotation: { y: 0 } }, x: 0, z: 0, w: 1.2, h: 0.9, d: 1.2, ground: true, deadly: true });
      game.update(1 / 60, 3, player);
      out.mamaSmash = game.state.state === 'RUNNING' && items.active.length === 0 && game.state.bonus >= CONFIG.dash.smashBonus;

      // ---- 重开 ----
      game.start(player);
      out.restartOk = game.state.state === 'RUNNING' && game.state.dist < 1;
    } catch (err) {
      out.simError = String(err && err.message || err);
    }

    out.pass = out.errors.length === 0 && out.frames > 3 && out.drawCalls > 0
      && out.sim && out.sim.dist > 60 && out.sim.jumped && out.sim.slid
      && out.collisionHit && out.collectOk && out.mamaTrigger && out.mamaSmash && out.restartOk && !out.simError;
    document.getElementById('selftest').textContent = 'SELFTEST:' + JSON.stringify(out);
    console.log('SELFTEST ' + JSON.stringify(out));
  }, 900);
}
