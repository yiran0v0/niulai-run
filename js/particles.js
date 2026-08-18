// particles.js —— 扬尘粒子（奔跑时蹄下尘土，朴素小方片）
import * as THREE from '../vendor/three.module.js';

export function createDust(scene) {
  const MAX = 40;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  for (let i = 0; i < MAX; i++) { positions[i * 3 + 1] = -10; life[i] = 0; }
  const mat = new THREE.PointsMaterial({
    color: 0xc9b98f, size: 0.22, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let timer = 0;

  return {
    emit(x, z) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = 0.08 + Math.random() * 0.12;
      positions[i * 3 + 2] = z + 0.55 + Math.random() * 0.3;
      vel[i * 3] = (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 1] = 1.1 + Math.random() * 1.2;
      vel[i * 3 + 2] = 1.6 + Math.random() * 2.2;
      life[i] = 0.55 + Math.random() * 0.3;
    },
    update(dt, emitting, oxX) {
      timer += dt;
      if (emitting && timer > 0.045) { timer = 0; this.emit(oxX, 0); }
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 2.2 * dt;
        if (life[i] <= 0) positions[i * 3 + 1] = -10;
      }
      geo.attributes.position.needsUpdate = true;
    },
    reset() {
      for (let i = 0; i < MAX; i++) { life[i] = 0; positions[i * 3 + 1] = -10; }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
