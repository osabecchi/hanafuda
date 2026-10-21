'use strict';
/* 花暦 — art: 札・神札・お守り・紋・和紙の背景を Canvas で描く(画像ファイルは使わない)
   札は 100×160 の座標で描いてから拡大縮小する。描いた札は大きさごとに取っておいて使い回す */
const ART = {};
const FONT_BRUSH = '"Yuji Syuku", "Shippori Mincho B1", "Yu Mincho", "Hiragino Mincho ProN", serif';
const FONT_MIN = '"Shippori Mincho B1", "Yu Mincho", "Hiragino Mincho ProN", "MS PMincho", serif';
const PAL = {
  sumi: '#1f1a17', ink: '#2a211b', cream: '#f4ead3', paper: '#f7f0de', shu: '#c8402a', red: '#c4302a', deep: '#8e1f16',
  gold: '#d4a73a', gold2: '#f1d488', gold3: '#9a7420', pine: '#24492f', pine2: '#3f7a4a', green: '#3f6a3a', leaf: '#4f8a46',
  pink: '#f0a6b8', pink2: '#d9687f', plum: '#c8304a', fuji: '#7b5ea7', fuji2: '#a98fd0', ayame: '#4249a0', botan: '#c4304a', botan2: '#e27a8e',
  hagi: '#b04a7a', susuki: '#c9a35a', kiku: '#e6b422', momiji: '#d0402a', momiji2: '#e07a2a', yanagi: '#5b8a3a', kiri: '#7a5aa8',
  blue: '#2f3f96', brown: '#6a4426', wood: '#d6ae76'
};

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function circle(c, x, y, r, fill, stroke, lw) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
}
function ell(c, x, y, rx, ry, rot, fill, stroke, lw) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
}
/* 先が細くなる枝 */
function branch(c, pts, w0, w1, col) {
  c.strokeStyle = col || PAL.ink; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    const t = i / Math.max(1, pts.length - 2);
    c.lineWidth = lerp(w0, w1, t);
    c.beginPath(); c.moveTo(pts[i][0], pts[i][1]);
    const mx = (pts[i][0] + pts[i + 1][0]) / 2 + (i % 2 ? 2 : -2), my = (pts[i][1] + pts[i + 1][1]) / 2;
    c.quadraticCurveTo(mx, my, pts[i + 1][0], pts[i + 1][1]); c.stroke();
  }
}
function leafShape(c, x, y, len, wid, ang, col, vein) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.45, -wid, len, 0); c.quadraticCurveTo(len * 0.45, wid, 0, 0);
  c.fillStyle = col; c.fill();
  if (vein) { c.strokeStyle = vein; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1, 0); c.lineTo(len * 0.9, 0); c.stroke(); }
  c.restore();
}
function petal5(c, x, y, r, col, rot, center) {
  for (let i = 0; i < 5; i++) {
    const a = (rot || 0) + i * TAU / 5 - Math.PI / 2;
    circle(c, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, col);
  }
  circle(c, x, y, r * 0.28, center || '#f6e7b0');
}
function sakuraFlower(c, x, y, r, col, rot, center) {
  for (let i = 0; i < 5; i++) {
    const a = (rot || 0) + i * TAU / 5 - Math.PI / 2;
    c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.5, -r * 1.0, -r * 0.12, -r * 1.0);
    c.lineTo(0, -r * 0.82); c.lineTo(r * 0.12, -r * 1.0);
    c.bezierCurveTo(r * 0.5, -r * 1.0, r * 0.55, -r * 0.35, 0, 0);
    c.fillStyle = col; c.fill(); c.restore();
  }
  circle(c, x, y, r * 0.22, center || PAL.pink2);
}
/* 松の葉の房(扇形) */
function pineTuft(c, x, y, w, h, rot) {
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  c.beginPath(); c.ellipse(0, 0, w, h, 0, Math.PI, TAU); c.closePath();
  c.fillStyle = PAL.pine; c.fill();
  c.strokeStyle = PAL.pine2; c.lineWidth = 0.7;
  for (let i = 1; i < 12; i++) { const a = Math.PI + i * Math.PI / 12; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * w * 0.95, Math.sin(a) * h * 0.95); c.stroke(); }
  c.strokeStyle = PAL.sumi; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, w, h, 0, Math.PI, TAU); c.stroke();
  c.restore();
}
/* 霞・金雲 */
function cloudBand(c, x, y, w, h, fill, edge) {
  c.beginPath();
  const n = Math.max(3, Math.round(w / (h * 1.1)));
  c.moveTo(x, y + h * 0.5);
  for (let i = 0; i < n; i++) { const x0 = x + (w / n) * i, x1 = x0 + w / n; c.bezierCurveTo(x0, y - h * 0.15, x1, y - h * 0.15, x1, y + h * 0.35); }
  for (let i = n - 1; i >= 0; i--) { const x1 = x + (w / n) * (i + 1), x0 = x1 - w / n; c.bezierCurveTo(x1, y + h * 1.15, x0, y + h * 1.15, x0, y + h * 0.65); }
  c.closePath();
  c.fillStyle = fill; c.fill();
  if (edge) { c.strokeStyle = edge; c.lineWidth = 0.8; c.stroke(); }
}
function goldGrad(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f6dc8e'); g.addColorStop(0.45, '#d4a73a'); g.addColorStop(0.7, '#f3d27a'); g.addColorStop(1, '#a8801f');
  return g;
}
function goldCloud(c, x, y, w, h) {
  cloudBand(c, x, y, w, h, goldGrad(c, x, y, x + w, y + h), 'rgba(120,80,10,0.55)');
  // 金箔の継ぎ目
  c.save(); c.globalAlpha = 0.18; c.strokeStyle = '#7a5a10'; c.lineWidth = 0.4;
  for (let gx = x + 6; gx < x + w; gx += 9) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
  c.restore();
}
/* 短冊 */
function ribbon(c, x, y, w, h, ang, col, text) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-w / 2 + 1.6, -h / 2 + 1.8, w, h);
  c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.8; c.strokeRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.6; c.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
  if (text) {
    c.fillStyle = PAL.sumi; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = Math.min(w * 0.72, (h - 8) / text.length);
    c.font = '700 ' + fs + 'px ' + FONT_BRUSH;
    for (let i = 0; i < text.length; i++) c.fillText(text[i], 0, -h / 2 + 5 + fs * (i + 0.5));
  }
  c.restore();
}
function grassLines(c, x0, x1, yBase, hgt, col, n, R) {
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, R()), h = hgt * (0.5 + R() * 0.6), lean = (R() - 0.5) * 18;
    c.lineWidth = 0.6 + R() * 0.8;
    c.beginPath(); c.moveTo(x, yBase); c.quadraticCurveTo(x + lean * 0.3, yBase - h * 0.6, x + lean, yBase - h); c.stroke();
  }
}
function moon(c, x, y, r, col, glow) {
  if (glow) { const g = c.createRadialGradient(x, y, r * 0.8, x, y, r * 1.6); g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.6, 0, TAU); c.fill(); }
  circle(c, x, y, r, col || '#f8eed2');
  c.save(); c.globalAlpha = 0.08; circle(c, x - r * 0.3, y - r * 0.15, r * 0.25, '#7a6a50'); circle(c, x + r * 0.25, y + r * 0.3, r * 0.18, '#7a6a50'); c.restore();
}

