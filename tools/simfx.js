// 用「手寫效果」卡組牌互打，抓效果錯誤：node tools/simfx.js 40 [filter]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const keys = SWU.EFFECTS.list().filter((k) => !process.argv[3] || k.includes(process.argv[3].toLowerCase()));
const pool = [...new Set(keys.map((k) => k.split('#')[0]))].map((k) => SWU.DB.byKey.get(k)).filter(Boolean);
const mains = pool.filter((c) => ['Unit', 'Event', 'Upgrade'].includes(c.t));
const leaders = pool.filter((c) => c.t === 'Leader');
const allLeaders = SWU.DB.list.filter((c) => c.t === 'Leader');
const bases = pool.filter((c) => c.t === 'Base').concat(SWU.DB.list.filter((c) => c.t === 'Base').slice(0, 5));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const games = +process.argv[2] || 20;
let wins = [0, 0], errs = 0, manual = 0, crashes = 0, stuck = 0;
const errMsgs = {}, manMsgs = {};
const oe = console.error;
console.error = (...a) => { const s = a.map((x) => (x && x.stack) || String(x)).join(' ').split('\n').slice(0, 3).join(' | '); errMsgs[s] = (errMsgs[s] || 0) + 1; };
(async () => {
  for (let i = 0; i < games; i++) {
    const mk = (n) => {
      const cards = [];
      const sel = SWU.shuffle([...mains]).slice(0, 25);
      for (const c of sel) cards.push(c, c);
      const L = Math.random() < 0.7 && leaders.length ? pick(leaders) : pick(allLeaders);
      return { name: n, leader: L, base: pick(bases), cards };
    };
    const io = () => ({ chooseAction: async (g, p, a) => SWU.AI.heur.chooseAction(g, p, a), choose: async (g, p, r) => SWU.AI.heur.choose(g, p, r), resolveManual: async (g, p, info) => { manual++; const k = info.card.key + ' | ' + info.text.slice(0, 60); manMsgs[k] = (manMsgs[k] || 0) + 1; } });
    const g = new SWU.Game([mk('A'), mk('B')], [io(), io()]);
    g.on((ev) => { if (ev.type === 'crash') { crashes++; console.log('CRASH', ev.error && ev.error.stack); } });
    const timer = new Promise((r) => setTimeout(() => r('timeout'), 30000));
    const r = await Promise.race([g.run(), timer]);
    if (r === 'timeout') { stuck++; console.log('STUCK round', g.G.round, g.G.log.slice(-4).map((l) => SWU.fmtLog(l, 'en'))); continue; }
    for (const l of g.G.log.filter((l) => l.k === 'logEffectError')) { errs++; }
    if (g.G.winner != null) wins[g.G.winner]++;
  }
  console.log('games', games, 'wins', wins, 'effect errors', errs, 'manual', manual, 'crashes', crashes, 'stuck', stuck);
  console.log('ERRORS', errMsgs);
  console.log('MANUAL', Object.entries(manMsgs).sort((a, b) => b[1] - a[1]).slice(0, 15));
  process.exit(0);
})();
