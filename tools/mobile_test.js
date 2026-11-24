// 手機畫面測試：node tools/mobile_test.js 輸出資料夾/
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || './';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: out + 'm1_lobby.png' });
  await pg.tap('text=開始對戰');
  await pg.waitForTimeout(1000);
  await pg.screenshot({ path: out + 'm2_mull.png' });
  for (let i = 0; i < 40; i++) {
    if (await pg.$('#modal:not([hidden]) .pick')) {
      const picks = await pg.$$('#modal .pick');
      await picks[0].tap();
      const p2 = await pg.$$('#modal:not([hidden]) .pick');
      if (p2.length > 1) await p2[1].tap();
      const c = await pg.$('#modal:not([hidden]) button.primary:not([disabled])');
      if (c) await c.tap();
      await pg.waitForTimeout(300);
      continue;
    }
    const effNo = await pg.$('#modal:not([hidden]) .effdlg button:last-of-type');
    if (effNo) {
      await effNo.tap();
      await pg.waitForTimeout(300);
      continue;
    }
    const no = await pg.$('.promptbar.asking button:has-text("否")');
    if (no) {
      await no.tap();
      await pg.waitForTimeout(300);
      continue;
    }
    const hand = await pg.$('.handcard.act');
    if (hand && i > 6) break;
    const pass = await pg.$('.passbtn, .promptbar button:has-text("跳過")');
    if (pass) {
      await pass.tap();
      await pg.waitForTimeout(900);
      continue;
    }
    await pg.waitForTimeout(500);
  }
  await pg.screenshot({ path: out + 'm3_board.png' });
  await pg.screenshot({ path: out + 'm3_board_full.png', fullPage: true });
  const hand = await pg.$('.handcard');
  if (hand) {
    await hand.tap();
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: out + 'm4_tap.png' });
  }
  console.log('scrollWidth', await pg.evaluate(() => document.documentElement.scrollWidth), 'height', await pg.evaluate(() => document.documentElement.scrollHeight));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
