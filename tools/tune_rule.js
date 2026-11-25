// 規則型打法（H.chooseAction／bestAttack）的爬山調參：候選參數 vs 目前最佳，規則對規則快速對打
// 用法：node tools/tune_rule.js 分鐘數 每輪局數 輸出.json [起始參數.json]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const mins = process.argv[2] != null ? +process.argv[2] : 60, N = +process.argv[3] || 400, out = process.argv[4] || 'rp.json';
const meta = SWU.Deck.presets().filter((d) => !d.id || !String(d.id).startsWith('preset-'));
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const ce = console.error, cw = console.warn;
async function match(rA, rB, n, seed0) {
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const aSeat = i % 2, k = Math.floor(i / 4) + seed0;
    let dA = meta[k % meta.length], dB = meta[(k * 3 + 1) % meta.length];
    if (Math.floor(i / 2) % 2) [dA, dB] = [dB, dA];
    let steps = 0;
    const io = (rp) => ({
      chooseAction: async (g, p, acts) => {
        if (++steps > 3000) throw new Error('too long');
        H.cfg = { rp };
        return H.chooseAction(g, p, acts);
      },
      choose: async (g, p, r) => ((H.cfg = { rp }), H.choose(g, p, r)),
      resolveManual: async () => {},
    });
    const decks = aSeat === 0 ? [mk(dA, 'A'), mk(dB, 'B')] : [mk(dB, 'B'), mk(dA, 'A')];
    const g = new SWU.Game(decks, aSeat === 0 ? [io(rA), io(rB)] : [io(rB), io(rA)]);
    console.error = () => {}; console.warn = () => {};
    try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
    if (g.G.winner === aSeat) a++;
    else if (g.G.winner != null) b++;
  }
  return [a, b];
}
(async () => {
  let best = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], 'utf8')) : { ...H.RP0 };
  const keys = Object.keys(H.RP0);
  const t0 = Date.now();
  let it = 0, seed = 0;
  const log = [];
  while (Date.now() - t0 < mins * 60000) {
    it++;
    const cand = { ...best };
    for (let j = 0; j < 3; j++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      const z = (Math.random() * 2 - 1) * 0.6;
      cand[k] = +(cand[k] * Math.exp(z) + (Math.random() < 0.2 ? (Math.random() - 0.5) : 0)).toFixed(3);
    }
    const [a, b] = await match(cand, best, N, seed);
    seed += N / 4;
    const acc = a > b && a / (a + b) >= 0.53;
    log.push({ it, a, b, acc });
    console.log(`it ${it} cand ${a}:${b} ${acc ? 'ACCEPT' : ''} ${acc ? JSON.stringify(cand) : ''}`);
    if (acc) best = cand;
    fs.writeFileSync(out, JSON.stringify({ best, log }, null, 1));
  }
  // 最後：最佳 vs 原本，用沒看過的牌組組合各 1000 局
  const FN = +(process.env.FINALN || 1000);
  const [a, b] = await match(best, H.RP0, FN, +(process.env.FSEED || 5000));
  console.log('FINAL best vs RP0', a, b, JSON.stringify(best));
  fs.writeFileSync(out, JSON.stringify({ best, log, final: [a, b] }, null, 1));
})();
