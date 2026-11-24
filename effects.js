/* 卡片專屬效果。鍵是「卡名 | 副標」。
 * side：'card' 一般卡（含單位、事件、升級）、'leader' 領袖面、'unit' 領袖單位面。
 * 沒寫在這裡的卡：關鍵字照樣自動處理，文字能力會跳出「手動處理／由奈判讀」。
 */
(function () {
  const SWU = window.SWU;
  const T = (...a) => SWU.t(...a);
  const REG = new Map();
  function def(key, side, impl) {
    impl.implemented = true;
    REG.set(key.toLowerCase() + '#' + side, impl);
  }
  SWU.EFFECTS = {
    get(card, side = 'card') {
      if (!card) return null;
      const h = REG.get((card.key || SWU.cardKey(card)).toLowerCase() + '#' + side);
      if (h && !h.auto) return h;
      const gx = SWU.GFX && SWU.GFX.impl(card, side);
      return gx || h || null;
    },
    hasHand(card, side) {
      const h = REG.get((card.key || SWU.cardKey(card)).toLowerCase() + '#' + side);
      return !!(h && !h.auto);
    },
    has(card, side) {
      return !!this.get(card, side);
    },
    def,
    list() {
      return [...REG.keys()];
    },
  };

  // ---------- 共用小工具 ----------
  const enemy = (g, p) => (u) => u.ctrl !== p;
  const friendly = (g, p) => (u) => u.ctrl === p;
  // 揭示：手牌裡的卡片圖示能湊出指定的阿斯佩克特
  function canDisclose(g, p, aspects) {
    const pool = g.P(p).hand.flatMap((c) => c.card.a || []);
    const need = [...aspects];
    for (const a of pool) {
      const i = need.indexOf(a);
      if (i >= 0) need.splice(i, 1);
    }
    return need.length === 0;
  }
  async function disclose(g, p, aspects, label) {
    if (!canDisclose(g, p, aspects)) return false;
    const ok = await g.yesno(p, T('promptDisclose', aspects.map((a) => T('asp_' + a)).join(' '), label));
    if (ok) g.log('logDisclose', g.P(p).name, aspects.join(' '));
    return ok;
  }
  SWU.canDisclose = canDisclose;
  const vanilla = { static: null };

  // ===== 領袖：Luke Skywalker – I Can Save Him =====
  def('Luke Skywalker | I Can Save Him', 'leader', {
    async onFriendlyAttackEnd(g, L, atk) {
      const u = atk.attacker;
      if (L.exhausted || !g.findUnit(u.uid) || u.damage <= 0) return;
      if (await g.yesno(L.owner, T('promptLukeFront', u.card.n), { uid: u.uid })) {
        L.exhausted = true;
        g.heal(u, 1);
      }
    },
  });
  def('Luke Skywalker | I Can Save Him', 'unit', {
    async onFriendlyAttackEnd(g, self, atk) {
      const u = atk.attacker;
      const p = self.ctrl;
      const alive = g.findUnit(u.uid) && u.damage > 0;
      const baseDmg = g.P(p).base.damage > 0;
      if (!alive && !baseDmg) return;
      const opts = [];
      if (alive) opts.push(T('optHealUnit', u.card.n, 2));
      if (baseDmg) opts.push(T('optHealBase', 2));
      const i = opts.length === 1 ? 0 : await g.pickOption(p, T('promptLukeBack'), opts);
      if (opts[i] && alive && i === 0) g.heal(u, 2);
      else g.healBase(p, 2);
    },
  });

  // ===== 單位 =====
  def('Gungi | Fighting for Kashyyyk', 'card', {
    async whenDamagedSurvive(g, u) {
      if (!u.exhausted || !g.P(u.ctrl).hand.length) return;
      if (!(await g.yesno(u.ctrl, T('promptGungi'), { uid: u.uid }))) return;
      const d = await g.discardFromHand(u.ctrl, 1);
      if (d.length) g.ready(u);
    },
  });
  def('Gungi | Finding Himself', 'card', vanilla);
  def('Huyang | Your Aptitude Falls Short', 'card', {
    async onAttack(g, u) {
      const t = await g.pickUnit(u.ctrl, T('promptHuyang'), (x) => g.isUpgraded(x), { optional: true });
      if (t) g.buff(t, -4, 0, 'phase');
    },
  });
  def('Mina Bonteri | Stop This War', 'card', {
    async whenDefeated(g, u) {
      if (await disclose(g, u.ctrl, ['Command', 'Command', 'Heroism'], u.card.n)) g.draw(u.ctrl, 1);
    },
  });
  def('Soaring Can-Cell', 'card', {
    removeKw: ['Ambush'],
    static: (g, u) => (g.controlsBaseTrait(u.ctrl, 'KASHYYYK') ? { kw: { Ambush: true } } : null),
  });
  def('Yord Fandar | Devoutly Disciplined', 'card', {
    removeKw: ['Sentinel'],
    static: (g) => (g.G.players.some((P) => P.base.damage >= 15) ? { kw: { Sentinel: true } } : null),
  });
  def('Latts Razzi | Deadly Whipmaster', 'card', {
    async whenPlayed(g, u) {
      const i = await g.pickOption(u.ctrl, T('promptLatts'), [T('optShield'), T('optExp')]);
      if (i === 1) g.giveExp(u);
      else g.giveShield(u);
      const t = await g.pickUnit(u.ctrl, T('promptDealPower', g.power(u)), (x) => x.ctrl !== u.ctrl && x.arena === 'Ground');
      if (t) await g.damageUnit(t, g.power(u));
    },
  });
  def('Leia Organa | Vigilant for Danger', 'card', {
    async onAttack(g, u) {
      await leiaVfd(g, u, u);
    },
    supportGrant: async (g, src, atk) => leiaVfd(g, atk.attacker, src),
  });
  async function leiaVfd(g, attacker, src) {
    if (g.remaining(attacker) <= 1 && !attacker.upgrades.some((x) => x.card.n === 'Shield')) {
      // 會自殺時仍讓玩家決定
    }
    if (!g.P(attacker.ctrl).base.damage) return;
    if (await g.yesno(attacker.ctrl, T('promptLeiaVfd', attacker.card.n), { uid: attacker.uid })) {
      await g.damageUnit(attacker, 1);
      g.healBase(attacker.ctrl, 2);
    }
  }
  def('Lifetree Caravan', 'card', {
    async whenPlayed(g, u) {
      if (g.P(u.ctrl).units.length >= 3 && (await g.yesno(u.ctrl, T('promptResourceTop')))) g.resourceTop(u.ctrl);
    },
  });
  def('Wookiee Protector', 'card', vanilla);
  def('Yanna | Sanctuary Elder', 'card', vanilla);
  def('Cobb Vanth | Let Me Handle This', 'card', {
    async onFriendlyPlay(g, self, played) {
      if (played === self) return;
      if (await g.yesno(self.ctrl, T('promptCobb', played.card.n), { uid: self.uid })) {
        await g.damageUnit(self, 2);
        if (g.findUnit(played.uid)) g.giveShield(played);
      }
    },
  });
  def('Paz Vizsla | For a Brighter Future', 'card', {
    async whenDefeated(g, u) {
      if (!u.defeatedByCombat) g.createToken(u.ctrl, 'Mandalorian', 2);
    },
  });
  def('Captain Typho | All Necessary Precautions', 'card', {
    async whenAttacked(g, u) {
      if (g.P(u.ctrl).base.damage && (await disclose(g, u.ctrl, ['Command', 'Heroism'], u.card.n))) g.healBase(u.ctrl, 1);
    },
  });
  def('Ezra Bridger | Spectre Six', 'card', {
    async whenPlayed(g, u) {
      const big = g.P(u.ctrl).units.some((x) => (x.card.a || []).some((a) => a === 'Aggression' || a === 'Cunning'));
      const n = big ? 4 : 2;
      const t = await g.pickUnit(u.ctrl, T('promptHealUnit', n), (x) => x.damage > 0, { optional: true });
      if (t) g.heal(t, n);
    },
  });
  def("Qui-Gon Jinn | We'll Handle This", 'card', {
    async whenPlayed(g, u) {
      const ids = g.G.attackedBase?.[u.ctrl] || [];
      const t = await g.pickUnit(u.ctrl, T('promptQuiGon'), (x) => ids.includes(x.uid) && x.ctrl !== u.ctrl, { optional: true });
      if (!t) return;
      const wasLeader = t.isLeader;
      await g.defeat(t, { ability: true, srcP: u.ctrl });
      if (wasLeader) await g.defeat(u, { ability: true, srcP: u.ctrl });
    },
  });
  def('Wookiee Rangers', 'card', {
    removeKw: ['Sentinel'],
    static: (g, u) =>
      g.controlsBaseTrait(u.ctrl, 'KASHYYYK') || g.P(u.ctrl).units.some((x) => x !== u && g.hasTrait(x, 'WOOKIEE')) ? { kw: { Sentinel: true } } : null,
  });
  def('Hunter | Everyone Get to Cover!', 'card', {
    async whenPlayed(g, u) {
      for (let k = 0; k < 2; k++) {
        const i = await g.pickOption(u.ctrl, T('promptHunter', k + 1), [T('optShieldAUnit'), T('optAttackExhausted')], { optional: true });
        if (i === 0) {
          const t = await g.pickUnit(u.ctrl, T('promptShieldTarget'), () => true);
          if (t) g.giveShield(t);
        } else if (i === 1) {
          const a = await g.pickUnit(u.ctrl, T('promptAttacker'), (x) => x.ctrl === u.ctrl && g.attackTargets(x, { unitsOnly: true }).units.length > 0, { optional: true });
          if (a) {
            a.exhausted = false;
            await g.attack(a, { unitsOnly: true });
          }
        }
      }
    },
  });
  def('Scorpenek Annihilator Droid', 'card', vanilla);
  def('Kelleran Beq | The Sabered Hand', 'card', {
    async whenPlayed(g, u) {
      const P = g.P(u.ctrl);
      const top = P.deck.splice(0, 7);
      const units = top.filter((c) => c.card.t === 'Unit');
      g.log('logSearch', P.name, top.length);
      const pick = units.length ? await g.pickCards(u.ctrl, T('promptKelleran'), units, 0, 1) : [];
      const rest = top.filter((c) => !pick.includes(c));
      P.deck.push(...SWU.shuffle(rest));
      if (pick.length) {
        const c = pick[0];
        const cost = Math.max(0, g.costOf(u.ctrl, c.card) - 3);
        if (g.canPay(u.ctrl, cost)) await g.playCard(u.ctrl, c.uid, 'deck', { inst: c, discount: 3 });
        else {
          P.deck.push(c);
          g.log('logCantPay', c.card.n);
        }
      }
    },
  });
  def('Luminara Unduli | Besieged General', 'card', {
    async onFriendlyPlay(g, self) {
      const a = await g.pickUnit(self.ctrl, T('promptLuminara'), (x) => x.ctrl === self.ctrl && g.canAttackWith(x), { optional: true });
      if (a) await g.attack(a, { power: 2 });
    },
  });
  def('Rey | Skywalker', 'card', {
    cantBeDefeatedBy: (g, u, why) => why.ability && why.srcP != null && why.srcP !== u.ctrl,
  });
  def('Trask Walker', 'card', {
    async whenPlayed(g, u) {
      await trask(g, u);
    },
    async onAttack(g, u) {
      await trask(g, u);
    },
  });
  async function trask(g, u) {
    const P = g.P(u.ctrl);
    const cands = P.discard.filter((c) => c.card.t === 'Unit' && (c.card.c || 0) <= 7);
    if (!cands.length) return;
    const [c] = await g.pickCards(u.ctrl, T('promptTrask'), cands, 1, 1);
    if (!c) return;
    const i = await g.pickOption(u.ctrl, T('promptTrask2', c.card.n), [T('optTraskBottom'), T('optTraskHand')]);
    P.discard = P.discard.filter((x) => x !== c);
    if (i === 1) P.hand.push(c);
    else {
      P.deck.push(c);
      g.healBase(u.ctrl, 3);
    }
  }
  def('Bo-Katan Kryze | Alone', 'card', {
    async whenPlayed(g, u) {
      for (const e of g.opp(u.ctrl).units) g.buff(e, -3, -3, 'phase');
      await g.checkState();
    },
    async onAnyDefeated(g, self, dead) {
      if (dead.ctrl === self.ctrl) return;
      const t = await g.pickUnit(self.ctrl, T('promptExpTarget'), (x) => x.ctrl === self.ctrl);
      if (t) g.giveExp(t);
    },
  });
  def('Blue Leader | Scarif Air Support', 'card', {
    async whenPlayed(g, u) {
      if (!g.canPay(u.ctrl, 2)) return;
      if (await g.yesno(u.ctrl, T('promptBlueLeader'), { uid: u.uid })) {
        g.pay(u.ctrl, 2);
        u.arena = 'Ground';
        g.giveExp(u, 2);
      }
    },
  });
  def('T-6 Shuttle 1974 | Stay Close', 'card', {
    async whenAttacked(g, u) {
      if (await g.yesno(u.ctrl, T('promptT6'), { uid: u.uid })) g.giveExp(u);
    },
  });
  def("T-6 Shuttle 1974 | With a Mentor's Dedication", 'card', {
    actions: [
      {
        label: 'abT6Mentor',
        can: (g, u) => !u.exhausted && g.P(u.ctrl).units.length > 1,
        async run(g, u) {
          u.exhausted = true;
          const t = await g.pickUnit(u.ctrl, T('promptBuffTarget', '+2/+2'), (x) => x !== u);
          if (!t) return;
          g.buff(t, 2, 2, 'phase');
          if (t.ctrl === u.ctrl && g.canAttackWith(t) && (await g.yesno(u.ctrl, T('promptAttackWith', t.card.n)))) await g.attack(t, {});
        },
      },
    ],
  });

  // ===== 事件 =====
  def('Overgrowth', 'card', {
    async event(g, p, inst) {
      if (g.controlsBaseTrait(p, 'KASHYYYK')) {
        const src = await g.pickUnit(p, T('promptOvergrowth1'), (x) => x.ctrl === p);
        if (src) {
          const t = await g.pickUnit(p, T('promptOvergrowth2', g.power(src)), (x) => x.ctrl !== p);
          if (t) await g.damageUnit(t, g.power(src));
        }
      }
      // 把這張卡放進資源區
      const P = g.P(p);
      const i = P.discard.findIndex((c) => c.uid === inst.uid);
      if (i >= 0) {
        const [c] = P.discard.splice(i, 1);
        P.resources.push({ ...c, exhausted: true });
        g.log('logResourceThis', c.card.n);
      }
    },
  });
  def('Lost and Forgotten', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, T('promptDefeatNonLeader'), (x) => !x.isLeader);
      if (!t) return;
      await g.defeat(t, { ability: true, srcP: p });
      if (!g.findUnit(t.uid)) g.healBase(p, 3);
    },
  });
  def('Direct Hit', 'card', {
    async event(g, p) {
      const t = await g.pickUnit(p, T('promptDefeatVehicle'), (x) => !x.isLeader && g.hasTrait(x, 'VEHICLE'));
      if (t) await g.defeat(t, { ability: true, srcP: p });
    },
  });

  // ===== 升級 =====
  def("Luke's Jedi Lightsaber | Constructed by Hand", 'card', {
    attachedStatic: (g, up, u) => (u.card.n === 'Luke Skywalker' ? { kw: { Sentinel: true } } : null),
    async whenPlayed() {},
  });
  def('Bestial Bond', 'card', {
    async whenPlayed(g, inst, u) {
      if (g.hasTrait(u, 'CREATURE') || g.hasTrait(u, 'FORCE')) g.createToken(u.ctrl, 'Beast', 1);
    },
  });
  def('Moral Authority', 'card', {
    async whenPlayed(g, inst, u) {
      const t = await g.pickUnit(u.ctrl, T('promptCapture'), (x) => x.ctrl !== u.ctrl && !x.isLeader && g.remaining(x) < g.remaining(u));
      if (t) g.capture(u, t);
    },
  });

  // ===== 標記「純關鍵字」的卡為已實作（避免多跳手動視窗）=====
  SWU.markVanillaKeywordCards = function () {
    for (const c of SWU.DB.list) {
      if (!['Unit', 'Upgrade'].includes(c.t)) continue;
      if (REG.has(c.key.toLowerCase() + '#card')) continue;
      if (!SWU.abilityLines(c).length) def(c.key, 'card', { auto: true });
    }
  };
})();
