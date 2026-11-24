// 隨機領袖＋基地自動組牌互打，測通用效果系統：node tools/simall.js 20
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'gfx.js', 'programs.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const leaders = SWU.DB.list.filter((c) => c.t === 'Leader');
const bases = SWU.DB.list.filter((c) => c.t === 'Base');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const games = +process.argv[2] || 10;
let wins = [0, 0], rounds = 0, errs = 0, manual = 0, crashes = 0, stuck = 0;
const errMsgs = {};
(async () => {
  for (let i = 0; i < games; i++) {
    const mkDeck = () => {
      for (let k = 0; k < 20; k++) {
        const d = SWU.Deck.autoBuild(pick(leaders).key, pick(bases).key);
        if (d && d.leader && SWU.Deck.count(d) >= 50) return d;
      }
    };
    const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
    const io = () => ({ chooseAction: async (g, p, a) => SWU.AI.heur.chooseAction(g, p, a), choose: async (g, p, r) => SWU.AI.heur.choose(g, p, r), resolveManual: async () => { manual++; } });
    const g = new SWU.Game([mk(mkDeck(), 'A'), mk(mkDeck(), 'B')], [io(), io()]);
    g.on((ev) => { if (ev.type === 'crash') { crashes++; console.log('CRASH', ev.error && ev.error.stack); } });
    const timer = new Promise((r) => setTimeout(() => r('timeout'), 20000));
    const r = await Promise.race([g.run(), timer]);
    if (r === 'timeout') { stuck++; console.log('STUCK round', g.G.round, g.G.log.slice(-4).map((l) => SWU.fmtLog(l, 'en'))); continue; }
    for (const l of g.G.log.filter((l) => l.k === 'logEffectError')) { errs++; errMsgs[l.a[0]] = (errMsgs[l.a[0]] || 0) + 1; }
    if (g.G.winner != null) wins[g.G.winner]++;
    else console.log('no winner, round', g.G.round);
    rounds += g.G.round;
  }
  console.log('wins', wins, 'avg rounds', (rounds / games).toFixed(1), 'effect errors', errs, 'manual', manual, 'crashes', crashes, 'stuck', stuck);
  console.log(errMsgs);
  process.exit(0);
})();
