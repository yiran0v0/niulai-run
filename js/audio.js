// audio.js —— 极简 WebAudio 合成音效 + 真人语音采样
// 新增：人声采样层 —— audio/ 目录下的录音（死亡长喊/技能短喊/搞笑短音）
// 即可自动加载；缺失时静默回退到合成音，不影响游戏。
// 首次用户手势后懒初始化；任何失败静默忽略。
let ctx = null;
let enabled = true;
let samplesLoaded = false;

export function initAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (!samplesLoaded) { samplesLoaded = true; preloadSamples(); }
  } catch (e) { ctx = null; }
}

// ---------- 人声采样层 ----------
const samples = {}; // name -> AudioBuffer

async function loadSample(name, url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return;
    const buf = await r.arrayBuffer();
    if (!ctx) return;
    samples[name] = await ctx.decodeAudioData(buf);
  } catch (e) { /* 静默：无采样则回退合成音 */ }
}

export function preloadSamples() {
  loadSample('mamaDie', 'audio/mama_v1.m4a');    // 死亡：完整版撕心裂肺“妈妈”
  loadSample('mamaDash', 'audio/take_08.m4a');   // 技能：短促“妈妈！”
  loadSample('mamaFunny', 'audio/take_09.m4a');  // 收集：短促怪叫
  loadSample('mamaBell', 'audio/take_03.m4a');   // 铜铃：短促喊声
}

const lastSampleAt = {};
const SAMPLE_MIN_GAP = { mamaFunny: 0.4, mamaBell: 0.35 };

function playSample(name, { rate = 1, gain = 0.9, when = 0 } = {}) {
  const buf = samples[name];
  if (!buf || !ctx || !enabled) return false;
  const now = performance.now();
  if (now - (lastSampleAt[name] || 0) < (SAMPLE_MIN_GAP[name] || 0.05) * 1000) return true;
  lastSampleAt[name] = now;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + (when || 0));
    return true;
  } catch (e) { return false; }
}

// ---------- 合成音回退 ----------
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

// 合成“哞~妈妈”回退：下行双音，模仿怯懦小牛惨叫
function fallbackMamaDie() {
  tone(300, 0.5, 'sawtooth', 0.14, 0, 90);
  tone(190, 0.6, 'square', 0.1, 0.18, 70);
  tone(140, 0.7, 'triangle', 0.08, 0.32, 60);
}

// 合成冲刺回退：上冲“哞——！”
function fallbackMamaDash() {
  tone(160, 0.4, 'sawtooth', 0.14, 0, 420);
  tone(320, 0.25, 'square', 0.08, 0.12, 640);
}

export const sfx = {
  jump: () => tone(320, 0.18, 'square', 0.06, 0, 560),
  slide: () => tone(220, 0.22, 'sawtooth', 0.045, 0, 120),
  collect: () => { tone(660, 0.09, 'sine', 0.1); tone(990, 0.14, 'sine', 0.08, 0.07); },
  bell: () => { tone(1320, 0.2, 'triangle', 0.1); tone(1760, 0.3, 'triangle', 0.07, 0.1); },
  crash: () => { tone(160, 0.35, 'sawtooth', 0.16, 0, 55); tone(90, 0.4, 'square', 0.12, 0.03, 40); },
  start: () => { tone(392, 0.12, 'triangle', 0.09); tone(523, 0.12, 'triangle', 0.09, 0.1); tone(659, 0.2, 'triangle', 0.09, 0.2); },

  // 妈妈技能触发：喊“妈妈！”（采样优先，回退合成）
  mamaDash: () => { if (!playSample('mamaDash', { rate: 1.05, gain: 0.95 })) fallbackMamaDash(); },
  // 死亡惨叫“妈妈——！”（采样优先，回退合成）
  mamaDie: () => {
    if (!playSample('mamaDie', { gain: 1.0 })) fallbackMamaDie();
    if (Math.random() < 0.35) playSample('mamaFunny', { rate: 1.1, gain: 0.5, when: 0.55 });
  },
  // 收集草料：随机搞笑短音（采样可选，无则保持安静不吵）
  hayFunny: () => { playSample('mamaFunny', { gain: 0.5 }); },
  // 收集铜铃：短促喊声（采样可选）
  bellVoice: () => { playSample('mamaBell', { gain: 0.65 }); },
  // 撞碎障碍的闷响
  smash: () => { tone(200, 0.16, 'square', 0.12, 0, 70); tone(90, 0.2, 'sawtooth', 0.09, 0.02, 45); },
  // 能量攒满的“叮”
  energyFull: () => { tone(880, 0.12, 'sine', 0.1); tone(1320, 0.2, 'sine', 0.09, 0.08); },
};
