// items.js —— 障碍物与收集物（对象池 + 模式化生成）
// 障碍致敬电影意象：木桩、石块、栅栏（草原）、悬枝（森林）、狼群（反派）、
// 豹拉（金色猎豹，会追着你换道）、灵蛇（贴地长蛇，需跳跃或换道）。
// 收集物：草料捆（常见，攒妈妈能量）、铜铃（稀有）。生成保证同一截面至少一条车道可通行。
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';

const C = CONFIG.colors;
const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

// ---------- 模型工厂 ----------
function makeStump() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.85, 7), mat(C.wood));
  body.position.y = 0.42;
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 7), mat(C.woodDark));
  top.position.y = 0.86;
  g.add(top);
  return g;
}

function makeRockBig() {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), mat(C.stone));
  r.position.y = 0.72;
  r.scale.y = 0.85;
  r.rotation.y = 0.6;
  g.add(r);
  const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mat(C.stone));
  r2.position.set(0.7, 0.3, 0.2);
  g.add(r2);
  return g;
}

function makeFenceRow() {
  const g = new THREE.Group();
  const w = CONFIG.trackWidth - 0.6;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.12), mat(C.wood));
  bar.position.y = 0.78;
  g.add(bar);
  for (const x of [-w / 2 + 0.3, 0, w / 2 - 0.3]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.18), mat(C.woodDark));
    p.position.set(x, 0.5, 0);
    g.add(p);
  }
  return g;
}

function makeBranch() {
  // 悬垂树枝：需滑铲
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.trackWidth, 0.5, 0.6), mat(C.treeTrunk));
  bar.position.y = 1.95;
  g.add(bar);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 5), mat(i % 2 ? C.treeLeaf : C.treeLeafDark));
    leaf.position.set(-3.2 + i * 1.6, 1.35 + (i % 2) * 0.15, 0);
    leaf.rotation.x = Math.PI;
    g.add(leaf);
  }
  return g;
}

function makeWolf() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 1.15), mat(C.wolf));
  body.position.y = 0.62;
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.92, -0.68);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.44), mat(C.wolf));
  head.add(hb);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), mat(C.wolfDark));
  snout.position.set(0, -0.08, -0.32);
  head.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat(C.wolfDark));
    ear.position.set(s * 0.15, 0.3, 0);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8442f }));
    eye.position.set(s * 0.16, 0.05, -0.22);
    head.add(eye);
  }
  g.add(head);
  g.userData.head = head;
  const legs = [];
  for (const [lx, lz] of [[-0.22, -0.42], [0.22, -0.42], [-0.22, 0.42], [0.22, 0.42]]) {
    const legGeo = new THREE.BoxGeometry(0.14, 0.44, 0.16);
    legGeo.translate(0, -0.22, 0);
    const leg = new THREE.Mesh(legGeo, mat(C.wolfDark));
    leg.position.set(lx, 0.44, lz);
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), mat(C.wolfDark));
  tail.geometry.translate(0, 0.21, 0);
  tail.position.set(0, 0.78, 0.6);
  tail.rotation.x = -0.6;
  g.add(tail);
  g.userData.tail = tail;
  return g;
}

function makeLeopard() {
  // 豹拉：金色猎豹，低伏身姿，会横切追猎（致敬电影反派猎手）
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.3), mat(C.leopard));
  body.position.y = 0.58;
  g.add(body);
  // 深色斑纹
  const spotMat = new THREE.MeshLambertMaterial({ color: 0x8a6a2f, flatShading: true });
  for (const [sx, sz, s] of [[-0.15, 0.2, 0.16], [0.18, -0.1, 0.14], [0.05, 0.35, 0.12], [-0.2, -0.3, 0.12], [0.22, 0.15, 0.1]]) {
    const spot = new THREE.Mesh(new THREE.BoxGeometry(s, 0.02, s), spotMat);
    spot.position.set(sx, 0.84, sz);
    g.add(spot);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.86, -0.78);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.42), mat(C.leopard));
  head.add(hb);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), mat(0xd9c28a));
  snout.position.set(0, -0.06, -0.32);
  head.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), mat(0x8a6a2f));
    ear.position.set(s * 0.17, 0.26, -0.02);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8442f }));
    eye.position.set(s * 0.17, 0.04, -0.2);
    head.add(eye);
  }
  g.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.24, -0.44], [0.24, -0.44], [-0.24, 0.44], [0.24, 0.44]]) {
    const legGeo = new THREE.BoxGeometry(0.13, 0.4, 0.15);
    legGeo.translate(0, -0.2, 0);
    const leg = new THREE.Mesh(legGeo, mat(0xd9c28a));
    leg.position.set(lx, 0.4, lz);
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.8), mat(C.leopard));
  tail.position.set(0, 0.68, 0.98);
  tail.rotation.x = -0.5;
  g.add(tail);
  g.userData.tail = tail;
  return g;
}