/* ---------------- 月ごとの絵 ---------------- */
const MOTIF = {
  // 一月 松
  pine(c, R, v) {
    if (v === 1) {
      branch(c, [[96, 150], [70, 120], [55, 92], [62, 64], [50, 40]], 7, 3, PAL.brown);
      pineTuft(c, 66, 74, 24, 14, -0.2); pineTuft(c, 44, 50, 20, 12, 0.15); pineTuft(c, 30, 112, 22, 13, 0.1); pineTuft(c, 70, 132, 22, 12, -0.05);
    } else {
      branch(c, [[4, 156], [26, 128], [50, 106], [72, 90], [90, 70]], 7, 3, PAL.brown);
      pineTuft(c, 28, 118, 22, 13, 0); pineTuft(c, 60, 96, 24, 14, -0.15); pineTuft(c, 82, 66, 18, 11, -0.3); pineTuft(c, 38, 66, 18, 10, 0.2);
    }
  },
  plum(c, R, v) {
    const g = c.createLinearGradient(0, 4, 0, 70); g.addColorStop(0, 'rgba(200,64,42,0.55)'); g.addColorStop(1, 'rgba(200,64,42,0)');
    c.fillStyle = g; c.fillRect(4, 4, 92, 70);
    const pts = v === 1 ? [[96, 150], [70, 118], [76, 84], [52, 60], [58, 30], [36, 12]] : [[4, 150], [30, 122], [22, 92], [48, 70], [40, 40], [68, 18]];
    branch(c, pts, 6, 2, PAL.ink);
    branch(c, v === 1 ? [[70, 118], [40, 104], [24, 82]] : [[30, 122], [62, 110], [80, 92]], 3.5, 1.5, PAL.ink);
    const spots = v === 1 ? [[74, 92], [55, 64], [60, 34], [42, 104], [26, 84], [84, 120], [40, 18], [68, 76]] : [[26, 96], [46, 72], [42, 44], [60, 110], [80, 94], [26, 128], [64, 22], [34, 60]];
    spots.forEach(([x, y], i) => petal5(c, x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, 7 + R() * 2, PAL.plum, R(), '#f8e6a8'));
    for (let i = 0; i < 6; i++) circle(c, 10 + R() * 80, 20 + R() * 120, 1.6, PAL.plum);
  },
  sakura(c, R, v) {
    cloudBand(c, 4, v === 1 ? 108 : 60, 92, 18, 'rgba(255,255,255,0.75)', 'rgba(200,120,140,0.4)');
    branch(c, v === 1 ? [[96, 30], [70, 40], [44, 30], [20, 44]] : [[4, 60], [30, 50], [60, 58], [90, 44]], 4, 2, PAL.ink);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const x = 10 + R() * 80, y = (v === 1 ? 10 : 8) + R() * (v === 1 ? 90 : 50);
      sakuraFlower(c, x, y, 7 + R() * 3, R() < 0.3 ? '#fbd2dc' : PAL.pink, R(), PAL.pink2);
    }
  },
  fuji(c, R, v) {
    branch(c, [[4, 8], [30, 14], [60, 8], [96, 16]], 3, 2, '#3a3a2a');
    const cols = v === 1 ? [14, 36, 58, 80] : [22, 46, 70, 90];
    cols.forEach((x0, k) => {
      const len = 50 + R() * 40;
      for (let i = 0; i < 9; i++) {
        const t = i / 9, y = 14 + t * len, r = 6 * (1 - t * 0.65);
        ell(c, x0 + Math.sin(i * 0.9 + k) * 2, y, r, r * 0.8, 0, i % 2 ? PAL.fuji2 : PAL.fuji);
      }
      leafShape(c, x0 + 6, 18, 18, 4, 0.9, PAL.leaf);
    });
  },
  ayame(c, R, v) {
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 10 + (R() - 0.5) * 6, h = 60 + R() * 60;
      c.save(); c.translate(x, 158); c.rotate((R() - 0.5) * 0.25);
      c.beginPath(); c.moveTo(-2.5, 0); c.quadraticCurveTo(-1, -h * 0.6, 0, -h); c.quadraticCurveTo(1, -h * 0.6, 2.5, 0); c.closePath();
      c.fillStyle = i % 2 ? PAL.leaf : PAL.green; c.fill(); c.restore();
    }
    const fl = v === 1 ? [[28, 54], [62, 40], [76, 80]] : [[22, 70], [50, 48], [80, 64]];
    fl.forEach(([x, y]) => iris(c, x, y, 11));
  },
  botan(c, R, v) {
    const fl = v === 1 ? [[34, 58, 20], [70, 108, 17]] : [[62, 60, 20], [30, 112, 16]];
    for (let i = 0; i < 7; i++) peonyLeaf(c, 10 + R() * 80, 40 + R() * 110, 12 + R() * 6, R() * TAU);
    fl.forEach(([x, y, r], i) => peony(c, x, y, r, i ? PAL.botan2 : PAL.botan, R));
  },
  hagi(c, R, v) {
    const g = c.createRadialGradient(70, 40, 4, 70, 40, 60); g.addColorStop(0, 'rgba(232,160,60,0.45)'); g.addColorStop(1, 'rgba(232,160,60,0)');
    c.fillStyle = g; c.fillRect(4, 4, 92, 100);
    for (let k = 0; k < 4; k++) {
      const x0 = v === 1 ? 96 - k * 6 : 4 + k * 6, dir = v === 1 ? -1 : 1;
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([x0 + dir * i * 15, 150 - Math.sin(i / 6 * Math.PI) * (70 + k * 12) - i * 6]);
      c.strokeStyle = '#5a2a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      pts.forEach(([x, y], i) => { if (i) { leafShape(c, x, y, 6, 2.6, -0.6 + R(), PAL.leaf); circle(c, x + 3, y - 3, 2.2, PAL.hagi); circle(c, x - 2, y + 2, 1.8, '#d0609a'); } });
    }
  },
  susuki(c, R, v) {
    const g = c.createLinearGradient(0, 4, 0, 100); g.addColorStop(0, '#9e2416'); g.addColorStop(1, '#d4472c');
    c.fillStyle = g; c.fillRect(4, 4, 92, 110);
    c.beginPath(); c.moveTo(4, 158); c.lineTo(4, 100); c.bezierCurveTo(30, 70, 70, 70, 96, 96); c.lineTo(96, 158); c.closePath();
    c.fillStyle = PAL.sumi; c.fill();
    grassLines(c, 6, 94, 112, 34, 'rgba(240,230,210,0.85)', 26, R);
    if (v === 1) for (let i = 0; i < 5; i++) { const x = 14 + i * 18, y = 70 + R() * 14; branch(c, [[x, 112], [x + 4, y + 10], [x + 8, y]], 1, 0.6, '#e8d8b0'); ell(c, x + 9, y - 4, 2.4, 7, 0.4, '#e8d0a0'); }
  },
  kiku(c, R, v) {
    for (let i = 0; i < 6; i++) leafShape(c, 10 + R() * 80, 80 + R() * 70, 16, 7, R() * TAU, PAL.green, '#2a4a2a');
    const fl = v === 1 ? [[30, 50, 16, PAL.kiku], [70, 88, 14, '#e8e0d0'], [40, 120, 12, PAL.shu]] : [[66, 44, 16, PAL.kiku], [28, 92, 14, PAL.shu], [72, 126, 12, '#e8e0d0']];
    fl.forEach(([x, y, r, col]) => chrys(c, x, y, r, col));
  },
  momiji(c, R, v) {
    branch(c, v === 1 ? [[96, 150], [70, 110], [74, 70], [50, 40], [56, 10]] : [[4, 150], [32, 112], [24, 72], [50, 44], [42, 12]], 4, 1.5, PAL.ink);
    for (let i = 0; i < 11; i++) mapleLeaf(c, 10 + R() * 80, 10 + R() * 140, 8 + R() * 4, R() * TAU, [PAL.momiji, PAL.momiji2, '#e6b422', '#b8301e'][Math.floor(R() * 4)]);
  },
  yanagi(c, R, v) {
    c.fillStyle = 'rgba(40,50,60,0.12)'; c.fillRect(4, 4, 92, 152);
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 11 + (R() - 0.5) * 6;
      c.strokeStyle = i % 2 ? PAL.yanagi : '#3f6a2a'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(x, 4); c.bezierCurveTo(x + 10, 40, x - 8, 80, x + 4 + (R() - 0.5) * 10, 100 + R() * 50); c.stroke();
      for (let j = 0; j < 6; j++) leafShape(c, x + (R() - 0.5) * 6, 14 + j * 16, 6, 1.6, 1.4 + (R() - 0.5) * 0.6, PAL.yanagi);
    }
  },
  kiri(c, R, v) {
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 28, y = 112 + (i % 2) * 14;
      kiriLeaf(c, x, y, 20, (i - 1) * 0.4);
    }
    // 花の房
    [[30, 30], [50, 22], [70, 32]].forEach(([x, y], k) => {
      branch(c, [[x, y + 40], [x, y + 10]], 1.5, 1, PAL.green);
      for (let i = 0; i < 8; i++) circle(c, x + (R() - 0.5) * 10, y + i * 4, 3, i % 2 ? PAL.kiri : '#9a7ac8');
    });
  }
};
function iris(c, x, y, r) {
  for (const s of [-1, 1]) {
    c.save(); c.translate(x, y); c.scale(s, 1);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(r * 0.8, -r * 0.2, r * 1.2, r * 0.7, r * 0.5, r * 1.0); c.bezierCurveTo(r * 0.3, r * 0.6, r * 0.1, r * 0.3, 0, 0);
    c.fillStyle = PAL.ayame; c.fill();
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.5, -r * 0.9, r * 0.15, -r * 1.3); c.quadraticCurveTo(-r * 0.05, -r * 0.6, 0, 0);
    c.fillStyle = '#5a62b8'; c.fill(); c.restore();
  }
  ell(c, x, y + r * 0.35, r * 0.15, r * 0.4, 0, '#e6c022');
}
function peony(c, x, y, r, col, R) {
  for (let ring = 0; ring < 3; ring++) {
    const rr = r * (1 - ring * 0.28), n = 8 - ring;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + ring * 0.4;
      ell(c, x + Math.cos(a) * rr * 0.5, y + Math.sin(a) * rr * 0.5, rr * 0.55, rr * 0.42, a, ring % 2 ? col : shade(col, -0.12), 'rgba(80,10,20,0.35)', 0.6);
    }
  }
  circle(c, x, y, r * 0.18, '#f0c84a');
}
function peonyLeaf(c, x, y, s, a) {
  for (let i = -1; i <= 1; i++) leafShape(c, x, y, s * (i ? 0.8 : 1), s * 0.35, a + i * 0.6, i ? PAL.green : PAL.leaf, '#244a24');
}
function chrys(c, x, y, r, col) {
  for (let ring = 0; ring < 2; ring++) {
    const n = 18 - ring * 6, rr = r * (1 - ring * 0.4);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + ring * 0.2;
      ell(c, x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55, rr * 0.48, rr * 0.13, a, ring ? shade(col, 0.1) : col, 'rgba(60,40,10,0.35)', 0.4);
    }
  }
  circle(c, x, y, r * 0.2, shade(col, -0.25));
}
function mapleLeaf(c, x, y, s, a, col) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath();
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI / 2 + (i - 3) * 0.48, len = s * (i === 3 ? 1 : i === 2 || i === 4 ? 0.9 : i === 1 || i === 5 ? 0.75 : 0.5);
    const mid = ang + 0.24;
    c.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
    if (i < 6) c.lineTo(Math.cos(mid) * len * 0.42, Math.sin(mid) * len * 0.42);
  }
  c.lineTo(0, s * 0.25); c.closePath();
  c.fillStyle = col; c.fill();
  c.strokeStyle = 'rgba(80,20,10,0.5)'; c.lineWidth = 0.5; c.stroke();
  c.restore();
}
function kiriLeaf(c, x, y, s, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.moveTo(0, s * 0.5);
  c.bezierCurveTo(-s * 1.1, s * 0.2, -s * 0.9, -s * 0.9, 0, -s);
  c.bezierCurveTo(s * 0.9, -s * 0.9, s * 1.1, s * 0.2, 0, s * 0.5);
  c.fillStyle = PAL.green; c.fill();
  c.strokeStyle = '#21401f'; c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.moveTo(0, s * 0.5); c.lineTo(0, -s * 0.85); c.moveTo(0, 0); c.lineTo(-s * 0.5, -s * 0.4); c.moveTo(0, 0); c.lineTo(s * 0.5, -s * 0.4); c.stroke();
  c.restore();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}

