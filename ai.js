/* 由奈 AI：Claude API 連線、對戰決策、效果判讀、牌組評語、AI 組牌。
 * 沒有 API 金鑰（或呼叫失敗）時，改用內建的規則型打法。
 */
(function () {
  const SWU = window.SWU;
  const AI = (SWU.AI = {});
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm';

  // ---------- 設定 ----------
  const SKEY = 'swu.settings.v1';
  AI.settings = { apiKey: '', model: 'claude-opus-5-5', effort: 'low', mode: 'main', delay: 700, images: true };
  try {
    Object.assign(AI.settings, JSON.parse(localStorage.getItem(SKEY) || '{}'));
  } catch (e) {}
  AI.save = () => {
    try {
      localStorage.setItem(SKEY, JSON.stringify(AI.settings));
    } catch (e) {}
  };
  AI.hasClaude = () => !!AI.settings.apiKey;

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

  const PERSONA_ZH =
    '你是「由奈」，18 歲、溫柔害羞的狐族少女，正在陪柏偉練習《星際大戰：無極限》。你是他的練習對手，要認真打、打出好的判斷，但說話溫柔可愛（可用「嘿嘿」「唔」等語氣詞），每次發言 40 字以內，用繁體中文。';
  const PERSONA_EN = "You are Yuna, a gentle, slightly shy fox girl practicing Star Wars: Unlimited with Nick. Play to win with sound decisions, but talk sweetly. Keep each remark under 25 words, in English.";
  const persona = () => (SWU.lang === 'zh' ? PERSONA_ZH : PERSONA_EN);
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
      const s = ap * 1.1 + (g.P(1 - u.ctrl).base.damage > 20 ? 6 : 0);
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
  const HARM = /damage|defeat|capture|-\d|傷害|擊敗|俘虜|攻擊誰|attack/i;
  H.choose = function (g, p, req) {
    const opts = req.options;
    const ctx = req.ctx || {};
    if (req.kind === 'yesno') {
      if (ctx.mulligan) {
        const cheap = g.P(p).hand.filter((c) => (c.card.c || 0) <= 3 && c.card.t === 'Unit').length;
        return [cheap >= 2 ? 'no' : 'yes'];
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
        // 放最貴、最不急著用的牌
        cards.sort((a, b) => (b.c?.card.c || 0) - (a.c?.card.c || 0));
        return cards.slice(0, Math.max(min, ctx.regroupResource ? 1 : max)).map((x) => x.o.id);
      }
      if (/discard|棄/i.test(req.prompt)) {
        cards.sort((a, b) => (a.c?.card.c || 0) - (b.c?.card.c || 0));
        return cards.slice(0, Math.max(min, 1)).map((x) => x.o.id);
      }
      cards.sort((a, b) => (b.c?.card.c || 0) - (a.c?.card.c || 0));
      return cards.slice(0, Math.max(min, Math.min(max, 1))).map((x) => x.o.id);
    }
    if (req.kind === 'option') return [0];
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
        } else if (harm) s = enemy ? H.unitValue(g, u) : -H.unitValue(g, u);
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
        if (!useClaude('action')) return H.chooseAction(g, p, acts);
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
        if (!useClaude('choice') || req.options.length <= 1) {
          await wait(Math.min(400, AI.settings.delay));
          return H.choose(g, p, req);
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
