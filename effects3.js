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
  const mill = (g, p, n) => g.mill(p, n);
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
    whenPlayed(g, u) {
      if ((g.G.playLog || []).some((x) => x.uid === u.uid && x.from === 'hand' && x.phaseId === g.G.phaseId)) SWU.FX2.takeControl(g, u, 1 - u.ctrl);
    },
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
      g.useForce(p);
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
      g.useForce(self.ctrl);
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
          g.useForce(Ld.ctrl);
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

  // ===================== 第 4 批 =====================
  const baseAt = (g, p, loc) => (g.P(p).base.card.s || '') === loc;
  const pilotsFriendly = (g, p) => pilotCount(g, p, -1);
  const chooseArena = async (g, p, card, aiPick = 0) => ((await g.pickOption(p, L(`${N(card)}：選擇一個區域`, `${card.n}: choose an arena`), [L('地面', 'Ground'), L('太空', 'Space')], { ctx: { aiPick } })) === 1 ? 'Space' : 'Ground');
  const isPilotUp = (g, up) => up.pilot || up.leaderPilot || g.hasTrait(up.card, 'PILOT');
  def('Rebel Operation', 'card', {
    costMod: (g, p) => -(g.P(p).units.filter((u) => g.hasTrait(u, 'REBEL')).length + (g.hasTrait(g.P(p).leader.card, 'REBEL') && !g.P(p).leader.deployed ? 1 : 0)),
    event: (g, p) => g.draw(p, 2),
  });
  def('Reckoning', 'card', {
    async event(g, p) {
      const n = g.P(p).units.reduce((a, u) => a + u.damage, 0);
      const t = await g.pickUnit(p, L(`對一個單位造成 ${n} 點傷害`, `Deal ${n} damage to a unit`), () => true, { ctx: { harm: true, op: 'damage', n } });
      if (t && n) await g.damageUnit(t, n, { p });
    },
  });
  async function redLeaderXW(g, self) {
    g.createToken(self.ctrl, 'X-Wing');
  }
  def('Red Leader | Form Up', 'card', {
    costMod: (g, p) => -pilotsFriendly(g, p),
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t === self && isPilotUp(g, up)) await redLeaderXW(g, self);
    },
    async onLeaderDeployed(g, self, x) {
      if (x === self) await redLeaderXW(g, self);
    },
  });
  def('Red Leader | Strike the Reactor', 'card', { extend: true, attackArenas: () => ['Ground', 'Space'] });
  def('Reforge', 'card', {
    async event(g, p) {
      const ups = [];
      for (const u of g.P(p).units) for (const up of u.upgrades) if (!up.leaderPilot) ups.push({ uid: up.uid, card: up.card, host: u, up });
      if (!ups.length) return;
      const pk = await g.pickCards(p, L('擊敗友方單位身上的一張升級', 'Defeat an upgrade on a friendly unit'), ups, 1, 1);
      if (!pk.length) return;
      const { host, up } = pk[0];
      g.removeUpgrade(host, up);
      const { pick, rest } = await searchDeck(g, p, 8, (c) => c.t === 'Upgrade' && g.upgradeTargets(p, c).includes(host), { card: cardOf('Reforge') }, { prompt: L('選一張能裝到那個單位的升級（少 4 費）', 'choose an upgrade for that unit (4 less)') });
      bottomRandom(g, p, rest);
      if (!pick.length || !g.findUnit(host.uid)) return pick.length && bottomRandom(g, p, pick);
      const c = pick[0];
      if (!g.canPay(p, Math.max(0, g.costOf(p, c.card) - 4))) return bottomRandom(g, p, [c]);
      await g.playCard(p, c.uid, 'deck', { inst: c, discount: 4, target: host });
    },
  });
  def('Regulations Bureaucrat', 'card', {
    extend: true,
    actions: [
      {
        text: L('橫置：橫置一個資源', 'Exhaust: exhaust a resource'),
        can: (g, u) => !u.exhausted,
        async run(g, u) {
          g.exhaust(u);
          const rs = [...g.P(1 - u.ctrl).resources.filter((r) => !r.exhausted), ...g.P(u.ctrl).resources.filter((r) => !r.exhausted)];
          if (!rs.length) return;
          const pk = await g.pickCards(u.ctrl, L('橫置一個資源', 'Exhaust a resource'), rs, 1, 1);
          if (pk.length) pk[0].exhausted = true;
        },
      },
    ],
  });
  def('Resistance X-Wing', 'card', { extend: true, static: (g, u) => (pilotsOn(g, u) ? { p: 1, h: 1 } : null) });
  def('Retrofitted Airspeeder', 'card', {
    extend: true,
    attackArenas: () => ['Space'],
    static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.G.attack.defender.arena === 'Space' ? { p: -1 } : null),
  });
  const noAbilities = (g, u) => g.isBlank(u) || (!(u.card.tx || '').trim() && !Object.keys(u.card.kwp || {}).length);
  def('Rex | Outserved His Purpose', 'card', { extend: true, aura: (g, src, u) => (u.ctrl === src.ctrl && noAbilities(g, u) ? { p: 1, h: 1 } : null) });
  def('Rey | Nobody', 'unit', {
    extend: true,
    async whenDeployed(g, u) {
      const P = g.P(u.ctrl);
      if (!(await may(g, u.ctrl, u, L('要棄掉所有手牌，然後抽 2 張嗎？', 'Discard your hand, then draw 2 cards?')))) return;
      for (const c of [...P.hand]) {
        P.hand = P.hand.filter((x) => x !== c);
        P.discard.push(c);
        g.noteHandDiscard(u.ctrl, c);
      }
      g.draw(u.ctrl, 2);
    },
  });
  SWU.DRAW_TRIG.add('Rey | With Palpatine\'s Power');
  def('Rey | With Palpatine\'s Power', 'card', {
    extend: true,
    async whenDrawn(g, c, p) {
      const P = g.P(p);
      if (!(P.leader.card.a || []).includes('Aggression') && !(P.base.card.a || []).includes('Aggression')) return;
      if (!(await may(g, p, c.card, L('要展示這張卡，對一個單位和一個基地各造成 2 點傷害嗎？', 'Reveal this card to deal 2 damage to a unit and 2 damage to a base?')))) return;
      g.revealCards(p, [c], 'reveal');
      const t = await g.pickUnit(p, L('對一個單位造成 2 點傷害', 'Deal 2 damage to a unit'), () => true, { ctx: { harm: true, op: 'damage', n: 2 } });
      if (t) await g.damageUnit(t, 2, { p });
      const b = await g.pickTarget(p, L('對一個基地造成 2 點傷害', 'Deal 2 damage to a base'), { bases: [1 - p, p], ctx: { harm: true } });
      if (b && b.base != null) g.damageBase(b.base, 2, { p });
    },
  });
  def('Rhydonium Detonation', 'card', {
    async event(g, p) {
      for (const q of [p, 1 - p]) {
        const t = await g.pickUnit(q, L('可以把一個非領袖單位收回擁有者手牌', 'You may return a non-leader unit to its owner\'s hand'), (x) => !g.isLeaderUnit(x) && x.ctrl === q, { optional: true });
        if (t) g.returnToHand(t);
      }
      for (const u of g.allUnits().filter((x) => !g.isLeaderUnit(x))) await g.defeat(u, {});
    },
  });
  def('Ritual Dragon', 'card', { extend: true, entersReady: (g, inst, p) => baseAt(g, p, 'Tatooine'), friendlyEntersReady: (g, src) => baseAt(g, src.ctrl, 'Tatooine') });
  def('Rose Tico | Now it\'s Worth It', 'card', { extend: true, entersReady: (g, inst, p) => g.P(p).units.some((u) => !u.card.u) });
  def('Ryyk Blademaster', 'card', { static: (g, u) => (g.P(u.ctrl).resources.length >= 6 ? { kw: { Ambush: true, Overwhelm: true } } : null) });
  const nextShielded = (g, p) => g.addNext(p, { f: (c) => c.t === 'Unit', kw: { Shielded: true }, phaseId: g.G.phaseId });
  def('Sabine Wren | Bargaining on Belief', 'leader', {
    actions: [
      {
        text: L('對手給他的一個單位 2 個優勢代幣；若他這麼做，你下一個單位獲得 Shielded', 'An opponent gives 2 Advantage tokens to a unit they control; if they do, your next unit gains Shielded'),
        can: (g, Ld) => !Ld.exhausted,
        async run(g, Ld) {
          Ld.exhausted = true;
          const o = 1 - Ld.ctrl;
          if (!g.P(o).units.length) return;
          const t = await g.pickUnit(o, L('可以給你的一個單位 2 個優勢代幣（對手下一個單位會獲得 Shielded）', 'You may give 2 Advantage tokens to a unit you control (the opponent\'s next unit gains Shielded)'), (x) => x.ctrl === o, { optional: true });
          if (!t) return;
          g.giveToken(t, 'Advantage');
          g.giveToken(t, 'Advantage');
          nextShielded(g, Ld.ctrl);
        },
      },
    ],
  });
  def('Sabine Wren | Bargaining on Belief', 'unit', { extend: true, onAttack: (g, u) => nextShielded(g, u.ctrl) });
  def('Sabine Wren | I Learned the Hard Way', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'attach' || ev.u !== self || self.sabBatch === ev.batch || !g.findUnit(self.uid)) return;
      self.sabBatch = ev.batch;
      const t = await g.pickUnit(self.ctrl, L('可以橫置一個地面單位', 'You may exhaust a ground unit'), (x) => x.arena === 'Ground', { optional: true, ctx: { harm: true } });
      if (t) g.exhaust(t);
    },
  });
  def('Sabé | Queen\'s Shadow', 'leader', {
    extend: true,
    async onEvent(g, Ld, ev) {
      if (ev.type !== 'damage' || !ev.combat || ev.base == null || ev.base === Ld.ctrl || ev.by !== Ld.ctrl) return;
      if (!(await exhaustLeaderMay(g, Ld))) return;
      const O = g.P(ev.base);
      const top = O.deck.slice(0, 2);
      if (!top.length) return;
      const pk = await g.pickCards(Ld.ctrl, L('看對手牌庫頂 2 張：棄掉 1 張', 'Top 2 of the defending player\'s deck: discard 1'), top, 1, 1);
      if (!pk.length) return;
      O.deck = O.deck.filter((c) => c !== pk[0]);
      O.discard.push(pk[0]);
      g.noteDiscarded(pk[0], 'deck');
    },
  });
  def('Salacious Crumb | Cackling Companion', 'card', { extend: true, entersReady: (g, inst, p) => g.P(p).leader.card.n === 'Jabba the Hutt' || g.P(p).units.some((u) => u.card.n === 'Jabba the Hutt') });
  def('Salvaged Blaster', 'card', {
    extend: true,
    whenDiscarded(g, c, from) {
      const P = g.P(c.owner);
      (P.discardPlays = P.discardPlays || []).push({ uid: c.uid, phaseId: g.G.phaseId });
    },
  });
  def('Salvaged Materials', 'card', {
    async event(g, p, inst) {
      const r = await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.card.t === 'Upgrade' && g.hasTrait(c.card, 'ITEM') && g.upgradeTargets(p, c.card).length), inst.card, { discount: 3, prompt: L('打出棄牌堆的一張道具升級（少 3 費）', 'play an Item upgrade from your discard pile (3 less)') });
      if (!r) return;
      const uid = r.uid;
      g.delay({
        at: 'regroupStart',
        round: g.G.round,
        run(g) {
          for (const h of g.allUnits()) {
            const up = h.upgrades.find((x) => x.uid === uid);
            if (up) g.removeUpgrade(h, up);
          }
        },
      });
    },
  });
  def('Sandcrawler Sales Team', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      if (!baseAt(g, u.ctrl, 'Tatooine')) return;
      const ups = [];
      for (const h of g.allUnits()) for (const up of h.upgrades) if (!/Token/.test(up.card.t) && !up.leaderPilot && (up.card.c || 0) <= 3) ups.push({ uid: up.uid, card: up.card, host: h, up });
      const pk = ups.length ? await g.pickCards(u.ctrl, L('可以把一張費用 3 以下的升級收回擁有者手牌', 'You may return an upgrade that costs 3 or less to its owner\'s hand'), ups, 0, 1) : [];
      if (!pk.length) return;
      const { host, up } = pk[0];
      host.upgrades = host.upgrades.filter((x) => x !== up);
      g.P(up.owner).hand.push({ uid: up.uid, card: up.card, owner: up.owner });
      g.log('logBounce', up.card.n);
    },
  });
  def('Sandstorm', 'card', {
    costMod: (g, p) => (baseAt(g, p, 'Tatooine') ? -1 : 0),
    async event(g, p, inst) {
      const ar = await chooseArena(g, p, inst.card);
      for (const u of g.P(1 - p).units) if (u.arena === ar && u.exhausted) g.giveToken(u, 'Weakness');
    },
  });
  def('Saw Gerrera | Bring Down the Empire', 'unit', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      const t = await g.pickUnit(self.ctrl, L('可以用另一個單位攻擊（+2/+0、Overwhelm，攻擊後擊敗它）', 'You may attack with another unit (+2/+0, Overwhelm, defeat it after)'), (x) => x.ctrl === self.ctrl && x !== self && g.canAttackWith(x), { optional: true });
      if (!t) return;
      await g.attack(t, { power: 2, kw: { Overwhelm: true } });
      if (g.findUnit(t.uid)) await g.defeat(t, { self: true });
    },
  });
  def('Saw Gerrera | Shadowlands Insurgent', 'card', {
    onEnemyPlay(g, self, card) {
      if (card.t === 'Event') g.resourceTop(self.ctrl);
    },
  });
  def('Scion Shuttle | At Morgan\'s Bidding', 'card', { extend: true, aura: (g, src, u) => (g.G.attack && g.G.attack.attacker === src && g.G.attack.defender === u ? { p: -1, h: -1 } : null) });
  def('Seasoned Fleet Admiral', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'draw' || ev.p === self.ctrl || ev.phase !== 'action') return;
      const t = await g.pickUnit(self.ctrl, L('可以給一個單位經驗代幣', 'You may give an Experience token to a unit'), () => true, { optional: true });
      if (t) g.giveExp(t);
    },
  });
  def('Sebulba\'s Podracer | Taking the Lead', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'discarded' || ev.from !== 'deck' || ev.p !== self.ctrl || self.sebRound === g.G.round || !self.exhausted) return;
      if (!(await may(g, self.ctrl, self, L('要重置這個單位嗎？（每回合一次）', 'Ready this unit? (once per round)')))) return;
      self.sebRound = g.G.round;
      g.ready(self);
    },
  });
  def('Seismic Detonation', 'card', {
    async event(g, p, inst) {
      const ar = await chooseArena(g, p, inst.card);
      g.delay({ at: 'regroupStart', round: g.G.round, async run(g) { for (const u of g.P(1 - p).units.filter((x) => x.arena === ar)) await g.damageUnit(u, 3, { p }); } });
    },
  });
  def('Shadow Caster | Just Business', 'card', {
    extend: true,
    async onUsedWhenDefeated(g, self, snap, again) {
      if (snap.ctrl !== self.ctrl) return;
      if (await may(g, self.ctrl, self, L(`要再使用一次 ${N(snap)} 的「被擊敗時」能力嗎？`, `Use ${snap.card.n}'s When Defeated abilities again?`))) await again();
    },
  });
  def('Shadow of Stygeon Prime', 'card', {
    grantFor: (g, up, host) => ({
      cantReady: () => true,
      onRegroupStart(g, u) {
        g.damageBase(u.ctrl, 2, { p: u.ctrl });
      },
    }),
  });
  def('Shifty Suspects', 'card', { extend: true, onAttack: (g) => (g.G.noHealPhase = g.G.phaseId) });
  async function shinHati(g, p, atk) {
    const n = atk.baseDamage || 0;
    const t = await g.pickUnit(p, L(`橫置一個費用少於 ${n} 的單位`, `Exhaust a unit that costs less than ${n}`), (x) => (x.card.c || 0) < n, { ctx: { harm: true } });
    if (t) g.exhaust(t);
  }
  def('Shin Hati | Eager Adversary', 'leader', {
    extend: true,
    async onFriendlyAttackEnd(g, Ld, atk) {
      if (!(atk.baseDamage > 0) || !g.allUnits().some((x) => (x.card.c || 0) < atk.baseDamage)) return;
      if (await exhaustLeaderMay(g, Ld)) await shinHati(g, Ld.ctrl, atk);
    },
  });
  def('Shin Hati | Eager Adversary', 'unit', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (!(atk.baseDamage > 0) || self.shinRound === g.G.round || !g.allUnits().some((x) => (x.card.c || 0) < atk.baseDamage)) return;
      if (!(await may(g, self.ctrl, self, L('要橫置一個費用較低的單位嗎？（每回合一次）', 'Exhaust a cheaper unit? (once per round)')))) return;
      self.shinRound = g.G.round;
      await shinHati(g, self.ctrl, atk);
    },
  });
  async function moveToken(g, p, card) {
    const cands = [];
    for (const h of g.allUnits()) for (const up of h.upgrades) if (/Token/.test(up.card.t)) cands.push({ uid: up.uid, card: up.card, host: h, up });
    if (!cands.length) return;
    const pk = await g.pickCards(p, L(`${N(card)}：可以取得一個代幣升級的控制權，移到另一個合法單位`, `${card.n}: you may take control of a token upgrade and attach it to a different unit`), cands, 0, 1);
    if (!pk.length) return;
    const { host, up } = pk[0];
    const t = await g.pickUnit(p, L('移到哪個單位', 'Attach it to'), (x) => x !== host, {});
    if (!t) return;
    host.upgrades = host.upgrades.filter((x) => x !== up);
    up.owner = p;
    t.upgrades.push(up);
    g.log('logAttach', up.card.n, t.card.n);
  }
  def('Shuttle ST-149 | Under Krennic\'s Authority', 'card', { extend: true, whenPlayed: (g, u) => moveToken(g, u.ctrl, u.card), whenDefeated: (g, snap) => moveToken(g, snap.ctrl, snap.card) });
  def('Sidon Ithano | The Crimson Corsair', 'card', {
    async whenPlayed(g, u) {
      const hosts = g.P(1 - u.ctrl).units.filter((x) => g.hasTrait(x, 'VEHICLE') && !hasPilot(g, x));
      if (!hosts.length) return;
      const t = await g.pickUnit(u.ctrl, L('可以把賽登當升級裝到沒有駕駛員的敵方載具上', 'You may attach Sidon as an upgrade to an enemy Vehicle without a Pilot'), (x) => hosts.includes(x), { optional: true });
      if (t) makePilotUpgrade(g, t, u);
    },
  });
  def('Sifo-Dyas', 'card', {
    async whenDefeated(g, snap) {
      const p = snap.ctrl;
      const P = g.P(p);
      const top = P.deck.splice(0, g.searchN(p, 8));
      const ok = top.filter((c) => c.card.t === 'Unit' && g.hasTrait(c.card, 'CLONE'));
      const pick = ok.length ? await g.pickCards(p, L('選任意張複製人單位（總費用 4 以下）棄掉，本階段可以免費打出', 'Choose Clone units (combined cost 4 or less) to discard; you may play them for free this phase'), ok, 0, ok.length, null, { sumMax: 4 }) : [];
      bottomRandom(g, p, top.filter((c) => !pick.includes(c)));
      for (const c of pick) {
        P.discard.push(c);
        g.noteDiscarded(c, 'deck');
        (P.discardPlays = P.discardPlays || []).push({ uid: c.uid, phaseId: g.G.phaseId, free: true });
      }
    },
  });
  def('Sinister War Memorial', 'card', {
    extend: true,
    baseGains: {
      onAnyDefeated(g, base, snap) {
        if (snap.ctrl === base.ctrl) g.healBase(base.ctrl, 1);
      },
    },
  });
  def('Sith Trooper', 'card', {
    extend: true,
    onAttack(g, u, atk) {
      const o = 1 - u.ctrl;
      const n = g.P(o).units.filter((x) => x.damage > 0).length;
      if (n) g.buff(u, n, 0, 'attack');
    },
  });
  def('Size Matters Not', 'card', { extend: true, costMod: (g, p) => (g.P(p).units.some((u) => g.hasTrait(u, 'FORCE')) ? -1 : 0) });
  def('Sly Moore | Witness to Power', 'card', {
    extend: true,
    whenPlayed(g, u) {
      const p = u.ctrl;
      (g.G.phaseMods = g.G.phaseMods || []).push({ phaseId: g.G.phaseId, f: (g, x) => (x.ctrl !== p && g.G.attack && g.G.attack.attacker === x && g.G.attack.base ? { p: -2 } : null) });
    },
  });
  const nextResistance = (g, u) => g.addNext(u.ctrl, { f: (c) => g.hasTrait(c, 'RESISTANCE'), n: 1, phaseId: g.G.phaseId });
  def('Snap Wexley | Resistance Recon Flier', 'card', { whenPlayed: nextResistance, onAttack: nextResistance });
  def('Snap Wexley | Resistance Recon Flier', 'pilot', {
    async whenPlayed(g, up, t) {
      const p = t.ctrl;
      const { pick, rest } = await searchDeck(g, p, 5, (c) => g.hasTrait(c, 'RESISTANCE'), up, { prompt: L('選一張抵抗組織卡加入手牌', 'choose a Resistance card to draw') });
      bottomRandom(g, p, rest);
      if (pick.length) g.P(p).hand.push(pick[0]);
    },
  });
  def('Soulless One | Soulless Fun', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('選一個敵方地面單位（這個單位在場時 -3/-0）', 'Choose an enemy ground unit (-3/-0 while this unit is in play)'), (x) => x.ctrl !== u.ctrl && x.arena === 'Ground', { ctx: { harm: true } });
      if (t) u.soulTarget = t.uid;
    },
    aura: (g, src, u) => (src.soulTarget === u.uid ? { p: -3 } : null),
  });
  def('Stolen Starpath Unit', 'card', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        const o = 1 - u.ctrl;
        const nm = await SWU.FX2.nameCard(g, u.ctrl, o, up.card);
        g.log('logNote', `${up.card.n}: ${nm}`);
        const O = g.P(o);
        if (O.hand.length) {
          g.revealCards(o, O.hand, 'reveal');
          await g.showCards(u.ctrl, O.hand, L('對手的手牌', "Opponent's hand"));
        }
        const n = O.hand.filter((c) => c.card.n === nm).length;
        if (n) g.createToken(u.ctrl, 'Spy', n);
      },
    }),
  });
  def('Supremacy | Destroy the Resistance', 'card', {
    async whenPlayed(g, u) {
      const b = await g.pickTarget(u.ctrl, L('對一個基地造成其剩餘生命一半的傷害', 'Deal damage to a base equal to half its remaining HP'), { bases: [1 - u.ctrl, u.ctrl], ctx: { harm: true } });
      if (!b || b.base == null) return;
      const B = g.P(b.base).base;
      const n = Math.floor(((B.card.h || 30) - B.damage) / 2);
      if (n) g.damageBase(b.base, n, { p: u.ctrl });
    },
  });
  def('Surveillance Cruiser', 'card', {
    extend: true,
    whenPlayed(g, u) {
      if (['Endor', 'Kashyyyk', 'Naboo', 'Tatooine'].includes(g.P(1 - u.ctrl).base.card.s)) g.draw(u.ctrl, 1);
    },
  });
  def('Swarming Vulture Droid', 'card', { extend: true, static: (g, u) => ({ p: g.P(u.ctrl).units.filter((x) => x !== u && x.card.n === 'Swarming Vulture Droid').length }) });
  def('Talzin\'s Shuttle | Mysterious Arrival', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      if (((g.G.playedThisPhase || [[], []])[1 - u.ctrl] || []).length < 2) return;
      const t = await g.pickUnit(u.ctrl, L('可以給一個單位 2 個弱點代幣', 'You may give 2 Weakness tokens to a unit'), () => true, { optional: true, ctx: { harm: true } });
      if (t) {
        g.giveToken(t, 'Weakness');
        g.giveToken(t, 'Weakness');
      }
    },
  });
  def('Tam Ryvora', 'pilot', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        const t = await g.pickUnit(u.ctrl, L('給這個區域的一個敵方單位 -1/-1（本階段）', 'Give an enemy unit in this arena -1/-1 for this phase'), (x) => x.ctrl !== u.ctrl && x.arena === u.arena, { ctx: { harm: true } });
        if (t) g.buff(t, -1, -1, 'phase');
      },
    }),
  });
  def('Taramyn Barcona | Eyes Front!', 'card', {
    async whenPlayed(g, u) {
      const ps = [0, 1].filter((q) => g.P(q).credits > 0);
      if (!ps.length) return;
      const i = await g.pickOption(u.ctrl, L('可以擊敗一個信用點代幣（任何玩家的）', 'You may defeat a Credit token (any player)'), [L('不要', 'No'), ...ps.map((q) => (q === u.ctrl ? L('自己的', 'Yours') : L('對手的', "Opponent's")))], { ctx: { aiPick: ps.includes(1 - u.ctrl) ? 1 + ps.indexOf(1 - u.ctrl) : 0 } });
      if (i <= 0) return;
      g.P(ps[i - 1]).credits--;
      g.giveExp(u);
      const t = await g.pickUnit(u.ctrl, L('給另一個友方單位經驗代幣', 'Give an Experience token to another friendly unit'), (x) => x.ctrl === u.ctrl && x !== u, {});
      if (t) g.giveExp(t);
    },
  });
  def('Targeted For Removal', 'card', {
    grantFor: (g, up, host) => ({
      whenDefeated(g, snap) {
        const n = snap.card.c || 0;
        if (n) {
          g.P(1 - snap.ctrl).credits += n;
          g.log('logToken', g.P(1 - snap.ctrl).name, 'Credit', n);
        }
      },
    }),
  });
  passive('Targeting Computer'); // 在引擎 dealIndirect
  def('Tatooine Repulsor Train', 'card', { extend: true, cantBeAttackedBy: (g, u) => g.P(u.ctrl).units.filter((x) => x.exhausted).length >= 2 });
  def('Tear This Ship Apart', 'card', {
    async event(g, p) {
      const O = g.P(1 - p);
      if (!O.resources.length) return;
      await g.showCards(p, O.resources, L('對手的資源', "Opponent's resources"));
      const ok = O.resources.filter((r) => ['Unit', 'Event', 'Upgrade'].includes(r.card.t) && (r.card.t !== 'Upgrade' || g.upgradeTargets(p, r.card).length));
      const pk = ok.length ? await g.pickCards(p, L('可以免費打出其中 1 張', 'You may play 1 of them for free'), ok, 0, 1) : [];
      if (!pk.length) return;
      const r = pk[0];
      O.resources = O.resources.filter((x) => x !== r);
      const c = { uid: r.uid, card: r.card, owner: r.owner };
      await g.playCard(p, c.uid, 'deck', { inst: c, free: true });
      g.resourceTop(1 - p);
    },
  });
  def('Tech | I Thought it Was Obvious', 'card', {
    async whenDamagedSurvive(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以橫置一個單位', 'You may exhaust a unit'), () => true, { optional: true, ctx: { harm: true } });
      if (t) g.exhaust(t);
    },
  });
  def('Temple of Destruction | Malachor', 'card', {
    onEvent(g, base, ev) {
      if (ev.type === 'damage' && ev.combat && ev.base != null && ev.base !== base.ctrl && ev.by === base.ctrl && ev.n >= 3 && !g.P(base.ctrl).force) {
        g.P(base.ctrl).force = true;
        g.log('logForce', g.P(base.ctrl).name);
      }
    },
  });
  def('That\'s a Rock', 'card', {
    extend: true,
    async whenDiscarded(g, c, from) {
      await RUN(g, c.owner, c, 'you may deal 1 damage to a unit');
    },
  });
  async function armorer(g, p, card, filter) {
    const P = g.P(p);
    const ok = P.resources.filter((r) => r.card.t === 'Upgrade' && g.P(p).units.some((u) => filter(u) && g.upgradeTargets(p, r.card).includes(u)) && g.canPay(p, g.costOf(p, r.card)));
    if (!ok.length) return false;
    const pk = await g.pickCards(p, L(`${N(card)}：從資源區打出一張升級（照常付費）`, `${card.n}: play an upgrade from your resources (paying its cost)`), ok, 0, 1);
    if (!pk.length) return false;
    const t = await g.pickUnit(p, L('裝到哪個單位', 'Attach to'), (u) => filter(u) && g.upgradeTargets(p, pk[0].card).includes(u), {});
    if (!t) return false;
    await g.playCard(p, pk[0].uid, 'resource', { target: t });
    g.resourceTop(p);
    return true;
  }
  def('The Armorer | Steel Shapes Us', 'leader', {
    actions: [
      {
        text: L('從資源區打出升級到本階段進場的單位，然後把牌庫頂放成資源', 'Play an upgrade from your resources on a unit that entered play this phase, then resource the top card'),
        can: (g, Ld) => !Ld.exhausted && g.allUnits().some((u) => u.playedPhase === g.G.phaseId),
        async run(g, Ld) {
          Ld.exhausted = true;
          await armorer(g, Ld.ctrl, Ld.card, (u) => u.playedPhase === g.G.phaseId);
        },
      },
    ],
  });
  def('The Armorer | Steel Shapes Us', 'unit', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid) return;
      await armorer(g, self.ctrl, self.card, (u) => u.ctrl === self.ctrl);
    },
  });
  def('The Chieftain | Here Since the Oceans Dried', 'card', {
    static: (g, u) => {
      const n = g.P(u.ctrl).units.filter((x) => x !== u && g.hasTrait(x, 'TUSKEN')).length;
      return n ? { kw: { Raid: n } } : null;
    },
    aura: (g, src, u) => (u.ctrl === src.ctrl && g.hasTrait(u, 'TUSKEN') && g.G.attack && g.G.attack.defender === u && u !== src ? { p: g.kw(u).Raid || 0 } : null),
  });
  def('The Conflict Within', 'card', {
    grantFor: (g, up, host) => ({
      async whenReadied(g, u) {
        if (g.canPay(u.ctrl, 3) && (await may(g, u.ctrl, up.card, L('要支付 3 嗎？（否則橫置這個單位）', 'Pay 3? (otherwise exhaust this unit)')))) g.pay(u.ctrl, 3);
        else u.exhausted = true;
      },
    }),
  });
  def('The Daughter | Embodiment of Light', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || ev.base !== self.ctrl || !g.P(self.ctrl).force) return;
      if (await may(g, self.ctrl, self, L('要使用原力回復基地 2 點嗎？', 'Use the Force to heal 2 damage from your base?'))) {
        g.useForce(self.ctrl);
        g.healBase(self.ctrl, 2);
      }
    },
  });
  def('The Eye of Aldhani', 'card', {
    event(g, p) {
      g.delay({
        at: 'actionStart',
        round: g.G.round + 1,
        async run(g) {
          const o = 1 - p;
          for (const u of [...g.P(o).units]) {
            if (g.canPay(o, 1) && (await g.yesno(o, L(`艾爾達尼之眼：要為 ${N(u)} 支付 1 嗎？（否則橫置）`, `Eye of Aldhani: pay 1 for ${u.card.n}? (otherwise exhaust it)`), { uid: u.uid }))) g.pay(o, 1);
            else g.exhaust(u);
          }
        },
      });
    },
  });
  def('The Father | Maintaining Balance', 'card', {
    extend: true,
    async onEvent(g, self, ev) {
      if (ev.type !== 'useForce' || ev.p !== self.ctrl || !g.findUnit(self.uid)) return;
      if (!(await may(g, self.ctrl, self, L('要對這個單位造成 1 點傷害，讓原力再次與你同在嗎？', 'Deal 1 damage to this unit so the Force is with you again?')))) return;
      await g.damageUnit(self, 1, { p: self.ctrl });
      g.P(self.ctrl).force = true;
      g.log('logForce', g.P(self.ctrl).name);
    },
  });
  def('The First Legion | Vader\'s Fist', 'card', {
    extend: true,
    async onAttack(g, u) {
      const o = 1 - u.ctrl;
      const tr = new Map();
      for (const c of [...g.P(o).units.map((x) => x.card), ...g.P(o).deck.map((x) => x.card), ...g.P(o).hand.map((x) => x.card), g.P(o).leader.card]) for (const t of c.tr || []) tr.set(t, (tr.get(t) || 0) + 1);
      const list = [...tr.keys()].sort((a, b) => tr.get(b) - tr.get(a));
      if (!list.length) return;
      const i = await g.pickOption(u.ctrl, L('指名一個特徵：敵方卡片本階段失去它', 'Name a Trait: enemy cards lose it this phase'), list, { ctx: { aiPick: 0 } });
      (g.G.lostTraits = g.G.lostTraits || []).push({ trait: list[Math.max(0, i)], victim: o, phaseId: g.G.phaseId });
    },
  });
  let ghostBusy = false;
  def('The Ghost | Heart of the Family', 'card', {
    extend: true,
    aura(g, src, u) {
      if (u === src || u.ctrl !== src.ctrl || !g.hasTrait(u, 'SPECTRE') || ghostBusy) return null;
      ghostBusy = true;
      try {
        return { kw: { ...g.kw(src) } };
      } finally {
        ghostBusy = false;
      }
    },
  });
  def('The Ghost | Whale Watching', 'card', {
    extend: true,
    onEvent(g, self, ev) {
      if (ev.type === 'damage' && ev.base != null && ev.base !== self.ctrl && ev.by === self.ctrl && g.P(self.ctrl).hand.length <= 7) g.draw(self.ctrl, 1);
    },
  });
  def('The Great Mothers | With Strange Magicks', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !(atk.dealtToD > 0) || !atk.defender) return;
      const d = g.findUnit(atk.defender.uid);
      if (d && !g.isLeaderUnit(d)) await g.defeat(d, {});
    },
  });
  def('The Great Progenitor | First of the Drengir', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      if (!(await may(g, self.ctrl, self, L('要給這個單位弱點代幣，並依弱點數量建立野獸代幣嗎？', 'Give a Weakness token to this unit and create a Beast token for each Weakness on it?')))) return;
      g.giveToken(self, 'Weakness');
      const n = self.upgrades.filter((x) => x.card.n === 'Weakness').length;
      g.createToken(self.ctrl, 'Beast', n);
    },
  });
  const nextNine = (g, p) => g.addNext(p, { n: 9, phaseId: g.G.phaseId });
  def('The Invisible Hand | Confederate Might', 'card', { extend: true, whenPlayed: (g, u) => nextNine(g, u.ctrl), whenDefeated: (g, snap) => nextNine(g, snap.ctrl) });
  def('The Mandalorian | Let\'s See the Puck', 'card', {
    extend: true,
    onEvent(g, self, ev) {
      if (ev.type === 'draw' && ev.p === self.ctrl && ev.phase === 'action' && g.findUnit(self.uid)) g.giveShield(self);
    },
  });
  def('The Mandalorian | Weathered Pilot', 'card', {
    async whenPlayed(g, u) {
      for (let i = 0; i < 2; i++) {
        const t = await g.pickUnit(u.ctrl, L(`可以橫置一個地面單位（${i + 1}/2）`, `You may exhaust a ground unit (${i + 1}/2)`), (x) => x.arena === 'Ground' && !x.exhausted, { optional: true, ctx: { harm: true } });
        if (!t) break;
        g.exhaust(t);
      }
    },
  });
  def('The Mandalorian | Weathered Pilot', 'pilot', {
    async whenPlayed(g, up, t) {
      const e = await g.pickUnit(t.ctrl, L('橫置這個區域的一個敵方單位', 'Exhaust an enemy unit in this arena'), (x) => x.ctrl !== t.ctrl && x.arena === t.arena, { ctx: { harm: true } });
      if (e) g.exhaust(e);
    },
  });
  def('The Marauder | A New Home', 'card', {
    extend: true,
    affordable: (g, p, cost) => g.canPay(p, Math.max(0, cost - g.P(p).units.length)),
    async prePay(g, p, cost) {
      const P = g.P(p);
      if (!P.units.length) return cost;
      const need = Math.max(0, cost - g.readyResources(p) - P.credits);
      const pk = await g.pickCards(p, L('選任意個友方單位各受 1 點傷害，每個讓這個單位少 1 費', 'Choose friendly units to deal 1 damage to each; 1 less per unit'), P.units.map((u) => ({ uid: u.uid, card: u.card, u })), Math.min(need, P.units.length), P.units.length, { aiPick: need });
      for (const c of pk) await g.damageUnit(c.u, 1, { p });
      return cost - pk.length;
    },
  });
  const gambit = (c) => (c.tr || []).includes('GAMBIT');
  def('The Master Codebreaker | High Stakes', 'card', {
    costFor: (g, src, card) => (gambit(card) && firstThisRound(g, src.ctrl, gambit) ? 1 : 0),
    async whenPlayed(g, u) {
      const { pick, rest } = await searchDeck(g, u.ctrl, 8, gambit, u, { prompt: L('選一張 Gambit 卡加入手牌', 'choose a Gambit card to draw') });
      bottomRandom(g, u.ctrl, rest);
      if (pick.length) g.P(u.ctrl).hand.push(pick[0]);
    },
  });
  def('The Son | Embodiment of Darkness', 'card', { aura: (g, src, u) => (u.ctrl === src.ctrl && g.P(src.ctrl).force ? { p: 2 } : null), static: (g, u) => (g.P(u.ctrl).force ? { p: 2 } : null) });
  passive('The Starhawk | Prototype Battleship'); // 在引擎 canPay/pay
  def('The Stranger | No Survivors', 'card', { extend: true, strikeLastAsk: true });
  def('The Tarkin Doctrine | Protect and Punish', 'card', {
    async whenPlayed(g, inst) {
      const p = inst.owner;
      const P = g.P(p);
      if (P.leader.card.n !== 'Grand Moff Tarkin' && !P.units.some((u) => u.card.n === 'Grand Moff Tarkin')) return;
      const t = await g.pickUnit(p, L('給一個敵方單位 -3/-0（本階段）', 'Give an enemy unit -3/-0 for this phase'), (x) => x.ctrl !== p, { ctx: { harm: true } });
      if (t) g.buff(t, -3, 0, 'phase');
    },
    baseGains: {
      async onCardPlayed(g, base, ev) {
        if (ev.p !== base.ctrl || ev.card.t !== 'Upgrade' || !g.hasTrait(ev.card, 'FORTIFICATION')) return;
        const t = await g.pickUnit(base.ctrl, L('橫置一個敵方單位', 'Exhaust an enemy unit'), (x) => x.ctrl !== base.ctrl, { ctx: { harm: true } });
        if (t) g.exhaust(t);
      },
    },
  });
  def('The Way of the Mand\'alor', 'card', { extend: true, costOnTarget: (g, p, t) => (g.hasTrait(t, 'MANDALORIAN') ? 1 : 0) });
  def('The Wrong Ride', 'card', {
    async event(g, p) {
      const rs = g.P(1 - p).resources.filter((r) => !r.exhausted);
      const n = Math.min(2, rs.length);
      if (!n) return;
      const pk = await g.pickCards(p, L('橫置 2 個敵方資源', 'Exhaust 2 enemy resources'), rs, n, n);
      for (const r of pk) r.exhausted = true;
    },
  });
  def('There Is No Conflict', 'card', {
    async whenPlayed(g, inst, t) {
      const others = t.upgrades.filter((x) => x !== inst && x.uid !== inst.uid && !x.leaderPilot);
      if (!others.length) return;
      const pk = await g.pickCards(inst.owner, L('把任意張其他升級收回擁有者手牌', 'Return any number of other upgrades to their owners\' hands'), others, 0, others.length);
      for (const up of pk) {
        t.upgrades = t.upgrades.filter((x) => x !== up);
        if (!/Token/.test(up.card.t)) g.P(up.owner).hand.push({ uid: up.uid, card: up.card, owner: up.owner });
        g.log('logBounce', up.card.n);
      }
    },
  });
  def('There Is No Escape', 'card', {
    async event(g, p) {
      const pk = await g.pickCards(p, L('選最多 3 個單位：本回合失去所有能力', 'Choose up to 3 units: they lose all abilities this round'), g.allUnits().map((u) => ({ uid: u.uid, card: u.card, u })), 0, 3);
      for (const c of pk) c.u.blankRound = g.G.round;
    },
  });
  def('Therm Scissorpunch | Boastful Gambler', 'card', {
    extend: true,
    onActionPhaseStart(g, self) {
      let n = 0;
      for (const q of [self.ctrl, 1 - self.ctrl]) {
        const top = g.P(q).deck[0];
        if (!top) continue;
        g.revealCards(q, [top], 'reveal');
        if ((top.card.c || 0) >= 3) n++;
      }
      if (n) g.buff(self, -2 * n, -2 * n, 'phase');
    },
  });
  passive('Thermal Oscillator | Starkiller Base'); // 牌組下限在 deck.js
  def('Third Sister | Seething With Ambition', 'unit', { extend: true, onAttack: (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit', kw: { Hidden: true }, phaseId: g.G.phaseId }) });
  def('Time of Crisis', 'card', {
    async event(g, p) {
      const keep = new Set();
      for (const q of [p, 1 - p]) {
        const t = await g.pickUnit(q, L('選擇一個你控制的單位（不受傷害）', 'Choose a unit you control (it is spared)'), (x) => x.ctrl === q, {});
        if (t) keep.add(t.uid);
      }
      for (const u of g.allUnits().filter((x) => !keep.has(x.uid))) await g.damageUnit(u, 3, { p });
    },
  });
  def('Tireless Magnaguard', 'card', {
    extend: true,
    whenDefeated(g, snap) {
      const d = (g.G.defeated || []).filter((x) => x.uid === snap.uid).pop();
      if (!d || d.power < 5) return;
      const P = g.P(snap.owner);
      (P.discardPlays = P.discardPlays || []).push({ uid: snap.uid, phaseId: g.G.phaseId, free: true, weak2: true });
    },
    whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      const last = (g.G.playLog || []).filter((x) => x.uid === u.uid).pop();
      if (last && last.from === 'discard' && last.cost === 0) {
        g.giveToken(u, 'Weakness');
        g.giveToken(u, 'Weakness');
      }
    },
  });
  def('Tobias Beckett | People are Predictable', 'leader', {
    actions: [
      {
        text: L('選一個友方單位交給對手控制；若對手接受，建立信用點', 'Choose a friendly unit; an opponent takes control of it. If they do, create a Credit'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).units.some((u) => !g.isLeaderUnit(u)),
        async run(g, Ld) {
          Ld.exhausted = true;
          const t = await g.pickUnit(Ld.ctrl, L('選一個友方單位', 'Choose a friendly unit'), (x) => x.ctrl === Ld.ctrl && !g.isLeaderUnit(x), {});
          if (!t) return;
          SWU.FX2.takeControl(g, t, 1 - Ld.ctrl);
          g.P(Ld.ctrl).credits++;
          g.log('logToken', g.P(Ld.ctrl).name, 'Credit', 1);
        },
      },
    ],
  });
  def('Tobias Beckett | People are Predictable', 'unit', {
    extend: true,
    async whenDeployed(g, u) {
      const p = u.ctrl;
      const mine = g.P(1 - p).units.filter((x) => x.owner === p);
      if (!mine.length) return;
      const pk = await g.pickCards(p, L('擊敗任意個你擁有但不控制的單位：每個建立信用點並抽 1 張', 'Defeat units you own but don\'t control: a Credit and a card for each'), mine.map((x) => ({ uid: x.uid, card: x.card, x })), 0, mine.length);
      for (const c of pk) {
        await g.defeat(c.x, {});
        g.P(p).credits++;
        g.draw(p, 1);
      }
    },
  });
  def('Tomb of Eilram | Zeffo', 'card', {
    actions: [
      {
        text: L('橫置一個友方單位：原力與你同在', 'Exhaust a friendly unit: the Force is with you'),
        can: (g, b) => !g.P(b.ctrl).force && g.P(b.ctrl).units.some((u) => !u.exhausted),
        async run(g, b) {
          const t = await g.pickUnit(b.ctrl, L('橫置一個友方單位', 'Exhaust a friendly unit'), (x) => x.ctrl === b.ctrl && !x.exhausted, {});
          if (!t) return;
          g.exhaust(t);
          g.P(b.ctrl).force = true;
          g.log('logForce', g.P(b.ctrl).name);
        },
      },
    ],
  });
  def('Trace Martez | Trusting Sister', 'pilot', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        let left = 2;
        while (left > 0) {
          const t = await g.pickUnit(u.ctrl, L(`可以回復一個單位的傷害（剩 ${left} 點）`, `You may heal damage from a unit (${left} left)`), (x) => x.damage > 0, { optional: true });
          if (!t) break;
          left -= g.heal(t, 1);
        }
      },
    }),
  });
  def('Trade Route Taxation', 'card', {
    event(g, p) {
      if (g.P(p).units.length > g.P(1 - p).units.length) (g.G.noEvents = g.G.noEvents || []).push({ p: 1 - p, phaseId: g.G.phaseId });
    },
  });
  def('Transmission Jamming', 'card', {
    async event(g, p, inst) {
      const nm = await SWU.FX2.nameCard(g, p, 1 - p, inst.card);
      g.log('logNote', `${inst.card.n}: ${nm}`);
      (g.G.phaseBans = g.G.phaseBans || []).push({ name: nm, phaseId: g.G.phaseId });
    },
  });
  def('Trap Field', 'card', {
    extend: true,
    baseGains: {
      async onEvent(g, base, ev) {
        if (ev.type !== 'enter' || !ev.u || ev.u.arena !== 'Ground' || g.isLeaderUnit(ev.u) || !g.findUnit(ev.u.uid)) return;
        const up = base.upgrades.find((x) => x.card.n === 'Trap Field');
        if (!up) return;
        if (!(await may(g, base.ctrl, up.card, L(`要擊敗陷阱區，對 ${N(ev.u)} 造成 3 點傷害嗎？`, `Defeat Trap Field to deal 3 damage to ${ev.u.card.n}?`)))) return;
        base.upgrades = base.upgrades.filter((x) => x !== up);
        g.dropUpgrade(up);
        await g.damageUnit(ev.u, 3, { p: base.ctrl });
      },
    },
  });
  def('Treacherous Minefield', 'card', {
    async event(g, p, inst) {
      const ar = await chooseArena(g, p, inst.card);
      (g.G.phaseGrants = g.G.phaseGrants || []).push({ phaseId: g.G.phaseId, match: (g, u) => u.arena === ar, hooks: { async onAttack(g, u) { await g.damageUnit(u, 2, { p }); } } });
    },
  });
  def('Turbolaser Salvo', 'card', {
    async event(g, p, inst) {
      const ar = await chooseArena(g, p, inst.card);
      const s = await g.pickUnit(p, L('選一個友方太空單位', 'Choose a friendly space unit'), (x) => x.ctrl === p && x.arena === 'Space', {});
      if (!s) return;
      const n = g.power(s);
      for (const u of g.P(1 - p).units.filter((x) => x.arena === ar)) await g.damageUnit(u, n, { p });
    },
  });
  def('Tusken Tracker', 'card', {
    extend: true,
    whenPlayed(g, u) {
      for (const x of g.P(1 - u.ctrl).units) x.loseKwPhase = { phaseId: g.G.phaseId, kws: ['Hidden'] };
    },
  });
  pre("search the top 8 cards of your deck for any number of Twi'lek units with combined cost 5 or less and play each of them for free");
  def('Twi\'lek Kalikori', 'card', {
    async whenPlayed(g, inst, t) {
      if (t && g.hasTrait(t, "TWI'LEK")) await RUN(g, t.ctrl, inst, "search the top 8 cards of your deck for any number of Twi'lek units with combined cost 5 or less and play each of them for free");
    },
  });
  def('Two-Faced Troig', 'card', {
    async whenPlayed(g, u) {
      if (!(await may(g, u.ctrl, u, L('要讓對手取得這個單位的控制權，換 2 個信用點嗎？', 'Have an opponent take control of this unit to create 2 Credit tokens?')))) return;
      SWU.FX2.takeControl(g, u, 1 - u.ctrl);
      g.P(u.owner).credits += 2;
      g.log('logToken', g.P(u.owner).name, 'Credit', 2);
    },
  });
  def('Ty Yorrick | Monster Hunter', 'card', { extend: true });
  def('U-Wing Lander', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid) || !self.upgrades.length) return;
      const ups = self.upgrades.filter((x) => !x.leaderPilot).map((up) => ({ uid: up.uid, card: up.card, up }));
      const pk = await g.pickCards(self.ctrl, L('可以把這個單位上的一張升級移到另一個友方載具', 'You may attach an upgrade on this unit to another friendly Vehicle'), ups, 0, 1);
      if (!pk.length) return;
      const up = pk[0].up;
      const t = await g.pickUnit(self.ctrl, L('移到哪個載具', 'Move to which Vehicle'), (x) => x !== self && x.ctrl === self.ctrl && g.hasTrait(x, 'VEHICLE') && (/Token/.test(up.card.t) || g.upgradeTargets(self.ctrl, up.card).includes(x) || (up.pilot && g.pilotHosts(self.ctrl).includes(x))), {});
      if (!t) return;
      self.upgrades = self.upgrades.filter((x) => x !== up);
      t.upgrades.push(up);
      g.log('logAttach', up.card.n, t.card.n);
    },
  });
  def('Umbaran Mobile Cannon', 'card', {
    extend: true,
    modDamage(g, u, n) {
      if (u.umbPhase === g.G.phaseId) return n;
      u.umbPhase = g.G.phaseId;
      return 0;
    },
  });
  def('Valiant Commando', 'card', {
    extend: true,
    async onDamageBase(g, u, atk) {
      if (!(await may(g, u.ctrl, u, L('要擊敗這個單位，對那個基地再造成 3 點傷害嗎？', 'Defeat this unit to deal 3 damage to that base?')))) return;
      await g.defeat(u, { self: true });
      g.damageBase(1 - u.ctrl, 3, { p: u.ctrl });
    },
  });
  def('Vane\'s Snub Fighter | Brash and Proud', 'card', {
    extend: true,
    onFriendlyAttackEnd(g, self, atk) {
      if (atk.baseDamage > 0 && g.findUnit(self.uid)) g.giveToken(self, 'Advantage');
    },
  });
  async function vanee(g, u) {
    const p = u.ctrl;
    const cands = [];
    for (const h of g.P(p).units) for (const up of h.upgrades) if (up.card.n === 'Experience') cands.push({ uid: up.uid, card: up.card, host: h, up });
    if (!cands.length) return;
    const pk = await g.pickCards(p, L('可以擊敗友方單位上的一個經驗代幣', 'You may defeat an Experience token on a friendly unit'), cands, 0, 1);
    if (!pk.length) return;
    g.removeUpgrade(pk[0].host, pk[0].up);
    const t = await g.pickUnit(p, L('給一個友方單位經驗代幣', 'Give an Experience token to a friendly unit'), (x) => x.ctrl === p, {});
    if (t) g.giveExp(t);
  }
  def('Vaneé | I Live to Serve', 'card', { whenPlayed: vanee, onAttack: vanee });
  def('Vermillion | Qi\'ra\'s Auction House', 'card', {
    extend: true,
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker.uid !== self.uid || !g.findUnit(self.uid)) return;
      const p = self.ctrl;
      const di = await g.pickOption(p, L('揭示哪個牌庫的頂牌', 'Reveal the top card of which deck'), [L('自己的', 'Yours'), L('對手的', "Opponent's")]);
      const dq = di === 1 ? 1 - p : p;
      const D = g.P(dq);
      if (!D.deck.length) return;
      const top = D.deck[0];
      g.revealCards(dq, [top], 'reveal');
      const pi = await g.pickOption(p, L(`選一位玩家可以免費打出 ${N(top)}`, `Choose a player who may play ${top.card.n} for free`), [L('自己', 'Yourself'), L('對手', 'Opponent')]);
      const q = pi === 1 ? 1 - p : p;
      const playable = ['Unit', 'Event', 'Upgrade'].includes(top.card.t) && (top.card.t !== 'Upgrade' || g.upgradeTargets(q, top.card).length);
      if (!playable || !(await g.yesno(q, L(`要免費打出 ${N(top)} 嗎？`, `Play ${top.card.n} for free?`), { card: top.card.key }))) return;
      D.deck.shift();
      await g.playCard(q, top.uid, 'deck', { inst: top, free: true });
      const n = top.card.c || 0;
      if (n) {
        g.P(1 - q).credits += n;
        g.log('logToken', g.P(1 - q).name, 'Credit', n);
      }
    },
  });
  def('Vernestra Rwoh | We Should Handle This Ourselves', 'card', {
    async prePay(g, p, cost, c) {
      const P = g.P(p);
      const ok = P.discard.filter((x) => x.card.t === 'Unit' && (x.card.c || 0) <= 5);
      const pk = ok.length ? await g.pickCards(p, L('可以把棄牌堆最多 2 個費用 5 以下的單位放到牌庫底（獲得它們的「打出時」能力）', 'You may put up to 2 units that cost 5 or less from your discard on the bottom of your deck (gain their When Played)'), ok, 0, 2) : [];
      for (const x of pk) {
        P.discard = P.discard.filter((y) => y !== x);
        P.deck.push(x);
      }
      g.G.vernestra = { uid: c.uid, cards: pk.map((x) => x.card) };
      return cost;
    },
    async whenPlayed(g, u) {
      const V = g.G.vernestra;
      if (!V || V.uid !== u.uid) return;
      g.G.vernestra = null;
      for (const card of V.cards) {
        const e = SWU.EFFECTS.get(card, 'card');
        if (e && e.whenPlayed) await e.whenPlayed(g, u);
      }
    },
  });
  def('Vice Admiral Rampart | A New Era of Safety', 'card', { extend: true }); // 在 Wild Space Wanderer 等「擊敗基地升級」時詢問
  def('Vigil | Securing the Future', 'card', {
    modFriendlyDamage: (g, s, u, n) => n - 1,
    modDamage: (g, u, n, src) => (src.attacker === u || src.defender === u || (g.srcCard && g.srcCard === u.card && !src.combat) ? n : n + 1),
  });
  let vonBusy = false;
  def('Vonreg\'s TIE Interceptor | Ace of the First Order', 'card', {
    static(g, u) {
      if (vonBusy) return null;
      vonBusy = true;
      try {
        const pw = g.power(u);
        const kw = {};
        if (pw >= 4) kw.Overwhelm = true;
        if (pw >= 6) kw.Raid = 1;
        return { kw };
      } finally {
        vonBusy = false;
      }
    },
  });
  def('Vult Skerris\'s Defender | Secret Project', 'card', {
    extend: true,
    whenPlayed(g, u) {
      if ((g.G.discardLog || []).some((x) => x.owner === u.ctrl && x.phaseId === g.G.phaseId)) g.giveShield(u);
    },
  });
  def('Vuutun Palaa | Droid Control Ship', 'card', { costMod: (g, p) => -g.P(p).units.filter((u) => g.hasTrait(u, 'DROID')).length });
  def('Watchful', 'card', {
    grantFor: (g, up, host) => ({
      async onAttack(g, u) {
        const i = await g.pickOption(u.ctrl, L('看哪個牌庫的頂牌', 'Look at the top card of which deck'), [L('自己的', 'Yours'), L('對手的', "Opponent's")]);
        const D = g.P(i === 1 ? 1 - u.ctrl : u.ctrl);
        if (!D.deck.length) return;
        await g.showCards(u.ctrl, [D.deck[0]], L('牌庫頂', 'Top card'));
        if (await may(g, u.ctrl, up.card, L('要把它放到牌庫底嗎？', 'Put it on the bottom of that deck?'))) D.deck.push(D.deck.shift());
      },
    }),
  });
  def('Wedge Antilles | Leader of Red Squadron', 'leader', {
    extend: true,
    actions: [
      {
        text: L('用 Piloting 打出一張手牌（少 1 費）', 'Play a card from your hand using Piloting (1 less)'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).hand.some((c) => /^Piloting \[/m.test(c.card.tx || '') && g.pilotHosts(Ld.ctrl, c.card).length && g.canPay(Ld.ctrl, Math.max(0, g.pilotCost(Ld.ctrl, c.card) - 1))),
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.ctrl;
          const ok = g.P(p).hand.filter((c) => /^Piloting \[/m.test(c.card.tx || '') && g.pilotHosts(p, c.card).length && g.canPay(p, Math.max(0, g.pilotCost(p, c.card) - 1)));
          const pk = await g.pickCards(p, L('選一張用 Piloting 打出', 'Choose a card to play using Piloting'), ok, 1, 1);
          if (pk.length) await g.playCard(p, pk[0].uid, 'hand', { asPilot: true, pilotDiscount: 1 });
        },
      },
    ],
  });
  def('Weequay Pirate', 'card', {
    extend: true,
    whenPlayed(g, u) {
      const last = (g.G.playLog || []).filter((x) => x.uid === u.uid).pop();
      if (last && last.cost === 0) g.giveExp(u);
    },
  });
  def('Wild Space Wanderer', 'card', {
    extend: true,
    async whenPlayed(g, u) {
      const cands = [];
      for (const q of [0, 1]) for (const up of g.P(q).base.upgrades) cands.push({ uid: up.uid, card: up.card, q, up });
      if (!cands.length) return;
      const pk = await g.pickCards(u.ctrl, L('可以擊敗基地上的一張升級', 'You may defeat an upgrade on a base'), cands, 0, 1);
      if (!pk.length) return;
      const { q, up } = pk[0];
      const ramp = g.P(q).units.find((x) => x.card.key === 'Vice Admiral Rampart | A New Era of Safety');
      if (ramp && (await g.yesno(q, L('蘭帕特：要改為擊敗蘭帕特嗎？', 'Rampart: defeat Rampart instead?'), { card: ramp.card.key }))) return g.defeat(ramp, { self: true });
      const B = g.P(q).base;
      B.upgrades = B.upgrades.filter((x) => x !== up);
      g.dropUpgrade(up);
      g.log('logDefeat', up.card.n);
    },
  });
  def('Willrow Hood | On the Run', 'card', { extend: true, protectOneUpgrade: true });
  def('Wroshyr Rebel', 'card', { extend: true, static: (g, u) => ({ p: Math.floor(g.P(u.ctrl).resources.length / 2) }) });
  def('Yoda | My Ally is the Force', 'card', {
    async whenPlayed(g, u) {
      if (!g.P(u.ctrl).force) return;
      if (!(await may(g, u.ctrl, u, L('要使用原力，回復一個基地 5 點嗎？', 'Use the Force to heal 5 damage from a base?')))) return;
      g.useForce(u.ctrl);
      const b = await g.pickTarget(u.ctrl, L('回復哪個基地', 'Heal which base'), { bases: [u.ctrl, 1 - u.ctrl], ctx: {} });
      if (b && b.base != null) g.healBase(b.base, 5);
    },
    async onEvent(g, self, ev) {
      if (ev.type !== 'useForce' || ev.p !== self.ctrl || !g.findUnit(self.uid)) return;
      const n = 2 * g.P(self.ctrl).units.length;
      await RUN(g, self.ctrl, self, `you may deal ${n} damage to a unit`, { self });
    },
  });
  def('You Hold This', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('選一個友方非領袖單位交給對手控制', 'Choose a friendly non-leader unit; an opponent takes control of it'), (x) => x.ctrl === p && !g.isLeaderUnit(x), {});
      if (!t) return;
      SWU.FX2.takeControl(g, t, 1 - p);
      const e = await g.pickUnit(p, L('對同區域的另一個單位造成 4 點傷害', 'Deal 4 damage to another unit in the same arena'), (x) => x !== t && x.arena === t.arena, { ctx: { harm: true, op: 'damage', n: 4 } });
      if (e) await g.damageUnit(e, 4, { p });
    },
  });
  def('Zam Wesell | Inconspicuous Assassin', 'card', { extend: true, static: (g, u) => (u.upgrades.length ? { kw: { Grit: true } } : null) });
  passive('Zam Wesell | Not What She Seems'); // 特徵在引擎 hasTrait
  def('Zeb Orrelios | Fists Work Every Time', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('給另一個單位 3 個優勢代幣', 'Give 3 Advantage tokens to another unit'), (x) => x !== u, {});
      if (t) for (let i = 0; i < 3; i++) g.giveToken(t, 'Advantage');
    },
    async onUpgradeDefeated(g, self, up, host) {
      if (host.ctrl !== self.ctrl || !g.findUnit(self.uid)) return;
      const b = await g.pickTarget(self.ctrl, L('對一個基地造成 1 點傷害', 'Deal 1 damage to a base'), { bases: [1 - self.ctrl, self.ctrl], ctx: { harm: true } });
      if (b && b.base != null) g.damageBase(b.base, 1, { p: self.ctrl });
    },
  });
  def('Zuckuss | The Findsman', 'card', {
    async onAttack(g, u) {
      const o = 1 - u.ctrl;
      const nm = await SWU.FX2.nameCard(g, u.ctrl, o, u.card);
      g.log('logNote', `${u.card.n}: ${nm}`);
      const out = mill(g, o, 1);
      if (out.length && out[0].card.n === nm) g.buff(u, 4, 0, 'attack');
    },
  });
  def('Doctor Evazan | Wanted on Twelve Systems', 'card', {
    extend: true,
    bounty(g, snap, collector) {
      let n = 12;
      for (const r of g.P(collector).resources) if (n > 0 && r.exhausted) ((r.exhausted = false), n--);
    },
  });
  // ===================== 第 5 批（輪替系列／TS26）上 =====================
  const smug = (g, uid) => (g.G.playLog || []).some((x) => x.uid === uid && x.from === 'smuggle' && x.round === g.G.round);
  const playedFromHand = (g, uid) => (g.G.playLog || []).some((x) => x.uid === uid && x.from === 'hand' && x.phaseId === g.G.phaseId);
  const hasBounty = (g, u) => {
    const e = g.eff(u);
    return !!((e && e.bounty) || (u.card.kwp && u.card.kwp.Bounty && u.card.kwp.Bounty.length));
  };
  const enemyBounty = (g, p) => g.P(1 - p).units.some((u) => hasBounty(g, u));
  const defeatedNow = (g, pred) => (g.G.defeated || []).some((x) => x.phaseId === g.G.phaseId && pred(x));
  function discardHand(g, p) {
    const P = g.P(p);
    for (const c of [...P.hand]) {
      P.hand = P.hand.filter((x) => x !== c);
      P.discard.push(c);
      g.noteHandDiscard(p, c);
    }
  }
  async function defeatResource(g, p, prompt, optional, filter = () => true) {
    const P = g.P(p);
    const rs = P.resources.filter(filter);
    if (!rs.length) return null;
    const pk = await g.pickCards(p, prompt, rs, optional ? 0 : 1, 1);
    if (!pk.length) return null;
    const r = pk[0];
    P.resources = P.resources.filter((x) => x !== r);
    g.P(r.owner != null ? r.owner : p).discard.push({ uid: r.uid, card: r.card, owner: r.owner != null ? r.owner : p });
    g.log('logDefeat', r.card.n);
    return r;
  }
  const expTo = async (g, p, prompt, filter = () => true, optional = false) => {
    const t = await g.pickUnit(p, prompt, filter, { optional });
    if (t) g.giveExp(t);
    return t;
  };
  const phaseGrant = (g, match, hooks) => (g.G.phaseGrants = g.G.phaseGrants || []).push({ phaseId: g.G.phaseId, match, hooks });

  def('Aggrieved Parliamentarian', 'card', {
    whenPlayed(g, u) {
      const o = 1 - u.ctrl;
      const P = g.P(o);
      const d = P.discard.splice(0);
      bottomRandom(g, o, d);
      g.log('logNote', `${P.name}: discard → deck bottom (${d.length})`);
    },
  });
  def('Altering the Deal', 'card', {
    async event(g, p) {
      const cs = [];
      for (const u of g.P(p).units) for (const c of u.captured || []) cs.push({ uid: c.uid, card: c.card, c, captor: u });
      if (!cs.length) return;
      const pk = await g.pickCards(p, L('棄掉一張友方單位看守的被俘虜卡', 'Discard a captured card guarded by a friendly unit'), cs, 1, 1);
      if (!pk.length) return;
      const { c, captor } = pk[0];
      captor.captured = captor.captured.filter((x) => x !== c);
      g.P(c.owner).discard.push({ uid: c.uid, card: c.card, owner: c.owner });
      g.log('logDefeat', c.card.n);
    },
  });
  def('Barriss Offee | It\'s Only a Matter of Time', 'card', {
    async onEnemyAttack(g, self, atk) {
      if (atk.attacker && g.findUnit(atk.attacker.uid) && (await may(g, self.ctrl, self, L(`要給 ${N(atk.attacker)} 1 個經驗代幣嗎？`, `Give an Experience token to ${atk.attacker.card.n}?`)))) g.giveExp(atk.attacker);
    },
  });
  def('Bendu | The One in the Middle', 'card', {
    onAttack: (g, u) => g.addNext(u.ctrl, { f: (c) => !(c.a || []).includes('Heroism') && !(c.a || []).includes('Villainy'), n: 2, phaseId: g.G.phaseId }),
  });
  const blackOne = async (g, u) => {
    if (!(await may(g, u.ctrl, u, L('要棄掉所有手牌，然後抽 3 張嗎？', 'Discard your hand, then draw 3 cards?')))) return;
    discardHand(g, u.ctrl);
    g.draw(u.ctrl, 3);
  };
  def('Black One | Scourge of Starkiller Base', 'card', { whenPlayed: blackOne, whenDefeated: blackOne });
  def('Boba Fett | Daimyo', 'unit', {
    aura(g, src, u) {
      if (u === src || u.ctrl !== src.ctrl || g._bobaK) return null;
      g._bobaK = true;
      try {
        return Object.keys(g.kw(u)).some((k) => !['SmuggleRaw', 'Bounty'].includes(k) || (k === 'Bounty' && (u.card.kwp.Bounty || []).length)) ? { p: 1 } : null;
      } finally {
        g._bobaK = false;
      }
    },
  });
  def('Boba Fett\'s Armor', 'card', { grantFor: (g, up, host) => (host.card.n === 'Boba Fett' ? { modDamage: (g, u, n) => Math.max(0, n - 2) } : null) });
  def('Bossk | Hunting His Prey', 'unit', {
    async onBountyCollected(g, self, snap, again) {
      if (self.bosskRound === g.G.round) return;
      if (!(await may(g, self.ctrl, self, L('要再領一次這個賞金嗎？', 'Collect that Bounty again?')))) return;
      self.bosskRound = g.G.round;
      await again();
    },
  });
  passive('Brain Invaders');
  def('Brutal Traditions', 'card', { fromDiscard: (g, p) => defeatedNow(g, (x) => x.ctrl !== p) });
  def('C-3P0 | Die, Jedi Dogs!', 'card', {
    whenPlayed(g, u) {
      SWU.FX2.takeControl(g, u, 1 - u.ctrl);
    },
    anyActions: [
      {
        text: L('橫置：對另一個地面單位造成等同這個單位攻擊力的傷害', 'Exhaust: deal damage equal to this unit\'s power to another ground unit'),
        can: (g, u, p) => p !== u.ctrl && !u.exhausted,
        async run(g, u, p) {
          g.exhaust(u);
          const n = g.power(u);
          const t = await g.pickUnit(p, L(`造成 ${n} 點傷害`, `Deal ${n} damage`), (x) => x !== u && x.arena === 'Ground', { ctx: { harm: true, op: 'damage', n } });
          if (t) await g.damageUnit(t, n, { p, self: u });
        },
      },
    ],
  });
  def('Cassian Andor | Rebellions Are Built On Hope', 'card', { whenPlayed: (g, u) => smug(g, u.uid) && g.ready(u) });
  def('Caught in the Crossfire', 'card', {
    async event(g, p) {
      const en = g.P(1 - p).units;
      const a = await g.pickUnit(p, L('選第一個敵方單位', 'Choose the first enemy unit'), (x) => x.ctrl !== p && en.some((y) => y !== x && y.arena === x.arena), { ctx: { harm: true } });
      if (!a) return;
      const b = await g.pickUnit(p, L('選同一區域的第二個敵方單位', 'Choose a second enemy unit in the same arena'), (x) => x.ctrl !== p && x !== a && x.arena === a.arena, { ctx: { harm: true } });
      if (!b) return;
      const pa = g.power(a), pb = g.power(b);
      await g.damageUnit(b, pa, { p, self: a });
      await g.damageUnit(a, pb, { p, self: b });
    },
  });
  def('Chain Code Collector', 'card', { onAttack: (g, u, atk) => atk.defender && hasBounty(g, atk.defender) && g.buff(atk.defender, -4, 0, 'attack') });
  def('Chancellor Palpatine | Wartime Chancellor', 'card', {
    tokensReady: true,
    onAttack(g, u) {
      if ((g.G.left || []).some((x) => x.phaseId === g.G.phaseId) || defeatedNow(g, () => true)) g.createToken(u.ctrl, 'Clone Trooper');
    },
  });
  def('Chancellor Palpatine // Darth Sidious | Playing Both Sides', 'leader', {
    actions: [
      {
        text: L('橫置：抽 1、基地回 2、翻面', 'Exhaust: draw a card, heal 2 from your base, flip'),
        can: (g, Ld) => !Ld.exhausted && !Ld.flipped && defeatedNow(g, (x) => x.ctrl === Ld.ctrl && (x.card.a || []).includes('Heroism')),
        run(g, Ld) {
          Ld.exhausted = true;
          g.draw(Ld.ctrl, 1);
          g.healBase(Ld.ctrl, 2);
          Ld.flipped = true;
          g.log('logNote', 'Darth Sidious');
        },
      },
      {
        text: L('橫置：建立複製人士兵、對敵方基地 2 傷、翻面', 'Exhaust: create a Clone Trooper, 2 damage to each enemy base, flip'),
        can: (g, Ld) => !Ld.exhausted && Ld.flipped && g.G.playedThisPhase[Ld.ctrl].some((c) => (c.a || []).includes('Villainy')),
        run(g, Ld) {
          Ld.exhausted = true;
          g.createToken(Ld.ctrl, 'Clone Trooper');
          g.damageBase(1 - Ld.ctrl, 2, { p: Ld.ctrl });
          Ld.flipped = false;
          g.log('logNote', 'Chancellor Palpatine');
        },
      },
    ],
  });
  def('Chirrut Îmwe | One With the Force', 'unit', { noLethal: (g) => g.G.phase === 'action' });
  def('Clone', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以複製一個非領袖、非載具單位', 'You may copy a non-leader, non-Vehicle unit'), (x) => x !== u && !g.isLeaderUnit(x) && !g.hasTrait(x, 'VEHICLE') && !isTok(x), { optional: true });
      if (!t) return;
      u.origCard = u.origCard || u.card;
      const c = t.origCard || t.card;
      u.card = { ...c, tr: [...new Set([...(c.tr || []), 'CLONE'])], u: false };
      u.arena = c.ar && c.ar.includes('Space') ? 'Space' : 'Ground';
      g.log('logNote', `Clone → ${c.n}`);
      if (g.has(u, 'Shielded')) g.giveShield(u);
      const e = SWU.EFFECTS.get(c, 'card');
      if (e && e.whenPlayed) await e.whenPlayed(g, u);
    },
  });
  def('Confederate Tri-Fighter', 'card', { noBaseHeal: true });
  def('Consolidation of Power', 'card', {
    async event(g, p) {
      const P = g.P(p);
      const us = P.units.map((u) => ({ uid: u.uid, card: u.card }));
      const pk = us.length ? await g.pickCards(p, L('選擇任意數量的友方單位', 'Choose any number of friendly units'), us, 0, us.length) : [];
      const chosen = pk.map((x) => g.findUnit(x.uid)).filter(Boolean);
      const sum = chosen.reduce((a, u) => a + g.power(u), 0);
      const cands = P.hand.filter((c) => c.card.t === 'Unit' && (c.card.c || 0) <= sum);
      if (cands.length) {
        const c = await g.pickCards(p, L(`可以免費打出一個費用 ≤${sum} 的單位`, `You may play a unit costing ${sum} or less for free`), cands, 0, 1);
        if (c.length) await g.playCard(p, c[0].uid, 'hand', { free: true });
      }
      for (const u of chosen) if (g.findUnit(u.uid)) await g.defeat(u, {});
    },
  });
  def('Count Dooku | Face of the Confederacy', 'unit', {
    onAttack: (g, u) => g.addNext(u.ctrl, { f: (c) => g.hasTrait(c, 'SEPARATIST'), kw: { Exploit: 3 }, phaseId: g.G.phaseId }),
  });
  def('Count Dooku | Fallen Jedi', 'card', {
    async whenPlayed(g, u) {
      const ex = g.G.lastExploit && g.G.lastExploit.uid === u.uid ? g.G.lastExploit.powers : [];
      for (const n of ex) {
        if (!n) continue;
        const t = await g.pickUnit(u.ctrl, L(`可以對一個敵方單位造成 ${n} 點傷害`, `You may deal ${n} damage to an enemy unit`), (x) => x.ctrl !== u.ctrl, { optional: true, ctx: { harm: true, op: 'damage', n } });
        if (t) await g.damageUnit(t, n, { p: u.ctrl, self: u });
      }
    },
  });
  def('DJ | Blatant Thief', 'card', {
    async whenPlayed(g, u) {
      if (!smug(g, u.uid)) return;
      const O = g.P(1 - u.ctrl);
      if (!O.resources.length) return;
      const pk = await g.pickCards(u.ctrl, L('取得一個敵方資源的控制權', 'Take control of an enemy resource'), O.resources, 1, 1);
      if (!pk.length) return;
      const r = pk[0];
      if (r.owner == null) r.owner = 1 - u.ctrl;
      O.resources = O.resources.filter((x) => x !== r);
      g.P(u.ctrl).resources.push(r);
      u.djRes = r.uid;
      g.log('logTakeControl', g.P(u.ctrl).name, r.card.n);
    },
    whenLeavesPlay(g, u) {
      if (!u.djRes) return;
      for (const P of g.G.players) {
        const r = P.resources.find((x) => x.uid === u.djRes);
        if (r && P.idx !== r.owner) {
          P.resources = P.resources.filter((x) => x !== r);
          g.P(r.owner).resources.push(r);
        }
      }
    },
  });
  def('Darth Maul | Revenge At Last', 'card', { attackTwo: true });
  def('Del Meeko | Providing Overwatch', 'card', { oppCostAdd: (g, u, card) => (card.t === 'Event' ? 1 : 0) });
  def('Dengar | The Demolisher', 'card', {
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t && g.findUnit(t.uid) && (await may(g, self.ctrl, self, L(`要對 ${N(t)} 造成 1 點傷害嗎？`, `Deal 1 damage to ${t.card.n}?`)))) await g.damageUnit(t, 1, { p: self.ctrl, self });
    },
  });
  def('Doctor Aphra | Rapacious Archaeologist', 'unit', {
    static: (g, u) => (new Set(g.P(u.ctrl).discard.map((c) => c.card.c || 0)).size >= 5 ? { p: 3 } : null),
    async whenDeployed(g, u) {
      const P = g.P(u.ctrl);
      const pick = [];
      for (let i = 0; i < 3; i++) {
        const cs = P.discard.filter((c) => !pick.includes(c) && !pick.some((x) => x.card.n === c.card.n));
        if (!cs.length) break;
        const pk = await g.pickCards(u.ctrl, L(`選第 ${i + 1} 張不同名稱的卡`, `Choose card ${i + 1} with a different name`), cs, 1, 1);
        if (!pk.length) break;
        pick.push(pk[0]);
      }
      if (pick.length < 3) return;
      const c = pick[g.rnd(3)];
      moveDiscardToHand(g, u.ctrl, c.uid);
    },
  });
  const sailer = async (g, u) => {
    if (!(g.G.baseHealed || []).some((x) => x.phaseId === g.G.phaseId)) return;
    await expTo(g, u.ctrl, L('給另一個分離主義單位 1 個經驗代幣', 'Give an Experience token to another Separatist unit'), (x) => x !== u && g.hasTrait(x, 'SEPARATIST'));
  };
  def('Dooku\'s Solar Sailer | Beautiful and Expensive', 'card', { whenPlayed: sailer, onAttack: sailer });
  def('Droid Manufactory | Geonosis', 'card', { onLeaderDeployed: (g, src) => g.createToken(src.ctrl != null ? src.ctrl : src.idx, 'Battle Droid', 2) });
  def('Dryden Vos | Offering No Escape', 'card', {
    async whenPlayed(g, u) {
      const cs = [];
      for (const x of g.P(u.ctrl).units) for (const c of x.captured || []) cs.push({ uid: c.uid, card: c.card, c, captor: x });
      if (!cs.length) return;
      const pk = await g.pickCards(u.ctrl, L('可以免費打出一張你看守的被俘虜卡', 'You may play a captured card you guard for free'), cs, 0, 1);
      if (!pk.length) return;
      const { c, captor } = pk[0];
      captor.captured = captor.captured.filter((x) => x !== c);
      await g.playCard(u.ctrl, c.uid, 'deck', { inst: c, free: true });
    },
  });
  def('Electrostaff', 'card', { grantFor: () => ({ aura: (g, src, u) => (g.G.attack && g.G.attack.defender === src && g.G.attack.attacker === u ? { p: -1 } : null) }) });
  def('Endless Legions', 'card', {
    async event(g, p) {
      const P = g.P(p);
      const us = P.resources.filter((r) => r.card.t === 'Unit');
      const pk = us.length ? await g.pickCards(p, L('展示任意數量的單位資源，依序免費打出', 'Reveal any number of unit resources to play for free'), us, 0, us.length) : [];
      if (pk.length) g.revealCards(p, pk, 'reveal');
      for (const r of pk) if (P.resources.includes(r)) await g.playCard(p, r.uid, 'resource', { free: true });
    },
  });
  def('Enfys Nest | Marauder', 'card', {
    aura: (g, src, u) => {
      const A = g.G.attack;
      return A && A.defender === u && A.attacker && A.attacker.ctrl === src.ctrl && A.opts && A.opts.ambush ? { p: -3 } : null;
    },
  });
  def('Enterprising Lackeys', 'card', {
    async whenDefeated(g, snap) {
      const p = snap.ctrl;
      const r = await defeatResource(g, p, L('可以擊敗一個友方資源，把這個單位放成資源', 'You may defeat a friendly resource to put this unit into play as a resource'), true);
      if (!r) return;
      const O = g.P(snap.owner);
      const c = O.discard.find((x) => x.uid === snap.uid);
      if (!c) return;
      O.discard = O.discard.filter((x) => x !== c);
      g.P(p).resources.push({ ...c, exhausted: true });
      g.log('logNote', `${c.card.n} → resource`);
    },
  });
  def('Entrenched', 'card', { grantFor: () => ({ cantAttackBase: () => true }) });
  def('Evidence of the Crime', 'card', {
    async event(g, p) {
      const ups = [];
      for (const u of g.allUnits()) for (const up of u.upgrades) if (!up.leaderPilot && (up.card.c || 0) <= 3 && !/Token/.test(up.card.t)) ups.push({ uid: up.uid, card: up.card, host: u, up });
      if (!ups.length) return;
      const pk = await g.pickCards(p, L('取得一張費用 ≤3 的升級的控制權', 'Take control of an upgrade that costs 3 or less'), ups, 1, 1);
      if (!pk.length) return;
      const { host, up } = pk[0];
      const ts = g.allUnits().filter((x) => x !== host && (g.upgradeTargets(p, up.card) || []).includes(x));
      const t = ts.length ? await g.pickUnit(p, L('裝到哪個單位', 'Attach it to which unit'), (x) => ts.includes(x), {}) : null;
      if (!t) return;
      host.upgrades = host.upgrades.filter((x) => x !== up);
      up.ctrl = p;
      t.upgrades.push(up);
      g.log('logAttach', up.card.n, t.card.n);
    },
  });
  def('Fenn Rau | Protector of Concord Dawn', 'card', {
    async whenPlayed(g, u) {
      await playUpgradeOn(g, u.ctrl, 'hand', g.P(u.ctrl).hand.filter((c) => c.card.t === 'Upgrade'), () => true, 2, u.card);
    },
    async onFriendlyUpgradePlayed(g, self, up, t) {
      if (t !== self) return;
      const x = await g.pickUnit(self.ctrl, L('給一個敵方單位本階段 -2/-2', 'Give an enemy unit -2/-2 for this phase'), (y) => y.ctrl !== self.ctrl, { ctx: { harm: true } });
      if (x) g.buff(x, -2, -2);
    },
  });
  def('Final Showdown', 'card', {
    event(g, p) {
      for (const u of g.P(p).units) g.ready(u);
      g.delay({ at: 'regroupStart', round: g.G.round, run: (g) => g.winGame(1 - p) });
    },
  });
  def('Finn | On the Run', 'card', {
    async onFriendlyAttackEnd(g, self, atk) {
      if (atk.attacker !== self) return;
      const t = await g.pickUnit(self.ctrl, L('選一個獨特單位：本階段受到的傷害 -1', 'Choose a unique unit: prevent 1 damage dealt to it this phase'), (x) => !!x.card.u, { ctx: { aiFriendly: true } });
      if (t) phaseGrant(g, (g, u) => u.uid === t.uid, { modDamage: (g, u, n) => Math.max(0, n - 1) });
    },
  });
  def('First Legion Snowtrooper', 'card', { static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && g.G.attack.defender.damage > 0 ? { p: 2, kw: { Overwhelm: true } } : null) });
  def('Fives | I Have Proof!', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以借用另一個單位的「進場時」能力', 'You may use the When Played abilities of another unit'), (x) => x !== u && /When Played/i.test(SWU.sideText(x.card, 'card')), { optional: true });
      if (!t) return;
      const e = SWU.EFFECTS.get(t.card, 'card');
      if (e && e.whenPlayed) await e.whenPlayed(g, u);
    },
  });
  def('Foresight', 'card', {
    grantFor: () => ({
      async onRegroupStart(g, self) {
        const p = self.ctrl;
        const P = g.P(p);
        if (!P.deck.length) return;
        const name = await SWU.FX2.nameCard(g, p, p, self.card);
        const top = P.deck[0];
        if (g.io[p] && g.io[p].isHuman) await g.showCards(p, [top], L('牌庫頂', 'Top of your deck'));
        if (top.card.n === name && (await may(g, p, self, L('猜中了！要展示並抽這張嗎？', 'It matches! Reveal and draw it?')))) {
          g.revealCards(p, [top], 'reveal');
          g.draw(p, 1);
        }
      },
    }),
  });
  def('Foundling', 'card', { grantTrait: () => ['MANDALORIAN'] });
  def('General Grievous | Trophy Collector', 'card', {
    upgradeCostOn: (g, u, card, t) => (t === u && g.hasTrait(card, 'LIGHTSABER') ? g.aspectPenalty(u.ctrl, card) : 0),
    async onAttack(g, u) {
      if (u.upgrades.filter((x) => g.hasTrait(x.card, 'LIGHTSABER')).length < 4) return;
      for (let i = 0; i < 4; i++) {
        const t = await g.pickUnit(u.ctrl, L(`擊敗敵方單位（${i + 1}/4）`, `Defeat an enemy unit (${i + 1}/4)`), (x) => x.ctrl !== u.ctrl, { ctx: { harm: true, op: 'defeat' } });
        if (!t) break;
        await g.defeat(t, {});
      }
    },
  });
  auraGrant('General Krell | Heartless Tactician', 'card', {
    auraGrant: (g, src, u) => ({
      async whenDefeated(g, snap) {
        if (await may(g, snap.ctrl, snap.card, L('要抽 1 張卡嗎？', 'Draw a card?'))) g.draw(snap.ctrl, 1);
      },
    }),
  });
  def('General\'s Blade', 'card', { grantFor: (g, up, host) => (g.hasTrait(host, 'JEDI') ? { onAttack: (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit', n: 2, phaseId: g.G.phaseId }) } : null) });
  async function thrawnLook(g, src) {
    const p = src.ctrl;
    if (!(g.io[p] && g.io[p].isHuman)) return;
    for (const q of [p, 1 - p]) if (g.P(q).deck.length) await g.showCards(p, [g.P(q).deck[0]], L(`${g.P(q).name} 的牌庫頂`, `Top of ${g.P(q).name}'s deck`));
  }
  async function thrawnReveal(g, p, card) {
    const q = await pickPlayer(g, p, card, false);
    const top = g.P(q).deck[0] || g.P(1 - q).deck[0];
    if (!top) return;
    g.revealCards(p, [top], 'reveal');
    const n = top.card.c || 0;
    const t = await g.pickUnit(p, L(`橫置一個費用 ≤${n} 的單位`, `Exhaust a unit that costs ${n} or less`), (x) => (x.card.c || 0) <= n && !x.exhausted, { ctx: { harm: true } });
    if (t) g.exhaust(t);
  }
  def('Grand Admiral Thrawn | Patient and Insightful', 'leader', {
    onActionPhaseStart: (g, src) => thrawnLook(g, src),
    actions: [
      {
        text: L('支付 1、橫置：展示牌庫頂，橫置費用不高於它的單位', 'Pay 1, exhaust: reveal a top card and exhaust a unit that costs the same or less'),
        can: (g, Ld) => !Ld.exhausted && g.canPay(Ld.ctrl, 1) && g.P(1 - Ld.ctrl).units.some((x) => !x.exhausted),
        async run(g, Ld) {
          Ld.exhausted = true;
          g.pay(Ld.ctrl, 1);
          await thrawnReveal(g, Ld.ctrl, Ld.card);
        },
      },
    ],
  });
  def('Grand Admiral Thrawn | Patient and Insightful', 'unit', {
    onActionPhaseStart: (g, src) => thrawnLook(g, src),
    async onAttack(g, u) {
      if (await may(g, u.ctrl, u, L('要展示一個牌庫頂並橫置單位嗎？', 'Reveal a top card to exhaust a unit?'))) await thrawnReveal(g, u.ctrl, u.card);
    },
  });
  def('Grievous\'s Wheel Bike', 'card', {
    costOnTarget: (g, p, t) => (t.card.n === 'General Grievous' ? 2 : 0),
    attachedStatic: () => ({ kw: { Overwhelm: true } }),
  });
  def('Han Solo | Audacious Smuggler', 'leader', {
    actions: [
      {
        text: L('橫置：把一張手牌放成資源並重置它；下個行動階段開始時擊敗一個資源', 'Exhaust: resource a card from hand and ready it; defeat a resource at the start of the next action phase'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).hand.length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.ctrl;
          const P = g.P(p);
          const pk = await g.pickCards(p, L('選一張手牌放成資源', 'Choose a card to resource'), P.hand, 1, 1);
          if (!pk.length) return;
          P.hand = P.hand.filter((x) => x !== pk[0]);
          P.resources.push({ ...pk[0], exhausted: false });
          g.log('logResourceThis', pk[0].card.n);
          g.delay({ at: 'actionStart', round: g.G.round + 1, run: async (g) => { await defeatResource(g, p, L('韓索羅：擊敗一個你控制的資源', 'Han Solo: defeat a resource you control'), false); } });
        },
      },
    ],
  });
  def('Han Solo | Reluctant Hero', 'card', { strikeFirst: () => true });
  def('Hondo Ohnaka | That\'s Good Business', 'leader', {
    async onCardPlayed(g, src, info) {
      if (info.p !== src.ctrl || info.from !== 'smuggle' || !g.allUnits().length) return;
      if (await exhaustLeaderMay(g, src, L('要橫置領袖，給一個單位 1 個經驗代幣嗎？', 'Exhaust this leader to give an Experience token to a unit?'))) await expTo(g, src.ctrl, L('給一個單位 1 個經驗代幣', 'Give an Experience token to a unit'));
    },
  });
  def('Hondo Ohnaka | That\'s Good Business', 'unit', {
    async onCardPlayed(g, src, info) {
      if (info.p !== src.ctrl || info.from !== 'smuggle') return;
      await expTo(g, src.ctrl, L('可以給一個單位 1 個經驗代幣', 'You may give an Experience token to a unit'), () => true, true);
    },
  });
  def('Hotshot DL-44 Blaster', 'card', {
    async whenPlayed(g, inst, t) {
      if (t && smug(g, inst.uid) && g.findUnit(t.uid) && !t.exhausted) await g.attack(t);
    },
  });
  async function hunterRes(g, p, card, optional) {
    const P = g.P(p);
    const uq = new Set(P.units.filter((u) => u.card.u).map((u) => u.card.n));
    const rs = P.resources.filter((r) => uq.has(r.card.n));
    if (!rs.length) return;
    const pk = await g.pickCards(p, L('展示一個和友方獨特單位同名的資源', 'Reveal a resource that shares a name with a friendly unique unit'), rs, optional ? 0 : 1, 1);
    if (!pk.length) return;
    const r = pk[0];
    g.revealCards(p, [r], 'reveal');
    P.resources = P.resources.filter((x) => x !== r);
    g.P(r.owner != null ? r.owner : p).hand.push({ uid: r.uid, card: r.card, owner: r.owner != null ? r.owner : p });
    if (P.deck.length) P.resources.push({ ...P.deck.shift(), exhausted: true });
    g.log('logReturnHand', r.card.n);
  }
  def('Hunter | Outcast Sergeant', 'leader', {
    actions: [
      {
        text: L('支付 1、橫置：展示一個和友方獨特單位同名的資源，換成牌庫頂', 'Pay 1, exhaust: swap a resource sharing a name with a friendly unique unit for your top card'),
        can: (g, Ld) => !Ld.exhausted && g.canPay(Ld.ctrl, 1) && g.P(Ld.ctrl).resources.some((r) => g.P(Ld.ctrl).units.some((u) => u.card.u && u.card.n === r.card.n)),
        async run(g, Ld) {
          Ld.exhausted = true;
          g.pay(Ld.ctrl, 1);
          await hunterRes(g, Ld.ctrl, Ld.card, false);
        },
      },
    ],
  });
  def('Hunter | Outcast Sergeant', 'unit', { onAttack: (g, u) => hunterRes(g, u.ctrl, u.card, true) });
  def('Hunter of the Haxion Brood', 'card', { static: (g, u) => (enemyBounty(g, u.ctrl) ? { kw: { Shielded: true } } : null) });
  def('IG-11 | I Cannot Be Captured', 'card', {
    async replaceCapture(g, u) {
      const p = u.ctrl;
      await g.defeat(u, { self: true });
      for (const x of g.P(1 - p).units.filter((y) => y.arena === 'Ground')) await g.damageUnit(x, 3, { p });
    },
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以對一個受傷的地面單位造成 3 點傷害', 'You may deal 3 damage to a damaged ground unit'), (x) => x.arena === 'Ground' && x.damage > 0, { optional: true, ctx: { harm: true, op: 'damage', n: 3 } });
      if (t) await g.damageUnit(t, 3, { p: u.ctrl, self: u });
    },
  });
  passive('Imprisoned');
  def('Incinerator Trooper', 'card', { strikeFirst: () => true });
  const jabbaGrant = (g, p, n) => async (g, Ld) => {
    const t = await g.pickUnit(Ld.ctrl, L(`選一個單位：本階段獲得「賞金：下一個單位少 ${n} 費」`, `Choose a unit: it gains "Bounty - The next unit you play this phase costs ${n} less" this phase`), () => true, {});
    if (t) phaseGrant(g, (g, u) => u.uid === t.uid, { bounty: (g, snap, collector) => g.addNext(collector, { f: (c) => c.t === 'Unit', n, phaseId: g.G.phaseId }) });
  };
  def('Jabba the Hutt | His High Exaltdeness', 'leader', {
    actions: [
      {
        text: L('橫置：讓一個單位本階段獲得賞金（下一個單位少 1 費）', 'Exhaust: a unit gains a Bounty this phase (next unit costs 1 less)'),
        can: (g, Ld) => !Ld.exhausted && g.allUnits().length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          await jabbaGrant(g, Ld.ctrl, 1)(g, Ld);
        },
      },
    ],
  });
  def('Jabba the Hutt | His High Exaltdeness', 'unit', {
    async whenDeployed(g, u) {
      const c = await g.pickUnit(u.ctrl, L('選另一個友方單位來俘虜', 'Choose another friendly unit to capture'), (x) => x.ctrl === u.ctrl && x !== u, {});
      if (!c) return;
      const t = await g.pickUnit(u.ctrl, L('選一個敵方非領袖單位被俘虜', 'Choose an enemy non-leader unit to capture'), (x) => x.ctrl !== u.ctrl && !g.isLeaderUnit(x), { ctx: { harm: true } });
      if (t) g.capture(c, t);
    },
    actions: [
      {
        text: L('橫置：讓一個單位本階段獲得賞金（下一個單位少 2 費）', 'Exhaust: a unit gains a Bounty this phase (next unit costs 2 less)'),
        can: (g, u) => !u.exhausted,
        async run(g, u) {
          g.exhaust(u);
          await jabbaGrant(g, u.ctrl, 2)(g, u);
        },
      },
    ],
  });
  const jangoTrig = (g, src, ev) => ev.type === 'damage' && ev.u && ev.ctrl !== src.ctrl && ev.dealer && ev.dealer.ctrl === src.ctrl && g.findUnit(ev.u.uid) && !ev.u.exhausted;
  def('Jango Fett | Concealing the Conspiracy', 'leader', {
    async onEvent(g, src, ev) {
      if (!jangoTrig(g, src, ev)) return;
      if (await exhaustLeaderMay(g, src, L(`要橫置領袖，橫置 ${N(ev.u)} 嗎？`, `Exhaust this leader to exhaust ${ev.u.card.n}?`))) g.exhaust(ev.u);
    },
  });
  def('Jango Fett | Concealing the Conspiracy', 'unit', {
    async onEvent(g, src, ev) {
      if (jangoTrig(g, src, ev) && (await may(g, src.ctrl, src, L(`要橫置 ${N(ev.u)} 嗎？`, `Exhaust ${ev.u.card.n}?`)))) g.exhaust(ev.u);
    },
  });
  def('Jango Fett | Guarding the Count', 'card', {
    static: (g, u) => ((g.G.attackedBase || [[], []])[u.ctrl].length ? { kw: { Ambush: true } } : null),
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('給一個敵方單位本階段 -3/-0', 'Give an enemy unit -3/-0 for this phase'), (x) => x.ctrl !== u.ctrl, { ctx: { harm: true } });
      if (t) g.buff(t, -3, 0);
    },
  });
  def('Jango Fett | Renowned Bounty Hunter', 'card', {
    static: (g, u) => (g.G.attack && g.G.attack.attacker === u && g.G.attack.defender && hasBounty(g, g.G.attack.defender) ? { p: 3, kw: { Overwhelm: true } } : null),
    onAttackDefeat: (g, u) => g.draw(u.ctrl, 1),
  });
  def('Jyn Erso | Resisting Oppression', 'unit', { aura: (g, src, u) => (g.G.attack && g.G.attack.defender === u && g.G.attack.attacker && g.G.attack.attacker.ctrl === src.ctrl ? { p: -1 } : null) });
  def('Ki-Adi-Mundi | Composed and Confident', 'card', {
    async onEnemyPlay(g, self) {
      if (g.G.playedThisPhase[1 - self.ctrl].length !== 2 || g.P(self.ctrl).units.length < 3) return;
      if (await may(g, self.ctrl, self, L('要抽 2 張卡嗎？', 'Draw 2 cards?'))) g.draw(self.ctrl, 2);
    },
  });
  def('Kragan Gorr | Warbird Captain', 'card', {
    async onEnemyAttack(g, self, atk) {
      if (!atk.base || !atk.attacker) return;
      const ar = atk.attacker.arena;
      const t = await g.pickUnit(self.ctrl, L('給同區域的一個友方單位 1 個護盾', 'Give a Shield token to a friendly unit in the same arena'), (x) => x.ctrl === self.ctrl && x.arena === ar, {});
      if (t) g.giveShield(t);
    },
  });
  def('Krayt Dragon', 'card', {
    async onEnemyPlay(g, self, card) {
      const n = card.c || 0;
      if (!n) return;
      const o = 1 - self.ctrl;
      const t = await g.pickTarget(self.ctrl, L(`可以對對手的基地或地面單位造成 ${n} 點傷害`, `You may deal ${n} damage to their base or a ground unit they control`), { units: g.P(o).units.filter((x) => x.arena === 'Ground'), bases: [o], optional: true, ctx: { harm: true, op: 'damage', n } });
      if (!t) return;
      if (t.base != null) g.damageBase(o, n, { p: self.ctrl });
      else if (t.unit) await g.damageUnit(t.unit, n, { p: self.ctrl, self });
    },
  });
  def('Krrsantan | Muscle for Hire', 'card', {
    async whenPlayed(g, u) {
      if (enemyBounty(g, u.ctrl) && (await may(g, u.ctrl, u, L('要重置這個單位嗎？', 'Ready this unit?')))) g.ready(u);
    },
    async onAttack(g, u) {
      const n = u.damage;
      if (!n) return;
      const t = await g.pickUnit(u.ctrl, L(`可以對一個地面單位造成 ${n} 點傷害`, `You may deal ${n} damage to a ground unit`), (x) => x.arena === 'Ground', { optional: true, ctx: { harm: true, op: 'damage', n } });
      if (t) await g.damageUnit(t, n, { p: u.ctrl, self: u });
    },
  });
  const controls = (g, p, name) => g.P(p).units.some((u) => u.card.n === name) || (g.P(p).leader.card.n === name && !g.P(p).leader.deployed);
  const ignoreAspFor = (asp, other) => (g, p) => {
    const c = cardOf(asp === 'Villainy' ? 'Kylo Ren | Killing the Past' : 'Rey | Keeping the Past');
    if (!c || !controls(g, p, other)) return 0;
    return -(g.aspectPenalty(p, c) - g.aspectPenalty(p, c, [asp]));
  };
  def('Kylo Ren | Killing the Past', 'card', {
    costMod: ignoreAspFor('Villainy', 'Rey'),
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('給一個單位本階段 +2/+0', 'Give a unit +2/+0 for this phase'), () => true, {});
      if (!t) return;
      g.buff(t, 2, 0);
      if (!(t.card.a || []).includes('Villainy')) g.giveExp(t);
    },
  });
  def('Kylo Ren | Rash and Deadly', 'leader', {
    actions: [
      {
        text: L('橫置、棄 1 張手牌：給一個單位本階段 +2/+0', 'Exhaust, discard a card: give a unit +2/+0 for this phase'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.ctrl).hand.length > 0 && g.P(Ld.ctrl).units.length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          await g.discardFromHand(Ld.ctrl, 1);
          const t = await g.pickUnit(Ld.ctrl, L('給一個單位本階段 +2/+0', 'Give a unit +2/+0 for this phase'), () => true, {});
          if (t) g.buff(t, 2, 0);
        },
      },
    ],
  });
  def('Kylo\'s TIE Silencer | Ruthlessly Efficient', 'card', {
    fromDiscard: (g, p, c) => (g.G.discardLog || []).some((x) => x.uid === c.uid && x.phaseId === g.G.phaseId && (x.from === 'hand' || x.from === 'deck')),
  });
  def('Lando Calrissian | Responsible Businessman', 'card', {
    async whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      if (!P.resources.length) return;
      const pk = await g.pickCards(u.ctrl, L('可以把最多 2 個友方資源收回擁有者手牌', 'Return up to 2 friendly resources to their owners\' hands'), P.resources, 0, 2);
      for (const r of pk) {
        P.resources = P.resources.filter((x) => x !== r);
        const o = r.owner != null ? r.owner : u.ctrl;
        g.P(o).hand.push({ uid: r.uid, card: r.card, owner: o });
        g.log('logReturnHand', r.card.n);
      }
    },
  });
  async function landoSmuggle(g, p) {
    const P = g.P(p);
    const rs = P.resources.filter((r) => g.smuggleCost(p, r.card) != null && ['Unit', 'Event', 'Upgrade'].includes(r.card.t) && g.canPay(p, Math.max(0, g.costOf(p, r.card, { baseCost: g.smuggleCost(p, r.card), from: 'smuggle' }) - 2)));
    if (!rs.length) return;
    const pk = await g.pickCards(p, L('用 Smuggle 打出一張（少 2 費）', 'Play a card using Smuggle (2 less)'), rs, 0, 1);
    if (!pk.length) return;
    await g.playCard(p, pk[0].uid, 'smuggle', { discount: 2 });
    const own = P.resources.filter((r) => r.owner == null || r.owner === p);
    if (own.length) await defeatResource(g, p, L('擊敗一個你擁有並控制的資源', 'Defeat a resource you own and control'), false, (r) => r.owner == null || r.owner === p);
  }
  const landoCan = (g, p) => g.P(p).resources.some((r) => g.smuggleCost(p, r.card) != null);
  def('Lando Calrissian | With Impeccable Taste', 'leader', {
    actions: [
      {
        text: L('橫置：用 Smuggle 打出一張卡（少 2 費），再擊敗一個資源', 'Exhaust: play a card using Smuggle (2 less), then defeat a resource'),
        can: (g, Ld) => !Ld.exhausted && landoCan(g, Ld.ctrl),
        async run(g, Ld) {
          Ld.exhausted = true;
          await landoSmuggle(g, Ld.ctrl);
        },
      },
    ],
  });
  def('Lando Calrissian | With Impeccable Taste', 'unit', {
    actions: [
      {
        text: L('用 Smuggle 打出一張卡（少 2 費），再擊敗一個資源（每輪一次）', 'Play a card using Smuggle (2 less), then defeat a resource (once per round)'),
        can: (g, u) => u.landoRound !== g.G.round && landoCan(g, u.ctrl),
        async run(g, u) {
          u.landoRound = g.G.round;
          await landoSmuggle(g, u.ctrl);
        },
      },
    ],
  });
  def('Lom Pyke | Making a Withdrawal', 'card', {
    async whenPlayed(g, u) {
      const o = 1 - u.ctrl;
      if (!g.P(o).base.damage) return;
      if (!(await g.yesno(o, L('Lom Pyke：要讓你的基地回復 5 點嗎？（對手可以給 2 個經驗代幣）', 'Lom Pyke: heal 5 damage from your base? (the opponent gives 2 Experience tokens)'), { card: u.card.key, aiNo: g.P(o).base.damage < 12 }))) return;
      g.healBase(o, 5);
      const t = await g.pickUnit(u.ctrl, L('給一個單位 2 個經驗代幣', 'Give 2 Experience tokens to a unit'), () => true, {});
      if (t) g.giveExp(t, 2);
    },
  });
  def('Lurking TIE Phantom', 'card', {
    cantBeCapturedBy: (g, u, captor) => !captor || captor.ctrl !== u.ctrl,
    modDamage: (g, u, n, src) => (enemyAbility(g, u, src || {}) ? 0 : n),
    cantBeDefeatedBy: (g, u, why) => noEnemyDefeat(g, u, why || {}),
  });
  def('Lux Bonteri | Renegade Separatist', 'card', {
    async onEnemyPlay(g, self, card) {
      const lg = (g.G.playLog || [])[(g.G.playLog || []).length - 1];
      if (!lg || lg.card !== card || lg.cost >= (card.c || 0)) return;
      const t = await g.pickUnit(self.ctrl, L('選一個單位重置或橫置', 'Choose a unit to ready or exhaust'), () => true, {});
      if (!t) return;
      const i = await g.pickOption(self.ctrl, L(`${N(t)}：`, `${t.card.n}:`), [L('重置', 'Ready'), L('橫置', 'Exhaust')], { ctx: { aiPick: t.ctrl === self.ctrl ? 0 : 1 } });
      if (i === 1) g.exhaust(t);
      else g.ready(t);
    },
  });
  def('Maul | Shadow Collective Visionary', 'card', {
    async onAttack(g, u, atk) {
      const t = await g.pickUnit(u.ctrl, L('可以選另一個友方地下社會單位承受這次攻擊的傷害', 'You may choose another friendly Underworld unit to take the damage for this attack'), (x) => x !== u && x.ctrl === u.ctrl && g.hasTrait(x, 'UNDERWORLD'), { optional: true });
      if (t) u.maulRedirect = { attackId: atk.id, uid: t.uid };
    },
    async preventDamage(g, s, u, n, src) {
      if (u !== s || !s.maulRedirect || !g.G.attack || g.G.attack.id !== s.maulRedirect.attackId) return false;
      const t = g.findUnit(s.maulRedirect.uid);
      if (!t) return false;
      await g.damageUnit(t, n, src || {});
      return true;
    },
  });
  def('Mechanize', 'card', {
    async event(g, p) {
      const r = await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.card.t === 'Unit' && !g.hasTrait(c.card, 'VEHICLE')), cardOf('Mechanize'), { prompt: L('從棄牌堆打出一個非載具單位（付費）', 'play a non-Vehicle unit from your discard pile (paying its cost)') });
      if (r && r.uid && g.findUnit(r.uid)) g.giveExp(g.findUnit(r.uid));
    },
  });
  def('Mercenary Gunship', 'card', {
    anyActions: [
      {
        text: L('支付 4：取得這個單位的控制權', 'Pay 4: take control of this unit'),
        can: (g, u, p) => p !== u.ctrl && g.canPay(p, 4),
        run(g, u, p) {
          g.pay(p, 4);
          SWU.FX2.takeControl(g, u, p);
        },
      },
    ],
  });
  def('Migs Mayfeld | Triggerman', 'card', {
    async onEvent(g, self, ev) {
      if (ev.type !== 'discarded' || ev.from !== 'hand' || self.migsRound === g.G.round || !g.findUnit(self.uid)) return;
      const t = await g.pickTarget(self.ctrl, L('可以對一個單位或基地造成 2 點傷害', 'You may deal 2 damage to a unit or base'), { units: g.allUnits(), bases: [1 - self.ctrl, self.ctrl], optional: true, ctx: { harm: true, op: 'damage', n: 2 } });
      if (!t) return;
      self.migsRound = g.G.round;
      if (t.base != null) g.damageBase(t.base, 2, { p: self.ctrl });
      else if (t.unit) await g.damageUnit(t.unit, 2, { p: self.ctrl, self });
    },
  });
  def('Millennium Falcon | Lando\'s Pride', 'card', { static: (g, u) => (u.playedPhase === g.G.phaseId && playedFromHand(g, u.uid) ? { kw: { Ambush: true } } : null) });
  def('Millennium Falcon | Piece Of Junk', 'card', {
    entersReady: true,
    async onRegroupReady(g, self) {
      if (g.canPay(self.ctrl, 1) && (await may(g, self.ctrl, self, L('要支付 1 讓她留在場上嗎？（不付就回手牌）', 'Pay 1 to keep her in play? (otherwise return her to hand)')))) g.pay(self.ctrl, 1);
      else g.returnToHand(self);
    },
  });
  def('Moff Gideon | Formidable Commander', 'unit', {
    aura: (g, src, u) => (u.ctrl === src.ctrl && (u.card.c || 0) <= 3 && !g.isLeaderUnit(u) && g.G.attack && g.G.attack.attacker === u && g.G.attack.defender ? { p: 1, kw: { Overwhelm: true } } : null),
  });
  def('Moralo Eval | Infamous Murderer', 'card', {
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || ev.base !== self.ctrl || !ev.combat || !g.findUnit(self.uid)) return;
      const t = await g.pickUnit(self.ctrl, L('可以對一個單位造成 1 點傷害', 'You may deal 1 damage to a unit'), () => true, { optional: true, ctx: { harm: true, op: 'damage', n: 1 } });
      if (t) await g.damageUnit(t, 1, { p: self.ctrl, self });
    },
  });
  const nalaPen = (g, src, card) => card.t === 'Unit' && g.hasTrait(card, 'CLONE');
  def('Nala Se | Clone Engineer', 'leader', { ignorePenalty: nalaPen });
  auraGrant('Nala Se | Clone Engineer', 'unit', {
    ignorePenalty: nalaPen,
    auraGrant: (g, src, u) => (g.hasTrait(u, 'CLONE') ? { whenDefeated: (g, snap) => g.healBase(snap.ctrl, 2) } : null),
  });
  const neel = (g, u) => g.addNext(u.ctrl, { f: (c) => c.t === 'Unit' && (c.p || 0) <= 1, ready: true, phaseId: g.G.phaseId });
  def('Neel | The Cutest Boy', 'card', { whenPlayed: neel, onAttack: neel });
  // ===================== 第 5 批（輪替系列／TS26）下 =====================
  const leaderUnits = (g, p) => g.P(p).units.filter((u) => u.isLeader).length;
  const toResource = (g, p, c, ready) => {
    g.P(p).resources.push({ uid: c.uid, card: c.card, owner: c.owner != null ? c.owner : p, exhausted: !ready });
    g.log('logResourceThis', c.card.n);
  };
  const takeFromDiscard = (g, owner, uid) => {
    const P = g.P(owner);
    const c = P.discard.find((x) => x.uid === uid);
    if (c) P.discard = P.discard.filter((x) => x !== c);
    return c;
  };
  const dmgPick = async (g, p, n, prompt, filter, optional, self) => {
    const t = await g.pickUnit(p, prompt, filter, { optional, ctx: { harm: true, op: 'damage', n } });
    if (t) await g.damageUnit(t, n, { p, self });
    return t;
  };
  def('Omega | Part of the Squad', 'card', {
    ignorePenalty: (g, src, card) => card.t === 'Unit' && g.hasTrait(card, 'CLONE') && firstThisRound(g, src.ctrl, (c) => c.t === 'Unit' && g.hasTrait(c, 'CLONE')),
    whenPlayed: (g, u) => RUN(g, u.ctrl, u.card, 'search the top 5 cards of your deck for a Clone card, reveal it, and draw it'),
  });
  pre('search the top 5 cards of your deck for a Clone card, reveal it, and draw it');
  def('On Top of Things', 'card', {
    whenPlayed(g, inst, t) {
      if (t) phaseGrant(g, (g, u) => u.uid === t.uid, { cantBeAttackedBy: () => true });
    },
  });
  def('Palpatine\'s Return', 'card', {
    async event(g, p) {
      const P = g.P(p);
      const disc = (c) => (g.hasTrait(c.card, 'FORCE') ? 8 : 6);
      const cs = P.discard.filter((c) => c.card.t === 'Unit' && g.canPay(p, Math.max(0, g.costOf(p, c.card) - disc(c))));
      if (!cs.length) return;
      const pk = await g.pickCards(p, L('從棄牌堆打出一個單位（少 6 費；原力單位少 8 費）', 'Play a unit from your discard pile (6 less; Force: 8 less)'), cs, 0, 1);
      if (pk.length) await g.playCard(p, pk[0].uid, 'discard', { discount: disc(pk[0]) });
    },
  });
  def('Phase-III Dark Trooper', 'card', {
    onEvent(g, self, ev) {
      if (ev.type === 'damage' && ev.u === self && ev.combat && g.findUnit(self.uid)) g.giveExp(self);
    },
  });
  def('Planetary Invasion', 'card', {
    async event(g, p) {
      const us = g.allUnits().map((u) => ({ uid: u.uid, card: u.card }));
      const pk = us.length ? await g.pickCards(p, L('重置最多 3 個單位（+1/+0、Overwhelm）', 'Ready up to 3 units (+1/+0 and Overwhelm)'), g.P(p).units.map((u) => ({ uid: u.uid, card: u.card })), 0, 3) : [];
      for (const x of pk) {
        const u = g.findUnit(x.uid);
        if (!u) continue;
        g.ready(u);
        g.buff(u, 1, 0, 'phase', { Overwhelm: true });
      }
    },
  });
  async function preVizsla(g, u) {
    const ups = [];
    for (const h of g.allUnits()) if (h !== u && !g.hasTrait(h, 'VEHICLE')) for (const up of h.upgrades) if (!up.leaderPilot && !/Token/.test(up.card.t) && g.canPay(u.ctrl, up.card.c || 0)) ups.push({ uid: up.uid, card: up.card, host: h, up });
    if (!ups.length) return;
    const pk = await g.pickCards(u.ctrl, L('可以支付一張升級的費用，把它搶過來裝到這個單位', 'You may pay an upgrade\'s cost to take it and attach it to this unit'), ups, 0, 1);
    if (!pk.length) return;
    const { host, up } = pk[0];
    g.pay(u.ctrl, up.card.c || 0);
    host.upgrades = host.upgrades.filter((x) => x !== up);
    if (g.findUnit(u.uid) && (g.upgradeTargets(u.ctrl, up.card) || []).includes(u)) {
      up.ctrl = u.ctrl;
      u.upgrades.push(up);
      g.log('logAttach', up.card.n, u.card.n);
    } else {
      g.dropUpgrade(up, host);
      g.log('logDefeat', up.card.n);
    }
  }
  def('Pre Vizsla | Power Hungry', 'card', { whenPlayed: preVizsla, onAttack: preVizsla });
  def('Pre Vizsla | Pursuing the Throne', 'unit', {
    static: (g, u) => {
      const n = g.P(u.ctrl).hand.length;
      return n >= 3 ? { p: n >= 6 ? 2 : 0, kw: { Saboteur: true } } : null;
    },
  });
  def('Privateer Crew', 'card', { whenPlayed: (g, u) => smug(g, u.uid) && g.giveExp(u, 3) });
  def('Pyrrhic Assault', 'card', {
    event(g, p) {
      phaseGrant(g, (g, u) => u.ctrl === p, {
        async whenDefeated(g, snap) {
          await dmgPick(g, snap.ctrl, 2, L('對一個敵方單位造成 2 點傷害', 'Deal 2 damage to an enemy unit'), (x) => x.ctrl !== snap.ctrl, false);
        },
      });
    },
  });
  def('Qi\'ra | I Alone Survived', 'unit', {
    async whenDeployed(g, u) {
      for (const x of g.allUnits()) if (x.damage) g.heal(x, x.damage);
      for (const x of g.allUnits()) {
        const n = Math.floor(g.remaining(x) / 2);
        if (n) await g.damageUnit(x, n, { p: u.ctrl, self: u });
      }
    },
  });
  def('Regional Governor', 'card', {
    async whenPlayed(g, u) {
      const name = await SWU.FX2.nameCard(g, u.ctrl, 1 - u.ctrl, u.card);
      if (name) (g.G.named = g.G.named || []).push({ kind: 'ban', name, victim: 1 - u.ctrl, src: u.uid });
    },
  });
  def('Relentless | Konstantine\'s Folly', 'card', { blankFirstEvent: true });
  def('Republic Defense Carrier', 'card', { costMod: (g, p) => -g.P(1 - p).units.length });
  def('Reputable Hunter', 'card', { costMod: (g, p) => (enemyBounty(g, p) ? -1 : 0) });
  async function resolute(g, u) {
    const t = await g.pickUnit(u.ctrl, L('對一個敵方單位（及同名的其他敵方單位）造成 2 點傷害', 'Deal 2 damage to an enemy unit and each other enemy unit with the same name'), (x) => x.ctrl !== u.ctrl, { ctx: { harm: true, op: 'damage', n: 2 } });
    if (!t) return;
    const all = g.P(1 - u.ctrl).units.filter((x) => x.card.n === t.card.n);
    for (const x of all) await g.damageUnit(x, 2, { p: u.ctrl, self: u });
  }
  def('Resolute | Under Anakin\'s Command', 'card', { costMod: (g, p) => -Math.floor(g.P(p).base.damage / 5), whenPlayed: resolute, onAttack: resolute });
  def('Restock', 'card', {
    async event(g, p) {
      const q = await pickPlayer(g, p, cardOf('Restock'), false);
      const Q = g.P(q);
      if (!Q.discard.length) return;
      const pk = await g.pickCards(p, L('選最多 4 張卡放到牌庫底', 'Choose up to 4 cards to put on the bottom of the deck'), Q.discard, 0, 4);
      Q.discard = Q.discard.filter((x) => !pk.includes(x));
      bottomRandom(g, q, pk);
    },
  });
  const nextEvent = (g, p, n) => g.addNext(p, { f: (c) => c.t === 'Event', n, phaseId: g.G.phaseId });
  def('Rex | No Other Option', 'leader', {
    actions: [
      {
        text: L('橫置、重置一個橫置的敵方單位：下一張事件少 1 費', 'Exhaust, ready an exhausted enemy unit: your next event costs 1 less'),
        can: (g, Ld) => !Ld.exhausted && g.P(1 - Ld.ctrl).units.some((x) => x.exhausted) && g.P(Ld.ctrl).hand.some((c) => c.card.t === 'Event'),
        async run(g, Ld) {
          Ld.exhausted = true;
          const t = await g.pickUnit(Ld.ctrl, L('重置一個橫置的敵方單位', 'Ready an exhausted enemy unit'), (x) => x.ctrl !== Ld.ctrl && x.exhausted, {});
          if (!t) return;
          g.ready(t);
          nextEvent(g, Ld.ctrl, 1);
        },
      },
    ],
  });
  def('Rex | No Other Option', 'unit', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以重置一個橫置的敵方單位（下一張事件少 2 費）', 'You may ready an exhausted enemy unit (your next event costs 2 less)'), (x) => x.ctrl !== u.ctrl && x.exhausted, { optional: true, ctx: { aiNo: true } });
      if (!t) return;
      g.ready(t);
      nextEvent(g, u.ctrl, 2);
    },
  });
  def('Rex\'s DC-17s', 'card', {
    grantFor: () => ({
      onAnyReadied(g, self, u) {
        if (g.G.phase !== 'action' || u.ctrl === self.ctrl || self.dc17Round === g.G.round || !self.exhausted) return;
        self.dc17Round = g.G.round;
        g.ready(self);
      },
    }),
  });
  def('Rey | Keeping the Past', 'card', {
    costMod: ignoreAspFor('Heroism', 'Kylo Ren'),
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以回復一個單位 2 點傷害', 'You may heal 2 damage from a unit'), (x) => x.damage > 0, { optional: true });
      if (!t) return;
      g.heal(t, 2);
      if (!(t.card.a || []).includes('Heroism')) g.giveShield(t);
    },
  });
  def('Roger Roger', 'card', {
    upWhenDefeated(g, up) {
      const p = up.ctrl != null ? up.ctrl : up.owner;
      const ts = g.P(p).units.filter((x) => isTok(x) && x.card.n === 'Battle Droid');
      if (!ts.length) return;
      const c = takeFromDiscard(g, up.owner, up.uid);
      if (!c) return;
      const t = ts[0];
      t.upgrades.push({ uid: c.uid, card: c.card, owner: c.owner });
      g.log('logAttach', c.card.n, t.card.n);
    },
  });
  def('Rose Tico | Dedicated to the Cause', 'card', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以擊敗一個友方單位的護盾，給它 2 個經驗代幣', 'You may defeat a Shield on a friendly unit to give it 2 Experience tokens'), (x) => x.ctrl === u.ctrl && x.upgrades.some((y) => y.card.n === 'Shield'), { optional: true });
      if (!t) return;
      const sh = t.upgrades.find((y) => y.card.n === 'Shield');
      t.upgrades = t.upgrades.filter((y) => y !== sh);
      g.giveExp(t, 2);
    },
  });
  def('Rukh | Thrawn\'s Assassin', 'card', {
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || !ev.combat || !ev.u || ev.dealer !== self || ev.u.ctrl === self.ctrl) return;
      if (g.findUnit(ev.u.uid) && !g.isLeaderUnit(ev.u)) await g.defeat(ev.u, {});
    },
  });
  def('Rush Clovis | Banking Clan Scion', 'card', { onAttack: (g, u) => !g.readyResources(1 - u.ctrl) && g.createToken(u.ctrl, 'Battle Droid') });
  def('Sabine Wren | Explosives Artist', 'card', {
    cantBeAttackedBy: (g, u) => new Set(g.P(u.ctrl).units.filter((x) => x !== u).flatMap((x) => x.card.a || [])).size >= 3,
    async onAttack(g, u, atk) {
      const t = await g.pickTarget(u.ctrl, L('可以對防守者或一個基地造成 1 點傷害', 'You may deal 1 damage to the defender or a base'), { units: atk.defender ? [atk.defender] : [], bases: [1 - u.ctrl, u.ctrl], optional: true, ctx: { harm: true, op: 'damage', n: 1 } });
      if (!t) return;
      if (t.base != null) g.damageBase(t.base, 1, { p: u.ctrl });
      else if (t.unit) await g.damageUnit(t.unit, 1, { p: u.ctrl, self: u });
    },
  });
  def('Sabine Wren | You Can Count On Me', 'card', {
    cantBeAttackedBy: (g, u) => u.exhausted,
    async onAttack(g, u) {
      if (!g.P(u.ctrl).deck.length || !(await may(g, u.ctrl, u, L('要棄掉牌庫頂 1 張嗎？', 'Discard the top card of your deck?')))) return;
      const [c] = g.mill(u.ctrl, 1);
      const ba = g.P(u.ctrl).base.card.a || [];
      if (c && !(c.card.a || []).some((a) => ba.includes(a))) await dmgPick(g, u.ctrl, 2, L('對一個地面單位造成 2 點傷害', 'Deal 2 damage to a ground unit'), (x) => x.arena === 'Ground', false, u);
    },
  });
  def('Salacious Crumb | Obnoxious Pet', 'card', {
    whenPlayed: (g, u) => g.healBase(u.ctrl, 1),
    actions: [
      {
        text: L('橫置、把這個單位收回手牌：對一個地面單位造成 1 點傷害', 'Exhaust, return this unit to hand: deal 1 damage to a ground unit'),
        can: (g, u) => !u.exhausted && g.allUnits().some((x) => x !== u && x.arena === 'Ground' && x.ctrl !== u.ctrl),
        async run(g, u) {
          const p = u.ctrl;
          g.exhaust(u);
          g.returnToHand(u);
          await dmgPick(g, p, 1, L('對一個地面單位造成 1 點傷害', 'Deal 1 damage to a ground unit'), (x) => x.arena === 'Ground', false);
        },
      },
    ],
  });
  SWU.GLOBAL_GRANT.add('Satine Kryze | Committed to Peace');
  def('Satine Kryze | Committed to Peace', 'card', {
    globalGrant: () => ({
      actions: [
        {
          text: L('橫置：棄掉對手牌庫頂（剩餘血量一半，無條件進位）', 'Exhaust: discard cards from an opponent\'s deck equal to half this unit\'s remaining HP, rounded up'),
          can: (g, u) => !u.exhausted && g.P(1 - u.ctrl).deck.length > 0,
          run(g, u) {
            g.exhaust(u);
            g.mill(1 - u.ctrl, Math.ceil(g.remaining(u) / 2));
          },
        },
      ],
    }),
  });
  def('Savage Opress | You Must Have Your Revenge', 'leader', {
    aura(g, src, u) {
      if (u.ctrl !== src.ctrl || g._savage) return null;
      g._savage = true;
      try {
        const mx = Math.max(...g.P(u.ctrl).units.map((x) => g.power(x)));
        return g.power(u) >= mx ? { kw: { Overwhelm: true } } : null;
      } finally {
        g._savage = false;
      }
    },
  });
  def('Saw Gerrera | Extremist', 'card', { onEnemyPlay: (g, self, card) => card.t === 'Event' && g.damageBase(1 - self.ctrl, 2, { p: 1 - self.ctrl }) });
  def('Scanning Officer', 'card', {
    whenPlayed(g, u) {
      const o = 1 - u.ctrl;
      const O = g.P(o);
      const rv = SWU.shuffle([...O.resources]).slice(0, 3);
      if (rv.length) g.revealCards(o, rv, 'reveal');
      for (const r of rv) {
        if (g.smuggleCost(o, r.card) == null || r.card.kwp.Smuggle == null) continue;
        O.resources = O.resources.filter((x) => x !== r);
        g.P(r.owner != null ? r.owner : o).discard.push({ uid: r.uid, card: r.card, owner: r.owner != null ? r.owner : o });
        g.log('logDefeat', r.card.n);
        if (O.deck.length) O.resources.push({ ...O.deck.shift(), exhausted: true });
      }
    },
  });
  def('Second Chance', 'card', {
    grantFor: () => ({
      whenDefeated(g, snap) {
        const P = g.P(snap.owner);
        if (P.discard.some((x) => x.uid === snap.uid)) (P.discardPlays = P.discardPlays || []).push({ uid: snap.uid, phaseId: g.G.phaseId, free: true });
      },
    }),
  });
  def('Secret Marriage', 'card', {
    async event(g, p) {
      const us = g.allUnits().filter((x) => !g.hasTrait(x, 'VEHICLE')).map((u) => ({ uid: u.uid, card: u.card }));
      if (!us.length) return;
      const pk = await g.pickCards(p, L('給最多 2 個非載具單位護盾（給敵方就抽 1）', 'Give a Shield to each of up to 2 non-Vehicle units (draw if you shield an enemy)'), us, 0, 2);
      let draw = false;
      for (const x of pk) {
        const u = g.findUnit(x.uid);
        if (!u) continue;
        g.giveShield(u);
        if (u.ctrl !== p) draw = true;
      }
      if (draw) g.draw(p, 1);
    },
  });
  def('Shadow Collective Camp | Zanbar', 'card', { onLeaderDeployed: (g, src) => g.draw(src.ctrl != null ? src.ctrl : src.owner, 1) });
  def('Shadowed Intentions', 'card', {
    grantFor: () => ({
      cantBeCapturedBy: (g, u, captor) => !captor || captor.ctrl !== u.ctrl,
      cantBeDefeatedBy: (g, u, why) => noEnemyDefeat(g, u, why || {}),
      cantBeBounced: () => true,
    }),
  });
  def('Slaver\'s Freighter', 'card', {
    async whenPlayed(g, u) {
      const n = g.P(1 - u.ctrl).units.reduce((a, x) => a + x.upgrades.length, 0);
      const t = await g.pickUnit(u.ctrl, L(`可以重置另一個攻擊力 ≤${n} 的單位`, `You may ready another unit with power ${n} or less`), (x) => x !== u && x.exhausted && g.power(x) <= n, { optional: true });
      if (t) g.ready(t);
    },
  });
  def('Sly Moore | Secretive Advisor', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('取得一個敵方代幣單位的控制權並重置', 'Take control of an enemy token unit and ready it'), (x) => x.ctrl !== u.ctrl && isTok(x), { ctx: { harm: true } });
      if (!t) return;
      SWU.FX2.takeControl(g, t, u.ctrl);
      g.ready(t);
      g.delay({ at: 'regroupStart', round: g.G.round, run: (g) => { if (g.findUnit(t.uid)) SWU.FX2.takeControl(g, t, t.owner); } });
    },
  });
  def('Smoke and Cinders', 'card', {
    async event(g, p) {
      for (const q of [p, 1 - p]) {
        const Q = g.P(q);
        if (Q.hand.length <= 2) continue;
        const keep = await g.pickCards(q, L('選 2 張留下，其餘棄掉', 'Choose 2 cards to keep; discard the rest'), Q.hand, 2, 2);
        for (const c of Q.hand.filter((x) => !keep.includes(x))) {
          Q.hand = Q.hand.filter((x) => x !== c);
          Q.discard.push(c);
          g.noteHandDiscard(q, c);
        }
      }
    },
  });
  def('Soulless One | Customized for Grievous', 'card', {
    async onAttack(g, u) {
      const P = g.P(u.ctrl);
      const cands = P.units.filter((x) => x !== u && !x.exhausted && (g.hasTrait(x, 'DROID') || x.card.n === 'General Grievous'));
      const ld = !P.leader.deployed && !P.leader.exhausted && P.leader.card.n === 'General Grievous';
      if (!cands.length && !ld) return;
      const opts = [L('不要', 'No'), ...cands.map((x) => N(x)), ...(ld ? [N(P.leader) + L('（領袖）', ' (leader)')] : [])];
      const i = await g.pickOption(u.ctrl, L('可以橫置友方機器人或格里弗斯：本次攻擊 +2/+0', 'You may exhaust a friendly Droid or General Grievous: +2/+0 for this attack'), opts, { ctx: { aiPick: opts.length > 1 ? 1 : 0 } });
      if (i <= 0) return;
      if (i <= cands.length) g.exhaust(cands[i - 1]);
      else P.leader.exhausted = true;
      g.buff(u, 2, 0, 'attack');
    },
  });
  def('Spark of Hope', 'card', {
    async event(g, p) {
      const P = g.P(p);
      const cs = P.discard.filter((c) => c.card.t === 'Unit' && defeatedNow(g, (x) => x.uid === c.uid));
      if (!cs.length) return;
      const pk = await g.pickCards(p, L('把本階段被擊敗的一個單位放成資源', 'Put a unit defeated this phase into play as a resource'), cs, 1, 1);
      if (!pk.length) return;
      takeFromDiscard(g, p, pk[0].uid);
      toResource(g, p, pk[0], false);
    },
  });
  def('SpecForce Soldier', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('讓一個單位本階段失去 Sentinel', 'A unit loses Sentinel for this phase'), (x) => g.has(x, 'Sentinel'), { ctx: { harm: true } });
      if (t) t.loseKwPhase = { phaseId: g.G.phaseId, kws: ['Sentinel'] };
    },
  });
  def('Strafing Gunship', 'card', {
    attackArenas: () => ['Space', 'Ground'],
    aura: (g, src, u) => (g.G.attack && g.G.attack.attacker === src && g.G.attack.defender === u && u.arena === 'Ground' ? { p: -2 } : null),
  });
  def('Sugi | Hired Guardian', 'card', { static: (g, u) => (g.P(1 - u.ctrl).units.some((x) => g.isUpgraded(x)) ? { kw: { Sentinel: true } } : null) });
  def('Sundari Gauntlet', 'card', { whenAttacked: (g, u) => g.damageBase(u.ctrl, 1, { p: u.ctrl }) });
  def('Sundari Palace | Mandalore', 'card', {
    actions: [
      {
        text: L('史詩行動：每個友方領袖單位可以把一張手牌放成資源並重置', 'Epic Action: for each friendly leader unit, you may resource a card from hand and ready it'),
        can: (g, B) => !B.epicUsed && leaderUnits(g, B.ctrl) > 0 && g.P(B.ctrl).hand.length > 0,
        async run(g, B) {
          B.epicUsed = true;
          const p = B.ctrl;
          const P = g.P(p);
          let n = 0;
          for (let i = 0; i < leaderUnits(g, p) && P.hand.length; i++) {
            const pk = await g.pickCards(p, L('可以把一張手牌放成資源（重置）', 'You may resource a card from your hand (ready)'), P.hand, 0, 1);
            if (!pk.length) break;
            P.hand = P.hand.filter((x) => x !== pk[0]);
            toResource(g, p, pk[0], true);
            n++;
          }
          if (n) g.delay({ at: 'regroupStart', round: g.G.round, run: async (g) => { for (let i = 0; i < n; i++) await defeatResource(g, p, L('Sundari Palace：擊敗一個友方資源', 'Sundari Palace: defeat a friendly resource'), false); } });
        },
      },
    ],
  });
  def('Superlaser Technician', 'card', {
    async whenDefeated(g, snap) {
      if (!g.P(snap.owner).discard.some((x) => x.uid === snap.uid)) return;
      if (!(await may(g, snap.ctrl, snap.card, L('要把這個單位放成資源並重置嗎？', 'Put this unit into play as a resource and ready it?')))) return;
      const c = takeFromDiscard(g, snap.owner, snap.uid);
      if (c) toResource(g, snap.ctrl, c, true);
    },
  });
  async function survivors(g, u) {
    const ups = [];
    for (const h of g.allUnits()) for (const up of h.upgrades) if (!up.leaderPilot) ups.push({ uid: up.uid, card: up.card, host: h, up });
    if (!ups.length) return;
    const pk = await g.pickCards(u.ctrl, L('可以把一張升級移到同一位玩家的另一個合法單位', 'You may move an upgrade to another eligible unit controlled by the same player'), ups, 0, 1);
    if (!pk.length) return;
    const { host, up } = pk[0];
    const ts = g.P(host.ctrl).units.filter((x) => x !== host && (g.upgradeTargets(host.ctrl, up.card) || []).includes(x));
    const t = ts.length ? await g.pickUnit(u.ctrl, L('移到哪個單位', 'Move it to which unit'), (x) => ts.includes(x), {}) : null;
    if (!t) return;
    host.upgrades = host.upgrades.filter((x) => x !== up);
    t.upgrades.push(up);
    g.log('logAttach', up.card.n, t.card.n);
  }
  def('Survivors\' Gauntlet', 'card', { whenPlayed: survivors, onAttack: survivors });
  def('Synara San | Loyal to Kragan', 'card', {
    async bounty(g, snap, collector) {
      if (!snap.exhausted) return;
      const b = await g.pickTarget(collector, L('賞金：對一個基地造成 5 點傷害', 'Bounty: deal 5 damage to a base'), { bases: [1 - collector, collector], ctx: { harm: true } });
      if (b && b.base != null) g.damageBase(b.base, 5, { p: collector });
    },
  });
  def('Tactical Droid Commander', 'card', {
    async onFriendlyPlay(g, self, u) {
      if (u === self || !g.hasTrait(u, 'SEPARATIST')) return;
      const n = u.card.c || 0;
      const t = await g.pickUnit(self.ctrl, L(`可以橫置一個費用 ≤${n} 的單位`, `You may exhaust a unit that costs ${n} or less`), (x) => (x.card.c || 0) <= n && !x.exhausted && x.ctrl !== self.ctrl, { optional: true, ctx: { harm: true } });
      if (t) g.exhaust(t);
    },
  });
  const takeX = (fn) => ({ costMod: (g, p) => -leaderUnits(g, p), event: fn });
  def('Take Action', 'card', takeX(async (g, p) => { await dmgPick(g, p, 3, L('對一個單位造成 3 點傷害', 'Deal 3 damage to a unit'), () => true, false); }));
  def('Take Aim', 'card', takeX(async (g, p) => {
    const t = await g.pickUnit(p, L('用一個單位攻擊（+2/+0、Saboteur）', 'Attack with a unit (+2/+0 and Saboteur)'), (x) => x.ctrl === p && g.canAttackWith(x), {});
    if (t) await g.attack(t, { power: 2, kw: { Saboteur: true } });
  }));
  def('Take Charge', 'card', takeX(async (g, p) => {
    const us = g.allUnits().map((u) => ({ uid: u.uid, card: u.card }));
    const pk = us.length ? await g.pickCards(p, L('給最多 3 個單位各 1 個經驗代幣', 'Give an Experience token to each of up to 3 units'), g.P(p).units.map((u) => ({ uid: u.uid, card: u.card })), 0, 3) : [];
    for (const x of pk) if (g.findUnit(x.uid)) g.giveExp(g.findUnit(x.uid));
  }));
  def('Take Cover', 'card', takeX(async (g, p) => {
    const t = await g.pickUnit(p, L('回復一個單位最多 3 點傷害並給它護盾', 'Heal up to 3 damage from a unit and give it a Shield'), () => true, {});
    if (!t) return;
    g.heal(t, 3);
    g.giveShield(t);
  }));
  def('Tarfful | Kashyyyk Chieftan', 'card', {
    async onEvent(g, self, ev) {
      if (ev.type !== 'damage' || !ev.combat || !ev.u || ev.ctrl !== self.ctrl || !g.hasTrait(ev.u, 'WOOKIEE') || !g.findUnit(ev.u.uid) || !g.findUnit(self.uid)) return;
      const t = await g.pickUnit(self.ctrl, L(`${N(ev.u)} 對一個敵方地面單位造成 ${ev.n} 點傷害`, `${ev.u.card.n} deals ${ev.n} damage to an enemy ground unit`), (x) => x.ctrl !== self.ctrl && x.arena === 'Ground', { ctx: { harm: true, op: 'damage', n: ev.n } });
      if (t) await g.damageUnit(t, ev.n, { p: self.ctrl, self: ev.u });
    },
  });
  def('Tech | Source of Insight', 'card', { techSmuggle: true });
  def('The Chaos of War', 'card', {
    event(g, p) {
      for (const q of [p, 1 - p]) {
        const n = g.P(q).hand.length;
        if (n) g.damageBase(q, n, { p });
      }
    },
  });
  def('The Client | Dictated by Discretion', 'card', {
    actions: [
      {
        text: L('橫置：讓一個單位本階段獲得「賞金：基地回復 5」', 'Exhaust: a unit gains "Bounty - Heal 5 damage from a base" this phase'),
        can: (g, u) => !u.exhausted,
        async run(g, u) {
          g.exhaust(u);
          const t = await g.pickUnit(u.ctrl, L('選一個單位', 'Choose a unit'), (x) => x.ctrl !== u.ctrl, {});
          if (!t) return;
          phaseGrant(g, (g, x) => x.uid === t.uid, {
            async bounty(g, snap, collector) {
              const b = await g.pickTarget(collector, L('賞金：回復一個基地 5 點傷害', 'Bounty: heal 5 damage from a base'), { bases: [collector, 1 - collector] });
              if (b && b.base != null) g.healBase(b.base, 5);
            },
          });
        },
      },
    ],
  });
  def('The Clone Wars', 'card', {
    async event(g, p) {
      const mx = g.readyResources(p) + (g.creditsUsable(p) ? g.P(p).credits : 0);
      if (!mx) return;
      const opts = Array.from({ length: mx + 1 }, (_, i) => String(i));
      const i = await g.pickOption(p, L('要支付幾個資源？', 'Pay how many resources?'), opts, { ctx: { aiPick: Math.min(mx, 3) } });
      const n = Math.max(0, i);
      if (!n) return;
      g.pay(p, n);
      g.createToken(p, 'Clone Trooper', n);
      g.createToken(1 - p, 'Battle Droid', n);
    },
  });
  def('The Darksaber', 'card', {
    costOnTarget: (g, p, t) => (g.hasTrait(t, 'MANDALORIAN') ? g.aspectPenalty(p, cardOf('The Darksaber')) : 0),
    grantFor: () => ({
      onAttack(g, u) {
        for (const x of g.P(u.ctrl).units) if (x !== u && g.hasTrait(x, 'MANDALORIAN')) g.giveExp(x);
      },
    }),
  });
  def('The Darksaber | Only the Strongest Shall Rule', 'card', {
    attachedStatic: () => ({ kw: { Sentinel: true } }),
    whenPlayed(g, inst, t) {
      if (!t) return;
      const ks = new Set();
      for (const u of g.P(t.ctrl).units) for (const k of Object.keys(g.kw(u))) if (!['SmuggleRaw', 'Bounty'].includes(k)) ks.add(k);
      if (ks.size >= 4) g.ready(t);
    },
  });
  def('The Emperor\'s Legion', 'card', {
    event(g, p) {
      for (const c of [...g.P(p).discard]) if (c.card.t === 'Unit' && defeatedNow(g, (x) => x.uid === c.uid)) moveDiscardToHand(g, p, c.uid);
    },
  });
  def('The Invasion of Christophsis', 'card', {
    async event(g, p) {
      for (const u of [...g.P(1 - p).units]) if (g.findUnit(u.uid)) await g.defeat(u, {});
    },
  });
  def('The Invisible Hand | Imposing Flagship', 'card', {
    whenPlayed: (g, u) => g.createToken(u.ctrl, 'Battle Droid', 4),
    async onAttack(g, u) {
      const cs = g.P(u.ctrl).units.filter((x) => x !== u && !x.exhausted && g.hasTrait(x, 'SEPARATIST')).map((x) => ({ uid: x.uid, card: x.card }));
      if (!cs.length) return;
      const pk = await g.pickCards(u.ctrl, L('橫置任意數量的友方分離主義單位（每個對基地 1 傷）', 'Exhaust any number of friendly Separatist units (1 base damage each)'), cs, 0, cs.length);
      let n = 0;
      for (const x of pk) {
        const t = g.findUnit(x.uid);
        if (t && !t.exhausted) {
          g.exhaust(t);
          n++;
        }
      }
      if (n) g.damageBase(1 - u.ctrl, n, { p: u.ctrl });
    },
  });
  def('The Marauder | Shuttling the Bad Batch', 'card', {
    async whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      if (!P.discard.length) return;
      const pk = await g.pickCards(u.ctrl, L('選棄牌堆一張卡（和你的單位同名就放成資源）', 'Choose a card in your discard pile (resource it if it shares a name with a unit you control)'), P.discard, 1, 1);
      if (!pk.length || !P.units.some((x) => x.card.n === pk[0].card.n)) return;
      takeFromDiscard(g, u.ctrl, pk[0].uid);
      toResource(g, u.ctrl, pk[0], false);
    },
  });
  def('Tobias Beckett | I Trust No One', 'card', {
    async onCardPlayed(g, self, info) {
      if (info.p !== self.ctrl || info.card.t === 'Unit' || self.tobRound === g.G.round) return;
      const n = info.card.c || 0;
      const t = await g.pickUnit(self.ctrl, L(`可以橫置一個費用 ≤${n} 的單位`, `You may exhaust a unit that costs ${n} or less`), (x) => (x.card.c || 0) <= n && !x.exhausted && x.ctrl !== self.ctrl, { optional: true, ctx: { harm: true } });
      if (!t) return;
      self.tobRound = g.G.round;
      g.exhaust(t);
    },
  });
  def('Traitorous', 'card', {
    whenPlayed(g, inst, t) {
      if (!t || g.isLeaderUnit(t) || (t.card.c || 0) > 3) return;
      const p = (g.G.playLog || []).slice(-1)[0];
      const to = p && p.uid === inst.uid ? p.p : inst.owner;
      if (t.ctrl !== to) {
        t.traitorous = inst.uid;
        SWU.FX2.takeControl(g, t, to);
      }
    },
    upWhenDefeated(g, up, host) {
      if (host && g.findUnit(host.uid) && host.traitorous === up.uid) {
        delete host.traitorous;
        SWU.FX2.takeControl(g, host, host.owner);
      }
    },
  });
  def('Trandoshan Hunters', 'card', { whenPlayed: (g, u) => enemyBounty(g, u.ctrl) && g.giveExp(u) });
  def('Tranquility | Inspiring Flagship', 'card', {
    async whenPlayed(g, u) {
      const cs = g.P(u.ctrl).discard.filter((c) => c.card.t === 'Unit' && g.hasTrait(c.card, 'REPUBLIC'));
      if (!cs.length) return;
      const pk = await g.pickCards(u.ctrl, L('可以把棄牌堆一個共和國單位收回手牌', 'You may return a Republic unit from your discard pile to your hand'), cs, 0, 1);
      if (pk.length) moveDiscardToHand(g, u.ctrl, pk[0].uid);
    },
    onAttack(g, u) {
      for (let i = 0; i < 3; i++) g.addNext(u.ctrl, { f: (c) => g.hasTrait(c, 'REPUBLIC'), n: 1, phaseId: g.G.phaseId });
    },
  });
  def('Tribunal | Grave of the 332nd', 'card', {
    costMod: (g, p) => -2 * g.G.playedThisPhase[p].length,
    whenPlayed(g, u) {
      for (const x of g.allUnits()) if (x !== u) g.buff(x, -2, -2);
    },
  });
  def('Unlicensed Headhunter', 'card', { bounty: (g, snap, collector) => snap.exhausted && g.healBase(collector, 5) });
  def('Unnatural Life', 'card', {
    async event(g, p) {
      const r = await playFromDiscard(g, p, g.P(p).discard.filter((c) => c.card.t === 'Unit' && defeatedNow(g, (x) => x.uid === c.uid)), cardOf('Unnatural Life'), { discount: 2, ready: true, prompt: L('打出本階段被擊敗的一個單位（少 2 費、就緒）', 'play a unit defeated this phase (2 less, ready)') });
      if (r && r.uid && g.findUnit(r.uid)) {
        const uid = r.uid;
        g.delay({ at: 'regroupStart', round: g.G.round, run: async (g) => { const x = g.findUnit(uid); if (x) await g.defeat(x, {}); } });
      }
    },
  });
  def('Unrefusable Offer', 'card', {
    grantFor: () => ({
      async bounty(g, snap, collector) {
        let c = g.P(snap.owner).discard.find((x) => x.uid === snap.uid);
        let from = 'odiscard';
        if (!c) {
          for (const u of g.allUnits()) {
            const k = (u.captured || []).find((x) => x.uid === snap.uid);
            if (k) {
              u.captured = u.captured.filter((x) => x !== k);
              c = k;
              from = 'deck';
            }
          }
        }
        if (!c || !(await may(g, collector, snap.card, L('賞金：要在你的控制下免費打出這個單位嗎？（輪末擊敗）', 'Bounty: play this unit for free under your control? (defeated at regroup)')))) return;
        await g.playCard(collector, c.uid, from, { inst: c, free: true, ready: true });
        const uid = c.uid;
        g.delay({ at: 'regroupStart', round: g.G.round, run: async (g) => { const x = g.findUnit(uid); if (x) await g.defeat(x, {}); } });
      },
    }),
  });
  def('Valiant Assault Ship', 'card', { onAttack: (g, u) => g.P(1 - u.ctrl).resources.length > g.P(u.ctrl).resources.length && g.buff(u, 2, 0, 'attack') });
  def('Vanguard Ace', 'card', {
    whenPlayed(g, u) {
      const n = g.G.playedThisPhase[u.ctrl].length - 1;
      if (n > 0) g.giveExp(u, n);
    },
  });
  def('Volunteer Soldier', 'card', { costMod: (g, p) => (g.P(p).units.some((x) => g.hasTrait(x, 'TROOPER')) ? -1 : 0) });
  def('Wartime Mercenaries', 'card', {
    async whenDefeated(g, snap) {
      const o = 1 - snap.ctrl;
      await expTo(g, o, L('可以給一個單位 1 個經驗代幣', 'You may give an Experience token to a unit'), (x) => x.ctrl === o || !(g.io[o] && !g.io[o].isHuman), true);
    },
  });
  def('Wartime Pirate', 'card', {
    async onAttack(g, u) {
      const o = 1 - u.ctrl;
      await dmgPick(g, o, 1, L('對一個單位造成 1 點傷害', 'Deal 1 damage to a unit'), (x) => x.ctrl !== o || !(g.io[o] && !g.io[o].isHuman), false);
    },
  });
  def('Wartime Profiteer', 'card', {
    async whenDefeated(g, snap) {
      const o = 1 - snap.ctrl;
      const rs = g.P(o).resources.filter((r) => r.exhausted);
      if (!rs.length) return;
      const pk = await g.pickCards(o, L('可以重置一個資源', 'You may ready a resource'), rs, 0, 1);
      if (pk.length) pk[0].exhausted = false;
    },
  });
  def('Wartime Refugee', 'card', { onAttack: (g, u) => g.healBase(1 - u.ctrl, 1) });
  const wolffe = (g) => {
    g.G.noHealPhase = g.G.phaseId;
  };
  def('Wolffe | Suspicious Veteran', 'card', { whenPlayed: wolffe, onAttack: wolffe });
  def('Wrecker | Boom!', 'card', {
    async whenPlayed(g, u) {
      if (!g.allUnits().some((x) => x.arena === 'Ground' && x.ctrl !== u.ctrl)) return;
      const r = await defeatResource(g, u.ctrl, L('可以擊敗一個友方資源，對一個地面單位造成 5 點傷害', 'You may defeat a friendly resource to deal 5 damage to a ground unit'), true);
      if (r) await dmgPick(g, u.ctrl, 5, L('對一個地面單位造成 5 點傷害', 'Deal 5 damage to a ground unit'), (x) => x.arena === 'Ground', false, u);
    },
  });
  def('Ziro the Hutt | Colorful Schemer', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('可以橫置一個對手的單位', 'You may exhaust a unit an opponent controls'), (x) => x.ctrl !== u.ctrl && !x.exhausted, { optional: true, ctx: { harm: true } });
      if (t) g.exhaust(t);
    },
    async onAttack(g, u) {
      const rs = g.P(1 - u.ctrl).resources.filter((r) => !r.exhausted);
      if (!rs.length) return;
      const pk = await g.pickCards(u.ctrl, L('可以橫置一個對手的資源', 'You may exhaust a resource an opponent controls'), rs, 0, 1);
      if (pk.length) pk[0].exhausted = true;
    },
  });
})();
