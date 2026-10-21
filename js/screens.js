'use strict';
/* 花暦 — screens: タイトル・デッキ選び・月のはじめ・勝負の結果・ご褒美・縁起物・茶屋・袋・山札選び・
   旅の結果・メニュー・役一覧・設定・図鑑・記録・実績・蔵・遊び方 */
const SC = { stack: [] };
const TEAHOUSE = ['', '松風庵', '梅香亭', '花見茶屋', '藤棚', '八橋屋', '牡丹亭', '萩の屋', '月見茶屋', '菊水', '紅葉屋', '柳屋', '桐壺'];

/* ---------------- 重ね画面の土台 ---------------- */
SC.open = function (o) {
  const layer = el('div', 'layer ' + (o.dim === false ? 'clear' : 'dim'));
  const panel = el('div', 'panel' + (o.wide ? ' wide' : ''));
  layer.appendChild(panel);
  $('ov').appendChild(layer);
  const ent = { layer, panel, onBack: o.onBack, closable: o.closable !== false, name: o.name };
  SC.stack.push(ent);
  if (o.build) o.build(panel, ent);
  UI.hideTip(); UI.coachHide();
  setTimeout(() => { const f = panel.querySelector('[data-focus]') || panel.querySelector('button:not([disabled]), .choice, .good.pick'); if (f && !UI.isTouch) f.focus({ preventScroll: true }); }, 30);
  return ent;
};
SC.close = function (ent) {
  ent = ent || SC.stack[SC.stack.length - 1];
  if (!ent) return;
  const i = SC.stack.indexOf(ent);
  if (i >= 0) SC.stack.splice(i, 1);
  ent.layer.remove();
  UI.hideTip();
};
SC.closeAll = function () { while (SC.stack.length) SC.close(); };
SC.top = () => SC.stack[SC.stack.length - 1];
SC.back = function () {
  if (UI.tipOpen) { UI.hideTip(); return true; }
  const t = SC.top();
  if (!t) return false;
  if (t.onBack) { t.onBack(); return true; }
  if (t.closable) { SC.close(t); SFX.page(); return true; }
  return true;
};
function btn(label, cls, fn, opt) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.onclick = ev => { ev.stopPropagation(); AU.init(); if (b.disabled) return; SFX.tap(); fn(ev); };
  if (opt && opt.focus) b.dataset.focus = '1';
  return b;
}
function cvEl(w, h) {
  const c = el('canvas');
  const d = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  return c;
}
const miniCard = (card, w) => { const c = cvEl(w, w * 1.6); ART.paintCard(c, card, c.width, c.height); return c; };
const miniFace = (fid, w) => miniCard({ u: 0, f: D.FACE_BY[fid].i, m: D.FACE_BY[fid].m, e: null, s: null }, w);
const miniKami = (def, w) => { const c = cvEl(w, w * 1.6); ART.paintKami(c, def, c.width, c.height); return c; };
const miniOma = (def, w) => { const c = cvEl(w, w * 1.4); ART.paintOma(c, def, c.width, c.height); return c; };
const miniPack = (t, w) => { const c = cvEl(w, w * 1.4); ART.paintPack(c, t, c.width, c.height); return c; };
const miniEmblem = (kj, col, w, opt) => { const c = cvEl(w, w); ART.paintEmblem(c, kj, col, c.width, c.height, opt); return c; };
function rarTag(r) { return '<span class="tagr" style="background:' + D.RARITY[r].col + '">' + D.RARITY[r].name + '</span>'; }
function itemArt(it, w) {
  if (it.t === 'kami') return miniKami(D.KAMI_BY[it.id], w);
  if (it.t === 'oma') return miniOma(D.OMA_BY[it.id], w);
  if (it.t === 'card') return miniCard(Object.assign({ u: 7 }, it.card), w);
  if (it.t === 'pack') return miniPack(it.id, w);
  return el('div');
}
function itemName(it) {
  if (it.t === 'kami') return D.KAMI_BY[it.id].name + ' ' + rarTag(D.KAMI_BY[it.id].rar);
  if (it.t === 'oma') return D.OMA_BY[it.id].name;
  if (it.t === 'card') return D.FACES[it.card.f].name;
  return '';
}
function itemDesc(it) {
  if (it.t === 'kami') {
    const def = D.KAMI_BY[it.id];
    let s = esc(fillDesc(def));
    const into = D.EVOS.filter(E => E.evo.indexOf(def.id) >= 0);
    if (into.length) s += '<div class="evo">' + into.map(E => E.evo.filter(id => id !== def.id).map(id => D.KAMI_BY[id].name).join('・') + 'と組むと進化').join('<br>') + '</div>';
    return s;
  }
  if (it.t === 'oma') return esc(D.OMA_BY[it.id].d);
  if (it.t === 'card') {
    const c = it.card, f = D.FACES[c.f];
    let s = D.KINDS[f.kind] + '・' + D.KANSUJI[c.m] + '月を山札に加える';
    if (c.e) s += '<br>' + D.ENH[c.e].name + ': ' + D.ENH[c.e].d;
    if (c.s) s += '<br>' + D.SEAL[c.s].name + ': ' + D.SEAL[c.s].d;
    return s;
  }
  return '';
}
/* 持ち物(神札とお守り)の小さな列。売る・使うができる */
function ownedRow(run, opt) {
  opt = opt || {};
  const wrap = el('div');
  const draw = () => {
    wrap.innerHTML = '';
    const row = el('div', 'mini-row');
    for (let i = 0; i < 5; i++) {
      const k = run.kami[i];
      if (!k) { const e = el('div', 'mini'); e.style.cssText = 'width:44px;height:70px;border:1.5px dashed rgba(90,70,50,0.3);border-radius:5px'; row.appendChild(e); continue; }
      const def = D.KAMI_BY[k.id];
      const m = el('div', 'mini');
      m.appendChild(miniKami(def, 44));
      if (def.cur) m.appendChild(el('div', 'st', esc(def.cur(k).replace(/^今 /, ''))));
      m.tabIndex = 0;
      m.onclick = () => UI.showTip(UI.kamiDescHTML(def, k), m, [{ label: '売る <small>+' + k.sell + '両</small>', fn: () => { sellKami(run, run.kami.indexOf(k)); SFX.coin(); UI.hideTip(); MAIN.afterAction(); UI.assignTargets(); draw(); if (opt.onChange) opt.onChange(); } }]);
      row.appendChild(m);
    }
    const sep = el('div'); sep.style.width = '6px'; row.appendChild(sep);
    for (let i = 0; i < omaMax(run); i++) {
      const o = run.oma[i];
      if (!o) { const e = el('div', 'mini'); e.style.cssText = 'width:36px;height:50px;border:1.5px dashed rgba(200,64,42,0.3);border-radius:8px'; row.appendChild(e); continue; }
      const def = D.OMA_BY[o.id];
      const m = el('div', 'mini');
      m.appendChild(miniOma(def, 36));
      m.tabIndex = 0;
      m.onclick = () => UI.showTip('<div class="tn">' + esc(def.name) + '</div><div class="td">' + esc(def.d) + '</div>', m, [
        { label: '使う', cls: 'red', disabled: !!def.inRound, fn: () => { UI.useOma(run.oma.indexOf(o)); setTimeout(() => { draw(); if (opt.onChange) opt.onChange(); }, 50); } },
        { label: '売る <small>+1両</small>', fn: () => { sellOma(run, run.oma.indexOf(o)); SFX.coin(); UI.hideTip(); MAIN.afterAction(); UI.assignTargets(); draw(); if (opt.onChange) opt.onChange(); } }]);
      row.appendChild(m);
    }
    wrap.appendChild(row);
  };
  draw();
  wrap.redraw = draw;
  return wrap;
}
function ryoBadge(run) { const b = el('div', 'ryo', run.ryo + '<small>両</small>'); b.style.boxShadow = 'none'; return b; }

