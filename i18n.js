/* 介面文字（繁中／English）與卡片繁中翻譯 */
(function () {
  const SWU = window.SWU;
  const S = {
    zh: {
      appName: '由奈練牌桌',
      yes: '是', no: '否', mine: '我方', theirs: '敵方', baseOf: '{0} 的基地', manualTag: '手動',
      asp_Vigilance: '藍（警戒）', asp_Command: '綠（指揮）', asp_Aggression: '紅（侵略）', asp_Cunning: '黃（狡詐）', asp_Heroism: '白（英雄）', asp_Villainy: '黑（反派）',
      // 行動
      actPlay: '打出 {0}（{1} 費）', actSmuggle: '走私打出 {0}（{1} 費）', actAttack: '用 {0} 攻擊', actAbility: '{0} 的行動能力 {1}',
      actLeaderAbility: '領袖 {0} 的行動能力 {1}', actDeploy: '部署領袖 {0}', actInitiative: '拿主動權（本階段之後都跳過）', actPass: '跳過',
      abT6Mentor: '（+2/+2 並可攻擊）',
      // 提示
      promptMulligan: '要重抽起手牌嗎？', promptResource2: '選 2 張手牌放進資源區', promptResource1: '整備階段：可以選 1 張手牌放進資源區（可不選）',
      promptDiscard: '選 {0} 張手牌棄掉', promptExploit: '剝削：最多可擊敗 {0} 個友方單位，每個減 2 費',
      promptAttach: '把 {0} 裝到哪個單位？', promptAmbush: '{0} 有伏擊：要準備並攻擊一個敵方單位嗎？', promptSupport: '{0} 的支援：選一個單位攻擊（可略過）',
      promptAttackTarget: '{0} 要攻擊誰？', promptAttackWith: '要用 {0} 攻擊嗎？', promptAttacker: '選一個要攻擊的單位',
      promptLukeFront: '路克（領袖）：要橫置領袖，替 {0} 回復 1 點傷害嗎？', promptLukeBack: '路克：回復 2 點傷害給誰？',
      optHealUnit: '{0}（回復 {1}）', optHealBase: '我方基地（回復 {0}）',
      promptGungi: 'Gungi 受傷存活：要棄 1 張手牌來準備他嗎？', promptHuyang: 'Huyang：選一個「有升級卡」的單位，本階段 -4/-0（可略過）',
      promptDisclose: '{1}：要揭示 {0} 嗎？', promptGoFirst: '由你決定：你要拿主動權（先手）嗎？', promptDiscloseCards: '{1}：揭示 {0}——選出要公開的手牌（不揭示就按略過）', logReveal: '{0} 公開了：{1}', logManualNote: '{0}', revealedBy: '{0} 公開了這些手牌', needMore: '還缺：{0}', undo: '回上一步', undoHint: '退回到你上一個行動之前', undoMid: '取消這個行動', okSeen: '看完了', promptLatts: 'Latts Razzi：給自己護盾還是經驗？', optShield: '護盾代幣', optExp: '經驗代幣',
      promptDealPower: '選一個敵方地面單位，造成 {0} 點傷害', promptLeiaVfd: 'Leia：要對 {0} 造成 1 點傷害，替基地回復 2 點嗎？',
      promptResourceTop: '要把牌庫頂的牌放進資源區嗎？', promptCobb: 'Cobb Vanth：要對自己造成 2 點傷害，給 {0} 護盾嗎？',
      promptHealUnit: '選一個單位回復 {0} 點傷害（可略過）', promptQuiGon: 'Qui-Gon：可以擊敗本階段攻擊過你基地的單位',
      promptHunter: 'Hunter：第 {0} 個選項', optShieldAUnit: '給一個單位護盾', optAttackExhausted: '讓一個單位攻擊（可已橫置，不能打基地）',
      promptShieldTarget: '給誰護盾？', promptKelleran: 'Kelleran Beq：從牌庫頂 7 張選 1 個單位打出（少 3 費）',
      promptLuminara: 'Luminara：可以讓一個單位攻擊，本次攻擊 +2/+0', promptTrask: 'Trask Walker：選棄牌堆中 7 費以下的單位',
      promptTrask2: '{0} 要怎麼處理？', optTraskBottom: '放牌庫底，基地回復 3', optTraskHand: '回到手牌',
      promptExpTarget: '給哪個友方單位經驗代幣？', promptBlueLeader: 'Blue Leader：要付 2 費移到地面並獲得 2 個經驗嗎？',
      promptT6: 'T-6：被攻擊時要給自己 1 個經驗代幣嗎？', promptBuffTarget: '選一個單位 {0}',
      promptOvergrowth1: '過度生長：選一個友方單位造成傷害', promptOvergrowth2: '選一個敵方單位受到 {0} 點傷害',
      promptDefeatNonLeader: '選一個非領袖單位擊敗', promptDefeatVehicle: '選一個非領袖載具單位擊敗', promptCapture: '選一個剩餘血量比它低的敵方非領袖單位俘虜',
      // 紀錄
      logStart: '對戰開始，{0} 拿到主動權', logDraw: '{0} 抽了 {1} 張', logEmptyDeck: '{0} 牌庫空了，基地受到 3 點傷害', logMulligan: '{0} 重抽了起手牌',
      logResourced: '{0} 放了 {1} 張牌到資源區', logRound: '── 第 {0} 回合 ──', logRegroup: '── 整備階段 ──', logPass: '{0} 跳過',
      logInitiative: '{0} 拿了主動權', logPlay: '{0} 打出 {1}（付 {2} 費）', logAttackBase: '{0} 攻擊 {1} 的基地', logAttackUnit: '{0} 攻擊 {1}',
      promptOrderDefeat: '同時被擊敗，選擇先處理哪張的「被擊敗時」效果', promptOrderTrig: '同時觸發，選擇先處理哪一個效果', promptDistHeal: '把最多 {0} 點治療分配給單位或基地', promptDistToken: '把 {0} 個{1}代幣分配給單位', logIndirect: '{0} 要承受 {1} 點間接傷害', promptIndirect: '分配 {0} 點間接傷害到 {1} 的單位和基地', promptDivide: '把 {0} 點傷害分配給目標', baseWord: '基地', logBaseDmg: '{0} 的基地受到 {1} 點傷害', logBaseHeal: '{0} 的基地回復 {1} 點', logUnitDmg: '{0} 受到 {1} 點傷害', logHeal: '{0} 回復 {1} 點',
      logShield: '{0} 的護盾擋下了傷害', logGiveShield: '{0} 獲得護盾', logGiveExp: '{0} 獲得 {1} 個經驗', logGiveToken: '{0} 獲得 {1} 代幣',
      logBuff: '{0} 本階段 {1}', logDefeat: '{0} 被擊敗', logToken: '{0} 創造了 {2} 個 {1}', logBounce: '{0} 回到手牌',
      logResourceTop: '{0} 把牌庫頂放進資源區', logDiscard: '{0} 棄掉 {1}', logManual: '【需處理】{0}：{1}', logEffectError: '效果處理出錯：{0}',
      logUnique: '{0} 是唯一卡，舊的那張被擊敗', logDeploy: '{0} 部署了領袖 {1}', logAbility: '使用 {0} 的能力', logSaboteur: '破壞：{0} 的護盾被移除',
      logWin: '🏆 {0} 獲勝！', logAttach: '{0} 裝備到 {1}', logSearch: '{0} 搜尋牌庫頂 {1} 張', logMill: '{0} 把牌庫頂 {1} 張放進棄牌堆', logRecover: '{0} 從棄牌堆取回 {1} 張', logTakeControl: '{0} 取得 {1} 的控制權', logLookHand: '{0} 看了對手的手牌', logForce: '原力與 {0} 同在', logCantPay: '費用不夠，{0} 放回牌庫底',
      logDisclose: '{0} 揭示了 {1}', logResourceThis: '{0} 放進資源區', logCapture: '{0} 俘虜了 {1}', logRescue: '{0} 被救出',
      logAi: '由奈：{0}',
    },
    en: {
      appName: 'Yuna Practice Table',
      yes: 'Yes', no: 'No', mine: 'Your', theirs: 'Enemy', baseOf: "{0}'s base", manualTag: 'manual',
      asp_Vigilance: 'Vigilance', asp_Command: 'Command', asp_Aggression: 'Aggression', asp_Cunning: 'Cunning', asp_Heroism: 'Heroism', asp_Villainy: 'Villainy',
      actPlay: 'Play {0} ({1})', actSmuggle: 'Smuggle {0} ({1})', actAttack: 'Attack with {0}', actAbility: "{0}'s action {1}",
      actLeaderAbility: 'Leader {0} action {1}', actDeploy: 'Deploy leader {0}', actInitiative: 'Take the initiative (pass for the rest of the phase)', actPass: 'Pass',
      abT6Mentor: '(+2/+2, may attack)',
      promptMulligan: 'Mulligan your opening hand?', promptResource2: 'Choose 2 cards to resource', promptResource1: 'Regroup: you may resource 1 card',
      promptDiscard: 'Discard {0} card(s)', promptExploit: 'Exploit: defeat up to {0} friendly units, 2 less each',
      promptAttach: 'Attach {0} to which unit?', promptAmbush: '{0} has Ambush: ready it and attack an enemy unit?', promptSupport: '{0} Support: choose a unit to attack (optional)',
      promptAttackTarget: 'What does {0} attack?', promptAttackWith: 'Attack with {0}?', promptAttacker: 'Choose a unit to attack with',
      promptLukeFront: 'Luke (leader): exhaust to heal 1 from {0}?', promptLukeBack: 'Luke: heal 2 from which?',
      optHealUnit: '{0} (heal {1})', optHealBase: 'Your base (heal {0})',
      promptGungi: 'Gungi survived damage: discard a card to ready him?', promptHuyang: 'Huyang: give an upgraded unit -4/-0 for this phase (optional)',
      promptDisclose: '{1}: disclose {0}?', promptGoFirst: 'Your call: do you want the initiative (go first)?', promptDiscloseCards: '{1}: disclose {0} — pick the cards to reveal (skip to not disclose)', logReveal: '{0} reveals: {1}', logManualNote: '{0}', revealedBy: '{0} revealed these cards', needMore: 'Still need: {0}', undo: 'Undo', undoHint: 'Go back to before your last action', undoMid: 'Cancel this action', okSeen: 'Got it', promptLatts: 'Latts Razzi: Shield or Experience?', optShield: 'Shield token', optExp: 'Experience token',
      promptDealPower: 'Choose an enemy ground unit to take {0} damage', promptLeiaVfd: 'Leia: deal 1 damage to {0} to heal 2 from your base?',
      promptResourceTop: 'Resource the top card of your deck?', promptCobb: 'Cobb Vanth: deal 2 to him to Shield {0}?',
      promptHealUnit: 'Heal {0} damage from a unit (optional)', promptQuiGon: 'Qui-Gon: defeat a unit that attacked your base this phase',
      promptHunter: 'Hunter: choice {0}', optShieldAUnit: 'Give a Shield to a unit', optAttackExhausted: 'Attack with a unit, even if exhausted (no bases)',
      promptShieldTarget: 'Shield which unit?', promptKelleran: 'Kelleran Beq: play a unit from the top 7 (3 less)',
      promptLuminara: 'Luminara: attack with a unit, +2/+0', promptTrask: 'Trask Walker: choose a unit in your discard costing 7 or less',
      promptTrask2: 'What to do with {0}?', optTraskBottom: 'Bottom of deck, heal 3 from base', optTraskHand: 'Return to hand',
      promptExpTarget: 'Give an Experience token to which friendly unit?', promptBlueLeader: 'Blue Leader: pay 2 to move to ground with 2 Experience?',
      promptT6: 'T-6: give it an Experience token?', promptBuffTarget: 'Choose a unit for {0}',
      promptOvergrowth1: 'Overgrowth: choose a friendly unit to deal damage', promptOvergrowth2: 'Choose an enemy unit to take {0} damage',
      promptDefeatNonLeader: 'Defeat a non-leader unit', promptDefeatVehicle: 'Defeat a non-leader Vehicle unit', promptCapture: 'Capture an enemy non-leader unit with less remaining HP',
      logStart: 'Game start. {0} has the initiative', logDraw: '{0} draws {1}', logEmptyDeck: "{0}'s deck is empty: 3 damage to base", logMulligan: '{0} mulligans',
      logResourced: '{0} resources {1} card(s)', logRound: '── Round {0} ──', logRegroup: '── Regroup ──', logPass: '{0} passes',
      logInitiative: '{0} takes the initiative', logPlay: '{0} plays {1} (paid {2})', logAttackBase: "{0} attacks {1}'s base", logAttackUnit: '{0} attacks {1}',
      promptOrderDefeat: 'Defeated at the same time: choose which When Defeated resolves first', promptOrderTrig: 'Simultaneous triggers: choose which resolves first', promptDistHeal: 'Distribute up to {0} healing among units or bases', promptDistToken: 'Distribute {0} {1} tokens among units', logIndirect: '{0} takes {1} indirect damage', promptIndirect: 'Assign {0} indirect damage among {1}\'s units and base', promptDivide: 'Divide {0} damage among targets', baseWord: 'base', logBaseDmg: "{0}'s base takes {1}", logBaseHeal: "{0}'s base heals {1}", logUnitDmg: '{0} takes {1} damage', logHeal: '{0} heals {1}',
      logShield: "{0}'s Shield prevents the damage", logGiveShield: '{0} gets a Shield', logGiveExp: '{0} gets {1} Experience', logGiveToken: '{0} gets a {1} token',
      logBuff: '{0} gets {1} this phase', logDefeat: '{0} is defeated', logToken: '{0} creates {2} {1} token(s)', logBounce: '{0} returns to hand',
      logResourceTop: '{0} resources the top card of their deck', logDiscard: '{0} discards {1}', logManual: '[Resolve] {0}: {1}', logEffectError: 'Effect error: {0}',
      logUnique: '{0} is unique; the older copy is defeated', logDeploy: '{0} deploys {1}', logAbility: "Uses {0}'s ability", logSaboteur: "Saboteur: {0}'s Shield removed",
      logWin: '🏆 {0} wins!', logAttach: '{0} attached to {1}', logSearch: '{0} searches the top {1}', logMill: '{0} discards the top {1} of their deck', logRecover: '{0} recovers {1} from the discard pile', logTakeControl: '{0} takes control of {1}', logLookHand: "{0} looks at the opponent's hand", logForce: 'The Force is with {0}', logCantPay: "Can't pay, {0} goes to the bottom",
      logDisclose: '{0} discloses {1}', logResourceThis: '{0} goes to resources', logCapture: '{0} captures {1}', logRescue: '{0} is rescued',
      logAi: 'Yuna: {0}',
    },
  };
  SWU.STR = S;
  SWU.lang = 'zh';
  try {
    SWU.lang = localStorage.getItem('swu.lang') || 'zh';
  } catch (e) {}
  SWU.setLang = (l) => {
    SWU.lang = l;
    try {
      localStorage.setItem('swu.lang', l);
    } catch (e) {}
  };
  const fmt = (s, a) => String(s).replace(/\{(\d+)\}/g, (_, i) => (a[i] != null ? a[i] : ''));
  // 朋友版（沒有主人模式）：對手叫「AI」，用簡潔中性的系統語氣
  SWU.friendMode = () => !(SWU.AI && SWU.AI.settings && SWU.AI.settings.owner);
  const FRIEND = {
    zh: { appName: 'SWU 練牌桌', gameOverLose: 'AI 獲勝', yunaSided: 'AI 已依你的牌組換入 {0} 張備牌。', yunaNoSide: 'AI 本局不換備牌。', friendHello: 'AI 對手已就緒。', friendWin: '對局結束：你獲勝。', friendLose: '對局結束：AI 獲勝。' },
    en: { appName: 'SWU Practice Table', gameOverLose: 'AI wins', yunaSided: 'AI sided in {0} cards against your deck.', yunaNoSide: 'AI keeps its deck for this game.', friendHello: 'AI opponent ready.', friendWin: 'Game over: you win.', friendLose: 'Game over: AI wins.' },
  };
  const raw = (k) => (S[SWU.lang] && S[SWU.lang][k]) || S.en[k] || S.zh[k] || k;
  SWU.t = (k, ...a) => {
    if (!SWU.friendMode()) return fmt(raw(k), a);
    const f = (FRIEND[SWU.lang] || FRIEND.en)[k];
    return fmt(f || raw(k), a)
      .replace(/由奈/g, 'AI')
      .replace(/Yuna's/g, "AI's")
      .replace(/Yuna/g, 'AI');
  };
  SWU.tl = (lang, k, ...a) => fmt((S[lang] && S[lang][k]) || S.en[k] || k, a);
  SWU.fmtLog = (l, lang = SWU.lang) => {
    const r = SWU.tl(lang, l.k, ...l.a);
    return SWU.friendMode && SWU.friendMode() ? r.replace(/由奈/g, 'AI').replace(/Yuna/g, 'AI') : r;
  };
  SWU.addStrings = (lang, obj) => Object.assign(S[lang], obj);

  // ---------- 卡片繁中翻譯（柏偉的路克牌組＋常見代幣） ----------
  // 鍵：卡名 | 副標；值：{ tx: 能力（一般／領袖面）, bt: 領袖單位面 }
  const ZH = {
    'Luke Skywalker | I Can Save Him': {
      tx: '當一個友方單位的攻擊結束時：你可以橫置這個領袖。若你這麼做，替那個單位回復 1 點傷害。',
      bt: '當一個友方單位的攻擊結束時：替那個單位或你的基地回復 2 點傷害。',
    },
    'Gungi | Fighting for Kashyyyk': { tx: '堅毅（這個單位身上每有 1 點傷害就 +1/+0。）\n當這個單位受到傷害並存活時：你可以棄 1 張手牌。若你這麼做，準備這個單位。' },
    'Gungi | Finding Himself': { tx: '（資料庫沒有收錄這張卡的能力文字，暫時當成白板單位。）' },
    'Huyang | Your Aptitude Falls Short': { tx: '攻擊時：你可以讓一個有升級卡的單位本階段 -4/-0。' },
    'Mina Bonteri | Stop This War': { tx: '回復 1（這個單位攻擊時，替你的基地回復 1 點傷害。）\n被擊敗時：你可以揭示 綠 綠 白（從手牌展示合計含有這些圖示的卡）。若你這麼做，抽 1 張牌。' },
    'Soaring Can-Cell': { tx: '突襲 1\n當你控制卡夏克（Kashyyyk）基地時，這個單位獲得伏擊。' },
    'Yord Fandar | Devoutly Disciplined': { tx: '當任一基地身上有 15 點以上傷害時，這個單位獲得哨兵。' },
    'Latts Razzi | Deadly Whipmaster': { tx: '打出時：給這個單位 1 個護盾代幣或經驗代幣。接著，她對一個敵方地面單位造成等同她攻擊力的傷害。' },
    'Leia Organa | Vigilant for Danger': { tx: '支援（打出這個單位時，你可以用另一個單位攻擊，那個單位在這次攻擊中獲得這個單位的其他能力。）\n攻擊時：你可以對這個單位造成 1 點傷害。若你這麼做，替你的基地回復 2 點傷害。' },
    'Lifetree Caravan': { tx: '打出時：若你控制 3 個以上單位（包含這個），你可以把牌庫頂的牌放進資源區。' },
    'Wookiee Protector': { tx: '哨兵（這個戰區的敵方單位攻擊你時，必須攻擊哨兵。）' },
    'Yanna | Sanctuary Elder': { tx: '堅毅（身上每有 1 點傷害就 +1/+0。）\n回復 1（攻擊時替你的基地回復 1 點傷害。）' },
    'Cobb Vanth | Let Me Handle This': { tx: '堅毅\n當你打出另一個單位時：你可以對這個單位造成 2 點傷害。若你這麼做，給那個單位 1 個護盾代幣。' },
    'Paz Vizsla | For a Brighter Future': { tx: '哨兵\n被擊敗時：若這個單位不是被戰鬥傷害擊敗，創造 2 個曼達洛人代幣。' },
    'Captain Typho | All Necessary Precautions': { tx: '哨兵\n當這個單位被攻擊時：你可以揭示 綠 白。若你這麼做，替你的基地回復 1 點傷害。' },
    'Ezra Bridger | Spectre Six': { tx: '突襲 1（攻擊時 +1/+0。）\n打出時：你可以替一個單位回復 2 點傷害。若你控制紅色或黃色單位，改為可以回復 4 點。' },
    "Qui-Gon Jinn | We'll Handle This": { tx: '堅毅\n打出時：你可以擊敗一個本階段攻擊過你基地的單位。若它是領袖單位，擊敗這個單位。' },
    'Wookiee Rangers': { tx: '當你控制另一個伍基人單位或卡夏克基地時，這個單位獲得哨兵。' },
    'Hunter | Everyone Get to Cover!': { tx: '打出時：選擇兩項（可重複選同一項）：\n・給一個單位 1 個護盾代幣。\n・用一個單位攻擊，即使它已橫置。這次攻擊不能攻擊基地。' },
    'Scorpenek Annihilator Droid': { tx: '哨兵\n護盾（打出時獲得 1 個護盾代幣。）\n壓制（攻擊敵方單位時，多餘的傷害打到對手基地。）' },
    'Kelleran Beq | The Sabered Hand': { tx: '打出時：搜尋你牌庫頂 7 張找一個單位，展示並打出它，它的費用少 3。（其餘的牌隨機放到牌庫底。）' },
    'Luminara Unduli | Besieged General': { tx: '當你打出一個單位時（包含這個）：你可以用一個單位攻擊，它在這次攻擊中 +2/+0。' },
    'Rey | Skywalker': { tx: '對手無法取得這個單位的控制權。\n這個單位不會被敵方的卡片能力擊敗。' },
    'Trask Walker': { tx: '打出時／攻擊時：選擇你棄牌堆中一個費用 7 以下的單位。把那張卡放到牌庫底並替你的基地回復 3 點傷害，或讓它回到手牌。' },
    'Bo-Katan Kryze | Alone': { tx: '打出時：讓每個敵方單位本階段 -3/-3。\n當一個敵方單位被擊敗時：給一個友方單位 1 個經驗代幣。' },
    'Blue Leader | Scarif Air Support': { tx: '伏擊（打出這個單位時，它可以攻擊一個敵方單位。）\n打出時：你可以支付 2 費。若你這麼做，把這個單位移到地面戰區並給它 2 個經驗代幣。（它變成地面單位。）' },
    'T-6 Shuttle 1974 | Stay Close': { tx: '當這個單位被攻擊時（造成傷害前）：你可以給這個單位 1 個經驗代幣。' },
    "T-6 Shuttle 1974 | With a Mentor's Dedication": { tx: '哨兵\n行動［橫置］：讓另一個單位本階段 +2/+2。你可以用那個單位攻擊。' },
    'Overgrowth': { tx: '若你控制卡夏克基地，一個友方單位對一個敵方單位造成等同其攻擊力的傷害。\n把這張卡放進資源區。' },
    'Lost and Forgotten': { tx: '擊敗一個非領袖單位。若你這麼做，替你的基地回復 3 點傷害。' },
    "Luke's Jedi Lightsaber | Constructed by Hand": { tx: '裝備在非載具單位上。\n若裝備的單位是路克・天行者，他獲得哨兵。' },
    'Direct Hit': { tx: '擊敗一個非領袖的載具單位。' },
    'Bestial Bond': { tx: '打出時：若裝備的單位是生物或原力單位，創造 1 個野獸代幣。' },
    'Moral Authority': { tx: '裝備在友方唯一單位上。\n打出時：裝備的單位俘虜一個剩餘血量比它低的敵方非領袖單位。' },
    'Origin Tree | Kashyyyk': { tx: '（基地，30 血，沒有額外能力。）' },
    'Shield': { tx: '如果裝備的單位將受到傷害，防止那些傷害，並擊敗這個護盾代幣。' },
    'Experience': { tx: '+1/+1' },
    'Advantage': { tx: '當裝備的單位攻擊或防禦結束時：擊敗這個升級。' },
  };
  SWU.ZH = ZH;
  SWU.cardText = function (card, side = 'card', lang = SWU.lang) {
    const leaderUnit = side === 'unit' && card.t === 'Leader';
    if (lang === 'zh') {
      const z = ZH[card.key];
      if (z) return (leaderUnit ? z.bt : z.tx) || '';
    }
    return (leaderUnit ? card.bt : card.tx) || '';
  };
  SWU.hasZh = (card) => !!ZH[card.key];
})();
