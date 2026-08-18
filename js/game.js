// game.js —— 游戏状态机 / 计分 / HUD / 界面切换 / 镜头语言 / 粒子音效
// READY → RUNNING → GAMEOVER；云雀「云玎」伴随飞行（致敬电影见证者）。
// 妈妈技能：草料攒能量 → 点“妈妈”/按 M → 牛来冲刺（无敌撞碎、双倍分、喊“妈妈！”）。
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { sfx } from './audio.js';

function makeLark() {
  // 云雀云玎：极简小鸟，绕牛来盘旋
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.lark, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bodyMat);
  body.scale.set(1, 0.9, 1.5);
  g.add(body);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.14, 4),
    new THREE.MeshLambertMaterial({ color: CONFIG.colors.oxHorn, flatShading: true })
  );
  beak.rotation.x = -Math.PI / 2;
  beak.position.z = -0.22;
  g.add(beak);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), bodyMat);
    wing.position.x = s * 0.2;
    wing.userData.side = s;
    g.add(wing);
    wings.push(wing);
  }
  g.userData.wings = wings;
  return g;
}

export function createGame(world, ox, track, items) {
  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const lark = makeLark();
  world.scene.add(lark);

  const g = {
    state: 'READY',
    speed: 0,
    dist: 0,     // 米
    coins: 0,
    score: 0,
    bonus: 0,    // 冲刺期间额外计分
    dash: 0,     // 妈妈冲刺剩余秒数
    energy: CONFIG.energy.start,
    shake: 0,
    lastDz: 0,
  };

  function setScreen(name) {
    $('screen-start').style.display = name === 'start' ? 'flex' : 'none';
    $('screen-over').style.display = name === 'over' ? 'flex' : 'none';
    hud.style.display = name === 'none' ? 'flex' : 'none';
    const mb = $('btn-mama');
    if (mb) mb.style.display = name === 'none' ? 'flex' : 'none';
  }

  function start(player) {
    g.state = 'RUNNING';
    g.speed = CONFIG.baseSpeed;
    g.dist = 0; g.coins = 0; g.score = 0; g.bonus = 0; g.dash = 0; g.shake = 0; g.lastDz = 0;
    g.energy = CONFIG.energy.start;
    track.reset();
    items.reset();
    player.reset();
    ox.reset();
    setScreen('none');
    sfx.start();
  }

  // 妈妈冲刺：满能量即可触发（若在冲刺中再次按，不叠加）
  function tryMama() {
    if (g.state !== 'RUNNING' || g.dash > 0 || g.energy < CONFIG.energy.max) return false;
    g.dash = CONFIG.dash.time;
    g.energy = 0;
    g.shake = Math.max(g.shake, 0.35);
    sfx.mamaDash();
    return true;
  }

  function addEnergy(v) {
    const before = g.energy;
    g.energy = Math.min(CONFIG.energy.max, g.energy + v);
    if (before < CONFIG.energy.max && g.energy >= CONFIG.energy.max) sfx.energyFull();
  }

  function smash(it) {
    g.bonus += CONFIG.dash.smashBonus;
    g.shake = Math.max(g.shake, 0.25);
    sfx.smash();
  }

  function gameover(player) {
    g.state = 'GAMEOVER';
    player.state.alive = false;
    g.dash = 0;
    g.shake = 0.6;
    sfx.crash();
    sfx.calfCry();
    // 死亡戏（全女朋友配音）：开场哭声 → 1.8s 妈妈喊“牛来！”→ 4.8s 委屈“嗯，妈妈…”
    // （若中途已重开则不再播）
    setTimeout(() => {
      if (g.state === 'GAMEOVER') sfx.mamaCall();
    }, 1800);
    setTimeout(() => {
      if (g.state === 'GAMEOVER') sfx.calfEnMama();
    }, 4800);
    $('over-dist').textContent = g.dist.toFixed(0);
    $('over-coins').textContent = g.coins;
    $('over-score').textContent = Math.floor(g.score + g.bonus);
    // 稍作停顿再出面板，让撞击的镜头抖动与“妈妈——”惨叫先被看见/听见
    setTimeout(() => {
      if (g.state === 'GAMEOVER') setScreen('over');
    }, 900);
  }

  return {
    state: g,
    lark,
    start,
    gameover,
    tryMama,
    addEnergy,
    smash,
    isRunning: () => g.state === 'RUNNING',
    update(dt, t, player, dust) {
      if (g.state !== 'RUNNING') {
        // 待机/结束：小牛原地呼吸，云雀轻轻绕圈
        ox.update(dt, t, 'idle', 0, 0);
        ox.root.position.x = player ? player.state.x : 0;
        ox.root.position.y = 0;
        larkFly(dt, t, ox.root.position.x);
        if (dust) dust.update(dt, false, 0);
        if (g.shake > 0) {
          g.shake -= dt;
          if (!world.cameraOverride) {
            world.camera.position.x = (Math.random() - 0.5) * g.shake * 0.6;
            world.camera.position.y = 5.2 + (Math.random() - 0.5) * g.shake * 0.4;
          }
        } else if (!world.cameraOverride) { world.camera.position.x = 0; }
        return;
      }

      // ---- 妈妈冲刺：速度猛冲 + 双倍计分 ----
      const dashing = g.dash > 0;
      if (dashing) {
        g.dash -= dt;
        g.speed = Math.min(CONFIG.dash.speed, g.speed + CONFIG.dash.accel * dt);
      } else {
        g.speed = Math.min(CONFIG.maxSpeed, g.speed + CONFIG.accel * dt);
      }
      g.dist += g.speed * dt;
      if (dashing) g.bonus += g.speed * dt; // 冲刺里程额外一倍分
      g.score = g.dist * 1 + g.coins * 50;

      const dz = g.speed * dt;
      g.lastDz = dz;
      track.update(dz);
      items.update(dz, g.dist, t, player.state.x, dt);
      player.update(dt, g.speed, dashing);

      // HUD
      $('hud-score').textContent = Math.floor(g.score + g.bonus);
      $('hud-dist').textContent = Math.floor(g.dist);
      $('hud-coins').textContent = g.coins;
      $('mama-fill').style.width = (g.energy / CONFIG.energy.max * 100).toFixed(0) + '%';
      $('btn-mama').classList.toggle('ready', g.energy >= CONFIG.energy.max);
      $('btn-mama').classList.toggle('active', dashing);

      // 牛来姿态与位置
      ox.root.position.x = player.state.x;
      ox.root.position.y = player.state.jumpY;
      ox.update(dt, t, player.pose(), (g.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), player.state.jumpY);

      // 云雀伴随
      larkFly(dt, t, player.state.x);

      // 蹄下扬尘
      if (dust) dust.update(dt, player.state.onGround && player.pose() !== 'slide', player.state.x);

      // 镜头语言：跟车道 + 速度 FOV + 冲刺再拉宽 + 撞击抖动
      if (!world.cameraOverride) {
        const speed01 = (g.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed);
        world.camera.fov = 62 + speed01 * 7 + (dashing ? 8 : 0);
        world.camera.updateProjectionMatrix();
        world.camera.position.x = player.state.x * 0.45;
        world.camera.position.y = 5.2 + Math.sin(t * 0.5) * 0.12;
        if (g.shake > 0) {
          g.shake -= dt;
          world.camera.position.x += (Math.random() - 0.5) * g.shake * 0.6;
          world.camera.position.y += (Math.random() - 0.5) * g.shake * 0.4;
        }
        world.camera.lookAt(player.state.x * 0.3, 2.2, -8);
      }
    },
  };

  function larkFly(dt, t, oxX) {
    const r = 2.1;
    const a = t * 1.6;
    lark.position.set(
      oxX + Math.cos(a) * r,
      2.6 + Math.sin(t * 2.3) * 0.35,
      Math.sin(a) * r * 0.8 - 1
    );
    lark.rotation.y = -a + Math.PI / 2;
    for (const w of lark.userData.wings) {
      w.rotation.z = w.userData.side * Math.sin(t * 14) * 0.7;
    }
  }
}
