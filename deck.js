/* 牌組：資料格式、匯入匯出、分析、起手機率、自動組牌 */
(function () {
  const SWU = window.SWU;
  const D = (SWU.Deck = {});

  // 牌組格式：{ id, name, leader: key, base: key, main: {key: n}, side: {key: n}, notes }
  D.blank = (name) => ({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || 'New deck', leader: null, base: null, main: {}, side: {} });
  D.card = (key) => (key ? SWU.DB.byKey.get(String(key).toLowerCase()) : null);
  D.count = (deck, zone = 'main') => Object.values(deck[zone] || {}).reduce((a, b) => a + b, 0);
  D.expand = (deck) => {
    const out = [];
    for (const [k, n] of Object.entries(deck.main)) {
      const c = D.card(k);
      if (c) for (let i = 0; i < n; i++) out.push(c);
    }
    return out;
  };
  D.aspects = (deck) => [...((D.card(deck.leader) || {}).a || []), ...((D.card(deck.base) || {}).a || [])];
  D.penalty = (deck, card) => {
    const have = D.aspects(deck);
    let m = 0;
    for (const a of card.a || []) {
      const i = have.indexOf(a);
      if (i >= 0) have.splice(i, 1);
      else m++;
    }
    return m * 2;
  };
  D.validate = (deck) => {
    const errs = [];
    if (!D.card(deck.leader)) errs.push(SWU.t('errNoLeader'));
    if (!D.card(deck.base)) errs.push(SWU.t('errNoBase'));
    const n = D.count(deck);
    if (n < 50) errs.push(SWU.t('errTooFew', n));
    for (const [k, c] of Object.entries(deck.main)) if (c + (deck.side[k] || 0) > 3) errs.push(SWU.t('errTooMany', k));
    const side = D.count(deck, 'side');
    if (side > 10) errs.push(SWU.t('errSide', side));
    return errs;
  };

  // ---------- 儲存 ----------
  const KEY = 'swu.decks.v1';
  D.loadAll = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  };
  D.saveAll = (decks) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(decks));
      return true;
    } catch (e) {
      return false;
    }
  };

  // ---------- 名稱比對 ----------
  function findByName(name, sub, hintAspects) {
    name = name.trim().replace(/\s+/g, ' ');
    if (sub) {
      const c = SWU.DB.byKey.get((name + ' | ' + sub.trim()).toLowerCase());
      if (c) return c;
    }
    const full = SWU.DB.byKey.get(name.toLowerCase());
    if (full) return full;
    // 「名字 - 副標」「名字, 副標」
    for (const sep of [' - ', ' – ', ' — ', ', ', ' | ']) {
      const i = name.indexOf(sep);
      if (i > 0) {
        const c = SWU.DB.byKey.get((name.slice(0, i) + ' | ' + name.slice(i + sep.length)).toLowerCase());
        if (c) return c;
      }
    }
    const list = SWU.DB.byName.get(name.toLowerCase());
    if (list && list.length) {
      const legal = list.filter((c) => c.pl === 'Yes');
      const pool = legal.length ? legal : list;
      if (hintAspects && hintAspects.length) {
        const fit = pool.filter((c) => (c.a || []).every((a) => hintAspects.includes(a)));
        if (fit.length) return fit[0];
      }
      return pool[0];
    }
    return null;
  }
  D.findByName = findByName;
  const byPrinting = (id) => {
    if (!id) return null;
    const m = String(id).toUpperCase().replace('_', '-');
    const [set, num] = m.split('-');
    if (!num) return null;
    return SWU.DB.byId.get(set + '-' + num) || SWU.DB.byId.get(set + '-' + num.padStart(3, '0')) || SWU.DB.byId.get(set + '-' + String(+num).padStart(3, '0'));
  };

  // 匯入：SWUDB JSON 或文字清單；回傳 {deck, warnings}
  D.parse = function (input, name) {
    const text = String(input || '').trim();
    const warnings = [];
    const deck = D.blank(name);
    if (text.startsWith('{')) {
      let j;
      try {
        j = JSON.parse(text);
      } catch (e) {
        return { error: SWU.t('errJson') };
      }
      const get = (o) => (o && (byPrinting(o.id) || (o.name && findByName(o.name, o.subtitle)))) || null;
      const L = get(j.leader);
      const B = get(j.base);
      if (L) deck.leader = L.key;
      else warnings.push(SWU.t('warnUnknown', JSON.stringify(j.leader)));
      if (B) deck.base = B.key;
      else warnings.push(SWU.t('warnUnknown', JSON.stringify(j.base)));
      for (const [zone, arr] of [
        ['main', j.deck || []],
        ['side', j.sideboard || []],
      ])
        for (const e of arr) {
          const c = get(e);
          if (!c) {
            warnings.push(SWU.t('warnUnknown', e.id || e.name));
            continue;
          }
          deck[zone][c.key] = (deck[zone][c.key] || 0) + (e.count || 1);
        }
      if (j.metadata && j.metadata.name) deck.name = j.metadata.name;
      return { deck, warnings };
    }
    let zone = 'main';
    let hint = [];
    for (let raw of text.split(/\r?\n/)) {
      let line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) continue;
      const h = line.toLowerCase().replace(/[:：]$/, '');
      if (/^(leader|領袖)s?$/.test(h)) {
        zone = 'leader';
        continue;
      }
      if (/^(base|基地)s?$/.test(h)) {
        zone = 'base';
        continue;
      }
      if (/^(deck|main ?deck|main|主牌|牌組)(\s*\(\d+\))?$/.test(h)) {
        zone = 'main';
        continue;
      }
      if (/^(sideboard|side|備牌)(\s*\(\d+\))?$/.test(h)) {
        zone = 'side';
        continue;
      }
      let z = zone;
      let m;
      if ((m = line.match(/^(leader|領袖)\s*[:：]\s*(.+)$/i))) {
        z = 'leader';
        line = m[2];
      } else if ((m = line.match(/^(base|基地)\s*[:：]\s*(.+)$/i))) {
        z = 'base';
        line = m[2];
      }
      let n = 1;
      if ((m = line.match(/^(\d+)\s*[xX×]?\s+(.+)$/))) {
        n = +m[1];
        line = m[2];
      } else if ((m = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/))) {
        n = +m[2];
        line = m[1];
      }
      line = line.replace(/\s*\([A-Z0-9]+[-_ ]?\d+\)\s*$/, '');
      const c = findByName(line, null, hint);
      if (!c) {
        warnings.push(SWU.t('warnUnknown', raw.trim()));
        continue;
      }
      if (z === 'leader' || (c.t === 'Leader' && z === 'main')) {
        deck.leader = c.key;
        hint = D.aspects(deck);
      } else if (z === 'base' || (c.t === 'Base' && z === 'main')) {
        deck.base = c.key;
        hint = D.aspects(deck);
      } else deck[z][c.key] = (deck[z][c.key] || 0) + n;
    }
    return { deck, warnings };
  };
  D.toText = (deck) => {
    const lines = [];
    if (deck.leader) lines.push('Leader: ' + deck.leader.replace(' | ', ' - '));
    if (deck.base) lines.push('Base: ' + deck.base.replace(' | ', ' - '));
    lines.push('', 'Deck');
    for (const [k, n] of D.sorted(deck.main)) lines.push(n + ' ' + k.replace(' | ', ' - '));
    if (D.count(deck, 'side')) {
      lines.push('', 'Sideboard');
      for (const [k, n] of D.sorted(deck.side)) lines.push(n + ' ' + k.replace(' | ', ' - '));
    }
    return lines.join('\n');
  };
  D.toSwudb = (deck) => {
    const id = (k) => {
      const c = D.card(k);
      return c && c.id ? c.id.replace('-', '_') : k;
    };
    return JSON.stringify(
      {
        metadata: { name: deck.name },
        leader: { id: id(deck.leader), count: 1 },
        base: { id: id(deck.base), count: 1 },
        deck: Object.entries(deck.main).map(([k, n]) => ({ id: id(k), count: n })),
        sideboard: Object.entries(deck.side).map(([k, n]) => ({ id: id(k), count: n })),
      },
      null,
      1
    );
  };
  D.sorted = (zone) =>
    Object.entries(zone || {}).sort((a, b) => {
      const ca = D.card(a[0]) || {};
      const cb = D.card(b[0]) || {};
      return (ca.c || 0) - (cb.c || 0) || a[0].localeCompare(b[0]);
    });

  // ---------- 機率（超幾何分佈） ----------
  const lnF = [0];
  for (let i = 1; i <= 200; i++) lnF[i] = lnF[i - 1] + Math.log(i);
  const lnC = (n, k) => (k < 0 || k > n ? -Infinity : lnF[n] - lnF[k] - lnF[n - k]);
  // N 張牌裡有 K 張目標，抽 n 張至少 k 張
  D.hyperAtLeast = function (N, K, n, k = 1) {
    n = Math.min(n, N);
    let p = 0;
    for (let i = k; i <= Math.min(K, n); i++) p += Math.exp(lnC(K, i) + lnC(N - K, n - i) - lnC(N, n));
    return Math.min(1, Math.max(0, p));
  };
  // 第 r 回合行動階段開始前看過幾張：起手 6（+領袖加抽）＋每個整備階段 2 張
  D.seenByRound = (r, extra = 0) => 6 + extra + 2 * (r - 1);
  D.drawTable = function (deck, K, { k = 1, rounds = 5, mulligan = false } = {}) {
    const N = D.count(deck);
    const L = D.card(deck.leader);
    const le = L && SWU.EFFECTS.get(L, 'leader');
    const extra = (le && le.startingHand) || (L && /Draw (\d+) more cards in your starting hand/.test(L.tx || '') ? +RegExp.$1 : 0);
    const out = [];
    for (let r = 1; r <= rounds; r++) {
      const n = D.seenByRound(r, extra);
      let p = D.hyperAtLeast(N, K, n, k);
      if (mulligan) {
        // 起手沒抽到就重抽一次（近似）
        const p0 = D.hyperAtLeast(N, K, 6 + extra, k);
        const later = n - (6 + extra);
        const pMissOpen = 1 - p0;
        const pAfter = D.hyperAtLeast(N, K, 6 + extra + later, k);
        p = p0 + pMissOpen * pAfter;
        p = Math.min(1, p);
      }
      out.push({ round: r, seen: n, p });
    }
    return out;
  };

  // ---------- 分析 ----------
  D.analyze = function (deck) {
    const cards = D.expand(deck);
    const N = cards.length;
    const A = { N, curve: {}, types: {}, arenas: { Ground: 0, Space: 0 }, penalty: 0, penaltyCards: [], kw: {}, traits: {}, avg: 0, copies: { 1: 0, 2: 0, 3: 0 }, interaction: 0, unitsCost: 0, unimplemented: [] };
    let sum = 0;
    for (const c of cards) {
      const cost = Math.min(c.c || 0, 8);
      A.curve[cost] = (A.curve[cost] || 0) + 1;
      A.types[c.t] = (A.types[c.t] || 0) + 1;
      if (c.t === 'Unit') {
        if ((c.ar || '').includes('Space')) A.arenas.Space++;
        else A.arenas.Ground++;
      }
      sum += c.c || 0;
      const pen = D.penalty(deck, c);
      if (pen) A.penalty++;
      for (const k of Object.keys(c.kwp || {})) if (!['SmuggleRaw', 'Bounty'].includes(k)) A.kw[k] = (A.kw[k] || 0) + 1;
      for (const t of c.tr || []) A.traits[t] = (A.traits[t] || 0) + 1;
      if (/defeat|deal \d+ damage|damage equal|captures|return .* to (its owner's|their) hand|-\d+\/-\d+|-\d\/-0/i.test(c.tx || '')) A.interaction++;
    }
    for (const [k, n] of Object.entries(deck.main)) {
      A.copies[Math.min(3, n)] = (A.copies[Math.min(3, n)] || 0) + 1;
      const c = D.card(k);
      if (c && D.penalty(deck, c)) A.penaltyCards.push(k);
      if (c && SWU.GFX && ['partial', 'manual'].includes(SWU.GFX.status(c, 'card'))) A.unimplemented.push(k);
      else if (c && !SWU.GFX && SWU.abilityLines(c).length && !SWU.EFFECTS.has(c, 'card')) A.unimplemented.push(k);
    }
    for (const k of [deck.leader, deck.base]) {
      const c = k && D.card(k);
      if (c && SWU.GFX && SWU.GFX.sidesOf(c).some((sd) => ['partial', 'manual'].includes(SWU.GFX.status(c, sd)))) A.unimplemented.unshift(k);
    }
    A.avg = N ? sum / N : 0;
    A.early = (A.curve[1] || 0) + (A.curve[2] || 0) + (A.curve[3] || 0);
    A.score = D.score(deck, A);
    return A;
  };
  // 0–100 的結構分數（只看牌組結構，不代表環境勝率）
  D.score = function (deck, A) {
    if (!A.N) return { total: 0, parts: [] };
    const parts = [];
    const clamp = (x) => Math.max(0, Math.min(1, x));
    parts.push({ k: 'scSize', v: clamp(1 - Math.abs(A.N - 50) / 10), w: 10 });
    parts.push({ k: 'scCurve', v: clamp(A.early / A.N / 0.5), w: 20 });
    parts.push({ k: 'scAvg', v: clamp(1 - Math.abs(A.avg - 3.6) / 2), w: 15 });
    parts.push({ k: 'scPenalty', v: clamp(1 - A.penalty / A.N / 0.25), w: 15 });
    const kinds = Object.keys(deck.main).length;
    const threeOf = Object.values(deck.main).filter((n) => n >= 3).length;
    parts.push({ k: 'scConsistency', v: clamp(kinds ? threeOf / kinds / 0.7 : 0), w: 20 });
    parts.push({ k: 'scInteraction', v: clamp(A.interaction / 8), w: 10 });
    const units = A.types.Unit || 0;
    parts.push({ k: 'scUnits', v: clamp(1 - Math.abs(units / A.N - 0.72) / 0.3), w: 10 });
    const total = Math.round(parts.reduce((s, p) => s + p.v * p.w, 0));
    return { total, parts };
  };

  // ---------- 自動組牌（不需 AI 的版本） ----------
  D.cardValue = function (c) {
    let v = 0;
    if (c.t === 'Unit') {
      const stats = (c.p || 0) + (c.h || 0);
      v = stats / Math.max(1, (c.c || 0) + 1) * 2;
      const k = c.kwp || {};
      if (k.Sentinel) v += 0.8;
      if (k.Overwhelm) v += 0.5;
      if (k.Ambush) v += 0.7;
      if (k.Shielded) v += 0.8;
      if (k.Raid) v += 0.3 * k.Raid;
      if (k.Restore) v += 0.4 * k.Restore;
      if (k.Saboteur) v += 0.5;
      if (k.Grit) v += 0.3;
      if (/When Played/.test(c.tx || '')) v += 0.8;
      if (/On Attack/.test(c.tx || '')) v += 0.5;
    } else if (c.t === 'Event') {
      v = 2.2;
      if (/Defeat (a|an) (non-leader )?(enemy )?unit/i.test(c.tx || '')) v += 1.6;
      if (/Deal \d+ damage/i.test(c.tx || '')) v += 0.8;
      if (/Draw/i.test(c.tx || '')) v += 0.5;
    } else if (c.t === 'Upgrade') {
      v = 1.6 + ((c.p || 0) + (c.h || 0)) / Math.max(1, c.c || 1) * 0.6;
    }
    if (c.u) v -= 0.15;
    return v;
  };
  D.pool = function (leaderKey, baseKey, { allowPenalty = false, legalOnly = true } = {}) {
    const tmp = { leader: leaderKey, base: baseKey };
    return SWU.DB.list.filter((c) => {
      if (!['Unit', 'Event', 'Upgrade'].includes(c.t)) return false;
      if (legalOnly && c.pl !== 'Yes') return false;
      if (!allowPenalty && D.penalty(tmp, c) > 0) return false;
      return true;
    });
  };
  D.autoBuild = function (leaderKey, baseKey, opts = {}) {
    const deck = D.blank(opts.name || SWU.t('autoDeckName'));
    deck.leader = leaderKey;
    deck.base = baseKey;
    const L = D.card(leaderKey);
    const pool = D.pool(leaderKey, baseKey)
      .map((c) => {
        let v = D.cardValue(c);
        // 和領袖、基地的特徵／文字有關的加分
        for (const t of c.tr || []) if ((L && (L.tx + ' ' + L.bt).toUpperCase().includes(t)) || D.card(baseKey).tr?.includes(t)) v += 0.6;
        const bt = (D.card(baseKey).tr || [])[0];
        if (bt && (c.tx || '').toUpperCase().includes(bt)) v += 1;
        return { c, v };
      })
      .sort((a, b) => b.v - a.v);
    const target = { 1: 3, 2: 12, 3: 12, 4: 8, 5: 6, 6: 4, 7: 5 };
    const have = {};
    let total = 0;
    let events = 0;
    for (const { c } of pool) {
      if (total >= 50) break;
      const cost = Math.min(7, Math.max(1, c.c || 1));
      if ((have[cost] || 0) >= target[cost]) continue;
      if (c.t !== 'Unit' && events >= 12) continue;
      const n = Math.min(3, 50 - total, target[cost] - (have[cost] || 0));
      if (n <= 0) continue;
      deck.main[c.key] = n;
      have[cost] = (have[cost] || 0) + n;
      total += n;
      if (c.t !== 'Unit') events += n;
    }
    // 不夠 50 就補最高分的
    for (const { c } of pool) {
      if (total >= 50) break;
      const cur = deck.main[c.key] || 0;
      if (cur >= 3) continue;
      const n = Math.min(3 - cur, 50 - total);
      deck.main[c.key] = cur + n;
      total += n;
    }
    return deck;
  };
  // ---------- 備牌（sideboard）----------
  const TX = (c) => (c.tx || '') + ' ' + (c.bt || '');
  D.features = (c) => ({
    antiUpgrade: /defeat (?:an|any|each|all|up to \d+)? ?(?:non-leader )?upgrades?|upgrades? .{0,40}(?:defeat|return)/i.test(TX(c)),
    bigRemoval: /defeat (?:a|an|target) (?:non-leader )?(?:enemy )?(?:ground |space )?unit(?! with)|with \d+ or more (?:power|cost)/i.test(TX(c)),
    smallRemoval: /deal [1-4] damage to (?:a|an|each)|defeat .{0,30}with [1-4] or less/i.test(TX(c)),
    sweeper: /to each (?:enemy )?(?:ground |space )?unit|each other unit/i.test(TX(c)),
    sentinel: !!(c.kwp && c.kwp.Sentinel) || (c.kw || []).includes('Sentinel'),
    heal: /heal|restore/i.test(TX(c)) || !!(c.kwp && c.kwp.Restore),
    space: c.ar === 'Space',
    ground: c.ar === 'Ground',
    cheap: c.t === 'Unit' && (c.c || 0) <= 2,
    big: c.t === 'Unit' && (c.p || 0) >= 5,
  });
  // 從看過的對手卡片推出對手牌型
  D.profile = (cards) => {
    const units = cards.filter((c) => c.t === 'Unit');
    const n = Math.max(1, cards.length), u = Math.max(1, units.length);
    return {
      upgrades: cards.filter((c) => c.t === 'Upgrade').length / n,
      space: units.filter((c) => c.ar === 'Space').length / u,
      cheap: units.filter((c) => (c.c || 0) <= 2).length / u,
      big: units.filter((c) => (c.p || 0) >= 5 || (c.c || 0) >= 6).length / u,
      wide: units.length / n,
    };
  };
  D.matchupValue = (c, pr) => {
    const f = D.features(c);
    let v = D.cardValue(c);
    if (!pr) return v;
    if (f.antiUpgrade) v += pr.upgrades * 8 - 0.6;
    if (f.bigRemoval) v += pr.big * 4;
    if (f.smallRemoval) v += pr.cheap * 2.5;
    if (f.sweeper) v += (pr.cheap + pr.wide) * 2.5 - 1;
    if (f.sentinel) v += pr.cheap * 2;
    if (f.heal) v += pr.cheap * 1.5;
    if (f.space) v += (pr.space - 0.35) * 3;
    if (f.ground) v += (0.65 - pr.space) * 1.5;
    if (f.cheap) v += pr.cheap * 1;
    return v;
  };
  // 沒有備牌就從可用卡池挑 10 張應對用的牌
  D.ensureSide = (deck) => {
    if (D.count(deck, 'side') >= 10) return deck;
    const pool = D.pool(deck.leader, deck.base).filter((c) => !deck.main[c.key]);
    const want = ['antiUpgrade', 'bigRemoval', 'sweeper', 'smallRemoval', 'sentinel', 'space', 'heal'];
    let n = D.count(deck, 'side');
    for (const k of [...want, ...want]) {
      if (n >= 10) break;
      const best = pool.filter((c) => D.features(c)[k] && !deck.side[c.key]).sort((a, b) => D.cardValue(b) - D.cardValue(a))[0];
      if (!best) continue;
      const k2 = Math.min(2, 10 - n);
      deck.side[best.key] = k2;
      n += k2;
      if (n >= 10) break;
    }
    return deck;
  };
  // 依對手牌型換牌：主牌數量不變，備牌最多 10 張，每張最多 3 張
  D.sideboardAI = (deck, seenCards, maxSwap = 6) => {
    const pr = D.profile(seenCards);
    const d = JSON.parse(JSON.stringify(deck));
    const swaps = [];
    for (let i = 0; i < maxSwap; i++) {
      // 只看「對這個對手」多出來的價值，避免把牌組本身的關鍵牌換掉
      const bonus = (k) => D.matchupValue(D.card(k), pr) - D.cardValue(D.card(k));
      const outs = Object.keys(d.main).filter((k) => !swaps.some((x) => x.in === k)).map((k) => ({ k, v: bonus(k), b: D.cardValue(D.card(k)) })).sort((a, b) => a.v - b.v || a.b - b.b);
      const ins = Object.keys(d.side).filter((k) => !swaps.some((x) => x.out === k)).map((k) => ({ k, v: bonus(k) })).sort((a, b) => b.v - a.v);
      if (!outs.length || !ins.length || ins[0].v < outs[0].v + 1.2) break;
      const o = outs[0].k, n = ins[0].k;
      d.main[o]--;
      if (!d.main[o]) delete d.main[o];
      d.side[o] = (d.side[o] || 0) + 1;
      d.side[n]--;
      if (!d.side[n]) delete d.side[n];
      d.main[n] = (d.main[n] || 0) + 1;
      swaps.push({ in: n, out: o });
    }
    return { deck: d, swaps, profile: pr };
  };

  // 給 AI 的候選清單（精簡文字）
  D.poolBrief = function (leaderKey, baseKey, limit = 220) {
    const L = D.card(leaderKey);
    return D.pool(leaderKey, baseKey)
      .map((c) => ({ c, v: D.cardValue(c) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, limit)
      .map(({ c }) => `${c.key} | ${c.t} | cost ${c.c} | ${c.p != null ? c.p + '/' + c.h : ''} | ${(c.ar || '')} | ${(c.tr || []).join(',')} | ${(c.tx || '').replace(/\s*\([^)]*\)/g, '').replace(/\n/g, ' ').slice(0, 160)}`);
  };

  // ---------- 內建牌組 ----------
  D.presets = function () {
    const mk = (name, list, id) => {
      const r = D.parse(list, name);
      r.deck.preset = true;
      r.deck.id = id;
      return r.deck;
    };
    const pq = `Leader: Luke Skywalker - I Can Save Him
Base: Origin Tree - Kashyyyk
Deck
3 Gungi - Finding Himself
3 Huyang - Your Aptitude Falls Short
2 Mina Bonteri - Stop This War
3 Soaring Can-Cell
1 Yord Fandar - Devoutly Disciplined
1 Latts Razzi - Deadly Whipmaster
2 Leia Organa - Vigilant for Danger
1 Lifetree Caravan
1 Wookiee Protector
1 Yanna - Sanctuary Elder
1 Cobb Vanth - Let Me Handle This
1 Paz Vizsla - For a Brighter Future
3 Captain Typho - All Necessary Precautions
2 Ezra Bridger - Spectre Six
1 Qui-Gon Jinn - We'll Handle This
3 Wookiee Rangers
1 Hunter - Everyone Get to Cover!
1 Scorpenek Annihilator Droid
2 Kelleran Beq - The Sabered Hand
1 Luminara Unduli - Besieged General
1 Rey - Skywalker
1 Trask Walker
2 Bo-Katan Kryze - Alone
3 Blue Leader - Scarif Air Support
3 Overgrowth
3 Lost and Forgotten
2 Luke's Jedi Lightsaber - Constructed by Hand
1 Direct Hit
1 Bestial Bond
1 Moral Authority
Sideboard
2 T-6 Shuttle 1974 - Stay Close`;
    const a2 = `Leader: Luke Skywalker - I Can Save Him
Base: Origin Tree - Kashyyyk
Deck
3 Gungi - Finding Himself
3 Huyang - Your Aptitude Falls Short
2 Mina Bonteri - Stop This War
3 Soaring Can-Cell
3 Yord Fandar - Devoutly Disciplined
1 Latts Razzi - Deadly Whipmaster
2 Leia Organa - Vigilant for Danger
1 Wookiee Protector
1 Yanna - Sanctuary Elder
3 Captain Typho - All Necessary Precautions
1 Ezra Bridger - Spectre Six
1 Qui-Gon Jinn - We'll Handle This
3 Wookiee Rangers
1 Hunter - Everyone Get to Cover!
2 Kelleran Beq - The Sabered Hand
1 Luminara Unduli - Besieged General
1 Rey - Skywalker
1 Trask Walker
3 Bo-Katan Kryze - Alone
3 Blue Leader - Scarif Air Support
2 T-6 Shuttle 1974 - Stay Close
3 Overgrowth
3 Lost and Forgotten
3 Bestial Bond
Sideboard
1 Direct Hit`;
    if (!D._presets || D._presetsLang !== SWU.lang) {
      D._presets = [mk(SWU.t('presetPQ'), pq, 'preset-pq'), mk(SWU.t('presetA2'), a2, 'preset-a2')];
      D._presetsLang = SWU.lang;
    }
    return JSON.parse(JSON.stringify(D._presets));
  };
})();
