'use strict';
/* 花暦 — テスト用ボット(Node で実行: node tools/bot.js [回数] [デッキ] [段位] [オプション])
   画面なしでゲームの処理(data/rules/run)だけを動かし、何か月まで進めたか・時間の目安・役の出方を数える。
   ボットは「手札から最高得点の出し方を全部試して選ぶ」「足りなければ見込みの薄い札を捨てる」
   「神札は、これまでの出しに加えたら何倍になったかで買う」という素直な打ち手。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'js');
const ctx = vm.createContext({ console, Math, JSON, Date, Map, Set, Object, Array, Number, String, Symbol });
for (const f of ['data.js', 'rules.js', 'run.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const G = name => vm.runInContext(name, ctx);
const D = G('D');
const H = {};
for (const n of ['newRun', 'startRound', 'play', 'discard', 'koikoi', 'payout', 'nextRound', 'nextMonth', 'pickReward', 'skipReward',
  'pickEngi', 'buyItem', 'openPack', 'pickPack', 'skipPack', 'sellKami', 'service', 'useOma', 'scorePlay', 'subsets', 'cardOf',
  'faceOf', 'runMods', 'kamiDef', 'checkEvolve', 'svcCost', 'omaMax', 'kamiMax', 'curMonth', 'previewYaku', 'detect', 'runFlags',
  'rerollReward', 'banishOffer', 'goEndless', 'kinpakuFor', 'monthLabel']) H[n] = G(n);

/* ---------------- 打ち方 ---------------- */
function handCards(run) { return run.rs.hand.map(u => H.cardOf(run, u)); }
function bestPlay(run, handOverride) {
  const rs = run.rs;
  const hand = handOverride || handCards(run);
  const boss = rs.boss ? D.BOSS_BY[rs.boss] : null;
  const maxK = Math.min(rs.maxPlay, hand.length);
  let best = null;
  for (const idx of H.subsets(hand.length, maxK)) {
    if (boss && boss.mustFive && idx.length < Math.min(5, hand.length)) continue;
    const pl = idx.map(i => hand[i]);
    const held = hand.filter((c, i) => idx.indexOf(i) < 0);
    const x = H.scorePlay(run, pl, held, { silent: true });
    const v = x.total;
    if (!best || v > best.v || (v === best.v && idx.length < best.idx.length)) best = { v, idx, uids: pl.map(c => c.u), x };
  }
  return best;
}
/* 捨てる札を選ぶ: 役の見込みがある札に点をつけ、低い札から捨てる */
function keepScores(run, hand, best) {
  const sc = new Map(hand.map(c => [c.u, 0]));
  const bump = (c, v) => sc.set(c.u, sc.get(c.u) + v);
  if (best && best.v > 0) for (const u of best.uids) { const c = hand.find(q => q.u === u); if (c && best.x.yaku[0].id !== 'su') bump(c, 3); }
  const byM = {};
  for (const c of hand) (byM[c.m] = byM[c.m] || []).push(c);
  for (const m in byM) if (byM[m].length >= 2) byM[m].forEach(c => bump(c, 1.5 * byM[m].length));
  const faces = new Set(hand.map(c => H.faceOf(c).id));
  for (const [id, need] of D.SETS) {
    const have = need.filter(f => faces.has(f)).length;
    if (have >= need.length - 1 && have >= 1) hand.forEach(c => { if (need.indexOf(H.faceOf(c).id) >= 0) bump(c, have === need.length ? 6 : 3.5); });
  }
  const kinds = { hikari: [], tane: [], tan: [], kasu: [] };
  hand.forEach(c => kinds[H.faceOf(c).kind].push(c));
  if (kinds.hikari.length >= 2) kinds.hikari.forEach(c => bump(c, 4));
  else kinds.hikari.forEach(c => bump(c, 1.5));
  for (const k of ['tane', 'tan']) if (kinds[k].length >= 3) kinds[k].forEach(c => bump(c, kinds[k].length - 1));
  if (kinds.kasu.length >= 4) kinds.kasu.forEach(c => bump(c, 1));
  hand.forEach(c => { if (c.e) bump(c, 2); if (c.m === H.curMonth(run)) bump(c, 0.8); });
  return sc;
}
function chooseDiscard(run) {
  const hand = handCards(run);
  const best = bestPlay(run, hand);
  const sc = keepScores(run, hand, best);
  const order = hand.slice().sort((a, b) => sc.get(a.u) - sc.get(b.u));
  const out = [];
  for (const c of order) { if (out.length >= D.RULE.maxDiscard) break; if (sc.get(c.u) < 3.5 || out.length < 2) out.push(c.u); }
  return out.slice(0, Math.min(D.RULE.maxDiscard, Math.max(1, out.length)));
}

