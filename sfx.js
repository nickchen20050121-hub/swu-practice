/* 小音效：全部用 Web Audio 即時合成，不用下載音檔 */
(function () {
  const SWU = (window.SWU = window.SWU || {});
  let ctx = null;
  let master = null;
  const last = {};
  function on() {
    const st = SWU.AI && SWU.AI.settings;
    return !st || st.sound !== false;
  }
  function vol() {
    const st = SWU.AI && SWU.AI.settings;
    return st && st.volume != null ? st.volume : 0.5;
  }
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = 0.35 * vol();
    return ctx;
  }
  // 瀏覽器規定要使用者先點一下才能出聲
  const unlock = () => ac();
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  function tone(f0, f1, dur, type = 'sine', gain = 0.5, delay = 0) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(f0, f1, dur, gain = 0.4, q = 1.2, delay = 0) {
    const c = ac();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  const SOUNDS = {
    play: () => noise(2400, 700, 0.14, 0.5, 0.9),
    draw: () => noise(3200, 1800, 0.07, 0.25, 1.5),
    attack: () => {
      noise(350, 2600, 0.22, 0.45, 0.8);
      tone(140, 90, 0.18, 'triangle', 0.25, 0.05);
    },
    hit: () => {
      tone(190, 70, 0.13, 'sine', 0.55);
      noise(1200, 400, 0.05, 0.3, 1);
    },
    base: () => {
      tone(110, 45, 0.28, 'sine', 0.7);
      noise(600, 150, 0.12, 0.3, 0.8);
    },
    defeat: () => {
      tone(320, 160, 0.16, 'triangle', 0.3);
      tone(220, 110, 0.22, 'triangle', 0.25, 0.09);
    },
    heal: () => tone(520, 880, 0.2, 'sine', 0.25),
    shield: () => {
      tone(700, 1050, 0.12, 'sine', 0.2);
      tone(1050, 1400, 0.14, 'sine', 0.15, 0.06);
    },
    round: () => {
      tone(660, 660, 0.45, 'sine', 0.22);
      tone(990, 990, 0.5, 'sine', 0.16, 0.08);
    },
    pass: () => tone(440, 400, 0.08, 'sine', 0.15),
    initiative: () => {
      tone(523, 523, 0.12, 'triangle', 0.2);
      tone(784, 784, 0.2, 'triangle', 0.2, 0.1);
    },
    click: () => tone(900, 700, 0.04, 'sine', 0.12),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.25, i * 0.12)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.35, 'triangle', 0.22, i * 0.16)),
  };
  function sfx(name) {
    if (!on() || !SOUNDS[name]) return;
    const now = performance.now();
    if (last[name] && now - last[name] < 70) return;
    last[name] = now;
    try {
      SOUNDS[name]();
    } catch (e) {
      /* 沒有音效裝置也不影響遊戲 */
    }
  }
  const BY_LOG = {
    logPlay: 'play',
    logDeploy: 'play',
    logResourced: 'play',
    logDraw: 'draw',
    logAttackUnit: 'attack',
    logAttackBase: 'attack',
    logUnitDmg: 'hit',
    logBaseDmg: 'base',
    logIndirect: 'hit',
    logDefeat: 'defeat',
    logHeal: 'heal',
    logBaseHeal: 'heal',
    logShield: 'shield',
    logGiveShield: 'shield',
    logGiveExp: 'shield',
    logRound: 'round',
    logPass: 'pass',
    logInitiative: 'initiative',
  };
  sfx.onLog = (entry) => entry && BY_LOG[entry.k] && sfx(BY_LOG[entry.k]);
  sfx.names = Object.keys(SOUNDS);
  SWU.sfx = sfx;
})();
