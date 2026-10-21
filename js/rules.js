'use strict';
/* 花暦 — rules: 役の判定と、1回の出しの得点計算。画面には依存しない(ボットからも使う)
   得点 = (役の点 + 札の点 + 上乗せ) × (役の倍 + 上乗せ) × 掛け算 */
const KBIT = { hikari: 1, tane: 2, tan: 4, kasu: 8 };

const kamiDef = k => D.KAMI_BY[k.id];
const curMonth = run => ((run.month - 1) % 12) + 1;
const yakuLv = (run, id) => run.lv[id] || 1;

function runFlags(run) {
  const fl = { four: 0, skip: 0, kikuKasu: 0, ameHikari: 0, splash: 0, smear: 0 };
  for (const k of run.kami) { const d = kamiDef(k); if (d.flags) for (const f in d.flags) fl[f] = 1; }
  return fl;
}

function kindBits(c, fl) {
  if (c.e === 'urushi') return 15;
  const f = faceOf(c);
  let b = KBIT[f.kind];
  if (fl.kikuKasu && f.id === 'sakazuki') b |= 8;
  if (fl.smear && (b & 6)) b |= 6;
  return b;
}

/* 主の力で封じられた札(点にも役にもならない) */
function isDebuffed(run, c) {
  const rs = run.rs;
  if (!rs || !rs.boss) return false;
  const b = D.BOSS_BY[rs.boss];
  if (b.debuffKind && faceOf(c).kind === b.debuffKind) return true;
  if (b.pillar && rs.pillar && rs.pillar.indexOf(c.u) >= 0) return true;
  return false;
}

/* 出した札(封じられた札は除いたもの)から、成立した役をすべて探す */
function detect(cards, fl) {
  const out = [];
  if (!cards.length) return out;
  const need = fl.four ? 4 : 5;
  // 月の役
  const byM = new Map();
  for (const c of cards) { if (!byM.has(c.m)) byM.set(c.m, []); byM.get(c.m).push(c); }
  const gs = [...byM.values()].sort((a, b) => b.length - a.length);
  const a = gs[0].length, b = gs[1] ? gs[1].length : 0;
  let mid = null, mc = null;
  if (a >= 5) { mid = 'gomai'; mc = gs[0]; }
  else if (a === 4) { mid = 'teshi'; mc = gs[0]; }
  else if (a === 3 && b >= 2) { mid = 'sanawase'; mc = gs[0].concat(gs[1]); }
  else if (a === 3) { mid = 'sanbon'; mc = gs[0]; }
  else if (a === 2 && b === 2) { mid = 'futakumi'; mc = gs[0].concat(gs[1]); }
  else if (a === 2) { mid = 'awase'; mc = gs[0]; }
  if (mid) out.push({ id: mid, cards: mc });
  // 種類の役
  const kb = cards.map(c => kindBits(c, fl));
  const ofKind = bit => cards.filter((c, i) => kb[i] & bit);
  const tane = ofKind(2), tan = ofKind(4), kasu = ofKind(8);
  const kasuCount = arr => arr.reduce((s, c) => s + (faceOf(c).id === D.KASU2 ? 2 : 1), 0);
  if (tane.length >= need) out.push({ id: 'tane', cards: tane });
  if (tan.length >= need) out.push({ id: 'tan', cards: tan });
  if (kasuCount(kasu) >= need) out.push({ id: 'kasu', cards: kasu });
  // 光一: 光札がちょうど1枚と、カス札
  const hk = cards.filter(c => faceOf(c).kind === 'hikari');
  if (hk.length === 1) {
    const rest = kasu.filter(c => c !== hk[0]);
    if (kasuCount(rest) >= need - 1) out.push({ id: 'pikaichi', cards: [hk[0]].concat(rest) });
  }
  // 花暦: 続いた月(十二月の次は一月)
  const ms = new Set(cards.map(c => c.m));
  if (ms.size >= need) {
    let best = null;
    for (const s of ms) {
      const chain = [s];
      let cur = s;
      while (chain.length < need) {
        const n1 = cur % 12 + 1, n2 = n1 % 12 + 1;
        if (ms.has(n1) && chain.indexOf(n1) < 0) cur = n1;
        else if (fl.skip && ms.has(n2) && chain.indexOf(n2) < 0) cur = n2;
        else break;
        chain.push(cur);
      }
      if (chain.length >= need) { best = chain; break; }
    }
    if (best) out.push({ id: 'hanagoyomi', cards: best.map(m => cards.find(c => c.m === m)) });
  }
  // 光の役
  const bset = new Set();
  for (const c of cards) { const id = faceOf(c).id; if (D.BRIGHTS.indexOf(id) >= 0) bset.add(id); }
  const rain = bset.has('ame') && !fl.ameHikari;
  let hid = null;
  if (bset.size >= 5) hid = 'goko';
  else if (bset.size === 4) hid = rain ? 'ameshiko' : 'shiko';
  else if (bset.size === 3 && !rain) hid = 'sanko';
  if (hid) out.push({ id: hid, cards: cards.filter(c => bset.has(faceOf(c).id)) });
  // 決まった組み合わせ
  const faces = new Set(cards.map(c => faceOf(c).id));
  for (const [id, need3] of D.SETS) {
    if (need3.every(f => faces.has(f))) out.push({ id, cards: cards.filter(c => need3.indexOf(faceOf(c).id) >= 0) });
  }
  if (out.some(y => y.id === 'akatan') && out.some(y => y.id === 'aotan')) {
    const both = cards.filter(c => /^(akatan|aotan)/.test(faceOf(c).id));
    out.push({ id: 'akaao', cards: both });
  }
  return out;
}

