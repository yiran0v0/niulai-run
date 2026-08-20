// track.js —— 无尽赛道滚动带 + 路边景物（树/石/草丛/栅栏/图腾柱）
// 牛来原地奔跑，世界向 +Z 滚动；段落完整越过后回收到最远端并重新布置。
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';

const C = CONFIG.colors;

// 共享几何体/材质（手搓低模：全部 flatShading）
const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

const G = {
  dirtTile: new THREE.PlaneGeometry(CONFIG.trackWidth, CONFIG.segLen),
  edgeTile: new THREE.PlaneGeometry(0.55, CONFIG.segLen),
  ruts: new THREE.PlaneGeometry(0.18, CONFIG.segLen),
  trunk: new THREE.CylinderGeometry(0.14, 0.2, 1.1, 5),
  leaf: new THREE.ConeGeometry(1.05, 1.9, 6),
  leaf2: new THREE.ConeGeometry(0.75, 1.4, 6),
  rock: new THREE.DodecahedronGeometry(0.55, 0),
  tuft: new THREE.ConeGeometry(0.32, 0.5, 4),
  post: new THREE.BoxGeometry(0.16, 0.9, 0.16),
  rail: new THREE.BoxGeometry(2.6, 0.12, 0.1),
  totemA: new THREE.BoxGeometry(0.5, 1.5, 0.5),
  totemB: new THREE.BoxGeometry(0.62, 0.3, 0.62),
};

const M = {
  dirtA: mat(C.dirt),
  dirtB: mat(C.dirtDark),
  edge: mat(C.dirtDark),
  rut: mat(C.dirtDark),
  trunk: mat(C.treeTrunk),
  leaf: mat(C.treeLeaf),
  leaf2: mat(C.treeLeafDark),
  rock: mat(C.stone),
  tuft: mat(C.grassDark),
  post: mat(C.wood),
  rail: mat(C.woodDark),
  totemA: mat(C.wood),
  totemB: mat(C.accent),
};

function rand(seedRef) {
  seedRef.s = (seedRef.s * 16807) % 2147483647;
  return seedRef.s / 2147483647;
}

function makeTree(seedRef) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(G.trunk, M.trunk);
  trunk.position.y = 0.55;
  g.add(trunk);
  const l1 = new THREE.Mesh(G.leaf, M.leaf);
  l1.position.y = 1.9;
  const l2 = new THREE.Mesh(G.leaf2, M.leaf2);
  l2.position.y = 2.75;
  g.add(l1, l2);
  const k = 0.7 + rand(seedRef) * 0.9;
  g.scale.setScalar(k);
  return g;
}

function makeRock(seedRef) {
  const m = new THREE.Mesh(G.rock, M.rock);
  m.scale.set(0.5 + rand(seedRef) * 1.1, 0.4 + rand(seedRef) * 0.7, 0.5 + rand(seedRef) * 1.1);
  m.rotation.y = rand(seedRef) * Math.PI;
  m.position.y = 0.18;
  return m;
}

function makeTuft(seedRef) {
  const g = new THREE.Group();
  const n = 2 + Math.floor(rand(seedRef) * 3);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(G.tuft, M.tuft);
    c.position.set((rand(seedRef) - 0.5) * 0.6, 0.24, (rand(seedRef) - 0.5) * 0.6);
    c.rotation.z = (rand(seedRef) - 0.5) * 0.5;
    g.add(c);
  }
  return g;
}

function makeFence(seedRef) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(G.post, M.post);
    p.position.set(i * 1.3, 0.45, 0);
    g.add(p);
  }
  const r1 = new THREE.Mesh(G.rail, M.rail);
  r1.position.set(1.3, 0.7, 0);
  const r2 = new THREE.Mesh(G.rail, M.rail);
  r2.position.set(1.3, 0.38, 0);
  g.add(r1, r2);
  return g;
}

