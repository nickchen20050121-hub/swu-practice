# SWU 練牌桌（Star Wars: Unlimited 練習用）

跟電腦 AI 對戰的 SWU 練習網站：組牌、看起手機率與牌組分析、單局或 BO3 練習。

## 怎麼開
- 直接用瀏覽器打開網站，或在本機打開 `index.html`。

## AI 對手
內建打法有 1～8 級難度。也可以到「設定」貼上 Claude API 金鑰（只存在你的瀏覽器）。

## 檔案
- `index.html`：版面與樣式
- `cards.js`：全卡資料
- `engine.js`：規則引擎；`effects.js`、`gfx.js`、`programs.js`：卡片效果
- `i18n.js`：中英文字；`deck.js`：牌組、匯入匯出、分析；`ai.js`：AI 對手；`sfx.js`：音效；`ui.js`：介面
- `tools/`：模擬對戰與測試工具