function highestCard(cards) {
  let best = null, bv = -1;
  for (const c of cards) {
    const v = D.CARD_TEN[faceOf(c).kind] + (c.e === 'ai' ? 30 : 0);
    if (v > bv) { bv = v; best = c; }
  }
  return best;
}

/* 写し絵・影法師が写す先をたどる */
function kamiHooks(run, i, depth) {
  const k = run.kami[i];
  if (!k) return [];
  const d = kamiDef(k);
  if (!d.copy) return [[d, k]];
  if ((depth || 0) > 4) return [];
  const out = [];
  if (d.copy === 'right' || d.copy === 'both') { if (i + 1 < run.kami.length) out.push(...kamiHooks(run, i + 1, (depth || 0) + 1)); }
  if (d.copy === 'left' || d.copy === 'both') { if (i !== 0) out.push(...kamiHooks(run, 0, (depth || 0) + 1)); }
  return out;
}

function shunBonus(run) {
  const m = runMods(run);
  return { t: D.SHUN_TEN * (m.shun ? 2 : 1) + (m.shunT || 0), b: m.shunB || 0 };
}

/* 役の判定だけ(選んでいる途中の表示用) */
function previewYaku(run, played) {
  const fl = runFlags(run);
  const live = played.filter(c => !isDebuffed(run, c));
  let det = detect(live, fl);
  const rs = run.rs;
  const boss = rs && rs.boss ? D.BOSS_BY[rs.boss] : null;
  if (boss && boss.once) det = det.filter(y => !rs.yakuMade[y.id]);
  if (!det.length && live.length) det = [{ id: 'su', cards: [highestCard(live)] }];
  det.sort((p, q) => D.YAKU_BY[q.id].ord - D.YAKU_BY[p.id].ord);
  let ten = 0, bai = 0;
  for (const y of det) {
    const Y = D.YAKU_BY[y.id], lv = yakuLv(run, y.id);
    let t = Y.ten + Y.lt * (lv - 1), b = Y.bai + Y.lb * (lv - 1);
    if (boss && boss.halve) { t = Math.ceil(t / 2); b = Math.ceil(b / 2); }
    ten += t; bai += b;
  }
  const void_ = !!(boss && boss.mouth && rs.firstYakus && rs.firstYakus.length && !det.some(y => rs.firstYakus.indexOf(y.id) >= 0));
  return { yaku: det, ten, bai, void: void_ };
}

/* 1回の出しの得点を計算する。opt.silent: 演出用の記録を作らず乱数も進めない(予想・ボット用)
   opt.disable: その番号の神札を無いものとして計算(活躍の内訳用) opt.sleep: 眠っている神札の番号 */