/* ---------------- タイトル ---------------- */
SC.title = function () {
  UI.leaveRound();
  $('play').hidden = true;
  const t = $('title');
  t.hidden = false;
  t.innerHTML = '';
  AU.setMood('title');
  FX.setAmbient(1.4, 3);
  const logo = el('div', 'logo', '<h1>花暦</h1><div class="en">HANAGOYOMI</div><div class="tag">花札で役を作り、十二か月を乗り切る</div>');
  t.appendChild(logo);
  const menu = el('div', 'menu');
  const saved = loadRun();
  if (saved && !saved.over) {
    const b = el('button', 'mbtn primary', 'つづきから<small>' + esc(D.DECK_BY[saved.deckId].name) + '・' + D.STAKES[saved.stake].name + '・' + monthLabel(saved.month) + '</small>');
    b.onclick = () => { AU.init(); SFX.tap(); MAIN.resume(saved); };
    menu.appendChild(b);
  }
  const nb = el('button', 'mbtn' + (saved ? '' : ' primary'), '旅に出る<small>デッキと段位を選ぶ</small>');
  nb.onclick = () => { AU.init(); SFX.tap(); if (saved && !saved.over) SC.confirm('中断している旅は消えます。新しく始めますか?', () => SC.newRun()); else SC.newRun(); };
  menu.appendChild(nb);
  const dk = todayKey();
  const dd = SAVE.daily[dk];
  const daily = el('button', 'mbtn', '今日のデイリー<small>' + esc(MAIN.dailyInfo().label) + (dd ? '・最高 ' + monthLabel(dd.month) : '') + '</small>');
  daily.onclick = () => { AU.init(); SFX.tap(); MAIN.startDaily(); };
  menu.appendChild(daily);
  const grid = el('div', 'mgrid');
  [['蔵', () => SC.kura()], ['図鑑', () => SC.codex()], ['記録', () => SC.records()], ['実績', () => SC.achievements()], ['設定', () => SC.settings()], ['遊び方', () => SC.howto()]].forEach(([n, f]) => {
    const b = el('button', 'mbtn', n); b.onclick = () => { AU.init(); SFX.tap(); f(); }; grid.appendChild(b);
  });
  menu.appendChild(grid);
  t.appendChild(menu);
  const foot = el('div', 'tfoot', '<span class="kinpaku">' + SAVE.kinpaku + '</span><span>金箔</span>' + (STORAGE_OK ? '' : '<span style="color:#c8402a">この環境では記録を保存できません</span>'));
  t.appendChild(foot);
  setTimeout(() => { const f = t.querySelector('.mbtn'); if (f && !UI.isTouch) f.focus({ preventScroll: true }); }, 50);
};

/* ---------------- 旅の支度(デッキと段位) ---------------- */
SC.newRun = function () {
  let deck = SAVE.decks[SAVE.last.deck] ? SAVE.last.deck : 'hana';
  let stake = Math.min(SAVE.last.stake || 1, SAVE.stakeMax);
  SC.open({ name: 'newrun', wide: true, build(p, ent) {
    const draw = () => {
      p.innerHTML = '';
      p.appendChild(el('h2', '', '旅の支度'));
      p.appendChild(el('p', 'sub', '開始デッキで決まりが変わる。金箔で新しいデッキを解放できる(蔵)。'));
      const g = el('div', 'decks');
      D.DECKS.forEach(d => {
        const own = !!SAVE.decks[d.id];
        const c = el('div', 'deck' + (own ? '' : ' lock') + (deck === d.id ? ' on' : ''));
        c.tabIndex = 0;
        c.appendChild(miniEmblem(d.kj, d.col, 46));
        c.appendChild(el('div', 'dn', esc(d.name)));
        c.appendChild(el('div', 'dd', esc(d.d)));
        const best = SAVE.deckClear[d.id];
        c.appendChild(el('div', 'stk', own ? (best ? D.STAKES[best].name + 'まで制覇' : '') : '金箔 ' + d.unlock.cost + 'で解放'));
        c.onclick = () => {
          if (!own) {
            if (SAVE.kinpaku >= d.unlock.cost) SC.confirm('金箔 ' + d.unlock.cost + ' で「' + d.name + '」を解放しますか?', () => { SAVE.kinpaku -= d.unlock.cost; SAVE.decks[d.id] = 1; saveGame(); SFX.buy(); deck = d.id; draw(); });
            else { SFX.error(); UI.toast('金箔が足りません(' + SAVE.kinpaku + ' / ' + d.unlock.cost + ')'); }
            return;
          }
          deck = d.id; SFX.select(2); draw();
        };
        g.appendChild(c);
      });
      p.appendChild(g);
      p.appendChild(el('h3', '', '段位'));
      const st = el('div', 'stakes');
      for (let n = 1; n <= 8; n++) {
        const b = el('button', n === stake ? 'on' : '', D.STAKES[n].name.replace('段', ''));
        b.disabled = n > SAVE.stakeMax;
        b.onclick = () => { stake = n; SFX.select(n); draw(); };
        st.appendChild(b);
      }
      p.appendChild(st);
      let sd = '';
      for (let n = 2; n <= stake; n++) sd += (sd ? '・' : '') + D.STAKES[n].d;
      p.appendChild(el('p', 'note', esc(D.STAKES[stake].name) + ': ' + (stake === 1 ? '標準の難しさ' : esc(sd)) + '<br>1年を乗り切ると次の段位が開く。'));
      const a = el('div', 'actions');
      a.appendChild(btn('もどる', '', () => SC.close(ent)));
      a.appendChild(btn('旅に出る', 'red', () => { SC.closeAll(); MAIN.startRun({ deck, stake }); }, { focus: 1 }));
      p.appendChild(a);
    };
    draw();
  } });
};

/* ---------------- 月のはじめ ---------------- */
SC.monthIntro = function (run) {
  UI.leaveRound();
  $('play').hidden = false; $('title').hidden = true;
  UI.active = true; UI.layout(); UI.hud();
  AU.setMood('play');
  const cm = curMonth(run);
  FX.setAmbient(1, cm);
  SC.open({ name: 'month', closable: false, onBack: () => SC.pause(), build(p, ent) {
    const M = D.MONTHS[cm];
    p.appendChild(el('div', 'month-big', (run.month > 12 ? '<span style="font-size:22px;font-family:var(--f-min)">' + D.KANSUJI[Math.ceil(run.month / 12)] + '年目 </span>' : '') + M.kan + '月'));
    p.appendChild(el('div', 'month-sub', M.name + '・' + M.flower + (run.daily ? '・デイリー' : '') + '  ' + D.DECK_BY[run.deckId].name + '・' + D.STAKES[run.stake].name));
    const list = el('div', 'list rounds');
    [0, 1, 2].forEach(r => {
      const li = el('div', 'li');
      if (r < 2) {
        const o = D.OPP_BY[run.opps[r]];
        li.appendChild(miniEmblem(o.kj, o.col, 40));
        li.appendChild(el('div', '', '<div class="nm">' + ['一', '二'][r] + 'の勝負 ・ ' + esc(o.name) + '</div><div class="ds">お題: ' + esc(D.ODAI[o.odai].d) + ' (+' + D.ODAI[o.odai].r + '両)</div>'));
      } else {
        const b = D.BOSS_BY[run.bossId];
        li.style.background = 'linear-gradient(90deg,#2a1d15,#3a2618)'; li.style.color = '#f4e6c4';
        li.appendChild(miniEmblem(b.kj, '#c99a2e', 40, { boss: 1 }));
        li.appendChild(el('div', '', '<div class="nm">主の勝負 ・ ' + esc(b.name) + '</div><div class="ds" style="color:#e8d0a0">' + esc(b.d) + '</div>'));
      }
      const tg = el('div', 'rt', '<span style="font-size:11px;font-weight:500">目標</span><br>' + fmt(run.targets[r]));
      if (r === run.round) li.style.boxShadow = '0 0 0 2px var(--shu)';
      li.appendChild(tg);
      list.appendChild(li);
    });
    p.appendChild(list);
    if (run.month === 1 && !run.daily) p.appendChild(el('p', 'note', '一・二の勝負に勝つと「ご褒美」を1つ。主に勝つと「縁起物」を選んで「茶屋」で買い物ができる。'));
    const a = el('div', 'actions');
    a.appendChild(btn('勝負を始める', 'red', () => { SC.close(ent); startRound(run); MAIN.afterAction(); UI.enterRound(); }, { focus: 1 }));
    p.appendChild(a);
  } });
};