function makeSnake() {
  // 灵蛇：贴地长蛇（4 节蠕动 + 三角头），低矮横拦，需跳跃或换道
  const g = new THREE.Group();
  const segs = [];
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), mat(i % 2 ? C.snake : 0x6f9178));
    seg.scale.set(1, 0.55, 1.15);
    seg.position.set(0, 0.16, -1.2 + i * 0.8);
    g.add(seg);
    segs.push(seg);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.18, -1.85);
  const hb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), mat(C.snake));
  hb.scale.set(0.85, 0.6, 1.35);
  head.add(hb);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: 0x2e2a26 }));
    eye.position.set(s * 0.14, 0.08, -0.24);
    head.add(eye);
  }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.26), mat(0xb5453c));
  tongue.position.set(0, -0.04, -0.4);
  head.add(tongue);
  g.add(head);
  g.userData.segs = segs;
  g.userData.head = head;
  g.userData.tongue = tongue;
  return g;
}

function makeHay() {
  // 草料捆：横放干草卷
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 9), mat(C.grassBall));
  roll.rotation.z = Math.PI / 2;
  roll.position.y = 0.36;
  g.add(roll);
  for (const dx of [-0.13, 0.13]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.03, 5, 12), mat(C.woodDark));
    band.rotation.y = Math.PI / 2;
    band.position.set(dx, 0.36, 0);
    g.add(band);
  }
  return g;
}

function makeBell() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.34, 8), mat(C.bell));
  body.position.y = 0.6;
  g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(C.bell));
  top.position.y = 0.82;
  g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 5, 10), mat(C.oxHorn));
  ring.position.y = 0.95;
  g.add(ring);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(C.oxHorn));
  clapper.position.y = 0.42;
  g.add(clapper);
  return g;
}