/* ---------------- 主役の絵(動物・物) ---------------- */
const SUBJ = {
  crane(c) {
    moonGlow(c);
    circle(c, 62, 44, 24, '#d23a26');
    goldCloud(c, 4, 6, 92, 16);
    // 鶴
    c.save(); c.translate(-4, 6);
    ell(c, 46, 104, 20, 12, -0.25, '#fbf8f0', PAL.sumi, 0.9);
    c.beginPath(); c.moveTo(60, 98); c.lineTo(80, 92); c.lineTo(76, 110); c.closePath(); c.fillStyle = PAL.sumi; c.fill();
    c.strokeStyle = '#fbf8f0'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(34, 98); c.bezierCurveTo(22, 84, 36, 74, 30, 60); c.stroke();
    c.strokeStyle = PAL.sumi; c.lineWidth = 2.2; c.beginPath(); c.moveTo(31, 72); c.bezierCurveTo(34, 68, 32, 64, 30, 60); c.stroke();
    circle(c, 30, 58, 4.2, '#fbf8f0', PAL.sumi, 0.8);
    circle(c, 30, 55.5, 2, PAL.red);
    c.strokeStyle = '#6a6050'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(27, 59); c.lineTo(16, 63); c.stroke();
    c.strokeStyle = PAL.sumi; c.lineWidth = 1.4; c.beginPath(); c.moveTo(44, 114); c.lineTo(42, 142); c.moveTo(50, 114); c.lineTo(54, 142); c.stroke();
    c.restore();
  },
  uguisu(c) {
    c.save(); c.translate(56, 92);
    ell(c, 0, 0, 13, 9, -0.3, '#7d8a32', PAL.sumi, 0.8);
    ell(c, 2, 4, 9, 5, -0.3, '#c8cc80');
    circle(c, -10, -6, 6.5, '#7d8a32', PAL.sumi, 0.8);
    circle(c, -12, -7, 1.3, PAL.sumi);
    c.beginPath(); c.moveTo(-16, -6); c.lineTo(-21, -4.5); c.lineTo(-16, -4); c.fillStyle = '#4a4020'; c.fill();
    c.beginPath(); c.moveTo(11, -2); c.lineTo(24, -10); c.lineTo(22, 2); c.closePath(); c.fillStyle = '#5a6424'; c.fill();
    c.strokeStyle = PAL.sumi; c.lineWidth = 1; c.beginPath(); c.moveTo(-2, 8); c.lineTo(-3, 13); c.moveTo(3, 8); c.lineTo(3, 13); c.stroke();
    c.restore();
  },
  maku(c) {
    goldCloud(c, 4, 6, 92, 14);
    const y0 = 78;
    c.beginPath(); c.moveTo(4, y0);
    for (let i = 0; i <= 4; i++) { const x = 4 + i * 23; c.quadraticCurveTo(x - 11.5, y0 + 8, x, y0); }
    c.lineTo(96, 150);
    for (let i = 4; i >= 0; i--) { const x = 4 + i * 23; c.quadraticCurveTo(x + 11.5, 156, x, 150); }
    c.closePath();
    const g = c.createLinearGradient(0, y0, 0, 156); g.addColorStop(0, '#d8402e'); g.addColorStop(1, '#a8281c');
    c.fillStyle = g; c.fill(); c.strokeStyle = PAL.sumi; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#f8f0e0'; c.fillRect(4, 100, 92, 7); c.fillRect(4, 126, 92, 7);
    c.strokeStyle = 'rgba(60,10,10,0.4)'; c.lineWidth = 0.7;
    for (let x = 16; x < 96; x += 14) { c.beginPath(); c.moveTo(x, y0 + 4); c.lineTo(x - 2, 150); c.stroke(); }
    circle(c, 50, 116, 12, '#f8f0e0', PAL.sumi, 1.2);
    // 紋(桜)
    sakuraFlower(c, 50, 116, 8, PAL.red, 0, '#f8f0e0');
    for (let i = 0; i <= 4; i++) { const x = 4 + i * 23; circle(c, x, y0, 2.5, PAL.sumi); c.strokeStyle = '#e8c84a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 2, y0 + 10); c.stroke(); }
  },
  hototogisu(c) {
    const g = c.createLinearGradient(0, 30, 0, 110); g.addColorStop(0, 'rgba(214,80,40,0)'); g.addColorStop(0.5, 'rgba(214,80,40,0.35)'); g.addColorStop(1, 'rgba(214,80,40,0)');
    c.fillStyle = g; c.fillRect(4, 30, 92, 80);
    // 三日月
    c.save(); c.beginPath(); c.arc(30, 122, 18, 0, TAU); c.clip();
    c.beginPath(); c.rect(0, 0, 100, 160); c.arc(38, 116, 16, 0, TAU, true); c.fillStyle = '#e8a33a'; c.fill(); c.restore();
    // 鳥
    c.save(); c.translate(56, 78); c.rotate(-0.25);
    c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-4, -26, 14, -30); c.quadraticCurveTo(4, -12, 6, -2); c.closePath(); c.fillStyle = '#2a2a3a'; c.fill();
    c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(0, 22, 20, 26); c.quadraticCurveTo(8, 10, 8, 2); c.closePath(); c.fillStyle = '#3a3a4e'; c.fill();
    ell(c, 0, 0, 16, 6, 0, '#4a4a5a', PAL.sumi, 0.6);
    ell(c, 2, 2, 10, 3, 0, '#d8d4c8');
    circle(c, -15, -1, 4.5, '#2a2a3a');
    c.beginPath(); c.moveTo(-19, -1); c.lineTo(-25, 1); c.lineTo(-19, 1.5); c.fillStyle = '#e6b422'; c.fill();
    c.beginPath(); c.moveTo(16, 0); c.lineTo(30, -4); c.lineTo(30, 4); c.closePath(); c.fillStyle = '#2a2a3a'; c.fill();
    c.restore();
  },
  yatsuhashi(c) {
    c.fillStyle = 'rgba(80,130,190,0.25)'; c.fillRect(4, 96, 92, 60);
    c.strokeStyle = 'rgba(60,100,170,0.5)'; c.lineWidth = 0.8;
    for (let y = 104; y < 156; y += 9) { c.beginPath(); for (let x = 4; x <= 96; x += 8) c.quadraticCurveTo(x + 2, y - 3, x + 4, y); c.stroke(); }
    const planks = [[2, 128, 46, 112], [46, 112, 96, 132], [30, 150, 80, 140]];
    planks.forEach(([x0, y0, x1, y1]) => {
      c.save(); c.translate(x0, y0); const a = Math.atan2(y1 - y0, x1 - x0); c.rotate(a);
      const L = Math.hypot(x1 - x0, y1 - y0);
      c.fillStyle = '#8a5a2a'; c.fillRect(0, -5, L, 10); c.strokeStyle = PAL.sumi; c.lineWidth = 0.9; c.strokeRect(0, -5, L, 10);
      c.strokeStyle = 'rgba(40,20,10,0.5)'; for (let x = 8; x < L; x += 8) { c.beginPath(); c.moveTo(x, -5); c.lineTo(x, 5); c.stroke(); }
      c.restore();
      c.fillStyle = PAL.sumi; c.fillRect(x0 - 1.5, y0 + 4, 3, 10); c.fillRect(x1 - 1.5, y1 + 4, 3, 10);
    });
  },
  cho(c) {
    butterfly(c, 34, 34, 13, '#3a6fb8', '#f0c84a', -0.3);
    butterfly(c, 70, 54, 10, '#e6b422', '#c8402a', 0.4);
  },
  inoshishi(c) {
    c.save(); c.translate(50, 118);
    ell(c, 0, 0, 30, 15, 0, '#4a3020', PAL.sumi, 1);
    c.strokeStyle = '#2a1a10'; c.lineWidth = 1.2;
    for (let i = -22; i < 20; i += 4) { c.beginPath(); c.moveTo(i, -12); c.lineTo(i - 2, -18); c.stroke(); }
    c.beginPath(); c.moveTo(-26, -4); c.quadraticCurveTo(-40, -2, -44, 6); c.lineTo(-30, 10); c.closePath(); c.fillStyle = '#4a3020'; c.fill();
    circle(c, -44, 6, 3, '#6a4a3a');
    c.strokeStyle = '#f0e8d8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-38, 6); c.quadraticCurveTo(-42, 0, -38, -2); c.stroke();
    circle(c, -32, -3, 1.4, '#f0e0a0');
    c.strokeStyle = '#3a2418'; c.lineWidth = 3.2; c.lineCap = 'round';
    [[-18, 12, -26, 26], [-8, 13, -4, 28], [14, 12, 6, 26], [22, 10, 32, 24]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
    c.restore();
  },
  tsuki(c) {
    goldCloud(c, 4, 10, 92, 14);
    moon(c, 50, 56, 30, '#f8eed2', true);
  },
  kari(c) {
    [[30, 40, 1], [56, 30, 0.85], [74, 50, 0.75]].forEach(([x, y, s]) => goose(c, x, y, s));
  },
  sakazuki(c) {
    c.save(); c.translate(50, 104);
    ell(c, 0, 14, 12, 4, 0, '#7a1a10');
    c.beginPath(); c.moveTo(-28, -10); c.quadraticCurveTo(0, 30, 28, -10); c.closePath();
    const g = c.createLinearGradient(-28, 0, 28, 0); g.addColorStop(0, '#9a2014'); g.addColorStop(0.5, '#d2402a'); g.addColorStop(1, '#8a1a10');
    c.fillStyle = g; c.fill(); c.strokeStyle = PAL.sumi; c.lineWidth = 1; c.stroke();
    ell(c, 0, -10, 28, 6, 0, '#e8c050', PAL.sumi, 1);
    ell(c, 0, -10, 22, 4, 0, '#c8402a');
    c.fillStyle = '#f2d27a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 16px ' + FONT_BRUSH; c.fillText('寿', 0, 4);
    c.restore();
  },
  shika(c) {
    c.save(); c.translate(52, 108);
    ell(c, 0, 0, 22, 10, 0, '#9a6232', PAL.sumi, 0.9);
    for (let i = 0; i < 6; i++) circle(c, -12 + i * 5, -3 + (i % 2) * 4, 1.4, '#f4e4c4');
    c.strokeStyle = '#7a4a22'; c.lineWidth = 3; c.lineCap = 'round';
    [[-14, 8, -16, 34], [-7, 9, -6, 34], [10, 9, 12, 34], [16, 7, 20, 32]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
    c.beginPath(); c.moveTo(18, -4); c.quadraticCurveTo(26, -16, 24, -28); c.lineWidth = 7; c.strokeStyle = '#9a6232'; c.stroke();
    ell(c, 22, -32, 6, 4.5, 0.6, '#9a6232', PAL.sumi, 0.8);
    circle(c, 20, -33, 1, PAL.sumi);
    c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(25, -35); c.lineTo(32, -48); c.lineTo(38, -50); c.moveTo(30, -44); c.lineTo(36, -42); c.moveTo(22, -36); c.lineTo(20, -50); c.lineTo(14, -54); c.moveTo(20, -46); c.lineTo(26, -52); c.stroke();
    c.restore();
  },
  ame(c) {
    c.fillStyle = 'rgba(30,40,60,0.18)'; c.fillRect(4, 4, 92, 152);
    goldCloud(c, 4, 6, 92, 12);
    c.strokeStyle = 'rgba(220,230,240,0.55)'; c.lineWidth = 0.6;
    for (let i = 0; i < 22; i++) { const x = 6 + (i * 37) % 90, y = 20 + (i * 53) % 110; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 10); c.stroke(); }
    // 川
    c.fillStyle = 'rgba(60,110,180,0.45)'; c.beginPath(); c.moveTo(4, 140); c.quadraticCurveTo(50, 128, 96, 142); c.lineTo(96, 156); c.lineTo(4, 156); c.fill();
    // 人と傘
    c.save(); c.translate(58, 92);
    c.beginPath(); c.moveTo(-6, -8); c.lineTo(-14, 42); c.lineTo(14, 42); c.lineTo(8, -8); c.closePath(); c.fillStyle = '#2a2a3e'; c.fill();
    c.fillStyle = '#c8402a'; c.fillRect(-12, 30, 24, 6);
    circle(c, 0, -14, 6, '#f2dcc0', PAL.sumi, 0.8);
    c.fillStyle = PAL.sumi; c.fillRect(-4, -24, 8, 5);
    c.strokeStyle = '#5a4020'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, -4); c.lineTo(-20, -30); c.stroke();
    c.beginPath(); c.moveTo(-46, -28); c.quadraticCurveTo(-24, -54, 2, -32); c.closePath();
    c.fillStyle = '#e6b422'; c.fill(); c.strokeStyle = PAL.sumi; c.lineWidth = 0.9; c.stroke();
    c.strokeStyle = 'rgba(80,50,10,0.5)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-20, -30); c.lineTo(-44 + i * 11, -30 - Math.sin(i / 4 * Math.PI) * 14); c.stroke(); }
    c.restore();
    // 蛙
    c.save(); c.translate(22, 132);
    ell(c, 0, 0, 7, 5, -0.4, '#4f8a3a', PAL.sumi, 0.7);
    c.strokeStyle = '#4f8a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 3); c.lineTo(10, 8); c.moveTo(-4, 3); c.lineTo(-9, 9); c.stroke();
    circle(c, -3, -4, 1.4, '#f0f0d0'); circle(c, 2, -5, 1.4, '#f0f0d0');
    c.restore();
  },
  tsubame(c) {
    c.save(); c.translate(52, 70); c.rotate(0.2);
    c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(-20, -24, -40, -26); c.quadraticCurveTo(-22, -10, -8, 4); c.closePath(); c.fillStyle = '#1e1e2a'; c.fill();
    c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(20, -24, 40, -20); c.quadraticCurveTo(22, -6, 8, 4); c.closePath(); c.fill();
    ell(c, 0, 2, 12, 6, 0, '#1e1e2a');
    ell(c, 2, 4, 7, 3, 0, '#f0ece0');
    circle(c, -11, 0, 4.5, '#1e1e2a'); circle(c, -12, 2.5, 2.4, '#c8402a');
    c.beginPath(); c.moveTo(10, 2); c.lineTo(28, 14); c.lineTo(20, 4); c.lineTo(28, -2); c.closePath(); c.fillStyle = '#1e1e2a'; c.fill();
    c.restore();
  },
  kaminari(c) {
    c.fillStyle = '#231c19'; c.fillRect(4, 4, 92, 152);
    for (let i = 0; i < 4; i++) { const x = 20 + i * 20, y = 30 + (i % 2) * 16; circle(c, x, y, 9, null, PAL.red, 2.2); tomoe(c, x, y, 6.5, PAL.red); }
    c.beginPath(); c.moveTo(62, 60); c.lineTo(44, 98); c.lineTo(58, 98); c.lineTo(36, 150); c.lineTo(72, 92); c.lineTo(58, 92); c.lineTo(76, 60); c.closePath();
    c.fillStyle = '#e6b422'; c.fill(); c.strokeStyle = PAL.red; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(91,138,58,0.8)'; c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(10 + i * 6, 156); c.quadraticCurveTo(14 + i * 6, 120, 8 + i * 8, 90); c.stroke(); }
  },
  houou(c) {
    goldCloud(c, 4, 6, 92, 14);
    c.save(); c.translate(50, 70);
    const tail = ['#c8402a', '#3f7a4a', '#e6b422', '#2f5fa8', '#c8402a'];
    tail.forEach((col, i) => {
      c.strokeStyle = col; c.lineWidth = 4 - i * 0.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(6, 6); c.bezierCurveTo(30 + i * 4, 20 + i * 6, 10 + i * 8, 60 + i * 4, 34 + i * 3, 74 - i * 2); c.stroke();
      circle(c, 34 + i * 3, 74 - i * 2, 3.2, col, PAL.sumi, 0.5);
    });
    c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-30, -26, -44, -20); c.quadraticCurveTo(-26, -12, -16, 8); c.closePath(); c.fillStyle = '#3f7a4a'; c.fill();
    c.beginPath(); c.moveTo(4, -2); c.quadraticCurveTo(14, -34, 36, -36); c.quadraticCurveTo(22, -16, 12, 6); c.closePath(); c.fillStyle = '#c8402a'; c.fill();
    ell(c, 0, 4, 14, 8, -0.4, '#e6b422', PAL.sumi, 0.8);
    c.strokeStyle = '#e6b422'; c.lineWidth = 4; c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-16, -10, -12, -20); c.stroke();
    circle(c, -12, -22, 4.5, '#c8402a', PAL.sumi, 0.6);
    circle(c, -13, -23, 1, PAL.sumi);
    c.beginPath(); c.moveTo(-16, -22); c.lineTo(-22, -20); c.lineTo(-16, -20); c.fillStyle = '#e6b422'; c.fill();
    c.strokeStyle = '#2f5fa8'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-11, -26); c.lineTo(-8 + i * 3, -34); c.stroke(); }
    c.restore();
  }
};
function moonGlow(c) { const g = c.createLinearGradient(0, 4, 0, 90); g.addColorStop(0, 'rgba(240,200,120,0.35)'); g.addColorStop(1, 'rgba(240,200,120,0)'); c.fillStyle = g; c.fillRect(4, 4, 92, 90); }
function butterfly(c, x, y, s, a, b, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const d of [-1, 1]) {
    ell(c, d * s * 0.6, -s * 0.35, s * 0.62, s * 0.5, d * 0.5, a, PAL.sumi, 0.7);
    ell(c, d * s * 0.5, s * 0.4, s * 0.42, s * 0.32, -d * 0.4, b, PAL.sumi, 0.7);
    circle(c, d * s * 0.7, -s * 0.4, s * 0.12, '#f8f0e0');
  }
  ell(c, 0, 0, s * 0.1, s * 0.55, 0, PAL.sumi);
  c.strokeStyle = PAL.sumi; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(-s * 0.3, -s * 0.95); c.moveTo(0, -s * 0.5); c.lineTo(s * 0.3, -s * 0.95); c.stroke();
  c.restore();
}
function goose(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#2a201c';
  c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-4, -16, 6, -18); c.quadraticCurveTo(0, -6, 2, 0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-10, 2); c.quadraticCurveTo(4, 12, 16, 12); c.quadraticCurveTo(6, 4, 6, 0); c.closePath(); c.fill();
  ell(c, 0, 0, 11, 4, -0.1, '#3a2c26');
  circle(c, -12, -2, 3, '#3a2c26');
  c.beginPath(); c.moveTo(-14, -2); c.lineTo(-19, -1); c.lineTo(-14, 0); c.fill();
  c.restore();
}
function tomoe(c, x, y, r, col) {
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    c.save(); c.translate(x, y); c.rotate(a);
    circle(c, r * 0.45, 0, r * 0.36, col);
    c.beginPath(); c.arc(0, 0, r * 0.82, -0.2, 1.4); c.strokeStyle = col; c.lineWidth = r * 0.22; c.stroke();
    c.restore();
  }
}

