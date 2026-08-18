// player.js —— 牛来的操控与物理：三车道换位 / 跳跃 / 滑铲 / 碰撞检测
import { CONFIG } from './config.js';

export function createPlayer(items, onCollect, onHit) {
  const P = {
    lane: 1,
    x: 0,
    jumpY: 0,
    vy: 0,
    onGround: true,
    sliding: 0,       // 滑铲剩余秒数
    alive: true,
  };

  function playerBox() {
    // 滑铲时身高压低
    const h = P.sliding > 0 ? 0.75 : 1.5;
    return {
      xMin: P.x - 0.42, xMax: P.x + 0.42,
      yMin: P.jumpY, yMax: P.jumpY + h,
      zMin: -0.55, zMax: 0.55,
    };
  }

  return {
    state: P,
    moveLane(dir) {
      if (!P.alive) return;
      const next = Math.min(2, Math.max(0, P.lane + dir));
      P.lane = next;
    },
    jump() {
      if (!P.alive || !P.onGround) return;
      P.vy = CONFIG.jumpVel;
      P.onGround = false;
      P.sliding = 0;
    },
    slide() {
      if (!P.alive) return;
      if (!P.onGround) { P.vy = -CONFIG.jumpVel * 1.2; } // 空中下压快速落地
      P.sliding = CONFIG.slideTime;
    },
    update(dt, speed) {
      // 换道插值
      const targetX = CONFIG.lanes[P.lane];
      P.x += (targetX - P.x) * Math.min(1, dt * 11);
      // 跳跃重力
      if (!P.onGround) {
        P.vy -= CONFIG.gravity * dt;
        P.jumpY += P.vy * dt;
        if (P.jumpY <= 0) { P.jumpY = 0; P.vy = 0; P.onGround = true; }
      }
      // 滑铲计时
      if (P.sliding > 0) P.sliding -= dt;

      // ---- 碰撞 ----
      const pb = playerBox();
      for (let i = items.active.length - 1; i >= 0; i--) {
        const it = items.active[i];
        if (Math.abs(it.z) > 2.5) continue; // 只查近处
        const hw = it.w / 2, hd = it.d / 2;
        const xOk = pb.xMin < it.x + hw && pb.xMax > it.x - hw;
        const zOk = pb.zMin < it.z + hd && pb.zMax > it.z - hd;
        if (!xOk || !zOk) continue;
        if (it.collectible) {
          const cy = it.node.position.y + 0.35;
          if (pb.yMin < cy + 0.5 && pb.yMax > cy - 0.5) {
            items.removeAt(i);
            onCollect(it);
          }
          continue;
        }
        // 障碍：ground 型占 y∈[0,h]；悬空型占 y∈[lowY, lowY+h]
        const yMin = it.ground ? 0 : it.lowY;
        const yMax = it.ground ? it.h : it.lowY + it.h;
        if (pb.yMin < yMax && pb.yMax > yMin) {
          onHit(it);
          return;
        }
      }
    },
    pose() {
      if (!P.onGround) return 'jump';
      if (P.sliding > 0) return 'slide';
      return 'run';
    },
    reset() {
      P.lane = 1; P.x = 0; P.jumpY = 0; P.vy = 0;
      P.onGround = true; P.sliding = 0; P.alive = true;
    },
  };
}

// ---------- 输入绑定（键盘 + 触摸滑动） ----------
export function bindControls(handlers) {
  const fire = (fn) => (e) => {
    if (e && e.preventDefault) e.preventDefault();
    fn();
  };
  addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': fire(handlers.left)(e); break;
      case 'ArrowRight': case 'KeyD': fire(handlers.right)(e); break;
      case 'ArrowUp': case 'KeyW': case 'Space': fire(handlers.jump)(e); break;
      case 'ArrowDown': case 'KeyS': fire(handlers.slide)(e); break;
    }
  });
  let tx = 0, ty = 0, tT = 0;
  addEventListener('touchstart', (e) => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tT = Date.now();
  }, { passive: true });
  addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Date.now() - tT > 600) return;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { handlers.jump(); return; }
    if (Math.abs(dx) > Math.abs(dy)) (dx > 0 ? handlers.right : handlers.left)();
    else (dy < 0 ? handlers.jump : handlers.slide)();
  }, { passive: true });
}
