'use strict';
/* 花暦 — main: 起動・毎フレームの更新・旅の進行・記録と実績・キーボードとゲームパッド */
const MAIN = { last: 0, playT: 0 };

/* ---------------- 旅の進行 ---------------- */
function kamiPoolNow() { return D.KAMI.filter(k => !k.evo && k.rar <= 3 && kamiUnlocked(k.id)).map(k => k.id); }
MAIN.startRun = function (o) {
  SC.closeAll();
  const run = newRun({ deck: o.deck, stake: o.stake, seed: o.seed, daily: o.daily, meta: o.daily ? { upg: {} } : { upg: Object.assign({}, SAVE.upg) }, pool: o.daily ? null : kamiPoolNow() });
  UI.run = run;
  SAVE.stats.runs++;
  if (o.daily) SAVE.stats.daily++;
  else SAVE.last = { deck: o.deck, stake: o.stake };
  for (const s of [...UI.sprites.values()]) killSprite(s);
  saveGame();
  MAIN.afterAction();
  MAIN.advance();
};
MAIN.dailyInfo = function () {
  const k = todayKey();
  const n = hashStr('daily' + k);
  const deck = D.DECKS[n % D.DECKS.length];
  return { key: k, seed: 'D' + k.replace(/-/g, ''), deck: deck.id, stake: 2, label: deck.name + '・二段' };
};
MAIN.startDaily = function () { const d = MAIN.dailyInfo(); MAIN.startRun({ deck: d.deck, stake: d.stake, seed: d.seed, daily: true }); };
MAIN.resume = function (saved) {
  SC.closeAll();
  for (const s of [...UI.sprites.values()]) killSprite(s);
  UI.run = saved;
  saved._ev = [];
  MAIN.advance();
};
/* いまの段階に合った画面を開く */
MAIN.advance = function () {
  const run = UI.run;
  if (!run) return SC.title();
  switch (run.phase) {
    case 'month': SC.monthIntro(run); break;
    case 'round': UI.enterRound(); break;
    case 'koikoi': UI.enterRound(); setTimeout(() => SC.koikoi(run), 300); break;
    case 'won': UI.active = true; $('play').hidden = false; $('title').hidden = true; UI.layout(); SC.roundResult(run); break;
    case 'reward': SC.reward(run); break;
    case 'engi': SC.engi(run); break;
    case 'shop': SC.shop(run); break;
    case 'clear': MAIN.endRun('clear'); break;
    case 'over': MAIN.endRun('over'); break;
    default: SC.title();
  }
  saveRun(run);
};
/* 出す・捨てる・買うなどのたびに: 記録・実績・セーブ */
MAIN.afterAction = function () {
  const run = UI.run;
  if (!run) return;
  processEvents(run);
  saveRun(run);
  UI.hud();
};
MAIN.afterRoundEnd = function (outcome) {
  const run = UI.run;
  if (run.phase === 'koikoi') { SC.koikoi(run); return; }
  if (run.phase === 'won') {
    const boss = run.round === 2;
    UI.lock = true;
    SFX.win();
    UI.bigStamp(boss ? '討伐' : '勝', boss ? '主「' + D.BOSS_BY[run.rs.boss].name + '」を倒した' : '目標 ' + fmt(run.rs.target) + ' 達成', true);
    const c = elCenter($('field'));
    FX.burst(c.x, c.y, 'petal', 60, { speed: 420, month: curMonth(run), life: 2.2 });
    FX.burst(c.x, c.y, 'gold', 40, { speed: 380 });
    FX.flashOn(0.5);
    setTimeout(() => { UI.lock = false; SC.roundResult(run); }, 1300);
    return;
  }
  if (run.phase === 'over') {
    UI.lock = true;
    SFX.lose();
    UI.bigStamp('負', '目標 ' + fmt(run.rs.koi ? run.rs.target2 : run.rs.target) + ' に届かなかった', false);
    FX.burst(window.innerWidth / 2, window.innerHeight * 0.3, 'petal', 40, { speed: 160, month: curMonth(run), life: 3, up: -40 });
    setTimeout(() => { UI.lock = false; MAIN.endRun('over'); }, 1700);
  }
};
MAIN.endRun = function (kind) {
  const run = UI.run;
  const S = SAVE;
  const news = [];
  const total = kinpakuFor(run);
  const gained = Math.max(0, total - (run.paid || 0));
  run.paid = total;
  S.kinpaku += gained; S.kinpakuTotal += gained;
  S.best.month = Math.max(S.best.month, run.cleared ? Math.max(13, run.month) : run.month);
  S.best.total = Math.max(S.best.total, run.stats.total);
  if (run.endless) S.best.endless = Math.max(S.best.endless, run.month);
  if (kind === 'clear') {
    S.stats.clears++;
    S.deckClear[run.deckId] = Math.max(S.deckClear[run.deckId] || 0, run.stake);
    S.best.stake = Math.max(S.best.stake, run.stake);
    if (!run.daily && run.stake >= S.stakeMax && S.stakeMax < 8) { S.stakeMax = run.stake + 1; news.push('段位「' + D.STAKES[S.stakeMax].name + '」が開いた'); }
    if (!S.best.clearTime || run.stats.time < S.best.clearTime) S.best.clearTime = Math.round(run.stats.time);
  } else S.stats.losses++;
  if (run.daily) {
    const k = run.seed.slice(1, 5) + '-' + run.seed.slice(5, 7) + '-' + run.seed.slice(7, 9);
    const prev = S.daily[k];
    const m = run.cleared ? Math.max(13, run.month) : run.month;
    if (!prev || m > prev.month || (m === prev.month && run.stats.total > prev.total)) S.daily[k] = { month: m, total: run.stats.total };
  }
  processEvents(run, news);
  clearRunSave();
  saveGame();
  SC.runResult(run, kind, gained, news);
};
MAIN.showEvolve = function (list) {
  SFX.evolve();
  list.forEach((e, i) => setTimeout(() => {
    const def = D.KAMI_BY[e.id];
    UI.bigStamp('進化', '「' + def.name + '」になった', true);
    UI.toast('進化: <b>' + def.name + '</b> — ' + esc(fillDesc(def)), 4200);
    FX.flashOn(0.55, '240,220,255');
    const s = spr('kami', e.u);
    const p = s ? scr(s) : { x: window.innerWidth / 2, y: 120 };
    FX.burst(p.x, p.y, 'gold', 40, { speed: 340 }); FX.ring(p.x, p.y, '200,150,255', 140);
  }, i * 900));
};

