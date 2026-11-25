// 驗證調過的局面評分權重：新權重 對 原本權重，換座位、隨機牌組。用法：node tools/eval_weights.js 權重json 局數 [等級=2]
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
const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const games = +process.argv[3] || 40, LV = +process.argv[4] || 2;
const KEYS = Object.keys(H.EW0);
const NEW = J.W || Object.fromEntries(KEYS.map((k) => [k, H.EW0[k] * Math.exp((J.theta || {})[k] || 0)]));
const OLD = { ...H.EW0 };
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
(async () => {
  let nw = 0, ow = 0, none = 0;
  for (let i = 0; i < games; i += 2) {
    const a = pres[Math.floor(Math.random() * pres.length)], b = pres[Math.floor(Math.random() * pres.length)];
    for (const seat of [0, 1]) {
      const g = new SWU.Game([mk(a, 'X'), mk(b, 'Y')], [io(seat === 0 ? NEW : OLD), io(seat === 1 ? NEW : OLD)]);
      await g.run();
      if (g.G.winner == null) none++;
      else if (g.G.winner === seat) nw++;
      else ow++;
    }
  }
  fs.writeSync(1, `new ${nw} old ${ow} none ${none}\n`);
})();
