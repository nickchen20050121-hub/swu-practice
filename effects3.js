/* 其餘卡片的效果（2026-11-25 起逐張對照官方文字補完）。
 * 在 gfx.js 之後載入：可以用 RUN() 借用句型判讀執行「效果本體」，觸發條件與特殊規則手寫。
 * extend: true 的卡只補自動判讀略過的那幾行，其餘沿用自動判讀。
 */
(function () {
  const SWU = window.SWU;
  const GFX = SWU.GFX;
  const def = SWU.EFFECTS.def;
  const L = (zh, en) => (SWU.lang === 'en' ? en : zh);
  const N = (c) => (SWU.cardName ? SWU.cardName(c.card || c) : (c.card || c).n);
  const isTok = (u) => /Token/.test(u.card.t);
  const cardOf = (key) => SWU.DB.byKey.get(key.toLowerCase());
  SWU.FX3_FAIL = [];
  // 句型判讀的效果本體（解析一次快取）
  const PC = new Map();
  function steps(text) {
    if (PC.has(text)) return PC.get(text);
    const st = GFX.parseBody(GFX.norm(text));
    if (!st) SWU.FX3_FAIL.push(text);
    PC.set(text, st);
    return st;
  }
  async function RUN(g, p, card, text, extra = {}) {
    const st = steps(text);
    if (!st) return false;
    const ctx = { g, p, card: card.card || card, ok: true, ...extra };
    await GFX.runSteps(ctx, st);
    return ctx.ok !== false;
  }
  SWU.RUN = RUN;
  // 句型清單：卡表載入後才能解析（特徵名稱等要等卡表），測試時呼叫 SWU.FX3_CHECK()
  const PRE = [];
  const pre = (...ts) => PRE.push(...ts);
  SWU.FX3_CHECK = () => {
    PRE.forEach(steps);
    return SWU.FX3_FAIL;
  };
  const phaseNow = (g) => g.G.phaseId;
  const otherAttackedThisPhase = (g, u) => (g.G.attackers || []).some((a) => a.phaseId === g.G.phaseId && a.uid !== u.uid);
  const enemyAbility = (g, u, src = {}) => !src.combat && g.dealerOf(src) !== u.ctrl;
  async function may(g, p, card, q) {
    return g.yesno(p, `${N(card)}：${q}`, { card: (card.card || card).key });
  }
  async function exhaustLeaderMay(g, Ld, q) {
    if (Ld.exhausted) return false;
    if (!(await may(g, Ld.ctrl, Ld.card, q || L('要橫置領袖發動嗎？', 'Exhaust this leader to use it?')))) return false;
    Ld.exhausted = true;
    return true;
  }
  function moveDiscardToHand(g, owner, uid) {
    const P = g.P(owner);
    const c = P.discard.find((x) => x.uid === uid);
    if (!c) return false;
    P.discard = P.discard.filter((x) => x !== c);
    P.hand.push(c);
    g.log('logReturnHand', c.card.n);
    return true;
  }
  async function searchDeck(g, p, n, filter, card, opts = {}) {
    const P = g.P(p);
    const top = P.deck.splice(0, g.searchN(p, n));
    g.log('logSearch', P.name, top.length);
    const ok = top.filter((c) => filter(c.card));
    const pick = ok.length ? await g.pickCards(p, `${N(card)}：${opts.prompt || L('選擇一張', 'choose a card')}`, ok, opts.min || 0, opts.max || 1) : [];
    const rest = top.filter((c) => !pick.includes(c));
    if (pick.length) g.revealCards && g.revealCards(p, pick, 'search');
    return { pick, rest, top };
  }
  const bottomRandom = (g, p, cards) => g.P(p).deck.push(...SWU.shuffle(cards));
  function mill(g, p, n) {
    const P = g.P(p);
    const out = P.deck.splice(0, n);
    P.discard.push(...out);
    if (out.length) g.log('logMill', P.name, out.length);
    return out;
  }
  function makePilotUpgrade(g, host, u) {
    // 把單位變成駕駛員升級裝到 host 上（移除它的升級和傷害）
    const P = g.P(u.ctrl);
    P.units = P.units.filter((x) => x !== u);
    for (const up of u.upgrades) g.dropUpgrade(up, u);
    const pm = (SWU.PILOT_MOD || {})[u.card.key] || [0, 0];
    const up = u.isLeader ? { uid: u.uid, card: u.card, owner: u.owner, leaderPilot: true, pilotMod: pm } : { uid: u.uid, card: u.card, owner: u.owner, pilot: true, pilotMod: pm };
    host.upgrades.push(up);
    g.log('logAttach', u.card.n, host.card.n);
    return up;
  }
  const hasPilot = (g, u) => u.upgrades.some((x) => x.leaderPilot || x.pilot || g.hasTrait(x.card, 'PILOT'));
  async function pickPlayer(g, p, card, harm = true) {
    const io = g.io[p];
    if (!io || !io.isHuman) return harm ? 1 - p : p;
    const i = await g.pickOption(p, L(`${N(card)}：選擇一位玩家`, `${card.n}: choose a player`), [L('對手', 'Opponent'), L('自己', 'Yourself')]);
    return i === 1 ? p : 1 - p;
  }
  const grantOf = (hooks) => ({ grantFor: (g, up, host) => hooks(g, up, host) });
  const auraGrant = (key, side, impl) => {
    SWU.AURA_GRANT.add(key);
    def(key, side, impl);
  };
  const passive = (key, side = 'card') => def(key, side, {});

  // ===================== 第 1 批 =====================
  def('Allegiant General Pryde | Ruthless and Loyal', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || !ev.indirect || !ev.u || !g.findUnit(ev.u.uid)) return;
      const ups = ev.u.upgrades.filter((x) => !x.card.u && !x.leaderPilot);
      if (!ups.length) return;
      const pick = await g.pickCards(self.ctrl, L(`${N(self)}：可以擊敗它身上一張非獨特升級`, `${self.card.n}: you may defeat a non-unique upgrade on it`), ups, 0, 1);
      if (pick.length) g.removeUpgrade(ev.u, pick[0]);
    },
  });
  def('Anakin Skywalker | Destined for Darkness', 'card', {
    async whenDefeated(g, u) {
      const P = g.P(u.owner);
      const ok = P.deck.filter((c) => c.card.n === 'Darth Vader');
      if (!ok.length) return SWU.shuffle(P.deck);
      const pick = await g.pickCards(u.owner, L('搜尋一張名為達斯維達的卡', 'Search for a card named Darth Vader'), ok, 0, 1);
      if (pick.length) {
        P.deck = P.deck.filter((c) => c !== pick[0]);
        g.revealCards && g.revealCards(u.owner, pick, 'search');
        P.hand.push(pick[0]);
      }
      SWU.shuffle(P.deck);
    },
    discardIgnorePenalty: (g, p, card) => card.n === 'Darth Vader',
  });
  def('Anakin Skywalker | I\'ll Try Spinning', 'pilot', {
    grantFor: (g, up, host) => ({
      async onFriendlyAttackEnd(g, w, atk) {
        if (atk.attacker.uid !== host.uid || !g.findUnit(host.uid) || !host.upgrades.includes(up)) return;
        if (!(await may(g, host.ctrl, up.card, L('要把這張升級收回擁有者手牌嗎？', 'Return this upgrade to its owner\'s hand?')))) return;
        host.upgrades = host.upgrades.filter((x) => x !== up);
        g.P(up.owner).hand.push({ uid: up.uid, card: up.card, owner: up.owner });
        g.log('logBounce', up.card.n);
      },
    }),
  });
  def('Anakin Skywalker | Prescient Podracer', 'card', {
    async onFriendlyAttackEnd(g, self, atk) {
      const a = atk.attacker;
      if (a.ctrl !== self.ctrl || !g.findUnit(a.uid) || g.isLeaderUnit(a) || otherAttackedThisPhase(g, a)) return;
      if (!(await may(g, self.ctrl, self, L(`要把 ${N(a)} 收回手牌並回復基地 2 點嗎？`, `Return ${a.card.n} to hand and heal 2 from your base?`)))) return;
      g.returnToHand(a);
      if (!g.findUnit(a.uid)) g.healBase(self.ctrl, 2);
    },
  });
  def('Anakin\'s Podracer | So Wizard!', 'card', { extend: true, strikeFirst: (g, a) => !otherAttackedThisPhase(g, a) });
  def('Arcana Star Map | Path to Peridea', 'card', { grantFor: () => ({ doubleSearch: true }) });
  def('Asajj Ventress | Death From Above', 'card', {
    async fromHandBaseCombat(g, x, a, atk) {
      const p = a.ctrl;
      if (g.isLeaderUnit(a) || a.arena !== 'Ground' || !g.P(p).hand.includes(x)) return null;
      const cost = 5 + g.aspectPenalty(p, { a: ['Cunning', 'Villainy'] });
      if (!g.canPay(p, cost)) return null;
      if (!(await g.yesno(p, L(`要展示亞莎凡崔斯、支付 ${cost} 讓她取代 ${N(a)} 攻擊基地嗎？`, `Reveal Asajj Ventress and pay ${cost} to replace ${a.card.n} as the attacker?`), { card: x.card.key }))) return null;
      g.pay(p, cost);
      g.revealCards && g.revealCards(p, [x], 'reveal');
      g.returnToHand(a);
      const P = g.P(p);
      P.hand = P.hand.filter((c) => c !== x);
      const u = g.makeUnit({ uid: x.uid, card: x.card, owner: x.owner }, p, { exhausted: true });
      P.units.push(u);
      g.log('logPlay', P.name, x.card.n, cost);
      return u;
    },
  });
  def('At Attin Safety Droid', 'card', { modBaseDamage: (g, s, p, n) => Math.min(n, 4) });
  def('Bacta Tank', 'card', {
    async whenPlayed(g, inst) {
      const t = await g.pickUnit(inst.owner, L('Bacta Tank：回復一個非載具單位最多 3 點傷害', 'Bacta Tank: heal up to 3 damage from a non-Vehicle unit'), (x) => !g.hasTrait(x, 'VEHICLE'), { ctx: { op: 'heal', n: 3 } });
      if (t) g.heal(t, 3);
    },
    grantFor: (g, up, host) => ({
      actions: [
        {
          text: L('擊敗 Bacta Tank：把棄牌堆的非載具單位放到牌庫頂', 'Defeat Bacta Tank: put a non-Vehicle unit from your discard on top of your deck'),
          can: (g, u) => host.upgrades.includes(up) && g.P(u.ctrl).discard.some((c) => c.card.t === 'Unit' && !g.hasTrait(c.card, 'VEHICLE')),
          async run(g, u) {
            g.removeUpgrade(host, up);
            const P = g.P(u.ctrl);
            const cs = P.discard.filter((c) => c.card.t === 'Unit' && !g.hasTrait(c.card, 'VEHICLE'));
            const pick = await g.pickCards(u.ctrl, L('選一張放到牌庫頂', 'Choose a unit to put on top of your deck'), cs, 1, 1);
            if (pick.length) {
              P.discard = P.discard.filter((c) => c !== pick[0]);
              P.deck.unshift(pick[0]);
            }
          },
        },
      ],
    }),
  });
  def('Bail Organa | Doing Everything He Can', 'unit', {
    extend: true,
    onCardPlayed(g, self, ev) {
      if (ev.p === self.ctrl && (ev.from === 'smuggle' || ev.from === 'plot' || ev.from === 'resource')) g.healBase(self.ctrl, 1);
    },
  });
  def('Banshee | Scream Machine', 'card', {
    extend: true,
    async onAttack(g, u) {
      const { pick, rest } = await searchDeck(g, u.ctrl, 5, (c) => c.t !== 'Unit', u, { prompt: L('選一張非單位卡放到牌庫頂', 'choose a non-unit card to put on top') });
      bottomRandom(g, u.ctrl, rest);
      if (pick.length) g.P(u.ctrl).deck.unshift(pick[0]);
    },
  });
  def('Baze Malbus | Good Luck', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'heal' || !ev.u || ev.uid !== self.uid) return;
      await RUN(g, self.ctrl, self, `you may deal ${ev.n} damage to a unit`, { self });
    },
  });
  pre('you may deal 1 damage to a unit', 'you may deal 2 damage to a unit');
  def('Beast Lair', 'card', {
    baseGains: {
      async onActionPhaseStart(g, base) {
        const p = base.ctrl;
        if (!g.P(p).hand.length) return;
        const pick = await g.pickCards(p, L('野獸巢穴：可以棄一張手牌來建立野獸代幣', 'Beast Lair: you may discard a card to create a Beast token'), g.P(p).hand, 0, 1);
        if (!pick.length) return;
        g.P(p).hand = g.P(p).hand.filter((c) => c !== pick[0]);
        g.P(p).discard.push(pick[0]);
        g.log('logDiscard', g.P(p).name, pick[0].card.n);
        g.createToken(p, 'Beast');
      },
    },
  });
  def('Biggs Darklighter | They\'ll Never Stop Us', 'pilot', {
    attachedStatic(g, up, u) {
      const o = { p: 0, h: 0, kw: {} };
      if (g.hasTrait(u, 'FIGHTER')) o.kw.Overwhelm = true;
      if (g.hasTrait(u, 'TRANSPORT')) o.h += 1;
      if (g.hasTrait(u, 'SPEEDER')) o.kw.Grit = true;
      return o;
    },
  });
  def('Black Squadron Scout Wing', 'card', {
    extend: true,
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t !== self || !g.canAttackWith(self)) return;
      if (await may(g, self.ctrl, self, L('要用這個單位攻擊嗎？（本次攻擊 +1/+0）', 'Attack with this unit (+1/+0)?'))) await g.attack(self, { power: 1 });
    },
  });
  def('Blade Three | Bane of the Devastator', 'card', {
    extend: true,
    onEvent(g, self, ev) {
      if (ev.type === 'damage' && ev.base === self.ctrl && g.findUnit(self.uid)) g.giveToken(self, 'Advantage');
    },
  });
  def('Blade of Talzin | A Gift of Shadows', 'card', {
    extend: true,
    upWhenDefeated(g, up, host) {
      if (host.ctrl === up.owner && g.hasTrait(host, 'NIGHT')) moveDiscardToHand(g, up.owner, up.uid);
    },
  });
  auraGrant('Bo-Katan\'s Gauntlet | Reinforce from Above', 'card', {
    extend: true,
    auraGrant: (g, src, u) => (isTok(u) ? null : { async whenDefeated(g, snap) { g.createToken(snap.ctrl, 'Mandalorian'); } }),
  });
  def('BoShek | Charismatic Smuggler', 'pilot', {
    async whenPlayed(g, up, t) {
      const out = mill(g, t.ctrl, 2);
      for (const c of out) if ((c.card.c || 0) % 2 === 1) moveDiscardToHand(g, c.owner, c.uid);
    },
  });
  def('Boba Fett | Any Methods Necessary', 'leader', {
    extend: true,
    async onEvent(g, Ld, ev) {
      if (ev.type !== 'damage' || ev.combat || ev.by !== Ld.ctrl || g.G.bobaBusy) return;
      if (!(await exhaustLeaderMay(g, Ld, L('你造成了非戰鬥傷害：要橫置波巴費特，造成 1 點間接傷害嗎？', 'You dealt non-combat damage: exhaust Boba Fett to deal 1 indirect damage?')))) return;
      const to = await pickPlayer(g, Ld.ctrl, Ld.card);
      g.G.bobaBusy = true;
      try {
        await g.dealIndirect(Ld.ctrl, to, 1);
      } finally {
        g.G.bobaBusy = false;
      }
    },
  });
  def('Boba Fett | Any Methods Necessary', 'unit', {
    extend: true,
    async whenDeployedAsUpgrade(g, host, Ld) {
      const p = host.ctrl;
      await g.dealDivided(p, 4, g.allUnits(), { upTo: true, prompt: L('波巴費特：最多 4 點傷害任意分配給單位', 'Boba Fett: deal up to 4 damage divided among units') });
    },
  });
  def('Boba Fett | Family Found', 'card', {
    extend: true,
    onFriendlyPlay(g, self, u) {
      if (u !== self && g.has(u, 'Ambush')) g.buff(u, 0, 0, 'phase', { Raid: 1, Saboteur: true });
    },
  });
  def('Boba Fett | Feared Bounty Hunter', 'pilot', {
    async whenPlayed(g, up, t) {
      const n = g.hasTrait(t, 'TRANSPORT') ? 2 : 1;
      await RUN(g, t.ctrl, up, `you may deal ${n} damage to a unit`, { attached: t });
    },
  });
  def('Bothan-5 | New Republic Prison Ship', 'card', {
    extend: true,
    async onAnyDefeated(g, self, snap) {
      if (snap.ctrl !== self.ctrl || snap.uid === self.uid || g.hasTrait(snap, 'VEHICLE') || isTok(snap) || snap.isLeader) return;
      if (self.b5Round === g.G.round || !g.findUnit(self.uid)) return;
      const P = g.P(snap.owner);
      const c = P.discard.find((x) => x.uid === snap.uid);
      if (!c) return;
      if (!(await may(g, self.ctrl, self, L(`要讓 Bothan-5 從棄牌堆俘虜 ${N(snap)} 嗎？`, `Have Bothan-5 capture ${snap.card.n} from your discard pile?`)))) return;
      self.b5Round = g.G.round;
      P.discard = P.discard.filter((x) => x !== c);
      (self.captured = self.captured || []).push(c);
      g.log('logCapture', self.card.n, c.card.n);
    },
  });
  def('Captain Pellaeon | Plotting from the Shadows', 'card', {
    extend: true,
    static: (g, u) => ((g.G.defeated || []).some((d) => d.leader && d.phaseId === g.G.phaseId) ? { kw: { Raid: 3 } } : null),
  });
  def('Carbonite Chamber', 'card', {
    extend: true,
    grantFor: (g, up, host) => ({
      actions: [
        {
          text: L('擊敗碳化室：選一個非載具單位，下個重整階段不重置', 'Defeat Carbonite Chamber: a non-Vehicle unit doesn\'t ready next regroup'),
          can: () => host.upgrades.includes(up),
          async run(g, u) {
            g.removeUpgrade(host, up);
            const t = await g.pickUnit(u.ctrl, L('選一個非載具單位', 'Choose a non-Vehicle unit'), (x) => !g.hasTrait(x, 'VEHICLE'), { ctx: { harm: true } });
            if (t) t.skipRegroupReady = g.G.round;
          },
        },
      ],
    }),
  });
  def('Carrion Spike | Harbinger of Tyranny', 'card', {
    extend: true,
    static(g, u) {
      const n = g.P(u.ctrl).base.upgrades.length;
      return n ? { p: n, kw: { Restore: n } } : null;
    },
  });
  def('Carson Teva | There\'s Something Going On', 'card', { extend: true, strikeFirst: () => true });
  def('Cassian Andor | Climb!', 'leader', {
    extend: true,
    protectFriendly: (g, src, u) => (g.G.hitBase || []).some((h) => h.uid === u.uid && h.phaseId === g.G.phaseId),
  });
  def('Cassian Andor | Climb!', 'unit', {
    extend: true,
    noLethal: (g, u) => g.G.initiative === u.ctrl,
    cantBeDefeatedBy: (g, u, why = {}) => g.G.initiative === u.ctrl && !why.combat && !why.state && !why.unique && !why.exploit && g.dealerOf({}) !== u.ctrl,
  });
  def('Cassian Andor | Lay Low', 'card', {
    extend: true,
    aura: (g, src, u) => (g.G.attack && g.G.attack.defender === src && g.G.attack.attacker === u ? { p: -2 } : null),
    modDamage: (g, u, n, src) => (enemyAbility(g, u, src) ? n - 2 : n),
  });
  def('Cassian Andor | Threading the Eye', 'pilot', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u, atk) {
        const opp = 1 - u.ctrl;
        const out = mill(g, opp, 1);
        if (out.length && (out[0].card.c || 0) <= 3) g.draw(u.ctrl, 1);
      },
    }),
  });
  pre('you may disclose Aggression Aggression', 'create a Spy token');
  def('Chairman Papanoida | Undaunted Diplomat', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'draw' || ev.phase !== 'action') return;
      if (await SWU.discloseFlow(g, self.ctrl, ['Aggression', 'Aggression'], self.card.n, true)) g.createToken(self.ctrl, 'Spy');
    },
  });
  const chamTrig = (g, src, ev) => ev.type === 'damage' && !ev.combat && ((ev.u && ev.ctrl === src.ctrl) || ev.base === src.ctrl);
  pre('deal 1 damage to an enemy unit or base', 'you may deal 1 damage to an enemy unit or base');
  def('Cham Syndulla | Hammer of Ryloth', 'leader', {
    extend: true,
    async onEvent(g, Ld, ev) {
      if (!chamTrig(g, Ld, ev)) return;
      if (await exhaustLeaderMay(g, Ld)) await RUN(g, Ld.ctrl, Ld, 'deal 1 damage to an enemy unit or base');
    },
  });
  def('Cham Syndulla | Hammer of Ryloth', 'unit', {
    extend: true,
    async onEvent(g, self, ev) {
      if (chamTrig(g, self, ev)) await RUN(g, self.ctrl, self, 'you may deal 1 damage to an enemy unit or base', { self });
    },
  });
  def('Chancellor Palpatine | How Liberty Dies', 'unit', {
    extend: true,
    whenDeployed(g, u) {
      g.addNext(u.ctrl, { f: (c, o) => o.from === 'plot', n: 3, phaseId: g.G.phaseId });
    },
  });
  const noEnemyDefeat = (g, u, why = {}) => !why.combat && !why.state && !why.unique && !why.exploit && g.dealerOf({}) !== u.ctrl;
  def('Chewbacca | Faithful First Mate', 'card', { extend: true, cantBeDefeatedBy: noEnemyDefeat, cantBeBounced: () => true });
  def('Chewbacca | Faithful First Mate', 'pilot', { grantFor: () => ({ cantBeDefeatedBy: noEnemyDefeat, cantBeBounced: () => true }) });
  def('Chimaera | Reinforcing the Center', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以發動另一個友方單位的「被擊敗時」能力', 'You may use a "When Defeated" ability on another friendly unit'), (x) => x !== u && x.ctrl === u.ctrl && (() => { const e = g.eff(x); return e && e.whenDefeated; })(), { optional: true });
      if (t) await g.eff(t).whenDefeated(g, { ...t }, { chimaera: true });
    },
  });
  def('Colossus | Castilon', 'card', { extend: true, startingHand: -1 });
  def('Confidence in Victory', 'card', {
    canPlay: (g, p) => g.G.phase === 'action' && !(g.G.actN || {})[p + ':' + g.G.phaseId],
    async event(g, p, inst) {
      const i = await g.pickOption(p, L('必勝信念：選擇一個區域', 'Confidence in Victory: choose an arena'), [L('地面', 'Ground'), L('太空', 'Space')], { ctx: { aiPick: 0 } });
      const arena = i === 1 ? 'Space' : 'Ground';
      g.log('logNote', `${inst.card.n}: ${arena}`);
      g.delay({
        at: 'regroupStart',
        round: g.G.round,
        run(g) {
          const mine = g.P(p).units.some((u) => u.arena === arena);
          const theirs = g.P(1 - p).units.some((u) => u.arena === arena);
          if (mine && !theirs) g.winGame(p);
        },
      });
    },
  });
  def('Congress of Malastare', 'card', {
    extend: true,
    costFor: (g, src, card) => (card.t === 'Upgrade' && !(g.G.playLog || []).some((x) => x.p === src.ctrl && x.phaseId === g.G.phaseId && x.card.t === 'Upgrade') ? 1 : 0),
  });
  def('Conveyex Security Captain', 'card', { extend: true, blankEnemyCredits: true });
  def('Corporate Defense Shuttle', 'card', { extend: true, cantAttack: () => true });
  def('Corvus | Inferno Squadron Raider', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      if (hasPilot(g, u)) return;
      const p = u.ctrl;
      const units = g.P(p).units.filter((x) => x !== u && g.hasTrait(x, 'PILOT') && !g.hasTrait(x, 'VEHICLE'));
      const ups = [];
      for (const h of g.P(p).units) if (h !== u) for (const up of h.upgrades) if (up.pilot || up.leaderPilot || g.hasTrait(up.card, 'PILOT')) ups.push({ uid: up.uid, card: up.card, host: h, up });
      const cands = [...units.map((x) => ({ uid: x.uid, card: x.card, unit: x })), ...ups];
      if (!cands.length) return;
      const pick = await g.pickCards(p, L('科爾沃斯：可以把一個友方駕駛員單位或升級裝到這個單位上', 'Corvus: you may attach a friendly Pilot unit or upgrade to this unit'), cands, 0, 1);
      if (!pick.length) return;
      const c = pick[0];
      if (c.unit) makePilotUpgrade(g, u, c.unit);
      else {
        c.host.upgrades = c.host.upgrades.filter((x) => x !== c.up);
        u.upgrades.push(c.up);
        g.log('logAttach', c.card.n, u.card.n);
      }
    },
  });
  def('Count Dooku | Silver-Tongued', 'card', { extend: true, regroupLimit: true });
  def('Crosshair | I\'ve Changed', 'card', {
    whenDamagedSurvive(g, u) {
      g.draw(u.ctrl, 1);
      g.draw(1 - u.ctrl, 1);
    },
    onEvent(g, self, ev) {
      if (ev.type === 'draw' && ev.p !== self.ctrl && ev.phase === 'action') g.damageBase(ev.p, 2, { p: self.ctrl });
    },
  });
  def('DJ | Need a Lift?', 'unit', { extend: true, rescueReady: () => true });
  def('Dark Sanctum', 'card', {
    baseGains: {
      onRegroupStart(g, base) {
        g.draw(base.ctrl, 1);
        g.damageBase(base.ctrl, 2, { p: base.ctrl });
      },
    },
  });
  def('Darth Sidious | Move Against the Jedi', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'heal' || ev.base !== self.ctrl) return;
      await RUN(g, self.ctrl, self, `deal ${ev.n} damage to an enemy unit`, { self });
    },
  });
  const sidiousTarget = async (g, p, card, ev) => {
    const units = g.allUnits().filter((u) => !ev.u || u.uid !== ev.uid);
    const bases = [0, 1].filter((b) => ev.base !== b);
    const t = await g.pickTarget(p, L(`${N(card)}：對另一個單位或基地造成 1 點傷害`, `${card.n}: deal 1 damage to a different unit or base`), { units, bases, optional: true, ctx: { harm: true, op: 'damage', n: 1 } });
    if (!t) return;
    if (t.base != null) g.damageBase(t.base, 1, { p });
    else await g.damageUnit(t.unit, 1, { p });
  };
  def('Darth Sidious | There is no Mercy', 'leader', {
    extend: true,
    async onEvent(g, Ld, ev) {
      if (ev.type !== 'damage' || ev.by !== Ld.ctrl || ev.n < 4) return;
      if (await exhaustLeaderMay(g, Ld)) await sidiousTarget(g, Ld.ctrl, Ld.card, ev);
    },
  });
  def('Darth Sidious | There is no Mercy', 'unit', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || ev.by !== self.ctrl || ev.n < 4) return;
      await sidiousTarget(g, self.ctrl, self.card, ev);
    },
  });
  def('Darth Sion | Lord of Pain', 'card', {
    whenPlayed(g, u) {
      const n = (g.G.defeated || []).filter((d) => d.phaseId === g.G.phaseId && d.ctrl !== u.ctrl).length;
      if (n) g.giveExp(u, n);
    },
    whenDefeated(g, snap) {
      const d = (g.G.defeated || []).filter((x) => x.uid === snap.uid).pop();
      if (d && d.power >= 7) moveDiscardToHand(g, snap.owner, snap.uid);
    },
  });
  def('Darth Traya | Lord of Betrayal', 'card', {
    extend: true,
    async onAttack(g, u) {
      const Ls = [0, 1].map((q) => g.P(q).leader).filter((Ld) => !Ld.deployed && Ld.exhausted);
      if (!Ls.length) return;
      const pick = await g.pickCards(u.ctrl, L('可以重置一個非單位領袖', 'You may ready a non-unit leader'), Ls.map((Ld) => ({ uid: Ld.uid, card: Ld.card, Ld })), 0, 1);
      if (pick.length) pick[0].Ld.exhausted = false;
    },
  });
  def('Darth Vader | Scourge of Squadrons', 'pilot', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        const t = await g.pickUnit(u.ctrl, L('可以對一個單位造成 1 點傷害', 'You may deal 1 damage to a unit'), () => true, { optional: true, ctx: { harm: true, op: 'damage', n: 1 } });
        if (!t) return;
        await g.damageUnit(t, 1, { p: u.ctrl });
        if (!g.findUnit(t.uid)) await RUN(g, u.ctrl, up, 'you may deal 1 damage to a unit or base', { self: u });
      },
    }),
  });
  pre('you may deal 1 damage to a unit or base');
  passive('Data Vault | Scarif'); // 牌組下限在 deck.js 處理
  def('Deadly Vulnerability', 'card', {
    extend: true,
    grantFor: (g, up, host) => ({
      modDamage: (g, u, n) => n * 2,
    }),
    // 防守時攻擊者失去 Overwhelm：在攻擊者身上判斷
  });
  def('Death Star Plans', 'card', {
    extend: true,
    grantFor: (g, up, host) => ({
      async whenAttacked(g, u, atk) {
        const ap = atk.attacker.ctrl;
        if (ap === host.ctrl || !host.upgrades.includes(up)) return;
        const t = await g.pickUnit(ap, L('死星設計圖：裝到你控制的一個單位上', 'Death Star Plans: attach it to a unit you control'), (x) => x.ctrl === ap, {});
        if (!t) return;
        host.upgrades = host.upgrades.filter((x) => x !== up);
        up.ctrl = ap;
        t.upgrades.push(up);
        g.log('logAttach', up.card.n, t.card.n);
      },
      costFor: (g, src, card) => (card.t === 'Unit' && !(g.G.playLog || []).some((x) => x.p === src.ctrl && x.round === g.G.round && x.card.t === 'Unit') ? 2 : 0),
    }),
  });
  def('Deceptive Shade', 'card', {
    extend: true,
    whenDefeated(g, snap) {
      g.addNext(snap.ctrl, { f: (c) => c.t === 'Unit', kw: { Ambush: true }, phaseId: g.G.phaseId });
    },
  });
  def('Decimator of Dissidents', 'card', {
    extend: true,
    costMod: (g, p) => ((g.G.indirectBy || []).some((x) => x.p === p && x.phaseId === g.G.phaseId) ? -1 : 0),
  });
  def('Dedra Meero | Not Wasting Time', 'unit', {
    extend: true,
    static: (g, u) => (g.P(u.ctrl).hand.length > g.P(1 - u.ctrl).hand.length ? { kw: { Raid: 2 } } : null),
  });
  def('Defiant Scrapper', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const O = g.P(1 - u.ctrl);
      if (O.credits > 0 && (await may(g, u.ctrl, u, L('要擊敗一個敵方信用點代幣嗎？', 'Defeat an enemy Credit token?')))) {
        O.credits--;
        g.log('logNote', `${u.card.n}: -1 Credit`);
      }
    },
  });
  def('Dengar | Crude and Slovenly', 'pilot', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        const to = await pickPlayer(g, u.ctrl, up.card);
        await g.dealIndirect(u.ctrl, to, g.hasTrait(u, 'UNDERWORLD') ? 3 : 2, { unit: u });
      },
    }),
  });
  def('Devastator | Hunting the Rebellion', 'card', {
    async whenPlayed(g, u) {
      await g.dealIndirect(u.ctrl, 1 - u.ctrl, 4, { unit: u });
    },
  });
  def('Diplomatic Envoy', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      if (await SWU.discloseFlow(g, u.ctrl, ['Command'], u.card.n, true)) g.addNext(u.ctrl, { f: (c) => c.t === 'Unit', kw: { Ambush: true }, phaseId: g.G.phaseId });
    },
  });

  // ===================== 第 2 批 =====================
  const hasWD = (card) => /When Defeated/i.test(SWU.sideText(card, 'card'));
  const firstThisRound = (g, p, pred) => !(g.G.playLog || []).some((x) => x.p === p && x.round === g.G.round && pred(x.card));
  def('Director Krennic | On the Verge Of Greatness', 'card', {
    extend: true,
    costFor: (g, src, card) => (card.t === 'Unit' && hasWD(card) && firstThisRound(g, src.ctrl, (c) => c.t === 'Unit' && hasWD(c)) ? 1 : 0),
  });
  def('Director Krennic | The Work has Stalled', 'card', {
    extend: true,
    onAttack(g, u) {
      if (g.P(u.ctrl).base.upgrades.length) g.draw(u.ctrl, 1);
    },
  });
  def('Dooku | It is Too Late', 'card', {
    extend: true,
    whenPlayed(g, u) {
      for (const x of g.P(u.ctrl).units) if (g.has(x, 'Hidden')) x.cantBeAttacked = g.G.phaseId;
    },
  });
  def('Elia Kane | False Convert', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const O = g.P(1 - u.ctrl);
      if (!O.resources.length) return;
      const look = SWU.shuffle([...O.resources]).slice(0, 3);
      const pick = await g.pickCards(u.ctrl, L('伊莉亞凱恩：看到的敵方資源，可以擊敗其中 1 張', 'Elia Kane: you may defeat 1 of these enemy resources'), look, 0, 1);
      if (!pick.length) return;
      O.resources = O.resources.filter((r) => r !== pick[0]);
      O.discard.push({ uid: pick[0].uid, card: pick[0].card, owner: pick[0].owner });
      g.log('logDefeat', pick[0].card.n);
      if (O.deck.length) O.resources.push({ ...O.deck.shift(), exhausted: false });
    },
  });
  def('Elzar Mann | Haunted by a Vision', 'card', {
    entersReady: (g, inst, p) => g.hasTrait(g.P(p).leader.card, 'FORCE'),
    async whenPlayed(g, u) {
      let n = 0;
      while (n < 5) {
        const t = await g.pickUnit(u.ctrl, L(`艾爾札曼：分配優勢代幣（已給 ${n}/5，可以停止）`, `Elzar Mann: give an Advantage token (${n}/5 given, optional)`), (x) => x.ctrl === u.ctrl && x !== u, { optional: true });
        if (!t) break;
        g.giveToken(t, 'Advantage');
        n++;
      }
      if (!n) return;
      const o = 1 - u.ctrl;
      const { pick, rest } = await searchDeck(g, o, 2 * n, (c) => c.t === 'Event', { card: u.card }, { prompt: L('選一張事件加入手牌', 'choose an event to draw') });
      bottomRandom(g, o, rest);
      if (pick.length) g.P(o).hand.push(pick[0]);
    },
  });
  const enfysLeader = {
    extend: true,
    async onUsedOnAttack(g, Ld, u, atk, again) {
      if (Ld.exhausted || !g.canPay(Ld.ctrl, 2)) return;
      if (!(await may(g, Ld.ctrl, Ld.card, L('要支付 2 並橫置領袖，再使用一次這個攻擊時能力嗎？', 'Pay 2 and exhaust this leader to use that On Attack ability again?')))) return;
      g.pay(Ld.ctrl, 2);
      Ld.exhausted = true;
      await again();
    },
  };
  def('Enfy Nest | Until We Can Go No Higher', 'leader', enfysLeader);
  def('Enfy Nest | Until We Can Go No Higher', 'unit', {
    extend: true,
    async onUsedOnAttack(g, self, u, atk, again) {
      if (self.enfysRound === g.G.round) return;
      if (!(await may(g, self.ctrl, self, L('要再使用一次這個攻擊時能力嗎？（每回合一次）', 'Use that On Attack ability again? (once per round)')))) return;
      self.enfysRound = g.G.round;
      await again();
    },
  });
  def('Enfys Nest | No More!', 'card', {
    extend: true,
    static: (g, u) => {
      const A = g.G.attack;
      return A && A.attacker === u && A.defender && (A.defender.card.c || 0) <= 3 ? { p: 2, kw: { Overwhelm: true } } : null;
    },
  });
  def('Enoch | Solemn Servant', 'card', {
    extend: true,
    async whenDefeated(g, snap) {
      const p = snap.ctrl;
      const i = await g.pickOption(p, L('伊諾克：對自己基地造成幾點傷害？（每 2 點讓下一個單位少 1 費）', 'Enoch: deal how much damage to your base? (1 less per 2)'), ['0', '1', '2', '3', '4', '5', '6'], { ctx: { aiPick: 2 } });
      const n = Math.max(0, i);
      if (!n) return;
      g.damageBase(p, n, { p });
      if (n >= 2) g.addNext(p, { f: (c) => c.t === 'Unit', n: Math.floor(n / 2), phaseId: g.G.phaseId });
    },
  });
  def('Escape Pod', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('逃生艙：可以俘虜一個友方非載具、非領袖單位', 'Escape Pod: you may capture a friendly non-Vehicle, non-leader unit'), (x) => x.ctrl === u.ctrl && x !== u && !g.hasTrait(x, 'VEHICLE') && !g.isLeaderUnit(x), { optional: true });
      if (t) g.capture(u, t);
    },
  });
  def('Eviscerator | Burn Them Away', 'card', { extend: true, keepAdvantage: true });
  def('Executor | Final Destruction of the Alliance', 'card', {
    extend: true,
    static(g, u) {
      let n = 0;
      for (const x of g.P(u.ctrl).units) if (x !== u) n += x.upgrades.length;
      return n ? { p: n } : null;
    },
  });
  passive('Exiled from the Force'); // 失去能力與原力特徵在引擎 isBlank／hasTrait 處理，Grit 在 kw 處理
  def('Faith in the Empire', 'card', { extend: true, costOnTarget: (g, p, t) => (g.hasTrait(t, 'IMPERIAL') ? 1 : 0) });
  def('Fett\'s Firespray | Settling the Score', 'card', { extend: true, ambushBase: true });
  def('Fire Across the Galaxy', 'card', {
    async event(g, p) {
      const used = new Set();
      for (;;) {
        const t = await g.pickUnit(p, L('可以發動一個友方 Spectre 單位的「打出時」能力', 'You may use a "When Played" ability on a friendly Spectre unit'), (x) => x.ctrl === p && g.hasTrait(x, 'SPECTRE') && !used.has(x.uid) && (() => { const e = g.eff(x); return e && e.whenPlayed; })(), { optional: true });
        if (!t) break;
        used.add(t.uid);
        await g.eff(t).whenPlayed(g, t);
      }
    },
  });
  def('Frozen in Carbonite', 'card', { extend: true, grantFor: () => ({ cantReady: () => true }) });
  SWU.TRAIT_GRANT.add('Fulcrum');
  def('Fulcrum', 'card', {
    grantTrait: () => ['REBEL'],
    grantFor: (g, up, host) => ({ aura: (g, src, u) => (u !== src && u.ctrl === src.ctrl && g.hasTrait(u, 'REBEL') ? { p: 2, h: 2 } : null) }),
  });
  def('GNK Power Droid', 'card', { extend: true, onAttack: (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit', n: 1, phaseId: g.G.phaseId }) });
  let raxBusy = false;
  def('Gallius Rax | Counselor to the Empire', 'card', {
    extend: true,
    aura(g, src, u) {
      if (u === src || u.ctrl !== src.ctrl || raxBusy) return null;
      raxBusy = true;
      try {
        const k = Object.keys(g.kw(u));
        return k.length >= 2 ? { p: 2, h: 2 } : null;
      } finally {
        raxBusy = false;
      }
    },
  });
  def('Gar Saxon | Coveting Power', 'card', {
    extend: true,
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t !== self || self.garRound === g.G.round) return;
      if (!(await may(g, self.ctrl, self, L('要建立一個曼達洛人代幣嗎？', 'Create a Mandalorian token?')))) return;
      self.garRound = g.G.round;
      g.createToken(self.ctrl, 'Mandalorian');
    },
  });
  def('General Grievous | Four-Armed Menace', 'card', {
    extend: true,
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t !== self) return;
      const ph = g.G.phaseId;
      self.ggChosen = self.ggPhase === ph ? self.ggChosen : [];
      self.ggPhase = ph;
      const all = [L('給他 1 個經驗代幣', 'Give an Experience token to him'), L('回復基地 3 點', 'Heal 3 damage from your base'), L('抽一張牌', 'Draw a card')];
      const left = [0, 1, 2].filter((i) => !self.ggChosen.includes(i));
      if (!left.length) return;
      const i = await g.pickOption(self.ctrl, L('葛里維斯：選一項（本階段沒選過的）', 'Grievous: choose one not chosen this phase'), left.map((i) => all[i]));
      const k = left[Math.max(0, i)];
      self.ggChosen.push(k);
      if (k === 0) g.giveExp(self);
      else if (k === 1) g.healBase(self.ctrl, 3);
      else g.draw(self.ctrl, 1);
    },
  });
  def('General Grievous | Scuttling to Safety', 'card', { extend: true, whenAttacked: (g, u) => g.returnToHand(u) });
  def('Gold Leader | Fastest Ship in the Fleet', 'card', {
    extend: true,
    aura: (g, src, u) => (g.G.attack && g.G.attack.defender === src && g.G.attack.attacker === u ? { p: -1 } : null),
  });
  def('Gorian Shard\'s Corsair | Pirate Warship', 'card', { extend: true }); // 無法防止：在引擎 damageUnit 處理
  def('Grand Admiral Thrawn | ...How Unfortunate', 'leader', {
    extend: true,
    async onUsedWhenDefeated(g, Ld, snap, again) {
      if (await exhaustLeaderMay(g, Ld, L(`要橫置索恩，再使用一次 ${N(snap)} 的「被擊敗時」能力嗎？`, `Exhaust Thrawn to use ${snap.card.n}'s When Defeated ability again?`))) await again();
    },
  });
  def('Grand Admiral Thrawn | ...How Unfortunate', 'unit', {
    extend: true,
    async onUsedWhenDefeated(g, self, snap, again) {
      if (self.thrawnRound === g.G.round || snap.uid === self.uid) return;
      if (!(await may(g, self.ctrl, self, L(`要再使用一次 ${N(snap)} 的「被擊敗時」能力嗎？（每回合一次）`, `Use ${snap.card.n}'s When Defeated ability again? (once per round)`)))) return;
      self.thrawnRound = g.G.round;
      await again();
    },
  });
  const fortifyNoPen = (g, src, card) => card.t === 'Upgrade' && /^Fortify/m.test(card.tx || '');
  const TARKIN_DS = 'Grand Moff Tarkin // The Death Star | Tyrant of the Outer Rim // Icon of Tyranny';
  def(TARKIN_DS, 'leader', { extend: true, ignorePenalty: fortifyNoPen });
  def(TARKIN_DS, 'unit', {
    extend: true,
    ignorePenalty: fortifyNoPen,
    async onRegroupStart(g, self) {
      const cands = [0, 1].filter((q) => (g.P(q).base.card.h || 30) - g.P(q).base.damage <= 10);
      if (!cands.length) return;
      const labels = cands.map((q) => (q === self.ctrl ? L('自己的基地', 'your base') : L('對手的基地', "opponent's base")) + ' (' + ((g.P(q).base.card.h || 30) - g.P(q).base.damage) + ')');
      const i = await g.pickOption(self.ctrl, L('死星：可以擊敗一個剩餘生命 10 以下的基地', 'The Death Star: you may defeat a base with 10 or less remaining HP'), [L('不要', 'No'), ...labels], { ctx: { aiPick: cands.includes(1 - self.ctrl) ? 1 + cands.indexOf(1 - self.ctrl) : 0 } });
      if (i <= 0) return;
      g.winGame(1 - cands[i - 1]);
    },
  });
  def('Grav Charge', 'card', {
    grantFor: (g, up, host) => ({
      async onFriendlyAttackEnd(g, w, atk) {
        if (atk.attacker.uid !== host.uid || !host.upgrades.includes(up)) return;
        if (g.findUnit(host.uid)) await g.damageUnit(host, 4, { p: up.owner });
        if (host.upgrades.includes(up)) g.removeUpgrade(host, up);
      },
    }),
  });
  def('Great Pit of Carkoon | Tatooine', 'card', {
    actions: [
      {
        text: L('史詩行動：棄一張單位，搜尋卡空沙拉克', 'Epic Action: discard a unit, search for The Sarlacc of Carkoon'),
        can: (g, b) => !b.epicUsed && g.P(b.ctrl).hand.some((c) => c.card.t === 'Unit'),
        async run(g, b) {
          const P = g.P(b.ctrl);
          const pk = await g.pickCards(b.ctrl, L('棄一張手牌中的單位', 'Discard a unit from your hand'), P.hand.filter((c) => c.card.t === 'Unit'), 1, 1);
          if (!pk.length) return;
          b.epicUsed = true;
          P.hand = P.hand.filter((c) => c !== pk[0]);
          P.discard.push(pk[0]);
          g.noteHandDiscard(b.ctrl, pk[0]);
          const ok = P.deck.filter((c) => c.card.n === 'The Sarlacc of Carkoon');
          if (ok.length) {
            P.deck = P.deck.filter((c) => c !== ok[0]);
            g.revealCards && g.revealCards(b.ctrl, [ok[0]], 'search');
            P.hand.push(ok[0]);
          }
          SWU.shuffle(P.deck);
        },
      },
    ],
  });
  def('Greater Sarlacc', 'card', {
    extend: true,
    affordable: (g, p, cost) => {
      const r = g.readyResources(p) + g.P(p).credits;
      for (let k = 0; k <= g.readyResources(p); k++) if (Math.max(0, cost - 3 * k) <= r - k) return true;
      return false;
    },
    async prePay(g, p, cost) {
      const P = g.P(p);
      const ready = P.resources.filter((r) => !r.exhausted);
      const need = (k) => Math.max(0, cost - 3 * k) <= ready.length - k + P.credits;
      let min = 0;
      while (min <= ready.length && !need(min)) min++;
      const pick = await g.pickCards(p, L('大沙拉克：可以擊敗任意張已就緒的資源，每張少 3 費', 'Greater Sarlacc: defeat any number of ready resources, 3 less each'), ready, Math.min(min, ready.length), ready.length, { aiPick: min });
      for (const r of pick) {
        P.resources = P.resources.filter((x) => x !== r);
        P.discard.push({ uid: r.uid, card: r.card, owner: r.owner });
        g.log('logDefeat', r.card.n);
      }
      return cost - 3 * pick.length;
    },
  });
  def('Greedo | Big-Timer', 'card', { extend: true, strikeLast: () => true });
  def('Grogu | Charming Companion', 'unit', {
    extend: true,
    aura(g, src, u) {
      const A = g.G.attack;
      if (!A || !A.defender) return null;
      if (A.defender === u && u !== src && u.ctrl === src.ctrl) return { p: 1 };
      if (A.attacker.ctrl === src.ctrl && A.attacker !== src && A.defender === u) return { p: -1 };
      return null;
    },
  });
  def('Guardian of the Whills', 'card', {
    extend: true,
    upgradeCostOn: (g, self, card, t) => (t === self && self.gwRound !== g.G.round ? ((self.gwRound = g.G.round), 1) : 0),
  });
  def('Han Solo | Has His Moments', 'pilot', {
    async whenPlayed(g, up, t) {
      if (!g.canAttackWith(t)) return;
      if (await may(g, t.ctrl, up.card, L(`要用 ${N(t)} 攻擊嗎？`, `Attack with ${t.card.n}?`))) await g.attack(t, { strikeFirst: t.card.n === 'Millennium Falcon' });
    },
  });
  def('Han Solo | Never Tell Me the Odds', 'unit', {
    extend: true,
    whenDeployedAsUpgrade(g, host) {
      const p = host.ctrl;
      let n = 0;
      for (const u of g.P(p).units) {
        if (!g.isLeaderUnit(u) && (u.card.c || 0) % 2 === 1) n++;
        for (const x of u.upgrades) if (!/Token/.test(x.card.t) && x.owner === p && (x.card.c || 0) % 2 === 1) n++;
      }
      for (const r of g.P(p).resources) if (n > 0 && r.exhausted) ((r.exhausted = false), n--);
    },
  });
  def('Heavy Ion Cannon', 'card', {
    whenPlayed: (g, inst) => g.draw(inst.owner, 1),
    baseGains: {
      actions: [
        {
          text: L('棄一張手牌：對一個單位造成 2 點傷害（每階段一次）', 'Discard a card: deal 2 damage to a unit (once per phase)'),
          can: (g, b, up) => up.hicPhase !== g.G.phaseId && g.P(b.ctrl).hand.length > 0 && g.allUnits().length > 0,
          async run(g, b, up) {
            const P = g.P(b.ctrl);
            const d = await g.discardFromHand(b.ctrl, 1);
            if (!d.length) return;
            up.hicPhase = g.G.phaseId;
            await RUN(g, b.ctrl, up, 'deal 2 damage to a unit');
          },
        },
      ],
    },
  });
  pre('deal 2 damage to a unit');
  def('Heroic Purrgil', 'card', { extend: true, static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.opts && g.G.attack.opts.ambush ? { p: 2 } : null) });
  def('Hijacked AT-ST', 'card', { extend: true, whenPlayed: (g, u) => (u.skipRegroupReady = g.G.round) });
  def('Hondo Ohnaka | Plays By His Own Rules', 'card', {
    actions: [
      {
        text: L('打出牌庫頂的卡（照常付費，每回合一次）', 'Play the top card of your deck (paying its cost, once per round)'),
        can: (g, u) => u.hondoRound !== g.G.round && g.P(u.ctrl).deck.length > 0 && (() => { const c = g.P(u.ctrl).deck[0]; return ['Unit', 'Event', 'Upgrade'].includes(c.card.t) && g.canPay(u.ctrl, g.costOf(u.ctrl, c.card)) && (c.card.t !== 'Upgrade' || /^Fortify/m.test(c.card.tx || '') || g.upgradeTargets(u.ctrl, c.card).length); })(),
        async run(g, u) {
          u.hondoRound = g.G.round;
          const P = g.P(u.ctrl);
          const c = P.deck.shift();
          await g.playCard(u.ctrl, c.uid, 'deck', { inst: c });
          if (!g.findAny(c.uid) && !g.allUnits().some((x) => x.upgrades.some((y) => y.uid === c.uid)) && !P.discard.includes(c)) {
            // 付不出費用：放回牌庫頂
            P.deck.unshift(c);
          }
        },
      },
    ],
  });
  def('Hondo Ohnaka | Superfluous Swindler', 'card', {
    extend: true,
    async onAttack(g, u) {
      const cands = [];
      for (const h of g.allUnits()) for (const up of h.upgrades) if (!up.pilot && !up.leaderPilot && !g.hasTrait(up.card, 'PILOT')) cands.push({ uid: up.uid, card: up.card, host: h, up });
      if (!cands.length) return;
      const pick = await g.pickCards(u.ctrl, L('韓多：可以取得一張非駕駛員升級的控制權，裝到另一個合法單位', 'Hondo: you may take control of a non-Pilot upgrade and attach it to a different eligible unit'), cands, 0, 1);
      if (!pick.length) return;
      const { host, up } = pick[0];
      const t = await g.pickUnit(u.ctrl, L('裝到哪個單位', 'Attach it to'), (x) => x !== host && (/Token/.test(up.card.t) || g.upgradeTargets(u.ctrl, up.card).includes(x)), {});
      if (!t) return;
      host.upgrades = host.upgrades.filter((x) => x !== up);
      up.ctrl = u.ctrl;
      t.upgrades.push(up);
      g.log('logAttach', up.card.n, t.card.n);
    },
  });
  def('Honor-Bound Partisan', 'card', { extend: true, whenDefeated: (g, snap) => g.addNext(snap.ctrl, { f: (c) => c.t === 'Unit', n: 1, phaseId: g.G.phaseId }) });
  def('Hound\'s Tooth | Reliable and Deadly', 'card', { extend: true, strikeFirst: (g, a, atk) => !!(atk.defender && atk.defender.exhausted && atk.defender.playedPhase !== g.G.phaseId) });
  def('Hunter For Hire', 'card', {
    extend: true,
    anyActions: [
      {
        text: L('擊敗你的一個信用點代幣：取得這個單位的控制權', 'Defeat a friendly Credit token: take control of this unit'),
        can: (g, u, p) => p !== u.ctrl && g.P(p).credits > 0,
        run(g, u, p) {
          g.P(p).credits--;
          SWU.FX2.takeControl(g, u, p);
        },
      },
    ],
  });
  passive('Hunting Aggressor'); // 在引擎 dealIndirect 處理
  def('IG-88 | Murderous Phlutdroid', 'pilot', { grantFor: () => ({ static: (g, u) => (g.P(1 - u.ctrl).units.some((x) => x.damage > 0) ? { p: 3 } : null) }) });
  def('Improvised Identity', 'card', {
    grantFor: (g, up, host) => ({
      actions: [
        {
          text: L('搜尋牌庫頂 3 張的地面單位棄掉，然後可以攻擊並獲得它的能力（每回合一次）', 'Discard a ground unit from the top 3, then you may attack gaining its abilities (once per round)'),
          can: (g, u) => u.iiRound !== g.G.round && host.upgrades.includes(up),
          async run(g, u) {
            u.iiRound = g.G.round;
            const { pick, rest } = await searchDeck(g, u.ctrl, 3, (c) => c.t === 'Unit' && (c.ar || '').includes('Ground'), up, { prompt: L('選一張地面單位棄掉', 'choose a ground unit to discard'), min: 0 });
            bottomRandom(g, u.ctrl, rest);
            if (pick.length) g.P(u.ctrl).discard.push(pick[0]);
            if (!g.canAttackWith(u)) return;
            if (!(await may(g, u.ctrl, up.card, L('要用這個單位攻擊嗎？', 'Attack with this unit?')))) return;
            await g.attack(u, { borrowCard: pick[0] && pick[0].card });
          },
        },
      ],
    }),
  });
  def('In Debt to Crimson Dawn', 'card', {
    grantFor: (g, up, host) => ({
      async whenReadied(g, u) {
        if (g.canPay(u.ctrl, 2) && (await may(g, u.ctrl, up.card, L('要支付 2 讓它保持重置嗎？（否則橫置）', 'Pay 2 to keep it ready? (otherwise exhaust it)')))) g.pay(u.ctrl, 2);
        else u.exhausted = true;
      },
    }),
  });
  def('Independent Smuggler', 'pilot', { attachedStatic: () => ({ kw: { Raid: 1 } }) });
  def('Infused Brawler ', 'card', {
    extend: true,
    onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      const i = self.upgrades.findIndex((x) => x.card.n === 'Experience');
      if (i >= 0) self.upgrades.splice(i, 1);
    },
  });
  def('Inquisitor\'s Lightsaber', 'card', { grantFor: () => ({ static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.hasTrait(g.G.attack.defender, 'FORCE') ? { p: 2 } : null) }) });
  def('Inspector\'s Shuttle', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const nm = await SWU.FX2.nameCard(g, u.ctrl, 1 - u.ctrl, u.card);
      const O = g.P(1 - u.ctrl);
      g.log('logNote', `${u.card.n}: ${nm}`);
      if (O.hand.length) await g.showCards(u.ctrl, O.hand, L('對手的手牌', "Opponent's hand"));
      const n = O.hand.filter((c) => c.card.n === nm).length;
      if (n) g.giveExp(u, n);
    },
  });
  def('Inspiring Senator', 'card', { extend: true, whenDefeated: (g, snap) => g.addNext(snap.ctrl, { f: (c) => c.t === 'Unit' && g.hasTrait(c, 'OFFICIAL'), n: 1, phaseId: g.G.phaseId }) });
  def('Insurgent Camp', 'card', {
    extend: true,
    baseGains: {
      async onFriendlyPlay(g, base, u) {
        const up = base.upgrades.find((x) => x.card.n === 'Insurgent Camp');
        if (!up || g.power(u) > 3) return;
        if (!(await may(g, base.ctrl, up.card, L(`要擊敗叛軍營地來重置 ${N(u)} 嗎？`, `Defeat Insurgent Camp to ready ${u.card.n}?`)))) return;
        base.upgrades = base.upgrades.filter((x) => x !== up);
        g.dropUpgrade(up);
        g.ready(u);
      },
    },
  });
  def('Intelligence Agency', 'card', {
    async whenPlayed(g, inst) {
      const p = inst.owner;
      const O = g.P(1 - p);
      if (!O.hand.length) return;
      await g.showCards(p, O.hand, L('對手的手牌', "Opponent's hand"));
      const d = await SWU.FX2.discardFrom(g, p, 1 - p, O.hand, true, inst.card);
      if (d) g.draw(1 - p, 1);
    },
  });
  def('Intimidator | Citadel Overwatch', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      if (!P.resources.length) return;
      const pick = await g.pickCards(u.ctrl, L('可以把任意張友方資源收回手牌，每張建立一個信用點', 'Return any number of friendly resources to hand; create a Credit for each'), P.resources, 0, P.resources.length, { aiPick: 0 });
      for (const r of pick) {
        P.resources = P.resources.filter((x) => x !== r);
        g.P(r.owner).hand.push({ uid: r.uid, card: r.card, owner: r.owner });
      }
      if (pick.length) {
        P.credits += pick.length;
        g.log('logToken', P.name, 'Credit', pick.length);
      }
    },
  });
  def('Invincible | Naval Adversary', 'card', {
    costMod: (g, p) => {
      const P = g.P(p);
      const sep = (c) => c.u && g.hasTrait(c, 'SEPARATIST');
      if (sep(P.leader.card)) return -1;
      if (P.units.some((u) => sep(u.card) || u.upgrades.some((x) => x.owner === p && sep(x.card)))) return -1;
      if (P.base.upgrades.some((x) => sep(x.card))) return -1;
      return 0;
    },
    async onLeaderDeployed(g, self) {
      const t = await g.pickUnit(self.ctrl, L('可以把一個費用 3 以下的非領袖單位收回擁有者手牌', 'You may return a non-leader unit that costs 3 or less to its owner\'s hand'), (x) => !g.isLeaderUnit(x) && (x.card.c || 0) <= 3, { optional: true });
      if (t) g.returnToHand(t);
    },
  });
  def('Jabba the Hutt | Wonderful Human Being', 'unit', {
    extend: true,
    async onFriendlyDamaged(g, self, ev) {
      const u = ev.u;
      if (u === self || self.jabbaRound === g.G.round || !g.findUnit(u.uid) || !g.findUnit(self.uid)) return;
      const t = await g.pickUnit(self.ctrl, L(`可以讓 ${N(u)} 對一個敵方單位造成 ${ev.n} 點傷害（每回合一次）`, `You may have ${u.card.n} deal ${ev.n} damage to an enemy unit (once per round)`), (x) => x.ctrl !== self.ctrl, { optional: true, ctx: { harm: true, op: 'damage', n: ev.n } });
      if (!t) return;
      self.jabbaRound = g.G.round;
      await g.damageUnit(t, ev.n, { p: self.ctrl });
    },
  });
  SWU.TRAIT_GRANT.add('Jedi Trials');
  def('Jedi Trials', 'card', { extend: true, grantTrait: (g, up, host) => (host.upgrades.length >= 4 ? ['JEDI'] : []) });
  def('Jocasta Nu | The Gift of Knowledge', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const cands = [];
      for (const h of g.P(p).units) for (const up of h.upgrades) if (up.owner === p && !up.leaderPilot) cands.push({ uid: up.uid, card: up.card, host: h, up });
      if (!cands.length) return;
      const pick = await g.pickCards(p, L('可以把一張友方升級移到另一個合法單位', 'You may attach a friendly upgrade to a different eligible unit'), cands, 0, 1);
      if (!pick.length) return;
      const { host, up } = pick[0];
      const t = await g.pickUnit(p, L('移到哪個單位', 'Move it to'), (x) => x !== host && (/Token/.test(up.card.t) || g.upgradeTargets(p, up.card).includes(x) || ((up.pilot) && g.pilotHosts(p).includes(x))), {});
      if (!t) return;
      host.upgrades = host.upgrades.filter((x) => x !== up);
      t.upgrades.push(up);
      g.log('logAttach', up.card.n, t.card.n);
    },
  });
  def('Kachirho Militia', 'card', {
    extend: true,
    onEnemyAttack(g, self, atk) {
      if (!atk.base || atk.attacker.arena !== 'Ground' || self.kmRound === g.G.round || !self.exhausted) return;
      self.kmRound = g.G.round;
      g.ready(self);
    },
  });
  def('Kazuda Xiono | Best Pilot in the Galaxy', 'leader', {
    actions: [
      {
        text: L('一個友方單位本回合失去所有能力，然後再進行一個行動', 'A friendly unit loses all abilities this round; take an extra action'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).units.length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          const t = await g.pickUnit(Ld.ctrl, L('選一個友方單位失去所有能力（本回合）', 'Choose a friendly unit to lose all abilities this round'), (x) => x.ctrl === Ld.ctrl, {});
          if (t) t.blankRound = g.G.round;
          g.G.extraAction = Ld.ctrl;
        },
      },
    ],
  });
  def('Kazuda Xiono | Best Pilot in the Galaxy', 'unit', {
    extend: true,
    async onAttack(g, u) {
      const P = g.P(u.ctrl);
      const pick = await g.pickCards(u.ctrl, L('選任意個友方單位，本回合失去所有能力', 'Choose any number of friendly units; they lose all abilities this round'), P.units.map((x) => ({ uid: x.uid, card: x.card, x })), 0, P.units.length, { aiPick: 0 });
      for (const c of pick) c.x.blankRound = g.G.round;
    },
  });
  def('Keeper of Skara Nal | Awoken', 'card', {
    extend: true,
    async onAttack(g, u) {
      const P = g.P(u.ctrl);
      const ks = P.hand.filter((c) => c.card.n === 'Keeper of Skara Nal');
      if (ks.length < 2) return;
      if (!(await may(g, u.ctrl, u, L('要棄掉 2 張斯卡拉納爾守護者，本次攻擊 +15/+0 並獲得 Overwhelm 嗎？', 'Discard 2 Keeper of Skara Nal for +15/+0 and Overwhelm this attack?')))) return;
      for (const c of ks.slice(0, 2)) {
        P.hand = P.hand.filter((x) => x !== c);
        P.discard.push(c);
        g.noteHandDiscard(u.ctrl, c);
      }
      g.buff(u, 15, 0, 'attack', { Overwhelm: true });
    },
  });
  let kbBusy = false;
  def('Kelleran Beq | Where are the Others?', 'card', {
    extend: true,
    static(g, u) {
      if (kbBusy) return null;
      kbBusy = true;
      try {
        const n = g.allUnits().filter((x) => x !== u && g.power(x) === 0).length;
        return n ? { p: n } : null;
      } finally {
        kbBusy = false;
      }
    },
  });
  const nextUW = (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit' && g.hasTrait(c, 'UNDERWORLD'), n: 1, phaseId: g.G.phaseId });
  def('Khetanna | Upon the Dune Sea', 'card', { extend: true, whenPlayed: nextUW, onAttack: nextUW });
  def('Krrsantan | Hit and Run', 'card', {
    extend: true,
    actions: [
      {
        text: L('棄 2 張手牌：把這個單位收回手牌', 'Discard 2 cards: return this unit to your hand'),
        can: (g, u) => g.P(u.ctrl).hand.length >= 2,
        async run(g, u) {
          const d = await g.discardFromHand(u.ctrl, 2);
          if (d.length === 2) g.returnToHand(u);
        },
      },
    ],
  });
  def('Krrsantan | Santo', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const n = g.P(u.ctrl).resources.length - 3;
      if (n <= 0) return;
      const t = await g.pickUnit(u.ctrl, L(`可以對一個地面單位造成 ${n} 點傷害`, `You may deal ${n} damage to a ground unit`), (x) => x.arena === 'Ground', { optional: true, ctx: { harm: true, op: 'damage', n } });
      if (t) await g.damageUnit(t, n, { p: u.ctrl });
    },
  });
  pre('you may use the Force. If you do, draw a card');
  def('Kylo Ren | I Know Your Story', 'card', {
    extend: true,
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t === self) await RUN(g, self.ctrl, self, 'you may use the Force. If you do, draw a card', { self });
    },
  });
  def('Kylo Ren | Relentless', 'card', {
    extend: true,
    onAttack(g, u) {
      if ((g.G.attackers || []).filter((a) => a.uid === u.uid && a.phaseId === g.G.phaseId).length === 1) g.ready(u);
    },
  });
  def('Kylo Ren | Supreme Leader', 'leader', {
    extend: true,
    actions: [
      {
        text: L('橫置並棄一張手牌：給一個單位經驗代幣', 'Exhaust, discard a card: give an Experience token to a unit'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).hand.length > 0 && g.allUnits().length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          const d = await g.discardFromHand(Ld.ctrl, 1);
          if (!d.length) return;
          const t = await g.pickUnit(Ld.ctrl, L('給一個單位經驗代幣', 'Give an Experience token to a unit'), () => true, {});
          if (t) g.giveExp(t);
        },
      },
    ],
  });
  def('Kylo Ren | We\'re Not Done Yet', 'unit', {
    extend: true,
    async whenDeployed(g, u) {
      const P = g.P(u.ctrl);
      for (let guard = 0; guard < 20; guard++) {
        const ok = P.discard.filter((c) => c.card.t === 'Upgrade' && g.upgradeTargets(u.ctrl, c.card).includes(u) && g.canPay(u.ctrl, g.costOf(u.ctrl, c.card)));
        if (!ok.length || !g.findUnit(u.uid)) break;
        const pick = await g.pickCards(u.ctrl, L('可以從棄牌堆打出升級到凱羅身上（照常付費）', 'You may play an upgrade from your discard pile on this unit (paying its cost)'), ok, 0, 1);
        if (!pick.length) break;
        await g.playCard(u.ctrl, pick[0].uid, 'discard', { target: u });
      }
    },
  });
  def('Kylo Ren\'s Lightsaber', 'card', { extend: true, grantFor: (g, up, host) => (g.hasTrait(host, 'FORCE') ? { cantBeExhaustedBy: () => true } : null) });
  def('Kylo\'s TIE Silencer | Follow My Lead', 'card', {
    extend: true,
    whenDiscardedFromHand(g, c, p) {
      const P = g.P(p);
      (P.discardPlays = P.discardPlays || []).push({ uid: c.uid, phaseId: g.G.phaseId });
    },
  });
  def('L3-37 | Get Out of My Seat', 'card', {
    extend: true,
    async replaceDefeat(g, u, why) {
      const hosts = g.pilotHosts(u.ctrl).filter((x) => x !== u);
      if (!hosts.length) return false;
      if (!(await may(g, u.ctrl, u, L('要改為把她當駕駛員升級裝到友方載具上嗎？', 'Attach her as a Pilot upgrade to a friendly Vehicle instead?')))) return false;
      const t = await g.pickUnit(u.ctrl, L('裝到哪個載具', 'Attach to which Vehicle'), (x) => hosts.includes(x), {});
      if (!t) return false;
      u.damage = 0;
      makePilotUpgrade(g, t, u);
      return true;
    },
  });
  def('L3-37 | We\'re Programmed to Learn', 'card', {
    extend: true,
    async onFriendlyEvent(g, self, card) {
      if ((card.c || 0) > 3 || self.l3Phase === g.G.phaseId || g.G.l3Busy) return;
      const P = g.P(self.ctrl);
      const c = [...P.discard].reverse().find((x) => x.card === card);
      if (!c) return;
      if (!(await may(g, self.ctrl, self, L(`要從棄牌堆免費再打出一次 ${N(card)} 嗎？`, `Play ${card.n} again from your discard pile for free?`)))) return;
      self.l3Phase = g.G.phaseId;
      g.G.l3Busy = true;
      try {
        await g.playCard(self.ctrl, c.uid, 'discard', { free: true });
      } finally {
        g.G.l3Busy = false;
      }
    },
  });
  async function playUpgradeOn(g, p, from, cands, filter, discount, card) {
    if (!cands.length) return null;
    const pick = await g.pickCards(p, L(`${N(card)}：選一張升級`, `${card.n}: choose an upgrade`), cands, 0, 1);
    if (!pick.length) return null;
    const c = pick[0];
    const t = await g.pickUnit(p, L('裝到哪個友方非載具單位', 'Attach to which friendly non-Vehicle unit'), (x) => filter(x) && g.upgradeTargets(p, c.card).includes(x), {});
    if (!t) return null;
    if (!g.canPay(p, Math.max(0, g.costOf(p, c.card) - discount))) return null;
    await g.playCard(p, c.uid, from, { target: t, discount });
    return t;
  }
  const lamaOk = (g, p) => (x) => x.ctrl === p && !g.hasTrait(x, 'VEHICLE');
  def('Lama Su | We Modified Their Genetics', 'leader', {
    actions: [
      {
        text: L('從手牌打出升級到友方非載具單位（少 1 費），並對它造成 1 點傷害', 'Play an upgrade from hand on a friendly non-Vehicle unit (1 less), then deal 1 damage to it'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).hand.some((c) => c.card.t === 'Upgrade' && g.P(Ld.ctrl).units.some((x) => lamaOk(g, Ld.ctrl)(x) && g.upgradeTargets(Ld.ctrl, c.card).includes(x))),
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.ctrl;
          const t = await playUpgradeOn(g, p, 'hand', g.P(p).hand.filter((c) => c.card.t === 'Upgrade'), lamaOk(g, p), 1, Ld.card);
          if (t && g.findUnit(t.uid)) await g.damageUnit(t, 1, { p });
        },
      },
    ],
  });
  def('Lama Su | We Modified Their Genetics', 'unit', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      const p = self.ctrl;
      await playUpgradeOn(g, p, 'discard', g.P(p).discard.filter((c) => c.card.t === 'Upgrade'), lamaOk(g, p), 1, self.card);
    },
  });
  def('Landing Pad', 'card', { extend: true, baseAura: (g, up, baseP, u) => (u.ctrl === baseP && u.arena === 'Space' ? { p: 1 } : null) });
  def('Lando Calrissian | Buying Time', 'unit', {
    extend: true,
    async whenDeployedAsUpgrade(g, host) {
      const t = await g.pickUnit(host.ctrl, L('可以給另一個區域的單位一個護盾', 'You may give a Shield token to a unit in a different arena'), (x) => x.arena !== host.arena, { optional: true });
      if (t) g.giveShield(t);
    },
  });

  def('Stolen Landspeeder', 'card', {
    extend: true,
    async bounty(g, snap, collector) {
      if (collector !== snap.owner) return;
      const P = g.P(snap.owner);
      const c = P.discard.find((x) => x.uid === snap.uid);
      if (!c) return;
      await g.playCard(collector, c.uid, 'discard', { free: true });
      const u = g.findUnit(c.uid);
      if (u) g.giveExp(u);
    },
  });

  // ===================== 第 3 批 =====================
  const friendlyLeftThisPhase = (g, p) => (g.G.left || []).some((x) => x.ctrl === p && x.phaseId === g.G.phaseId);
  function toDeckBottom(g, u) {
    if (!g.findUnit(u.uid) || g.isLeaderUnit(u)) return false;
    const P = g.P(u.ctrl);
    P.units = P.units.filter((x) => x !== u);
    for (const up of u.upgrades) g.dropUpgrade(up, u);
    (g.G.left = g.G.left || []).push({ uid: u.uid, ctrl: u.ctrl, phaseId: g.G.phaseId });
    if (!isTok(u)) g.P(u.owner).deck.push({ uid: u.uid, card: u.card, owner: u.owner });
    g.log('logBottom', u.card.n);
    return true;
  }
  async function playFromDiscard(g, p, cands, card, opts = {}) {
    if (!cands.length) return null;
    const pick = await g.pickCards(p, `${N(card)}：${opts.prompt || L('可以從棄牌堆打出一張', 'you may play a card from your discard pile')}`, cands, 0, 1);
    if (!pick.length) return null;
    const c = pick[0];
    const cost = opts.free ? 0 : Math.max(0, g.costOf(p, c.card, { ignoreAspect: opts.ignoreAspect }) - (opts.discount || 0));
    if (!g.canPay(p, cost)) return null;
    await g.playCard(p, c.uid, 'discard', { free: opts.free, discount: opts.discount || 0, ignoreAspect: opts.ignoreAspect });
    const u = g.findUnit(c.uid);
    if (u && opts.ready) g.ready(u);
    return u || c;
  }
  def('Lando Calrissian | Check This Out', 'card', {
    async whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      const n = Math.min(3, P.resources.length);
      if (n) {
        const pick = await g.pickCards(u.ctrl, L('藍道：把 3 張友方資源收回手牌', 'Lando: return 3 friendly resources to hand'), P.resources, n, n);
        for (const r of pick) {
          P.resources = P.resources.filter((x) => x !== r);
          g.P(r.owner).hand.push({ uid: r.uid, card: r.card, owner: r.owner });
        }
      }
      if (!P.hand.length) return;
      const pick = await g.pickCards(u.ctrl, L('可以把最多 3 張手牌放成資源', 'You may resource up to 3 cards from your hand'), P.hand, 0, Math.min(3, P.hand.length), { aiPick: 3 });
      for (const c of pick) {
        P.hand = P.hand.filter((x) => x !== c);
        P.resources.push({ ...c, exhausted: true });
        await g.fire(u.ctrl, 'onResourced', c);
      }
    },
  });
  def('Lando Calrissian | Eyes Open', 'card', { extend: true, aura: (g, src, u) => (g.G.attack && g.G.attack.defender === src && g.G.attack.attacker === u ? { p: -1 } : null) });
  SWU.TRAIT_GRANT.add('Leia\'s Disguise');
  def('Leia\'s Disguise', 'card', { extend: true, grantTrait: () => ['UNDERWORLD'] });
  def('Let\'s Talk', 'card', {
    costMod: (g, p) => (friendlyLeftThisPhase(g, p) ? -3 : 0),
    async event(g, p) {
      for (const f of [...g.P(p).units]) {
        if (!g.findUnit(f.uid)) continue;
        const t = await g.pickUnit(p, L(`${N(f)} 俘虜同區域的一個敵方非領袖單位`, `${f.card.n} captures an enemy non-leader unit in the same arena`), (x) => x.ctrl !== p && x.arena === f.arena && !g.isLeaderUnit(x), { ctx: { harm: true } });
        if (t) g.capture(f, t);
      }
    },
  });
  def('Liberated by Darkness', 'card', {
    async event(g, p, inst) {
      const P = g.P(p);
      if (!P.force) return;
      if (!(await may(g, p, inst.card, L('要使用原力來取得一個非領袖單位的控制權嗎？', 'Use the Force to take control of a non-leader unit?')))) return;
      P.force = false;
      g.log('logUseForce', P.name);
      const t = await g.pickUnit(p, L('取得一個非領袖單位的控制權', 'Take control of a non-leader unit'), (x) => x.ctrl !== p && !g.isLeaderUnit(x), { ctx: { harm: true } });
      if (!t) return;
      SWU.FX2.takeControl(g, t, p);
      g.delay({ at: 'regroupStart', round: g.G.round, run: (g) => { if (g.findUnit(t.uid)) SWU.FX2.takeControl(g, t, t.owner); } });
    },
  });
  def('Libertine | Under New Ownership', 'card', {
    static: (g, u) => ((u.captured || []).length ? { p: u.captured.length } : null),
    async whenPlayed(g, u) {
      const e = await g.pickUnit(u.ctrl, L('選一個敵方單位', 'Choose an enemy unit'), (x) => x.ctrl !== u.ctrl, {});
      if (!e) return;
      const f = await g.pickUnit(u.ctrl, L('選一個友方非領袖單位被它俘虜', 'Choose a friendly non-leader unit for it to capture'), (x) => x.ctrl === u.ctrl && !g.isLeaderUnit(x), {});
      if (f) g.capture(e, f);
    },
  });
  def('Life Wind Sage', 'card', { extend: true, static: (g, u) => (g.P(1 - u.ctrl).units.some((x) => x.exhausted) ? { kw: { Raid: 2 } } : null) });
  def('Lightspeed Assault', 'card', {
    async event(g, p, inst) {
      const f = await g.pickUnit(p, L('擊敗一個友方太空單位', 'Defeat a friendly space unit'), (x) => x.ctrl === p && x.arena === 'Space', {});
      if (!f) return;
      const pw = g.power(f);
      await g.defeat(f, { self: true });
      const e = await g.pickUnit(p, L(`對一個敵方太空單位造成 ${pw} 點傷害`, `Deal ${pw} damage to an enemy space unit`), (x) => x.ctrl !== p && x.arena === 'Space', { ctx: { harm: true, op: 'damage', n: pw } });
      if (!e) return;
      const ep = g.power(e);
      const dealt = await g.damageUnit(e, pw, { p });
      if (dealt > 0) await g.dealIndirect(p, e.ctrl, ep);
    },
  });
  def('Local Support', 'card', {
    extend: true,
    whenPlayed(g, inst, t) {
      const p = t ? t.ctrl : inst.owner;
      const P = g.P(p);
      if (!P.deck.length) return;
      const top = P.deck[0];
      g.revealCards(p, [top], 'reveal');
      if ((top.card.tr || []).some((tr) => P.units.some((u) => g.hasTrait(u, tr)))) P.hand.push(P.deck.shift());
    },
  });
  def('Loth-Wolf', 'card', { extend: true, cantAttack: () => true });
  def('Lothal E-Wing', 'card', { extend: true, static: (g, u) => (g.P(1 - u.ctrl).units.some((x) => x.upgrades.length) ? { kw: { Restore: 2 } } : null) });
  def('Luke Skywalker | A Hero\'s Beginning', 'card', {
    extend: true,
    async onFriendlyPlay(g, self, u) {
      if (u === self || !u.card.u || !g.P(self.ctrl).force) return;
      if (!(await may(g, self.ctrl, self, L('要使用原力，給路克經驗和護盾嗎？', 'Use the Force to give Luke an Experience and a Shield token?')))) return;
      g.P(self.ctrl).force = false;
      g.giveExp(self);
      g.giveShield(self);
    },
  });
  def('Luke Skywalker | Dreaming Farmboy', 'card', { extend: true, entersReady: (g) => g.G.round === 1 });
  def('Luke Skywalker | I Have to Face Him', 'leader', { extend: true, startingHand: 2 });
  def('Luke Skywalker | Overplaying His Hand', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以把一個敵方非領袖單位放到擁有者牌庫底', 'You may put an enemy non-leader unit on the bottom of its owner\'s deck'), (x) => x.ctrl !== u.ctrl && !g.isLeaderUnit(x), { optional: true, ctx: { harm: true } });
      if (t && toDeckBottom(g, t)) g.draw(t.owner, 2);
    },
  });
  def('Luke Skywalker | You Still With Me?', 'pilot', {
    async replaceUpDefeat(g, up, host) {
      if (!(await may(g, host.ctrl, up.card, L('要改為讓路克以單位身分移到地面區域（橫置）嗎？', 'Move Luke to the ground arena as a unit (exhausted) instead?')))) return false;
      const u = g.makeUnit({ uid: up.uid, card: up.card, owner: up.owner }, host.ctrl, { exhausted: true, arena: 'Ground' });
      g.P(host.ctrl).units.push(u);
      g.log('logNote', `${up.card.n} → Ground`);
      return true;
    },
  });
  const luthenTrig = (g, src, snap) => snap.ctrl === src.ctrl && g.G.attack && g.G.attack.attacker && g.G.attack.attacker.uid === snap.uid;
  pre('deal 1 damage to a unit or base', 'deal 2 damage to a unit or base');
  def('Luthen Rael | Don\'t You Want to Fight For Real?', 'leader', {
    extend: true,
    async onAnyDefeated(g, Ld, snap) {
      if (!luthenTrig(g, Ld, snap)) return;
      if (await exhaustLeaderMay(g, Ld)) await RUN(g, Ld.ctrl, Ld, 'deal 1 damage to a unit or base');
    },
  });
  def('Luthen Rael | Don\'t You Want to Fight For Real?', 'unit', {
    extend: true,
    async onAnyDefeated(g, self, snap) {
      if (luthenTrig(g, self, snap) && snap.uid !== self.uid) await RUN(g, self.ctrl, self, 'you may deal 2 damage to a unit or base', { self });
    },
  });
  pre('you may deal 2 damage to a unit or base');
  passive('Malakili | Keeper of the Menagerie'); // 生物獲得地下世界特徵：在引擎 hasTrait
  def('Malakili | Loving Rancor Keeper', 'card', {
    extend: true,
    costFor: (g, src, card) => (card.t === 'Unit' && g.hasTrait(card, 'CREATURE') && !(g.G.playLog || []).some((x) => x.p === src.ctrl && x.phaseId === g.G.phaseId && x.card.t === 'Unit' && g.hasTrait(x.card, 'CREATURE')) ? 1 : 0),
    preventDamage: (g, s, u, n, src) => u.ctrl === s.ctrl && g.dealerOf(src) === s.ctrl && !!((src.attacker && g.hasTrait(src.attacker, 'CREATURE')) || (!src.attacker && g.srcCard && g.hasTrait(g.srcCard, 'CREATURE'))),
  });
  def('Mandalorian Scout', 'card', {
    extend: true,
    whenDefeated(g, snap) {
      const r = g.P(snap.ctrl).resources.find((x) => !x.exhausted);
      if (r) r.exhausted = true;
    },
  });
  def('Mando\'s N-1 Starfighter | Faster than a Fathier', 'card', {
    extend: true,
    async onAttack(g, u) {
      const P = g.P(u.ctrl);
      const opts = [];
      if (!P.leader.deployed && !P.leader.exhausted) opts.push({ uid: P.leader.uid, card: P.leader.card, Ld: P.leader });
      for (const x of P.units) if (x.isLeader && !x.exhausted) opts.push({ uid: x.uid, card: x.card, x });
      if (!opts.length) return;
      const pick = await g.pickCards(u.ctrl, L('可以橫置一個友方領袖，本次攻擊 +2/+0', 'You may exhaust a friendly leader for +2/+0 this attack'), opts, 0, 1);
      if (!pick.length) return;
      if (pick[0].Ld) pick[0].Ld.exhausted = true;
      else g.exhaust(pick[0].x);
      g.buff(u, 2, 0, 'attack');
    },
  });
  passive('Marchion Ro | Eye of the Nihil'); // Raid 加倍在引擎 kw
  def('Marrok\'s Fiend Fighter | Formidable Pursuer', 'card', { extend: true, static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.G.attack.defender.damage > 0 ? { p: 2 } : null) });
  def('Mastery', 'card', { extend: true, costOnTarget: (g, p, t) => (t.card.u ? 1 : 0) });
  def('Maul | Master of the Shadow Collective', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !(atk.baseDamage > 0)) return;
      const opp = 1 - self.ctrl;
      const t = await g.pickUnit(self.ctrl, L('可以取得對手一個非領袖單位的控制權', 'You may take control of a non-leader unit that player controls'), (x) => x.ctrl === opp && !g.isLeaderUnit(x), { optional: true, ctx: { harm: true } });
      if (!t) return;
      SWU.FX2.takeControl(g, t, self.ctrl);
      (self.maulTook = self.maulTook || []).push(t.uid);
    },
    whenLeavesPlay(g, self) {
      for (const uid of self.maulTook || []) {
        const t = g.findUnit(uid);
        if (t) SWU.FX2.takeControl(g, t, t.owner);
      }
    },
  });
  def('Maul | Old Master', 'unit', {
    extend: true,
    async whenDeployed(g, u) {
      const ids = new Set((g.G.defeated || []).filter((d) => d.phaseId === g.G.phaseId).map((d) => d.uid));
      const P = g.P(u.ctrl);
      await playFromDiscard(g, u.ctrl, P.discard.filter((c) => c.card.t === 'Unit' && ids.has(c.uid) && g.canPay(u.ctrl, Math.max(0, g.costOf(u.ctrl, c.card) - 5))), u.card, { discount: 5, prompt: L('可以打出本階段被擊敗的單位（少 5 費）', 'you may play a unit defeated this phase (5 less)') });
    },
  });
  def('Max Rebo | Encore!', 'card', { extend: true, extraRegroup: true });
  def('Mayor\'s Majordomo | No Problem Groveling', 'card', {
    extend: true,
    actions: [
      {
        text: L('橫置、棄一張手牌：橫置一個單位', 'Exhaust, discard a card: exhaust a unit'),
        can: (g, u) => !u.exhausted && g.P(u.ctrl).hand.length > 0,
        async run(g, u) {
          g.exhaust(u);
          const d = await g.discardFromHand(u.ctrl, 1);
          if (!d.length) return;
          const t = await g.pickUnit(u.ctrl, L('橫置一個單位', 'Exhaust a unit'), () => true, { ctx: { harm: true } });
          if (t) g.exhaust(t);
        },
      },
    ],
  });
  def('Maz Kanata | It Calls to You', 'card', { extend: true, onResourced: (g, self) => g.giveExp(self) });
  def('Maz Kanata | Where\'s My Boyfriend?', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      const p = self.ctrl;
      const { pick, rest } = await searchDeck(g, p, 5, (c) => c.t === 'Unit' && g.hasTrait(c, 'UNDERWORLD'), self, { prompt: L('選一個地下世界單位打出（少 4 費、就緒）', 'choose an Underworld unit to play (4 less, ready)') });
      bottomRandom(g, p, rest);
      if (!pick.length) return;
      const c = pick[0];
      const cost = Math.max(0, g.costOf(p, c.card) - 4);
      if (!g.canPay(p, cost)) return bottomRandom(g, p, [c]);
      await g.playCard(p, c.uid, 'deck', { inst: c, discount: 4 });
      const u = g.findUnit(c.uid);
      if (!u) return;
      g.ready(u);
      g.delay({ at: 'regroupStart', round: g.G.round, run: (g) => { if (g.findUnit(u.uid)) toDeckBottom(g, u); } });
    },
  });
  def('Military Academy', 'card', { extend: true, baseAura: (g, up, baseP, u) => (u.ctrl === baseP ? { kw: { Overwhelm: true } } : null) });
  def('Millennium Falcon | Bucket of Bolts', 'card', {
    extend: true,
    whenPlayed(g, u) {
      if (g.P(u.ctrl).base.damage > g.P(1 - u.ctrl).base.damage) g.ready(u);
    },
  });
  const pilotsOn = (g, u) => u.upgrades.filter((x) => x.leaderPilot || x.pilot || g.hasTrait(x.card, 'PILOT')).length;
  def('Millennium Falcon | Get Out And Push', 'card', { extend: true, extraPilot: 1, static: (g, u) => (pilotsOn(g, u) ? { p: pilotsOn(g, u) } : null) });
  def('Millennium Falcon | Ya-Hoo!', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.canPay(self.ctrl, 1)) return;
      const p = self.ctrl;
      const t = await g.pickUnit(p, L('可以支付 1：把一個費用 3 以下的友方單位收回手牌', 'You may pay 1: return a friendly unit that costs 3 or less to its owner\'s hand'), (x) => x.ctrl === p && !g.isLeaderUnit(x) && (x.card.c || 0) <= 3, { optional: true });
      if (!t) return;
      g.pay(p, 1);
      g.returnToHand(t);
      if (t.owner !== p) return;
      const c = g.P(p).hand.find((x) => x.uid === t.uid);
      if (c && (await may(g, p, self, L(`要免費打出 ${N(c)} 嗎？`, `Play ${c.card.n} for free?`)))) await g.playCard(p, c.uid, 'hand', { free: true });
    },
  });
  def('Miraj Scintel | The Weak Deserve to Kneel', 'card', {
    extend: true,
    aura: (g, src, u) => (u.ctrl === src.ctrl && g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.G.attack.defender.damage > 0 ? { kw: { Overwhelm: true } } : null),
    static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.G.attack.defender.damage > 0 ? { kw: { Overwhelm: true } } : null),
  });
  def('Moff Gideon | I Know Everything', 'card', {
    extend: true,
    onDamageBase(g, u) {
      g.addNext(1 - u.ctrl, { f: (c) => c.t === 'Unit', n: -1, phaseId: g.G.phaseId, persist: true });
    },
  });
  const GIDEON_KW = ['Ambush', 'Grit', 'Hidden', 'Overwhelm', 'Saboteur', 'Sentinel', 'Shielded', 'Support'];
  def('Moff Gideon | Indomitable Warlord', 'unit', {
    extend: true,
    static(g, u) {
      const kw = {};
      for (const c of g.P(u.ctrl).discard) if (c.card.t === 'Unit' && g.hasTrait(c.card, 'IMPERIAL')) for (const k of GIDEON_KW) if ((c.card.kwp || {})[k]) kw[k] = true;
      return Object.keys(kw).length ? { kw } : null;
    },
  });
  passive('Moff Jerjerrod | We Shall Redouble Our Efforts'); // 代幣加倍在引擎 createToken/checkState
  def('Mon Cal Cruiser', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const i = await g.pickOption(p, L('蒙卡巡洋艦：選一項', 'Mon Cal Cruiser: choose one'), [L('用一個單位攻擊，本次 +2/+0', 'Attack with a unit; it gets +2/+0'), L('看對手手牌，可以棄一張，他抽一張', "Look at an opponent's hand; you may discard a card, they draw")]);
      if (i === 1) {
        const O = g.P(1 - p);
        if (!O.hand.length) return;
        await g.showCards(p, O.hand, L('對手的手牌', "Opponent's hand"));
        if (await SWU.FX2.discardFrom(g, p, 1 - p, O.hand, true, u.card)) g.draw(1 - p, 1);
        return;
      }
      const t = await g.pickUnit(p, L('選一個單位攻擊', 'Choose a unit to attack with'), (x) => x.ctrl === p && g.canAttackWith(x), { optional: true });
      if (t) await g.attack(t, { power: 2 });
    },
  });
  const monNoPen = (g, src, card) => card.t === 'Unit' && g.hasTrait(card, 'OFFICIAL') && !(card.a || []).includes('Villainy');
  const monAura = (g, src, u) => (u !== src && u.ctrl === src.ctrl && g.hasTrait(u, 'OFFICIAL') ? { h: 1 } : null);
  def('Mon Mothma | Forming a Coalition', 'leader', { extend: true, ignorePenalty: monNoPen, aura: monAura });
  def('Mon Mothma | Forming a Coalition', 'unit', { ignorePenalty: monNoPen, aura: monAura });
  def('Morgan Elsbeth | Following the Call', 'unit', {
    extend: true,
    onAttack(g, u) {
      const p = u.ctrl;
      g.addNext(p, { f: (c) => c.t === 'Unit' && Object.keys(c.kwp || {}).some((k) => g.P(p).units.some((x) => g.kw(x)[k])), n: 1, phaseId: g.G.phaseId });
    },
  });
  def('Mother Talzin | The Time Has Come', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const c = await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.card.t === 'Unit' && (c.card.a || []).includes('Villainy') && (c.card.c || 0) <= 4), u.card, { free: true });
      if (c && !g.hasTrait(c.card || c, 'NIGHT') && !g.hasTrait(c.card || c, 'UNDEAD') && g.findUnit(u.uid)) await g.damageUnit(u, (c.card || c).c || 0, { p });
    },
  });
  def('Mouse Droid', 'card', { extend: true, whenPlayed: (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit' && g.hasTrait(c, 'IMPERIAL'), n: 1, phaseId: g.G.phaseId }) });
  def('Muckraker Crab Droid', 'card', { extend: true, cantBeAttackedBy: (g, u) => !u.exhausted });
  passive('Mythosaur | Folklore Awakened'); // 在引擎 exhaust／returnToHand／hasTrait
  def('Nabat Village | Ryloth', 'card', {
    startingHand: 3,
    noMulligan: true,
    async onActionPhaseStart(g, base) {
      if (g.G.round !== 1) return;
      const P = g.P(base.ctrl);
      const n = Math.min(3, P.hand.length);
      const pick = await g.pickCards(base.ctrl, L('納巴特村：把 3 張手牌依序放到牌庫底', 'Nabat Village: put 3 cards from your hand on the bottom of your deck'), P.hand, n, n);
      for (const c of pick) {
        P.hand = P.hand.filter((x) => x !== c);
        P.deck.push(c);
      }
    },
  });
  def('Nameless Terror', 'card', {
    extend: true,
    onAttack(g, u) {
      for (const x of g.P(1 - u.ctrl).units) x.noForcePhase = g.G.phaseId;
    },
  });
  def('Nebula Ignition', 'card', {
    async event(g) {
      for (const u of g.allUnits().filter((x) => !x.upgrades.length)) await g.defeat(u, {});
    },
  });
  SWU.TRAIT_GRANT.add('Nemik\'s Manifesto');
  def('Nemik\'s Manifesto', 'card', {
    grantTrait: () => ['REBEL'],
    grantFor: (g, up, host) => ({
      whenDefeated(g, snap) {
        const n = g.P(snap.ctrl).units.filter((x) => x.uid !== snap.uid && g.hasTrait(x, 'REBEL')).length;
        if (n) g.damageBase(1 - snap.ctrl, n, { p: snap.ctrl });
      },
    }),
  });
  const pilotCount = (g, p, exceptUid) => {
    let n = 0;
    for (const u of g.P(p).units) {
      if (u.uid !== exceptUid && g.hasTrait(u, 'PILOT')) n++;
      for (const x of u.upgrades) if (x.uid !== exceptUid && (x.pilot || x.leaderPilot || g.hasTrait(x.card, 'PILOT'))) n++;
    }
    return n;
  };
  def('Nien Nunb | Loyal Co-Pilot', 'card', { static: (g, u) => ({ p: pilotCount(g, u.ctrl, u.uid) }) });
  def('Nien Nunb | Loyal Co-Pilot', 'pilot', { attachedStatic: (g, up, u) => ({ p: pilotCount(g, u.ctrl, up.uid) }) });
  def('Nightbrother | Maul\'s Gauntlet', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const r = await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.card.t === 'Unit'), u.card, { discount: 3, ready: true, prompt: L('可以打出棄牌堆的一個單位（少 3 費、就緒）', 'you may play a unit from your discard pile (3 less, ready)') });
      if (r && r.uid && g.findUnit(r.uid)) g.delay({ at: 'regroupStart', round: g.G.round, run: async (g) => { const x = g.findUnit(r.uid); if (x) await g.defeat(x, {}); } });
    },
  });
  def('No Disintegrations', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('對一個非領袖單位造成（剩餘生命 − 1）點傷害', 'Deal damage equal to 1 less than its remaining HP to a non-leader unit'), (x) => !g.isLeaderUnit(x), { ctx: { harm: true } });
      if (t) await g.damageUnit(t, g.remaining(t) - 1, { p });
    },
  });
  def('Noxious Refinery', 'card', {
    baseGains: {
      async onRegroupStart(g, base) {
        const P = g.P(base.ctrl);
        if (!P.deck.length) return;
        g.revealCards(base.ctrl, [P.deck[0]], 'reveal');
        if ((P.deck[0].card.a || []).includes('Aggression')) await RUN(g, base.ctrl, { card: cardOf('Noxious Refinery') }, 'deal 1 damage to an enemy unit');
      },
    },
  });
  pre('deal 1 damage to an enemy unit');
  def('Numa | Still Fighting', 'card', { extend: true, modDamage: (g, u, n) => n - 1 });
  def('Obi-Wan Kenobi | Finding What Doesn\'t Exist', 'card', {
    extend: true,
    onDamageBase(g, u) {
      const o = 1 - u.ctrl;
      const out = mill(g, o, 1);
      if (out.length) (g.G.oppFreePlay = g.G.oppFreePlay || []).push({ uid: out[0].uid, owner: o, for: u.ctrl, phaseId: g.G.phaseId, paid: true, ignoreAspect: true });
    },
  });
  passive('Obi-Wan Kenobi | Protector of Felucia'); // 在引擎 basePower/hp
  def('Oggdo Bogdo | Bogano Brute', 'card', { extend: true, cantAttack: (g, u) => u.damage <= 0 });
  def('Old Daka | Oldest and Wisest', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const t = await g.pickUnit(p, L('可以擊敗一個名字不是老達卡的友方夜之單位', 'You may defeat a friendly Night unit not named Old Daka'), (x) => x.ctrl === p && g.hasTrait(x, 'NIGHT') && x.card.n !== 'Old Daka', { optional: true });
      if (!t) return;
      const uid = t.uid;
      await g.defeat(t, { self: true });
      await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.uid === uid), u.card, { free: true });
    },
  });
  def('Omega | Close Your Eyes and Focus', 'unit', { extend: true, aura: (g, src, u) => (u !== src && u.ctrl === src.ctrl && (u.card.a || []).includes('Heroism') ? { kw: { Grit: true } } : null) });
  def('One Must Destroy to Create', 'card', {
    async event(g, p, inst) {
      const t = await g.pickUnit(p, L('擊敗一個友方非領袖單位', 'Defeat a friendly non-leader unit'), (x) => x.ctrl === p && !g.isLeaderUnit(x), {});
      if (!t) return;
      const uid = t.uid;
      await g.defeat(t, { self: true });
      await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.uid === uid), inst.card, { free: true });
    },
  });
  def('One in a Million', 'card', {
    canPlay: (g, p, from) => from && from !== 'hand',
    async event(g, p) {
      const n = g.readyResources(p);
      const t = await g.pickUnit(p, L(`擊敗一個戰力與剩餘生命都等於 ${n} 的單位`, `Defeat a unit with power and remaining HP both equal to ${n}`), (x) => g.power(x) === n && g.remaining(x) === n, { ctx: { harm: true } });
      if (t) await g.defeat(t, {});
    },
  });
  const OPPO_KW = ['Ambush', 'Grit', 'Hidden', 'Overwhelm', 'Saboteur', 'Sentinel', 'Shielded'];
  let oppoBusy = false;
  def('Oppo Rancisis | Ancient Councilor', 'card', {
    static(g, u) {
      if (oppoBusy) return null;
      oppoBusy = true;
      try {
        const kw = {};
        for (const x of g.P(u.ctrl).units) {
          if (x === u) continue;
          const k = g.kw(x);
          for (const n of OPPO_KW) if (k[n]) kw[n] = true;
          if (k.Raid) kw.Raid = 2;
          if (k.Restore) kw.Restore = 2;
        }
        return { kw };
      } finally {
        oppoBusy = false;
      }
    },
  });
  def('Orn Free Taa | Political Power Broker', 'card', {
    static: (g, u) => ({ p: g.P(u.ctrl).discard.filter((c) => g.hasTrait(c.card, 'LAW')).length }),
    async whenPlayed(g, u) {
      const { pick, rest } = await searchDeck(g, u.ctrl, 10, (c) => g.hasTrait(c, 'LAW'), u, { prompt: L('選一張法律卡加入手牌', 'choose a Law card to draw') });
      bottomRandom(g, u.ctrl, rest);
      if (pick.length) g.P(u.ctrl).hand.push(pick[0]);
    },
  });
  async function oshaPlay(g, p, card) {
    const P = g.P(p);
    const ok = P.resources.filter((r) => r.card.t === 'Unit' && (r.card.a || []).includes('Villainy') && g.canPay(p, g.costOf(p, r.card, { ignoreAsp: ['Villainy', 'Villainy'] })));
    if (!ok.length) return false;
    const pick = await g.pickCards(p, L('從資源區打出一個邪惡單位（忽略邪惡面向懲罰）', 'Play a Villainy unit from your resources (ignoring Villainy penalties)'), ok, 0, 1);
    if (!pick.length) return false;
    await g.playCard(p, pick[0].uid, 'resource', { ignoreAsp: ['Villainy', 'Villainy'] });
    if (!P.hand.length) return true;
    const r = await g.pickCards(p, L('可以把一張手牌放成資源', 'You may resource a card from your hand'), P.hand, 0, 1);
    for (const c of r) {
      P.hand = P.hand.filter((x) => x !== c);
      P.resources.push({ ...c, exhausted: true });
      await g.fire(p, 'onResourced', c);
    }
    return true;
  }
  const oshaHasTarget = (g, p) => g.P(p).resources.some((r) => r.card.t === 'Unit' && (r.card.a || []).includes('Villainy'));
  def('Osha | Haunted by Her Past', 'leader', {
    actions: [
      {
        text: L('若本階段有友方英雄單位被擊敗：從資源區打出一個邪惡單位', 'If a friendly Heroism unit was defeated this phase: play a Villainy unit from your resources'),
        can: (g, Ld) => !Ld.exhausted && oshaHasTarget(g, Ld.ctrl) && (g.G.defeated || []).some((d) => d.ctrl === Ld.ctrl && d.phaseId === g.G.phaseId && (d.card.a || []).includes('Heroism')),
        async run(g, Ld) {
          Ld.exhausted = true;
          await oshaPlay(g, Ld.ctrl, Ld.card);
        },
      },
    ],
  });
  def('Osha | Haunted by Her Past', 'unit', {
    actions: [
      {
        text: L('從資源區打出一個邪惡單位（忽略邪惡面向懲罰）', 'Play a Villainy unit from your resources'),
        can: (g, u) => oshaHasTarget(g, u.ctrl),
        run: (g, u) => oshaPlay(g, u.ctrl, u.card),
      },
    ],
  });
  def('Outcast | Mercenary Starship', 'card', { extend: true, onFriendlyPlay: (g, self, u) => g.buff(u, 1, 0, 'phase') });
  def('Pack Guardian', 'card', { extend: true, static: (g, u) => (!u.exhausted ? { kw: { Sentinel: true } } : null) });
  const padmeTrig = (g, src, ev) => ev.type === 'handOut' && ev.p === src.ctrl && src.padmeBatch !== ev.batch;
  def('Padmé Amidala | What Do You Have to Hide?', 'leader', {
    extend: true,
    async onEvent(g, Ld, ev) {
      if (!padmeTrig(g, Ld, ev)) return;
      Ld.padmeBatch = ev.batch;
      if (await exhaustLeaderMay(g, Ld)) await RUN(g, Ld.ctrl, Ld, 'deal 1 damage to a unit');
    },
  });
  def('Padmé Amidala | What Do You Have to Hide?', 'unit', {
    extend: true,
    async onEvent(g, self, ev) {
      if (!padmeTrig(g, self, ev)) return;
      self.padmeBatch = ev.batch;
      await RUN(g, self.ctrl, self, 'you may deal 1 damage to a unit', { self });
    },
  });
  pre('deal 1 damage to a unit');
  def('Pantoran Starship Thief', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      if (!g.canPay(p, 3)) return;
      const hosts = g.allUnits().filter((x) => x !== u && (g.hasTrait(x, 'FIGHTER') || g.hasTrait(x, 'TRANSPORT')) && !hasPilot(g, x));
      if (!hosts.length) return;
      const t = await g.pickUnit(p, L('可以支付 3：裝到一個沒有駕駛員的戰機或運輸艦上，並取得它的控制權', 'You may pay 3: attach to a Fighter or Transport without a Pilot and take control of it'), (x) => hosts.includes(x), { optional: true });
      if (!t) return;
      g.pay(p, 3);
      const up = makePilotUpgrade(g, t, u);
      up.thief = p;
      if (t.ctrl !== p) SWU.FX2.takeControl(g, t, p);
    },
  });
  def('Pantoran Starship Thief', 'pilot', {
    // 「這張升級離開單位時：那個單位的擁有者取回控制權」
    upWhenDefeated(g, up, host) {
      const h = g.findUnit(host.uid);
      if (h && h.ctrl !== h.owner) SWU.FX2.takeControl(g, h, h.owner);
    },
  });
  def('Patient Hunter', 'card', {
    extend: true,
    async onRegroupStart(g, self) {
      const t = await g.pickUnit(self.ctrl, L('可以給一個非領袖單位經驗代幣（它這個重整階段不能重置）', 'You may give an Experience token to a non-leader unit (it can\'t ready this regroup phase)'), (x) => !g.isLeaderUnit(x), { optional: true });
      if (!t) return;
      g.giveExp(t);
      t.skipRegroupReady = g.G.round;
    },
  });
  def('Paz Vizsla | Unyielding Warrior', 'card', { extend: true, static: (g, u) => (u.damage ? { p: 2 * u.damage } : null) });
  def('Peli Motto | You Bring the Cash?', 'card', {
    extend: true,
    ignorePenalty: (g, src, card) => card.t !== 'Unit' && !(g.G.playLog || []).some((x) => x.p === src.ctrl && x.phaseId === g.G.phaseId && x.card.t !== 'Unit'),
  });
  def('Phantom II | Modified to Dock', 'card', {
    extend: true,
    actions: [
      {
        text: L('支付 1：裝到 The Ghost 上成為升級', 'Pay 1: attach it as an upgrade to The Ghost'),
        can: (g, u) => g.canPay(u.ctrl, 1) && g.P(u.ctrl).units.some((x) => x.card.n === 'The Ghost'),
        async run(g, u) {
          const t = await g.pickUnit(u.ctrl, L('裝到哪個 The Ghost', 'Attach to which The Ghost'), (x) => x.ctrl === u.ctrl && x.card.n === 'The Ghost', {});
          if (!t) return;
          g.pay(u.ctrl, 1);
          const P = g.P(u.ctrl);
          P.units = P.units.filter((x) => x !== u);
          for (const up of u.upgrades) g.dropUpgrade(up, u);
          t.upgrades.push({ uid: u.uid, card: u.card, owner: u.owner });
          g.log('logAttach', u.card.n, t.card.n);
        },
      },
    ],
  });
  def('Phee Genoa | Liberator of Ancient Wonders', 'card', {
    extend: true,
    async onEnemyLeaderDeployed(g, self, u) {
      const q = u.ctrl;
      if (g.canPay(q, 2) && (await g.yesno(q, L('菲吉諾亞：要支付 2 嗎？（否則橫置你的領袖）', 'Phee Genoa: pay 2? (otherwise exhaust your leader)'), {}))) g.pay(q, 2);
      else g.exhaust(u);
    },
  });
  def('Pit Droid Team', 'card', {
    extend: true,
    upgradeCostOn: (g, self, card, t) => (t !== self && t.ctrl === self.ctrl && self.pdPhase !== g.G.phaseId ? ((self.pdPhase = g.G.phaseId), 1) : 0),
  });
  def('Plo Koon | I Don\'t Believe in Chance', 'card', { extend: true, static: (g, u) => (g.P(u.ctrl).force ? { kw: { Grit: true } } : null) });
  def('Poe Dameron | I Can Fly Anything', 'leader', {
    actions: [
      {
        text: L('支付 1、橫置：翻面並當駕駛員裝到友方載具上', 'Pay 1, exhaust: flip and attach as a Pilot to a friendly Vehicle'),
        can: (g, Ld) => !Ld.exhausted && !Ld.deployed && !Ld.epicUsed && g.canPay(Ld.ctrl, 1) && g.pilotHosts(Ld.ctrl).length > 0,
        async run(g, Ld) {
          g.pay(Ld.ctrl, 1);
          Ld.exhausted = true;
          await g.deployLeader(Ld.ctrl, { pilot: true, free: true });
        },
      },
    ],
  });
  def('Poe Dameron | I Can Fly Anything', 'unit', {
    extend: true,
    grantFor: (g, up, host) =>
      up.leaderPilot
        ? {
            actions: [
              {
                text: L('支付 1：把波移到另一個沒有駕駛員的友方載具（每回合一次）', 'Pay 1: attach Poe to another friendly Vehicle without a Pilot (once per round)'),
                can: (g, u) => up.poeRound !== g.G.round && g.canPay(u.ctrl, 1) && g.pilotHosts(u.ctrl).some((x) => x !== host),
                async run(g, u) {
                  const t = await g.pickUnit(u.ctrl, L('移到哪個載具', 'Attach to which Vehicle'), (x) => x !== host && g.pilotHosts(u.ctrl).includes(x), {});
                  if (!t) return;
                  g.pay(u.ctrl, 1);
                  up.poeRound = g.G.round;
                  host.upgrades = host.upgrades.filter((x) => x !== up);
                  t.upgrades.push(up);
                  g.log('logAttach', up.card.n, t.card.n);
                },
              },
            ],
          }
        : null,
  });
  SWU.AURA_LOSEKW.add('Poe Dameron');
  def('Poe Dameron | I\'ll Come Back For You', 'card', { extend: true, auraLoseKw: () => ['Sentinel'], loseKw: () => ['Sentinel'] });
  def('Poggle the Lesser | Secret Designs', 'card', {
    extend: true,
    async onAttack(g, u) {
      const p = u.ctrl;
      if (!g.canPay(p, 1) || !g.P(p).hand.length) return;
      if (!(await may(g, p, u, L('要支付 1 並棄一張手牌，讓下一張卡少 3 費嗎？', 'Pay 1 and discard a card so the next card you play costs 3 less?')))) return;
      g.pay(p, 1);
      const d = await g.discardFromHand(p, 1);
      if (d.length) g.addNext(p, { n: 3, phaseId: g.G.phaseId });
    },
  });
  def('Pointless to Resist', 'card', { grantFor: () => ({ static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.base ? { p: -3 } : null) }) });
  def('Populist Advisor', 'card', {
    extend: true,
    onEvent(g, self, ev) {
      if (ev.type === 'damage' && ev.base === self.ctrl && ev.combat && ev.by !== self.ctrl && g.findUnit(self.uid)) g.buff(self, 0, 0, 'phase', { Sentinel: true });
    },
  });
  def('Power from Pain', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('選一個單位：每有 1 點傷害 +1/+0', 'Choose a unit: +1/+0 for each damage on it'), () => true, {});
      if (t && t.damage) g.buff(t, t.damage, 0, 'phase');
    },
  });
  def('Premonition of Doom', 'card', {
    event(g, p) {
      g.delay({ at: 'takeInit', p, phaseId: g.G.phaseId, run: (g) => { for (const u of g.allUnits()) g.exhaust(u); } });
    },
  });
  async function purrgil(g, u, p) {
    const t = await g.pickUnit(p, L('可以把另一個友方非領袖單位收回手牌，並造成等同其費用的傷害', 'You may return another friendly non-leader unit to hand and deal damage equal to its cost'), (x) => x.ctrl === p && x.uid !== u.uid && !g.isLeaderUnit(x), { optional: true });
    if (!t) return;
    const c = t.card.c || 0;
    g.returnToHand(t);
    if (g.findUnit(t.uid)) return;
    const e = await g.pickUnit(p, L(`對一個單位造成 ${c} 點傷害`, `Deal ${c} damage to a unit`), () => true, { ctx: { harm: true, op: 'damage', n: c } });
    if (e) await g.damageUnit(e, c, { p });
  }
  def('Purrgil Ultra', 'card', { whenPlayed: (g, u) => purrgil(g, u, u.ctrl), whenDefeated: (g, snap) => purrgil(g, snap, snap.ctrl) });
  def('Qi\'ra | Survivor', 'card', {
    extend: true,
    async whenDefeated(g, snap) {
      const n = snap.upgrades.filter((x) => x.card.n === 'Experience').length;
      if (!n) return;
      const t = await g.pickUnit(snap.ctrl, L(`可以給一個單位 ${n} 個經驗代幣`, `You may give ${n} Experience tokens to a unit`), () => true, { optional: true });
      if (t) g.giveExp(t, n);
    },
  });
  def('Queen Amidala | Retaking Theed', 'card', { extend: true, costMod: (g, p) => (g.P(p).base.upgrades.length ? -2 : 0) });
  async function quiGon(g, p, card) {
    const t = await g.pickUnit(p, L('把一個友方非領袖單位收回手牌', 'Return a friendly non-leader unit to its owner\'s hand'), (x) => x.ctrl === p && !g.isLeaderUnit(x), {});
    if (!t) return;
    const c = t.card.c || 0;
    g.returnToHand(t);
    const ok = g.P(p).hand.filter((x) => x.card.t === 'Unit' && !(x.card.a || []).includes('Villainy') && (x.card.c || 0) < c && x.uid !== t.uid);
    if (!ok.length) return;
    const pick = await g.pickCards(p, L('免費打出一張費用較低的非邪惡單位', 'Play a non-Villainy unit that costs less for free'), ok, 1, 1);
    if (pick.length) await g.playCard(p, pick[0].uid, 'hand', { free: true });
  }
  def('Qui-Gon Jinn | Student of the Living Force', 'leader', {
    actions: [
      {
        text: L('橫置、使用原力：收回友方單位，免費打出較便宜的非邪惡單位', 'Exhaust, use the Force: return a friendly unit, play a cheaper non-Villainy unit for free'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).force && g.P(Ld.ctrl).units.some((x) => !g.isLeaderUnit(x)),
        async run(g, Ld) {
          Ld.exhausted = true;
          g.P(Ld.ctrl).force = false;
          await quiGon(g, Ld.ctrl, Ld.card);
        },
      },
    ],
  });
  def('Qui-Gon Jinn | Student of the Living Force', 'unit', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      if (!g.P(self.ctrl).units.some((x) => !g.isLeaderUnit(x))) return;
      if (await may(g, self.ctrl, self, L('要收回一個友方非領袖單位並免費打出較便宜的非邪惡單位嗎？', 'Return a friendly non-leader unit and play a cheaper non-Villainy unit for free?'))) await quiGon(g, self.ctrl, self.card);
    },
  });
  def('Qui-Gon Jinn\'s Aethersprite | Guided by the Force', 'card', {
    extend: true,
    onAttack(g, u) {
      (g.G.aether = g.G.aether || []).push({ p: u.ctrl, phaseId: g.G.phaseId });
    },
    async onUsedWhenPlayed(g, self, u, again) {
      const A = g.G.aether || [];
      const i = A.findIndex((x) => x.p === self.ctrl && x.phaseId === g.G.phaseId);
      if (i < 0) return;
      A.splice(i, 1);
      if (await may(g, self.ctrl, self, L(`要再使用一次 ${N(u)} 的「打出時」能力嗎？`, `Use ${u.card.n}'s When Played ability again?`))) await again();
    },
  });
  def('R2-D2 | Artooooooooo!', 'pilot', { grantFor: () => ({ extraPilot: 1 }) });
  async function r2Look(g, u) {
    const P = g.P(u.ctrl);
    if (!P.deck.length) return;
    await g.showCards(u.ctrl, [P.deck[0]], L('牌庫頂', 'Top of your deck'));
    if (await may(g, u.ctrl, u, L('要把它放到牌庫底嗎？', 'Put it on the bottom of your deck?'))) P.deck.push(P.deck.shift());
  }
  def('R2-D2 | Ignoring Protocol', 'card', { whenPlayed: r2Look, onAttack: r2Look });
  def('Raddus | Holdo\'s Final Command', 'card', {
    extend: true,
    static(g, u) {
      const P = g.P(u.ctrl);
      const res = (c) => g.hasTrait(c, 'RESISTANCE');
      const ok = res(P.leader.card) || P.units.some((x) => (x !== u && res(x)) || x.upgrades.some((y) => res(y.card)));
      return ok ? { kw: { Sentinel: true } } : null;
    },
  });
  def('Raddus | Hope of the Resistance', 'card', { extend: true, oppCostAdd: (g, u) => (u.exhausted ? 3 : 0) });
  def('Radiant VII | Ambassadors\' Arrival', 'card', { extend: true, aura: (g, src, u) => (u.ctrl !== src.ctrl && !g.isLeaderUnit(u) && u.damage ? { p: -u.damage } : null) });
  def('Rampart | Enjoy the Exit', 'card', { extend: true, noRegroupReady: (g, u) => g.power(u) < 4 });
  def('Rancor Keeper', 'card', {
    extend: true,
    async onFriendlyDamaged(g, self, ev) {
      if (self.rkRound === g.G.round || !g.findUnit(ev.u.uid) || !g.findUnit(self.uid)) return;
      self.rkRound = g.G.round;
      for (const b of [1 - self.ctrl, self.ctrl]) {
        const i = await g.pickOption(self.ctrl, L(`對${b === self.ctrl ? '自己' : '對手'}的基地造成 1 點傷害？`, `Deal 1 damage to ${b === self.ctrl ? 'your' : "the opponent's"} base?`), [L('是', 'Yes'), L('否', 'No')], { ctx: { aiPick: b === self.ctrl ? 1 : 0 } });
        if (i === 0) g.damageBase(b, 1, { p: self.ctrl });
      }
    },
  });
  def('Raze to Ruin', 'card', {
    async event(g, p) {
      for (const q of [p, 1 - p]) {
        const P = g.P(q);
        const n = P.hand.length - 3;
        if (n <= 0) continue;
        const pick = await g.pickCards(q, L(`棄到剩 3 張手牌（棄 ${n} 張）`, `Discard down to 3 cards (discard ${n})`), P.hand, n, n);
        for (const c of pick) {
          P.hand = P.hand.filter((x) => x !== c);
          P.discard.push(c);
          g.log('logDiscard', P.name, c.card.n);
          g.noteHandDiscard(q, c);
        }
      }
    },
  });
  async function razorRide(g, self) {
    const t = await g.pickUnit(self.ctrl, L('可以把費用 2 以下的非領袖單位或費用 4 以下且橫置的非領袖單位收回手牌', 'You may return a non-leader unit that costs 2 or less, or an exhausted one that costs 4 or less'), (x) => !g.isLeaderUnit(x) && ((x.card.c || 0) <= 2 || (x.exhausted && (x.card.c || 0) <= 4)), { optional: true, ctx: { harm: true } });
    if (t) g.returnToHand(t);
  }
  def('Razor Crest | Ride For Hire', 'card', {
    extend: true,
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t === self && (up.pilot || up.leaderPilot || g.hasTrait(up.card, 'PILOT'))) await razorRide(g, self);
    },
    async onLeaderDeployed(g, self, x) {
      if (x === self) await razorRide(g, self);
    },
  });
  passive('Razor Crest | Stay Off the Ice'); // 在引擎 defeat
})();
