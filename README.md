# 由奈練牌桌（Star Wars: Unlimited 練習用）

自用的 SWU 練牌網站：跟 AI「由奈」對戰、組牌、看起手機率與牌組分析。

## 怎麼開
- 本機：直接用 Chrome／Edge 打開 `index.html`。
- 網站：把整個資料夾放到 GitHub Pages（Settings → Pages → Deploy from branch）。

## 由奈的 AI
到「設定」貼上 Claude API 金鑰（console.anthropic.com 建立）。金鑰只存在你的瀏覽器。沒有金鑰時由奈用內建打法。

## 檔案
- `index.html`：版面與樣式
- `cards.js`：全卡資料（由 `tools/build_cards.py` 從 swu-db 資料產生）
- `engine.js`：規則引擎；`effects.js`：卡片專屬效果；`i18n.js`：中英文字與卡片翻譯
- `deck.js`：牌組、匯入匯出、機率、分析、自動組牌；`ai.js`：由奈 AI；`ui.js`：介面
- `tools/sim.js`：用內建 AI 自動對打測試（`node tools/sim.js 10`）

卡圖來自 cdn.swu-db.com；卡片資料來自 swu-db.com。非官方粉絲工具。