/* ---------------- 記録・実績・解放 ---------------- */
function processEvents(run, news) {
  const S = SAVE, st = S.stats;
  const evs = run._ev || [];
  run._ev = [];
  for (const ev of evs) {
    switch (ev.t) {
      case 'play':
        st.plays++; st.cards += ev.n;
        ev.yaku.forEach(y => { S.yaku[y] = (S.yaku[y] || 0) + 1; });
        S.best.play = Math.max(S.best.play, ev.score);
        st.maxYaku = Math.max(st.maxYaku, ev.nYaku);
        if (ev.kin) st.kinScored++;
        st.hikariScored += ev.hikari;
        if (ev.goyomiTan) st.goyomiTan++;
        if (ev.n === 1 && ev.score >= 300) st.oneCard300++;
        if (ev.n === 1 && ev.score >= 1000) st.oneCard1000++;
        break;
      case 'discard': st.discards++; break;
      case 'win': st.wins++; if (ev.oneShot) st.oneShot++; if (ev.koikoi) st.koikoi++; break;
      case 'boss': st.bosses++; S.bossKill[ev.id] = (S.bossKill[ev.id] || 0) + 1; if (ev.noKami) st.bossNoKami++; break;
      case 'kami': S.dex[ev.id] = 1; break;
      case 'oma': S.omaDex[ev.id] = 1; break;
      case 'evolve': st.evolve++; break;
      case 'fullKami': st.fullKami++; break;
      case 'thin': st.thinDeck++; break;
      case 'ema': st.ema++; st.maxLv = Math.max(st.maxLv, ev.lv); break;
      case 'ryo': break;
    }
  }
  S.best.ryo = Math.max(S.best.ryo, run.ryo);
  if (!run.over) S.best.month = Math.max(S.best.month, run.cleared ? 13 : run.month);
  for (const id in run.lv) st.maxLv = Math.max(st.maxLv, run.lv[id]);
  // 実績
  for (const a of D.ACH) {
    if (S.ach[a.id]) continue;
    let ok = false;
    try { ok = a.t(S); } catch (e) { ok = false; }
    if (ok) {
      S.ach[a.id] = Date.now();
      S.kinpaku += a.g; S.kinpakuTotal += a.g;
      UI.toast('実績「<b>' + esc(a.name) + '</b>」 <span class="kinpaku">+' + a.g + '</span>', 3600);
      if (news) news.push('実績「' + a.name + '」+' + a.g + '金箔');
    }
  }
  // 神札の解放
  for (const id in D.KAMI_UNLOCK) {
    if (S.unlockSeen[id]) continue;
    let ok = false;
    try { ok = D.KAMI_UNLOCK[id].t(S); } catch (e) { ok = false; }
    if (ok) {
      S.unlockSeen[id] = 1;
      UI.toast('神札「<b>' + esc(D.KAMI_BY[id].name) + '</b>」が出るようになった', 3600);
      if (news) news.push('神札「' + D.KAMI_BY[id].name + '」が解放された');
    }
  }
  saveGame();
}

