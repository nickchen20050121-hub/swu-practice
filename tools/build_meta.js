// 把 tools/meta_raw.txt（比賽牌表，只有卡名）解析成完整卡名，輸出 meta_decks.js
// 同名卡：Premier 合法 > 不會被罰費 > 卡價高（比賽常用）
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'deck.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const byName = new Map();
for (const c of SWU.DB.list) {
  const k = norm(c.n);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(c);
}
const lines = fs.readFileSync(path.join(__dirname, 'meta_raw.txt'), 'utf8').split('\n');
const decks = [];
let cur = null, zone = null, problems = 0;
const asp = () => [...(cur.leader.a || []), ...(cur.base.a || [])];
const penalty = (c) => {
  const have = asp().slice();
  let p = 0;
  for (const a of c.a || []) { const i = have.indexOf(a); if (i >= 0) have.splice(i, 1); else p++; }
  return p;
};
const pick = (name, test) => {
  const list = (byName.get(norm(name)) || []).filter(test);
  return list;
};
for (const raw of lines) {
  const l = raw.trim();
  if (!l || l.startsWith('# ')) continue;
  let m;
  if ((m = l.match(/^### (.+?) \| (.+)$/))) { cur = { title: m[1], event: m[2], main: {}, side: {}, notes: [] }; decks.push(cur); continue; }
  if ((m = l.match(/^Leader: (.+?) @(\w+)$/))) {
    const c = pick(m[1], (c) => c.t === 'Leader' && (c.ids || []).some((i) => i.startsWith(m[2] + '-')));
    if (c.length !== 1) { console.log(cur.title, 'leader?', c.map((x) => x.key)); problems++; }
    cur.leader = c[0];
    continue;
  }
  if ((m = l.match(/^Base: (.+)$/))) {
    const c = pick(m[1], (c) => c.t === 'Base').sort((a, b) => (b.pl === 'Yes') - (a.pl === 'Yes'));
    if (!c.length) { console.log(cur.title, 'base?', m[1]); problems++; }
    if (c.length > 1) cur.notes.push('base ' + m[1] + ' → ' + c[0].key + ' (' + c.length + ' 選項)');
    cur.base = c[0];
    continue;
  }
  if (l === 'Deck') { zone = 'main'; continue; }
  if (l === 'Sideboard') { zone = 'side'; continue; }
  if ((m = l.match(/^(\d+) (.+)$/))) {
    let c = pick(m[2], (c) => !['Leader', 'Base'].includes(c.t) && !/Token/.test(c.t));
    if (!c.length) { console.log(cur.title, 'unknown', m[2]); problems++; continue; }
    c.sort((a, b) => (b.pl === 'Yes') - (a.pl === 'Yes') || penalty(a) - penalty(b) || (+b.pr || 0) - (+a.pr || 0));
    const legal = c.filter((x) => x.pl === 'Yes' && penalty(x) === penalty(c[0]));
    if (legal.length > 1) cur.notes.push(`${m[2]} → ${c[0].key}（另有 ${legal.slice(1).map((x) => x.s || x.key).join('、')}）`);
    cur[zone][c[0].key] = (cur[zone][c[0].key] || 0) + +m[1];
  }
}
const out = decks.map((d, i) => {
  const n = Object.values(d.main).reduce((a, b) => a + b, 0), s = Object.values(d.side).reduce((a, b) => a + b, 0);
  console.log(`${d.title}: ${d.leader && d.leader.key} / ${d.base && d.base.key} main ${n} side ${s}`);
  for (const x of d.notes) console.log('   ', x);
  return { id: 'meta' + (i + 1), preset: true, meta: true, name: d.title.replace(/ \(\w+\)$/, '') + '｜' + d.event, event: d.event, leader: d.leader.key, base: d.base.key, main: d.main, side: d.side };
});
fs.writeFileSync(path.join(dir, 'meta_decks.js'), '/* 2026-11 比賽得名牌表（tools/build_meta.js 產生） */\nwindow.SWU_META_DECKS=' + JSON.stringify(out) + ';\n');
console.log(decks.length, 'decks,', problems, 'problems');
