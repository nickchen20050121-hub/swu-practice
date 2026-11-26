// 依領袖調規則參數：固定一副牌（領袖＋基地），候選參數 vs 目前最佳，同一個種子、同座位、同對手各打一局（成對比較）
// 對手一律用 H.RP。用法：node tools/tune_leader.js 牌組id 分鐘 每輪成對數 輸出.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const id = process.argv[2], mins = +process.argv[3] || 30, N = +process.argv[4] || 150, out = process.argv[5] || 'rpl_' + id + '.json';
const meta = window.SWU_META_DECKS;
const L = meta.find((d) => d.id === id);
const others = meta.filter((d) => d !== L && (!process.env.OPP || process.env.OPP.split(',').includes(d.id)));
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const ce = console.error, cw = console.warn;
async function one(rpL, i, seed) {
  const seat = i % 2, X = others[Math.floor(i / 2) % others.length];
  let steps = 0;
  const io = (rp) => ({
    chooseAction: async (g, p, acts) => { if (++steps > 3000) throw new Error('too long'); H.cfg = { rp }; return H.chooseAction(g, p, acts); },
    choose: async (g, p, r) => ((H.cfg = { rp }), H.choose(g, p, r)),
    resolveManual: async () => {},
  });
  const decks = seat === 0 ? [mk(L, 'L'), mk(X, 'X')] : [mk(X, 'X'), mk(L, 'L')];
  const g = new SWU.Game(decks, seat === 0 ? [io(rpL), io(H.RP)] : [io(H.RP), io(rpL)], { seed });
  console.error = () => {}; console.warn = () => {};
  try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
  return g.G.winner === seat ? 1 : 0;
}
async function pair(rA, rB, n, s0) {
  let a = 0, b = 0, d = 0;
  for (let i = 0; i < n; i++) {
    const seed = 900000 + s0 + i;
    const x = await one(rA, i, seed), y = await one(rB, i, seed);
    a += x; b += y; if (x !== y) d++;
  }
  return [a, b, d];
}
(async () => {
  const start = process.env.START ? { ...H.RPL[L.leader] } : { ...H.RP };
  let best = { ...start };
  const keys = Object.keys(H.RP);
  const t0 = Date.now();
  let it = 0, s = +(process.env.S0 || 0);
  const log = [];
  while (Date.now() - t0 < mins * 60000) {
    it++;
    const cand = { ...best };
    for (let j = 0; j < 3; j++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      cand[k] = +(cand[k] * Math.exp((Math.random() * 2 - 1) * 0.6) + (Math.random() < 0.2 ? Math.random() - 0.5 : 0)).toFixed(3);
    }
    const [a, b, d] = await pair(cand, best, N, s);
    s += N;
    const acc = a - b >= Math.max(3, 1.5 * Math.sqrt(d));
    log.push({ it, a, b, d, acc });
    console.log(`it ${it} cand ${a} best ${b} disc ${d} ${acc ? 'ACCEPT ' + JSON.stringify(cand) : ''}`);
    if (acc) best = cand;
    fs.writeFileSync(out, JSON.stringify({ id, leader: L.leader, best, log }, null, 1));
  }
  const FN = +(process.env.FINALN || 400);
  const [a, b, d] = await pair(best, start, FN, 500000);
  console.log('FINAL', id, L.leader, 'best', a, 'start', b, 'of', FN, 'disc', d);
  fs.writeFileSync(out, JSON.stringify({ id, leader: L.leader, best, log, final: [a, b, d, FN] }, null, 1));
})();
