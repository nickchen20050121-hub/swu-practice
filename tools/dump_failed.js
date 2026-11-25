// 列出句型判讀不了的卡：node tools/dump_failed.js 批次大小 輸出資料夾
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js','pilots.js','effects2.js','gfx.js', 'effects3.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const size = +process.argv[2] || 80, out = process.argv[3];
const items = [];
for (const c of SWU.DB.list) {
  if (/Token/.test(c.t)) continue;
  for (const side of SWU.GFX.sidesOf(c)) {
    if (SWU.EFFECTS.hasHand(c, side)) continue;
    const pr = SWU.GFX.compileRegex(c, side);
    if (!pr.failed.length) continue;
    const head = `= ${c.key}#${side}  [${c.t}${c.ar ? ' ' + c.ar : ''}${c.tr ? ' ' + c.tr.join(',') : ''}]`;
    const body = c.t === 'Event' ? [SWU.GFX.norm(c.tx).replace(/\n/g, ' / ')] : pr.failed.map((f) => f.line);
    items.push(head + '\n' + body.map((l) => '  ' + l).join('\n'));
  }
}
fs.mkdirSync(out, { recursive: true });
for (let i = 0; i < items.length; i += size) fs.writeFileSync(path.join(out, 'b' + String(i / size).padStart(2, '0') + '.txt'), items.slice(i, i + size).join('\n') + '\n');
console.log(items.length, 'items', Math.ceil(items.length / size), 'batches');
