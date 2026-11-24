// 把 tools/rewrites/*.txt（人工改寫成標準句型的卡片能力）編譯成 programs.js
// 格式：
//   = 卡名 | 副標#side
//   改寫後的一行能力（事件卡：效果本文；可多行）
//   { ...JSON 能力... }     直接寫效果程式
//   ! 說明                  保留手動處理
//   ~                       這段文字不需要處理（例如提醒文字）
// 每一筆會取代該卡「句型判讀失敗」的那些行；判讀成功的行保留。
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..');
global.window = global; global.localStorage = { getItem: () => null, setItem: () => {} };
for (const f of ['cards.js', 'engine.js', 'i18n.js', 'effects.js', 'gfx.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
SWU.initDB(window.SWU_CARDS); SWU.markVanillaKeywordCards();
const G = SWU.GFX;
const rdir = path.join(__dirname, 'rewrites');
const files = fs.existsSync(rdir) ? fs.readdirSync(rdir).filter((f) => f.endsWith('.txt')).sort() : [];
const out = {};
let errors = 0, entries = 0, manualKept = 0;
const only = process.argv[2];
for (const f of files) {
  if (only && !f.includes(only)) continue;
  const lines = fs.readFileSync(path.join(rdir, f), 'utf8').split('\n');
  let cur = null;
  const flush = () => {
    if (!cur) return;
    entries++;
    const { key, side, body, ln } = cur;
    const card = SWU.DB.byKey.get(key.toLowerCase()) || SWU.DB.list.find((c) => c.key.trim().toLowerCase() === key.toLowerCase());
    if (!card) { console.log(`${f}:${ln} unknown card ${key}`); errors++; return; }
    const base = G.compileRegex(card, side);
    const prog = { v: 1, src: 'prebuilt', abilities: [...base.abilities], failed: [] };
    const err = (m) => { console.log(`${f}:${ln} ${key}#${side}: ${m}`); errors++; };
    if (card.t === 'Event') {
      let txt = body.filter((l) => !/^[!~{]/.test(l));
      for (const l of txt.filter((x) => /costs? \d+ less to play/i.test(x))) {
        const ab = G.compileLine(l.replace(/^If (.+?), this event costs (\d+) less to play\.?$/i, 'While $1, this event costs $2 less to play.'), card);
        if (!ab || ab.manual) err('cost line fails: ' + l);
        else prog.abilities.push(ab);
      }
      txt = txt.filter((x) => !/costs? \d+ less to play/i.test(x));
      const json = body.filter((l) => l.startsWith('{'));
      if (body.some((l) => l.startsWith('!'))) { prog.failed = base.failed; manualKept++; }
      for (const j of json) { try { prog.abilities.push(JSON.parse(j)); } catch (e) { err('bad json ' + e.message); } }
      if (txt.length) {
        if (/^choose (one|two)/i.test(txt[0])) {
          const two = /^choose two/i.test(txt[0]);
          const opts = [];
          for (const o of txt.slice(1)) {
            const st = G.parseBody(SWU.GFX.norm(o.replace(/^-\s*/, '')));
            if (!st) { err('option fails: ' + o); continue; }
            opts.push({ label: o.replace(/^-\s*/, ''), steps: st });
          }
          prog.abilities.push({ trigger: 'event', steps: [{ op: 'chooseOne', options: opts, times: two ? 2 : 1 }] });
        } else {
          const st = G.parseBody(SWU.GFX.norm(txt.join(' ')));
          if (!st) err('event body fails: ' + txt.join(' '));
          else prog.abilities.push({ trigger: 'event', steps: st });
        }
      }
    } else {
      for (const l of body) {
        if (l.startsWith('~')) continue;
        if (l.startsWith('!')) { prog.failed.push(...base.failed.filter((x) => !prog.failed.includes(x))); manualKept++; continue; }
        if (l.startsWith('{')) { try { prog.abilities.push(JSON.parse(l)); } catch (e) { err('bad json ' + e.message); } continue; }
        const ab = G.compileLine(l, card);
        if (!ab || ab.manual) err('line fails: ' + l);
        else prog.abilities.push(ab);
      }
    }
    out[card.key.toLowerCase() + '#' + side] = prog;
  };
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#')) return;
    const m = l.match(/^=\s*(.+?)#(card|leader|unit)\s*(\[.*\])?$/);
    if (m) { flush(); cur = { key: m[1].trim(), side: m[2], body: [], ln: i + 1 }; return; }
    if (cur) cur.body.push(l);
  });
  flush();
}
if (!only || process.argv[3] === 'write') {
  fs.writeFileSync(path.join(dir, 'programs.js'), '/* 預先轉好的卡片效果程式（tools/build_programs.js 產生） */\nwindow.SWU_PROGRAMS=' + JSON.stringify(out) + ';\n');
}
console.log(`${entries} entries, ${errors} errors, ${manualKept} kept manual, ${files.length} files`);
