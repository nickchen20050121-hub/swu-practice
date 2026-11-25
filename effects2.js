/* 比賽牌組卡片的完整效果（2026-11-25 逐張對照官方文字與全規則手寫）。
 * 寫在這裡的卡會取代 programs.js／句型判讀的近似版本。
 */
(function () {
  const SWU = window.SWU;
  const def = SWU.EFFECTS.def;
  const L = (zh, en) => (SWU.lang === 'en' ? en : zh);
  const N = (c) => (SWU.cardName ? SWU.cardName(c.card || c) : (c.card || c).n);
  const ASPECTS = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy'];
  const aspName = (a) => SWU.t('asp_' + a);
  const isTok = (u) => /Token/.test(u.card.t);
  const enemyOf = (p) => (u) => u.ctrl !== p;
  const friendOf = (p) => (u) => u.ctrl === p;
  const nonLeader = (g) => (u) => !g.isLeaderUnit(u);
  const hasWeak = (u) => u.upgrades.some((x) => x.card.n === 'Weakness');
  const credit = (g, p, n = 1) => {
    g.P(p).credits += n;
    g.log('logToken', g.P(p).name, 'Credit', n);
  };
  const ctxOf = (card, harm) => ({ card: card.key || card, harm: !!harm });

  // 鑽研某一個「卡名」：玩家從清單挑（看過的卡＋比賽牌組常見卡），電腦挑對手牌庫裡最常見、最貴的
  function nameCandidates(g, p, victim) {
    const V = g.P(victim);
    const seen = new Map();
    const add = (c) => {
      if (!c || ['Leader', 'Base'].includes(c.t) || /Token/.test(c.t)) return;
      seen.set(c.n, c);
    };
    for (const x of V.discard) add(x.card);
    for (const u of V.units) add(u.card);
    for (const x of (g.G.revealed || []).filter((r) => r.p === victim)) add(x.card);
    for (const d of window.SWU_META_DECKS || []) for (const k of Object.keys(d.main || {})) add(SWU.DB.byKey.get(k.toLowerCase()));
    return [...seen.values()].sort((a, b) => (a.n < b.n ? -1 : 1));
  }
  async function nameCard(g, p, victim, src) {
    const io = g.io[p];
    if (io && io.isHuman) {
      const cs = nameCandidates(g, p, victim);
      const i = await g.pickOption(p, L(`${N(src)}：指名一張卡`, `${src.n}: name a card`), cs.map((c) => N(c) + (SWU.lang === 'en' ? '' : '（' + c.n + '）')));
      return cs[i < 0 ? 0 : i].n;
    }
    // 電腦：對手所有卡（牌庫＋手牌）裡數量×費用最高的
    const V = g.P(victim);
    const score = new Map();
    for (const x of [...V.deck, ...V.hand]) {
      if (['Leader', 'Base'].includes(x.card.t)) continue;
      score.set(x.card.n, (score.get(x.card.n) || 0) + 1 + (x.card.c || 0) / 3);
    }
    let best = null, bs = -1;
    for (const [n, s] of score) if (s > bs) ((bs = s), (best = n));
    return best || (V.hand[0] && V.hand[0].card.n) || 'Nothing';
  }
  async function chooseAspect(g, p, src) {
    const i = await g.pickOption(p, L(`${N(src)}：選擇一個面向`, `${src.n}: choose an aspect`), ASPECTS.map(aspName));
    return ASPECTS[i < 0 ? 0 : i];
  }
  async function lookHand(g, p, victim, src) {
    const V = g.P(victim);
    g.log('logLookHand', g.P(p).name);
    if (V.hand.length) await g.showCards(p, V.hand, L(`${N(src)}：對手的手牌`, `${src.n}: opponent's hand`));
  }
  async function discardFrom(g, p, victim, cands, optional, src) {
    const V = g.P(victim);
    if (!cands.length) return null;
    const pick = await g.pickCards(p, L(`${N(src)}：選一張棄掉`, `${src.n}: choose a card to discard`), cands, optional ? 0 : 1, 1);
    if (!pick.length) return null;
    V.hand = V.hand.filter((x) => x !== pick[0]);
    V.discard.push(pick[0]);
    g.log('logDiscard', V.name, pick[0].card.n);
    return pick[0];
  }
  function takeControl(g, u, p) {
    if (!g.findUnit(u.uid) || u.ctrl === p) return;
    g.P(u.ctrl).units = g.P(u.ctrl).units.filter((x) => x !== u);
    u.ctrl = p;
    g.P(p).units.push(u);
    g.log('logTakeControl', g.P(p).name, u.card.n);
  }
  async function exhaustUnit(g, p, prompt, filter, optional, card) {
    const t = await g.pickUnit(p, prompt, filter, { optional, ctx: ctxOf(card, true) });
    if (t) g.exhaust(t);
    return t;
  }
  async function dealTo(g, p, n, prompt, filter, opts = {}) {
    const units = g.allUnits().filter(filter);
    const bases = opts.bases || [];
    const t = await g.pickTarget(p, prompt, { units, bases, optional: !!opts.optional, ctx: { harm: true, op: 'damage', n } });
    if (!t) return null;
    if (t.base != null) g.damageBase(t.base, n, { ability: true });
    else await g.damageUnit(t.unit, n);
    return t;
  }
  const allBases = [0, 1];

  // ===================== 領袖駕駛員加成（官方升級數值） =====================
  SWU.PILOT_MOD = {
    'Luke Skywalker | Hero of Yavin': [4, 5],
    'Darth Vader | Victor Squadron Leader': [5, 5],
  };

  // ===================== 領袖 =====================
  def('Luke Skywalker | Hero of Yavin', 'leader', {
    actions: [
      {
        text: L('造成 1 點傷害', 'deal 1 damage'),
        can: (g, Ld) => !Ld.exhausted,
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.owner;
          const ok = (g.G.attackers || []).some((a) => a.ctrl === p && a.phaseId === g.G.phaseId && g.hasTrait(a.u, 'FIGHTER'));
          if (!ok) return;
          await dealTo(g, p, 1, L('天行者：對一個單位造成 1 點傷害', 'Luke: deal 1 damage to a unit'), () => true);
        },
      },
    ],
  });
  def('Luke Skywalker | Hero of Yavin', 'unit', {
    grantFor(g, up, host) {
      if (!g.hasTrait(host, 'FIGHTER')) return null;
      return {
        async onAttack(g, u) {
          await dealTo(g, up.owner, 3, L('天行者（駕駛員）：可以對一個單位造成 3 點傷害', 'Luke (Pilot): you may deal 3 damage to a unit'), () => true, { optional: true });
        },
      };
    },
  });
  def('Darth Vader | Victor Squadron Leader', 'leader', {
    actions: [
      {
        text: L('建立鈦戰機', 'create TIE Fighter'),
        can: (g, Ld) => !Ld.exhausted,
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.owner;
          const ok = (g.G.attackers || []).some((a) => a.ctrl === p && a.phaseId === g.G.phaseId && g.hasTrait(a.u, 'VEHICLE') && !isTok(a.u));
          if (ok) g.createToken(p, 'TIE Fighter', 1);
        },
      },
    ],
  });
  def('Darth Vader | Victor Squadron Leader', 'unit', {
    async whenDeployedAsUpgrade(g, host, Ld) {
      g.createToken(Ld.owner, 'TIE Fighter', 2);
    },
  });
  def('Doctor Hemlock | Emotion Has No Place Here', 'leader', {
    actions: [
      {
        text: L('給弱點', 'give Weakness'),
        can: (g, Ld) => !Ld.exhausted && g.canPay(Ld.owner, 1) && g.allUnits().some((u) => !hasWeak(u)),
        async run(g, Ld) {
          Ld.exhausted = true;
          g.pay(Ld.owner, 1);
          const t = await g.pickUnit(Ld.owner, L('赫姆洛克：給一個沒有弱點的單位一個弱點代幣', 'Hemlock: give a Weakness token to a unit without one'), (u) => !hasWeak(u), { ctx: { harm: true } });
          if (t) g.giveToken(t, 'Weakness');
        },
      },
    ],
  });
  def('Director Krennic | Amidst My Achievement', 'leader', {
    actions: [
      {
        text: L('擊敗友方單位→Credit', 'defeat a unit → Credit'),
        can: (g, Ld) => !Ld.exhausted && g.P(Ld.owner).units.length > 0,
        async run(g, Ld) {
          const p = Ld.owner;
          const t = await g.pickUnit(p, L('克倫尼克：擊敗一個友方單位（費用）', 'Krennic: defeat a friendly unit (cost)'), friendOf(p));
          if (!t) return;
          Ld.exhausted = true;
          await g.defeat(t, { cost: true, by: Ld });
          credit(g, p, 1);
        },
      },
    ],
  });
  def('Lando Calrissian | Full Sabacc', 'leader', {
    actions: [
      {
        text: L('猜面向', 'Sabacc'),
        can: (g, Ld) => !Ld.exhausted && g.canPay(Ld.owner, 1),
        async run(g, Ld) {
          Ld.exhausted = true;
          const p = Ld.owner;
          g.pay(p, 1);
          await landoSabacc(g, p, Ld.card);
        },
      },
    ],
  });
  async function landoSabacc(g, p, card) {
    const asp = await chooseAspect(g, p, card);
    const i = await g.pickOption(p, L('從哪個牌庫棄掉頂牌？', "Discard the top card of which deck?"), [L('自己的牌庫', 'your deck'), L('對手的牌庫', "opponent's deck")]);
    const Q = g.P(i === 1 ? 1 - p : p);
    if (!Q.deck.length) return;
    const c = Q.deck.shift();
    Q.discard.push(c);
    g.log('logMill', Q.name, 1);
    g.revealCards(Q.idx, [c], 'mill');
    if ((c.card.a || []).includes(asp)) credit(g, p, 1);
  }
  def('Lando Calrissian | Full Sabacc', 'unit', {
    async whenDeployed(g, u) {
      const P = g.P(u.ctrl);
      if (P.credits < 1) return;
      if (!(await g.yesno(u.ctrl, L('藍道：要擊敗 1 個 Credit 代幣，換 3 個 Credit 嗎？', 'Lando: defeat a Credit token to create 3 Credit tokens?'), { uid: u.uid }))) return;
      P.credits -= 1;
      credit(g, u.ctrl, 3);
    },
  });
  def('Vel Sartha | Aldhani Insurgent', 'leader', {
    actions: [
      {
        text: L('給經驗', 'give Experience'),
        can: (g, Ld) => !Ld.exhausted && g.allUnits().length > 0,
        async run(g, Ld) {
          Ld.exhausted = true;
          const t = await g.pickUnit(Ld.owner, L('薇兒：給一個單位經驗代幣', 'Vel: give an Experience token to a unit'), () => true);
          if (t) g.giveExp(t, 1);
          credit(g, 1 - Ld.owner, 1);
        },
      },
    ],
  });
  def('Vel Sartha | Aldhani Insurgent', 'unit', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('薇兒：可以給一個單位經驗代幣（對手會得到 1 個 Credit）', 'Vel: you may give an Experience token to a unit (opponent creates a Credit)'), () => true, { optional: true });
      if (!t) return;
      g.giveExp(t, 1);
      credit(g, 1 - u.ctrl, 1);
    },
  });
  def('Wicket | Few Greater Battles to Fight', 'leader', {
    async onFriendlyAttack(g, Ld, atk) {
      if (Ld.exhausted || !atk.defender) return;
      if ((atk.defender.card.c || 0) <= (atk.attacker.card.c || 0)) return;
      if (!(await g.yesno(Ld.owner, L('威克特：橫置領袖抽一張牌？', 'Wicket: exhaust this leader to draw a card?')))) return;
      Ld.exhausted = true;
      g.draw(Ld.owner, 1);
    },
  });

  // ===================== 單位 =====================
  def('Adamant Ewoks', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const ok = g.P(p).units.some((x) => x !== u && g.hasTrait(x, 'EWOK')) || g.controlsBaseTrait(p, 'ENDOR') || /Endor/i.test(g.P(p).base.card.key || '');
      if (!ok) return;
      if (!(await g.yesno(p, L('堅定的伊沃克人：對一個基地和一個敵方單位各造成 1 點傷害？', 'Adamant Ewoks: deal 1 damage to a base and 1 to an enemy unit?'), { uid: u.uid }))) return;
      await dealTo(g, p, 1, L('選擇一個基地（1 點傷害）', 'choose a base (1 damage)'), () => false, { bases: allBases });
      await dealTo(g, p, 1, L('選擇一個敵方單位（1 點傷害）', 'choose an enemy unit (1 damage)'), enemyOf(p));
    },
  });
  def("Annihilator | Tagge's Flagship", 'card', {
    async whenPlayed(g, u) {
      await annihilate(g, u.ctrl);
    },
    async whenDefeated(g, u) {
      await annihilate(g, u.ctrl);
    },
  });
  async function annihilate(g, p) {
    const t = await g.pickUnit(p, L('殲滅者號：可以擊敗一個敵方單位', 'Annihilator: you may defeat an enemy unit'), enemyOf(p), { optional: true, ctx: { harm: true } });
    if (!t) return;
    const name = t.card.n, q = t.ctrl;
    await g.defeat(t, { ability: true, by: p });
    if (g.findUnit(t.uid)) return;
    const Q = g.P(q);
    await lookHand(g, p, q, { n: 'Annihilator' });
    const hit = [...Q.hand.filter((c) => c.card.n === name), ...Q.deck.filter((c) => c.card.n === name)];
    Q.hand = Q.hand.filter((c) => !hit.includes(c));
    Q.deck = Q.deck.filter((c) => !hit.includes(c));
    Q.discard.push(...hit);
    for (let i = Q.deck.length - 1; i > 0; i--) {
      const j = g.rnd(i + 1);
      [Q.deck[i], Q.deck[j]] = [Q.deck[j], Q.deck[i]];
    }
    if (hit.length) g.log('logDiscard', Q.name, name + ' ×' + hit.length);
  }
  async function arvel(g, u) {
    const p = u.ctrl;
    const owners = [p, 1 - p].filter((q) => g.P(q).credits > 0);
    if (!owners.length) return;
    let q = owners[0];
    if (owners.length > 1) {
      const i = await g.pickOption(p, L('亞維爾：要擊敗誰的 Credit？（可略過）', "Arvel: defeat whose Credit token? (optional)"), [L('自己的', 'yours'), L('對手的', "opponent's")], { optional: true });
      if (i < 0) return;
      q = owners[i];
    } else if (!(await g.yesno(p, L(`亞維爾：擊敗一個${q === p ? '自己' : '對手'}的 Credit 代幣，造成 1 點傷害？`, `Arvel: defeat a Credit token (${q === p ? 'yours' : "opponent's"}) to deal 1 damage?`), { uid: u.uid }))) return;
    g.P(q).credits -= 1;
    g.log('logDefeat', 'Credit');
    await dealTo(g, p, 1, L('亞維爾：對一個單位或基地造成 1 點傷害', 'Arvel: deal 1 damage to a unit or base'), () => true, { bases: allBases });
  }
  def('Arvel Skeen | Win and Walk Away', 'card', { whenPlayed: arvel, onAttack: arvel });
  def("Cad Bane | Now it's My Turn", 'card', {
    async onAttack(g, u) {
      const P = g.P(u.ctrl);
      if (!P.credits) return;
      const i = await g.pickOption(u.ctrl, L('凱德・班恩：要擊敗幾個友方 Credit 代幣？（每個給 1 經驗）', 'Cad Bane: defeat how many friendly Credit tokens? (1 Experience each)'), Array.from({ length: P.credits + 1 }, (_, k) => String(k)));
      const n = Math.max(0, i);
      if (!n) return;
      P.credits -= n;
      g.log('logDefeat', 'Credit ×' + n);
      g.giveExp(u, n);
    },
  });
  def('Canto Bight Security', 'card', {
    async whenAttacked(g, u) {
      credit(g, u.ctrl, 1);
    },
  });
  def('Cantwell Arrestor Cruiser', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      if (!g.P(1 - p).units.length) return;
      if (!(await SWU.discloseFlow(g, p, ['Vigilance', 'Vigilance', 'Villainy'], N(u)))) return;
      const t = await g.pickUnit(p, L('坎特韋爾號：橫置一個敵方單位（本單位在場時它不能重置）', "Cantwell: exhaust an enemy unit (it can't ready while this unit is in play)"), enemyOf(p), { ctx: { harm: true } });
      if (!t) return;
      g.exhaust(t);
      t.lockedBy = u.uid;
    },
  });
  def('Chancellor Palpatine | I Am the Senate', 'card', {
    async whenPlayed(g, u) {
      if (!g.P(u.ctrl).units.some((x) => g.isLeaderUnit(x))) return;
      for (const s of g.createToken(u.ctrl, 'Spy', 2)) g.buff(s, 0, 0, 'phase', { Sentinel: true });
    },
  });
  def('Chewbacca | Resourceful Wookiee', 'card', {
    static(g, u) {
      const R = g.P(u.ctrl).resources;
      const ex = R.filter((r) => r.exhausted).length;
      const kw = {};
      if (ex) kw.Raid = ex;
      if (R.length && ex === R.length) kw.Overwhelm = true;
      return { kw };
    },
  });
  def('Condemn', 'card', {
    keepGrant: {
      async onAttack(g, u, atk) {
        const q = 1 - u.ctrl;
        if (await SWU.discloseFlow(g, q, ['Vigilance', 'Villainy'], 'Condemn')) g.buff(u, -6, 0, 'attack');
      },
    },
  });
  def('Constructed Lightsaber', 'card', {
    attachFilter: (g, p, u) => g.hasTrait(u, 'FORCE'),
    attachedStatic(g, up, u) {
      const a = u.card.a || [];
      if (a.includes('Heroism')) return { kw: { Restore: 2 } };
      if (a.includes('Villainy')) return { kw: { Raid: 2 } };
      return { kw: { Sentinel: true } };
    },
  });
  def('Corona Four | Justice for Alderaan', 'card', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('科羅納四號：可以給一個單位本階段 -2/-0', 'Corona Four: you may give a unit -2/-0 for this phase'), () => true, { optional: true, ctx: { harm: true } });
      if (t) g.buff(t, -2, 0, 'phase');
    },
    async whenDefeated(g, u) {
      const t = await g.pickUnit(u.ctrl, L('科羅納四號：可以擊敗一個戰力 0 的非領袖單位', 'Corona Four: you may defeat a non-leader unit with 0 power'), (x) => !g.isLeaderUnit(x) && g.power(x) <= 0, { optional: true, ctx: { harm: true } });
      if (t) await g.defeat(t, { ability: true, by: u.ctrl });
    },
  });
  def('Crackshot V-Wing', 'card', {
    async whenPlayed(g, u) {
      if (!g.P(u.ctrl).units.some((x) => x !== u && g.hasTrait(x, 'FIGHTER'))) await g.damageUnit(u, 1);
    },
  });
  def('Darth Tyranus | Servant of Sidious', 'card', {
    static: (g, u) => (g.P(u.ctrl).force ? { kw: { Ambush: true } } : null),
  });
  def('Disposable B1', 'card', {
    async whenPlayed(g, u) {
      const ph = g.G.phaseId;
      if (g.P(u.ctrl).units.some((x) => x !== u && x.playedPhase === ph) || (g.G.entered || []).some((e) => e.p === u.ctrl && e.phaseId === ph && e.uid !== u.uid)) g.draw(u.ctrl, 1);
    },
  });
  def('Domesticated Loth-Cat', 'card', {
    auraLoseKw: (g, src, u) => (u.ctrl !== src.ctrl ? ['Ambush', 'Support'] : null),
  });
  def("Emissary's Sheathipede", 'card', {
    async whenDefeated(g, u) {
      const q = 1 - u.ctrl;
      const ex = g.P(q).resources.filter((r) => r.exhausted);
      if (!ex.length) return;
      if (await g.yesno(q, L('使節號：要重置一個資源嗎？', "Emissary's Sheathipede: ready a resource?"))) ex[0].exhausted = false;
    },
  });
  def('Expendable Mercenary', 'card', {
    async whenDefeated(g, u) {
      const O = g.P(u.owner);
      const c = O.discard.find((x) => x.uid === u.uid);
      if (!c || u.ctrl !== u.owner) return;
      if (!(await g.yesno(u.ctrl, L('可犧牲的傭兵：把它從棄牌堆放進資源區？', 'Expendable Mercenary: resource it from the discard pile?')))) return;
      O.discard = O.discard.filter((x) => x !== c);
      O.resources.push({ ...c, exhausted: true });
      g.log('logResourced', O.name, 1);
    },
  });
  def('Galen Erso | Destroying His Creation', 'card', {
    aura: (g, src, u) => (u.ctrl !== src.ctrl ? { kw: { Raid: 1, Saboteur: true } } : null),
    async whenPlayed(g, u) {
      if (await g.yesno(u.ctrl, L('蓋倫・厄索：要讓對手取得這個單位的控制權嗎？', 'Galen Erso: have an opponent take control of this unit?'), { uid: u.uid })) takeControl(g, u, 1 - u.ctrl);
    },
  });
  def("Galen Erso | You'll Never Win", 'card', {
    async whenPlayed(g, u) {
      const name = await nameCard(g, u.ctrl, 1 - u.ctrl, u.card);
      (g.G.named = g.G.named || []).push({ kind: 'blank', name, victim: 1 - u.ctrl, src: u.uid });
      g.log('logManual', u.card.n, L('指名：', 'named: ') + name);
    },
  });
  def('Garindan | Information Broker', 'card', {
    async whenPlayed(g, u) {
      const q = 1 - u.ctrl;
      const name = await nameCard(g, u.ctrl, q, u.card);
      g.log('logManual', u.card.n, L('指名：', 'named: ') + name);
      await lookHand(g, u.ctrl, q, u.card);
      await discardFrom(g, u.ctrl, q, g.P(q).hand.filter((c) => c.card.n === name), false, u.card);
    },
  });
  def('General Grievous | Scourge of Dathomir', 'card', {
    noBaseHeal: true,
    async whenPlayed(g, u) {
      await dealTo(g, u.ctrl, 4, L('格里弗斯：對一個基地造成 4 點傷害', 'Grievous: deal 4 damage to a base'), () => false, { bases: allBases });
    },
  });
  def("Governor's Shuttle", 'card', {
    async whenPlayed(g, u) {
      const picks = [];
      for (const q of [u.ctrl, 1 - u.ctrl]) {
        if (!g.P(q).units.length) continue;
        const t = await g.pickUnit(q, L('總督座機：選擇一個你控制的單位（會被擊敗）', "Governor's Shuttle: choose a unit you control (it will be defeated)"), friendOf(q), { ctx: { harm: true } });
        if (t) picks.push(t);
      }
      for (const t of picks) await g.defeat(t, { ability: true, by: u.ctrl });
    },
  });
  def('Home One | On My Mark', 'card', {
    costMod: (g, p) => (g.P(1 - p).units.filter((u) => u.arena === 'Space').length >= 3 ? -3 : 0),
  });
  def('Kanan Jarrus | Spectre One', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const big = g.P(p).units.some((x) => (x.card.a || []).some((a) => a === 'Command' || a === 'Aggression'));
      const max = big ? 4 : 2;
      const t = await g.pickUnit(p, L(`凱南：可以讓一個費用 ${max} 以下的非領袖單位回到擁有者手牌`, `Kanan: you may return a non-leader unit that costs ${max} or less to its owner's hand`), (x) => !g.isLeaderUnit(x) && (x.card.c || 0) <= max, { optional: true });
      if (t) g.returnToHand(t);
    },
  });
  def('Lando Calrissian | Trust Me', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl;
      const en = g.P(1 - p).units;
      const fr = g.P(p).units.filter((x) => x !== u && !g.isLeaderUnit(x));
      if (!en.length || !fr.length) return;
      if (!(await g.yesno(p, L('藍道：選一個敵方單位俘虜你的另一個非領袖單位，並回復基地 6 點？', 'Lando: choose an enemy unit to capture another friendly non-leader unit, and heal 6 from your base?'), { uid: u.uid }))) return;
      const e = await g.pickUnit(p, L('選擇敵方單位（俘虜者）', 'choose the enemy unit (captor)'), (x) => en.includes(x));
      const f = await g.pickUnit(p, L('選擇要被俘虜的友方單位', 'choose the friendly unit to be captured'), (x) => fr.includes(x));
      if (!e || !f) return;
      g.healBase(p, 6);
      g.capture(e, f);
    },
  });
  async function lawbringer(g, u) {
    const asp = await chooseAspect(g, u.ctrl, u.card);
    for (const x of g.P(1 - u.ctrl).units.filter((x) => (x.card.a || []).includes(asp))) g.buff(x, -2, -2, 'phase');
    await g.checkState();
  }
  def('Lawbringer | Shadow Over Lothal', 'card', { whenPlayed: lawbringer, onAttack: lawbringer });
  def('Leia Organa | Extraordinary', 'card', {
    cantReady: (g, u) => u.arena === 'Space',
    actions: [
      {
        text: L('移到地面', 'move to ground'),
        can: (g, u) => u.arena === 'Space' && g.P(u.ctrl).force,
        async run(g, u) {
          g.P(u.ctrl).force = false;
          u.arena = 'Ground';
          g.log('logManual', u.card.n, L('移到地面戰區', 'moves to the ground arena'));
          for (const x of g.P(u.ctrl).units.filter((x) => (x.card.a || []).includes('Heroism'))) g.buff(x, 2, 2, 'phase');
        },
      },
    ],
  });
  def('Lieutenant Gorn | I Deserve Worse', 'card', {
    async onAttack(g, u) {
      const O = g.P(1 - u.ctrl);
      if (!O.credits) return;
      O.credits -= 1;
      g.P(u.ctrl).credits += 1;
      g.log('logTakeControl', g.P(u.ctrl).name, 'Credit');
    },
  });
  def('Logray | Bright Tree Shaman', 'card', {
    async onFriendlyDamaged(g, self, ev) {
      if (ev.u === self || (ev.card.c || 0) > 3) return;
      await dealTo(g, self.ctrl, 1, L('羅格雷：可以對一個敵方單位造成 1 點傷害', 'Logray: you may deal 1 damage to an enemy unit'), enemyOf(self.ctrl), { optional: true });
    },
  });
  def('Marrok | Mysterious Warrior', 'card', {
    loseKw: (g, u) => (g.isUpgraded(u) ? ['Sentinel'] : null),
    static: (g, u) => (g.isUpgraded(u) ? { kw: { Saboteur: true } } : null),
  });
  def('Migs Mayfeld | How About a Toast?', 'card', {
    async onAttack(g, u, atk) {
      if (atk.defender) await g.damageUnit(atk.defender, g.isUpgraded(u) ? 2 : 1);
    },
  });
  def('Ninth Sister | Hulking Inquisitor', 'card', {
    async whenPlayed(g, u) {
      const q = 1 - u.ctrl;
      const d = await g.discardFromHand(q, 1);
      if (!d.length) return;
      const n = d[0].card.c || 0;
      if (!n) return;
      await g.dealDivided(u.ctrl, n, g.allUnits(), { upTo: true, prompt: L(`第九修女：可以把 ${n} 點傷害任意分配給單位`, `Ninth Sister: you may divide ${n} damage among any units`) });
    },
  });
  def('Nuvo Vindi | Blue Shadow Perfected', 'card', {
    async whenPlayed(g, u) {
      const t = await g.pickUnit(u.ctrl, L('努沃・溫迪：可以給一個單位弱點代幣', 'Nuvo Vindi: you may give a Weakness token to a unit'), () => true, { optional: true, ctx: { harm: true } });
      if (t) g.giveToken(t, 'Weakness');
    },
    async onAnyDefeated(g, self, snap) {
      if (snap.ctrl === self.ctrl || !(snap.upgrades || []).some((x) => x.card.n === 'Weakness')) return;
      if (self.nuvoRound === g.G.round) return;
      const t = await g.pickUnit(self.ctrl, L('努沃・溫迪：可以給一個單位弱點代幣（每輪一次）', 'Nuvo Vindi: you may give a Weakness token to a unit (once per round)'), () => true, { optional: true, ctx: { harm: true } });
      if (!t) return;
      self.nuvoRound = g.G.round;
      g.giveToken(t, 'Weakness');
    },
  });
  def('Obi-Wan Kenobi | I Sense a Trap', 'card', {
    async whenPlayed(g, u) {
      const p = u.ctrl, P = g.P(p), ph = g.G.phaseId;
      const dead = (g.G.defeated || []).filter((d) => d.phaseId === ph && d.card.t === 'Unit').map((d) => d.uid);
      const cands = P.discard.filter((c) => dead.includes(c.uid) && c.card.t === 'Unit' && g.canPay(p, Math.max(0, g.costOf(p, c.card) - 5)));
      const fresh = g.allUnits().filter((x) => x.playedPhase === ph);
      const opts = [];
      if (cands.length) opts.push(L('從棄牌堆打出本階段被擊敗的單位（減 5 費）', 'play a unit defeated this phase from your discard (costs 5 less)'));
      if (fresh.length) opts.push(L('本階段進場的單位 -5/-5', 'a unit that entered play this phase gets -5/-5'));
      if (!opts.length) return;
      const i = await g.pickOption(p, L('歐比王：可以選一項', 'Obi-Wan: you may choose one'), opts, { optional: true });
      if (i < 0) return;
      if (opts[i] === opts[0] && cands.length) {
        const pick = await g.pickCards(p, L('選擇要打出的單位', 'choose a unit to play'), cands, 0, 1);
        if (!pick.length) return;
        P.discard = P.discard.filter((x) => x !== pick[0]);
        P.hand.push(pick[0]);
        await g.playCard(p, pick[0].uid, 'hand', { discount: 5 });
      } else {
        const t = await g.pickUnit(p, L('選擇本階段進場的單位（-5/-5）', 'choose a unit that entered play this phase (-5/-5)'), (x) => fresh.includes(x), { ctx: { harm: true } });
        if (t) g.buff(t, -5, -5, 'phase');
        await g.checkState();
      }
    },
  });
  def('Obi-Wan Kenobi | Protective Padawan', 'card', {
    async onFriendlyPlay(g, self, u) {
      if (g.hasTrait(u, 'FORCE')) g.buff(self, 0, 0, 'phase', { Sentinel: true });
    },
  });
  def('Queen Amidala | Championing Her People', 'card', {
    async whenPlayed(g, u) {
      g.createToken(u.ctrl, 'Spy', 2);
    },
    async preventDamage(g, self, u, n) {
      if (u !== self) return false;
      const tr = self.card.tr || [];
      const others = g.P(self.ctrl).units.filter((x) => x !== self && (x.card.tr || []).some((t) => tr.includes(t)));
      if (!others.length) return false;
      const t = await g.pickUnit(self.ctrl, L(`艾米達拉女王將受到 ${n} 點傷害：可以擊敗另一個同特徵的友方單位來防止`, `Queen Amidala would take ${n} damage: you may defeat another friendly unit sharing a trait to prevent it`), (x) => others.includes(x), { optional: true });
      if (!t) return false;
      await g.defeat(t, { ability: true, by: self.ctrl });
      return true;
    },
  });
  def('Ravager | Final Imperial Command', 'card', {
    async onFriendlyPlay(g, self, u) {
      const pw = g.power(u);
      if (!pw) return;
      const t = await g.pickUnit(self.ctrl, L(`劫掠者號：可以讓 ${N(u)} 對同戰區一個單位造成 ${pw} 點傷害`, `Ravager: you may have ${u.card.n} deal ${pw} damage to a unit in the same arena`), (x) => x.arena === u.arena && x !== u, { optional: true, ctx: { harm: true } });
      if (t) await g.damageUnit(t, pw);
    },
  });
  def('Ryder Azadi | Restored Governor', 'card', {
    async whenPlayed(g, u) {
      const name = await nameCard(g, u.ctrl, 1 - u.ctrl, u.card);
      (g.G.named = g.G.named || []).push({ kind: 'ban', name, victim: 1 - u.ctrl, src: u.uid });
      g.log('logManual', u.card.n, L('指名：', 'named: ') + name);
    },
  });
  def("Sabine's Masterpiece | Crazy Colorful", 'card', {
    async onAttack(g, u) {
      const p = u.ctrl, P = g.P(p);
      const has = (a) => P.units.some((x) => (x.card.a || []).includes(a));
      if (has('Vigilance')) {
        const t = await g.pickTarget(p, L('莎賓的傑作：從一個基地回復 2 點', "Sabine's Masterpiece: heal 2 damage from a base"), { bases: allBases });
        if (t && t.base != null) g.healBase(t.base, 2);
      }
      if (has('Command')) {
        const t = await g.pickUnit(p, L('莎賓的傑作：給一個單位經驗代幣', "Sabine's Masterpiece: give an Experience token to a unit"), () => true);
        if (t) g.giveExp(t, 1);
      }
      if (has('Aggression')) await dealTo(g, p, 1, L('莎賓的傑作：對一個單位或基地造成 1 點傷害', "Sabine's Masterpiece: deal 1 damage to a unit or base"), () => true, { bases: allBases });
      if (has('Cunning')) {
        const i = await g.pickOption(p, L('莎賓的傑作：橫置或重置一個資源', "Sabine's Masterpiece: exhaust or ready a resource"), [L('重置自己的資源', 'ready your resource'), L('橫置自己的資源', 'exhaust your resource'), L('橫置對手的資源', "exhaust opponent's resource"), L('重置對手的資源', "ready opponent's resource")]);
        const R = i >= 2 ? g.P(1 - p).resources : P.resources;
        const wantEx = i === 1 || i === 2;
        const r = R.find((x) => x.exhausted !== wantEx);
        if (r) r.exhausted = wantEx;
      }
    },
  });
  def('Screeching TIE Fighter', 'card', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('尖嘯鈦戰機：可以選一個地面單位，本階段失去關鍵字', 'Screeching TIE: you may choose a ground unit; it loses its keywords this phase'), (x) => x.arena === 'Ground', { optional: true, ctx: { harm: true } });
      if (t) t.noKwPhase = g.G.phaseId;
    },
  });
  def('Shin Hati | Going Somewhere?', 'card', {
    static: (g, u) => (u.arena === 'Ground' && !g.P(u.ctrl).units.some((x) => x !== u && x.arena === 'Ground' && !g.isLeaderUnit(x)) ? { kw: { Sentinel: true } } : null),
  });
  def("Silver Angel | Trace's Hope", 'card', {
    async whenHealed(g, u) {
      await dealTo(g, u.ctrl, 1, L('銀天使號：可以對一個太空單位造成 1 點傷害', 'Silver Angel: you may deal 1 damage to a space unit'), (x) => x.arena === 'Space', { optional: true });
    },
  });
  def('Stolen AT-Hauler', 'card', {
    async whenDefeated(g, u) {
      (g.G.oppFreePlay = g.G.oppFreePlay || []).push({ uid: u.uid, owner: u.owner, for: 1 - u.ctrl, phaseId: g.G.phaseId });
    },
  });
  def('The Mandalorian | Devoted Rescuer', 'card', {
    async preventDamage(g, self, u, n) {
      if (u === self || u.ctrl !== self.ctrl) return false;
      if (!self.upgrades.some((x) => x.card.n === 'Shield')) return false;
      if (!(await g.yesno(self.ctrl, L(`${N(u)} 將受到 ${n} 點傷害：要擊敗曼達洛人身上的護盾來防止嗎？`, `${u.card.n} would take ${n} damage: defeat a Shield on The Mandalorian to prevent it?`), { uid: u.uid }))) return false;
      const i = self.upgrades.findIndex((x) => x.card.n === 'Shield');
      self.upgrades.splice(i, 1);
      g.log('logShield', u.card.n);
      return true;
    },
  });
  def('Victor Squadron | In Attack Formation', 'card', { entersReady: true });
  def('Wicket | Yub Nub!', 'card', { cantAttackBase: () => true });
  def('Yoda | A Disturbing Puzzle', 'card', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, L('尤達：可以選一個敵方單位，本階段防止它受到與造成的戰鬥傷害', 'Yoda: you may choose an enemy unit; prevent all combat damage dealt to and by it this phase'), enemyOf(u.ctrl), { optional: true, ctx: { harm: true } });
      if (t) t.yodaPhase = g.G.phaseId;
    },
  });

  // ===================== 事件 =====================
  def('Booma Ball', 'card', {
    async whenPlayed(g, inst) {
      await boomaBall(g, inst.owner, inst);
    },
  });
  async function boomaBall(g, p, self) {
    const ups = [];
    for (const u of g.allUnits()) for (const up of u.upgrades) if (up !== self && up.uid !== (self && self.uid) && !/Token/.test(up.card.t) && !up.leaderPilot && (up.card.c || 0) <= 3) ups.push({ uid: up.uid, card: up.card, host: u, up });
    if (!ups.length) return;
    const pick = await g.pickCards(p, L('波瑪球：可以讓一張費用 3 以下的升級卡回到擁有者手牌', "Booma Ball: you may return an upgrade that costs 3 or less to its owner's hand"), ups, 0, 1);
    if (!pick.length) return;
    const { host, up } = pick[0];
    host.upgrades = host.upgrades.filter((x) => x !== up);
    g.P(up.owner).hand.push({ uid: up.uid, card: up.card, owner: up.owner });
    g.log('logBounce', up.card.n);
    await g.checkState();
  }
  def('Forced Pacification', 'card', {
    async event(g, p) {
      const mine = g.P(p).units.map((u) => ({ uid: u.uid, card: u.card }));
      if (!mine.length) return;
      const pick = await g.pickCards(p, L('強制綏靖：擊敗任意數量的友方單位（每個橫置 2 個敵方單位）', 'Forced Pacification: defeat any number of friendly units (exhaust 2 enemy units for each)'), mine, 0, mine.length);
      let n = 0;
      for (const c of pick) {
        const u = g.findUnit(c.uid);
        if (!u) continue;
        await g.defeat(u, { ability: true, by: p });
        if (!g.findUnit(u.uid)) n++;
      }
      const done = [];
      for (let i = 0; i < n * 2; i++) {
        const t = await g.pickUnit(p, L(`強制綏靖：橫置一個敵方單位（${i + 1}/${n * 2}）`, `Forced Pacification: exhaust an enemy unit (${i + 1}/${n * 2})`), (x) => x.ctrl !== p && !done.includes(x), { ctx: { harm: true } });
        if (!t) break;
        done.push(t);
        g.exhaust(t);
      }
    },
  });
  def('Hold For Questioning', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('拘留審問：橫置一個敵方單位', 'Hold For Questioning: exhaust an enemy unit'), enemyOf(p), { ctx: { harm: true } });
      if (!t) return;
      g.exhaust(t);
      const q = t.ctrl, asp = t.card.a || [];
      await lookHand(g, p, q, { n: 'Hold For Questioning', key: 'Hold For Questioning' });
      await discardFrom(g, p, q, g.P(q).hand.filter((c) => (c.card.a || []).some((a) => asp.includes(a))), false, { n: 'Hold For Questioning', key: 'Hold For Questioning' });
    },
  });
  def('Hotshot Maneuver', 'card', {
    async event(g, p) {
      const can = g.P(p).units.filter((u) => g.canAttackWith(u));
      const t = await g.pickUnit(p, L('王牌機動：選擇一個友方單位', 'Hotshot Maneuver: choose a friendly unit'), friendOf(p));
      if (!t) return;
      let n = SWU.abilityLines(t.card, t.isLeader ? 'unit' : 'card').filter((l) => /On Attack/i.test(l)).length;
      for (const up of t.upgrades) {
        const tx = up.leaderPilot ? up.card.bt || '' : up.card.tx || '';
        n += (tx.match(/gains:?\s*["“][^"”]*On Attack/gi) || []).length;
      }
      const hit = [];
      for (let i = 0; i < n; i++) {
        const v = await g.pickUnit(p, L(`王牌機動：對一個不同的敵方單位造成 2 點傷害（${i + 1}/${n}）`, `Hotshot Maneuver: deal 2 damage to a different enemy unit (${i + 1}/${n})`), (x) => x.ctrl !== p && !hit.includes(x.uid), { ctx: { harm: true } });
        if (!v) break;
        hit.push(v.uid);
        await g.damageUnit(v, 2);
      }
      if (g.findUnit(t.uid) && can.includes(t) && g.canAttackWith(t)) await g.attack(t, {});
    },
  });
  def('Migrate', 'card', {
    async event(g, p) {
      const n = Math.floor(g.P(p).resources.length / 3);
      if (n) g.createToken(p, 'Beast', n);
    },
  });
  def('System Shock', 'card', {
    async event(g, p) {
      const ups = [];
      for (const u of g.allUnits()) for (const up of u.upgrades) if (!up.leaderPilot) ups.push({ uid: up.uid, card: up.card, host: u, up });
      if (!ups.length) return;
      const pick = await g.pickCards(p, L('系統衝擊：擊敗一張非領袖升級卡', 'System Shock: defeat a non-leader upgrade'), ups, 1, 1);
      if (!pick.length) return;
      const { host, up } = pick[0];
      g.removeUpgrade(host, up);
      g.log('logDefeat', up.card.n);
      await g.damageUnit(host, 1);
      await g.checkState();
    },
  });
  def('The Tree Remembers', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('古樹記得：一個敵方單位本階段失去所有能力（費用 3 以下則擊敗）', 'The Tree Remembers: an enemy unit loses all abilities this phase (defeat it if it costs 3 or less)'), enemyOf(p), { ctx: { harm: true } });
      if (!t) return;
      t.blankPhase = g.G.phaseId;
      if ((t.card.c || 0) <= 3) await g.defeat(t, { ability: true, by: p });
    },
  });
  def('Trench Run', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, L('壕溝突擊：用一個戰機攻擊（+4/+0）', 'Trench Run: attack with a Fighter unit (+4/+0)'), (u) => u.ctrl === p && g.hasTrait(u, 'FIGHTER') && g.canAttackWith(u));
      if (!t) return;
      await g.attack(t, {
        power: 4,
        async onAttackExtra(atk) {
          const Q = g.P(1 - p);
          const cs = Q.deck.splice(0, 2);
          Q.discard.push(...cs);
          if (cs.length) g.log('logMill', Q.name, cs.length);
          if (cs.length) g.revealCards(Q.idx, cs, 'mill');
          const diff = cs.length === 2 ? Math.abs((cs[0].card.c || 0) - (cs[1].card.c || 0)) : 0;
          if (diff) await g.damageUnit(t, diff, { unpreventable: true });
        },
      });
    },
  });

  // ===================== 升級 =====================
  def('Figure of Unity', 'card', {
    attachFilter: (g, p, u) => !!u.card.u,
    grant: {
      aura: (g, src, u) => (!src.exhausted && u.ctrl === src.ctrl && u !== src ? { kw: { Overwhelm: true, Raid: 1, Restore: 1 } } : null),
    },
  });
  def('Nimble Prowess', 'card', {
    async whenPlayed(g, inst, host) {
      const t = await g.pickUnit(inst.owner, L('靈巧身手：可以橫置一個同戰區的單位', "Nimble Prowess: you may exhaust a unit in attached unit's arena"), (x) => x.arena === host.arena, { optional: true, ctx: { harm: true } });
      if (t) g.exhaust(t);
    },
  });
  def('The Darksaber | Icon of Leadership', 'card', {
    attachFilter: (g, p, u) => !!u.card.u && !g.hasTrait(u, 'VEHICLE'),
  });
  def('Verdant Fortress', 'card', {
    baseAura: (g, up, bp, u) => (u.ctrl === bp ? { kw: { Raid: 1 } } : null),
  });
  def('Whistling Birds', 'card', {
    grant: {
      async onFriendlyAttackEnd(g, src, atk) {
        if (atk.attacker !== src || !atk.base || !(atk.baseDamage > 0)) return;
        const q = 1 - src.ctrl;
        for (const x of g.P(q).units.filter((x) => x.arena === src.arena)) await g.damageUnit(x, 2, { combat: true });
        await g.checkState();
      },
    },
  });
})();
