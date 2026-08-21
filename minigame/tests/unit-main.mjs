// unit-main.mjs —— 微信小游戏版单元测试
// 直接 import build_src/ 下的真实源码模块(与打包进 game.js 的代码同源),
// 覆盖:adapter / CONFIG / player 物理碰撞 / items 生成与对象池 / game 状态机 / ui 虚拟元素与命中 / 渲染模块冒烟。
import * as THREE from '../build_src/vendor/three.module.js';
import { CONFIG } from '../build_src/js/config.js';
import { createPlayer } from '../build_src/js/player.js';
import { createItems } from '../build_src/js/items.js';
import { createGame } from '../build_src/js/game.js';
import { createUI } from '../build_src/js/ui.js';
import { createWorld } from '../build_src/js/world.js';
import { createOx } from '../build_src/js/ox.js';
import { createTrack } from '../build_src/js/track.js';
import { createDust } from '../build_src/js/particles.js';

const T = window.__T;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 虚拟元素工具(等价于 ui.js 初始化的 13 个 id) ----------
function mkElements() {
  const ids = [
    'hud', 'screen-start', 'screen-over', 'btn-start', 'btn-restart', 'btn-mama',
    'mama-fill', 'hud-score', 'hud-dist', 'hud-coins', 'over-dist', 'over-coins', 'over-score',
  ];
  for (const id of ids) window.__weapp.makeVirtualEl(id);
}

// ============ 0. 引导自检 ============
T.section('boot');
T.t('adapter 加载无 bootError', !window.__bootError, window.__bootError || '');
T.t('__weapp 已导出', !!window.__weapp);
T.t('__weapp.canvas 存在', !!window.__weapp.canvas);
T.eq('首个 wx canvas 即上屏 canvas', window.wx._created[0] === window.__weapp.canvas, true);

// ============ 1. adapter:虚拟元素与事件桥 ============
T.section('adapter');
{
  const el = window.__weapp.makeVirtualEl('test-foo');
  T.t('makeVirtualEl 注册进 registry', window.__registry['test-foo'] === el);
  T.t('document.getElementById 命中虚拟元素', document.getElementById('test-foo') === el);
  T.eq('style 初始为空对象', JSON.stringify(el.style), '{}');
  el.classList.add('a'); el.classList.add('b');
  T.t('classList add/contains', el.classList.contains('a') && el.classList.contains('b'));
  el.classList.remove('a');
  T.t('classList remove', !el.classList.contains('a'));
  el.classList.toggle('c', true);
  T.t('classList toggle(force=true)', el.classList.contains('c'));
  el.classList.toggle('c', false);
  T.t('classList toggle(force=false)', !el.classList.contains('c'));
  el.classList.toggle('d');
  T.t('classList toggle(无 force) 翻转', el.classList.contains('d'));
  el.textContent = '42';
  T.eq('textContent 可读写', el.textContent, '42');

  // 触摸桥:wx.onTouchStart(adapter 注册的桥)→ 上屏 canvas dispatchEvent → 页面监听
  // (adapter 把触摸派发到它自己的上屏 canvas,即 __weapp.canvas)
  const c = window.__weapp.canvas;
  let got = null;
  c.addEventListener('touchstart', (e) => {
    const t0 = e.touches && e.touches[0];
    got = t0 ? { x: t0.clientX, y: t0.clientY } : null;
  });
  window.wx._fireTouch('start', [{ x: 33, y: 77 }], []);
  T.eq('触摸桥 clientX 映射', got && got.x, 33);
  T.eq('触摸桥 clientY 映射', got && got.y, 77);
}

// ============ 2. CONFIG 不变量 ============
T.section('config');
{
  T.eq('三车道', CONFIG.lanes.length, 3);
  T.eq('laneCount=3', CONFIG.laneCount, 3);
  T.t('maxSpeed > baseSpeed', CONFIG.maxSpeed > CONFIG.baseSpeed);
  T.t('加速度为正', CONFIG.accel > 0);
  T.eq('能量上限 100', CONFIG.energy.max, 100);
  T.eq('开局满能量', CONFIG.energy.start, 100);
  T.t('冲刺参数合法', CONFIG.dash.time > 0 && CONFIG.dash.speed > CONFIG.maxSpeed && CONFIG.dash.smashBonus > 0);
}

