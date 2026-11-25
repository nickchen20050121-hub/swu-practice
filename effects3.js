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
  const pre = (...ts) => ts.forEach(steps); // 載入時就檢查句型
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
})();
