// cov14 验证：悬停国家 → 分站卡片
// 策略：暂停自转 → 悬停图例 BJS 把相机飞到北京（中国居中）→ 网格扫描悬停 → 读卡片 → 点击进入分站
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = 'https://starteday.com/zh';
const OUT = 'F:/workbuddyxingqiuge/2026-09-11-10-18-28/shots_live';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  // 1. 暂停自转（evaluate 点击，避开折叠线下的命中测试）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => /暂停|自转/.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  report.rotatePaused = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sd-rot')].find((x) => /暂停|自转/.test(x.textContent || ''));
    return b ? b.textContent.trim() : null;
  });

  // 2. 悬停图例 BJS → 相机飞向北京
  await page.hover('.sd-leg-item:has(.sd-leg-code:text("BJS"))');
  await page.waitForTimeout(1800);

  // 3. 网格扫描：读每个位置的分站卡片
  const box = await page.evaluate(() => {
    const c = document.querySelector('.sd-globe canvas');
    const r = c.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  const readCard = () => page.evaluate(() => {
    const card = document.querySelector('.sd-country-card');
    if (!card || card.style.display === 'none') return null;
    return {
      text: card.textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
      left: Math.round(card.getBoundingClientRect().left),
      top: Math.round(card.getBoundingClientRect().top),
    };
  });

  const offsets = [[0, 0], [-70, -20], [70, -30], [-40, 60], [50, 70], [-110, 40], [110, 50], [0, -90]];
  report.scan = [];
  for (const [dx, dy] of offsets) {
    await page.mouse.move(box.cx + dx, box.cy + dy);
    await page.waitForTimeout(450);
    const card = await readCard();
    report.scan.push({ dx, dy, card });
    if (dx === 0 && dy === 0 && card) {
      await page.screenshot({ path: OUT + '/cov14_china_card.png' });
    } else if (card && /暂无分站/.test(card.text)) {
      await page.screenshot({ path: OUT + '/cov14_no_station.png' });
    }
  }

  // 4. 鼠标回中国中心 → 点击 → 应进入 ?src=BJS
  await page.mouse.move(box.cx, box.cy);
  await page.waitForTimeout(500);
  const chinaCard = await readCard();
  report.chinaCardBeforeClick = chinaCard;
  await page.mouse.click(box.cx, box.cy);
  await page.waitForTimeout(1500);
  report.afterCountryClick = await page.evaluate(() => location.search);

  // 5. 选中后面板应为北京（BJS）
  report.selectedCode = await page.evaluate(() => {
    const p = document.querySelector('.sd-panel:not(.is-global) .sd-panel-code');
    return p ? p.textContent : null;
  });

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
