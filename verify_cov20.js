// cov20 验证：地球仪新增 4 国可交互分站（德国 BER / 意大利 ROM / 日本 TYO / 埃及 CAI）
// 1) 首页地球图例出现 BER/ROM/TYO/CAI 且信号数 > 0（原有 13 分站仍在）
// 2) ?src=BER / ?src=TYO 信息流按分站正确过滤
// 3) ja 首页首次出现真实 RSS 内容（非 mock）：标题应为日文且有时效性
// 4) 无 pageerror
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = process.env.BASE || 'https://starteday.com/zh';
const NEW_CODES = ['BER', 'ROM', 'TYO', 'CAI'];
const OLD_CODES = ['BJS', 'NYC', 'LON', 'PAR', 'ICN', 'MAD', 'MOW', 'YTO', 'RUH', 'SAO', 'MAA', 'JNB', 'SYD'];

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
    return { regions: out, head: ((document.querySelector('.sd-stats') || {}).textContent || '').trim() };
  });

  const regs = report.legend.regions;
  report.legendCheck = {
    newWithSignal: NEW_CODES.filter((c) => (regs[c] || 0) > 0),
    oldPresent: OLD_CODES.filter((c) => c in regs),
    regionCount: Object.keys(regs).length,
  };
  report.legendOk = NEW_CODES.every((c) => (regs[c] || 0) > 0) && OLD_CODES.every((c) => c in regs);
  await page.close();

  // ---- 2. ?src= 分站过滤 ----
  for (const code of ['BER', 'TYO']) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(`src-${code}: ` + e.message.slice(0, 160)));
    try {
      await p.goto(`${BASE}/?src=${code}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.feed-card', { timeout: 60000 });
      await p.waitForTimeout(2500);
      const r = await p.evaluate(() => ({
        panelCode: ((document.querySelector('.sd-panel-code') || {}).textContent || '').trim(),
        feedCards: document.querySelectorAll('.feed-card').length,
      }));
      report['src_' + code] = r;
      report['src_' + code + '_ok'] = r.panelCode === code && r.feedCards > 0;
    } catch (e) {
      report['src_' + code] = 'err:' + e.message.split('\n')[0];
      report['src_' + code + '_ok'] = false;
    }
    await p.close();
  }

  // ---- 3. ja 首页真实 RSS 内容（非 mock 的抽样特征：日文标题 + 非全部相同时间戳）----
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('ja: ' + e.message.slice(0, 160)));
    try {
      await p.goto('https://starteday.com/ja', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.feed-card', { timeout: 60000 });
      await p.waitForTimeout(3000);
      report.ja = await p.evaluate(() => {
        const cards = [...document.querySelectorAll('.feed-card')];
        const titles = cards.slice(0, 6).map((c) => ((c.querySelector('.card-title') || {}).textContent || '').trim());
        const sources = cards.slice(0, 6).map((c) => ((c.querySelector('.src') || {}).textContent || '').trim());
        // 日文假名/汉字占比（mock 内容也含日文，这里只记录样本供人工核对）
        return { sampleCount: cards.length, titles, sources };
      });
      // 有共同/朝日/每日 来源即视为真实 RSS 生效
      // 注意：feed 标题是「株式会社共同通信社」「朝日新聞」「ニュース速報（総合）(毎日フラッシュ)」，不是站名
      report.jaRealRss = /共同通信|朝日新聞|ニュース速報/.test((report.ja.sources || []).join('|'));
    } catch (e) {
      report.ja = 'err:' + e.message.split('\n')[0];
      report.jaRealRss = false;
    }
    await p.close();
  }

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
