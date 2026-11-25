// 讀 learn_eval.js 的 jsonl，用邏輯迴歸（無截距、L2）學出評分權重，縮放成 hp 權重和原本一樣
// 用法：node tools/fit_eval.js a.jsonl b.jsonl ...
const fs = require('fs');
const rows = [];
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) rows.push(JSON.parse(l));
const K = Object.keys(rows[0].F);
// 依局分訓練／驗證（每 5 局拿 1 局驗證）
const tr = rows.filter((r) => r.g % 5), va = rows.filter((r) => r.g % 5 === 0);
const X = (r) => K.map((k) => r.F[k]);
const sd = K.map((_, j) => Math.sqrt(tr.reduce((a, r) => a + X(r)[j] ** 2, 0) / tr.length) || 1);
const sig = (z) => 1 / (1 + Math.exp(-z));
const fit = (lam) => {
  let w = K.map(() => 0);
  for (let it = 0; it < 3000; it++) {
    const gr = K.map(() => 0);
    for (const r of tr) {
      const x = X(r).map((v, j) => v / sd[j]);
      const e = sig(x.reduce((a, v, j) => a + v * w[j], 0)) - r.win;
      x.forEach((v, j) => (gr[j] += e * v));
    }
    w = w.map((v, j) => v - 0.5 * (gr[j] / tr.length + lam * v));
  }
  return w.map((v, j) => v / sd[j]);
};
const ll = (w, set) => set.reduce((a, r) => { const p = sig(X(r).reduce((s, v, j) => s + v * w[j], 0)); return a - (r.win ? Math.log(p) : Math.log(1 - p)); }, 0) / set.length;
const acc = (w, set) => set.filter((r) => (X(r).reduce((s, v, j) => s + v * w[j], 0) > 0) === !!r.win).length / set.length;
console.log('rows', rows.length, 'train', tr.length, 'valid', va.length);
let best = null;
for (const lam of [0.001, 0.01, 0.05]) {
  const w = fit(lam);
  const L = ll(w, va);
  console.log('lam', lam, 'valid logloss', L.toFixed(4), 'acc', acc(w, va).toFixed(3));
  if (!best || L < best.L) best = { w, L, lam };
}
const EW0 = { pw: 1.1, rm: 0.9, cost: 0.3, leader: 3, shield: 2, rdyMe: 0.35, rdyOp: 0.5, hp: 1.25, opLow: 1.0, myLow: 0.8, hand: 1.6, res: 1.2, ldReady: 1 };
// 舊權重的預測力（同樣縮放後擬合一個係數）
const w0 = K.map((k) => EW0[k]);
let a0 = 0.01, bestL0 = Infinity;
for (let a = 0.005; a < 0.5; a *= 1.1) { const L = ll(w0.map((v) => v * a), va); if (L < bestL0) bestL0 = L, a0 = a; }
console.log('old weights valid logloss', bestL0.toFixed(4), 'acc', acc(w0, va).toFixed(3));
const hpI = K.indexOf('hp'), scale = EW0.hp / best.w[hpI];
const EW = {};
K.forEach((k, j) => (EW[k] = +(best.w[j] * scale).toFixed(3)));
console.log('NEW EW', JSON.stringify(EW));
