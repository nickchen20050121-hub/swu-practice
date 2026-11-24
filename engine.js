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

  // 卡片文字有沒有「關鍵字以外」的能力
  SWU.abilityLines = function (card, side) {
    const text = side === 'unit' && card.t === 'Leader' ? card.bt || '' : card.tx || '';
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
    if (c.force) g.P(p).force = false;
    g.pay(p, c.res);
  };

  // ---------- 工具 ----------
  let UID = 1;
  const rnd = (n) => Math.floor(Math.random() * n);
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
      this.G.log.push({ k, a, r: this.G.round });
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
      if (!P.leader.deployed) out.push({ src: P.leader, e: SWU.EFFECTS.get(P.leader.card, 'leader') });
      out.push({ src: P.base, e: SWU.EFFECTS.get(P.base.card, 'card') });
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
      const base = SWU.EFFECTS.get(u.card, u.isLeader ? 'unit' : 'card');
      if (!u.upgrades || !u.upgrades.length || !SWU.GFX) return base;
      let out = base;
      for (const up of u.upgrades) {
        const ue = SWU.EFFECTS.get(up.card, 'card');
        if (ue && ue.grant) out = SWU.GFX.mergeHooks(out, ue.grant);
      }
      return out;
    }
    statics(u) {
      // 持續效果：卡片本身、場上其他卡的光環、升級卡
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
        const ue = SWU.EFFECTS.get(up.card, 'card');
        if (ue && ue.attachedStatic) add(ue.attachedStatic(this, up, u));
        const g = (up.card.tx || '').match(/^Attached unit gains (Sentinel|Overwhelm|Saboteur|Grit|Ambush|Hidden|Raid (\d+)|Restore (\d+))\.?$/m);
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
      for (const k of u.lost || []) delete res[k];
      return res;
    }
    has(u, k) {
      return !!this.kw(u)[k];
    }
    basePower(u) {
      return (u.isLeader ? u.card.p : u.card.p) || 0;
    }
    power(u, attacking) {
      const s = this.statics(u);
      let p = this.basePower(u) + s.p;
      for (const up of u.upgrades) p += up.card.p || 0;
      for (const m of this.activeMods(u)) p += m.p || 0;
      const k = this.kw(u);
      if (k.Grit) p += u.gritDamage != null ? u.gritDamage : u.damage;
      if (attacking && k.Raid) p += k.Raid;
      return Math.max(0, p);
    }
    hp(u) {
      const s = this.statics(u);
      let h = (u.card.h || 0) + s.h;
      for (const up of u.upgrades) h += up.card.t === 'Upgrade' || /Token/.test(up.card.t) ? up.card.h || 0 : 0;
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
      return (card.tr || []).includes(t.toUpperCase());
    }
    controlsBaseTrait(p, trait) {
      return this.hasTrait(this.P(p).base.card, trait);
    }
    aspectPenalty(p, card) {
      const have = [...this.P(p).aspects];
      let missing = 0;
      for (const a of card.a || []) {
        const i = have.indexOf(a);
        if (i >= 0) have.splice(i, 1);
        else missing++;
      }
      return missing * 2;
    }
    readyResources(p) {
      return this.P(p).resources.filter((r) => !r.exhausted).length;
    }
    costOf(p, card, opts = {}) {
      let base = opts.baseCost != null ? opts.baseCost : card.c || 0;
      let cost = base + (opts.ignoreAspect ? 0 : this.aspectPenalty(p, card));
      const e = SWU.EFFECTS.get(card, 'card');
      if (e && e.costMod) cost += e.costMod(this, p) || 0;
      // 場上的減費光環
      for (const u of this.P(p).units) {
        const oe = this.eff(u);
        if (oe && oe.discount) cost -= oe.discount(this, u, card) || 0;
      }
      cost -= opts.discount || 0;
      return Math.max(0, cost);
    }
    canPay(p, n) {
      return this.readyResources(p) + this.P(p).credits >= n;
    }
    pay(p, n) {
      const P = this.P(p);
      for (const r of P.resources) {
        if (n <= 0) break;
        if (!r.exhausted) {
          r.exhausted = true;
          n--;
        }
      }
      while (n > 0 && P.credits > 0) {
        P.credits--;
        n--;
      }
    }
    // Sentinel 限制下可攻擊的目標
    attackTargets(attacker, opts = {}) {
      const p = attacker.ctrl;
      const O = this.opp(p);
      const arena = attacker.arena;
      const enemies = O.units.filter((u) => u.arena === arena);
      const sab = this.has(attacker, 'Saboteur');
      const sentinels = enemies.filter((u) => this.has(u, 'Sentinel'));
      let units = enemies.filter((u) => {
        if (this.has(u, 'Hidden') && u.playedPhase === this.G.phaseId && !this.has(u, 'Sentinel')) return false;
        if (u.cantBeAttacked && u.cantBeAttacked === this.G.phaseId) return false;
        return true;
      });
      let base = !opts.noBase;
      if (sentinels.length && !sab) {
        units = sentinels;
        base = false;
      }
      if (opts.unitsOnly) base = false;
      if (opts.filter) units = units.filter(opts.filter);
      return { units, base };
    }
    canAttackWith(u) {
      if (u.exhausted) return false;
      if (u.cantAttack) return false;
      const t = this.attackTargets(u);
      return t.units.length > 0 || t.base;
    }

    // ---------- 互動 ----------
    async choose(p, req) {
      // req: {prompt, options:[{id,label,uid?}], min, max}
      if (!req.options.length) return [];
      const min = req.min == null ? 1 : req.min;
      if (req.options.length === 1 && min >= 1 && (req.max || 1) === 1 && !req.forceAsk) return [req.options[0].id];
      this.emit({ type: 'prompt', p, req });
      const r = await this.io[p].choose(this, p, req);
      this.emit({ type: 'prompt-done', p });
      return Array.isArray(r) ? r : r == null ? [] : [r];
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
    async pickOption(p, prompt, labels, opts = {}) {
      const options = labels.map((l, i) => ({ id: i, label: l }));
      const r = await this.choose(p, { kind: 'option', prompt, options, min: opts.optional ? 0 : 1, max: 1, forceAsk: true, ctx: opts.ctx });
      return r.length ? +r[0] : -1;
    }
    async pickCards(p, prompt, cards, min, max, ctx) {
      const options = cards.map((c) => ({ id: c.uid, label: c.card.key, card: c.card.key }));
      const r = await this.choose(p, { kind: 'cards', prompt, options, min, max, forceAsk: true, ctx });
      return r.map((id) => cards.find((c) => c.uid === id)).filter(Boolean);
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
        P.hand.push(P.deck.shift());
      }
      if (n > 0) this.log('logDraw', P.name, n);
    }
    damageBase(p, n, src) {
      if (n <= 0) return 0;
      const B = this.P(p).base;
      const fe = B.upgrades.map((up) => SWU.EFFECTS.get(up.card, 'card')).find((e) => e && e.baseDamage);
      if (fe) {
        const r = fe.baseDamage(this, p, n);
        if (r === 0) return 0;
      }
      B.damage += n;
      this.log('logBaseDmg', this.P(p).name, n);
      this.checkWin();
      return n;
    }
    healBase(p, n) {
      const B = this.P(p).base;
      const h = Math.min(n, B.damage);
      B.damage -= h;
      if (h) this.log('logBaseHeal', this.P(p).name, h);
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
      const sh = u.upgrades.findIndex((x) => x.card.n === 'Shield');
      if (sh >= 0) {
        u.upgrades.splice(sh, 1);
        this.log('logShield', u.card.n);
        return 0;
      }
      u.damage += n;
      this.log('logUnitDmg', u.card.n, n);
      this.pendingDamaged = this.pendingDamaged || [];
      this.pendingDamaged.push(u);
      if (!src.combat) await this.checkState();
      return n;
    }
    heal(u, n) {
      const h = Math.min(n, u.damage);
      u.damage -= h;
      if (h) this.log('logHeal', u.card.n, h);
      return h;
    }
    giveShield(u) {
      u.upgrades.push(this.inst(SWU.token('Shield'), u.ctrl));
      this.log('logGiveShield', u.card.n);
    }
    giveExp(u, n = 1) {
      for (let i = 0; i < n; i++) u.upgrades.push(this.inst(SWU.token('Experience'), u.ctrl));
      this.log('logGiveExp', u.card.n, n);
    }
    giveToken(u, name) {
      const t = SWU.token(name);
      if (t) u.upgrades.push(this.inst(t, u.ctrl));
      this.log('logGiveToken', u.card.n, name);
    }
    buff(u, p, h, until = 'phase', kw) {
      const m = { p, h, kw, until, phaseId: this.G.phaseId };
      if (until === 'attack' && this.G.attack) m.attackId = this.G.attack.id;
      u.mods.push(m);
      if (p || h) this.log('logBuff', u.card.n, (p >= 0 ? '+' : '') + p + '/' + (h >= 0 ? '+' : '') + h);
    }
    exhaust(u) {
      u.exhausted = true;
    }
    ready(u) {
      u.exhausted = false;
    }
    async defeat(u, why = {}) {
      if (!u || !this.findUnit(u.uid)) return;
      const ctrl = u.ctrl;
      const P = this.P(ctrl);
      const e = this.eff(u);
      const wasCombat = !!why.combat;
      if (e && e.cantBeDefeatedBy && e.cantBeDefeatedBy(this, u, why)) return;
      P.units = P.units.filter((x) => x !== u);
      this.log('logDefeat', u.card.n);
      if (u.captured && u.captured.length) this.rescue(u);
      // 升級卡回各自擁有者棄牌堆，代幣消失
      for (const up of u.upgrades) if (!/Token/.test(up.card.t)) this.P(up.owner).discard.push({ uid: up.uid, card: up.card, owner: up.owner });
      if (u.isLeader) {
        const L = this.P(u.owner).leader;
        L.deployed = false;
        L.exhausted = true;
        L.epicUsed = true;
      } else if (!/Token/.test(u.card.t)) {
        this.P(u.owner).discard.push({ uid: u.uid, card: u.card, owner: u.owner });
      }
      this.emit({ type: 'defeat', u });
      // When Defeated
      const snapshot = { ...u, defeatedByCombat: wasCombat };
      if (e && e.whenDefeated) await this.safe(() => e.whenDefeated(this, snapshot, why));
      else if (!e || !e.implemented) await this.unimplemented(u, 'When Defeated', ctrl);
      if (e && e.bounty) await this.safe(() => e.bounty(this, snapshot, 1 - ctrl));
      else for (const k of u.card.kwp?.Bounty || []) await this.unimplementedText(u, k, 1 - ctrl);
      // 其他卡的「當敵方單位被擊敗」
      for (const q of [ctrl, 1 - ctrl]) await this.fire(q, 'onAnyDefeated', snapshot);
    }
    async checkState() {
      let again = true;
      while (again) {
        again = false;
        for (const u of this.allUnits()) {
          if (this.remaining(u) <= 0) {
            await this.defeat(u, { state: true });
            again = true;
            break;
          }
        }
      }
      // 「受到傷害且存活」
      const dmg = this.pendingDamaged || [];
      this.pendingDamaged = [];
      for (const u of dmg) {
        if (!this.findUnit(u.uid)) continue;
        const e = this.eff(u);
        if (e && e.whenDamagedSurvive) await this.safe(() => e.whenDamagedSurvive(this, u));
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
        const u = this.makeUnit(this.inst(t, p), p, { exhausted: true });
        this.P(p).units.push(u);
        out.push(u);
      }
      this.log('logToken', this.P(p).name, name, n);
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
      const P = this.P(t.ctrl);
      P.units = P.units.filter((x) => x !== t);
      for (const up of t.upgrades) if (!/Token/.test(up.card.t)) this.P(up.owner).discard.push({ uid: up.uid, card: up.card, owner: up.owner });
      captor.captured = captor.captured || [];
      captor.captured.push({ uid: t.uid, card: t.card, owner: t.owner });
      this.log('logCapture', captor.card.n, t.card.n);
    }
    rescue(captor) {
      for (const c of captor.captured || []) {
        const u = this.makeUnit(c, c.owner, { exhausted: true });
        this.P(c.owner).units.push(u);
        this.log('logRescue', c.card.n);
      }
      captor.captured = [];
    }
    returnToHand(u) {
      if (!this.findUnit(u.uid) || u.isLeader) return;
      const P = this.P(u.ctrl);
      P.units = P.units.filter((x) => x !== u);
      for (const up of u.upgrades) if (!/Token/.test(up.card.t)) this.P(up.owner).discard.push({ uid: up.uid, card: up.card, owner: up.owner });
      if (!/Token/.test(u.card.t)) this.P(u.owner).hand.push({ uid: u.uid, card: u.card, owner: u.owner });
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
      }
      return cards;
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
      if (this.io[p].resolveManual) await this.io[p].resolveManual(this, p, { card: u.card, text, source: u });
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
      }
      for (const r of P.resources) {
        const k = r.card.kwp || {};
        if (k.Smuggle != null) {
          const a = this.playOption(p, r, 'smuggle');
          if (a) acts.push(a);
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
        const line = !(le0 && le0.actions) && SWU.actionLine(L.card, 'leader');
        if (line && SWU.actionAffordable(this, p, line, L)) acts.push({ type: 'manualLeader', line, label: SWU.t('actLeaderAbility', L.card.n, SWU.t('manualTag')) });
      }
      if (!L.deployed) {
        const le = SWU.EFFECTS.get(L.card, 'leader');
        if (le && le.actions)
          le.actions.forEach((ab, i) => {
            if (ab.can(this, L)) acts.push({ type: 'leaderAbility', manual: !!ab.manual, i, label: SWU.t('actLeaderAbility', L.card.n, ab.label ? SWU.t(ab.label) : ab.text || '') });
          });
        if (!L.epicUsed && P.resources.length >= (L.card.c || 99)) acts.push({ type: 'deploy', label: SWU.t('actDeploy', L.card.n) });
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
    playOption(p, c, from) {
      const card = c.card;
      if (!['Unit', 'Event', 'Upgrade'].includes(card.t)) return null;
      let cost;
      if (from === 'smuggle') cost = this.costOf(p, card, { baseCost: card.kwp.Smuggle });
      else cost = this.costOf(p, card);
      const e = SWU.EFFECTS.get(card, 'card');
      let exploitMax = card.kwp.Exploit || 0;
      const reduce = Math.min(exploitMax, this.P(p).units.length) * 2;
      if (!this.canPay(p, Math.max(0, cost - reduce))) return null;
      if (card.t === 'Upgrade' && !this.upgradeTargets(p, card).length) return null;
      if (e && e.canPlay && !e.canPlay(this, p)) return null;
      return { type: 'play', uid: c.uid, from, cost, label: SWU.t(from === 'smuggle' ? 'actSmuggle' : 'actPlay', card.n, cost) };
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
      units = units.filter((u) => !/Token/.test(u.card.t) || true);
      return units;
    }
    async doAction(p, act) {
      const G = this.G;
      const P = this.P(p);
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
          G.consecutivePasses = 0;
          return;
        case 'play':
          await this.playCard(p, act.uid, act.from);
          break;
        case 'attack': {
          const u = this.findUnit(act.uid);
          await this.attack(u, {});
          break;
        }
        case 'ability': {
          const u = this.findUnit(act.uid);
          const ab = this.eff(u).actions[act.i];
          this.log('logAbility', u.card.n);
          await this.safe(() => ab.run(this, u));
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
          await this.deployLeader(p);
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
      if (from === 'smuggle') {
        c = P.resources.find((r) => r.uid === uid);
      } else if (from === 'deck') {
        c = opts.inst;
      } else c = P.hand.find((x) => x.uid === uid);
      if (!c) return;
      const card = c.card;
      let cost = opts.free ? 0 : from === 'smuggle' ? this.costOf(p, card, { baseCost: card.kwp.Smuggle }) : this.costOf(p, card, { discount: opts.discount || 0, ignoreAspect: opts.ignoreAspect });
      // Exploit
      if (!opts.free && card.kwp.Exploit && P.units.length) {
        const max = Math.min(card.kwp.Exploit, P.units.length);
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
          if (u) await this.defeat(u, { exploit: true });
          cost = Math.max(0, cost - 2);
        }
      }
      if (!this.canPay(p, cost)) return;
      this.pay(p, cost);
      if (from === 'smuggle') {
        P.resources = P.resources.filter((r) => r !== c);
        if (P.deck.length) P.resources.push({ ...P.deck.shift(), exhausted: true });
      } else if (from === 'hand') P.hand = P.hand.filter((x) => x !== c);
      this.log('logPlay', P.name, card.n, cost);
      this.G.playedThisPhase[p].push(card);
      const inst = { uid: c.uid, card, owner: c.owner };
      const e = SWU.EFFECTS.get(card, 'card');
      if (card.t === 'Unit') {
        const u = this.makeUnit(inst, p, { exhausted: true });
        P.units.push(u);
        await this.enforceUnique(p, u);
        this.emit({ type: 'play', u });
        if (this.has(u, 'Shielded')) this.giveShield(u);
        // 其他卡「當你打出單位時」
        await this.fire(p, 'onFriendlyPlay', u);
        if (e && e.whenPlayed) await this.safe(() => e.whenPlayed(this, u));
        else if (!e || !e.implemented) await this.unimplemented(u, 'When Played', p);
        await this.checkState();
        if (this.findUnit(u.uid) && this.has(u, 'Ambush')) await this.ambush(u);
        if (this.findUnit(u.uid) && this.has(u, 'Support')) await this.support(u);
      } else if (card.t === 'Event') {
        P.discard.push(inst);
        if (e && e.event) await this.safe(() => e.event(this, p, inst));
        else await this.unimplementedText({ card }, card.tx || '', p);
        await this.fire(p, 'onFriendlyEvent', card);
      } else if (card.t === 'Upgrade') {
        const targets = opts.target ? [opts.target] : this.upgradeTargets(p, card);
        const t = await this.pickUnit(p, SWU.t('promptAttach', card.n), (u) => targets.includes(u), { ctx: { card: card.key } });
        if (!t) {
          P.discard.push(inst);
          return;
        }
        t.upgrades.push(inst);
        this.log('logAttach', card.n, t.card.n);
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
      const t = this.attackTargets(u, { unitsOnly: true });
      if (!t.units.length) return;
      if (!(await this.yesno(u.ctrl, SWU.t('promptAmbush', u.card.n), { uid: u.uid }))) return;
      this.ready(u);
      await this.attack(u, { unitsOnly: true });
    }
    async support(u) {
      const others = this.P(u.ctrl).units.filter((x) => x !== u && this.canAttackWith(x));
      if (!others.length) return;
      const a = await this.pickUnit(u.ctrl, SWU.t('promptSupport', u.card.n), (x) => others.includes(x), { optional: true });
      const e = this.eff(u);
      if (a) await this.attack(a, { onAttackExtra: e && e.supportGrant ? (atk) => e.supportGrant(this, u, atk) : null });
    }
    async deployLeader(p) {
      const P = this.P(p);
      const L = P.leader;
      L.deployed = true;
      L.epicUsed = true;
      const u = this.makeUnit({ uid: L.uid, card: L.card, owner: p }, p, { exhausted: false, isLeader: true, arena: 'Ground' });
      P.units.push(u);
      this.log('logDeploy', P.name, L.card.n);
      const e = SWU.EFFECTS.get(L.card, 'unit');
      if (e && e.whenDeployed) await this.safe(() => e.whenDeployed(this, u));
      else if (!e || !e.implemented) await this.unimplemented(u, 'When Deployed', p);
      if (this.has(u, 'Shielded')) this.giveShield(u);
    }

    // ---------- 攻擊 ----------
    async attack(attacker, opts = {}) {
      if (!attacker || !this.findUnit(attacker.uid)) return;
      const G = this.G;
      const p = attacker.ctrl;
      const tg = this.attackTargets(attacker, opts);
      if (!tg.units.length && !tg.base) return;
      this.exhaust(attacker);
      const atk = { id: UID++, attacker, p, opts };
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
        if (opts.power || opts.hp) this.buff(attacker, opts.power || 0, opts.hp || 0, 'attack');
        if (opts.kw) attacker.mods.push({ p: 0, h: 0, kw: opts.kw, until: 'attack', attackId: atk.id });
        this.log(atk.base ? 'logAttackBase' : 'logAttackUnit', attacker.card.n, atk.defender ? atk.defender.card.n : this.opp(p).name);
        this.emit({ type: 'attack', atk });
        // On Attack
        const k = this.kw(attacker);
        if (k.Restore) this.healBase(p, k.Restore);
        if (k.Saboteur && atk.defender) {
          const before = atk.defender.upgrades.length;
          atk.defender.upgrades = atk.defender.upgrades.filter((x) => x.card.n !== 'Shield');
          if (before !== atk.defender.upgrades.length) this.log('logSaboteur', atk.defender.card.n);
        }
        const e = this.eff(attacker);
        if (e && e.onAttack) await this.safe(() => e.onAttack(this, attacker, atk));
        else if (!e || !e.implemented) await this.unimplemented(attacker, 'On Attack', p);
        for (const up of attacker.upgrades) {
          const ue = SWU.EFFECTS.get(up.card, 'card');
          if (ue && ue.attachedOnAttack) await this.safe(() => ue.attachedOnAttack(this, up, attacker, atk));
        }
        if (opts.onAttackExtra) await this.safe(() => opts.onAttackExtra(atk));
        // 其他友方「當友方單位攻擊時」
        await this.fire(p, 'onFriendlyAttack', atk);
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
          if (u && this.findUnit(u.uid)) u.upgrades = u.upgrades.filter((x) => x.card.n !== 'Advantage');
        }
        await this.checkState();
      } finally {
        G.attack = prev;
      }
    }
    async combatDamage(atk) {
      const a = atk.attacker;
      const d = atk.defender;
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
      if (!d || !this.findUnit(d.uid)) return;
      const dp = this.power(d, false);
      // Grit 在戰鬥中同時結算：先鎖定目前傷害
      a.gritDamage = a.damage;
      d.gritDamage = d.damage;
      const remainingD = this.remaining(d);
      const hadShield = d.upgrades.some((x) => x.card.n === 'Shield');
      const dealtToD = await this.damageUnit(d, ap, { combat: true });
      await this.damageUnit(a, dp, { combat: true });
      delete a.gritDamage;
      delete d.gritDamage;
      if (this.has(a, 'Overwhelm') && !hadShield) {
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
      for (const u of [d, a]) if (this.findUnit(u.uid) && this.remaining(u) <= 0) await this.defeat(u, { combat: true, by: u === d ? a : d });
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
      G.initiative = rnd(2);
      this.log('logStart', this.P(G.initiative).name);
      for (const P of G.players) {
        let n = 6;
        const le = SWU.EFFECTS.get(P.leader.card, 'leader');
        if (le && le.startingHand) n += le.startingHand;
        this.draw(P.idx, n);
      }
      this.emit({ type: 'update' });
      for (const p of [G.initiative, 1 - G.initiative]) {
        const P = this.P(p);
        if (await this.yesno(p, SWU.t('promptMulligan'), { mulligan: true })) {
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
      for (const q of [G.initiative, 1 - G.initiative]) await this.fire(q, 'onActionPhaseStart');
      this.emit({ type: 'update' });
      let guard = 0;
      while (G.consecutivePasses < 2 && guard++ < 500) {
        const p = G.active;
        const acts = this.legalActions(p);
        this.emit({ type: 'turn', p });
        let act;
        if (acts.length === 1) act = acts[0];
        else act = await this.io[p].chooseAction(this, p, acts);
        if (!act) act = { type: 'pass' };
        await this.doAction(p, act);
        this.emit({ type: 'update' });
        G.active = 1 - p;
      }
    }
    async regroupPhase() {
      const G = this.G;
      G.phase = 'regroup';
      G.phaseId++;
      this.log('logRegroup');
      for (const q of [G.initiative, 1 - G.initiative]) await this.fire(q, 'onRegroupStart');
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
        }
      }
      for (const P of G.players) {
        for (const r of P.resources) r.exhausted = false;
        for (const u of P.units) u.exhausted = false;
        P.leader.exhausted = false;
      }
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
  SWU.GameOver = GameOver;

  SWU.unitLabel = function (g, u) {
    const who = u.ctrl === 0 ? SWU.t('mine') : SWU.t('theirs');
    return `${who} ${u.card.n}${u.isLeader ? '★' : ''} ${g.power(u)}/${g.remaining(u)}`;
  };
})();