/* 札の顔の組み立て: 背景 → 花 → 主役 → 短冊 */
const FACE_PLAN = {
  tsuru: ['pine', 1, 'crane'], akatan1: ['pine', 0, 'rib:aka:あかよろし'], matsu1: ['pine', 0], matsu2: ['pine', 1],
  uguisu: ['plum', 0, 'uguisu'], akatan2: ['plum', 1, 'rib:aka:あかよろし'], ume1: ['plum', 0], ume2: ['plum', 1],
  maku: ['sakura', 0, 'maku'], akatan3: ['sakura', 1, 'rib:aka:みよしの'], sakura1: ['sakura', 0], sakura2: ['sakura', 1],
  hototogisu: ['fuji', 0, 'hototogisu'], kusa1: ['fuji', 1, 'rib:red'], fuji1: ['fuji', 0], fuji2: ['fuji', 1],
  yatsuhashi: ['ayame', 0, 'yatsuhashi'], kusa2: ['ayame', 1, 'rib:red'], ayame1: ['ayame', 0], ayame2: ['ayame', 1],
  cho: ['botan', 1, 'cho'], aotan1: ['botan', 0, 'rib:blue'], botan1: ['botan', 0], botan2: ['botan', 1],
  inoshishi: ['hagi', 0, 'inoshishi'], kusa3: ['hagi', 1, 'rib:red'], hagi1: ['hagi', 0], hagi2: ['hagi', 1],
  tsuki: ['susuki', 0, 'tsuki'], kari: ['susuki', 0, 'kari'], susuki1: ['susuki', 0], susuki2: ['susuki', 1],
  sakazuki: ['kiku', 1, 'sakazuki'], aotan2: ['kiku', 0, 'rib:blue'], kiku1: ['kiku', 0], kiku2: ['kiku', 1],
  shika: ['momiji', 0, 'shika'], aotan3: ['momiji', 1, 'rib:blue'], momiji1: ['momiji', 0], momiji2: ['momiji', 1],
  ame: ['yanagi', 0, 'ame'], tsubame: ['yanagi', 1, 'tsubame'], yanagitan: ['yanagi', 0, 'rib:red'], kaminari: [null, 0, 'kaminari'],
  houou: ['kiri', 0, 'houou'], kiri1: ['kiri', 0], kiri2: ['kiri', 1], kiri3: ['kiri', 0]
};
function drawFace(c, f) {
  const plan = FACE_PLAN[f.id];
  const R = prng(hashStr('face' + f.id));
  // 地
  let bg = PAL.cream;
  if (f.id === 'kiri3') bg = '#ecc94a';
  c.fillStyle = bg; c.fillRect(4, 4, 92, 152);
  // 和紙の繊維
  c.save(); c.globalAlpha = 0.25; c.strokeStyle = '#fffaf0'; c.lineWidth = 0.4;
  for (let i = 0; i < 14; i++) { const x = 4 + R() * 92, y = 4 + R() * 152; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y + R() * 6, x + 12 * R(), y + 10 * R()); c.stroke(); }
  c.restore();
  if (plan[0]) MOTIF[plan[0]](c, R, plan[1]);
  const s = plan[2];
  if (s) {
    if (s.startsWith('rib:')) {
      const [, kind, text] = s.split(':');
      const col = kind === 'blue' ? PAL.blue : PAL.red;
      ribbon(c, 52, 84, 22, 76, -0.18, col, text || '');
    } else SUBJ[s](c);
  }
}

