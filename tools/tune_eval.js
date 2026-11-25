// 自我對戰調局面評分權重（SPSA）：每輪把權重往隨機方向 ±c 推，兩邊對打（換座位、多組牌），往贏的方向更新。
// 用法：node tools/tune_eval.js 輸出檔 輪數 [等級=2] [每輪局數=4] [起始權重json檔]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js'])
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const pres = SWU.Deck.presets();
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const H = SWU.AI.heur;
const out = process.argv[2], iters = +process.argv[3] || 50, LV = +process.argv[4] || 2, per = +process.argv[5] || 4;
const KEYS = Object.keys(H.EW0);
let theta = Object.fromEntries(KEYS.map((k) => [k, 0]));
if (process.argv[6]) theta = { ...theta, ...JSON.parse(fs.readFileSync(process.argv[6], 'utf8')).theta };
const toW = (th) => Object.fromEntries(KEYS.map((k) => [k, H.EW0[k] * Math.exp(th[k])]));
const log = (s) => fs.writeSync(1, s + '\n');
async function play(W0, W1, d0, d1) {
  const io = (W) => {
    let force = null;
    return {
      chooseAction: async (g, p, a) => {
        H.EW = W;
        const r = await H.levelAction(g, p, a, LV);
        force = r.force != null && r.act && r.act.type === 'attack' ? { uid: r.act.uid, target: r.force } : null;
        return r.act;
      },
      choose: async (g, p, r) => {
        H.EW = W;
        if (force && r.kind === 'target' && r.ctx && r.ctx.uid === force.uid && r.options.some((o) => o.id === force.target)) {
          const t = force.target;
          force = null;
          return [t];
        }
        return H.levelChoose(g, p, r, LV);
      },
      resolveManual: async () => {},
    };
  };
  const g = new SWU.Game([mk(d0, 'X'), mk(d1, 'Y')], [io(W0), io(W1)]);
  await g.run();
  return g.G.winner;
}
(async () => {
  const c = 0.25;
  for (let it = 0; it < iters; it++) {
    const delta = Object.fromEntries(KEYS.map((k) => [k, Math.random() < 0.5 ? -1 : 1]));
    const tp = {}, tm = {};
    for (const k of KEYS) (tp[k] = theta[k] + c * delta[k]), (tm[k] = theta[k] - c * delta[k]);
    const Wp = toW(tp), Wm = toW(tm);
    let score = 0, n = 0;
    for (let j = 0; j < per; j += 2) {
      const a = pres[Math.floor(Math.random() * pres.length)], b = pres[Math.floor(Math.random() * pres.length)];
      // 同一組牌換座位各打一次
      for (const plusSeat of [0, 1]) {
        const w = await play(plusSeat === 0 ? Wp : Wm, plusSeat === 0 ? Wm : Wp, a, b);
        if (w != null) (score += w === plusSeat ? 1 : -1), n++;
      }
    }
    const a = 0.12 / Math.pow(1 + it / 20, 0.602);
    if (n) for (const k of KEYS) theta[k] = Math.max(-1.5, Math.min(1.5, theta[k] + (a * (score / n)) / delta[k]));
    log(`it ${it} score ${score}/${n} ` + KEYS.map((k) => k + '=' + toW(theta)[k].toFixed(2)).join(' '));
    fs.writeFileSync(out, JSON.stringify({ it: it + 1, theta, W: toW(theta) }, null, 1));
  }
})();
