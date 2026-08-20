// player.js —— 牛来的操控与物理：三车道换位 / 跳跃 / 滑铲 / 碰撞检测
import { CONFIG } from './config.js';

export function createPlayer(items, onCollect, onHit, onSmash) {
  const P = {
    lane: 1,
    x: 0,
    jumpY: 0,
    vy: 0,
    onGround: true,
    sliding: 0,       // 滑铲剩余秒数
    alive: true,
    invincible: false, // 妈妈冲刺：撞碎而非撞死
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
    update(dt, speed, invincible) {
      P.invincible = !!invincible;
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
          if (P.invincible) {
            // 妈妈冲刺：撞碎障碍
            items.removeAt(i);
            if (onSmash) onSmash(it);
            continue;
          }
          onHit(it);
          return;
        }
      }
    },
    pose() {
      if (!P.onGround) return 'jump';
      if (P.sliding > 0) return 'slide';
      if (P.invincible) return 'dash';
      return 'run';
    },
    reset() {
      P.lane = 1; P.x = 0; P.jumpY = 0; P.vy = 0;
      P.onGround = true; P.sliding = 0; P.alive = true; P.invincible = false;
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
      case 'KeyM': case 'ShiftLeft': case 'ShiftRight': fire(handlers.mama)(e); break;
    }
  });
  let tx = 0, ty = 0, tT = 0, tTriggered = false, tFromMamaBtn = false;
  addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    tx = t.clientX; ty = t.clientY; tT = Date.now();
    tTriggered = false;
    // 手指从「妈妈」按钮按下：交给按钮自己的处理，不参与滑动手势
    tFromMamaBtn = !!(e.target && e.target.closest && e.target.closest('#btn-mama'));
  }, { passive: true });

  // 滑动在手指移动中即时触发（阈值 26px），不等抬手 —— 下滑/上滑更跟手
  addEventListener('touchmove', (e) => {
    if (tTriggered || tFromMamaBtn) return;
    const t = e.touches[0];
    const dx = t.clientX - tx;
    const dy = t.clientY - ty;
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.25) {
      tTriggered = true;
      (dx > 0 ? handlers.right : handlers.left)();
    } else if (Math.abs(dy) > Math.abs(dx) * 1.25) {
      tTriggered = true;
      (dy < 0 ? handlers.jump : handlers.slide)();
    }
  }, { passive: true });

  addEventListener('touchend', (e) => {
    if (tTriggered || tFromMamaBtn) return;
    // 未形成滑动的手势：快速轻点 = 跳跃
    if (Date.now() - tT < 350) handlers.jump();
  }, { passive: true });
}