/* ---------------- 札1枚 ---------------- */
const KIND_BADGE = { hikari: ['光', '#c99a2e', '#fff8e0'], tane: ['種', '#3f7a4a', '#f4f8e8'], tan: ['短', '#c8402a', '#fff2ea'] };
const ENH_COL = { kin: '#d4a73a', gin: '#b8bcc4', shu: '#c8402a', ai: '#2c4a8e', urushi: '#1a1412' };
ART.cardTo = function (c, card, w, h, opt) {
  const f = D.FACES[card.f];
  c.save();
  c.scale(w / 100, h / 160);
  // 縁(裏紙の折り返し)
  rrect(c, 0, 0, 100, 160, 7); c.fillStyle = card.e === 'urushi' ? '#0e0a08' : '#2a1d15'; c.fill();
  c.save(); rrect(c, 3.5, 3.5, 93, 153, 4); c.clip();
  drawFace(c, f);
  if (card.e === 'kin' || card.e === 'gin') leafFlakes(c, card.e === 'kin', hashStr('fl' + card.u));
  c.restore();
  if (card.e) {
    c.strokeStyle = ENH_COL[card.e]; c.lineWidth = card.e === 'urushi' ? 3 : 2.6;
    rrect(c, 4.6, 4.6, 90.8, 150.8, 3.5); c.stroke();
    if (card.e === 'urushi') { c.fillStyle = '#e6c25a'; const R = prng(card.u * 7); for (let i = 0; i < 26; i++) { const a = R(); const p = a < 0.5 ? [4 + R() * 92, a < 0.25 ? 5.5 : 154.5] : [a < 0.75 ? 5.5 : 94.5, 4 + R() * 152]; circle(c, p[0], p[1], 0.7, '#e6c25a'); } }
  }
  // 月の印(左上)
  const changed = card.m !== f.m;
  const mk = D.KANSUJI[card.m];
  circle(c, 13, 14, 9.5, changed ? PAL.shu : 'rgba(252,246,232,0.92)', PAL.sumi, 1);
  c.fillStyle = changed ? '#fff' : PAL.sumi; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '800 ' + (mk.length > 1 ? 9.5 : 13) + 'px ' + FONT_MIN;
  c.fillText(mk, 13, 14.8);
  // 種類の印(その下)
  const kb = KIND_BADGE[f.kind];
  if (kb) {
    rrect(c, 5.5, 26, 15, 15, 3); c.fillStyle = kb[1]; c.fill(); c.strokeStyle = PAL.sumi; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = kb[2]; c.font = '800 11px ' + FONT_MIN; c.fillText(kb[0], 13, 34);
  }
  // 強化の札(左下)
  if (card.e) {
    const t = { kin: '金', gin: '銀', shu: '朱', ai: '藍', urushi: '漆' }[card.e];
    rrect(c, 5.5, 128, 15, 15, 3); c.fillStyle = ENH_COL[card.e]; c.fill(); c.strokeStyle = PAL.sumi; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = card.e === 'kin' || card.e === 'gin' ? PAL.sumi : '#fff'; c.font = '800 11px ' + FONT_MIN; c.fillText(t, 13, 136);
  }
  // 印(判子)
  if (card.s) {
    c.save(); c.translate(84, 142); c.rotate(-0.12);
    rrect(c, -9, -9, 18, 18, 2.5); c.fillStyle = card.s === 'fuku' ? '#c99a2e' : card.s === 'inori' ? '#2c4a8e' : PAL.shu; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8; rrect(c, -7, -7, 14, 14, 1.5); c.stroke();
    c.fillStyle = '#fff'; c.font = '700 11px ' + FONT_BRUSH; c.fillText(D.SEAL[card.s].kj, 0, 0.8);
    c.restore();
  }
  c.restore();
};
function leafFlakes(c, gold, seed) {
  const R = prng(seed);
  c.save(); c.globalAlpha = 0.55;
  for (let i = 0; i < 18; i++) {
    const x = 4 + R() * 92, y = 4 + R() * 152, s = 4 + R() * 7;
    c.save(); c.translate(x, y); c.rotate(R() * 0.6 - 0.3);
    c.fillStyle = gold ? goldGrad(c, -s, -s, s, s) : 'rgba(220,224,232,0.95)';
    c.fillRect(-s / 2, -s / 2, s, s * (0.7 + R() * 0.5));
    c.restore();
  }
  c.restore();
}
ART.backTo = function (c, w, h) {
  c.save(); c.scale(w / 100, h / 160);
  rrect(c, 0, 0, 100, 160, 7);
  const g = c.createLinearGradient(0, 0, 100, 160); g.addColorStop(0, '#5a1e16'); g.addColorStop(1, '#2a0d09');
  c.fillStyle = g; c.fill();
  c.strokeStyle = '#c99a2e'; c.lineWidth = 1.2; rrect(c, 6, 6, 88, 148, 4); c.stroke();
  c.lineWidth = 0.6; rrect(c, 9, 9, 82, 142, 3); c.stroke();
  // 花菱
  c.save(); c.translate(50, 80); c.fillStyle = '#d4a73a';
  for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, -3); c.bezierCurveTo(-9, -10, -6, -22, 0, -24); c.bezierCurveTo(6, -22, 9, -10, 0, -3); c.fill(); c.restore(); }
  circle(c, 0, 0, 3, '#5a1e16');
  c.restore();
  c.globalAlpha = 0.25;
  for (let i = 0; i < 4; i++) { c.save(); c.translate(i % 2 ? 76 : 24, i < 2 ? 30 : 130); c.fillStyle = '#d4a73a'; for (let j = 0; j < 4; j++) { c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(0, -5, 2.5, 5, 0, 0, TAU); c.fill(); } c.restore(); }
  c.restore();
};