/* ---------------- 神札の値打ち ----------------
   これまでの出し(最大24回分)を、その神札を足した状態でもう一度数え直して比べる */
function evalRun(run, kamiList, lvPatch) {
  const saveK = run.kami, saveLv = run.lv, saveRs = run.rs;
  run.kami = kamiList;
  if (lvPatch) run.lv = Object.assign({}, run.lv, lvPatch);
  let sum = 0;
  for (const h of run._hist || []) {
    run.rs = h.rs;
    sum += Math.log(1 + H.scorePlay(run, h.played, h.held, { silent: true }).total);
  }
  run.kami = saveK; run.lv = saveLv; run.rs = saveRs;
  return sum;
}
function projectKami(run, id) {
  const d = D.KAMI_BY[id];
  const k = { id, u: -1, s: d.s0 ? JSON.parse(JSON.stringify(d.s0)) : {}, sell: 2 };
  const left = Math.max(1, 12 - run.month + 1);
  if (id === 'kokemusu') k.s.b = 2 * Math.min(18, left * 1.5);
  if (id === 'nenrin') k.s.x = 1 + 0.5 * Math.min(6, left / 2);
  if (id === 'shusse') k.s.b = 3 * Math.min(8, left / 2);
  if (id === 'senbazuru' || id === 'sakagura') k.s.x = 1.5;
  if (id === 'yukidaruma') k.s.t = 60;
  if (id === 'junrei') k.s.t = 30;
  if (id === 'daifukucho') k.s.b = 6;
  if (id === 'fujin' || id === 'raijin') k.s.b = 5;
  return k;
}
const ECON_BONUS = { kozuchi: 0.6, ebisu: 0.6, kanenonaruki: 0.4, chokinbako: 0.3, takarabune: 0.5, saisen: 0.3, omikujibako: 0.4, emakake: 0.4,
  hayauma: 0.9, houkiboshi: 0.6, senju: 0.8, yubiori: 0.5, tobiishi: 0.2, kikuzake: 0.2, amayadori: 0.2, ooburumai: 0.3, bakedanuki: 0.4,
  kintsugi: 0.3, aizome: 0.3, onmyoji: 0.5 };
function kamiValue(run, id, replaceIdx) {
  const base = evalRun(run, run.kami);
  const list = run.kami.slice();
  if (replaceIdx !== undefined && replaceIdx >= 0) list.splice(replaceIdx, 1);
  list.push(projectKami(run, id));
  const v = evalRun(run, list) - base;
  const n = Math.max(1, (run._hist || []).length);
  const early = Math.max(0.2, (13 - run.month) / 12);
  return v / n + (ECON_BONUS[id] || 0) * (id in { kozuchi: 1, ebisu: 1, kanenonaruki: 1, chokinbako: 1, takarabune: 1, saisen: 1, omikujibako: 1, emakake: 1 } ? early : 1) * 0.5;
}
function weakestKami(run) {
  if (!run.kami.length) return { i: -1, v: 0 };
  const base = evalRun(run, run.kami);
  let best = { i: -1, v: Infinity };
  run.kami.forEach((k, i) => {
    const list = run.kami.filter((q, j) => j !== i);
    let v = (base - evalRun(run, list)) / Math.max(1, (run._hist || []).length) + (ECON_BONUS[k.id] || 0) * 0.5;
    if (v < best.v) best = { i, v };
  });
  return best;
}
function emaValue(run, grp) {
  const base = evalRun(run, run.kami);
  const patch = {};
  for (const y of D.EMA_GROUPS[grp].yaku) patch[y] = (run.lv[y] || 1) + 1;
  return (evalRun(run, run.kami, patch) - base) / Math.max(1, (run._hist || []).length);
}
/* 加工のお守りの対象(よく得点に使った札) */
function modTargets(run, id, where) {
  const o = D.OMA_BY[id];
  const use = run._use || {};
  let pool = where === 'round' ? run.rs.hand.map(u => H.cardOf(run, u)) : run.cards.slice();
  if (id === 'harai') {
    pool = pool.filter(c => H.faceOf(c).kind === 'kasu' && !c.e).sort((a, b) => (use[a.u] || 0) - (use[b.u] || 0));
    return pool.slice(0, o.n).map(c => c.u);
  }
  if (id === 'tsukigae' || id === 'koyomiokuri') return [];
  pool = pool.filter(c => !(o.enh && c.e) && !(o.seal && c.s)).sort((a, b) => (use[b.u] || 0) - (use[a.u] || 0) || (D.CARD_TEN[H.faceOf(b).kind] - D.CARD_TEN[H.faceOf(a).kind]));
  return pool.slice(0, o.n).map(c => c.u);
}
function itemValue(run, it) {
  if (it.t === 'kami') {
    if (run.kami.length < H.kamiMax(run)) return kamiValue(run, it.id);
    const w = weakestKami(run);
    return kamiValue(run, it.id, w.i) - Math.max(0, w.v);
  }
  if (it.t === 'oma') {
    const o = D.OMA_BY[it.id];
    if (o.type === 'ema') return emaValue(run, o.grp) * 1.6;
    if (it.id === 'omikuji') return run.kami.length < H.kamiMax(run) ? 0.25 : -1;
    if (o.type === 'mod') return (it.id === 'tsukigae' || it.id === 'koyomiokuri') ? -1 : (it.id === 'harai' ? 0.12 : 0.16);
    return 0.05;
  }
  if (it.t === 'card') return it.card.e === 'kin' ? 0.1 : 0.03;
  return 0;
}
const ENGI_PRI = ['senkyaku', 'suehiro', 'taigan', 'migaru', 'kamidana', 'omiki', 'shoubai', 'kinzaiku', 'mekiki', 'kura', 'mamorikin', 'shunsai', 'joren', 'oobukuro', 'negiri', 'susuharai', 'fukubiki', 'oharai'];