/* ---------------- 毎フレーム ---------------- */
function frame(now) {
  requestAnimationFrame(frame);
  MAIN.tick(Math.min(0.05, Math.max(0, (now - (MAIN.last || now)) / 1000)));
  MAIN.last = now;
}
MAIN.tick = function (dt) {
  tlUpdate(dt);
  updateSprites(dt);
  if (UI.active) updateDisplays(dt);
  FX.update(dt);
  FX.draw();
  const st = $('stage');
  const tr = FX.shake ? 'translate(' + FX.sx.toFixed(1) + 'px,' + FX.sy.toFixed(1) + 'px)' : '';
  if (st._tr !== tr) { st.style.transform = tr; st._tr = tr; }
  pollPad();
  const run = UI.run;
  if (run && !run.over && (run.phase === 'round' || run.phase === 'shop' || run.phase === 'reward')) {
    run.stats.time = (run.stats.time || 0) + dt;
    SAVE.stats.playTime += dt;
  }
};
HG.tick = MAIN.tick;

/* ---------------- 画面の大きさ ---------------- */
MAIN.onResize = function (force) {
  clearTimeout(MAIN._rz);
  const go = () => {
    ART.washi($('bg'), window.innerWidth, window.innerHeight, SAVE.set.quality);
    FX.resize();
    if (force) { ART.clearCache(); for (const s of UI.sprites.values()) s.key = ''; }
    UI.layout();
  };
  if (force) go(); else { UI.layout(); MAIN._rz = setTimeout(go, 160); }
};