/* ---------------- 神札(御札) ---------------- */
const MOTIF_K = {
  sun(c, col) { circle(c, 50, 78, 26, col); for (let i = 0; i < 12; i++) { c.save(); c.translate(50, 78); c.rotate(i * TAU / 12); c.fillStyle = col; c.fillRect(-1.5, -40, 3, 9); c.restore(); } },
  moon(c, col) { c.save(); c.beginPath(); c.arc(50, 78, 28, 0, TAU); c.clip(); c.beginPath(); c.rect(0, 0, 100, 160); c.arc(62, 70, 24, 0, TAU, true); c.fillStyle = col; c.fill(); c.restore(); },
  cloud(c, col) { cloudBand(c, 12, 56, 76, 16, col); cloudBand(c, 22, 88, 64, 14, col); },
  wave(c, col) { c.strokeStyle = col; c.lineWidth = 3; for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(20 + i * 20 + (r % 2) * 10, 70 + r * 14, 10, Math.PI, TAU); c.stroke(); } },
  leaf(c, col) { leafShape(c, 30, 104, 44, 14, -0.9, col); leafShape(c, 50, 104, 40, 12, -1.9, col); },
  bird(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(20, 80); c.quadraticCurveTo(40, 50, 52, 72); c.quadraticCurveTo(64, 50, 84, 74); c.quadraticCurveTo(60, 70, 52, 86); c.quadraticCurveTo(44, 72, 20, 80); c.fill(); },
  bell(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(30, 96); c.quadraticCurveTo(30, 54, 50, 54); c.quadraticCurveTo(70, 54, 70, 96); c.closePath(); c.fill(); circle(c, 50, 100, 6, col); },
  fan(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(50, 110); c.arc(50, 110, 44, -Math.PI * 0.85, -Math.PI * 0.15); c.closePath(); c.fill(); },
  drum(c, col) { circle(c, 50, 78, 28, null, col, 5); tomoe(c, 50, 78, 18, col); },
  face(c, col) { circle(c, 50, 78, 26, col); },
  circle(c, col) { circle(c, 50, 78, 26, null, col, 6); },
  coin(c, col) { circle(c, 50, 78, 28, col); c.fillStyle = 'rgba(247,240,222,0.9)'; c.fillRect(42, 70, 16, 16); },
  brush(c, col) { c.strokeStyle = col; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, 110); c.quadraticCurveTo(50, 50, 80, 44); c.stroke(); },
  tomoe(c, col) { tomoe(c, 50, 78, 26, col); },
  star(c, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(50 + Math.cos(a) * r, 78 + Math.sin(a) * r); } c.fill(); },
  sake(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(22, 64); c.quadraticCurveTo(50, 110, 78, 64); c.closePath(); c.fill(); ell(c, 50, 64, 28, 6, 0, col); },
  gourd(c, col) { circle(c, 50, 62, 14, col); circle(c, 50, 92, 20, col); },
  scroll(c, col) { c.fillStyle = col; c.fillRect(26, 52, 48, 56); circle(c, 26, 80, 6, col); circle(c, 74, 80, 6, col); },
  rain(c, col) { c.strokeStyle = col; c.lineWidth = 2.5; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(20 + i * 8, 50 + (i % 3) * 8); c.lineTo(14 + i * 8, 76 + (i % 3) * 8); c.stroke(); } },
  wind(c, col) { c.strokeStyle = col; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(18, 60 + i * 16); c.bezierCurveTo(50, 50 + i * 16, 70, 76 + i * 16, 84, 60 + i * 16); c.stroke(); } },
  tree(c, col) { c.fillStyle = col; c.fillRect(46, 80, 8, 32); circle(c, 50, 66, 24, col); },
  gate(c, col) { c.fillStyle = col; c.fillRect(22, 54, 56, 7); c.fillRect(28, 64, 44, 4); c.fillRect(32, 54, 6, 56); c.fillRect(62, 54, 6, 56); },
  fish(c, col) { c.fillStyle = col; ell(c, 46, 78, 26, 12, 0, col); c.beginPath(); c.moveTo(70, 78); c.lineTo(88, 64); c.lineTo(88, 92); c.closePath(); c.fill(); },
  moonS(c, col) { MOTIF_K.moon(c, col); },
  spark(c, col) { c.strokeStyle = col; c.lineWidth = 2.5; for (let i = 0; i < 14; i++) { const a = i * TAU / 14; c.beginPath(); c.moveTo(50 + Math.cos(a) * 8, 78 + Math.sin(a) * 8); c.lineTo(50 + Math.cos(a) * 32, 78 + Math.sin(a) * 32); c.stroke(); } },
  hand(c, col) { c.fillStyle = col; for (let i = 0; i < 4; i++) rrectFill(c, 30 + i * 11, 50 + Math.abs(1.5 - i) * 6, 8, 34, 4, col); rrectFill(c, 28, 80, 46, 28, 10, col); },
  mountain(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(14, 110); c.lineTo(42, 56); c.lineTo(56, 78); c.lineTo(66, 64); c.lineTo(90, 110); c.closePath(); c.fill(); },
  flower(c, col) { sakuraFlower(c, 50, 80, 26, col, 0, 'rgba(255,255,255,0.5)'); },
  crane(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(14, 70); c.lineTo(50, 86); c.lineTo(86, 60); c.lineTo(56, 96); c.lineTo(44, 98); c.closePath(); c.fill(); },
  rock(c, col) { ell(c, 34, 92, 18, 14, 0, col); ell(c, 66, 86, 22, 20, 0, col); },
  stripe(c, col) { c.fillStyle = col; for (let i = 0; i < 4; i++) c.fillRect(20 + i * 16, 52, 8, 56); },
  daruma(c, col) { ell(c, 50, 84, 26, 30, 0, col); circle(c, 50, 70, 12, 'rgba(247,240,222,0.85)'); },
  crack(c, col) { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(30, 50); c.lineTo(46, 72); c.lineTo(38, 84); c.lineTo(58, 104); c.lineTo(70, 96); c.stroke(); },
  cat(c, col) { circle(c, 50, 84, 22, col); c.fillStyle = col; c.beginPath(); c.moveTo(30, 72); c.lineTo(34, 50); c.lineTo(46, 64); c.closePath(); c.fill(); c.beginPath(); c.moveTo(70, 72); c.lineTo(66, 50); c.lineTo(54, 64); c.closePath(); c.fill(); },
  mask(c, col) { ell(c, 50, 80, 24, 30, 0, col); c.fillStyle = col; c.beginPath(); c.moveTo(30, 56); c.lineTo(26, 38); c.lineTo(40, 52); c.fill(); c.beginPath(); c.moveTo(70, 56); c.lineTo(74, 38); c.lineTo(60, 52); c.fill(); },
  deer(c, col) { c.strokeStyle = col; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(50, 104); c.lineTo(50, 70); c.lineTo(34, 50); c.moveTo(42, 60); c.lineTo(30, 62); c.moveTo(50, 70); c.lineTo(66, 50); c.moveTo(58, 60); c.lineTo(70, 62); c.stroke(); },
  mirror(c, col) { circle(c, 50, 74, 26, null, col, 5); circle(c, 50, 74, 18, col); c.fillStyle = col; c.fillRect(46, 98, 8, 16); },
  frame(c, col) { c.strokeStyle = col; c.lineWidth = 5; c.strokeRect(24, 52, 52, 56); },
  shadow(c, col) { ell(c, 50, 104, 26, 6, 0, col); circle(c, 50, 64, 10, col); c.fillStyle = col; c.fillRect(40, 72, 20, 30); },
  boat(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(16, 88); c.lineTo(84, 88); c.lineTo(72, 106); c.lineTo(28, 106); c.closePath(); c.fill(); c.fillRect(48, 50, 4, 38); c.beginPath(); c.moveTo(52, 52); c.lineTo(76, 70); c.lineTo(52, 84); c.fill(); },
  biwa(c, col) { ell(c, 50, 90, 20, 24, 0, col); c.fillStyle = col; c.fillRect(46, 46, 8, 30); },
  dragon(c, col) { c.strokeStyle = col; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, 110); c.bezierCurveTo(10, 60, 70, 100, 60, 64); c.bezierCurveTo(54, 40, 80, 44, 84, 56); c.stroke(); },
  jewel(c, col) { tomoe(c, 50, 78, 22, col); circle(c, 50, 78, 32, null, col, 3); },
  knot(c, col) { c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.ellipse(38, 78, 14, 10, 0.5, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(62, 78, 14, 10, -0.5, 0, TAU); c.stroke(); },
  ema(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(24, 66); c.lineTo(50, 50); c.lineTo(76, 66); c.lineTo(76, 106); c.lineTo(24, 106); c.closePath(); c.fill(); },
  lantern(c, col) { ell(c, 50, 80, 20, 26, 0, col); c.fillStyle = col; c.fillRect(40, 50, 20, 5); c.fillRect(40, 105, 20, 5); },
  lightning(c, col) { c.fillStyle = col; c.beginPath(); c.moveTo(56, 44); c.lineTo(34, 84); c.lineTo(50, 84); c.lineTo(40, 116); c.lineTo(68, 72); c.lineTo(52, 72); c.lineTo(64, 44); c.closePath(); c.fill(); }
};
function rrectFill(c, x, y, w, h, r, col) { rrect(c, x, y, w, h, r); c.fillStyle = col; c.fill(); }
ART.kamiTo = function (c, def, w, h, opt) {
  opt = opt || {};
  const rc = D.RARITY[def.rar].col;
  c.save(); c.scale(w / 100, h / 160);
  rrect(c, 0, 0, 100, 160, 6);
  c.fillStyle = def.rar >= 4 ? goldGrad(c, 0, 0, 100, 160) : rc; c.fill();
  rrect(c, 4, 4, 92, 152, 4);
  const pg = c.createLinearGradient(0, 0, 0, 160); pg.addColorStop(0, '#fbf6e8'); pg.addColorStop(1, '#efe4c8');
  c.fillStyle = pg; c.fill();
  // 和紙の繊維
  const R = prng(hashStr('kami' + def.id));
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = '#e2d4b0'; c.lineWidth = 0.4;
  for (let i = 0; i < 16; i++) { const x = 6 + R() * 88, y = 24 + R() * 130; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R() * 10 - 5, y + R() * 10); c.stroke(); }
  c.restore();
  // 上の帯
  c.fillStyle = def.rar >= 4 ? '#8a6418' : rc; c.fillRect(4, 4, 92, 18);
  c.fillStyle = '#fff6e0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 10px ' + FONT_MIN;
  c.fillText(def.rar === 5 ? '進 化' : '神 札 ・ ' + D.RARITY[def.rar].name, 50, 13.5);
  // 模様
  c.save(); c.globalAlpha = 0.16;
  const mf = MOTIF_K[def.motif] || MOTIF_K.circle;
  mf(c, def.rar >= 4 ? '#b8892a' : rc);
  c.restore();
  // 字
  const kj = def.kj;
  c.fillStyle = PAL.sumi;
  const n = kj.length;
  const fs = n === 1 ? 50 : n === 2 ? 36 : 27;
  c.font = '400 ' + fs + 'px ' + FONT_BRUSH;
  const top = 80 - (fs * n) / 2;
  for (let i = 0; i < n; i++) c.fillText(kj[i], 50, top + fs * (i + 0.5) + 2);
  // 判子
  c.save(); c.translate(76, 140); c.rotate(-0.1);
  rrect(c, -9, -9, 18, 18, 2); c.fillStyle = PAL.shu; c.fill();
  c.strokeStyle = 'rgba(255,240,220,0.7)'; c.lineWidth = 0.8; rrect(c, -7, -7, 14, 14, 1); c.stroke();
  c.fillStyle = '#fff'; c.font = '700 11px ' + FONT_BRUSH; c.fillText('神', 0, 1);
  c.restore();
  if (def.rar >= 4) leafFlakes(c, true, hashStr('k' + def.id));
  if (def.rar === 5) { c.strokeStyle = '#7a3f8f'; c.lineWidth = 2; rrect(c, 6, 24, 88, 130, 3); c.stroke(); }
  c.restore();
};

