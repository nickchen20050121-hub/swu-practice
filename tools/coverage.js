// 統計通用效果系統能自動處理多少卡：node tools/coverage.js [show]
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards', 'engine', 'i18n', 'effects', 'gfx']) require('../' + f + '.js');
try { require('../programs.js'); } catch (e) {}
const SWU = window.SWU;
SWU.initDB(window.SWU_CARDS);
SWU.markVanillaKeywordCards();
const st = {};
const fails = [];
for (const c of SWU.DB.list) {
  if (/Token/.test(c.t)) continue;
  for (const side of SWU.GFX.sidesOf(c)) {
    const s = SWU.GFX.status(c, side);
    st[s] = (st[s] || 0) + 1;
    if (s === 'partial' || s === 'manual') for (const f of SWU.GFX.compileRegex(c, side).failed) fails.push(f.line);
  }
}
console.log(st, 'failed lines', fails.length);
if (process.argv[2] === 'show') {
  const n = +process.argv[3] || 40;
  const shuf = fails.sort(() => Math.random() - 0.5).slice(0, n);
  console.log(shuf.join('\n'));
}
