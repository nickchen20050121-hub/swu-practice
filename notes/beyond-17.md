# 17 副以外的前段領袖（2026-10-10～11-27）

來源：swumetastats API `GET /api/matchups?startDate=2026-10-10&endDate=2026-11-27&placement=top4&minPlayers=32`（2026-11-27 抓）。**注意**：`placement=top4` 的實際意思還沒確認（可能是「打進前四的牌組的所有對局」），所以場數和勝率只當排序參考。領袖能力文字來自網站 `cards.js`。

| 領袖 | 場數 | 勝率 | 屬性 | 觀念類型（推論） |
|---|---|---|---|---|
| Han Solo \| Never Tell Me the Odds | 352 | 48.6% | Cunning+Heroism | 奇數費用牌組；領袖每輪多一次攻擊；當駕駛員部署時依奇數費用張數重置資源（資源加速） |
| Obi-Wan Kenobi \| Courage Makes Heroes | 304 | 44.4% | Command+Heroism | 經驗代幣疊加（單位越養越大）、用原力 |
| Tarfful \| Fighting From the Shadowlands | 301 | 42.2% | Command+Heroism | 棄牌造 Beast 代幣＝鋪寬；部署後是哨兵（控制） |
| Grand Admiral Thrawn \| ...How Unfortunate | 228 | 39.9% | Vigilance+Villainy | 「被擊敗時」效果用兩次＝犧牲引擎（同 Krennic／Maul OM 觀念） |
| Darth Vader \| Might of the Empire | 122 | 36.1% | Command+Villainy | 3 費以上單位都有 Raid 1＝中費進攻 |

17 副裡的領袖在同一份資料的排序：Wicket 1993 場 53.5%、Ahsoka 1798／49.6%、Krennic 1535／50.2%、Hemlock 1396／50.4%、Boba 916／47.1%、Talzin 842／55.5%、Lando 817／48.8%、Maul SR 724／48.9%。

下一步：Han Solo、Obi-Wan、Tarfful、Thrawn 這 4 個場數最多，先找它們的得名牌表（`tools/build_meta_api.js`）；加進網站前先問柏偉。
