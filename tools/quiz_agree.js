// 用柏偉的出題答案檢查：電腦（某組設定）在每個題目局面會不會選跟他一樣的動作
// 用法：OPT='{...}' node tools/quiz_agree.js 答案紀錄.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js', 'quiz.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const OPT = { initFix: true, attackFirst: 0.5, rollout: 4, top: 6, ...JSON.parse(process.env.OPT || '{}') };
const ans = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).quiz || [];
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const ce = console.error, cw = console.warn;
(async () => {
  let agree = 0, n = 0;
  const seen = new Set();
  for (const a of ans) {
    if (seen.has(a.id) || /按錯/.test(a.note || '')) continue;
    seen.add(a.id);
    const q = window.SWU_QUIZ.find((x) => x.id === a.id);
    if (!q) continue;
    const dA = window.SWU_META_DECKS.find((d) => d.id === q.a), dB = window.SWU_META_DECKS.find((d) => d.id === q.b);
    let pick = null;
    const STOP = {};
    const io = { chooseAction: async (g, p, acts) => { if (g.replaying) return null; H.cfg = OPT; const r = await H.chooseActionSmart(g, p, acts, OPT); const c = r.act && r.act.uid != null ? g.findAny(r.act.uid) : null; pick = { type: r.act && r.act.type, card: c ? c.card.key : null }; throw STOP; }, choose: async (g, p, r) => H.choose(g, p, r), resolveManual: async () => {} };
    const g = new SWU.Game([mk(dA, 'A'), mk(dB, 'B')], [io, io], { seed: q.seed, uid0: q.uid0, replay: q.rec });
    console.error = () => {}; console.warn = () => {};
    try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
    if (!pick) continue;
    n++;
    const mine = a.mine.type === 'play' && !a.mine.card ? null : a.mine; // 舊版紀錄裝備卡沒記卡名
    const same = mine ? pick.type === mine.type && (pick.card || null) === (mine.card || null) : pick.type === 'play' && /渴望|野性|附帶/.test((a.myLogs || [])[0] || '');
    if (same) agree++;
    if (process.env.V) console.log(a.id, same ? 'SAME' : 'diff', JSON.stringify(pick), '| his', JSON.stringify(a.mine), (a.myLogs || [])[0] || '');
  }
  console.log('agree', agree, '/', n);
})();
