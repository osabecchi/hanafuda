'use strict';
/* 花暦 — run: 1回の旅(12か月×3勝負)の進行。ご褒美・縁起物・茶屋もここ。画面には依存しない
   流れ: month(月のはじめ) → round(勝負) → won → reward(一・二) / engi(主) → shop → 次の月
   乱数は「流れ」ごとに別のシードを持つので、同じシードなら同じ展開になる(デイリー用) */

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rnd(run, stream) {
  let a = run.rng[stream];
  if (a === undefined) a = hashStr(run.seed + ':' + stream);
  a = (a + 0x6D2B79F5) | 0;
  run.rng[stream] = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rndInt = (run, s, n) => Math.floor(rnd(run, s) * n);
function rndPick(run, s, arr) { return arr.length ? arr[rndInt(run, s, arr.length)] : null; }
function rndShuffle(run, s, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rndInt(run, s, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
function rndWeighted(run, s, weights) {   // weights: 配列 → 番号
  let sum = 0; for (const w of weights) sum += w;
  let r = rnd(run, s) * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}
function newSeed() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function emit(run, ev) { (run._ev || (run._ev = [])).push(ev); }

/* ---------------- 札 ---------------- */
function newCard(run, f, m) { run.deckV++; return { u: ++run.uid, f, m: m || D.FACES[f].m, e: null, s: null }; }
function cardOf(run, u) {
  if (!run._cm || run._cmV !== run.deckV) { run._cm = new Map(run.cards.map(c => [c.u, c])); run._cmV = run.deckV; }
  return run._cm.get(u);
}
function removeCard(run, u) {
  const i = run.cards.findIndex(c => c.u === u);
  if (i < 0) return false;
  run.cards.splice(i, 1);
  run.deckV++;
  const rs = run.rs;
  if (rs) for (const k of ['hand', 'pile', 'used', 'down']) { const j = rs[k].indexOf(u); if (j >= 0) rs[k].splice(j, 1); }
  return true;
}
function copyCard(run, c) { const n = newCard(run, c.f, c.m); n.e = c.e; n.s = c.s; run.cards.push(n); return n; }
const KIND_ORD = { hikari: 0, tane: 1, tan: 2, kasu: 3 };
function sortUids(run, uids, mode) {
  const key = u => {
    const c = cardOf(run, u), f = faceOf(c);
    return mode === 'kind' ? KIND_ORD[f.kind] * 1000 + c.m * 50 + f.i : c.m * 1000 + KIND_ORD[f.kind] * 50 + f.i;
  };
  return uids.slice().sort((a, b) => key(a) - key(b));
}
function sortHand(run) {
  if (!run.rs || run.sortMode === 'manual') return;
  run.rs.hand = sortUids(run, run.rs.hand, run.sortMode);
}
function setHandOrder(run, uids) {
  if (!run.rs || uids.length !== run.rs.hand.length) return;
  run.rs.hand = uids.slice();
  run.sortMode = 'manual';
}

/* ---------------- 神札 ---------------- */
function newKami(run, id) {
  const d = D.KAMI_BY[id];
  const k = { id, u: ++run.uid, s: d.s0 ? JSON.parse(JSON.stringify(d.s0)) : {}, sell: Math.max(1, Math.floor((d.cost || 6) * D.ECON.sellRate)) };
  return k;
}
function hasKami(run, id) { return run.kami.some(k => k.id === id); }
function kamiMax(run) { return D.RULE.kamiMax; }
function omaMax(run) { return D.RULE.omaMax + runMods(run).oma; }
function addKami(run, id) {
  if (run.kami.length >= kamiMax(run)) return null;
  const k = newKami(run, id);
  run.kami.push(k);
  emit(run, { t: 'kami', id });
  if (run.kami.length >= kamiMax(run)) emit(run, { t: 'fullKami' });
  return k;
}
/* 進化: 材料がすべてそろったら、いちばん左の材料の位置で上位版になる */
function checkEvolve(run) {
  const done = [];
  for (const E of D.EVOS) {
    const idx = E.evo.map(id => run.kami.findIndex(k => k.id === id));
    if (!idx.every(i => i >= 0)) continue;
    const parts = {};
    E.evo.forEach((id, j) => { parts[id] = run.kami[idx[j]]; });
    const at = Math.min(...idx);
    const nk = newKami(run, E.id);
    if (E.merge) Object.assign(nk.s, E.merge(parts));
    nk.sell = E.evo.reduce((s, id) => s + parts[id].sell, 0);
    const from = E.evo.map(id => parts[id].u);
    run.kami = run.kami.filter(k => E.evo.indexOf(k.id) < 0);
    run.kami.splice(Math.min(at, run.kami.length), 0, nk);
    done.push({ id: E.id, from, u: nk.u });
    emit(run, { t: 'evolve', id: E.id });
    emit(run, { t: 'kami', id: E.id });
  }
  return done;
}
/* 店や3択に出せる神札 */
function kamiPool(run, rar) {
  const ownedEvo = new Set();
  for (const k of run.kami) { const d = kamiDef(k); if (d.evo) d.evo.forEach(id => ownedEvo.add(id)); }
  return D.KAMI.filter(d => d.rar === rar && !d.evo && !hasKami(run, d.id) && !ownedEvo.has(d.id) &&
    run.banned.indexOf(d.id) < 0 && (!run.pool || run.pool.indexOf(d.id) >= 0));
}
function rollKami(run, stream, weights, avoid) {
  for (let tries = 0; tries < 8; tries++) {
    const rar = rndWeighted(run, stream, weights);
    const pool = kamiPool(run, rar).filter(d => !avoid || avoid.indexOf(d.id) < 0);
    if (pool.length) return rndPick(run, stream, pool).id;
  }
  const any = [1, 2, 3].flatMap(r => kamiPool(run, r)).filter(d => !avoid || avoid.indexOf(d.id) < 0);
  return any.length ? rndPick(run, stream, any).id : null;
}
function rollOma(run, stream, type) {
  let pool = D.OMA;
  if (type === 'ema') pool = D.OMA.filter(o => o.type === 'ema');
  else if (type === 'other') pool = D.OMA.filter(o => o.type !== 'ema');
  return rndPick(run, stream, pool).id;
}
function rollCard(run, stream) {
  const f = rndInt(run, stream, 48);
  const c = { f, m: D.FACES[f].m, e: null, s: null };
  const enhs = Object.keys(D.ENH);
  if (rnd(run, stream) < 0.8) c.e = rndPick(run, stream, enhs);
  if (rnd(run, stream) < 0.25) c.s = rndPick(run, stream, Object.keys(D.SEAL));
  return c;
}

/* ---------------- 増減のまとめ ---------------- */
function runMods(run) {
  const m = { hand: 0, plays: 0, discards: 0, maxPlay: 0, oma: 0, interestCap: 0, shopItems: 0, packs: 0, freeReroll: 0,
    reward: 0, discount: 0, bossBai: 0, packExtra: 0, shun: 0, shunT: 0, shunB: 0, ryo: 0, noDiscard: 0 };
  const add = o => { if (o) for (const k in o) m[k] = (m[k] || 0) + o[k]; };
  add(D.DECK_BY[run.deckId].mods);
  for (const k of run.kami) add(kamiDef(k).mods);
  for (const id in run.engi) for (let i = 0; i < run.engi[id]; i++) add(D.ENGI_BY[id].mods);
  const u = (run.meta && run.meta.upg) || {};
  m.ryo += 2 * (u.fukuzeni || 0);
  m.shopItems += u.mekikiM || 0;
  m.packs += u.fukuromashi || 0;
  m.oma += u.mamoriM || 0;
  m.freeReroll += u.negiriM || 0;
  m.interestCap += 2 * (u.risoku || 0);
  if (run.stake >= 4) m.discards -= 1;
  if (run.stake >= 8) m.plays -= 1;
  return m;
}
function roundParams(run, boss) {
  const m = runMods(run);
  let hand = D.RULE.hand + m.hand, plays = D.RULE.plays + m.plays, discards = D.RULE.discards + m.discards;
  if (m.noDiscard) discards = 0;
  if (boss && boss.mods) {
    hand += boss.mods.hand || 0;
    if (boss.mods.discardsMax !== undefined) discards = Math.min(discards, boss.mods.discardsMax);
    if (boss.mods.playsMax) plays = Math.min(plays, boss.mods.playsMax);
  }
  return { hand: Math.max(2, hand), plays: Math.max(1, plays), discards: Math.max(0, discards), maxPlay: D.RULE.maxPlay + m.maxPlay };
}
function niceNum(v) {
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1));
  return Math.round(v / p) * p;
}
/* 段位による上乗せは、一月から六月にかけて少しずつ効く */
const stakeRamp = month => Math.min(1, (month - 1) / 5);
function monthBase(run, month) {
  const B = D.TARGET.base;
  let v = month <= 12 ? B[month - 1] : B[11] * Math.pow(D.TARGET.endless, month - 12);
  const r = stakeRamp(month);
  if (run.stake >= 3) v *= 1 + 0.2 * r;
  if (run.stake >= 6) v *= 1 + 0.2 * r;
  return v;
}
function roundTarget(run, round, bossId) {
  const base = monthBase(run, run.month);
  if (round < 2) return niceNum(base * D.TARGET.round[round]);
  let v = base * D.BOSS_BY[bossId].tgt;
  if (run.stake >= 7) v *= 1 + 0.25 * stakeRamp(run.month);
  return niceNum(v);
}

/* ---------------- 旅のはじまり ---------------- */
function newRun(o) {
  const run = {
    v: 1, seed: o.seed || newSeed(), daily: !!o.daily, deckId: o.deck || 'hana', stake: o.stake || 1,
    month: 1, round: 0, phase: 'month', endless: false, cleared: false, over: false,
    ryo: 0, uid: 0, deckV: 0, cards: [], kami: [], oma: [], lv: {}, engi: {},
    banned: [], banish: D.ECON.banish, rng: {}, meta: o.meta || { upg: {} }, pool: o.pool || null,
    svc: { remove: 0, enhance: 0, rewrite: 0 }, sortMode: 'month', lastOma: null,
    opps: [], bossId: null, rs: null, shop: null, offers: null, pack: null, monthPlayed: [], monthYaku: {},
    stats: { plays: 0, discards: 0, wins: 0, bosses: 0, best: 0, bestPlay: null, total: 0, yaku: {}, kamiC: {}, maxYaku: 0,
      ryoEarned: 0, cardsPlayed: 0, time: 0, oneShots: 0 }
  };
  const deck = D.DECK_BY[run.deckId];
  for (let f = 0; f < 48; f++) run.cards.push(newCard(run, f));
  if (run.deckId === 'midare') for (const c of run.cards) c.m = 1 + rndInt(run, 'deck', 12);
  const m = runMods(run);
  run.ryo = D.ECON.startRyo + m.ryo;
  run.banish += (run.meta.upg && run.meta.upg.oharaiM) || 0;
  if (run.deckId === 'midare') { run.oma.push({ id: 'tsukigae', u: ++run.uid }); run.oma.push({ id: 'tsukigae', u: ++run.uid }); }
  if (run.meta.upg && run.meta.upg.hatsumode && run.oma.length < omaMax(run)) run.oma.push({ id: rollOma(run, 'start', 'other'), u: ++run.uid });
  setupMonth(run);
  return run;
}

function setupMonth(run) {
  const cm = curMonth(run);
  // 相手(一・二の勝負)
  const recent = run.recentOpps || [];
  const pool = D.OPPS.map(o => o.id).filter(id => recent.indexOf(id) < 0);
  const a = rndPick(run, 'opp', pool);
  const b = rndPick(run, 'opp', pool.filter(id => id !== a));
  run.opps = [a, b];
  run.recentOpps = recent.concat([a, b]).slice(-8);
  // 主
  const theme = D.BOSSES.find(x => x.m === cm);
  const extras = D.BOSSES.filter(x => !x.m && (run.recentBoss || []).indexOf(x.id) < 0);
  if (!run.endless && run.month === 12) run.bossId = 'hououN';
  else if (run.month === 1) run.bossId = theme.id;
  else if (run.month <= 11 && rnd(run, 'boss') < D.BOSS_THEME_P) run.bossId = theme.id;
  else if (run.month > 12) run.bossId = rndPick(run, 'boss', D.BOSSES.filter(x => (run.recentBoss || []).indexOf(x.id) < 0)).id;
  else run.bossId = rndPick(run, 'boss', extras).id;
  run.recentBoss = (run.recentBoss || []).concat([run.bossId]).slice(-5);
  run.round = 0;
  run.monthPlayed = [];
  run.monthYaku = {};
  run.targets = [0, 1, 2].map(r => roundTarget(run, r, run.bossId));
  // 暦の札: カス2枚が今月の札になる
  if (run.deckId === 'koyomi') {
    const ks = run.cards.filter(c => faceOf(c).kind === 'kasu' && c.m !== cm);
    rndShuffle(run, 'koyomi', ks).slice(0, 2).forEach(c => { c.m = cm; });
  }
  run.phase = 'month';
}

/* ---------------- 勝負 ---------------- */
function startRound(run) {
  const isBoss = run.round === 2;
  const boss = isBoss ? D.BOSS_BY[run.bossId] : null;
  const p = roundParams(run, boss);
  const prevPlayed = run.rs && run.rs.playedAll ? run.rs.playedAll : [];
  const rs = run.rs = {
    target: run.targets[run.round], score: 0, n: 0, d: 0, plays: p.plays, discards: p.discards,
    handSize: p.hand, maxPlay: p.maxPlay, hand: [], pile: [], used: [], down: [],
    boss: isBoss ? run.bossId : null, opp: isBoss ? null : run.opps[run.round],
    odai: isBoss ? null : D.OPP_BY[run.opps[run.round]].odai, odaiDone: false, odaiN: 0,
    yakuMade: {}, firstYaku: null, lastYaku: null, koi: 0, target2: 0,
    pillar: boss && boss.pillar ? prevPlayed.slice() : null, sleep: -1, playedAll: [], firstYakus: null
  };
  rs.pile = rndShuffle(run, 'deal' + run.month + '_' + run.round, run.cards.map(c => c.u));
  for (const k of run.kami) { const d = kamiDef(k); if (d.round) d.round(run, k, d.v); }
  draw(run, 'start');
  run.phase = 'round';
  return rs;
}
function draw(run, why) {
  const rs = run.rs;
  const boss = rs.boss ? D.BOSS_BY[rs.boss] : null;
  let n = rs.handSize - rs.hand.length;
  if (boss && boss.drawN && why !== 'start') n = boss.drawN;
  const drawn = [];
  for (let i = 0; i < n && rs.pile.length; i++) {
    const u = rs.pile.pop();
    rs.hand.push(u);
    drawn.push(u);
    if (boss) {
      if (boss.firstDown && why === 'start') rs.down.push(u);
      else if (boss.faceDown && rnd(run, 'boss') < boss.faceDown) rs.down.push(u);
      else if (boss.downAfterPlay && why === 'play') rs.down.push(u);
    }
  }
  if (run.sortMode !== 'manual') sortHand(run);
  return drawn;
}
function canPlay(run, uids) {
  const rs = run.rs;
  if (run.phase !== 'round' || !rs) return '今は出せません';
  if (!uids.length) return '札を選んでください';
  if (uids.length > rs.maxPlay) return '一度に出せるのは' + rs.maxPlay + '枚までです';
  if (rs.plays <= 0) return '出しが残っていません';
  const boss = rs.boss ? D.BOSS_BY[rs.boss] : null;
  if (boss && boss.mustFive && uids.length < Math.min(5, rs.hand.length)) return '主「八橋」: 5枚出さなければなりません';
  return null;
}
function canDiscard(run, uids) {
  const rs = run.rs;
  if (run.phase !== 'round' || !rs) return '今は捨てられません';
  if (!uids.length) return '札を選んでください';
  if (uids.length > D.RULE.maxDiscard) return '一度に捨てられるのは' + D.RULE.maxDiscard + '枚までです';
  if (rs.discards <= 0) return '捨てが残っていません';
  return null;
}
function topYakuId(yaku) {
  let best = null;
  for (const y of yaku) if (!best || D.YAKU_BY[y.id].ord < D.YAKU_BY[best].ord) best = y.id;
  return best;
}
function playInfo(run, x) {
  const info = {
    scoring: x.scoring, nYaku: x.nYaku, yaku: x.yaku, changed: [], lvUp: [],
    fam: f => D.FAM[f].some(id => x.ids.has(id)),
    kindN: k => x.scoring.filter(c => x.isKind(c, k)).length,
    faceN: id => x.scoring.filter(c => faceOf(c).id === id).length,
    shunN: x.scoring.filter(c => x.shun(c)).length,
    topYaku: () => topYakuId(x.yaku),
    rnd: () => rnd(run, 'luck')
  };
  return info;
}

/* 札を出す。戻り値に演出用の記録(x.ev)と結果を入れる */
function play(run, uids) {
  const err = canPlay(run, uids);
  if (err) return { err };
  const rs = run.rs;
  const boss = rs.boss ? D.BOSS_BY[rs.boss] : null;
  const sel = new Set(uids);
  const playedU = rs.hand.filter(u => sel.has(u));
  const played = playedU.map(u => cardOf(run, u));
  rs.hand = rs.hand.filter(u => !sel.has(u));
  const wasDown = rs.down.filter(u => sel.has(u));
  rs.down = rs.down.filter(u => !sel.has(u));
  const held = rs.hand.map(u => cardOf(run, u));
  let sleep = -1;
  if (boss && boss.sleep && run.kami.length) sleep = rndInt(run, 'boss', run.kami.length);
  rs.sleep = sleep;
  const x = scorePlay(run, played, held, { sleep });
  const contrib = run.kami.map((k, i) => {
    if (i === sleep) return 0;
    return Math.max(0, x.total - scorePlay(run, played, held, { silent: true, sleep, disable: i }).total);
  });
  run.kami.forEach((k, i) => { run.stats.kamiC[k.id] = (run.stats.kamiC[k.id] || 0) + contrib[i]; });
  rs.score += x.total;
  run.stats.total += x.total;
  run.ryo += x.ryo;
  let toll = 0;
  if (boss && boss.toll) { toll = played.length; run.ryo -= toll; }
  rs.n++; rs.plays--;
  rs.used.push(...playedU);
  rs.playedAll.push(...playedU);
  run.monthPlayed.push(...playedU);
  const yids = x.yaku.map(y => y.id);
  yids.forEach(id => { rs.yakuMade[id] = 1; run.monthYaku[id] = (run.monthYaku[id] || 0) + 1; });
  const top = topYakuId(x.yaku);
  if (!rs.firstYaku) { rs.firstYaku = top; rs.firstYakus = yids.filter(id => id !== 'su'); }
  rs.lastYaku = top;
  // 出したあとの神札(育つ神札など)
  const info = playInfo(run, x);
  const gone = [];
  run.kami.forEach((k, i) => { const d = kamiDef(k); if (d.after && i !== sleep) d.after(run, k, info, d.v); });
  run.kami.forEach(k => { if (k.gone) gone.push(k.u); });
  if (gone.length) run.kami = run.kami.filter(k => !k.gone);
  // 主の力
  const scattered = [];
  if (boss) {
    if (boss.lvDown) for (const id of yids) if (id !== 'su' && (run.lv[id] || 1) > 1) run.lv[id]--;
    if (boss.scatter) for (let i = 0; i < boss.scatter && rs.hand.length; i++) {
      const u = rs.hand.splice(rndInt(run, 'boss', rs.hand.length), 1)[0];
      rs.used.push(u); scattered.push(u);
      const j = rs.down.indexOf(u); if (j >= 0) rs.down.splice(j, 1);
    }
    if (boss.shuffle) { rndShuffle(run, 'boss', rs.hand); rndShuffle(run, 'boss', run.kami); run.sortMode = 'manual'; }
  }
  checkOdai(run, x, played);
  // 記録
  const st = run.stats;
  st.plays++; st.cardsPlayed += played.length;
  yids.forEach(id => { st.yaku[id] = (st.yaku[id] || 0) + 1; });
  st.maxYaku = Math.max(st.maxYaku, x.nYaku);
  if (x.total > st.best) { st.best = x.total; st.bestPlay = { score: x.total, yaku: yids, faces: played.map(c => c.f), month: run.month }; }
  emit(run, { t: 'play', score: x.total, yaku: yids, n: played.length, nYaku: x.nYaku,
    kin: x.scoring.some(c => c.e === 'kin'), hikari: info.kindN('hikari'), goyomiTan: x.has('hanagoyomi') && x.has('tan') });
  // 引く
  const drawn = draw(run, 'play');
  // 結果
  let outcome = null;
  const deckKoi = run.deckId === 'koikoi';
  if (rs.koi === 1) {
    if (rs.score >= rs.target2 || rs.plays <= 0 || (!rs.hand.length && !rs.pile.length)) outcome = 'win';
  } else if (rs.score >= rs.target) {
    outcome = (deckKoi && rs.plays > 0 && rs.hand.length) ? 'koikoi' : 'win';
  } else if (rs.plays <= 0 || (!rs.hand.length && !rs.pile.length)) outcome = 'lose';
  if (outcome === 'win') { winRound(run); }
  else if (outcome === 'koikoi') run.phase = 'koikoi';
  else if (outcome === 'lose') { run.phase = 'over'; run.over = true; emit(run, { t: 'lose' }); }
  return { x, played: playedU, wasDown, drawn, contrib, sleep, gone, scattered, toll, outcome, lvUp: info.lvUp, changed: info.changed };
}
function discard(run, uids) {
  const err = canDiscard(run, uids);
  if (err) return { err };
  const rs = run.rs;
  const sel = new Set(uids);
  const gone = rs.hand.filter(u => sel.has(u));
  rs.hand = rs.hand.filter(u => !sel.has(u));
  rs.down = rs.down.filter(u => !sel.has(u));
  rs.used.push(...gone);
  rs.discards--; rs.d++;
  run.stats.discards++;
  const cards = gone.map(u => cardOf(run, u));
  let ryo = 0;
  for (const k of run.kami) { const d = kamiDef(k); if (d.discard) ryo += d.discard(run, k, cards, d.v) || 0; }
  run.ryo += ryo;
  emit(run, { t: 'discard' });
  const drawn = draw(run, 'discard');
  let outcome = null;
  if (!rs.hand.length && !rs.pile.length) { outcome = 'lose'; run.phase = 'over'; run.over = true; emit(run, { t: 'lose' }); }
  return { discarded: gone, drawn, ryo, outcome };
}
function koikoi(run, yes) {
  const rs = run.rs;
  if (run.phase !== 'koikoi') return;
  if (yes) { rs.koi = 1; rs.target2 = rs.target * 2; run.phase = 'round'; }
  else winRound(run);
}
function checkOdai(run, x, played) {
  const rs = run.rs;
  if (!rs.odai || rs.odaiDone) return;
  let ok = false;
  switch (rs.odai) {
    case 'hikariYaku': ok = x.fam('hikari'); break;
    case 'yanagi': ok = x.scoring.some(c => faceOf(c).m === 11); break;
    case 'bigPlay': ok = x.total >= rs.target / 2; break;
    case 'sanbon': ok = x.fam('sanbon'); break;
    case 'kasuYaku': ok = x.fam('kasu'); break;
    case 'taneYaku': ok = x.fam('tane'); break;
    case 'goyomi': ok = x.has('hanagoyomi'); break;
    case 'tanYaku': ok = x.fam('tan'); break;
    case 'enhanced': ok = x.scoring.some(c => c.e); break;
    case 'multiYaku': ok = x.nYaku >= 2; break;
    case 'oneCard': ok = played.length === 1 && x.total > 0; break;
    case 'sake': ok = x.fam('sake'); break;
    case 'shun': rs.odaiN += x.scoring.filter(c => x.shun(c)).length; ok = rs.odaiN >= 3; break;
    case 'allKinds': ok = ['hikari', 'tane', 'tan', 'kasu'].every(k => played.some(c => faceOf(c).kind === k)); break;
    case 'fivePlay': if (played.length >= 5 && x.total > 0) rs.odaiN++; ok = rs.odaiN >= 3; break;
  }
  if (ok) rs.odaiDone = true;
}
function winRound(run) {
  const rs = run.rs;
  if (rs.odai && !rs.odaiDone) {
    if (rs.odai === 'noDiscard') rs.odaiDone = rs.d === 0;
    else if (rs.odai === 'oneShot') rs.odaiDone = rs.n === 1;
    else if (rs.odai === 'twoPlays') rs.odaiDone = rs.n <= 2;
  }
  run.phase = 'won';
  run.stats.wins++;
  if (rs.n === 1) run.stats.oneShots++;
  emit(run, { t: 'win', oneShot: rs.n === 1, boss: rs.boss, koikoi: rs.koi === 1 && rs.score >= rs.target2, noKami: !run.kami.length });
}

/* 勝負の結果(報酬)。勝ったあとに一度だけ呼ぶ */
function payout(run) {
  const rs = run.rs;
  const m = runMods(run);
  const isBoss = run.round === 2;
  const items = [];
  let base = D.ECON.reward[run.round] + m.reward;
  if (run.stake >= 2 && run.round === 0) base = 0;
  if (rs.koi === 1) {
    if (rs.score >= rs.target2) { base *= 2; items.push({ label: 'こいこい成功(報酬2倍)', r: 0, koi: 1 }); }
    else { base = 0; items.push({ label: 'こいこい失敗(報酬なし)', r: 0, koi: -1 }); }
  }
  items.push({ label: (isBoss ? '主' : ['一', '二'][run.round]) + 'の勝負', r: Math.max(0, base) });
  if (rs.plays > 0) items.push({ label: '残りの出し ' + rs.plays + '回', r: rs.plays * D.ECON.perPlay });
  if (rs.odaiDone) items.push({ label: 'お題「' + D.ODAI[rs.odai].d + '」', r: D.ODAI[rs.odai].r, odai: 1 });
  for (const k of run.kami) { const d = kamiDef(k); if (d.win) { const r = d.win(run, k, d.v); if (r) items.push({ label: d.name, r, kami: k.u }); } }
  const gifts = [];
  if (isBoss) {
    run.stats.bosses++;
    for (const k of run.kami) { const d = kamiDef(k); if (d.boss) { const r = d.boss(run, k, d.v); if (r) items.push({ label: d.name, r, kami: k.u }); } }
    const cap = D.ECON.interestCap + m.interestCap;
    const intr = Math.min(cap, Math.floor(Math.max(0, run.ryo) / D.ECON.interestPer));
    if (intr > 0) items.push({ label: '月末の利子(' + D.ECON.interestPer + '両につき1両・上限' + cap + ')', r: intr });
    if (run._emaGift) {
      for (let i = 0; i < run._emaGift; i++) {
        let best = null;
        for (const id in run.monthYaku) if (id !== 'su' && (!best || run.monthYaku[id] > run.monthYaku[best])) best = id;
        if (best) { run.lv[best] = (run.lv[best] || 1) + 1; gifts.push({ t: 'lv', id: best }); }
      }
    }
    emit(run, { t: 'boss', id: rs.boss, noKami: !run.kami.length });
  }
  run._emaGift = 0;
  // 祈りの印
  for (const u of rs.hand) {
    const c = cardOf(run, u);
    if (c && c.s === 'inori' && rs.lastYaku && rs.lastYaku !== 'su' && run.oma.length < omaMax(run)) {
      run.oma.push({ id: 'ema_' + D.YAKU_GROUP[rs.lastYaku], u: ++run.uid }); gifts.push({ t: 'oma', id: 'ema_' + D.YAKU_GROUP[rs.lastYaku] });
    }
  }
  if (run._gift) {
    for (let i = 0; i < run._gift; i++) if (run.oma.length < omaMax(run)) { const id = rollOma(run, 'gift'); run.oma.push({ id, u: ++run.uid }); gifts.push({ t: 'oma', id }); }
    run._gift = 0;
  }
  const total = items.reduce((s, it) => s + it.r, 0);
  run.ryo += total;
  run.stats.ryoEarned += total;
  emit(run, { t: 'ryo', ryo: run.ryo });
  // 次へ
  if (isBoss) {
    if (run.month === 12 && !run.endless) { run.phase = 'clear'; run.cleared = true; emit(run, { t: 'clear' }); }
    else { genEngi(run); run.phase = 'engi'; }
  } else { genReward(run); run.phase = 'reward'; }
  return { items, total, gifts };
}
function nextRound(run) {
  run.round++;
  run.offers = null;
  startRound(run);
}
function nextMonth(run) {
  run.month++;
  run.shop = null; run.offers = null; run.pack = null; run.rs = null;
  for (const k of run.kami) { const d = kamiDef(k); if (d.month) d.month(run, k, d.v); }
  setupMonth(run);
}
function goEndless(run) {
  run.endless = true;
  genEngi(run);
  run.phase = 'engi';
}

/* ---------------- ご褒美(一・二の勝負のあとの3択) ---------------- */
function rollRewardItem(run, avoid) {
  const r = rnd(run, 'reward');
  if (r < 0.45) {
    const id = rollKami(run, 'reward', D.RAR_W.reward, avoid);
    if (id) return { t: 'kami', id };
  }
  if (r < 0.88) return { t: 'oma', id: rollOma(run, 'reward', rnd(run, 'reward') < 0.5 ? 'ema' : 'other') };
  return { t: 'card', card: rollCard(run, 'reward') };
}
function genReward(run) {
  const n = 3 + ((run.meta.upg && run.meta.upg.goshugi) || 0);
  const items = [];
  for (let i = 0; i < n; i++) items.push(rollRewardItem(run, items.filter(o => o.t === 'kami').map(o => o.id)));
  run.offers = { kind: 'reward', items, reroll: D.ECON.rerollReward };
}
function rerollReward(run) {
  const o = run.offers;
  if (!o || run.ryo < o.reroll) return false;
  run.ryo -= o.reroll; o.reroll++;
  const n = o.items.length;
  o.items = [];
  for (let i = 0; i < n; i++) o.items.push(rollRewardItem(run, o.items.filter(q => q.t === 'kami').map(q => q.id)));
  return true;
}
function banishOffer(run, i) {
  const o = run.offers;
  if (!o || run.banish <= 0 || !o.items[i] || o.items[i].t !== 'kami') return false;
  run.banned.push(o.items[i].id);
  run.banish--;
  const avoid = o.items.filter(q => q.t === 'kami').map(q => q.id);
  const id = rollKami(run, 'reward', D.RAR_W.reward, avoid);
  o.items[i] = id ? { t: 'kami', id } : { t: 'oma', id: rollOma(run, 'reward') };
  return true;
}
/* 選んだものを受け取る。targets: 加工のお守りで選んだ札 */
function takeItem(run, it, targets) {
  if (it.t === 'kami') {
    if (run.kami.length >= kamiMax(run)) return { err: '神札の枠がいっぱいです(売ると空きます)' };
    const k = addKami(run, it.id);
    return { ok: 1, kami: k.u, evolved: checkEvolve(run) };
  }
  if (it.t === 'oma') return applyOma(run, it.id, targets || [], 'now');
  if (it.t === 'card') {
    const c = newCard(run, it.card.f, it.card.m);
    c.e = it.card.e; c.s = it.card.s;
    run.cards.push(c);
    return { ok: 1, added: [c.u] };
  }
  return { err: '?' };
}
function pickReward(run, i, targets) {
  const o = run.offers;
  if (!o || run.phase !== 'reward') return { err: '?' };
  const res = takeItem(run, o.items[i], targets);
  if (res.err) return res;
  run.offers = null;
  return res;
}
function skipReward(run) {
  run.ryo += D.ECON.skipReward;
  run.offers = null;
}

/* ---------------- 縁起物(主のあと) ---------------- */
function genEngi(run) {
  const n = 3 + ((run.meta.upg && run.meta.upg.engikatsugi) || 0);
  const pool = D.ENGI.filter(e => (run.engi[e.id] || 0) < e.max && !(e.id === 'kamidana' && run.kami.length >= kamiMax(run)));
  const items = rndShuffle(run, 'engi', pool.slice()).slice(0, n).map(e => e.id);
  run.offers = { kind: 'engi', items };
}
function pickEngi(run, i) {
  const o = run.offers;
  if (!o || o.kind !== 'engi') return { err: '?' };
  const id = o.items[i];
  const res = { ok: 1, id, added: [], removed: [], changed: [], oma: [], kami: null };
  run.engi[id] = (run.engi[id] || 0) + 1;
  switch (id) {
    case 'taigan': D.YAKU.forEach(y => { run.lv[y.id] = (run.lv[y.id] || 1) + 1; }); break;
    case 'oharai': run.banish += 2; break;
    case 'fukubiki': for (let i2 = 0; i2 < 2; i2++) if (run.oma.length < omaMax(run)) { const oid = rollOma(run, 'engi'); run.oma.push({ id: oid, u: ++run.uid }); res.oma.push(oid); } break;
    case 'kamidana': { const kid = rollKami(run, 'engi', [0, 0, 70, 30]); if (kid) { const k = addKami(run, kid); res.kami = k && k.u; res.evolved = checkEvolve(run); } break; }
    case 'susuharai': { const ks = rndShuffle(run, 'engi', run.cards.filter(c => faceOf(c).kind === 'kasu')).slice(0, 4); ks.forEach(c => { removeCard(run, c.u); res.removed.push(c.u); }); emitDeck(run); break; }
    case 'kinzaiku': { const cs = rndShuffle(run, 'engi', run.cards.filter(c => c.e !== 'kin')).slice(0, 3); cs.forEach(c => { c.e = 'kin'; res.changed.push(c.u); }); break; }
  }
  run.offers = null;
  genShop(run);
  run.phase = 'shop';
  return res;
}
function emitDeck(run) { if (run.cards.length <= 36) emit(run, { t: 'thin' }); }

/* ---------------- 茶屋 ---------------- */
function price(run, base) {
  return Math.max(1, base + (run.stake >= 5 ? 1 : 0) - runMods(run).discount);
}
function rollShopItem(run) {
  if (rnd(run, 'shop') < D.SHOP.kamiChance) {
    const avoid = run.shop ? run.shop.items.filter(it => it.t === 'kami').map(it => it.id) : [];
    const id = rollKami(run, 'shop', D.RAR_W.shop, avoid);
    if (id) return { t: 'kami', id, cost: price(run, D.KAMI_BY[id].cost) };
  }
  const id = rollOma(run, 'shop');
  return { t: 'oma', id, cost: price(run, D.OMA_BY[id].cost) };
}
function rollPack(run) {
  const keys = Object.keys(D.PACK_W);
  const t = keys[rndWeighted(run, 'pack', keys.map(k => D.PACK_W[k]))];
  return { t, cost: price(run, D.PACKS[t].cost) };
}
function genShop(run) {
  const m = runMods(run);
  const s = run.shop = { items: [], packs: [], reroll: D.ECON.rerollShop, free: m.freeReroll, enh: null };
  const ni = D.SHOP.items + m.shopItems;
  for (let i = 0; i < ni; i++) s.items.push(rollShopItem(run));
  const np = D.SHOP.packs + m.packs;
  for (let i = 0; i < np; i++) s.packs.push(rollPack(run));
  s.enh = rndPick(run, 'shop', ['kin', 'shu', 'ai', 'gin', 'urushi']);
}
function svcCost(run, kind) { return price(run, D.ECON.svc[kind] + run.svc[kind] * D.ECON.svc.inc); }
function buyItem(run, i) {
  const s = run.shop, it = s && s.items[i];
  if (!it || it.sold) return { err: '?' };
  if (run.ryo < it.cost) return { err: '両が足りません' };
  if (it.t === 'kami') {
    if (run.kami.length >= kamiMax(run)) return { err: '神札の枠がいっぱいです(売ると空きます)' };
    run.ryo -= it.cost; it.sold = true;
    const k = addKami(run, it.id);
    return { ok: 1, kami: k.u, evolved: checkEvolve(run) };
  }
  if (run.oma.length >= omaMax(run)) return { err: 'お守りの枠がいっぱいです' };
  run.ryo -= it.cost; it.sold = true;
  const o = { id: it.id, u: ++run.uid };
  run.oma.push(o);
  return { ok: 1, oma: o.u };
}
function rerollShop(run) {
  const s = run.shop;
  if (!s) return false;
  if (s.free > 0) s.free--;
  else { if (run.ryo < s.reroll) return false; run.ryo -= s.reroll; s.reroll++; }
  const n = s.items.length;
  s.items = [];
  for (let i = 0; i < n; i++) s.items.push(rollShopItem(run));
  return true;
}
function openPack(run, i) {
  const s = run.shop, p = s && s.packs[i];
  if (!p || p.sold) return { err: '?' };
  if (run.ryo < p.cost) return { err: '両が足りません' };
  run.ryo -= p.cost; p.sold = true;
  const n = D.PACKS[p.t].n + runMods(run).packExtra;
  const ch = [];
  for (let j = 0; j < n; j++) {
    if (p.t === 'kami' || p.t === 'bigkami') {
      const id = rollKami(run, 'pack', p.t === 'bigkami' ? D.RAR_W.big : D.RAR_W.shop, ch.map(q => q.id));
      ch.push(id ? { t: 'kami', id } : { t: 'oma', id: rollOma(run, 'pack') });
    } else if (p.t === 'oma') ch.push({ t: 'oma', id: rollOma(run, 'pack', 'other') });
    else if (p.t === 'ema') {
      let id; for (let tries = 0; tries < 6; tries++) { id = rollOma(run, 'pack', 'ema'); if (!ch.some(q => q.id === id)) break; }
      ch.push({ t: 'oma', id });
    } else ch.push({ t: 'card', card: rollCard(run, 'pack') });
  }
  run.pack = { t: p.t, items: ch };
  return { ok: 1 };
}
function pickPack(run, j, targets) {
  const pk = run.pack;
  if (!pk || !pk.items[j]) return { err: '?' };
  const res = takeItem(run, pk.items[j], targets);
  if (res.err) return res;
  run.pack = null;
  return res;
}
function skipPack(run) { run.pack = null; }
function sellKami(run, i) {
  const k = run.kami[i];
  if (!k) return 0;
  run.kami.splice(i, 1);
  run.ryo += k.sell;
  return k.sell;
}
function sellOma(run, i) {
  if (!run.oma[i]) return 0;
  run.oma.splice(i, 1);
  run.ryo += 1;
  return 1;
}
function moveKami(run, from, to) {
  if (from === to || !run.kami[from]) return;
  const [k] = run.kami.splice(from, 1);
  run.kami.splice(Math.max(0, Math.min(run.kami.length, to)), 0, k);
}
function service(run, kind, u, arg) {
  const c = cardOf(run, u);
  if (!c) return { err: '?' };
  const cost = svcCost(run, kind);
  if (run.ryo < cost) return { err: '両が足りません' };
  if (kind === 'remove') { if (run.cards.length <= 20) return { err: 'これ以上は減らせません' }; removeCard(run, u); emitDeck(run); }
  else if (kind === 'enhance') c.e = run.shop.enh;
  else if (kind === 'rewrite') { if (!(arg >= 1 && arg <= 12) || arg === c.m) return { err: '月を選んでください' }; c.m = arg; }
  run.ryo -= cost;
  run.svc[kind]++;
  return { ok: 1 };
}

/* ---------------- お守りを使う ----------------
   where: 'round'(勝負中は手札の札が対象) / 'shop' / 'now'(袋やご褒美から、すぐ使う) */
function omaNeeds(id) { const o = D.OMA_BY[id]; return o.type === 'mod' ? { n: o.n, min: o.min || 1 } : null; }
function canUseOma(run, id, targets, where) {
  const o = D.OMA_BY[id];
  if (o.inRound && run.phase !== 'round') return '勝負の中でだけ使えます';
  if (o.type === 'mod') {
    if (targets.length < (o.min || 1)) return '札を' + (o.min || 1) + '枚以上選んでください';
    if (targets.length > o.n) return '札は' + o.n + '枚までです';
  }
  if (id === 'omikuji' && run.kami.length >= kamiMax(run)) return '神札の枠がいっぱいです';
  if (id === 'shoukon' && (!run.lastOma || run.lastOma === 'shoukon')) return 'まだ使ったお守りがありません';
  return null;
}
function useOma(run, i, targets, where) {
  const o = run.oma[i];
  if (!o) return { err: '?' };
  const err = canUseOma(run, o.id, targets, where);
  if (err) return { err };
  run.oma.splice(i, 1);
  return applyOma(run, o.id, targets, where);
}
function applyOma(run, id, targets, where) {
  const o = D.OMA_BY[id];
  const err = canUseOma(run, id, targets, where);
  if (err) return { err };
  const res = { ok: 1, id, changed: [], removed: [], added: [], oma: [], kami: null, lv: null };
  const cs = targets.map(u => cardOf(run, u)).filter(Boolean);
  if (o.type === 'ema') {
    for (const y of D.EMA_GROUPS[o.grp].yaku) run.lv[y] = (run.lv[y] || 1) + 1;
    res.lv = o.grp;
    emit(run, { t: 'ema', lv: Math.max(...D.EMA_GROUPS[o.grp].yaku.map(y => run.lv[y])) });
  } else if (o.enh) cs.forEach(c => { c.e = o.enh; res.changed.push(c.u); });
  else if (o.seal) cs.forEach(c => { c.s = o.seal; res.changed.push(c.u); });
  else switch (id) {
    case 'tsukigae': { const m = cs[0].m; cs.forEach(c => { c.m = m; res.changed.push(c.u); }); break; }
    case 'koyomiokuri': cs.forEach(c => { c.m = c.m % 12 + 1; res.changed.push(c.u); }); break;
    case 'harai': cs.forEach(c => { removeCard(run, c.u); res.removed.push(c.u); }); emitDeck(run); break;
    case 'utsushi': cs.forEach(c => { const n = copyCard(run, c); res.added.push(n.u); if (run.phase === 'round' && run.rs) run.rs.hand.push(n.u); }); break;
    case 'omikuji': {
      let kid;
      if (rnd(run, 'omikuji') < 0.04) { kid = rndPick(run, 'omikuji', kamiPool(run, 4)); kid = kid && kid.id; res.daikichi = !!kid; }
      if (!kid) kid = rollKami(run, 'omikuji', D.RAR_W.shop);
      if (kid) { const k = addKami(run, kid); res.kami = k.u; res.evolved = checkEvolve(run); }
      break;
    }
    case 'saisenO': { const g = Math.min(20, Math.max(0, run.ryo)); run.ryo += g; res.ryo = g; break; }
    case 'fukubukuro': for (let j = 0; j < 2; j++) if (run.oma.length < omaMax(run)) { const oid = rollOma(run, 'oma'); run.oma.push({ id: oid, u: ++run.uid }); res.oma.push(oid); } break;
    case 'shoukon': if (run.oma.length < omaMax(run)) { run.oma.push({ id: run.lastOma, u: ++run.uid }); res.oma.push(run.lastOma); } break;
    case 'kamikakushi': {
      const rs = run.rs;
      rs.pile.push(...rs.hand);
      rs.hand = []; rs.down = [];
      rndShuffle(run, 'oma', rs.pile);
      res.drawn = draw(run, 'oma');
      break;
    }
  }
  if (id !== 'shoukon') run.lastOma = id;
  emit(run, { t: 'oma', id });
  return res;
}

/* ---------------- 旅の結果 ---------------- */
function kinpakuFor(run) {
  const K = D.KINPAKU, st = run.stats;
  let g = st.wins * K.win + st.bosses * K.boss + (run.cleared ? K.clear : 0) + Math.max(0, run.month - 12 - (run.over ? 1 : 0)) * K.endlessMonth;
  g *= 1 + K.stakeBonus * (run.stake - 1);
  return Math.round(g);
}
function monthLabel(m) { const y = Math.ceil(m / 12), mm = ((m - 1) % 12) + 1; return (y > 1 ? (y <= 12 ? D.KANSUJI[y] : y) + '年目 ' : '') + D.KANSUJI[mm] + '月'; }
function saveableRun(run) { return JSON.stringify(run, (k, v) => (k[0] === '_' ? undefined : v)); }
