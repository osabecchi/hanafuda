'use strict';
/* 花暦 — core: 小道具・セーブ・音(WebAudio でその場で合成) */
const HG = window.HG = {};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => {
  if (!isFinite(n)) return '∞';
  n = Math.floor(n);
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + '兆';
  if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '億';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const fmtBai = b => {
  if (!isFinite(b)) return '∞';
  if (b >= 1e6) return fmt(b);
  if (Math.abs(b - Math.round(b)) < 0.005) return String(Math.round(b));
  return b < 100 ? b.toFixed(2).replace(/0$/, '') : b.toFixed(1);
};
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------------- セーブ ---------------- */
const SAVE_KEY = 'hanagoyomi-save-v1';
const RUN_KEY = 'hanagoyomi-run-v1';
function defaultSave() {
  return {
    v: 1, kinpaku: 0, kinpakuTotal: 0, upg: {}, decks: { hana: 1, shu: 1 }, stakeMax: 1, deckClear: {},
    dex: {}, omaDex: {}, ach: {}, yaku: {}, bossKill: {}, unlockSeen: {},
    best: { month: 0, play: 0, total: 0, ryo: 0, stake: 0, endless: 0, clearTime: 0 },
    stats: { runs: 0, wins: 0, bosses: 0, clears: 0, plays: 0, discards: 0, ema: 0, evolve: 0, oneShot: 0, kinScored: 0, hikariScored: 0,
      maxYaku: 0, fullKami: 0, thinDeck: 0, oneCard300: 0, oneCard1000: 0, koikoi: 0, daily: 0, bossNoKami: 0, maxLv: 0, goyomiTan: 0,
      playTime: 0, ryoEarned: 0, cards: 0, losses: 0 },
    daily: {},
    last: { deck: 'hana', stake: 1 },
    set: { master: 0.8, bgm: 0.55, sfx: 0.8, quality: 2, shake: 1, flash: 1, speed: 0, guide: true },
    tut: {}
  };
}
function mergeDeep(def, src) {
  if (!src || typeof src !== 'object' || Array.isArray(def) || def === null || typeof def !== 'object') return src === undefined ? def : src;
  const out = {};
  for (const k in def) out[k] = (k in src) ? mergeDeep(def[k], src[k]) : def[k];
  for (const k in src) if (!(k in out)) out[k] = src[k];
  return out;
}
let SAVE = defaultSave();
let STORAGE_OK = true;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) SAVE = mergeDeep(defaultSave(), JSON.parse(raw));
} catch (e) { STORAGE_OK = false; }
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { STORAGE_OK = false; }
}
function saveRun(run) {
  try {
    if (!run || run.over || run.phase === 'clear') localStorage.removeItem(RUN_KEY);
    else localStorage.setItem(RUN_KEY, saveableRun(run));
  } catch (e) { /* 保存できない環境でも遊べる */ }
}
function loadRun() {
  try { const raw = localStorage.getItem(RUN_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function clearRunSave() { try { localStorage.removeItem(RUN_KEY); } catch (e) { } }

/* ---------------- 音 ----------------
   箏(こと)は Karplus-Strong で作った音を高さを変えて鳴らす。太鼓・鐘・拍子木・紙の音も合成 */
const AU = { ctx: null, master: null, sfxG: null, bgmG: null, noise: null, koto: null, shami: null, last: {}, bgm: null, step: 0, nextT: 0, timer: 0, mood: 'title' };
const YO = [0, 2, 5, 7, 9];          // 陽音階
const MIYAKO = [0, 1, 5, 7, 8];      // 都節
AU.init = function () {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  let ctx;
  try { ctx = AU.ctx = new C(); } catch (e) { return; }
  AU.master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
  AU.master.connect(comp); comp.connect(ctx.destination);
  AU.sfxG = ctx.createGain(); AU.sfxG.connect(AU.master);
  AU.bgmG = ctx.createGain(); AU.bgmG.connect(AU.master);
  // 少しだけ響き(短いディレイ)
  const dl = ctx.createDelay(0.5), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
  dl.delayTime.value = 0.19; fb.gain.value = 0.28; wet.gain.value = 0.22; lp.type = 'lowpass'; lp.frequency.value = 2400;
  AU.verb = ctx.createGain();
  AU.verb.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(AU.master);
  AU.applyVol();
  const sr = ctx.sampleRate;
  AU.noise = ctx.createBuffer(1, sr, sr);
  const nd = AU.noise.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  AU.koto = AU.ks(220, 2.2, 0.9965, 0.5);
  AU.shami = AU.ks(330, 1.2, 0.992, 0.95);
  AU.timer = setInterval(AU.sched, 30);
};
AU.ks = function (f, dur, decay, bright) {
  const ctx = AU.ctx, sr = ctx.sampleRate, n = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * (1 - bright) + r * bright; ring[i] = prev; }
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[idx], b = ring[(idx + 1) % N];
    const v = (a + b) * 0.5 * decay;
    ring[idx] = v;
    d[i] = a;
    idx = (idx + 1) % N;
  }
  // 撥のアタック
  for (let i = 0; i < Math.min(n, 400); i++) d[i] *= 1 + (1 - i / 400) * 0.6;
  return buf;
};
AU.applyVol = function () {
  if (!AU.ctx) return;
  const s = SAVE.set;
  AU.master.gain.value = s.master;
  AU.sfxG.gain.value = s.sfx * 0.7;
  AU.bgmG.gain.value = s.bgm * 0.36;
};
function sNode(out) { return out || AU.sfxG; }
function tone(type, f0, f1, dur, vol, out, t0, attack) {
  const ctx = AU.ctx; if (!ctx) return;
  const t = t0 || ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sNode(out));
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, vol, type, f0, f1, out, t0, q) {
  const ctx = AU.ctx; if (!ctx) return;
  const t = t0 || ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = AU.noise;
  s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sNode(out));
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function pluck(buf, f, baseF, vol, out, t0, pan) {
  const ctx = AU.ctx; if (!ctx || !buf) return;
  const t = t0 || ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = buf;
  s.playbackRate.value = f / baseF;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sNode(out)); if (out !== AU.bgmG) p.connect(AU.verb); }
  else { g.connect(sNode(out)); if (out !== AU.bgmG) g.connect(AU.verb); }
  s.start(t);
}
function scaleFreq(base, scale, i) {
  const oct = Math.floor(i / scale.length), deg = ((i % scale.length) + scale.length) % scale.length;
  return base * Math.pow(2, (oct * 12 + scale[deg]) / 12);
}
function rate(name, ms) {
  const now = performance.now();
  if (AU.last[name] && now - AU.last[name] < ms) return false;
  AU.last[name] = now;
  return true;
}
const SFX = {
  tap() { if (!AU.ctx || !rate('tap', 30)) return; noiseHit(0.05, 0.25, 'bandpass', 2600, 1800, null, 0, 2); },
  select(i) { if (!AU.ctx) return; pluck(AU.koto, scaleFreq(440, YO, (i || 0) % 8), 220, 0.32); noiseHit(0.04, 0.15, 'highpass', 3000); },
  deselect() { if (!AU.ctx) return; pluck(AU.koto, 330, 220, 0.18); },
  deal(i) { if (!AU.ctx || !rate('deal', 25)) return; noiseHit(0.09, 0.22, 'bandpass', 1800 + (i || 0) * 60, 900, null, 0, 0.8); },
  slap() {   // 札を打つ「パチン」
    if (!AU.ctx || !rate('slap', 35)) return;
    const t = AU.ctx.currentTime;
    noiseHit(0.035, 0.9, 'highpass', 2600, 0, null, t, 0.7);
    noiseHit(0.08, 0.35, 'bandpass', 900, 400, null, t, 1.5);
    tone('sine', 160, 70, 0.09, 0.5, null, t);
  },
  wood() { if (!AU.ctx) return; tone('sine', 1150, 1100, 0.07, 0.4); noiseHit(0.03, 0.3, 'bandpass', 2200, 0, null, 0, 6); },
  hyoshigi() {   // 勝負のはじめ「カン、カン」
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    for (const dt of [0, 0.32]) { tone('square', 1900, 1850, 0.05, 0.12, null, t + dt); noiseHit(0.05, 0.55, 'bandpass', 2600, 0, null, t + dt, 8); tone('sine', 950, 940, 0.12, 0.3, null, t + dt); }
  },
  ten(i) {   // 点が乗る: 木の音が少しずつ高く
    if (!AU.ctx || !rate('ten', 22)) return;
    const f = scaleFreq(660, YO, Math.min(14, i || 0));
    tone('triangle', f, f * 0.98, 0.07, 0.22);
    noiseHit(0.025, 0.12, 'bandpass', f * 2, 0, null, 0, 5);
  },
  bai(i) {   // 倍が乗る: 箏の音が音階を上がる
    if (!AU.ctx || !rate('bai', 25)) return;
    const f = scaleFreq(293.66, YO, Math.min(19, i || 0));
    pluck(AU.koto, f, 220, 0.55, null, 0, (Math.random() - 0.5) * 0.4);
    pluck(AU.koto, f * 2, 220, 0.12);
  },
  mul(i) {   // 掛け算: 太鼓+鐘
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    const f = scaleFreq(293.66, YO, Math.min(19, i || 0));
    SFX.taiko(0.9);
    tone('sine', f * 2, f * 2, 1.2, 0.28, null, t + 0.01);
    tone('sine', f * 2 * 2.76, f * 2 * 2.7, 0.6, 0.08, null, t + 0.01);
    pluck(AU.shami, f, 330, 0.5, null, t);
  },
  taiko(v) {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    tone('sine', 120, 52, 0.45, 0.8 * (v || 1), null, t, 0.002);
    noiseHit(0.12, 0.4 * (v || 1), 'lowpass', 600, 120, null, t);
  },
  bell(f, vol) {   // 鐘(FM)
    const ctx = AU.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.6);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    car.connect(g); g.connect(AU.sfxG); g.connect(AU.verb);
    car.start(t); mod.start(t); car.stop(t + 2.5); mod.stop(t + 2.5);
  },
  yaku(big) {   // 役ができた
    if (!AU.ctx) return;
    SFX.taiko(big ? 1.1 : 0.7);
    const t = AU.ctx.currentTime;
    const notes = big ? [0, 2, 3, 4, 5] : [0, 2, 4];
    notes.forEach((n, i) => pluck(AU.koto, scaleFreq(392, YO, n), 220, 0.4, null, t + i * 0.055));
    if (big) SFX.bell(784, 0.25);
  },
  total(big) {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    SFX.taiko(1.2);
    noiseHit(0.5, 0.25, 'bandpass', 5000, 2000, null, t, 0.6);
    [0, 2, 4, 5, 7].forEach((n, i) => pluck(AU.shami, scaleFreq(330, YO, n + (big ? 2 : 0)), 330, 0.35, null, t + 0.04 * i));
    if (big) { SFX.bell(659, 0.3); SFX.bell(988, 0.2); }
  },
  count() { if (!AU.ctx || !rate('count', 45)) return; tone('triangle', 1600 + Math.random() * 200, 1500, 0.03, 0.08); },
  coin() {
    if (!AU.ctx || !rate('coin', 60)) return;
    const t = AU.ctx.currentTime;
    tone('sine', 2093, 2093, 0.25, 0.18, null, t); tone('sine', 3136, 3136, 0.3, 0.12, null, t + 0.06); tone('sine', 2637, 2637, 0.3, 0.1, null, t + 0.11);
  },
  win() {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    SFX.hyoshigi();
    [0, 2, 4, 5, 7, 9].forEach((n, i) => pluck(AU.koto, scaleFreq(392, YO, n), 220, 0.45, null, t + 0.5 + i * 0.08, i % 2 ? 0.3 : -0.3));
    SFX.bell(784, 0.2);
  },
  lose() {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    [4, 2, 1, 0].forEach((n, i) => pluck(AU.koto, scaleFreq(196, MIYAKO, n), 220, 0.5, null, t + i * 0.32));
    tone('sine', 98, 60, 1.6, 0.4, null, t + 1.0);
  },
  stamp() { if (!AU.ctx) return; SFX.taiko(0.6); noiseHit(0.06, 0.5, 'lowpass', 900, 200); },
  buy() { SFX.coin(); if (AU.ctx) pluck(AU.koto, 587, 220, 0.3); },
  error() { if (!AU.ctx) return; tone('square', 180, 150, 0.15, 0.08); },
  page() { if (!AU.ctx || !rate('page', 60)) return; noiseHit(0.16, 0.2, 'bandpass', 1200, 3000, null, 0, 0.7); },
  evolve() {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((n, i) => pluck(AU.koto, scaleFreq(293.66, YO, n), 220, 0.4, null, t + i * 0.06));
    SFX.bell(587, 0.3); setTimeout(() => SFX.bell(880, 0.25), 450);
  }
};

