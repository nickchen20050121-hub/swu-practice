/* 通用效果系統（Generic effects）
 * 1. 句型判讀：把卡片英文文字轉成「效果程式」（JSON 步驟）。
 * 2. 判讀不了的卡：請 Claude 轉成同一種效果程式，存在瀏覽器裡重複使用。
 * 3. 直譯器：把效果程式變成引擎用的觸發函式（whenPlayed、onAttack…）。
 */
(function () {
  const SWU = window.SWU;
  const GFX = (SWU.GFX = {});
  const KW = ['Sentinel', 'Overwhelm', 'Saboteur', 'Grit', 'Ambush', 'Hidden', 'Shielded', 'Raid', 'Restore'];
  const KWRE = '(?:sentinel|overwhelm|saboteur|grit|ambush|hidden|shielded|raid \\d+|restore \\d+)';
  const TOKENS = { shield: 'Shield', experience: 'Experience', advantage: 'Advantage', weakness: 'Weakness' };
  const UNIT_TOKENS = ['battle droid', 'beast', 'clone trooper', 'mandalorian', 'spy', 'tie fighter', 'x-wing'];
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
  const num = (s) => (s == null ? 1 : NUMW[s] != null ? NUMW[s] : +s);

  let TRAITS = null;
  function traits() {
    if (TRAITS) return TRAITS;
    const set = new Set();
    for (const c of SWU.DB.list) for (const t of c.tr || []) set.add(t.toLowerCase());
    TRAITS = [...set].sort((a, b) => b.length - a.length);
    return TRAITS;
  }
  const ASP = ['vigilance', 'command', 'aggression', 'cunning', 'heroism', 'villainy'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function kwObj(list) {
    const kw = {};
    for (const raw of list) {
      const s = raw.trim().toLowerCase();
      let m;
      if ((m = s.match(/^(raid|restore) (\d+)$/))) kw[cap(m[1])] = (kw[cap(m[1])] || 0) + +m[2];
      else if (KW.map((k) => k.toLowerCase()).includes(s)) kw[cap(s)] = true;
      else return null;
    }
    return kw;
  }
  function splitKw(s) {
    return s
      .replace(/,? and /g, ', ')
      .split(/,\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // ================= 目標片語 =================
  const SPEC = {
    'this unit': { sel: 'self' },
    'this leader': { sel: 'self' },
    'attached unit': { sel: 'attached' },
    it: { sel: 'prev' },
    'that unit': { sel: 'prev' },
    them: { sel: 'prev' },
    'each of them': { sel: 'prev' },
    'each of those units': { sel: 'prev' },
    'that enemy unit': { sel: 'prev' },
    'that friendly unit': { sel: 'prev' },
    'the chosen unit': { sel: 'prev' },
    'him': { sel: 'self' },
    'her': { sel: 'self' },
    'those units': { sel: 'prev' },
    'the defending unit': { sel: 'defender' },
    'the defender': { sel: 'defender' },
    'the attacking unit': { sel: 'attacker' },
    'the attacker': { sel: 'attacker' },
    'your base': { sel: 'base', side: 'friendly' },
    'a friendly base': { sel: 'base', side: 'friendly' },
    'each enemy base': { sel: 'base', side: 'enemy' },
    'the enemy base': { sel: 'base', side: 'enemy' },
    'an enemy base': { sel: 'base', side: 'enemy' },
    "each opponent's base": { sel: 'base', side: 'enemy' },
    "an opponent's base": { sel: 'base', side: 'enemy' },
    "the opponent's base": { sel: 'base', side: 'enemy' },
    "the defending player's base": { sel: 'base', side: 'enemy' },
    'a base': { sel: 'chooseBase' },
    'each base': { sel: 'base', side: 'any' },
  };
  GFX.parseTarget = parseTarget;
  function parseTarget(raw) {
    let s = raw
      .trim()
      .replace(/\.$/, '')
      .toLowerCase()
      .replace(/[’]/g, "'");
    if (SPEC[s]) return { ...SPEC[s] };
    const t = { sel: 'choose', side: 'any', f: {} };
    let m;
    if ((m = s.match(/^(.*) or (?:a |an )?(enemy |friendly )?base$/))) {
      s = m[1];
      t.base = m[2] ? m[2].trim() : 'any';
    }
    if ((m = s.match(/^each of up to (\w+) (?:different )?/))) {
      t.sel = 'upTo';
      t.count = num(m[1]);
    } else if ((m = s.match(/^up to (\w+) (?:different )?/))) {
      t.sel = 'upTo';
      t.count = num(m[1]);
    } else if ((m = s.match(/^each other /)) || (m = s.match(/^all other /))) {
      t.sel = 'each';
      t.f.notSelf = true;
    } else if ((m = s.match(/^(each|all|every) /))) t.sel = 'each';
    else if ((m = s.match(/^another /))) t.f.notSelf = true;
    else if ((m = s.match(/^other /))) {
      t.sel = 'each';
      t.f.notSelf = true;
    } else if ((m = s.match(/^(a|an) /))) {
    } else if ((m = s.match(/^(\d+|two|three) /))) {
      t.sel = 'upTo';
      t.count = num(m[1]);
      t.exact = true;
    } else m = ['']; // 複數主詞（靜態效果）
    s = s.slice(m[0].length);
    const mm = s.match(/^(.*?)\bunits?\b(.*)$/);
    if (!mm) return null;
    if (!m[0] && !/units\b/.test(s)) return null;
    if (!m[0]) t.sel = 'each';
    let words = mm[1].trim();
    let suf = mm[2].trim();
    const f = t.f;
    const TR = traits();
    while (words) {
      let w;
      if ((w = words.match(/^(friendly|enemy)\b/))) t.side = w[1];
      else if ((w = words.match(/^other\b/))) f.notSelf = true;
      else if ((w = words.match(/^non-leader\b/))) f.nonLeader = true;
      else if ((w = words.match(/^leader\b/))) f.leader = true;
      else if ((w = words.match(/^non-unique\b/))) f.nonUnique = true;
      else if ((w = words.match(/^unique\b/))) f.unique = true;
      else if ((w = words.match(/^(damaged|undamaged|exhausted|ready|upgraded)\b/))) f[w[1]] = true;
      else if ((w = words.match(/^(ground|space)\b/))) f.arena = cap(w[1]);
      else if ((w = words.match(/^non-token\b/))) f.nonToken = true;
      else if ((w = words.match(/^token\b/))) f.token = true;
      else if ((w = words.match(new RegExp('^(' + ASP.join('|') + ') or (' + ASP.join('|') + ')\\b')))) f.anyAspects = [cap(w[1]), cap(w[2])];
      else if ((w = words.match(new RegExp('^(' + ASP.join('|') + ')\\b')))) (f.aspects = f.aspects || []).push(cap(w[1]));
      else if ((w = words.match(/^non-([a-z][a-z\- ]*?)\s*$/)) || (w = words.match(/^non-([a-z][a-z\-]*)\b/))) {
        if (!TR.includes(w[1])) return null;
        (f.notTraits = f.notTraits || []).push(w[1].toUpperCase());
      } else {
        const tr = TR.find((x) => words === x || words.startsWith(x + ' '));
        if (!tr) return null;
        const rest = words.slice(tr.length).trim();
        const or = rest.match(/^or ([a-z][a-z\- ]*)$/);
        const tr2 = or && TR.find((x) => or[1] === x);
        if (tr2) {
          f.anyTraits = [tr.toUpperCase(), tr2.toUpperCase()];
          w = [words];
        } else {
          w = [tr];
          (f.traits = f.traits || []).push(tr.toUpperCase());
        }
      }
      words = words.slice(w[0].length).trim();
    }
    while (suf) {
      suf = suf.replace(/^,\s*|^and\s+/, '').trim();
      if (!suf) break;
      let w;
      if ((w = suf.match(/^(?:that|which) costs? (\d+) or less\b/)) || (w = suf.match(/^with a cost of (\d+) or less\b/))) f.maxCost = +w[1];
      else if ((w = suf.match(/^(?:that|which) costs? (\d+) or more\b/)) || (w = suf.match(/^with a cost of (\d+) or more\b/))) f.minCost = +w[1];
      else if ((w = suf.match(/^with (\d+) or less power\b/))) f.maxPower = +w[1];
      else if ((w = suf.match(/^with (\d+) or more power\b/))) f.minPower = +w[1];
      else if ((w = suf.match(/^with (\d+) or less remaining hp\b/))) f.maxRem = +w[1];
      else if ((w = suf.match(/^with (\d+) or more remaining hp\b/))) f.minRem = +w[1];
      else if ((w = suf.match(/^(?:that )?you control\b/))) t.side = 'friendly';
      else if ((w = suf.match(/^(?:that )?an opponent controls\b/))) t.side = 'enemy';
      else if ((w = suf.match(/^in (?:this unit's|the same) arena\b/))) f.sameArena = true;
      else if ((w = suf.match(/^(?:with an upgrade on it|that has an upgrade on it|that is upgraded)\b/))) f.upgraded = true;
      else if ((w = suf.match(/^with a shield token on it\b/))) f.shielded = true;
      else if ((w = suf.match(/^without a shield token on it\b/))) f.noShield = true;
      else if ((w = suf.match(/^without an experience token on it\b/))) f.noExp = true;
      else if ((w = suf.match(/^with (sentinel|overwhelm|saboteur|grit|ambush|hidden|shielded|raid|restore)\b/))) f.hasKw = cap(w[1]);
      else if ((w = suf.match(/^(?:that )?you played this phase\b/))) {
        t.side = 'friendly';
        f.playedThisPhase = true;
      } else if ((w = suf.match(/^that entered play this phase\b/))) f.playedThisPhase = true;
      else if ((w = suf.match(/^(?:without any upgrades|with no upgrades on it|with no upgrades)\b/))) f.noUpgrades = true;
      else if ((w = suf.match(/^named ([^,]+?)(?=,| and |$)/))) f.name = w[1].trim();
      else return null;
      suf = suf.slice(w[0].length).trim();
    }
    return t;
  }

  // ================= 句子 → 步驟 =================
  function amountOf(s) {
    s = s.toLowerCase();
    if (/^(this unit's|its) power$/.test(s)) return { x: 'power', of: s.startsWith('this') ? 'self' : 'prev' };
    if (/^attached unit's power$/.test(s)) return { x: 'power', of: 'attached' };
    if (/^the attacker's power$/.test(s)) return { x: 'power', of: 'attacker' };
    if (/^the (?:amount of )?damage on this unit$/.test(s)) return { x: 'damage', of: 'self' };
    if (/^(?:the )?(?:its|that unit's) cost$/.test(s)) return { x: 'cost', of: 'prev' };
    if (/^(?:the )?damage on your base$/.test(s)) return { x: 'baseDamage' };
    let m;
    if ((m = s.match(/^(\w+) times (.+)$/)) && num(m[1]) && amountOf(m[2])) return { x: 'mul', k: num(m[1]), of: amountOf(m[2]) };
    if ((m = s.match(/^the number of (.+)$/))) {
      const t = parseTarget('each ' + m[1].replace(/units$/, 'unit'));
      if (t && t.sel === 'each') return { x: 'count', side: t.side, f: t.f };
      if (/^cards in your hand$/.test(m[1])) return { x: 'hand' };
      if (/^resources you control$/.test(m[1])) return { x: 'resources' };
      if (/^cards in your discard pile$/.test(m[1])) return { x: 'discard' };
      if (/^upgrades on (this unit|it)$/.test(m[1])) return { x: 'upgrades', of: m[1] === 'it' ? 'prev' : 'self' };
    }
    return null;
  }
  // 「for each X」的 X（單數）
  function eachOf(s) {
    s = s.toLowerCase().trim();
    let mm0;
    if (/^resource you control$/.test(s)) return { x: 'resources' };
    if (/^card in your hand$/.test(s)) return { x: 'hand' };
    if (/^upgrade on (this unit|it)$/.test(s)) return { x: 'upgrades', of: /it$/.test(s) ? 'prev' : 'self' };
    if (/^card in your discard pile$/.test(s)) return { x: 'discard' };
    if ((mm0 = s.match(/^(enemy |friendly )?unit (?:that was )?defeated this phase$/))) return { x: 'defeatedCount', side: mm0[1] ? mm0[1].trim() : 'any' };
    if (/^(?:friendly )?credit token(?: you control)?$/.test(s)) return { x: 'credits' };
    if ((mm0 = s.match(/^(.+?) in your discard pile$/)) && cardFilter('a ' + mm0[1])) return { x: 'discardCount', f: cardFilter('a ' + mm0[1]) };
    if (/^damage on this unit$/.test(s)) return { x: 'damage', of: 'self' };
    if (/^damage on (?:the defender|the defending unit)$/.test(s)) return { x: 'damage', of: 'defender' };
    let mm;
    if ((mm = s.match(/^(\d+) damage on your base$/))) return { x: 'div', k: +mm[1], of: { x: 'baseDamage' } };
    const t = parseTarget('each ' + s);
    if (t && t.sel === 'each') return { x: 'count', side: t.side, f: t.f };
    return null;
  }
  GFX.eachOf = eachOf;
  // 解析一個子句（已去掉 You may / If you do），回傳步驟陣列或 null
  function parseClause(s0, env) {
    const s = s0
      .trim()
      .replace(/\.$/, '')
      .replace(/[’]/g, "'");
    const l = s.toLowerCase();
    let m, t;
    const T = (x) => parseTarget(x);
    if ((m = s.match(/^note: (.+)$/i))) return [{ op: 'note', text: m[1] }];
    if (env.lastAttack && (m = l.match(/^(?:it|that unit) gets ([+-]\d+)\/([+-]\d+) for this attack for each (.+)$/)) && eachOf(m[3])) {
      env.lastAttack.per = { p: +m[1], h: +m[2], of: eachOf(m[3]) };
      return [];
    }
    if ((m = l.match(/^(.+?) for each (.+)$/)) && eachOf(m[2])) {
      const inner = parseClause(m[1], env);
      if (inner && inner.length === 1) {
        const st = inner[0];
        const per = eachOf(m[2]);
        if (st.op === 'buff') st.per = per;
        else if (st.op === 'attackMod') st.per = per;
        else if (typeof st.n === 'number') st.n = { x: 'mul', k: st.n, of: per };
        else return null;
        return inner;
      }
    }
    if ((m = l.match(/^return (a|an|up to \w+) (.+?) from your discard pile to your hand$/)) && (t = cardFilter('a ' + m[2])))
      return [{ op: 'recover', f: t, count: m[1].startsWith('up to') ? num(m[1].slice(6)) : 1, to: 'hand', upTo: m[1].startsWith('up to') }];
    if ((m = l.match(/^put (a|an|up to \w+) (.+?) from your discard pile on the bottom of your deck$/)) && (t = cardFilter('a ' + m[2])))
      return [{ op: 'recover', f: t, count: m[1].startsWith('up to') ? num(m[1].slice(6)) : 1, to: 'bottom', upTo: m[1].startsWith('up to') }];
    if ((m = l.match(/^play (a|an) (.+?) from your discard pile( for free)?$/)) && (t = cardFilter('a ' + m[2]))) {
      const st = { op: 'playFromDiscard', f: t, free: !!m[3], discount: 0 };
      env.lastPlay = st;
      return [st];
    }
    if ((m = l.match(/^take control of (.+?)( until the regroup phase)?$/)) && (t = T(m[1]))) return [{ op: 'takeControl', target: t, temp: !!m[2] }];
    if ((m = l.match(/^deal (\d+) indirect damage to (?:each opponent|a player|an opponent|the defending player|each player)$/))) return [{ op: 'damage', n: +m[1], target: { sel: 'base', side: 'enemy' } }];
    if ((m = l.match(/^look at an opponent's hand(?: and|\.)? (?:you may )?discard a (.+?) from it$/)))
      return [{ op: 'discardOpp', f: m[1] === 'card' ? {} : cardFilter('a ' + m[1]) || {} }];
    if (/^look at an opponent's hand$/.test(l)) return [{ op: 'lookHand' }];
    if ((m = l.match(new RegExp('^disclose ((?:(?:' + ASP.join('|') + ')\\s*)+)$')))) return [{ op: 'disclose', aspects: m[1].trim().split(/\s+/).map(cap) }];
    if ((m = l.match(/^discard (?:a|an|1) (.+?) from (?:it|those cards|their hand)$/))) return [{ op: 'discardOpp', f: m[1] === 'card' || m[1] === 'of those cards' ? {} : cardFilter('a ' + m[1]) || {} }];
    if (/^(?:an|each) opponent discards a random card from their hand$/.test(l)) return [{ op: 'discard', n: 1, who: 'opp', random: true }];
    if ((m = l.match(/^(.+?) deals damage equal to its power to (.+)$/))) {
      const a = T(m[1]),
        b = T(m[2]);
      if (a && b) return [{ op: 'source', target: a }, { op: 'damage', n: { x: 'power', of: 'src' }, target: b, ifPrev: true }];
    }
    if ((m = l.match(/^search the top (\d+) cards of your deck for (a|an|up to (\w+)) (.+?),? and play (?:it|them)( for free|, ignoring its aspect penalties)?$/))) {
      const cf = cardFilter(m[4]);
      if (cf) {
        const st = { op: 'search', n: +m[1], count: m[3] ? num(m[3]) : 1, f: cf, to: 'play', free: m[5] === ' for free', ignoreAspect: /ignoring/.test(m[5] || ''), discount: 0 };
        env.lastPlay = st;
        return [st];
      }
    }
    if (/^use this ability only once each round$/.test(l)) {
      env.limitRound = true;
      return [];
    }
    // 傷害
    if ((m = l.match(/^deal (\d+) damage to (.+)$/)) && (t = T(m[2]))) return [{ op: 'damage', n: +m[1], target: t }];
    if ((m = l.match(/^deal damage equal to (.+?) to (.+)$/)) && amountOf(m[1]) && (t = T(m[2]))) return [{ op: 'damage', n: amountOf(m[1]), target: t }];
    if ((m = l.match(/^deal damage to (.+?) equal to (.+)$/)) && amountOf(m[2]) && (t = T(m[1]))) return [{ op: 'damage', n: amountOf(m[2]), target: t }];
    if ((m = l.match(/^heal up to (\d+) damage from (.+)$/)) && (t = T(m[2]))) return [{ op: 'heal', n: +m[1], target: t }];
    if ((m = l.match(/^deal (\d+) damage to (.+?) and (\d+) damage to (.+)$/))) {
      const a = T(m[2]),
        b = T(m[4]);
      if (a && b) return [{ op: 'damage', n: +m[1], target: a }, { op: 'damage', n: +m[3], target: b }];
    }
    if ((m = l.match(/^heal (\d+) damage from (.+)$/)) && (t = T(m[2]))) return [{ op: 'heal', n: +m[1], target: t }];
    if ((m = l.match(/^heal all damage from (.+)$/)) && (t = T(m[1]))) return [{ op: 'heal', n: 99, target: t }];
    // 擊敗
    if ((m = l.match(/^defeat (a|an) (friendly |enemy )?(non-unique )?upgrade(?: that costs (\d+) or less)?$/)))
      return [{ op: 'defeatUpgrade', f: { side: m[2] ? m[2].trim() : null, nonUnique: !!m[3], maxCost: m[4] ? +m[4] : null } }];
    if ((m = l.match(/^defeat (.+)$/)) && (t = T(m[1]))) return [{ op: 'defeat', target: t }];
    // 代幣升級
    if ((m = l.match(/^give (a|an|\w+) (shield|experience|advantage|weakness) tokens? to (.+)$/)) && (t = T(m[3]))) return [{ op: 'token', name: TOKENS[m[2]], n: num(m[1]), target: t }];
    if ((m = l.match(/^give (a|an) (shield|experience) token to (.+?) and (?:a|an) (shield|experience) token to (.+)$/))) {
      const a = T(m[3]),
        b = T(m[5]);
      if (a && b) return [{ op: 'token', name: TOKENS[m[2]], n: 1, target: a }, { op: 'token', name: TOKENS[m[4]], n: 1, target: b }];
    }
    if ((m = l.match(/^give (a|an|\w+) (shield|experience) tokens? and (a|an|\w+) (shield|experience) tokens? to (.+)$/)) && (t = T(m[5])))
      return [{ op: 'token', name: TOKENS[m[2]], n: num(m[1]), target: t }, { op: 'token', name: TOKENS[m[4]], n: num(m[3]), target: { sel: 'prev' } }];
    // 加減數值
    const UNTIL = '(?: for this (phase|attack))?';
    if ((m = l.match(new RegExp('^give (.+?) ([+-]\\d+)/([+-]\\d+)(?: and (' + KWRE + '(?:(?:,| and|, and) ' + KWRE + ')*))?' + UNTIL + '$')))) {
      t = T(m[1]);
      const kw = m[4] ? kwObj(splitKw(m[4])) : {};
      if (t && kw) return [{ op: 'buff', p: +m[2], h: +m[3], kw, until: m[5] || 'phase', target: t }];
    }
    if ((m = l.match(new RegExp('^give (.+?) (' + KWRE + '(?:(?:,| and|, and) ' + KWRE + ')*)' + UNTIL + '$')))) {
      t = T(m[1]);
      const kw = kwObj(splitKw(m[2]));
      if (t && kw) return [{ op: 'buff', p: 0, h: 0, kw, until: m[3] || 'phase', target: t }];
    }
    if ((m = l.match(new RegExp('^(.+?) gets? ([+-]\\d+)/([+-]\\d+)(?: and gains? (' + KWRE + '(?:(?:,| and|, and) ' + KWRE + ')*))?' + ' for this (phase|attack)$')))) {
      t = T(m[1]);
      const kw = m[4] ? kwObj(splitKw(m[4])) : {};
      if (t && kw) {
        if (env.lastAttack && t.sel === 'prev' && m[5] === 'attack') {
          env.lastAttack.p = (env.lastAttack.p || 0) + +m[2];
          env.lastAttack.h = (env.lastAttack.h || 0) + +m[3];
          Object.assign((env.lastAttack.kw = env.lastAttack.kw || {}), kw);
          return [];
        }
        return [{ op: 'buff', p: +m[2], h: +m[3], kw, until: m[5], target: t }];
      }
    }
    if ((m = l.match(new RegExp('^(.+?) gains? (' + KWRE + '(?:(?:,| and|, and) ' + KWRE + ')*) for this (phase|attack)$')))) {
      t = T(m[1]);
      const kw = kwObj(splitKw(m[2]));
      if (t && kw) {
        if (env.lastAttack && t.sel === 'prev' && m[3] === 'attack') {
          Object.assign((env.lastAttack.kw = env.lastAttack.kw || {}), kw);
          return [];
        }
        return [{ op: 'buff', p: 0, h: 0, kw, until: m[3], target: t }];
      }
    }
    if (env.lastAttack && /^(it|that unit) can't attack bases for this attack$/.test(l)) {
      env.lastAttack.noBase = true;
      return [];
    }
    // 狀態
    if ((m = l.match(/^ready (a|an|\w+) resources?$/))) return [{ op: 'readyResource', n: num(m[1]) }];
    if ((m = l.match(/^(exhaust|ready) (.+)$/)) && (t = T(m[2]))) return [{ op: m[1], target: t }];
    if ((m = l.match(/^return (.+?) to (?:its|their) owner's hand$/)) && (t = T(m[1]))) return [{ op: 'bounce', target: t }];
    if ((m = l.match(/^(?:this unit )?captures? (.+)$/)) && (t = T(m[1]))) return [{ op: 'capture', target: t }];
    if ((m = l.match(/^(a friendly .*?unit) captures (.+)$/)) && T(m[1]) && (t = T(m[2]))) return [{ op: 'source', target: T(m[1]) }, { op: 'capture', target: t, by: 'src', ifPrev: true }];
    // 卡片
    if ((m = l.match(/^draw (a|an|\w+) cards?$/))) return [{ op: 'draw', n: num(m[1]) }];
    if ((m = l.match(/^(?:each|an|the) opponent draws (a|an|\w+) cards?$/))) return [{ op: 'draw', n: num(m[1]), who: 'opp' }];
    if ((m = l.match(/^discard (a|\w+) cards? from your hand$/))) return [{ op: 'discard', n: num(m[1]), who: 'me' }];
    if ((m = l.match(/^(?:each|an|the) opponent discards (a|\w+) cards? from their hand$/))) return [{ op: 'discard', n: num(m[1]), who: 'opp' }];
    if ((m = l.match(/^discard (a|\w+) cards? from (?:the top of )?your deck$/))) return [{ op: 'mill', n: num(m[1]), who: 'me' }];
    if ((m = l.match(/^(?:each|an) opponent discards (a|\w+) cards? from (?:the top of )?their deck$/))) return [{ op: 'mill', n: num(m[1]), who: 'opp' }];
    if ((m = l.match(/^create (a|an|\w+) credit tokens?$/))) return [{ op: 'credit', n: num(m[1]) }];
    if ((m = l.match(/^(its controller |their controller |an opponent |each opponent )?creates? (a|an|\w+) ([a-z\- ]+?) tokens?$/)) && UNIT_TOKENS.includes(m[3]))
      return [{ op: 'createToken', n: num(m[2]), name: tokenName(m[3]), who: !m[1] ? 'me' : /opponent/.test(m[1]) ? 'opp' : 'prevCtrl' }];
    if (/^(put the top card of your deck into play as a resource|resource the top card of your deck)$/.test(l)) return [{ op: 'resourceTop', n: 1 }];
    if (/^the force is with you$/.test(l)) return [{ op: 'force' }];
    if (/^use the force$/.test(l)) return [{ op: 'useForce' }];
    if ((m = l.match(/^pay (\d+) resources?$/)) || (m = l.match(/^pay (\d+)$/))) return [{ op: 'pay', n: +m[1] }];
    if (/^exhaust this leader$/.test(l)) return [{ op: 'exhaustSelf' }];
    if ((m = l.match(/^search the top (\d+) cards of your deck for (a|an|up to (\w+)) (.+?),? reveal (?:it|them),? and draw (?:it|them)$/))) {
      const cf = cardFilter(m[4]);
      if (cf) return [{ op: 'search', n: +m[1], count: m[3] ? num(m[3]) : 1, f: cf, to: 'hand' }];
    }
    // 攻擊
    if ((m = l.match(/^attack with (.+?)(, even if it's exhausted)?$/)) && (t = T(m[1]))) {
      const st = { op: 'attack', target: t, exhaustedOk: !!m[2] };
      env.lastAttack = st;
      return [st];
    }
    if ((m = l.match(/^(?:it|that unit|this unit) can't attack bases for this attack$/)) && env.lastAttack) {
      env.lastAttack.noBase = true;
      return [];
    }
    // 打出手牌
    if (/^play a card from your hand, ignoring 1 of its .*aspect penalties$/.test(l)) return [{ op: 'playFromHand', f: {}, discount: 2, penaltyOnly: true }];
    if ((m = l.match(/^play (.+?) from your hand(?:, ignoring its aspect penalties| for free)?$/))) {
      const cf = cardFilter(m[1]);
      if (cf) {
        const st = { op: 'playFromHand', f: cf, ignoreAspect: /ignoring its aspect/.test(l), free: /for free/.test(l), discount: 0 };
        env.lastPlay = st;
        return [st];
      }
    }
    if ((m = l.match(/^(?:it|that card) costs (\d+) less$/)) && env.lastPlay) {
      env.lastPlay.discount += +m[1];
      return [];
    }
    // 「A and B」兩個動作
    const parts = s.split(/ and (?=(?:deal|heal|give|create|draw|ready|exhaust|defeat|return|discard)\b)/i);
    if (parts.length === 2) {
      const a = parseClause(parts[0], env);
      const b = a && parseClause(parts[1], env);
      if (a && b) return [...a, ...b];
    }
    return null;
  }
  function tokenName(s) {
    return { 'battle droid': 'Battle Droid', beast: 'Beast', 'clone trooper': 'Clone Trooper', mandalorian: 'Mandalorian', spy: 'Spy', 'tie fighter': 'TIE Fighter', 'x-wing': 'X-Wing' }[s];
  }
  // 「a Force unit」「an event」「a card」「a unit that costs 3 or less」
  function cardFilter(s) {
    s = s.toLowerCase().trim();
    const f = {};
    let m;
    if ((m = s.match(/^(.*?)\s*(?:that|which) (?:each )?costs? (\d+) or less$/))) {
      f.maxCost = +m[2];
      s = m[1];
    } else if ((m = s.match(/^(.*?)\s*(?:that|which) (?:each )?costs? (\d+) or more$/))) {
      f.minCost = +m[2];
      s = m[1];
    }
    s = s.replace(/^(a|an|up to \w+)\s+/, '');
    if (/^non-(unit|event|upgrade) cards?$/.test(s)) s = s.replace(/ cards?$/, ' card');
    m = s.match(/^(.*?)\s*\b(card|unit|event|upgrade)s?$/);
    if (m && /non-$/.test(m[1])) m = ['', m[1] + m[2], 'card'];
    if (!m) return null;
    if (m[2] !== 'card') f.type = cap(m[2]);
    let w = m[1].trim();
    const TR = traits();
    while (w) {
      let x;
      if ((x = w.match(new RegExp('^(' + ASP.join('|') + ')\\b')))) (f.aspects = f.aspects || []).push(cap(x[1]));
      else if ((x = w.match(/^(ground|space)\b/))) f.arena = cap(x[1]);
      else if ((x = w.match(/^non-unique\b/))) f.nonUnique = true;
      else if ((x = w.match(/^non-(unit|event|upgrade)\b/))) f.notType = cap(x[1]);
      else if ((x = w.match(/^unique\b/))) f.unique = true;
      else if ((x = w.match(/^non-([a-z][a-z\-]*)\b/)) && TR.includes(x[1])) (f.notTraits = f.notTraits || []).push(x[1].toUpperCase());
      else if ((x = w.match(new RegExp('^non-(' + ASP.join('|') + ')\\b')))) (f.notAspects = f.notAspects || []).push(cap(x[1]));
      else {
        const tr = TR.find((y) => w === y || w.startsWith(y + ' '));
        if (!tr) return null;
        x = [tr];
        (f.traits = f.traits || []).push(tr.toUpperCase());
      }
      w = w.slice(x[0].length).trim();
    }
    return f;
  }

  // 條件「If you control a Force unit」「If you have the initiative」
  function parseCond(s) {
    const l = s
      .toLowerCase()
      .trim()
      .replace(/[’]/g, "'");
    let m, t;
    if (/^you have the initiative$/.test(l)) return { initiative: true };
    if ((m = l.match(/^(?:an|each) opponent controls no (ground |space )?units$/))) return { not: { count: { side: 'enemy', f: m[1] ? { arena: cap(m[1].trim()) } : {} }, min: 1 } };
    if (/^you control fewer resources than (?:an|that) opponent$/.test(l)) return { fewerResources: true };
    if (/^you have fewer cards in (?:your )?hand than (?:an|that) opponent$/.test(l)) return { fewerCards: true };
    if (/^you control (?:a ground unit and a space unit|a unit in each arena)$/.test(l))
      return { all: [{ count: { side: 'friendly', f: { arena: 'Ground' } }, min: 1 }, { count: { side: 'friendly', f: { arena: 'Space' } }, min: 1 }] };
    if ((m = l.match(/^the (?:defending unit|defender) is (?:a |an )?(.+)$/)) && (t = parseTarget('a ' + m[1] + ' unit'))) return { defenderIs: t.f };
    if ((m = l.match(/^(?:an|a) (enemy|friendly)?\s*unit was defeated this phase$/))) return { defeatedThisPhase: m[1] || 'any' };
    if ((m = l.match(/^you control fewer (ground |space )?units than (?:an|that) opponent$/))) return { fewerUnits: m[1] ? cap(m[1].trim()) : true };
    if ((m = l.match(/^you control more (ground |space )?units than (?:an|that) opponent$/))) return { moreUnits: m[1] ? cap(m[1].trim()) : true };
    if ((m = l.match(/^there is (?:a|an) (.+?) in your discard pile$/)) && (t = cardFilter('a ' + m[1]))) return { discardHas: t };
    if ((m = l.match(/^you(?:'ve| have) attacked with (?:a|an|another) (.+?) this phase$/)) && (t = parseTarget('a ' + m[1]))) return { attackedThisPhase: t.f, other: /another/.test(l) };
    if ((m = l.match(/^you(?:'ve| have) played (?:a|an|another) (.+?) this phase$/)) && (t = cardFilter('a ' + m[1]))) return { playedThisPhase: t };
    if ((m = l.match(/^(?:this unit|it) is undamaged$/))) return { not: { selfDamaged: true } };
    if (/^this unit is upgraded$/.test(l)) return { selfUpgraded: true };
    if ((m = l.match(/^this unit is (?:a|an) (.+?)(?: unit)?$/)) && (t = parseTarget('a ' + m[1] + ' unit'))) return { selfIs: t.f };
    if ((m = l.match(/^(?:it|that card|the discarded card) (?:is|was) (?:a|an) (.+)$/)) && (t = cardFilter('a ' + m[1]))) return { prevIs: t };
    if ((m = l.match(/^attached unit is (?:a|an) (.+?)$/)) && (t = parseTarget('a ' + m[1] + (/unit$/.test(m[1]) ? '' : ' unit')))) return { attachedIs: t.f };
    if ((m = l.match(/^attached unit is ([a-z\-' ]+)$/))) return { attachedIs: { name: m[1] } };
    if ((m = l.match(/^(?:it's|it is|this unit is) attacking a unit$/))) return { not: { attackingBase: true } };
    if ((m = l.match(/^(?:it's|it is|this unit is) attacking a base$/))) return { attackingBase: true };
    if ((m = l.match(/^your base has (\d+) or less remaining hp$/))) return { baseRemainingMax: +m[1] };
    if ((m = l.match(/^an opponent's base has (\d+) or less remaining hp$/))) return { enemyBaseRemainingMax: +m[1] };
    if ((m = l.match(/^you have (\d+) or more cards in your hand$/))) return { handMin: +m[1] };
    if ((m = l.match(/^you have no cards in your hand$/))) return { handMax: 0 };
    if ((m = l.match(/^you control (\d+) or more resources$/))) return { resourcesMin: +m[1] };
    if ((m = l.match(/^the force is with you$/))) return { force: true };
    if (/^you don't have the initiative$/.test(l)) return { not: { initiative: true } };
    if ((m = l.match(/^you control (\w+) or more (.+)$/)) && (t = parseTarget('each friendly ' + m[2].replace(/units$/, 'unit'))))
      return { count: { side: 'friendly', f: t.f }, min: num(m[1]) };
    if ((m = l.match(/^you control (?:at least )?(\w+) (?:or more )?units$/)) && num(m[1])) return { count: { side: 'friendly', f: {} }, min: num(m[1]) };
    if ((m = l.match(/^you control (?:a|an|another) (.+)$/)) && (t = parseTarget('a ' + m[1]))) {
      if (/^another/.test(l.slice(12))) t.f.notSelf = true;
      return { count: { side: 'friendly', f: t.f }, min: 1 };
    }
    if ((m = l.match(/^you control (?:a|an) (.+?) leader$/)) || (m = l.match(/^your leader is (?:a|an) (.+)$/))) {
      const tr = traits().find((x) => x === m[1]);
      if (tr) return { leaderTrait: tr.toUpperCase() };
    }
    if ((m = l.match(/^an opponent controls (\w+) or more (.+)$/)) && (t = parseTarget('each enemy ' + m[2].replace(/units$/, 'unit'))))
      return { count: { side: 'enemy', f: t.f }, min: num(m[1]) };
    if ((m = l.match(/^(?:an|each) opponent controls (?:a|an) (.+)$/)) && (t = parseTarget('a ' + m[1]))) return { count: { side: 'enemy', f: t.f }, min: 1 };
    if ((m = l.match(/^the (?:defending unit|defender) (?:was|is) defeated$/))) return { defenderDefeated: true };
    if ((m = l.match(/^(?:it|that unit) (?:was|is) defeated$/))) return { prevDefeated: true };
    if ((m = l.match(/^(?:it|that unit) survived$/))) return { not: { prevDefeated: true } };
    if ((m = l.match(/^(?:this unit|it) is damaged$/))) return { selfDamaged: true };
    if ((m = l.match(/^your base has (\d+) or more damage on it$/))) return { baseDamage: +m[1] };
    if ((m = l.match(/^you control (?:a|an) (.+) base$/)) || (m = l.match(/^your base is (?:a|an) (.+)$/))) {
      const tr = traits().find((x) => x === m[1]);
      if (tr) return { baseTrait: tr.toUpperCase() };
    }
    if ((m = l.match(/^this unit is attacking (?:a|an enemy) base$/))) return { attackingBase: true };
    return null;
  }

  // 一段能力文字 → 步驟
  function parseBody(body) {
    const env = {};
    const steps = [];
    body = body.trim().replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (!body) return [];
    const sentences = body
      .replace(/\. Then,? /g, '. ')
      .replace(/, then /g, '. ')
      .split(/(?<=\.)\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (let sen of sentences) {
      sen = sen.replace(/\.$/, '');
      let ifPrev = false,
        ifNot = false,
        optional = false,
        cond = null;
      let m;
      if ((m = sen.match(/^if you do(?![n'])\b,?\s*/i))) {
        ifPrev = true;
        sen = sen.slice(m[0].length);
      } else if ((m = sen.match(/^if you (?:don't|do not),?\s*/i))) {
        ifNot = true;
        sen = sen.slice(m[0].length);
      } else if ((m = sen.match(/^if (.+?), (.+)$/i))) {
        cond = parseCond(m[1]);
        if (!cond) return null;
        sen = m[2];
      }
      if ((m = sen.match(/^you may\s+/i))) {
        optional = true;
        sen = sen.slice(m[0].length);
      }
      if ((m = sen.match(/^for this phase, (.+)$/i))) return null;
      if (cond && /\s+instead$/i.test(sen) && steps.length) {
        const alt = parseClause(sen.replace(/\s+instead$/i, ''), env);
        if (!alt) return null;
        if (optional && alt.length) alt[0].optional = true;
        const last = steps[steps.length - 1];
        last.alt = { cond, steps: alt };
        continue;
      }
      const st = parseClause(sen, env);
      if (!st) return null;
      if (st.length) {
        if (ifPrev) st[0].ifPrev = true;
        if (ifNot) st[0].ifNotPrev = true;
        if (optional) st[0].optional = true;
        if (cond) for (const x of st) x.cond = cond;
        if (optional && st.length > 1) for (const x of st.slice(1)) x.ifPrev = true;
      }
      steps.push(...st);
    }
    if (env.limitRound) steps.unshift({ op: 'limitRound' });
    return steps;
  }
  GFX.parseBody = parseBody;

  // 靜態句：「This unit gets +1/+0」「Each other friendly Trooper unit gains Sentinel」
  function parseStatic(line) {
    let s = line
      .trim()
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .trim()
      .replace(/\.$/, '')
      .replace(/[’]/g, "'");
    let cond = null,
      m;
    if ((m = s.match(/^Coordinate\s*[-—–]\s*(.+)$/i))) {
      cond = { count: { side: 'friendly', f: {} }, min: 3 };
      s = m[1];
    }
    if ((m = s.match(/^While (.+?), (.+)$/i))) {
      const c2 = staticCond(m[1]);
      if (!c2) return null;
      cond = cond ? { all: [cond, c2] } : c2;
      s = m[2];
    }
    if ((m = s.match(/^(.+?) while (attacking|defending)$/i))) {
      const c2 = { [m[2] === 'attacking' ? 'selfAttacking' : 'selfDefending']: true };
      cond = cond ? { all: [cond, c2] } : c2;
      s = m[1];
    }
    if ((m = s.match(/^ignore the aspect penalt(?:y|ies) on (?:each )?(.+?) you play$/i))) {
      const cf = cardFilter('a ' + m[1].replace(/s$/, '').replace(/^cards? named (.+)$/, 'card'));
      if (cf) return { trigger: 'ignorePenalty', f: cf, cond };
      return null;
    }
    if ((m = s.match(/^this (?:unit|event|upgrade|card) costs (\d+) less to play(?: for each (.+))?$/i))) {
      const per = m[2] ? eachOf(m[2]) : null;
      if (m[2] && !per) return null;
      return { trigger: 'selfCost', n: +m[1], per, cond };
    }
    if ((m = s.match(/^this (?:unit|event|upgrade) costs (\d+) less to play$/i))) return { trigger: 'selfCost', n: +m[1], cond };
    let per = null;
    if ((m = s.match(/^(.+?) for each (.+)$/i))) {
      per = eachOf(m[2]);
      if (!per) return null;
      s = m[1];
    }
    if ((m = s.match(/^(.+?) (?:costs? (\d+) less to play|you play costs? (\d+) less|you play cost (\d+) less)$/i))) {
      const n = +(m[2] || m[3] || m[4]);
      const subj = m[1].replace(/^(each|all) /i, '').trim();
      const cf = cardFilter(subj);
      if (cf && !m[2]) return { trigger: 'discount', f: cf, n, cond };
      return null;
    }
    const pm = s.match(new RegExp('^(.+?) (?:gets?|get) ([+-]\\d+)/([+-]\\d+)(?: and gains? (.+))?$', 'i')) || s.match(/^(.+?) (?:gains?|gain) (.+)$/i);
    if (!pm) return null;
    let subj = pm[1],
      p = 0,
      h = 0,
      kwText = null;
    if (pm.length === 5) {
      p = +pm[2];
      h = +pm[3];
      kwText = pm[4] || null;
    } else kwText = pm[2];
    const kw = kwText ? kwObj(splitKw(kwText)) : {};
    if (!kw) return null;
    const ls = subj.toLowerCase();
    let who;
    if (ls === 'this unit' || ls === 'this leader') who = { sel: 'self' };
    else if (ls === 'attached unit') who = { sel: 'attached' };
    else {
      who = parseTarget(ls);
      if (!who || who.sel !== 'each') return null;
    }
    return { trigger: 'static', who, p, h, kw, cond, per };
  }
  function staticCond(s) {
    const l = s.toLowerCase();
    if (/^this unit is attacking$/.test(l)) return { selfAttacking: true };
    if (/^this unit is defending$/.test(l)) return { selfDefending: true };
    if (/^this unit is damaged$/.test(l)) return { selfDamaged: true };
    if (/^this unit is ready$/.test(l)) return { not: { selfExhausted: true } };
    if (/^this unit is exhausted$/.test(l) || /^attached unit is exhausted$/.test(l)) return { selfExhausted: true };
    if (/^this unit is upgraded$/.test(l) || /^this unit has an upgrade on it$/.test(l)) return { selfUpgraded: true };
    return parseCond(s);
  }

  function norm(t) {
    return String(t || '')
      .replace(/[–−—](?=\d)/g, '-')
      .replace(/\{([^}]*)\}/g, '$1')
      .replace(/[’]/g, "'")
      .replace(/\b(SENTINEL|OVERWHELM|SABOTEUR|GRIT|AMBUSH|SHIELDED|HIDDEN|RAID|RESTORE)\b/g, (m) => cap(m.toLowerCase()));
  }
  GFX.norm = norm;
  // ================= 卡片 → 效果程式 =================
  const TRIGGERS = [
    [/^when played$/, 'whenPlayed'],
    [/^on attack$/, 'onAttack'],
    [/^when defeated$/, 'whenDefeated'],
    [/^when deployed$/, 'whenDeployed'],
    [/^bounty$/, 'bounty'],
    [/^when this unit completes an attack$/, 'attackEnd'],
    [/^when this unit's attack ends$/, 'attackEndAny'],
    [/^when attack ends$/, 'attackEndAny'],
    [/^when the regroup phase starts$/, 'regroupStart'],
    [/^when this unit completes an attack \(and survives\)$/, 'attackEnd'],
    [/^when you take the initiative$/, 'takeInitiative'],
    [/^when this unit is attacked$/, 'whenAttacked'],
    [/^when you play an event$/, 'playEvent'],
    [/^when this unit deals (?:combat )?damage to (?:a|an enemy) base$/, 'damageBase'],
    [/^when this unit attacks and defeats a unit$/, 'defeatsUnit'],
    [/^when this unit defeats a unit$/, 'defeatsUnit'],
  ];
  function parseTrigger(name) {
    const l = name.toLowerCase().trim().replace(/[’]/g, "'");
    for (const [re, t] of TRIGGERS) if (re.test(l)) return { t };
    let m, tg;
    if ((m = l.match(/^when you play (.+)$/))) {
      const s = m[1].replace(/^another /, 'a ');
      const cf = cardFilter(s);
      if (cf) return { t: 'friendlyPlay', f: cf, other: /^another/.test(m[1]) || cf.type === 'Unit' };
    }
    if ((m = l.match(/^when (.+?) attacks$/)) && (tg = parseTarget(m[1])) && tg.side === 'friendly') return { t: 'friendlyAttack', tf: tg.f };
    if ((m = l.match(/^when (.+?)'s attack ends$/)) && (tg = parseTarget(m[1])) && tg.side === 'friendly') return { t: 'friendlyAttackEnd', tf: tg.f };
    if ((m = l.match(/^when (.+?) completes an attack$/)) && (tg = parseTarget(m[1])) && tg.side === 'friendly') return { t: 'friendlyAttackEnd', tf: tg.f, survive: true };
    if ((m = l.match(/^when (.+?) is defeated$/)) && (tg = parseTarget(m[1]))) return { t: 'anyDefeated', side: tg.side, tf: tg.f };
    if (/^when an enemy unit attacks(?: your base)?$/.test(l)) return { t: 'enemyAttack', base: /base$/.test(l) };
    if ((m = l.match(/^when an opponent plays (.+)$/)) && cardFilter(m[1])) return { t: 'enemyPlay', f: cardFilter(m[1]) };
    if (/^when this unit is dealt damage(?: and survives)?$/.test(l)) return { t: 'damagedSurvive' };
    if ((m = l.match(/^when (?:another )?(.+?) enters play$/)) && (tg = parseTarget('a ' + m[1].replace(/^(a|an) /, ''))) && tg.side === 'friendly') return { t: 'friendlyPlay', f: {}, tf: tg.f, other: true };
    if ((m = l.match(/^when (.+?) is played$/)) && (tg = parseTarget(m[1]))) return { t: 'friendlyPlay', f: {}, tf: tg.f, side: tg.side };
    if (/^when a unit is defeated$/.test(l)) return { t: 'anyDefeated', side: 'any', tf: {} };
    return null;
  }
  GFX.compileRegex = function (card, side) {
    const isLeaderFront = card.t === 'Leader' && side === 'leader';
    const text = norm(side === 'unit' && card.t === 'Leader' ? card.bt || '' : card.tx || '');
    const out = { v: 1, src: 'regex', abilities: [], failed: [] };
    if (card.t === 'Event') {
      let lines = text
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x && !/^(Smuggle|Plot|Piloting)\b/.test(x));
      if (/^Choose one:?$/i.test(lines[0] || '')) {
        const opts = [];
        for (const ln of lines.slice(1)) {
          const st = parseBody(ln.replace(/^[•\-*]\s*/, ''));
          if (!st) {
            out.failed.push({ trigger: 'event', line: text });
            return out;
          }
          opts.push({ label: ln.replace(/^[•\-*]\s*/, ''), steps: st });
        }
        out.abilities.push({ trigger: 'event', steps: [{ op: 'chooseOne', options: opts }] });
        return out;
      }
      const body = lines.join(' ');
      const st = parseBody(body);
      if (st) out.abilities.push({ trigger: 'event', steps: st });
      else out.failed.push({ trigger: 'event', line: body });
      return out;
    }
    const lines = SWU.abilityLines(card, side).map(norm).filter((l) => !/^(Attach to|Smuggle|Plot|Piloting|Attached unit is a leader unit)/i.test(l));
    for (const line of lines) {
      const ab = compileLine(line, isLeaderFront, card);
      if (ab && !ab.manual) out.abilities.push(ab);
      else out.failed.push({ trigger: ab ? ab.trigger : null, line, cost: ab && ab.cost, epic: ab && ab.epic, tinfo: ab && ab.tinfo });
    }
    return out;
  };
  GFX.compileLine = (line, card) => compileLine(norm(line), card && card.t === 'Leader', card);
  function compileLine(line, isLeaderFront, card) {
    let m;
    const clean = line.replace(/[’]/g, "'");
    if ((m = clean.match(/^(Epic )?Action \[([^\]]*)\]:\s*(.*)$/i)) || (m = clean.match(/^(Epic )?Action:\s*(.*)$/i))) {
      const costS = m.length === 4 ? m[2] : '';
      const body = m.length === 4 ? m[3] : m[2];
      const cost = parseCost(costS);
      const steps = cost && parseBody(body);
      if (!cost) return { manual: true, trigger: 'action', cost: { res: 0 }, epic: !!m[1] };
      if (!steps) return { manual: true, trigger: 'action', cost, epic: !!m[1] };
      return { trigger: 'action', cost, epic: !!m[1], steps, text: line };
    }
    if ((m = clean.match(/^Bounty\s*[-—–]\s*(.*)$/i))) {
      const st = parseBody(m[1]);
      return st ? { trigger: 'bounty', steps: st } : { manual: true, trigger: 'bounty' };
    }
    if ((m = clean.match(/^Coordinate\s*[-—–]\s*(.*)$/i))) {
      const inner = m[1];
      const st = parseStatic(clean);
      if (st) return st;
      const sub = compileLine(inner, isLeaderFront, card);
      if (sub && !sub.manual) {
        sub.cond = sub.cond ? { all: [sub.cond, { count: { side: 'friendly', f: {} }, min: 3 }] } : { count: { side: 'friendly', f: {} }, min: 3 };
        return sub;
      }
      return { manual: true, trigger: sub && sub.trigger };
    }
    if ((m = clean.match(/^At the start of the (regroup|action) phase,?:?\s*(.*)$/i))) {
      const st = parseBody(m[2]);
      const tr = m[1].toLowerCase() === 'regroup' ? 'regroupStart' : 'actionPhaseStart';
      return st ? { trigger: tr, steps: st } : { manual: true, trigger: tr };
    }
    if ((m = clean.match(/^([A-Z][^:]*?):\s*(.*)$/)) && /^(When|On) /i.test(m[1])) {
      const names = m[1].split('/').map((x) => x.trim());
      const tinfos = names.map(parseTrigger);
      if (tinfos.some((x) => !x)) return null;
      const st = parseBody(m[2]);
      if (!st) return { manual: true, trigger: tinfos[0].t, tinfo: tinfos };
      return { trigger: 'multi', tinfo: tinfos, steps: st };
    }
    if ((m = clean.match(/^Attached unit gains:?\s*["“](.+)["”]\.?$/))) {
      const inner = compileLine(m[1].trim(), false, card);
      if (inner && !inner.manual) return { trigger: 'grant', inner };
      return { manual: true, trigger: 'grant' };
    }
    const sx = parseStatic(clean);
    if (sx) return sx;
    return null;
  }
  function parseCost(s) {
    const c = { res: 0, exhaust: false, force: false };
    if (!s.trim()) return c;
    for (const part of s.split(',').map((x) => x.trim())) {
      let m;
      if ((m = part.match(/^C=(\d+)$/)) || (m = part.match(/^(\d+) resources?$/))) c.res = +m[1];
      else if (/^exhaust$/i.test(part)) c.exhaust = true;
      else if (/^use the force$/i.test(part)) c.force = true;
      else return null;
    }
    return c;
  }

  // ================= 直譯器 =================
  const sideOk = (side, u, p) => side === 'any' || !side || (side === 'friendly' ? u.ctrl === p : u.ctrl !== p);
  function unitMatch(g, ctx, u, f = {}) {
    if (!f) return true;
    if (f.notSelf && ctx.self && u.uid === ctx.self.uid) return false;
    if (f.nonLeader && u.isLeader) return false;
    if (f.leader && !u.isLeader) return false;
    if (f.unique && !u.card.u) return false;
    if (f.nonUnique && u.card.u) return false;
    if (f.damaged && !(u.damage > 0)) return false;
    if (f.undamaged && u.damage > 0) return false;
    if (f.exhausted && !u.exhausted) return false;
    if (f.ready && u.exhausted) return false;
    if (f.upgraded && !(u.upgrades || []).length) return false;
    if (f.noUpgrades && (u.upgrades || []).length) return false;
    if (f.shielded && !(u.upgrades || []).some((x) => x.card.n === 'Shield')) return false;
    if (f.arena && u.arena !== f.arena) return false;
    if (f.sameArena && ctx.self && u.arena !== ctx.self.arena) return false;
    if (f.token && !/Token/.test(u.card.t)) return false;
    if (f.nonToken && /Token/.test(u.card.t)) return false;
    if (f.traits && !f.traits.every((t) => g.hasTrait(u, t))) return false;
    if (f.anyTraits && !f.anyTraits.some((t) => g.hasTrait(u, t))) return false;
    if (f.anyAspects && !f.anyAspects.some((a) => (u.card.a || []).includes(a))) return false;
    if (f.noShield && (u.upgrades || []).some((x) => x.card.n === 'Shield')) return false;
    if (f.noExp && (u.upgrades || []).some((x) => x.card.n === 'Experience')) return false;
    if (f.hasKw && !g.has(u, f.hasKw)) return false;
    if (f.playedThisPhase && u.playedPhase !== g.G.phaseId) return false;
    if (f.notTraits && f.notTraits.some((t) => g.hasTrait(u, t))) return false;
    if (f.aspects && !f.aspects.every((a) => (u.card.a || []).includes(a))) return false;
    if (f.name && u.card.n.toLowerCase() !== f.name && !u.card.n.toLowerCase().startsWith(f.name)) return false;
    if (f.maxCost != null && (u.card.c || 0) > f.maxCost) return false;
    if (f.minCost != null && (u.card.c || 0) < f.minCost) return false;
    if (f.maxPower != null && g.power(u) > f.maxPower) return false;
    if (f.minPower != null && g.power(u) < f.minPower) return false;
    if (f.maxRem != null && g.remaining(u) > f.maxRem) return false;
    if (f.minRem != null && g.remaining(u) < f.minRem) return false;
    return true;
  }
  function cardMatch(card, f = {}) {
    if (!f) return true;
    if (f.type && card.t !== f.type) return false;
    if (f.notType && card.t === f.notType) return false;
    if (f.notTraits && f.notTraits.some((t) => (card.tr || []).includes(t))) return false;
    if (f.notAspects && f.notAspects.some((a) => (card.a || []).includes(a))) return false;
    if (f.unique && !card.u) return false;
    if (f.nonUnique && card.u) return false;
    if (f.traits && !f.traits.every((t) => (card.tr || []).includes(t))) return false;
    if (f.aspects && !f.aspects.every((a) => (card.a || []).includes(a))) return false;
    if (f.arena && !(card.ar || []).includes(f.arena)) return false;
    if (f.maxCost != null && (card.c || 0) > f.maxCost) return false;
    if (f.minCost != null && (card.c || 0) < f.minCost) return false;
    return true;
  }
  GFX.unitMatch = unitMatch;
  GFX.cardMatch = cardMatch;
  let condDepth = 0;
  function checkCond(ctx, c) {
    if (!c) return true;
    const g = ctx.g;
    if (condDepth > 3) return false;
    condDepth++;
    try {
      if (c.all) return c.all.every((x) => checkCond(ctx, x));
      if (c.any) return c.any.some((x) => checkCond(ctx, x));
      if (c.not) return !checkCond(ctx, c.not);
      if (c.initiative) return g.G.initiative === ctx.p;
      if (c.count) {
        const n = g.allUnits().filter((u) => sideOk(c.count.side, u, ctx.p) && unitMatch(g, ctx, u, c.count.f)).length;
        return n >= (c.min || 1);
      }
      if (c.leaderTrait) return g.hasTrait(g.P(ctx.p).leader.card, c.leaderTrait);
      if (c.baseTrait) return g.hasTrait(g.P(ctx.p).base.card, c.baseTrait);
      if (c.baseDamage) return g.P(ctx.p).base.damage >= c.baseDamage;
      if (c.prevDefeated) {
        const u = (ctx.prev && ctx.prev[0]) || (ctx.atk && ctx.atk.defender);
        return !!u && !g.findUnit(u.uid);
      }
      if (c.defenderDefeated) {
        const a = ctx.atk || g.G.attack;
        return !!(a && a.defender && (a.defenderDefeated || !g.findUnit(a.defender.uid)));
      }
      if (c.selfDamaged) return !!ctx.self && ctx.self.damage > 0;
      if (c.selfIs) return !!(ctx.self && ctx.self.card && unitMatch(g, {}, ctx.self, c.selfIs));
      if (c.selfExhausted) return !!(ctx.self && ctx.self.exhausted);
      if (c.selfUpgraded) return !!ctx.self && (ctx.self.upgrades || []).length > 0;
      if (c.selfAttacking) return !!(g.G.attack && ctx.self && g.G.attack.attacker.uid === ctx.self.uid);
      if (c.selfDefending) return !!(g.G.attack && ctx.self && g.G.attack.defender && g.G.attack.defender.uid === ctx.self.uid);
      if (c.attackingBase) return !!((ctx.atk || g.G.attack) && (ctx.atk || g.G.attack).base);
      if (c.defeatedThisPhase) return (g.G.defeated || []).some((d) => d.phaseId === g.G.phaseId && sideOk(c.defeatedThisPhase, d, ctx.p));
      if (c.fewerUnits || c.moreUnits) {
        const ar = typeof (c.fewerUnits || c.moreUnits) === 'string' ? c.fewerUnits || c.moreUnits : null;
        const n = (q) => g.P(q).units.filter((u) => !ar || u.arena === ar).length;
        return c.fewerUnits ? n(ctx.p) < n(1 - ctx.p) : n(ctx.p) > n(1 - ctx.p);
      }
      if (c.fewerResources) return g.P(ctx.p).resources.length < g.P(1 - ctx.p).resources.length;
      if (c.fewerCards) return g.P(ctx.p).hand.length < g.P(1 - ctx.p).hand.length;
      if (c.discardHas) return g.P(ctx.p).discard.some((x) => cardMatch(x.card, c.discardHas));
      if (c.attackedThisPhase) return (g.G.attackers || []).some((a) => a.phaseId === g.G.phaseId && a.ctrl === ctx.p && (!c.other || !ctx.self || a.uid !== ctx.self.uid) && unitMatch(g, {}, a.u, c.attackedThisPhase));
      if (c.playedThisPhase) return (g.G.playedThisPhase[ctx.p] || []).some((card) => cardMatch(card, c.playedThisPhase));
      if (c.defenderIs) {
        const d = (ctx.atk || g.G.attack || {}).defender;
        return !!d && unitMatch(g, {}, d, c.defenderIs);
      }
      if (c.prevIs) return !!(ctx.prev && ctx.prev[0] && ctx.prev[0].card && cardMatch(ctx.prev[0].card, c.prevIs));
      if (c.attachedIs) return !!(ctx.attached && unitMatch(g, {}, ctx.attached, c.attachedIs));
      if (c.baseRemainingMax != null) return (g.P(ctx.p).base.card.h || 30) - g.P(ctx.p).base.damage <= c.baseRemainingMax;
      if (c.enemyBaseRemainingMax != null) return (g.P(1 - ctx.p).base.card.h || 30) - g.P(1 - ctx.p).base.damage <= c.enemyBaseRemainingMax;
      if (c.handMin != null) return g.P(ctx.p).hand.length >= c.handMin;
      if (c.handMax != null) return g.P(ctx.p).hand.length <= c.handMax;
      if (c.resourcesMin != null) return g.P(ctx.p).resources.length >= c.resourcesMin;
      if (c.force) return !!g.P(ctx.p).force;
      return false;
    } finally {
      condDepth--;
    }
  }
  function amt(ctx, n) {
    if (typeof n === 'number') return n;
    if (!n) return 0;
    const g = ctx.g;
    if (n.x === 'power') {
      const u = n.of === 'self' ? ctx.self : n.of === 'attached' ? ctx.attached : n.of === 'attacker' ? ctx.atk && ctx.atk.attacker : n.of === 'src' ? ctx.src : n.of === 'defender' ? ctx.atk && ctx.atk.defender : ctx.prev && ctx.prev[0];
      return u && u.card ? g.power(u) : 0;
    }
    if (n.x === 'defeatedCount') return (g.G.defeated || []).filter((d) => d.phaseId === g.G.phaseId && sideOk(n.side, d, ctx.p)).length;
    if (n.x === 'credits') return g.P(ctx.p).credits;
    if (n.x === 'discardCount') return g.P(ctx.p).discard.filter((c) => cardMatch(c.card, n.f)).length;
    if (n.x === 'div') return Math.floor(amt(ctx, n.of) / (n.k || 1));
    if (n.x === 'mul') return (n.k || 1) * amt(ctx, n.of);
    if (n.x === 'cost') {
      const u = n.of === 'self' ? ctx.self : ctx.prev && ctx.prev[0];
      return u && u.card ? u.card.c || 0 : 0;
    }
    if (n.x === 'baseDamage') return g.P(ctx.p).base.damage;
    if (n.x === 'discard') return g.P(ctx.p).discard.length;
    if (n.x === 'upgrades') {
      const u = n.of === 'self' ? ctx.self : ctx.prev && ctx.prev[0];
      return u && u.upgrades ? u.upgrades.length : 0;
    }
    if (n.x === 'damage') {
      const u = n.of === 'defender' ? (ctx.atk || g.G.attack || {}).defender : ctx.self;
      return u ? u.damage || 0 : 0;
    }
    if (n.x === 'hand') return g.P(ctx.p).hand.length;
    if (n.x === 'resources') return g.P(ctx.p).resources.length;
    if (n.x === 'count') return ctx.g.allUnits().filter((u) => sideOk(n.side, u, ctx.p) && unitMatch(g, ctx, u, n.f)).length;
    return +n || 0;
  }
  function L(zh, en) {
    return SWU.lang === 'en' ? en : zh;
  }
  function describe(st, ctx) {
    const n = amt(ctx, st.n);
    const tn = { Shield: L('護盾', 'Shield'), Experience: L('經驗', 'Experience'), Advantage: L('優勢', 'Advantage'), Weakness: L('弱點', 'Weakness') };
    const sg = (x) => (x >= 0 ? '+' : '') + x;
    switch (st.op) {
      case 'damage':
        return L(`造成 ${n} 點傷害`, `deal ${n} damage`);
      case 'heal':
        return L(`治療 ${n >= 99 ? '全部' : n + ' 點'}傷害`, `heal ${n >= 99 ? 'all' : n} damage`);
      case 'defeat':
        return L('擊敗', 'defeat');
      case 'token':
        return L(`給予 ${st.n > 1 ? st.n + ' 個' : ''}${tn[st.name] || st.name}代幣`, `give ${st.n > 1 ? st.n + ' ' : ''}${st.name} token`);
      case 'buff': {
        const parts = [];
        if (st.p || st.h) parts.push(sg(st.p) + '/' + sg(st.h));
        for (const k in st.kw || {}) parts.push(typeof st.kw[k] === 'number' ? k + ' ' + st.kw[k] : k);
        return L(`給予 ${parts.join('、')}`, `give ${parts.join(', ')}`);
      }
      case 'exhaust':
        return L('橫置', 'exhaust');
      case 'ready':
        return L('重整（轉正）', 'ready');
      case 'bounce':
        return L('回到手牌', 'return to hand');
      case 'capture':
        return L('俘虜', 'capture');
      case 'attack':
        return L('選擇攻擊的單位', 'choose a unit to attack with');
      default:
        return st.op;
    }
  }
  const HARMFUL = { damage: true, defeat: true, exhaust: true, bounce: true, capture: true };
  async function resolve(ctx, st, tspec) {
    const g = ctx.g;
    const p = ctx.p;
    const t = tspec || st.target;
    if (!t) return [];
    const onBoard = (u) => u && g.findUnit(u.uid);
    switch (t.sel) {
      case 'self':
        return onBoard(ctx.self) ? [g.findUnit(ctx.self.uid)] : [];
      case 'attached':
        return onBoard(ctx.attached) ? [ctx.attached] : [];
      case 'prev':
        return (ctx.prev || []).filter((x) => x.base != null || onBoard(x));
      case 'defender':
        return ctx.atk && onBoard(ctx.atk.defender) ? [ctx.atk.defender] : [];
      case 'attacker':
        return ctx.atk && onBoard(ctx.atk.attacker) ? [ctx.atk.attacker] : [];
      case 'played':
        return onBoard(ctx.played) ? [ctx.played] : [];
      case 'base': {
        const out = [];
        if (t.side !== 'enemy') out.push({ base: p });
        if (t.side !== 'friendly') out.push({ base: 1 - p });
        return out;
      }
    }
    let pool = g.allUnits().filter((u) => sideOk(t.side, u, p) && unitMatch(g, ctx, u, t.f));
    if (st.op === 'attack') pool = pool.filter((u) => u.ctrl === p && (st.exhaustedOk ? !u.cantAttack : g.canAttackWith(u)) && g.attackTargets(u, { noBase: st.noBase }).units.length + (st.noBase ? 0 : 1) > 0);
    if (st.op === 'capture') pool = pool.filter((u) => u.ctrl !== p && !u.isLeader);
    if (st.op === 'bounce') pool = pool.filter((u) => !u.isLeader);
    if (t.sel === 'each') return pool;
    const bases = t.sel === 'chooseBase' ? [p, 1 - p] : t.base ? (t.base === 'enemy' ? [1 - p] : t.base === 'friendly' ? [p] : [p, 1 - p]) : [];
    if (t.sel === 'chooseBase') pool = [];
    const prompt = `${ctx.card.n}：${describe(st, ctx)}`;
    const harm = !!HARMFUL[st.op] || (st.op === 'buff' && (st.p < 0 || st.h < 0)) || (st.op === 'token' && st.name === 'Weakness');
    const picks = [];
    const count = t.sel === 'upTo' ? t.count || 1 : 1;
    for (let i = 0; i < count; i++) {
      const units = pool.filter((u) => !picks.includes(u));
      const bs = bases.filter((b) => !picks.some((x) => x.base === b));
      if (!units.length && !bs.length) break;
      const optional = st.optional || t.sel === 'upTo' ? !(t.exact && i < count) || st.optional : false;
      const r = await g.pickTarget(p, prompt + (count > 1 ? ` (${i + 1}/${count})` : ''), { units, bases: bs, optional: optional || (t.sel === 'upTo' && !t.exact), ctx: { harm, card: ctx.card.key } });
      if (!r) break;
      picks.push(r.unit || { base: r.base });
    }
    return picks;
  }
  async function runSteps(ctx, steps) {
    const g0 = ctx.g;
    const prevSrc = g0.srcCard;
    if (ctx.card) g0.srcCard = ctx.card;
    try {
      return await runSteps0(ctx, steps);
    } finally {
      g0.srcCard = prevSrc;
    }
  }
  async function runSteps0(ctx, steps) {
    for (const st of steps) {
      if (ctx.g.G.winner != null) return;
      if (ctx.stop) return;
      if (st.ifPrev && !ctx.ok) continue;
      if (st.ifNotPrev && ctx.ok) { ctx.ok = false; continue; }
      if (st.cond && !checkCond(ctx, st.cond)) {
        ctx.ok = false;
        continue;
      }
      if (st.alt && checkCond(ctx, st.alt.cond)) {
        const ok0 = ctx.ok;
        ctx.ok = true;
        for (const x of st.alt.steps) {
          if (x.ifPrev && !ctx.ok) continue;
          ctx.ok = !!(await runStep(ctx, x));
        }
        if (!st.alt.steps.length) ctx.ok = ok0;
        continue;
      }
      ctx.ok = !!(await runStep(ctx, st));
    }
  }
  GFX.runSteps = runSteps;
  async function ask(ctx, st, text) {
    if (!st.optional) return true;
    return ctx.g.yesno(ctx.p, `${ctx.card.n}：${text}?`, { harm: false });
  }
  async function runStep(ctx, st) {
    const g = ctx.g;
    const p = ctx.p;
    const P = g.P(p);
    const who = st.who === 'opp' ? 1 - p : p;
    switch (st.op) {
      case 'damage': {
        const n = amt(ctx, st.n);
        const ts = await resolve(ctx, st);
        for (const x of ts) {
          if (x.base != null) g.damageBase(x.base, n, { ability: true });
          else await g.damageUnit(x, n);
        }
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'heal': {
        const n = amt(ctx, st.n);
        const ts = await resolve(ctx, st);
        for (const x of ts) {
          if (x.base != null) g.healBase(x.base, n);
          else g.heal(x, n);
        }
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'defeat': {
        const ts = await resolve(ctx, st);
        for (const x of ts) if (x.base == null) await g.defeat(x, { ability: true, srcP: p });
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'defeatUpgrade': {
        const ups = [];
        for (const u of g.allUnits())
          for (const up of u.upgrades) {
            if (st.f && st.f.nonUnique && up.card.u) continue;
            if (st.f && st.f.side === 'friendly' && up.owner !== p) continue;
            if (st.f && st.f.side === 'enemy' && up.owner === p) continue;
            if (st.f && st.f.maxCost != null && (up.card.c || 0) > st.f.maxCost) continue;
            ups.push({ uid: up.uid, card: up.card, host: u, up });
          }
        if (!ups.length) return false;
        const pick = await g.pickCards(p, `${ctx.card.n}：${L('擊敗一張升級卡', 'defeat an upgrade')}`, ups, st.optional ? 0 : 1, 1);
        if (!pick.length) return false;
        const { host, up } = pick[0];
        host.upgrades = host.upgrades.filter((x) => x !== up);
        if (!/Token/.test(up.card.t)) g.P(up.owner).discard.push({ uid: up.uid, card: up.card, owner: up.owner });
        g.log('logDefeat', up.card.n);
        await g.checkState();
        return true;
      }
      case 'token': {
        const ts = await resolve(ctx, st);
        for (const x of ts) {
          if (x.base != null) continue;
          for (let i = 0; i < (st.n || 1); i++) {
            if (st.name === 'Shield') g.giveShield(x);
            else if (st.name === 'Experience') g.giveExp(x, 1);
            else g.giveToken(x, st.name);
          }
        }
        ctx.prev = ts;
        await g.checkState();
        return ts.length > 0;
      }
      case 'buff': {
        const ts = await resolve(ctx, st);
        const k = st.per ? amt(ctx, st.per) : 1;
        for (const x of ts) if (x.base == null) g.buff(x, (st.p || 0) * k, (st.h || 0) * k, st.until || 'phase', st.kw && Object.keys(st.kw).length ? st.kw : undefined);
        ctx.prev = ts;
        await g.checkState();
        return ts.length > 0;
      }
      case 'exhaust':
      case 'ready': {
        const ts = await resolve(ctx, st);
        for (const x of ts) if (x.base == null) x.exhausted = st.op === 'exhaust';
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'exhaustSelf': {
        const s = ctx.self;
        if (!s || s.exhausted) return false;
        if (!(await ask(ctx, st, L('橫置這張領袖', 'exhaust this leader')))) return false;
        s.exhausted = true;
        return true;
      }
      case 'bounce': {
        const ts = await resolve(ctx, st);
        for (const x of ts) if (x.base == null) g.returnToHand(x);
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'capture': {
        const captor = st.by === 'src' ? ctx.src : ctx.self && g.findUnit(ctx.self.uid) ? ctx.self : ctx.attached;
        if (!captor) return false;
        const ts = await resolve(ctx, st);
        for (const x of ts) if (x.base == null) g.capture(captor, x);
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'draw':
        if (!(await ask(ctx, st, L(`抽 ${st.n} 張牌`, `draw ${st.n}`)))) return false;
        g.draw(who, st.n || 1);
        return true;
      case 'discard': {
        if (!g.P(who).hand.length) return false;
        if (who === p && !(await ask(ctx, st, L(`棄 ${st.n} 張手牌`, `discard ${st.n}`)))) return false;
        if (st.random) {
          const Q = g.P(who);
          const i = Math.floor(Math.random() * Q.hand.length);
          const [c] = Q.hand.splice(i, 1);
          Q.discard.push(c);
          g.log('logDiscard', Q.name, c.card.n);
          ctx.prev = [c];
          return true;
        }
        const d = await g.discardFromHand(who, st.n || 1);
        ctx.prev = d;
        return d.length > 0;
      }
      case 'mill': {
        const Q = g.P(who);
        const cs = Q.deck.splice(0, st.n || 1);
        Q.discard.push(...cs);
        if (cs.length) g.log('logMill', Q.name, cs.length);
        return cs.length > 0;
      }
      case 'credit':
        if (!(await ask(ctx, st, L('建立 Credit 代幣', 'create a Credit token')))) return false;
        P.credits += st.n || 1;
        g.log('logToken', P.name, 'Credit', st.n || 1);
        return true;
      case 'createToken': {
        if (!(await ask(ctx, st, L(`建立 ${st.name} 代幣`, `create ${st.name} token`)))) return false;
        let owner = p;
        if (st.who === 'prevCtrl' && ctx.prev && ctx.prev[0]) owner = ctx.prev[0].ctrl != null ? ctx.prev[0].ctrl : p;
        if (st.who === 'opp') owner = 1 - p;
        ctx.prev = g.createToken(owner, st.name, st.n || 1);
        return true;
      }
      case 'resourceTop':
        if (!P.deck.length) return false;
        if (!(await ask(ctx, st, L('把牌庫頂放進資源區', 'resource the top card')))) return false;
        for (let i = 0; i < (st.n || 1); i++) g.resourceTop(p);
        return true;
      case 'readyResource': {
        const ex = P.resources.filter((r) => r.exhausted);
        if (!ex.length) return false;
        if (!(await ask(ctx, st, L('重整資源', 'ready a resource')))) return false;
        ex.slice(0, st.n || 1).forEach((r) => (r.exhausted = false));
        return true;
      }
      case 'force':
        P.force = true;
        g.log('logForce', P.name);
        return true;
      case 'useForce':
        if (!P.force) return false;
        if (!(await ask(ctx, st, L('使用原力', 'use the Force')))) return false;
        P.force = false;
        return true;
      case 'pay':
        if (!g.canPay(p, st.n)) return false;
        if (!(await ask(ctx, st, L(`支付 ${st.n} 資源`, `pay ${st.n}`)))) return false;
        g.pay(p, st.n);
        return true;
      case 'attack': {
        const ts = await resolve(ctx, { ...st, optional: true });
        const a = ts[0];
        if (!a || a.base != null) return false;
        if (st.exhaustedOk) a.exhausted = false;
        if (a.exhausted) return false;
        ctx.prev = [a];
        const k = st.per ? amt(ctx, st.per.of) : 0;
        await g.attack(a, { power: (st.p || 0) + (st.per ? st.per.p * k : 0), hp: (st.h || 0) + (st.per ? st.per.h * k : 0), kw: st.kw, noBase: st.noBase });
        return true;
      }
      case 'search': {
        const top = P.deck.splice(0, st.n);
        g.log('logSearch', P.name, top.length);
        const ok = top.filter((c) => cardMatch(c.card, st.f));
        const pick = ok.length ? await g.pickCards(p, `${ctx.card.n}：${L('選擇要加入手牌的卡', 'choose cards to draw')}`, ok, 0, st.count || 1) : [];
        P.deck.push(...SWU.shuffle(top.filter((c) => !pick.includes(c))));
        for (const c of pick) {
          if (st.to === 'play') {
            const cost = st.free ? 0 : Math.max(0, g.costOf(p, c.card, { ignoreAspect: st.ignoreAspect }) - (st.discount || 0));
            if (g.canPay(p, cost)) await g.playCard(p, c.uid, 'deck', { inst: c, free: st.free, discount: st.discount || 0, ignoreAspect: st.ignoreAspect });
            else P.deck.push(c);
          } else P.hand.push(c);
        }
        ctx.prev = pick;
        return pick.length > 0;
      }
      case 'playFromHand': {
        const cands = P.hand.filter((c) => cardMatch(c.card, st.f) && ['Unit', 'Event', 'Upgrade'].includes(c.card.t));
        const disc = (c) => (st.penaltyOnly ? Math.min(2, g.aspectPenalty(p, c.card)) : st.discount || 0);
        const afford = cands.filter((c) => st.free || g.canPay(p, Math.max(0, g.costOf(p, c.card, { ignoreAspect: st.ignoreAspect }) - disc(c))));
        if (!afford.length) return false;
        const pick = await g.pickCards(p, `${ctx.card.n}：${L('選擇要打出的牌', 'choose a card to play')}`, afford, 0, 1);
        if (!pick.length) return false;
        await g.playCard(p, pick[0].uid, 'hand', { discount: disc(pick[0]), ignoreAspect: st.ignoreAspect, free: st.free });
        return true;
      }
      case 'chooseOne': {
        let left = st.options.slice();
        for (let k = 0; k < (st.times || 1) && left.length; k++) {
          const i = await g.pickOption(p, `${ctx.card.n}：${L('選擇一項', 'choose one')}${st.times > 1 ? ` (${k + 1}/${st.times})` : ''}`, left.map((o) => o.label));
          if (i < 0 || !left[i]) return false;
          const o = left[i];
          left = left.filter((x) => x !== o);
          ctx.ok = true;
          await runSteps(ctx, o.steps);
        }
        return true;
      }
      case 'note':
        await g.unimplementedText({ card: ctx.card }, st.text || '', p);
        return true;
      case 'limitRound': {
        const key = (ctx.self && ctx.self.uid) + ':' + ctx.card.key;
        g.G.limits = g.G.limits || {};
        if (g.G.limits[key] === g.G.round) {
          ctx.stop = true;
          return false;
        }
        g.G.limits[key] = g.G.round;
        return true;
      }
      case 'recover': {
        const cands = P.discard.filter((c) => cardMatch(c.card, st.f));
        if (!cands.length) return false;
        const pick = await g.pickCards(p, `${ctx.card.n}：${L('從棄牌堆選卡', 'choose from your discard pile')}`, cands, st.upTo || st.optional ? 0 : 1, st.count || 1);
        for (const c of pick) {
          P.discard = P.discard.filter((x) => x !== c);
          if (st.to === 'bottom') P.deck.push(c);
          else P.hand.push(c);
        }
        if (pick.length) g.log('logRecover', P.name, pick.length);
        ctx.prev = pick;
        return pick.length > 0;
      }
      case 'playFromDiscard': {
        const cands = P.discard.filter((c) => cardMatch(c.card, st.f) && ['Unit', 'Event', 'Upgrade'].includes(c.card.t) && (st.free || g.canPay(p, Math.max(0, g.costOf(p, c.card) - (st.discount || 0)))));
        if (!cands.length) return false;
        const pick = await g.pickCards(p, `${ctx.card.n}：${L('從棄牌堆打出', 'play from your discard pile')}`, cands, 0, 1);
        if (!pick.length) return false;
        P.discard = P.discard.filter((x) => x !== pick[0]);
        P.hand.push(pick[0]);
        await g.playCard(p, pick[0].uid, 'hand', { discount: st.discount || 0, free: st.free });
        return true;
      }
      case 'takeControl': {
        const ts = await resolve(ctx, st);
        for (const x of ts) {
          if (x.base != null || x.ctrl === p) continue;
          g.P(x.ctrl).units = g.P(x.ctrl).units.filter((u) => u !== x);
          x.ctrl = p;
          P.units.push(x);
          if (st.temp) x.returnCtrl = g.G.round;
          g.log('logTakeControl', P.name, x.card.n);
        }
        ctx.prev = ts;
        return ts.length > 0;
      }
      case 'discardOpp': {
        const O = g.P(1 - p);
        const cands = O.hand.filter((c) => cardMatch(c.card, st.f || {}));
        g.log('logLookHand', P.name);
        if (!cands.length) return false;
        const pick = await g.pickCards(p, `${ctx.card.n}：${L('從對手手牌選一張棄掉', "discard a card from the opponent's hand")}`, cands, st.optional ? 0 : 1, 1);
        for (const c of pick) {
          O.hand = O.hand.filter((x) => x !== c);
          O.discard.push(c);
          g.log('logDiscard', O.name, c.card.n);
        }
        ctx.prev = pick;
        return pick.length > 0;
      }
      case 'disclose': {
        if (!SWU.canDisclose || !SWU.canDisclose(g, p, st.aspects)) return false;
        if (!(await ask(ctx, st, L('揭示 ', 'disclose ') + st.aspects.map((a) => SWU.t('asp_' + a)).join(' ')))) return false;
        g.log('logDisclose', P.name, st.aspects.join(' '));
        return true;
      }
      case 'lookHand':
        g.log('logLookHand', P.name);
        return true;
      case 'source': {
        const ts = await resolve(ctx, { ...st, op: 'source' });
        ctx.src = ts[0];
        return !!ctx.src;
      }
      default:
        g.log('logEffectError', 'unknown op ' + st.op);
        return false;
    }
  }

  // ================= 效果程式 → 引擎觸發函式 =================
  function build(prog, card, side) {
    const H = { implemented: true, gfx: prog.src || 'regex', actions: undefined };
    const add = (name, fn) => {
      const prev = H[name];
      H[name] = prev
        ? async (...a) => {
            await prev(...a);
            await fn(...a);
          }
        : fn;
    };
    const addStatic = (name, fn) => {
      const prev = H[name];
      H[name] = prev
        ? (...a) => {
            const x = prev(...a),
              y = fn(...a);
            if (!x) return y;
            if (!y) return x;
            return { p: (x.p || 0) + (y.p || 0), h: (x.h || 0) + (y.h || 0), kw: { ...(x.kw || {}), ...(y.kw || {}) } };
          }
        : fn;
    };
    const isUpg = card.t === 'Upgrade';
    const runAb = async (ab, ctx) => {
      if (ab.cond && !checkCond(ctx, ab.cond)) return;
      ctx.card = card;
      ctx.ok = true;
      await runSteps(ctx, ab.steps || []);
      await ctx.g.checkState();
    };
    const manual = (line) => async (ctx) => ctx.g.unimplementedText({ card }, line, ctx.p);
    const all = [...prog.abilities.map((a) => ({ a })), ...(prog.failed || []).map((f) => ({ f }))];
    for (const { a, f } of all) {
      const ab = a || { trigger: f.trigger, tinfo: f.tinfo, cost: f.cost, epic: f.epic, manualLine: f.line };
      const exec = a ? (ctx) => runAb(ab, ctx) : manual(f.line);
      const tinfos = ab.trigger === 'multi' ? ab.tinfo : ab.tinfo || [{ t: ab.trigger }];
      if (ab.trigger === 'action') {
        H.actions = H.actions || [];
        const cost = ab.cost || { res: 0 };
        H.actions.push({
          text: (ab.text || f.line || '').replace(/^(Epic )?Action( \[[^\]]*\])?:\s*/, '').slice(0, 60),
          manual: !a,
          can: (g, src) => {
            if (ab.epic && src.epicUsed) return false;
            if (cost.exhaust && src.exhausted) return false;
            if (cost.force && !g.P(src.ctrl != null ? src.ctrl : src.owner).force) return false;
            return g.canPay(src.ctrl != null ? src.ctrl : src.owner, cost.res || 0);
          },
          async run(g, src) {
            const p = src.ctrl != null ? src.ctrl : src.owner;
            if (cost.exhaust) src.exhausted = true;
            if (cost.force) g.P(p).force = false;
            if (ab.epic) src.epicUsed = true;
            g.pay(p, cost.res || 0);
            await exec({ g, p, self: src });
          },
        });
        continue;
      }
      if (ab.trigger === 'static') {
        const s = ab;
        const val = (g, u) => {
          const k = s.per && g ? amt({ g, p: u.ctrl, self: u, prev: [u] }, s.per) : 1;
          return { p: (s.p || 0) * k, h: (s.h || 0) * k, kw: s.kw || {} };
        };
        if (s.who.sel === 'self') addStatic('static', (g, u) => (checkCond({ g, p: u.ctrl, self: u }, s.cond) ? val(g, u) : null));
        else if (s.who.sel === 'attached') addStatic('attachedStatic', (g, up, u) => (checkCond({ g, p: u.ctrl, self: u, attached: u }, s.cond) ? val(g, u) : null));
        else {
          const w = s.who;
          const fx = (g, src, u) => {
            const p = src.ctrl != null ? src.ctrl : src.owner;
            const ctx = { g, p, self: src };
            if (!sideOk(w.side, u, p) || !unitMatch(g, ctx, u, { ...(w.f || {}), maxPower: undefined, minPower: undefined })) return null;
            return checkCond(ctx, s.cond) ? val(g, src) : null;
          };
          addStatic('aura', fx);
          if (!(w.f || {}).notSelf) addStatic('static', (g, u) => fx(g, u, u));
        }
        continue;
      }
      if (ab.trigger === 'ignorePenalty') {
        const prevI = H.ignorePenalty;
        H.ignorePenalty = (g, src, c) => (prevI && prevI(g, src, c)) || (cardMatch(c, ab.f) && checkCond({ g, p: src.ctrl != null ? src.ctrl : src.owner, self: src }, ab.cond));
        continue;
      }
      if (ab.trigger === 'selfCost') {
        const prevC = H.costMod;
        H.costMod = (g, p) => {
          const ctx = { g, p, self: null };
          let d = 0;
          if (checkCond(ctx, ab.cond)) d = -(ab.n || 0) * (ab.per ? amt(ctx, ab.per) : 1);
          return (prevC ? prevC(g, p) : 0) + d;
        };
        continue;
      }
      if (ab.trigger === 'grant') {
        if (!a) continue;
        const sub = build({ abilities: [ab.inner], failed: [] }, { ...card, t: 'Unit' }, 'card');
        const prevG = H.grant;
        H.grant = prevG ? mergeHooks(prevG, sub) : sub;
        continue;
      }
      if (ab.trigger === 'discount') {
        addStatic('discountRaw', () => null);
        const prevD = H.discount;
        H.discount = (g, src, c) => (prevD ? prevD(g, src, c) : 0) + (cardMatch(c, ab.f) && checkCond({ g, p: src.ctrl, self: src }, ab.cond) ? ab.n : 0);
        continue;
      }
      for (const ti of tinfos) {
        if (!ti || !ti.t) continue;
        const onBoard = (g, u) => !!g.findUnit(u.uid);
        switch (ti.t) {
          case 'whenPlayed':
            if (card.t === 'Event') break;
            if (isUpg) add('whenPlayed', (g, inst, t) => exec({ g, p: inst.owner, attached: t, self: null }));
            else add('whenPlayed', (g, u) => exec({ g, p: u.ctrl, self: u }));
            break;
          case 'event':
            add('event', (g, p, inst) => exec({ g, p, self: null }));
            break;
          case 'onAttack':
            if (isUpg) add('attachedOnAttack', (g, up, u, atk) => exec({ g, p: u.ctrl, self: u, attached: u, atk }));
            else add('onAttack', (g, u, atk) => exec({ g, p: u.ctrl, self: u, atk }));
            break;
          case 'whenDefeated':
            if (isUpg) break;
            add('whenDefeated', (g, u) => exec({ g, p: u.ctrl, self: u }));
            break;
          case 'whenDeployed':
            add('whenDeployed', (g, u) => exec({ g, p: u.ctrl, self: u }));
            break;
          case 'bounty':
            add('bounty', (g, u, collector) => exec({ g, p: collector, self: u, bountyOf: u }));
            break;
          case 'attackEnd':
            add('onFriendlyAttackEnd', (g, w, atk) => (atk.attacker.uid === w.uid && onBoard(g, w) ? exec({ g, p: w.ctrl, self: w, atk }) : null));
            break;
          case 'attackEndAny':
            add('onFriendlyAttackEnd', (g, w, atk) => (atk.attacker.uid === w.uid ? exec({ g, p: w.ctrl, self: w, atk }) : null));
            break;
          case 'friendlyAttackEnd':
            add('onFriendlyAttackEnd', (g, w, atk) => {
              const a = atk.attacker;
              const p = w.ctrl != null ? w.ctrl : w.owner;
              if (a.ctrl !== p || !unitMatch(g, { g, p, self: w }, a, ti.tf)) return null;
              if (ti.survive && !onBoard(g, a)) return null;
              return exec({ g, p, self: w, atk, prev: [a] });
            });
            break;
          case 'friendlyAttack':
            add('onFriendlyAttack', (g, w, atk) => {
              const a = atk.attacker;
              const p = w.ctrl != null ? w.ctrl : w.owner;
              if (a.ctrl !== p || !unitMatch(g, { g, p, self: w }, a, ti.tf)) return null;
              return exec({ g, p, self: w, atk, prev: [a] });
            });
            break;
          case 'friendlyPlay':
            add('onFriendlyPlay', (g, w, played) => {
              if (ti.other && played.uid === w.uid) return null;
              if (!cardMatch(played.card, ti.f)) return null;
              if (ti.tf && !unitMatch(g, { g, self: w }, played, ti.tf)) return null;
              return exec({ g, p: w.ctrl != null ? w.ctrl : w.owner, self: w, played, prev: [played] });
            });
            break;
          case 'playEvent':
            add('onFriendlyEvent', (g, w, c) => exec({ g, p: w.ctrl != null ? w.ctrl : w.owner, self: w }));
            break;
          case 'anyDefeated':
            add('onAnyDefeated', (g, w, dead) => {
              const p = w.ctrl != null ? w.ctrl : w.owner;
              if (dead.uid === w.uid) return null;
              if (!sideOk(ti.side, dead, p) || !unitMatch(g, { g, p, self: w }, dead, { ...ti.tf, maxPower: undefined, maxRem: undefined })) return null;
              return exec({ g, p, self: w, dead, prev: [] });
            });
            break;
          case 'enemyAttack':
            add('onEnemyAttack', (g, w, atk) => (!ti.base || atk.base ? exec({ g, p: w.ctrl != null ? w.ctrl : w.owner, self: w, atk, prev: [atk.attacker] }) : null));
            break;
          case 'enemyPlay':
            add('onEnemyPlay', (g, w, c) => (cardMatch(c, ti.f) ? exec({ g, p: w.ctrl != null ? w.ctrl : w.owner, self: w }) : null));
            break;
          case 'damagedSurvive':
            add('whenDamagedSurvive', (g, u) => exec({ g, p: u.ctrl, self: u }));
            break;
          case 'whenAttacked':
            add('whenAttacked', (g, u, atk) => exec({ g, p: u.ctrl, self: u, atk }));
            break;
          case 'takeInitiative':
            add('onTakeInitiative', (g, u) => exec({ g, p: u.ctrl != null ? u.ctrl : u.owner, self: u }));
            break;
          case 'regroupStart':
            add('onRegroupStart', (g, u) => exec({ g, p: u.ctrl != null ? u.ctrl : u.owner, self: u }));
            break;
          case 'actionPhaseStart':
            add('onActionPhaseStart', (g, u) => exec({ g, p: u.ctrl != null ? u.ctrl : u.owner, self: u }));
            break;
          case 'damageBase':
            add('onDamageBase', (g, u, atk) => exec({ g, p: u.ctrl, self: u, atk }));
            break;
          case 'defeatsUnit':
            add('onAttackDefeat', (g, u, atk) => exec({ g, p: u.ctrl, self: u, atk, prev: [atk.defender] }));
            break;
        }
      }
    }
    if (!prog.abilities.length && (prog.failed || []).some((f) => !f.trigger)) H.implemented = false;
    H.unknown = (prog.failed || []).filter((f) => !f.trigger).map((f) => f.line);
    H.status = !(prog.failed || []).length ? prog.src || 'regex' : prog.abilities.length ? 'partial' : 'manual';
    return H;
  }

  // 合併兩組觸發函式（單位本身＋升級卡給的能力）
  const STATIC_HOOKS = ['static', 'aura', 'attachedStatic'];
  function mergeHooks(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = { ...a };
    for (const k in b) {
      if (k === 'actions') out.actions = [...(a.actions || []), ...(b.actions || [])];
      else if (typeof b[k] !== 'function' || typeof a[k] !== 'function') {
        if (out[k] === undefined || typeof b[k] === 'function') out[k] = b[k];
      } else if (STATIC_HOOKS.includes(k)) {
        const fa = a[k],
          fb = b[k];
        out[k] = (...x) => {
          const r1 = fa(...x),
            r2 = fb(...x);
          if (!r1) return r2;
          if (!r2) return r1;
          return { p: (r1.p || 0) + (r2.p || 0), h: (r1.h || 0) + (r2.h || 0), kw: { ...(r1.kw || {}), ...(r2.kw || {}) } };
        };
      } else if (k === 'discount') {
        const fa = a[k],
          fb = b[k];
        out[k] = (...x) => (fa(...x) || 0) + (fb(...x) || 0);
      } else if (k === 'cantBeDefeatedBy') {
        const fa = a[k],
          fb = b[k];
        out[k] = (...x) => fa(...x) || fb(...x);
      } else {
        const fa = a[k],
          fb = b[k];
        out[k] = async (...x) => {
          await fa(...x);
          await fb(...x);
        };
      }
    }
    out.implemented = a.implemented !== false || b.implemented !== false;
    return out;
  }
  GFX.mergeHooks = mergeHooks;

  // ================= 快取與 Claude 轉換 =================
  const CKEY = 'swu.gfx.v1';
  let claudeCache = {};
  try {
    claudeCache = JSON.parse(localStorage.getItem(CKEY) || '{}');
  } catch (e) {}
  const saveCache = () => {
    try {
      localStorage.setItem(CKEY, JSON.stringify(claudeCache));
    } catch (e) {}
  };
  const memo = new Map();
  const ckey = (card, side) => (card.key || SWU.cardKey(card)).toLowerCase() + '#' + side;
  GFX.program = function (card, side) {
    const k = ckey(card, side);
    if (claudeCache[k]) return claudeCache[k];
    if (window.SWU_PROGRAMS && window.SWU_PROGRAMS[k]) return window.SWU_PROGRAMS[k];
    return GFX.compileRegex(card, side);
  };
  GFX.impl = function (card, side = 'card') {
    if (!card || /Token/.test(card.t)) return null;
    if (side === 'card' && card.t === 'Leader') return null;
    if (side !== 'card' && card.t !== 'Leader') return null;
    const k = ckey(card, side);
    if (memo.has(k)) return memo.get(k);
    let h = null;
    try {
      const prog = GFX.program(card, side);
      if (prog.abilities.length || (prog.failed || []).length) h = build(prog, card, side);
      else if (prog.src && prog.src !== 'regex') h = { implemented: true, gfx: prog.src }; // 預先判定為無需自動處理（被動／近似略過）
    } catch (e) {
      console.warn('gfx build failed', card.key, e);
    }
    memo.set(k, h);
    return h;
  };
  GFX.status = function (card, side = 'card') {
    if (SWU.EFFECTS.hasHand && SWU.EFFECTS.hasHand(card, side)) return 'hand';
    const k = ckey(card, side);
    if (claudeCache[k]) return claudeCache[k].failed && claudeCache[k].failed.length ? 'partial' : 'claude';
    const pre = window.SWU_PROGRAMS && window.SWU_PROGRAMS[k];
    if (pre) return pre.failed && pre.failed.length ? 'partial' : 'prebuilt';
    const prog = GFX.compileRegex(card, side);
    if (!prog.failed.length) return prog.abilities.length ? 'regex' : 'none';
    return prog.abilities.length ? 'partial' : 'manual';
  };
  GFX.sidesOf = (card) => (card.t === 'Leader' ? ['leader', 'unit'] : ['card']);
  GFX.needsClaude = function (cards) {
    const out = [];
    const seen = new Set();
    for (const card of cards) {
      for (const side of GFX.sidesOf(card)) {
        const k = ckey(card, side);
        if (seen.has(k)) continue;
        seen.add(k);
        const st = GFX.status(card, side);
        if (st === 'partial' || st === 'manual') out.push({ card, side });
      }
    }
    return out;
  };
  GFX.clearCache = () => {
    claudeCache = {};
    memo.clear();
    saveCache();
  };

  const DSL_DOC = `Convert Star Wars: Unlimited card abilities into a JSON "effect program" for a game engine.
Program: {"abilities":[Ability...], "failed":[{"trigger":T,"line":"exact text"}]}  (put any ability you truly cannot express into "failed"; the engine then asks the player to resolve it by hand)
Ability (triggered): {"trigger":T, "tinfo"?:[...], "cond"?:Cond, "steps":[Step...]}
 T = whenPlayed | onAttack | whenDefeated | whenDeployed | event (event card text) | bounty (resolved by the opponent who collects) | attackEnd (this unit completes an attack and survives) | attackEndAny | whenAttacked | takeInitiative | playEvent (you play an event) | damageBase (this unit deals combat damage to a base) | defeatsUnit (this unit defeats a unit while attacking; "prev" = that unit) | regroupStart | actionPhaseStart | multi (several triggers: put them in tinfo as [{"t":"whenPlayed"},{"t":"onAttack"}])
 Friendly-event triggers use trigger "multi" with tinfo: {"t":"friendlyPlay","f":CardFilter,"other":true} | {"t":"friendlyAttack","tf":Filter} | {"t":"friendlyAttackEnd","tf":Filter,"survive":bool} | {"t":"anyDefeated","side":"friendly|enemy|any","tf":Filter}. In these, "prev" starts as the played/attacking unit.
Ability (action): {"trigger":"action","epic":bool,"cost":{"res":n,"exhaust":bool,"force":bool},"text":"short label","steps":[...]}
Ability (static): {"trigger":"static","who":{"sel":"self"|"attached"} or {"sel":"each","side":"friendly|enemy|any","f":Filter},"p":n,"h":n,"kw":{"Sentinel":true,"Raid":2},"cond"?:Cond}
Ability (cost reduction for cards you play): {"trigger":"discount","f":CardFilter,"n":n,"cond"?:Cond}
Step common fields: "optional":true ("you may"), "ifPrev":true ("If you do," = only if the previous step happened), "cond":Cond.
Steps:
 {"op":"damage","n":N,"target":Target}   N = number or {"x":"power","of":"self|prev|attached|attacker"} or {"x":"count","side":..,"f":Filter}
 {"op":"heal","n":N,"target":Target}  (99 = all)
 {"op":"defeat","target":Target} | {"op":"defeatUpgrade","f":{"nonUnique":bool,"maxCost":n}}
 {"op":"token","name":"Shield|Experience|Advantage|Weakness","n":1,"target":Target}
 {"op":"buff","p":n,"h":n,"kw":{...},"until":"phase|attack","target":Target}
 {"op":"exhaust"|"ready"|"bounce"|"capture","target":Target}  (capture: this unit captures)
 {"op":"exhaustSelf"} (exhaust this leader/unit as part of the effect)
 {"op":"draw","n":n,"who":"me|opp"} | {"op":"discard","n":n,"who":"me|opp"} (from hand) | {"op":"mill","n":n,"who":"me|opp"} (top of deck to discard)
 {"op":"createToken","name":"Battle Droid|Beast|Clone Trooper|Mandalorian|Spy|TIE Fighter|X-Wing","n":n,"who":"me|prevCtrl"} | {"op":"credit","n":n}
 {"op":"resourceTop","n":1} | {"op":"readyResource","n":n} | {"op":"force"} (the Force is with you) | {"op":"useForce"} | {"op":"pay","n":n}
 {"op":"attack","target":Target(friendly unit to attack with),"p":n,"h":n,"kw":{},"noBase":bool,"exhaustedOk":bool}
 {"op":"search","n":topN,"count":n,"f":CardFilter,"to":"hand"}
 {"op":"playFromHand","f":CardFilter,"discount":n,"ignoreAspect":bool,"free":bool}
 {"op":"chooseOne","options":[{"label":"text","steps":[...]}]}
 {"op":"note","text":"part the engine cannot do; player resolves it"}
Target: {"sel":"self|attached|prev|defender|attacker|played"} | {"sel":"base","side":"friendly|enemy|any"} | {"sel":"chooseBase"} | {"sel":"choose|each|upTo","side":"friendly|enemy|any","count":n(upTo),"base":"any|enemy|friendly"(also allow choosing a base),"f":Filter}
Filter: {"nonLeader","leader","unique","nonUnique","damaged","undamaged","exhausted","ready","upgraded","noUpgrades","token","nonToken","notSelf","sameArena": true, "arena":"Ground|Space","traits":["FORCE"],"notTraits":[..],"aspects":["Heroism"],"name":"lowercase card name","maxCost","minCost","maxPower","minPower","maxRem","minRem": numbers}
Filter also: "anyTraits":[..] (has one of), "anyAspects":[..], "noShield","noExp","playedThisPhase": true, "hasKw":"Sentinel".
Upgrade granting an ability ("Attached unit gains: \"On Attack: ...\""): {"trigger":"grant","inner":Ability}
Step "alt": {"cond":Cond,"steps":[..]} = do these steps instead when cond holds ("If X, do Y instead").
CardFilter: {"type":"Unit|Event|Upgrade","traits":[..],"aspects":[..],"arena":"Ground|Space","maxCost":n}
Cond: {"initiative":true} | {"count":{"side":"friendly|enemy|any","f":Filter},"min":n} | {"baseTrait":"X"} | {"leaderTrait":"X"} | {"baseDamage":n} | {"prevDefeated":true} | {"selfDamaged":true} | {"selfAttacking":true} | {"selfDefending":true} | {"attackingBase":true} | {"not":Cond} | {"all":[..]} | {"any":[..]}
Traits are UPPERCASE. Keywords (Sentinel, Raid N, Overwhelm, etc. printed alone on a line) and "Attach to..." restrictions are handled by the engine: do NOT include them. Keep "optional" for every "you may". Use exact numbers from the text.`;
  GFX.DSL_DOC = DSL_DOC;

  function validProg(x) {
    return x && Array.isArray(x.abilities) && x.abilities.every((a) => a && typeof a.trigger === 'string');
  }
  // 一次送一批（約 8 張）給 Claude
  GFX.compileWithClaude = async function (items, onProgress) {
    const AI = SWU.AI;
    if (!AI || !AI.hasClaude()) return 0;
    let done = 0;
    for (let i = 0; i < items.length; i += 8) {
      const batch = items.slice(i, i + 8);
      const list = batch
        .map((it, j) => {
          const c = it.card;
          const text = it.side === 'unit' ? c.bt || '' : c.tx || '';
          const what = c.t === 'Leader' ? (it.side === 'leader' ? 'Leader (undeployed side; "this leader" = the leader card)' : 'Leader unit (deployed side)') : c.t;
          return `#${j} ${c.key} — ${what}${c.tr ? ' — traits: ' + c.tr.join(', ') : ''}\n${text}`;
        })
        .join('\n\n');
      try {
        const txt = await AI.ask({
          system: DSL_DOC,
          user: `Cards:\n\n${list}\n\nReturn ONLY a JSON object {"programs":[{"i":0,"program":{...}}, ...]} with one entry per card, no other text.`,
          maxTokens: 12000,
          effort: 'medium',
        });
        const m = String(txt).match(/\{[\s\S]*\}/);
        const obj = m ? JSON.parse(m[0]) : null;
        for (const e of (obj && obj.programs) || []) {
          const it = batch[e.i];
          if (!it || !validProg(e.program)) continue;
          e.program.src = 'claude';
          e.program.v = 1;
          e.program.failed = e.program.failed || [];
          claudeCache[ckey(it.card, it.side)] = e.program;
          memo.delete(ckey(it.card, it.side));
          done++;
        }
        saveCache();
      } catch (err) {
        console.warn('gfx claude batch failed', err);
      }
      onProgress && onProgress(Math.min(items.length, i + 8), items.length);
    }
    return done;
  };
  // 測試用：從外部載入預先轉好的效果程式
  GFX.loadPrograms = function (map) {
    for (const k in map) {
      claudeCache[k] = map[k];
      memo.delete(k);
    }
  };
})();
