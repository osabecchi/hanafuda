'use strict';
/* 花暦 — ui: 勝負の画面。札(スプライト)の配置と動き、選ぶ・並べ替える操作、得点の数え上げ演出
   札・神札・お守りは #sprites の中に絶対配置した要素で、毎フレーム目標の位置へなめらかに動く */
const $ = id => document.getElementById(id);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const UI = {
  run: null, sel: [], cursor: -1, lock: false, sprites: new Map(), field: [], fieldOut: [], L: null, playRect: null,
  disp: { ten: 0, bai: 0, score: 0, ryo: 0 }, tgt: { ten: 0, bai: 0, score: 0, ryo: 0 }, calcMode: 'idle',
  drag: null, ff: 1, active: false, landscape: false, pending: null, dpr: 1
};

/* ---------------- 演出の段取り(タイムライン) ---------------- */
const TL = { q: [], cur: null };
function tl(dur, fn) { TL.q.push({ dur, fn }); }
function tlBusy() { return TL.q.length > 0 || !!TL.cur; }
function tlUpdate(dt) {
  const sp = D.ANIM.speeds[SAVE.set.speed] || 1;
  let budget = dt * sp * UI.ff;
  let guard = 0;
  while (guard++ < 200) {
    if (!TL.cur) {
      if (!TL.q.length) { UI.ff = 1; return; }
      TL.cur = TL.q.shift();
      TL.cur.left = TL.cur.dur;
      try { if (TL.cur.fn) TL.cur.fn(); } catch (e) { console.error(e); }
    }
    if (TL.cur.left > budget) { TL.cur.left -= budget; return; }
    budget -= TL.cur.left;
    TL.cur = null;
  }
}

/* ---------------- スプライト ---------------- */
function makeSprite(kind, u) {
  const e = el('div', 'sp ' + kind);
  const cv = el('canvas');
  e.appendChild(cv);
  const ov = el('div', 'ov'); e.appendChild(ov);
  let extra = null;
  if (kind === 'card') { extra = el('div', 'tag', '旬'); extra.style.display = 'none'; e.appendChild(extra); }
  if (kind === 'kami') { extra = el('div', 'st'); extra.style.display = 'none'; e.appendChild(extra); }
  $('sprites').appendChild(e);
  const s = { el: e, cv, ov, extra, kind, u, x: 0, y: 0, r: 0, s: 1, tx: 0, ty: 0, tr: 0, ts: 1, w: 10, h: 16, z: 0, jy: 0, jv: 0, sb: 0, key: '', op: 1, top: 1, delay: 0, dead: false, lastT: '' };
  bindSprite(s);
  UI.sprites.set(kind + u, s);
  return s;
}
function spr(kind, u) { return UI.sprites.get(kind + u); }
function killSprite(s, fade) {
  if (!s || s.dead) return;
  s.dead = true;
  if (fade) { s.top = 0; s.ts = 0.6; setTimeout(() => { s.el.remove(); UI.sprites.delete(s.kind + s.u); }, 380); }
  else { s.el.remove(); UI.sprites.delete(s.kind + s.u); }
}
function paintSprite(s) {
  const run = UI.run;
  const pw = Math.max(8, Math.round(s.w * UI.dpr)), ph = Math.max(8, Math.round(s.h * UI.dpr));
  let key;
  if (s.kind === 'card') {
    const c = cardOf(run, s.u);
    if (!c) return;
    const down = run.rs && run.rs.down.indexOf(s.u) >= 0 && UI.field.indexOf(s.u) < 0;
    key = (down ? 'back' : ART.cardKey(c)) + pw + 'x' + ph;
    if (key !== s.key) { s.key = key; if (down) ART.paintBack(s.cv, pw, ph); else ART.paintCard(s.cv, c, pw, ph); }
    const deb = !down && isDebuffed(run, c);
    s.el.classList.toggle('deb', deb);
    const shun = !down && run.rs && c.m === curMonth(run) && run.phase !== 'shop';
    s.el.classList.toggle('shun', shun);
    s.extra.style.display = shun ? '' : 'none';
  } else if (s.kind === 'kami') {
    const k = run.kami.find(q => q.u === s.u);
    if (!k) return;
    const def = D.KAMI_BY[k.id];
    key = def.id + pw + 'x' + ph;
    if (key !== s.key) { s.key = key; ART.paintKami(s.cv, def, pw, ph); }
    const t = def.cur ? def.cur(k).replace(/^今 /, '') : '';
    if (t !== s.lastT) { s.lastT = t; s.extra.textContent = t; s.extra.style.display = t ? '' : 'none'; }
    s.el.classList.toggle('sleep', run.rs && run.rs.sleep >= 0 && run.kami[run.rs.sleep] === k && UI.lock);
  } else if (s.kind === 'oma') {
    const o = run.oma.find(q => q.u === s.u);
    if (!o) return;
    key = o.id + pw + 'x' + ph;
    if (key !== s.key) { s.key = key; ART.paintOma(s.cv, D.OMA_BY[o.id], pw, ph); }
  }
}
function bump(s, amt) { if (!s) return; s.jv -= 420 * (amt || 1); s.sb = Math.max(s.sb, 0.12 * (amt || 1)); }
function updateSprites(dt) {
  const k = 1 - Math.exp(-dt * 16), kr = 1 - Math.exp(-dt * 12);
  for (const s of UI.sprites.values()) {
    if (s.delay > 0) { s.delay -= dt * UI.ff; s.el.style.opacity = '0'; continue; }
    if (UI.drag && UI.drag.s === s && UI.drag.moved) { s.x = s.tx; s.y = s.ty; }
    else { s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; }
    s.r += (s.tr - s.r) * kr; s.s += (s.ts - s.s) * kr; s.op += (s.top - s.op) * kr;
    // はねる(ばね)
    s.jv += (-s.jy * 260 - s.jv * 16) * dt; s.jy += s.jv * dt;
    s.sb *= Math.exp(-dt * 9);
    const sc = s.s * (1 + s.sb);
    const tr = 'translate3d(' + (s.x - s.w / 2).toFixed(1) + 'px,' + (s.y - s.h / 2 + s.jy).toFixed(1) + 'px,0) rotate(' + s.r.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
    if (tr !== s._tr) { s.el.style.transform = tr; s._tr = tr; }
    const op = s.op.toFixed(2);
    if (op !== s._op) { s.el.style.opacity = op; s._op = op; }
    if (s.z !== s._z) { s.el.style.zIndex = s.z; s._z = s.z; }
  }
}
function setSize(s, w, h) {
  if (Math.abs(s.w - w) > 0.5 || Math.abs(s.h - h) > 0.5) { s.w = w; s.h = h; s.el.style.width = w + 'px'; s.el.style.height = h + 'px'; }
}

