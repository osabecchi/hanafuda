'use strict';
/* 花暦 HANAGOYOMI — data
   札・役・神札・お守り・相手・主・デッキ・段位・実績・数値は、すべてここで調整する。
   神札などの効果関数は rules.js の得点計算(x = 計算中の文脈)から呼ばれる。 */
const D = {};

/* ---------------- 月 ---------------- */
D.MONTHS = [null,
  { n: 1, name: '睦月', flower: '松', kan: '一', col: '#2f5d3a' },
  { n: 2, name: '如月', flower: '梅', kan: '二', col: '#b8324a' },
  { n: 3, name: '弥生', flower: '桜', kan: '三', col: '#d97f97' },
  { n: 4, name: '卯月', flower: '藤', kan: '四', col: '#7b5ea7' },
  { n: 5, name: '皐月', flower: '菖蒲', kan: '五', col: '#3d4f9a' },
  { n: 6, name: '水無月', flower: '牡丹', kan: '六', col: '#c23a5b' },
  { n: 7, name: '文月', flower: '萩', kan: '七', col: '#a63f6b' },
  { n: 8, name: '葉月', flower: '芒', kan: '八', col: '#a8823a' },
  { n: 9, name: '長月', flower: '菊', kan: '九', col: '#c9971c' },
  { n: 10, name: '神無月', flower: '紅葉', kan: '十', col: '#c8402a' },
  { n: 11, name: '霜月', flower: '柳', kan: '十一', col: '#4f7a4a' },
  { n: 12, name: '師走', flower: '桐', kan: '十二', col: '#6b4c8a' }
];
D.KANSUJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/* ---------------- 札(48枚) ---------------- */
D.KINDS = { hikari: '光', tane: 'タネ', tan: '短冊', kasu: 'カス' };
D.CARD_TEN = { hikari: 20, tane: 10, tan: 5, kasu: 1 };   // 札の点(花合わせの点数)
D.SHUN_TEN = 10;                                          // 旬(その月の札)の上乗せ
D.FACES = [
  ['tsuru', 1, 'hikari', '松に鶴'], ['akatan1', 1, 'tan', '松に赤短'], ['matsu1', 1, 'kasu'], ['matsu2', 1, 'kasu'],
  ['uguisu', 2, 'tane', '梅に鶯'], ['akatan2', 2, 'tan', '梅に赤短'], ['ume1', 2, 'kasu'], ['ume2', 2, 'kasu'],
  ['maku', 3, 'hikari', '桜に幕'], ['akatan3', 3, 'tan', '桜に赤短'], ['sakura1', 3, 'kasu'], ['sakura2', 3, 'kasu'],
  ['hototogisu', 4, 'tane', '藤に不如帰'], ['kusa1', 4, 'tan', '藤に短冊'], ['fuji1', 4, 'kasu'], ['fuji2', 4, 'kasu'],
  ['yatsuhashi', 5, 'tane', '菖蒲に八橋'], ['kusa2', 5, 'tan', '菖蒲に短冊'], ['ayame1', 5, 'kasu'], ['ayame2', 5, 'kasu'],
  ['cho', 6, 'tane', '牡丹に蝶'], ['aotan1', 6, 'tan', '牡丹に青短'], ['botan1', 6, 'kasu'], ['botan2', 6, 'kasu'],
  ['inoshishi', 7, 'tane', '萩に猪'], ['kusa3', 7, 'tan', '萩に短冊'], ['hagi1', 7, 'kasu'], ['hagi2', 7, 'kasu'],
  ['tsuki', 8, 'hikari', '芒に月'], ['kari', 8, 'tane', '芒に雁'], ['susuki1', 8, 'kasu'], ['susuki2', 8, 'kasu'],
  ['sakazuki', 9, 'tane', '菊に盃'], ['aotan2', 9, 'tan', '菊に青短'], ['kiku1', 9, 'kasu'], ['kiku2', 9, 'kasu'],
  ['shika', 10, 'tane', '紅葉に鹿'], ['aotan3', 10, 'tan', '紅葉に青短'], ['momiji1', 10, 'kasu'], ['momiji2', 10, 'kasu'],
  ['ame', 11, 'hikari', '柳に小野道風'], ['tsubame', 11, 'tane', '柳に燕'], ['yanagitan', 11, 'tan', '柳に短冊'], ['kaminari', 11, 'kasu', '柳に雷'],
  ['houou', 12, 'hikari', '桐に鳳凰'], ['kiri1', 12, 'kasu'], ['kiri2', 12, 'kasu'], ['kiri3', 12, 'kasu', '桐の色札']
].map(([id, m, kind, name], i) => ({ i, id, m, kind, name: name || D.MONTHS[m].flower + 'のカス' }));
D.FACE_BY = {};
D.FACES.forEach(f => { D.FACE_BY[f.id] = f; });
const faceOf = c => D.FACES[c.f];
D.BRIGHTS = ['tsuru', 'maku', 'tsuki', 'ame', 'houou'];
D.KASU2 = 'kiri3';   // 桐の色札はカス2枚分に数える
D.FACE_NOTE = { kiri3: 'カス2枚分に数える', ame: '光札だが、三光・四光には入らない(雨四光になる)', sakazuki: '月見酒・花見酒に使う' };

/* ---------------- 役 ----------------
   ten/bai = 役の点と倍、lt/lb = 等級が1上がるごとの上乗せ。成立した役はすべて重ねて数える */