/* ---------------- 1回の旅 ---------------- */
function simRun(opt) {
  const run = H.newRun({ deck: opt.deck, stake: opt.stake, seed: opt.seed, meta: { upg: opt.upg || {} } });
  run._hist = []; run._use = {};
  const T = { think: 0, anim: 0, shop: 0, pick: 0, other: 0 };
  const log = { yaku: {}, rounds: [], deaths: null, boss: [], playsPerRound: [], evo: 0, bossFail: null };
  let guard = 0;
  while (!run.over && guard++ < 5000) {
    if (run.phase === 'month') { T.other += 3; H.startRound(run); continue; }
    if (run.phase === 'round') {
      const rs = run.rs;
      const best = bestPlay(run);
      const need = rs.target * (rs.koi ? 2 : 1) - rs.score;
      const perPlay = need / Math.max(1, rs.plays);
      if (best.v < perPlay && rs.discards > 0 && rs.plays > 0 && !(best.v >= need)) {
        const ds = chooseDiscard(run);
        H.discard(run, ds);
        T.think += 3; T.anim += 0.8;
        continue;
      }
      const held = rs.hand.filter(u => best.uids.indexOf(u) < 0).map(u => H.cardOf(run, u));
      const snap = { rs: { n: rs.n, plays: rs.plays, discards: rs.discards, boss: null, yakuMade: {}, firstYaku: null }, played: best.uids.map(u => Object.assign({}, H.cardOf(run, u))), held: held.map(c => Object.assign({}, c)) };
      const res = H.play(run, best.uids);
      if (res.err) throw new Error(res.err);
      run._hist.push(snap); if (run._hist.length > 24) run._hist.shift();
      res.x.scoring.forEach(c => { run._use[c.u] = (run._use[c.u] || 0) + 1; });
      res.x.yaku.forEach(y => { log.yaku[y.id] = (log.yaku[y.id] || 0) + 1; });
      T.think += 5; T.anim += 0.9 + 0.13 * res.x.ev.length;
      continue;
    }
    if (run.phase === 'koikoi') {
      const rs = run.rs;
      const best = bestPlay(run);
      const go = rs.plays >= 2 && best.v * rs.plays >= rs.target * 2 - rs.score;
      H.koikoi(run, go);
      continue;
    }
    if (run.phase === 'won') {
      log.playsPerRound.push(run.rs.n);
      log.rounds.push({ m: run.month, r: run.round, n: run.rs.n, score: run.rs.score, target: run.rs.target });
      if (run.round === 2) log.boss.push(run.rs.boss);
      H.payout(run);
      T.other += 3;
      continue;
    }
    if (run.phase === 'reward') {
      const o = run.offers;
      let bi = -1, bv = 0.02;
      o.items.forEach((it, i) => { const v = itemValue(run, it); if (v > bv) { bv = v; bi = i; } });
      if (bi >= 0) {
        const it = o.items[bi];
        let targets = [];
        if (it.t === 'kami' && run.kami.length >= H.kamiMax(run)) { const w = weakestKami(run); H.sellKami(run, w.i); }
        if (it.t === 'oma' && D.OMA_BY[it.id].type === 'mod') targets = modTargets(run, it.id, 'now');
        const r = H.pickReward(run, bi, targets);
        if (r.err) H.skipReward(run);
        if (r.evolved && r.evolved.length) log.evo += r.evolved.length;
      } else H.skipReward(run);
      T.pick += 6;
      H.nextRound(run);
      continue;
    }
    if (run.phase === 'engi') {
      const items = run.offers.items;
      let bi = 0, bp = 99;
      items.forEach((id, i) => { const p = ENGI_PRI.indexOf(id); if (p >= 0 && p < bp) { bp = p; bi = i; } });
      H.pickEngi(run, bi);
      T.pick += 6;
      continue;
    }
    if (run.phase === 'shop') {
      shopBot(run, log);
      T.shop += 25;
      H.nextMonth(run);
      continue;
    }
    if (run.phase === 'clear') {
      if (opt.endless) { H.goEndless(run); continue; }
      break;
    }
    throw new Error('phase ' + run.phase);
  }
  const reached = run.cleared && !opt.endless ? 13 : run.month;
  if (run.over) log.deaths = { m: run.month, r: run.round, boss: run.rs && run.rs.boss, score: run.rs.score, target: run.rs.target };
  return { run, T, log, reached, cleared: run.cleared, time: T.think + T.anim + T.shop + T.pick + T.other };
}
function shopBot(run, log) {
  const s = run.shop;
  for (let pass = 0; pass < 3; pass++) {
    // 品書き
    let bi = -1, bv = 0.08;
    s.items.forEach((it, i) => {
      if (it.sold || it.cost > run.ryo) return;
      if (it.t === 'oma' && run.oma.length >= H.omaMax(run)) return;
      const v = itemValue(run, it) - it.cost * 0.012;
      if (v > bv) { bv = v; bi = i; }
    });
    if (bi >= 0) {
      const it = s.items[bi];
      if (it.t === 'kami' && run.kami.length >= H.kamiMax(run)) { const w = weakestKami(run); H.sellKami(run, w.i); }
      const r = H.buyItem(run, bi);
      if (r.evolved && r.evolved.length) log.evo += r.evolved.length;
      continue;
    }
    break;
  }
  // 袋
  s.packs.forEach((p, i) => {
    if (p.sold || p.cost > run.ryo - 3) return;
    if ((p.t === 'kami' || p.t === 'bigkami') && run.kami.length >= H.kamiMax(run) && run.month > 8) return;
    if (p.t === 'card') return;
    H.openPack(run, i);
    let bi = -1, bv = 0.0;
    run.pack.items.forEach((it, j) => { const v = itemValue(run, it); if (v > bv) { bv = v; bi = j; } });
    if (bi >= 0) {
      const it = run.pack.items[bi];
      if (it.t === 'kami' && run.kami.length >= H.kamiMax(run)) { const w = weakestKami(run); H.sellKami(run, w.i); }
      let targets = [];
      if (it.t === 'oma' && D.OMA_BY[it.id].type === 'mod') targets = modTargets(run, it.id, 'now');
      const r = H.pickPack(run, bi, targets);
      if (r.err) H.skipPack(run);
      if (r.evolved && r.evolved.length) log.evo += r.evolved.length;
    } else H.skipPack(run);
  });
  // 手入れ: カスを抜く・よく使う札を強化
  const use = run._use;
  const kasuMain = (run.stats.yaku.kasu || 0) > run.stats.plays * 0.25;
  if (!kasuMain && run.ryo >= H.svcCost(run, 'remove') + 6 && run.cards.length > 34) {
    const k = run.cards.filter(c => H.faceOf(c).kind === 'kasu' && !c.e).sort((a, b) => (use[a.u] || 0) - (use[b.u] || 0))[0];
    if (k) H.service(run, 'remove', k.u);
  }
  if (run.ryo >= H.svcCost(run, 'enhance') + 8) {
    const c = run.cards.filter(q => !q.e).sort((a, b) => (use[b.u] || 0) - (use[a.u] || 0))[0];
    if (c) H.service(run, 'enhance', c.u);
  }
  // 持っているお守りを使う
  for (let i = run.oma.length - 1; i >= 0; i--) {
    const o = D.OMA_BY[run.oma[i].id];
    if (o.inRound) continue;
    let t = [];
    if (o.type === 'mod') { t = modTargets(run, o.id, 'shop'); if (!t.length) { continue; } }
    H.useOma(run, i, t, 'shop');
  }
}