/* ---------------- 配置 ---------------- */
function visHand() {
  const run = UI.run, rs = run && run.rs;
  if (!rs || !(run.phase === 'round' || run.phase === 'koikoi' || run.phase === 'won' || run.phase === 'over')) return [];
  return UI.pendingDraw ? rs.hand.filter(u => UI.pendingDraw.indexOf(u) < 0) : rs.hand;
}
function relRect(e) {
  const p = UI.playRect, r = e.getBoundingClientRect();
  return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
}
UI.layout = function () {
  const run = UI.run;
  if (!run || !UI.active) return;
  const playEl = $('play');
  UI.playRect = playEl.getBoundingClientRect();
  UI.dpr = Math.min(window.devicePixelRatio || 1, SAVE.set.quality >= 2 ? 2.5 : SAVE.set.quality === 1 ? 1.5 : 1);
  const land = window.innerWidth >= window.innerHeight * 1.25;
  if (land !== UI.landscape) {
    UI.landscape = land;
    const calc = $('calc');
    if (land) { $('hud-info').appendChild(calc); calc.style.cssText = 'position:static;transform:none;justify-content:center;margin-top:2px'; }
    else { $('field').appendChild(calc); calc.style.cssText = ''; }
  }
  const kr = relRect($('kami-row')), fr = relRect($('field')), hr = relRect($('hand-area'));
  const L = UI.L = { kr, fr, hr };
  // 手札
  const rs = run.rs;
  const hand = visHand();
  const n = Math.max(1, hand.length);
  let ch = Math.min(hr.h / 1.17, (hr.w / (1 + 0.55 * (n - 1))) / 0.625, 230);
  ch = Math.max(48, ch);
  const cw = ch * 0.625;
  const spacing = n > 1 ? Math.min(cw * 1.05, (hr.w - cw) / (n - 1)) : 0;
  const total = cw + spacing * (n - 1);
  const x0 = hr.x + (hr.w - total) / 2 + cw / 2;
  L.cw = cw; L.ch = ch; L.spacing = spacing; L.x0 = x0;
  const mid = (n - 1) / 2, droop = Math.min(0.7, ch * 0.05 / Math.max(1, mid * mid));
  L.hand = hand.map((u, i) => {
    const d = i - mid;
    return { x: x0 + i * spacing, y: hr.y + hr.h - ch / 2 - 3 - droop * mid * mid + d * d * droop, r: d * 1.3 };
  });
  // 場
  const m = Math.max(1, UI.field.length);
  const top = land ? 30 : 30, bottom = land ? 6 : 50;
  let fh = Math.min(ch, Math.max(40, fr.h - top - bottom));
  let fw = fh * 0.625;
  const fsp = m > 1 ? Math.min(fw * 1.08, (fr.w - 40 - fw) / (m - 1)) : 0;
  if (fsp < fw * 0.6 && m > 1) { fw = Math.min(fw, (fr.w - 40) / (1 + 0.6 * (m - 1))); fh = fw / 0.625; }
  const fsp2 = m > 1 ? Math.min(fw * 1.08, (fr.w - 40 - fw) / (m - 1)) : 0;
  const fx0 = fr.x + (fr.w - (fw + fsp2 * (m - 1))) / 2 + fw / 2;
  L.fw = fw; L.fh = fh;
  L.field = UI.field.map((u, i) => ({ x: fx0 + i * fsp2, y: fr.y + top + (fr.h - top - bottom) / 2 }));
  L.pile = { x: fr.x + fr.w - 18, y: fr.y + fr.h - 30 };
  // 神札とお守り
  const nO = omaMax(run);
  let kh = kr.h - 4, kw = kh * 0.625, oh = kh * 0.82, ow = oh * (100 / 140);
  const g = 6;
  const gaps = (5 + nO - 1) * g + 10;
  const need = 5 * kw + nO * ow + gaps;
  if (need > kr.w) { const f = Math.max(0.3, (kr.w - gaps) / (5 * kw + nO * ow)); kh *= f; kw *= f; oh *= f; ow *= f; }
  const used = 5 * kw + nO * ow + (5 + nO - 1) * g + 10;
  const kx0 = kr.x + Math.max(0, (kr.w - used) / 2);
  L.kw = kw; L.kh = kh; L.ow = ow; L.oh = oh;
  L.kami = []; L.oma = [];
  for (let i = 0; i < 5; i++) L.kami.push({ x: kx0 + i * (kw + g) + kw / 2, y: kr.y + kr.h / 2 });
  const ox0 = kx0 + 5 * (kw + g) + 10;
  for (let i = 0; i < nO; i++) L.oma.push({ x: ox0 + i * (ow + g) + ow / 2, y: kr.y + kr.h / 2 + (kh - oh) / 2 });
  // 枠の点線
  const row = $('kami-row');
  const want = 5 + nO;
  while (row.children.length < want) row.appendChild(el('div', 'slot'));
  while (row.children.length > want) row.lastChild.remove();
  for (let i = 0; i < want; i++) {
    const sl = row.children[i], isO = i >= 5, p = isO ? L.oma[i - 5] : L.kami[i];
    const w = isO ? ow : kw, h = isO ? oh : kh;
    sl.className = 'slot' + (isO ? ' oma' : '');
    sl.style.cssText = 'left:' + (p.x - kr.x - w / 2) + 'px;top:' + (p.y - kr.y - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px';
  }
  UI.assignTargets();
};
UI.assignTargets = function () {
  const run = UI.run, L = UI.L;
  if (!run || !L) return;
  const rs = run.rs;
  const vh = visHand();
  const showHand = vh.length > 0;
  if (showHand) {
    vh.forEach((u, i) => {
      let s = spr('card', u);
      if (!s) { s = makeSprite('card', u); s.x = L.pile.x; s.y = L.pile.y; s.s = 0.4; s.r = 20; }
      setSize(s, L.cw, L.ch);
      const p = L.hand[i];
      if (!(UI.drag && UI.drag.s === s && UI.drag.moved)) { s.tx = p.x; s.ty = p.y - (UI.sel.indexOf(u) >= 0 ? L.ch * 0.17 : 0); }
      s.tr = p.r; s.ts = 1; s.top = 1; s.z = 10 + i;
      s.el.classList.toggle('sel', UI.sel.indexOf(u) >= 0);
      s.el.classList.toggle('cur', UI.cursor === i && UI.kbd);
      paintSprite(s);
    });
  }
  UI.field.forEach((u, i) => {
    let s = spr('card', u);
    if (!s) s = makeSprite('card', u);
    setSize(s, L.fw, L.fh);
    s.tx = L.field[i].x; s.ty = L.field[i].y; s.tr = 0; s.ts = 1; s.z = 22 + i;
    s.el.classList.remove('sel', 'cur');
    paintSprite(s);
  });
  run.kami.forEach((k, i) => {
    let s = spr('kami', k.u);
    if (!s) { s = makeSprite('kami', k.u); const p = L.kami[Math.min(i, 4)]; s.x = p.x; s.y = p.y - 30; s.op = 0; s.s = 0.5; }
    setSize(s, L.kw, L.kh);
    const p = L.kami[Math.min(i, 4)];
    if (!(UI.drag && UI.drag.s === s && UI.drag.moved)) { s.tx = p.x; s.ty = p.y; }
    s.tr = 0; s.ts = 1; s.top = 1; s.z = 6 + i;
    paintSprite(s);
  });
  run.oma.forEach((o, i) => {
    let s = spr('oma', o.u);
    if (!s) { s = makeSprite('oma', o.u); const p = L.oma[Math.min(i, L.oma.length - 1)]; s.x = p.x; s.y = p.y - 30; s.op = 0; }
    setSize(s, L.ow, L.oh);
    const p = L.oma[Math.min(i, L.oma.length - 1)];
    s.tx = p.x; s.ty = p.y; s.tr = 0; s.ts = 1; s.top = 1; s.z = 6;
    paintSprite(s);
  });
  // いなくなったもの
  for (const s of [...UI.sprites.values()]) {
    if (s.dead) continue;
    if (s.kind === 'card' && vh.indexOf(s.u) < 0 && UI.field.indexOf(s.u) < 0 && UI.fieldOut.indexOf(s.u) < 0) killSprite(s, true);
    if (s.kind === 'kami' && !run.kami.some(k => k.u === s.u)) killSprite(s, true);
    if (s.kind === 'oma' && !run.oma.some(o => o.u === s.u)) killSprite(s, true);
  }
};
/* 画面の座標(fx の canvas 用) */
function scr(s, dy) { const p = UI.playRect || { left: 0, top: 0 }; return { x: p.left + s.x, y: p.top + s.y + (dy || 0) }; }
function elCenter(e) { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

/* ---------------- 表示の更新 ---------------- */
UI.hud = function () {
  const run = UI.run;
  if (!run) return;
  const rs = run.rs;
  $('h-month').textContent = monthLabel(run.month);
  $('h-round').textContent = run.round === 2 ? '主の勝負' : ['一', '二'][run.round] + 'の勝負';
  UI.tgt.ryo = run.ryo;
  if (!rs) { $('h-target').textContent = fmt(run.targets[run.round]); $('h-plays').textContent = '-'; $('h-disc').textContent = '-'; $('opp-name').textContent = monthLabel(run.month); $('opp-rule').textContent = ''; $('opp').classList.remove('boss'); }
  if (rs) {
    $('h-target').textContent = fmt(rs.koi ? rs.target2 : rs.target) + (rs.koi ? '(こいこい)' : '');
    $('h-plays').textContent = rs.plays;
    $('h-disc').textContent = rs.discards;
    const opp = rs.boss ? D.BOSS_BY[rs.boss] : D.OPP_BY[rs.opp];
    $('opp-name').textContent = rs.boss ? '主「' + opp.name + '」' : opp.name;
    $('opp-rule').textContent = rs.boss ? opp.d : 'お題: ' + D.ODAI[rs.odai].d + ' (+' + D.ODAI[rs.odai].r + '両)' + (rs.odaiDone ? ' ✔' : '');
    $('opp').classList.toggle('boss', !!rs.boss);
    const key = (rs.boss || rs.opp) + (rs.boss ? 'b' : '');
    if (UI._embKey !== key) { UI._embKey = key; ART.emblemTo($('opp-emb').getContext('2d'), opp.kj, rs.boss ? '#c99a2e' : opp.col, 80, 80, { boss: !!rs.boss }); }
    $('pile-n').textContent = rs.pile.length;
  }
  const canAct = run.phase === 'round' && !UI.lock;
  const sel = UI.sel.length;
  $('btn-play').disabled = !canAct || !sel || !!canPlay(run, UI.sel);
  $('btn-discard').disabled = !canAct || !sel || !!canDiscard(run, UI.sel);
  $('btn-disc-n').textContent = rs ? rs.discards : '';
  $('btn-sort').textContent = run.sortMode === 'kind' ? '種類順' : run.sortMode === 'manual' ? '並べ替え' : '月順';
};
function updateDisplays(dt) {
  const k = 1 - Math.exp(-dt * 14);
  const d = UI.disp, t = UI.tgt;
  for (const key of ['ten', 'bai']) { d[key] += (t[key] - d[key]) * k; if (Math.abs(t[key] - d[key]) < 0.01) d[key] = t[key]; }
  if (Math.abs(t.ryo - d.ryo) >= 0.5) d.ryo += Math.sign(t.ryo - d.ryo) * Math.max(1, Math.abs(t.ryo - d.ryo) * k); else d.ryo = t.ryo;
  if (UI.scoreTween) {
    const st = UI.scoreTween;
    st.t += dt * (D.ANIM.speeds[SAVE.set.speed] || 1) * UI.ff;
    const f = Math.min(1, st.t / st.dur);
    d.score = st.from + (st.to - st.from) * easeOut(f);
    if (Math.random() < 0.5) SFX.count();
    if (f >= 1) { d.score = st.to; UI.scoreTween = null; }
  } else d.score = t.score;
  const tv = $('c-ten'), bv = $('c-bai');
  const bt = t.bai, shown = Math.abs(bt - d.bai) < 0.01 ? bt : d.bai;
  const dec = Math.abs(bt - Math.round(bt)) < 0.005 ? 0 : Math.abs(bt * 10 - Math.round(bt * 10)) < 0.05 ? 1 : 2;
  const ts = fmt(Math.round(d.ten)), bs = fmtBai(dec === 0 ? Math.round(shown) : +shown.toFixed(dec));
  if (tv._v !== ts) { tv._v = ts; tv.textContent = ts; }
  if (bv._v !== bs) { bv._v = bs; bv.textContent = bs; }
  const ss = fmt(d.score);
  if ($('h-score')._v !== ss) { $('h-score')._v = ss; $('h-score').textContent = ss; }
  const rs = UI.run && UI.run.rs;
  if (rs) {
    const tg = rs.koi ? rs.target2 : rs.target;
    $('h-bar').style.width = Math.min(100, d.score / tg * 100) + '%';
    $('h-barw').classList.toggle('done', d.score >= tg);
  }
  const rv = Math.round(d.ryo) + '<small>両</small>';
  if ($('h-ryo')._v !== rv) { $('h-ryo')._v = rv; $('h-ryo').innerHTML = rv; }
  // 数字の跳ね
  for (const id of ['c-ten', 'c-bai']) {
    const e = $(id);
    if (e._p > 0.001) { e._p *= Math.exp(-dt * 10); e.style.transform = 'scale(' + (1 + e._p).toFixed(3) + ')'; }
  }
}
function punch(id, a) { $(id)._p = Math.max($(id)._p || 0, a || 0.18); }
UI.setCalc = function (mode, ten, bai) {
  UI.calcMode = mode;
  $('calc').className = mode;
  if (ten !== undefined) { UI.tgt.ten = ten; UI.tgt.bai = bai; }
};

/* 選んでいる札でできる役の予想 */
UI.preview = function () {
  const run = UI.run;
  const line = $('yaku-line');
  if (!run || run.phase !== 'round' || UI.lock) return;
  if (!UI.sel.length) {
    line.innerHTML = '<span class="hint">' + (UI.isTouch ? '札をタップして選ぶ(最大' + run.rs.maxPlay + '枚)・ドラッグで並べ替え' : '札をクリックして選ぶ(最大' + run.rs.maxPlay + '枚)・ドラッグで並べ替え') + '</span>';
    UI.setCalc('idle', 0, 0);
    return;
  }
  const cards = run.rs.hand.filter(u => UI.sel.indexOf(u) >= 0).map(u => cardOf(run, u));
  const pv = previewYaku(run, cards);
  const err = canPlay(run, UI.sel);
  let html = pv.yaku.map(y => '<span class="y' + (BIG_YAKU.has(y.id) ? ' big' : '') + '">' + D.YAKU_BY[y.id].name + '<small>Lv' + yakuLv(run, y.id) + '</small></span>').join('');
  if (pv.void) html += '<span class="warn"> 迷い家: 最初の出しの役がないと0点</span>';
  else if (err && UI.sel.length > run.rs.maxPlay) html = '<span class="warn">' + esc(err) + '</span>';
  else if (err && /八橋/.test(err)) html += '<span class="warn"> 5枚出す</span>';
  line.innerHTML = html;
  UI.setCalc('preview', pv.ten, pv.bai);
};
const BIG_YAKU = new Set(['goko', 'shiko', 'ameshiko', 'sanko', 'akaao', 'inoshikacho', 'akatan', 'aotan', 'gomai', 'teshi', 'omote', 'matsukiri']);
const MID_YAKU = new Set(['tsukimi', 'hanami', 'kusatan', 'tane', 'tan', 'hanagoyomi', 'sanawase', 'pikaichi']);

/* ---------------- 勝負に入る ---------------- */
UI.enterRound = function () {
  const run = UI.run;
  UI.active = true;
  $('play').hidden = false;
  $('title').hidden = true;
  UI.sel = []; UI.cursor = -1; UI.field = []; UI.fieldOut = []; UI.lock = false; UI.pendingDraw = null;
  for (const s of [...UI.sprites.values()]) if (s.kind === 'card') killSprite(s);
  const rs = run.rs;
  UI.disp.score = UI.tgt.score = rs ? rs.score : 0;
  UI.disp.ryo = UI.tgt.ryo = run.ryo;
  UI.setCalc('idle', 0, 0);
  $('yaku-line').innerHTML = '';
  AU.setMood(run.round === 2 ? 'boss' : 'play');
  FX.setAmbient(0.35, curMonth(run));
  ART.paintBack($('pile-cv'), 60, 96);
  UI.layout();
  // 配る
  if (rs) rs.hand.forEach((u, i) => { const s = spr('card', u); if (s) { s.delay = 0.12 + i * 0.06; s.x = UI.L.pile.x; s.y = UI.L.pile.y; s.s = 0.4; } setTimeout(() => SFX.deal(i), (120 + i * 60) / (D.ANIM.speeds[SAVE.set.speed] || 1)); });
  UI.hud();
  UI.preview();
  if (rs && rs.n === 0 && rs.d === 0) {
    SFX.hyoshigi();
    const opp = rs.boss ? D.BOSS_BY[rs.boss] : D.OPP_BY[rs.opp];
    UI.banner(rs.boss ? '主「' + opp.name + '」' : opp.name + 'との勝負', rs.boss ? opp.d : '「' + opp.line + '」', rs.boss);
  }
  setTimeout(() => UI.coachStep(), 900);
};
UI.leaveRound = function () {
  UI.active = false;
  UI.hideTip();
  UI.coachHide();
};
UI.banner = function (title, sub, boss) {
  const b = el('div', 'stamp in');
  b.innerHTML = '<div class="s' + (boss ? '' : ' gold') + '" style="font-size:clamp(34px,9vw,64px)">' + esc(title) + '</div><div class="l">' + esc(sub || '') + '</div>';
  document.body.appendChild(b);
  setTimeout(() => { b.className = 'stamp out'; setTimeout(() => b.remove(), 320); }, 1300);
};

/* ---------------- 操作 ---------------- */
UI.toggle = function (u) {
  const run = UI.run;
  if (!run || run.phase !== 'round' || UI.lock) return;
  const i = UI.sel.indexOf(u);
  if (i >= 0) { UI.sel.splice(i, 1); SFX.deselect(); }
  else {
    if (UI.sel.length >= Math.max(run.rs.maxPlay, D.RULE.maxDiscard)) { SFX.error(); UI.toast(Math.max(run.rs.maxPlay, D.RULE.maxDiscard) + '枚までです'); return; }
    UI.sel.push(u); SFX.select(UI.sel.length);
    bump(spr('card', u), 0.35);
  }
  UI.assignTargets(); UI.hud(); UI.preview();
  if (UI.sel.length) UI.coachDone('select');
};
UI.clearSel = function () { UI.sel = []; UI.assignTargets(); UI.hud(); UI.preview(); };
UI.sortToggle = function () {
  const run = UI.run;
  if (!run || !run.rs || UI.lock) return;
  run.sortMode = run.sortMode === 'month' ? 'kind' : 'month';
  sortHand(run);
  SFX.page();
  UI.assignTargets(); UI.hud();
  saveRun(run);
};
UI.doDiscard = function () {
  const run = UI.run;
  if (UI.lock || !run || run.phase !== 'round') return;
  const err = canDiscard(run, UI.sel);
  if (err) { UI.toast(err); SFX.error(); return; }
  const out = run.rs.hand.filter(u => UI.sel.indexOf(u) >= 0);
  const res = discard(run, UI.sel);
  if (res.err) return;
  UI.sel = [];
  UI.lock = true;
  UI.pendingDraw = (res.drawn || []).slice();
  UI.hideTip();
  out.forEach((u, i) => {
    const s = spr('card', u);
    if (!s) return;
    UI.fieldOut.push(u);
    setTimeout(() => { s.tx = UI.L.fr.x + UI.L.fr.w + 80; s.ty = s.y - 60 - i * 10; s.tr = 40; s.top = 0; SFX.page(); }, i * 40);
    setTimeout(() => { UI.fieldOut.splice(UI.fieldOut.indexOf(u), 1); killSprite(s); }, 600);
  });
  if (res.ryo) { const p = elCenter($('h-ryo')); FX.pop(p.x, p.y + 26, '+' + res.ryo + '両', '#9a7420', 18); SFX.coin(); }
  MAIN.afterAction();
  setTimeout(() => {
    UI.pendingDraw = null;
    UI.layout();
    res.drawn.forEach((u, i) => { const s = spr('card', u); if (s) { s.delay = i * 0.06; s.x = UI.L.pile.x; s.y = UI.L.pile.y; s.s = 0.4; setTimeout(() => SFX.deal(i), i * 60); } });
    UI.lock = false;
    UI.hud(); UI.preview();
    if (res.outcome === 'lose') MAIN.afterRoundEnd();
  }, 260);
  UI.hud();
  UI.coachDone('discard');
};
UI.doPlay = function () {
  const run = UI.run;
  if (UI.lock || !run || run.phase !== 'round') return;
  const err = canPlay(run, UI.sel);
  if (err) { UI.toast(err); SFX.error(); return; }
  UI.hideTip();
  UI.coachHide();
  const kamiU = run.kami.map(k => k.u);
  const scoreBefore = run.rs.score;
  const targetBefore = run.rs.koi ? run.rs.target2 : run.rs.target;
  const res = play(run, UI.sel);
  if (res.err) { UI.toast(res.err); return; }
  UI.sel = [];
  UI.lock = true;
  UI.field = res.played.slice();
  UI.pendingDraw = (res.drawn || []).slice();
  saveRun(run);
  UI.playback(res, kamiU, scoreBefore, targetBefore);
  UI.coachDone('play');
};

/* ---------------- 得点の数え上げ ---------------- */
UI.playback = function (res, kamiU, scoreBefore, targetBefore) {
  const run = UI.run, x = res.x;
  const sp = () => D.ANIM.speeds[SAVE.set.speed] || 1;
  UI.setCalc('live', 0, 0);
  UI.disp.ten = 0; UI.disp.bai = 0;
  $('yaku-line').innerHTML = '';
  // 場へ
  tl(0.05, () => { UI.layout(); });
  UI.field.forEach((u, i) => tl(0.07, () => { SFX.slap(); const s = spr('card', u); if (s) bump(s, 0.3); }));
  tl(0.28, null);
  let bi = 0, ti = 0;
  const kamiSp = i => spr('kami', kamiU[i]);
  const popAt = (s, text, col, size, dy) => { if (!s) return; const p = scr(s, -s.h * 0.55 + (dy || 0)); FX.pop(p.x, p.y, text, col, size); };
  const evText = e => e.t ? '+' + fmt(e.t) : e.b ? '+' + fmtBai(e.b) + '倍' : e.x ? '×' + fmtBai(e.x) + '倍' : e.r ? '+' + e.r + '両' : '';
  const evCol = e => e.t ? '#2c4a8e' : e.b ? '#c8402a' : e.x ? '#b8861a' : '#9a7420';
  const sound = e => { if (e.t) SFX.ten(ti++); if (e.b) SFX.bai(bi++); if (e.x) SFX.mul(bi++); if (e.r) SFX.coin(); };
  const applyTotals = e => { UI.tgt.ten = e.T; UI.tgt.bai = e.B; if (e.t) punch('c-ten', 0.16); if (e.b || e.x) punch('c-bai', e.x ? 0.3 : 0.18); };
  for (const e of x.ev) {
    const s = e.s;
    if (s.k === 'yaku') {
      const big = BIG_YAKU.has(s.id), mid = MID_YAKU.has(s.id);
      tl(big ? 0.75 : mid ? 0.5 : 0.38, () => {
        applyTotals(e);
        punch('c-ten', 0.2); punch('c-bai', 0.2);
        bi++;
        SFX.yaku(big);
        const chip = el('span', 'y' + (big ? ' big' : ''), D.YAKU_BY[s.id].name + '<small>Lv' + s.lv + '</small>');
        $('yaku-line').appendChild(chip);
        (e.cards || []).forEach(u => { const cs = spr('card', u); bump(cs, 0.6); if (cs && big) { const p = scr(cs); FX.burst(p.x, p.y, 'spark', 6, { speed: 160, col: '255,220,120' }); } });
        UI.stamp(D.YAKU_BY[s.id].name, big ? 'gold' : '', '点 +' + e.t + '  倍 +' + e.b);
        const c = elCenter($('field'));
        if (big) { FX.flashOn(0.5); FX.shakeOn(9); FX.burst(c.x, c.y - 20, 'gold', 26, { speed: 300 }); FX.burst(c.x, c.y - 20, 'petal', 16, { speed: 220, month: curMonth(run) }); FX.ring(c.x, c.y - 20); }
        else if (mid) { FX.flashOn(0.18); FX.shakeOn(4); FX.burst(c.x, c.y - 20, 'gold', 10, { speed: 220 }); }
      });
    } else if (s.k === 'engi') {
      tl(0.3, () => { applyTotals(e); sound(e); const p = elCenter($('c-bai')); FX.pop(p.x, p.y - 26, '御神酒 ' + evText(e), evCol(e), 20); });
    } else if (e.re) {
      tl(0.22, () => { const cs = spr('card', s.u); bump(cs, 0.5); popAt(cs, 'もう一度', '#7a3f8f', 16, -16); SFX.wood(); });
    } else if (s.k === 'card' || s.k === 'held') {
      tl(e.x ? 0.34 : 0.19, () => {
        applyTotals(e); sound(e);
        const cs = spr('card', s.u);
        bump(cs, e.x ? 0.9 : 0.55);
        popAt(cs, evText(e), evCol(e), e.x ? 26 : 21);
        if (e.x) { FX.shakeOn(3.5); if (cs) { const p = scr(cs); FX.burst(p.x, p.y, 'gold', 8, { speed: 200 }); } }
        if (e.r && cs) { const p = scr(cs); FX.burst(p.x, p.y, 'gold', 5, { speed: 140 }); }
      });
    } else if (s.k === 'kami') {
      tl(e.x ? 0.4 : 0.24, () => {
        applyTotals(e); sound(e);
        const ks = kamiSp(s.i);
        bump(ks, e.x ? 1 : 0.6);
        if (ks) { ks.el.classList.add('glow'); setTimeout(() => ks.el.classList.remove('glow'), 280); }
        popAt(ks, evText(e), evCol(e), e.x ? 26 : 21, ks ? ks.h * 1.25 : 0);
        if (e.on) bump(spr('card', e.on), 0.35);
        if (e.x) { FX.shakeOn(5); if (ks) { const p = scr(ks); FX.burst(p.x, p.y, 'gold', 10, { speed: 230 }); FX.ring(p.x, p.y, '232,180,60', 70); } FX.flashOn(0.12); }
      });
    }
  }
  // 合計
  const total = x.total;
  const tgt = targetBefore;
  const ratio = total / Math.max(1, tgt);
  tl(0.32, () => {
    UI.tgt.ten = x.ten; UI.tgt.bai = x.bai;
    punch('c-ten', 0.25); punch('c-bai', 0.25);
  });
  tl(0.15, () => {
    if (x.void) { UI.stamp('不成立', '', '迷い家: 最初の出しの役が入っていない'); SFX.error(); return; }
    const c = elCenter($('calc'));
    FX.pop(c.x, c.y - 34, fmt(total), ratio >= 1 ? '#b8861a' : '#1f1a17', ratio >= 1 ? 42 : ratio >= 0.4 ? 36 : 30, { life: 1.4, rise: 46 });
    SFX.total(ratio >= 0.6);
    if (ratio >= 1) { FX.flashOn(0.75); FX.shakeOn(14); FX.burst(c.x, c.y, 'gold', 40, { speed: 380 }); FX.burst(c.x, c.y, 'petal', 30, { speed: 300, month: curMonth(run) }); FX.ring(c.x, c.y, '232,180,60', 160); }
    else if (ratio >= 0.4) { FX.flashOn(0.3); FX.shakeOn(7); FX.burst(c.x, c.y, 'gold', 18, { speed: 260 }); }
    else { FX.shakeOn(3); FX.burst(c.x, c.y, 'gold', 6, { speed: 160 }); }
    UI.scoreTween = { from: scoreBefore, to: scoreBefore + total, t: 0, dur: Math.min(1.3, 0.35 + Math.log10(1 + total) * 0.16) };
    UI.tgt.score = scoreBefore + total;
  });
  tl(Math.min(1.25, 0.4 + Math.log10(1 + total) * 0.15), null);
  // そのほかの出来事
  tl(0.05, () => {
    if (res.toll) { const p = elCenter($('h-ryo')); FX.pop(p.x, p.y + 26, '-' + res.toll + '両', '#c8402a', 18); }
    if (x.ryo) SFX.coin();
    (res.changed || []).forEach(u => { const s = spr('card', u); if (s) { s.key = ''; paintSprite(s); bump(s, 0.5); const p = scr(s); FX.burst(p.x, p.y, 'gold', 10, { speed: 180 }); } });
    (res.lvUp || []).forEach(y => UI.toast('陰陽師: ' + D.YAKU_BY[y].name + ' が Lv' + yakuLv(run, y) + ' に'));
    (res.gone || []).forEach(u => { const s = spr('kami', u); if (s) { const p = scr(s); FX.burst(p.x, p.y, 'spark', 14, { speed: 200, col: '255,160,80' }); } });
    if (res.gone && res.gone.length) UI.toast('神札が燃え尽きた');
    if (res.scattered && res.scattered.length) {
      res.scattered.forEach((u, i) => { const s = spr('card', u); if (s) { UI.fieldOut.push(u); s.tx = s.x + 120; s.ty = s.y - 140; s.tr = 60; s.top = 0; setTimeout(() => { UI.fieldOut.splice(UI.fieldOut.indexOf(u), 1); killSprite(s); }, 600); } });
      UI.toast('花冷え: 手札が2枚散った');
    }
    UI.hud();
  });
  // 場を片付けて配る
  tl(0.22, () => {
    const out = UI.field.slice();
    UI.field = [];
    out.forEach((u, i) => {
      const s = spr('card', u);
      if (!s) return;
      UI.fieldOut.push(u);
      s.tx = UI.L.fr.x - 80 - i * 10; s.ty = s.y - 40; s.tr = -30; s.top = 0;
      setTimeout(() => { const j = UI.fieldOut.indexOf(u); if (j >= 0) UI.fieldOut.splice(j, 1); killSprite(s); }, 520);
    });
    $('yaku-line').innerHTML = '';
    UI.setCalc('idle', 0, 0);
    UI.pendingDraw = null;
    UI.layout();
    (res.drawn || []).forEach((u, i) => { const s = spr('card', u); if (s) { s.delay = 0.1 + i * 0.06; s.x = UI.L.pile.x; s.y = UI.L.pile.y; s.s = 0.4; setTimeout(() => SFX.deal(i), (100 + i * 60) / sp()); } });
  });
  tl(0.35, () => {
    UI.lock = false;
    MAIN.afterAction();
    UI.hud(); UI.preview();
    if (res.outcome) MAIN.afterRoundEnd(res.outcome);
    else setTimeout(() => UI.coachStep(), 300);
  });
};
UI.stamp = function (text, cls, sub) {
  document.querySelectorAll('.stamp.ystamp').forEach(e => e.remove());
  const b = el('div', 'stamp in ystamp');
  const f = elCenter($('field'));
  b.style.top = (f.y - 10) + 'px';
  b.innerHTML = '<div class="s ' + (cls || '') + '">' + esc(text) + '</div>' + (sub ? '<div class="l">' + esc(sub) + '</div>' : '');
  document.body.appendChild(b);
  const sp = D.ANIM.speeds[SAVE.set.speed] || 1;
  setTimeout(() => { b.className = 'stamp out ystamp'; setTimeout(() => b.remove(), 300); }, 620 / sp / UI.ff);
};
UI.bigStamp = function (text, sub, gold) {
  const b = el('div', 'stamp in');
  b.innerHTML = '<div class="s' + (gold ? ' gold' : '') + '" style="font-size:clamp(80px,26vw,170px)">' + esc(text) + '</div>' + (sub ? '<div class="l">' + esc(sub) + '</div>' : '');
  document.body.appendChild(b);
  setTimeout(() => { b.className = 'stamp out'; setTimeout(() => b.remove(), 320); }, 1150);
};

/* ---------------- ふきだし(札や神札の説明) ---------------- */
function fillDesc(def) { return def.d.replace(/\{(\w+)\}/g, (m, k) => def.v && def.v[k] !== undefined ? def.v[k] : m); }
UI.kamiDescHTML = function (def, k) {
  let h = '<div class="tn">' + esc(def.name) + ' <span class="tagr" style="background:' + D.RARITY[def.rar].col + '">' + D.RARITY[def.rar].name + '</span></div><div class="td">' + esc(fillDesc(def)) + '</div>';
  if (k && def.cur) h += '<div class="tc">' + esc(def.cur(k)) + '</div>';
  if (def.evo) h += '<div class="te">進化: ' + def.evo.map(id => D.KAMI_BY[id].name).join(' + ') + '</div>';
  const into = D.EVOS.filter(E => E.evo.indexOf(def.id) >= 0);
  into.forEach(E => { h += '<div class="te">' + E.evo.filter(id => id !== def.id).map(id => '「' + D.KAMI_BY[id].name + '」').join('と') + 'と組むと進化 →「' + E.name + '」</div>'; });
  return h;
};
UI.cardDescHTML = function (c) {
  const run = UI.run, f = faceOf(c);
  let h = '<div class="tn">' + esc(f.name) + '</div><div class="td">' + D.KINDS[f.kind] + '・' + D.KANSUJI[c.m] + '月(' + D.MONTHS[c.m].flower + ')';
  if (c.m !== f.m) h += ' ※もとは' + D.KANSUJI[f.m] + '月';
  h += ' ・札の点 ' + D.CARD_TEN[f.kind];
  if (run && run.rs && c.m === curMonth(run)) h += ' <b style="color:#3f7a4a">旬 +' + shunBonus(run).t + '点</b>';
  h += '</div>';
  if (c.e) h += '<div class="tc">' + D.ENH[c.e].name + ': ' + D.ENH[c.e].d + '</div>';
  if (c.s) h += '<div class="tc">' + D.SEAL[c.s].name + ': ' + D.SEAL[c.s].d + '</div>';
  if (D.FACE_NOTE[f.id]) h += '<div class="td">' + D.FACE_NOTE[f.id] + '</div>';
  if (run && isDebuffed(run, c)) h += '<div class="tc" style="color:#c8402a">封じられている(点にも役にもならない)</div>';
  const sets = D.SETS.filter(([, fs]) => fs.indexOf(f.id) >= 0).map(([id]) => D.YAKU_BY[id].name);
  if (D.BRIGHTS.indexOf(f.id) >= 0) sets.unshift('三光・四光・五光');
  if (sets.length) h += '<div class="te">使う役: ' + sets.join('・') + '</div>';
  return h;
};
UI.showTip = function (html, anchor, buttons) {
  const t = $('tip');
  t.innerHTML = html;
  if (buttons && buttons.length) {
    const b = el('div', 'tb');
    buttons.forEach(bt => { const x = el('button', 'btn small' + (bt.cls ? ' ' + bt.cls : ''), bt.label); x.disabled = !!bt.disabled; x.onclick = ev => { ev.stopPropagation(); bt.fn(); }; b.appendChild(x); });
    t.appendChild(b);
  }
  t.hidden = false;
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const tw = t.offsetWidth, th = t.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 10;
  if (y < 8) y = r.top + r.height + 10;
  if (y + th > window.innerHeight - 8) y = Math.max(8, window.innerHeight - th - 8);
  x = clamp(x, 8, window.innerWidth - tw - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
  UI.tipOpen = true;
};
UI.hideTip = function () { $('tip').hidden = true; UI.tipOpen = false; UI.tipFor = null; };
UI.tipCard = function (s) {
  const c = cardOf(UI.run, s.u);
  if (!c) return;
  const down = UI.run.rs && UI.run.rs.down.indexOf(s.u) >= 0;
  UI.tipFor = s;
  UI.showTip(down ? '<div class="tn">裏向きの札</div><div class="td">出すまで何の札かわからない</div>' : UI.cardDescHTML(c), s.el);
};
UI.tipKami = function (s) {
  const run = UI.run;
  const i = run.kami.findIndex(k => k.u === s.u);
  if (i < 0) return;
  const k = run.kami[i], def = D.KAMI_BY[k.id];
  UI.tipFor = s;
  UI.showTip(UI.kamiDescHTML(def, k) + '<div class="note">左から順に効く。ドラッグで並べ替えられる</div>', s.el, [
    { label: '売る <small>+' + k.sell + '両</small>', disabled: UI.lock, fn: () => { UI.sellKami(i); } }
  ]);
};
UI.tipOma = function (s) {
  const run = UI.run;
  const i = run.oma.findIndex(o => o.u === s.u);
  if (i < 0) return;
  const def = D.OMA_BY[run.oma[i].id];
  const inRound = run.phase === 'round';
  const needs = omaNeeds(def.id);
  let hint = '';
  if (needs && inRound) hint = '<div class="note">手札で' + (needs.min > 1 ? needs.min + '〜' : '') + needs.n + '枚選んでから「使う」</div>';
  else if (needs) hint = '<div class="note">山札から札を選んで使う</div>';
  UI.tipFor = s;
  UI.showTip('<div class="tn">' + esc(def.name) + '</div><div class="td">' + esc(def.d) + '</div>' + hint, s.el, [
    { label: '使う', cls: 'red', disabled: UI.lock || (def.inRound && !inRound), fn: () => UI.useOma(i) },
    { label: '売る <small>+1両</small>', disabled: UI.lock, fn: () => { sellOma(run, i); SFX.coin(); UI.hideTip(); UI.assignTargets(); UI.hud(); MAIN.afterAction(); } }
  ]);
};
UI.sellKami = function (i) {
  const run = UI.run;
  const k = run.kami[i];
  if (!k || UI.lock) return;
  const s = spr('kami', k.u);
  const v = sellKami(run, i);
  SFX.coin();
  if (s) { const p = scr(s); FX.burst(p.x, p.y, 'gold', 12, { speed: 200 }); FX.pop(p.x, p.y - 30, '+' + v + '両', '#9a7420', 20); }
  UI.hideTip();
  UI.assignTargets(); UI.hud();
  MAIN.afterAction();
  if (SC.onKamiChange) SC.onKamiChange();
};
UI.useOma = function (i) {
  const run = UI.run;
  const o = run.oma[i];
  if (!o || UI.lock) return;
  const def = D.OMA_BY[o.id];
  if (run.phase !== 'round') {
    // 茶屋などでは山札から選ぶ
    const needs = omaNeeds(def.id);
    UI.hideTip();
    if (needs) { SC.deckPicker({ title: def.name, sub: def.d, n: needs.n, min: needs.min, onOk: us => { const r = useOma(run, i, us, 'shop'); UI.omaResult(r, def); } }); return; }
    const r = useOma(run, i, [], 'shop');
    UI.omaResult(r, def);
    return;
  }
  const targets = run.rs.hand.filter(u => UI.sel.indexOf(u) >= 0);
  const r = useOma(run, i, targets, 'round');
  UI.omaResult(r, def);
};
UI.omaResult = function (r, def) {
  const run = UI.run;
  if (r.err) { UI.toast(r.err); SFX.error(); return; }
  UI.hideTip();
  SFX.evolve();
  if (r.lv) UI.toast('<b>' + def.name + '</b> ' + D.EMA_GROUPS[r.lv].yaku.map(y => D.YAKU_BY[y].name + ' Lv' + yakuLv(run, y)).join('・'));
  else UI.toast('<b>' + def.name + '</b> を使った');
  if (r.daikichi) { UI.bigStamp('大吉', '幻の神札が来た', true); FX.flashOn(0.6); }
  if (r.ryo) { const p = elCenter($('h-ryo')); FX.pop(p.x, p.y + 26, '+' + r.ryo + '両', '#9a7420', 20); }
  if (run.phase === 'round') {
    UI.sel = UI.sel.filter(u => run.rs.hand.indexOf(u) >= 0);
    (r.changed || []).forEach(u => { const s = spr('card', u); if (s) { s.key = ''; bump(s, 0.6); const p = scr(s); FX.burst(p.x, p.y, 'gold', 10, { speed: 180 }); } });
    if (r.drawn) { UI.sel = []; for (const s of [...UI.sprites.values()]) if (s.kind === 'card' && run.rs.hand.indexOf(s.u) < 0) killSprite(s, true); }
  }
  if (r.evolved && r.evolved.length) MAIN.showEvolve(r.evolved);
  UI.layout(); UI.hud(); UI.preview();
  MAIN.afterAction();
  if (SC.onKamiChange) SC.onKamiChange();
};

/* ---------------- 指とマウス ---------------- */
function bindSprite(s) {
  const e = s.el;
  e.addEventListener('pointerdown', ev => {
    if (ev.button !== undefined && ev.button > 0) return;
    if (UI.lock && tlBusy()) { UI.ff = 3; return; }
    AU.init();
    UI.isTouch = ev.pointerType !== 'mouse';
    UI.kbd = false;
    UI.hideTip();
    const inHand = s.kind === 'card' && UI.run.rs && UI.run.rs.hand.indexOf(s.u) >= 0;
    if (s.kind === 'card' && !inHand) return;
    UI.drag = { s, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), moved: false, long: false };
    try { e.setPointerCapture(ev.pointerId); } catch (er) { }
    clearTimeout(UI._lp);
    UI._lp = setTimeout(() => {
      const d = UI.drag;
      if (d && d.s === s && !d.moved) { d.long = true; if (s.kind === 'card') UI.tipCard(s); else if (s.kind === 'kami') UI.tipKami(s); else UI.tipOma(s); }
    }, 430);
    ev.preventDefault();
  });
  e.addEventListener('pointermove', ev => {
    const d = UI.drag;
    if (!d || d.s !== s || d.id !== ev.pointerId) return;
    const dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) > 9 && !d.long && !UI.lock && s.kind !== 'oma') { d.moved = true; e.classList.add('drag'); clearTimeout(UI._lp); }
    if (d.moved) {
      const p = UI.playRect;
      s.tx = ev.clientX - p.left; s.ty = ev.clientY - p.top - 10;
      dragReorder(s, s.tx);
    }
  });
  const end = ev => {
    const d = UI.drag;
    if (!d || d.s !== s || d.id !== ev.pointerId) return;
    clearTimeout(UI._lp);
    UI.drag = null;
    e.classList.remove('drag');
    if (d.moved) {
      if (s.kind === 'card') { run_setOrder(); }
      else if (s.kind === 'kami') { saveRun(UI.run); }
      UI.assignTargets();
      SFX.tap();
      UI.coachDone('drag');
      return;
    }
    if (d.long || ev.type === 'pointercancel') return;
    if (s.kind === 'card') UI.toggle(s.u);
    else if (s.kind === 'kami') UI.tipKami(s);
    else if (s.kind === 'oma') UI.tipOma(s);
  };
  e.addEventListener('pointerup', end);
  e.addEventListener('pointercancel', end);
  e.addEventListener('contextmenu', ev => ev.preventDefault());
  e.addEventListener('pointerenter', ev => {
    if (ev.pointerType !== 'mouse' || UI.drag) return;
    clearTimeout(UI._hv);
    UI._hv = setTimeout(() => { if (!UI.drag && !UI.lock && document.querySelector('#ov .layer') === null) { if (s.kind === 'card') UI.tipCard(s); else if (s.kind === 'kami' && !UI.tipOpen) UI.tipKami(s); } }, 650);
  });
  e.addEventListener('pointerleave', ev => { clearTimeout(UI._hv); if (ev.pointerType === 'mouse' && UI.tipFor === s && s.kind === 'card') UI.hideTip(); });
}
function dragReorder(s, x) {
  const run = UI.run, L = UI.L;
  if (s.kind === 'card') {
    const hand = run.rs.hand;
    const from = hand.indexOf(s.u);
    if (from < 0) return;
    let to = Math.round((x - L.x0) / Math.max(1, L.spacing));
    to = clamp(to, 0, hand.length - 1);
    if (to !== from) { hand.splice(from, 1); hand.splice(to, 0, s.u); run.sortMode = 'manual'; UI.assignTargets(); UI.hud(); }
  } else if (s.kind === 'kami') {
    const from = run.kami.findIndex(k => k.u === s.u);
    let best = 0, bd = Infinity;
    L.kami.forEach((p, i) => { if (i < run.kami.length) { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; best = i; } } });
    if (best !== from && from >= 0) { moveKami(run, from, best); UI.assignTargets(); }
  }
}
function run_setOrder() { const run = UI.run; run.sortMode = 'manual'; saveRun(run); UI.hud(); UI.preview(); }