D.YAKU = [
  { id: 'goko', name: '五光', yomi: 'ごこう', ten: 200, bai: 20, lt: 40, lb: 4, req: '光札5枚', ex: ['tsuru', 'maku', 'tsuki', 'ame', 'houou'] },
  { id: 'shiko', name: '四光', yomi: 'しこう', ten: 100, bai: 10, lt: 30, lb: 3, req: '柳以外の光札4枚', ex: ['tsuru', 'maku', 'tsuki', 'houou'] },
  { id: 'ameshiko', name: '雨四光', yomi: 'あめしこう', ten: 80, bai: 8, lt: 30, lb: 3, req: '柳に小野道風を含む光札4枚', ex: ['tsuru', 'maku', 'tsuki', 'ame'] },
  { id: 'sanko', name: '三光', yomi: 'さんこう', ten: 50, bai: 5, lt: 25, lb: 2, req: '柳以外の光札3枚', ex: ['tsuru', 'maku', 'tsuki'] },
  { id: 'akaao', name: '赤青短', yomi: 'あかあおたん', ten: 120, bai: 12, lt: 30, lb: 3, req: '赤短と青短を同時に(6枚出しが要る)', ex: ['akatan1', 'akatan2', 'akatan3', 'aotan1', 'aotan2', 'aotan3'] },
  { id: 'inoshikacho', name: '猪鹿蝶', yomi: 'いのしかちょう', ten: 60, bai: 6, lt: 25, lb: 2, req: '萩に猪・紅葉に鹿・牡丹に蝶', ex: ['inoshishi', 'shika', 'cho'] },
  { id: 'akatan', name: '赤短', yomi: 'あかたん', ten: 60, bai: 6, lt: 25, lb: 2, req: '松・梅・桜の赤短', ex: ['akatan1', 'akatan2', 'akatan3'] },
  { id: 'aotan', name: '青短', yomi: 'あおたん', ten: 60, bai: 6, lt: 25, lb: 2, req: '牡丹・菊・紅葉の青短', ex: ['aotan1', 'aotan2', 'aotan3'] },
  { id: 'kusatan', name: '草短', yomi: 'くさたん', ten: 45, bai: 4, lt: 20, lb: 2, req: '藤・菖蒲・萩の短冊', ex: ['kusa1', 'kusa2', 'kusa3'] },
  { id: 'tsukimi', name: '月見酒', yomi: 'つきみざけ', ten: 35, bai: 4, lt: 20, lb: 2, req: '芒に月・菊に盃', ex: ['tsuki', 'sakazuki'] },
  { id: 'hanami', name: '花見酒', yomi: 'はなみざけ', ten: 35, bai: 4, lt: 20, lb: 2, req: '桜に幕・菊に盃', ex: ['maku', 'sakazuki'] },
  { id: 'omote', name: '表菅原', yomi: 'おもてすがわら', ten: 50, bai: 5, lt: 20, lb: 2, req: '松に鶴・梅に鶯・桜に幕', ex: ['tsuru', 'uguisu', 'maku'] },
  { id: 'matsukiri', name: '松桐坊主', yomi: 'まつきりぼうず', ten: 40, bai: 4, lt: 20, lb: 2, req: '松に鶴・桐に鳳凰・芒に月', ex: ['tsuru', 'houou', 'tsuki'] },
  { id: 'pikaichi', name: '光一', yomi: 'ぴかいち', ten: 20, bai: 2, lt: 15, lb: 1, req: '光札1枚とカス札4枚', ex: ['tsuki', 'matsu1', 'ume1', 'fuji1', 'hagi1'] },
  { id: 'hanagoyomi', name: '花暦', yomi: 'はなごよみ', ten: 30, bai: 3, lt: 25, lb: 2, req: '続いた5つの月(十二月→一月もつながる)', ex: ['matsu1', 'ume1', 'sakura1', 'fuji1', 'ayame1'] },
  { id: 'tane', name: 'タネ', yomi: 'たね', ten: 60, bai: 5, lt: 20, lb: 2, req: 'タネ札5枚', ex: ['uguisu', 'hototogisu', 'yatsuhashi', 'kari', 'tsubame'] },
  { id: 'tan', name: 'タン', yomi: 'たん', ten: 50, bai: 5, lt: 20, lb: 2, req: '短冊札5枚', ex: ['akatan1', 'kusa1', 'aotan1', 'kusa3', 'yanagitan'] },
  { id: 'kasu', name: 'カス', yomi: 'かす', ten: 20, bai: 2, lt: 15, lb: 1, req: 'カス札5枚(桐の色札は2枚分)', ex: ['matsu1', 'ume1', 'sakura1', 'kiku1', 'kiri1'] },
  { id: 'gomai', name: '五枚月', yomi: 'ごまいづき', ten: 120, bai: 12, lt: 35, lb: 3, req: '同じ月の札5枚(書き換えや写しで作る)', ex: ['sakura1', 'sakura2', 'maku', 'akatan3', 'sakura1'] },
  { id: 'teshi', name: '手四', yomi: 'てし', ten: 60, bai: 7, lt: 30, lb: 3, req: '同じ月の札4枚', ex: ['tsuru', 'akatan1', 'matsu1', 'matsu2'] },
  { id: 'sanawase', name: '三本合わせ', yomi: 'さんぼんあわせ', ten: 40, bai: 4, lt: 25, lb: 2, req: '同じ月3枚と、別の同じ月2枚', ex: ['maku', 'sakura1', 'sakura2', 'kiku1', 'kiku2'] },
  { id: 'sanbon', name: '三本', yomi: 'さんぼん', ten: 30, bai: 3, lt: 20, lb: 2, req: '同じ月の札3枚', ex: ['shika', 'momiji1', 'momiji2'] },
  { id: 'futakumi', name: '二組', yomi: 'ふたくみ', ten: 20, bai: 2, lt: 20, lb: 1, req: '同じ月2枚を2組', ex: ['ume1', 'ume2', 'hagi1', 'hagi2'] },
  { id: 'awase', name: '合わせ', yomi: 'あわせ', ten: 10, bai: 2, lt: 15, lb: 1, req: '同じ月の札2枚', ex: ['fuji1', 'fuji2'] },
  { id: 'su', name: '素', yomi: 'す', ten: 5, bai: 1, lt: 10, lb: 1, req: '役なし(いちばん点の高い札1枚だけ数える)', ex: ['tsuki'] }
];
D.YAKU_BY = {};
D.YAKU.forEach((y, i) => { y.ord = i; D.YAKU_BY[y.id] = y; });
D.SETS = [   // 決まった札の組み合わせでできる役
  ['inoshikacho', ['inoshishi', 'shika', 'cho']],
  ['akatan', ['akatan1', 'akatan2', 'akatan3']],
  ['aotan', ['aotan1', 'aotan2', 'aotan3']],
  ['kusatan', ['kusa1', 'kusa2', 'kusa3']],
  ['tsukimi', ['tsuki', 'sakazuki']],
  ['hanami', ['maku', 'sakazuki']],
  ['omote', ['tsuru', 'uguisu', 'maku']],
  ['matsukiri', ['tsuru', 'houou', 'tsuki']]
];
D.FAM = {   // 神札の条件に使う役のまとまり
  tsuki: ['awase', 'futakumi', 'sanbon', 'sanawase', 'teshi', 'gomai'],
  sanbon: ['sanbon', 'sanawase', 'teshi', 'gomai'],
  teshi: ['teshi', 'gomai'],
  futa: ['futakumi', 'sanawase'],
  tan: ['tan', 'akatan', 'aotan', 'kusatan', 'akaao'],
  tane: ['tane', 'inoshikacho'],
  kasu: ['kasu', 'pikaichi'],
  hikari: ['sanko', 'ameshiko', 'shiko', 'goko'],
  goyomi: ['hanagoyomi'],
  sake: ['tsukimi', 'hanami']
};
D.FAM_NAME = { tsuki: '月の役', sanbon: '三本以上', teshi: '手四以上', futa: '二組・三本合わせ', tan: '短冊の役', tane: 'タネの役', kasu: 'カスの役', hikari: '光の役', goyomi: '花暦', sake: '酒の役' };
D.EMA_GROUPS = {   // 絵馬で等級が上がるまとまり
  awase: { name: '合', yaku: ['awase', 'futakumi'] },
  sanbon: { name: '三', yaku: ['sanbon', 'sanawase'] },
  teshi: { name: '四', yaku: ['teshi', 'gomai'] },
  kasu: { name: '素', yaku: ['kasu', 'su'] },
  tan: { name: '短', yaku: ['tan', 'akatan', 'aotan', 'kusatan', 'akaao'] },
  tane: { name: '種', yaku: ['tane', 'inoshikacho'] },
  hikari: { name: '光', yaku: ['sanko', 'ameshiko', 'shiko', 'goko'] },
  goyomi: { name: '暦', yaku: ['hanagoyomi'] },
  sake: { name: '酒', yaku: ['tsukimi', 'hanami'] },
  koten: { name: '古', yaku: ['pikaichi', 'omote', 'matsukiri'] }
};
D.YAKU_GROUP = {};
for (const g in D.EMA_GROUPS) for (const y of D.EMA_GROUPS[g].yaku) D.YAKU_GROUP[y] = g;

/* ---------------- 札の強化と印 ---------------- */
D.ENH = {
  kin: { name: '金箔', d: '得点するたび ×1.5倍', x: 1.5 },
  shu: { name: '朱', d: '得点するたび 倍+4', b: 4 },
  ai: { name: '藍', d: '得点するたび 点+30', t: 30 },
  gin: { name: '銀箔', d: '手札に残っていると ×1.5倍', x: 1.5 },
  urushi: { name: '漆', d: 'どの種類の札としても数える' }
};
D.SEAL = {
  kasane: { name: '重ねの印', kj: '重', d: 'この札は2回数える' },
  fuku: { name: '福の印', kj: '福', d: '得点するたび +2両', r: 2 },
  inori: { name: '祈りの印', kj: '祈', d: '勝負の終わりに手札にあると、最後に出した役の絵馬が出る' }
};

/* ---------------- 数値 ---------------- */
D.RULE = { hand: 8, plays: 4, discards: 3, maxPlay: 5, maxDiscard: 5, kamiMax: 5, omaMax: 2 };
D.TARGET = {
  base: [250, 800, 2000, 4200, 7000, 10000, 14000, 20000, 29000, 41000, 58000, 82000],
  round: [1, 1.5, 2],          // 一の勝負・二の勝負・主の勝負
  endless: 1.65                 // 13か月目からの伸び(毎月)
};
D.ECON = {
  startRyo: 4, reward: [3, 4, 5], perPlay: 1, interestPer: 5, interestCap: 5,
  rerollShop: 2, rerollReward: 1, skipReward: 2, banish: 2,
  kamiCost: [0, 4, 6, 8, 12], omaCost: 3, sellRate: 0.5,
  svc: { remove: 3, enhance: 5, rewrite: 2, inc: 1 }
};
D.RARITY = [null,
  { name: '並', col: '#3a3530' }, { name: '上', col: '#2c4a6e' }, { name: '極', col: '#b8361f' }, { name: '幻', col: '#b8892a' }, { name: '進化', col: '#7a3f8f' }];
D.RAR_W = { shop: [0, 68, 26, 6], reward: [0, 66, 28, 6], big: [0, 45, 40, 15] };

/* ---------------- 神札 ----------------
   rar: 1並 2上 3極 4幻(おみくじの大吉だけ) 5進化
   hook: card(札が得点するたび) retrig(もう1回数える数) held(手札に残った札) main(神札の番)
         after(出したあと) discard(捨てたあと) win(勝負に勝った) boss(主を倒した) month(月が変わった) round(勝負のはじめ)
   mods: 手札や出し回数などの増減、flags: 役の数え方を変える */
