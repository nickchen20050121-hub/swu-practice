const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  pg.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text());
  });
  await pg.goto('file:///home/user/swu-site/index.html');
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: out + '1_lobby.png' });
  await pg.click('text=開始對戰');
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: out + '2_mulligan.png' });
  for (let i = 0; i < 60; i++) {
    if (await pg.$('#modal:not([hidden]) .pick')) {
      const picks = await pg.$$('#modal .pick');
      await picks[0].click();
      await pg.waitForTimeout(150);
      const p2 = await pg.$$('#modal:not([hidden]) .pick');
      if (p2.length > 1) await p2[1].click();
      await pg.waitForTimeout(150);
      const c = await pg.$('#modal:not([hidden]) button.primary:not([disabled])');
      if (c) await c.click();
      await pg.waitForTimeout(300);
      continue;
    }
    if (await pg.$('#modal:not([hidden]) .dialog.manual')) {
      await pg.click('#modal button.primary');
      continue;
    }
    if (await pg.$('#modal:not([hidden]) .dialog.small')) {
      await pg.click('#modal .dialog.small button');
      continue;
    }
    const no = await pg.$('.promptbar.asking button:has-text("否")');
    if (no) {
      await no.click();
      await pg.waitForTimeout(300);
      continue;
    }
    const hand = await pg.$('.handcard.act');
    if (hand) {
      await hand.dblclick();
      await pg.waitForTimeout(500);
      continue;
    }
    const unit = await pg.$('.zone.p0 .unit.act');
    if (unit) {
      await unit.dblclick();
      await pg.waitForTimeout(400);
      continue;
    }
    const can = await pg.$('.can');
    if (can) {
      await can.click();
      await pg.waitForTimeout(400);
      continue;
    }
    const pass = await pg.$('.promptbar .passbtn, .promptbar button:has-text("跳過")');
    if (pass) {
      await pass.click();
      await pg.waitForTimeout(800);
      continue;
    }
    await pg.waitForTimeout(600);
  }
  await pg.screenshot({ path: out + '3_board.png' });
  await pg.click('header >> text=組牌器');
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: out + '4_builder.png' });
  await pg.click('.subtabs >> text=起手機率');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '5_prob.png' });
  await pg.click('header >> text=EN');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '6_builder_en.png' });
  await pg.setViewportSize({ width: 400, height: 850 });
  await pg.click('header >> text=Play');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: out + '7_mobile.png' });
  console.log('scrollWidth@400', await pg.evaluate(() => document.documentElement.scrollWidth));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
