// 用 swumetastats.com 的比賽牌表（/api/decklists 的 JSON）補充 meta_decks.js
// 用法：node tools/build_meta_api.js decklists1.json [decklists2.json ...]
// 只取本環境（HMW 禁卡更新後）前八名、領袖＋基地不重複的牌組；不收玩家名字
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'deck.js', 'meta_decks.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
const SINCE = process.env.SINCE || '2026-11-09', MAX = +(process.env.MAX || 36);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/…/g, '').replace(/\s+/g, ' ').trim();
const byFull = new Map(), byName = new Map();
for (const c of SWU.DB.list) {
  for (const [m, k] of [[byFull, norm(c.key)], [byName, norm(c.n)]]) {
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
}
const asp = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean).sort().join(',');
let problems = 0;
const find = (card, type) => {
  let l = byFull.get(norm(card.name)) || [];
  if (!l.length && type === 'Base') l = (byName.get(norm(card.name)) || []).filter((c) => c.t === 'Base');
  if (type) l = l.filter((c) => (type === 'Other' ? !['Leader', 'Base'].includes(c.t) && !/Token/.test(c.t) : c.t === type));
  if (l.length > 1 && card.aspect != null) {
    const a = l.filter((c) => asp((c.a || []).join(',')) === asp(card.aspect));
    if (a.length) l = a;
  }
  if (l.length > 1 && card.set) {
    const s = l.filter((c) => (c.ids || []).some((i) => i.startsWith(card.set.toUpperCase() + '-')));
    if (s.length) l = s;
  }
  l.sort((a, b) => (b.pl === 'Yes') - (a.pl === 'Yes'));
  return l[0];
};
const seen = new Set(), all = [];
for (const f of process.argv.slice(2)) for (const d of JSON.parse(fs.readFileSync(f, 'utf8')).decklists || []) if (!seen.has(d.id)) seen.add(d.id), all.push(d);
const old = window.SWU_META_DECKS || [];
const combos = new Set(old.map((d) => d.leader + '/' + d.base));
const picked = [];
all
  .filter((d) => d.standing <= 8 && (d.tournament.startDate || '') >= SINCE && d.cards)
  .sort((a, b) => a.standing - b.standing || (b.tournament.startDate || '').localeCompare(a.tournament.startDate || ''))
  .forEach((d) => {
    if (old.length + picked.length >= MAX) return;
    const leader = find(d.leaderCard || { name: d.leaderName }, 'Leader'), base = find({ ...(d.baseCard || {}), name: d.baseName }, 'Base');
    if (!leader || !base) return console.log('skip (leader/base?)', d.leaderName, d.baseName), problems++;
    const k = leader.key + '/' + base.key;
    if (combos.has(k)) return;
    const main = {}, side = {};
    let bad = 0;
    for (const c of d.cards) {
      if (['Leader', 'Base'].includes(c.section)) continue;
      const card = find({ ...(c.card || {}), name: c.cardName }, 'Other');
      if (!card) { bad++; console.log('  unknown', c.cardName); continue; }
      const z = /side/i.test(c.section) ? side : main;
      z[card.key] = (z[card.key] || 0) + c.count;
    }
    const n = Object.values(main).reduce((a, b) => a + b, 0);
    if (bad || n < 50) return console.log('skip', k, 'bad', bad, 'main', n), problems++;
    combos.add(k);
    const date = (d.tournament.startDate || '').slice(0, 10);
    const ev = `${d.tournament.name} ${date} #${d.standing}`;
    const short = leader.n + (leader.s ? '' : '');
    picked.push({ preset: true, meta: true, name: short + '｜' + ev, event: ev, leader: leader.key, base: base.key, main, side });
    console.log(`${leader.key} / ${base.key}: main ${n} side ${Object.values(side).reduce((a, b) => a + b, 0)} | ${ev}`);
  });
const out = [...old, ...picked].map((d, i) => ({ ...d, id: 'meta' + (i + 1) }));
fs.writeFileSync(path.join(dir, 'meta_decks.js'), '/* 2026-11 比賽得名牌表（tools/build_meta.js、tools/build_meta_api.js 產生；後者資料來自 swumetastats.com／Melee.gg） */\nwindow.SWU_META_DECKS=' + JSON.stringify(out) + ';\n');
console.log(old.length, 'old +', picked.length, 'new decks,', problems, 'problems');