/* ---------------- 案内(最初のプレイ) ---------------- */
const COACH = {
  select: { el: 'hand-area', text: () => '<b>札を選ぼう</b><br>' + (UI.isTouch ? 'タップで選ぶ(最大5枚)。' : 'クリックで選ぶ(最大5枚)。<span class="k">←</span><span class="k">→</span>で移動、<span class="k">Space</span>で選択も可。') + '<br>同じ月の札や、決まった組み合わせ(赤短・猪鹿蝶など)で<b>役</b>ができる。' },
  play: { el: 'btn-play', text: () => 'できる役と <b>点×倍</b> が表示された。<br><b>「出す」</b>で得点!' + (UI.isTouch ? '' : ' <span class="k">Enter</span>') + '<br>目標の点に届けば勝ち。' },
  discard: { el: 'btn-discard', text: () => '要らない札は<b>「捨てる」</b>で入れ替えられる。' + (UI.isTouch ? '' : ' <span class="k">X</span>') + '<br>出しと捨ての回数には限りがある。' },
  drag: { el: 'hand-area', text: () => '札は<b>ドラッグで並べ替え</b>できる。<br>得点は左の札から順に数える。' },
  kami: { el: 'kami-row', text: () => '<b>神札</b>は持っているだけで効く。<br>左から順に効くので、ドラッグで並べ替えよう。タップで説明・売却。' }
};
UI.coachStep = function () {
  if (!SAVE.set.guide || !UI.active || UI.lock || document.querySelector('#ov .layer')) return;
  const run = UI.run;
  if (!run || run.phase !== 'round') return;
  const t = SAVE.tut;
  let step = null;
  if (!t.select) step = 'select';
  else if (!t.play && UI.sel.length) step = 'play';
  else if (t.play && !t.discard && run.rs.n >= 1) step = 'discard';
  else if (t.play && !t.kami && run.kami.length) step = 'kami';
  else if (t.discard && !t.drag && run.stats.plays >= 4) step = 'drag';
  if (step) UI.coach(step); else UI.coachHide();
};
UI.coach = function (step) {
  const c = $('coach'), C = COACH[step];
  UI.coachCur = step;
  c.innerHTML = C.text() + '<span class="x">わかった</span>';
  c.hidden = false;
  c.querySelector('.x').onclick = () => UI.coachDone(step, true);
  const r = $(C.el).getBoundingClientRect();
  const cw = c.offsetWidth, chh = c.offsetHeight;
  let x = clamp(r.left + r.width / 2 - cw / 2, 8, window.innerWidth - cw - 8);
  let y = r.top - chh - 14, cls = 'up';
  if (y < 8) { y = r.bottom + 14; cls = 'down'; }
  c.className = cls;
  c.style.left = x + 'px'; c.style.top = y + 'px';
  c.style.setProperty('--ax', clamp(r.left + r.width / 2 - x, 16, cw - 16) + 'px');
};
UI.coachDone = function (step, force) {
  if (!SAVE.tut[step] && (force || UI.coachCur === step || step === 'select' || step === 'play')) {
    if (step === 'select' && !force && !UI.sel.length) return;
    SAVE.tut[step] = 1; saveGame();
  }
  if (UI.coachCur === step) UI.coachHide();
  setTimeout(() => UI.coachStep(), 250);
};
UI.coachHide = function () { $('coach').hidden = true; UI.coachCur = null; };

