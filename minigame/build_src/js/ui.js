// ui.js —— 小游戏 canvas UI 层
// H5 版用 DOM+CSS 渲染界面;小游戏无 DOM,本模块以 2D canvas 绘制同款界面,
// 并以"虚拟元素"承接 game.js 的 DOM 读写(style.display/textContent/classList),
// 每帧读取状态重绘。样式尽量还原 H5 的水墨/楷体/印章红风格。
const makeVirtualEl = (id) => globalThis.__weapp.makeVirtualEl(id);

const INK = '#33352e';
const PAPER = '#f4edda';
const SEAL = '#b5453c';
const SOFT = '#5c6156';

function font(sz, bold) {
  return (bold ? 'bold ' : '') + sz + 'px "Kaiti SC","STKaiti","KaiTi",serif';
}

export function createUI(vw0, vh0) {
  const uiCanvas = globalThis.__weapp.createUICanvas();
  uiCanvas.width = 1024;
  uiCanvas.height = 2048;
  const ctx = uiCanvas.getContext('2d');
  // 将绘制坐标从逻辑屏映射到纹理:统一按目标尺寸缩放绘制
  let _vw = 0, _vh = 0, _scale = 1;
  function setViewport(w, h) {
    _vw = w; _vh = h;
    _scale = Math.min(uiCanvas.width / w, uiCanvas.height / h);
  }
  setViewport(vw0, vh0);
  const _W = () => _vw, _H = () => _vh;

  // ---- 虚拟元素(与 H5 index.html 的 id 一一对应) ----
  const els = {
    hud: makeVirtualEl('hud'),
    'screen-start': makeVirtualEl('screen-start'),
    'screen-over': makeVirtualEl('screen-over'),
    'btn-start': makeVirtualEl('btn-start'),
    'btn-restart': makeVirtualEl('btn-restart'),
    'btn-mama': makeVirtualEl('btn-mama'),
    'mama-fill': makeVirtualEl('mama-fill'),
    'hud-score': makeVirtualEl('hud-score'),
    'hud-dist': makeVirtualEl('hud-dist'),
    'hud-coins': makeVirtualEl('hud-coins'),
    'over-dist': makeVirtualEl('over-dist'),
    'over-coins': makeVirtualEl('over-coins'),
    'over-score': makeVirtualEl('over-score'),
  };
  els['screen-start'].style.display = 'flex';
  els['screen-over'].style.display = 'none';
  els.hud.style.display = 'none';
  els['btn-mama'].style.display = 'none';

  const W = () => _W();
  const H = () => _H();
  const S = () => Math.min(W(), H()) / 420; // 缩放基准(以 420 短边设计)

  // ---- 命中区域 ----
  const hit = { startBtn: null, restartBtn: null, mamaBtn: null };

  function card(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawStart() {
    const s = S();
    // 半透明纸底遮罩
    ctx.fillStyle = 'rgba(244,237,218,.55)';
    ctx.fillRect(0, 0, W(), H());
    // 面板
    const pw = Math.min(W() * 0.92, 560 * s);
    const ph = 500 * s;
    const px = (W() - pw) / 2, py = (H() - ph) / 2;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    card(px, py, pw, ph, 14 * s); ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'rgba(51,53,46,.28)'; ctx.shadowOffsetX = 6 * s; ctx.shadowOffsetY = 6 * s;

    let y = py + 40 * s;
    // 印章
    ctx.save();
    ctx.translate(px + pw / 2, y + 14 * s); ctx.rotate(-0.07);
    ctx.fillStyle = SEAL; card(-92 * s, -16 * s, 184 * s, 34 * s, 6 * s); ctx.fill();
    ctx.fillStyle = PAPER; ctx.font = font(15 * s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('纯手工·不用 AI', 0, 2 * s);
    ctx.restore();
    y += 62 * s;

    // 标题
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = font(Math.min(64 * s, pw / 6), true);
    ctx.fillText('牛来·梦境狂奔', W() / 2, y + 10 * s);
    y += 42 * s;
    ctx.fillStyle = SOFT; ctx.font = font(17 * s);
    ctx.fillText('—— 致敬国产动画电影《牛来》 ——', W() / 2, y);
    y += 40 * s;

    // 操作说明
    ctx.font = font(16 * s); ctx.fillStyle = SOFT;
    const lines = [
      '怯懦的小牛犊「牛来」坠入梦境',
      '← → 换道    ↑ / 空格 跳跃    ↓ 滑铲',
      '躲开狼群、豹拉与灵蛇,收集草料,跑出草原!',
      '吃满能量 → 点「妈妈」:冲刺撞碎一切,双倍分!',
    ];
    for (const ln of lines) { ctx.fillText(ln, W() / 2, y); y += 30 * s; }
    y += 22 * s;

    // 开始按钮
    const bw = 240 * s, bh = 62 * s;
    const bx = (W() - bw) / 2, by = y;
    ctx.fillStyle = INK;
    ctx.shadowColor = 'rgba(181,69,60,.6)'; ctx.shadowOffsetX = 4 * s; ctx.shadowOffsetY = 4 * s;
    card(bx, by, bw, bh, 10 * s); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = PAPER; ctx.font = font(24 * s, true);
    ctx.fillText('入  梦', bx + bw / 2, by + bh / 2 + 9 * s);
    hit.startBtn = { x: bx, y: by, w: bw, h: bh };

    // 灵蛇语录
    ctx.fillStyle = SOFT; ctx.font = font(13 * s);
    ctx.fillText('「世间从无安稳,要学会警觉自立。」—— 灵蛇', W() / 2, py + ph - 26 * s);
  }

  function drawOver() {
    const s = S();
    ctx.fillStyle = 'rgba(244,237,218,.55)';
    ctx.fillRect(0, 0, W(), H());
    const pw = Math.min(W() * 0.92, 480 * s);
    const ph = 430 * s;
    const px = (W() - pw) / 2, py = (H() - ph) / 2;
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    card(px, py, pw, ph, 14 * s); ctx.fill(); ctx.stroke();

    let y = py + 40 * s;
    ctx.save();
    ctx.translate(px + pw / 2, y + 14 * s); ctx.rotate(-0.07);
    ctx.fillStyle = SEAL; card(-52 * s, -16 * s, 104 * s, 34 * s, 6 * s); ctx.fill();
    ctx.fillStyle = PAPER; ctx.font = font(15 * s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('梦 醒', 0, 2 * s);
    ctx.restore();
    y += 66 * s;

    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = font(40 * s, true);
    ctx.fillText('牛来,醒一醒!', W() / 2, y);
    y += 46 * s;

    ctx.font = font(21 * s);
    ctx.fillStyle = SOFT;
    const d = els['over-dist'].textContent || '0';
    const c = els['over-coins'].textContent || '0';
    const sc = els['over-score'].textContent || '0';
    ctx.fillText('奔跑里程 ' + d + ' 米', W() / 2, y); y += 38 * s;
    ctx.fillText('草料 ' + c + ' 捆 · 得分 ' + sc, W() / 2, y); y += 52 * s;

    ctx.fillStyle = SOFT; ctx.font = font(14 * s);
    ctx.fillText('牛来:「妈妈——!」', W() / 2, y); y += 40 * s;

    const bw = 300 * s, bh = 62 * s;
    const bx = (W() - bw) / 2, by = y;
    ctx.fillStyle = INK;
    ctx.shadowColor = 'rgba(181,69,60,.6)'; ctx.shadowOffsetX = 4 * s; ctx.shadowOffsetY = 4 * s;
    card(bx, by, bw, bh, 10 * s); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = PAPER; ctx.font = font(23 * s, true);
    ctx.fillText('再 入 梦 境', bx + bw / 2, by + bh / 2 + 9 * s);
    hit.restartBtn = { x: bx, y: by, w: bw, h: bh };
  }

  function drawHud() {
    const s = S();
    ctx.textBaseline = 'middle';
    // 三张卡
    const cards = [
      { label: '牛来', val: els['hud-score'].textContent, w: 128 },
      { label: '里程', val: els['hud-dist'].textContent + ' 米', w: 150 },
      { label: '草料', val: els['hud-coins'].textContent, w: 118 },
    ];
    let x = 14 * s;
    for (const c of cards) {
      const cw = c.w * s, ch = 44 * s;
      ctx.fillStyle = 'rgba(244,237,218,.88)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      card(x, 14 * s, cw, ch, 10 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = SOFT; ctx.font = font(17 * s); ctx.textAlign = 'left';
      ctx.fillText(c.label, x + 12 * s, 14 * s + ch / 2);
      ctx.fillStyle = SEAL; ctx.font = font(20 * s, true); ctx.textAlign = 'right';
      ctx.fillText(String(c.val), x + cw - 12 * s, 14 * s + ch / 2 + 1);
      x += cw + 10 * s;
    }
    ctx.textAlign = 'left';
  }

  function drawMamaBtn(t) {
    if (els['btn-mama'].style.display === 'none') return;
    const s = S();
    const r = 46 * s;
    const cx = W() - r - 22 * s, cy = H() - r - 26 * s;
    const ready = els['btn-mama'].classList.contains('ready');
    const active = els['btn-mama'].classList.contains('active');
    const e = els['mama-fill'].style.width || '0%';

    // 能量填充(从底部上升)
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - 5 * s, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = active ? SEAL : 'rgba(181,69,60,.85)';
    const fh = (r - 5 * s) * 2 * (parseFloat(e) / 100 || 0);
    ctx.fillRect(cx - r, cy + (r - 5 * s) - fh, r * 2, fh);
    ctx.restore();

    // 主体
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? SEAL : INK; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = ready ? SEAL : INK; ctx.stroke();
    if (ready && !active) {
      const pulse = 5 + Math.sin(t * 6) * 3;
      ctx.beginPath(); ctx.arc(cx, cy, r + pulse * s, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(181,69,60,.35)'; ctx.stroke();
    }
    ctx.fillStyle = PAPER; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font(24 * s, true);
    ctx.fillText('妈妈', cx, cy - 6 * s);
    ctx.font = font(10 * s);
    ctx.fillText('点按释放', cx, cy + 16 * s);
    hit.mamaBtn = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  }

  // ---- 主绘制(画在自身离屏 canvas,逻辑坐标 = 视口坐标) ----
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    ctx.save();
    ctx.scale(_scale, _scale);
    if (els['screen-start'].style.display !== 'none') drawStart();
    else if (els['screen-over'].style.display !== 'none') drawOver();
    else {
      if (els.hud.style.display !== 'none') drawHud();
      drawMamaBtn(t);
    }
    ctx.restore();
  }

  // ---- 触摸命中 ----
  function onTap(x, y) {
    const inRect = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inRect(hit.startBtn) && els['btn-start']._onclick) { els['btn-start']._onclick(); return true; }
    if (inRect(hit.restartBtn) && els['btn-restart']._onclick) { els['btn-restart']._onclick(); return true; }
    if (inRect(hit.mamaBtn) && els['btn-mama']._onclick) { els['btn-mama']._onclick(); return true; }
    return false;
  }

  return { els, render, onTap, canvas: uiCanvas, setViewport };
}
