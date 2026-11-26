// 產生「教由奈」題目：規則型自我對戰，挑出玩家座位（0 號）有事件／升級卡能出的局面，
// 用 Lv4 搜尋記下由奈會怎麼打；網站重播 seed＋rec 回到該局面讓柏偉作答。
// 用法：node tools/gen_quiz.js 題數 輸出檔(quiz.js) [起始種子]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const H = SWU.AI.heur;
const want = +process.argv[2] || 30, out = process.argv[3] || path.join(dir, 'quiz.js'), s0 = +process.argv[4] || 1;
const meta = window.SWU_META_DECKS;
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const L4 = { initFix: true, attackFirst: 0.5, rollout: 4, top: 6 };
const quiz = [];
const ce = console.error, cw = console.warn;
(async () => {
  for (let gi = 0; quiz.length < want && gi < want * 6; gi++) {
    const dA = meta[(gi * 7 + s0) % meta.length], dB = meta[(gi * 5 + s0 + 3) % meta.length];
    if (dA === dB) continue;
    let taken = 0, stop = false;
    const seed = 1000 + gi * 7919 + s0;
    const io = (q) => ({
      chooseAction: async (g, p, acts) => {
        H.cfg = {};
        if (stop) throw new Error('stop');
        if (q === 0 && taken < 2 && g.G.round >= 2 && g.G.round <= 6 && !g.replaying) {
          const evs = acts.filter((a) => (a.type === 'play' && ['Event', 'Upgrade'].includes((g.findAny(a.uid) || {}).card?.t)) || (a.type === 'leaderAbility' && !a.manual));
          if (evs.length && Math.random() < 0.45) {
            const rec = JSON.parse(JSON.stringify(g.rec));
            console.error = () => {}; console.warn = () => {};
            let r;
            try { r = await H.chooseActionSmart(g, p, acts, L4); } finally { console.error = ce; console.warn = cw; }
            const a = r.act;
            if (a) {
              const c = a.uid != null ? g.findAny(a.uid) : null;
              const tgt = r.force == null ? null : String(r.force).startsWith('base') ? 'base' : (g.findUnit(r.force) || {}).card?.key;
              quiz.push({ id: 'q' + seed + '_' + rec.length, a: dA.id, b: dB.id, seed, uid0: g.uid0, rec, round: g.G.round, ai: { type: a.type, card: c ? c.card.key : null, target: tgt }, evs: evs.map((x) => (x.type === 'leaderAbility' ? 'leaderAbility' : g.findAny(x.uid).card.key)) });
              taken++;
              if (taken >= 2) stop = true;
              console.log('quiz', quiz.length, dA.leader, 'vs', dB.leader, 'r' + g.G.round, a.type, c && c.card.key, tgt || '');
              return a;
            }
          }
        }
        return H.chooseAction(g, p, acts);
      },
      choose: async (g, p, r) => ((H.cfg = {}), H.choose(g, p, r)),
      resolveManual: async () => {},
    });
    const g = new SWU.Game([mk(dA, 'A'), mk(dB, 'B')], [io(0), io(1)], { seed });
    console.error = () => {}; console.warn = () => {};
    try { await g.run(); } catch (e) {} finally { console.error = ce; console.warn = cw; }
  }
  fs.writeFileSync(out, '/* 「教由奈」題目（tools/gen_quiz.js 產生） */\nwindow.SWU_QUIZ=' + JSON.stringify(quiz) + ';\n');
  console.log('wrote', quiz.length);
})();