// ============ 3. player:操控 / 物理 / 碰撞 ============
T.section('player');
{
  function stubItems() {
    return {
      active: [],
      removeAt(i) { this.active.splice(i, 1); },
      update() {}, reset() {},
    };
  }
  let hit = 0, collect = 0, smash = 0;
  const items = stubItems();
  const player = createPlayer(items, () => collect++, () => hit++, () => smash++);
  const P = player.state;

  // 初始状态
  T.eq('初始车道=1', P.lane, 1);
  T.t('初始在地面', P.onGround);
  T.eq('初始 sliding=0', P.sliding, 0);
  T.t('初始存活', P.alive);

  // 换道夹紧
  player.moveLane(1); T.eq('右移→车道2', P.lane, 2);
  player.moveLane(1); T.eq('再右移被夹在车道2', P.lane, 2);
  player.moveLane(-1); player.moveLane(-1); player.moveLane(-1);
  T.eq('左移三次被夹在车道0', P.lane, 0);
  player.moveLane(1); T.eq('回到车道1', P.lane, 1);

  // 跳跃
  player.jump();
  T.t('跳跃后离地', !P.onGround);
  T.eq('初速=jumpVel', P.vy, CONFIG.jumpVel);
  player.jump(); // 空中再跳应无效
  T.eq('空中不能二段跳', P.vy, CONFIG.jumpVel);

  // 跳跃物理:回到地面,全程 jumpY >= 0
  let maxY = 0, minY = 0;
  for (let i = 0; i < 400 && !P.onGround; i++) {
    player.update(1 / 60, 10, false);
    maxY = Math.max(maxY, P.jumpY);
    minY = Math.min(minY, P.jumpY);
  }
  T.t('跳跃落地', P.onGround);
  T.t('跳跃最高点 > 0.8m', maxY > 0.8, 'maxY=' + maxY);
  T.t('跳跃过程不为负高度', minY >= -0.0001, 'minY=' + minY);
  T.eq('落地后 jumpY=0', P.jumpY, 0);
  T.eq('落地后 vy=0', P.vy, 0);

  // 滑铲
  player.slide();
  T.eq('滑铲时长=slideTime', P.sliding, CONFIG.slideTime);
  T.eq('滑铲姿态', player.pose(), 'slide');
  player.update(CONFIG.slideTime, 10, false);
  T.t('滑铲计时结束', P.sliding <= 0);
  T.eq('滑铲结束姿态=run', player.pose(), 'run');

  // 空中滑铲=快速下压
  player.jump();
  player.slide();
  T.t('空中滑铲转为下压(vy<0)', P.vy < 0, 'vy=' + P.vy);

  // 姿态优先级
  player.reset();
  T.eq('地面奔跑姿态=run', player.pose(), 'run');
  player.jump(); T.eq('空中姿态=jump', player.pose(), 'jump');
  player.reset(); player.slide(); T.eq('地面滑铲姿态=slide', player.pose(), 'slide');
  player.reset(); player.update(1, 10, true); T.eq('无敌冲刺姿态=dash', player.pose(), 'dash');

  // reset
  player.moveLane(1); player.jump(); player.slide();
  player.reset();
  T.eq('reset 后车道=1', P.lane, 1);
  T.t('reset 后在地面', P.onGround);
  T.eq('reset 后 sliding=0', P.sliding, 0);
  T.t('reset 后存活', P.alive);
  T.t('reset 后非无敌', !P.invincible);

  // 碰撞:障碍(同车道)→ onHit
  hit = 0;
  player.reset();
  items.active = [{ type: 'stump', node: {}, x: CONFIG.lanes[1], z: 0, w: 1.2, h: 0.9, d: 1.2, ground: true, deadly: true }];
  player.update(1, 10, false); // dt=1 → x 瞬移到目标车道
  T.eq('同车道障碍→撞死回调', hit, 1);

  // 碰撞:障碍(异车道)→ 无事
  hit = 0;
  player.reset();
  items.active = [{ type: 'stump', node: {}, x: CONFIG.lanes[0], z: 0, w: 1.2, h: 0.9, d: 1.2, ground: true, deadly: true }];
  player.update(1, 10, false);
  T.eq('异车道障碍→不碰撞', hit, 0);

  // 碰撞:障碍(远离 z)→ 无事
  hit = 0;
  player.reset();
  items.active = [{ type: 'stump', node: {}, x: CONFIG.lanes[1], z: 10, w: 1.2, h: 0.9, d: 1.2, ground: true, deadly: true }];
  player.update(1, 10, false);
  T.eq('远处(z>2.5)障碍→不碰撞', hit, 0);

  // 收集:草料→ onCollect 且被移除
  collect = 0;
  player.reset();
  items.active = [{ type: 'hay', node: { position: { y: 0.35 } }, x: CONFIG.lanes[1], z: 0, w: 0.7, h: 0.7, d: 0.7, ground: false, lowY: 0, deadly: false, collectible: true }];
  player.update(1, 10, false);
  T.eq('收集物→收集回调', collect, 1);
  T.eq('收集后移出 active', items.active.length, 0);

  // 无敌:冲刺撞碎
  hit = 0; smash = 0;
  player.reset();
  items.active = [{ type: 'rockBig', node: {}, x: CONFIG.lanes[1], z: 0, w: 1.8, h: 1.6, d: 1.8, ground: true, deadly: true }];
  player.update(1, 10, true);
  T.eq('无敌撞碎→不撞死', hit, 0);
  T.eq('无敌撞碎→smash 回调', smash, 1);
  T.eq('撞碎后移出 active', items.active.length, 0);

  // 悬枝:站立撞死 / 滑铲通过
  const branch = { type: 'branch', node: {}, x: CONFIG.lanes[1], z: 0, w: CONFIG.trackWidth, h: 0.6, d: 0.7, ground: false, lowY: 1.3, deadly: true };
  hit = 0; player.reset();
  items.active = [branch];
  player.update(1, 10, false);
  T.eq('悬枝站立→撞死', hit, 1);
  hit = 0; player.reset(); player.slide();
  items.active = [{ ...branch }];
  player.update(0.1, 10, false); // dt 小,滑铲未结束
  T.eq('悬枝滑铲→安全通过', hit, 0);
  T.t('滑铲压低判定盒高度', player.state.sliding > 0);
}