/* ---------------- こいこい ---------------- */
SC.koikoi = function (run) {
  SC.open({ name: 'koikoi', closable: false, build(p, ent) {
    const rs = run.rs;
    p.appendChild(el('div', 'koi-q', '<div class="big">こいこい?</div>'));
    p.appendChild(el('p', 'sub', '目標(' + fmt(rs.target) + ')に届いた。続けると、目標の2倍(' + fmt(rs.target * 2) + ')に届けば勝負の報酬が2倍。届かなければ勝負の報酬はなし(勝ちのまま)。残りの出し: ' + rs.plays + '回'));
    const a = el('div', 'actions');
    a.appendChild(btn('勝負(ここで終える)', '', () => { SC.close(ent); koikoi(run, false); MAIN.afterAction(); MAIN.afterRoundEnd('win'); }, { focus: 1 }));
    a.appendChild(btn('こいこい!', 'red', () => { SC.close(ent); koikoi(run, true); MAIN.afterAction(); UI.hud(); UI.bigStamp('こいこい', '目標 ' + fmt(rs.target2), false); SFX.yaku(true); }));
    p.appendChild(a);
  } });
};

/* ---------------- 勝負の結果(報酬) ---------------- */
SC.roundResult = function (run) {
  UI.hideTip();
  const isBoss = run.round === 2;
  const pay = payout(run);
  MAIN.afterAction();
  SC.open({ name: 'result', closable: false, build(p, ent) {
    p.appendChild(el('h2', '', (isBoss ? '主を倒した' : '勝ち') + ' <span class="hanko" style="font-size:20px">勝</span>'));
    p.appendChild(el('p', 'sub', '得点 ' + fmt(run.rs.score) + ' / 目標 ' + fmt(run.rs.target)));
    const rows = [];
    pay.items.forEach(it => { const r = el('div', 'payrow', '<span>' + esc(it.label) + '</span><b>' + (it.r ? '+' + it.r + '両' : '') + '</b>'); p.appendChild(r); rows.push(r); });
    pay.gifts.forEach(g => { const r = el('div', 'payrow', '<span>' + (g.t === 'lv' ? '絵馬掛け: ' + D.YAKU_BY[g.id].name + ' Lv' + yakuLv(run, g.id) : 'お守り「' + D.OMA_BY[g.id].name + '」をもらった') + '</span><b></b>'); p.appendChild(r); rows.push(r); });
    const tot = el('div', 'paytotal', '<span>合計</span><span class="price">+' + pay.total + '両</span>');
    tot.style.opacity = '0';
    p.appendChild(tot);
    p.appendChild(el('p', 'note', '持ち金 ' + run.ryo + '両'));
    rows.forEach((r, i) => setTimeout(() => { r.classList.add('on'); SFX.coin(); }, 180 + i * 170));
    setTimeout(() => { tot.style.transition = 'opacity .3s'; tot.style.opacity = '1'; UI.tgt.ryo = run.ryo; }, 200 + rows.length * 170);
    const a = el('div', 'actions');
    a.appendChild(btn('次へ', 'red', () => { SC.close(ent); MAIN.advance(); }, { focus: 1 }));
    p.appendChild(a);
  } });
};

/* ---------------- ご褒美(3択) ---------------- */
SC.reward = function (run) {
  UI.active = true; $('play').hidden = false; UI.layout();
  SC.open({ name: 'reward', wide: true, closable: false, onBack: () => {}, build(p, ent) {
    const draw = () => {
      p.innerHTML = '';
      const head = el('div', 'row'); head.style.justifyContent = 'space-between';
      head.appendChild(el('h2', '', 'ご褒美 <span style="font-size:14px;font-family:var(--f-body);color:var(--mute)">ひとつ選ぶ</span>'));
      head.appendChild(ryoBadge(run));
      p.appendChild(head);
      const o = run.offers;
      const ch = el('div', 'choices');
      o.items.forEach((it, i) => {
        const c = el('div', 'choice');
        c.tabIndex = 0;
        c.appendChild(itemArt(it, 70));
        c.appendChild(el('div', 'gn', itemName(it)));
        c.appendChild(el('div', 'gd', itemDesc(it)));
        c.onclick = () => SC.takeOffer(run, it, targets => pickReward(run, i, targets), () => { SC.close(ent); nextRound(run); MAIN.afterAction(); MAIN.advance(); }, draw);
        if (it.t === 'kami' && run.banish > 0) {
          const bb = btn('除外', 'small', ev => { banishOffer(run, i); MAIN.afterAction(); draw(); });
          bb.classList.add('ban'); bb.title = 'この神札を今回の旅で出なくする';
          c.appendChild(bb);
        }
        ch.appendChild(c);
      });
      p.appendChild(ch);
      p.appendChild(el('h3', '', '持ち物'));
      p.appendChild(ownedRow(run, { onChange: draw }));
      const a = el('div', 'actions');
      const rr = btn('入れ替え <small>' + o.reroll + '両</small>', 'blue', () => { if (rerollReward(run)) { SFX.page(); MAIN.afterAction(); draw(); } else { SFX.error(); UI.toast('両が足りません'); } });
      rr.disabled = run.ryo < o.reroll;
      a.appendChild(rr);
      a.appendChild(btn('見送る <small>+' + D.ECON.skipReward + '両</small>', '', () => { skipReward(run); SFX.coin(); SC.close(ent); nextRound(run); MAIN.afterAction(); MAIN.advance(); }));
      p.appendChild(a);
      p.appendChild(el('p', 'note', '除外: 残り' + run.banish + '回(その神札を今回の旅で出なくする)。神札の枠がいっぱいなら、先に持ち物から売る。'));
    };
    draw();
  } });
};
/* 選んだ品を受け取る(加工のお守りなら札を選んでもらう) */
SC.takeOffer = function (run, it, take, done, redraw) {
  const finish = res => {
    if (res.err) { SFX.error(); UI.toast(res.err); return; }
    SFX.buy();
    MAIN.afterAction();
    if (it.t === 'oma') { const def = D.OMA_BY[it.id]; UI.toast('<b>' + def.name + '</b>' + (res.lv ? ' ' + D.EMA_GROUPS[res.lv].yaku.map(y => D.YAKU_BY[y].name + ' Lv' + yakuLv(run, y)).join('・') : ' を使った')); if (res.daikichi) UI.bigStamp('大吉', '幻の神札が来た', true); }
    if (it.t === 'card') UI.toast('山札に「' + D.FACES[it.card.f].name + '」を加えた');
    if (it.t === 'kami') UI.toast('神札「' + D.KAMI_BY[it.id].name + '」');
    UI.assignTargets();
    if (res.evolved && res.evolved.length) MAIN.showEvolve(res.evolved);
    done();
  };
  if (it.t === 'kami' && run.kami.length >= kamiMax(run)) { SFX.error(); UI.toast('神札の枠がいっぱい。持ち物から1つ売ると選べる'); return; }
  if (it.t === 'oma') {
    const needs = omaNeeds(it.id);
    if (needs) { const def = D.OMA_BY[it.id]; SC.deckPicker({ title: def.name, sub: def.d, n: needs.n, min: needs.min, onOk: us => finish(take(us)) }); return; }
    if (it.id === 'omikuji' && run.kami.length >= kamiMax(run)) { SFX.error(); UI.toast('神札の枠がいっぱいです'); return; }
  }
  finish(take([]));
};