// ---------- 生成器 ----------
export function createItems() {
  const group = new THREE.Group();
  const pools = { stump: [], rockBig: [], fenceRow: [], branch: [], wolf: [], leopard: [], snake: [], hay: [], bell: [] };
  const factories = { stump: makeStump, rockBig: makeRockBig, fenceRow: makeFenceRow, branch: makeBranch, wolf: makeWolf, leopard: makeLeopard, snake: makeSnake, hay: makeHay, bell: makeBell };
  const active = []; // {type, node, x, z, w, h, d, ground(占地面), lowY(悬空障碍下沿), deadly, collectible}
  const stats = { spawned: 0, collected: 0 };
  const SPAWN_Z = -150;    // 生成截面：藏在雾外
  let gapCountdown = 45;   // 距离下一个截面的剩余米数（开局留 runway）
  let rngS = 987654321;
  const rnd = () => { rngS = (rngS * 16807) % 2147483647; return rngS / 2147483647; };

  function acquire(type) {
    const pool = pools[type];
    let node = pool.pop();
    if (!node) node = factories[type]();
    node.visible = true;
    group.add(node);
    return node;
  }

  function release(item) {
    item.node.visible = false;
    group.remove(item.node);
    pools[item.type].push(item.node);
  }

  function spawnObstacle(type, laneIdx, z) {
    const node = acquire(type);
    const x = CONFIG.lanes[laneIdx];
    node.position.set(x, 0, z);
    const spec = {
      stump:    { w: 1.2, h: 0.9, d: 1.2, ground: true },
      rockBig:  { w: 1.8, h: 1.6, d: 1.8, ground: true },
      fenceRow: { w: CONFIG.trackWidth - 0.6, h: 1.0, d: 0.4, ground: true },
      branch:   { w: CONFIG.trackWidth, h: 0.6, d: 0.7, ground: false, lowY: 1.3 },
      wolf:     { w: 0.9, h: 1.1, d: 1.3, ground: true },
      leopard:  { w: 1.0, h: 1.05, d: 1.5, ground: true, chase: true },
      snake:    { w: 0.9, h: 0.45, d: 3.8, ground: true, wiggle: true },
    }[type];
    active.push({ type, node, x, z, lane: laneIdx, ...spec, deadly: true });
    stats.spawned++;
  }

  function spawnCollectible(type, laneIdx, z, y) {
    const node = acquire(type);
    node.position.set(CONFIG.lanes[laneIdx], y || 0, z);
    active.push({
      type, node, x: CONFIG.lanes[laneIdx], z,
      w: 0.7, h: 0.7, d: 0.7, ground: false, lowY: 0,
      deadly: false, collectible: true, spin: true,
    });
    stats.spawned++;
  }

  // 生成一个"截面事件"
  function spawnPattern(z, difficulty) {
    const r = rnd();
    const pick = () => Math.floor(rnd() * 3);
    if (r < 0.14) {
      // 悬垂树枝：三车道滑铲
      spawnObstacle('branch', 1, z);
    } else if (r < 0.26) {
      // 双障碍留一活路
      const safe = pick();
      for (let l = 0; l < 3; l++) if (l !== safe) spawnObstacle(rnd() < 0.5 ? 'stump' : 'rockBig', l, z);
    } else if (r < 0.36) {
      // 狼拦路（单狼或双狼）
      const safe = pick();
      const n = difficulty > 0.5 && rnd() < 0.5 ? 2 : 1;
      let placed = 0;
      for (let l = 0; l < 3 && placed < n; l++) {
        if (l !== safe) { spawnObstacle('wolf', l, z); placed++; }
      }
    } else if (r < 0.43) {
      // 豹拉出猎：一车道豹拉（会追），高难度再补一桩
      const l = pick();
      spawnObstacle('leopard', l, z);
      if (difficulty > 0.4 && rnd() < 0.5) spawnObstacle('stump', (l + 1 + Math.floor(rnd() * 2)) % 3, z + 14);
    } else if (r < 0.53) {
      // 全栏（必须跳）
      spawnObstacle('fenceRow', 1, z);
    } else if (r < 0.6) {
      // 灵蛇横路：跳跃或换道
      spawnObstacle('snake', pick(), z);
      if (difficulty > 0.5 && rnd() < 0.5) spawnObstacle('snake', pick(), z + 10);
    } else if (r < 0.7) {
      // 草料弧线（跳跃轨迹上）
      const l = pick();
      for (let i = 0; i < 6; i++) {
        const y = 0.55 + Math.sin((i / 5) * Math.PI) * 1.5;
        spawnCollectible('hay', l, z - i * 2.4, y);
      }
    } else if (r < 0.8) {
      // 草料直线
      const l = pick();
      for (let i = 0; i < 5; i++) spawnCollectible('hay', l, z - i * 2.2, 0.35);
    } else if (r < 0.86) {
      // 铜铃（换道奖励）
      const l = pick();
      spawnCollectible('bell', l, z - 2, 0.5);
      spawnObstacle('stump', (l + 1) % 3, z - 2);
    } else {
      // 单障碍
      spawnObstacle(['stump', 'rockBig', 'wolf', 'snake'][Math.floor(rnd() * 4)], pick(), z);
    }
  }

  return {
    group,
    active,
    stats,
    update(dz, dist, t, playerX, dt) {
      // 整体前移
      for (const it of active) {
        it.z += dz;
        it.node.position.z = it.z;
        if (it.spin) it.node.rotation.y = (t || 0) * 2.4;
        if (it.type === 'wolf' || it.type === 'leopard') {
          // 狼/豹拉小跑动画（腿摆+头点）
          const ph = (t || 0) * 9;
          const legs = it.node.userData.legs;
          if (legs) {
            legs[0].rotation.x = Math.sin(ph) * 0.6;
            legs[3].rotation.x = Math.sin(ph) * 0.6;
            legs[1].rotation.x = Math.sin(ph + Math.PI) * 0.6;
            legs[2].rotation.x = Math.sin(ph + Math.PI) * 0.6;
          }
        }
        if (it.type === 'leopard' && it.chase && typeof playerX === 'number') {
          // 豹拉横切追猎：进入 42 米后朝牛来所在 x 逼近
          if (it.z > -42) {
            const chaseSpeed = 3.2 + Math.min(1, dist / 900) * 2.4;
            const dir = Math.sign(playerX - it.x) || 1;
            it.x += dir * chaseSpeed * (dt || 0.016);
            it.x = Math.max(-4.4, Math.min(4.4, it.x));
          }
          it.node.position.x = it.x;
          const tail = it.node.userData.tail;
          if (tail) tail.rotation.x = -0.5 + Math.sin((t || 0) * 10) * 0.35;
        }
        if (it.type === 'snake' && it.wiggle) {
          // 灵蛇蠕动：节段横向摆动 + 蛇信吞吐
          const ph = (t || 0) * 6;
          const segs = it.node.userData.segs;
          if (segs) segs.forEach((s, i) => { s.position.x = Math.sin(ph + i * 1.1) * 0.22; });
          const head = it.node.userData.head;
          if (head) head.position.x = Math.sin(ph + 4.2) * 0.3;
          const tongue = it.node.userData.tongue;
          if (tongue) tongue.position.z = -0.4 - (Math.sin(ph * 2.3) > 0 ? 0.1 : 0);
        }
      }
      // 越过镜头的回收
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].z > 14) {
          release(active[i]);
          active.splice(i, 1);
        }
      }
      // 按行进距离在雾外补新截面
      const difficulty = Math.min(1, dist / 900);
      gapCountdown -= dz;
      while (gapCountdown <= 0) {
        spawnPattern(SPAWN_Z - gapCountdown, difficulty); // 补偿过冲，落在 -150 附近
        gapCountdown += 20 - difficulty * 8 + rnd() * 6;
      }
    },
    spawnAhead(difficulty) { spawnPattern(-70, difficulty); },
    removeAt(i) {
      release(active[i]);
      active.splice(i, 1);
    },
    reset() {
      while (active.length) release(active.pop());
      gapCountdown = 45;
      stats.spawned = 0;
      stats.collected = 0;
    },
  };
}
