'use strict';
/* 花暦 — fx: 花びら・金箔・火花・数字のポップ・画面の光と揺れ(いちばん上の canvas に描く) */
const FX = { cv: null, c: null, w: 1, h: 1, dpr: 1, parts: [], pops: [], flash: 0, flashCol: '255,236,180', shake: 0, sx: 0, sy: 0, ambient: 0, ambMonth: 3, ambT: 0 };
const PETAL = {
  1: { col: ['#3f7a4a', '#2f5d3a'], shape: 'needle' }, 2: { col: ['#c8304a', '#e0607a'], shape: 'round' }, 3: { col: ['#f6b8c8', '#f0a0b4', '#fde0e8'], shape: 'sakura' },
  4: { col: ['#9a7ac8', '#7b5ea7'], shape: 'round' }, 5: { col: ['#4a52a8', '#6a72c0'], shape: 'leaf' }, 6: { col: ['#e27a8e', '#c4304a'], shape: 'sakura' },
  7: { col: ['#c05a8a', '#d0609a', '#5b8a3a'], shape: 'round' }, 8: { col: ['#e8d8b0', '#c9a35a'], shape: 'fluff' }, 9: { col: ['#e6b422', '#f0c84a', '#c8402a'], shape: 'leaf' },
  10: { col: ['#d0402a', '#e07a2a', '#e6b422'], shape: 'maple' }, 11: { col: ['#5b8a3a', '#7aa04a'], shape: 'leaf' }, 12: { col: ['#8a6aaa', '#e6b422'], shape: 'round' }
};
FX.init = function () {
  FX.cv = document.getElementById('fx');
  FX.c = FX.cv.getContext('2d');
  FX.resize();
};
FX.resize = function () {
  const q = SAVE.set.quality;
  FX.dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.5 : 1);
  FX.w = window.innerWidth; FX.h = window.innerHeight;
  FX.cv.width = Math.round(FX.w * FX.dpr); FX.cv.height = Math.round(FX.h * FX.dpr);
};
FX.cap = () => [90, 220, 420][SAVE.set.quality] || 220;
function addPart(p) { if (FX.parts.length < FX.cap()) FX.parts.push(p); }
/* kind: gold / petal / spark / ring / ink */
FX.burst = function (x, y, kind, n, o) {
  o = o || {};
  const m = o.month || FX.ambMonth;
  const mult = [0.45, 0.75, 1][SAVE.set.quality] || 1;
  n = Math.max(1, Math.round(n * mult));
  for (let i = 0; i < n; i++) {
    const a = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * (o.spread || 1.2) : Math.random() * TAU;
    const sp = (o.speed || 220) * (0.35 + Math.random() * 0.8);
    const p = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 60), life: 0, max: (o.life || 1.2) * (0.6 + Math.random() * 0.6), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, ph: Math.random() * TAU, s: (o.size || 1) * (0.7 + Math.random() * 0.6), g: o.g !== undefined ? o.g : 260 };
    if (kind === 'petal') { const P = PETAL[m] || PETAL[3]; p.col = P.col[Math.floor(Math.random() * P.col.length)]; p.shape = P.shape; p.g = 60; p.drag = 1.6; }
    if (kind === 'gold') { p.g = 120; p.drag = 1.2; }
    if (kind === 'spark') { p.g = 0; p.drag = 3; p.col = o.col || '255,220,120'; }
    if (kind === 'ink') { p.col = o.col || '#1f1a17'; p.g = 500; }
    addPart(p);
  }
};
FX.ring = function (x, y, col, r) { addPart({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0, max: 0.5, r: r || 120, col: col || '232,180,60', g: 0 }); };
/* 数字のポップ */
FX.pop = function (x, y, text, col, size, o) {
  o = o || {};
  FX.pops.push({ x, y, text, col: col || '#2c4a8e', size: size || 22, life: 0, max: o.life || 0.95, rise: o.rise || 34, delay: 0 });
  if (FX.pops.length > 40) FX.pops.shift();
};
FX.flashOn = function (a, col) {
  const k = SAVE.set.flash;
  if (k <= 0) return;
  if (a * k > FX.flash) { FX.flash = a * k; FX.flashCol = col || '255,236,180'; }
};
FX.shakeOn = function (a) { FX.shake = Math.max(FX.shake, a * SAVE.set.shake); };
FX.setAmbient = function (n, month) { FX.ambient = n; if (month) FX.ambMonth = month; };

