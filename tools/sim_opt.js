// AI 設定比較：OPTA 對 OPTB（JSON，smart 參數；可加 _choose:'v2' 等開關），換座位各打一半
// 用法：OPTA='{...}' OPTB='{...}' node tools/sim_opt.js 局數 [起始] [luke]
//  luke：B 方固定用柏偉的路克（台北 PQ 版），A 方輪流用比賽牌組
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js','pilots.js','effects2.js','gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const games = +process.argv[2] || 16, off = +process.argv[3] || 0, luke = process.argv[4] === 'luke';
SWU.AI.settings.owner = luke;
const pres = SWU.Deck.presets();
const lukeD = pres.find((d) => d.id === 'preset-pq');
const meta = pres.filter((d) => !d.id || !String(d.id).startsWith('preset-'));
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const OA = JSON.parse(process.env.OPTA || '{}'), OB = JSON.parse(process.env.OPTB || '{}');
let aW = 0, bW = 0, none = 0, ms = 0, dec = 0, tmax = 0;
(async () => {
  for (let i = 0; i < games; i++) {
    const aSeat = i % 2;
    const io = (O) => {
      let force = null;
      return {
        chooseAction: async (g, p, a) => {
          H.cfg = O;
          SWU.AI.settings.style = O.style || 'default';
          const t = Date.now();
          const r = O.rule ? { act: H.chooseAction(g, p, a) } : await H.chooseActionSmart(g, p, a, O);
          const dt = Date.now() - t;
          ms += dt; dec++; tmax = Math.max(tmax, dt);
          force = r.force != null && r.act && r.act.type === 'attack' ? { uid: r.act.uid, target: r.force } : null;
          return r.act;
        },
        choose: async (g, p, r) => {
          H.cfg = O;
          SWU.AI.settings.style = O.style || 'default';
          if (force && r.kind === 'target' && r.ctx && r.ctx.uid === force.uid && r.options.some((o) => o.id === force.target)) {
            const t = force.target;
            force = null;
            return [t];
          }
          return H.choose(g, p, r);
        },
        resolveManual: async () => {},
      };
    };
    // 每 4 局一組：換座位也換牌組，排除「A 剛好拿到強牌組」的偏差
    const k = Math.floor(i / 4) + off;
    let dA = meta[k % meta.length], dB = luke ? lukeD : meta[(k + 1) % meta.length];
    if (!luke && Math.floor(i / 2) % 2) [dA, dB] = [dB, dA];
    const decks = aSeat === 0 ? [mk(dA, 'A'), mk(dB, 'B')] : [mk(dB, 'B'), mk(dA, 'A')];
    const g = new SWU.Game(decks, aSeat === 0 ? [io(OA), io(OB)] : [io(OB), io(OA)]);
    await g.run();
    if (g.G.winner == null) none++;
    else if (g.G.winner === aSeat) aW++;
    else bW++;
  }
  console.log('A', aW, 'B', bW, 'none', none, '| avg ms', (ms / Math.max(1, dec)).toFixed(0), 'max', tmax);
})();
