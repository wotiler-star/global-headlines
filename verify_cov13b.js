// cov13b 验证 v2：自动巡览 / 键盘快捷键 / 实时坐标 / 本地时间修复
// 注意：信号台底部按钮可能位于首屏折叠线下方，Playwright 命中测试会被吸顶 header 遮挡，
//       统一用 evaluate el.click() 派发真实事件（React onClick 正常响应）。
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = 'https://starteday.com/zh';
const OUT = 'F:/workbuddyxingqiuge/2026-09-11-10-18-28/shots_live';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.sd-boot', { timeout: 15000 });
      await p.screenshot({ path: OUT + '/cov13b_boot.png' });
      await p.waitForSelector('.sd-globe canvas', { timeout: 60000 });
      page = p;
    } catch (e) {
      console.log(`第 ${attempt} 轮失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!page) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(2500);

  const report = {};
  const clickByText = (re) => page.evaluate((src) => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => new RegExp(src).test(x.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  }, re);
  const clickLegend = (code) => page.evaluate((c) => {
    const li = [...document.querySelectorAll('.sd-leg-item')].find((x) => x.querySelector('.sd-leg-code')?.textContent === c);
    if (li) { li.click(); return true; }
    return false;
  }, code);

  // 1. 初始化占位已消失
  report.bootGone = await page.evaluate(() => !document.querySelector('.sd-boot'));

  // 2. 实时坐标读数
  report.coord = await page.evaluate(() => document.querySelector('.sd-coord')?.textContent || null);

  // 3. AUTO 巡览
  report.autoBtnBefore = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => /AUTO|巡览/.test(x.textContent || ''));
    return b ? b.textContent.trim() : null;
  });
  report.autoClicked = await clickByText('AUTO|巡览');
  await page.waitForTimeout(500);
  report.tourOnClass = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => /AUTO|巡览/.test(x.textContent || ''));
    return b ? b.className : null;
  });
  await page.waitForFunction(() => location.search.startsWith('?src='), null, { timeout: 9000 }).catch(() => {});
  report.tourUrl = await page.evaluate(() => location.search);
  await page.screenshot({ path: OUT + '/cov13b_tour.png' });

  // 4. 键盘：→ 切换 · R 自转开关 · Esc 清除
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  report.afterArrow = await page.evaluate(() => location.search);
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  report.afterR = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => /暂停|自转/.test(x.textContent || ''));
    return b ? b.textContent.trim() : null;
  });
  await page.keyboard.press('r');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  report.afterEsc = await page.evaluate(() => location.search || '(none)');

  // 5. 选中首尔 → 本地时间应为 UTC+9 附近（非 UTC）
  report.icnClicked = await clickLegend('ICN');
  await page.waitForTimeout(1200);
  report.icnLocal = await page.evaluate(() => {
    const p = document.querySelector('.sd-panel:not(.is-global)');
    if (!p) return null;
    let v = null;
    p.querySelectorAll('.sd-metric').forEach((m) => {
      if ((m.querySelector('.sd-m-label')?.textContent || '').includes('LOCAL')) v = m.querySelector('.sd-m-val')?.textContent;
    });
    return v;
  });
  report.icnCoord = await page.evaluate(() => document.querySelector('.sd-coord')?.textContent || null);
  await page.screenshot({ path: OUT + '/cov13b_icn.png' });

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
