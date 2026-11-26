// 文字版題目：規則型自我對戰，挑 0 號座位能用領袖能力或事件的局面，印出局面文字與候選行動（給聊天室選擇題用）
// 用法：node tools/quiz_text.js 題數 輸出.json [種子]
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'zh_cards.js', 'effects.js', 'pilots.js', 'effects2.js', 'gfx.js', 'effects3.js', 'programs.js', 'meta_decks.js', 'deck.js', 'ai.js']) { try { vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); } catch (e) {} }
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
SWU.lang = 'zh';
const H = SWU.AI.heur;
const want = +process.argv[2] || 4, out = process.argv[3], s0 = +process.argv[4] || 7;
const meta = window.SWU_META_DECKS;
const mk = (d, n) => ({ name: n, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
const L4 = { initFix: true, attackFirst: 0.5, rollout: 4, top: 6 };
const nm = (c) => (c.u ? '✦' : '') + SWU.cardName(c);
const ce = console.error, cw = console.warn;
const res = [];
function desc(g, p) {
  const side = (i) => {
    const P = g.P(i);
    const us = P.units.map((u) => nm(u.card) + ' ' + g.power(u) + '/' + g.remaining(u) + (u.exhausted ? '（已橫置）' : '') + (u.upgrades.length ? '［' + u.upgrades.map((x) => nm(x.card)).join('、') + '］' : '') + '，' + (/Space/.test(u.card.ar || '') ? '太空' : '地面'));
    const L = P.leader;
    return {
      leader: nm(L.card) + (L.deployed ? '（已部署）' : L.exhausted ? '（已橫置）' : '（可用）'),
      base: nm(P.base.card) + ' 剩 ' + ((P.base.card.h || 30) - P.base.damage) + ' 血',
      res: P.resources.filter((r) => !r.exhausted).length + '/' + P.resources.length,
      units: us, hand: P.hand.length, credits: P.credits || 0,
    };
  };
  return { round: g.G.round, init: g.G.initiative === p ? '我方' : '對方', me: side(p), op: side(1 - p), hand: g.P(p).hand.map((c) => nm(c.card) + '（' + (c.card.c || 0) + '費，' + (c.card.t === 'Event' ? '事件' : c.card.t === 'Upgrade' ? '升級' : '單位') + '）') };
}
(async () => {
  for (let gi = 0; res.length < want && gi < want * 8; gi++) {
    const dA = meta[(gi * 5 + s0) % meta.length], dB = meta[(gi * 3 + s0 + 2) % meta.length];
    if (dA === dB) continue;
    let stop = false;
    const seed = 5000 + gi * 7907 + s0;
    const io = (q) => ({
      chooseAction: async (g, p, acts) => {
        H.cfg = {};
        if (stop) throw new Error('stop');
        if (q === 0 && g.G.round >= 3 && g.G.round <= 7 && !g.replaying) {
          const la = acts.find((a) => a.type === 'leaderAbility' && !a.manual);
          const evs = acts.filter((a) => a.type === 'play' && (g.findAny(a.uid) || {}).card?.t === 'Event');
          if ((la || evs.length) && Math.random() < 0.5) {
            console.error = () => {}; console.warn = () => {};
            let r; try { r = await H.chooseActionSmart(g, p, acts, L4); } finally { console.error = ce; console.warn = cw; }
            const lab = (a) => { const c = a.uid != null ? g.findAny(a.uid) : null; return a.type === 'play' ? '打出 ' + nm(c.card) : a.type === 'attack' ? nm(c.card) + ' 攻擊' : a.type === 'leaderAbility' ? '用領袖能力' : a.type === 'deploy' ? '部署領袖' : a.type === 'initiative' ? '拿先攻' : a.type === 'pass' ? '跳過' : a.type; };
            const seen = new Set(), opts = [];
            for (const a of acts) { const l = lab(a); if (!seen.has(l)) { seen.add(l); opts.push(l); } }
            res.push({ seed, a: dA.id, b: dB.id, leaders: [dA.leader, dB.leader], ...desc(g, p), opts, ai: r.act ? lab(r.act) : null, aiTarget: r.force == null ? null : String(r.force).startsWith('base') ? '基地' : nm((g.findUnit(r.force) || {}).card || { n: '?' }) });
            console.log('got', res.length);
            stop = true;
            return r.act;
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
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log('wrote', res.length);
})();
