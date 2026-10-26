// cov18 验证：搜索体验（联想分类项 + 结果 tab 方向键导航）
// 范式：轮询重试（本地→服务器 HTTPS 偶发挂起），长等待水合。
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = process.env.BASE || 'https://starteday.com/zh';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const report = {};

  // ============ 1. 联想下拉分类项 ============
  // 输入"科技"（命中分类标签）→ 下拉应出现 data-type=category 项（置顶）+ "分类"提示 chip；
  // 回车后 URL 应带 cat=tech（并保留 q）。
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('suggest: ' + e.message.slice(0, 160)));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.search-input', { timeout: 60000 });
      page = p;
    } catch (e) {
      console.log(`联想第 ${attempt} 轮加载失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!page) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(3000); // 等水合

  const input = await page.$('.search-input');
  await input.click();
  await input.type('科技', { delay: 60 });
  // 等联想请求返回（180ms 防抖 + 网络）
  let sug = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    sug = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.search-suggest .ss-item')];
      if (!items.length) return null;
      return items.map((el) => ({
        type: el.getAttribute('data-type'),
        text: (el.querySelector('.ss-text') || {}).textContent || '',
        kind: (el.querySelector('.ss-kind') || {}).textContent || '',
      }));
    });
    if (sug) break;
  }
  report.suggest = {
    items: sug || [],
    hasCategoryItem: !!(sug && sug.some((s) => s.type === 'category')),
    categoryFirst: !!(sug && sug[0] && sug[0].type === 'category'),
    kindChip: !!(sug && sug.some((s) => s.kind === '分类')),
  };

  // ↓ 高亮第一项（分类）+ 回车 → 应跳 cat=tech 且保留 q=科技
  // （直接回车 active=-1 会走原生表单纯 q 搜索，这是预期 UX，故选分类必须先 ↓）
  await input.press('ArrowDown');
  await input.press('Enter');
  await page.waitForTimeout(2500);
  report.suggestEnterUrl = page.url();
  report.suggestEnterOk = /\/zh\/search\?.*cat=tech/.test(page.url()) && /q=/.test(page.url());
  console.log('--- 联想分类项结果 ---');
  console.log(JSON.stringify(report.suggest, null, 2));
  await page.close();

  // ============ 2. 结果 tab 方向键导航 ============
  let sp = null;
  for (let attempt = 1; attempt <= 5 && !sp; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('tabs: ' + e.message.slice(0, 160)));
    try {
      await p.goto(`${BASE}/search?q=AI`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.sp-tab[role="tab"]', { timeout: 60000 });
      sp = p;
    } catch (e) {
      console.log(`tab 第 ${attempt} 轮加载失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!sp) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }
  await sp.waitForTimeout(2500);

  const tabsInfo = await sp.evaluate(() => {
    const tabs = [...document.querySelectorAll('.sp-tab[role="tab"]')];
    const panel = document.querySelector('#sp-panel');
    return {
      tabCount: tabs.length,
      tablistPresent: !!document.querySelector('.sp-tablist[role="tablist"]'),
      sortOutsideTablist: !!document.querySelector('.sp-tabs > .sp-tablist') && !!document.querySelector('.sp-tabs > .sp-sort'),
      panelRole: panel ? panel.getAttribute('role') : null,
      panelLabelledby: panel ? panel.getAttribute('aria-labelledby') : null,
      rovingTabindex: tabs.filter((t) => t.getAttribute('tabindex') === '0').length, // 应只有 1 个
    };
  });
  report.tabs = tabsInfo;

  // 聚焦当前 tab（综合），按 → 应切到国际并保留 q
  await sp.click('.sp-tab.active');
  await sp.keyboard.press('ArrowRight');
  await sp.waitForTimeout(2500);
  report.tabs.arrowRightUrl = sp.url();
  report.tabs.arrowRightOk = /cat=world/.test(sp.url()) && /q=AI/.test(sp.url());
  report.tabs.arrowRightFocus = await sp.evaluate(() => {
    const el = document.activeElement;
    return el && el.classList.contains('sp-tab') ? (el.textContent || '').trim() : null;
  });

  // End 键 → 最后一个分类（video）
  await sp.keyboard.press('End');
  await sp.waitForTimeout(2500);
  report.tabs.endKeyUrl = sp.url();
  report.tabs.endKeyOk = /cat=video/.test(sp.url());

  // Home 键 → 回综合
  await sp.keyboard.press('Home');
  await sp.waitForTimeout(2000);
  report.tabs.homeKeyOk = !/cat=/.test(sp.url());

  await sp.close();

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
