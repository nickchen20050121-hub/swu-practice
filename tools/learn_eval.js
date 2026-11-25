// 從自我對戰學局面評分：記錄每回合第一個決定時的局面特徵，打完用勝負做邏輯迴歸
// 用法：node tools/learn_eval.js 局數 起始 輸出.jsonl   （OPT 環境變數＝雙方 smart 參數）
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const games = +process.argv[2] || 10, off = +process.argv[3] || 0, out = process.argv[4] || 'feat.jsonl';
const pres = SWU.Deck.presets();
const meta = pres.filter((d) => !d.id || !String(d.id).startsWith('preset-'));
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const O = JSON.parse(process.env.OPT || '{"initFix":true,"attackFirst":0.5}');
// 和 H.evalState 的每一項權重對應的特徵（不含風格加成）
const feats = (g, p) => {
  const G = g.G, me = g.P(p), op = g.P(1 - p);
  const hp = (P) => (P.base.card.h || 30) - P.base.damage;
  const F = { pw: 0, rm: 0, cost: 0, leader: 0, shield: 0, rdyMe: 0, rdyOp: 0, hp: 0, opLow: 0, myLow: 0, hand: 0, res: 0, ldReady: 0 };
  for (const [P, sg] of [[me, 1], [op, -1]]) for (const u of P.units) {
    const pw = g.power(u);
    F.pw += sg * pw; F.rm += sg * g.remaining(u); F.cost += sg * (u.card.c || 0);
    if (u.isLeader) F.leader += sg;
    if ((u.upgrades || []).some((x) => x.card.n === 'Shield')) F.shield += sg;
    if (!u.exhausted) { if (sg > 0) F.rdyMe += pw; else F.rdyOp -= pw; }
  }
  const myHp = hp(me), opHp = hp(op);
  F.hp = myHp - opHp; F.opLow = Math.max(0, 10 - opHp); F.myLow = -Math.max(0, 10 - myHp);
  F.hand = me.hand.length - op.hand.length; F.res = me.resources.length - op.resources.length;
  F.ldReady = me.leader && !me.leader.deployed && !me.leader.exhausted ? 1 : 0;
  return F;
};
(async () => {
  const fd = fs.openSync(out, 'a');
  for (let i = 0; i < games; i++) {
    const rows = [], seen = new Set();
    const io = () => ({
      chooseAction: async (g, p, a) => {
        H.cfg = O;
        const key = g.G.round + ':' + p;
        if (!seen.has(key) && g.G.round >= 2) { seen.add(key); rows.push({ p, round: g.G.round, F: feats(g, p) }); }
        return (await H.chooseActionSmart(g, p, a, O)).act;
      },
      choose: async (g, p, r) => { H.cfg = O; return H.choose(g, p, r); },
      resolveManual: async () => {},
    });
    const k = i + off;
    const dA = meta[k % meta.length], dB = meta[(k * 7 + 3) % meta.length];
    const g = new SWU.Game([mk(dA, 'A'), mk(dB, 'B')], [io(), io()]);
    await g.run();
    if (g.G.winner == null) continue;
    for (const r of rows) fs.writeSync(fd, JSON.stringify({ g: k, round: r.round, win: r.p === g.G.winner ? 1 : 0, F: r.F }) + '\n');
  }
  fs.closeSync(fd);
  console.log('done', games);
})();
