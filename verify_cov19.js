// cov19 验证：地球仪新增 7 个主要大国可交互分站
// 1) 首页地球图例出现 MOW/YTO/RUH/SAO/MAA/JNB/SYD 且信号数 > 0（原有 6 分站仍在）
// 2) ?src=MOW / ?src=SYD 信息流按分站正确过滤（显示分站标题 + 有文章卡片）
// 3) 无 pageerror
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = process.env.BASE || 'https://starteday.com/zh';
const NEW_CODES = ['MOW', 'YTO', 'RUH', 'SAO', 'MAA', 'JNB', 'SYD'];
const OLD_CODES = ['BJS', 'NYC', 'LON', 'PAR', 'ICN', 'MAD'];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const report = {};

  // ---- 1. 首页图例 ----
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('home: ' + e.message.slice(0, 160)));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.sd-leg-item', { timeout: 60000 });
      page = p;
    } catch (e) {
      console.log(`首页第 ${attempt} 轮加载失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!page) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(3000);

  report.legend = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.sd-leg-item')];
    const out = {};
    for (const el of items) {
      const code = (el.querySelector('.sd-leg-code') || {}).textContent || '';
      const cnt = (el.querySelector('.sd-leg-count') || {}).textContent || '0';
      out[code.trim()] = Number(cnt.trim()) || 0;
    }
    const head = (document.querySelector('.sd-stats') || {}).textContent || '';
    return { regions: out, head: head.trim() };
  });

  const regs = report.legend.regions;
  report.legendCheck = {
    newPresent: NEW_CODES.filter((c) => c in regs),
    newWithSignal: NEW_CODES.filter((c) => (regs[c] || 0) > 0),
    oldPresent: OLD_CODES.filter((c) => c in regs),
    regionCount: Object.keys(regs).length,
  };
  report.legendOk =
    NEW_CODES.every((c) => (regs[c] || 0) > 0) && OLD_CODES.every((c) => c in regs);
  await page.close();

  // ---- 2. ?src= 分站过滤 ----
  for (const code of ['MOW', 'SYD']) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(`src-${code}: ` + e.message.slice(0, 160)));
    try {
      await p.goto(`${BASE}/?src=${code}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.feed-card, .search-noresult, .sd-panel', { timeout: 60000 });
      await p.waitForTimeout(2500);
      const r = await p.evaluate(() => {
        const head = document.querySelector('.sd-panel-code');
        const cards = document.querySelectorAll('.feed-card').length;
        // 分站信息条（InfiniteFeed 的 src 提示）
        const srcBar = [...document.querySelectorAll('div, span, p')].find(
          (el) => el.children.length === 0 && /\u00b7\s*\d+\s*$/.test(el.textContent || '') && (el.textContent || '').length < 30
        );
        return {
          panelCode: head ? head.textContent.trim() : null,
          feedCards: cards,
          srcBarText: srcBar ? (srcBar.textContent || '').trim() : null,
        };
      });
      report['src_' + code] = r;
      report['src_' + code + '_ok'] = r.panelCode === code && r.feedCards > 0;
    } catch (e) {
      report['src_' + code] = 'err:' + e.message.split('\n')[0];
      report['src_' + code + '_ok'] = false;
    }
    await p.close();
  }

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