// ============ 4. items:模式化生成 / 活路保证 / 对象池 / 豹拉追猎 ============
T.section('items');
{
  const items = createItems();
  T.eq('初始无 active', items.active.length, 0);
  T.eq('初始 stats 归零', items.stats.spawned + items.stats.collected, 0);

  // 长跑 3000m:生成、回收、活路保证
  const seenTypes = new Set();
  const dt = 1 / 60;
  let dist = 0;
  for (let i = 0; i < 15000; i++) {
    const dz = 12 * dt;
    dist += dz;
    items.update(dz, dist, i * dt, 0, dt);
    for (const it of items.active) seenTypes.add(it.type);
  }
  T.t('长跑有生成', items.stats.spawned > 0, 'spawned=' + items.stats.spawned);
  T.t('active 有内容且在界内', items.active.length > 0 && items.active.length < 80, 'active=' + items.active.length);
  T.t('生成过草料', seenTypes.has('hay'), 'types=' + [...seenTypes].join(','));
  T.t('生成过铜铃', seenTypes.has('bell'), 'types=' + [...seenTypes].join(','));
  T.t('生成过障碍', ['stump', 'rockBig', 'wolf', 'leopard', 'snake', 'branch', 'fenceRow'].some((t) => seenTypes.has(t)));

  // 活路保证:同一截面(z 相同)的地面障碍不得堵死三车道(全宽型 branch/fenceRow 可滑铲/跳跃通过,不算堵路)
  const byZ = new Map();
  for (const it of items.active) {
    if (!it.deadly || it.collectible) continue;
    if (it.type === 'branch' || it.type === 'fenceRow') continue; // 动作型,非堵路
    const z = Math.round(it.z * 10) / 10;
    if (!byZ.has(z)) byZ.set(z, new Set());
    byZ.get(z).add(it.lane);
  }
  let worst = 0;
  for (const lanes of byZ.values()) worst = Math.max(worst, lanes.size);
  T.t('同截面至少一条车道可通行(≤2/3 被占)', worst <= 2, 'worst blocked lanes=' + worst);

  // 车道合法性(豹拉追猎会离开原车道,豁免;收集物不带 lane 字段,只校验 x 落在车道)
  let laneOk = true;
  for (const it of items.active) {
    if (it.chase) continue;
    if (it.collectible) { laneOk = laneOk && CONFIG.lanes.includes(it.x); continue; }
    laneOk = laneOk && it.lane >= 0 && it.lane <= 2 && it.x === CONFIG.lanes[it.lane];
  }
  T.t('active 车道索引合法且 x 对齐(豹拉/收集豁免)', laneOk);

  // 豹拉追猎:进入 42m 内朝玩家逼近并夹在 ±4.4
  const leopard = {
    type: 'leopard', node: new THREE.Group(), x: CONFIG.lanes[1], z: -30,
    w: 1.0, h: 1.05, d: 1.5, ground: true, deadly: true, chase: true,
  };
  const items2 = createItems();
  items2.active.push(leopard);
  const x0 = leopard.x;
  for (let i = 0; i < 20; i++) items2.update(0, 100, i * 0.1, 0.9, 0.1);
  T.t('豹拉朝玩家 x 逼近', leopard.x > x0, 'x0=' + x0 + ' x=' + leopard.x);
  for (let i = 0; i < 200; i++) items2.update(0, 100, i * 0.1, -2.3, 0.1);
  T.t('豹拉 x 被夹在 ±4.4', leopard.x >= -4.4 && leopard.x <= 4.4, 'x=' + leopard.x);

  // removeAt / 对象池归还
  const before = items2.active.length;
  if (before > 0) {
    items2.removeAt(0);
    T.eq('removeAt 收缩 active', items2.active.length, before - 1);
  } else {
    T.t('removeAt(空) 跳过', true);
  }

  // reset
  items.reset();
  T.eq('reset 后 active 清空', items.active.length, 0);
  T.eq('reset 后 stats 归零', items.stats.spawned, 0);
}

