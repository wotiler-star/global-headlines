// 验证 ?src=ICN 直载时信息流是否真的按首尔过滤
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (let a = 1; a <= 5; a++) {
    try {
      await page.goto('https://starteday.com/zh?src=ICN', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.sd-globe canvas', { timeout: 60000 });
      break;
    } catch (e) { console.log('attempt', a, e.message.split('\n')[0]); }
  }
  await page.waitForTimeout(6000); // 等 mounted 后的客户端渲染
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card')];
    const srcs = cards.map((c) => {
      const s = c.querySelector('.card-meta .src, .meta .src');
      return s ? s.textContent.trim() : '(none)';
    });
    const header = document.querySelector('.feed-head, .if-head, .section-title');
    return {
      cardCount: cards.length,
      srcSample: [...new Set(srcs)].slice(0, 12),
      hasStationHeader: /首尔/.test(document.body.textContent || ''),
      infiniteFeedExists: !!document.querySelector('.infinite-feed, .if-list, [class*="infinite"]'),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