/* ---------------- お知らせ ---------------- */
UI.toast = function (html, ms) {
  const t = el('div', 'toast', html);
  $('toasts').appendChild(t);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 420); }, ms || 2600);
};

/* ---------------- キーボード(勝負の画面) ---------------- */
UI.key = function (ev) {
  const run = UI.run;
  if (!UI.active || !run || run.phase !== 'round') return false;
  const k = ev.code;
  if (UI.lock) { if (k === 'Space' || k === 'Enter') { UI.ff = 3; return true; } return false; }
  const hand = run.rs.hand;
  const mv = d => { UI.kbd = true; UI.cursor = clamp((UI.cursor < 0 ? 0 : UI.cursor + d), 0, hand.length - 1); UI.assignTargets(); SFX.tap(); };
  switch (k) {
    case 'ArrowLeft': case 'KeyA': if (ev.shiftKey) moveCard(-1); else mv(-1); return true;
    case 'ArrowRight': case 'KeyD': if (ev.shiftKey) moveCard(1); else mv(1); return true;
    case 'ArrowUp': case 'KeyW': case 'Space': UI.kbd = true; if (UI.cursor < 0) UI.cursor = 0; if (hand[UI.cursor] !== undefined) UI.toggle(hand[UI.cursor]); return true;
    case 'ArrowDown': UI.clearSel(); return true;
    case 'Enter': case 'KeyZ': UI.doPlay(); return true;
    case 'KeyX': case 'Backspace': case 'Delete': UI.doDiscard(); return true;
    case 'KeyS': UI.sortToggle(); return true;
    case 'KeyQ': moveCard(-1); return true;
    case 'KeyE': moveCard(1); return true;
    case 'KeyY': case 'Tab': SC.yakuList(); return true;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
      const i = +k.slice(5) - 1, kk = run.kami[i];
      if (kk) { const s = spr('kami', kk.u); if (s) UI.tipKami(s); }
      return true;
    }
    case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
      const i = +k.slice(5) - 6, o = run.oma[i];
      if (o) { const s = spr('oma', o.u); if (s) UI.tipOma(s); }
      return true;
    }
  }
  return false;
};
function moveCard(d) {
  const run = UI.run, hand = run.rs.hand;
  if (UI.cursor < 0 || UI.cursor >= hand.length) return;
  const j = UI.cursor + d;
  if (j < 0 || j >= hand.length) return;
  const t = hand[UI.cursor]; hand[UI.cursor] = hand[j]; hand[j] = t;
  UI.cursor = j; UI.kbd = true;
  run_setOrder();
  UI.assignTargets();
  SFX.tap();
}
