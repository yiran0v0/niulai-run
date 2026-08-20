// ox.js —— 主角「牛来」：怯懦的小牛犊
// 程序化低多边形建模，致敬正片"以前用砖头搭建，现在用多边形搭建"的手搓质感。
// 奶白身体 + 棕斑 + 呆萌大眼 + 小弯角；对角步态跑动、跳跃、滑铲姿态。
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';

const C = CONFIG.colors;

function box(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, flatShading: true })
  );
  return m;
}

export function createOx() {
  const root = new THREE.Group();

  // ---- 身体 ----
  const body = new THREE.Group();
  const bodyBox = box(0.85, 0.72, 1.35, C.oxBody);
  bodyBox.position.y = 0.95;
  body.add(bodyBox);

  // 棕斑（贴片，手搓感）
  const patchMat = new THREE.MeshLambertMaterial({ color: C.oxPatch, flatShading: true });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.3, 0.42), patchMat);
  p1.position.set(0.02, 1.08, 0.18);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.74, 0.3), patchMat);
  p2.position.set(-0.24, 0.95, 0.52);
  const p3 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.26, 0.3), patchMat);
  p3.position.set(-0.01, 1.12, -0.42);
  body.add(p1, p2, p3);
  root.add(body);

  // ---- 头 ----
  const head = new THREE.Group();
  head.position.set(0, 1.42, -0.72);
  const headBox = box(0.56, 0.5, 0.52, C.oxBody);
  head.add(headBox);
  // 鼻吻
  const muzzle = box(0.4, 0.26, 0.16, C.oxMuzzle);
  muzzle.position.set(0, -0.12, -0.31);
  head.add(muzzle);
  // 小弯角
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.3, 5),
      new THREE.MeshLambertMaterial({ color: C.oxHorn, flatShading: true })
    );
    horn.position.set(s * 0.2, 0.32, 0.05);
    horn.rotation.z = -s * 0.5;
    horn.rotation.x = -0.25;
    head.add(horn);
  }
  // 耳朵
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = box(0.26, 0.1, 0.18, C.oxPatch);
    ear.position.set(s * 0.38, 0.14, 0.02);
    ear.rotation.z = s * 0.35;
    head.add(ear);
    ears.push(ear);
  }
  // 呆萌大眼：黑珠 + 白高光
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 8, 6),
      new THREE.MeshLambertMaterial({ color: C.oxEye })
    );
    eye.position.set(s * 0.23, 0.05, -0.25);
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    spark.position.set(s * 0.045, 0.025, -0.05);
    eye.add(spark);
    head.add(eye);
  }
  root.add(head);

  // ---- 四条腿（绕髋部旋转，geometry 原点上移到腿顶）----
  const legs = [];
  const legPos = [
    [-0.27, -0.48], [0.27, -0.48],   // 前腿 z 负方向
    [-0.27, 0.5], [0.27, 0.5],       // 后腿
  ];
  for (const [lx, lz] of legPos) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.62, lz);
    const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.24);
    legGeo.translate(0, -0.31, 0);
    leg.add(new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: C.oxBody, flatShading: true })));
    const hoof = box(0.21, 0.14, 0.25, C.oxHoof);
    hoof.position.y = -0.58;
    leg.add(hoof);
    root.add(leg);
    legs.push(leg);
  }

  // ---- 尾巴 ----
  const tail = new THREE.Group();
  tail.position.set(0, 1.2, 0.7);
  const tailGeo = new THREE.BoxGeometry(0.07, 0.46, 0.07);
  tailGeo.translate(0, -0.23, 0);
  tail.add(new THREE.Mesh(tailGeo, new THREE.MeshLambertMaterial({ color: C.oxBody, flatShading: true })));
  const tuft = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshLambertMaterial({ color: C.oxPatch, flatShading: true })
  );
  tuft.position.y = -0.48;
  tail.add(tuft);
  tail.rotation.x = 0.5;
  root.add(tail);

  // ---- 假阴影（朴素画风：半透明墨色圆片）----
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 18),
    new THREE.MeshBasicMaterial({ color: 0x33352e, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  let phase = 0;

  return {
    root,
    legs, // [前左, 前右, 后左, 后右]
    update(dt, t, state, speed01, jumpY) {
      phase += dt * (5 + speed01 * 7);
      const s = state;

      if (s === 'run') {
        const swing = Math.sin(phase) * 0.75;
        const swing2 = Math.sin(phase + Math.PI) * 0.75;
        legs[0].rotation.x = swing;
        legs[3].rotation.x = swing;   // 对角步态：前左+后右
        legs[1].rotation.x = swing2;
        legs[2].rotation.x = swing2;
        body.position.y = Math.abs(Math.sin(phase)) * 0.06;
        body.rotation.x = -0.04 + Math.sin(phase * 2) * 0.02;
        head.position.y = 1.42 + Math.sin(phase * 2 + 0.6) * 0.045;
        head.rotation.x = Math.sin(phase * 2) * 0.05;
      } else if (s === 'idle') {
        const br = Math.sin(t * 2.2) * 0.02;
        for (const l of legs) l.rotation.x *= 0.85;
        body.position.y = br * 0.5;
        body.scale.y = 1 + br;
        head.position.y = 1.42 + br * 0.6;
        head.rotation.x = Math.sin(t * 0.7) * 0.06;
      } else if (s === 'jump') {
        legs[0].rotation.x = -0.7; legs[1].rotation.x = -0.7; // 前腿前伸
        legs[2].rotation.x = 0.8;  legs[3].rotation.x = 0.8;  // 后腿后蹬
        body.rotation.x = -0.12;
        head.rotation.x = -0.15;
      } else if (s === 'slide') {
        legs[0].rotation.x = 0.9; legs[1].rotation.x = 0.9;
        legs[2].rotation.x = 1.1; legs[3].rotation.x = 1.1;
        body.rotation.x = 0.3;
        body.position.y = -0.28;
        head.position.y = 1.05;
        head.rotation.x = 0.4;
      } else if (s === 'dash') {
        // 妈妈冲刺：低头猛冲，四蹄狂摆，牛角朝前
        const swing = Math.sin(phase * 1.35) * 1.0;
        const swing2 = Math.sin(phase * 1.35 + Math.PI) * 1.0;
        legs[0].rotation.x = swing;
        legs[3].rotation.x = swing;
        legs[1].rotation.x = swing2;
        legs[2].rotation.x = swing2;
        body.rotation.x = -0.2;
        body.position.y = -0.06 + Math.abs(Math.sin(phase * 1.35)) * 0.08;
        head.position.y = 1.28;
        head.rotation.x = 0.32;
        tail.rotation.x = 0.75;
      }

      if (s !== 'slide') {
        body.position.y = s === 'run' ? body.position.y : body.position.y;
        if (s !== 'run') body.position.y = s === 'idle' ? body.position.y : 0;
      }

      // 尾巴永远轻摇，耳朵偶尔抖
      tail.rotation.z = Math.sin(t * 4.5) * 0.35;
      ears[0].rotation.z = -0.35 + Math.sin(t * 3.7) * 0.1;
      ears[1].rotation.z = 0.35 - Math.sin(t * 3.9) * 0.1;

      // 阴影随跳跃缩放淡出
      const lift = Math.max(0, jumpY || 0);
      const k = Math.max(0.35, 1 - lift * 0.09);
      shadow.scale.setScalar(k);
      shadow.material.opacity = 0.22 * k;
    },
    reset() {
      phase = 0;
      body.rotation.x = 0; body.position.y = 0; body.scale.y = 1;
      head.position.set(0, 1.42, -0.72); head.rotation.x = 0;
      tail.rotation.x = 0.5;
      for (const l of legs) l.rotation.x = 0;
    },
  };
}
