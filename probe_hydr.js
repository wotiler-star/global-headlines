// 定位 #418 具体元素：捕获 console error 详情 + 复现两次加载
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('=== PAGEERROR:', e.message.slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('=== CONSOLE:', m.text().slice(0, 400));
  });
  for (let round = 1; round <= 2; round++) {
    console.log(`--- 第 ${round} 次加载 ?src=NYC ---`);
    try {
      await page.goto('https://starteday.com/zh?src=NYC', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.sd-globe canvas', { timeout: 60000 });
      await page.waitForTimeout(2000);
      console.log('  加载完成, URL:', await page.evaluate(() => location.search));
    } catch (e) { console.log('  加载失败:', e.message.split('\n')[0]); }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