FX.update = function (dt) {
  // 舞い散る花びら(背景)
  if (FX.ambient > 0 && SAVE.set.quality > 0) {
    FX.ambT -= dt;
    if (FX.ambT <= 0) {
      FX.ambT = 1 / FX.ambient;
      const P = PETAL[FX.ambMonth] || PETAL[3];
      addPart({ kind: 'petal', amb: 1, x: Math.random() * FX.w * 1.2 - FX.w * 0.1, y: -12, vx: 18 + Math.random() * 25, vy: 30 + Math.random() * 30, life: 0, max: 14, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, ph: Math.random() * TAU, s: 0.8 + Math.random() * 0.5, g: 0, drag: 0, col: P.col[Math.floor(Math.random() * P.col.length)], shape: P.shape });
    }
  }
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life += dt;
    if (p.life >= p.max || p.y > FX.h + 40) { FX.parts.splice(i, 1); continue; }
    if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
    p.vy += p.g * dt;
    if (p.kind === 'petal') { p.ph += dt * 3; p.vx += Math.sin(p.ph) * 30 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.ph += dt * 6;
  }
  for (let i = FX.pops.length - 1; i >= 0; i--) { const p = FX.pops[i]; p.life += dt; if (p.life >= p.max) FX.pops.splice(i, 1); }
  FX.flash = Math.max(0, FX.flash - dt * 2.6);
  if (FX.shake > 0.1) {
    FX.shake *= Math.exp(-dt * 9);
    FX.sx = (Math.random() - 0.5) * FX.shake; FX.sy = (Math.random() - 0.5) * FX.shake;
  } else { FX.shake = 0; FX.sx = FX.sy = 0; }
};
function petalPath(c, shape, s) {
  c.beginPath();
  if (shape === 'sakura') { c.moveTo(0, 6 * s); c.bezierCurveTo(-6 * s, 2 * s, -5 * s, -6 * s, -1.2 * s, -6 * s); c.lineTo(0, -4.5 * s); c.lineTo(1.2 * s, -6 * s); c.bezierCurveTo(5 * s, -6 * s, 6 * s, 2 * s, 0, 6 * s); }
  else if (shape === 'maple') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; c.lineTo(Math.cos(a) * 7 * s, Math.sin(a) * 7 * s); c.lineTo(Math.cos(a + 0.6) * 3 * s, Math.sin(a + 0.6) * 3 * s); } }
  else if (shape === 'leaf') { c.moveTo(0, -7 * s); c.quadraticCurveTo(3.5 * s, 0, 0, 7 * s); c.quadraticCurveTo(-3.5 * s, 0, 0, -7 * s); }
  else if (shape === 'needle') { c.rect(-0.8 * s, -6 * s, 1.6 * s, 12 * s); }
  else if (shape === 'fluff') { c.ellipse(0, 0, 2 * s, 6 * s, 0, 0, TAU); }
  else c.ellipse(0, 0, 4.5 * s, 4 * s, 0, 0, TAU);
}
FX.draw = function () {
  const c = FX.c;
  c.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
  c.clearRect(0, 0, FX.w, FX.h);
  for (const p of FX.parts) {
    const t = p.life / p.max, a = p.amb ? Math.min(1, (p.max - p.life) / 2) * 0.85 : 1 - t * t;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = a;
    if (p.kind === 'gold') {
      const sx = Math.cos(p.ph) * p.s * 5, sy = p.s * 5;
      const light = 0.5 + 0.5 * Math.sin(p.ph);
      c.fillStyle = 'rgb(' + Math.round(200 + 55 * light) + ',' + Math.round(150 + 80 * light) + ',' + Math.round(40 + 90 * light) + ')';
      c.fillRect(-sx, -sy, sx * 2, sy * 1.6);
    } else if (p.kind === 'petal') {
      c.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.ph * 0.5)));
      petalPath(c, p.shape, p.s); c.fillStyle = p.col; c.fill();
    } else if (p.kind === 'spark') {
      c.strokeStyle = 'rgba(' + p.col + ',' + a + ')'; c.lineWidth = 2 * p.s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-p.vx * 0.04, -p.vy * 0.04); c.stroke();
    } else if (p.kind === 'ring') {
      c.globalAlpha = 1; c.strokeStyle = 'rgba(' + p.col + ',' + (1 - t) * 0.8 + ')'; c.lineWidth = 6 * (1 - t) + 1;
      c.beginPath(); c.arc(0, 0, p.r * easeOut(t), 0, TAU); c.stroke();
    } else if (p.kind === 'ink') {
      c.fillStyle = p.col; c.beginPath(); c.arc(0, 0, 3 * p.s * (1 - t * 0.5), 0, TAU); c.fill();
    }
    c.restore();
  }
  // ポップ
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const p of FX.pops) {
    const t = p.life / p.max;
    const sc = t < 0.15 ? easeOutBack(t / 0.15) : 1;
    const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(p.x, p.y - p.rise * easeOut(Math.min(1, t * 1.4))); c.scale(sc, sc);
    c.font = '800 ' + p.size + 'px ' + FONT_MIN;
    c.lineJoin = 'round'; c.lineWidth = Math.max(3, p.size * 0.22); c.strokeStyle = 'rgba(255,250,238,0.95)'; c.strokeText(p.text, 0, 0);
    c.fillStyle = p.col; c.fillText(p.text, 0, 0);
    c.restore();
  }
  if (FX.flash > 0.01) { c.fillStyle = 'rgba(' + FX.flashCol + ',' + Math.min(0.85, FX.flash) + ')'; c.fillRect(0, 0, FX.w, FX.h); }
};
