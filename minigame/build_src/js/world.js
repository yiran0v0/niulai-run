// world.js —— 场景 / 相机 / 光照 / 水墨天空 / 远山 / 雾 / 草原
// 视觉基调：电影唯一官方物料是“水墨海报”，正片是朴素低模三维——
// 因此天空与远山走水墨晕染，地面物件走 flatShading 低多边形“手搓”感。
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';

function gradientTexture(topColor, bottomColor) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 一层水墨远山：沿 x 轴的锯齿山脊条带
function makeRidge(width, height, color, opacity, seed) {
  const pts = 24;
  const pos = [];
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  pos.push(-width / 2, -height, 0);
  for (let i = 0; i <= pts; i++) {
    const x = -width / 2 + (width * i) / pts;
    const peak = height * (0.35 + 0.65 * rand() * (0.6 + 0.4 * Math.sin(i * 1.7)));
    pos.push(x, peak, 0);
  }
  pos.push(width / 2, -height, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = gradientTexture('#efe8d4', '#d9e0cd');
  scene.fog = new THREE.Fog(CONFIG.colors.skyBottom, CONFIG.fogNear, CONFIG.fogFar);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
  camera.position.set(0, 5.2, 9.5);
  camera.lookAt(0, 2.2, -8);

  // 光照：半球光打底 + 一盏暖阳平行光，不用阴影贴图（朴素画风）
  const hemi = new THREE.HemisphereLight(0xf2ecd8, 0x8a9169, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeecf, 1.15);
  sun.position.set(-14, 22, 10);
  scene.add(sun);

  // 远景：三层水墨山 + 淡红日
  const backdrop = new THREE.Group();
  const r1 = makeRidge(520, 46, CONFIG.colors.inkNear, 0.9, 7);
  r1.position.set(0, 0, -175);
  const r2 = makeRidge(560, 34, CONFIG.colors.inkMid, 0.75, 23);
  r2.position.set(0, 0, -205);
  const r3 = makeRidge(620, 26, CONFIG.colors.inkFar, 0.55, 91);
  r3.position.set(0, 0, -240);
  backdrop.add(r1, r2, r3);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(11, 40),
    new THREE.MeshBasicMaterial({ color: CONFIG.colors.sun, transparent: true, opacity: 0.8, depthWrite: false })
  );
  sunDisc.position.set(-42, 46, -238);
  backdrop.add(sunDisc);
  scene.add(backdrop);

  // 流云：淡墨扁片，缓慢向镜头漂（运动线索 + 水墨晕染感）
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf7f3e6, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const w = 16 + (i % 3) * 9;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.32), cloudMat);
    c.position.set(-60 + (i * 137) % 120, 34 + (i % 4) * 9, -190 - (i % 3) * 14);
    clouds.add(c);
  }
  scene.add(clouds);

  // 草原大地（跑道由 track.js 的滚动带负责，避免 z-fight）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: CONFIG.colors.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  return {
    scene,
    camera,
    backdrop,
    cameraOverride: null, // 调试用：{pos:[x,y,z], look:[x,y,z]}
    update(dt, t, dz) {
      // 云缓慢压近再回到远处
      for (const c of clouds.children) {
        c.position.z += (dz || 0) * 0.06 + dt * 0.5;
        if (c.position.z > -120) c.position.z = -215;
      }
      if (this.cameraOverride) {
        camera.position.set(...this.cameraOverride.pos);
        camera.lookAt(...this.cameraOverride.look);
        return;
      }
      // 镜头微微呼吸
      camera.position.y = 5.2 + Math.sin(t * 0.5) * 0.12;
      camera.lookAt(0, 2.2, -8);
      backdrop.position.x = Math.sin(t * 0.03) * 6; // 远山极缓漂移，水墨般流动
    },
  };
}