// ============ 5. game:状态机 / 计分 / 妈妈技能 ============
T.section('game');
{
  mkElements();
  const calls = { track: 0, items: 0, ox: 0, player: 0 };
  const fakeWorld = {
    scene: { add() {} },
    camera: { position: { x: 0, y: 0 }, fov: 62, updateProjectionMatrix() {}, lookAt() {} },
    cameraOverride: null,
  };
  const fakeOx = {
    root: { position: { x: 0, y: 0 } },
    update() {}, reset() { calls.ox++; },
  };
  const fakeTrack = { update() {}, reset() { calls.track++; } };
  const fakeItems = { active: [], update() {}, reset() { calls.items++; } };
  const pItems = { active: [], removeAt() {} };
  const player = createPlayer(pItems, () => {}, () => {}, () => {});
  const game = createGame(fakeWorld, fakeOx, fakeTrack, fakeItems);

  T.eq('初始状态 READY', game.state.state, 'READY');
  T.eq('初始能量=满', game.state.energy, CONFIG.energy.start);
  T.t('READY 时非运行中', !game.isRunning());

  // start
  game.start(player);
  T.eq('start 后 RUNNING', game.state.state, 'RUNNING');
  T.eq('start 后速度=baseSpeed', game.state.speed, CONFIG.baseSpeed);
  T.t('start 后数据归零', game.state.dist === 0 && game.state.coins === 0 && game.state.score === 0 && game.state.bonus === 0 && game.state.dash === 0);
  T.t('start 触发重置(track/items/ox)', calls.track >= 1 && calls.items >= 1 && calls.ox >= 1);
  T.eq('start 切走 start 屏', document.getElementById('screen-start').style.display, 'none');
  T.eq('start 显示 HUD', document.getElementById('hud').style.display, 'flex');
  T.eq('start 显示妈妈按钮', document.getElementById('btn-mama').style.display, 'flex');
  T.t('isRunning', game.isRunning());

  // tryMama:满能量可触发
  T.t('满能量触发妈妈冲刺', game.tryMama() === true);
  T.eq('冲刺计时=dash.time', game.state.dash, CONFIG.dash.time);
  T.eq('冲刺后能量清零', game.state.energy, 0);
  T.t('冲刺中再按无效', game.tryMama() === false);

  // 冲刺期间 update:速度冲刺 + 双倍计分
  game.state.dash = CONFIG.dash.time; // 重开一次冲刺
  const sp0 = game.state.speed;
  game.update(1 / 60, 1, player, null);
  T.t('冲刺速度上升', game.state.speed > sp0);
  T.t('冲刺 bonus 累计', game.state.bonus > 0);
  T.t('冲刺 HUD active 类', document.getElementById('btn-mama').classList.contains('active'));

  // 冲刺结束:回归普通加速,active 类移除
  for (let i = 0; i < 160; i++) game.update(1 / 60, 1 + i / 60, player, null);
  T.t('冲刺计时耗尽', game.state.dash <= 0);
  T.t('冲刺结束移除 active 类', !document.getElementById('btn-mama').classList.contains('active'));

  // 能量不足不能冲刺
  game.state.dash = 0; game.state.energy = 50;
  T.t('能量不足不能冲刺', game.tryMama() === false);

  // addEnergy 封顶
  game.state.energy = 90;
  game.addEnergy(CONFIG.energy.hay);
  T.eq('addEnergy 封顶 100', game.state.energy, 100);
  game.state.energy = 0;
  game.addEnergy(12);
  T.eq('addEnergy 累加', game.state.energy, 12);

  // smash 加分
  game.state.bonus = 0;
  game.smash(null);
  T.eq('撞碎加分=smashBonus', game.state.bonus, CONFIG.dash.smashBonus);

  // 普通加速封顶 maxSpeed
  game.state.energy = 100;
  for (let i = 0; i < 8000; i++) game.update(1 / 60, i / 60, player, null);
  T.eq('速度封顶 maxSpeed', game.state.speed, CONFIG.maxSpeed);
  T.t('计分 = 里程 + 草料×50', Math.abs(game.state.score - (game.state.dist + game.state.coins * 50)) < 0.01);
  T.t('HUD 分数已写入', /^\d+$/.test(document.getElementById('hud-score').textContent));

  // gameover
  game.state.coins = 3;
  game.gameover(player);
  T.eq('gameover 状态', game.state.state, 'GAMEOVER');
  T.t('gameover 后主角死亡', player.state.alive === false);
  T.eq('gameover 冲刺清零', game.state.dash, 0);
  T.eq('over-dist 文本', document.getElementById('over-dist').textContent, game.state.dist.toFixed(0));
  // 注意:虚拟元素 textContent 直接存值(不强制转字符串,与微信 adapter 行为一致)
  T.eq('over-coins 文本', document.getElementById('over-coins').textContent, game.state.coins);
  T.eq('over-score 文本', document.getElementById('over-score').textContent, Math.floor(game.state.score + game.state.bonus));
  await sleep(1000); // 等 900ms 面板延迟
  T.eq('gameover 900ms 后面板显示', document.getElementById('screen-over').style.display, 'flex');
  T.eq('gameover 后 HUD 隐藏', document.getElementById('hud').style.display, 'none');
  T.t('gameover 后非运行', !game.isRunning());

  // 非运行状态 update 安全(READY 分支)
  const g2 = createGame(fakeWorld, fakeOx, fakeTrack, fakeItems);
  let threw = false;
  try { g2.update(1 / 60, 2, null, null); } catch (e) { threw = true; }
  T.t('非运行 update 不抛异常', !threw);
}