/* ---------------- お守り ---------------- */
const OMA_COL = { kinpaku: '#c99a2e', shuzumi: '#c8402a', aidama: '#2c4a8e', ginpaku: '#9aa0aa', urushinuri: '#1e1a18', kasaneIn: '#a8281c',
  fukuIn: '#c99a2e', inoriIn: '#2c4a8e', tsukigae: '#6b4c8a', koyomiokuri: '#3f7a4a', harai: '#f2efe6', utsushi: '#5a7a9a',
  omikuji: '#c8402a', saisenO: '#b8892a', fukubukuro: '#d8506a', shoukon: '#4a3a6a', kamikakushi: '#2a3a2a' };
ART.omaTo = function (c, def, w, h) {
  c.save(); c.scale(w / 100, h / 140);
  if (def.type === 'ema') {
    c.strokeStyle = '#c8402a'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 30); c.lineTo(50, 6); c.lineTo(70, 30); c.stroke();
    c.beginPath(); c.moveTo(6, 40); c.lineTo(50, 18); c.lineTo(94, 40); c.lineTo(94, 132); c.lineTo(6, 132); c.closePath();
    const g = c.createLinearGradient(0, 18, 0, 132); g.addColorStop(0, '#e6c28a'); g.addColorStop(1, '#c69a5a');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(110,70,30,0.3)'; c.lineWidth = 0.8;
    for (let y = 46; y < 130; y += 7) { c.beginPath(); c.moveTo(10, y); c.quadraticCurveTo(50, y + 3, 90, y); c.stroke(); }
    c.fillStyle = '#5a3a1a'; c.fillRect(6, 40, 88, 3);
    c.fillStyle = PAL.sumi; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '400 46px ' + FONT_BRUSH; c.fillText(def.kj, 50, 86);
    c.fillStyle = PAL.shu; c.font = '700 11px ' + FONT_MIN; c.fillText('絵馬', 50, 120);
  } else {
    const col = OMA_COL[def.id] || PAL.shu;
    // 紐
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(40, 22); c.quadraticCurveTo(50, 2, 60, 22); c.stroke();
    c.strokeStyle = PAL.shu; c.lineWidth = 2; c.beginPath(); c.moveTo(42, 24); c.quadraticCurveTo(50, 8, 58, 24); c.stroke();
    // 袋
    c.beginPath(); c.moveTo(14, 40); c.quadraticCurveTo(14, 20, 50, 20); c.quadraticCurveTo(86, 20, 86, 40); c.lineTo(86, 126); c.quadraticCurveTo(86, 134, 78, 134); c.lineTo(22, 134); c.quadraticCurveTo(14, 134, 14, 126); c.closePath();
    const g = c.createLinearGradient(0, 20, 100, 134); g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.2));
    c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.2; c.stroke();
    // 金襴の模様
    c.save(); c.clip(); c.globalAlpha = 0.22; c.fillStyle = '#f1d488';
    for (let y = 26; y < 134; y += 10) for (let x = 14 + (y % 20 ? 5 : 0); x < 88; x += 10) { c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y); c.fill(); }
    c.restore();
    // 結び
    circle(c, 50, 28, 5, PAL.shu, '#7a1a10', 1);
    // 札
    rrect(c, 32, 44, 36, 78, 3); c.fillStyle = '#fbf6e8'; c.fill(); c.strokeStyle = '#c99a2e'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = PAL.sumi; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 9px ' + FONT_MIN; c.fillText('御守', 50, 54);
    c.font = '400 30px ' + FONT_BRUSH; c.fillText(def.kj, 50, 88);
    c.fillStyle = PAL.shu; c.fillRect(44, 106, 12, 12);
    c.fillStyle = '#fff'; c.font = '700 8px ' + FONT_BRUSH; c.fillText('守', 50, 112.5);
  }
  c.restore();
};
/* 袋(茶屋の福袋) */
ART.packTo = function (c, t, w, h) {
  const P = D.PACKS[t];
  const col = { kami: '#2c4a6e', bigkami: '#6b2c6e', oma: '#c8402a', ema: '#8a5a2a', card: '#3f6a3a' }[t];
  c.save(); c.scale(w / 100, h / 140);
  c.beginPath(); c.moveTo(20, 46); c.quadraticCurveTo(50, 30, 80, 46); c.lineTo(92, 120); c.quadraticCurveTo(50, 140, 8, 120); c.closePath();
  const g = c.createLinearGradient(0, 30, 100, 140); g.addColorStop(0, shade(col, 0.2)); g.addColorStop(1, shade(col, -0.25));
  c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.2; c.stroke();
  c.save(); c.clip(); c.globalAlpha = 0.2; c.strokeStyle = '#f1d488'; c.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(16 + i * 16, 130, 14, Math.PI, TAU); c.stroke(); c.beginPath(); c.arc(8 + i * 16, 112, 14, Math.PI, TAU); c.stroke(); }
  c.restore();
  // 口の結び
  c.fillStyle = shade(col, -0.1); c.beginPath(); c.moveTo(28, 44); c.quadraticCurveTo(50, 8, 72, 44); c.quadraticCurveTo(50, 36, 28, 44); c.fill();
  c.strokeStyle = '#d4a73a'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(24, 46); c.quadraticCurveTo(50, 36, 76, 46); c.stroke();
  circle(c, 50, 42, 6, '#d4a73a', '#8a6418', 1);
  rrect(c, 34, 62, 32, 44, 3); c.fillStyle = '#fbf6e8'; c.fill(); c.strokeStyle = '#c99a2e'; c.lineWidth = 1; c.stroke();
  c.fillStyle = PAL.sumi; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '400 26px ' + FONT_BRUSH; c.fillText(P.kj, 50, 85);
  if (t === 'bigkami') { c.fillStyle = '#d4a73a'; c.font = '700 10px ' + FONT_MIN; c.fillText('大', 50, 116); }
  c.restore();
};
/* 紋(相手・主・縁起物・デッキ) */
ART.emblemTo = function (c, kj, col, w, h, opt) {
  opt = opt || {};
  const s = Math.min(w, h);
  c.save(); c.translate(w / 2, h / 2); c.scale(s / 100, s / 100);
  circle(c, 0, 0, 47, opt.boss ? '#1f1a17' : '#fbf6e8');
  circle(c, 0, 0, 47, null, col, 4);
  circle(c, 0, 0, 40, null, col, 1.4);
  if (opt.boss) { for (let i = 0; i < 16; i++) { c.save(); c.rotate(i * TAU / 16); c.fillStyle = col; c.beginPath(); c.ellipse(0, -43.5, 2.2, 4, 0, 0, TAU); c.fill(); c.restore(); } }
  c.fillStyle = opt.boss ? '#f4e6c4' : col; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '400 ' + (kj.length > 1 ? 32 : 48) + 'px ' + FONT_BRUSH;
  if (kj.length > 1) { c.fillText(kj[0], 0, -15); c.fillText(kj[1], 0, 18); } else c.fillText(kj, 0, 3);
  c.restore();
};

