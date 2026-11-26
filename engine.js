/* 星際大戰：無極限 練牌桌 — 規則引擎
 * 遊戲狀態是純資料（可 JSON 序列化給 AI），流程用 async/await，
 * 需要玩家決定的地方呼叫 io[玩家].choose(...)，人類由介面回答，由奈由 AI 模組回答。
 */
(function () {
  const SWU = (window.SWU = window.SWU || {});
  const ASPECTS = ['Vigilance', 'Command', 'Aggression', 'Cunning', 'Heroism', 'Villainy'];
  SWU.ASPECTS = ASPECTS;

  // ---------- 卡片資料庫 ----------
  const DB = { list: [], byKey: new Map(), byId: new Map(), byName: new Map() };
  SWU.DB = DB;
  SWU.cardKey = (c) => c.n + (c.s ? ' | ' + c.s : '');
  SWU.initDB = function (cards) {
    DB.list = cards;
    for (const c of cards) {
      c.key = SWU.cardKey(c);
      DB.byKey.set(c.key.toLowerCase(), c);
      if (c.id) DB.byId.set(c.id, c);
      for (const pid of c.ids || []) if (!DB.byId.has(pid)) DB.byId.set(pid, c);
      const nk = c.n.toLowerCase();
      if (!DB.byName.has(nk)) DB.byName.set(nk, []);
      DB.byName.get(nk).push(c);
      c.kwp = parseKeywords(c.t === 'Leader' ? c.bt || '' : c.tx || '');
    }
  };
  SWU.token = (name) => DB.list.find((c) => c.n === name && /Token/.test(c.t));

  // 解析卡面印刷的關鍵字（行首），條件式的「gains X」不在此處理
  function parseKeywords(text) {
    const k = {};
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      let m;
      if ((m = line.match(/^(Sentinel|Overwhelm|Saboteur|Grit|Ambush|Shielded|Hidden|Support|Fortify)\b/))) k[m[1]] = true;
      if ((m = line.match(/^Raid (\d+)/))) k.Raid = (k.Raid || 0) + +m[1];
      if ((m = line.match(/^Restore (\d+)/))) k.Restore = (k.Restore || 0) + +m[1];
      if ((m = line.match(/^Exploit (\d+)/))) k.Exploit = (k.Exploit || 0) + +m[1];
      if ((m = line.match(/^Smuggle \[([^\]]+)\]/))) {
        const c = m[1].match(/(\d+)/);
        k.Smuggle = c ? +c[1] : 0;
        k.SmuggleRaw = m[1];
      }
      if (/^Bounty\b/.test(line)) k.Bounty = (k.Bounty || []).concat(line);
      if (/^Coordinate\b/.test(line)) k.Coordinate = true;
      if (/^Piloting\b/.test(line)) k.Piloting = true;
    }
    return k;
  }
  SWU.parseKeywords = parseKeywords;
  SWU.AURA_LOSEKW = new Set(['Domesticated Loth-Cat']);
  SWU.AURA_GRANT = new Set();
  SWU.GLOBAL_GRANT = new Set();
  SWU.TRAIT_GRANT = new Set();
  SWU.DRAW_TRIG = new Set();

  // 卡片文字有沒有「關鍵字以外」的能力
  // Piloting 單位：Piloting 那行之後是「當升級時」的能力（side 'pilot'），之前是單位本身的能力
  SWU.pilotSplit = function (card) {
    const ls = (card.tx || '').split('\n');
    const i = card.t === 'Unit' ? ls.findIndex((l) => /^Piloting\b/.test(l.trim())) : -1;
    if (i < 0) return null;
    return { unit: ls.slice(0, i).join('\n'), pilot: ls.slice(i + 1).join('\n') };
  };
  SWU.sideText = function (card, side) {
    if (side === 'unit' && card.t === 'Leader') return card.bt || '';
    const sp = SWU.pilotSplit(card);
    if (sp) return side === 'pilot' ? sp.pilot : sp.unit;
    return side === 'pilot' ? '' : card.tx || '';
  };
  SWU.abilityLines = function (card, side) {
    const text = SWU.sideText(card, side);
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^(Sentinel|Overwhelm|Saboteur|Grit|Ambush|Shielded|Hidden|Raid \d+|Restore \d+|Exploit \d+|Fortify|Support|Smuggle|Bounty|Coordinate|Piloting|Plot)\b(?![^(]*:)/i.test(l.replace(/\s*\([^)]*\)/g, '')) && !/^\(/.test(l));
  };

  // 「Action [C=1, Exhaust]: ...」
  SWU.actionLine = function (card, side) {
    const text = side === 'unit' && card.t === 'Leader' ? card.bt || '' : card.tx || '';
    const l = text.split('\n').find((x) => /^Action \[/.test(x.trim()));
    return l ? l.trim() : null;
  };
  function parseActionCost(line) {
    const m = line.match(/^Action \[([^\]]*)\]/);
    const c = { res: 0, exhaust: false, force: false };
    if (!m) return c;
    const s = m[1];
    const n = s.match(/C=(\d+)/) || s.match(/(\d+) resources?/);
    if (n) c.res = +n[1];
    if (/Exhaust/i.test(s)) c.exhaust = true;
    if (/use the Force/i.test(s)) c.force = true;
    return c;
  }
  SWU.actionAffordable = function (g, p, line, src) {
    const c = parseActionCost(line);
    if (c.exhaust && src.exhausted) return false;
    if (c.force && !g.P(p).force) return false;
    return g.canPay(p, c.res);
  };
  SWU.payActionCost = function (g, p, line, src) {
    const c = parseActionCost(line);
    if (c.exhaust && src) src.exhausted = true;
    if (c.force) g.useForce(p);
    g.pay(p, c.res);
  };

  // ---------- 工具 ----------
  let UID = 1;
  // 可重現的亂數（回上一步時用同一個種子重播）
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let RNG = Math.random;
  const rnd = (n) => Math.floor(RNG() * n);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  SWU.shuffle = shuffle;

  // ---------- 遊戲 ----------
  class Game {
    constructor(decks, io, opts = {}) {
      // decks: [{leader, base, cards:[card...]}] ×2 ； io: [io0, io1]
      this.io = io;
      this.opts = opts;
      this.decks = decks;
      this.seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647);
      RNG = mulberry32(this.seed);
      this.uid0 = opts.uid0 != null ? opts.uid0 : UID;
      UID = this.uid0;
      this.rec = [];
      this.replay = opts.replay && opts.replay.length ? opts.replay : null;
      this.rp = 0;
      this.replaying = !!this.replay;
      this.checkpoints = [];
      this.listeners = new Set();
      this.G = {
        round: 1,
        phase: 'setup',
        phaseId: 0,
        active: 0,
        initiative: 0,
        initiativeTaken: false,
        tookInit: [false, false],
        consecutivePasses: 0,
        winner: null,
        log: [],
        attack: null,
        playedThisPhase: [[], []],
        players: decks.map((d, i) => this.makePlayer(d, i)),
      };
    }
    makePlayer(d, i) {
      const P = {
        idx: i,
        name: d.name || (i === 0 ? 'You' : 'Yuna'),
        leader: { uid: UID++, card: d.leader, owner: i, ctrl: i, deployed: false, exhausted: false, epicUsed: false, isLeaderFront: true },
        base: { uid: UID++, card: d.base, damage: 0, owner: i, ctrl: i, upgrades: [], epicUsed: false, isBase: true },
        deck: shuffle(d.cards.map((c) => this.inst(c, i))),
        hand: [],
        resources: [],
        discard: [],
        units: [],
        force: false,
        credits: 0,
      };
      P.aspects = [...(d.leader.a || []), ...(d.base.a || [])];
      return P;
    }
    inst(card, owner) {
      return { uid: UID++, card, owner };
    }
    on(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    emit(ev) {
      for (const fn of this.listeners) {
        try {
          fn(ev, this);
        } catch (e) {
          console.error(e);
        }
      }
    }
    log(k, ...a) {
      this.G.log.push({ k, a, r: this.G.round, p: this.G.actor != null ? this.G.actor : null });
      if (this.G.log.length > 400) this.G.log.shift();
      this.emit({ type: 'log' });
    }
    P(i) {
      return this.G.players[i];
    }
    opp(i) {
      return this.G.players[1 - i];
    }

    // ---------- 查詢 ----------
    allUnits() {
      return [...this.G.players[0].units, ...this.G.players[1].units];
    }
    findUnit(uid) {
      return this.allUnits().find((u) => u.uid === uid) || null;
    }
    findAny(uid) {
      for (const P of this.G.players) {
        for (const zone of ['hand', 'deck', 'discard']) {
          const c = P[zone].find((x) => x.uid === uid);
          if (c) return c;
        }
        const r = P.resources.find((x) => x.uid === uid);
        if (r) return r;
      }
      return this.findUnit(uid);
    }
    // 能觸發「友方」能力的來源：場上單位、未部署的領袖、基地
    sources(p) {
      const P = this.P(p);
      const out = P.units.map((u) => ({ src: u, e: this.eff(u) }));
      if (!P.leader.deployed && !this.brainInv()) out.push({ src: P.leader, e: SWU.EFFECTS.get(P.leader.card, 'leader') });
      out.push({ src: P.base, e: SWU.EFFECTS.get(P.base.card, 'card') });
      // 基地上的升級：「Attached base gains: …」
      for (const up of P.base.upgrades) {
        const be = SWU.EFFECTS.get(up.card, 'card');
        if (be && be.baseGains) out.push({ src: P.base, e: be.baseGains, up });
      }
      return out.filter((x) => x.e);
    }
    async fire(p, hook, ...args) {
      for (const { src, e } of this.sources(p)) {
        if (!e[hook]) continue;
        if (src.uid && !src.isLeaderFront && !src.isBase && !this.findUnit(src.uid)) continue;
        await this.safe(() => e[hook](this, src, ...args));
      }
    }
    ctrlOf(u) {
      return u.ctrl;
    }
    eff(u) {
      if (u.upgrades && this.isBlank(u)) {
        // 失去所有能力：只留下「保留」型的升級給的能力（例如 Condemn）
        let out = { implemented: true };
        for (const up of u.upgrades) {
          const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
          if (ue && ue.keepGrant && SWU.GFX) out = SWU.GFX.mergeHooks(out, ue.keepGrant);
        }
        return out;
      }
      let base = SWU.EFFECTS.get(u.card, u.isLeader ? 'unit' : 'card');
      // 本階段所有某區域單位獲得的能力（Treacherous Minefield）
      for (const pg of this.G.phaseGrants || []) if (pg.phaseId === this.G.phaseId && pg.match(this, u) && SWU.GFX) base = SWU.GFX.mergeHooks(base, pg.hooks);
      // Improvised Identity：本次攻擊獲得被棄掉單位的能力
      // Support：本次攻擊獲得支援單位的其他所有能力
      if (u.borrow && this.borrowOn(u) && SWU.GFX) {
        let be = SWU.EFFECTS.get(u.borrow.card, u.borrow.side || 'card');
        if (be) {
          be = { ...be };
          delete be.whenPlayed;
          delete be.supportGrant;
          base = SWU.GFX.mergeHooks(base, be);
        }
      }
      // 其他友方單位給的能力（Bo-Katan's Gauntlet…）
      if (SWU.GFX && SWU.AURA_GRANT.size && u.ctrl != null && this.G.players[u.ctrl])
        for (const o of this.G.players[u.ctrl].units) {
          if (o === u || !SWU.AURA_GRANT.has(o.card.key)) continue;
          const oe = SWU.EFFECTS.get(o.card, o.isLeader ? 'unit' : 'card');
          if (oe && oe.auraGrant && !this.cardBlank(o.owner, o.card)) {
            const gr = oe.auraGrant(this, o, u);
            if (gr) base = SWU.GFX.mergeHooks(base, gr);
          }
        }
      // 所有單位（含敵方）獲得的能力（Satine Kryze）
      if (SWU.GFX && SWU.GLOBAL_GRANT && SWU.GLOBAL_GRANT.size)
        for (const GP of this.G.players) for (const o of GP.units) {
          if (!SWU.GLOBAL_GRANT.has(o.card.key) || this.isBlank(o)) continue;
          const oe = SWU.EFFECTS.get(o.card, o.isLeader ? 'unit' : 'card');
          if (oe && oe.globalGrant) { const gr = oe.globalGrant(this, o, u); if (gr) base = SWU.GFX.mergeHooks(base, gr); }
        }
      if (!u.upgrades || !u.upgrades.length || !SWU.GFX) return base;
      let out = base;
      for (const up of u.upgrades) {
        const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
        if (ue && ue.grant) out = SWU.GFX.mergeHooks(out, ue.grant);
        if (ue && ue.grantFor) {
          const gr = ue.grantFor(this, up, u);
          if (gr) out = SWU.GFX.mergeHooks(out, gr);
        }
      }
      return out;
    }
    borrowOn(u) {
      const b = u.borrow;
      return !!(b && (b.pre || (this.G.attack && this.G.attack.id === b.attackId)));
    }
    upSide(up) {
      return up.leaderPilot ? 'unit' : up.pilot ? 'pilot' : 'card';
    }
    // 卡片是否「失去所有能力」：The Tree Remembers（本階段）、Condemn（攻擊中）、Galen Erso 指名
    isBlank(u) {
      const G = this.G;
      if (u.blankPhase != null && u.blankPhase === G.phaseId) return true;
      if (u.blankRound != null && u.blankRound === G.round) return true;
      if (u.upgrades && u.upgrades.some((x) => x.card.n === 'Exiled from the Force')) return true;
      if (G.attack && G.attack.attacker === u && u.upgrades.some((x) => x.card.n === 'Condemn')) return true;
      if (!u.isLeader && this.cardBlank(u.owner, u.card)) return true;
      if (u.upgrades && u.upgrades.some((x) => x.card.n === 'Imprisoned')) return true;
      if (u.isLeader && this.brainInv()) return true;
      return false;
    }
    // Brain Invaders：所有領袖失去能力（史詩行動除外）
    brainInv() {
      if (!this.G.players.some((P) => P.units.some((x) => x.card.n === 'Brain Invaders'))) return false;
      return this.allUnits().some((x) => x.card.n === 'Brain Invaders' && !x.isLeader && !(x.blankPhase != null && x.blankPhase === this.G.phaseId) && !this.cardBlank(x.owner, x.card));
    }
    cardBlank(owner, card) {
      for (const nm of this.G.named || []) {
        if (nm.kind !== 'blank' || nm.victim !== owner || nm.name !== card.n || card.t === 'Leader') continue;
        if (this.findUnit(nm.src)) return true;
      }
      return false;
    }
    cardBanned(p, card) {
      if ((this.G.phaseBans || []).some((x) => x.name === card.n && x.phaseId === this.G.phaseId)) return true;
      for (const nm of this.G.named || []) if (nm.kind === 'ban' && nm.victim === p && nm.name === card.n && this.findUnit(nm.src)) return true;
      return false;
    }
    // 「領袖單位」：本身是領袖，或身上有領袖駕駛員／黑暗劍
    isLeaderUnit(u) {
      return !!(u && (u.isLeader || (u.upgrades || []).some((x) => x.leaderPilot || x.card.n === 'The Darksaber')));
    }
    statics(u) {
      // 持續效果：卡片本身、場上其他卡的光環、升級卡
      // 光環互相參照（例如「有某關鍵字的單位得到某關鍵字」）時避免無限遞迴
      if ((this._sDepth || 0) > 3) return { p: 0, h: 0, kw: {} };
      this._sDepth = (this._sDepth || 0) + 1;
      try {
        return this._statics(u);
      } finally {
        this._sDepth--;
      }
    }
    _statics(u) {
      const out = { p: 0, h: 0, kw: {} };
      const add = (s) => {
        if (!s) return;
        out.p += s.p || 0;
        out.h += s.h || 0;
        for (const k in s.kw || {}) {
          const v = s.kw[k];
          if (typeof v === 'number') out.kw[k] = (out.kw[k] || 0) + v;
          else if (v) out.kw[k] = true;
        }
      };
      const e = this.eff(u);
      if (e && e.static) add(e.static(this, u));
      for (const m of this.G.phaseMods || []) if (m.phaseId === this.G.phaseId) add(m.f(this, u));
      const blank = this.isBlank(u);
      for (const P of this.G.players)
        for (const up of P.base.upgrades) {
          const be = SWU.EFFECTS.get(up.card, 'card');
          if (be && be.baseAura) add(be.baseAura(this, up, P.idx, u));
        }
      if (blank) return out;
      for (const other of this.allUnits()) {
        const oe = this.eff(other);
        if (oe && oe.aura && other !== u) add(oe.aura(this, other, u));
      }
      for (const P of this.G.players) {
        if (P.leader.deployed) continue;
        const le = SWU.EFFECTS.get(P.leader.card, 'leader');
        if (le && le.aura) add(le.aura(this, P.leader, u));
      }
      for (const up of u.upgrades) {
        const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
        if (ue && ue.attachedStatic) add(ue.attachedStatic(this, up, u));
        if (up.leaderPilot) continue;
        const g = SWU.sideText(up.card, this.upSide(up)).match(/^Attached unit gains (Sentinel|Overwhelm|Saboteur|Grit|Ambush|Hidden|Raid (\d+)|Restore (\d+))\.?$/m);
        if (g && !(ue && ue.attachedStatic)) {
          if (g[2]) add({ kw: { Raid: +g[2] } });
          else if (g[3]) add({ kw: { Restore: +g[3] } });
          else add({ kw: { [g[1]]: true } });
        }
      }
      return out;
    }
    activeMods(u) {
      const pid = this.G.phaseId;
      return u.mods.filter((m) => m.until === 'perm' || (m.until === 'phase' && m.phaseId === pid) || (m.until === 'attack' && this.G.attack && this.G.attack.id === m.attackId));
    }
    kw(u) {
      const base = { ...(u.card.kwp || {}) };
      const e = this.eff(u);
      if (e && e.removeKw) for (const k of e.removeKw) delete base[k];
      const s = this.statics(u);
      const res = { ...base };
      const merge = (k, v) => {
        if (typeof v === 'number') res[k] = (typeof res[k] === 'number' ? res[k] : 0) + v;
        else if (v) res[k] = true;
      };
      for (const k in s.kw) merge(k, s.kw[k]);
      for (const m of this.activeMods(u)) for (const k in m.kw || {}) merge(k, m.kw[k]);
      if (u.borrow && this.borrowOn(u)) for (const k in u.borrow.card.kwp || {}) if (k !== 'Support') merge(k, u.borrow.card.kwp[k]);
      for (const k of u.lost || []) delete res[k];
      if (u.loseKwPhase && u.loseKwPhase.phaseId === this.G.phaseId) for (const k of u.loseKwPhase.kws) delete res[k];
      if (this.isBlank(u) || (u.noKwPhase != null && u.noKwPhase === this.G.phaseId)) {
        const grit = u.upgrades && u.upgrades.some((x) => x.card.n === 'Exiled from the Force');
        for (const k in res) delete res[k];
        if (grit) res.Grit = true;
        return res;
      }
      if (e && e.loseKw) for (const k of e.loseKw(this, u) || []) delete res[k];
      // Marchion Ro：友方單位的 Raid 加倍
      if (res.Raid && u.ctrl != null && this.G.players[u.ctrl].units.some((x) => x.card.key === 'Marchion Ro | Eye of the Nihil' && !this.isBlank(x))) res.Raid *= 2;
      // Deadly Vulnerability：攻擊裝著它的單位時失去 Overwhelm
      const A = this.G.attack;
      if (A && A.attacker === u && A.defender && A.defender.upgrades.some((x) => x.card.n === 'Deadly Vulnerability')) delete res.Overwhelm;
      if ((this._lkDepth || 0) < 2) {
        this._lkDepth = (this._lkDepth || 0) + 1;
        try {
          for (const o of this.allUnits()) {
            if (o === u || !SWU.AURA_LOSEKW.has(o.card.n)) continue;
            const oe = this.eff(o);
            if (oe && oe.auraLoseKw) for (const k of oe.auraLoseKw(this, o, u) || []) delete res[k];
          }
        } finally {
          this._lkDepth--;
        }
      }
      return res;
    }
    has(u, k) {
      return !!this.kw(u)[k];
    }
    basePower(u) {
      if (this.obi7(u)) return 7;
      if (u.upgrades && u.upgrades.some((x) => x.card.n === 'Size Matters Not')) return 5;
      return (u.isLeader ? u.card.p : u.card.p) || 0;
    }
    obi7(u) {
      const P = u.ctrl != null && this.G.players[u.ctrl];
      return !!(P && P.units.length >= 7 && P.units.includes(u) && P.units.some((x) => x.card.key === 'Obi-Wan Kenobi | Protector of Felucia'));
    }
    power(u, attacking) {
      const s = this.statics(u);
      let p = this.basePower(u) + s.p;
      for (const up of u.upgrades) p += up.pilotMod ? up.pilotMod[0] : up.card.p || 0;
      for (const m of this.activeMods(u)) p += m.p || 0;
      const k = this.kw(u);
      if (k.Grit) p += u.gritDamage != null ? u.gritDamage : u.damage;
      if (attacking && k.Raid) p += k.Raid;
      return Math.max(0, p);
    }
    hp(u) {
      const s = this.statics(u);
      let h = (this.obi7(u) ? 7 : u.upgrades && u.upgrades.some((x) => x.card.n === 'Size Matters Not') ? 5 : u.card.h || 0) + s.h;
      for (const up of u.upgrades) h += up.pilotMod ? up.pilotMod[1] : up.card.t === 'Upgrade' || /Token/.test(up.card.t) ? up.card.h || 0 : 0;
      for (const m of this.activeMods(u)) h += m.h || 0;
      return h;
    }
    remaining(u) {
      return this.hp(u) - u.damage;
    }
    isUpgraded(u) {
      return u.upgrades.length > 0;
    }
    hasTrait(c, t) {
      const card = c.card || c;
      const T = t.toUpperCase();
      if (c.upgrades && c.upgrades.length) {
        if (T === 'MANDALORIAN' && c.upgrades.some((x) => x.card.n === 'The Darksaber')) return true;
        if (T === 'FORCE' && c.upgrades.some((x) => x.card.n === 'Exiled from the Force')) return false;
        for (const up of c.upgrades) {
          const ue = SWU.TRAIT_GRANT.has(up.card.n) && SWU.EFFECTS.get(up.card, 'card');
          if (ue && ue.grantTrait && (ue.grantTrait(this, up, c) || []).includes(T)) return true;
        }
      }
      if (T === 'FORCE' && c.noForcePhase != null && c.noForcePhase === this.G.phaseId) return false;
      if (this.G.lostTraits && this.G.lostTraits.length) {
        const o = c.ctrl != null ? c.ctrl : c.owner;
        if (o != null && this.G.lostTraits.some((x) => x.trait === T && x.victim === o && x.phaseId === this.G.phaseId)) return false;
      }
      // Zam Wesell｜Not What She Seems：獲得友方領袖的特徵（原力除外）
      if (card.key === 'Zam Wesell | Not What She Seems' && T !== 'FORCE') {
        const o = c.owner != null ? c.owner : c.ctrl;
        if (o != null && this.G.players[o] && (this.G.players[o].leader.card.tr || []).includes(T)) return true;
      }
      if ((card.tr || []).includes(T)) return true;
      if (T === 'UNDERWORLD' && (card.tr || []).includes('CREATURE')) {
        const o = c.ctrl != null ? c.ctrl : c.owner;
        if (o != null && this.G.players[o] && this.G.players[o].units.some((x) => x.card.key === 'Malakili | Keeper of the Menagerie')) return true;
      }
      if (T === 'MANDALORIAN' && (card.t === 'Leader' || c.isLeader)) {
        const o = c.ctrl != null ? c.ctrl : c.owner;
        if (o != null && this.G.players[o] && this.G.players[o].units.some((x) => x.card.key === 'Mythosaur | Folklore Awakened')) return true;
      }
      return false;
    }
    controlsBaseTrait(p, trait) {
      return this.hasTrait(this.P(p).base.card, trait);
    }
    aspectPenalty(p, card, ignore) {
      const have = [...this.P(p).aspects, ...(ignore || [])];
      for (const u of this.P(p).units) if (u.upgrades.some((x) => x.card.n === 'The Darksaber')) have.push(...(u.card.a || []));
      let missing = 0;
      for (const a of card.a || []) {
        const i = have.indexOf(a);
        if (i >= 0) have.splice(i, 1);
        else missing++;
      }
      return missing * 2;
    }
    // Smuggle 費用（Tech｜Source of Insight：沒有 Smuggle 的資源 = 費用 +2）
    smuggleCost(p, card) {
      const k = card.kwp || {};
      if (k.Smuggle != null) return k.Smuggle;
      if (this.P(p).units.some((u) => { const ue = this.eff(u); return ue && ue.techSmuggle; })) return (card.c || 0) + 2;
      return null;
    }
    // Exploit 數量（含「下一張…獲得 Exploit」）
    exploitOf(p, card, opts = {}) {
      let n = (card.kwp && card.kwp.Exploit) || 0;
      for (const m of this.nextMods(p, card, opts)) if (m.kw && m.kw.Exploit) n += m.kw.Exploit;
      return n;
    }
    readyResources(p) {
      return this.P(p).resources.filter((r) => !r.exhausted).length;
    }
    costOf(p, card, opts = {}) {
      let base = opts.baseCost != null ? opts.baseCost : card.c || 0;
      let pen = opts.ignoreAspect ? 0 : this.aspectPenalty(p, card, opts.ignoreAsp);
      if (pen && this.sources(p).some(({ src, e }) => e.ignorePenalty && e.ignorePenalty(this, src, card))) pen = 0;
      // 棄牌堆裡的卡：「在你的棄牌堆時，忽略…的面向懲罰」
      if (pen && this.P(p).discard.some((x) => { const de = SWU.EFFECTS.get(x.card, 'card'); return de && de.discardIgnorePenalty && de.discardIgnorePenalty(this, p, card); })) pen = 0;
      let cost = base + pen;
      const e = SWU.EFFECTS.get(card, 'card');
      if (e && e.costMod) cost += e.costMod(this, p) || 0;
      // 場上的減費光環
      for (const u of this.P(p).units) {
        const oe = this.eff(u);
        if (oe && oe.discount) cost -= oe.discount(this, u, card) || 0;
      }
      // 領袖／基地的減費、「下一張…少 N 費」
      for (const { src, e: se } of this.sources(p)) if (!src.uid || !this.P(p).units.includes(src)) { if (se.costFor) cost -= se.costFor(this, src, card, opts) || 0; }
      for (const u of this.P(p).units) { const oe = this.eff(u); if (oe && oe.costFor) cost -= oe.costFor(this, u, card, opts) || 0; }
      for (const m of this.nextMods(p, card, opts)) cost -= m.n || 0;
      for (const u of this.opp(p).units) { const oe = this.eff(u); if (oe && oe.oppCostAdd) cost += oe.oppCostAdd(this, u, card) || 0; }
      cost -= opts.discount || 0;
      return Math.max(0, cost);
    }
    // 「本階段你打出的下一張 X 少 N 費／獲得某關鍵字」：P.nextMods = [{f(card, opts), n, kw, phaseId, round}]
    nextMods(p, card, opts = {}) {
      const P = this.P(p);
      const G = this.G;
      P.nextMods = (P.nextMods || []).filter((m) => (m.phaseId == null || m.phaseId === G.phaseId) && (m.round == null || m.round === G.round));
      const out = [];
      for (const m of P.nextMods) if ((!m.cost || !opts.noNext) && (!m.f || m.f(card, opts))) out.push(m);
      return out;
    }
    // Ty Yorrick：友方能力造成的傷害 +1
    tyPlus(src = {}) {
      const dp = this.dealerOf(src);
      return dp != null && this.G.players[dp] && this.G.players[dp].units.some((x) => x.card.key === 'Ty Yorrick | Monster Hunter' && !this.isBlank(x));
    }
    winGame(p) {
      if (this.G.winner != null) return;
      this.G.winner = p;
      this.log('logWin', this.P(p).name);
      this.emit({ type: 'gameover' });
      throw new GameOver();
    }
    delay(d) {
      (this.G.delayed = this.G.delayed || []).push(d);
    }
    creditsUsable(p) {
      return !this.opp(p).units.some((u) => { const e = this.eff(u); return e && e.blankEnemyCredits; });
    }
    // 把牌庫頂 N 張棄掉
    mill(p, n) {
      const Q = this.P(p);
      const cs = Q.deck.splice(0, n);
      Q.discard.push(...cs);
      if (cs.length) this.log('logMill', Q.name, cs.length);
      for (const c of cs) this.noteDiscarded(c, 'deck');
      return cs;
    }
    useForce(p) {
      const P = this.P(p);
      if (!P.force) return false;
      P.force = false;
      this.log('logUseForce', P.name);
      this.queueEv({ type: 'useForce', p });
      return true;
    }
    // 搜尋牌庫頂 N 張（Arcana Star Map 會變兩倍）
    searchN(p, n) {
      return this.P(p).units.some((u) => { const e = this.eff(u); return e && e.doubleSearch; }) ? n * 2 : n;
    }
    addNext(p, m) {
      const P = this.P(p);
      (P.nextMods = P.nextMods || []).push(m);
    }
    starhawk(p, n) {
      return this.P(p).units.some((u) => u.card.key === 'The Starhawk | Prototype Battleship' && !this.isBlank(u)) ? Math.ceil(n / 2) : n;
    }
    droidPayers(p) {
      if (!this.P(p).units.some((u) => u.card.key === 'Vuutun Palaa | Droid Control Ship' && !this.isBlank(u))) return [];
      return this.P(p).units.filter((u) => !u.exhausted && this.hasTrait(u, 'DROID'));
    }
    canPay(p, n) {
      n = this.starhawk(p, n);
      if (this.droidPayers(p).length) return this.readyResources(p) + (this.creditsUsable(p) ? this.P(p).credits : 0) + this.droidPayers(p).length >= n;
      return this.readyResources(p) + (this.creditsUsable(p) ? this.P(p).credits : 0) >= n;
    }
    pay(p, n) {
      const P = this.P(p);
      n = this.starhawk(p, n);
      for (const r of P.resources) {
        if (n <= 0) break;
        if (!r.exhausted) {
          r.exhausted = true;
          n--;
        }
      }
      while (n > 0 && P.credits > 0 && this.creditsUsable(p)) {
        P.credits--;
        n--;
      }
      // Vuutun Palaa：橫置友方機器人單位來付費
      for (const d of this.droidPayers(p)) {
        if (n <= 0) break;
        d.exhausted = true;
        n--;
      }
    }
    // Sentinel 限制下可攻擊的目標
    attackTargets(attacker, opts = {}) {
      const p = attacker.ctrl;
      const O = this.opp(p);
      const arena = attacker.arena;
      const ae1 = this.eff(attacker);
      const extraAr = ae1 && ae1.attackArenas ? ae1.attackArenas(this, attacker) || [] : [];
      const enemies = O.units.filter((u) => u.arena === arena || extraAr.includes(u.arena));
      const sab = this.has(attacker, 'Saboteur');
      const sentinels = enemies.filter((u) => this.has(u, 'Sentinel'));
      let units = enemies.filter((u) => {
        if (this.has(u, 'Hidden') && u.playedPhase === this.G.phaseId && !this.has(u, 'Sentinel')) return false;
        if (u.cantBeAttacked && u.cantBeAttacked === this.G.phaseId) return false;
        const de = this.eff(u);
        if (de && de.cantBeAttackedBy && de.cantBeAttackedBy(this, u, attacker) && !this.has(u, 'Sentinel')) return false;
        for (const { src: s, e } of this.sources(u.ctrl)) if (e.protectFriendly && e.protectFriendly(this, s, u, attacker) && !this.has(u, 'Sentinel')) return false;
        return true;
      });
      let base = !opts.noBase;
      if (sentinels.length && !sab) {
        units = sentinels;
        base = false;
      }
      if (opts.unitsOnly) base = false;
      const ae = this.eff(attacker);
      if (ae && ae.cantAttackBase && ae.cantAttackBase(this, attacker)) base = false;
      if (opts.filter) units = units.filter(opts.filter);
      return { units, base };
    }
    canAttackWith(u) {
      if (u.exhausted) return false;
      if (u.cantAttack) return false;
      const ce = this.eff(u);
      if (ce && ce.cantAttack && ce.cantAttack(this, u)) return false;
      const t = this.attackTargets(u);
      return t.units.length > 0 || t.base;
    }

    // ---------- 互動 ----------
    rnd(n) {
      return rnd(n);
    }
    // 所有玩家輸入都經過這裡：記錄下來，回上一步時重播
    async input(p, kind, fn) {
      if (this.replay) {
        if (this.rp < this.replay.length) {
          const r = this.replay[this.rp++];
          this.rec.push(r);
          if (this.rp === this.replay.length && this.opts.onReplayEnd) this.opts.onReplayEnd(this);
          return r.v == null ? r.v : JSON.parse(JSON.stringify(r.v));
        }
        this.replay = null;
        this.replaying = false;
        this.emit({ type: 'replay-done' });
      }
      const v = await fn();
      this.rec.push({ p, k: kind, v: v === undefined ? null : JSON.parse(JSON.stringify(v)) });
      return v;
    }
    async choose(p, req) {
      // req: {prompt, options:[{id,label,uid?}], min, max}
      if (!req.options.length) return [];
      const min = req.min == null ? 1 : req.min;
      const r = await this.input(p, 'c', async () => {
        if (req.options.length === 1 && min >= 1 && (req.max || 1) === 1 && !req.forceAsk && !(this.io[p] && this.io[p].isHuman && !this.io[p].autoSingle && req.kind !== 'internal')) return [req.options[0].id];
        this.emit({ type: 'prompt', p, req });
        const v = await this.io[p].choose(this, p, req);
        this.emit({ type: 'prompt-done', p });
        return v;
      });
      return Array.isArray(r) ? r : r == null ? [] : [r];
    }
    // 給玩家看牌（不需要回答）
    async showCards(p, cards, prompt) {
      if (!cards.length || this.replaying) return;
      const io = this.io[p];
      if (io && io.showCards) await io.showCards(this, p, cards, prompt);
    }
    // 公開卡片：記錄並讓對手看到
    revealCards(p, cards, why) {
      if (!cards.length) return;
      if (cards.some((c) => this.P(p).hand.includes(c))) this.queueEv({ type: 'handOut', p, reveal: true });
      this.log('logReveal', this.P(p).name, cards.map((c) => c.card.n).join('、'));
      this.emit({ type: 'reveal', p, cards: cards.map((c) => c.card), why });
    }
    async yesno(p, prompt, ctx) {
      const r = await this.choose(p, {
        kind: 'yesno',
        prompt,
        ctx,
        options: [
          { id: 'yes', label: SWU.t('yes') },
          { id: 'no', label: SWU.t('no') },
        ],
        forceAsk: true,
      });
      return r[0] === 'yes';
    }
    async pickUnit(p, prompt, filter = () => true, opts = {}) {
      const list = this.allUnits().filter(filter);
      if (!list.length) return null;
      const options = list.map((u) => ({ id: u.uid, uid: u.uid, label: SWU.unitLabel(this, u) }));
      const r = await this.choose(p, { kind: 'unit', prompt, options, min: opts.optional ? 0 : 1, max: 1, ctx: opts.ctx });
      return r.length ? this.findUnit(r[0]) : null;
    }
    async pickTarget(p, prompt, { units = [], bases = [], optional = false, ctx } = {}) {
      const options = units.map((u) => ({ id: u.uid, uid: u.uid, label: SWU.unitLabel(this, u) }));
      for (const b of bases) options.push({ id: 'base' + b, uid: this.P(b).base.uid, label: SWU.t('baseOf', this.P(b).name) });
      if (!options.length) return null;
      const r = await this.choose(p, { kind: 'target', prompt, options, min: optional ? 0 : 1, max: 1, ctx });
      if (!r.length) return null;
      if (String(r[0]).startsWith('base')) return { base: +String(r[0]).slice(4) };
      return { unit: this.findUnit(r[0]) };
    }
    async orderUnits(p, units, prompt) {
      const out = [];
      const rest = [...units];
      while (rest.length > 1) {
        const i = await this.pickOption(p, prompt + ' (' + (out.length + 1) + ')', rest.map((u) => u.card.n));
        const k = i < 0 ? 0 : i;
        out.push(rest[k]);
        rest.splice(k, 1);
      }
      return out.concat(rest);
    }
    async pickOption(p, prompt, labels, opts = {}) {
      const options = labels.map((l, i) => ({ id: i, label: l }));
      const r = await this.choose(p, { kind: 'option', prompt, options, min: opts.optional ? 0 : 1, max: 1, forceAsk: true, ctx: opts.ctx });
      return r.length ? +r[0] : -1;
    }
    async pickCards(p, prompt, cards, min, max, ctx, lim = {}) {
      const val = (c) => (lim.sumKey === 'power' ? c.card.p || 0 : c.card.c || 0);
      const options = cards.map((c) => ({ id: c.uid, label: c.card.key, card: c.card.key, val: lim.sumMax != null ? val(c) : undefined }));
      const r = await this.choose(p, { kind: 'cards', prompt, options, min, max, forceAsk: true, ctx, sumMax: lim.sumMax, sumKey: lim.sumKey });
      let out = r.map((id) => cards.find((c) => c.uid === id)).filter(Boolean);
      if (lim.sumMax != null) {
        let used = 0;
        out = out.filter((c) => (used + val(c) <= lim.sumMax ? ((used += val(c)), true) : false));
      }
      return out;
    }

    // ---------- 基本操作 ----------
    draw(p, n = 1) {
      const P = this.P(p);
      for (let i = 0; i < n; i++) {
        if (!P.deck.length) {
          this.log('logEmptyDeck', P.name);
          this.damageBase(p, 3);
          continue;
        }
        const dc = P.deck.shift();
        P.hand.push(dc);
        if (this.G.phase === 'action' && SWU.DRAW_TRIG.has(dc.card.key)) (this.pendingDrawn = this.pendingDrawn || []).push({ p, c: dc });
      }
      if (n > 0) {
        this.log('logDraw', P.name, n);
        this.queueEv({ type: 'draw', p, n });
      }
    }
    damageBase(p, n, src) {
      if (n <= 0) return 0;
      const B = this.P(p).base;
      const fe = B.upgrades.map((up) => SWU.EFFECTS.get(up.card, 'card')).find((e) => e && e.baseDamage);
      if (fe) {
        const r = fe.baseDamage(this, p, n);
        if (r === 0) return 0;
      }
      if (src && !src.combat && !src.indirect && this.tyPlus(src)) n += 1;
      for (const { src: s, e } of this.sources(p)) if (e.modBaseDamage) n = Math.max(0, e.modBaseDamage(this, s, p, n, src || {}) ?? n);
      if (n <= 0) return 0;
      B.damage += n;
      this.log('logBaseDmg', this.P(p).name, n);
      if (src && src.attacker) (this.G.hitBase = this.G.hitBase || []).push({ uid: src.attacker.uid, phaseId: this.G.phaseId });
      this.queueEv({ type: 'damage', base: p, n, combat: !!(src && src.combat), indirect: !!(src && src.indirect), by: this.dealerOf(src || {}) });
      this.checkWin();
      return n;
    }
    dealerOf(src = {}) {
      if (src.p != null) return src.p;
      if (src.attacker) return src.attacker.ctrl;
      if (this.srcP != null) return this.srcP;
      if (this.G.actor != null) return this.G.actor;
      return this.G.active;
    }
    // 事件佇列：受到傷害、回復、抽牌…在 checkState 時通知所有卡片（hook：onEvent）
    queueEv(ev) {
      ev.phaseId = this.G.phaseId;
      ev.phase = this.G.phase;
      (this.evq = this.evq || []).push(ev);
    }
    healBase(p, n) {
      if (this.allUnits().some((u) => { const e = this.eff(u); return e && e.noBaseHeal; })) return 0;
      if (this.G.noHealPhase === this.G.phaseId) return 0;
      const B = this.P(p).base;
      const h = Math.min(n, B.damage);
      B.damage -= h;
      if (h) {
        this.log('logBaseHeal', this.P(p).name, h);
        (this.G.baseHealed = this.G.baseHealed || []).push({ p, phaseId: this.G.phaseId });
        this.queueEv({ type: 'heal', base: p, n: h });
      }
      return h;
    }
    checkWin() {
      for (const P of this.G.players) {
        if (P.base.damage >= (P.base.card.h || 30) && this.G.winner == null) {
          this.G.winner = 1 - P.idx;
          this.log('logWin', this.opp(P.idx).name);
          this.emit({ type: 'gameover' });
          throw new GameOver();
        }
      }
    }
    // 傷害單位（回傳實際傷害）
    async damageUnit(u, n, src = {}) {
      if (!u || n <= 0 || !this.findUnit(u.uid)) return 0;
      // Gorian Shard's Corsair：友方地下世界卡造成的傷害無法防止
      if (!src.unpreventable) {
        const dp = this.dealerOf(src);
        const srcCard = src.attacker ? src.attacker : src.defender ? src.defender : this.srcCard;
        if (dp != null && srcCard && this.hasTrait(srcCard, 'UNDERWORLD') && this.P(dp).units.some((x) => /^Gorian Shard's Corsair/.test(x.card.key))) src = { ...src, unpreventable: true };
      }
      if (!src.unpreventable) {
        const sh = u.upgrades.findIndex((x) => x.card.n === 'Shield');
        if (sh >= 0) {
          const [shu] = u.upgrades.splice(sh, 1);
          (this.pendingUpDefeat = this.pendingUpDefeat || []).push({ up: shu, host: { ...u } });
          this.log('logShield', u.card.n);
          return 0;
        }
        // 取代效果：防止傷害（Queen Amidala、The Mandalorian…）
        for (const { src: s, e } of this.sources(u.ctrl)) {
          if (!e.preventDamage || !this.findUnit(s.uid)) continue;
          let ok = false;
          await this.safe(async () => (ok = await e.preventDamage(this, s, u, n, src)));
          if (ok) return 0;
        }
      }
      if (!src.combat && !src.indirect && this.tyPlus(src)) n += 1;
      const me = this.eff(u);
      if (me && me.modDamage) n = Math.max(0, me.modDamage(this, u, n, src) ?? n);
      for (const { src: s, e } of this.sources(u.ctrl)) if (e.modFriendlyDamage && s !== u) n = Math.max(0, e.modFriendlyDamage(this, s, u, n, src) ?? n);
      if (n <= 0) return 0;
      u.damage += n;
      this.log('logUnitDmg', u.card.n, n);
      this.noteDamage(u, n, src);
      if (!src.combat) await this.checkState();
      return n;
    }
    noteDamage(u, n, src = {}) {
      this.pendingDamaged = this.pendingDamaged || [];
      this.pendingDamaged.push(u);
      this.queueEv({ type: 'damage', u, uid: u.uid, ctrl: u.ctrl, card: u.card, n, combat: !!src.combat, indirect: !!src.indirect, by: this.dealerOf(src), dealer: src.attacker || src.defender || src.self || null });
      (this.pendingDmgEv = this.pendingDmgEv || []).push({ u, n, ctrl: u.ctrl, card: u.card, combat: !!src.combat });
    }
    // ---------- 分配傷害（間接傷害／自行分配） ----------
    // req: {prompt, total, upTo, targets:[{id, uid?, base?}], own:bool}
    async distribute(chooser, req) {
      if (!req.targets.length || req.total <= 0) return {};
      let alloc = null;
      const io = this.io[chooser];
      if (io && io.distribute) {
        alloc = await this.input(chooser, 'd', async () => {
          this.emit({ type: 'prompt', p: chooser, req });
          const v = await io.distribute(this, chooser, req);
          this.emit({ type: 'prompt-done', p: chooser });
          return v;
        });
      }
      if (!alloc) alloc = this.autoDistribute(chooser, req);
      return alloc;
    }
    autoDistribute(chooser, req) {
      const alloc = {};
      if (req.mode === 'heal') {
        let left = req.total;
        const dmgOf = (t) => (t.base != null ? this.P(t.base).base.damage : (this.findUnit(t.uid) || {}).damage || 0);
        const mine = req.targets.filter((t) => (t.base != null ? t.base === chooser : (this.findUnit(t.uid) || {}).ctrl === chooser)).sort((a, b) => dmgOf(b) - dmgOf(a));
        for (const t of mine) {
          const k = Math.min(left, dmgOf(t));
          if (k > 0) ((alloc[t.id] = k), (left -= k));
        }
        return alloc;
      }
      if (req.mode === 'token') {
        const us = req.targets.map((t) => ({ t, u: this.findUnit(t.uid) })).filter((x) => x.u);
        const good = !req.harmful;
        const pick = us.filter((x) => (good ? x.u.ctrl === chooser : x.u.ctrl !== chooser)).sort((a, b) => this.power(b.u) - this.power(a.u))[0] || us[0];
        if (pick) alloc[pick.t.id] = req.total;
        return alloc;
      }
      let left = req.total;
      const units = req.targets.filter((t) => t.uid != null).map((t) => ({ t, u: this.findUnit(t.uid) })).filter((x) => x.u);
      const baseT = req.targets.find((t) => t.base != null);
      const add = (id, n) => ((alloc[id] = (alloc[id] || 0) + n), (left -= n));
      if (req.own) {
        // 自己承受：基地夠厚就全部放基地，否則盡量讓單位吃但不死
        const B = baseT ? this.P(baseT.base).base : null;
        const bRem = B ? (B.card.h || 30) - B.damage : 0;
        if (baseT && bRem > left + 4) add(baseT.id, left);
        else {
          for (const x of units.sort((a, b) => this.remaining(b.u) - this.remaining(a.u))) {
            const k = Math.min(left, this.remaining(x.u) - 1);
            if (k > 0) add(x.t.id, k);
            if (!left) break;
          }
          if (left && baseT && bRem > left) add(baseT.id, left);
          if (left) for (const x of units.sort((a, b) => (a.u.card.c || 0) - (b.u.card.c || 0))) { if (!left) break; add(x.t.id, left); }
          if (left && baseT) add(baseT.id, left);
        }
        return alloc;
      }
      // 打對手：先把能打死的高費單位打死，剩下打基地或最大的單位
      const shield = (u) => (u.upgrades.some((x) => x.card.n === 'Shield') && !req.unpreventable ? 1 : 0);
      for (const x of units.sort((a, b) => (b.u.card.c || 0) - (a.u.card.c || 0))) {
        if (shield(x.u)) continue;
        const need = this.remaining(x.u);
        if (need <= left) add(x.t.id, need);
        if (!left) break;
      }
      if (left && baseT) add(baseT.id, left);
      else if (left && units.length) {
        const big = units.filter((x) => !alloc[x.t.id]).sort((a, b) => this.remaining(b.u) - this.remaining(a.u))[0] || units[0];
        add(big.t.id, left);
      }
      if (req.upTo && !units.length && !baseT) return {};
      return alloc;
    }
    distTargets(list, withBaseOf) {
      const ts = list.map((u) => ({ id: 'u' + u.uid, uid: u.uid, label: u.card.n + ' ' + this.power(u) + '/' + this.remaining(u) }));
      if (withBaseOf != null) ts.push({ id: 'base' + withBaseOf, base: withBaseOf, label: this.P(withBaseOf).name + ' ' + SWU.t('baseWord') });
      return ts;
    }
    // 間接傷害：由承受方分配到自己的單位和基地，不能被防止
    async dealIndirect(from, to, n, src = {}) {
      const F = this.P(from);
      n += F.units.filter((u) => /^Hunting Aggressor/.test(u.card.key || u.card.n)).length;
      if (n <= 0) return { base: 0, units: [] };
      const srcUnit = src.unit && this.findUnit(src.unit.uid);
      const iAssign = F.units.some((u) => /^Devastator/.test(u.card.key || u.card.n)) || (srcUnit && srcUnit.upgrades.some((x) => x.card.n === 'Targeting Computer'));
      const chooser = iAssign ? from : to;
      const targets = this.distTargets(this.P(to).units, to);
      this.log('logIndirect', this.P(to).name, n);
      (this.G.indirectBy = this.G.indirectBy || []).push({ p: from, phaseId: this.G.phaseId });
      const alloc = await this.distribute(chooser, { kind: 'distribute', indirect: true, unpreventable: true, own: chooser === to, total: n, targets, prompt: SWU.t('promptIndirect', n, this.P(to).name) });
      const hit = [];
      let baseN = 0;
      for (const t of targets) {
        const k = alloc[t.id] || 0;
        if (!k) continue;
        if (t.base != null) baseN += k;
        else {
          const u = this.findUnit(t.uid);
          if (!u) continue;
          u.damage += k;
          this.log('logUnitDmg', u.card.n, k);
          this.noteDamage(u, k, { indirect: true });
          hit.push(u);
        }
      }
      if (baseN) this.damageBase(to, baseN, { ability: true, indirect: true });
      await this.checkState();
      return { base: baseN, units: hit };
    }
    // 自行分配傷害（可被護盾防止）
    async dealDivided(chooser, n, units, opts = {}) {
      if (n <= 0 || !units.length) return [];
      const targets = this.distTargets(units, opts.baseOf);
      const alloc = await this.distribute(chooser, { kind: 'distribute', own: false, upTo: !!opts.upTo, total: n, targets, prompt: opts.prompt || SWU.t('promptDivide', n) });
      const hit = [];
      for (const t of targets) {
        const k = alloc[t.id] || 0;
        if (!k) continue;
        if (t.base != null) this.damageBase(t.base, k, { ability: true });
        else {
          const u = this.findUnit(t.uid);
          if (u && (await this.damageUnit(u, k))) hit.push(u);
        }
      }
      return hit;
    }
    heal(u, n) {
      const h = Math.min(n, u.damage);
      u.damage -= h;
      if (h) {
        this.log('logHeal', u.card.n, h);
        (this.pendingHealed = this.pendingHealed || []).push(u);
        this.queueEv({ type: 'heal', u, uid: u.uid, ctrl: u.ctrl, n: h });
      }
      return h;
    }
    giveShield(u) {
      u.upgrades.push(this.inst(SWU.token('Shield'), u.ctrl));
      this.queueEv({ type: 'attach', u });
      this.log('logGiveShield', u.card.n);
    }
    giveExp(u, n = 1) {
      for (let i = 0; i < n; i++) u.upgrades.push(this.inst(SWU.token('Experience'), u.ctrl));
      if (n > 0) this.queueEv({ type: 'attach', u });
      this.log('logGiveExp', u.card.n, n);
    }
    giveToken(u, name) {
      const t = SWU.token(name);
      if (t) u.upgrades.push(this.inst(t, u.ctrl));
      if (t) this.queueEv({ type: 'attach', u });
      this.log('logGiveToken', u.card.n, name);
    }
    buff(u, p, h, until = 'phase', kw) {
      const m = { p, h, kw, until, phaseId: this.G.phaseId };
      if (until === 'attack' && this.G.attack) m.attackId = this.G.attack.id;
      u.mods.push(m);
      if (p || h) this.log('logBuff', u.card.n, (p >= 0 ? '+' : '') + p + '/' + (h >= 0 ? '+' : '') + h);
    }
    exhaust(u) {
      const e = u.upgrades ? this.eff(u) : null;
      if (e && e.cantBeExhaustedBy && this.dealerOf({}) !== u.ctrl && e.cantBeExhaustedBy(this, u)) return;
      if (u.upgrades && u.upgrades.length && this.dealerOf({}) !== u.ctrl && this.P(u.ctrl).units.some((x) => x.card.key === 'Mythosaur | Folklore Awakened' && !this.isBlank(x))) return;
      u.exhausted = true;
    }
    ready(u) {
      if (u.lockedBy != null && this.findUnit(u.lockedBy)) return;
      const e = this.eff(u);
      if (e && e.cantReady && e.cantReady(this, u)) return;
      const was = u.exhausted;
      u.exhausted = false;
      if (was) (this.pendingReadied = this.pendingReadied || []).push(u);
    }
    // 升級卡離場：回棄牌堆／代幣消失／領袖駕駛員回領袖區
    dropUpgrade(up, host) {
      if (host) (this.pendingUpDefeat = this.pendingUpDefeat || []).push({ up, host: { ...host } });
      if (up.leaderPilot) {
        const L = this.P(up.owner).leader;
        L.deployed = false;
        L.exhausted = true;
        L.epicUsed = true;
        this.log('logDefeat', up.card.n);
        return;
      }
      if (!/Token/.test(up.card.t)) this.P(up.owner).discard.push({ uid: up.uid, card: up.card, owner: up.owner });
    }
    removeUpgrade(host, up) {
      host.upgrades = host.upgrades.filter((x) => x !== up);
      this.dropUpgrade(up, host);
    }
    async defeat(u, why = {}) {
      if (!u || !this.findUnit(u.uid)) return;
      const ctrl = u.ctrl;
      const P = this.P(ctrl);
      const e = this.eff(u);
      const wasCombat = !!why.combat;
      if (e && e.cantBeDefeatedBy && e.cantBeDefeatedBy(this, u, why)) return;
      if (e && e.replaceDefeat) {
        let done = false;
        await this.safe(async () => (done = await e.replaceDefeat(this, u, why)));
        if (done) return;
      }
      P.units = P.units.filter((x) => x !== u);
      (this.G.left = this.G.left || []).push({ uid: u.uid, ctrl, phaseId: this.G.phaseId });
      this.log('logDefeat', u.card.n);
      (this.G.defeated = this.G.defeated || []).push({ uid: u.uid, ctrl, card: u.card, phaseId: this.G.phaseId, round: this.G.round, unique: !!u.card.u, leader: !!u.isLeader, token: /Token/.test(u.card.t), power: (() => { try { return this.power(u); } catch (e) { return 0; } })() });
      if (u.captured && u.captured.length) this.rescue(u);
      // 升級卡回各自擁有者棄牌堆，代幣消失（可被取代：Luke｜You Still With Me?）
      for (const up of u.upgrades) {
        const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
        let kept = false;
        if (ue && ue.replaceUpDefeat) await this.safe(async () => (kept = await ue.replaceUpDefeat(this, up, u)));
        if (!kept) this.dropUpgrade(up, u);
      }
      if (e && e.whenLeavesPlay) await this.safe(() => e.whenLeavesPlay(this, u));
      if (u.isLeader) {
        const L = this.P(u.owner).leader;
        L.deployed = false;
        L.exhausted = true;
        L.epicUsed = true;
      } else if (!/Token/.test(u.card.t)) {
        this.P(u.owner).discard.push({ uid: u.uid, card: u.origCard || u.card, owner: u.owner });
      }
      this.emit({ type: 'defeat', u });
      // When Defeated
      const snapshot = { ...u, defeatedByCombat: wasCombat };
      const noWD = this.allUnits().some((x) => x.card.key === 'Razor Crest | Stay Off the Ice' && !this.isBlank(x)) || (u.card.key === 'Razor Crest | Stay Off the Ice' && !this.isBlank(u));
      if (e && e.whenDefeated && noWD) {
        // 失去「被擊敗時」能力
      } else if (e && e.whenDefeated) {
        await this.safe(() => e.whenDefeated(this, snapshot, why));
        await this.fire(ctrl, 'onUsedWhenDefeated', snapshot, () => this.safe(() => e.whenDefeated(this, snapshot, why)));
      } else if (!e || !e.implemented) await this.unimplemented(u, 'When Defeated', ctrl);
      await this.collectBounty(snapshot, e, 1 - ctrl);
      // 其他卡的「當敵方單位被擊敗」
      for (const q of [ctrl, 1 - ctrl]) await this.fire(q, 'onAnyDefeated', snapshot);
    }
    async collectBounty(snapshot, e, collector) {
      if (e && e.bounty) {
        await this.safe(() => e.bounty(this, snapshot, collector));
        await this.fire(collector, 'onBountyCollected', snapshot, () => this.safe(() => e.bounty(this, snapshot, collector)));
      } else for (const k of snapshot.card.kwp?.Bounty || []) await this.unimplementedText(snapshot, k, collector);
    }
    async checkState() {
      let again = true;
      while (again) {
        again = false;
        const dead = this.allUnits().filter((u) => this.remaining(u) <= 0 && !(() => { const e = this.eff(u); return e && e.noLethal && e.noLethal(this, u); })());
        if (!dead.length) break;
        let order = dead;
        for (const q of [0, 1]) {
          const io = this.io[q];
          const mine = dead.filter((u) => u.ctrl === q && (() => { const e = this.eff(u); return e && e.whenDefeated; })());
          if (io && io.isHuman && mine.length > 1) {
            const sorted = await this.orderUnits(q, mine, SWU.t('promptOrderDefeat'));
            order = order.filter((u) => !mine.includes(u));
            order = q === this.G.active ? [...sorted, ...order] : [...order, ...sorted];
          }
        }
        for (const u of order) if (this.findUnit(u.uid)) await this.defeat(u, { state: true });
        again = true;
      }
      // 「受到傷害且存活」
      const dmg = this.pendingDamaged || [];
      this.pendingDamaged = [];
      for (const u of dmg) {
        if (!this.findUnit(u.uid)) continue;
        const e = this.eff(u);
        if (e && e.whenDamagedSurvive) await this.safe(() => e.whenDamagedSurvive(this, u));
      }
      const dev = this.pendingDmgEv || [];
      this.pendingDmgEv = [];
      for (const ev of dev) await this.fire(ev.ctrl, 'onFriendlyDamaged', ev);
      const hl = this.pendingHealed || [];
      this.pendingHealed = [];
      for (const u of hl) {
        if (!this.findUnit(u.uid)) continue;
        const e = this.eff(u);
        if (e && e.whenHealed) await this.safe(() => e.whenHealed(this, u));
      }
      // 被棄掉的卡自己的能力（That's a Rock）
      const pdc = this.pendingDiscarded || [];
      this.pendingDiscarded = [];
      for (const { c, from } of pdc) {
        const e = SWU.EFFECTS.get(c.card, 'card');
        if (e && e.whenDiscarded) await this.safe(() => e.whenDiscarded(this, c, from));
      }
      // 抽到這張卡時（Rey｜With Palpatine's Power）
      const pdr = this.pendingDrawn || [];
      this.pendingDrawn = [];
      for (const { p, c } of pdr) {
        const e = SWU.EFFECTS.get(c.card, 'card');
        if (e && e.whenDrawn && this.P(p).hand.includes(c)) await this.safe(() => e.whenDrawn(this, c, p));
      }
      // Moff Jerjerrod：可以擊敗他，讓剛建立的代幣數量加倍
      const pt = this.pendingTokens || [];
      this.pendingTokens = [];
      for (const t of pt) {
        const j = this.P(t.p).units.find((x) => x.card.key === 'Moff Jerjerrod | We Shall Redouble Our Efforts');
        if (!j) continue;
        if (!(await this.yesno(t.p, SWU.lang === 'en' ? `Moff Jerjerrod: defeat him to create ${t.n} more ${t.name} token(s)?` : `傑傑羅德：要擊敗他，再多建立 ${t.n} 個${t.name}代幣嗎？`, { card: j.card.key }))) continue;
        await this.defeat(j, { self: true });
        this._jerj = true;
        try { this.createToken(t.p, t.name, t.n); } finally { this._jerj = false; }
      }
      // 「當這個單位重置時」（In Debt to Crimson Dawn）
      const rd = this.pendingReadied || [];
      this.pendingReadied = [];
      for (const u of rd) {
        const e = this.findUnit(u.uid) && this.eff(u);
        if (e && e.whenReadied) await this.safe(() => e.whenReadied(this, u));
        if (this.findUnit(u.uid)) for (const q of [0, 1]) await this.fire(q, 'onAnyReadied', u);
      }
      // 升級卡被擊敗時（upWhenDefeated）
      const ud = this.pendingUpDefeat || [];
      this.pendingUpDefeat = [];
      for (const { up, host } of ud) {
        for (const q of [0, 1]) await this.fire(q, 'onUpgradeDefeated', up, host);
        const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
        if (ue && ue.upWhenDefeated) await this.safe(() => ue.upWhenDefeated(this, up, host));
      }
      const prc = this.pendingRC || [];
      this.pendingRC = [];
      for (const r of prc) if (this.findUnit(r.t.uid)) await this.safe(() => r.e.replaceCapture(this, r.t));
      const pbn = this.pendingBounty || [];
      this.pendingBounty = [];
      for (const b of pbn) await this.collectBounty(b.snap, b.e, b.collector);
      const eq = this.evq || [];
      this.evq = [];
      const batch = (this._evBatch = (this._evBatch || 0) + 1);
      for (const ev of eq) ev.batch = batch;
      for (const ev of eq) for (const q of [this.G.active == null ? 0 : this.G.active, this.G.active == null ? 1 : 1 - this.G.active]) await this.fire(q, 'onEvent', ev);
      if (dev.length || hl.length || eq.length || ud.length || pdc.length || pdr.length || pbn.length) {
        if ((this._csDepth || 0) < 4) {
          this._csDepth = (this._csDepth || 0) + 1;
          try { await this.checkState(); } finally { this._csDepth--; }
        }
      }
    }
    async safe(fn) {
      try {
        await fn();
      } catch (e) {
        if (e instanceof GameOver) throw e;
        console.error(e);
        this.log('logEffectError', String(e.message || e));
      }
    }
    createToken(p, name, n = 1) {
      const t = SWU.token(name);
      if (!t) return [];
      const out = [];
      for (let i = 0; i < n; i++) {
        const u = this.makeUnit(this.inst(t, p), p, { exhausted: !this.P(p).units.some((x) => { const xe = this.eff(x); return xe && xe.tokensReady; }) });
        this.P(p).units.push(u);
        this.queueEv({ type: 'enter', u });
        out.push(u);
      }
      this.log('logToken', this.P(p).name, name, n);
      if (!this._jerj && this.P(p).units.some((x) => x.card.key === 'Moff Jerjerrod | We Shall Redouble Our Efforts')) (this.pendingTokens = this.pendingTokens || []).push({ p, name, n });
      return out;
    }
    makeUnit(inst, p, opts = {}) {
      const c = inst.card;
      return {
        uid: inst.uid,
        card: c,
        owner: inst.owner,
        ctrl: p,
        damage: 0,
        exhausted: opts.exhausted !== false,
        upgrades: [],
        mods: [],
        playedPhase: this.G.phaseId,
        playedRound: this.G.round,
        isLeader: !!opts.isLeader,
        arena: opts.arena || (c.ar && c.ar.includes('Space') ? 'Space' : 'Ground'),
      };
    }
    capture(captor, t) {
      if (!this.findUnit(t.uid)) return;
      { const ce = this.eff(t); if (ce && ce.cantBeCapturedBy && ce.cantBeCapturedBy(this, t, captor)) return; if (ce && ce.replaceCapture) { (this.pendingRC = this.pendingRC || []).push({ t, e: ce }); return; } }
      const P = this.P(t.ctrl);
      { const be = this.eff(t); if (be && (be.bounty || (t.card.kwp?.Bounty || []).length)) (this.pendingBounty = this.pendingBounty || []).push({ snap: { ...t, upgrades: [...t.upgrades] }, e: be, collector: 1 - t.ctrl }); }
      P.units = P.units.filter((x) => x !== t);
      for (const up of t.upgrades) this.dropUpgrade(up, t);
      (this.G.left = this.G.left || []).push({ uid: t.uid, ctrl: t.ctrl, phaseId: this.G.phaseId });
      { const te = this.eff(t); if (te && te.whenLeavesPlay) this.safe(() => te.whenLeavesPlay(this, t)); }
      captor.captured = captor.captured || [];
      captor.captured.push({ uid: t.uid, card: t.origCard || t.card, owner: t.owner });
      this.log('logCapture', captor.card.n, t.card.n);
    }
    rescue(captor) {
      for (const c of captor.captured || []) {
        const ready = this.sources(c.owner).some(({ src, e }) => e.rescueReady && e.rescueReady(this, src, c));
        const u = this.makeUnit(c, c.owner, { exhausted: !ready });
        this.P(c.owner).units.push(u);
        this.log('logRescue', c.card.n);
      }
      captor.captured = [];
    }
    returnToHand(u) {
      if (!this.findUnit(u.uid) || u.isLeader) return;
      const be = this.eff(u);
      if (be && be.cantBeBounced && this.dealerOf({}) !== u.ctrl && be.cantBeBounced(this, u)) return;
      if (u.upgrades.length && this.dealerOf({}) !== u.ctrl && this.P(u.ctrl).units.some((x) => x.card.key === 'Mythosaur | Folklore Awakened' && !this.isBlank(x))) return;
      const P = this.P(u.ctrl);
      P.units = P.units.filter((x) => x !== u);
      for (const up of u.upgrades) this.dropUpgrade(up, u);
      (this.G.left = this.G.left || []).push({ uid: u.uid, ctrl: u.ctrl, phaseId: this.G.phaseId });
      if (be && be.whenLeavesPlay) this.safe(() => be.whenLeavesPlay(this, u));
      if (!/Token/.test(u.card.t)) this.P(u.owner).hand.push({ uid: u.uid, card: u.origCard || u.card, owner: u.owner });
      this.log('logBounce', u.card.n);
    }
    resourceTop(p) {
      const P = this.P(p);
      if (!P.deck.length) return;
      const c = P.deck.shift();
      P.resources.push({ ...c, exhausted: true });
      this.log('logResourceTop', P.name);
    }
    async discardFromHand(p, n = 1, optional = false) {
      const P = this.P(p);
      if (!P.hand.length) return [];
      const cards = await this.pickCards(p, SWU.t('promptDiscard', n), P.hand, optional ? 0 : Math.min(n, P.hand.length), n);
      for (const c of cards) {
        P.hand = P.hand.filter((x) => x !== c);
        P.discard.push(c);
        this.log('logDiscard', P.name, c.card.n);
        this.noteHandDiscard(p, c);
      }
      return cards;
    }
    // 從手牌棄掉（Kylo's TIE Silencer 等「從手牌被棄掉時」）
    noteHandDiscard(p, c) {
      this.queueEv({ type: 'handOut', p: c.owner, discard: true });
      this.noteDiscarded(c, 'hand');
    }
    // 從手牌／牌庫被棄掉（That's a Rock、Salvaged Blaster、Sebulba's Podracer…）
    noteDiscarded(c, from) {
      (this.G.discardLog = this.G.discardLog || []).push({ uid: c.uid, owner: c.owner, from, phaseId: this.G.phaseId, round: this.G.round });
      this.queueEv({ type: 'discarded', c, from, p: c.owner });
      const e = SWU.EFFECTS.get(c.card, 'card');
      if (e && e.whenDiscardedFromHand && from === 'hand') e.whenDiscardedFromHand(this, c, c.owner);
      if (e && e.whenDiscarded) (this.pendingDiscarded = this.pendingDiscarded || []).push({ c, from });
    }

    // ---------- 未實作效果 ----------
    async unimplemented(u, trigger, p) {
      const card = u.card;
      const lines = SWU.abilityLines(card, u.isLeader ? 'unit' : 'card').filter((l) => {
        const re = new RegExp('^([A-Za-z /]*/)?' + trigger.replace(/ /g, ' ') + '(/[A-Za-z /]*)?:', 'i');
        return re.test(l);
      });
      for (const l of lines) await this.unimplementedText(u, l, p);
    }
    async unimplementedText(u, text, p) {
      this.log('logManual', u.card.n, text);
      if (this.io[p].resolveManual) await this.input(p, 'm', () => this.io[p].resolveManual(this, p, { card: u.card, text, source: u }));
    }

    // ---------- 打出卡片 ----------
    legalActions(p) {
      const G = this.G;
      const P = this.P(p);
      const acts = [];
      if (G.tookInit[p]) return [{ type: 'pass', label: SWU.t('actPass') }];
      for (const c of P.hand) {
        const a = this.playOption(p, c, 'hand');
        if (a) acts.push(a);
        const pa = this.pilotOption(p, c);
        if (pa) acts.push(pa);
      }
      for (const r of P.resources) {
        if (this.smuggleCost(p, r.card) != null) {
          const a = this.playOption(p, r, 'smuggle');
          if (a) acts.push(a);
        }
      }
      for (const c of P.discard) {
        if ((P.discardPlays || []).some((d) => d.uid === c.uid && d.phaseId === G.phaseId)) continue;
        const de = SWU.EFFECTS.get(c.card, 'card');
        if (de && de.fromDiscard && de.fromDiscard(this, p, c)) {
          const a = this.playOption(p, c, 'discard');
          if (a) acts.push(a);
        }
      }
      for (const dp of P.discardPlays || []) {
        if (dp.phaseId !== G.phaseId) continue;
        const c = P.discard.find((x) => x.uid === dp.uid);
        if (c && dp.free) {
          if (!this.cardBanned(p, c.card) && (c.card.t !== 'Upgrade' || this.upgradeTargets(p, c.card).length)) acts.push({ type: 'play', uid: c.uid, from: 'discard', free: true, cost: 0, label: SWU.t('actPlay', c.card.n, 0) });
          continue;
        }
        const a = c && this.playOption(p, c, 'discard');
        if (a) acts.push(a);
      }
      for (const fp of G.oppFreePlay || []) {
        if (fp.for !== p || fp.phaseId !== G.phaseId) continue;
        const c = this.P(fp.owner).discard.find((x) => x.uid === fp.uid);
        if (c && !this.cardBanned(p, c.card)) {
          if (fp.paid) {
            const cost = this.costOf(p, c.card, { ignoreAspect: fp.ignoreAspect });
            if (this.canPay(p, cost) && (c.card.t !== 'Upgrade' || this.upgradeTargets(p, c.card).length)) acts.push({ type: 'play', uid: c.uid, from: 'odiscard', paid: true, ignoreAspect: fp.ignoreAspect, cost, label: SWU.t('actPlay', c.card.n, cost) });
          } else acts.push({ type: 'play', uid: c.uid, from: 'odiscard', cost: 0, label: SWU.t('actPlay', c.card.n, 0) });
        }
      }
      for (const u of P.units) if (this.canAttackWith(u)) acts.push({ type: 'attack', uid: u.uid, label: SWU.t('actAttack', u.card.n) });
      // 行動能力
      for (const u of P.units) {
        const e = this.eff(u);
        if (e && e.actions)
          e.actions.forEach((ab, i) => {
            if (ab.can(this, u)) acts.push({ type: 'ability', manual: !!ab.manual, uid: u.uid, i, label: SWU.t('actAbility', u.card.n, ab.label ? SWU.t(ab.label) : ab.text || '') });
          });
      }
      // 任何玩家都能使用的行動（Hunter For Hire）
      for (const u of this.opp(p).units) {
        const e = this.eff(u);
        if (e && e.anyActions)
          e.anyActions.forEach((ab, i) => {
            if (ab.can(this, u, p)) acts.push({ type: 'ability', any: true, uid: u.uid, i, label: SWU.t('actAbility', u.card.n, ab.text || '') });
          });
      }
      // 基地上的升級給的行動（Heavy Ion Cannon…）
      for (const up of P.base.upgrades) {
        const be = SWU.EFFECTS.get(up.card, 'card');
        if (be && be.baseGains && be.baseGains.actions)
          be.baseGains.actions.forEach((ab, i) => {
            if (ab.can(this, P.base, up)) acts.push({ type: 'baseUpAbility', upUid: up.uid, i, label: SWU.t('actAbility', up.card.n, ab.text || '') });
          });
      }
      // 未實作的「Action [...]」能力：當成手動能力提供
      for (const u of P.units) {
        const e = this.eff(u);
        if (e && e.actions) continue;
        const line = SWU.actionLine(u.card, u.isLeader ? 'unit' : 'card');
        if (line && SWU.actionAffordable(this, p, line, u)) acts.push({ type: 'manualAbility', uid: u.uid, line, label: SWU.t('actAbility', u.card.n, SWU.t('manualTag')) });
      }
      const L = P.leader;
      if (!L.deployed) {
        const le0 = SWU.EFFECTS.get(L.card, 'leader');
        const line = !(le0 && le0.actions) && !this.brainInv() && SWU.actionLine(L.card, 'leader');
        if (line && SWU.actionAffordable(this, p, line, L)) acts.push({ type: 'manualLeader', line, label: SWU.t('actLeaderAbility', L.card.n, SWU.t('manualTag')) });
      }
      if (!L.deployed) {
        const le = SWU.EFFECTS.get(L.card, 'leader');
        if (le && le.actions && !this.brainInv())
          le.actions.forEach((ab, i) => {
            if (ab.can(this, L)) acts.push({ type: 'leaderAbility', manual: !!ab.manual, i, label: SWU.t('actLeaderAbility', L.card.n, ab.label ? SWU.t(ab.label) : ab.text || '') });
          });
        if (!L.epicUsed && P.resources.length >= (L.card.c || 99)) {
          acts.push({ type: 'deploy', label: SWU.t('actDeploy', L.card.n) });
          if (/as an upgrade/i.test(L.card.ep || '') && this.pilotHosts(p).length)
            acts.push({ type: 'deploy', pilot: true, label: (SWU.lang === 'en' ? 'Deploy as Pilot upgrade: ' : '部署為駕駛員升級：') + (SWU.cardName ? SWU.cardName(L.card) : L.card.n) });
        }
      }
      const be = SWU.EFFECTS.get(P.base.card, 'card');
      if (be && be.actions)
        be.actions.forEach((ab, i) => {
          if (ab.can(this, P.base)) acts.push({ type: 'baseAbility', manual: !!ab.manual, i, label: SWU.t('actAbility', P.base.card.n, ab.text || '') });
        });
      if (!G.initiativeTaken) acts.push({ type: 'initiative', label: SWU.t('actInitiative') });
      acts.push({ type: 'pass', label: SWU.t('actPass') });
      return acts;
    }
    // Piloting [C=2 Vigilance]：當成駕駛員升級打出的費用（括號裡的面向用來算罰費）
    pilotCost(p, card) {
      const m = (card.tx || '').match(/Piloting \[C=(\d+)([^\]]*)\]/);
      if (!m) return null;
      const asp = m[2].trim() ? m[2].trim().split(/\s+/) : [];
      return this.costOf(p, { ...card, a: asp }, { baseCost: +m[1] });
    }
    pilotOption(p, c) {
      const card = c.card;
      if (card.t !== 'Unit' || !/^Piloting \[/m.test(card.tx || '') || !this.pilotHosts(p, card).length) return null;
      const cost = this.pilotCost(p, card);
      if (cost == null || !this.canPay(p, cost) || this.cardBanned(p, card)) return null;
      return { type: 'play', uid: c.uid, from: 'hand', asPilot: true, cost, label: (SWU.lang === 'en' ? 'Play as Pilot: ' : '當駕駛員打出：') + (SWU.cardName ? SWU.cardName(card) : card.n) + ' (' + cost + ')' };
    }
    playOption(p, c, from) {
      const card = c.card;
      if (!['Unit', 'Event', 'Upgrade'].includes(card.t)) return null;
      let cost;
      if (from === 'smuggle') cost = this.costOf(p, card, { baseCost: this.smuggleCost(p, card), from });
      else cost = this.costOf(p, card);
      const e = SWU.EFFECTS.get(card, 'card');
      let exploitMax = this.exploitOf(p, card, { from });
      let reduce = Math.min(exploitMax, this.P(p).units.length) * 2;
      // 費用看目標而定的升級（Mastery 裝在獨特單位上 -1…）：用最便宜的目標判斷能不能打
      if (card.t === 'Upgrade') reduce += this.bestTargetDiscount(p, card);
      if (!this.canPay(p, Math.max(0, cost - reduce)) && !(e && e.affordable && e.affordable(this, p, cost))) return null;
      if (card.t === 'Upgrade' && !/^Fortify/m.test(card.tx || '') && !this.upgradeTargets(p, card).length) return null;
      if (e && e.canPlay && !e.canPlay(this, p, from)) return null;
      if (this.cardBanned(p, card)) return null;
      if (card.t === 'Event' && (this.G.noEvents || []).some((x) => x.p === p && x.phaseId === this.G.phaseId)) return null;
      return { type: 'play', uid: c.uid, from, cost, label: SWU.t(from === 'smuggle' ? 'actSmuggle' : 'actPlay', card.n, cost) };
    }
    targetDiscount(p, card, t) {
      const e0 = SWU.EFFECTS.get(card, 'card');
      let d = 0;
      if (e0 && e0.costOnTarget) d += e0.costOnTarget(this, p, t) || 0;
      for (const u of this.P(p).units) {
        const ue = this.eff(u);
        if (ue && ue.upgradeCostOn) d += ue.upgradeCostOn(this, u, card, t) || 0;
      }
      return d;
    }
    bestTargetDiscount(p, card) {
      const e0 = SWU.EFFECTS.get(card, 'card');
      const hasOn = (e0 && e0.costOnTarget) || this.P(p).units.some((u) => { const ue = this.eff(u); return ue && ue.upgradeCostOn; });
      if (!hasOn) return 0;
      let best = 0;
      for (const t of this.upgradeTargets(p, card)) best = Math.max(best, this.targetDiscount(p, card, t));
      return best;
    }
    upgradeTargets(p, card) {
      const tx = card.tx || '';
      let units = this.allUnits();
      if (/Fortify/.test(tx)) return [];
      if (/Attach to a friendly/i.test(tx)) units = units.filter((u) => u.ctrl === p);
      if (/Attach to an enemy/i.test(tx)) units = units.filter((u) => u.ctrl !== p);
      if (/non-Vehicle/i.test(tx)) units = units.filter((u) => !this.hasTrait(u, 'VEHICLE'));
      else if (/Attach to a (friendly |enemy )?Vehicle/i.test(tx)) units = units.filter((u) => this.hasTrait(u, 'VEHICLE'));
      if (/non-leader/i.test(tx.split('\n')[0])) units = units.filter((u) => !u.isLeader);
      if (/Attach to a (friendly )?Unique/i.test(tx)) units = units.filter((u) => u.card.u);
      const ue = SWU.EFFECTS.get(card, 'card');
      if (ue && ue.attachFilter) units = units.filter((u) => ue.attachFilter(this, p, u));
      return units;
    }
    async doAction(p, act) {
      const G = this.G;
      const P = this.P(p);
      G.actN = G.actN || {};
      if (act.type !== 'pass') G.actN[p + ':' + G.phaseId] = (G.actN[p + ':' + G.phaseId] || 0) + 1;
      switch (act.type) {
        case 'pass':
          this.log('logPass', P.name);
          G.consecutivePasses++;
          return;
        case 'initiative':
          G.initiativeTaken = true;
          G.tookInit[p] = true;
          G.initiative = p;
          this.log('logInitiative', P.name);
          await this.fire(p, 'onTakeInitiative');
          for (const d of (G.delayed || []).filter((d) => d.at === 'takeInit' && d.p === p && d.phaseId === G.phaseId && !d.done)) {
            d.done = true;
            await this.safe(() => d.run(this));
          }
          G.consecutivePasses = 0;
          return;
        case 'play':
          await this.playCard(p, act.uid, act.from, act.asPilot ? { asPilot: true } : act.paid ? { paid: true, ignoreAspect: act.ignoreAspect } : act.free ? { free: true } : {});
          break;
        case 'attack': {
          const u = this.findUnit(act.uid);
          await this.attack(u, {});
          break;
        }
        case 'ability': {
          const u = this.findUnit(act.uid);
          const ab = act.any ? this.eff(u).anyActions[act.i] : this.eff(u).actions[act.i];
          this.log('logAbility', u.card.n);
          await this.safe(() => ab.run(this, u, p));
          break;
        }
        case 'baseUpAbility': {
          const up = P.base.upgrades.find((x) => x.uid === act.upUid);
          const ab = up && SWU.EFFECTS.get(up.card, 'card').baseGains.actions[act.i];
          if (!ab) break;
          this.log('logAbility', up.card.n);
          await this.safe(() => ab.run(this, P.base, up));
          break;
        }
        case 'leaderAbility': {
          const ab = SWU.EFFECTS.get(P.leader.card, 'leader').actions[act.i];
          this.log('logAbility', P.leader.card.n);
          await this.safe(() => ab.run(this, P.leader));
          break;
        }
        case 'baseAbility': {
          const ab = SWU.EFFECTS.get(P.base.card, 'card').actions[act.i];
          this.log('logAbility', P.base.card.n);
          await this.safe(() => ab.run(this, P.base));
          break;
        }
        case 'deploy':
          await this.deployLeader(p, { pilot: !!act.pilot });
          break;
        case 'manualAbility': {
          const u = this.findUnit(act.uid);
          SWU.payActionCost(this, p, act.line, u);
          await this.unimplementedText(u, act.line, p);
          break;
        }
        case 'manualLeader': {
          SWU.payActionCost(this, p, act.line, P.leader);
          await this.unimplementedText({ card: P.leader.card }, act.line, p);
          break;
        }
        case 'manual':
          break;
      }
      G.consecutivePasses = 0;
      await this.checkState();
    }
    async playCard(p, uid, from = 'hand', opts = {}) {
      const P = this.P(p);
      let c;
      if (from === 'smuggle' || from === 'plot' || from === 'resource') {
        c = P.resources.find((r) => r.uid === uid);
      } else if (from === 'odiscard') {
        for (const Q of this.G.players) c = c || Q.discard.find((x) => x.uid === uid);
        if (c && !opts.paid) opts = { ...opts, free: true };
      } else if (from === 'deck') {
        c = opts.inst;
      } else if (from === 'discard') {
        c = P.discard.find((x) => x.uid === uid);
      } else c = P.hand.find((x) => x.uid === uid);
      if (!c) return;
      const card = c.card;
      let cost = opts.free ? 0 : opts.asPilot ? Math.max(0, this.pilotCost(p, card) - (opts.pilotDiscount || 0)) : from === 'smuggle' ? this.costOf(p, card, { baseCost: this.smuggleCost(p, card), discount: opts.discount || 0, from }) : this.costOf(p, card, { discount: opts.discount || 0, ignoreAspect: opts.ignoreAspect, ignoreAsp: opts.ignoreAsp, from });
      // Exploit
      const exN = opts.free ? 0 : this.exploitOf(p, card, { from, ...opts });
      if (!opts.free && exN && P.units.length) {
        const max = Math.min(exN, P.units.length);
        const need = Math.max(0, cost - this.readyResources(p) - P.credits);
        const choices = await this.pickCards(
          p,
          SWU.t('promptExploit', max),
          P.units.map((u) => ({ uid: u.uid, card: u.card })),
          Math.ceil(need / 2),
          max
        );
        for (const ch of choices) {
          const u = this.findUnit(ch.uid);
          if (u) { (this.G.lastExploit = this.G.lastExploit && this.G.lastExploit.uid === c.uid ? this.G.lastExploit : { uid: c.uid, powers: [] }).powers.push(this.power(u)); await this.defeat(u, { exploit: true }); }
          cost = Math.max(0, cost - 2);
        }
      }
      // 費用取決於目標的升級（Faith in the Empire、Guardian of the Whills…）：先選目標
      const e0 = SWU.EFFECTS.get(card, 'card');
      if (card.t === 'Upgrade' && !opts.asPilot && !opts.free && !/^Fortify/m.test(card.tx || '') && !opts.target) {
        const hasOn = (e0 && e0.costOnTarget) || this.P(p).units.some((u) => { const ue = this.eff(u); return ue && ue.upgradeCostOn; });
        if (hasOn) {
          // 只列出付得起的目標
          const targets = this.upgradeTargets(p, card).filter((x) => this.canPay(p, Math.max(0, cost - this.targetDiscount(p, card, x))));
          const t = await this.pickUnit(p, SWU.t('promptAttach', card.n), (u) => targets.includes(u), { ctx: { card: card.key } });
          if (!t) return;
          opts = { ...opts, target: t };
          if (e0 && e0.costOnTarget) cost -= e0.costOnTarget(this, p, t) || 0;
          for (const u of this.P(p).units) { const ue = this.eff(u); if (ue && ue.upgradeCostOn) cost -= ue.upgradeCostOn(this, u, card, t) || 0; }
          cost = Math.max(0, cost);
        }
      }
      if (e0 && e0.prePay && !opts.free) cost = Math.max(0, await e0.prePay(this, p, cost, c));
      if (!this.canPay(p, cost)) return;
      this.pay(p, cost);
      if (from === 'resource') P.resources = P.resources.filter((r) => r !== c);
      else if (from === 'smuggle' || from === 'plot') {
        P.resources = P.resources.filter((r) => r !== c);
        if (P.deck.length) P.resources.push({ ...P.deck.shift(), exhausted: true });
      } else if (from === 'odiscard') {
        const Q = this.P(c.owner);
        Q.discard = Q.discard.filter((x) => x !== c);
        this.G.oppFreePlay = (this.G.oppFreePlay || []).filter((x) => x.uid !== c.uid);
      } else if (from === 'hand') P.hand = P.hand.filter((x) => x !== c);
      else if (from === 'discard') {
        P.discard = P.discard.filter((x) => x !== c);
        P.discardPlays = (P.discardPlays || []).filter((x) => x.uid !== c.uid);
      }
      this.log('logPlay', P.name, card.n, cost);
      const usedNext = this.nextMods(p, card, { from, ...opts });
      P.nextMods = (P.nextMods || []).filter((m) => m.persist || !usedNext.includes(m));
      (this.G.playLog = this.G.playLog || []).push({ p, card, from, phaseId: this.G.phaseId, round: this.G.round, cost: this.starhawk(p, cost), uid: c.uid });
      this.emit({ type: 'cast', p, card });
      if (this.pauseFor && !this.replaying) await this.pauseFor('cast', p);
      this.G.playedThisPhase[p].push(card);
      for (const q of [p, 1 - p]) await this.fire(q, 'onCardPlayed', { p, card, from, uid: c.uid });
      await this.fire(1 - p, 'onEnemyPlay', card);
      const inst = { uid: c.uid, card, owner: c.owner };
      const relentless = card.t === 'Event' && this.opp(p).units.some((x) => { const xe = this.eff(x); return xe && xe.blankFirstEvent; }) && (this.G.playLog || []).filter((x) => x.p === p && x.round === this.G.round && x.card.t === 'Event').length === 1;
      if (relentless) this.log('logNote', 'Relentless: ' + card.n);
      const e = this.cardBlank(c.owner, card) || relentless ? { implemented: true, event() {} } : SWU.EFFECTS.get(card, 'card');
      if (card.t === 'Unit' && opts.asPilot) {
        // Piloting：當成升級裝在友方沒有駕駛員的載具上
        const hosts = this.pilotHosts(p, card);
        const t = hosts.length ? await this.pickUnit(p, SWU.lang === 'en' ? 'Attach ' + card.n + ' as a Pilot to' : '把 ' + (SWU.cardName ? SWU.cardName(card) : card.n) + ' 當駕駛員裝在哪個載具', (u) => hosts.includes(u), { ctx: { card: card.key } }) : null;
        if (!t) {
          this.P(c.owner).discard.push(inst);
          return;
        }
        const up = { ...inst, pilot: true, pilotMod: (SWU.PILOT_MOD || {})[card.key] || [0, 0] };
        t.upgrades.push(up);
        this.log('logAttach', card.n, t.card.n);
        this.queueEv({ type: 'attach', u: t });
        this.emit({ type: 'play', u: t });
        if (e && e.whenPlayedAsUpgrade) await this.safe(() => e.whenPlayedAsUpgrade(this, up, t));
        const pe = SWU.EFFECTS.get(card, 'pilot');
        if (pe && pe.whenPlayed) await this.safe(() => pe.whenPlayed(this, up, t));
        await this.fire(p, 'onFriendlyUpgradePlayed', up, t);
      } else if (card.t === 'Unit') {
        const rdy = opts.ready || usedNext.some((m) => m.ready) || (e && e.entersReady && (typeof e.entersReady !== 'function' || e.entersReady(this, inst, p))) || this.sources(p).some(({ src, e: se }) => se.friendlyEntersReady && se.friendlyEntersReady(this, src, inst));
        const u = this.makeUnit(inst, p, { exhausted: !rdy });
        for (const m of usedNext) if (m.kw) this.buff(u, 0, 0, 'phase', m.kw);
        P.units.push(u);
        this.queueEv({ type: 'enter', u });
        await this.enforceUnique(p, u);
        this.emit({ type: 'play', u });
        if (this.has(u, 'Shielded')) this.giveShield(u);
        // 其他卡「當你打出單位時」
        await this.fire(p, 'onFriendlyPlay', u);
        // Maul | Old Master 等：先擊敗，「打出時」在擊敗之後才結算
        if (opts.defeatFirst) {
          await this.defeat(u, { by: opts.defeatFirst });
          await this.checkState();
        }
        if (e && e.whenPlayed) {
          await this.safe(() => e.whenPlayed(this, u));
          await this.fire(p, 'onUsedWhenPlayed', u, () => this.safe(() => e.whenPlayed(this, u)));
        } else if (!e || !e.implemented) await this.unimplemented(u, 'When Played', p);
        await this.checkState();
        if (this.findUnit(u.uid) && this.has(u, 'Ambush')) await this.ambush(u);
        if (this.findUnit(u.uid) && this.has(u, 'Support')) await this.support(u);
      } else if (card.t === 'Event') {
        this.P(c.owner).discard.push(inst);
        if (e && e.event) await this.safe(() => e.event(this, p, inst));
        else await this.unimplementedText({ card }, card.tx || '', p);
        await this.fire(p, 'onFriendlyEvent', card);
      } else if (card.t === 'Upgrade' && /^Fortify/m.test(card.tx || '')) {
        // 堡壘：裝在自己的基地上
        P.base.upgrades.push(inst);
        this.log('logAttach', card.n, P.base.card.n);
        if (e && e.whenPlayed) await this.safe(() => e.whenPlayed(this, inst, P.base));
      } else if (card.t === 'Upgrade') {
        const targets = opts.target ? [opts.target] : this.upgradeTargets(p, card);
        const t = await this.pickUnit(p, SWU.t('promptAttach', card.n), (u) => targets.includes(u), { ctx: { card: card.key } });
        if (!t) {
          P.discard.push(inst);
          return;
        }
        t.upgrades.push(inst);
        this.log('logAttach', card.n, t.card.n);
        this.queueEv({ type: 'attach', u: t });
        await this.fire(p, 'onFriendlyUpgradePlayed', inst, t);
        if (e && e.whenPlayed) await this.safe(() => e.whenPlayed(this, inst, t));
        else if (!e || !e.implemented) {
          const lines = SWU.abilityLines(card).filter((l) => /^When Played/i.test(l));
          for (const l of lines) await this.unimplementedText({ card }, l, p);
        }
      }
      await this.checkState();
    }
    async enforceUnique(p, u) {
      if (!u.card.u) return;
      const P = this.P(p);
      const dup = P.units.filter((x) => x !== u && x.card.key === u.card.key);
      for (const d of dup) {
        this.log('logUnique', u.card.n);
        await this.defeat(d, { unique: true });
      }
    }
    async ambush(u) {
      const baseOk = this.P(u.ctrl).units.some((x) => { const e = this.eff(x); return e && e.ambushBase; });
      const t = this.attackTargets(u, { unitsOnly: !baseOk });
      if (!t.units.length && !t.base) return;
      if (!(await this.yesno(u.ctrl, SWU.t('promptAmbush', u.card.n), { uid: u.uid }))) return;
      this.ready(u);
      await this.attack(u, { unitsOnly: !baseOk, ambush: true });
    }
    async support(u) {
      const others = this.P(u.ctrl).units.filter((x) => x !== u && this.canAttackWith(x));
      if (!others.length) return;
      const a = await this.pickUnit(u.ctrl, SWU.t('promptSupport', u.card.n), (x) => others.includes(x), { optional: true });
      if (a) {
        this.log('logSupport', u.card.n, a.card.n);
        await this.attack(a, { borrowCard: u.card, borrowSide: u.isLeader ? 'unit' : 'card', support: u.uid });
      }
    }
    pilotHosts(p, card) {
      return this.P(p).units.filter((u) => {
        if (!this.hasTrait(u, 'VEHICLE')) return false;
        if (card && card.n === 'R2-D2' && card.s === 'Artooooooooo!') return true;
        const n = u.upgrades.filter((x) => x.leaderPilot || x.pilot || this.hasTrait(x.card, 'PILOT')).length;
        const e = this.eff(u);
        return n < 1 + ((e && e.extraPilot) || 0);
      });
    }
    async deployLeader(p, opts = {}) {
      const P = this.P(p);
      const L = P.leader;
      const plots = P.resources.filter((r) => /^Plot\b/m.test(r.card.tx || ''));
      if (opts.pilot) {
        const hosts = this.pilotHosts(p);
        const t = hosts.length && (await this.pickUnit(p, SWU.lang === 'en' ? 'Deploy ' + L.card.n + ' as a Pilot on' : '把 ' + (SWU.cardName ? SWU.cardName(L.card) : L.card.n) + ' 部署為哪個載具的駕駛員', (u) => hosts.includes(u), { ctx: { card: L.card.key } }));
        if (t) {
          L.deployed = true;
          L.epicUsed = true;
          const mod = (SWU.PILOT_MOD || {})[L.card.key] || [0, 0];
          t.upgrades.push({ uid: L.uid, card: L.card, owner: p, leaderPilot: true, pilotMod: mod });
          this.log('logDeploy', P.name, L.card.n);
          this.log('logAttach', L.card.n, t.card.n);
          this.emit({ type: 'play', u: t });
          if (this.pauseFor && !this.replaying) await this.pauseFor('cast', p);
          const e = SWU.EFFECTS.get(L.card, 'unit');
          if (e && e.whenDeployedAsUpgrade) await this.safe(() => e.whenDeployedAsUpgrade(this, t, L));
          await this.fire(p, 'onLeaderDeployed', t);
          await this.checkState();
          await this.plotPlays(p, plots);
          return;
        }
      }
      L.deployed = true;
      L.epicUsed = true;
      const u = this.makeUnit({ uid: L.uid, card: L.card, owner: p }, p, { exhausted: false, isLeader: true, arena: 'Ground' });
      P.units.push(u);
      this.log('logDeploy', P.name, L.card.n);
      this.emit({ type: 'play', u });
      if (this.pauseFor && !this.replaying) await this.pauseFor('cast', p);
      const e = SWU.EFFECTS.get(L.card, 'unit');
      if (e && e.whenDeployed) await this.safe(() => e.whenDeployed(this, u));
      else if (!e || !e.implemented) await this.unimplemented(u, 'When Deployed', p);
      await this.fire(p, 'onLeaderDeployed', u);
      await this.fire(1 - p, 'onEnemyLeaderDeployed', u);
      if (this.has(u, 'Shielded')) this.giveShield(u);
      await this.checkState();
      await this.plotPlays(p, plots);
    }
    // Plot：部署領袖時，可從資源區打出有 Plot 的卡（付費），用牌庫頂替補
    async plotPlays(p, plots) {
      const P = this.P(p);
      let left = plots.filter((r) => P.resources.includes(r));
      while (left.length) {
        const ok = left.filter((r) => this.canPay(p, this.costOf(p, r.card, { from: 'plot' })) && (r.card.t !== 'Upgrade' || /^Fortify/m.test(r.card.tx || '') || this.upgradeTargets(p, r.card).length) && !this.cardBanned(p, r.card));
        if (!ok.length) break;
        const pick = await this.pickCards(p, SWU.lang === 'en' ? 'Plot: you may play a card from your resources (paying its cost)' : '密謀（Plot）：可以從資源區打出一張卡（照常付費，用牌庫頂替補）', ok, 0, 1, { plot: true });
        if (!pick.length) break;
        left = left.filter((r) => r !== pick[0]);
        this.revealCards(p, [pick[0]], 'plot');
        await this.playCard(p, pick[0].uid, 'plot');
        if (this.G.winner != null) return;
      }
    }

    // ---------- 攻擊 ----------
    async attack(attacker, opts = {}) {
      if (!attacker || !this.findUnit(attacker.uid)) return;
      const G = this.G;
      const p = attacker.ctrl;
      const atkId = UID++;
      if (opts.borrowCard) attacker.borrow = { card: opts.borrowCard, side: opts.borrowSide, attackId: atkId, pre: true };
      const tg = this.attackTargets(attacker, opts);
      if (attacker.borrow && attacker.borrow.attackId === atkId) attacker.borrow.pre = false;
      if (!tg.units.length && !tg.base) return;
      this.exhaust(attacker);
      const atk = { id: atkId, attacker, p, opts };
      const prev = G.attack;
      G.attack = atk;
      try {
        const target = await this.pickTarget(p, SWU.t('promptAttackTarget', attacker.card.n), {
          units: tg.units,
          bases: tg.base ? [1 - p] : [],
          ctx: { uid: attacker.uid },
        });
        if (!target) return;
        atk.defender = target.unit || null;
        atk.base = target.base != null;
        { const e2 = this.eff(attacker); if (atk.defender && e2 && e2.attackTwo && !this.isBlank(attacker)) { const rest = tg.units.filter((x) => x !== atk.defender); if (rest.length) { const t2 = await this.pickTarget(p, SWU.lang === 'en' ? 'Choose a second defender (optional)' : '可以再選第二個防守單位', { units: rest, optional: true, ctx: { uid: attacker.uid } }); if (t2 && t2.unit) atk.defender2 = t2.unit; } } }
        if (opts.power || opts.hp) this.buff(attacker, opts.power || 0, opts.hp || 0, 'attack');
        if (opts.kw) attacker.mods.push({ p: 0, h: 0, kw: opts.kw, until: 'attack', attackId: atk.id });
        (G.attackers = G.attackers || []).push({ uid: attacker.uid, ctrl: p, u: attacker, phaseId: G.phaseId });
        this.log(atk.base ? 'logAttackBase' : 'logAttackUnit', attacker.card.n, atk.defender ? atk.defender.card.n : this.opp(p).name);
        this.emit({ type: 'attack', atk });
        if (this.pauseFor && !this.replaying) await this.pauseFor('attack', p);
        // On Attack
        const k = this.kw(attacker);
        if (k.Restore) this.healBase(p, k.Restore);
        if (k.Saboteur && atk.defender) {
          const before = atk.defender.upgrades.length;
          atk.defender.upgrades = atk.defender.upgrades.filter((x) => x.card.n !== 'Shield');
          if (before !== atk.defender.upgrades.length) this.log('logSaboteur', atk.defender.card.n);
        }
        const e = this.eff(attacker);
        if (e && e.onAttack) {
          await this.safe(() => e.onAttack(this, attacker, atk));
          // Enfys Nest：「當你使用攻擊時能力」可以再使用一次
          if (!opts.noReuse) await this.fire(p, 'onUsedOnAttack', attacker, atk, () => this.safe(() => e.onAttack(this, attacker, atk)));
        } else if (!e || !e.implemented) await this.unimplemented(attacker, 'On Attack', p);
        if (!this.isBlank(attacker))
          for (const up of attacker.upgrades) {
            const ue = SWU.EFFECTS.get(up.card, this.upSide(up));
            if (ue && ue.attachedOnAttack) await this.safe(() => ue.attachedOnAttack(this, up, attacker, atk));
          }
        if (opts.onAttackExtra) await this.safe(() => opts.onAttackExtra(atk));
        // 其他友方「當友方單位攻擊時」
        await this.fire(p, 'onFriendlyAttack', atk);
        await this.fire(1 - p, 'onEnemyAttack', atk);
        if (atk.defender && this.findUnit(atk.defender.uid)) {
          const de = this.eff(atk.defender);
          if (de && de.whenAttacked) await this.safe(() => de.whenAttacked(this, atk.defender, atk));
        }
        // 攻擊者可能在觸發中被擊敗
        if (this.findUnit(attacker.uid)) await this.combatDamage(atk);
        await this.checkState();
        // When attack ends
        atk.ended = true;
        await this.fire(p, 'onFriendlyAttackEnd', atk);
        // Advantage 代幣
        for (const u of [attacker, atk.defender]) {
          if (u && this.findUnit(u.uid) && !this.P(u.ctrl).units.some((o) => { const oe = this.eff(o); return oe && oe.keepAdvantage; })) u.upgrades = u.upgrades.filter((x) => x.card.n !== 'Advantage');
        }
        await this.checkState();
      } finally {
        G.attack = prev;
      }
    }
    async combatDamage(atk) {
      let a = atk.attacker;
      const d = atk.defender;
      if (atk.base) {
        // 手牌中的取代效果（Asajj Ventress｜Death From Above）
        for (const x of [...this.P(a.ctrl).hand]) {
          const he = SWU.EFFECTS.get(x.card, 'card');
          if (!he || !he.fromHandBaseCombat) continue;
          let nu = null;
          await this.safe(async () => (nu = await he.fromHandBaseCombat(this, x, a, atk)));
          if (nu) {
            a = nu;
            atk.attacker = nu;
            break;
          }
        }
      }
      const ap = this.power(a, true);
      if (atk.base) {
        const G = this.G;
        G.attackedBase = G.attackedBase || [[], []];
        G.attackedBase[1 - a.ctrl].push(a.uid);
        this.damageBase(1 - a.ctrl, ap, { combat: true, attacker: a });
        atk.baseDamage = ap;
        if (ap > 0) {
          const e = this.eff(a);
          if (e && e.onDamageBase) await this.safe(() => e.onDamageBase(this, a, atk));
        }
        return;
      }
      if (!d || !this.findUnit(d.uid)) {
        // 防守單位在戰鬥傷害前離場：有 Overwhelm 時全部算溢出傷害
        if (d && this.has(a, 'Overwhelm') && ap > 0 && this.findUnit(a.uid)) {
          this.damageBase(1 - a.ctrl, ap, { combat: true, attacker: a });
          atk.baseDamage = ap;
        }
        return;
      }
      const dp = this.power(d, false);
      // Grit 在戰鬥中同時結算：先鎖定目前傷害
      a.gritDamage = a.damage;
      d.gritDamage = d.damage;
      const remainingD = this.remaining(d);
      const hadShield = d.upgrades.some((x) => x.card.n === 'Shield');
      const ph = this.G.phaseId;
      const yA = a.yodaPhase === ph, yD = d.yodaPhase === ph;
      const ae0 = this.eff(a);
      const de0 = this.eff(d);
      let lastA = !!(ae0 && ae0.strikeLast && ae0.strikeLast(this, a, atk));
      if (!lastA && ae0 && ae0.strikeLastAsk) lastA = await this.yesno(a.ctrl, SWU.lang === 'en' ? 'Have the defending unit deal combat damage first?' : '要讓防守單位先造成戰鬥傷害嗎？', { card: a.card.key, aiNo: true });
      const lastD = !!(de0 && de0.strikeLast && de0.strikeLast(this, d, atk));
      const first = !lastA && !!(atk.strikeFirst || (atk.opts && atk.opts.strikeFirst) || lastD || (ae0 && ae0.strikeFirst && ae0.strikeFirst(this, a, atk)));
      // Greedo：攻擊者最後造成戰鬥傷害（防守者先打，攻擊者被擊敗就不造成傷害）
      if (lastA && !lastD && !(yA || yD)) {
        await this.damageUnit(a, dp, { combat: true, p: d.ctrl, defender: d });
        if (this.remaining(a) <= 0) {
          delete a.gritDamage;
          delete d.gritDamage;
          for (const u of [d, a]) if (this.findUnit(u.uid) && this.remaining(u) <= 0) await this.defeat(u, { combat: true, by: u === d ? a : d });
          await this.checkState();
          return;
        }
        const dealt = await this.damageUnit(d, ap, { combat: true, attacker: a, p: a.ctrl });
        delete a.gritDamage;
        delete d.gritDamage;
        if (this.has(a, 'Overwhelm') && !hadShield && dealt > 0 && ap - Math.max(0, remainingD) > 0) this.damageBase(1 - a.ctrl, ap - Math.max(0, remainingD), { combat: true, attacker: a });
        atk.defenderDefeated = this.remaining(d) <= 0;
        for (const u of [d, a]) if (this.findUnit(u.uid) && this.remaining(u) <= 0) await this.defeat(u, { combat: true, by: u === d ? a : d });
        await this.checkState();
        return;
      }
      const dealtToD = yA || yD ? 0 : await this.damageUnit(d, ap, { combat: true, attacker: a, p: a.ctrl });
      atk.dealtToD = dealtToD;
      const d2 = atk.defender2 && this.findUnit(atk.defender2.uid) ? atk.defender2 : null;
      if (d2) {
        const d2p = this.power(d2, false);
        await this.damageUnit(d2, ap, { combat: true, attacker: a, p: a.ctrl });
        await this.damageUnit(a, d2p, { combat: true, p: d2.ctrl, defender: d2 });
      }
      // 「先造成戰鬥傷害」：防守單位因此被擊敗就不會反擊
      if (!(yA || yD) && !(first && this.remaining(d) <= 0)) await this.damageUnit(a, dp, { combat: true, p: d.ctrl, defender: d });
      delete a.gritDamage;
      delete d.gritDamage;
      if (this.has(a, 'Overwhelm') && !hadShield && dealtToD > 0) {
        const excess = ap - Math.max(0, remainingD);
        if (excess > 0) {
          this.damageBase(1 - a.ctrl, excess, { combat: true, attacker: a });
          atk.baseDamage = excess;
        }
      }
      atk.defenderDefeated = this.remaining(d) <= 0;
      if (atk.defenderDefeated) {
        const e = this.eff(a);
        if (e && e.onAttackDefeat) atk.afterDefeat = () => e.onAttackDefeat(this, a, atk);
      }
      // 戰鬥傷害後一起判定擊敗
      for (const u of d2 ? [d, d2, a] : [d, a]) if (this.findUnit(u.uid) && this.remaining(u) <= 0) await this.defeat(u, { combat: true, by: u === a ? d : a });
      if (atk.afterDefeat && this.findUnit(a.uid)) await this.safe(atk.afterDefeat);
      await this.checkState();
    }

    // ---------- 流程 ----------
    async run() {
      try {
        await this.setup();
        while (this.G.winner == null) {
          await this.actionPhase();
          await this.regroupPhase();
          if (this.allUnits().some((u) => { const e = this.eff(u); return e && e.extraRegroup; })) {
            this.log('logNote', 'Max Rebo: extra regroup phase');
            await this.regroupPhase();
          }
          this.G.round++;
        }
      } catch (e) {
        if (!(e instanceof GameOver)) {
          console.error(e);
          this.log('logEffectError', String(e.message || e));
          this.emit({ type: 'crash', error: e });
        }
      }
      this.emit({ type: 'update' });
    }
    async setup() {
      const G = this.G;
      G.phase = 'setup';
      // 隨機（或上一局輸的人）決定誰拿主動權先手
      const chooser = this.opts.initiativeChooser != null ? this.opts.initiativeChooser : rnd(2);
      // 單局：像比賽一樣隨機決定先後攻；BO3 第二局起才由上一局輸家選
      if (this.opts.randomFirst && this.opts.initiativeChooser == null) G.initiative = rnd(2);
      else if (this.opts.askInitiative) G.initiative = (await this.yesno(chooser, SWU.t('promptGoFirst'), { goFirst: true })) ? chooser : 1 - chooser;
      else G.initiative = chooser;
      this.log('logStart', this.P(G.initiative).name);
      for (const P of G.players) {
        let n = 6;
        const le = SWU.EFFECTS.get(P.leader.card, 'leader');
        if (le && le.startingHand) n += le.startingHand;
        const be = SWU.EFFECTS.get(P.base.card, 'card');
        if (be && be.startingHand) n += be.startingHand;
        this.draw(P.idx, n);
      }
      this.emit({ type: 'update' });
      for (const p of [G.initiative, 1 - G.initiative]) {
        const P = this.P(p);
        const nbe = SWU.EFFECTS.get(P.base.card, 'card');
        if (!(nbe && nbe.noMulligan) && (await this.yesno(p, SWU.t('promptMulligan'), { mulligan: true }))) {
          const n = P.hand.length;
          P.deck.push(...P.hand);
          P.hand = [];
          shuffle(P.deck);
          this.draw(p, n);
          this.log('logMulligan', P.name);
        }
      }
      for (const p of [G.initiative, 1 - G.initiative]) {
        const P = this.P(p);
        const cards = await this.pickCards(p, SWU.t('promptResource2'), P.hand, 2, 2, { setupResource: true });
        for (const c of cards) {
          P.hand = P.hand.filter((x) => x !== c);
          P.resources.push({ ...c, exhausted: false });
        }
        this.log('logResourced', P.name, cards.length);
      }
      this.emit({ type: 'update' });
    }
    async actionPhase() {
      const G = this.G;
      G.phase = 'action';
      G.phaseId++;
      G.active = G.initiative;
      G.consecutivePasses = 0;
      G.initiativeTaken = false;
      G.tookInit = [false, false];
      G.playedThisPhase = [[], []];
      G.attackedBase = [[], []];
      this.log('logRound', G.round);
      for (const d of (G.delayed || []).filter((d) => d.at === 'actionStart' && d.round === G.round && !d.done)) {
        d.done = true;
        await this.safe(() => d.run(this));
      }
      for (const q of [G.initiative, 1 - G.initiative]) await this.fire(q, 'onActionPhaseStart');
      this.emit({ type: 'update' });
      let guard = 0;
      while (G.consecutivePasses < 2 && guard++ < 500) {
        const p = G.active;
        const acts = this.legalActions(p);
        this.emit({ type: 'turn', p });
        let act;
        // 只剩 Pass 時：電腦自動跳過；玩家（manualPass 座位）要自己按，保留虛張聲勢的空間（拿了先攻之後規則上就是 Pass，自動跳過）
        if (acts.length === 1 && (this.opts.manualPass !== p || G.tookInit[p])) act = acts[0];
        else {
          if (this.io[p].isHuman) this.checkpoints.push(this.rec.length);
          act = await this.input(p, 'a', () => this.io[p].chooseAction(this, p, acts));
        }
        if (!act) act = { type: 'pass' };
        G.actor = p;
        await this.doAction(p, act);
        G.actor = null;
        this.emit({ type: 'update' });
        // 「在這個行動之後再進行一個行動」
        if (G.extraAction === p && act.type !== 'pass') G.active = p;
        else G.active = 1 - p;
        if (G.extraAction === p) G.extraAction = null;
      }
    }
    async regroupPhase() {
      const G = this.G;
      G.phase = 'regroup';
      G.phaseId++;
      this.log('logRegroup');
      for (const d of (G.delayed || []).filter((d) => d.at === 'regroupStart' && d.round === G.round)) await this.safe(() => d.run(this));
      for (const q of [G.initiative, 1 - G.initiative]) await this.fire(q, 'onRegroupStart');
      for (const P of G.players)
        for (const u of [...P.units])
          if (u.returnCtrl != null && u.ctrl !== u.owner) {
            P.units = P.units.filter((x) => x !== u);
            u.ctrl = u.owner;
            delete u.returnCtrl;
            this.P(u.owner).units.push(u);
          }
      for (const p of [G.initiative, 1 - G.initiative]) this.draw(p, 2);
      this.emit({ type: 'update' });
      for (const p of [G.initiative, 1 - G.initiative]) {
        const P = this.P(p);
        if (!P.hand.length) continue;
        const cards = await this.pickCards(p, SWU.t('promptResource1'), P.hand, 0, 1, { regroupResource: true });
        for (const c of cards) {
          P.hand = P.hand.filter((x) => x !== c);
          P.resources.push({ ...c, exhausted: false });
          this.log('logResourced', P.name, 1);
          await this.fire(p, 'onResourced', c);
        }
      }
      for (const P of G.players) {
        for (const r of P.resources) r.exhausted = false;
        // Count Dooku｜Silver-Tongued：對手每個區域最多重置 1 個單位
        const lim = this.opp(P.idx).units.some((x) => { const e = this.eff(x); return e && e.regroupLimit; });
        let toReady = P.units.filter((u) => !(u.skipRegroupReady != null && u.skipRegroupReady === this.G.round) && !(() => { const e = this.eff(u); return e && e.noRegroupReady && e.noRegroupReady(this, u); })());
        for (const u of P.units) if (u.skipRegroupReady === this.G.round) delete u.skipRegroupReady;
        if (lim) {
          const pickArena = async (ar) => {
            const xs = toReady.filter((u) => u.arena === ar && u.exhausted);
            if (xs.length <= 1) return xs;
            const t = await this.pickUnit(P.idx, SWU.lang === 'en' ? 'Choose 1 ' + ar + ' unit to ready' : '選 1 個' + (ar === 'Space' ? '太空' : '地面') + '單位重置', (u) => xs.includes(u), {});
            return t ? [t] : [xs[0]];
          };
          toReady = [...toReady.filter((u) => !u.exhausted), ...(await pickArena('Ground')), ...(await pickArena('Space'))];
        }
        for (const u of toReady) this.ready(u);
        P.leader.exhausted = false;
      }
      for (const q of [this.G.initiative, 1 - this.G.initiative]) await this.fire(q, 'onRegroupReady');
      this.emit({ type: 'update' });
    }

    // ---------- 給 AI 的精簡狀態 ----------
    snapshot(forP) {
      const G = this.G;
      const unit = (u) => ({
        uid: u.uid,
        name: u.card.key,
        power: this.power(u),
        hp: this.hp(u),
        damage: u.damage,
        exhausted: u.exhausted,
        arena: u.arena,
        leader: u.isLeader || undefined,
        keywords: Object.entries(this.kw(u))
          .filter(([k, v]) => v && !['SmuggleRaw', 'Bounty'].includes(k))
          .map(([k, v]) => (typeof v === 'number' ? k + ' ' + v : k)),
        upgrades: u.upgrades.map((x) => x.card.n),
        text: SWU.cardText(u.card, u.isLeader ? 'unit' : 'card', 'en').slice(0, 300),
      });
      const pl = (P, me) => ({
        name: P.name,
        base: { name: P.base.card.key, hp: P.base.card.h, damage: P.base.damage },
        leader: {
          name: P.leader.card.key,
          deployed: P.leader.deployed,
          exhausted: P.leader.exhausted,
          epicUsed: P.leader.epicUsed,
          deployCost: P.leader.card.c,
          text: (P.leader.deployed ? P.leader.card.bt : P.leader.card.tx || '').slice(0, 300),
        },
        resources: P.resources.length,
        readyResources: P.resources.filter((r) => !r.exhausted).length,
        handSize: P.hand.length,
        hand: me
          ? P.hand.map((c) => ({ uid: c.uid, name: c.card.key, type: c.card.t, cost: this.costOf(P.idx, c.card), power: c.card.p, hp: c.card.h, text: (c.card.tx || '').slice(0, 240) }))
          : undefined,
        deckSize: P.deck.length,
        discardTop: P.discard.slice(-5).map((c) => c.card.n),
        units: P.units.map(unit),
        aspects: P.aspects,
      });
      return {
        round: G.round,
        phase: G.phase,
        initiative: this.P(G.initiative).name,
        initiativeTaken: G.initiativeTaken,
        you: pl(this.P(forP), true),
        opponent: pl(this.opp(forP), false),
        recentLog: G.log.slice(-12).map((l) => SWU.fmtLog(l, 'en')),
      };
    }
  }
  class GameOver extends Error {}
  SWU.Game = Game;
  // 給 AI 預想用：暫存／還原全域亂數與編號
  SWU.engineRT = { get: () => ({ RNG, UID }), set: (r) => ((RNG = r.RNG), (UID = r.UID)) };
  SWU.GameOver = GameOver;

  SWU.unitLabel = function (g, u) {
    const who = u.ctrl === 0 ? SWU.t('mine') : SWU.t('theirs');
    return `${who} ${u.card.n}${u.isLeader ? '★' : ''} ${g.power(u)}/${g.remaining(u)}`;
  };
})();