/* ---------------- BGM: 箏と笙の、ゆっくりした自動演奏 ---------------- */
const MOODS = {
  title: { bpm: 66, scale: YO, root: 146.83, density: 0.5, drone: [0, 7, 14], taiko: 0 },
  play: { bpm: 80, scale: YO, root: 164.81, density: 0.55, drone: [0, 7, 12], taiko: 0 },
  boss: { bpm: 92, scale: MIYAKO, root: 146.83, density: 0.7, drone: [0, 7, 13], taiko: 1 },
  shop: { bpm: 96, scale: YO, root: 196, density: 0.62, drone: [0, 12], taiko: 0, shami: 1 },
  result: { bpm: 60, scale: YO, root: 146.83, density: 0.35, drone: [0, 7, 12], taiko: 0 }
};
AU.setMood = function (m) {
  if (AU.mood === m) return;
  AU.mood = m;
  AU.stopDrone();
  AU.step = 0;
};
AU.stopDrone = function () {
  if (AU.drone) { const t = AU.ctx.currentTime; AU.drone.forEach(d => { d.g.gain.cancelScheduledValues(t); d.g.gain.setTargetAtTime(0.0001, t, 0.6); d.o.stop(t + 3); }); AU.drone = null; }
};
AU.startDrone = function (M) {
  const ctx = AU.ctx, t = ctx.currentTime;
  AU.drone = M.drone.map((semi, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = M.root * Math.pow(2, semi / 12) * (i % 2 ? 1.003 : 0.998);
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(0.045 / M.drone.length * 2, t, 1.8);
    o.connect(f); f.connect(g); g.connect(AU.bgmG);
    o.start(t);
    return { o, g };
  });
};
AU.sched = function () {
  const ctx = AU.ctx;
  if (!ctx || ctx.state !== 'running') return;
  const M = MOODS[AU.mood] || MOODS.play;
  if (SAVE.set.bgm <= 0.001) { AU.stopDrone(); return; }
  if (!AU.drone) { AU.startDrone(M); AU.nextT = ctx.currentTime + 0.1; }
  const spb = 60 / M.bpm / 2;   // 8分音符
  while (AU.nextT < ctx.currentTime + 0.2) {
    const s = AU.step++;
    const t = AU.nextT;
    const bar = Math.floor(s / 16), pos = s % 16;
    // 箏の旋律: 小節ごとにゆるく形を変える
    const r = (Math.sin(s * 12.9898 + bar * 78.233) * 43758.5453) % 1;
    const rr = Math.abs(r);
    if ((pos % 4 === 0 && rr < 0.9) || rr < M.density * 0.45) {
      const deg = Math.floor(Math.abs(Math.sin(bar * 3.1 + pos * 0.7)) * 7) + (pos === 0 ? 0 : 2);
      pluck(AU.koto, scaleFreq(M.root * 2, M.scale, deg), 220, 0.32 + (pos === 0 ? 0.15 : 0), AU.bgmG, t, (rr - 0.5) * 0.6);
      if (pos === 0 && bar % 2 === 0) pluck(AU.koto, scaleFreq(M.root, M.scale, 0), 220, 0.35, AU.bgmG, t);
    }
    if (M.shami && pos % 4 === 2 && rr < 0.7) pluck(AU.shami, scaleFreq(M.root * 2, M.scale, 4 + (pos % 8 === 2 ? 1 : 0)), 330, 0.2, AU.bgmG, t);
    if (M.taiko && (pos === 0 || pos === 8 || (pos === 14 && bar % 2))) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pos === 0 ? 0.55 : 0.32, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(AU.bgmG); o.start(t); o.stop(t + 0.45);
    }
    AU.nextT += spb;
  }
};
