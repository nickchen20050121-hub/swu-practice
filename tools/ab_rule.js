// 規則型打法 A/B：CFGA、CFGB（JSON，會併入 rp: H.RP）各自的設定，平衡座位與牌組
// 用法：CFGA='{"resKey":3}' CFGB='{}' node tools/ab_rule.js 局數 起始種子
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const N = +process.argv[2] || 200, seed0 = +process.argv[3] || 0;
const A = { rp: H.RP, ...JSON.parse(process.env.CFGA || '{}') }, B = { rp: H.RP, ...JSON.parse(process.env.CFGB || '{}') };
const meta = SWU.Deck.presets().filter((d) => !d.id || !String(d.id).startsWith('preset-'));
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const ce = console.error, cw = console.warn;
(async () => {
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) {
    const aSeat = i % 2, k = Math.floor(i / 4) + seed0;
    let dA = meta[k % meta.length], dB = meta[(k * 3 + 1) % meta.length];
    if (Math.floor(i / 2) % 2) [dA, dB] = [dB, dA];
    let steps = 0;
    const io = (cfg) => ({
      chooseAction: async (g, p, acts) => { if (++steps > 3000) throw new Error('too long'); H.cfg = cfg; return H.chooseAction(g, p, acts); },
      choose: async (g, p, r) => ((H.cfg = cfg), H.choose(g, p, r)),
      resolveManual: async () => {},
    });
    const decks = aSeat === 0 ? [mk(dA, 'A'), mk(dB, 'B')] : [mk(dB, 'B'), mk(dA, 'A')];
    const g = new SWU.Game(decks, aSeat === 0 ? [io(A), io(B)] : [io(B), io(A)]);
    console.error = () => {}; console.warn = () => {};
    try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
    if (g.G.winner === aSeat) a++; else if (g.G.winner != null) b++;
  }
  console.log('A', a, 'B', b);
})();