/* ---------------- 和紙の背景(金の霞つき) ---------------- */
function suyari(c, x, y, w, h, R) {
  const r = h / 2;
  c.save();
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); c.closePath();
  c.shadowColor = 'rgba(90,60,10,0.25)'; c.shadowBlur = 6; c.shadowOffsetY = 1.5;
  c.fillStyle = goldGrad(c, x, y - h, x + w * 0.5, y + h * 2);
  c.fill();
  c.shadowColor = 'transparent';
  c.clip();
  // 金箔の継ぎ目と、箔ごとの色むら
  const s = h * 0.95;
  for (let gx = x; gx < x + w; gx += s) for (let gy = y - s * 0.3; gy < y + h; gy += s) {
    const v = R();
    c.fillStyle = v < 0.5 ? 'rgba(255,240,190,' + (v * 0.3) + ')' : 'rgba(120,80,10,' + ((v - 0.5) * 0.22) + ')';
    c.fillRect(gx, gy, s, s);
  }
  c.strokeStyle = 'rgba(110,75,10,0.22)'; c.lineWidth = 0.6;
  for (let gx = x; gx < x + w; gx += s) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
  for (let gy = y - s * 0.3; gy < y + h; gy += s) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
  c.restore();
  c.save();
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); c.closePath();
  c.strokeStyle = 'rgba(120,85,15,0.55)'; c.lineWidth = 1; c.stroke();
  c.restore();
}
ART.washi = function (cv, w, h, q) {
  const dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, '#f2e9d4'); g.addColorStop(0.55, '#ebdfc4'); g.addColorStop(1, '#e2d3b2');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const R = prng(7);
  // 繊維
  const nF = Math.round(w * h / (q >= 2 ? 900 : 2200));
  for (let i = 0; i < nF; i++) {
    const x = R() * w, y = R() * h, l = 6 + R() * 26, a = R() * TAU;
    c.strokeStyle = R() < 0.6 ? 'rgba(255,252,242,' + (0.25 + R() * 0.35) + ')' : 'rgba(150,120,80,' + (0.04 + R() * 0.05) + ')';
    c.lineWidth = 0.4 + R() * 0.9;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  // 金砂子
  for (let i = 0; i < w * h / 6000; i++) { c.fillStyle = 'rgba(200,160,60,' + (0.15 + R() * 0.35) + ')'; const s = 0.6 + R() * 1.6; c.fillRect(R() * w, R() * h, s, s); }
  // すやり霞(屏風の金の帯): 上と下に、端の丸い横長の帯を重ねる
  const bh = Math.max(16, Math.min(40, h * 0.042));
  const bands = [
    [-0.12, -0.45, 0.62], [0.38, 0.42, 0.78], [0.78, -0.2, 0.4],
    [-0.08, -1.2, 0.5], [0.3, -2.1, 0.72], [0.66, -1.05, 0.5]
  ];
  bands.forEach(([fx, fy, fw], i) => {
    const bw = w * fw, x = w * fx, y = i < 3 ? fy * bh : h + fy * bh;
    suyari(c, x, y, bw, bh * (i % 2 ? 0.85 : 1), R);
  });
  // 四隅を少し暗く
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(60,40,10,0)'); v.addColorStop(1, 'rgba(60,40,10,0.22)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
};

/* ---------------- 取っておき(キャッシュ) ---------------- */
const ART_CACHE = new Map();
function artCanvas(key, w, h, draw) {
  const k = key + '@' + w + 'x' + h;
  let cv = ART_CACHE.get(k);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    if (ART_CACHE.size > 600) ART_CACHE.clear();
    ART_CACHE.set(k, cv);
  }
  return cv;
}
ART.clearCache = () => ART_CACHE.clear();
ART.cardKey = c => 'c' + c.f + '|' + c.m + '|' + (c.e || '') + '|' + (c.s || '') + (c.e === 'urushi' || c.e === 'kin' || c.e === 'gin' ? '|' + c.u : '');
/* 要素の中の canvas に描く(pw, ph はピクセル) */
ART.paintCard = (cv, card, pw, ph) => { blit(cv, artCanvas(ART.cardKey(card), pw, ph, (c, w, h) => ART.cardTo(c, card, w, h)), pw, ph); };
ART.paintBack = (cv, pw, ph) => { blit(cv, artCanvas('back', pw, ph, (c, w, h) => ART.backTo(c, w, h)), pw, ph); };
ART.paintKami = (cv, def, pw, ph) => { blit(cv, artCanvas('k' + def.id, pw, ph, (c, w, h) => ART.kamiTo(c, def, w, h)), pw, ph); };
ART.paintOma = (cv, def, pw, ph) => { blit(cv, artCanvas('o' + def.id, pw, ph, (c, w, h) => ART.omaTo(c, def, w, h)), pw, ph); };
ART.paintPack = (cv, t, pw, ph) => { blit(cv, artCanvas('p' + t, pw, ph, (c, w, h) => ART.packTo(c, t, w, h)), pw, ph); };
ART.paintEmblem = (cv, kj, col, pw, ph, opt) => { blit(cv, artCanvas('e' + kj + col + (opt && opt.boss ? 'b' : ''), pw, ph, (c, w, h) => ART.emblemTo(c, kj, col, w, h, opt)), pw, ph); };
function blit(cv, src, pw, ph) {
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const c = cv.getContext('2d');
  c.clearRect(0, 0, pw, ph);
  c.drawImage(src, 0, 0);
}