function scorePlay(run, played, held, opt) {
  opt = opt || {};
  const fl = runFlags(run);
  const rs = run.rs;
  const boss = rs && rs.boss ? D.BOSS_BY[rs.boss] : null;
  const live = played.filter(c => !isDebuffed(run, c));
  let det = detect(live, fl);
  if (boss && boss.once) det = det.filter(y => !rs.yakuMade[y.id]);
  if (!det.length && live.length) det = [{ id: 'su', cards: [highestCard(live)] }];
  det.sort((p, q) => D.YAKU_BY[q.id].ord - D.YAKU_BY[p.id].ord);
  const sc = new Set();
  det.forEach(y => y.cards.forEach(c => sc.add(c.u)));
  if (fl.splash) live.forEach(c => sc.add(c.u));
  const scoring = played.filter(c => sc.has(c.u));
  const ids = new Set(det.map(y => y.id));
  const x = {
    run, rs, played, held, scoring, fl, yaku: det, ids,
    nYaku: det.filter(y => y.id !== 'su').length,
    ten: 0, bai: 0, ryo: 0, ev: opt.silent ? null : [], cur: null,
    isFirst: rs ? rs.n === 0 : true, isLast: rs ? rs.plays <= 1 : false,
    discLeft: rs ? rs.discards : 0, void: false
  };
  x.has = id => ids.has(id);
  x.fam = f => D.FAM[f].some(id => ids.has(id));
  x.isKind = (c, k) => (kindBits(c, fl) & KBIT[k]) !== 0;
  x.shun = c => c.m === curMonth(run);
  x.sameKind = () => played.length > 0 && played.reduce((a, c) => a & kindBits(c, fl), 15) !== 0;
  x.rnd = opt.silent ? () => 0.5 : () => rnd(run, 'luck');
  const push = (o) => { if (x.ev) { o.s = x.cur; o.T = x.ten; o.B = x.bai; x.ev.push(o); } };
  x.addT = (_, n, on) => { if (!n) return; x.ten += n; push({ t: n, on: on && on.u }); };
  x.addB = (_, n, on) => { if (!n) return; x.bai += n; push({ b: n, on: on && on.u }); };
  x.mulB = (_, f, on) => { if (f === 1) return; x.bai *= f; push({ x: f, on: on && on.u }); };
  x.addR = (_, n, on) => { if (!n) return; x.ryo += n; push({ r: n, on: on && on.u }); };

  // 迷い家: 最初の役を含まなければ0点
  if (boss && boss.mouth && rs.firstYakus && rs.firstYakus.length && !rs.firstYakus.some(id => ids.has(id))) x.void = true;

  // 1) 役
  for (const y of det) {
    const Y = D.YAKU_BY[y.id], lv = yakuLv(run, y.id);
    let t = Y.ten + Y.lt * (lv - 1), b = Y.bai + Y.lb * (lv - 1);
    if (boss && boss.halve) { t = Math.ceil(t / 2); b = Math.ceil(b / 2); }
    x.cur = { k: 'yaku', id: y.id, lv };
    x.ten += t; x.bai += b;
    push({ t, b, yk: y.id, cards: y.cards.map(c => c.u) });
  }
  const mods = runMods(run);
  if (boss && mods.bossBai) { x.cur = { k: 'engi', id: 'omiki' }; x.addB(null, mods.bossBai); }

  const hooks = run.kami.map((k, i) => (i === opt.disable || i === opt.sleep || k.gone) ? [] : kamiHooks(run, i));
  const sb = shunBonus(run);

  // 2) 得点する札(左から順に)
  for (const c of scoring) {
    let trig = 1 + (c.s === 'kasane' ? 1 : 0);
    hooks.forEach((hs, i) => { for (const [d, inst] of hs) if (d.retrig) { x.cur = { k: 'kami', i }; trig += d.retrig(x, inst, c, d.v) || 0; } });
    for (let r = 0; r < trig; r++) {
      x.cur = { k: 'card', u: c.u, re: r };
      if (r > 0) push({ re: 1 });
      let base = D.CARD_TEN[faceOf(c).kind];
      const shun = x.shun(c);
      if (shun) base += sb.t;
      x.addT(null, base);
      if (shun && sb.b) x.addB(null, sb.b);
      if (c.e === 'ai') x.addT(null, D.ENH.ai.t);
      if (c.e === 'shu') x.addB(null, D.ENH.shu.b);
      if (c.e === 'kin') x.mulB(null, D.ENH.kin.x);
      if (c.s === 'fuku') x.addR(null, D.SEAL.fuku.r);
      hooks.forEach((hs, i) => { for (const [d, inst] of hs) if (d.card) { x.cur = { k: 'kami', i }; d.card(x, inst, c, d.v); } });
    }
  }
  // 3) 手札に残った札
  for (const c of held) {
    if (isDebuffed(run, c)) continue;
    x.cur = { k: 'held', u: c.u };
    if (c.e === 'gin') x.mulB(null, D.ENH.gin.x);
    hooks.forEach((hs, i) => { for (const [d, inst] of hs) if (d.held) { x.cur = { k: 'kami', i }; d.held(x, inst, c, d.v); } });
  }
  // 4) 神札(左から順に)
  hooks.forEach((hs, i) => { for (const [d, inst] of hs) if (d.main) { x.cur = { k: 'kami', i }; d.main(x, inst, d.v); } });

  x.total = x.void ? 0 : Math.floor(x.ten * x.bai + 1e-9);
  return x;
}

/* ボットや予想のための「この手札で出せるいちばん良い出し方」 */
function* subsets(n, maxK) {
  const idx = [];
  function* rec(start) {
    if (idx.length) yield idx.slice();
    if (idx.length >= maxK) return;
    for (let i = start; i < n; i++) { idx.push(i); yield* rec(i + 1); idx.pop(); }
  }
  yield* rec(0);
}
