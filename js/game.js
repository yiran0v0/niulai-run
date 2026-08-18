// game.js —— 游戏状态机 / 计分 / HUD / 界面切换 / 镜头语言 / 粒子音效
// READY → RUNNING → GAMEOVER；云雀「云玎」伴随飞行（致敬电影见证者）。
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
    shake: 0,
    lastDz: 0,
  };

  function setScreen(name) {
    $('screen-start').style.display = name === 'start' ? 'flex' : 'none';
    $('screen-over').style.display = name === 'over' ? 'flex' : 'none';
    hud.style.display = name === 'none' ? 'flex' : 'none';
  }

  function start(player) {
    g.state = 'RUNNING';
    g.speed = CONFIG.baseSpeed;
    g.dist = 0; g.coins = 0; g.score = 0; g.shake = 0; g.lastDz = 0;
    track.reset();
    items.reset();
    player.reset();
    ox.reset();
    setScreen('none');
    sfx.start();
  }

  function gameover(player) {
    g.state = 'GAMEOVER';
    player.state.alive = false;
    g.shake = 0.6;
    sfx.crash();
    $('over-dist').textContent = g.dist.toFixed(0);
    $('over-coins').textContent = g.coins;
    $('over-score').textContent = Math.floor(g.score);
    // 稍作停顿再出面板，让撞击的镜头抖动先被看见
    setTimeout(() => {
      if (g.state === 'GAMEOVER') setScreen('over');
    }, 480);
  }

  return {
    state: g,
    lark,
    start,
    gameover,
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
      g.speed = Math.min(CONFIG.maxSpeed, g.speed + CONFIG.accel * dt);
      g.dist += g.speed * dt;
      g.score = g.dist * 1 + g.coins * 50;

      const dz = g.speed * dt;
      g.lastDz = dz;
      track.update(dz);
      items.update(dz, g.dist, t);
      player.update(dt, g.speed);

      // HUD
      $('hud-score').textContent = Math.floor(g.score);
      $('hud-dist').textContent = Math.floor(g.dist);
      $('hud-coins').textContent = g.coins;

      // 牛来姿态与位置
      ox.root.position.x = player.state.x;
      ox.root.position.y = player.state.jumpY;
      ox.update(dt, t, player.pose(), (g.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), player.state.jumpY);

      // 云雀伴随
      larkFly(dt, t, player.state.x);

      // 蹄下扬尘
      if (dust) dust.update(dt, player.state.onGround && player.pose() === 'run', player.state.x);

      // 镜头语言：跟车道 + 速度 FOV + 撞击抖动
      if (!world.cameraOverride) {
        const speed01 = (g.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed);
        world.camera.fov = 62 + speed01 * 7;
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