/* ---------------- キーボード・ゲームパッド ---------------- */
function focusables(root) {
  return [...root.querySelectorAll('button, [tabindex="0"], input[type=range]')].filter(e => !e.disabled && e.offsetParent !== null);
}
function navRoot() { const t = SC.top(); if (t) return t.panel; if (!$('title').hidden) return $('title'); return null; }
function spatial(dir) {
  const root = navRoot();
  if (!root) return;
  const els = focusables(root);
  if (!els.length) return;
  const cur = document.activeElement;
  if (!cur || els.indexOf(cur) < 0) { els[0].focus(); return; }
  const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = null, bd = Infinity;
  for (const e of els) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    let ok = false;
    if (dir === 'L') ok = dx < -4 && Math.abs(dy) < Math.abs(dx) * 2 + 20;
    if (dir === 'R') ok = dx > 4 && Math.abs(dy) < Math.abs(dx) * 2 + 20;
    if (dir === 'U') ok = dy < -4;
    if (dir === 'D') ok = dy > 4;
    if (!ok) continue;
    const d = (dir === 'L' || dir === 'R') ? Math.abs(dx) + Math.abs(dy) * 2.5 : Math.abs(dy) + Math.abs(dx) * 0.6;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); SFX.tap(); }
}
addEventListener('keydown', ev => {
  AU.init();
  UI.isTouch = false;
  if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type !== 'range') return;
  if (ev.code === 'Escape' || ev.code === 'KeyP') {
    if (SC.back()) { ev.preventDefault(); return; }
    if (UI.active && UI.run && UI.run.phase === 'round') { SC.pause(); ev.preventDefault(); }
    return;
  }
  if (SC.top() || !$('title').hidden) {
    const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' };
    if (map[ev.code] && !(ev.target && ev.target.type === 'range' && (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight'))) { spatial(map[ev.code]); ev.preventDefault(); }
    return;
  }
  if (UI.key(ev)) ev.preventDefault();
});
const PAD = { prev: {}, rep: {} };
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  const p = pads && [...pads].find(x => x && x.connected);
  if (!p) return;
  const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const dirs = { L: b(14) || ax < -0.55, R: b(15) || ax > 0.55, U: b(12) || ay < -0.55, D: b(13) || ay > 0.55 };
  const now = performance.now();
  const edge = (k, v) => { const pr = PAD.prev[k]; PAD.prev[k] = v; if (v && !pr) { PAD.rep[k] = now + 380; return true; } if (v && pr && (k in dirs) && now > PAD.rep[k]) { PAD.rep[k] = now + 110; return true; } return false; };
  const inMenu = SC.top() || !$('title').hidden;
  for (const d of ['L', 'R', 'U', 'D']) if (edge(d, dirs[d])) {
    AU.init(); UI.isTouch = false;
    if (inMenu) spatial(d);
    else if (UI.active) { const code = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' }[d]; UI.key({ code, shiftKey: false }); }
  }
  if (edge('A', b(0))) { AU.init(); if (inMenu) { const f = document.activeElement; if (f && f !== document.body) f.click(); else spatial('D'); } else UI.key({ code: 'Space' }); }
  if (edge('B', b(1))) { if (!SC.back() && UI.active) UI.clearSel(); }
  if (edge('X', b(2)) && !inMenu) UI.doDiscard();
  if (edge('Y', b(3)) && !inMenu) UI.doPlay();
  if (edge('LB', b(4)) && !inMenu) UI.key({ code: 'KeyQ' });
  if (edge('RB', b(5)) && !inMenu) UI.key({ code: 'KeyE' });
  if (edge('BK', b(8))) { if (!inMenu) SC.yakuList(); else SC.back(); }
  if (edge('ST', b(9))) { if (!SC.back() && UI.active) SC.pause(); }
}

/* ---------------- 起動 ---------------- */
MAIN.boot = function () {
  FX.init();
  ART.washi($('bg'), window.innerWidth, window.innerHeight, SAVE.set.quality);
  addEventListener('resize', () => MAIN.onResize());
  addEventListener('orientationchange', () => setTimeout(() => MAIN.onResize(), 200));
  $('btn-play').onclick = () => { AU.init(); UI.doPlay(); };
  $('btn-discard').onclick = () => { AU.init(); UI.doDiscard(); };
  $('btn-sort').onclick = () => { AU.init(); UI.sortToggle(); };
  $('btn-yaku').onclick = () => { AU.init(); SFX.page(); SC.yakuList(); };
  $('btn-menu').onclick = () => { AU.init(); SFX.tap(); SC.pause(); };
  $('opp').onclick = () => {
    const run = UI.run;
    if (!run || !run.rs) return;
    const rs = run.rs;
    const o = rs.boss ? D.BOSS_BY[rs.boss] : D.OPP_BY[rs.opp];
    UI.showTip(rs.boss ? '<div class="tn">主「' + esc(o.name) + '」</div><div class="td">' + esc(o.d) + '</div>' : '<div class="tn">' + esc(o.name) + '</div><div class="td">「' + esc(o.line) + '」<br>お題: ' + esc(D.ODAI[rs.odai].d) + '(達成で +' + D.ODAI[rs.odai].r + '両)' + (rs.odaiDone ? ' ✔ 達成' : '') + '</div>', $('opp'));
  };
  $('deck-pile').onclick = () => { SFX.page(); SC.deckView(); };
  // 勝負中に画面をタップすると演出を早送り
  $('play').addEventListener('pointerdown', () => { if (UI.lock && tlBusy()) UI.ff = 3; });
  document.addEventListener('pointerdown', ev => {
    AU.init();
    UI.isTouch = ev.pointerType !== 'mouse';
    if (UI.tipOpen && !$('tip').contains(ev.target) && !(UI.tipFor && UI.tipFor.el && UI.tipFor.el.contains(ev.target))) {
      if (!ev.target.closest || !ev.target.closest('.mini, #opp')) UI.hideTip();
    }
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.run) saveRun(UI.run); });
  addEventListener('pagehide', () => { if (UI.run) saveRun(UI.run); });
  // 筆の字を先に読み込んでおく
  if (document.fonts && document.fonts.load) {
    const glyphs = new Set('あかよろしみよの寿神並上極幻進化御守絵馬札光種短金銀朱藍漆重福祈大一二三四五六七八九十');
    D.KAMI.forEach(k => [...k.kj].forEach(ch => glyphs.add(ch)));
    D.OMA.forEach(o => [...o.kj].forEach(ch => glyphs.add(ch)));
    D.OPPS.forEach(o => glyphs.add(o.kj));
    D.BOSSES.forEach(o => glyphs.add(o.kj));
    D.DECKS.forEach(o => [...o.kj].forEach(ch => glyphs.add(ch)));
    D.ENGI.forEach(o => [...o.kj].forEach(ch => glyphs.add(ch)));
    D.UPGRADES.forEach(o => glyphs.add(o.kj));
    D.YAKU.forEach(y => [...y.name].forEach(ch => glyphs.add(ch)));
    const txt = [...glyphs].join('');
    Promise.all([
      document.fonts.load('40px "Yuji Syuku"', txt),
      document.fonts.load('800 20px "Shippori Mincho B1"', txt + '0123456789+×倍点両')
    ]).then(() => { ART.clearCache(); for (const s of UI.sprites.values()) s.key = ''; UI._embKey = null; if (UI.active) { UI.assignTargets(); UI.hud(); } if (!$('title').hidden) SC.title(); }).catch(() => { });
  }
  SC.title();
  requestAnimationFrame(frame);
  // ホーム画面のアプリとして入れたとき、オフラインでも起動できるように
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.top === window) navigator.serviceWorker.register('sw.js').catch(() => { });
  } catch (e) { /* 使えない環境では何もしない */ }
};
MAIN.boot();