/* ---------------- 縁起物(主のあと) ---------------- */
SC.engi = function (run) {
  UI.active = true; $('play').hidden = false; UI.layout();
  SC.open({ name: 'engi', wide: true, closable: false, onBack: () => {}, build(p, ent) {
    p.appendChild(el('h2', '', '縁起物 <span style="font-size:14px;font-family:var(--f-body);color:var(--mute)">主を倒した褒美。ひとつ選ぶ(旅のあいだずっと効く)</span>'));
    const ch = el('div', 'choices');
    run.offers.items.forEach((id, i) => {
      const e = D.ENGI_BY[id];
      const c = el('div', 'choice');
      c.tabIndex = 0;
      c.appendChild(miniEmblem(e.kj, '#b8361f', 64));
      c.appendChild(el('div', 'gn', esc(e.name)));
      c.appendChild(el('div', 'gd', esc(e.d) + ((run.engi[id] || 0) ? '<br><small>持っている: ' + run.engi[id] + '</small>' : '')));
      c.onclick = () => {
        const r = pickEngi(run, i);
        SFX.evolve();
        MAIN.afterAction();
        UI.toast('縁起物「<b>' + e.name + '</b>」');
        if (r.evolved && r.evolved.length) MAIN.showEvolve(r.evolved);
        UI.layout();
        SC.close(ent);
        MAIN.advance();
      };
      ch.appendChild(c);
    });
    p.appendChild(ch);
  } });
};

/* ---------------- 茶屋 ---------------- */
SC.shop = function (run) {
  UI.active = true; $('play').hidden = false;
  UI.field = []; UI.layout();
  AU.setMood('shop');
  FX.setAmbient(0.5, curMonth(run));
  if (run.pack) { SC.pack(run); return; }
  SC.open({ name: 'shop', wide: true, closable: false, onBack: () => SC.pause(), build(p, ent) {
    const draw = () => {
      const st = p.scrollTop;
      p.innerHTML = '';
      const s = run.shop;
      const head = el('div', 'row'); head.style.justifyContent = 'space-between';
      head.appendChild(el('h2', '', '茶屋「' + TEAHOUSE[curMonth(run)] + '」'));
      head.appendChild(ryoBadge(run));
      p.appendChild(head);
      p.appendChild(el('p', 'sub', '次は ' + monthLabel(run.month + 1) + '。神札は5枠まで。月末の利子は持ち金' + D.ECON.interestPer + '両につき1両。'));
      p.appendChild(el('h3', '', '持ち物'));
      p.appendChild(ownedRow(run, { onChange: draw }));
      // 品書き
      p.appendChild(el('h3', '', '品書き'));
      const g = el('div', 'goods');
      s.items.forEach((it, i) => {
        const c = el('div', 'good' + (it.sold ? ' sold' : ''));
        c.appendChild(itemArt(it, 54));
        const gi = el('div', 'gi');
        gi.appendChild(el('div', 'gn', itemName(it)));
        gi.appendChild(el('div', 'gd', itemDesc(it)));
        const gb = el('div', 'gb');
        if (it.sold) gb.appendChild(el('span', 'note', '売り切れ'));
        else {
          const b = btn('買う <small class="price">' + it.cost + '両</small>', 'red small', () => {
            const r = buyItem(run, i);
            if (r.err) { SFX.error(); UI.toast(r.err); return; }
            SFX.buy();
            MAIN.afterAction();
            UI.assignTargets();
            if (r.evolved && r.evolved.length) MAIN.showEvolve(r.evolved);
            draw();
          });
          b.disabled = run.ryo < it.cost;
          gb.appendChild(b);
        }
        gi.appendChild(gb);
        c.appendChild(gi);
        g.appendChild(c);
      });
      p.appendChild(g);
      // 袋
      p.appendChild(el('h3', '', '袋'));
      const g2 = el('div', 'goods');
      s.packs.forEach((pk, i) => {
        const P = D.PACKS[pk.t];
        const c = el('div', 'good' + (pk.sold ? ' sold' : ''));
        c.appendChild(miniPack(pk.t, 54));
        const gi = el('div', 'gi');
        gi.appendChild(el('div', 'gn', esc(P.name)));
        gi.appendChild(el('div', 'gd', esc(P.d)));
        const gb = el('div', 'gb');
        if (pk.sold) gb.appendChild(el('span', 'note', '開けた'));
        else {
          const b = btn('開ける <small class="price">' + pk.cost + '両</small>', 'red small', () => {
            const r = openPack(run, i);
            if (r.err) { SFX.error(); UI.toast(r.err); return; }
            SFX.page(); MAIN.afterAction();
            SC.close(ent); SC.pack(run);
          });
          b.disabled = run.ryo < pk.cost;
          gb.appendChild(b);
        }
        gi.appendChild(gb);
        c.appendChild(gi);
        g2.appendChild(c);
      });
      p.appendChild(g2);
      // 手入れ
      p.appendChild(el('h3', '', '札の手入れ'));
      const g3 = el('div', 'goods');
      const svc = (kind, name, desc, onPick) => {
        const cost = svcCost(run, kind);
        const c = el('div', 'good');
        const gi = el('div', 'gi');
        gi.appendChild(el('div', 'gn', name));
        gi.appendChild(el('div', 'gd', desc));
        const gb = el('div', 'gb');
        const b = btn('頼む <small class="price">' + cost + '両</small>', 'blue small', onPick);
        b.disabled = run.ryo < cost;
        gb.appendChild(b);
        gi.appendChild(gb);
        c.appendChild(gi);
        g3.appendChild(c);
      };
      svc('remove', '札を祓う', '山札から札を1枚取り除く(山札は20枚まで)', () => SC.deckPicker({ title: '札を祓う', sub: '取り除く札を1枚選ぶ', n: 1, onOk: us => { const r = service(run, 'remove', us[0]); if (r.err) { UI.toast(r.err); SFX.error(); } else { SFX.buy(); MAIN.afterAction(); } draw(); } }));
      svc('enhance', '札に' + D.ENH[s.enh].name, '札を1枚、' + D.ENH[s.enh].name + 'の札にする(' + D.ENH[s.enh].d + ')', () => SC.deckPicker({ title: D.ENH[s.enh].name + 'の札にする', sub: D.ENH[s.enh].d, n: 1, onOk: us => { const r = service(run, 'enhance', us[0]); if (r.err) { UI.toast(r.err); SFX.error(); } else { SFX.buy(); MAIN.afterAction(); } draw(); } }));
      svc('rewrite', '月の書き換え', '札を1枚選んで、好きな月にする(役の組み方が変わる)', () => SC.deckPicker({ title: '月の書き換え', sub: '書き換える札を1枚選ぶ', n: 1, onOk: us => SC.monthPicker(cardOf(run, us[0]), m => { const r = service(run, 'rewrite', us[0], m); if (r.err) { UI.toast(r.err); SFX.error(); } else { SFX.buy(); MAIN.afterAction(); } draw(); }) }));
      p.appendChild(g3);
      const a = el('div', 'actions');
      const rc = s.free > 0 ? 0 : s.reroll;
      const rr = btn('品書きを入れ替え <small>' + (rc ? rc + '両' : '無料') + '</small>', 'blue', () => { if (rerollShop(run)) { SFX.page(); MAIN.afterAction(); draw(); } else { SFX.error(); UI.toast('両が足りません'); } });
      rr.disabled = run.ryo < rc;
      a.appendChild(rr);
      a.appendChild(btn('山札を見る', '', () => SC.deckView()));
      a.appendChild(btn('出発する →', 'red', () => { SC.close(ent); nextMonth(run); MAIN.afterAction(); MAIN.advance(); }, { focus: 1 }));
      p.appendChild(a);
      p.scrollTop = st;
    };
    SC.onKamiChange = draw;
    draw();
  } });
};
/* 袋を開けたところ */
SC.pack = function (run) {
  SC.open({ name: 'pack', wide: true, closable: false, onBack: () => {}, build(p, ent) {
    const draw = () => {
      p.innerHTML = '';
      const pk = run.pack;
      p.appendChild(el('h2', '', esc(D.PACKS[pk.t].name) + ' <span style="font-size:14px;font-family:var(--f-body);color:var(--mute)">ひとつ選ぶ</span>'));
      const ch = el('div', 'choices');
      pk.items.forEach((it, i) => {
        const c = el('div', 'choice');
        c.tabIndex = 0;
        c.appendChild(itemArt(it, 66));
        c.appendChild(el('div', 'gn', itemName(it)));
        c.appendChild(el('div', 'gd', itemDesc(it)));
        c.onclick = () => SC.takeOffer(run, it, t => pickPack(run, i, t), () => { SC.close(ent); SC.shop(run); }, draw);
        ch.appendChild(c);
      });
      p.appendChild(ch);
      p.appendChild(el('h3', '', '持ち物'));
      p.appendChild(ownedRow(run, { onChange: draw }));
      const a = el('div', 'actions');
      a.appendChild(btn('見送る', '', () => { skipPack(run); MAIN.afterAction(); SC.close(ent); SC.shop(run); }));
      p.appendChild(a);
    };
    draw();
  } });
};
/* 山札から札を選ぶ */
SC.deckPicker = function (o) {
  const run = UI.run;
  const sel = [];
  SC.open({ name: 'picker', wide: true, build(p, ent) {
    p.appendChild(el('h2', '', esc(o.title)));
    p.appendChild(el('p', 'sub', esc(o.sub || '') + '(' + ((o.min || 1) < o.n ? (o.min || 1) + '〜' : '') + o.n + '枚)'));
    const g = el('div', 'deckgrid');
    const cards = run.cards.slice().sort((a, b) => a.m - b.m || KIND_ORD[faceOf(a).kind] - KIND_ORD[faceOf(b).kind] || a.f - b.f);
    const okB = btn('決定', 'red', () => { if (sel.length < (o.min || 1)) return; SC.close(ent); o.onOk(sel.slice()); });
    const upd = () => { okB.disabled = sel.length < (o.min || 1); okB.innerHTML = '決定 <small>' + sel.length + '/' + o.n + '</small>'; };
    cards.forEach(c => {
      const m = el('div', 'mini');
      m.appendChild(miniCard(c, 46));
      m.tabIndex = 0;
      m.onclick = () => {
        const i = sel.indexOf(c.u);
        if (i >= 0) { sel.splice(i, 1); m.classList.remove('sel'); SFX.deselect(); }
        else { if (sel.length >= o.n) { if (o.n === 1) { sel.length = 0; g.querySelectorAll('.mini.sel').forEach(e => e.classList.remove('sel')); } else { SFX.error(); return; } } sel.push(c.u); m.classList.add('sel'); SFX.select(sel.length); }
        upd();
      };
      m.oncontextmenu = ev => { ev.preventDefault(); UI.showTip(UI.cardDescHTML(c), m); };
      g.appendChild(m);
    });
    p.appendChild(g);
    p.appendChild(el('p', 'note', '山札 ' + run.cards.length + '枚。長押し・右クリックで札の説明。'));
    const a = el('div', 'actions');
    a.appendChild(btn('やめる', '', () => SC.close(ent)));
    a.appendChild(okB);
    upd();
    p.appendChild(a);
  } });
};
SC.monthPicker = function (card, onPick) {
  SC.open({ name: 'mpick', build(p, ent) {
    p.appendChild(el('h2', '', '何月にする?'));
    p.appendChild(el('p', 'sub', esc(D.FACES[card.f].name) + '(今は' + D.KANSUJI[card.m] + '月)'));
    const g = el('div', 'monthgrid');
    for (let m = 1; m <= 12; m++) {
      const b = btn(D.KANSUJI[m] + '月<br><small>' + D.MONTHS[m].flower + '</small>', 'small', () => { SC.close(ent); onPick(m); });
      b.style.flexDirection = 'column'; b.style.minHeight = '52px';
      b.disabled = m === card.m;
      g.appendChild(b);
    }
    p.appendChild(g);
    const a = el('div', 'actions');
    a.appendChild(btn('やめる', '', () => SC.close(ent)));
    p.appendChild(a);
  } });
};

