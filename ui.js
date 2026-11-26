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
    expFt: '匯出 Force Table', expFtHint: 'SWUDB JSON 格式，複製後到 Force Table 匯入牌組貼上', expKb: '匯出 Karabast', expKbHint: 'SWUDB JSON 格式，複製後到 Karabast 的牌組匯入貼上', expMelee: '匯出 Melee', expMeleeHint: 'Melee.gg 牌表文字格式（張數 | 卡名 | 副標），比賽報名貼牌表用', dimgBtn: '牌組圖片', dimgDownload: '下載圖片', dimgMaking: '正在產生圖片…', dimgDone: '已下載', dimgTextOnly: '已下載（有些卡圖讀不到，改用文字版）', dimgFail: '產生圖片失敗，請再試一次', lvName: '第 {0} 級', lv1: '照基本打法：先下費用合適的牌、挑好打的目標攻擊', lv2: '每一步都先預想結果，會推測你手上可能有什麼牌', lv3: '會把最好的幾個行動推演到回合結束再決定', lv4: '推演更多次，比較少被你的手牌嚇到或騙到', lv5: '從你的領袖、基地、出過的牌和比賽環境推測你的牌組，把最好的 12 個候選行動各推演 14 次，算利益也算風險（原本的最強）', lv6: '推演一路看到下一回合，每個行動都假設你手上有幾種不同的牌（想得更久）', lv7: '不作弊的最強：最好的 16 個行動各推演 28 次、看到下一回合，對你的手牌抽 2 種可能來比較，最怕被反打（想得最久）', lv8: '最高等級：想得和第 7 級一樣久，推演更準',
    setSound: '音效', setVolume: '音量', setZoom: '滑鼠指到卡片時放大顯示（手機長按）', lbYuna: '由奈', lbAdd: '新增牌組', lbRandom: '隨機比賽牌組', lbPickHint: '從左邊點一副牌組', lbBack: '返回', lbTileHint: '點牌組可以看牌表，再選給你（P1）或由奈（P2）用。', lbMine: '我的牌組（{0}）', lbMeta: '🏆 比賽得名牌組（{0}）', lbVersus: '對戰', lbSwap: '交換牌組', lbSwapNo: '由奈是隨機牌組時不能交換', lbReset: '重置牌組', lbAiTitle: '由奈設定', lbLevel: '難度：', lbStyle: '打法：', ai_level_basic: '一般', ai_level_basic_d: '只看眼前最好的一步，適合剛熟悉牌組時練習', ai_level_full: '全力', ai_level_full_d: '預想每個行動的結果，並推測你的手牌', ai_style_default: '預設', ai_style_default_d: '依場面選擇最好的走法', ai_style_aggro: '侵略', ai_style_aggro_d: '專心攻擊你的基地', ai_style_control: '控制', ai_style_control_d: '先清場、保留手牌，打長期戰', lbHomeTitle: '要怎麼跟由奈練牌？', lbSingleDesc: '打一局，馬上開始', lbBo3Desc: '照比賽規則三戰兩勝，局間可以換備牌', lbBuildDesc: '組自己的牌組，或匯入 SWUDB 牌表', dl_ground: '地面單位', dl_space: '太空單位', dl_event: '事件', dl_upgrade: '升級', dl_other: '其他', dl_side: '備牌', dvAspects: '屬性', dvDraw: '主牌', dvP1: '選為 P1（你）', dvP2: '選為 P2（由奈）', dvEdit: '編輯', dvCopyEdit: '複製並編輯',
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
    type_Leader: '領袖', type_Base: '基地', type_Unit: '單位', type_Event: '事件', type_Upgrade: '升級', mode_single: '單局', mode_bo3: '三戰兩勝（BO3）', bo3Hint: '照比賽規則：第一局隨機一方決定誰先手，之後由上一局輸的人決定；局間可以用備牌換牌（主牌至少 50 張、備牌最多 10 張）。由奈也會依你的牌型換備牌。', matchScore: '第 {0} 局後　{3} {1} : {2} 由奈', matchWin: '你贏下這場比賽！', matchLose: '這場比賽由奈贏了', nextGame: '換備牌，開始第 {0} 局', sideTitle: '第 {0} 局前換備牌', sideHint: '點按鈕在主牌和備牌之間移動。換好後主牌至少 50 張、備牌最多 10 張。', sideReset: '還原', sideConfirm: '確定，開始下一局', yunaSided: '嘿嘿，我針對你的牌換了 {0} 張備牌喔～', yunaNoSide: '這局我不換牌，用原本的牌組繼續～', addTo: '點卡片加到：', randomMeta: '🎲 隨機一套比賽得名牌組', randomMetaHint: '開打時隨機挑一套 🏆 比賽牌組（開局才知道是哪套，跟真正比賽一樣）', setName: '你的名字', setNamePh: '例如：小明', setNameHint: '由奈會用這個名字叫你（只存在這台裝置）', noOwnDecks: '你還沒有自己的牌組：可以先到「組牌器」組一副（或匯入 SWUDB 牌表），也可以直接選一套 🏆 比賽得名牌組來打。', myResources: '我的資源', used: '已用', readyRes: '可用', discardView: '點開看棄牌堆', emptyPile: '這裡還沒有牌', close: '關閉', amPlay: '出牌', amAttack: '攻擊', amAbility: '啟動能力', modePlayHint: '點一張亮起來的手牌就打出', modeAttackHint: '點一個亮起來的單位發動攻擊', sortBy: '排序', sort_number: '卡號', sort_cost: '費用', sort_name: '名稱', sort_aspect: '屬性', sort_type: '類型', sort_power: '戰力', sort_hp: '生命', sort_price: '價格', allSets: '全部系列', setsLabel: '系列（可多選）：', allArenas: '地面＋太空', arenaGround: '只看地面', arenaSpace: '只看太空', allTraits: '全部特性', allKw: '全部關鍵字', groupBy: '分組顯示', aspAll: '同時有選的屬性', aspAny: '有任一選的屬性', aspNone: '無屬性', showing: '顯示 {0} / {1}', clearFilters: '清除篩選', noAspect: '無屬性', search: '搜尋卡名或文字…', allTypes: '全部類型', legalOnly: '只看 Premier 合法', noPenalty: '只看不會被罰費', cost: '費用', any: '不限', results: '{0} 張',
    deckName: '牌組名稱', leader: '領袖', base: '基地', main: '主牌', side: '備牌', toSide: '移到備牌', toMain: '移到主牌', save: '儲存', saved: '已儲存', del: '刪除', confirmDel: '再按一次刪除',
    exportText: '匯出文字', exportJson: '匯出 SWUDB JSON', copied: '已複製', copyFail: '請手動複製下面的文字',
    autoBuild: '由奈幫我組', autoBuildQuick: '快速自動組（不用 AI）', wishes: '想要的風格（可不填，例如：偏快攻、多放哨兵）', building: '由奈組牌中…',
    analysis: '分析', prob: '起手機率', review: '由奈評語', askReview: '請由奈評估這副牌', reviewing: '由奈閱讀中…',
    score: '結構分數', curve: '費用曲線', types: '類型', arenas: '戰區', penalty: '會被罰費的卡', keywords: '關鍵字', automation: '自動化狀態', autoLearn: '請由奈讀懂這些卡（Claude）', autoLearning: '由奈正在讀卡片效果… {0}/{1}', autoNeedKey: '到「設定」輸入 Claude API 金鑰後，由奈就能把這些卡也變成自動處理（每張只需讀一次）。', autoLearned: '由奈讀懂了 {0} 張卡的效果！', autoStats: '自動處理 {0} 張／待讀懂 {1} 張', autoOk: '全部卡片效果都已自動化', autoMissing: '這些卡的文字效果會跳出手動處理：',
    avgCost: '平均費用', interaction: '解場／互動卡', probTarget: '目標', probAtLeast: '至少抽到', probMull: '起手沒抽到就重抽', probRound: '回合', probSeen: '看過張數', probP: '機率',
    probCard: '指定卡', probCat: '類別', cat2: '2 費以下單位', cat3: '3 費以下單位', catSentinel: '有哨兵的卡', catRemoval: '解場卡', probCore: '每張牌在第 1／3／5 回合前抽到的機率',
    scSize: '張數', scCurve: '前期卡比例', scAvg: '平均費用', scPenalty: '顏色罰費', scConsistency: '穩定度（3 張的比例）', scInteraction: '互動手段', scUnits: '單位比例',
    scNote: '只看牌組結構，不代表實戰勝率。', errNoLeader: '還沒選領袖', errNoBase: '還沒選基地', errTooFew: '主牌只有 {0} 張（至少 50）', errTooMany: '{0} 超過 3 張', errSide: '備牌 {0} 張（最多 10）',
    errJson: 'JSON 格式有誤', warnUnknown: '找不到：{0}', presetPQ: 'Luke Skywalker (ASH)｜起源之樹・卡希克 (HMW)｜MAGICSTAR 行星賽 PQ 版 52 張', presetA2: 'Luke Skywalker (ASH)｜起源之樹・卡希克 (HMW)｜A2 調整版 50 張', autoDeckName: '自動組牌',
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
    expFt: 'Export Force Table', expFtHint: 'SWUDB JSON; paste it into Force Table deck import', expKb: 'Export Karabast', expKbHint: 'SWUDB JSON; paste it into Karabast deck import', expMelee: 'Export Melee', expMeleeHint: 'Melee.gg decklist text (count | name | subtitle) for tournament registration', dimgBtn: 'Deck image', dimgDownload: 'Download image', dimgMaking: 'Making image…', dimgDone: 'Downloaded', dimgTextOnly: 'Downloaded (some card art could not be loaded, used text instead)', dimgFail: 'Could not make the image, please try again', lvName: 'Level {0}', lv1: 'Solid basics: plays on curve and attacks good targets', lv2: 'Looks one step ahead and guesses what is in your hand', lv3: 'Plays out the best few actions to the end of the round before deciding', lv4: 'Plays out more rounds; harder to bluff', lv5: 'Reads your deck from your leader, base, played cards and the meta, plays out its 12 best candidates 14 times each and weighs gain against risk (the old strongest)', lv6: 'Plays out into the next round and tries several possible hands for you (thinks longer)', lv7: 'Strongest fair level: plays out its 16 best candidates 28 times each into the next round, samples 2 possible hands for you and plays safest against punishes (thinks the longest)', lv8: 'Top level: thinks as long as level 7, with more accurate playouts',
    setSound: 'Sound effects', setVolume: 'Volume', setZoom: 'Enlarge cards on hover (long-press on phones)', lbYuna: 'Yuna', lbAdd: 'New deck', lbRandom: 'Random tournament deck', lbPickHint: 'Pick a deck on the left', lbBack: 'Back', lbTileHint: 'Click a deck to see its list, then pick it for you (P1) or Yuna (P2).', lbMine: 'My decks ({0})', lbMeta: '🏆 Tournament decks ({0})', lbVersus: 'Match-up', lbSwap: 'Swap decks', lbSwapNo: "Can't swap while Yuna uses a random deck", lbReset: 'Reset decks', lbAiTitle: 'Yuna settings', lbLevel: 'Difficulty:', lbStyle: 'Play style:', ai_level_basic: 'Normal', ai_level_basic_d: 'Takes the best move in front of her; good while learning a deck', ai_level_full: 'Full strength', ai_level_full_d: 'Looks ahead at each action and predicts your hand', ai_style_default: 'Default', ai_style_default_d: 'Picks the best line for the board', ai_style_aggro: 'Aggressive', ai_style_aggro_d: 'Focuses on hitting your base', ai_style_control: 'Control', ai_style_control_d: 'Clears the board, keeps cards, plays the long game', lbHomeTitle: 'How do you want to practice?', lbSingleDesc: 'One game, start right away', lbBo3Desc: 'Best of three with sideboarding between games', lbBuildDesc: 'Build your own deck or import from SWUDB', dl_ground: 'Ground units', dl_space: 'Space units', dl_event: 'Events', dl_upgrade: 'Upgrades', dl_other: 'Other', dl_side: 'Sideboard', dvAspects: 'Aspects', dvDraw: 'Draw deck', dvP1: 'Select P1 (you)', dvP2: 'Select P2 (Yuna)', dvEdit: 'Edit', dvCopyEdit: 'Copy & edit',
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
    type_Leader: 'Leader', type_Base: 'Base', type_Unit: 'Unit', type_Event: 'Event', type_Upgrade: 'Upgrade', mode_single: 'Single game', mode_bo3: 'Best of three', bo3Hint: 'Tournament style: in game 1 a random player chooses who goes first, afterwards the previous loser chooses; between games you may side in cards (main at least 50, sideboard at most 10). Yuna sides against your deck too.', matchScore: 'After game {0}: {3} {1} : {2} Yuna', matchWin: 'You won the match!', matchLose: 'Yuna won the match', nextGame: 'Sideboard and start game {0}', sideTitle: 'Sideboarding before game {0}', sideHint: 'Move cards between main deck and sideboard. Main deck at least 50, sideboard at most 10.', sideReset: 'Reset', sideConfirm: 'Confirm and start next game', yunaSided: 'Hehe, I sided in {0} cards against you~', yunaNoSide: "I'm keeping my deck as is~", addTo: 'Click adds to:', randomMeta: '🎲 Random tournament deck', randomMetaHint: 'A random 🏆 tournament deck is picked when the game starts, like a real event.', setName: 'Your name', setNamePh: 'e.g. Alex', setNameHint: 'Yuna calls you by this name (stored on this device only)', noOwnDecks: 'You have no decks yet: build one in the Deck builder (or import from SWUDB), or just pick a 🏆 tournament deck.', myResources: 'My resources', used: 'used', readyRes: 'ready', discardView: 'Click to view discard pile', emptyPile: 'No cards here yet', close: 'Close', amPlay: 'Play card', amAttack: 'Attack', amAbility: 'Action ability', modePlayHint: 'Click a highlighted hand card to play it', modeAttackHint: 'Click a highlighted unit to attack with it', sortBy: 'Sort', sort_number: 'Set #', sort_cost: 'Cost', sort_name: 'Name', sort_aspect: 'Aspect', sort_type: 'Type', sort_power: 'Power', sort_hp: 'HP', sort_price: 'Price', allSets: 'All sets', setsLabel: 'Sets (multi):', allArenas: 'Ground + Space', arenaGround: 'Ground only', arenaSpace: 'Space only', allTraits: 'All traits', allKw: 'All keywords', groupBy: 'Group', aspAll: 'Has all selected', aspAny: 'Has any selected', aspNone: 'No aspect', showing: 'Showing {0} / {1}', clearFilters: 'Clear filters', noAspect: 'Colorless', search: 'Search names or text…', allTypes: 'All types', legalOnly: 'Premier legal only', noPenalty: 'No aspect penalty', cost: 'Cost', any: 'Any', results: '{0} cards',
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
    errJson: 'Invalid JSON', warnUnknown: 'Not found: {0}', presetPQ: 'Luke Skywalker (ASH) | Origin Tree (HMW) | MAGICSTAR PQ, 52', presetA2: 'Luke Skywalker (ASH) | Origin Tree (HMW) | A2 tune, 50', autoDeckName: 'Auto-build',
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
  // ---------- 中英對照卡片資訊（放大圖、預覽、手機說明、組牌器共用） ----------
  function cardMeta(card, lang = SWU.lang) {
    const zh = lang === 'zh';
    return [
      SWU.typeName(card.t, lang),
      card.c != null ? t('cost') + ' ' + card.c : '',
      card.p != null ? card.p + '/' + card.h : card.h ? card.h + ' HP' : '',
      card.ar ? SWU.arName(card.ar, lang) : '',
      (card.tr || []).map((x) => (zh ? SWU.trName(x, 'zh') : x)).join('・'),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  function cardInfo(card, side = 'card', opt = {}) {
    const zh = SWU.lang === 'zh';
    const zn = SWU.zhName(card), zs = SWU.zhSub(card);
    const leader = card.t === 'Leader';
    const txt = (sd, lang) => SWU.cardText(card, sd, lang);
    const block = (label, zhT, enT) => {
      if (!zhT && !enT) return null;
      return h(
        'div',
        { class: 'ci-sec' },
        label ? h('div', { class: 'ci-lab' }, label) : null,
        zh && zhT && zhT !== enT ? h('div', { class: 'ci-zh' }, zhT) : null,
        enT ? h('div', { class: zh && zhT && zhT !== enT ? 'ci-en' : 'ci-zh' }, enT) : null
      );
    };
    const kws = (card.kw || []).filter((k) => k !== 'Keyword' && k !== 'Keywords');
    const secs = [];
    if (leader) {
      const first = side === 'unit' ? 'unit' : 'card';
      const second = first === 'unit' ? 'card' : 'unit';
      const lab = (sd) => (sd === 'unit' ? (zh ? '部署後（單位面）' : 'Unit side') : zh ? '領袖面' : 'Leader side');
      secs.push(block(lab(first), txt(first, 'zh'), txt(first, 'en')));
      if (first === 'card' && card.ep) secs.push(block(zh ? '史詩行動' : 'Epic Action', SWU.cardEp(card, 'zh').replace(/^史詩行動：/, ''), card.ep.replace(/^Epic Action:\s*/, '')));
      secs.push(block(lab(second), txt(second, 'zh'), txt(second, 'en')));
      if (first === 'unit' && card.ep) secs.push(block(zh ? '史詩行動' : 'Epic Action', SWU.cardEp(card, 'zh').replace(/^史詩行動：/, ''), card.ep.replace(/^Epic Action:\s*/, '')));
    } else {
      secs.push(block('', txt('card', 'zh'), txt('card', 'en')));
      if (card.ep) secs.push(block(zh ? '史詩行動' : 'Epic Action', SWU.cardEp(card, 'zh').replace(/^史詩行動：/, ''), card.ep.replace(/^Epic Action:\s*/, '')));
    }
    const nm = secs.filter(Boolean);
    return h(
      'div',
      { class: 'cinfo' + (opt.cls ? ' ' + opt.cls : '') },
      h('div', { class: 'ci-name' }, card.u ? h('span', { class: 'uniq', title: zh ? '獨特' : 'Unique' }, '✦') : null, zh && zn ? zn : card.n, zh && zs ? h('span', { class: 'ci-sub' }, '｜' + zs) : card.s ? h('span', { class: 'ci-sub' }, '｜' + card.s) : null),
      zh && zn ? h('div', { class: 'ci-en ci-ename' }, (card.u ? '✦' : '') + card.n + (card.s ? ' | ' + card.s : '')) : null,
      h('div', { class: 'ci-meta' }, cardMeta(card)),
      zh && (card.tr || []).length ? h('div', { class: 'ci-en ci-tr' }, card.tr.join(' · ')) : null,
      kws.length ? h('div', { class: 'ci-kws' }, ...kws.map((k) => h('span', { class: 'chip' }, SWU.bi(SWU.kwName(k, 'zh'), k)))) : null,
      ...(nm.length ? nm : [h('div', { class: 'ci-en' }, zh ? '（沒有能力文字）' : '(no ability text)')]),
      opt.extra || null
    );
  }
  // ---------- 卡牌版本（一般／閃卡／超空間／尊爵版／特卡／編號卡／賽事卡…） ----------
  const VER_GROUPS = [
    ['normal', '一般版', 'Normal'],
    ['foil', '閃卡', 'Foil'],
    ['hs', '超空間版', 'Hyperspace'],
    ['hsf', '超空間閃卡', 'Hyperspace Foil'],
    ['show', '特卡（展示版）', 'Showcase'],
    ['pres', '尊爵版系列', 'Prestige'],
    ['serial', '編號卡', 'Serialized'],
    ['prize', '賽事獎勵卡', 'Tournament prizes'],
    ['pack', '賽事活動包', 'Event packs'],
    ['promo', '店家活動／推廣卡', 'OP & promos'],
    ['judge', '裁判卡', 'Judge'],
    ['other', '其他特典', 'Other exclusives'],
  ];
  function verGroup(v) {
    if (v === 'Normal') return 'normal';
    if (v === 'Foil') return 'foil';
    if (v === 'Hyperspace') return 'hs';
    if (v === 'Hyperspace Foil') return 'hsf';
    if (v === 'Showcase') return 'show';
    if (/^Prestige/.test(v)) return 'pres';
    if (v === 'Serialized') return 'serial';
    if (/Judge/.test(v)) return 'judge';
    if (/Event Pack|Silver Pack|Black Pack|Token Pack/.test(v)) return 'pack';
    if (/^(PQ|SQ|RQ|GC|SS|S1|Store Showdown)\b/.test(v)) return 'prize';
    if (/OP Promo|Prerelease Promo/.test(v)) return 'promo';
    return 'other';
  }
  const VER_ZH = {
    Normal: '一般版', Foil: '閃卡', Hyperspace: '超空間版', 'Hyperspace Foil': '超空間閃卡', Showcase: '特卡', Prestige: '尊爵版', 'Prestige Foil': '尊爵閃卡', 'Prestige Serialized': '尊爵編號卡', Serialized: '編號卡',
    'OP Promo': '店家活動卡', 'OP Promo Foil': '店家活動閃卡', 'Prerelease Promo': '發售前活動卡', 'Prerelease Judge': '發售前活動裁判卡', 'Judge Program': '裁判計畫卡', 'Judge Promo': '裁判推廣卡',
    'Convention Exclusive': '展會限定', 'Costco Exclusive': 'Costco 限定', 'Gift Box': '禮盒版', 'Movie Promo': '電影推廣卡', 'Event Exclusive': '活動限定', 'S1 Leaderboard Prize': '第一季排行榜獎勵',
  };
  const VER_PRE = { PQ: '行星賽', SQ: '星區資格賽', RQ: '地區資格賽', GC: '銀河錦標賽', SS: '店家對決', 'Store Showdown': '店家對決' };
  const VER_SUF = {
    Participation: '參加獎', Judge: '裁判卡', Champion: '冠軍', Finalist: '亞軍', 'Top 4': '前 4 名', 'Top 8': '前 8 名', 'Top 16': '前 16 名', 'Top 64': '前 64 名', 'Prize Wall': '獎品牆', 'Prize Wall Foil': '獎品牆閃卡',
    'Event Pack': '活動包', 'Silver Pack': '銀包', 'Black Pack': '黑包', 'Token Pack': '代幣包', 'Day Two': '第二天晉級', 'Day Three': '第三天晉級', 'VIP Promo': 'VIP 特典', 'Staff Promo': '工作人員特典',
    'Early Badge Pickup Promo': '提早報到特典', 'Early Bird Promo': '早鳥特典', 'LCQ Participation': '最後資格賽參加獎', 'Event Exclusive': '活動限定',
  };
  function verName(v, lang = SWU.lang) {
    if (lang !== 'zh') return v;
    if (VER_ZH[v]) return VER_ZH[v];
    const m = v.match(/^(PQ|SQ|RQ|GC|SS|Store Showdown) (.+)$/);
    if (m && VER_SUF[m[2]]) return VER_PRE[m[1]] + ' ' + VER_SUF[m[2]];
    return v;
  }
  let varState = 0;
  const varWait = [];
  function loadVariants(cb) {
    if (window.SWU_VAR) return cb();
    varWait.push(cb);
    if (varState) return;
    varState = 1;
    const me = [...document.scripts].find((x) => /ui\.js/.test(x.src));
    const v = me && me.src.match(/\?v=\w+/);
    const sc = document.createElement('script');
    sc.src = 'variants.js' + (v ? v[0] : '');
    sc.onload = () => varWait.splice(0).forEach((f) => f());
    sc.onerror = () => (varState = 0);
    document.head.append(sc);
  }
  function cardVariants(card) {
    const V = window.SWU_VAR;
    if (!V) return null;
    return (V.v[card.key] || []).map(([set, num, vi, pr, tid, img]) => ({ set, num, vt: V.vt[vi], pr, tid, img: img || `https://cdn.swu-db.com/images/cards/${set}/${num}.png` }));
  }
  function versionCount(card) {
    const box = h('div', { class: 'ci-ver muted' });
    const fill = () => {
      const list = cardVariants(card) || [];
      if (!list.length) return;
      const by = {};
      for (const x of list) by[verGroup(x.vt)] = (by[verGroup(x.vt)] || 0) + 1;
      const zh = SWU.lang === 'zh';
      box.textContent = (zh ? '版本 ' : 'Versions ') + list.length + '：' + VER_GROUPS.filter((g) => by[g[0]]).map((g) => (zh ? g[1] : g[2]) + ' ' + by[g[0]]).join('、');
    };
    if (window.SWU_VAR) fill();
    else loadVariants(fill);
    return box;
  }
  function versionsBox(card) {
    const zh = SWU.lang === 'zh';
    const det = h('details', { class: 'vers' });
    const sum = h('summary', {}, zh ? '卡牌版本（載入中…）' : 'Versions (loading…)');
    det.append(sum);
    const fill = () => {
      const list = cardVariants(card) || [];
      sum.textContent = (zh ? '卡牌版本 ' : 'Versions ') + list.length;
      if (!list.length) return;
      const big = h('div', { class: 'vers-big' });
      const show = (x) => {
        big.innerHTML = '';
        big.append(
          h('img', { src: x.img, alt: card.key, loading: 'lazy' }),
          h('div', { class: 'ci-meta' }, verName(x.vt) + (zh && verName(x.vt) !== x.vt ? '（' + x.vt + '）' : '') + ' · ' + x.set + ' ' + x.num + (x.pr ? ' · $' + x.pr.toFixed(2) : ''))
        );
      };
      det.append(big);
      for (const g of VER_GROUPS) {
        const items = list.filter((x) => verGroup(x.vt) === g[0]).sort((a, b) => (a.set + a.num).localeCompare(b.set + b.num));
        if (!items.length) continue;
        det.append(
          h('div', { class: 'vers-g' }, zh ? g[1] + ' ' + g[2] : g[2]),
          h(
            'div',
            { class: 'vers-list' },
            ...items.map((x) =>
              h(
                'button',
                { class: 'vers-it', title: x.vt, onclick: (e) => (e.preventDefault(), show(x)) },
                h('span', { class: 'vers-n' }, verName(x.vt)),
                h('span', { class: 'muted' }, x.set + ' ' + x.num),
                h('span', { class: 'vers-p' }, x.pr ? '$' + x.pr.toFixed(2) : '—')
              )
            )
          )
        );
      }
    };
    det.addEventListener('toggle', () => det.open && !det._f && ((det._f = 1), loadVariants(fill)));
    if (window.SWU_VAR) {
      const list = cardVariants(card) || [];
      sum.textContent = (zh ? '卡牌版本 ' : 'Versions ') + list.length;
    } else sum.textContent = zh ? '卡牌版本（點開查看）' : 'Versions (tap to open)';
    return det;
  }
  function textFrame(card, side, stats, full) {
    const isUnitSide = side === 'unit';
    const p = stats ? stats.p : card.p;
    const hp = stats ? stats.h : card.h;
    return h(
      'div',
      { class: 'frame ' + (card.a && card.a[0] ? ASP_CLASS[card.a[0]] : 'neutral') },
      h('div', { class: 'fr-top' }, card.c != null && card.t !== 'Base' ? h('b', { class: 'fr-cost' }, isUnitSide ? '' : card.c) : null, aspectDots(card)),
      h('div', { class: 'fr-name' }, (card.u ? '✦' : '') + SWU.cardName(card)),
      card.s ? h('div', { class: 'fr-sub' }, SWU.cardSub(card)) : null,
      h('div', { class: 'fr-text' }, full ? SWU.cardText(card, side) : SWU.cardText(card, side).slice(0, 160)),
      p != null || hp != null ? h('div', { class: 'fr-stats' }, h('span', { class: 'pw' }, p != null ? p : ''), h('span', { class: 'hpv' }, hp != null ? hp : '')) : null
    );
  }
  function cardFace(card, side = 'card', opts = {}) {
    const url = imgUrl(card, side);
    const wrap = h('div', { class: 'face' + (card.t === 'Leader' || card.t === 'Base' ? ' wide' : '') + (opts.small ? ' small' : '') });
    if (url) {
      // 放大圖：先放文字版墊底，圖片載入後蓋上去（網路慢也看得到內容）
      if (opts.full) wrap.append(textFrame(card, side, opts.stats, true));
      const img = h('img', { src: url, alt: card.key, loading: opts.full ? 'eager' : 'lazy', draggable: 'false', class: opts.full ? 'zimg' : null });
      img.addEventListener('error', () => {
        if (opts.full) img.remove();
        else img.replaceWith(textFrame(card, side, opts.stats));
      });
      wrap.append(img);
    } else wrap.append(textFrame(card, side, opts.stats, opts.full));
    if (!opts.noZoom) zoomable(wrap, card, side, opts.stats);
    return wrap;
  }
  // ---------- 卡片放大：電腦滑鼠指到就放大，手機長按 ----------
  const zoom = { el: null, timer: null, cur: null, shownByPress: false };
  function zoomable(el, card, side = 'card', stats) {
    if (!card) return el;
    el._zc = { card, side, stats };
    el.setAttribute('data-zoom', '');
    return el;
  }
  function zoomEl() {
    if (!zoom.el) {
      zoom.el = h('div', { id: 'zoom', class: 'zoom', 'aria-hidden': 'true' });
      document.body.append(zoom.el);
    }
    return zoom.el;
  }
  function showZoom(face, x, y, center) {
    const zc = face._zc;
    if (!zc || SWU.AI.settings.zoom === false) return;
    const el = zoomEl();
    el.innerHTML = '';
    const big = cardFace(zc.card, zc.side, { stats: zc.stats, full: true, noZoom: true });
    el.append(big);
    if (zc.card.t === 'Leader' && zc.side === 'card' && zc.card.bimg) el.append(cardFace(zc.card, 'unit', { full: true, noZoom: true }));
    if (SWU.AI.settings.zoomText !== false) el.append(cardInfo(zc.card, zc.side, { cls: 'zinfo', extra: versionCount(zc.card) }));
    el.className = 'zoom on' + (big.classList.contains('wide') ? ' wide' : '') + (center ? ' center' : '');
    if (center) {
      el.style.left = el.style.top = '';
      return;
    }
    const r = el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight, pad = 12;
    let left = x + 24;
    if (left + r.width > W - pad) left = x - 24 - r.width;
    left = Math.max(pad, left);
    const top = Math.min(Math.max(pad, y - r.height / 2), H - r.height - pad);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function hideZoom() {
    clearTimeout(zoom.timer);
    zoom.cur = null;
    if (zoom.el) zoom.el.className = 'zoom';
  }
  function installZoom() {
    const fine = () => window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
    document.addEventListener('mouseover', (e) => {
      if (!fine()) return;
      const f = e.target.closest && e.target.closest('[data-zoom]');
      if (f === zoom.cur) return;
      clearTimeout(zoom.timer);
      if (!f || !f._zc || f.closest('#zoom, #preview, .peek')) {
        hideZoom();
        return;
      }
      zoom.cur = f;
      const { clientX: x, clientY: y } = e;
      zoom.timer = setTimeout(() => zoom.cur === f && showZoom(f, x, y), 180);
    });
    document.addEventListener('mousemove', (e) => {
      if (!zoom.cur || !zoom.el || !zoom.el.classList.contains('on')) return;
      showZoom(zoom.cur, e.clientX, e.clientY);
    });
    document.addEventListener('mousedown', hideZoom, true);
    document.addEventListener('scroll', hideZoom, true);
    // 手機長按
    let press = null;
    document.addEventListener(
      'touchstart',
      (e) => {
        const f = e.target.closest && e.target.closest('[data-zoom]');
        clearTimeout(press);
        if (!f || !f._zc || f.closest('#zoom')) return;
        press = setTimeout(() => {
          zoom.shownByPress = true;
          clearTimeout(peekTimer);
          hidePeek();
          showZoom(f, 0, 0, true);
        }, 450);
      },
      { passive: true }
    );
    const end = (e) => {
      clearTimeout(press);
      if (zoom.shownByPress) {
        zoom.shownByPress = false;
        hideZoom();
        if (e.cancelable) e.preventDefault(); // 長按放開不要算成點擊
      }
    };
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', end);
    document.addEventListener('touchmove', () => clearTimeout(press), { passive: true });
    // 手機：牌表裡的卡名列（不是卡片本身）點一下就放大，再點任何地方收起
    let tapShown = false;
    document.addEventListener(
      'click',
      (e) => {
        if (fine()) return;
        if (tapShown) {
          tapShown = false;
          hideZoom();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const f = e.target.closest && e.target.closest('[data-zoom]');
        if (!f || !f._zc || f.classList.contains('face') || e.target.closest('button')) return;
        e.preventDefault();
        e.stopPropagation();
        tapShown = true;
        showZoom(f, 0, 0, true);
      },
      true
    );
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest && e.target.closest('[data-zoom]') && zoom.shownByPress) e.preventDefault();
    });
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
  window.__swuS = () => S; // 測試用
  window.__swuRender = () => renderBoard(); // 測試用
  const isTouch = () => window.matchMedia && matchMedia('(max-width:720px), (pointer:coarse)').matches;
  function setPreview(card, side, acts, popt = {}) {
    S.preview = { card, side };
    renderPreview();
    if (isTouch() && S.tab === 'play' && S.game) {
      // 稍等一下再跳說明，讓「連點兩下」的第二下能點到卡片本身
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => showPeek(card, side, acts || [], popt), 330);
    }
  }
  // 手機：點卡片時從下方滑出的小卡片說明（可直接按按鈕打出）
  function showPeek(card, side, acts, popt = {}) {
    let el = $('#peek');
    if (!el) {
      el = h('div', { id: 'peek', class: 'peek', role: 'dialog' });
      document.body.append(el);
    }
    el.innerHTML = '';
    el.append(
      h('div', { class: 'peek-face' }, cardFace(card, side, { small: true })),
      h(
        'div',
        { class: 'peek-body' },
        h('div', { class: 'peek-head' }, h('span'), h('button', { class: 'ghost small peek-x', 'aria-label': 'close', onclick: hidePeek }, '✕')),
        cardInfo(card, side),
        acts.length ? h('div', { class: 'peek-acts' }, ...acts.map((a) => h('button', { class: 'primary', onclick: () => (hidePeek(), settle(a)) }, a.label))) : null
      )
    );
    // 手牌：說明改在上方，下方的手牌還點得到（再點一次同一張就打出）
    el.classList.toggle('top', !!popt.top);
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
    const kids = [cardFace(card, side), cardInfo(card, side, { extra: versionsBox(card) })];
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
      // 手機：先點自己的單位、再點發光的目標 → 這次攻擊的目標已經選好了
      const ft = S.forceTarget;
      if (ft && req.kind === 'target' && req.ctx && req.ctx.uid === ft.uid && req.options.some((o) => o.id === ft.target)) {
        S.forceTarget = null;
        return Promise.resolve([ft.target]);
      }
      S.forceTarget = null;
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
    S.atkSel = null;
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
    const gopts = { askInitiative: true, randomFirst: true, manualPass: 0 };
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
    S.chat = [{ who: 'yuna', text: SWU.friendMode() ? t('friendHello') : SWU.lang === 'zh' ? '嘿嘿，請多指教～我會認真打的喔 (｡･ω･｡)' : "Hehe, let's have a good game~ I'll do my best!" }];
    if (S.game) recordGame(S.game, true);
    const g = new SWU.Game([mk(mine, SWU.playerName()), mk(yuna, SWU.friendMode() ? 'AI' : SWU.lang === 'zh' ? '由奈' : 'Yuna')], [humanIO, aiPlayer], gopts);
    attachGame(g);
    showIntro(g);
  }
  // ---------- 教由奈（主人模式）：重播到由奈自我對戰的某個局面，柏偉作答，存起來給 Claude 分析 ----------
  const QKEY = 'swu.quiz.v1';
  const QuizLog = {
    list() {
      try {
        return JSON.parse(localStorage.getItem(QKEY) || '[]');
      } catch (e) {
        return [];
      }
    },
    save(a) {
      let all = QuizLog.list().filter((x) => x.id !== a.id);
      all.push(a);
      try {
        localStorage.setItem(QKEY, JSON.stringify(all.slice(-500)));
        return true;
      } catch (e) {
        return false;
      }
    },
  };
  function quizLeft() {
    const done = new Set(QuizLog.list().map((x) => x.id));
    return (window.SWU_QUIZ || []).filter((q) => !done.has(q.id) && allDecks().some((d) => d.id === q.a) && allDecks().some((d) => d.id === q.b));
  }
  function quizActText(g, a, zh) {
    if (!a) return zh ? '（沒有）' : '(none)';
    const nm = (k) => { const c = k && SWU.Deck.card(k); return c ? SWU.cardName(c) : k || ''; };
    if (a.type === 'play') return (zh ? '打出 ' : 'Play ') + nm(a.card);
    if (a.type === 'attack') return (zh ? '用 ' : 'Attack with ') + nm(a.card) + (zh ? ' 攻擊' : '') + (a.target ? ' → ' + (a.target === 'base' ? (zh ? '基地' : 'base') : nm(a.target)) : '');
    if (a.type === 'pass') return zh ? 'Pass（跳過）' : 'Pass';
    if (a.type === 'initiative') return zh ? '搶先攻' : 'Take the initiative';
    if (a.type === 'deploy') return zh ? '部署領袖' : 'Deploy leader';
    if (a.type === 'leaderAbility') return zh ? '使用領袖能力' : 'Use leader ability';
    return a.type + (a.card ? ' ' + nm(a.card) : '');
  }
  function startQuiz() {
    const left = quizLeft();
    const zh = SWU.lang !== 'en';
    if (!left.length) return toast(zh ? '題目都答完了！等由奈出新題目～' : 'All questions answered!');
    const q = left[Math.floor(Math.random() * left.length)];
    const dA = allDecks().find((d) => d.id === q.a), dB = allDecks().find((d) => d.id === q.b);
    const mk = (d, name) => ({ name, leader: SWU.Deck.card(d.leader), base: SWU.Deck.card(d.base), cards: SWU.Deck.expand(d) });
    const aiPlayer = SWU.AI.makePlayer({ say: () => {}, thinking: (v) => ((S.thinking = v), renderStatus()), error: () => {} });
    const Q = { q, done: false, logFrom: null };
    const check = (g) => {
      if (Q.done || g.replaying || !Q.ready) return;
      // 只認柏偉自己真的做出的行動（不是重播、不是其他選擇）
      const first = g.rec.slice(q.rec.length).find((r) => r.p === 0 && r.k === 'a');
      if (!first) return;
      Q.done = true;
      const act = first && first.v;
      const c = act && act.uid != null ? g.findAny(act.uid) : null;
      const mine = { type: act && act.type, card: c ? c.card.key : null };
      const myLogs = g.G.log.slice(Q.logFrom || 0).filter((l) => l.p === 0).map((l) => { try { return SWU.fmtLog(l); } catch (e) { return l.k; } });
      // 顯示結果時暫停這局（不然接下來的選擇視窗會把結果蓋掉）；按「繼續／下一題／結束」才往下打
      Q.wait = new Promise((r) => (Q.release = r));
      showQuizResult(g, Q, mine, myLogs);
    };
    // 重播期間雙方都當成電腦（單一選項自動選、不記錄），和產生題目時一模一樣，局面才不會跑掉
    const wrap = (io) => ({
      ...io,
      get isHuman() { return !!io.isHuman && Q.ready; },
      get distribute() { return Q.ready ? io.distribute : undefined; },
      get showCards() { return Q.ready ? io.showCards : undefined; },
      get autoSingle() { return !!SWU.AI.settings.autoSingle; },
      chooseAction: async (g, p, acts) => {
        check(g);
        if (Q.wait) await Q.wait;
        return io.chooseAction(g, p, acts);
      },
    });
    if (S.game) recordGame(S.game, true);
    S.match = null;
    S.chat = [{ who: 'yuna', text: zh ? '出題囉！這個局面輪到你，你會怎麼打？照平常一樣直接操作就好 (｡･ω･｡)' : 'Quiz time! Your move here — just play it as usual.' }];
    const g = new SWU.Game([mk(dA, SWU.playerName()), mk(dB, zh ? '由奈' : 'Yuna')], [wrap(humanIO), wrap(aiPlayer)], { seed: q.seed, uid0: q.uid0, replay: q.rec });
    g.quiz = Q;
    g._logged = true; // 出題局不存進一般對局紀錄
    g.on((ev) => { if (ev.type === 'replay-done') (Q.logFrom = g.G.log.length), (Q.ready = true); });
    attachGame(g);
    toast(zh ? `出題（第 ${g.G.round || q.round} 回合）：輪到你` : 'Quiz: your move');
  }
  function showQuizResult(g, Q, mine, myLogs) {
    const zh = SWU.lang !== 'en';
    const q = Q.q;
    const same = mine.type === q.ai.type && (mine.card || null) === (q.ai.card || null);
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const box = h('textarea', { rows: '3', placeholder: zh ? '為什麼這樣打？（可不填，例如：先留著等對手翻面／這張要配合某張卡）' : 'Why? (optional)' });
    if (Q.note) box.value = Q.note;
    const save = () => {
      Q.note = box.value.trim();
      QuizLog.save({ id: q.id, date: new Date().toISOString(), round: q.round, a: q.a, b: q.b, mine, myLogs, ai: q.ai, same, note: Q.note, step: q.rec.length, rec: g.rec.slice(q.rec.length, q.rec.length + 8) });
    };
    save();
    const chipOff = () => { const c = document.querySelector('.quizchip'); if (c) c.remove(); };
    chipOff();
    const look = () => {
      save();
      closeModal();
      document.body.append(h('button', { class: 'quizchip primary', onclick: () => (chipOff(), showQuizResult(g, Q, mine, myLogs)) }, zh ? '🎓 看出題結果' : '🎓 Quiz result'));
    };
    m.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, zh ? '🎓 教由奈' : '🎓 Teach the AI'),
        h('p', {}, h('b', {}, zh ? '你的選擇：' : 'You: '), quizActText(g, mine, zh)),
        myLogs.length ? h('div', { class: 'small muted' }, h('ul', {}, ...myLogs.slice(0, 6).map((x) => h('li', {}, x)))) : null,
        h('p', {}, h('b', {}, zh ? '由奈原本會：' : 'AI would: '), quizActText(g, q.ai, zh)),
        h('p', { class: 'small ' + (same ? 'ok' : 'muted') }, same ? (zh ? '一樣耶！' : 'Same!') : zh ? '不一樣～你的答案會讓由奈知道哪裡想錯' : 'Different — your answer helps the AI learn'),
        box,
        h(
          'div',
          { class: 'row end' },
          h('button', { class: 'ghost', onclick: look }, zh ? '👀 先看場面' : '👀 View board'),
          h('button', { class: 'ghost', onclick: () => (save(), closeModal(), Q.release && Q.release()) }, zh ? '繼續打完這局' : 'Keep playing'),
          h('button', { class: 'ghost', onclick: () => (save(), chipOff(), closeModal(), S.game && S.game.listeners.clear(), (S.game = null), (S.pending = null), render()) }, zh ? '結束' : 'Done'),
          h('button', { class: 'primary', onclick: () => (save(), chipOff(), closeModal(), startQuiz()) }, zh ? `下一題（剩 ${Math.max(0, quizLeft().length - 1)}）` : 'Next')
        )
      )
    );
  }
  // ---------- 開場動畫：秀出雙方領袖＋基地，再公布先後攻（點一下可略過） ----------
  function showIntro(g) {
    const old = document.querySelector('.intro');
    if (old) old.remove();
    const en = SWU.lang === 'en';
    const side = (P, cls) =>
      h('div', { class: 'introside ' + cls }, h('div', { class: 'introname' }, P.name), h('div', { class: 'introcards' }, cardFace(P.leader.card, 'leader'), cardFace(P.base.card, 'card')));
    const coin = h('div', { class: 'introcoin' }, '🪙 …');
    const el = h('div', { class: 'intro', onclick: () => el.remove() }, side(g.P(1), 'them'), h('div', { class: 'introvs' }, 'VS'), side(g.P(0), 'me'), coin, h('small', { class: 'introskip' }, en ? 'Tap to skip' : '點一下略過'));
    document.body.append(el);
    setTimeout(() => {
      const i = g.G.initiative;
      if (i != null && el.isConnected) {
        coin.textContent = '🪙 ' + (en ? `${g.P(i).name} goes first` : `${g.P(i).name} 先攻`);
        coin.classList.add('on', i === 0 ? 'me' : 'them');
      }
    }, 1400);
    setTimeout(() => el.isConnected && (el.classList.add('out'), setTimeout(() => el.remove(), 400)), 3600);
  }
  // ---------- 回上一步：用同一個亂數種子重播到上一個檢查點 ----------
  function undoTarget() {
    const g = S.game;
    if (!g || !S.pending || g.G.winner != null || !g.checkpoints || g.quiz) return null;
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
    if (old.quiz) (g.quiz = old.quiz), (g._logged = true);
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
      h('div', { class: 'revealcards' }, ...ev.cards.map((c) => h('div', { class: 'pick', onmouseenter: () => setPreview(c, 'card'), onclick: () => showPeek && showPeek(c, 'card') }, cardFace(c, 'card'), h('small', {}, SWU.cardName(c))))),
      h('button', { class: 'primary', onclick: () => el.remove() }, t('okSeen'))
    );
    document.body.append(el);
  }
  // ---------- 對手動作小動畫 ----------
  const ANIM_MS = 900;
  function animOn() {
    return SWU.AI.settings.anim !== false;
  }
  function animClass(uid, base) {
    const A = S.anim;
    if (!A || !animOn()) return null;
    const el = Date.now() - A.t0;
    if (el > ANIM_MS) return null;
    const st = { style: 'animation-delay:-' + el + 'ms' };
    if (A.kind === 'attack') {
      if (uid != null && uid === A.a) return { cls: A.p === 1 ? ' anim-lunge-down' : ' anim-lunge-up', ...st };
      if (uid != null && uid === A.d) return { cls: ' anim-hit', ...st };
      if (base != null && base === A.base) return { cls: ' anim-hit', ...st };
    }
    if (A.kind === 'play' && uid != null && uid === A.u) return { cls: ' anim-drop', ...st };
    return null;
  }
  function setAnim(a) {
    S.anim = Object.assign({ t0: Date.now() }, a);
    clearTimeout(S.animT);
    S.animT = setTimeout(() => {
      S.anim = null;
      renderBoard();
    }, ANIM_MS + 30);
  }
  function showCastPop(ev) {
    if (!animOn()) return;
    const old = document.querySelector('.castpop');
    if (old) old.remove();
    const zh = SWU.lang === 'zh';
    const el = h(
      'div',
      { class: 'castpop', onclick: () => el.remove() },
      h('small', {}, zh ? '對方打出' : 'Opponent plays'),
      cardFace(ev.card, 'card', { small: true }),
      h('b', {}, SWU.cardName(ev.card))
    );
    document.body.append(el);
    setTimeout(() => el.remove(), 1700);
  }
  // ---------- 對局紀錄（主人模式）：每局結束存在這台裝置，設定頁可下載給 Claude 分析 ----------
  const GKEY = 'swu.games.v1';
  const GameLog = {
    list() {
      try {
        return JSON.parse(localStorage.getItem(GKEY) || '[]');
      } catch (e) {
        return [];
      }
    },
    save(entry) {
      let all = GameLog.list();
      // 同一局（同種子）只留最新一筆：進行中自動存，打完再覆蓋
      if (entry.gid) all = all.filter((x) => x.gid !== entry.gid);
      all.push(entry);
      // 空間不夠就丟掉最舊的
      while (all.length) {
        try {
          localStorage.setItem(GKEY, JSON.stringify(all.slice(-80)));
          return;
        } catch (e) {
          all = all.slice(Math.max(1, Math.floor(all.length / 4)));
        }
      }
    },
    clear() {
      try {
        localStorage.removeItem(GKEY);
      } catch (e) {}
    },
  };
  SWU.GameLog = GameLog;
  function recordGame(g, unfinished) {
    if (g.quiz) return;
    // 對手資料庫：記住玩家這局出過的牌和打法（兩版都記，只存在這台裝置）
    if (!g.replaying && (g.G.winner != null || g.G.round >= 2)) try {
      SWU.OppDB && SWU.OppDB.learn(g, 0);
    } catch (e) {}
    if (!SWU.AI.settings.owner || g._logged || (g.G.winner == null && !(unfinished && (g.G.round >= 2 || (g.advice && g.advice.length))))) return;
    // 進行中（autosave）不鎖；打完或換新局才鎖
    if (unfinished !== 'auto') g._logged = true;
    const deckOf = (d) => {
      const cnt = {};
      for (const c of d.cards || []) cnt[c.key] = (cnt[c.key] || 0) + 1;
      return { leader: d.leader && d.leader.key, base: d.base && d.base.key, cards: cnt };
    };
    const st = SWU.AI.settings;
    let ver = '';
    try {
      const s = [...document.scripts].map((x) => x.src).find((x) => /engine\.js\?v=/.test(x));
      ver = s ? s.split('v=')[1] : '';
    } catch (e) {}
    GameLog.save({
      gid: String(g.seed) + ':' + String(g.uid0),
      date: new Date().toISOString(),
      ver,
      level: SWU.AI.levelNum(),
      style: st.style || 'default',
      match: S.match ? { wins: [...S.match.wins] } : null,
      winner: g.G.winner,
      youWon: g.G.winner === 0,
      unfinished: g.G.winner == null,
      rounds: g.G.round,
      bases: g.G.players.map((P) => P.base.damage),
      decks: g.decks.map(deckOf),
      seed: g.seed,
      uid0: g.uid0,
      rec: g.rec,
      advice: g.advice || [],
      log: g.G.log.map((l) => {
        try {
          return SWU.fmtLog(l, 'en');
        } catch (e) {
          return l.k;
        }
      }),
    });
  }
  // ---------- 回報問題：寫下說明，連同當下局面、最近紀錄和整局重播資料一起存起來 ----------
  const RKEY = 'swu.reports.v1';
  const Reports = {
    list() {
      try {
        return JSON.parse(localStorage.getItem(RKEY) || '[]');
      } catch (e) {
        return [];
      }
    },
    save(r) {
      let all = Reports.list();
      all.push(r);
      while (all.length) {
        try {
          localStorage.setItem(RKEY, JSON.stringify(all.slice(-40)));
          return true;
        } catch (e) {
          all = all.slice(1);
        }
      }
      return false;
    },
    clear() {
      try {
        localStorage.removeItem(RKEY);
      } catch (e) {}
    },
  };
  SWU.Reports = Reports;
  function snapUnit(g, x) {
    return {
      uid: x.uid,
      card: x.card.key,
      ctrl: x.ctrl,
      power: g.power(x),
      hp: g.hp(x),
      damage: x.damage,
      exhausted: !!x.exhausted,
      arena: x.arena,
      leader: !!x.isLeader,
      kw: Object.keys(g.kw(x)),
      upgrades: (x.upgrades || []).map((y) => y.card.key),
    };
  }
  function snapState(g) {
    const G = g.G;
    return {
      round: G.round,
      phase: G.phase,
      active: G.active,
      initiative: G.initiative,
      winner: G.winner,
      players: G.players.map((P) => ({
        name: P.idx,
        base: { card: P.base.card.key, damage: P.base.damage, upgrades: (P.base.upgrades || []).map((y) => y.card.key) },
        leader: { card: P.leader.card.key, deployed: !!P.leader.deployed, exhausted: !!P.leader.exhausted, epicUsed: !!P.leader.epicUsed },
        units: P.units.map((x) => snapUnit(g, x)),
        resources: P.resources.length,
        readyRes: P.resources.filter((r) => !r.exhausted).length,
        hand: P.idx === 0 ? P.hand.map((c) => c.card.key) : P.hand.length,
        deck: P.deck.length,
        discard: P.discard.map((c) => c.card.key),
      })),
    };
  }
  function openReport() {
    const g = S.game;
    const zh = SWU.lang !== 'en';
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const box = h('textarea', { rows: '5', placeholder: zh ? '發生了什麼？例如：對方用路克能力打我有護盾的單位，護盾沒有擋掉' : 'What went wrong? e.g. a Shield did not prevent damage' });
    const send = () => {
      const note = box.value.trim();
      let ver = '';
      try {
        const s = [...document.scripts].map((x) => x.src).find((x) => /engine\.js\?v=/.test(x));
        ver = s ? s.split('v=')[1] : '';
      } catch (e) {}
      const deckOf = (d) => {
        const cnt = {};
        for (const c of d.cards || []) cnt[c.key] = (cnt[c.key] || 0) + 1;
        return { leader: d.leader && d.leader.key, base: d.base && d.base.key, cards: cnt };
      };
      let r = null;
      try {
        r = {
          date: new Date().toISOString(),
          ver,
          note,
          level: SWU.AI.levelNum(),
          state: g ? snapState(g) : null,
          recent: g
            ? g.G.log.slice(-40).map((l) => {
                try {
                  return SWU.fmtLog(l, 'en');
                } catch (e) {
                  return l.k;
                }
              })
            : [],
          decks: g ? g.decks.map(deckOf) : null,
          seed: g && g.seed,
          uid0: g && g.uid0,
          rec: g && g.rec,
        };
      } catch (e) {
        r = { date: new Date().toISOString(), ver, note, err: String(e) };
      }
      const ok = Reports.save(r);
      closeModal();
      // 直接送到 GitHub 問題回報（開好已填內容的頁面，按 Submit 就送出）；只有主人版
      if (SWU.AI.settings.owner) try {
        const S0 = r.state;
        const uline = (x) => `${x.card}${x.leader ? ' [L]' : ''} ${x.power}/${x.hp - x.damage}hp${x.exhausted ? ' ex' : ''}${x.upgrades.length ? ' +' + x.upgrades.join('+') : ''}`;
        const ps = S0
          ? S0.players
              .map((P, i) => `P${i}${i === 0 ? ' (me)' : ' (AI)'} base ${P.base.card} dmg ${P.base.damage}; leader ${P.leader.card}${P.leader.deployed ? ' deployed' : ''}${P.leader.exhausted ? ' ex' : ''}; res ${P.readyRes}/${P.resources}; hand ${Array.isArray(P.hand) ? P.hand.join(', ') : P.hand}\n` + P.units.map((x) => '  - ' + uline(x)).join('\n'))
              .join('\n')
          : '';
        let body = `**${zh ? '說明' : 'Note'}**\n${note || '-'}\n\nver ${ver} · level ${r.level} · round ${S0 ? S0.round : '?'} ${S0 ? S0.phase : ''}\n\n**Board**\n\`\`\`\n${ps}\n\`\`\`\n**Recent log**\n\`\`\`\n${r.recent.slice(-25).join('\n')}\n\`\`\`\n`;
        if (body.length > 6000) body = body.slice(0, 6000) + '\n…';
        const title = (zh ? '回報：' : 'Report: ') + (note || '').slice(0, 60);
        const url = 'https://github.com/nickchen20050121-hub/swu-practice/issues/new?labels=report&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
        window.open(url, '_blank', 'noopener');
      } catch (e) {}
      toast(ok ? (zh ? '已記下這個問題 ✓（設定頁可下載）' : 'Report saved ✓ (download in Settings)') : zh ? '存不下來，空間不夠' : 'Could not save (storage full)');
    };
    m.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, zh ? '回報問題' : 'Report a problem'),
        h('p', { class: 'small muted' }, zh ? '會連同現在的局面和這局每一步一起存在這台裝置，之後在設定頁下載對局紀錄就會一起帶走。' : 'Saved on this device together with the current board and every move of this game. It is included when you download records in Settings.'),
        box,
        h('div', { class: 'row end' }, h('button', { class: 'ghost', onclick: closeModal }, t('cancel')), h('button', { class: 'primary', onclick: send }, zh ? '送出' : 'Save'))
      )
    );
    setTimeout(() => box.focus(), 50);
  }
  // ---------- 給由奈的建議：針對她最近的動作打字，連同當下局面存進這局的紀錄 ----------
  const AKEY = 'swu.advice.v1';
  const Advice = {
    list() {
      try {
        return JSON.parse(localStorage.getItem(AKEY) || '[]');
      } catch (e) {
        return [];
      }
    },
    save(a) {
      let all = Advice.list();
      all.push(a);
      while (all.length) {
        try {
          localStorage.setItem(AKEY, JSON.stringify(all.slice(-300)));
          return true;
        } catch (e) {
          all = all.slice(1);
        }
      }
      return false;
    },
  };
  function openAdvice() {
    const g = S.game;
    if (!g) return;
    const zh = SWU.lang !== 'en';
    const aiLines = g.G.log.filter((l) => l.p === 1).slice(-4).map((l) => {
      try {
        return SWU.fmtLog(l);
      } catch (e) {
        return l.k;
      }
    });
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const box = h('textarea', { rows: '4', placeholder: zh ? '例如：這裡應該先攻擊基地再出牌／這隻不該拿去換／應該留著先攻' : 'e.g. should have attacked the base before playing a card' });
    const send = () => {
      const note = box.value.trim();
      if (!note) return closeModal();
      let a;
      try {
        a = {
          gid: String(g.seed) + ':' + String(g.uid0),
          date: new Date().toISOString(),
          level: SWU.AI.levelNum(),
          round: g.G.round,
          phase: g.G.phase,
          step: g.rec.length,
          aiRecent: g.G.log.filter((l) => l.p === 1).slice(-4).map((l) => {
            try {
              return SWU.fmtLog(l, 'en');
            } catch (e) {
              return l.k;
            }
          }),
          note,
          state: snapState(g),
        };
      } catch (e) {
        a = { date: new Date().toISOString(), note, err: String(e) };
      }
      (g.advice = g.advice || []).push(a);
      const ok = Advice.save(a);
      try {
        recordGame(g, 'auto');
      } catch (e) {}
      closeModal();
      toast(ok ? (zh ? '記下了 ✓ 下載對局紀錄時會一起帶走' : 'Saved ✓ included when you download records') : zh ? '存不下來，空間不夠' : 'Could not save (storage full)');
    };
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
    });
    m.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, zh ? '給由奈的建議' : 'Advice for the AI'),
        aiLines.length ? h('div', { class: 'small muted' }, (zh ? '由奈最近的動作：' : 'Recent AI moves:'), h('ul', {}, ...aiLines.map((x) => h('li', {}, x)))) : null,
        h('p', { class: 'small muted' }, zh ? '會連同現在的局面一起存進這局的紀錄。由奈要等你在設定頁「下載對局紀錄」並傳給她之後才讀得到。' : 'Saved with the current board into this game record. The AI only reads it after you download records in Settings and send the file.'),
        box,
        h('div', { class: 'row end' }, h('button', { class: 'ghost advdl', onclick: () => downloadGames() }, zh ? '⬇ 下載對局紀錄' : '⬇ Download records'), h('button', { class: 'ghost', onclick: closeModal }, t('cancel')), h('button', { class: 'primary', onclick: send }, zh ? '記下' : 'Save'))
      )
    );
    setTimeout(() => box.focus(), 50);
  }
  function downloadGames() {
    const all = GameLog.list();
    const blob = new Blob([JSON.stringify({ games: all, reports: Reports.list(), advice: Advice.list(), quiz: QuizLog.list(), opponents: SWU.OppDB ? SWU.OppDB.all() : null })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date(), z = (x) => String(x).padStart(2, '0');
    // 檔名只用英數（有些瀏覽器不接受中文檔名，會變成 download）
    a.download = `SWU_Practice_Records_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}_${all.length}games.json`;
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  }
  // 關掉或切走網頁時也存一下進行中的對局
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && S.game && S.game.G.winner == null)
      try {
        recordGame(S.game, 'auto');
      } catch (e) {}
  });
  function attachGame(g) {
    S.game = g;
    g.pauseFor = (kind, p) => (p === 1 && animOn() ? new Promise((r) => setTimeout(r, kind === 'attack' ? 750 : 600)) : null);
    S.pending = null;
    g.on((ev) => {
      if (g.replaying && ev.type !== 'gameover') return;
      if (ev.type === 'replay-done') {
        renderLog();
        renderBoard();
      } else if (ev.type === 'reveal') {
        if (ev.p !== 0) showRevealPop(ev);
        renderBoard();
      } else if (ev.type === 'attack') {
        const atk = ev.atk;
        setAnim({ kind: 'attack', p: atk.p, a: atk.attacker.uid, d: atk.defender ? atk.defender.uid : null, base: atk.base ? 1 - atk.p : null });
        renderBoard();
      } else if (ev.type === 'play') {
        if (ev.u) setAnim({ kind: 'play', p: ev.u.ctrl, u: ev.u.uid });
      } else if (ev.type === 'cast') {
        if (ev.p === 1 && ev.card && ev.card.t !== 'Unit') showCastPop(ev);
      } else if (ev.type === 'log') {
        renderLog();
        renderFeed();
        SWU.sfx && SWU.sfx.onLog(g.G.log[g.G.log.length - 1]);
      }
      else if (ev.type === 'update' && g.G.round !== g._lastSavedRound && g.G.round >= 2 && !g.replaying) {
        g._lastSavedRound = g.G.round;
        try {
          recordGame(g, 'auto');
        } catch (e) {}
        renderBoard();
      } else if (ev.type === 'gameover') {
        S.pending = null;
        renderBoard();
        recordGame(g);
        const win = g.G.winner === 0;
        SWU.sfx && SWU.sfx(win ? 'win' : 'lose');
        if (S.match && g.G.winner != null && !g._counted) {
          g._counted = true;
          S.match.wins[g.G.winner]++;
          S.match.lastLoser = 1 - g.G.winner;
          // 由奈記住這局看到你用了哪些牌（之後換備牌用）
          const P0 = g.P(0);
          for (const x of [...P0.discard, ...P0.units, ...P0.units.flatMap((u) => u.upgrades || [])]) if (x && x.card && x.owner === 0 && !/Token/.test(x.card.t)) S.match.seen.push(x.card);
          renderBoard();
        }
        S.chat.push({ who: 'yuna', text: SWU.friendMode() ? t(win ? 'friendWin' : 'friendLose') : SWU.lang === 'zh' ? (win ? '唔…輸給你了，你好厲害！再來一局嘛 (≧▽≦)' : '嘿嘿，這局是我贏了～要再練一次嗎？') : win ? 'Aww, you win! Great game!' : 'Hehe, I win this one~ Again?' });
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
    document.title = t('appName');
    document.body.classList.toggle('ingame', S.tab === 'play' && !!S.game);
    document.body.classList.remove('sideopen');
    if (S.tab === 'play') S.game ? renderGameShell(v) : renderLobby(v);
    else if (S.tab === 'build') renderBuilder(v);
    else if (S.tab === 'settings') renderSettings(v);
    else v.append(h('section', { class: 'panel help', html: t('helpBody') }));
  }

  // ---------- 大廳（仿 Force Table：首頁選模式 → 左邊牌組格、右邊對戰面板） ----------
  function leaderArtCard(name) {
    return SWU.DB.list.find((c) => c.t === 'Leader' && c.n === name && c.img) || null;
  }
  function deckArt(d, extra) {
    const L = d && SWU.Deck.card(d.leader);
    const url = L && SWU.AI.settings.images ? L.img : null;
    return h(
      'div',
      { class: 'dart ' + (L && L.a && L.a[0] ? ASP_CLASS[L.a[0]] : 'neutral') + (extra ? ' ' + extra : '') },
      h('span', { class: 'dart-n' }, L ? L.n : '?'),
      url ? h('img', { src: url, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : null
    );
  }
  function isOwnDeck(d) {
    return S.decks.some((x) => x.id === d.id);
  }
  function renderLobby(v) {
    const decks = allDecks();
    if (!S.lobby.mine || !deckById(S.lobby.mine)) S.lobby.mine = decks[0] && decks[0].id;
    if (!S.lobby.yuna || (S.lobby.yuna !== 'random-meta' && !deckById(S.lobby.yuna))) S.lobby.yuna = decks.some((d) => d.meta) ? 'random-meta' : (decks[1] || decks[0] || {}).id;
    if (!S.lobby.step) S.lobby.step = 'home';
    if (S.lobby.step === 'home') return renderLobbyHome(v);
    const st = SWU.AI.settings;
    const own = decks.filter((d) => !d.meta);
    const metas = decks.filter((d) => d.meta);
    const badges = (id) => [id === S.lobby.mine ? h('b', { class: 'pbadge p1' }, 'P1') : null, id === S.lobby.yuna ? h('b', { class: 'pbadge p2' }, 'P2') : null];
    const tile = (d) =>
      h(
        'button',
        { class: 'dtile' + (d.id === S.lobby.mine || d.id === S.lobby.yuna ? ' sel' : ''), title: d.name, onclick: () => openDeckView(d) },
        deckArt(d),
        h('span', { class: 'pbadges' }, ...badges(d.id)),
        h('span', { class: 'dtile-n' }, d.event ? d.event.replace(/ \d{4}-\d{2}-\d{2}/, '') : d.name),
        SWU.Deck.validate(d).length ? h('span', { class: 'dtile-warn', title: SWU.Deck.validate(d).join('、') }, '⚠') : null
      );
    const addTile = h(
      'button',
      {
        class: 'dtile add',
        onclick: () => {
          editDeck(SWU.Deck.blank(t('newDeck')));
          S.tab = 'build';
          render();
        },
      },
      h('div', { class: 'dart neutral' }, h('span', { class: 'plus' }, '＋')),
      h('span', { class: 'dtile-n' }, t('lbAdd'))
    );
    const randTile = h(
      'button',
      { class: 'dtile' + (S.lobby.yuna === 'random-meta' ? ' sel' : ''), title: t('randomMetaHint'), onclick: () => ((S.lobby.yuna = 'random-meta'), render()) },
      h('div', { class: 'dart neutral' }, h('span', { class: 'plus' }, '🎲')),
      h('span', { class: 'pbadges' }, S.lobby.yuna === 'random-meta' ? h('b', { class: 'pbadge p2' }, 'P2') : null),
      h('span', { class: 'dtile-n' }, t('lbRandom'))
    );
    const slot = (key) => {
      const id = S.lobby[key];
      const d = id === 'random-meta' ? null : deckById(id);
      return h(
        'div',
        { class: 'vslot' },
        h('div', { class: 'vslot-art' }, d ? deckArt(d) : h('div', { class: 'dart neutral' }, h('span', { class: 'plus' }, id === 'random-meta' ? '🎲' : '？')), h('b', { class: 'pbadge ' + (key === 'mine' ? 'p1' : 'p2') }, key === 'mine' ? 'P1' : 'P2')),
        h('div', { class: 'vslot-who' }, key === 'mine' ? SWU.playerName() : t('lbYuna')),
        h('div', { class: 'vslot-n' }, d ? d.name.replace(/^🏆 /, '') : id === 'random-meta' ? t('lbRandom') : t('lbPickHint'))
      );
    };
    const optBtns = (key, list) =>
      h(
        'div',
        { class: 'aiopts' },
        ...list.map((k) =>
          h(
            'button',
            {
              class: 'aiopt' + (st[key] === k ? ' on' : ''),
              onclick: () => {
                st[key] = k;
                SWU.AI.save();
                render();
              },
            },
            h('b', {}, t('ai_' + key + '_' + k)),
            h('span', {}, t('ai_' + key + '_' + k + '_d'))
          )
        )
      );
    const ready = deckById(S.lobby.mine) && (S.lobby.yuna === 'random-meta' || deckById(S.lobby.yuna));
    v.append(
      h(
        'section',
        { class: 'qm' },
        h(
          'div',
          { class: 'qm-left' },
          h('div', { class: 'qm-head' }, h('button', { class: 'linkbtn', onclick: () => ((S.lobby.step = 'home'), render()) }, '‹ ' + t('lbBack')), h('span', { class: 'sep' }, '｜'), h('b', {}, t('mode_' + S.lobby.mode))),
          h('p', { class: 'muted small' }, t('lbTileHint')),
          h('h3', {}, t('lbMine', own.length)),
          !S.decks.length ? h('p', { class: 'muted small' }, t('noOwnDecks')) : null,
          h('div', { class: 'dgrid' }, addTile, ...own.map(tile)),
          h('h3', {}, t('lbMeta', metas.length)),
          h('div', { class: 'dgrid' }, randTile, ...metas.map(tile))
        ),
        h(
          'div',
          { class: 'qm-right panel' },
          h('h3', { class: 'qm-title' }, t('lbVersus')),
          h('div', { class: 'vsrow' }, slot('mine'), h('div', { class: 'vs' }, 'VS'), slot('yuna')),
          h(
            'div',
            { class: 'vsbtns' },
            h(
              'button',
              {
                disabled: S.lobby.yuna === 'random-meta',
                title: S.lobby.yuna === 'random-meta' ? t('lbSwapNo') : '',
                onclick: () => {
                  [S.lobby.mine, S.lobby.yuna] = [S.lobby.yuna, S.lobby.mine];
                  render();
                },
              },
              t('lbSwap')
            ),
            h(
              'button',
              {
                onclick: () => {
                  S.lobby.mine = decks[0] && decks[0].id;
                  S.lobby.yuna = metas.length ? 'random-meta' : (decks[1] || decks[0] || {}).id;
                  render();
                },
              },
              t('lbReset')
            )
          ),
          h('h3', { class: 'qm-title' }, t('lbAiTitle')),
          h('div', { class: 'aiopt-lbl' }, t('lbLevel')),
          h(
            'div',
            { class: 'lvrow', role: 'group', 'aria-label': t('lbLevel') },
            ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
              h(
                'button',
                {
                  class: 'lvbtn' + (SWU.AI.levelNum() === n ? ' on' : ''),
                  title: t('lv' + n),
                  onclick: () => {
                    st.level = n;
                    SWU.AI.save();
                    render();
                  },
                },
                String(n)
              )
            )
          ),
          h('div', { class: 'lvdesc' }, h('b', {}, t('lvName', SWU.AI.levelNum())), '　', t('lv' + SWU.AI.levelNum())),
          h('div', { class: 'aiopt-lbl' }, t('lbStyle')),
          optBtns('style', ['default', 'aggro', 'control']),
          S.lobby.mode === 'bo3' ? h('p', { class: 'muted small' }, t('bo3Hint')) : null,
          h('p', { class: 'ai-status ' + (SWU.AI.hasClaude() ? 'on' : 'off') }, SWU.AI.hasClaude() ? t('aiStatusOn', st.model) : t('aiStatusOff')),
          h('button', { class: 'primary big', onclick: () => startGame(), disabled: !ready }, t('start')),
          SWU.AI.settings.owner && (window.SWU_QUIZ || []).length ? h('button', { class: 'ghost big quizbtn', onclick: () => startQuiz() }, (SWU.lang === 'en' ? '🎓 Teach the AI' : '🎓 教由奈（出題）') + ` · ${quizLeft().length}`) : null
        )
      ),
      h('div', { id: 'modal', class: 'modal', hidden: true })
    );
  }
  function renderLobbyHome(v) {
    const modes = [
      { k: 'single', art: 'Luke Skywalker', title: t('mode_single'), desc: t('lbSingleDesc') },
      { k: 'bo3', art: 'Darth Vader', title: t('mode_bo3'), desc: t('lbBo3Desc') },
      { k: 'build', art: 'Hera Syndulla', title: t('tabBuild'), desc: t('lbBuildDesc') },
    ];
    v.append(
      h(
        'section',
        { class: 'home' },
        h('h2', { class: 'home-title' }, t('lbHomeTitle')),
        h(
          'div',
          { class: 'modecards' },
          ...modes.map((m) => {
            const c = leaderArtCard(m.art);
            return h(
              'button',
              {
                class: 'modecard ' + m.k,
                onclick: () => {
                  if (m.k === 'build') S.tab = 'build';
                  else {
                    S.lobby.mode = m.k;
                    S.lobby.step = 'pick';
                  }
                  render();
                },
              },
              h('div', { class: 'mc-art' }, c && SWU.AI.settings.images ? h('img', { src: c.img, alt: '', onerror: (e) => e.target.remove() }) : null),
              h('div', { class: 'mc-txt' }, h('b', {}, m.title), h('span', {}, m.desc))
            );
          })
        ),
        !S.decks.length ? h('p', { class: 'muted small' }, t('noOwnDecks')) : null
      )
    );
  }
  // ---------- 牌組圖片：整副牌的卡圖＋張數，可下載成 PNG ----------
  function deckImageGroups(d) {
    const order = ['ground', 'space', 'event', 'upgrade', 'other'];
    const gk = (c) => (c.t === 'Unit' ? (c.ar === 'Space' ? 'space' : 'ground') : c.t === 'Event' ? 'event' : c.t === 'Upgrade' ? 'upgrade' : 'other');
    const sortL = (a) => a.sort((x, y) => order.indexOf(gk(x[0])) - order.indexOf(gk(y[0])) || (x[0].c || 0) - (y[0].c || 0) || x[0].n.localeCompare(y[0].n));
    const list = (o) => sortL(Object.entries(o || {}).map(([k, n]) => [SWU.Deck.card(k), n]).filter((x) => x[0] && x[1] > 0));
    return { L: SWU.Deck.card(d.leader), B: SWU.Deck.card(d.base), main: list(d.main), side: list(d.side) };
  }
  function openDeckImage(d) {
    const old = document.querySelector('.viewpop');
    if (old) old.remove();
    const { L, B, main, side } = deckImageGroups(d);
    const tile = ([c, n]) => h('div', { class: 'dimg-card' }, cardFace(c, 'card'), h('b', { class: 'dimg-n' }, '×' + n));
    const status = h('span', { class: 'muted small' });
    const el = h(
      'div',
      { class: 'viewpop', onclick: (e) => e.target === el && el.remove() },
      h(
        'div',
        { class: 'dialog deckimg' },
        h('div', { class: 'dv-head' }, h('h3', {}, d.name), h('button', { class: 'ghost', 'aria-label': t('close'), onclick: () => el.remove() }, '✕')),
        h('div', { class: 'dimg-top' }, L ? cardFace(L, 'card') : null, B ? cardFace(B, 'card') : null, h('div', { class: 'muted small' }, t('dvDraw') + ' ' + SWU.Deck.count(d) + (side.length ? '　' + t('dl_side') + ' ' + side.reduce((s, x) => s + x[1], 0) : ''))),
        h('div', { class: 'dimg-grid' }, ...main.map(tile)),
        side.length ? h('h4', {}, t('dl_side')) : null,
        side.length ? h('div', { class: 'dimg-grid' }, ...side.map(tile)) : null,
        h(
          'div',
          { class: 'row end' },
          status,
          h(
            'button',
            {
              class: 'primary',
              onclick: async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                status.textContent = t('dimgMaking');
                try {
                  const r = await renderDeckPng(d);
                  const a = h('a', { href: r.url, download: ((d.name || 'deck').replace(/[^\p{L}\p{N} ()._-]+/gu, ' ').replace(/\s+/g, ' ').trim() || 'deck') + '.png' });
                  document.body.append(a);
                  a.click();
                  a.remove();
                  status.textContent = r.textOnly ? t('dimgTextOnly') : t('dimgDone');
                } catch (err) {
                  status.textContent = t('dimgFail');
                } finally {
                  btn.disabled = false;
                }
              },
            },
            '⬇ ' + t('dimgDownload')
          ),
          h('button', { onclick: () => el.remove() }, t('close'))
        )
      )
    );
    document.body.append(el);
  }
  // 卡圖要能跨網域讀取才能畫進圖片；讀不到的卡改畫文字版
  function loadCardImg(url) {
    return new Promise((res) => {
      if (!url || !SWU.AI.settings.images) return res(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const to = setTimeout(() => res(null), 8000);
      img.onload = () => (clearTimeout(to), res(img));
      img.onerror = () => (clearTimeout(to), res(null));
      img.src = url;
    });
  }
  async function renderDeckPng(d) {
    const { L, B, main, side } = deckImageGroups(d);
    const cw = 150, ch = 210, gap = 12, cols = 10, pad = 24;
    const W = pad * 2 + cols * cw + (cols - 1) * gap;
    const rowsOf = (n) => Math.ceil(n / cols);
    const wideW = 294, wideH = 210;
    const headH = 70 + wideH + 24;
    const sideH = side.length ? 44 + rowsOf(side.length) * (ch + gap) : 0;
    const H = headH + rowsOf(main.length) * (ch + gap) + sideH + pad + 24;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#0e1c2d';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#e3edf5';
    x.font = 'bold 30px "Noto Sans TC", sans-serif';
    x.fillText(d.name || '', pad, 46);
    x.font = '16px "Noto Sans TC", sans-serif';
    x.fillStyle = '#8ea3b7';
    x.textAlign = 'right';
    x.fillText(t('dvDraw') + ' ' + SWU.Deck.count(d) + (side.length ? '  ' + t('dl_side') + ' ' + side.reduce((s, q) => s + q[1], 0) : '') + '  ·  ' + t('appName'), W - pad, 46);
    x.textAlign = 'left';
    const all = [L, B, ...main.map((q) => q[0]), ...side.map((q) => q[0])].filter(Boolean);
    const imgs = new Map();
    await Promise.all([...new Set(all)].map(async (c) => imgs.set(c.key, await loadCardImg(c.img))));
    let textOnly = false;
    const ASPC = { Vigilance: '#3b78d6', Command: '#3b9653', Aggression: '#d0463a', Cunning: '#ddb02c', Heroism: '#efe9d8', Villainy: '#26262c' };
    const rr = (px, py, w, hh, r) => {
      x.beginPath();
      x.roundRect ? x.roundRect(px, py, w, hh, r) : x.rect(px, py, w, hh);
    };
    const drawText = (c, px, py, w, hh) => {
      textOnly = true;
      rr(px, py, w, hh, 10);
      x.fillStyle = '#f3f8fb';
      x.fill();
      x.lineWidth = 4;
      x.strokeStyle = ASPC[(c.a || [])[0]] || '#cbdbe5';
      x.stroke();
      x.fillStyle = '#10233d';
      x.font = 'bold 15px "Noto Sans TC", sans-serif';
      const words = (c.n || '').split(' ');
      let line = '', ly = py + 46;
      for (const wd of words) {
        if (x.measureText(line + wd).width > w - 20 && line) {
          x.fillText(line, px + 10, ly);
          line = '';
          ly += 19;
        }
        line += wd + ' ';
      }
      x.fillText(line, px + 10, ly);
      if (c.s) {
        x.font = '12px "Noto Sans TC", sans-serif';
        x.fillStyle = '#5a6d82';
        x.fillText(c.s.slice(0, 22), px + 10, ly + 18);
      }
      if (c.c != null && c.t !== 'Base') {
        x.fillStyle = '#10233d';
        x.beginPath();
        x.arc(px + 20, py + 20, 13, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#fff';
        x.font = 'bold 15px sans-serif';
        x.textAlign = 'center';
        x.fillText(String(c.c), px + 20, py + 25);
        x.textAlign = 'left';
      }
      (c.a || []).forEach((a, i) => {
        x.fillStyle = ASPC[a];
        x.beginPath();
        x.arc(px + w - 16 - i * 16, py + 18, 6, 0, Math.PI * 2);
        x.fill();
      });
      if (c.p != null || c.h != null) {
        x.font = 'bold 18px monospace';
        x.fillStyle = '#d0463a';
        if (c.p != null) x.fillText(String(c.p), px + 10, py + hh - 12);
        x.fillStyle = '#3b78d6';
        x.textAlign = 'right';
        if (c.h != null) x.fillText(String(c.h), px + w - 10, py + hh - 12);
        x.textAlign = 'left';
      }
    };
    const drawCard = (c, px, py, w, hh) => {
      const im = imgs.get(c.key);
      if (im) {
        x.save();
        rr(px, py, w, hh, 10);
        x.clip();
        x.drawImage(im, px, py, w, hh);
        x.restore();
      } else drawText(c, px, py, w, hh);
    };
    const badge = (n, px, py) => {
      const s = '×' + n;
      x.font = 'bold 20px sans-serif';
      const bw = x.measureText(s).width + 14;
      rr(px + cw - bw - 4, py + ch - 34, bw, 28, 8);
      x.fillStyle = 'rgba(0,0,0,.78)';
      x.fill();
      x.fillStyle = '#fff';
      x.fillText(s, px + cw - bw + 3, py + ch - 13);
    };
    if (L) drawCard(L, pad, 70, wideW, wideH);
    if (B) drawCard(B, pad + wideW + gap * 2, 70, wideW, wideH);
    const grid = (list, y0) => {
      list.forEach(([c, n], i) => {
        const px = pad + (i % cols) * (cw + gap), py = y0 + Math.floor(i / cols) * (ch + gap);
        drawCard(c, px, py, cw, ch);
        badge(n, px, py);
      });
    };
    grid(main, headH);
    if (side.length) {
      const sy = headH + rowsOf(main.length) * (ch + gap) + 8;
      x.fillStyle = '#e3edf5';
      x.font = 'bold 22px "Noto Sans TC", sans-serif';
      x.fillText(t('dl_side'), pad, sy + 22);
      grid(side, sy + 36);
    }
    let url;
    try {
      const blob = await new Promise((res, rej) => {
        try {
          cv.toBlob((bl) => (bl ? res(bl) : rej(new Error('blob'))), 'image/png');
        } catch (e) {
          rej(e);
        }
      });
      url = URL.createObjectURL(blob);
    } catch (e) {
      // 圖片網站不允許跨網域讀取：整張改成文字版
      imgs.clear();
      return renderDeckPngTextOnly(d);
    }
    return { url, textOnly };
  }
  async function renderDeckPngTextOnly(d) {
    const st = SWU.AI.settings.images;
    SWU.AI.settings.images = false;
    try {
      const r = await renderDeckPng(d);
      return { url: r.url, textOnly: true };
    } finally {
      SWU.AI.settings.images = st;
    }
  }
  // 點牌組：顯示牌表（領袖、基地、屬性、分類），可選 P1／P2、編輯、刪除
  function openDeckView(d) {
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '';
    const L = SWU.Deck.card(d.leader);
    const B = SWU.Deck.card(d.base);
    const asp = [...((L && L.a) || []), ...((B && B.a) || [])];
    const groups = { ground: [], space: [], event: [], upgrade: [], other: [] };
    const gkey = (c) => (c.t === 'Unit' ? (c.ar === 'Space' ? 'space' : 'ground') : c.t === 'Event' ? 'event' : c.t === 'Upgrade' ? 'upgrade' : 'other');
    for (const [k, n] of Object.entries(d.main || {})) {
      const c = SWU.Deck.card(k);
      if (c) groups[gkey(c)].push([c, n]);
    }
    const line = ([c, n]) =>
      zoomable(h('li', {}, h('span', { class: 'qty' }, n + '×'), h('span', { class: 'dl-c' }, c.c != null ? c.c : ''), h('span', { class: 'dl-n' }, SWU.cardName(c) + (c.s ? ', ' + SWU.cardSub(c) : '')), aspectDots(c)), c);
    const sortL = (a) => a.sort((x, y) => (x[0].c || 0) - (y[0].c || 0) || x[0].n.localeCompare(y[0].n));
    const sec = (k, list) => (list.length ? h('div', { class: 'dl-sec' }, h('h4', {}, t('dl_' + k) + '（' + list.reduce((s, x) => s + x[1], 0) + '）'), h('ul', {}, ...sortL(list).map(line))) : null);
    const side = Object.entries(d.side || {}).map(([k, n]) => [SWU.Deck.card(k), n]).filter((x) => x[0]);
    let delArmed = false;
    const pick = (key) => {
      S.lobby[key] = d.id;
      closeModal();
      render();
    };
    m.append(
      h(
        'div',
        { class: 'dialog deckview' },
        h('div', { class: 'dv-head' }, h('h3', {}, d.name), h('div', { class: 'dv-headbtns' }, h('button', { class: 'dimgbtn', onclick: () => openDeckImage(d) }, '🖼 ' + t('dimgBtn')), h('button', { class: 'ghost', 'aria-label': t('close'), onclick: closeModal }, '✕'))),
        h(
          'div',
          { class: 'dv-meta' },
          h('div', {}, h('i', {}, t('type_Leader') + '：'), L ? zoomable(h('span', { class: 'zlink' }, L.n + (L.s ? ', ' + L.s : '')), L) : '—'),
          h('div', {}, h('i', {}, t('type_Base') + '：'), B ? zoomable(h('span', { class: 'zlink' }, B.n + (B.s ? '（' + B.s + '）' : '')), B) : '—'),
          h('div', {}, h('i', {}, t('dvAspects') + '：'), aspectDots({ a: asp })),
          h('div', {}, h('i', {}, t('dvDraw') + '：'), t('results', SWU.Deck.count(d)) + (side.length ? '　' + t('dl_side') + ' ' + side.reduce((s, x) => s + x[1], 0) : '')),
          d.event ? h('div', { class: 'muted small' }, d.event) : null
        ),
        h('div', { class: 'dv-list' }, sec('ground', groups.ground), sec('space', groups.space), sec('event', groups.event), sec('upgrade', groups.upgrade), sec('other', groups.other), sec('side', side)),
        h(
          'div',
          { class: 'row dv-btns' },
          h('button', { class: S.lobby.mine === d.id ? 'on' : '', onclick: () => pick('mine') }, t('dvP1')),
          h('button', { class: S.lobby.yuna === d.id ? 'on' : '', onclick: () => pick('yuna') }, t('dvP2')),
          h(
            'button',
            {
              class: 'primary',
              onclick: () => {
                closeModal();
                editDeck(d);
                S.tab = 'build';
                render();
              },
            },
            isOwnDeck(d) ? t('dvEdit') : t('dvCopyEdit')
          ),
          isOwnDeck(d)
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
                    if (S.edit && S.edit.id === d.id) S.edit = null;
                    closeModal();
                    render();
                  },
                },
                t('del')
              )
            : null
        )
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
          { class: 'side', onclick: (e) => e.target.classList.contains('side') && document.body.classList.remove('sideopen') },
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
    for (const l of S.game.G.log.slice(-120)) box.append(h('div', { class: 'l' + (/^logManual/.test(l.k) ? ' warn' : /^logRound|^logRegroup/.test(l.k) ? ' sep' : '') + (l.p === 0 ? ' by-me' : l.p === 1 ? ' by-opp' : '') }, l.p != null ? h('span', { class: 'who' }, whoTag(l.p)) : null, SWU.fmtLog(l, logLang())));
    box.scrollTop = box.scrollHeight;
  }
  // 行動紀錄語言（可和介面語言分開切換）
  function logLang() {
    if (!S.logLang) {
      try {
        S.logLang = localStorage.getItem('swu.logLang') || '';
      } catch (e) {}
    }
    return S.logLang === 'zh' || S.logLang === 'en' ? S.logLang : SWU.lang;
  }
  function toggleLogLang() {
    S.logLang = logLang() === 'zh' ? 'en' : 'zh';
    try {
      localStorage.setItem('swu.logLang', S.logLang);
    } catch (e) {}
    renderLog();
    renderFeed();
  }
  function whoTag(p, lang = logLang()) {
    return p === 0 ? (lang === 'zh' ? '我' : 'Me') : lang === 'zh' ? '對方' : 'Opp';
  }
  // 桌面上的「對方做了什麼／我做了什麼」
  const FEED_SKIP = /^(logDraw|logRound|logRegroup)/;
  function feedEl() {
    const g = S.game;
    const lang = logLang();
    // 每邊各一行：最後一個主要動作，後面接它造成的結果
    const L = g ? g.G.log : [];
    const MAJOR = /^log(Play|Deploy|Attack|Ability|Pass|Initiative|Attach|Smuggle)/;
    const lineFor = (p) => {
      let i = L.length - 1;
      while (i >= 0 && !(L[i].p === p && MAJOR.test(L[i].k))) i--;
      if (i < 0) return null;
      const extra = [];
      for (let j = i + 1; j < L.length && extra.length < 3; j++) {
        if (MAJOR.test(L[j].k)) break;
        if (L[j].p === p && !FEED_SKIP.test(L[j].k)) extra.push(SWU.fmtLog(L[j], lang));
      }
      return { i, l: L[i], text: SWU.fmtLog(L[i], lang) + (extra.length ? ' → ' + extra.join(lang === 'zh' ? '，' : '; ') : '') };
    };
    const rows = [lineFor(1), lineFor(0)].filter(Boolean);
    const newest = rows.length ? Math.max(...rows.map((r) => r.i)) : -1;
    return h(
      'div',
      { id: 'feed', class: 'feed' },
      h(
        'div',
        { class: 'feed-head' },
        h('b', {}, lang === 'zh' ? '最近動作' : 'Recent actions'),
        h('button', { class: 'chip small', title: lang === 'zh' ? '切換紀錄語言' : 'Switch log language', onclick: toggleLogLang }, lang === 'zh' ? '中 / EN' : 'EN / 中'),
        h('button', { class: 'chip small fulllog', onclick: () => document.body.classList.toggle('sideopen') }, lang === 'zh' ? '全部紀錄' : 'Full log')
      ),
      rows.length
        ? h('div', { class: 'feed-rows' }, ...rows.map((r) => h('div', { class: 'feed-r ' + (r.l.p === 0 ? 'by-me' : 'by-opp') + (r.i === newest ? ' latest' : ''), title: r.text }, h('span', { class: 'who' }, whoTag(r.l.p, lang)), h('span', {}, r.text))))
        : h('div', { class: 'muted small' }, lang === 'zh' ? '還沒有動作' : 'No actions yet')
    );
  }
  function renderFeed() {
    const el = $('#feed');
    if (el) el.replaceWith(feedEl());
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
      G.winner == null ? h('span', { class: 'turn ' + (mine ? 'me' : 'them') }, mine ? t('yourTurn') : S.thinking || G.active === 1 ? t('yunaTurn') : '…') : null,
      h('button', { class: 'chip logbtn', onclick: () => document.body.classList.toggle('sideopen') }, '📜 ' + t('log')),
      h('button', { class: 'chip reportbtn', title: SWU.lang === 'en' ? 'Report a problem' : '回報問題', onclick: openReport }, '🐞 ' + (SWU.lang === 'en' ? 'Report' : '回報')),
      SWU.AI.settings.owner ? h('button', { class: 'chip advbtn', title: SWU.lang === 'en' ? 'Advice for the AI' : '給由奈的建議', onclick: openAdvice }, '💬 ' + (SWU.lang === 'en' ? 'Advice' : '建議')) : null,
      h(
        'button',
        {
          class: 'chip sndbtn',
          title: t('setSound'),
          'aria-label': t('setSound'),
          onclick: () => {
            SWU.AI.settings.sound = SWU.AI.settings.sound === false;
            SWU.AI.save();
            if (SWU.AI.settings.sound) SWU.sfx('click');
            renderStatus();
          },
        },
        SWU.AI.settings.sound === false ? '🔇' : '🔊'
      )
    );
  }
  // 手機／電腦：選了一個能攻擊的友方單位 → 它能打的目標發光，點目標就直接攻擊
  function atkTargetIds() {
    const A = S.atkSel;
    if (!A || !S.pending || S.pending.type !== 'action') return null;
    const g = S.game;
    const u = g.findUnit(A.uid);
    if (!u) return null;
    const tg = g.attackTargets(u);
    const ids = new Set(tg.units.map((x) => x.uid));
    if (tg.base) ids.add('base' + (1 - u.ctrl));
    return ids;
  }
  function atkTargetClick(id) {
    const A = S.atkSel;
    const ids = atkTargetIds();
    if (!A || !ids || !ids.has(id)) return false;
    S.atkSel = null;
    S.forceTarget = { uid: A.uid, target: id };
    clearTimeout(peekTimer);
    hidePeek();
    settle(A.act);
    return true;
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
        style: (animClass(u.uid) || {}).style || null,
        class: 'unit' + ((animClass(u.uid) || {}).cls || '') + (u.exhausted ? ' exhausted' : '') + (opt ? ' can' : '') + (acts.length ? ' act' : '') + (S.actMode === 'attack' && acts.some((x) => x.type === 'attack') ? ' hl' : '') + (selected || toolSel || S.selUid === u.uid ? ' sel' : '') + (u.isLeader ? ' leaderunit' : '') + ((atkTargetIds() || new Set()).has(u.uid) ? ' can atktg' : ''),
        tabindex: opt || acts.length ? '0' : null,
        onmouseenter: () => setPreview(card, side),
        onclick: () => clickUnit(u, opt, acts),
        onkeydown: (e) => {
          if (e.key === 'Enter') clickUnit(u, opt, acts);
        },
      },
      cardFace(card, side, { stats: { p: g.power(u), h: g.hp(u) } }),
      (() => {
        // 戰力／生命：大數字＋跟印刷數值比的加減（綠色加、紅色減）
        const dp = g.power(u) - (card.p || 0), dh = g.hp(u) - (card.h || 0);
        const sg = (x) => (x > 0 ? '+' + x : String(x));
        return h(
          'div',
          { class: 'counters' },
          h('span', { class: 'pwr', title: (SWU.lang === 'en' ? 'Power' : '戰力') + (dp ? ' ' + (card.p || 0) + sg(dp) : '') }, g.power(u), dp ? h('sup', { class: dp > 0 ? 'up' : 'down' }, sg(dp)) : null),
          u.damage ? h('span', { class: 'dmg' }, '-' + u.damage) : null,
          h('span', { class: 'hp' + (u.damage ? ' hurt' : ''), title: (SWU.lang === 'en' ? 'Remaining HP' : '剩餘生命') + ' ' + g.remaining(u) + '/' + g.hp(u) + (dh ? '（' + (card.h || 0) + sg(dh) + '）' : '') }, g.remaining(u), dh ? h('sup', { class: dh > 0 ? 'up' : 'down' }, sg(dh)) : null)
        );
      })(),
      u.upgrades.length ? upgradeBar(u) : null,
      pd && pd.type === 'distribute' && pd.alloc['u' + u.uid] ? h('span', { class: 'allocbadge' }, '+' + pd.alloc['u' + u.uid]) : null,
      h(
        'div',
        { class: 'tokens' },
        ...Object.entries(g.kw(u))
          .filter(([k, val]) => val && ['Sentinel', 'Overwhelm', 'Saboteur', 'Ambush', 'Raid', 'Restore', 'Grit', 'Hidden'].includes(k))
          .map(([k, val]) => h('span', { class: 'kw' }, kwShort(k) + (typeof val === 'number' ? val : '')))
      )
    );
    return el;
  }
  // 單位身上的升級：一小條「升級 ×N」，點開看全部升級的卡圖與加成
  function upMod(x) {
    const p = x.leaderPilot ? x.pilotMod[0] : x.card.p || 0;
    const hh = x.leaderPilot ? x.pilotMod[1] : x.card.h || 0;
    const sg = (v) => (v >= 0 ? '+' + v : String(v));
    if (x.card.n === 'Shield') return '';
    return sg(p) + '/' + sg(hh) + (x.leaderPilot ? (SWU.lang === 'en' ? ' · Pilot' : '・駕駛員') : '');
  }
  function upgradeBar(u) {
    const en = SWU.lang === 'en';
    const openUps = () => openViewPop((en ? 'Upgrades on ' : '升級：') + SWU.cardName(u.card) + '（' + u.upgrades.length + '）', u.upgrades.map((x) => x.card), u.upgrades.map(upMod));
    const n = (name) => u.upgrades.filter((x) => x.card.n === name).length;
    const sh = n('Shield'), xp = n('Experience'), wk = n('Weakness');
    const pil = u.upgrades.filter((x) => x.leaderPilot).length;
    const other = u.upgrades.length - sh - xp - wk - pil;
    const bits = [];
    if (pil) bits.push(en ? 'Pilot' : '駕駛員');
    if (other) bits.push((en ? 'Upgrade' : '升級') + (other > 1 ? other : ''));
    if (xp) bits.push((en ? 'XP' : '經驗') + xp);
    if (sh) bits.push('🛡' + (sh > 1 ? sh : ''));
    if (wk) bits.push((en ? 'Weak' : '弱點') + wk);
    return h(
      'div',
      {
        class: 'upbar',
        title: en ? (isTouch() ? 'Long-press to see all upgrades' : 'Click to see all upgrades') : isTouch() ? '長按看所有升級' : '點一下看所有升級',
        onclick: (e) => {
          // 手機：點一下當成點單位本身（不跳面板），長按才打開升級清單
          if (isTouch()) return;
          e.stopPropagation();
          openUps();
        },
        ontouchstart: (e) => {
          e.stopPropagation();
          clearTimeout(S.upTimer);
          S.upTimer = setTimeout(() => {
            S.upLong = true;
            openUps();
          }, 500);
        },
        ontouchend: () => clearTimeout(S.upTimer),
        ontouchmove: () => clearTimeout(S.upTimer),
      },
      bits.join('·')
    );
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
    if (S.upLong) {
      S.upLong = false;
      return;
    }
    if (atkTargetClick(u.uid)) return;
    if (S.actMode === 'attack') {
      const a = (acts || []).find((x) => x.type === 'attack');
      if (a) {
        S.actMode = null;
        clearTimeout(peekTimer);
        hidePeek();
        return settle(a);
      }
    }
    const atk = (acts || []).find((x) => x.type === 'attack');
    if (atk && !(S.atkSel && S.atkSel.uid === u.uid)) {
      // 第一下：選這個單位攻擊，能打的目標發光（不跳面板）
      S.atkSel = { uid: u.uid, act: atk };
      S.selUid = u.uid;
      clearTimeout(peekTimer);
      hidePeek();
      S.preview = { card: u.card, side: u.isLeader ? 'unit' : 'card' };
      renderPreview();
      renderBoard();
      return;
    }
    if (atk) {
      // 再點一下同一個單位：取消選取，有其他行動才跳出說明
      S.atkSel = null;
      S.selUid = null;
      if (acts.length > 1) setPreview(u.card, u.isLeader ? 'unit' : 'card', acts.filter((x) => x.type !== 'attack'));
      renderBoard();
      return;
    }
    S.atkSel = null;
    if (tapTwice('u' + u.uid) && doPrimary(acts)) return;
    S.selUid = u.uid;
    // 手機：沒有可以做的行動就不跳說明面板（長按可以看大圖）
    if (acts.length || !isTouch()) setPreview(u.card, u.isLeader ? 'unit' : 'card', acts);
    else {
      S.preview = { card: u.card, side: u.isLeader ? 'unit' : 'card' };
      renderPreview();
    }
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
        style: (animClass(null, pIdx) || {}).style || null,
        class: 'basecard' + ((animClass(null, pIdx) || {}).cls || '') + (baseOpt || (atkTargetIds() || new Set()).has('base' + pIdx) ? ' can' : '') + (toolSel ? ' sel' : ''),
        onmouseenter: () => setPreview(P.base.card, 'card'),
        onclick: () => {
          if (S.pending && S.pending.type === 'manual') {
            S.toolTarget = { base: pIdx };
            openManualModal();
            renderBoard();
          } else if (baseOpt) pickOption(baseOpt.id);
          else atkTargetClick('base' + pIdx);
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
      h('span', { class: 'stat' }, t('discard') + ' ', h('b', {}, P.discard.length)),
      g.G.initiative === pIdx ? h('span', { class: 'inittag' + (g.G.initiativeTaken ? ' taken' : ''), title: SWU.lang === 'en' ? 'Has the initiative token' : '先攻指示物在這邊' }, '★ ' + (SWU.lang === 'en' ? 'Initiative' : '先攻') + (g.G.initiativeTaken ? (SWU.lang === 'en' ? ' (taken)' : '（已拿）') : '')) : null,
      P.force || P._hadForce ? ((P._hadForce = true), h('span', { class: 'forcetok' + (P.force ? ' on' : ''), title: SWU.lang === 'en' ? (P.force ? 'Has the Force token' : 'No Force token') : P.force ? '有原力指示物' : '沒有原力指示物' }, P.force ? '✦ ' + t('toolForce') : '✕ ' + t('toolForce'))) : null,
      P.credits ? h('span', { class: 'stat' }, 'Credits ' + P.credits) : null
    );
    // 資源（卡背，已用的橫置）、牌庫、棄牌堆、對手手牌
    const back = (cls, title) => h('div', { class: 'cardback ' + (cls || ''), title: title || '' }, h('span', {}, '✦'));
    const res = h(
      'div',
      {
        class: 'pile resrow' + (pIdx === 0 ? ' clickable' : ''),
        title: t('resources') + ' ' + ready + '/' + P.resources.length,
        onclick: pIdx === 0 ? () => openViewPop(t('myResources'), P.resources.map((r) => r.card), P.resources.map((r) => (r.exhausted ? t('used') : t('readyRes')))) : null,
      },
      h('span', { class: 'pilelabel' }, t('resources'), h('b', {}, ' ' + ready + '/' + P.resources.length)),
      h('div', { class: 'backs' }, ...[...P.resources].sort((a, b) => a.exhausted - b.exhausted).map((r) => back(r.exhausted ? 'exh' : '')))
    );
    const top = P.discard[P.discard.length - 1];
    const piles = h(
      'div',
      { class: 'piles' },
      res,
      pIdx === 1 ? h('div', { class: 'pile handrow', title: t('hand') + ' ' + P.hand.length }, h('span', { class: 'pilelabel' }, t('hand'), h('b', {}, ' ' + P.hand.length)), h('div', { class: 'backs' }, ...P.hand.map(() => back('hb')))) : null,
      h(
        'div',
        { class: 'pilepair' },
      (() => {
        // Intelligence Agency：可以隨時看自己牌庫頂
        const peek = pIdx === 0 && P.deck.length && (P.base.upgrades.some((x) => x.card.n === 'Intelligence Agency') || P.units.some((u) => u.card.key === 'Hondo Ohnaka | Plays By His Own Rules')) ? P.deck[0].card : null;
        return h('div', { class: 'pile deckpile', title: t('deck') + ' ' + P.deck.length, onmouseenter: peek ? () => setPreview(peek, 'card') : null }, peek ? cardFace(peek, 'card', { small: true }) : back('big'), h('span', { class: 'pilecount' }, P.deck.length), h('span', { class: 'pilelabel' }, t('deck')));
      })(),
      h(
        'div',
        { class: 'pile discpile clickable', title: t('discardView'), onclick: () => openViewPop(P.name + '：' + t('discard') + '（' + P.discard.length + '）', [...P.discard].reverse().map((c) => c.card)), onmouseenter: () => top && setPreview(top.card, 'card') },
        top ? h('div', { class: 'disctop' }, cardFace(top.card, 'card', { small: true })) : h('div', { class: 'cardback empty big' }),
        h('span', { class: 'pilecount' }, P.discard.length),
        h('span', { class: 'pilelabel' }, t('discard'))
      )
      )
    );
    return h(
      'div',
      { class: 'zone p' + pIdx },
      info,
      h(
        'div',
        { class: 'zbody' },
        piles,
        h(
          'div',
          { class: 'lanes' },
          h('div', { class: 'lane ground' }, h('span', { class: 'lane-label' }, t('ground')), h('div', { class: 'units' }, ...units('Ground'))),
          h('div', { class: 'center' }, baseEl, leaderEl),
          h('div', { class: 'lane space' }, h('span', { class: 'lane-label' }, t('space')), h('div', { class: 'units' }, ...units('Space')))
        )
      )
    );
  }
  // 查看棄牌堆／自己的資源（不影響進行中的選擇）
  function openViewPop(title, cards, notes) {
    const old = document.querySelector('.viewpop');
    if (old) old.remove();
    const el = h(
      'div',
      { class: 'viewpop', onclick: (e) => e.target === el && el.remove() },
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, title),
        cards.length
          ? h('div', { class: 'pickgrid' }, ...cards.map((c, i) => h('div', { class: 'pick', onmouseenter: () => setPreview(c, 'card'), onclick: () => isTouch() && showPeek(c, 'card') }, cardFace(c, 'card'), h('small', {}, SWU.cardName(c) + (notes && notes[i] ? '（' + notes[i] + '）' : '')))))
          : h('p', { class: 'muted' }, t('emptyPile')),
        h('div', { class: 'row end' }, h('button', { class: 'primary', onclick: () => el.remove() }, t('close')))
      )
    );
    document.body.append(el);
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
            class: 'handcard' + (acts.length ? ' act' : '') + (S.actMode === 'play' && acts.length ? ' hl' : '') + (S.selUid === c.uid ? ' sel' : ''),
            tabindex: acts.length ? '0' : null,
            onmouseenter: () => !isTouch() && setPreview(c.card, 'card'),
            onclick: () => {
              if (S.actMode === 'play' && acts.length) {
                S.actMode = null;
                doPrimary(acts);
                return;
              }
              // 點一下選起來，再點同一張就打出（不用快速連點）
              if (S.selUid === c.uid && acts.length) {
                S.selUid = null;
                if (doPrimary(acts)) return;
              }
              S.selUid = c.uid;
              setPreview(c.card, 'card', acts, { top: true });
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
    if (!S.pending || S.pending.type !== 'action') S.actMode = null;
    const el = promptBar0();
    const u = undoTarget();
    if (u && !(S.pending && S.pending.type === 'action')) el.append(h('button', { class: 'ghost undobtn', title: u.mid ? t('undoMid') : t('undoHint'), onclick: doUndo }, '↶ ' + t('undo')));
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
          zoomable(h('span', { class: 'grow' }, (c ? SWU.cardName(c) + (c.s ? ' – ' + SWU.cardSub(c) : '') : k) + ' ×' + n), c),
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
        h('div', { class: 'pickgrid' }, ...pd.cards.map((c) => h('div', { class: 'pick', onmouseenter: () => setPreview(c.card, 'card') }, cardFace(c.card, 'card'), h('small', {}, SWU.cardName(c.card))))),
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
      const pass = pd.acts.find((a) => a.type === 'pass');
      const init = pd.acts.find((a) => a.type === 'initiative');
      const plays = pd.acts.filter((a) => a.type === 'play');
      const attacks = pd.acts.filter((a) => a.type === 'attack');
      const abil = pd.acts.filter((a) => !['play', 'attack', 'pass', 'initiative'].includes(a.type));
      const u = undoTarget();
      const mode = S.actMode;
      // 像 Force Table 的動作選單：不能用的變灰；出牌／攻擊會把可選的牌標亮，點一下就執行
      const mb = (key, label, n, on, onclick, cls) => h('button', { class: 'ambtn ' + (cls || '') + (mode === key ? ' on' : ''), disabled: !on, onclick }, label, n ? h('small', {}, ' ' + n) : null);
      const toggle = (k) => () => {
        S.actMode = S.actMode === k ? null : k;
        renderBoard();
      };
      return h(
        'div',
        { class: 'promptbar' },
        h('b', {}, t('yourTurn')),
        h('span', { class: 'muted hint' }, mode === 'play' ? t('modePlayHint') : mode === 'attack' ? t('modeAttackHint') : t('tapTwice')),
        h('span', { class: 'grow' }),
        h(
          'div',
          { class: 'actmenu' },
          mb('play', t('amPlay'), plays.length, plays.length, toggle('play')),
          mb('attack', t('amAttack'), attacks.length, attacks.length, toggle('attack')),
          mb('ability', t('amAbility'), abil.length, abil.length, () => (abil.length === 1 ? settle(abil[0]) : openMenu(abil))),
          init ? h('button', { class: 'ambtn inittok take', title: t('initTokenTake'), onclick: () => askInitiative(init) }, h('span', { class: 'coin' }, '★'), t('initToken')) : mb('init', t('initToken'), 0, false, null),
          pass ? h('button', { class: 'ambtn passbtn', onclick: () => settle(pass) }, t('passBig')) : mb('pass', t('passBig'), 0, false, null),
          mb('undo', '↶ ' + t('undo'), 0, !!u, doUndo, 'undobtn'),
          h('button', { class: 'ambtn ghost', onclick: () => openManualModal(true) }, t('manualTools'))
        )
      );
    }
    if (pd.type === 'choose') {
      const req = pd.req;
      const min = req.min == null ? 1 : req.min;
      const boardOpts = req.options.filter((o) => o.uid != null);
      const listOpts = req.options.filter((o) => o.uid == null);
      const src = S.game && S.game.srcCard;
      // 要點場上的單位時：改成畫面底部一條小提示，不擋住場面；清單收起來，要的話再展開
      if (boardOpts.length) {
        const zh = SWU.lang !== 'en';
        const open = !!S.pickList;
        return h('div', { class: 'promptslot' }, h(
          'div',
          { class: 'promptbar asking effpop onboard' + (open ? ' open' : '') },
          h(
            'div',
            { class: 'effq' },
            src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + SWU.cardName(src)) : null,
            h('b', {}, req.prompt),
            h('small', { class: 'muted' }, zh ? '點場上發亮的單位' : 'Tap a highlighted unit')
          ),
          h('div', { class: 'pickrow' },
            ...listOpts.map((o) => h('button', { class: pd.sel.includes(o.id) ? 'on' : '', onclick: () => pickOption(o.id) }, o.label)),
            (req.max || 1) > 1 && req.kind !== 'cards' ? h('button', { class: 'primary', disabled: pd.sel.length < min, onclick: () => settle(pd.sel) }, t('confirm')) : null,
            min === 0 && req.kind !== 'yesno' ? h('button', { class: 'ghost', onclick: () => settle([]) }, t('skip')) : null,
            h('button', { class: 'ghost small', onclick: () => ((S.pickList = !open), renderBoard()) }, open ? (zh ? '收起 ▾' : 'Hide ▾') : (zh ? '清單 ▴' : 'List ▴'))
          ),
          open ? h('div', { class: 'picklist' }, ...boardOpts.map((o) => h('button', { class: 'ghost small' + (pd.sel.includes(o.id) ? ' on' : ''), onmouseenter: () => hilite(o.uid), onclick: () => pickOption(o.id) }, o.label))) : null
        ));
      }
      return h(
        'div',
        { class: 'promptbar asking effpop' },
        src ? h('div', { class: 'effsrc', onmouseenter: () => setPreview(src, 'card') }, cardFace(src, 'card')) : null,
        h('div', { class: 'effq' }, src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + SWU.cardName(src)) : null, h('b', {}, req.prompt)),
        req.kind === 'cards' ? h('button', { onclick: openCardsModal }, t('select')) : null,
        ...listOpts.map((o) => h('button', { class: pd.sel.includes(o.id) ? 'on' : '', onclick: () => pickOption(o.id) }, o.label)),
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
          src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + SWU.cardName(src)) : null,
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
    if (req.ctx && req.ctx.mulligan && S.game) {
      // 重抽起手：把手牌放大、亮亮的擺在視窗裡，看清楚再決定
      const hand = S.game.P(0).hand;
      const en = SWU.lang === 'en';
      const O = S.game.P(1), fi = S.game.G.initiative;
      const peekBoard = () => {
        m.hidden = true;
        const b = h('button', { class: 'primary mullback', onclick: () => ((m.hidden = false), b.remove()) }, en ? 'Back to mulligan' : '回到留牌');
        document.body.append(b);
      };
      m.append(
        h(
          'div',
          { class: 'dialog mulldlg' },
          h(
            'div',
            { class: 'mullopp' },
            h('span', { class: 'muted small' }, en ? 'Opponent' : '對手'),
            h('div', { class: 'mulloppcards', onclick: () => showPeek && showPeek(O.leader.card, 'leader') }, cardFace(O.leader.card, 'leader')),
            h('div', { class: 'mulloppcards', onclick: () => showPeek && showPeek(O.base.card, 'card') }, cardFace(O.base.card, 'card')),
            h('div', { class: 'mullinfo' }, h('b', {}, SWU.cardName(O.leader.card)), h('br'), h('span', { class: 'small muted' }, SWU.cardName(O.base.card)), h('br'), fi != null ? h('span', { class: 'small' }, '🪙 ' + (en ? (fi === 0 ? 'You go first' : 'Opponent goes first') : fi === 0 ? '你先攻' : '對手先攻')) : null, (() => {
              // 牌型：誰是進攻方（指南第六段：開局先決定角色）
              try {
                const HH = SWU.AI.heur, A = HH.ARCH, gg = S.game;
                const ma = A[HH.archOf(gg.decks[0])], oa = A[HH.archOf(gg.decks[1])];
                const role = ma.speed < oa.speed ? (en ? 'You are the beatdown: pressure the base' : '你是進攻方：主動搶血') : ma.speed > oa.speed ? (en ? 'You are the control: trade and outlast' : '你是防守方：先守住、拖後期') : en ? 'Even speed: fight for the board' : '速度差不多：爭場面';
                return h('div', { class: 'small archinfo' }, (en ? 'Archetypes: ' : '牌型：') + (en ? ma.en : ma.zh) + ' vs ' + (en ? oa.en : oa.zh), h('br'), h('b', {}, role));
              } catch (e) {
                return null;
              }
            })()),
            h('button', { class: 'ghost small mullpeek', onclick: peekBoard }, en ? '👁 Board' : '👁 看場面')
          ),
          h('h3', {}, req.prompt),
          h('div', { class: 'mullhand' }, ...hand.map((c) => cardFace(c.card, 'card'))),
          h('div', { class: 'mullbtns' }, ...req.options.map((o, i) => h('button', { class: i === 0 ? 'primary' : '', onclick: () => settle([o.id]) }, o.label)))
        )
      );
      return;
    }
    m.append(
      h(
        'div',
        { class: 'dialog small effdlg' },
        src ? h('div', { class: 'effdlg-card' }, cardFace(src, 'card')) : null,
        src ? h('small', { class: 'muted' }, t('effectFrom') + '：' + SWU.cardName(src)) : null,
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
    b.append(statusBar(), feedEl(), playerZone(1), promptBar(), playerZone(0), handEl());
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
              h('small', {}, card ? SWU.cardName(card) : o.label)
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
        info ? h('div', { class: 'manual-card' }, cardFace(info.card, 'card', { small: true }), h('div', {}, h('b', {}, SWU.cardName(info.card) + (info.card.s ? '｜' + SWU.cardSub(info.card) : '')), h('p', {}, SWU.lang === 'zh' && SWU.hasZh(info.card) ? SWU.cardText(info.card) : info.text), h('p', { class: 'muted small' }, t('manualHint')))) : null,
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
      if (q && !(c.key.toLowerCase().includes(q) || (c.tx || '').toLowerCase().includes(q) || (c.tr || []).join(' ').toLowerCase().includes(q) || SWU.zhName(c).includes(q) || SWU.zhSub(c).includes(q) || (c.tr || []).some((x) => SWU.trName(x, 'zh').includes(q)) || (SWU.ZH[c.key] && (SWU.ZH[c.key].tx || '').includes(q)))) return false;
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
    renderBuilderBody({ deckOnly: c.t !== 'Leader' && c.t !== 'Base' });
  }
  function removeCard(key, zone = 'main') {
    const d = S.edit;
    if (!d[zone][key]) return;
    d[zone][key]--;
    if (!d[zone][key]) delete d[zone][key];
    d.dirty = true;
    renderBuilderBody({ deckOnly: true });
  }
  function renderBuilder(v) {
    S.decks = SWU.Deck.loadAll();
    // 進組牌器預設開一副新的空牌組；要改舊牌組就從左邊「我的牌組」點進去（避免加到舊牌組上）
    if (!S.edit) editDeck(SWU.Deck.blank(t('newDeck')));
    v.append(h('div', { class: 'builder', id: 'builder' }));
    renderBuilderBody();
  }
  function renderBuilderBody(opts = {}) {
    const root = $('#builder');
    if (!root) return;
    // 只加減卡：搜尋結果不重畫（重畫會讓上方高度變動、手機畫面跳動），只更新那張卡的「已在牌組」標記
    if (opts.deckOnly && root.children.length === 3) {
      const winY0 = window.scrollY;
      const anchorKey0 = S.anchor;
      S.anchor = null;
      const find0 = () => (anchorKey0 ? [...root.querySelectorAll('[data-anchor]')].find((x) => x.getAttribute('data-anchor') === anchorKey0) : null);
      const b0 = find0();
      const bTop = b0 ? b0.getBoundingClientRect().top : null;
      root.style.minHeight = root.offsetHeight + 'px';
      root.children[0].replaceWith(deckListPanel());
      root.children[2].replaceWith(deckPanel());
      for (const el of root.querySelectorAll('.rcard[data-anchor]')) {
        const k = el.getAttribute('data-anchor').slice(2);
        const n = (S.edit.main[k] || 0) + (S.edit.side[k] || 0);
        el.classList.toggle('indeck', !!(n || S.edit.leader === k || S.edit.base === k));
      }
      root.style.minHeight = '';
      if (Math.abs(window.scrollY - winY0) > 1) window.scrollTo(0, winY0);
      const b1 = bTop != null ? find0() : null;
      if (b1) {
        const d = b1.getBoundingClientRect().top - bTop;
        if (Math.abs(d) > 1) window.scrollBy(0, d);
      }
      return;
    }
    const keepScroll = $('.results') ? $('.results').scrollTop : 0;
    const focus = document.activeElement && document.activeElement.id;
    // 手機：整頁捲動，重畫時先撐住高度、畫完把捲動位置放回去，加減卡時畫面不會跳
    const winY = window.scrollY;
    // 剛剛按的那一列／那張卡：重畫後讓它留在螢幕上同一個位置
    const anchorKey = S.anchor;
    S.anchor = null;
    const findAnchor = () => (anchorKey ? [...document.querySelectorAll('[data-anchor]')].find((x) => x.getAttribute('data-anchor') === anchorKey) : null);
    const a0 = findAnchor();
    const aTop = a0 ? a0.getBoundingClientRect().top : null;
    root.style.minHeight = root.offsetHeight + 'px';
    const next = [deckListPanel(), searchPanel(), deckPanel()];
    // 原地換掉三個區塊（不先清空），頁面高度不會瞬間變 0，手機就不會把畫面拉回上面
    if (root.children.length === next.length) [...root.children].forEach((el, i) => el.replaceWith(next[i]));
    else {
      root.innerHTML = '';
      root.append(...next);
    }
    if ($('.results')) $('.results').scrollTop = keepScroll;
    root.style.minHeight = '';
    if (Math.abs(window.scrollY - winY) > 1) window.scrollTo(0, winY);
    const a1 = aTop != null ? findAnchor() : null;
    if (a1) {
      const d = a1.getBoundingClientRect().top - aTop;
      if (Math.abs(d) > 1) window.scrollBy(0, d);
    }
    // 手機：只有剛在打字時才把游標放回搜尋框（不然點卡片加牌會跳回搜尋框、跳出鍵盤）
    if (focus && $('#' + focus) && (!isTouch() || Date.now() - (S.typedAt || 0) < 1500)) {
      const el = $('#' + focus);
      el.focus({ preventScroll: true });
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
            'data-anchor': 'r|' + c.key,
            onpointerdown: () => (S.anchor = 'r|' + c.key),
            onmouseenter: () => !isTouch() && setPreviewBuilder(c),
            onclick: () => addCard(c, f.addZone || 'main'),
            oncontextmenu: (e) => {
              e.preventDefault();
              removeCard(c.key, f.addZone || 'main');
            },
            ontouchstart: () => (press = setTimeout(() => removeCard(c.key, f.addZone || 'main'), 600)),
            ontouchend: () => clearTimeout(press),
          },
          cardFace(c, 'card', { noZoom: isTouch() }),
          n ? h('span', { class: 'count' }, '×' + n) : isSet ? h('span', { class: 'count' }, '✓') : null,
          h('small', {}, SWU.cardName(c), c.s ? ' – ' + SWU.cardSub(c) : ''),
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
            S.typedAt = Date.now();
            timer = setTimeout(() => {
              f.q = e.target.value;
              rerender();
            }, 250);
          },
        }),
        h(
          'span',
          { class: 'sortgrp' },
          sel('fsort', f.sort, (v) => (f.sort = v), ['number', 'cost', 'aspect', 'type', 'name', 'power', 'hp', 'price'].map((x) => [x, t('sortBy') + '：' + t('sort_' + x)])),
          h('button', { id: 'fdir', title: SWU.lang === 'en' ? 'Sort direction' : '排序方向', onclick: () => ((f.dir = -f.dir), rerender()) }, f.dir > 0 ? (SWU.lang === 'en' ? '↑ Asc' : '↑ 小到大') : SWU.lang === 'en' ? '↓ Desc' : '↓ 大到小')
        ),
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
        sel('ftrait', f.trait, (v) => (f.trait = v), [['', t('allTraits')], ...TRAITS.map((x) => [x, SWU.bi(SWU.trName(x, 'zh'), x)])]),
        sel('fkw', f.kw, (v) => (f.kw = v), [['', t('allKw')], ...KWS.map((x) => [x, SWU.bi(SWU.kwName(x, 'zh'), x)])])
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
    box.append(cardInfo(c, 'card', { extra: h('div', {}, c.pr ? h('div', { class: 'ci-meta' }, (SWU.lang === 'zh' ? '一般版參考價 ' : 'Normal price ') + '$' + c.pr) : null, versionsBox(c)) }));
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
            { class: 'drow', 'data-anchor': zone + '|' + k, onpointerdown: () => (S.anchor = zone + '|' + k), onmouseenter: () => c.t && !isTouch() && setPreviewBuilder(c) },
            h('span', { class: 'dc' }, c.c != null ? c.c : '·'),
            aspectDots(c),
            c.t ? zoomable(h('span', { class: 'dn' }, SWU.cardName(c), c.s ? h('small', {}, ' ' + SWU.cardSub(c)) : null, pen ? h('em', { class: 'penmark' }, ' +' + pen) : null), c) : h('span', { class: 'dn' }, c.n),
            h('button', { class: 'mini', title: '-', onmousedown: (e) => e.preventDefault(), onclick: () => removeCard(k, zone) }, '−'),
            h('b', { class: 'dq' }, n),
            h('button', { class: 'mini', title: '+', onmousedown: (e) => e.preventDefault(), onclick: () => c.t && addCard(c, zone) }, '+'),
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
                  renderBuilderBody({ deckOnly: true });
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
        h('button', { onclick: () => openDeckImage(d) }, '🖼 ' + t('dimgBtn')),
        h('button', { onclick: () => doExport(SWU.Deck.toSwudb(d)) }, t('exportJson')),
        h('button', { title: t('expFtHint'), onclick: () => doExport(SWU.Deck.toSwudb(d)) }, t('expFt')),
        h('button', { title: t('expKbHint'), onclick: () => doExport(SWU.Deck.toSwudb(d)) }, t('expKb')),
        h('button', { title: t('expMeleeHint'), onclick: () => doExport(SWU.Deck.toMelee(d)) }, t('expMelee')),
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
    const zh = SWU.lang !== 'en';
    const nG = st.owner ? GameLog.list().length : 0;
    const nR = Reports.list().length;
    const gamesField = st.owner || nR
      ? h(
          'div',
          { class: 'field' },
          h('label', {}, zh ? `對局紀錄（這台裝置存了 ${nG} 局、${nR} 個問題回報）` : `Game records (${nG} games, ${nR} reports on this device)`),
          st.owner ? h('p', { class: 'small muted' }, zh ? '每局打完會自動存下雙方每一步。下載後把檔案傳給 Claude，就能分析你怎麼贏、把電腦調強。' : 'Every finished game is saved with both players\' moves. Download and send the file to Claude to analyse and tune the AI.') : h('p', { class: 'small muted' }, zh ? '對戰中按「回報」存下的問題，可以在這裡下載成檔案。' : 'Problems saved with the in-game Report button can be downloaded here.'),
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'primary', disabled: !nG && !nR, onclick: downloadGames }, zh ? '下載對局紀錄' : 'Download records'),
            h(
              'button',
              {
                class: 'ghost',
                disabled: !nG && !nR,
                onclick: () => {
                  if (!confirm(zh ? '確定要清除這台裝置上的對局紀錄和問題回報嗎？' : 'Clear all game records and reports on this device?')) return;
                  GameLog.clear();
                  Reports.clear();
                  render();
                },
              },
              zh ? '清除' : 'Clear'
            )
          )
        )
      : null;
    const testOut = h('span', { class: 'small' });
    const backup = h('textarea', { id: 'backup', rows: '5', placeholder: t('backupHint') });
    v.append(
      h(
        'section',
        { class: 'panel settings' },
        gamesField,
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
          h('input', { id: 'pname', type: 'text', value: st.owner ? st.ownerName || '柏偉' : st.playerName && st.playerName !== '柏偉' ? st.playerName : '', maxlength: '20', placeholder: t('setNamePh'), onchange: (e) => ((st.owner ? (st.ownerName = e.target.value.trim()) : (st.playerName = e.target.value.trim())), save()) }),
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
        h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'sound', checked: st.sound !== false, onchange: (e) => ((st.sound = e.target.checked), save(), st.sound && SWU.sfx('play')) }), t('setSound'))),
        h('div', { class: 'field' }, h('label', { for: 'volume' }, t('setVolume')), h('input', { type: 'range', id: 'volume', min: 0, max: 1, step: 0.05, value: st.volume != null ? st.volume : 0.5, onchange: (e) => ((st.volume = +e.target.value), save(), SWU.sfx('hit')) })),
        h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'zoom', checked: st.zoom !== false, onchange: (e) => ((st.zoom = e.target.checked), save()) }), t('setZoom'))),
        h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'zoomText', checked: st.zoomText !== false, onchange: (e) => ((st.zoomText = e.target.checked), save()) }), SWU.lang === 'zh' ? '放大卡片時旁邊顯示中英文說明' : 'Show bilingual text next to zoomed cards')),
        h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'anim', checked: st.anim !== false, onchange: (e) => ((st.anim = e.target.checked), save()) }), SWU.lang === 'zh' ? '對手出牌、攻擊時播放小動畫（會稍微停頓讓你看清楚）' : 'Animate opponent plays and attacks (brief pause so you can follow)')),
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
    // 主人模式：只有網址帶 ?me=nick 時才開（不記在裝置上，同一台裝置開一般網址就是朋友看到的樣子）
    try {
      const q = new URLSearchParams(location.search);
      SWU.AI.settings.owner = q.get('me') === 'nick';
    } catch (e) {
      SWU.AI.settings.owner = false;
    }
    SWU.initDB(window.SWU_CARDS);
    SWU.markVanillaKeywordCards();
    document.documentElement.lang = SWU.lang === 'zh' ? 'zh-Hant' : 'en';
    S.decks = SWU.Deck.loadAll();
    installZoom();
    render();
  };
})();