const KN = (x, c, k) => x.isKind(c, k);
D.KAMI = [
  // ---- 並: 基本
  { id: 'otafuku', name: 'お多福', kj: '多福', rar: 1, cost: 3, motif: 'face', v: { b: 4 }, d: '倍 +{b}',
    main(x, k, v) { x.addB(k, v.b); } },
  { id: 'naruko', name: '鳴子', kj: '鳴子', rar: 1, cost: 3, motif: 'bell', v: { t: 60 }, d: '点 +{t}',
    main(x, k, v) { x.addT(k, v.t); } },
  { id: 'wabisabi', name: '侘び寂び', kj: '侘寂', rar: 1, cost: 4, motif: 'leaf', v: { b: 15, n: 3 }, d: '出した札が{n}枚以下なら 倍 +{b}',
    main(x, k, v) { if (x.played.length <= v.n) x.addB(k, v.b); } },
  { id: 'ichiban', name: '一番太鼓', kj: '一番', rar: 1, cost: 4, motif: 'drum', v: { b: 12 }, d: 'その勝負の最初の出しなら 倍 +{b}',
    main(x, k, v) { if (x.isFirst) x.addB(k, v.b); } },
  { id: 'fukuwarai', name: '福笑い', kj: '福笑', rar: 1, cost: 3, motif: 'face', v: { b: 20 }, d: '倍 +0〜{b}(でたらめ)',
    main(x, k, v) { x.addB(k, Math.floor(x.rnd() * (v.b + 1))); } },
  { id: 'suteougi', name: '捨て扇', kj: '捨扇', rar: 1, cost: 4, motif: 'fan', v: { t: 40 }, d: '残りの捨て1回につき 点 +{t}',
    main(x, k, v) { x.addT(k, v.t * x.discLeft); } },
  { id: 'muyoku', name: '無欲', kj: '無欲', rar: 1, cost: 4, motif: 'circle', v: { b: 15 }, d: '残りの捨てが0なら 倍 +{b}',
    main(x, k, v) { if (x.discLeft === 0) x.addB(k, v.b); } },
  { id: 'dorei', name: '土鈴', kj: '土鈴', rar: 1, cost: 4, motif: 'bell', v: { b: 10 }, d: '得点する札が5枚以上なら 倍 +{b}',
    main(x, k, v) { if (x.scoring.length >= 5) x.addB(k, v.b); } },
  // ---- 並: 札の種類
  { id: 'kinbyobu', name: '金屏風', kj: '屏風', rar: 1, cost: 5, motif: 'cloud', v: { b: 4 }, d: '光札が得点するたび 倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'hikari')) x.addB(k, v.b, c); } },
  { id: 'uguisubue', name: '鶯笛', kj: '鶯笛', rar: 1, cost: 5, motif: 'bird', v: { b: 3 }, d: 'タネ札が得点するたび 倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'tane')) x.addB(k, v.b, c); } },
  { id: 'fude', name: '筆', kj: '筆', rar: 1, cost: 5, motif: 'brush', v: { b: 3 }, d: '短冊札が得点するたび 倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'tan')) x.addB(k, v.b, c); } },
  { id: 'takebouki', name: '竹箒', kj: '竹箒', rar: 1, cost: 5, motif: 'leaf', v: { b: 2 }, d: 'カス札が得点するたび 倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'kasu')) x.addB(k, v.b, c); } },
  { id: 'andon', name: '行灯', kj: '行灯', rar: 1, cost: 4, motif: 'lantern', v: { t: 50 }, d: '光札が得点するたび 点 +{t}',
    card(x, k, c, v) { if (KN(x, c, 'hikari')) x.addT(k, v.t, c); } },
  { id: 'subako', name: '巣箱', kj: '巣箱', rar: 1, cost: 4, motif: 'bird', v: { t: 30 }, d: 'タネ札が得点するたび 点 +{t}',
    card(x, k, c, v) { if (KN(x, c, 'tane')) x.addT(k, v.t, c); } },
  { id: 'suzuri', name: '硯', kj: '硯', rar: 1, cost: 4, motif: 'brush', v: { t: 30 }, d: '短冊札が得点するたび 点 +{t}',
    card(x, k, c, v) { if (KN(x, c, 'tan')) x.addT(k, v.t, c); } },
  { id: 'momigara', name: '籾殻', kj: '籾殻', rar: 1, cost: 4, motif: 'leaf', v: { t: 15 }, d: 'カス札が得点するたび 点 +{t}',
    card(x, k, c, v) { if (KN(x, c, 'kasu')) x.addT(k, v.t, c); } },
  { id: 'ukiyoe', name: '浮世絵', kj: '浮世', rar: 1, cost: 5, motif: 'wave', v: { b: 3 }, d: '旬の札が得点するたび 倍 +{b}',
    card(x, k, c, v) { if (x.shun(c)) x.addB(k, v.b, c); } },
  // ---- 並: 役
  { id: 'futaba', name: '双葉', kj: '双葉', rar: 1, cost: 3, motif: 'leaf', v: { b: 6 }, d: '月の役(合わせ〜五枚月)を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('tsuki')) x.addB(k, v.b); } },
  { id: 'mitsudomoe', name: '三つ巴', kj: '三巴', rar: 1, cost: 4, motif: 'tomoe', v: { b: 12 }, d: '三本以上の月の役を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('sanbon')) x.addB(k, v.b); } },
  { id: 'tanabata', name: '七夕', kj: '七夕', rar: 1, cost: 4, motif: 'star', v: { b: 10 }, d: '短冊の役を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('tan')) x.addB(k, v.b); } },
  { id: 'mushikago', name: '虫籠', kj: '虫籠', rar: 1, cost: 4, motif: 'bird', v: { b: 10 }, d: 'タネの役を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('tane')) x.addB(k, v.b); } },
  { id: 'chirizuka', name: '塵塚', kj: '塵塚', rar: 1, cost: 3, motif: 'leaf', v: { b: 8 }, d: 'カスの役(カス・光一)を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('kasu')) x.addB(k, v.b); } },
  { id: 'hidokei', name: '日時計', kj: '日時計', rar: 1, cost: 4, motif: 'sun', v: { b: 12 }, d: '花暦を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('goyomi')) x.addB(k, v.b); } },
  { id: 'sakadaru', name: '酒樽', kj: '酒樽', rar: 1, cost: 4, motif: 'sake', v: { b: 12 }, d: '月見酒か花見酒を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('sake')) x.addB(k, v.b); } },
  { id: 'kinun', name: '金雲', kj: '金雲', rar: 1, cost: 4, motif: 'cloud', v: { b: 15 }, d: '光の役(三光〜五光)を含むと 倍 +{b}',
    main(x, k, v) { if (x.fam('hikari')) x.addB(k, v.b); } },
  { id: 'hyoutan', name: '瓢箪', kj: '瓢箪', rar: 1, cost: 3, motif: 'gourd', v: { t: 60 }, d: '月の役を含むと 点 +{t}',
    main(x, k, v) { if (x.fam('tsuki')) x.addT(k, v.t); } },
  { id: 'makimono', name: '巻物', kj: '巻物', rar: 1, cost: 4, motif: 'scroll', v: { t: 100 }, d: '役が2つ以上なら 点 +{t}',
    main(x, k, v) { if (x.nYaku >= 2) x.addT(k, v.t); } },
  // ---- 並: 決まりを変える
  { id: 'tobiishi', name: '飛び石', kj: '飛石', rar: 1, cost: 4, motif: 'circle', d: '花暦で、月を1つずつとばしてもよい', flags: { skip: 1 } },
  { id: 'kikuzake', name: '菊酒', kj: '菊酒', rar: 1, cost: 4, motif: 'sake', d: '菊に盃をカス札としても数える', flags: { kikuKasu: 1 } },
  { id: 'amayadori', name: '雨宿り', kj: '雨宿', rar: 1, cost: 4, motif: 'rain', d: '柳に小野道風を、ふつうの光札として数える(雨四光→四光)', flags: { ameHikari: 1 } },
  { id: 'ooburumai', name: '大盤振る舞い', kj: '振舞', rar: 1, cost: 4, motif: 'fan', d: '出した札すべてが得点する', flags: { splash: 1 } },
  { id: 'hayauma', name: '早馬', kj: '早馬', rar: 1, cost: 5, motif: 'wind', d: '手札 +1', mods: { hand: 1 } },
  { id: 'houkiboshi', name: '箒星', kj: '箒星', rar: 1, cost: 5, motif: 'star', d: '捨て +1', mods: { discards: 1 } },
  // ---- 並: お金
  { id: 'kozuchi', name: '打ち出の小槌', kj: '小槌', rar: 1, cost: 6, motif: 'coin', v: { r: 3 }, d: '勝負に勝つと +{r}両',
    win(run, k, v) { return v.r; } },
  { id: 'saisen', name: '賽銭箱', kj: '賽銭', rar: 1, cost: 5, v: { r: 1 }, motif: 'coin', d: '捨てた札にカス札が2枚以上あれば +{r}両',
    discard(run, k, cards, v) { return cards.filter(c => faceOf(c).kind === 'kasu').length >= 2 ? v.r : 0; } },
  { id: 'chokinbako', name: '貯金箱', kj: '貯金', rar: 1, cost: 5, motif: 'coin', d: '月末の利子の上限 +5両', mods: { interestCap: 5 } },
  { id: 'kanenonaruki', name: '金の成る木', kj: '成木', rar: 1, cost: 4, motif: 'tree', v: { g: 2 }, d: '勝負に勝つたび、この札の売値 +{g}両',
    win(run, k, v) { k.sell += v.g; return 0; } },
  { id: 'omikujibako', name: 'おみくじ箱', kj: '神籤', rar: 1, cost: 5, motif: 'scroll', d: '勝負に勝つと、お守りを1つもらう(枠が空いていれば)',
    win(run, k) { run._gift = (run._gift || 0) + 1; return 0; } },
  { id: 'emakake', name: '絵馬掛け', kj: '絵馬', rar: 1, cost: 5, motif: 'ema', d: '主を倒すと、この月にいちばん多く出した役の等級 +1',
    boss(run, k) { run._emaGift = (run._emaGift || 0) + 1; return 0; } },
  // ---- 並: 数える回数
  { id: 'kodama', name: 'こだま', kj: '木霊', rar: 1, cost: 5, motif: 'tree', d: '最初に得点する札を、もう1回数える',
    retrig(x, k, c) { return x.scoring[0] === c ? 1 : 0; } },
  // ---- 並: 育つ
  { id: 'yukidaruma', name: '雪だるま', kj: '雪達磨', rar: 1, cost: 4, motif: 'circle', v: { g: 15 }, s0: { t: 0 }, d: 'カスの役を出すたび 点 +{g} ずつ増える', cur: k => '今 点+' + k.s.t,
    main(x, k) { if (k.s.t) x.addT(k, k.s.t); },
    after(run, k, info, v) { if (info.fam('kasu')) k.s.t += v.g; } },
  { id: 'junrei', name: '巡礼', kj: '巡礼', rar: 1, cost: 4, motif: 'gate', v: { g: 4 }, s0: { t: 0 }, d: '旬の札が得点するたび 点 +{g} ずつ増える', cur: k => '今 点+' + k.s.t,
    main(x, k) { if (k.s.t) x.addT(k, k.s.t); },
    after(run, k, info, v) { k.s.t += v.g * info.shunN; } },
  { id: 'shusse', name: '出世魚', kj: '出世', rar: 1, cost: 5, motif: 'fish', v: { g: 3 }, s0: { b: 0 }, d: '月が変わるたび 倍 +{g} ずつ増える', cur: k => '今 倍+' + k.s.b,
    main(x, k) { if (k.s.b) x.addB(k, k.s.b); },
    month(run, k, v) { k.s.b += v.g; } },
  { id: 'dango', name: '月見団子', kj: '団子', rar: 1, cost: 4, motif: 'moon', v: { b: 20 }, s0: { b: 20 }, d: '倍 +{b}。出すたびに1ずつ減り、0で消える', cur: k => '今 倍+' + k.s.b,
    main(x, k) { x.addB(k, k.s.b); },
    after(run, k) { k.s.b -= 1; if (k.s.b <= 0) k.gone = true; } },
  { id: 'senkouhanabi', name: '線香花火', kj: '花火', rar: 1, cost: 5, motif: 'spark', v: { x: 2, n: 10 }, s0: { n: 10 }, d: '×{x}倍。{n}回出すと燃え尽きる', cur: k => 'あと' + k.s.n + '回',
    main(x, k, v) { x.mulB(k, v.x); },
    after(run, k) { k.s.n -= 1; if (k.s.n <= 0) k.gone = true; } },

  // ---- 上
  { id: 'yubiori', name: '指折り', kj: '指折', rar: 2, cost: 7, motif: 'hand', d: 'タネ・タン・カス・花暦・光一が4枚で成立する', flags: { four: 1 } },
  { id: 'bakedanuki', name: '化け狸', kj: '化狸', rar: 2, cost: 6, motif: 'leaf', d: 'タネ札と短冊札を、同じ種類として数える', flags: { smear: 1 } },
  { id: 'senju', name: '千手観音', kj: '千手', rar: 2, cost: 7, motif: 'hand', d: '出し +2。そのかわり捨てが0回', mods: { plays: 2, noDiscard: 1 } },
  { id: 'ebisu', name: '恵比寿', kj: '恵比寿', rar: 2, cost: 7, motif: 'fish', d: '勝負に勝つと、持っている神札1つにつき +1両',
    win(run) { return run.kami.length; } },
  { id: 'manekineko', name: '招き猫', kj: '招猫', rar: 2, cost: 6, motif: 'cat', v: { b: 2 }, d: '持っている両5両につき 倍 +{b}',
    main(x, k, v) { const n = Math.floor(Math.max(0, x.run.ryo) / 5); if (n) x.addB(k, v.b * n); } },
  { id: 'yamabiko', name: '山彦', kj: '山彦', rar: 2, cost: 7, motif: 'mountain', d: '光札を、もう1回数える',
    retrig(x, k, c) { return KN(x, c, 'hikari') ? 1 : 0; } },
  { id: 'nidozaki', name: '二度咲き', kj: '再咲', rar: 2, cost: 6, motif: 'flower', d: '旬の札を、もう1回数える',
    retrig(x, k, c) { return x.shun(c) ? 1 : 0; } },
  { id: 'zankyou', name: '残響', kj: '残響', rar: 2, cost: 7, motif: 'bell', d: '最後の出しでは、得点する札をすべてもう1回数える',
    retrig(x) { return x.isLast ? 1 : 0; } },
  { id: 'kokemusu', name: '苔むす', kj: '苔', rar: 2, cost: 6, motif: 'leaf', v: { g: 2 }, s0: { b: 0 }, d: '勝負に勝つたび 倍 +{g} ずつ増える', cur: k => '今 倍+' + k.s.b,
    main(x, k) { if (k.s.b) x.addB(k, k.s.b); },
    win(run, k, v) { k.s.b += v.g; return 0; } },
  { id: 'sakagura', name: '酒蔵', kj: '酒蔵', rar: 2, cost: 6, motif: 'sake', v: { g: 0.2 }, s0: { x: 1 }, d: '盃が得点するたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(1),
    main(x, k) { if (k.s.x > 1) x.mulB(k, k.s.x); },
    after(run, k, info, v) { k.s.x = +(k.s.x + v.g * info.faceN('sakazuki')).toFixed(2); } },
  { id: 'daifukucho', name: '大福帳', kj: '大福帳', rar: 2, cost: 6, motif: 'scroll', v: { g: 1 }, s0: { b: 0 }, d: '役を2つ以上同時に作るたび 倍 +{g} ずつ増える', cur: k => '今 倍+' + k.s.b,
    main(x, k) { if (k.s.b) x.addB(k, k.s.b); },
    after(run, k, info, v) { if (info.nYaku >= 2) k.s.b += v.g; } },
  { id: 'senbazuru', name: '千羽鶴', kj: '千羽鶴', rar: 2, cost: 7, motif: 'crane', v: { g: 0.1 }, s0: { x: 1 }, d: '光札が得点するたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(1),
    main(x, k) { if (k.s.x > 1) x.mulB(k, k.s.x); },
    after(run, k, info, v) { k.s.x = +(k.s.x + v.g * info.kindN('hikari')).toFixed(2); } },
  { id: 'meotoiwa', name: '夫婦岩', kj: '夫婦', rar: 2, cost: 7, motif: 'rock', v: { x: 2 }, d: '二組か三本合わせを含むと ×{x}倍',
    main(x, k, v) { if (x.fam('futa')) x.mulB(k, v.x); } },
  { id: 'sanninkanjo', name: '三人官女', kj: '官女', rar: 2, cost: 7, motif: 'fan', v: { x: 2 }, d: '三本以上の月の役を含むと ×{x}倍',
    main(x, k, v) { if (x.fam('sanbon')) x.mulB(k, v.x); } },
  { id: 'tsurunomai', name: '鶴の舞', kj: '鶴舞', rar: 2, cost: 8, motif: 'crane', v: { x: 2 }, d: '光の役を含むと ×{x}倍',
    main(x, k, v) { if (x.fam('hikari')) x.mulB(k, v.x); } },
  { id: 'kouhaku', name: '紅白幕', kj: '紅白', rar: 2, cost: 7, motif: 'stripe', v: { x: 2 }, d: '短冊の役を含むと ×{x}倍',
    main(x, k, v) { if (x.fam('tan')) x.mulB(k, v.x); } },
  { id: 'gekkou', name: '月光', kj: '月光', rar: 2, cost: 7, motif: 'moon', v: { x: 2 }, d: '出した札がすべて同じ種類なら ×{x}倍',
    main(x, k, v) { if (x.sameKind()) x.mulB(k, v.x); } },
  { id: 'hanaikada', name: '花筏', kj: '花筏', rar: 2, cost: 7, motif: 'wave', v: { x: 1.25 }, d: '旬の札が得点するたび ×{x}倍',
    card(x, k, c, v) { if (x.shun(c)) x.mulB(k, v.x, c); } },
  { id: 'daruma', name: '達磨', kj: '達磨', rar: 2, cost: 7, motif: 'daruma', v: { x: 3 }, d: '最後の出しで ×{x}倍',
    main(x, k, v) { if (x.isLast) x.mulB(k, v.x); } },
  { id: 'ittenbari', name: '一点張り', kj: '一点', rar: 2, cost: 6, motif: 'circle', v: { x: 4 }, d: '1枚だけ出すと ×{x}倍',
    main(x, k, v) { if (x.played.length === 1) x.mulB(k, v.x); } },
  { id: 'kintsugi', name: '金継ぎ', kj: '金継', rar: 2, cost: 7, motif: 'crack', d: '得点した光札が金箔の札になる',
    after(run, k, info) { info.scoring.forEach(c => { if (faceOf(c).kind === 'hikari' && !c.e) { c.e = 'kin'; info.changed.push(c.u); } }); } },
  { id: 'aizome', name: '藍染め', kj: '藍染', rar: 2, cost: 6, motif: 'wave', d: '得点した短冊札が藍の札(点+30)になる',
    after(run, k, info) { info.scoring.forEach(c => { if (faceOf(c).kind === 'tan' && !c.e) { c.e = 'ai'; info.changed.push(c.u); } }); } },
  { id: 'onmyoji', name: '陰陽師', kj: '陰陽', rar: 2, cost: 7, motif: 'star', v: { p: 0.25 }, d: '出すたび 1/4 の確率で、成立した役の等級 +1',
    after(run, k, info, v) { if (info.rnd() < v.p) { const y = info.topYaku(); if (y && y !== 'su') { run.lv[y] = (run.lv[y] || 1) + 1; info.lvUp.push(y); } } } },
  { id: 'yatanokagami', name: '八咫鏡', kj: '八咫鏡', rar: 2, cost: 6, motif: 'mirror', v: { b: 2 }, d: '手札に残った札1枚につき 倍 +{b}',
    held(x, k, c, v) { x.addB(k, v.b, c); } },
  { id: 'kusanagi', name: '草薙剣', kj: '草薙', rar: 2, cost: 6, motif: 'sword', v: { b: 2 }, d: '得点する札1枚につき 倍 +{b}',
    card(x, k, c, v) { x.addB(k, v.b, c); } },
  { id: 'magatama', name: '八尺瓊勾玉', kj: '勾玉', rar: 2, cost: 6, motif: 'tomoe', v: { b: 6 }, d: '成立した役1つにつき 倍 +{b}',
    main(x, k, v) { x.addB(k, v.b * x.nYaku); } },
  { id: 'fujin', name: '風神', kj: '風神', rar: 2, cost: 6, motif: 'wind', v: { b: 5 }, s0: { b: 0 }, d: '捨てるたび、その勝負の間 倍 +{b}', cur: k => '今 倍+' + k.s.b,
    main(x, k) { if (k.s.b) x.addB(k, k.s.b); },
    discard(run, k, cards, v) { k.s.b += v.b; return 0; }, round(run, k) { k.s.b = 0; } },
  { id: 'raijin', name: '雷神', kj: '雷神', rar: 2, cost: 6, motif: 'lightning', v: { b: 5 }, s0: { b: 0 }, d: '出すたび、その勝負の間 倍 +{b}(次の出しから)', cur: k => '今 倍+' + k.s.b,
    main(x, k) { if (k.s.b) x.addB(k, k.s.b); },
    after(run, k, info, v) { k.s.b += v.b; }, round(run, k) { k.s.b = 0; } },

  // ---- 極
  { id: 'nenrin', name: '年輪', kj: '年輪', rar: 3, cost: 9, motif: 'tree', v: { g: 0.5 }, s0: { x: 1 }, d: '主を倒すたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(1),
    main(x, k) { if (k.s.x > 1) x.mulB(k, k.s.x); },
    boss(run, k, v) { k.s.x += v.g; return 0; } },
  { id: 'onimen', name: '鬼の面', kj: '鬼面', rar: 3, cost: 9, motif: 'mask', v: { x: 3 }, d: '手四以上を含むと ×{x}倍',
    main(x, k, v) { if (x.fam('teshi')) x.mulB(k, v.x); } },
  { id: 'karigoromo', name: '狩衣', kj: '狩衣', rar: 3, cost: 8, motif: 'deer', v: { x: 3 }, d: '猪鹿蝶を含むと ×{x}倍',
    main(x, k, v) { if (x.has('inoshikacho')) x.mulB(k, v.x); } },
  { id: 'koyomikagami', name: '暦鏡', kj: '暦鏡', rar: 3, cost: 9, motif: 'mirror', v: { x: 3 }, d: '花暦を含むと ×{x}倍',
    main(x, k, v) { if (x.fam('goyomi')) x.mulB(k, v.x); } },
  { id: 'tekagami', name: '手鏡', kj: '手鏡', rar: 3, cost: 8, motif: 'mirror', v: { x: 1.5 }, d: '手札に残った光札1枚につき ×{x}倍',
    held(x, k, c, v) { if (KN(x, c, 'hikari')) x.mulB(k, v.x, c); } },
  { id: 'utsushie', name: '写し絵', kj: '写絵', rar: 3, cost: 10, motif: 'frame', copy: 'right', d: '右隣の神札と同じ得点の効果を持つ' },
  { id: 'kageboshi', name: '影法師', kj: '影法師', rar: 3, cost: 10, motif: 'shadow', copy: 'left', d: 'いちばん左の神札と同じ得点の効果を持つ' },
  { id: 'takarabune', name: '宝船', kj: '宝船', rar: 3, cost: 8, motif: 'boat', v: { r: 10 }, d: '主を倒すと +{r}両',
    boss(run, k, v) { return v.r; } },

  // ---- 幻(おみくじの大吉でだけ手に入る)
  { id: 'amaterasu', name: '天照', kj: '天照', rar: 4, cost: 12, motif: 'sun', v: { x: 2 }, d: '光札が得点するたび ×{x}倍',
    card(x, k, c, v) { if (KN(x, c, 'hikari')) x.mulB(k, v.x, c); } },
  { id: 'benzaiten', name: '弁財天', kj: '弁天', rar: 4, cost: 12, motif: 'biwa', v: { x: 1.5 }, d: '短冊札が得点するたび ×{x}倍',
    card(x, k, c, v) { if (KN(x, c, 'tan')) x.mulB(k, v.x, c); } },
  { id: 'yatagarasu', name: '八咫烏', kj: '八咫烏', rar: 4, cost: 12, motif: 'bird', v: { x: 1.5 }, d: 'タネ札が得点するたび ×{x}倍',
    card(x, k, c, v) { if (KN(x, c, 'tane')) x.mulB(k, v.x, c); } },
  { id: 'zashikiwarashi', name: '座敷童子', kj: '童子', rar: 4, cost: 12, motif: 'face', v: { x: 1.3 }, d: 'カス札が得点するたび ×{x}倍',
    card(x, k, c, v) { if (KN(x, c, 'kasu')) x.mulB(k, v.x, c); } },
  { id: 'ryujin', name: '龍神', kj: '龍神', rar: 4, cost: 12, motif: 'dragon', v: { x: 1.5 }, d: '成立した役1つにつき ×{x}倍',
    main(x, k, v) { for (let i = 0; i < x.nYaku; i++) x.mulB(k, v.x); } },

  // ---- 進化(組み合わせると上位版になる)
  { id: 'gekka', name: '月下の宴', kj: '宴', rar: 5, evo: ['sakadaru', 'sakagura'], motif: 'moon', v: { x: 3, g: 0.25 }, s0: { x: 1 },
    d: '月見酒か花見酒を含むと ×{x}倍。盃が得点するたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(2),
    merge(p) { return { x: p.sakagura ? p.sakagura.s.x : 1 }; },
    main(x, k, v) { if (x.fam('sake')) x.mulB(k, v.x); if (k.s.x > 1) x.mulB(k, k.s.x); },
    after(run, k, info, v) { k.s.x = +(k.s.x + v.g * info.faceN('sakazuki')).toFixed(2); } },
  { id: 'tsurusennen', name: '鶴は千年', kj: '千年', rar: 5, evo: ['tsurunomai', 'senbazuru'], motif: 'crane', v: { x: 3, g: 0.15 }, s0: { x: 1 },
    d: '光の役を含むと ×{x}倍。光札が得点するたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(2),
    merge(p) { return { x: p.senbazuru ? p.senbazuru.s.x : 1 }; },
    main(x, k, v) { if (x.fam('hikari')) x.mulB(k, v.x); if (k.s.x > 1) x.mulB(k, k.s.x); },
    after(run, k, info, v) { k.s.x = +(k.s.x + v.g * info.kindN('hikari')).toFixed(2); } },
  { id: 'senryobako', name: '千両箱', kj: '千両', rar: 5, evo: ['manekineko', 'kozuchi'], motif: 'coin', v: { r: 5, b: 3 },
    d: '勝負に勝つと +{r}両。持っている両5両につき 倍 +{b}',
    main(x, k, v) { const n = Math.floor(Math.max(0, x.run.ryo) / 5); if (n) x.addB(k, v.b * n); },
    win(run, k, v) { return v.r; } },
  { id: 'sennensugi', name: '千年杉', kj: '千年杉', rar: 5, evo: ['kokemusu', 'nenrin'], motif: 'tree', v: { g: 0.25 }, s0: { x: 1 },
    d: '勝負に勝つたび ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(2),
    merge(p) { return { x: (p.nenrin ? p.nenrin.s.x : 1) + (p.kokemusu ? p.kokemusu.s.b * 0.05 : 0) }; },
    main(x, k) { if (k.s.x > 1) x.mulB(k, k.s.x); },
    win(run, k, v) { k.s.x = +(k.s.x + v.g).toFixed(2); return 0; } },
  { id: 'bunbou', name: '文房四宝', kj: '文房', rar: 5, evo: ['fude', 'suzuri'], motif: 'brush', v: { t: 40, b: 5 }, d: '短冊札が得点するたび 点 +{t}・倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'tan')) { x.addT(k, v.t, c); x.addB(k, v.b, c); } } },
  { id: 'kachou', name: '花鳥風月', kj: '花鳥', rar: 5, evo: ['uguisubue', 'subako'], motif: 'bird', v: { t: 40, b: 5 }, d: 'タネ札が得点するたび 点 +{t}・倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'tane')) { x.addT(k, v.t, c); x.addB(k, v.b, c); } } },
  { id: 'konjikido', name: '金色堂', kj: '金色', rar: 5, evo: ['kinbyobu', 'andon'], motif: 'gate', v: { t: 60, b: 8 }, d: '光札が得点するたび 点 +{t}・倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'hikari')) { x.addT(k, v.t, c); x.addB(k, v.b, c); } } },
  { id: 'souan', name: '草庵', kj: '草庵', rar: 5, evo: ['takebouki', 'momigara'], motif: 'leaf', v: { t: 20, b: 3 }, d: 'カス札が得点するたび 点 +{t}・倍 +{b}',
    card(x, k, c, v) { if (KN(x, c, 'kasu')) { x.addT(k, v.t, c); x.addB(k, v.b, c); } } },
  { id: 'nanakorobi', name: '七転八起', kj: '七転', rar: 5, evo: ['daruma', 'zankyou'], motif: 'daruma', v: { x: 4 }, d: '最後の出しで ×{x}倍。得点する札をすべてもう1回数える',
    retrig(x) { return x.isLast ? 1 : 0; },
    main(x, k, v) { if (x.isLast) x.mulB(k, v.x); } },
  { id: 'enmusubi', name: '縁結び', kj: '縁結', rar: 5, evo: ['meotoiwa', 'futaba'], motif: 'knot', v: { x: 2.5, b: 6 }, d: '月の役を含むと 倍 +{b}、×{x}倍',
    main(x, k, v) { if (x.fam('tsuki')) { x.addB(k, v.b); x.mulB(k, v.x); } } },
  { id: 'kyouka', name: '鏡花水月', kj: '鏡花', rar: 5, evo: ['utsushie', 'kageboshi'], motif: 'mirror', copy: 'both', d: '右隣の神札と、いちばん左の神札、両方の得点の効果を持つ' },
  { id: 'sanshu', name: '三種の神器', kj: '神器', rar: 5, evo: ['yatanokagami', 'kusanagi', 'magatama'], motif: 'jewel', v: { b1: 2, b2: 2, b3: 6, x: 2 },
    d: '手札に残った札1枚につき 倍+{b1}、得点する札1枚につき 倍+{b2}、役1つにつき 倍+{b3}。最後に ×{x}倍',
    card(x, k, c, v) { x.addB(k, v.b2, c); },
    held(x, k, c, v) { x.addB(k, v.b1, c); },
    main(x, k, v) { x.addB(k, v.b3 * x.nYaku); x.mulB(k, v.x); } },
  { id: 'hyakki', name: '百鬼夜行', kj: '百鬼', rar: 5, evo: ['onimen', 'sanninkanjo'], motif: 'mask', v: { x: 3, x2: 2 }, d: '三本以上で ×{x}倍。手四以上なら さらに ×{x2}倍',
    main(x, k, v) { if (x.fam('sanbon')) x.mulB(k, v.x); if (x.fam('teshi')) x.mulB(k, v.x2); } },
  { id: 'konten', name: '渾天儀', kj: '渾天', rar: 5, evo: ['koyomikagami', 'hidokei'], motif: 'sun', v: { x: 4, b: 12 }, d: '花暦を含むと 倍 +{b}、×{x}倍',
    main(x, k, v) { if (x.fam('goyomi')) { x.addB(k, v.b); x.mulB(k, v.x); } } },
  { id: 'fuujinraijin', name: '風神雷神', kj: '風雷', rar: 5, evo: ['fujin', 'raijin'], motif: 'lightning', v: { g: 0.5 }, s0: { x: 1 },
    d: '出す・捨てるたび、その勝負の間 ×{g}倍 ずつ増える', cur: k => '今 ×' + k.s.x.toFixed(1),
    main(x, k) { if (k.s.x > 1) x.mulB(k, k.s.x); },
    after(run, k, info, v) { k.s.x += v.g; },
    discard(run, k, cards, v) { k.s.x += v.g; return 0; }, round(run, k) { k.s.x = 1; } }
];
D.KAMI_BY = {};
D.KAMI.forEach((k, i) => { k.ord = i; D.KAMI_BY[k.id] = k; });
D.EVOS = D.KAMI.filter(k => k.evo);

/* 神札の解放条件(書いていない神札ははじめから出る)。s = セーブデータ */
D.KAMI_UNLOCK = {
  yubiori: { d: '6か月目に着く', t: s => s.best.month >= 6 },
  bakedanuki: { d: '赤短か青短を作る', t: s => (s.yaku.akatan || 0) + (s.yaku.aotan || 0) >= 1 },
  senju: { d: '1回の出しで勝負に勝つ', t: s => s.stats.oneShot >= 1 },
  kintsugi: { d: '金箔の札で得点する', t: s => s.stats.kinScored >= 1 },
  onmyoji: { d: '絵馬を累計10枚使う', t: s => s.stats.ema >= 10 },
  senbazuru: { d: '光札を累計30回得点させる', t: s => s.stats.hikariScored >= 30 },
  daifukucho: { d: '役を3つ同時に作る', t: s => s.stats.maxYaku >= 3 },
  yatanokagami: { d: '主を累計5体倒す', t: s => s.stats.bosses >= 5 },
  kusanagi: { d: '1回の出しで10,000点', t: s => s.best.play >= 10000 },
  magatama: { d: '役を4つ同時に作る', t: s => s.stats.maxYaku >= 4 },
  fujin: { d: '捨てを累計100回使う', t: s => s.stats.discards >= 100 },
  raijin: { d: '出しを累計200回使う', t: s => s.stats.plays >= 200 },
  senkouhanabi: { d: '1回の出しで5,000点', t: s => s.best.play >= 5000 },
  ittenbari: { d: '1枚だけ出して300点以上', t: s => s.stats.oneCard300 >= 1 },
  nenrin: { d: '主を累計10体倒す', t: s => s.stats.bosses >= 10 },
  onimen: { d: '手四を作る', t: s => (s.yaku.teshi || 0) >= 1 },
  karigoromo: { d: '猪鹿蝶を作る', t: s => (s.yaku.inoshikacho || 0) >= 1 },
  koyomikagami: { d: '花暦を累計5回作る', t: s => (s.yaku.hanagoyomi || 0) >= 5 },
  tekagami: { d: '四光か雨四光を作る', t: s => (s.yaku.shiko || 0) + (s.yaku.ameshiko || 0) >= 1 },
  utsushie: { d: '神札を進化させる', t: s => s.stats.evolve >= 1 },
  kageboshi: { d: '12か月(1年)を乗り切る', t: s => s.stats.clears >= 1 },
  takarabune: { d: '両を一度に40両持つ', t: s => s.best.ryo >= 40 }
};

/* ---------------- お守り ---------------- */
D.OMA = [
  // 絵馬: 役の等級を上げる
  ...Object.keys(D.EMA_GROUPS).map(g => ({
    id: 'ema_' + g, type: 'ema', grp: g, name: '絵馬「' + D.EMA_GROUPS[g].name + '」', kj: D.EMA_GROUPS[g].name, cost: 3,
    d: D.EMA_GROUPS[g].yaku.map(y => D.YAKU_BY[y].name).join('・') + ' の等級 +1'
  })),
  // 加工: 札を選んで使う
  { id: 'kinpaku', type: 'mod', name: '金箔押し', kj: '金', n: 1, cost: 3, enh: 'kin', d: '選んだ札1枚を金箔の札にする(得点するたび ×1.5倍)' },
  { id: 'shuzumi', type: 'mod', name: '朱墨', kj: '朱', n: 2, cost: 3, enh: 'shu', d: '選んだ札2枚までを朱の札にする(得点するたび 倍+4)' },
  { id: 'aidama', type: 'mod', name: '藍玉', kj: '藍', n: 2, cost: 3, enh: 'ai', d: '選んだ札2枚までを藍の札にする(得点するたび 点+30)' },
  { id: 'ginpaku', type: 'mod', name: '銀箔押し', kj: '銀', n: 1, cost: 3, enh: 'gin', d: '選んだ札1枚を銀箔の札にする(手札に残ると ×1.5倍)' },
  { id: 'urushinuri', type: 'mod', name: '漆塗り', kj: '漆', n: 1, cost: 3, enh: 'urushi', d: '選んだ札1枚を漆の札にする(どの種類としても数える)' },
  { id: 'kasaneIn', type: 'mod', name: '重ね印', kj: '重', n: 1, cost: 4, seal: 'kasane', d: '選んだ札1枚に重ねの印を押す(2回数える)' },
  { id: 'fukuIn', type: 'mod', name: '福印', kj: '福', n: 1, cost: 3, seal: 'fuku', d: '選んだ札1枚に福の印を押す(得点するたび +2両)' },
  { id: 'inoriIn', type: 'mod', name: '祈り印', kj: '祈', n: 1, cost: 3, seal: 'inori', d: '選んだ札1枚に祈りの印を押す(勝負の終わりに手札にあると絵馬が出る)' },
  { id: 'tsukigae', type: 'mod', name: '月替え', kj: '替', n: 3, min: 2, cost: 3, d: '選んだ札(2〜3枚)を、いちばん左の札と同じ月にする' },
  { id: 'koyomiokuri', type: 'mod', name: '暦送り', kj: '送', n: 2, cost: 3, d: '選んだ札2枚までの月を1つ進める(十二月→一月)' },
  { id: 'harai', type: 'mod', name: '祓い', kj: '祓', n: 2, cost: 3, d: '選んだ札2枚までを山札から取り除く' },
  { id: 'utsushi', type: 'mod', name: '写し', kj: '写', n: 1, cost: 4, d: '選んだ札1枚の写しを山札に加える' },
  // 特別
  { id: 'omikuji', type: 'misc', name: 'おみくじ', kj: '籤', cost: 4, d: 'ランダムな神札を1つもらう(神札の枠が要る。まれに大吉で「幻」)' },
  { id: 'saisenO', type: 'misc', name: '賽銭', kj: '銭', cost: 4, d: '持っている両を2倍にする(最大+20両)' },
  { id: 'fukubukuro', type: 'misc', name: '福袋', kj: '福', cost: 4, d: 'ランダムなお守りを2つもらう(枠が空いていれば)' },
  { id: 'shoukon', type: 'misc', name: '招魂', kj: '魂', cost: 3, d: '最後に使ったお守り(招魂以外)をもう1つもらう' },
  { id: 'kamikakushi', type: 'misc', name: '神隠し', kj: '隠', cost: 3, inRound: true, d: '手札をすべて山札に戻し、引き直す(勝負の中だけ)' }
];
D.OMA_BY = {};
D.OMA.forEach(o => { D.OMA_BY[o.id] = o; });

/* ---------------- 袋(茶屋) ---------------- */
D.PACKS = {
  kami: { name: '神札袋', kj: '神', cost: 4, n: 3, d: '神札3つから1つ選ぶ' },
  bigkami: { name: '大神札袋', kj: '神', cost: 7, n: 5, d: '神札5つから1つ選ぶ(上・極が出やすい)' },
  oma: { name: '御守袋', kj: '守', cost: 4, n: 3, d: 'お守り3つから1つ選んで、すぐ使う' },
  ema: { name: '絵馬袋', kj: '絵', cost: 4, n: 3, d: '絵馬3つから1つ選んで、すぐ使う' },
  card: { name: '札袋', kj: '札', cost: 4, n: 3, d: '強化された札3枚から1枚を山札に加える' }
};
D.PACK_W = { kami: 28, bigkami: 10, oma: 24, ema: 22, card: 16 };
D.SHOP = { items: 3, packs: 2, kamiChance: 0.72 };

/* ---------------- 縁起物(主を倒したあとの3択) ---------------- */
D.ENGI = [
  { id: 'suehiro', name: '末広がり', kj: '扇', max: 1, d: '手札 +1', mods: { hand: 1 } },
  { id: 'senkyaku', name: '千客万来', kj: '千客', max: 1, d: '出し +1', mods: { plays: 1 } },
  { id: 'migaru', name: '身軽', kj: '身軽', max: 2, d: '捨て +1', mods: { discards: 1 } },
  { id: 'mamorikin', name: '御守袋', kj: '守袋', max: 1, d: 'お守りの枠 +1', mods: { oma: 1 } },
  { id: 'mekiki', name: '目利き', kj: '目利', max: 1, d: '茶屋の品書き +1', mods: { shopItems: 1 } },
  { id: 'negiri', name: '値切り', kj: '値切', max: 1, d: '茶屋の入れ替えが毎回1回無料', mods: { freeReroll: 1 } },
  { id: 'kura', name: '蔵', kj: '蔵', max: 2, d: '月末の利子の上限 +5両', mods: { interestCap: 5 } },
  { id: 'taigan', name: '大願', kj: '大願', max: 2, d: 'すべての役の等級 +1' },
  { id: 'shunsai', name: '旬彩', kj: '旬', max: 1, d: '旬の札の上乗せが2倍(+20点)', mods: { shun: 1 } },
  { id: 'shoubai', name: '商売繁盛', kj: '商売', max: 1, d: '勝負の報酬 +2両', mods: { reward: 2 } },
  { id: 'joren', name: '常連', kj: '常連', max: 1, d: '茶屋の品がすべて1両安い', mods: { discount: 1 } },
  { id: 'omiki', name: '御神酒', kj: '神酒', max: 1, d: '主の勝負では 倍 +10', mods: { bossBai: 10 } },
  { id: 'oobukuro', name: '大袋', kj: '大袋', max: 1, d: '袋の中身 +1', mods: { packExtra: 1 } },
  { id: 'oharai', name: 'お祓い', kj: '祓', max: 3, d: '除外できる回数 +2' },
  { id: 'fukubiki', name: '福引き', kj: '福引', max: 9, d: 'お守りを2つもらう(枠が空いていれば)' },
  { id: 'kamidana', name: '神棚', kj: '神棚', max: 9, d: '「上」以上の神札を1つもらう(枠が要る)' },
  { id: 'susuharai', name: '煤払い', kj: '煤払', max: 3, d: '山札からランダムなカス札を4枚取り除く' },
  { id: 'kinzaiku', name: '金細工', kj: '金細', max: 3, d: '山札のランダムな札3枚を金箔の札にする' }
];
D.ENGI_BY = {};
D.ENGI.forEach(e => { D.ENGI_BY[e.id] = e; });

/* ---------------- 相手(一・二の勝負)とお題 ---------------- */
D.ODAI = {
  hikariYaku: { d: '光の役を作る', r: 3 },
  noDiscard: { d: '捨てを使わずに勝つ', r: 3 },
  yanagi: { d: '柳の札で得点する', r: 2 },
  bigPlay: { d: '1回の出しで目標の半分以上', r: 3 },
  sanbon: { d: '三本以上の月の役を作る', r: 3 },
  kasuYaku: { d: 'カスの役を作る', r: 2 },
  oneShot: { d: '1回の出しで勝つ', r: 5 },
  taneYaku: { d: 'タネの役を作る', r: 3 },
  goyomi: { d: '花暦を作る', r: 4 },
  tanYaku: { d: '短冊の役を作る', r: 3 },
  twoPlays: { d: '出し2回以内で勝つ', r: 3 },
  enhanced: { d: '強化した札で得点する', r: 2 },
  multiYaku: { d: '役を2つ同時に作る', r: 3 },
  oneCard: { d: '1枚だけ出して得点する', r: 2 },
  sake: { d: '月見酒か花見酒を作る', r: 4 },
  shun: { d: '旬の札を3回得点させる', r: 2 },
  allKinds: { d: '光・タネ・短冊・カスを1回でそろえて出す', r: 3 },
  fivePlay: { d: '5枚出しで3回得点する', r: 2 }
};
D.OPPS = [
  { id: 'kitsune', name: '狐', kj: '狐', col: '#c8702a', odai: 'hikariYaku', line: '光るものには目がなくてのう' },
  { id: 'tanuki', name: '狸', kj: '狸', col: '#7a5a3a', odai: 'noDiscard', line: '捨てるなんぞ、もったいない' },
  { id: 'kappa', name: '河童', kj: '河', col: '#3f7a5a', odai: 'yanagi', line: '雨の日は調子がいいんだ' },
  { id: 'tengu', name: '天狗', kj: '天', col: '#b8361f', odai: 'bigPlay', line: '一発で決めてみせよ' },
  { id: 'oni', name: '鬼', kj: '鬼', col: '#8a2a2a', odai: 'sanbon', line: '三本そろえて殴り込みだ' },
  { id: 'yukionna', name: '雪女', kj: '雪', col: '#6a8aa8', odai: 'kasuYaku', line: '小さなものほど、積もるのよ' },
  { id: 'zashiki', name: '座敷童', kj: '童', col: '#c23a5b', odai: 'oneShot', line: 'すぐ終わらせてくれたら、福をあげる' },
  { id: 'bakeneko', name: '化け猫', kj: '猫', col: '#5a4a6a', odai: 'taneYaku', line: '鳥も獣も、みんな好物' },
  { id: 'rokurokubi', name: 'ろくろ首', kj: '首', col: '#a63f6b', odai: 'goyomi', line: '首を長くして待ってるよ' },
  { id: 'nekomata', name: '猫又', kj: '又', col: '#4a5a7a', odai: 'tanYaku', line: '短冊に願いを書いてごらん' },
  { id: 'kamaitachi', name: '鎌鼬', kj: '鎌', col: '#5b7a3a', odai: 'twoPlays', line: '速さこそ、すべて' },
  { id: 'tsukumogami', name: '付喪神', kj: '付', col: '#8a6a2a', odai: 'enhanced', line: '大事に手入れした札を見せて' },
  { id: 'nue', name: '鵺', kj: '鵺', col: '#3a3a5a', odai: 'multiYaku', line: 'あれもこれも、混ぜてしまえ' },
  { id: 'hitotsume', name: '一つ目小僧', kj: '目', col: '#2c4a6e', odai: 'oneCard', line: '一枚だけ、よおく見せて' },
  { id: 'umibozu', name: '海坊主', kj: '海', col: '#2a3a4a', odai: 'sake', line: '月を見ながら一杯どうだ' },
  { id: 'azukiarai', name: '小豆洗い', kj: '豆', col: '#7a3a3a', odai: 'shun', line: 'しょきしょき、季節のものを' },
  { id: 'nurikabe', name: 'ぬりかべ', kj: '壁', col: '#6a6a5a', odai: 'allKinds', line: 'ぜんぶ並べて、壁にしよう' },
  { id: 'karakasa', name: '唐傘お化け', kj: '傘', col: '#b8892a', odai: 'fivePlay', line: '五枚そろえて、ぱっと開く' }
];
D.OPP_BY = {};
D.OPPS.forEach(o => { D.OPP_BY[o.id] = o; });

/* ---------------- 主(3勝負目) ----------------
   m: その月の主。tgt: 目標の倍率(ふつうの主は2)。final: 十二月 */
D.BOSSES = [
  { id: 'oimatsu', name: '老松', kj: '松', m: 1, tgt: 2, d: '捨ては1回だけ', mods: { discardsMax: 1 } },
  { id: 'uguisunokimi', name: '鶯の君', kj: '梅', m: 2, tgt: 2, d: '同じ役は、この勝負で1度しか成立しない', once: 1 },
  { id: 'hanabie', name: '花冷え', kj: '桜', m: 3, tgt: 2, d: '出すたびに、手札から2枚がランダムに散る', scatter: 2 },
  { id: 'fujinami', name: '藤波', kj: '藤', m: 4, tgt: 2, d: '短冊札が封じられる(点にも役にもならない)', debuffKind: 'tan' },
  { id: 'yatsuhashiN', name: '八橋', kj: '菖', m: 5, tgt: 2, d: '必ず5枚出さなければならない', mustFive: 1 },
  { id: 'karajishi', name: '唐獅子', kj: '牡', m: 6, tgt: 3, d: '目標がとても大きい' },
  { id: 'ooinoshishi', name: '大猪', kj: '萩', m: 7, tgt: 2, d: 'タネ札が封じられる(点にも役にもならない)', debuffKind: 'tane' },
  { id: 'jugoya', name: '十五夜', kj: '月', m: 8, tgt: 2, d: '札の4枚に1枚が裏向きで配られる', faceDown: 0.25 },
  { id: 'kikujido', name: '菊慈童', kj: '菊', m: 9, tgt: 2, d: '役の点と倍が半分になる', halve: 1 },
  { id: 'kijomomiji', name: '鬼女紅葉', kj: '紅', m: 10, tgt: 2, d: '光札が封じられる(点にも役にもならない)', debuffKind: 'hikari' },
  { id: 'raiko', name: '雷公', kj: '雷', m: 11, tgt: 1.25, d: '出しは1回だけ', mods: { playsMax: 1 } },
  { id: 'hououN', name: '鳳凰', kj: '桐', m: 12, tgt: 2.5, final: 1, d: '出すたびに、神札が1つ眠る(その出しでは効かない)', sleep: 1 },
  // どの月にも出る主
  { id: 'kasumi', name: '霞', kj: '霞', tgt: 2, d: 'はじめの手札がすべて裏向き', firstDown: 1 },
  { id: 'binbogami', name: '貧乏神', kj: '貧', tgt: 2, d: '札を1枚出すたびに1両失う', toll: 1 },
  { id: 'mayoiga', name: '迷い家', kj: '迷', tgt: 2, d: '最初の出しでできた役を、どれも含まない出しは0点', mouth: 1 },
  { id: 'yukinba', name: '雪婆', kj: '雪', tgt: 2, d: '手札 -1', mods: { hand: -1 } },
  { id: 'hyakkiyako', name: '百鬼夜行', kj: '百', tgt: 2, d: '出す・捨てるたびに、3枚しか引けない', drawN: 3 },
  { id: 'yomeiri', name: '狐の嫁入り', kj: '嫁', tgt: 2, d: '出したあとに引く札は裏向き', downAfterPlay: 1 },
  { id: 'oonamazu', name: '大鯰', kj: '鯰', tgt: 2, d: '出すたびに、手札と神札の並びがばらばらになる', shuffle: 1 },
  { id: 'amanojaku', name: '天邪鬼', kj: '天', tgt: 2, d: '出すたびに、成立した役の等級が1下がる(1より下にはならない)', lvDown: 1 },
  { id: 'fuinseki', name: '封じ石', kj: '封', tgt: 2, d: '前の勝負で出した札は封じられる', pillar: 1 }
];
D.BOSS_BY = {};
D.BOSSES.forEach(b => { D.BOSS_BY[b.id] = b; });
D.BOSS_THEME_P = 0.6;   // その月の主が出る確率(残りはどの月にも出る主)

/* ---------------- 開始デッキ ---------------- */
D.DECKS = [
  { id: 'hana', name: '花の札', kj: '花', col: '#c8402a', d: '標準の48枚。特別なルールはない', unlock: { free: 1 } },
  { id: 'shu', name: '朱の札', kj: '朱', col: '#b8361f', d: '捨て +1', mods: { discards: 1 }, unlock: { free: 1 } },
  { id: 'ai', name: '藍の札', kj: '藍', col: '#2c4a6e', d: '出し +1', mods: { plays: 1 }, unlock: { cost: 20 } },
  { id: 'kin', name: '金の札', kj: '金', col: '#b8892a', d: 'はじめから+6両。月末の利子の上限 +5両', mods: { ryo: 6, interestCap: 5 }, unlock: { cost: 25 } },
  { id: 'koyomi', name: '暦の札', kj: '暦', col: '#3f7a5a', d: '旬の札が 点+30・倍+2。月のはじめに山札のカス2枚がその月の札に書き換わる', mods: { shunT: 20, shunB: 2 }, unlock: { cost: 35 } },
  { id: 'hachihachi', name: '八八の札', kj: '八八', col: '#6b4c8a', d: '一度に6枚まで出せる。手札 +1、出し -1', mods: { maxPlay: 1, hand: 1, plays: -1 }, unlock: { cost: 45 } },
  { id: 'koikoi', name: 'こいこいの札', kj: '恋', col: '#c23a5b', d: '目標を超えたあと「こいこい」で続けられ、目標の2倍に届けば報酬が倍。勝負の報酬 -1両', mods: { reward: -1 }, unlock: { cost: 50 } },
  { id: 'midare', name: '乱れ札', kj: '乱', col: '#3a3530', d: '札の月がすべてばらばら。はじめにお守り「月替え」を2つ持つ', unlock: { cost: 50 } }
];
D.DECK_BY = {};
D.DECKS.forEach(d => { D.DECK_BY[d.id] = d; });

/* ---------------- 段位(難易度) ---------------- */
D.STAKES = [null,
  { n: 1, name: '一段', d: '標準' },
  { n: 2, name: '二段', d: '一の勝負の報酬がなくなる' },
  { n: 3, name: '三段', d: '目標 +20%(一〜六月にかけて上がる)' },
  { n: 4, name: '四段', d: '捨て -1' },
  { n: 5, name: '五段', d: '茶屋の品が1両高い' },
  { n: 6, name: '六段', d: '目標がさらに +20%(一〜六月にかけて上がる)' },
  { n: 7, name: '七段', d: '主の目標 +25%(一〜六月にかけて上がる)' },
  { n: 8, name: '八段', d: '出し -1' }
];

/* ---------------- 蔵(周回をまたぐ永久強化。金箔で買う) ---------------- */
D.UPGRADES = [
  { id: 'fukuzeni', name: '福銭', kj: '銭', d: 'はじめの両 +2', max: 3, cost: [10, 20, 35] },
  { id: 'mekikiM', name: '目利き', kj: '目', d: '茶屋の品書き +1', max: 1, cost: [40] },
  { id: 'fukuromashi', name: '袋増し', kj: '袋', d: '茶屋の袋 +1', max: 1, cost: [30] },
  { id: 'mamoriM', name: 'お守り袋', kj: '守', d: 'お守りの枠 +1', max: 1, cost: [35] },
  { id: 'negiriM', name: '値切り上手', kj: '値', d: '茶屋の入れ替えが毎回1回無料', max: 1, cost: [25] },
  { id: 'oharaiM', name: 'お祓いの心得', kj: '祓', d: '除外できる回数 +1', max: 2, cost: [15, 30] },
  { id: 'risoku', name: '蔵の利子', kj: '利', d: '月末の利子の上限 +2両', max: 2, cost: [20, 40] },
  { id: 'hatsumode', name: '初詣', kj: '詣', d: 'はじめにお守りを1つ持つ', max: 1, cost: [25] },
  { id: 'engikatsugi', name: '縁起担ぎ', kj: '縁', d: '縁起物の候補 +1(4択)', max: 1, cost: [30] },
  { id: 'goshugi', name: 'ご祝儀', kj: '祝', d: 'ご褒美の候補 +1(4択)', max: 1, cost: [45] }
];
D.UPG_BY = {};
D.UPGRADES.forEach(u => { D.UPG_BY[u.id] = u; });

/* 金箔(周回の通貨)の稼ぎ */
D.KINPAKU = { win: 1, boss: 3, clear: 10, endlessMonth: 3, stakeBonus: 0.25 };

/* ---------------- 実績(s = セーブデータ) ---------------- */
D.ACH = [
  { id: 'first', name: '初勝負', d: '勝負に1回勝つ', g: 5, t: s => s.stats.wins >= 1 },
  { id: 'boss1', name: '主を倒す', d: '主を1体倒す', g: 8, t: s => s.stats.bosses >= 1 },
  { id: 'm3', name: '弥生を越えて', d: '3か月を乗り切る', g: 10, t: s => s.best.month >= 4 },
  { id: 'm6', name: '半年', d: '6か月を乗り切る', g: 15, t: s => s.best.month >= 7 },
  { id: 'clear', name: '花暦の一年', d: '12か月を乗り切る', g: 40, t: s => s.stats.clears >= 1 },
  { id: 'goko', name: '五光', d: '五光を作る', g: 30, t: s => (s.yaku.goko || 0) >= 1 },
  { id: 'shiko', name: '四つの光', d: '四光か雨四光を作る', g: 15, t: s => (s.yaku.shiko || 0) + (s.yaku.ameshiko || 0) >= 1 },
  { id: 'isc', name: '猪鹿蝶', d: '猪鹿蝶を作る', g: 10, t: s => (s.yaku.inoshikacho || 0) >= 1 },
  { id: 'akaao', name: '赤と青', d: '赤短と青短の両方を作る', g: 15, t: s => (s.yaku.akatan || 0) >= 1 && (s.yaku.aotan || 0) >= 1 },
  { id: 'sake', name: '月見で一杯、花見で一杯', d: '月見酒と花見酒の両方を作る', g: 10, t: s => (s.yaku.tsukimi || 0) >= 1 && (s.yaku.hanami || 0) >= 1 },
  { id: 'teshi', name: '手四', d: '手四を作る', g: 10, t: s => (s.yaku.teshi || 0) >= 1 },
  { id: 'gomai', name: '五枚月', d: '五枚月を作る', g: 25, t: s => (s.yaku.gomai || 0) >= 1 },
  { id: 'nagashi', name: '短冊流し', d: '花暦とタンを同時に作る', g: 20, t: s => s.stats.goyomiTan >= 1 },
  { id: 'multi4', name: '役満開', d: '1回の出しで役を4つ以上', g: 25, t: s => s.stats.maxYaku >= 4 },
  { id: 'p10k', name: '一万点', d: '1回の出しで10,000点', g: 15, t: s => s.best.play >= 10000 },
  { id: 'p100k', name: '十万点', d: '1回の出しで100,000点', g: 30, t: s => s.best.play >= 100000 },
  { id: 'p1m', name: '百万点', d: '1回の出しで1,000,000点', g: 50, t: s => s.best.play >= 1000000 },
  { id: 'evolve', name: '進化', d: '神札を進化させる', g: 15, t: s => s.stats.evolve >= 1 },
  { id: 'full', name: '満員御礼', d: '神札の枠を5つ埋める', g: 10, t: s => s.stats.fullKami >= 1 },
  { id: 'rich', name: '長者', d: '両を一度に50両持つ', g: 15, t: s => s.best.ryo >= 50 },
  { id: 'thin', name: '断捨離', d: '山札を36枚以下にする', g: 15, t: s => s.stats.thinDeck >= 1 },
  { id: 'onecard', name: '一枚入魂', d: '1枚だけ出して1,000点以上', g: 20, t: s => s.stats.oneCard1000 >= 1 },
  { id: 'raiko', name: '雷公を鎮める', d: '主「雷公」を倒す', g: 15, t: s => (s.bossKill.raiko || 0) >= 1 },
  { id: 'koikoi', name: 'こいこい', d: 'こいこいで目標の2倍に届く', g: 15, t: s => s.stats.koikoi >= 1 },
  { id: 'endless', name: '二年目の春', d: 'エンドレスで十五か月目に着く', g: 30, t: s => s.best.endless >= 15 },
  { id: 'stake4', name: '四段', d: '四段以上で1年を乗り切る', g: 40, t: s => s.best.stake >= 4 },
  { id: 'stake8', name: '八段', d: '八段で1年を乗り切る', g: 100, t: s => s.best.stake >= 8 },
  { id: 'decks4', name: '札の目利き', d: '4種類のデッキで1年を乗り切る', g: 40, t: s => Object.keys(s.deckClear).length >= 4 },
  { id: 'daily', name: '日課', d: 'デイリーを遊ぶ', g: 5, t: s => s.stats.daily >= 1 },
  { id: 'dex30', name: '神札収集家', d: '神札を30種見つける', g: 20, t: s => Object.keys(s.dex).length >= 30 },
  { id: 'nokami', name: '神頼みせず', d: '神札を持たずに主を倒す', g: 20, t: s => s.stats.bossNoKami >= 1 },
  { id: 'lv5', name: '極めた役', d: 'ひとつの役を等級5にする', g: 15, t: s => s.stats.maxLv >= 5 }
];

/* ---------------- 表示の調整 ---------------- */
D.ANIM = { speeds: [1, 1.7, 3] };   // ふつう・はやい・とても速い