/* ---------------- 旅の結果 ---------------- */
SC.runResult = function (run, kind, gained, news) {
  UI.leaveRound();
  AU.setMood('result');
  const clear = kind === 'clear';
  FX.setAmbient(clear ? 2 : 0.6, curMonth(run));
  SC.open({ name: 'runresult', wide: true, closable: false, onBack: () => {}, build(p, ent) {
    const st = run.stats;
    p.appendChild(el('div', 'month-big', clear ? '<span style="color:#b8861a">満開</span>' : run.endless ? '<span style="color:#b8861a">二年目の花</span>' : '<span style="color:#8a6a5a">花散る</span>'));
    const where = run.over ? monthLabel(run.month) + '・' + (run.round === 2 ? '主「' + D.BOSS_BY[run.bossId].name + '」' : ['一', '二'][run.round] + 'の勝負') : '十二か月を乗り切った';
    p.appendChild(el('div', 'month-sub', esc(where) + '  ' + D.DECK_BY[run.deckId].name + '・' + D.STAKES[run.stake].name + (run.daily ? '・デイリー' : '')));
    const g = el('div', 'grid2');
    const stat = (k, v) => g.appendChild(el('div', 'stat', '<span>' + k + '</span><b>' + v + '</b>'));
    stat('勝った勝負', st.wins + '回');
    stat('倒した主', st.bosses + '体');
    stat('総得点', fmt(st.total));
    stat('出した回数', st.plays + '回');
    stat('稼いだ両', st.ryoEarned + '両');
    stat('かかった時間', Math.round((st.time || 0) / 60) + '分');
    p.appendChild(g);
    if (st.bestPlay) {
      p.appendChild(el('h3', '', '最高の一手'));
      const li = el('div', 'li');
      const cs = el('div', 'mini-row');
      st.bestPlay.faces.forEach(f => cs.appendChild(miniCard({ u: 0, f, m: D.FACES[f].m }, 30)));
      li.appendChild(cs);
      li.appendChild(el('div', '', '<div class="nm">' + st.bestPlay.yaku.map(y => D.YAKU_BY[y].name).join('・') + '</div><div class="ds">' + monthLabel(st.bestPlay.month) + '</div>'));
      li.appendChild(el('div', 'rt', fmt(st.bestPlay.score) + '点'));
      p.appendChild(li);
    }
    const kc = Object.entries(st.kamiC).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (kc.length) {
      p.appendChild(el('h3', '', '神札の活躍(いなければ減っていた点数)'));
      const list = el('div', 'list barlist');
      const max = kc[0][1];
      kc.slice(0, 8).forEach(([id, v]) => {
        const def = D.KAMI_BY[id];
        const li = el('div', 'li');
        li.appendChild(el('div', 'fill')); li.lastChild.style.width = (v / max * 100) + '%';
        li.appendChild(miniKami(def, 22));
        li.appendChild(el('div', 'nm', esc(def.name)));
        li.appendChild(el('div', 'rt', '+' + fmt(v)));
        list.appendChild(li);
      });
      p.appendChild(list);
    }
    const yk = Object.entries(st.yaku).sort((a, b) => b[1] - a[1]);
    if (yk.length) {
      p.appendChild(el('h3', '', '作った役'));
      p.appendChild(el('p', 'sub', yk.map(([id, n]) => D.YAKU_BY[id].name + ' ' + n).join('・')));
    }
    p.appendChild(el('h3', '', '金箔'));
    p.appendChild(el('p', 'sub', '<span class="kinpaku">+' + gained + '</span>(勝負 ' + D.KINPAKU.win + '・主 ' + D.KINPAKU.boss + '・1年 ' + D.KINPAKU.clear + (run.stake > 1 ? '・段位で ×' + (1 + D.KINPAKU.stakeBonus * (run.stake - 1)).toFixed(2) : '') + ') → 所持 ' + SAVE.kinpaku));
    if (news && news.length) p.appendChild(el('p', 'note', news.map(esc).join('<br>')));
    const a = el('div', 'actions');
    if (clear) {
      a.appendChild(btn('二年目へ(エンドレス)', 'gold', () => { SC.close(ent); goEndless(run); MAIN.afterAction(); MAIN.advance(); }, { focus: 1 }));
      a.appendChild(btn('旅を終える', '', () => { clearRunSave(); SC.close(ent); SC.title(); }));
    } else {
      a.appendChild(btn('もう一度', 'red', () => { SC.close(ent); if (run.daily) MAIN.startDaily(); else MAIN.startRun({ deck: run.deckId, stake: run.stake }); }, { focus: 1 }));
      a.appendChild(btn('タイトルへ', '', () => { SC.close(ent); SC.title(); }));
    }
    p.appendChild(a);
    if (run.seed && !run.daily) p.appendChild(el('p', 'note', 'シード: ' + run.seed));
  } });
};

