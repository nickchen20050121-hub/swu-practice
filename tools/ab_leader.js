// 領袖專屬規則 A/B：固定一副牌，同種子、同座位、同對手，各用 OPTA 和 OPTB 打一局（成對比較）；對手一律用 OPTX
// 用法：OPTA='{...}' OPTB='{...}' OPTX='{...}' node tools/ab_leader.js 牌組id 成對數 起始
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const id = process.argv[2], N = +process.argv[3] || 20, off = +process.argv[4] || 0;
const meta = window.SWU_META_DECKS, L = meta.find((d) => d.id === id), others = meta.filter((d) => d !== L);
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const OA = JSON.parse(process.env.OPTA || '{}'), OB = JSON.parse(process.env.OPTB || '{}'), OX = JSON.parse(process.env.OPTX || '{}');
const ce = console.error, cw = console.warn;
const io = (O) => {
  let force = null, steps = 0;
  return {
    chooseAction: async (g, p, a) => {
      if (++steps > 3000) throw new Error('too long');
      H.cfg = O;
      const r = O.rule ? { act: H.chooseAction(g, p, a) } : await H.chooseActionSmart(g, p, a, O);
      force = r.force != null && r.act && r.act.type === 'attack' ? { uid: r.act.uid, target: r.force } : null;
      return r.act;
    },
    choose: async (g, p, r) => {
      H.cfg = O;
      if (force && r.kind === 'target' && r.ctx && r.ctx.uid === force.uid && r.options.some((o) => o.id === force.target)) { const t = force.target; force = null; return [t]; }
      return H.choose(g, p, r);
    },
    resolveManual: async () => {},
  };
};
async function one(O, i) {
  const seat = i % 2, X = others[Math.floor(i / 2) % others.length];
  const decks = seat === 0 ? [mk(L, 'L'), mk(X, 'X')] : [mk(X, 'X'), mk(L, 'L')];
  const g = new SWU.Game(decks, seat === 0 ? [io(O), io(OX)] : [io(OX), io(O)], { seed: 700000 + i });
  console.error = () => {}; console.warn = () => {};
  try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
  return g.G.winner === seat ? 1 : 0;
}
(async () => {
  let a = 0, b = 0, d = 0;
  for (let i = off; i < off + N; i++) { const x = await one(OA, i), y = await one(OB, i); a += x; b += y; if (x !== y) d++; }
  console.log('A', a, 'B', b, 'pairs', N, 'disc', d);
})();
