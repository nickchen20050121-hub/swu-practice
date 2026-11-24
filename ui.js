/* 介面：大廳、對戰桌、組牌器、設定 */
(function () {
  const SWU = window.SWU;
  const t = (...a) => SWU.t(...a);
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };

  SWU.addStrings('zh', {
    tabPlay: '對戰', tabBuild: '組牌器', tabSettings: '設定', tabHelp: '說明',
    lobbyTitle: '開一局練習', yourDeck: '你的牌組', yunaDeck: '由奈的牌組', start: '開始對戰', resume: '回到對局', newGame: '重新開局',
    needDecks: '先到組牌器建一副牌，或直接選一套 🏆 比賽牌組。', aiStatusOn: '由奈會用 Claude 思考（{0}）', aiStatusOff: '還沒設定 API 金鑰，由奈先用內建打法。到「設定」輸入金鑰就能變聰明。',
    round: '第 {0} 回合', phase_setup: '開局', phase_action: '行動階段', phase_regroup: '整備階段', initiative: '主動權', taken: '已拿',
    yourTurn: '輪到你', yunaTurn: '由奈思考中…', hand: '手牌', deck: '牌庫', discard: '棄牌', resources: '資源', ground: '地面', space: '太空',
    tapTwice: '點兩下卡牌直接打出／攻擊', setAutoSingle: '只有一個合法目標時', setAutoSingleOff: '一律讓我點（預設）', setAutoSingleOn: '自動幫我選', distLeft: '還剩 {0} 點', distHint: '點場上發亮的單位或基地，每點一下分配 1 點', distReset: '重新分配', takeInitTitle: '拿走先攻指示物？', takeInitBody: '拿先攻後你這一輪就不能再行動（等同 Pass），下一輪由你先手。', takeInitYes: '拿先攻', initToken: '先攻', initTokenTake: '點我搶先攻', effectFrom: '效果', passBig: 'Pass',
    confirm: '確定', skip: '略過', cancel: '取消', done: '完成', select: '選擇', log: '對戰紀錄', chat: '由奈',
    manualTitle: '需要手動處理的效果', manualHint: '這個效果還沒自動化。用下面的工具照卡片文字調整，或請由奈幫你判讀。', manualAsk: '請由奈幫我處理',
    toolTarget: '先點選目標（單位或基地）', toolDmg: '+1 傷害', toolHeal: '回復 1', toolShield: '護盾', toolExp: '經驗', toolDefeat: '擊敗', toolExhaust: '橫置', toolReady: '準備',
    toolBounce: '回手牌', toolBuffUp: '本階段 +1/+1', toolBuffDown: '本階段 -1/-1', toolDraw: '我抽 1 張', toolResTop: '牌庫頂放資源', toolToken: '創造代幣', toolForce: '原力',
    manualTools: '手動調整', gameOverWin: '你贏了！', gameOverLose: '由奈贏了～', again: '再來一局', viewLog: '看紀錄',
    // 組牌器
    myDecks: '我的牌組', newDeck: '新牌組', import: '匯入', presets: '內建牌組', importHint: '貼上 SWUDB 匯出的 JSON，或文字清單（每行「3 卡名 - 副標」，可用 Leader:/Base: 開頭標出領袖和基地）', doImport: '匯入',
    type_Leader: '領袖', type_Base: '基地', type_Unit: '單位', type_Event: '事件', type_Upgrade: '升級', mode_single: '單局', mode_bo3: '三戰兩勝（BO3）', bo3Hint: '照比賽規則：第一局隨機一方決定誰先手，之後由上一局輸的人決定；局間可以用備牌換牌（主牌至少 50 張、備牌最多 10 張）。由奈也會依你的牌型換備牌。', matchScore: '第 {0} 局後　{3} {1} : {2} 由奈', matchWin: '你贏下這場比賽！', matchLose: '這場比賽由奈贏了', nextGame: '換備牌，開始第 {0} 局', sideTitle: '第 {0} 局前換備牌', sideHint: '點按鈕在主牌和備牌之間移動。換好後主牌至少 50 張、備牌最多 10 張。', sideReset: '還原', sideConfirm: '確定，開始下一局', yunaSided: '嘿嘿，我針對你的牌換了 {0} 張備牌喔～', yunaNoSide: '這局我不換牌，用原本的牌組繼續～', addTo: '點卡片加到：', randomMeta: '🎲 隨機一套比賽得名牌組', randomMetaHint: '開打時隨機挑一套 🏆 比賽牌組（開局才知道是哪套，跟真正比賽一樣）', setName: '你的名字', setNamePh: '例如：小明', setNameHint: '由奈會用這個名字叫你（只存在這台裝置）', noOwnDecks: '你還沒有自己的牌組：可以先到「組牌器」組一副（或匯入 SWUDB 牌表），也可以直接選一套 🏆 比賽得名牌組來打。', sortBy: '排序', sort_number: '卡號', sort_cost: '費用', sort_name: '名稱', sort_aspect: '屬性', sort_type: '類型', sort_power: '戰力', sort_hp: '生命', sort_price: '價格', allSets: '全部系列', setsLabel: '系列（可多選）：', allArenas: '地面＋太空', arenaGround: '只看地面', arenaSpace: '只看太空', allTraits: '全部特性', allKw: '全部關鍵字', groupBy: '分組顯示', aspAll: '同時有選的屬性', aspAny: '有任一選的屬性', aspNone: '無屬性', showing: '顯示 {0} / {1}', clearFilters: '清除篩選', noAspect: '無屬性', search: '搜尋卡名或文字…', allTypes: '全部類型', legalOnly: '只看 Premier 合法', noPenalty: '只看不會被罰費', cost: '費用', any: '不限', results: '{0} 張',
    deckName: '牌組名稱', leader: '領袖', base: '基地', main: '主牌', side: '備牌', toSide: '移到備牌', toMain: '移到主牌', save: '儲存', saved: '已儲存', del: '刪除', confirmDel: '再按一次刪除',
    exportText: '匯出文字', exportJson: '匯出 SWUDB JSON', copied: '已複製', copyFail: '請手動複製下面的文字',
    autoBuild: '由奈幫我組', autoBuildQuick: '快速自動組（不用 AI）', wishes: '想要的風格（可不填，例如：偏快攻、多放哨兵）', building: '由奈組牌中…',
    analysis: '分析', prob: '起手機率', review: '由奈評語', askReview: '請由奈評估這副牌', reviewing: '由奈閱讀中…',
    score: '結構分數', curve: '費用曲線', types: '類型', arenas: '戰區', penalty: '會被罰費的卡', keywords: '關鍵字', automation: '自動化狀態', autoLearn: '請由奈讀懂這些卡（Claude）', autoLearning: '由奈正在讀卡片效果… {0}/{1}', autoNeedKey: '到「設定」輸入 Claude API 金鑰後，由奈就能把這些卡也變成自動處理（每張只需讀一次）。', autoLearned: '由奈讀懂了 {0} 張卡的效果！', autoStats: '自動處理 {0} 張／待讀懂 {1} 張', autoOk: '全部卡片效果都已自動化', autoMissing: '這些卡的文字效果會跳出手動處理：',
    avgCost: '平均費用', interaction: '解場／互動卡', probTarget: '目標', probAtLeast: '至少抽到', probMull: '起手沒抽到就重抽', probRound: '回合', probSeen: '看過張數', probP: '機率',
    probCard: '指定卡', probCat: '類別', cat2: '2 費以下單位', cat3: '3 費以下單位', catSentinel: '有哨兵的卡', catRemoval: '解場卡', probCore: '每張牌在第 1／3／5 回合前抽到的機率',
    scSize: '張數', scCurve: '前期卡比例', scAvg: '平均費用', scPenalty: '顏色罰費', scConsistency: '穩定度（3 張的比例）', scInteraction: '互動手段', scUnits: '單位比例',
    scNote: '只看牌組結構，不代表實戰勝率。', errNoLeader: '還沒選領袖', errNoBase: '還沒選基地', errTooFew: '主牌只有 {0} 張（至少 50）', errTooMany: '{0} 超過 3 張', errSide: '備牌 {0} 張（最多 10）',
    errJson: 'JSON 格式有誤', warnUnknown: '找不到：{0}', presetPQ: '藍綠路克（台北 PQ 版 52 張）', presetA2: '藍綠路克（A2 調整版 50 張）', autoDeckName: '自動組牌',
    pickLeaderBase: '先選好領袖和基地', addHint: '點卡片加入牌組；右鍵或長按移除', clickToSet: '點卡片設為{0}',
    // 設定
    setLang: '語言', setKey: 'Claude API 金鑰', setKeyHint: '金鑰只會存在這台電腦的瀏覽器裡。到 console.anthropic.com 建立。', setTest: '測試連線', testing: '測試中…', testOk: '連線成功', testFail: '連線失敗：{0}',
    setModel: '模型', setEffort: '思考深度', effLow: '快（low）', effMed: '中（medium）', effHigh: '深（high）', setMode: '哪些決定交給 Claude', modeMain: '主要行動與效果判讀（較快、較省）', modeAll: '每個決定（較聰明、較慢、較貴）',
    setDelay: '由奈出牌間隔（毫秒）', setImages: '顯示官方卡圖（需要網路）', setData: '資料備份', exportAll: '匯出全部牌組', importAll: '匯入備份', backupHint: '把這段文字存起來，換電腦時貼回來即可。',
    logAiSkip: '由奈略過了 {0} 的效果（沒有 API 金鑰）', aiError: '由奈連不上 Claude，先用內建打法：{0}',
    helpBody:
      '<h3>怎麼玩</h3><ol><li>到「組牌器」建立或匯入牌組（也內建 9 套 🏆 比賽得名牌組可以直接用）。</li><li>回到「對戰」選雙方牌組，按開始。</li><li>輪到你時，點手牌打出、點自己的單位攻擊，或用下方按鈕。需要選目標時，可選的東西會亮起來。</li><li>卡片效果還沒自動化時會跳出「手動處理」視窗，用工具調整，或請由奈判讀。</li></ol><h3>規則自動化</h3><p>回合流程、資源與罰費、攻擊與哨兵、突襲、回復、壓制、破壞、堅毅、伏擊、護盾、隱匿、支援、剝削、走私、唯一性都會自動處理；你的路克牌組所有卡片效果都已寫好。其他卡的文字效果會用手動處理或由奈判讀。</p><h3>由奈的 AI</h3><p>在「設定」輸入 Claude API 金鑰後，由奈會用 Claude 決定行動並說話；沒有金鑰時用內建打法。</p>',
  });
  SWU.addStrings('en', {
    tabPlay: 'Play', tabBuild: 'Deck builder', tabSettings: 'Settings', tabHelp: 'Help',
    lobbyTitle: 'Start a practice game', yourDeck: 'Your deck', yunaDeck: "Yuna's deck", start: 'Start game', resume: 'Back to game', newGame: 'New game',
    needDecks: 'Build a deck in the deck builder first, or pick a built-in 🏆 tournament deck.', aiStatusOn: 'Yuna thinks with Claude ({0})', aiStatusOff: 'No API key yet, so Yuna uses the built-in strategy. Add a key in Settings.',
    tapTwice: 'Double-click a card to play / attack', setAutoSingle: 'When there is only one legal target', setAutoSingleOff: 'Always let me click (default)', setAutoSingleOn: 'Choose it automatically', distLeft: '{0} left', distHint: 'Click a highlighted unit or base to assign 1 point each', distReset: 'Reset', takeInitTitle: 'Take the initiative?', takeInitBody: 'Taking the initiative ends your actions this round (like passing). You go first next round.', takeInitYes: 'Take initiative', initToken: 'Initiative', initTokenTake: 'Click to claim', effectFrom: 'Effect', passBig: 'Pass',
    round: 'Round {0}', phase_setup: 'Setup', phase_action: 'Action phase', phase_regroup: 'Regroup', initiative: 'Initiative', taken: 'taken',
    yourTurn: 'Your turn', yunaTurn: 'Yuna is thinking…', hand: 'Hand', deck: 'Deck', discard: 'Discard', resources: 'Resources', ground: 'Ground', space: 'Space',
    confirm: 'Confirm', skip: 'Skip', cancel: 'Cancel', done: 'Done', select: 'Select', log: 'Game log', chat: 'Yuna',
    manualTitle: 'Resolve this effect', manualHint: 'This effect is not automated yet. Use the tools to apply the card text, or ask Yuna to resolve it.', manualAsk: 'Ask Yuna to resolve it',
    toolTarget: 'Pick a target first (unit or base)', toolDmg: '+1 damage', toolHeal: 'Heal 1', toolShield: 'Shield', toolExp: 'Experience', toolDefeat: 'Defeat', toolExhaust: 'Exhaust', toolReady: 'Ready',
    toolBounce: 'Return to hand', toolBuffUp: '+1/+1 this phase', toolBuffDown: '-1/-1 this phase', toolDraw: 'I draw 1', toolResTop: 'Resource top card', toolToken: 'Create token', toolForce: 'Force',
    manualTools: 'Manual tools', gameOverWin: 'You win!', gameOverLose: 'Yuna wins!', again: 'Play again', viewLog: 'View log',
    myDecks: 'My decks', newDeck: 'New deck', import: 'Import', presets: 'Built-in decks', importHint: 'Paste SWUDB JSON or a text list ("3 Name - Subtitle" per line, Leader:/Base: lines for leader and base)', doImport: 'Import',
    type_Leader: 'Leader', type_Base: 'Base', type_Unit: 'Unit', type_Event: 'Event', type_Upgrade: 'Upgrade', mode_single: 'Single game', mode_bo3: 'Best of three', bo3Hint: 'Tournament style: in game 1 a random player chooses who goes first, afterwards the previous loser chooses; between games you may side in cards (main at least 50, sideboard at most 10). Yuna sides against your deck too.', matchScore: 'After game {0}: {3} {1} : {2} Yuna', matchWin: 'You won the match!', matchLose: 'Yuna won the match', nextGame: 'Sideboard and start game {0}', sideTitle: 'Sideboarding before game {0}', sideHint: 'Move cards between main deck and sideboard. Main deck at least 50, sideboard at most 10.', sideReset: 'Reset', sideConfirm: 'Confirm and start next game', yunaSided: 'Hehe, I sided in {0} cards against you~', yunaNoSide: "I'm keeping my deck as is~", addTo: 'Click adds to:', randomMeta: '🎲 Random tournament deck', randomMetaHint: 'A random 🏆 tournament deck is picked when the game starts, like a real event.', setName: 'Your name', setNamePh: 'e.g. Alex', setNameHint: 'Yuna calls you by this name (stored on this device only)', noOwnDecks: 'You have no decks yet: build one in the Deck builder (or import from SWUDB), or just pick a 🏆 tournament deck.', sortBy: 'Sort', sort_number: 'Set #', sort_cost: 'Cost', sort_name: 'Name', sort_aspect: 'Aspect', sort_type: 'Type', sort_power: 'Power', sort_hp: 'HP', sort_price: 'Price', allSets: 'All sets', setsLabel: 'Sets (multi):', allArenas: 'Ground + Space', arenaGround: 'Ground only', arenaSpace: 'Space only', allTraits: 'All traits', allKw: 'All keywords', groupBy: 'Group', aspAll: 'Has all selected', aspAny: 'Has any selected', aspNone: 'No aspect', showing: 'Showing {0} / {1}', clearFilters: 'Clear filters', noAspect: 'Colorless', search: 'Search names or text…', allTypes: 'All types', legalOnly: 'Premier legal only', noPenalty: 'No aspect penalty', cost: 'Cost', any: 'Any', results: '{0} cards',
    deckName: 'Deck name', leader: 'Leader', base: 'Base', main: 'Main deck', side: 'Sideboard', toSide: 'To sideboard', toMain: 'To main', save: 'Save', saved: 'Saved', del: 'Delete', confirmDel: 'Click again to delete',
    exportText: 'Export text', exportJson: 'Export SWUDB JSON', copied: 'Copied', copyFail: 'Copy the text below',
    autoBuild: 'Yuna, build it for me', autoBuildQuick: 'Quick auto-build (no AI)', wishes: 'Style wishes (optional, e.g. aggressive, lots of Sentinels)', building: 'Yuna is building…',
    analysis: 'Analysis', prob: 'Draw odds', review: "Yuna's review", askReview: 'Ask Yuna to review this deck', reviewing: 'Yuna is reading…',
    score: 'Structure score', curve: 'Cost curve', types: 'Types', arenas: 'Arenas', penalty: 'Cards with aspect penalty', keywords: 'Keywords', automation: 'Automation', autoLearn: 'Let Yuna learn these cards (Claude)', autoLearning: 'Yuna is reading card effects… {0}/{1}', autoNeedKey: 'Add a Claude API key in Settings and Yuna can automate these cards too (each card is read once).', autoLearned: 'Yuna learned {0} cards!', autoStats: '{0} automated / {1} to learn', autoOk: 'Every card effect is automated', autoMissing: 'These cards will ask for manual resolution:',
    avgCost: 'Average cost', interaction: 'Removal / interaction', probTarget: 'Target', probAtLeast: 'At least', probMull: 'Mulligan if missing', probRound: 'Round', probSeen: 'Cards seen', probP: 'Chance',
    probCard: 'Card', probCat: 'Category', cat2: 'Units costing 2 or less', cat3: 'Units costing 3 or less', catSentinel: 'Cards with Sentinel', catRemoval: 'Removal',
    probCore: 'Chance to see each card by rounds 1 / 3 / 5',
    scSize: 'Size', scCurve: 'Early cards', scAvg: 'Average cost', scPenalty: 'Aspect penalty', scConsistency: 'Consistency (3-ofs)', scInteraction: 'Interaction', scUnits: 'Unit ratio',
    scNote: 'Structure only; not a win-rate prediction.', errNoLeader: 'No leader', errNoBase: 'No base', errTooFew: 'Main deck has {0} cards (50 minimum)', errTooMany: '{0} has more than 3 copies', errSide: 'Sideboard has {0} (10 max)',
    errJson: 'Invalid JSON', warnUnknown: 'Not found: {0}', presetPQ: 'Blue-Green Luke (Taipei PQ, 52)', presetA2: 'Blue-Green Luke (A2 tune, 50)', autoDeckName: 'Auto-build',
    pickLeaderBase: 'Choose a leader and a base first', addHint: 'Click a card to add it; right-click or long-press to remove', clickToSet: 'Click to set as {0}',
    setLang: 'Language', setKey: 'Claude API key', setKeyHint: 'The key stays in this browser only. Create one at console.anthropic.com.', setTest: 'Test connection', testing: 'Testing…', testOk: 'Connected', testFail: 'Failed: {0}',
    setModel: 'Model', setEffort: 'Thinking effort', effLow: 'Fast (low)', effMed: 'Medium', effHigh: 'Deep (high)', setMode: 'Decisions made by Claude', modeMain: 'Main actions and effect reading (faster, cheaper)', modeAll: 'Every decision (smarter, slower, costlier)',
    setDelay: "Delay between Yuna's moves (ms)", setImages: 'Show official card images (needs internet)', setData: 'Backup', exportAll: 'Export all decks', importAll: 'Import backup', backupHint: 'Save this text; paste it back on another computer.',
    logAiSkip: "Yuna skipped {0}'s effect (no API key)", aiError: "Yuna couldn't reach Claude, using the built-in strategy: {0}",
    helpBody:
      '<h3>How to play</h3><ol><li>Build or import a deck in the deck builder (9 🏆 tournament decks are built in).</li><li>On Play, pick both decks and start.</li><li>On your turn, click a hand card to play it, click your unit to attack, or use the buttons below. Valid choices light up.</li><li>Effects that are not automated open a manual window: use the tools, or ask Yuna.</li></ol><h3>Automation</h3><p>Round flow, resources and penalties, attacks and Sentinel, Raid, Restore, Overwhelm, Saboteur, Grit, Ambush, Shields, Hidden, Support, Exploit, Smuggle and uniqueness are automatic, and every card in your Luke deck is scripted. Other card text uses manual tools or Yuna.</p><h3>Yuna\'s AI</h3><p>Add a Claude API key in Settings and Yuna decides and talks with Claude; without a key she uses a built-in strategy.</p>',
  });

  // ---------- 狀態 ----------
  const S = {
    tab: 'play',
    game: null,
    pending: null,
    chat: [],
    thinking: false,
    preview: null,
    decks: [],
    edit: null,
    filters: { q: '', type: '', aspects: [], cost: '', legal: true, nopen: false, page: 0, sets: [], sort: 'number', dir: 1, arena: '', trait: '', kw: '', group: true, aspMode: 'all' },
    deckTab: 'analysis',
    review: '',
    lobby: { mine: null, yuna: null, mode: 'single' },
    match: null,
    toolTarget: null,
  };
  SWU.UI = S;
  function allDecks() {
    return [...S.decks, ...SWU.Deck.presets()];
  }
  function deckById(id) {
    return allDecks().find((d) => d.id === id) || null;
  }

  // ---------- 卡片顯示 ----------
  function imgUrl(card, side) {
    if (!SWU.AI.settings.images) return null;
    return side === 'unit' && card.bimg ? card.bimg : card.img;
  }
  const ASP_CLASS = { Vigilance: 'vig', Command: 'cmd', Aggression: 'agg', Cunning: 'cun', Heroism: 'her', Villainy: 'vil' };
  function aspectDots(card) {
    return h('span', { class: 'asp' }, ...(card.a || []).map((a) => h('i', { class: 'dot ' + ASP_CLASS[a], title: t('asp_' + a) })));
  }
  function textFrame(card, side, stats) {
    const isUnitSide = side === 'unit';
    const p = stats ? stats.p : card.p;
    const hp = stats ? stats.h : card.h;
    return h(
      'div',
      { class: 'frame ' + (card.a && card.a[0] ? ASP_CLASS[card.a[0]] : 'neutral') },
      h('div', { class: 'fr-top' }, card.c != null && card.t !== 'Base' ? h('b', { class: 'fr-cost' }, isUnitSide ? '' : card.c) : null, aspectDots(card)),
      h('div', { class: 'fr-name' }, card.n),
      card.s ? h('div', { class: 'fr-sub' }, card.s) : null,
      h('div', { class: 'fr-text' }, SWU.cardText(card, side).slice(0, 160)),
      p != null || hp != null ? h('div', { class: 'fr-stats' }, h('span', { class: 'pw' }, p != null ? p : ''), h('span', { class: 'hpv' }, hp != null ? hp : '')) : null
    );
  }
  function cardFace(card, side = 'card', opts = {}) {
    const url = imgUrl(card, side);
    const wrap = h('div', { class: 'face' + (card.t === 'Leader' || card.t === 'Base' ? ' wide' : '') + (opts.small ? ' small' : '') });
    if (url) {
      const img = h('img', { src: url, alt: card.key, loading: 'lazy', draggable: 'false' });
      img.addEventListener('error', () => {
        img.replaceWith(textFrame(card, side, opts.stats));
      });
      wrap.append(img);
    } else wrap.append(textFrame(card, side, opts.stats));
    return wrap;
  }
  // 點兩下判定（電腦 dblclick／手機連點兩下都適用）
  let lastTap = { id: null, t: 0 };
  let peekTimer = null;
  function tapTwice(id) {
    const now = Date.now();
    const two = lastTap.id === id && now - lastTap.t < 450;
    lastTap = two ? { id: null, t: 0 } : { id, t: now };
    return two;
  }
  const primaryAct = (acts) => acts.find((a) => a.type === 'attack') || acts.find((a) => a.type === 'play' && !a.from) || acts.find((a) => a.type === 'play') || acts.find((a) => a.type === 'deploy') || acts[0];
  function doPrimary(acts) {
    if (!acts.length) return false;
    clearTimeout(peekTimer);
    hidePeek();
    const a = primaryAct(acts);
    const same = acts.filter((x) => x.type === a.type);
    if (a.type === 'play' && acts.filter((x) => x.type === 'play').length > 1) openMenu(acts.filter((x) => x.type === 'play'));
    else if (same.length > 1 && a.type !== 'attack') openMenu(same);
    else settle(a);
    return true;
  }
  window.__swuGame = () => S.game; // 測試用
  const isTouch = () => window.matchMedia && matchMedia('(max-width:720px), (pointer:coarse)').matches;
  function setPreview(card, side, acts) {
    S.preview = { card, side };
    renderPreview();
    if (isTouch() && S.tab === 'play' && S.game) {
      // 稍等一下再跳說明，讓「連點兩下」的第二下能點到卡片本身
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => showPeek(card, side, acts || []), 330);
    }
  }
  // 手機：點卡片時從下方滑出的小卡片說明（可直接按按鈕打出）
  function showPeek(card, side, acts) {
    let el = $('#peek');
    if (!el) {
      el = h('div', { id: 'peek', class: 'peek', role: 'dialog' });
      document.body.append(el);
    }
    el.innerHTML = '';
    const meta = [card.t, card.c != null ? t('cost') + ' ' + card.c : '', card.p != null ? card.p + '/' + card.h : card.h ? card.h + ' HP' : '', (card.tr || []).join(' · ')].filter(Boolean).join(' · ');
    el.append(
      h('div', { class: 'peek-face' }, cardFace(card, side, { small: true })),
      h(
        'div',
        { class: 'peek-body' },
        h('div', { class: 'peek-head' }, h('b', {}, card.n), h('button', { class: 'ghost small peek-x', 'aria-label': 'close', onclick: hidePeek }, '✕')),
        card.s ? h('small', { class: 'muted' }, card.s) : null,
        h('div', { class: 'pv-meta' }, meta),
        h('div', { class: 'pv-text' }, SWU.cardText(card, side) || (SWU.lang === 'zh' ? '（沒有能力文字）' : '(no ability text)')),
        acts.length ? h('div', { class: 'peek-acts' }, ...acts.map((a) => h('button', { class: 'primary', onclick: () => (hidePeek(), settle(a)) }, a.label))) : null
      )
    );
    el.hidden = false;
    clearTimeout(S.peekTimer);
    if (!acts.length) S.peekTimer = setTimeout(hidePeek, 7000);
  }
  function hidePeek() {
    clearTimeout(peekTimer);
    const el = $('#peek');
    if (el) el.hidden = true;
  }
  function renderPreview() {
    const box = $('#preview');
    if (!box) return;
    box.innerHTML = '';
    if (!S.preview) {
      box.append(h('p', { class: 'muted' }, SWU.lang === 'zh' ? '把滑鼠移到卡片上看詳細內容' : 'Hover a card to see details'));
      return;
    }
    const { card, side } = S.preview;
    const kids = [
      cardFace(card, side),
      h('div', { class: 'pv-name' }, card.n, card.s ? h('small', {}, card.s) : null),
      h('div', { class: 'pv-meta' }, [card.t, card.c != null ? t('cost') + ' ' + card.c : '', card.p != null ? card.p + '/' + card.h : card.h ? card.h + ' HP' : '', card.ar || '', (card.tr || []).join(' · ')].filter(Boolean).join('  ·  ')),
      card.t === 'Leader' ? h('div', { class: 'pv-text' }, h('b', {}, side === 'unit' ? (SWU.lang === 'zh' ? '領袖面' : 'Leader side') : SWU.lang === 'zh' ? '部署後' : 'Unit side'), ' ', SWU.cardText(card, side === 'unit' ? 'card' : 'unit')) : null,
      h('div', { class: 'pv-text' }, SWU.cardText(card, side)),
      card.ep ? h('div', { class: 'pv-text muted' }, card.ep) : null,
      SWU.lang === 'zh' && !SWU.hasZh(card) && (card.tx || card.bt) ? h('div', { class: 'pv-note muted' }, '（這張卡還沒有中文翻譯，顯示英文原文）') : null,
    ];
    box.append(...kids.filter(Boolean));
  }

  // ---------- 人類玩家 IO ----------
  const humanIO = {
    isHuman: true,
    get autoSingle() {
      return !!SWU.AI.settings.autoSingle;
    },
    chooseAction(g, p, acts) {
      return new Promise((resolve) => {
        S.pending = { type: 'action', acts, resolve };
        renderBoard();
      });
    },
    choose(g, p, req) {
      return new Promise((resolve) => {
        S.pending = { type: 'choose', req, sel: [], resolve };
        renderBoard();
        if (req.kind === 'cards') openCardsModal();
        else if (!req.options.some((o) => o.uid != null) && (req.max || 1) === 1) openEffectModal();
      });
    },
    distribute(g, p, req) {
      return new Promise((resolve) => {
        S.pending = { type: 'distribute', req: { ...req, options: req.targets }, alloc: {}, resolve };
        closeModal();
        renderBoard();
      });
    },
    showCards(g, p, cards, prompt) {
      return new Promise((resolve) => {
        S.pending = { type: 'show', cards, prompt, resolve };
        renderBoard();
        openShowModal();
      });
    },
    resolveManual(g, p, info) {
      return new Promise((resolve) => {
        S.pending = { type: 'manual', info, resolve, prev: S.pending };
        S.toolTarget = null;
        renderBoard();
        openManualModal();
      });
    },
  };
  function settle(val) {
    const pd = S.pending;
    if (!pd) return;
    S.pending = null;
    S.selUid = null;
    closeModal();
    hidePeek();
    pd.resolve(val);
  }

  // ---------- 讓 Claude 讀懂卡片效果 ----------
  function deckCardsFor(d) {
    return [SWU.Deck.card(d.leader), SWU.Deck.card(d.base), ...Object.keys(d.main || {}).map((k) => SWU.Deck.card(k))].filter(Boolean);
  }
  async function learnCards(cards) {
    const need = SWU.GFX.needsClaude(cards);
    if (!need.length || !SWU.AI.hasClaude()) return 0;
    const m = $('#modal');
    const show = (i, n) => {
      m.hidden = false;
      m.innerHTML = '';
      m.append(h('div', { class: 'dialog small' }, h('p', {}, t('autoLearning', i, n)), h('div', { class: 'lbar' }, h('i', { style: 'width:' + Math.round((100 * i) / Math.max(1, n)) + '%' }))));
    };
    show(0, need.length);
    let n = 0;
    try {
      n = await SWU.GFX.compileWithClaude(need, show);
    } finally {
      closeModal();
    }
    toast(t('autoLearned', n));
    return n;
  }
  function toast(text) {
    const el = h('div', { class: 'toast' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---------- 開局 ----------
  async function startGame(next) {
    let mine, yuna;
    const gopts = { askInitiative: true };
    if (next === true && S.match) {
      mine = S.match.mine;
      yuna = S.match.yuna;
      gopts.initiativeChooser = S.match.lastLoser;
      S.match.game++;
    } else {
      mine = deckById(S.lobby.mine);
      if (S.lobby.yuna === 'random-meta') {
        const ms = allDecks().filter((d) => d.meta);
        yuna = ms[Math.floor(Math.random() * ms.length)];
      } else yuna = deckById(S.lobby.yuna);
      if (!mine || !yuna) return;
      S.match = S.lobby.mode === 'bo3' ? { mine: JSON.parse(JSON.stringify(mine)), yuna: SWU.Deck.ensureSide(JSON.parse(JSON.stringify(yuna))), wins: [0, 0], game: 1, seen: [], lastLoser: null } : null;
    }
    if (SWU.AI.hasClaude()) await learnCards([...deckCardsFor(mine), ...deckCardsFor(yuna)]);
    const mk = (d, name) => ({ name, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
    const aiPlayer = SWU.AI.makePlayer({
      say: (text) => {
        S.chat.push({ who: 'yuna', text });
        renderChat();
      },
      thinking: (v) => {
        S.thinking = v;
        renderStatus();
      },
      error: (e) => {
        S.chat.push({ who: 'sys', text: t('aiError', String(e.message || e).slice(0, 120)) });
        renderChat();
      },
    });
    S.chat = [{ who: 'yuna', text: SWU.lang === 'zh' ? '嘿嘿，請多指教～我會認真打的喔 (｡･ω･｡)' : "Hehe, let's have a good game~ I'll do my best!" }];
    const g = new SWU.Game([mk(mine, SWU.playerName()), mk(yuna, SWU.lang === 'zh' ? '由奈' : 'Yuna')], [humanIO, aiPlayer], gopts);
    attachGame(g);
  }
  // ---------- 回上一步：用同一個亂數種子重播到上一個檢查點 ----------
  function undoTarget() {
    const g = S.game;
    if (!g || !S.pending || g.G.winner != null || !g.checkpoints) return null;
    const cps = g.checkpoints;
    if (!cps.length) return null;
    const last = cps[cps.length - 1];
    if (S.pending.type === 'action' && last === g.rec.length) return cps.length >= 2 ? { to: cps[cps.length - 2], mid: false } : null;
    return { to: last, mid: true };
  }
  function doUndo() {
    const u = undoTarget();
    if (!u) return;
    const old = S.game;
    old.listeners.clear();
    S.pending = null;
    S.selUid = null;
    closeModal();
    hidePeek();
    const g = new SWU.Game(old.decks, old.io, { ...old.opts, seed: old.seed, uid0: old.uid0, replay: old.rec.slice(0, u.to) });
    attachGame(g);
    toast(t('undo') + ' ✓');
  }
  function showRevealPop(ev) {
    const old = document.querySelector('.revealpop');
    if (old) old.remove();
    const el = h(
      'div',
      { class: 'revealpop' },
      h('b', {}, t('revealedBy', S.game.P(ev.p).name)),
      h('div', { class: 'revealcards' }, ...ev.cards.map((c) => h('div', { class: 'pick', onmouseenter: () => setPreview(c, 'card'), onclick: () => showPeek && showPeek(c, 'card') }, cardFace(c, 'card'), h('small', {}, c.n)))),
      h('button', { class: 'primary', onclick: () => el.remove() }, t('okSeen'))
    );
    document.body.append(el);
  }
  function attachGame(g) {
    S.game = g;
    S.pending = null;
    g.on((ev) => {
      if (g.replaying && ev.type !== 'gameover') return;
      if (ev.type === 'replay-done') {
        renderLog();
        renderBoard();
      } else if (ev.type === 'reveal') {
        if (ev.p !== 0) showRevealPop(ev);
        renderBoard();
      } else if (ev.type === 'log') renderLog();
      else if (ev.type === 'gameover') {
        S.pending = null;
        renderBoard();
        const win = g.G.winner === 0;
        if (S.match && g.G.winner != null && !g._counted) {
          g._counted = true;
          S.match.wins[g.G.winner]++;
          S.match.lastLoser = 1 - g.G.winner;
          // 由奈記住這局看到你用了哪些牌（之後換備牌用）
          const P0 = g.P(0);
          for (const x of [...P0.discard, ...P0.units, ...P0.units.flatMap((u) => u.upgrades || [])]) if (x && x.card && x.owner === 0 && !/Token/.test(x.card.t)) S.match.seen.push(x.card);
          renderBoard();
        }
        S.chat.push({ who: 'yuna', text: SWU.lang === 'zh' ? (win ? '唔…輸給你了，你好厲害！再來一局嘛 (≧▽≦)' : '嘿嘿，這局是我贏了～要再練一次嗎？') : win ? 'Aww, you win! Great game!' : 'Hehe, I win this one~ Again?' });
        renderChat();
      } else renderBoard();
    });
    render();
    g.run();
  }

  // ---------- 渲染：外框 ----------
  function render() {
    const app = $('#app');
    app.innerHTML = '';
    app.append(
      h(
        'header',
        { class: 'top' },
        h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', {}, t('appName'))),
        h(
          'nav',
          { class: 'tabs' },
          ...['play', 'build', 'settings', 'help'].map((k) =>
            h(
              'button',
              {
                class: 'tab' + (S.tab === k ? ' on' : ''),
                onclick: () => {
                  S.tab = k;
                  render();
                },
              },
              t('tab' + k[0].toUpperCase() + k.slice(1))
            )
          )
        ),
        h(
          'button',
          {
            class: 'lang',
            onclick: () => {
              SWU.setLang(SWU.lang === 'zh' ? 'en' : 'zh');
              document.documentElement.lang = SWU.lang === 'zh' ? 'zh-Hant' : 'en';
              render();
            },
            title: 'Language',
          },
          SWU.lang === 'zh' ? 'EN' : '中文'
        )
      ),
      h('main', { id: 'view' })
    );
    const v = $('#view');
    if (S.tab === 'play') S.game ? renderGameShell(v) : renderLobby(v);
    else if (S.tab === 'build') renderBuilder(v);
    else if (S.tab === 'settings') renderSettings(v);
    else v.append(h('section', { class: 'panel help', html: t('helpBody') }));
  }

  // ---------- 大廳 ----------
  function renderLobby(v) {
    const decks = allDecks();
    if (!S.lobby.mine || !deckById(S.lobby.mine)) S.lobby.mine = decks[0] && decks[0].id;
    if (!S.lobby.yuna || (S.lobby.yuna !== 'random-meta' && !deckById(S.lobby.yuna))) S.lobby.yuna = decks.some((d) => d.meta) ? 'random-meta' : (decks[1] || decks[0] || {}).id;
    const sel = (key) =>
      h(
        'select',
        {
          id: 'lobby-' + key,
          onchange: (e) => {
            S.lobby[key] = e.target.value;
            render();
          },
        },
        key === 'yuna' ? h('option', { value: 'random-meta', selected: S.lobby[key] === 'random-meta' }, t('randomMeta')) : null,
        ...decks.map((d) => h('option', { value: d.id, selected: d.id === S.lobby[key] }, d.name + (SWU.Deck.validate(d).length ? ' ⚠' : '')))
      );
    const deckCard = (id) => {
      if (id === 'random-meta') return h('div', { class: 'muted small' }, t('randomMetaHint'));
      const d = deckById(id);
      if (!d) return h('div', { class: 'muted' }, t('needDecks'));
      const L = SWU.Deck.card(d.leader);
      const B = SWU.Deck.card(d.base);
      return h('div', { class: 'lobby-deck' }, L ? cardFace(L, 'card', { small: true }) : null, B ? cardFace(B, 'card', { small: true }) : null, h('div', { class: 'muted small' }, SWU.Deck.count(d) + ' / ' + (SWU.Deck.validate(d).join('、') || 'OK')));
    };
    v.append(
      h(
        'section',
        { class: 'panel lobby' },
        h('h2', {}, t('lobbyTitle')),
        !S.decks.length ? h('p', { class: 'muted small' }, t('noOwnDecks')) : null,
        h('div', { class: 'lobby-grid' }, h('div', {}, h('label', { for: 'lobby-mine' }, t('yourDeck')), sel('mine'), deckCard(S.lobby.mine)), h('div', { class: 'vs' }, 'VS'), h('div', {}, h('label', { for: 'lobby-yuna' }, t('yunaDeck')), sel('yuna'), deckCard(S.lobby.yuna))),
        h(
          'div',
          { class: 'modesel' },
          ...['single', 'bo3'].map((md) => h('button', { class: S.lobby.mode === md ? 'on' : 'ghost', onclick: () => ((S.lobby.mode = md), render()) }, t('mode_' + md)))
        ),
        S.lobby.mode === 'bo3' ? h('p', { class: 'muted small' }, t('bo3Hint')) : null,
        h('p', { class: 'ai-status ' + (SWU.AI.hasClaude() ? 'on' : 'off') }, SWU.AI.hasClaude() ? t('aiStatusOn', SWU.AI.settings.model) : t('aiStatusOff')),
        h('button', { class: 'primary big', onclick: () => startGame(), disabled: !deckById(S.lobby.mine) || !(S.lobby.yuna === 'random-meta' || deckById(S.lobby.yuna)) }, t('start'))
      )
    );
  }

  // ---------- 對戰桌 ----------
  function renderGameShell(v) {
    v.append(
      h(
        'div',
        { class: 'table-wrap' },
        h('section', { id: 'board', class: 'board' }),
        h(
          'aside',
          { class: 'side' },
          h('div', { id: 'preview', class: 'preview panel' }),
          h('div', { class: 'panel chatbox' }, h('h3', {}, t('chat')), h('div', { id: 'chat', class: 'chat' })),
          h('div', { class: 'panel logbox' }, h('h3', {}, t('log')), h('div', { id: 'log', class: 'log' }))
        )
      ),
      h('div', { id: 'modal', class: 'modal', hidden: true })
    );
    renderBoard();
    renderPreview();
    renderChat();
    renderLog();
    if (S.pending && S.pending.type === 'manual') openManualModal();
    else if (S.pending && S.pending.type === 'show') openShowModal();
    else if (S.pending && S.pending.req && S.pending.req.kind === 'cards') openCardsModal();
  }
  function renderChat() {
    const box = $('#chat');
    if (!box) return;
    box.innerHTML = '';
    for (const m of S.chat.slice(-30)) box.append(h('div', { class: 'msg ' + m.who }, m.text));
    box.scrollTop = box.scrollHeight;
  }
  function renderLog() {
    const box = $('#log');
    if (!box || !S.game) return;
    box.innerHTML = '';
    for (const l of S.game.G.log.slice(-120)) box.append(h('div', { class: 'l' + (/^logManual/.test(l.k) ? ' warn' : /^logRound|^logRegroup/.test(l.k) ? ' sep' : '') }, SWU.fmtLog(l)));
    box.scrollTop = box.scrollHeight;
  }
  function renderStatus() {
    const el = $('#status');
    if (el) el.replaceWith(statusBar());
  }
  function statusBar() {
    const g = S.game;
    const G = g.G;
    const mine = S.pending && (S.pending.type === 'action' || S.pending.type === 'choose' || S.pending.type === 'manual');
    return h(
      'div',
      { id: 'status', class: 'status' },
      h('span', { class: 'chip' }, t('round', G.round)),
      h('span', { class: 'chip' }, t('phase_' + G.phase)),
      (() => {
        const init = S.pending && S.pending.type === 'action' && S.pending.acts.find((a) => a.type === 'initiative');
        return h(
          init ? 'button' : 'span',
          { class: 'chip inittok ' + (G.initiative === 0 ? 'me' : 'them') + (init ? ' take' : ''), title: init ? t('initTokenTake') : '', onclick: init ? () => askInitiative(init) : null },
          h('span', { class: 'coin' }, '★'),
          t('initiative') + '：' + g.P(G.initiative).name + (G.initiativeTaken ? '（' + t('taken') + '）' : '')
        );
      })(),
      G.winner == null ? h('span', { class: 'turn ' + (mine ? 'me' : 'them') }, mine ? t('yourTurn') : S.thinking || G.active === 1 ? t('yunaTurn') : '…') : null
    );
  }
  function optionFor(uid) {
    const pd = S.pending;
    if (!pd || (pd.type !== 'choose' && pd.type !== 'distribute')) return null;
    return pd.req.options.find((o) => o.uid === uid || o.id === uid) || null;
  }
  function actsFor(uid) {
    const pd = S.pending;
    if (!pd || pd.type !== 'action') return [];
    return pd.acts.filter((a) => a.uid === uid);
  }
  function unitEl(u) {
    const g = S.game;
    const card = u.card;
    const side = u.isLeader ? 'unit' : 'card';
    const opt = optionFor(u.uid);
    const acts = u.ctrl === 0 ? actsFor(u.uid) : [];
    const pd = S.pending;
    const selected = pd && pd.sel && pd.sel.includes(opt && opt.id);
    const toolSel = S.toolTarget && S.toolTarget.uid === u.uid;
    const el = h(
      'div',
      {
        class: 'unit' + (u.exhausted ? ' exhausted' : '') + (opt ? ' can' : '') + (acts.length ? ' act' : '') + (selected || toolSel || S.selUid === u.uid ? ' sel' : '') + (u.isLeader ? ' leaderunit' : ''),
        tabindex: opt || acts.length ? '0' : null,
        onmouseenter: () => setPreview(card, side),
        onclick: () => clickUnit(u, opt, acts),
        onkeydown: (e) => {
          if (e.key === 'Enter') clickUnit(u, opt, acts);
        },
      },
      cardFace(card, side, { stats: { p: g.power(u), h: g.hp(u) } }),
      h(
        'div',
        { class: 'counters' },
        h('span', { class: 'pwr' }, g.power(u)),
        h('span', { class: 'hp' + (u.damage ? ' hurt' : '') }, g.remaining(u)),
        u.damage ? h('span', { class: 'dmg' }, '-' + u.damage) : null
      ),
      pd && pd.type === 'distribute' && pd.alloc['u' + u.uid] ? h('span', { class: 'allocbadge' }, '+' + pd.alloc['u' + u.uid]) : null,
      h(
        'div',
        { class: 'tokens' },
        ...u.upgrades.map((x) => h('span', { class: 'tok ' + (x.card.n === 'Shield' ? 'sh' : x.card.n === 'Experience' ? 'xp' : 'up'), title: x.card.key, onmouseenter: (e) => (e.stopPropagation(), setPreview(x.card, 'card')) }, x.card.n === 'Shield' ? '盾' : x.card.n === 'Experience' ? '+1' : x.card.n.slice(0, 6))),
        ...Object.entries(g.kw(u))
          .filter(([k, val]) => val && ['Sentinel', 'Overwhelm', 'Saboteur', 'Ambush', 'Raid', 'Restore', 'Grit', 'Hidden'].includes(k))
          .map(([k, val]) => h('span', { class: 'kw' }, kwShort(k) + (typeof val === 'number' ? val : '')))
      )
    );
    return el;
  }
  function kwShort(k) {
    const zh = { Sentinel: '哨', Overwhelm: '壓', Saboteur: '破', Ambush: '伏', Raid: '突', Restore: '回', Grit: '堅', Hidden: '隱' };
    return SWU.lang === 'zh' ? zh[k] : k.slice(0, 3);
  }
  function clickUnit(u, opt, acts) {
    const pd = S.pending;
    if (pd && pd.type === 'manual') {
      S.toolTarget = { uid: u.uid };
      openManualModal();
      renderBoard();
      return;
    }
    if (opt) return pickOption(opt.id);
    if (tapTwice('u' + u.uid) && doPrimary(acts)) return;
    S.selUid = u.uid;
    setPreview(u.card, u.isLeader ? 'unit' : 'card', acts);
    renderBoard();
  }
  function distSum(pd) {
    return Object.values(pd.alloc).reduce((a, b) => a + b, 0);
  }
  function distAdd(id, d) {
    const pd = S.pending;
    if (!pd || pd.type !== 'distribute') return;
    const cur = pd.alloc[id] || 0;
    if (d > 0 && distSum(pd) >= pd.req.total) return;
    if (d < 0 && !cur) return;
    pd.alloc[id] = cur + d;
    if (!pd.alloc[id]) delete pd.alloc[id];
    renderBoard();
  }
  function pickOption(id) {
    const pd = S.pending;
    if (pd && pd.type === 'distribute') return distAdd(id, 1);
    const req = pd.req;
    const max = req.max || 1;
    const min = req.min == null ? 1 : req.min;
    if (max === 1) return settle([id]);
    const i = pd.sel.indexOf(id);
    if (i >= 0) pd.sel.splice(i, 1);
    else if (pd.sel.length < max) pd.sel.push(id);
    renderBoard();
    if (req.kind === 'cards') openCardsModal();
    if (pd.sel.length === max && min === max && req.kind !== 'cards') settle(pd.sel);
  }
  function openMenu(acts) {
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    m.append(
      h(
        'div',
        { class: 'dialog small' },
        ...acts.map((a) => h('button', { class: 'wide', onclick: () => settle(a) }, a.label)),
        h('button', { class: 'ghost wide', onclick: closeModal }, t('cancel'))
      )
    );
  }
  function closeModal() {
    const m = $('#modal');
    if (m) {
      m.hidden = true;
      m.innerHTML = '';
    }
  }
  function playerZone(pIdx) {
    const g = S.game;
    const P = g.P(pIdx);
    const L = P.leader;
    const baseOpt = optionFor('base' + pIdx);
    const leaderActs = pIdx === 0 && S.pending && S.pending.type === 'action' ? S.pending.acts.filter((a) => ['deploy', 'leaderAbility', 'manualLeader'].includes(a.type)) : [];
    const baseHP = (P.base.card.h || 30) - P.base.damage;
    const toolSel = S.toolTarget && S.toolTarget.base === pIdx;
    const baseEl = h(
      'div',
      {
        class: 'basecard' + (baseOpt ? ' can' : '') + (toolSel ? ' sel' : ''),
        onmouseenter: () => setPreview(P.base.card, 'card'),
        onclick: () => {
          if (S.pending && S.pending.type === 'manual') {
            S.toolTarget = { base: pIdx };
            openManualModal();
            renderBoard();
          } else if (baseOpt) pickOption(baseOpt.id);
        },
      },
      cardFace(P.base.card, 'card'),
      h('div', { class: 'basehp' + (baseHP <= 10 ? ' low' : '') }, h('b', {}, baseHP), h('small', {}, '/' + (P.base.card.h || 30))),
      S.pending && S.pending.type === 'distribute' && S.pending.alloc['base' + pIdx] ? h('span', { class: 'allocbadge' }, '+' + S.pending.alloc['base' + pIdx]) : null
    );
    const leaderEl = L.deployed
      ? h('div', { class: 'leadercard deployed', onmouseenter: () => setPreview(L.card, 'card') }, cardFace(L.card, 'card', { small: true }), h('span', { class: 'badge' }, '★'))
      : h(
          'div',
          {
            class: 'leadercard' + (L.exhausted ? ' exhausted' : '') + (leaderActs.length ? ' act' : ''),
            onmouseenter: () => setPreview(L.card, 'card'),
            onclick: () => {
              if (tapTwice('L') && doPrimary(leaderActs)) return;
              setPreview(L.card, 'card', leaderActs);
              if (!isTouch() && leaderActs.length) openMenu(leaderActs);
            },
          },
          cardFace(L.card, 'card'),
          h('span', { class: 'badge' }, (L.epicUsed ? '✓ ' : '') + (L.card.c || ''))
        );
    const units = (arena) => P.units.filter((u) => u.arena === arena).map(unitEl);
    const ready = P.resources.filter((r) => !r.exhausted).length;
    const info = h(
      'div',
      { class: 'pinfo' },
      h('b', { class: 'pname' }, P.name),
      h('span', { class: 'stat' }, t('resources') + ' ', h('b', {}, ready + '/' + P.resources.length)),
      h('span', { class: 'stat' }, t('hand') + ' ', h('b', {}, P.hand.length)),
      h('span', { class: 'stat' }, t('deck') + ' ', h('b', {}, P.deck.length)),
      h('span', { class: 'stat', title: P.discard.map((c) => c.card.n).join(', ') }, t('discard') + ' ', h('b', {}, P.discard.length)),
      P.force ? h('span', { class: 'stat force' }, t('toolForce')) : null,
      P.credits ? h('span', { class: 'stat' }, 'Credits ' + P.credits) : null
    );
    return h(
      'div',
      { class: 'zone p' + pIdx },
      info,
      h(
        'div',
        { class: 'lanes' },
        h('div', { class: 'lane ground' }, h('span', { class: 'lane-label' }, t('ground')), h('div', { class: 'units' }, ...units('Ground'))),
        h('div', { class: 'center' }, baseEl, leaderEl),
        h('div', { class: 'lane space' }, h('span', { class: 'lane-label' }, t('space')), h('div', { class: 'units' }, ...units('Space')))
      )
    );
  }
  function handEl() {
    const g = S.game;
    const P = g.P(0);
    const pd = S.pending;
    return h(
      'div',
      { class: 'hand' },
      ...P.hand.map((c) => {
        const acts = pd && pd.type === 'action' ? pd.acts.filter((a) => a.uid === c.uid && a.type === 'play') : [];
        const pen = g.aspectPenalty(0, c.card);
        return h(
          'div',
          {
            class: 'handcard' + (acts.length ? ' act' : '') + (S.selUid === c.uid ? ' sel' : ''),
            tabindex: acts.length ? '0' : null,
            onmouseenter: () => setPreview(c.card, 'card'),
            onclick: () => {
              if (tapTwice('h' + c.uid) && doPrimary(acts)) return;
              S.selUid = c.uid;
              setPreview(c.card, 'card', acts);
              renderBoard();
            },
            onkeydown: (e) => e.key === 'Enter' && acts.length && settle(acts[0]),
          },
          cardFace(c.card, 'card'),
          pen ? h('span', { class: 'pen' }, '+' + pen) : null
        );
      })
    );
  }
  function promptBar() {
    const el = promptBar0();
    const u = undoTarget();
    if (u) el.append(h('button', { class: 'ghost undobtn', title: u.mid ? t('undoMid') : t('undoHint'), onclick: doUndo }, '↶ ' + t('undo')));
    return el;
  }
  // ---------- 三戰兩勝：局間換備牌 ----------
  function openSideModal() {
    if (!S.match) return;
    if (!S.sideEdit) S.sideEdit = JSON.parse(JSON.stringify(S.match.mine));
    const d = S.sideEdit;
    const main = SWU.Deck.count(d), side = SWU.Deck.count(d, 'side');
    const errs = SWU.Deck.validate(d);
    const move = (k, from, to) => {
      d[from][k]--;
      if (!d[from][k]) delete d[from][k];
      d[to][k] = (d[to][k] || 0) + 1;
      openSideModal();
    };
    const rows = (zone) =>
      SWU.Deck.sorted(d[zone]).map(([k, n]) => {
        const c = SWU.Deck.card(k);
        return h(
          'div',
          { class: 'siderow', onmouseenter: () => c && setPreview(c, 'card') },
          h('span', { class: 'cost' }, c && c.c != null ? c.c : ''),
          h('span', { class: 'grow' }, (c ? c.n + (c.s ? ' – ' + c.s : '') : k) + ' ×' + n),
          h('button', { class: 'mini', onclick: () => move(k, zone, zone === 'main' ? 'side' : 'main') }, zone === 'main' ? t('toSide') + ' ⇢' : '⇠ ' + t('toMain'))
        );
      });
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    m.append(
      h(
        'div',
        { class: 'dialog sidedlg' },
        h('h3', {}, t('sideTitle', S.match.game + 1)),
        h('p', { class: 'muted small' }, t('sideHint')),
        h('div', { class: 'sidecols' }, h('div', {}, h('h4', {}, t('main') + ' ' + main), ...rows('main')), h('div', {}, h('h4', {}, t('side') + ' ' + side + ' / 10'), ...rows('side'))),
        errs.length ? h('p', { class: 'warn' }, errs.join('、')) : null,
        h(
          'div',
          { class: 'row end' },
          h('button', { class: 'ghost', onclick: () => ((S.sideEdit = JSON.parse(JSON.stringify(S.match.mine))), openSideModal()) }, t('sideReset')),
          h(
            'button',
            {
              class: 'primary',
              disabled: errs.length > 0,
              onclick: () => {
                S.match.mine = S.sideEdit;
                S.sideEdit = null;
                const r = SWU.Deck.sideboardAI(S.match.yuna, S.match.seen);
                S.match.yuna = r.deck;
                closeModal();
                startGame(true).then(() => {
                  S.chat.push({ who: 'yuna', text: r.swaps.length ? t('yunaSided', r.swaps.length) : t('yunaNoSide') });
                  renderChat();
                });
              },
            },
            t('sideConfirm')
          )
        )
      )
    );
  }
  function openShowModal() {
    const pd = S.pending;
    if (!pd || pd.type !== 'show') return;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    m.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, pd.prompt),
        h('div', { class: 'pickgrid' }, ...pd.cards.map((c) => h('div', { class: 'pick', onmouseenter: () => setPreview(c.card, 'card') }, cardFace(c.card, 'card'), h('small', {}, c.card.n)))),
        h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: () => settle(null) }, t('okSeen')))
      )
    );
  }
  function promptBar0() {
    const pd = S.pending;
    const g = S.game;
    if (g.G.winner != null) {
      const M = S.match;
      if (M) {
        const done = M.wins[0] >= 2 || M.wins[1] >= 2;
        return h(
          'div',
          { class: 'promptbar over' },
          h('b', {}, g.G.winner === 0 ? t('gameOverWin') : t('gameOverLose')),
          h('span', { class: 'matchscore' }, t('matchScore', M.game, M.wins[0], M.wins[1], SWU.playerName())),
          done ? h('b', {}, M.wins[0] >= 2 ? t('matchWin') : t('matchLose')) : null,
          done
            ? h('button', { class: 'primary', onclick: () => ((S.game = null), (S.match = null), render()) }, t('again'))
            : h('button', { class: 'primary', onclick: openSideModal }, t('nextGame', M.game + 1))
        );
      }
      return h(
        'div',
        { class: 'promptbar over' },
        h('b', {}, g.G.winner === 0 ? t('gameOverWin') : t('gameOverLose')),
        h('button', { class: 'primary', onclick: () => ((S.game = null), render()) }, t('again'))
      );
    }
    if (!pd) return h('div', { class: 'promptbar idle' }, S.thinking ? h('span', { class: 'spinner' }) : null, t('yunaTurn'));
    if (pd.type === 'action') {
      const other = pd.acts.filter((a) => (!a.uid || a.type === 'ability' || a.type === 'manualAbility') && a.type !== 'pass' && a.type !== 'initiative');
      const pass = pd.acts.find((a) => a.type === 'pass');
      const init = pd.acts.find((a) => a.type === 'initiative');
      return h(
        'div',
        { class: 'promptbar' },
        h('b', {}, t('yourTurn')),
        h('span', { class: 'muted hint' }, t('tapTwice')),
        ...other.map((a) => h('button', { onclick: () => settle(a) }, a.label)),
        h('span', { class: 'grow' }),
        h('button', { class: 'ghost', onclick: () => openManualModal(true) }, t('manualTools')),
        init ? h('button', { class: 'inittok take', title: t('initTokenTake'), onclick: () => askInitiative(init) }, h('span', { class: 'coin' }, '★'), t('initToken')) : null,
        pass ? h('button', { class: 'passbtn', onclick: () => settle(pass) }, t('passBig')) : null
      );
    }
    if (pd.type === 'choose') {
      const req = pd.req;
      const min = req.min == null ? 1 : req.min;
      const boardOpts = req.options.filter((o) => o.uid != null);
      const listOpts = req.options.filter((o) => o.uid == null);
      const src = S.game && S.game.srcCard;
      return h(
        'div',
        { class: 'promptbar asking effpop' + (boardOpts.length ? ' board' : '') },
        src ? h('div', { class: 'effsrc', onmouseenter: () => setPreview(src, 'card') }, cardFace(src, 'card')) : null,
        h('div', { class: 'effq' }, src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + src.n) : null, h('b', {}, req.prompt)),
        req.kind === 'cards' ? h('button', { onclick: openCardsModal }, t('select')) : null,
        ...listOpts.map((o) => h('button', { class: pd.sel.includes(o.id) ? 'on' : '', onclick: () => pickOption(o.id) }, o.label)),
        ...(boardOpts.length && boardOpts.length <= 8 ? boardOpts.map((o) => h('button', { class: 'ghost small', onmouseenter: () => hilite(o.uid), onclick: () => pickOption(o.id) }, o.label)) : []),
        (req.max || 1) > 1 && req.kind !== 'cards' ? h('button', { class: 'primary', disabled: pd.sel.length < min, onclick: () => settle(pd.sel) }, t('confirm')) : null,
        min === 0 && req.kind !== 'yesno' ? h('button', { class: 'ghost', onclick: () => settle([]) }, t('skip')) : null
      );
    }
    if (pd.type === 'distribute') {
      const req = pd.req;
      const sum = distSum(pd);
      const left = req.total - sum;
      const ok = req.upTo || left === 0;
      const src = S.game && S.game.srcCard;
      return h(
        'div',
        { class: 'promptbar asking effpop dist' },
        src ? h('div', { class: 'effsrc', onmouseenter: () => setPreview(src, 'card') }, cardFace(src, 'card')) : null,
        h(
          'div',
          { class: 'effq' },
          src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + src.n) : null,
          h('b', {}, req.prompt),
          h('span', { class: 'distleft' + (left ? '' : ' done') }, t('distLeft', left)),
          h('small', { class: 'muted' }, t('distHint'))
        ),
        h(
          'div',
          { class: 'distlist' },
          ...req.options.map((o) =>
            h(
              'span',
              { class: 'distrow' + (pd.alloc[o.id] ? ' on' : '') },
              h('button', { class: 'ghost small', disabled: !pd.alloc[o.id], onclick: () => distAdd(o.id, -1) }, '−'),
              h('span', { class: 'distname' }, o.label + (pd.alloc[o.id] ? '  ×' + pd.alloc[o.id] : '')),
              h('button', { class: 'ghost small', disabled: !left, onclick: () => distAdd(o.id, 1) }, '+')
            )
          )
        ),
        h('button', { class: 'ghost', onclick: () => ((pd.alloc = {}), renderBoard()) }, t('distReset')),
        h('button', { class: 'primary', disabled: !ok, onclick: () => settle({ ...pd.alloc }) }, t('confirm'))
      );
    }
    if (pd.type === 'show') return h('div', { class: 'promptbar asking' }, h('b', {}, pd.prompt), h('button', { onclick: openShowModal }, t('select')), h('button', { class: 'primary', onclick: () => settle(null) }, t('okSeen')));
    if (pd.type === 'manual') return h('div', { class: 'promptbar asking' }, h('b', {}, t('manualTitle')), h('button', { onclick: () => openManualModal() }, t('manualTools')));
    return h('div', { class: 'promptbar' });
  }
  // 效果發動時跳出的視窗（是／否、選項）
  function openEffectModal() {
    const pd = S.pending;
    if (!pd || pd.type !== 'choose') return;
    const req = pd.req;
    const src = S.game && S.game.srcCard;
    const min = req.min == null ? 1 : req.min;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    m.append(
      h(
        'div',
        { class: 'dialog small effdlg' },
        src ? h('div', { class: 'effdlg-card' }, cardFace(src, 'card')) : null,
        src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + src.n) : null,
        h('h3', {}, req.prompt),
        ...req.options.map((o, i) => h('button', { class: 'wide' + (req.kind === 'yesno' && i === 0 ? ' primary' : ''), onclick: () => settle([o.id]) }, o.label)),
        min === 0 && req.kind !== 'yesno' ? h('button', { class: 'ghost wide', onclick: () => settle([]) }, t('skip')) : null
      )
    );
  }
  function askInitiative(a) {
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    m.append(
      h(
        'div',
        { class: 'dialog small' },
        h('h3', {}, t('takeInitTitle')),
        h('p', { class: 'muted' }, t('takeInitBody')),
        h('button', { class: 'primary wide', onclick: () => settle(a) }, t('takeInitYes')),
        h('button', { class: 'ghost wide', onclick: closeModal }, t('cancel'))
      )
    );
  }
  function hilite(uid) {
    document.querySelectorAll('.unit.flash').forEach((e) => e.classList.remove('flash'));
  }
  function renderBoard() {
    const b = $('#board');
    if (!b || !S.game) return;
    b.innerHTML = '';
    b.append(statusBar(), playerZone(1), promptBar(), playerZone(0), handEl());
  }

  // 選卡視窗（資源、棄牌、搜尋）
  function openCardsModal() {
    const pd = S.pending;
    if (!pd || pd.type !== 'choose') return;
    const req = pd.req;
    const g = S.game;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const min = req.min == null ? 1 : req.min;
    const max = req.max || 1;
    const lim = req.sumMax;
    const used = lim == null ? 0 : req.options.filter((o) => pd.sel.includes(o.id)).reduce((s, o) => s + (o.val || 0), 0);
    const over = (o) => lim != null && !pd.sel.includes(o.id) && used + (o.val || 0) > lim;
    m.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, req.prompt),
        h(
          'div',
          { class: 'pickgrid' },
          ...req.options.map((o) => {
            const inst = g.findAny(o.id);
            const card = inst ? inst.card : SWU.Deck.card(o.card);
            return h(
              'div',
              {
                class: 'pick' + (pd.sel.includes(o.id) ? ' sel' : '') + (over(o) ? ' off' : ''),
                onmouseenter: () => card && setPreview(card, 'card'),
                onclick: () => {
                  if (over(o)) return;
                  if (max === 1 && min <= 1) return settle([o.id]);
                  const i = pd.sel.indexOf(o.id);
                  if (i >= 0) pd.sel.splice(i, 1);
                  else if (pd.sel.length < max) pd.sel.push(o.id);
                  openCardsModal();
                },
              },
              card ? cardFace(card, 'card') : h('div', {}, o.label),
              h('small', {}, card ? card.n : o.label)
            );
          })
        ),
        h(
          'div',
          { class: 'row end' },
          req.needText && pd.sel.length && !req.validate(pd.sel) ? h('span', { class: 'warn' }, t('needMore', req.needText(pd.sel))) : null,
          h('span', { class: 'muted' }, (max >= 20 ? pd.sel.length : pd.sel.length + ' / ' + max) + (lim != null ? (SWU.lang !== 'zh' ? ` · total ${req.sumKey || 'cost'} ${used} / ${lim}` : ` · 總${req.sumKey === 'power' ? '戰力' : '費用'} ${used} / ${lim}`) : '')),
          min === 0 ? h('button', { class: 'ghost', onclick: () => settle([]) }, t('skip')) : null,
          max > 1 || min === 0 ? h('button', { class: 'primary', disabled: pd.sel.length < min || (req.validate && !(pd.sel.length && req.validate(pd.sel))), onclick: () => settle(pd.sel) }, t('confirm')) : null
        )
      )
    );
  }

  // 手動處理工具
  function openManualModal(free) {
    const g = S.game;
    const pd = S.pending;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const info = pd && pd.type === 'manual' ? pd.info : null;
    if (free && pd && pd.type === 'action') {
      // 自由調整：暫時把 pending 改成 manual，關閉時回到行動選擇
      S.pending = { type: 'manual', info: null, resolve: () => {}, prev: pd, free: true };
      renderBoard();
    }
    const tgt = S.toolTarget;
    const tu = tgt && tgt.uid ? g.findUnit(tgt.uid) : null;
    const tb = tgt && tgt.base != null ? tgt.base : null;
    const tName = tu ? SWU.unitLabel(g, tu) : tb != null ? t('baseOf', g.P(tb).name) : t('toolTarget');
    const act = async (fn) => {
      try {
        await fn();
        await g.checkState();
      } catch (e) {
        if (!(e instanceof SWU.GameOver)) console.error(e);
      }
      renderBoard();
      if (g.G.winner == null) openManualModal();
    };
    const btn = (label, fn, need = 'unit') =>
      h('button', { disabled: (need === 'unit' && !tu) || (need === 'any' && !tu && tb == null), onclick: () => act(fn) }, label);
    const finish = () => {
      const cur = S.pending;
      S.toolTarget = null;
      closeModal();
      if (cur && cur.free) {
        S.pending = cur.prev;
        renderBoard();
        return;
      }
      settle();
    };
    m.append(
      h(
        'div',
        { class: 'dialog manual' },
        h('h3', {}, info ? t('manualTitle') : t('manualTools')),
        info ? h('div', { class: 'manual-card' }, cardFace(info.card, 'card', { small: true }), h('div', {}, h('b', {}, info.card.key), h('p', {}, SWU.lang === 'zh' && SWU.hasZh(info.card) ? SWU.cardText(info.card) : info.text), h('p', { class: 'muted small' }, t('manualHint')))) : null,
        h('div', { class: 'tool-target' }, tName),
        h(
          'div',
          { class: 'tools' },
          btn(t('toolDmg'), () => (tu ? g.damageUnit(tu, 1) : g.damageBase(tb, 1)), 'any'),
          btn(t('toolHeal'), () => (tu ? g.heal(tu, 1) : g.healBase(tb, 1)), 'any'),
          btn(t('toolShield'), () => g.giveShield(tu)),
          btn(t('toolExp'), () => g.giveExp(tu)),
          btn(t('toolBuffUp'), () => g.buff(tu, 1, 1)),
          btn(t('toolBuffDown'), () => g.buff(tu, -1, -1)),
          btn(t('toolExhaust'), () => g.exhaust(tu)),
          btn(t('toolReady'), () => g.ready(tu)),
          btn(t('toolBounce'), () => g.returnToHand(tu)),
          btn(t('toolDefeat'), () => g.defeat(tu, { ability: true, srcP: 0 })),
          btn(t('toolDraw'), () => g.draw(0, 1), 'none'),
          btn(t('toolResTop'), () => g.resourceTop(0), 'none'),
          btn(t('toolForce'), () => (g.P(0).force = !g.P(0).force), 'none')
        ),
        h(
          'div',
          { class: 'row' },
          h('select', { id: 'tokensel' }, ...['Clone Trooper', 'Battle Droid', 'X-Wing', 'TIE Fighter', 'Mandalorian', 'Beast', 'Spy'].map((n) => h('option', { value: n }, n))),
          h('button', { onclick: () => act(() => g.createToken(0, $('#tokensel').value, 1)) }, t('toolToken'))
        ),
        h(
          'div',
          { class: 'row end' },
          info && SWU.AI.hasClaude()
            ? h(
                'button',
                {
                  onclick: async (e) => {
                    e.target.disabled = true;
                    e.target.textContent = t('reviewing');
                    try {
                      const r = await SWU.AI.interpret(g, 0, info);
                      if (r.say) S.chat.push({ who: 'yuna', text: r.say }), renderChat();
                      await SWU.AI.applyOps(g, 0, r.ops || [], info.source && info.source.uid);
                    } catch (err) {
                      S.chat.push({ who: 'sys', text: t('aiError', String(err.message || err)) });
                      renderChat();
                    }
                    finish();
                  },
                },
                t('manualAsk')
              )
            : null,
          h('button', { class: 'primary', onclick: finish }, t('done'))
        )
      )
    );
  }

  // ---------- 組牌器 ----------
  function saveDecks() {
    SWU.Deck.saveAll(S.decks);
  }
  function editDeck(d) {
    S.edit = JSON.parse(JSON.stringify(d));
    if (S.edit.preset) {
      delete S.edit.preset;
      S.edit.id = SWU.Deck.blank().id;
      S.edit.name = d.name;
    }
    S.review = d.review || '';
  }
  // ---------- 組牌器：系列、卡號、排序 ----------
  const SET_ORDER = ['SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'IBH', 'SEC', 'LAW', 'TS26', 'ASH', 'HMW', 'IC27'];
  const SET_SIZE = { SOR: 252, SHD: 262, TWI: 257, JTL: 262, LOF: 264, IBH: 104, SEC: 264, LAW: 264, TS26: 84, ASH: 264, HMW: 272, IC27: 194 };
  const SET_ZH = { SOR: '一彈 反抗之火', SHD: '二彈 銀河暗影', TWI: '三彈 共和暮光', JTL: '四彈 躍入光速', LOF: '五彈 原力傳說', IBH: '入門 霍斯之戰', SEC: '六彈 力量的秘密', LAW: '七彈 無法時代', TS26: 'Twin Suns 2026', ASH: '八彈 帝國餘燼', HMW: '九彈 家園', IC27: 'Icons 2027' };
  function printings(c) {
    if (c._pr) return c._pr;
    const out = [];
    for (const id of c.ids || [c.id]) {
      const [st, n] = id.split('-');
      if (SET_ORDER.includes(st) && /^\d+$/.test(n) && +n <= (SET_SIZE[st] || 999)) out.push({ set: st, n: +n });
    }
    out.sort((x, y) => SET_ORDER.indexOf(x.set) - SET_ORDER.indexOf(y.set) || x.n - y.n);
    return (c._pr = out);
  }
  function printingOf(c, sets) {
    const pr = printings(c);
    return (sets && sets.length && pr.find((x) => sets.includes(x.set))) || pr[0] || null;
  }
  const TYPE_ORDER = ['Leader', 'Base', 'Unit', 'Event', 'Upgrade'];
  const aspKey = (c) => {
    const a = c.a || [];
    if (!a.length) return 99;
    return a.map((x) => SWU.ASPECTS.indexOf(x)).sort((x, y) => x - y).reduce((s, v) => s * 7 + v + 1, 0);
  };
  function sortKey(c, f) {
    const pr = printingOf(c, f.sets);
    const num = pr ? SET_ORDER.indexOf(pr.set) * 1000 + pr.n : 99999;
    switch (f.sort) {
      case 'cost': return [c.c == null ? 99 : c.c, num];
      case 'name': return [c.key.toLowerCase()];
      case 'aspect': return [aspKey(c), c.c || 0, num];
      case 'type': return [TYPE_ORDER.indexOf(c.t), c.c || 0, num];
      case 'power': return [c.p == null ? -1 : c.p, c.c || 0, num];
      case 'hp': return [c.h == null ? -1 : c.h, c.c || 0, num];
      case 'price': return [+c.pr || 0, num];
      default: return [num];
    }
  }
  function groupOf(c, f) {
    switch (f.sort) {
      case 'cost': return c.c == null ? '—' : t('cost') + ' ' + c.c;
      case 'aspect': return (c.a || []).length ? (c.a || []).map((x) => t('asp_' + x)).join(' + ') : t('noAspect');
      case 'type': return t('type_' + c.t) !== 'type_' + c.t ? t('type_' + c.t) : c.t;
      case 'number': { const pr = printingOf(c, f.sets); return pr ? pr.set + ' · ' + (SWU.lang === 'zh' ? SET_ZH[pr.set] || '' : '') : '—'; }
      case 'power': return c.p == null ? '—' : (SWU.lang === 'zh' ? '戰力 ' : 'Power ') + c.p;
      case 'hp': return c.h == null ? '—' : (SWU.lang === 'zh' ? '生命 ' : 'HP ') + c.h;
      default: return null;
    }
  }
  let TRAITS = null, KWS = null;
  function traitList() {
    if (TRAITS) return TRAITS;
    const tc = {}, kc = {};
    for (const c of SWU.DB.list) {
      if (/Token/.test(c.t)) continue;
      for (const x of c.tr || []) tc[x] = (tc[x] || 0) + 1;
      for (const x of c.kw || []) kc[x] = (kc[x] || 0) + 1;
    }
    TRAITS = Object.keys(tc).sort();
    KWS = Object.keys(kc).sort();
    return TRAITS;
  }
  function filteredCards() {
    const f = S.filters;
    const q = f.q.trim().toLowerCase();
    const deck = S.edit;
    const list = SWU.DB.list.filter((c) => {
      if (/Token/.test(c.t)) return false;
      if (f.type && c.t !== f.type) return false;
      if (f.legal && c.pl !== 'Yes') return false;
      if (f.sets.length && !printings(c).some((x) => f.sets.includes(x.set))) return false;
      if (f.aspects.length) {
        const ca = c.a || [];
        const want = f.aspects.filter((a) => a !== 'none');
        const none = f.aspects.includes('none');
        const hit = f.aspMode === 'any' ? (none && !ca.length) || want.some((a) => ca.includes(a)) : none ? !ca.length && !want.length : want.every((a) => ca.includes(a));
        if (!hit) return false;
      }
      if (f.cost !== '') {
        if (f.cost === '7' ? (c.c || 0) < 7 : (c.c || 0) !== +f.cost) return false;
      }
      if (f.arena && c.ar !== f.arena) return false;
      if (f.trait && !(c.tr || []).includes(f.trait)) return false;
      if (f.kw && !(c.kw || []).includes(f.kw)) return false;
      if (f.nopen && deck && ['Unit', 'Event', 'Upgrade'].includes(c.t) && SWU.Deck.penalty(deck, c) > 0) return false;
      if (q && !(c.key.toLowerCase().includes(q) || (c.tx || '').toLowerCase().includes(q) || (c.tr || []).join(' ').toLowerCase().includes(q) || (SWU.ZH[c.key] && ((SWU.ZH[c.key].tx || '').includes(q) || (SWU.ZH[c.key].n || '').includes(q))))) return false;
      return true;
    });
    const keys = new Map(list.map((c) => [c, sortKey(c, f)]));
    list.sort((x, y) => {
      const a = keys.get(x), b = keys.get(y);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] === b[i]) continue;
        if (a[i] == null) return -1;
        if (b[i] == null) return 1;
        return (a[i] < b[i] ? -1 : 1) * (i === 0 ? f.dir : 1);
      }
      return x.key < y.key ? -1 : 1;
    });
    return list;
  }
  function addCard(c, zone = 'main') {
    const d = S.edit;
    if (c.t === 'Leader') d.leader = c.key;
    else if (c.t === 'Base') d.base = c.key;
    else {
      const total = (d.main[c.key] || 0) + (d.side[c.key] || 0);
      if (total >= 3) return;
      d[zone][c.key] = (d[zone][c.key] || 0) + 1;
    }
    d.dirty = true;
    renderBuilderBody();
  }
  function removeCard(key, zone = 'main') {
    const d = S.edit;
    if (!d[zone][key]) return;
    d[zone][key]--;
    if (!d[zone][key]) delete d[zone][key];
    d.dirty = true;
    renderBuilderBody();
  }
  function renderBuilder(v) {
    S.decks = SWU.Deck.loadAll();
    if (!S.edit) editDeck(S.decks[0] || SWU.Deck.presets()[1]);
    v.append(h('div', { class: 'builder', id: 'builder' }));
    renderBuilderBody();
  }
  function renderBuilderBody() {
    const root = $('#builder');
    if (!root) return;
    const keepScroll = $('.results') ? $('.results').scrollTop : 0;
    const focus = document.activeElement && document.activeElement.id;
    root.innerHTML = '';
    root.append(deckListPanel(), searchPanel(), deckPanel());
    if ($('.results')) $('.results').scrollTop = keepScroll;
    if (focus && $('#' + focus)) {
      const el = $('#' + focus);
      el.focus();
      if (el.setSelectionRange && el.value != null && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length);
    }
  }
  function deckListPanel() {
    const imp = h('textarea', { id: 'importbox', rows: '6', placeholder: t('importHint') });
    const warn = h('div', { class: 'muted small', id: 'importwarn' });
    return h(
      'section',
      { class: 'panel decklist' },
      h('h3', {}, t('myDecks')),
      h(
        'div',
        { class: 'list' },
        ...S.decks.map((d) =>
          h(
            'button',
            {
              class: 'deckrow' + (S.edit && S.edit.id === d.id ? ' on' : ''),
              onclick: () => {
                editDeck(d);
                renderBuilderBody();
              },
            },
            h('b', {}, d.name),
            h('small', {}, (SWU.Deck.card(d.leader) || {}).n || '—', ' · ', SWU.Deck.count(d))
          )
        )
      ),
      h(
        'button',
        {
          onclick: () => {
            editDeck(SWU.Deck.blank(t('newDeck')));
            renderBuilderBody();
          },
        },
        '+ ' + t('newDeck')
      ),
      h('h4', {}, t('presets')),
      ...SWU.Deck.presets().map((d) =>
        h(
          'button',
          {
            class: 'ghost small left',
            onclick: () => {
              editDeck(d);
              renderBuilderBody();
            },
          },
          d.name
        )
      ),
      h('h4', {}, t('import')),
      imp,
      h(
        'button',
        {
          onclick: () => {
            const r = SWU.Deck.parse(imp.value, t('import'));
            if (r.error) {
              warn.textContent = r.error;
              return;
            }
            editDeck(r.deck);
            S.edit.dirty = true;
            renderBuilderBody();
            if (r.warnings.length) $('#importwarn').textContent = r.warnings.join('\n');
          },
        },
        t('doImport')
      ),
      warn
    );
  }
  function searchPanel() {
    const f = S.filters;
    const list = filteredCards();
    const pageSize = 120;
    const page = list.slice(0, (f.page + 1) * pageSize);
    const rerender = () => {
      f.page = 0;
      renderBuilderBody();
    };
    const sel = (id, val, set, opts) => h('select', { id, onchange: (e) => (set(e.target.value), rerender()) }, ...opts.map(([v, l]) => h('option', { value: v, selected: val === v }, l)));
    const aspBtns = [...SWU.ASPECTS, 'none'].map((a) =>
      h(
        'button',
        {
          class: 'aspbtn ' + (a === 'none' ? 'none' : ASP_CLASS[a]) + (f.aspects.includes(a) ? ' on' : ''),
          title: a === 'none' ? t('noAspect') : t('asp_' + a),
          onclick: () => {
            f.aspects = f.aspects.includes(a) ? f.aspects.filter((x) => x !== a) : [...f.aspects, a];
            rerender();
          },
        },
        a === 'none' ? h('i', { class: 'dot none' }) : h('i', { class: 'dot ' + ASP_CLASS[a] })
      )
    );
    const setBtns = SET_ORDER.map((st) =>
      h(
        'button',
        {
          class: 'setbtn' + (f.sets.includes(st) ? ' on' : ''),
          title: SET_ZH[st] || st,
          onclick: () => {
            f.sets = f.sets.includes(st) ? f.sets.filter((x) => x !== st) : [...f.sets, st];
            rerender();
          },
        },
        st
      )
    );
    traitList();
    let timer;
    // 依排序分組，組名當標題列
    const items = [];
    let lastG;
    for (const c of page) {
      if (f.group) {
        const g = groupOf(c, f);
        if (g != null && g !== lastG) {
          items.push(h('div', { class: 'rgroup' }, g));
          lastG = g;
        }
      }
      const n = (S.edit.main[c.key] || 0) + (S.edit.side[c.key] || 0);
      const isSet = S.edit.leader === c.key || S.edit.base === c.key;
      const pr = printingOf(c, f.sets);
      let press;
      items.push(
        h(
          'div',
          {
            class: 'rcard' + (n || isSet ? ' indeck' : ''),
            onmouseenter: () => setPreviewBuilder(c),
            onclick: () => addCard(c, f.addZone || 'main'),
            oncontextmenu: (e) => {
              e.preventDefault();
              removeCard(c.key, f.addZone || 'main');
            },
            ontouchstart: () => (press = setTimeout(() => removeCard(c.key, f.addZone || 'main'), 600)),
            ontouchend: () => clearTimeout(press),
          },
          cardFace(c, 'card'),
          n ? h('span', { class: 'count' }, '×' + n) : isSet ? h('span', { class: 'count' }, '✓') : null,
          h('small', {}, c.n, c.s ? ' – ' + c.s : ''),
          pr ? h('small', { class: 'setno' }, pr.set + ' ' + String(pr.n).padStart(3, '0')) : null
        )
      );
    }
    const more = list.length > page.length;
    return h(
      'section',
      { class: 'panel search' },
      h(
        'div',
        { class: 'filters' },
        h('input', {
          id: 'q',
          type: 'text',
          value: f.q,
          placeholder: t('search'),
          oninput: (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              f.q = e.target.value;
              rerender();
            }, 250);
          },
        }),
        sel('fsort', f.sort, (v) => (f.sort = v), ['number', 'cost', 'aspect', 'type', 'name', 'power', 'hp', 'price'].map((x) => [x, t('sortBy') + '：' + t('sort_' + x)])),
        h('button', { class: 'ghost small', id: 'fdir', title: f.dir > 0 ? '↑' : '↓', onclick: () => ((f.dir = -f.dir), rerender()) }, f.dir > 0 ? '↑' : '↓'),
        h('span', { class: 'modesel small' }, h('span', { class: 'muted small' }, t('addTo')), ...['main', 'side'].map((z) => h('button', { class: (f.addZone || 'main') === z ? 'on' : 'ghost', onclick: () => ((f.addZone = z), renderBuilderBody()) }, t(z)))),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'fgroup', checked: f.group, onchange: (e) => ((f.group = e.target.checked), rerender()) }), t('groupBy'))
      ),
      h('div', { class: 'filters setrow' }, h('span', { class: 'muted small' }, t('setsLabel')), ...setBtns),
      h(
        'div',
        { class: 'filters' },
        sel('ftype', f.type, (v) => (f.type = v), [['', t('allTypes')], ...TYPE_ORDER.map((x) => [x, t('type_' + x)])]),
        sel('fcost', f.cost, (v) => (f.cost = v), [['', t('cost') + '：' + t('any')], ...['0', '1', '2', '3', '4', '5', '6', '7'].map((x) => [x, t('cost') + ' ' + (x === '7' ? '7+' : x)])]),
        sel('farena', f.arena, (v) => (f.arena = v), [['', t('allArenas')], ['Ground', t('arenaGround')], ['Space', t('arenaSpace')]]),
        sel('ftrait', f.trait, (v) => (f.trait = v), [['', t('allTraits')], ...TRAITS.map((x) => [x, x])]),
        sel('fkw', f.kw, (v) => (f.kw = v), [['', t('allKw')], ...KWS.map((x) => [x, x])])
      ),
      h(
        'div',
        { class: 'filters' },
        h('div', { class: 'aspbtns' }, ...aspBtns),
        f.aspects.length > 1 ? sel('faspmode', f.aspMode, (v) => (f.aspMode = v), [['all', t('aspAll')], ['any', t('aspAny')]]) : null,
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'flegal', checked: f.legal, onchange: (e) => ((f.legal = e.target.checked), rerender()) }), t('legalOnly')),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'fnopen', checked: f.nopen, onchange: (e) => ((f.nopen = e.target.checked), rerender()) }), t('noPenalty')),
        h(
          'button',
          {
            class: 'ghost small',
            onclick: () => {
              Object.assign(f, { q: '', type: '', aspects: [], cost: '', nopen: false, sets: [], arena: '', trait: '', kw: '', aspMode: 'all' });
              rerender();
            },
          },
          t('clearFilters')
        ),
        h('span', { class: 'muted small' }, t('showing', page.length, list.length) + ' · ' + t('addHint'))
      ),
      h(
        'div',
        {
          class: 'results',
          onscroll: (e) => {
            const el = e.target;
            if (more && el.scrollTop + el.clientHeight > el.scrollHeight - 300 && !el._loading) {
              el._loading = true;
              f.page++;
              renderBuilderBody();
            }
          },
        },
        ...items,
        more
          ? h(
              'button',
              {
                class: 'ghost wide',
                onclick: () => {
                  f.page++;
                  renderBuilderBody();
                },
              },
              '…' + (list.length - page.length)
            )
          : null
      ),
      h('div', { id: 'bpreview', class: 'bpreview' })
    );
  }
  function setPreviewBuilder(c) {
    const box = $('#bpreview');
    if (!box) return;
    box.innerHTML = '';
    box.append(
      h('b', {}, c.key),
      h('span', { class: 'muted' }, ' ' + [c.t, c.c != null ? c.c : '', c.p != null ? c.p + '/' + c.h : c.h ? c.h + 'HP' : '', c.ar || '', (c.tr || []).join(' · '), c.pr ? '$' + c.pr : ''].filter(Boolean).join(' · ')),
      h('p', {}, SWU.cardText(c, 'card')),
      c.t === 'Leader' ? h('p', {}, h('b', {}, 'Unit: '), SWU.cardText(c, 'unit')) : null
    );
  }
  function deckPanel() {
    const d = S.edit;
    const errs = SWU.Deck.validate(d);
    const L = SWU.Deck.card(d.leader);
    const B = SWU.Deck.card(d.base);
    const group = (zone) => {
      const rows = SWU.Deck.sorted(d[zone]);
      return h(
        'div',
        { class: 'dlist' },
        ...rows.map(([k, n]) => {
          const c = SWU.Deck.card(k) || { key: k, n: k };
          const pen = c.a ? SWU.Deck.penalty(d, c) : 0;
          return h(
            'div',
            { class: 'drow', onmouseenter: () => c.t && setPreviewBuilder(c) },
            h('span', { class: 'dc' }, c.c != null ? c.c : '·'),
            aspectDots(c),
            h('span', { class: 'dn' }, c.n, c.s ? h('small', {}, ' ' + c.s) : null, pen ? h('em', { class: 'penmark' }, ' +' + pen) : null),
            h('button', { class: 'mini', title: '-', onclick: () => removeCard(k, zone) }, '−'),
            h('b', { class: 'dq' }, n),
            h('button', { class: 'mini', title: '+', onclick: () => c.t && addCard(c, zone) }, '+'),
            h(
              'button',
              {
                class: 'mini ghost',
                title: zone === 'main' ? t('toSide') : t('toMain'),
                onclick: () => {
                  const other = zone === 'main' ? 'side' : 'main';
                  d[zone][k]--;
                  if (!d[zone][k]) delete d[zone][k];
                  d[other][k] = (d[other][k] || 0) + 1;
                  d.dirty = true;
                  renderBuilderBody();
                },
              },
              zone === 'main' ? '⇢' : '⇠'
            )
          );
        })
      );
    };
    const exportBox = h('textarea', { id: 'exportbox', rows: '4', hidden: true, readonly: true });
    const doExport = (txt) => {
      exportBox.hidden = false;
      exportBox.value = txt;
      try {
        navigator.clipboard.writeText(txt).then(
          () => flash(t('copied')),
          () => flash(t('copyFail'))
        );
      } catch (e) {
        flash(t('copyFail'));
      }
      exportBox.select();
    };
    let delArmed = false;
    return h(
      'section',
      { class: 'panel deckpanel' },
      h('input', {
        id: 'deckname',
        type: 'text',
        value: d.name,
        'aria-label': t('deckName'),
        oninput: (e) => {
          d.name = e.target.value;
          d.dirty = true;
        },
      }),
      h(
        'div',
        { class: 'lb' },
        h('div', { class: 'slot' }, h('small', {}, t('leader')), L ? h('div', { onmouseenter: () => setPreviewBuilder(L) }, cardFace(L, 'card', { small: true })) : h('div', { class: 'empty' }, t('clickToSet', t('leader')))),
        h('div', { class: 'slot' }, h('small', {}, t('base')), B ? h('div', { onmouseenter: () => setPreviewBuilder(B) }, cardFace(B, 'card', { small: true })) : h('div', { class: 'empty' }, t('clickToSet', t('base'))))
      ),
      h(
        'div',
        { class: 'row' },
        h('b', {}, t('main') + ' ' + SWU.Deck.count(d) + ' · ' + t('side') + ' ' + SWU.Deck.count(d, 'side')),
        errs.length ? h('span', { class: 'err small' }, errs.join('；')) : h('span', { class: 'ok small' }, '✓ Premier')
      ),
      group('main'),
      h('h4', {}, t('side') + ' ' + SWU.Deck.count(d, 'side') + ' / 10'),
      group('side'),
      h(
        'div',
        { class: 'row wrap' },
        h(
          'button',
          {
            class: 'primary',
            onclick: () => {
              delete d.dirty;
              const i = S.decks.findIndex((x) => x.id === d.id);
              const copy = JSON.parse(JSON.stringify(d));
              if (i >= 0) S.decks[i] = copy;
              else S.decks.unshift(copy);
              saveDecks();
              flash(t('saved'));
              renderBuilderBody();
            },
          },
          t('save') + (d.dirty ? ' •' : '')
        ),
        h('button', { onclick: () => doExport(SWU.Deck.toText(d)) }, t('exportText')),
        h('button', { onclick: () => doExport(SWU.Deck.toSwudb(d)) }, t('exportJson')),
        S.decks.some((x) => x.id === d.id)
          ? h(
              'button',
              {
                class: 'danger',
                onclick: (e) => {
                  if (!delArmed) {
                    delArmed = true;
                    e.target.textContent = t('confirmDel');
                    return;
                  }
                  S.decks = S.decks.filter((x) => x.id !== d.id);
                  saveDecks();
                  S.edit = null;
                  editDeck(S.decks[0] || SWU.Deck.presets()[1]);
                  renderBuilderBody();
                },
              },
              t('del')
            )
          : null
      ),
      exportBox,
      autoBuildBox(),
      h(
        'div',
        { class: 'subtabs' },
        ...['analysis', 'prob', 'review'].map((k) =>
          h(
            'button',
            {
              class: 'tab' + (S.deckTab === k ? ' on' : ''),
              onclick: () => {
                S.deckTab = k;
                renderBuilderBody();
              },
            },
            t(k)
          )
        )
      ),
      S.deckTab === 'analysis' ? analysisEl(d) : S.deckTab === 'prob' ? probEl(d) : reviewEl(d)
    );
  }
  function flash(text) {
    const el = h('div', { class: 'toast' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 1800);
  }
  function autoBuildBox() {
    const d = S.edit;
    const wishes = h('input', { type: 'text', id: 'wishes', placeholder: t('wishes') });
    const status = h('span', { class: 'muted small' });
    const ready = d.leader && d.base;
    return h(
      'details',
      { class: 'autobuild' },
      h('summary', {}, t('autoBuild')),
      ready ? null : h('p', { class: 'muted small' }, t('pickLeaderBase')),
      wishes,
      h(
        'div',
        { class: 'row wrap' },
        h(
          'button',
          {
            class: 'primary',
            disabled: !ready || !SWU.AI.hasClaude(),
            title: SWU.AI.hasClaude() ? '' : t('aiStatusOff'),
            onclick: async (e) => {
              e.target.disabled = true;
              status.textContent = t('building');
              try {
                const r = await SWU.AI.buildDeck(d.leader, d.base, wishes.value);
                editDeck(r.deck);
                S.edit.dirty = true;
                S.review = (r.explanation || '') + (r.missing.length ? '\n\n' + t('warnUnknown', r.missing.join(', ')) : '');
                S.deckTab = 'review';
                renderBuilderBody();
              } catch (err) {
                status.textContent = t('aiError', String(err.message || err));
                e.target.disabled = false;
              }
            },
          },
          t('autoBuild')
        ),
        h(
          'button',
          {
            disabled: !ready,
            onclick: () => {
              editDeck(SWU.Deck.autoBuild(d.leader, d.base));
              S.edit.dirty = true;
              renderBuilderBody();
            },
          },
          t('autoBuildQuick')
        ),
        status
      )
    );
  }
  function bars(obj, keys, labelFn) {
    const max = Math.max(1, ...keys.map((k) => obj[k] || 0));
    return h(
      'div',
      { class: 'bars' },
      ...keys.map((k) =>
        h('div', { class: 'bar' }, h('span', { class: 'bv' }, obj[k] || 0), h('div', { class: 'bf', style: `height:${((obj[k] || 0) / max) * 100}%` }), h('span', { class: 'bl' }, labelFn ? labelFn(k) : k))
      )
    );
  }
  function analysisEl(d) {
    const A = SWU.Deck.analyze(d);
    const sc = A.score;
    return h(
      'div',
      { class: 'analysis' },
      h(
        'div',
        { class: 'scorebox' },
        h('div', { class: 'gauge', style: `--v:${sc.total}` }, h('b', {}, sc.total), h('small', {}, t('score'))),
        h('div', { class: 'parts' }, ...sc.parts.map((p) => h('div', { class: 'part' }, h('span', {}, t(p.k)), h('div', { class: 'pbar' }, h('i', { style: `width:${Math.round(p.v * 100)}%` }))))),
        h('p', { class: 'muted small' }, t('scNote'))
      ),
      h('h4', {}, t('curve')),
      bars(A.curve, ['0', '1', '2', '3', '4', '5', '6', '7', '8'], (k) => (k === '8' ? '8+' : k)),
      h(
        'div',
        { class: 'facts' },
        h('div', {}, h('small', {}, t('avgCost')), h('b', {}, A.avg.toFixed(2))),
        h('div', {}, h('small', {}, t('interaction')), h('b', {}, A.interaction)),
        h('div', {}, h('small', {}, t('types')), h('b', {}, Object.entries(A.types).map(([k, v]) => k + ' ' + v).join(' · '))),
        h('div', {}, h('small', {}, t('arenas')), h('b', {}, t('ground') + ' ' + A.arenas.Ground + ' · ' + t('space') + ' ' + A.arenas.Space))
      ),
      h('h4', {}, t('keywords')),
      h('div', { class: 'chips' }, ...Object.entries(A.kw).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('span', { class: 'chip' }, k + ' ' + v))),
      A.penaltyCards.length ? h('div', {}, h('h4', {}, t('penalty')), h('p', { class: 'small' }, A.penaltyCards.join('、'))) : null,
      h('h4', {}, t('automation')),
      A.unimplemented.length
        ? h(
            'div',
            {},
            h('p', { class: 'small' }, t('autoMissing') + ' ' + A.unimplemented.join('、')),
            SWU.AI.hasClaude()
              ? h('button', { class: 'primary', onclick: () => learnCards(deckCardsFor(d)).then(() => renderBuilder()) }, t('autoLearn'))
              : h('p', { class: 'small muted' }, t('autoNeedKey'))
          )
        : h('p', { class: 'ok small' }, '✓ ' + t('autoOk'))
    );
  }
  function probEl(d) {
    S.prob = S.prob || { target: 'cat2', k: 1, mull: false };
    const pr = S.prob;
    const keys = Object.keys(d.main);
    const cats = {
      cat2: (c) => c.t === 'Unit' && (c.c || 0) <= 2,
      cat3: (c) => c.t === 'Unit' && (c.c || 0) <= 3,
      catSentinel: (c) => !!(c.kwp && c.kwp.Sentinel) || /gains Sentinel/.test(c.tx || ''),
      catRemoval: (c) => /defeat|deal \d+ damage|damage equal|-\d+\/-\d+/i.test(c.tx || ''),
    };
    let K = 0;
    if (cats[pr.target]) for (const [k, n] of Object.entries(d.main)) cats[pr.target](SWU.Deck.card(k) || {}) && (K += n);
    else K = d.main[pr.target] || 0;
    const rows = SWU.Deck.count(d) ? SWU.Deck.drawTable(d, K, { k: pr.k, mulligan: pr.mull }) : [];
    const pct = (p) => (p * 100).toFixed(1) + '%';
    const core = SWU.Deck.sorted(d.main)
      .filter(([, n]) => n >= 2)
      .map(([k, n]) => {
        const tb = SWU.Deck.drawTable(d, n, { k: 1 });
        return h('tr', {}, h('td', {}, k.split(' | ')[0] + ' ×' + n), h('td', {}, pct(tb[0].p)), h('td', {}, pct(tb[2].p)), h('td', {}, pct(tb[4].p)));
      });
    return h(
      'div',
      { class: 'prob' },
      h(
        'div',
        { class: 'row wrap' },
        h('label', { for: 'ptarget' }, t('probTarget')),
        h(
          'select',
          { id: 'ptarget', onchange: (e) => ((pr.target = e.target.value), renderBuilderBody()) },
          h('optgroup', { label: t('probCat') }, ...Object.keys(cats).map((k) => h('option', { value: k, selected: pr.target === k }, t(k)))),
          h('optgroup', { label: t('probCard') }, ...keys.map((k) => h('option', { value: k, selected: pr.target === k }, k + ' ×' + d.main[k])))
        ),
        h('label', { for: 'pk' }, t('probAtLeast')),
        h('select', { id: 'pk', onchange: (e) => ((pr.k = +e.target.value), renderBuilderBody()) }, ...[1, 2, 3].map((n) => h('option', { value: n, selected: pr.k === n }, n))),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pmull', checked: pr.mull, onchange: (e) => ((pr.mull = e.target.checked), renderBuilderBody()) }), t('probMull'))
      ),
      h('p', { class: 'muted small' }, 'N=' + SWU.Deck.count(d) + '，K=' + K),
      h(
        'table',
        { class: 'ptable' },
        h('thead', {}, h('tr', {}, h('th', {}, t('probRound')), h('th', {}, t('probSeen')), h('th', {}, t('probP')))),
        h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, r.round), h('td', {}, r.seen), h('td', {}, h('div', { class: 'pcell' }, h('i', { style: `width:${r.p * 100}%` }), h('span', {}, pct(r.p)))))))
      ),
      h('h4', {}, t('probCore')),
      h('div', { class: 'tablewrap' }, h('table', { class: 'ptable small' }, h('tbody', {}, ...core)))
    );
  }
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '';
    let inList = false;
    for (const l of lines) {
      const li = l.match(/^\s*[-*・]\s+(.*)$/) || l.match(/^\s*\d+[.)]\s+(.*)$/);
      if (li) {
        if (!inList) (html += '<ul>'), (inList = true);
        html += '<li>' + inline(li[1]) + '</li>';
        continue;
      }
      if (inList) (html += '</ul>'), (inList = false);
      const hd = l.match(/^(#{1,4})\s+(.*)$/);
      if (hd) html += '<h4>' + inline(hd[2]) + '</h4>';
      else if (l.trim()) html += '<p>' + inline(l) + '</p>';
    }
    if (inList) html += '</ul>';
    return html;
    function inline(s) {
      return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    }
  }
  function reviewEl(d) {
    const out = h('div', { class: 'review', html: S.review ? md(S.review) : '' });
    return h(
      'div',
      {},
      h(
        'button',
        {
          disabled: !SWU.AI.hasClaude() || !SWU.Deck.count(d),
          title: SWU.AI.hasClaude() ? '' : t('aiStatusOff'),
          onclick: async (e) => {
            e.target.disabled = true;
            e.target.textContent = t('reviewing');
            try {
              S.review = await SWU.AI.reviewDeck(d, SWU.Deck.analyze(d));
              d.review = S.review;
            } catch (err) {
              S.review = t('aiError', String(err.message || err));
            }
            renderBuilderBody();
          },
        },
        t('askReview')
      ),
      SWU.AI.hasClaude() ? null : h('p', { class: 'muted small' }, t('aiStatusOff')),
      out
    );
  }

  // ---------- 設定 ----------
  function renderSettings(v) {
    const st = SWU.AI.settings;
    const save = () => SWU.AI.save();
    const testOut = h('span', { class: 'small' });
    const backup = h('textarea', { id: 'backup', rows: '5', placeholder: t('backupHint') });
    v.append(
      h(
        'section',
        { class: 'panel settings' },
        h(
          'div',
          { class: 'field' },
          h('label', {}, t('setAutoSingle')),
          h(
            'div',
            { class: 'row' },
            h('button', { class: !st.autoSingle ? 'on' : '', onclick: () => ((st.autoSingle = false), save(), render()) }, t('setAutoSingleOff')),
            h('button', { class: st.autoSingle ? 'on' : '', onclick: () => ((st.autoSingle = true), save(), render()) }, t('setAutoSingleOn'))
          )
        ),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'pname' }, t('setName')),
          h('input', { id: 'pname', type: 'text', value: st.playerName || '', maxlength: '20', placeholder: t('setNamePh'), onchange: (e) => ((st.playerName = e.target.value.trim()), save()) }),
          h('p', { class: 'muted small' }, t('setNameHint'))
        ),
        h('div', { class: 'field' }, h('label', {}, t('setLang')), h('div', { class: 'row' }, h('button', { class: SWU.lang === 'zh' ? 'on' : '', onclick: () => (SWU.setLang('zh'), render()) }, '繁體中文'), h('button', { class: SWU.lang === 'en' ? 'on' : '', onclick: () => (SWU.setLang('en'), render()) }, 'English'))),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'apikey' }, t('setKey')),
          h('input', { id: 'apikey', type: 'password', value: st.apiKey, autocomplete: 'off', placeholder: 'sk-ant-…', onchange: (e) => ((st.apiKey = e.target.value.trim()), save()) }),
          h('p', { class: 'muted small' }, t('setKeyHint')),
          h(
            'div',
            { class: 'row' },
            h(
              'button',
              {
                onclick: async () => {
                  st.apiKey = $('#apikey').value.trim();
                  save();
                  testOut.textContent = t('testing');
                  try {
                    await SWU.AI.test();
                    testOut.textContent = '✓ ' + t('testOk');
                    testOut.className = 'ok small';
                  } catch (e) {
                    testOut.textContent = t('testFail', String(e.message || e).slice(0, 160));
                    testOut.className = 'err small';
                  }
                },
              },
              t('setTest')
            ),
            testOut
          )
        ),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'model' }, t('setModel')),
          h(
            'select',
            { id: 'model', onchange: (e) => ((st.model = e.target.value), save()) },
            ...[
              ['claude-opus-5-5', 'Claude Opus 5.5'],
              ['claude-sonnet-5-5', 'Claude Sonnet 5.5'],
              ['claude-haiku-5-5', 'Claude Haiku 5.5'],
            ].map(([id, n]) => h('option', { value: id, selected: st.model === id }, n))
          )
        ),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'effort' }, t('setEffort')),
          h('select', { id: 'effort', onchange: (e) => ((st.effort = e.target.value), save()) }, ...[['low', 'effLow'], ['medium', 'effMed'], ['high', 'effHigh']].map(([id, k]) => h('option', { value: id, selected: st.effort === id }, t(k))))
        ),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'mode' }, t('setMode')),
          h('select', { id: 'mode', onchange: (e) => ((st.mode = e.target.value), save()) }, h('option', { value: 'main', selected: st.mode === 'main' }, t('modeMain')), h('option', { value: 'all', selected: st.mode === 'all' }, t('modeAll')))
        ),
        h('div', { class: 'field' }, h('label', { for: 'delay' }, t('setDelay')), h('input', { id: 'delay', type: 'number', min: '0', max: '5000', step: '100', value: st.delay, onchange: (e) => ((st.delay = +e.target.value || 0), save()) })),
        h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'images', checked: st.images, onchange: (e) => ((st.images = e.target.checked), save()) }), t('setImages'))),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'backup' }, t('setData')),
          backup,
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => ((backup.value = JSON.stringify(SWU.Deck.loadAll())), backup.select()) }, t('exportAll')),
            h(
              'button',
              {
                onclick: () => {
                  try {
                    const arr = JSON.parse(backup.value);
                    if (!Array.isArray(arr)) throw 0;
                    const cur = SWU.Deck.loadAll();
                    for (const d of arr) if (!cur.some((x) => x.id === d.id)) cur.push(d);
                    SWU.Deck.saveAll(cur);
                    flash(t('saved'));
                  } catch (e) {
                    flash(t('errJson'));
                  }
                },
              },
              t('importAll')
            )
          )
        )
      )
    );
  }

  // ---------- 啟動 ----------
  SWU.boot = function () {
    // 主人模式：網址加 ?me=nick 打開（只存在這台裝置）；?me=off 關閉
    try {
      const q = new URLSearchParams(location.search);
      const me = q.get('me');
      if (me) {
        const st = SWU.AI.settings;
        if (me === 'off') st.owner = false;
        else {
          st.owner = true;
          if (!st.playerName) st.playerName = '柏偉';
        }
        SWU.AI.save();
        q.delete('me');
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
      }
    } catch (e) {}
    SWU.initDB(window.SWU_CARDS);
    SWU.markVanillaKeywordCards();
    document.documentElement.lang = SWU.lang === 'zh' ? 'zh-Hant' : 'en';
    S.decks = SWU.Deck.loadAll();
    render();
  };
})();
