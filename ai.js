/* 由奈 AI：Claude API 連線、對戰決策、效果判讀、牌組評語、AI 組牌。
 * 沒有 API 金鑰（或呼叫失敗）時，改用內建的規則型打法。
 */
(function () {
  const SWU = window.SWU;
  const AI = (SWU.AI = {});
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm';

  // ---------- 設定 ----------
  const SKEY = 'swu.settings.v1';
  AI.settings = { apiKey: '', model: 'claude-opus-5-5', effort: 'low', mode: 'main', delay: 700, images: true, level: 7, lvVer: 2, style: 'default' };
  try {
    Object.assign(AI.settings, JSON.parse(localStorage.getItem(SKEY) || '{}'));
  } catch (e) {}
  if (AI.settings.level === 'full') AI.settings.level = 8;
  else if (AI.settings.level === 'basic') AI.settings.level = 4;
  // 舊的 1～8 級 → 新的 1～7 級（舊 8 級直接升到新 7 級；舊 1～4 都變新 1 級）
  if (AI.settings.lvVer !== 2) {
    const o = +AI.settings.level || 8;
    AI.settings.level = o >= 8 ? 7 : Math.max(1, o - 3);
    AI.settings.lvVer = 2;
  }
  AI.levelNum = () => Math.min(8, Math.max(1, +AI.settings.level || 7));
  AI.save = () => {
    try {
      localStorage.setItem(SKEY, JSON.stringify(AI.settings));
    } catch (e) {}
  };
  AI.hasClaude = () => !!AI.settings.apiKey;
  SWU.playerName = () => {
    const st = AI.settings;
    if (st.owner) return st.ownerName || '柏偉';
    const n = st.playerName && st.playerName !== '柏偉' ? st.playerName : '';
    return n || (SWU.lang === 'zh' ? '你' : 'You');
  };

  // ---------- Claude 連線 ----------
  let clientPromise = null;
  let clientKey = null;
  async function client() {
    if (!clientPromise || clientKey !== AI.settings.apiKey) {
      clientKey = AI.settings.apiKey;
      clientPromise = import(SDK_URL).then((m) => {
        const Anthropic = m.default || m.Anthropic;
        return new Anthropic({ apiKey: clientKey, dangerouslyAllowBrowser: true });
      });
    }
    return clientPromise;
  }
  // 回傳文字；schema 有給就要求結構化 JSON 並解析
  AI.ask = async function ({ system, user, schema, maxTokens = 2000, effort }) {
    const c = await client();
    const body = {
      model: AI.settings.model || 'claude-opus-5-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: effort || AI.settings.effort || 'low' },
      fallbacks: 'default',
    };
    if (schema) body.output_config.format = { type: 'json_schema', schema };
    const res = await c.messages.create(body, { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } });
    if (res.stop_reason === 'refusal') throw new Error('refusal');
    const text = (res.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!schema) return text;
    try {
      return JSON.parse(text);
    } catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('bad json');
    }
  };
  AI.test = async () => AI.ask({ system: 'Reply with the single word OK.', user: 'ping', maxTokens: 50 });

  const PERSONA_ZH = () =>
    '你是「由奈」，18 歲、溫柔害羞的狐族少女，正在陪' + SWU.playerName() + '練習《星際大戰：無極限》。你是對方的練習對手，要認真打、打出好的判斷，但說話溫柔可愛（可用「嘿嘿」「唔」等語氣詞），每次發言 40 字以內，用繁體中文。';
  const PERSONA_EN = () => "You are Yuna, a gentle, slightly shy fox girl practicing Star Wars: Unlimited with " + SWU.playerName() + ". Play to win with sound decisions, but talk sweetly. Keep each remark under 25 words, in English.";
  const PERSONA_BOT = () => 'You are an AI opponent in a Star Wars: Unlimited practice tool. Play to win with sound decisions. Remarks must be short, neutral and factual, with no emoji, no cute tone, no name for yourself. Under 20 words, in ' + (SWU.lang === 'zh' ? 'Traditional Chinese' : 'English') + '.';
  const persona = () => (SWU.friendMode && SWU.friendMode() ? PERSONA_BOT() : SWU.lang === 'zh' ? PERSONA_ZH() : PERSONA_EN());
  const RULES =
    'Star Wars: Unlimited rules recap: players alternate single actions (play a card, attack with a ready unit, use an action ability, take the initiative, or pass). Units attack enemy units in the same arena or the enemy base; Sentinel units must be attacked first. Combat damage is simultaneous (bases deal none). Destroy the enemy base (usually 30 HP) to win. Resources pay costs; missing aspect icons add +2 each. Taking the initiative means you go first next round but you pass for the rest of this phase. Value good trades, tempo and base damage race.';

  // ---------- 規則型 AI ----------
  const H = (AI.heur = {});
  H.unitValue = (g, u) => g.power(u) + g.remaining(u) + (u.card.c || 0) + (u.isLeader ? 6 : 0);
  H.bestAttack = function (g, u) {
    const t = g.attackTargets(u);
    const ap = g.power(u, true);
    let best = null;
    for (const d of t.units) {
      const kills = ap >= g.remaining(d) && !d.upgrades.some((x) => x.card.n === 'Shield');
      const dies = g.power(d) >= g.remaining(u) && !u.upgrades.some((x) => x.card.n === 'Shield');
      let s = 0;
      if (kills) s += H.unitValue(g, d) * 1.2;
      else s += Math.min(ap, g.remaining(d)) * 0.4;
      if (dies) s -= H.unitValue(g, u);
      if (kills && !dies) s += 4;
      if (!best || s > best.s) best = { s, target: d };
    }
    if (t.base) {
      const s = ap * ((H.cfg && H.cfg.baseW) || 1.1) + (g.P(1 - u.ctrl).base.damage > 20 ? 6 : 0);
      if (!best || s >= best.s) best = { s, base: true };
    }
    return best;
  };
  H.chooseAction = function (g, p, acts) {
    const P = g.P(p);
    let best = acts.find((a) => a.type === 'pass');
    let bestS = 0.5;
    for (const a of acts) {
      let s = 0;
      if (a.type === 'play') {
        const c = g.findAny(a.uid);
        if (!c) continue;
        const card = c.card;
        s = 3 + (card.c || 0) * 1.2 - (a.cost - (card.c || 0)) * 0.8;
        if (card.t === 'Event') {
          const tx = card.tx || '';
          if (/Defeat/i.test(tx) && !g.opp(p).units.length) s = -5;
          else if (/damage/i.test(tx) && !g.opp(p).units.length) s = -5;
          else s -= 1;
        }
        if (card.t === 'Upgrade') s -= 1.5;
      } else if (a.type === 'attack') {
        const u = g.findUnit(a.uid);
        const b = H.bestAttack(g, u);
        s = b ? 2 + b.s * 0.6 : -1;
      } else if (a.type === 'deploy') s = 6;
      else if (a.type === 'initiative') s = P.units.length && !acts.some((x) => x.type === 'attack' || x.type === 'play') ? 1 : 0.2;
      else if (a.type === 'ability' || a.type === 'leaderAbility' || a.type === 'baseAbility') s = a.manual ? (AI.hasClaude() ? 1.5 : -1) : 2.5;
      else if (a.type === 'manualAbility' || a.type === 'manualLeader') s = AI.hasClaude() ? 1.5 : -1;
      if (s > bestS) {
        bestS = s;
        best = a;
      }
    }
    return best;
  };
  // ---------- 預想一步：用重播把每個候選行動實際跑一次，看結果局面 ----------
  // 局面評分權重（2026-11-25 起用自我對戰調整：tools/tune_eval.js）
  H.EW0 = { pw: 1.1, rm: 0.9, cost: 0.3, leader: 3, shield: 2, rdyMe: 0.35, rdyOp: 0.5, hp: 1.25, opLow: 1.0, myLow: 0.8, hand: 1.6, res: 1.2, ldReady: 1 };
  H.EW = { ...H.EW0 };
  H.evalState = function (g, p) {
    const W = (H.cfg && H.cfg.ew) || H.EW;
    const G = g.G;
    if (G.winner != null) return G.winner === p ? 10000 : -10000;
    const me = g.P(p), op = g.P(1 - p);
    const hpLeft = (P) => (P.base.card.h || 30) - P.base.damage;
    const unitV = (u, mine) => {
      const pw = g.power(u), rm = g.remaining(u);
      let v = pw * W.pw + rm * W.rm + (u.card.c || 0) * W.cost + (u.isLeader ? W.leader : 0);
      if ((u.upgrades || []).some((x) => x.card.n === 'Shield')) v += W.shield;
      if (G.phase === 'action' && !u.exhausted) v += pw * (mine ? W.rdyMe : W.rdyOp); // 還能攻擊／還能反擊
      return v;
    };
    let s = 0;
    const myHp = hpLeft(me), opHp = hpLeft(op);
    s += (myHp - opHp) * W.hp;
    // 對方快死了就更積極打基地
    if (opHp <= 10) s += (10 - opHp) * W.opLow;
    if (myHp <= 10) s -= (10 - myHp) * W.myLow;
    for (const u of me.units) s += unitV(u, true);
    for (const u of op.units) s -= unitV(u, false);
    s += (me.hand.length - op.hand.length) * W.hand;
    s += (me.resources.length - op.resources.length) * W.res;
    // 行為風格：侵略＝更看重打對方基地；控制＝更看重場面、手牌和自己的血量
    let st = AI.settings.style;
    // 依自己領袖的屬性自動選風格（侵略色＝搶血）；模擬驗證 Lv2 62:42、Lv4 45:35
    if (!(H.cfg && H.cfg.autoStyle === false) && (!st || st === 'default')) st = (me.leader.card.a || []).includes('Aggression') ? 'aggro' : 'default';
    if (st === 'aggro') s += (30 - opHp) * 0.9 - (me.units.length ? 0 : 1);
    else if (st === 'control') {
      for (const u of me.units) s += unitV(u, true) * 0.3;
      for (const u of op.units) s -= unitV(u, false) * 0.4;
      s += (me.hand.length - op.hand.length) * 0.8 + myHp * 0.3;
    }
    if (me.leader && !me.leader.deployed && !me.leader.exhausted) s += W.ldReady;
    // 先攻指示物：下一輪先手的價值（實驗中）
    const iw = (H.cfg && H.cfg.initW) || 0;
    if (iw && G.initiative != null) s += G.initiative === p ? iw : -iw;
    return s;
  };
  // ---------- 推測對手手牌：看對手領袖＋基地的屬性、已經出過的牌、卡價（當作環境熱門度） ----------
  H.predictPool = function (g, p) {
    const q = 1 - p, Q = g.P(q);
    const key = Q.leader.card.key + '|' + Q.base.card.key;
    g._pool = g._pool || {};
    let pool = g._pool[key];
    if (!pool) {
      const asp = [...(Q.leader.card.a || []), ...(Q.base.card.a || [])];
      pool = SWU.DB.list
        .filter((c) => c.pl === 'Yes' && ['Unit', 'Event', 'Upgrade'].includes(c.t) && (c.a || []).every((a) => asp.includes(a)))
        .map((c) => ({ c, w: 1 + Math.min(3, Math.log10(1 + (+c.pr || 0) * 10)) * 1.5 + ((c.a || []).length ? 1 : 0) + Math.min(12, (SWU.Deck.metaFreq()[c.key.toLowerCase()] || 0)) * 1.2 }));
      g._pool[key] = pool;
    }
    // 已經看過的牌（場上、棄牌堆、公開過的）：牌組通常放 3 張，剩下的機率高
    const seen = {};
    for (const x of [...Q.discard, ...Q.units.map((u) => u), ...Q.units.flatMap((u) => u.upgrades || [])]) if (x && x.card && x.card.key) seen[x.card.key] = (seen[x.card.key] || 0) + 1;
    for (const l of g.G.log) if (l.k === 'logReveal' && l.a[0] === Q.name) for (const n of String(l.a[1]).split('、')) seen['@' + n] = 1;
    return pool.map(({ c, w }) => {
      const k = seen[c.key] || (seen['@' + c.n] ? 1 : 0);
      return { c, w: k ? (k >= 3 ? 0.2 : w + 6) : w };
    });
  };
  H.sampleHand = function (pool, n, maxCost) {
    const out = [];
    const ok = pool.filter((x) => x.w > 0 && (x.c.c || 0) <= maxCost + 2);
    let tot = ok.reduce((s, x) => s + x.w, 0);
    for (let i = 0; i < n && tot > 0; i++) {
      let r = Math.random() * tot;
      const x = ok.find((y) => (r -= y.w) <= 0) || ok[ok.length - 1];
      out.push(x.c);
    }
    return out;
  };
  // 對手下一步用「公開的」場面能做到的最好攻擊（不偷看手牌）
  H.oppThreat = function (g, p) {
    let worst = 0;
    for (const u of g.P(1 - p).units) {
      if (u.exhausted || !g.canAttackWith(u)) continue;
      const b = H.bestAttack(g, u);
      if (b && b.s > worst) worst = b.s;
    }
    return worst;
  };
  H.search = async function (g, p, acts, opt = {}) {
    if (!SWU.engineRT || !g.rec || g.replaying) return null;
    const rt = SWU.engineRT.get();
    const STOP = { stop: true };
    const base = H.evalState(g, p) - H.oppThreat(g, p) * 0.6;
    const cands = [];
    for (const a of acts) {
      if (a.type === 'pass' || a.type === 'initiative' || a.type === 'manualAbility' || a.type === 'manualLeader' || a.manual) continue;
      if (a.type === 'attack') {
        const u = g.findUnit(a.uid);
        if (!u) continue;
        const t = g.attackTargets(u);
        for (const d of t.units) cands.push({ a, force: d.uid });
        if (t.base) cands.push({ a, force: 'base' + (1 - p) });
      } else cands.push({ a });
    }
    if (!cands.length) return { best: null, gain: -Infinity, base };
    const t0 = Date.now();
    const pool = H.predictPool(g, p);
    const sim = async (c, deep) => {
      let score = null;
      let forced = c.force != null;
      let oppMoves = 0;
      let rollN = 0;
      let rgN = 0;
      const mk = (q) => {
        const o = g.io[q] || {};
        return {
          isHuman: !!o.isHuman,
          get autoSingle() {
            return !!o.autoSingle;
          },
          chooseAction: async (g2, who, acts2) => {
            // 推演到這回合結束：雙方都用快速規則打完，再看局面
            if (deep === 'roll' && acts2 && acts2.length && rollN++ < (opt.h2 ? 100 : 40)) return H.chooseAction(g2, who, acts2);
            // 深一層：讓對手用推測的手牌回應一手（最多兩個行動），再看局面
            if (deep && who !== p && oppMoves < 2 && acts2 && acts2.length) {
              oppMoves++;
              const r = H.chooseAction(g2, who, acts2);
              if (r && r.type !== 'pass') return r;
            }
            score = H.evalState(g2, p) - (who !== p ? H.oppThreat(g2, p) * (deep && oppMoves ? 0.4 : 0.6) : 0);
            throw STOP;
          },
          choose: async (g2, qq, req) => {
            if (forced && req.ctx && req.ctx.uid === c.a.uid && req.kind === 'target') {
              forced = false;
              return [c.force];
            }
            if (req.ctx && req.ctx.regroupResource) {
              // 推演看兩回合：第一次重整先照常放資源，到下一回合結束才評分
              if (deep === 'roll' && opt.h2 && rgN++ < 2) return H.choose(g2, qq, req);
              score = H.evalState(g2, p);
              throw STOP;
            }
            return H.choose(g2, qq, req);
          },
          distribute: o.distribute ? async (g2, qq, req) => g2.autoDistribute(qq, req) : undefined,
          showCards: o.showCards ? async () => {} : undefined,
          resolveManual: async () => {},
        };
      };
      // 重播到現在後，把看不到的資訊換掉：雙方牌庫重洗、對手手牌換成推測的牌
      const hide = (g2) => {
        for (const P of g2.G.players) for (let i = P.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [P.deck[i], P.deck[j]] = [P.deck[j], P.deck[i]]; }
        const Q = g2.P(1 - p);
        const guess = H.sampleHand(pool, Q.hand.length, Q.resources.length);
        if (guess.length === Q.hand.length) Q.hand = guess.map((card) => g2.inst(card, 1 - p));
      };
      const g2 = new SWU.Game(g.decks, [mk(0), mk(1)], { ...g.opts, seed: g.seed, uid0: g.uid0, onReplayEnd: opt.cheat ? undefined : hide, replay: [...g.rec, { p, k: 'a', v: JSON.parse(JSON.stringify(c.a)) }] });
      const ce = console.error;
      console.error = () => {};
      try {
        await g2.run();
      } finally {
        console.error = ce;
      }
      if (score == null) score = H.evalState(g2, p);
      // 有效果錯誤的走法不採用
      if (g2.G.log.some((l) => l.k === 'logEffectError' && !/stop/.test(String(l.a[0])) && l.a[0] !== '[object Object]')) score -= 5;
      return score;
    };
    let best = null, bestS = -Infinity;
    try {
      const scored = [];
      for (const c of cands) {
        if (Date.now() - t0 > (opt.tA || (opt.samples > 1 ? 4000 : 2500))) break;
        let sc = 0;
        const ns = opt.samples || 1;
        for (let k = 0; k < ns; k++) sc += await sim(c, false);
        sc /= ns;
        scored.push({ c, sc });
        if (sc > bestS) {
          bestS = sc;
          best = c;
        }
      }
      // 全力：前幾名再多想一層（對手會怎麼回應），用兩層的結果決定
      if (opt.rollout && scored.length > 1) {
        scored.sort((x, y) => y.sc - x.sc);
        let bd = -Infinity, bc = null;
        for (const x of scored.slice(0, opt.top || 5)) {
          if (Date.now() - t0 > (opt.tB || 6000)) break;
          const rs = [];
          for (let k = 0; k < opt.rollout; k++) rs.push(await sim(x.c, 'roll'));
          const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
          // 風險：同一個行動在不同推演裡結果差很多（例如怕對手手上有解牌），就扣分
          const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / rs.length);
          let d = mean - (opt.risk || 0) * sd + x.sc * (opt.blend == null ? 0.3 : opt.blend);
          if (d > bd) {
            bd = d;
            bc = x.c;
          }
        }
        if (bc) best = bc;
      }
      // 高手打法：能攻擊時先攻擊再出牌（出牌之後對手可能先把攻擊者解掉）；分數差不多就先打
      if (opt.attackFirst && best && best.a.type === 'play') {
        const bs = (scored.find((x) => x.c === best) || {}).sc;
        let alt = null;
        for (const x of scored) if (x.c.a.type === 'attack' && bs != null && x.sc >= bs - opt.attackFirst && (!alt || x.sc > alt.sc)) alt = x;
        if (alt) best = alt.c;
      }
      if (opt.deep && scored.length > 1) {
        scored.sort((x, y) => y.sc - x.sc);
        const top = scored.slice(0, 5);
        let bd = -Infinity, bc = null;
        for (const x of top) {
          if (Date.now() - t0 > 5000) break;
          let d = 0;
          const N = 3;
          for (let k = 0; k < N; k++) d += await sim(x.c, true);
          d = d / N + x.sc * 0.25;
          if (d > bd) {
            bd = d;
            bc = x.c;
          }
        }
        if (bc) best = bc;
      }
    } finally {
      SWU.engineRT.set(rt);
    }
    return { best: best && best.a, force: best && best.force, gain: bestS - base, base };
  };
  // 預想版行動選擇：沒有好處的行動就搶先攻／Pass
  // ---------- 難度 1～7（2026-11-25 柏偉：8 級還是太簡單 → 改 7 級整體往上）----------
  // 1：規則型；2：預想一步；3～4：前幾名推演到回合結束；5：原本的最強（前 12 名各推演 14 次）；
  // 6～7：推演看到下一回合（h2）、每個候選多抽幾種對手手牌、想更久
  H.LEVELS = {
    1: {},
    2: { smart: { initFix: true, attackFirst: 0.5 } },
    3: { smart: { initFix: true, attackFirst: 0.5, rollout: 2, top: 4 } },
    4: { smart: { initFix: true, attackFirst: 0.5, rollout: 4, top: 6 } },
    5: { smart: { initFix: true, attackFirst: 0.5, rollout: 14, top: 12, risk: 0.3 } },
    6: { smart: { initFix: true, attackFirst: 0.5, rollout: 20, top: 14, risk: 0.3, samples: 2, h2: true, tA: 5000, tB: 10000 } },
    7: { smart: { initFix: true, attackFirst: 0.5, rollout: 28, top: 16, risk: 0.3, samples: 2, h2: true, tA: 6000, tB: 14000 } },
    // 8（2026-11-25 柏偉要求）：作弊，推演時直接用真實的對手手牌和雙方牌庫順序（不重洗、不猜）
    8: { smart: { initFix: true, attackFirst: 0.5, rollout: 28, top: 16, risk: 0.3, h2: true, tA: 6000, tB: 14000, cheat: true } },
  };
  H.randomAct = function (g, p, acts) {
    const real = acts.filter((a) => !a.manual && a.type !== 'manualAbility' && a.type !== 'manualLeader');
    const nonPass = real.filter((a) => a.type !== 'pass' && a.type !== 'initiative');
    const pool = nonPass.length && Math.random() < 0.85 ? nonPass : real.length ? real : acts;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  H.levelAction = async function (g, p, acts, lv) {
    const L = H.LEVELS[lv] || H.LEVELS[7];
    if (L.smart) return H.chooseActionSmart(g, p, acts, L.smart);
    if (L.rand && Math.random() < L.rand) return { act: H.randomAct(g, p, acts) };
    return { act: H.chooseAction(g, p, acts) };
  };
  H.levelChoose = function (g, p, req, lv) {
    const L = H.LEVELS[lv] || H.LEVELS[7];
    if (L.rand && req.options.length > 1 && Math.random() < L.rand) {
      const ctx = req.ctx || {};
      if (req.kind === 'target') return [req.options[Math.floor(Math.random() * req.options.length)].id];
      // 放資源時亂放（可能把便宜的好牌放掉）
      if (req.kind === 'cards' && (ctx.setupResource || ctx.regroupResource)) {
        const n = Math.max(req.min == null ? 1 : req.min, Math.min(req.max || 1, ctx.regroupResource ? 1 : req.max || 1));
        return req.options
          .map((o) => o.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, n);
      }
    }
    return H.choose(g, p, req);
  };
  // 全力模式：前 6 名候選行動各推演 4 次到回合結束（模擬對戰 128 局對舊版贏 66%）
  H.bestOpt = { rollout: 4, top: 6 };
  H.chooseActionSmart = async function (g, p, acts, opt = H.bestOpt || {}) {
    let r = null;
    try {
      r = await H.search(g, p, acts, opt);
    } catch (e) {
      console.warn('search failed', e);
    }
    if (!r) return { act: H.chooseAction(g, p, acts) };
    const init = acts.find((a) => a.type === 'initiative');
    const pass = acts.find((a) => a.type === 'pass');
    // 要 Pass／搶先攻之前，能免費打對方基地就先打（攻擊基地自己不受傷，橫置也不影響防守）
    const baseAtk = () => {
      let b = null, bp = 0;
      for (const a of acts) {
        if (a.type !== 'attack') continue;
        const u = g.findUnit(a.uid);
        if (!u || !g.attackTargets(u).base) continue;
        const pw = g.power(u, true);
        if (pw > bp) (bp = pw), (b = a);
      }
      return b && { act: b, force: 'base' + (1 - p), pw: bp };
    };
    const done = (x) => {
      const t = x.act && x.act.type;
      if (opt.baseFirst && (t === 'pass' || (t === 'initiative' && opt.baseFirst >= 2))) {
        const b = baseAtk();
        if (b && (t === 'pass' || b.pw >= (opt.baseFirstMin || 1))) return { act: b.act, force: b.force };
      }
      return x;
    };
    if (r.best && r.gain > 0.3) return done({ act: r.best, force: r.force });
    // 還有費用能下牌時，先把場面鋪好再搶先攻（資源留到回合結束就浪費了）
    if (opt.initFix && init && r.best && r.best.type === 'play' && r.gain > -1.5) return { act: r.best, force: r.force };
    // 沒什麼好做的：能搶先攻就搶（等於 Pass 但下回合先手）
    if (init) return done({ act: init });
    if (r.best && r.gain > -0.5 && !pass) return done({ act: r.best, force: r.force });
    return done({ act: pass || r.best || acts[0] });
  };
  const HARM = /damage|defeat|capture|-\d|傷害|擊敗|俘虜|攻擊誰|attack/i;
  H.choose = function (g, p, req) {
    const opts = req.options;
    const ctx = req.ctx || {};
    if (req.kind === 'yesno') {
      if (ctx.mulligan) {
        const hand = g.P(p).hand;
        const cheap = hand.filter((c) => (c.card.c || 0) <= 3 && c.card.t === 'Unit').length;
        if (H.cfg && H.cfg.oldMull) return [cheap >= 2 ? 'no' : 'yes'];
        // 留牌：前兩回合有東西下（≤3 費的牌至少 2 張、其中有單位），且手上不全是 6 費以上的大牌
        const early = hand.filter((c) => (c.card.c || 0) <= 3).length;
        const big = hand.filter((c) => (c.card.c || 0) >= 6).length;
        return [early >= 2 && cheap >= 1 && big <= 3 ? 'no' : 'yes'];
      }
      if (ctx.uid) {
        const u = g.findUnit(ctx.uid);
        if (u && /1 damage to|造成 1 點傷害|deal 2 to|造成 2 點傷害/.test(req.prompt) && g.remaining(u) <= 2) return ['no'];
      }
      return ['yes'];
    }
    if (req.kind === 'cards') {
      const cards = opts.map((o) => ({ o, c: g.findAny(o.id) }));
      const max = req.max || 1;
      const min = req.min == null ? 1 : req.min;
      if (ctx.setupResource || ctx.regroupResource) {
        if (ctx.regroupResource && g.P(p).resources.length >= 8) return [];
        if (H.cfg && H.cfg.oldChoose) {
          cards.sort((a, b) => (b.c?.card.c || 0) - (a.c?.card.c || 0));
          return cards.slice(0, Math.max(min, ctx.regroupResource ? 1 : max)).map((x) => x.o.id);
        }
        // 放「最不會用到」的牌：近期打得出來的留著，離現在費用太遠的、重複的獨特卡先放
        const P = g.P(p);
        const R = P.resources.length + (ctx.setupResource ? 2 : 1);
        const L = P.leader;
        const needLeader = !L.deployed && !L.epicUsed && (L.card.c || 0) > R;
        const names = {};
        for (const x of cards) if (x.c) names[x.c.card.n] = (names[x.c.card.n] || 0) + 1;
        const onBoard = new Set(P.units.map((u) => u.card.n));
        const keep = (x) => {
          if (!x.c) return 0;
          const c = x.c.card, cost = c.c || 0;
          let v;
          if (cost <= R) v = 10 + cost * 0.8;
          else if (cost <= R + 2) v = 7 + cost * 0.4;
          else v = 4 - (cost - R) * 0.6;
          if (c.u && (names[c.n] > 1 || onBoard.has(c.n))) v -= 6;
          if (c.t === 'Upgrade') v -= 1;
          if (c.t === 'Event' && /^Defeat|damage/i.test(c.tx || '') && !g.opp(p).units.length) v -= 1;
          if (needLeader) v -= 0.5;
          return v;
        };
        cards.sort((a, b) => keep(a) - keep(b));
        return cards.slice(0, Math.max(min, ctx.regroupResource ? 1 : max)).map((x) => x.o.id);
      }
      if (/discard|棄/i.test(req.prompt)) {
        cards.sort((a, b) => (a.c?.card.c || 0) - (b.c?.card.c || 0));
        return cards.slice(0, Math.max(min, 1)).map((x) => x.o.id);
      }
      cards.sort((a, b) => (b.c?.card.c || 0) - (a.c?.card.c || 0));
      return cards.slice(0, Math.max(min, Math.min(max, 1))).map((x) => x.o.id);
    }
    if (req.kind === 'option') return [ctx.aiPick != null && opts.some((o) => o.id === ctx.aiPick) ? ctx.aiPick : 0];
    // 單位／目標
    const harm = HARM.test(req.prompt);
    let bestO = null;
    let bestS = -Infinity;
    for (const o of opts) {
      let s = 0;
      if (String(o.id).startsWith('base')) {
        const b = +String(o.id).slice(4);
        s = b !== p ? 3 : -9;
        if (ctx.uid) {
          const u = g.findUnit(ctx.uid);
          if (u) {
            const best = H.bestAttack(g, u);
            s = best && best.base ? 100 : 0;
          }
        }
      } else {
        const u = g.findUnit(o.id);
        if (!u) continue;
        const enemy = u.ctrl !== p;
        if (ctx.uid && enemy) {
          const a = g.findUnit(ctx.uid);
          const best = a && H.bestAttack(g, a);
          s = best && best.target === u ? 100 : H.unitValue(g, u) * 0.1;
        } else if (harm) {
          s = enemy ? H.unitValue(g, u) : -H.unitValue(g, u);
          // 傷害類：能打死的優先（有護盾的打不死）
          if (enemy && ctx.op === 'damage' && typeof ctx.n === 'number') {
            const shield = (u.upgrades || []).some((x) => x.card.n === 'Shield');
            s += !shield && ctx.n >= g.remaining(u) ? 8 + H.unitValue(g, u) : shield ? -3 : 0;
          }
        }
        else s = enemy ? -H.unitValue(g, u) : H.unitValue(g, u) + u.damage;
      }
      if (s > bestS) {
        bestS = s;
        bestO = o;
      }
    }
    if ((req.min || 0) === 0 && bestS < 0) return [];
    return bestO ? [bestO.id] : [opts[0].id];
  };

  // ---------- 對戰玩家 ----------
  AI.makePlayer = function (hooks = {}) {
    const say = (text) => hooks.say && text && hooks.say(text);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const useClaude = (kind) => AI.hasClaude() && (AI.settings.mode === 'all' || kind === 'action' || kind === 'manual');
    const fails = { n: 0 };
    let force = null; // 預想時選好的攻擊目標
    async function claudeOr(fallback, fn) {
      if (fails.n >= 3) return fallback();
      try {
        hooks.thinking && hooks.thinking(true);
        const r = await fn();
        fails.n = 0;
        return r;
      } catch (e) {
        console.warn('Claude failed', e);
        fails.n++;
        hooks.error && hooks.error(e);
        return fallback();
      } finally {
        hooks.thinking && hooks.thinking(false);
      }
    }
    return {
      isAI: true,
      async chooseAction(g, p, acts) {
        await wait(AI.settings.delay);
        if (!useClaude('action')) {
          const t0 = Date.now();
          const r = await H.levelAction(g, p, acts, AI.levelNum());
          force = r.force != null && r.act && r.act.type === 'attack' ? { uid: r.act.uid, target: r.force } : null;
          // 不讓「想多久」洩漏手牌：決定 Pass／搶先攻時也像有在考慮一樣等一下
          if (r.act && (r.act.type === 'pass' || r.act.type === 'initiative') && AI.settings.delay !== 0) {
            const left = 700 + Math.random() * 900 - (Date.now() - t0);
            if (left > 0) await wait(left);
          }
          return r.act;
        }
        return claudeOr(
          () => H.chooseAction(g, p, acts),
          async () => {
            const snap = g.snapshot(p);
            const list = acts.map((a, i) => `${i}: ${SWU.tl('en', ...actLabelEn(g, a))}`).join('\n');
            const r = await AI.ask({
              system: persona() + '\n' + RULES,
              user: `Game state (JSON):\n${JSON.stringify(snap)}\n\nYour legal actions:\n${list}\n\nPick the best action index. "say" is a short in-character remark to your opponent (do not reveal your hand).`,
              schema: {
                type: 'object',
                properties: { choice: { type: 'integer' }, say: { type: 'string' } },
                required: ['choice', 'say'],
                additionalProperties: false,
              },
              maxTokens: 1500,
            });
            say(r.say);
            const a = acts[r.choice];
            return a || H.chooseAction(g, p, acts);
          }
        );
      },
      async choose(g, p, req) {
        if (force && req.kind === 'target' && req.ctx && req.ctx.uid === force.uid && req.options.some((o) => o.id === force.target)) {
          const t = force.target;
          force = null;
          return [t];
        }
        if (!useClaude('choice') || req.options.length <= 1) {
          await wait(Math.min(400, AI.settings.delay));
          return H.levelChoose(g, p, req, AI.levelNum());
        }
        return claudeOr(
          () => H.choose(g, p, req),
          async () => {
            const list = req.options.map((o, i) => `${i}: ${o.label}`).join('\n');
            const r = await AI.ask({
              system: persona() + '\n' + RULES,
              user: `Game state (JSON):\n${JSON.stringify(g.snapshot(p))}\n\nDecision: ${req.prompt}\nOptions:\n${list}\nChoose between ${req.min == null ? 1 : req.min} and ${req.max || 1} option indexes.`,
              schema: {
                type: 'object',
                properties: { picks: { type: 'array', items: { type: 'integer' } } },
                required: ['picks'],
                additionalProperties: false,
              },
              maxTokens: 800,
            });
            const ids = (r.picks || []).map((i) => req.options[i] && req.options[i].id).filter((x) => x != null);
            const min = req.min == null ? 1 : req.min;
            if (ids.length < min) return H.choose(g, p, req);
            return ids.slice(0, req.max || 1);
          }
        );
      },
      async resolveManual(g, p, info) {
        if (!AI.hasClaude()) {
          g.log('logAiSkip', info.card.n);
          return;
        }
        await claudeOr(
          () => g.log('logAiSkip', info.card.n),
          async () => {
            const ops = await AI.interpret(g, p, info);
            if (ops.say) say(ops.say);
            await AI.applyOps(g, p, ops.ops || [], info.source && info.source.uid);
          }
        );
      },
    };
  };
  function actLabelEn(g, a) {
    const name = (uid) => {
      const x = g.findAny(uid);
      return x ? x.card.key : '?';
    };
    switch (a.type) {
      case 'play':
        return [a.from === 'smuggle' ? 'actSmuggle' : 'actPlay', name(a.uid), a.cost];
      case 'attack':
        return ['actAttack', name(a.uid)];
      case 'ability':
      case 'manualAbility':
        return ['actAbility', name(a.uid), a.line || ''];
      case 'leaderAbility':
      case 'manualLeader':
        return ['actLeaderAbility', g.P(g.G.active).leader.card.key, a.line || ''];
      case 'deploy':
        return ['actDeploy', g.P(g.G.active).leader.card.key];
      case 'initiative':
        return ['actInitiative'];
      default:
        return ['actPass'];
    }
  }

  // ---------- 效果判讀：把卡片文字變成可執行的操作 ----------
  const OPS_SCHEMA = {
    type: 'object',
    properties: {
      say: { type: 'string' },
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['damage', 'heal', 'defeat', 'shield', 'experience', 'draw', 'exhaust', 'ready', 'buff', 'returnToHand', 'createToken', 'resourceTop', 'attack', 'healBase', 'damageBase', 'discardFromHand', 'note'] },
            target: { type: 'string' },
            amount: { type: 'integer' },
            power: { type: 'integer' },
            hp: { type: 'integer' },
            token: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['op'],
          additionalProperties: false,
        },
      },
    },
    required: ['ops', 'say'],
    additionalProperties: false,
  };
  AI.interpret = async function (g, p, info) {
    const snap = g.snapshot(p);
    return AI.ask({
      system:
        persona() +
        '\n' +
        RULES +
        '\nYou resolve a card ability the game engine does not automate. Translate it into primitive operations and choose targets that are legal and best for the controller. ' +
        'Targets: a unit uid as a string (e.g. "123"), "self" for the source unit, "myBase" or "enemyBase". For draw/discardFromHand/createToken/resourceTop/healBase/damageBase, target may be "me" or "opponent". ' +
        'buff = power/hp change for this phase. attack = attack with the target unit (amount = bonus power). If an optional ("you may") effect is bad, return no ops. If something cannot be expressed, add a note op.',
      user: `Controller: ${g.P(p).name} (you).\nCard: ${info.card.key}\nAbility to resolve now: ${info.text}\nSource uid: ${info.source && info.source.uid}\nGame state:\n${JSON.stringify(snap)}`,
      schema: OPS_SCHEMA,
      maxTokens: 1500,
    });
  };
  AI.applyOps = async function (g, p, ops, srcUid) {
    const sideOf = (t) => (t === 'opponent' || t === 'enemyBase' ? 1 - p : p);
    const unit = (t, src) => {
      if (t === 'self' && src) return g.findUnit(src);
      const u = g.findUnit(+t);
      return u;
    };
    for (const o of ops.slice(0, 12)) {
      const u = unit(o.target, srcUid);
      const n = Math.max(0, Math.min(20, o.amount || 1));
      switch (o.op) {
        case 'damage':
          if (o.target === 'myBase' || o.target === 'enemyBase') g.damageBase(sideOf(o.target), n);
          else if (u) await g.damageUnit(u, n);
          break;
        case 'heal':
          if (o.target === 'myBase' || o.target === 'enemyBase') g.healBase(sideOf(o.target), n);
          else if (u) g.heal(u, n);
          break;
        case 'healBase':
          g.healBase(sideOf(o.target), n);
          break;
        case 'damageBase':
          g.damageBase(sideOf(o.target), n);
          break;
        case 'defeat':
          if (u) await g.defeat(u, { ability: true, srcP: p });
          break;
        case 'shield':
          if (u) g.giveShield(u);
          break;
        case 'experience':
          if (u) g.giveExp(u, n);
          break;
        case 'draw':
          g.draw(sideOf(o.target), n);
          break;
        case 'discardFromHand':
          await g.discardFromHand(sideOf(o.target), n);
          break;
        case 'exhaust':
          if (u) g.exhaust(u);
          break;
        case 'ready':
          if (u) g.ready(u);
          break;
        case 'buff':
          if (u) g.buff(u, o.power || 0, o.hp || 0, 'phase');
          break;
        case 'returnToHand':
          if (u) g.returnToHand(u);
          break;
        case 'createToken':
          g.createToken(sideOf(o.target), o.token || 'Clone Trooper', n);
          break;
        case 'resourceTop':
          g.resourceTop(sideOf(o.target));
          break;
        case 'attack':
          if (u && u.ctrl === p) {
            u.exhausted = false;
            await g.attack(u, { power: o.amount || 0 });
          }
          break;
        case 'note':
          if (o.text) g.log('logAi', o.text);
          break;
      }
      await g.checkState();
    }
  };

  // ---------- 牌組評語 ----------
  AI.reviewDeck = async function (deck, analysis) {
    const list = SWU.Deck.toText(deck);
    const zh = SWU.lang === 'zh';
    return AI.ask({
      system: persona() + '\n' + RULES + (zh ? '\n這次是組牌顧問模式：用繁體中文寫，條列清楚，約 300 到 500 字，可以用 Markdown 標題與條列。' : '\nDeck advisor mode: write in English, 200-350 words, Markdown headings and bullets allowed.'),
      user:
        `Review this Premier deck: strengths, weaknesses, mulligan advice, and up to 5 concrete swaps (only real cards that fit the aspects).\n\n${list}\n\nStructural stats: ${JSON.stringify({
          size: analysis.N,
          curve: analysis.curve,
          types: analysis.types,
          arenas: analysis.arenas,
          avgCost: analysis.avg.toFixed(2),
          aspectPenaltyCards: analysis.penaltyCards,
          keywords: analysis.kw,
          score: analysis.score.total,
        })}`,
      maxTokens: 4000,
      effort: 'medium',
    });
  };

  // ---------- AI 組牌 ----------
  AI.buildDeck = async function (leaderKey, baseKey, wishes) {
    const L = SWU.Deck.card(leaderKey);
    const B = SWU.Deck.card(baseKey);
    const pool = SWU.Deck.poolBrief(leaderKey, baseKey, 240);
    const zh = SWU.lang === 'zh';
    const r = await AI.ask({
      system: persona() + '\n' + RULES + '\nYou are building a competitive Premier deck. Use only cards from the candidate list, copied exactly by name (the part before the first " | " pair is "Name | Subtitle"). Exactly 50 main-deck cards, max 3 copies each.',
      user: `Leader: ${L.key} — ${L.tx} / Unit side: ${L.bt}\nBase: ${B.key} (${B.h} HP) ${B.tx || ''}\nPlayer wishes: ${wishes || '(none)'}\n\nCandidates (name | type | cost | stats | arena | traits | text):\n${pool.join('\n')}\n\nReturn the deck and a short explanation ${zh ? 'in Traditional Chinese (about 150-250 characters)' : 'in English (about 120 words)'}.`,
      schema: {
        type: 'object',
        properties: {
          cards: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, count: { type: 'integer' } }, required: ['name', 'count'], additionalProperties: false } },
          explanation: { type: 'string' },
        },
        required: ['cards', 'explanation'],
        additionalProperties: false,
      },
      maxTokens: 6000,
      effort: 'medium',
    });
    const deck = SWU.Deck.blank(zh ? '由奈組的 ' + L.n : 'Yuna build: ' + L.n);
    deck.leader = leaderKey;
    deck.base = baseKey;
    const miss = [];
    for (const e of r.cards || []) {
      const name = String(e.name).split(' | ').slice(0, 2).join(' | ');
      const c = SWU.Deck.findByName(name, null, SWU.Deck.aspects(deck));
      if (!c || !['Unit', 'Event', 'Upgrade'].includes(c.t)) {
        miss.push(e.name);
        continue;
      }
      deck.main[c.key] = Math.min(3, (deck.main[c.key] || 0) + Math.max(1, e.count | 0));
    }
    // 補到 50 或砍到 50
    let n = SWU.Deck.count(deck);
    if (n < 50) {
      const fill = SWU.Deck.autoBuild(leaderKey, baseKey);
      for (const [k, c] of SWU.Deck.sorted(fill.main)) {
        if (n >= 50) break;
        const cur = deck.main[k] || 0;
        const add = Math.min(3 - cur, c, 50 - n);
        if (add > 0) {
          deck.main[k] = cur + add;
          n += add;
        }
      }
    }
    while (n > 50) {
      const [k] = SWU.Deck.sorted(deck.main).slice(-1)[0];
      deck.main[k]--;
      if (!deck.main[k]) delete deck.main[k];
      n--;
    }
    deck.notes = r.explanation;
    return { deck, explanation: r.explanation, missing: miss };
  };
})();