function makeTotem(seedRef) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(G.totemA, M.totemA);
  a.position.y = 0.75;
  g.add(a);
  const b = new THREE.Mesh(G.totemB, M.totemB);
  b.position.y = 1.62;
  g.add(b);
  g.rotation.y = rand(seedRef) * Math.PI;
  return g;
}

export function createTrack() {
  const group = new THREE.Group();
  const seedRef = { s: 12345 };
  const segs = [];
  let recycled = 0;

  function buildSegment(index) {
    const seg = new THREE.Group();
    seg.userData.index = index;

    // 土路瓦片：相邻段深浅交错，滚动时有节奏感
    const tile = new THREE.Mesh(G.dirtTile, index % 2 === 0 ? M.dirtA : M.dirtB);
    tile.rotation.x = -Math.PI / 2;
    tile.position.y = 0;
    seg.add(tile);

    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(G.edgeTile, M.edge);
      e.rotation.x = -Math.PI / 2;
      e.position.set(side * (CONFIG.trackWidth / 2 - 0.27), 0.005, 0);
      seg.add(e);
      const r = new THREE.Mesh(G.ruts, M.rut);
      r.rotation.x = -Math.PI / 2;
      r.position.set(side * 1.45, 0.006, 0);
      seg.add(r);
    }

    // 景物池
    const pool = new THREE.Group();
    seg.add(pool);
    seg.userData.pool = pool;
    seg.userData.props = [];
    for (let i = 0; i < 8; i++) seg.userData.props.push({ node: makeTree(seedRef), type: 'tree' });
    for (let i = 0; i < 4; i++) seg.userData.props.push({ node: makeRock(seedRef), type: 'rock' });
    for (let i = 0; i < 6; i++) seg.userData.props.push({ node: makeTuft(seedRef), type: 'tuft' });
    for (let i = 0; i < 2; i++) seg.userData.props.push({ node: makeFence(seedRef), type: 'fence' });
    seg.userData.props.push({ node: makeTotem(seedRef), type: 'totem' });

    for (const p of seg.userData.props) pool.add(p.node);

    group.add(seg);
    return seg;
  }

  function decorate(seg) {
    for (const p of seg.userData.props) {
      const r = rand(seedRef);
      let show = true;
      if (p.type === 'tree') show = r < 0.75;
      else if (p.type === 'rock') show = r < 0.5;
      else if (p.type === 'tuft') show = r < 0.7;
      else if (p.type === 'fence') show = r < 0.35;
      else if (p.type === 'totem') show = r < 0.18;
      p.node.visible = show;
      if (!show) continue;
      const side = rand(seedRef) < 0.5 ? -1 : 1;
      let x = side * (5 + rand(seedRef) * 26);
      if (p.type === 'tuft') x = side * (4.6 + rand(seedRef) * 20);
      if (p.type === 'fence') x = side * (5.4 + rand(seedRef) * 1.2);
      const z = (rand(seedRef) - 0.5) * CONFIG.segLen * 0.92;
      p.node.position.x = x;
      p.node.position.z = z;
      if (p.type === 'tree') p.node.rotation.y = rand(seedRef) * Math.PI * 2;
    }
  }

  for (let i = 0; i < CONFIG.segCount; i++) {
    const seg = buildSegment(i);
    seg.position.z = 10 - i * CONFIG.segLen; // 最前段在镜头前，向 -Z 延伸
    decorate(seg);
    segs.push(seg);
  }

  return {
    group,
    stats: { recycled: 0 },
    update(dz) {
      for (const seg of segs) {
        seg.position.z += dz;
        // 段完全越过镜头（段中心 > segLen/2 + 20）→ 回收到最远端
        if (seg.position.z - CONFIG.segLen / 2 > 20) {
          seg.position.z -= CONFIG.segCount * CONFIG.segLen;
          decorate(seg);
          this.stats.recycled++;
        }
      }
    },
    reset() {
      for (let i = 0; i < segs.length; i++) {
        segs[i].position.z = 10 - i * CONFIG.segLen;
        decorate(segs[i]);
      }
      this.stats.recycled = 0;
    },
  };
}
