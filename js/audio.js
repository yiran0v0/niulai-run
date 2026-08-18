// audio.js —— 极简 WebAudio 合成音效（无素材，致敬“纯手搓”）
// 首次用户手势后懒初始化；任何失败静默忽略，不影响游戏。
let ctx = null;
let enabled = true;

export function initAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type, gain, delay, slideTo) {
  if (!ctx || !enabled) return;
  try {
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) { /* 静默 */ }
}

export const sfx = {
  jump: () => tone(320, 0.18, 'square', 0.06, 0, 560),
  slide: () => tone(220, 0.22, 'sawtooth', 0.045, 0, 120),
  collect: () => { tone(660, 0.09, 'sine', 0.1); tone(990, 0.14, 'sine', 0.08, 0.07); },
  bell: () => { tone(1320, 0.2, 'triangle', 0.1); tone(1760, 0.3, 'triangle', 0.07, 0.1); },
  crash: () => { tone(160, 0.35, 'sawtooth', 0.16, 0, 55); tone(90, 0.4, 'square', 0.12, 0.03, 40); },
  start: () => { tone(392, 0.12, 'triangle', 0.09); tone(523, 0.12, 'triangle', 0.09, 0.1); tone(659, 0.2, 'triangle', 0.09, 0.2); },
};