/* ---------------- メニュー ---------------- */
SC.pause = function () {
  if (SC.stack.some(s => s.name === 'pause')) return;
  SC.open({ name: 'pause', build(p, ent) {
    const run = UI.run;
    p.appendChild(el('h2', '', 'メニュー'));
    if (run) p.appendChild(el('p', 'sub', monthLabel(run.month) + '・' + D.DECK_BY[run.deckId].name + '・' + D.STAKES[run.stake].name + (run.daily ? '・デイリー' : '') + '<br>シード ' + esc(run.seed)));
    const m = el('div', 'menu'); m.style.maxWidth = 'none';
    const add = (label, fn, cls) => { const b = el('button', 'mbtn ' + (cls || ''), label); b.onclick = () => { SFX.tap(); fn(); }; m.appendChild(b); };
    add('つづける', () => SC.close(ent), 'primary');
    add('役一覧', () => SC.yakuList());
    if (run) add('山札を見る', () => SC.deckView());
    add('設定', () => SC.settings());
    add('遊び方', () => SC.howto());
    if (run) add('中断してタイトルへ<small>続きから再開できる</small>', () => { saveRun(run); SC.closeAll(); SC.title(); });
    if (run) add('この旅をあきらめる', () => SC.confirm('この旅を終わりにしますか?(結果は記録される)', () => { SC.closeAll(); run.over = true; run.phase = 'over'; MAIN.endRun('over'); }));
    p.appendChild(m);
  } });
};
SC.confirm = function (text, yes, no) {
  SC.open({ name: 'confirm', build(p, ent) {
    p.appendChild(el('p', '', esc(text)));
    const a = el('div', 'actions');
    a.appendChild(btn('いいえ', '', () => { SC.close(ent); if (no) no(); }, { focus: 1 }));
    a.appendChild(btn('はい', 'red', () => { SC.close(ent); yes(); }));
    p.appendChild(a);
  } });
};

/* ---------------- 役一覧 ---------------- */
SC.yakuList = function () {
  const run = UI.run;
  SC.open({ name: 'yaku', wide: true, build(p, ent) {
    p.appendChild(el('h2', '', '役一覧'));
    p.appendChild(el('p', 'sub', '1回に' + (run && run.rs ? run.rs.maxPlay : 5) + '枚まで出せる。できた役はすべて重ねて数える。<br>得点 =(役の点 + 札の点)×(役の倍)。札の点: 光20・タネ10・短冊5・カス1、旬(その月の札)+' + D.SHUN_TEN + '。神札で点と倍を伸ばす。'));
    const list = el('div', 'list');
    D.YAKU.forEach(Y => {
      const lv = run ? yakuLv(run, Y.id) : 1;
      const t = Y.ten + Y.lt * (lv - 1), b = Y.bai + Y.lb * (lv - 1);
      const r = el('div', 'yk');
      const made = run ? (run.stats.yaku[Y.id] || 0) : (SAVE.yaku[Y.id] || 0);
      r.appendChild(el('div', 'nm', esc(Y.name) + '<small>' + Y.yomi + ' ・ Lv' + lv + (made ? ' ・ ' + made + '回' : '') + '</small>'));
      r.appendChild(el('div', 'sc', '<span class="t">' + t + '</span> × <span class="b">' + b + '</span>'));
      r.appendChild(el('div', 'rq', esc(Y.req)));
      const ex = el('div', 'ex');
      (Y.ex || []).forEach(f => ex.appendChild(miniFace(f, 24)));
      r.appendChild(ex);
      list.appendChild(r);
    });
    p.appendChild(list);
    const a = el('div', 'actions');
    a.appendChild(btn('閉じる', '', () => SC.close(ent), { focus: 1 }));
    p.appendChild(a);
  } });
};
SC.deckView = function () {
  const run = UI.run;
  if (!run) return;
  SC.open({ name: 'deck', wide: true, build(p, ent) {
    const rs = run.rs;
    const used = new Set(rs && run.phase === 'round' ? rs.used.concat(rs.hand) : []);
    p.appendChild(el('h2', '', '山札 ' + run.cards.length + '枚'));
    p.appendChild(el('p', 'sub', run.phase === 'round' && rs ? '残り ' + rs.pile.length + '枚(薄い札は、この勝負で手札に来た札)' : '月ごとの並び'));
    for (let m = 1; m <= 12; m++) {
      const cs = run.cards.filter(c => c.m === m);
      if (!cs.length) continue;
      const row = el('div', 'row');
      row.style.marginBottom = '6px';
      row.appendChild(el('div', '', '<b style="font-family:var(--f-min);display:inline-block;width:3.2em">' + D.KANSUJI[m] + '月</b>'));
      cs.sort((a, b) => KIND_ORD[faceOf(a).kind] - KIND_ORD[faceOf(b).kind]).forEach(c => {
        const mm = el('div', 'mini' + (used.has(c.u) ? ' dim' : ''));
        mm.appendChild(miniCard(c, 34));
        mm.onclick = () => UI.showTip(UI.cardDescHTML(c), mm);
        row.appendChild(mm);
      });
      p.appendChild(row);
    }
    const a = el('div', 'actions');
    a.appendChild(btn('閉じる', '', () => SC.close(ent), { focus: 1 }));
    p.appendChild(a);
  } });
};

/* ---------------- 設定 ---------------- */
SC.settings = function () {
  SC.open({ name: 'settings', build(p, ent) {
    const S = SAVE.set;
    p.appendChild(el('h2', '', '設定'));
    const slider = (label, key, fmtv) => {
      const r = el('div', 'set-row');
      r.appendChild(el('span', '', label));
      const inp = el('input'); inp.type = 'range'; inp.min = 0; inp.max = 100; inp.value = Math.round(S[key] * 100);
      const v = el('span', 'v', fmtv(S[key]));
      inp.oninput = () => { S[key] = inp.value / 100; v.textContent = fmtv(S[key]); AU.applyVol(); saveGame(); };
      inp.onchange = () => { if (key === 'sfx' || key === 'master') SFX.bai(4); };
      r.appendChild(inp); r.appendChild(v);
      p.appendChild(r);
    };
    const pct = x => Math.round(x * 100) + '%';
    slider('全体の音量', 'master', pct);
    slider('BGM', 'bgm', pct);
    slider('効果音', 'sfx', pct);
    slider('画面の揺れ', 'shake', pct);
    slider('フラッシュの強さ', 'flash', pct);
    const seg = (label, key, opts, after) => {
      const r = el('div', 'set-row');
      r.appendChild(el('span', '', label));
      const s = el('div', 'seg');
      opts.forEach(([val, name]) => { const b = el('button', S[key] === val ? 'on' : '', name); b.onclick = () => { S[key] = val; saveGame(); s.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); SFX.tap(); if (after) after(); }; s.appendChild(b); });
      r.appendChild(s); r.appendChild(el('span'));
      p.appendChild(r);
    };
    seg('画質', 'quality', [[0, '低'], [1, '中'], [2, '高']], () => { MAIN.onResize(true); });
    seg('演出の速さ', 'speed', [[0, 'ふつう'], [1, 'はやい'], [2, 'とても速い']]);
    seg('操作ガイド', 'guide', [[true, '表示する'], [false, '表示しない']]);
    const a = el('div', 'actions');
    a.appendChild(btn('ガイドを最初から', 'small', () => { SAVE.tut = {}; SAVE.set.guide = true; saveGame(); UI.toast('次の勝負で操作ガイドを出します'); }));
    a.appendChild(btn('記録をすべて消す', 'small', () => SC.confirm('金箔・解放・記録・中断中の旅をすべて消しますか?', () => { const keep = SAVE.set; SAVE = defaultSave(); SAVE.set = keep; saveGame(); clearRunSave(); SC.closeAll(); SC.title(); UI.toast('記録を消しました'); })));
    p.appendChild(a);
    const a2 = el('div', 'actions');
    a2.appendChild(btn('閉じる', 'red', () => SC.close(ent), { focus: 1 }));
    p.appendChild(a2);
    p.appendChild(el('p', 'note', '操作: クリック/タップで札を選ぶ・ドラッグで並べ替え・長押しで説明。キーボード ←→ 移動 / Space 選ぶ / Enter 出す / X 捨てる / S 並べ替え / Q・E 札を動かす / Y 役一覧 / 1〜5 神札 / Esc メニュー。ゲームパッド: 十字 移動・A 選ぶ・Y 出す・X 捨てる・LB/RB 札を動かす・START メニュー。'));
  } });
};

