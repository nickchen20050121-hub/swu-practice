// 由 swu_cards_all.json 產生 variants.js（每張卡的所有版本：系列、編號、版本種類、價格）
const fs = require('fs');
const src = process.argv[2] || '/mnt/project-files/swu/data/swu_cards_all.json';
const all = require(src).cards;
global.window = {};
require('../cards.js');
const keys = new Set(window.SWU_CARDS.map((c) => c.n + (c.s ? ' | ' + c.s : '')));
const VT = [];
const vi = (v) => (VT.includes(v) ? VT.indexOf(v) : VT.push(v) - 1);
const out = {};
let hit = 0;
for (const c of all) {
  const k = c.Name + (c.Subtitle ? ' | ' + c.Subtitle : '');
  if (!keys.has(k)) continue;
  hit++;
  const pr = parseFloat(c.MarketPrice) || parseFloat(/Foil/.test(c.VariantType) ? c.Price_Foil : c.Price_Normal) || 0;
  const img = c.FrontArt === `https://cdn.swu-db.com/images/cards/${c.Set}/${c.Number}.png` ? 0 : c.FrontArt || '';
  (out[k] = out[k] || []).push([c.Set, c.Number, vi(c.VariantType || 'Normal'), Math.round(pr * 100) / 100, c.tcgplayerId ? +c.tcgplayerId : 0].concat(img ? [img] : []));
}
fs.writeFileSync(__dirname + '/../variants.js', '// 卡片版本資料（自動產生）\nwindow.SWU_VAR=' + JSON.stringify({ vt: VT, v: out }) + ';\n');
console.log('printings', all.length, 'matched', hit, 'cards', Object.keys(out).length, '/', keys.size, 'types', VT.length);
