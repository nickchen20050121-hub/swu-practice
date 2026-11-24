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
- `engine.js`：規則引擎；`effects.js`：手寫的卡片專屬效果；`i18n.js`：中英文字與卡片翻譯
- `gfx.js`：通用效果系統。常見句型直接把卡片文字轉成效果步驟；轉不了的卡，開局前請 Claude 轉一次並存在瀏覽器（之後不再花費）
- `deck.js`：牌組、匯入匯出、機率、分析、自動組牌；`ai.js`：由奈 AI；`ui.js`：介面
- `tools/sim.js`：用內建 AI 自動對打測試（`node tools/sim.js 10`）；`tools/simall.js`：隨機領袖＋基地全卡池對打；`tools/coverage.js`：句型自動判讀涵蓋率
- `tools/mobile_test.js`、`tools/ui_test.js`：Playwright 介面截圖測試

## 手機
點卡片會從下方跳出說明卡，可以直接按「打出」；手牌在畫面底部可左右滑。

卡圖來自 cdn.swu-db.com；卡片資料來自 swu-db.com。非官方粉絲工具。