/* ---------------- 図鑑 ---------------- */
function kamiUnlocked(id) { const u = D.KAMI_UNLOCK[id]; return !u || !!SAVE.unlockSeen[id] || u.t(SAVE); }
SC.codex = function () {
  let tab = 'kami';
  SC.open({ name: 'codex', wide: true, build(p, ent) {
    const draw = () => {
      p.innerHTML = '';
      p.appendChild(el('h2', '', '図鑑'));
      const tabs = el('div', 'tabs');
      [['kami', '神札'], ['oma', 'お守り'], ['yaku', '役'], ['opp', '相手'], ['boss', '主']].forEach(([k, n]) => { const b = el('button', tab === k ? 'on' : '', n); b.onclick = () => { tab = k; SFX.page(); draw(); }; tabs.appendChild(b); });
      p.appendChild(tabs);
      if (tab === 'kami') {
        const found = Object.keys(SAVE.dex).length;
        p.appendChild(el('p', 'sub', '見つけた神札 ' + found + ' / ' + D.KAMI.length + '。鍵のついた神札は、条件を満たすと茶屋やご褒美に出るようになる。'));
        const g = el('div', 'deckgrid'); g.style.gridTemplateColumns = 'repeat(auto-fill, minmax(52px, 1fr))';
        D.KAMI.forEach(def => {
          const seen = !!SAVE.dex[def.id];
          const unl = kamiUnlocked(def.id);
          const m = el('div', 'mini' + (seen ? '' : ' dim'));
          m.appendChild(miniKami(def, 50));
          if (!unl) m.appendChild(el('div', 'st', '鍵'));
          m.onclick = () => {
            let h = UI.kamiDescHTML(def);
            if (!unl) h += '<div class="tc" style="color:#c8402a">解放: ' + esc(D.KAMI_UNLOCK[def.id].d) + '</div>';
            if (def.rar === 4) h += '<div class="note">おみくじの「大吉」でだけ手に入る</div>';
            if (!seen) h += '<div class="note">まだ手に入れていない</div>';
            UI.showTip(h, m);
          };
          g.appendChild(m);
        });
        p.appendChild(g);
      } else if (tab === 'oma') {
        const list = el('div', 'list');
        D.OMA.forEach(o => { const li = el('div', 'li' + (SAVE.omaDex[o.id] ? '' : ' off')); li.appendChild(miniOma(o, 30)); li.appendChild(el('div', '', '<div class="nm">' + esc(o.name) + '</div><div class="ds">' + esc(o.d) + '</div>')); list.appendChild(li); });
        p.appendChild(list);
      } else if (tab === 'yaku') {
        const list = el('div', 'list');
        D.YAKU.forEach(Y => { const li = el('div', 'li' + (SAVE.yaku[Y.id] ? '' : ' off')); li.appendChild(el('div', '', '<div class="nm">' + esc(Y.name) + ' <small>' + Y.yomi + '</small></div><div class="ds">' + esc(Y.req) + ' ・ ' + Y.ten + '×' + Y.bai + '</div>')); li.appendChild(el('div', 'rt', (SAVE.yaku[Y.id] || 0) + '回')); list.appendChild(li); });
        p.appendChild(list);
      } else if (tab === 'opp') {
        const list = el('div', 'list');
        D.OPPS.forEach(o => { const li = el('div', 'li'); li.appendChild(miniEmblem(o.kj, o.col, 36)); li.appendChild(el('div', '', '<div class="nm">' + esc(o.name) + '</div><div class="ds">「' + esc(o.line) + '」 お題: ' + esc(D.ODAI[o.odai].d) + '</div>')); list.appendChild(li); });
        p.appendChild(list);
      } else {
        const list = el('div', 'list');
        D.BOSSES.forEach(b => { const n = SAVE.bossKill[b.id] || 0; const li = el('div', 'li' + (n ? ' done' : '')); li.appendChild(miniEmblem(b.kj, '#c99a2e', 36, { boss: 1 })); li.appendChild(el('div', '', '<div class="nm">' + esc(b.name) + (b.m ? ' <small>' + D.KANSUJI[b.m] + '月の主</small>' : '') + '</div><div class="ds">' + esc(b.d) + '</div>')); li.appendChild(el('div', 'rt', n ? n + '勝' : '')); list.appendChild(li); });
        p.appendChild(list);
      }
      const a = el('div', 'actions');
      a.appendChild(btn('閉じる', '', () => SC.close(ent), { focus: 1 }));
      p.appendChild(a);
    };
    draw();
  } });
};

/* ---------------- 記録・実績 ---------------- */
SC.records = function () {
  SC.open({ name: 'records', wide: true, build(p, ent) {
    const S = SAVE, st = S.stats, b = S.best;
    p.appendChild(el('h2', '', '記録'));
    p.appendChild(el('h3', '', 'ベスト'));
    const g = el('div', 'grid2');
    const stat = (k, v) => g.appendChild(el('div', 'stat', '<span>' + k + '</span><b>' + v + '</b>'));
    stat('いちばん進んだ月', b.month ? (b.month > 12 ? monthLabel(Math.min(b.month, 99)) : b.month >= 13 ? '一年 満了' : monthLabel(b.month)) : '—');
    stat('1回の出しの最高', fmt(b.play) + '点');
    stat('旅の総得点の最高', fmt(b.total) + '点');
    stat('一度に持った両', b.ryo + '両');
    stat('制覇した最高段位', b.stake ? D.STAKES[b.stake].name : '—');
    stat('エンドレスの最高', b.endless ? monthLabel(b.endless) : '—');
    stat('1年の最短', b.clearTime ? Math.round(b.clearTime / 60) + '分' : '—');
    p.appendChild(g);
    p.appendChild(el('h3', '', '累計'));
    const g2 = el('div', 'grid2');
    const stat2 = (k, v) => g2.appendChild(el('div', 'stat', '<span>' + k + '</span><b>' + v + '</b>'));
    stat2('旅に出た回数', st.runs + '回');
    stat2('1年を乗り切った', st.clears + '回');
    stat2('勝った勝負', st.wins + '回');
    stat2('倒した主', st.bosses + '体');
    stat2('出した回数', st.plays + '回');
    stat2('捨てた回数', st.discards + '回');
    stat2('稼いだ両', st.ryoEarned + '両');
    stat2('稼いだ金箔', S.kinpakuTotal);
    stat2('遊んだ時間', Math.round(st.playTime / 60) + '分');
    stat2('進化させた', st.evolve + '回');
    p.appendChild(g2);
    p.appendChild(el('h3', '', 'デッキごとの制覇'));
    const list = el('div', 'list');
    D.DECKS.forEach(d => { const li = el('div', 'li' + (SAVE.decks[d.id] ? '' : ' off')); li.appendChild(miniEmblem(d.kj, d.col, 28)); li.appendChild(el('div', 'nm', esc(d.name))); li.appendChild(el('div', 'rt', S.deckClear[d.id] ? D.STAKES[S.deckClear[d.id]].name : '—')); list.appendChild(li); });
    p.appendChild(list);
    const days = Object.keys(S.daily).sort().reverse().slice(0, 7);
    if (days.length) {
      p.appendChild(el('h3', '', 'デイリー'));
      const l2 = el('div', 'list');
      days.forEach(k => { const d = S.daily[k]; l2.appendChild(el('div', 'li', '<div class="nm">' + k + '</div><div class="rt">' + monthLabel(d.month) + ' ・ ' + fmt(d.total) + '点</div>')); });
      p.appendChild(l2);
    }
    const a = el('div', 'actions');
    a.appendChild(btn('閉じる', '', () => SC.close(ent), { focus: 1 }));
    p.appendChild(a);
  } });
};
SC.achievements = function () {
  SC.open({ name: 'ach', wide: true, build(p, ent) {
    const n = Object.keys(SAVE.ach).length;
    p.appendChild(el('h2', '', '実績 ' + n + ' / ' + D.ACH.length));
    p.appendChild(el('p', 'sub', '達成すると金箔がもらえる。'));
    const list = el('div', 'list');
    D.ACH.forEach(a => { const done = !!SAVE.ach[a.id]; const li = el('div', 'li' + (done ? ' done' : '')); li.appendChild(el('div', '', '<div class="nm">' + (done ? '✔ ' : '') + esc(a.name) + '</div><div class="ds">' + esc(a.d) + '</div>')); li.appendChild(el('div', 'rt', '<span class="kinpaku">' + a.g + '</span>')); list.appendChild(li); });
    p.appendChild(list);
    const ac = el('div', 'actions');
    ac.appendChild(btn('閉じる', '', () => SC.close(ent), { focus: 1 }));
    p.appendChild(ac);
  } });
};

