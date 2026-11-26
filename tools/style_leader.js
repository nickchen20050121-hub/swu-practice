// 打法風格池：固定一副牌，每種風格 vs 預設，同種子成對比較（規則型），找出這個領袖最適合的風格
// 用法：node tools/style_leader.js 牌組id 成對數
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const id = process.argv[2], N = +process.argv[3] || 200;
const meta = window.SWU_META_DECKS, L = meta.find((d) => d.id === id), others = meta.filter((d) => d !== L);
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const R = H.RP, mul = (o) => { const r = { ...R }; for (const k in o) r[k] = +(R[k] * o[k]).toFixed(3); return r; };
const STY = {
  face: { rp: mul({ atk0: 1.3, kill: 0.6, safeKill: 0.6 }), baseW: 1.8 },         // 偏打基地
  control: { rp: mul({ kill: 2.5, safeKill: 2, chip: 1.5 }), baseW: 0.6 },        // 偏解怪
  develop: { rp: mul({ play0: 1.3, playC: 2, atk0: 0.8, abil: 1.3 }), baseW: 1.1 }, // 偏鋪場／累積價值
  tempo: { rp: mul({ deploy: 1.5, abil: 1.5, safeKill: 1.5 }), baseW: 1.3 },     // 偏領袖能力與搶節奏
};
const ce = console.error, cw = console.warn;
async function one(cfg, i) {
  const seat = i % 2, X = others[Math.floor(i / 2) % others.length];
  let steps = 0;
  const io = (c) => ({
    chooseAction: async (g, p, acts) => { if (++steps > 3000) throw new Error('too long'); H.cfg = c; return H.chooseAction(g, p, acts); },
    choose: async (g, p, r) => ((H.cfg = c), H.choose(g, p, r)),
    resolveManual: async () => {},
  });
  const base = { rp: R };
  const decks = seat === 0 ? [mk(L, 'L'), mk(X, 'X')] : [mk(X, 'X'), mk(L, 'L')];
  const g = new SWU.Game(decks, seat === 0 ? [io(cfg), io(base)] : [io(base), io(cfg)], { seed: 800000 + i });
  console.error = () => {}; console.warn = () => {};
  try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
  return g.G.winner === seat ? 1 : 0;
}
(async () => {
  const res = {};
  const def = []; for (let i = 0; i < N; i++) def.push(await one({ rp: R }, i));
  const d0 = def.reduce((a, b) => a + b, 0);
  for (const [k, c] of Object.entries(STY)) {
    let a = 0, disc = 0;
    for (let i = 0; i < N; i++) { const x = await one(c, i); a += x; if (x !== def[i]) disc++; }
    res[k] = [a, d0, disc];
    console.log(id, L.leader, k, a, 'vs default', d0, 'of', N, 'disc', disc);
  }
})();