/* ---------------- 集計 ---------------- */
function main() {
  const args = process.argv.slice(2);
  const N = +args[0] || 40;
  const deck = args[1] || 'hana';
  const stake = +args[2] || 1;
  const flags = new Set(args.slice(3));
  const endless = flags.has('endless');
  const upgAll = flags.has('upg');
  const upg = upgAll ? Object.fromEntries(D.UPGRADES.map(u => [u.id, u.max])) : {};
  const t0 = Date.now();
  const res = [];
  for (let i = 0; i < N; i++) res.push(simRun({ deck, stake, seed: 'BOT' + deck + stake + '_' + i, endless, upg }));
  const ms = Date.now() - t0;
  const reach = {};
  res.forEach(r => { reach[r.reached] = (reach[r.reached] || 0) + 1; });
  const clears = res.filter(r => r.cleared).length;
  const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log(`== ${N}回 デッキ=${deck} 段位=${stake}${endless ? ' エンドレス' : ''}${upgAll ? ' 蔵すべて' : ''}  (${(ms / 1000).toFixed(1)}秒)`);
  console.log('クリア率', (clears / N * 100).toFixed(0) + '%', ' 到達月の分布', JSON.stringify(reach));
  const times = res.map(r => r.time / 60);
  console.log('推定プレイ時間(分) 平均', avg(times).toFixed(1), ' 中央', pct(times, 0.5).toFixed(1), ' クリア時の平均', avg(res.filter(r => r.cleared).map(r => r.time / 60)).toFixed(1));
  const pp = res.flatMap(r => r.log.playsPerRound);
  console.log('勝負あたりの出し回数 平均', avg(pp).toFixed(2), ' 1回で勝った割合', (pp.filter(n => n === 1).length / pp.length * 100).toFixed(0) + '%');
  const deaths = res.filter(r => r.log.deaths).map(r => r.log.deaths);
  const dm = {};
  deaths.forEach(d => { const k = d.m + (d.r === 2 ? '主(' + D.BOSS_BY[d.boss].name + ')' : ['一', '二'][d.r]); dm[k] = (dm[k] || 0) + 1; });
  console.log('負けた場所', JSON.stringify(dm));
  const ys = {};
  res.forEach(r => { for (const k in r.log.yaku) ys[k] = (ys[k] || 0) + r.log.yaku[k]; });
  const totalPlays = res.reduce((s, r) => s + r.run.stats.plays, 0);
  console.log('役の出現(出し100回あたり)', Object.entries(ys).sort((a, b) => b[1] - a[1]).map(([k, v]) => D.YAKU_BY[k].name + ':' + (v / totalPlays * 100).toFixed(1)).join(' '));
  console.log('最高の出し 平均', Math.round(avg(res.map(r => r.run.stats.best))), ' 進化の回数 平均', avg(res.map(r => r.log.evo)).toFixed(2), ' 金箔 平均', avg(res.map(r => H.kinpakuFor(r.run))).toFixed(1));
  // 月ごとの「目標に対する余裕」
  const margin = {};
  res.forEach(r => r.log.rounds.forEach(x => { (margin[x.m] = margin[x.m] || []).push(x.score / x.target); }));
  console.log('月ごとの 得点/目標 の中央値', Object.keys(margin).map(m => m + ':' + pct(margin[m], 0.5).toFixed(2)).join(' '));
  const kc = {};
  res.forEach(r => { for (const k in r.run.stats.kamiC) kc[k] = (kc[k] || 0) + 1; });
  console.log('よく使われた神札', Object.entries(kc).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => D.KAMI_BY[k].name + ':' + v).join(' '));
  if (flags.has('v')) res.slice(0, 3).forEach(r => console.log(JSON.stringify(r.log.rounds.map(x => x.m + '.' + x.r + ':' + x.n + ':' + Math.round(x.score / x.target * 100) + '%'))));
}
if (require.main === module) main();
module.exports = { simRun, H, D };