/* ---------------- 蔵(永久強化) ---------------- */
SC.kura = function () {
  SC.open({ name: 'kura', wide: true, build(p, ent) {
    const draw = () => {
      p.innerHTML = '';
      const head = el('div', 'row'); head.style.justifyContent = 'space-between';
      head.appendChild(el('h2', '', '蔵'));
      head.appendChild(el('div', 'kinpaku', SAVE.kinpaku + ' 金箔'));
      p.appendChild(head);
      p.appendChild(el('p', 'sub', '旅で集めた金箔で、ずっと効く強化とデッキを手に入れる。(デイリーでは蔵の強化は効かない)'));
      p.appendChild(el('h3', '', '永久強化'));
      const list = el('div', 'list');
      D.UPGRADES.forEach(u => {
        const lv = SAVE.upg[u.id] || 0;
        const li = el('div', 'li' + (lv >= u.max ? ' done' : ''));
        li.appendChild(miniEmblem(u.kj, '#8a6418', 34));
        li.appendChild(el('div', '', '<div class="nm">' + esc(u.name) + ' <small style="font-family:var(--f-body);color:var(--mute)">' + lv + '/' + u.max + '</small></div><div class="ds">' + esc(u.d) + '</div>'));
        const rt = el('div', 'rt');
        if (lv < u.max) {
          const cost = u.cost[lv];
          const b = btn('<span class="kinpaku">' + cost + '</span>', 'small', () => { if (SAVE.kinpaku < cost) { SFX.error(); return; } SAVE.kinpaku -= cost; SAVE.upg[u.id] = lv + 1; saveGame(); SFX.buy(); draw(); });
          b.disabled = SAVE.kinpaku < cost;
          rt.appendChild(b);
        } else rt.textContent = '済';
        li.appendChild(rt);
        list.appendChild(li);
      });
      p.appendChild(list);
      p.appendChild(el('h3', '', 'デッキ'));
      const l2 = el('div', 'list');
      D.DECKS.forEach(d => {
        const own = !!SAVE.decks[d.id];
        const li = el('div', 'li' + (own ? ' done' : ''));
        li.appendChild(miniEmblem(d.kj, d.col, 34));
        li.appendChild(el('div', '', '<div class="nm">' + esc(d.name) + '</div><div class="ds">' + esc(d.d) + '</div>'));
        const rt = el('div', 'rt');
        if (!own) { const b = btn('<span class="kinpaku">' + d.unlock.cost + '</span>', 'small', () => { if (SAVE.kinpaku < d.unlock.cost) return; SAVE.kinpaku -= d.unlock.cost; SAVE.decks[d.id] = 1; saveGame(); SFX.buy(); draw(); }); b.disabled = SAVE.kinpaku < d.unlock.cost; rt.appendChild(b); }
        else rt.textContent = '済';
        li.appendChild(rt);
        l2.appendChild(li);
      });
      p.appendChild(l2);
      const a = el('div', 'actions');
      a.appendChild(btn('閉じる', '', () => { SC.close(ent); if (!UI.run || !UI.active) SC.title(); }, { focus: 1 }));
      p.appendChild(a);
    };
    draw();
  } });
};

/* ---------------- 遊び方 ---------------- */
SC.howto = function () {
  SC.open({ name: 'howto', wide: true, build(p, ent) {
    p.appendChild(el('h2', '', '遊び方'));
    const sec = (t, h) => { p.appendChild(el('h3', '', t)); p.appendChild(el('p', '', h)); };
    sec('流れ', '48枚の花札の山から手札8枚。札を最大5枚選んで「出す」と、できた役の点数がスコアになる。出しと捨ての回数には限りがあり、目標の点に届けば勝ち。<br>1か月は3勝負(一・二・主)。十二か月を乗り切れば1年クリア。そのあとはエンドレス(二年目)にも進める。');
    sec('点の数え方', '得点 =(役の点 + 札の点)×(役の倍)。<br>できた役は<b>すべて重ねて</b>数える(例: 赤短+タン+花暦)。数えるのは役になった札だけ。<br>札の点: 光20・タネ10・短冊5・カス1。その月の札(<b>旬</b>)は +' + D.SHUN_TEN + '点。');
    sec('神札', '持っているだけで効く札(5枠)。左から順に効くので、+倍の神札を先に、×倍の神札を後ろに並べると伸びる。特定の神札の組み合わせは<b>進化</b>して上位版になる。売ると両が戻る。');
    sec('お守り・茶屋', 'お守りは使い切り。絵馬は役の等級(Lv)を上げる。加工のお守りは札を強化・印つき・月替えにする。<br>主を倒すと「縁起物」(旅の間ずっと効く)を選び、「茶屋」で神札・お守り・袋を買える。札を祓う(削除)・強化・月の書き換えもできる。持ち金5両ごとに月末の利子1両。');
    sec('相手と主', '一・二の勝負の相手は「お題」を出す。達成すると両がもらえる。<br>主は特別な決まりで邪魔をしてくる(短冊が封じられる、5枚出し必須など)。');
    sec('周回', '旅の終わりに金箔がたまる。「蔵」で永久強化と新しいデッキを手に入れよう。1年を乗り切ると次の段位(難易度)が開く。実績でも金箔がもらえる。デイリーは日替わりで全員同じ展開。');
    sec('操作', 'タップ/クリック: 札を選ぶ ・ ドラッグ: 並べ替え ・ 長押し/マウスを乗せる: 説明。<br>キーボード: ←→ 移動 / Space 選ぶ / Enter 出す / X 捨てる / S 月順・種類順 / Q・E 札を動かす / Y 役一覧 / 1〜5 神札 / 6〜9 お守り / Esc メニュー。<br>ゲームパッド: 十字 移動 / A 選ぶ / Y 出す / X 捨てる / B 選択解除 / LB・RB 札を動かす / START メニュー / BACK 役一覧。');
    const a = el('div', 'actions');
    a.appendChild(btn('役一覧を見る', '', () => SC.yakuList()));
    a.appendChild(btn('閉じる', 'red', () => SC.close(ent), { focus: 1 }));
    p.appendChild(a);
  } });
};