// ============ 6. ui:虚拟元素 / 初始界面 / 命中测试 / 缩放 ============
T.section('ui');
{
  const ui = createUI(375, 667);
  const ids = [
    'hud', 'screen-start', 'screen-over', 'btn-start', 'btn-restart', 'btn-mama',
    'mama-fill', 'hud-score', 'hud-dist', 'hud-coins', 'over-dist', 'over-coins', 'over-score',
  ];
  for (const id of ids) T.t('ui 注册元素 ' + id, !!ui.els[id] && !!document.getElementById(id));
  T.eq('初始 start 屏显示', ui.els['screen-start'].style.display, 'flex');
  T.eq('初始 over 屏隐藏', ui.els['screen-over'].style.display, 'none');
  T.eq('初始 HUD 隐藏', ui.els.hud.style.display, 'none');
  T.eq('初始妈妈按钮隐藏', ui.els['btn-mama'].style.display, 'none');
  T.eq('UI canvas 尺寸=视口×2x(默认)', ui.canvas.width + 'x' + ui.canvas.height, '750x1334');
  const ui2 = createUI(375, 667, 1);
  T.eq('dpr=1 → UI 画布=逻辑分辨率', ui2.canvas.width + 'x' + ui2.canvas.height, '375x667');
  const ui3 = createUI(375, 667, 3);
  T.eq('dpr=3 被 cap 到 2x', ui3.canvas.width + 'x' + ui3.canvas.height, '750x1334');
  const ui4 = createUI(768, 1024, 2); // iPad 竖屏:2x 长边=2048,不触发 cap
  T.eq('长边=2048 不触发 cap(2x)', ui4.canvas.width + 'x' + ui4.canvas.height, '1536x2048');
  const ui5 = createUI(1024, 2048, 2); // 超长边:4096 → cap 到 2048
  T.eq('超长边触发 cap 2048', ui5.canvas.width + 'x' + ui5.canvas.height, '1024x2048');

  let threw = false;
  try { ui.render(0); } catch (e) { threw = true; }
  T.t('render(start 屏) 不抛异常', !threw);

  // 命中测试:开始按钮(布局公式与 ui.js drawStart 一致)
  const s = Math.min(375, 667) / 420;
  const pw = Math.min(375 * 0.92, 560 * s);
  const px = (375 - pw) / 2;
  const py = (667 - 500 * s) / 2;
  const by = py + 40 * s + 62 * s + 42 * s + 40 * s + 4 * 30 * s + 22 * s;
  const bx = (375 - 240 * s) / 2, bw = 240 * s, bh = 62 * s;
  const cx = bx + bw / 2, cy = by + bh / 2;

  let started = false;
  ui.els['btn-start']._onclick = () => { started = true; };
  T.t('点开始按钮→路由到 _onclick', ui.onTap(cx, cy) === true && started);
  T.t('空白处点按→不消费', ui.onTap(2, 2) === false);

  // 回归:运行中(start 屏隐藏)点"旧开始按钮位置"不得误触重开
  // (曾因 hit.startBtn 残留导致运行中误触 startGame() 静默重开)
  started = false;
  ui.els['screen-start'].style.display = 'none';
  ui.els['screen-over'].style.display = 'none';
  ui.render(0);
  T.t('运行中点旧开始按钮位置→不触发重开', ui.onTap(cx, cy) === false && started === false);
  // 回归:结算屏隐藏后,点"旧再入梦境位置"不得误触重开
  let restarted = false;
  ui.els['btn-restart']._onclick = () => { restarted = true; };
  ui.els['screen-over'].style.display = 'flex';
  ui.render(0);
  const rs = Math.min(375, 667) / 420;
  const rpw = Math.min(375 * 0.92, 480 * rs);
  const rpx = (375 - rpw) / 2;
  const rpy = (667 - 430 * rs) / 2;
  const rby = rpy + (40 + 66 + 46 + 38 + 52 + 40) * rs;
  const rbx = (375 - 300 * rs) / 2, rbw = 300 * rs, rbh = 62 * rs;
  T.t('结算屏点再入梦境→路由到 _onclick', ui.onTap(rbx + rbw / 2, rby + rbh / 2) === true && restarted);
  restarted = false;
  ui.els['screen-over'].style.display = 'none';
  ui.render(0);
  T.t('重开后点旧再入位置→不触发重开', ui.onTap(rbx + rbw / 2, rby + rbh / 2) === false && restarted === false);

  // 妈妈按钮命中(需先显示;且 start/over 屏隐藏时才会绘制妈妈按钮)
  ui.els['screen-start'].style.display = 'none';
  ui.els['screen-over'].style.display = 'none';
  ui.els['btn-mama'].style.display = 'flex';
  ui.render(0);
  const r = 46 * s;
  const mcx = 375 - r - 22 * s, mcy = 667 - r - 26 * s;
  let mama = false;
  ui.els['btn-mama']._onclick = () => { mama = true; };
  T.t('点妈妈按钮→路由到 _onclick', ui.onTap(mcx, mcy) === true && mama);

  // 运行中 HUD 绘制
  ui.els['screen-start'].style.display = 'none';
  ui.els.hud.style.display = 'flex';
  ui.els['btn-mama'].style.display = 'flex';
  ui.els['hud-score'].textContent = '123';
  ui.els['hud-dist'].textContent = '45';
  threw = false;
  try { ui.render(1.5); } catch (e) { threw = true; }
  T.t('render(HUD) 不抛异常', !threw);

  // setViewport 换分辨率
  threw = false;
  try { ui.setViewport(750, 1334); ui.render(2); } catch (e) { threw = true; }
  T.t('setViewport+render 不抛异常', !threw);
}

// ============ 7. 渲染模块冒烟(在浏览器环境创建/更新不抛错) ============
T.section('smoke');
{
  let threw = false;
  try {
    const world = createWorld();
    const ox = createOx();
    const track = createTrack();
    const dust = createDust(world.scene);
    T.t('createWorld 返回 scene+camera', !!world.scene && !!world.camera);
    T.t('createOx 有模型子节点', ox.root.children.length > 0);
    T.eq('createTrack 段落数=segCount', track.group.children.length, CONFIG.segCount);
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60, i / 60, 0.2);
      ox.update(1 / 60, i / 60, 'run', 0.2, 0);
      track.update(0.2);
      dust.update(1 / 60, true, 0);
    }
    track.reset(); ox.reset(); dust.reset();
  } catch (e) { threw = true; }
  T.t('渲染模块 120 帧冒烟无异常', !threw);
}

// ============ 收尾 ============
T.finish();
