// cov17 验证：性能（地球延迟初始化 + 卡片悬停预取）+ 移动端（面板静态化）
// 范式：轮询重试（本地→服务器 HTTPS 偶发挂起），长等待水合，网络请求监听。
//
// 经验修正（2026-10-23 二轮）：
// 1) deferredInit 必须在「.sd-globe 容器刚出现」时立刻测 canvas 是否存在——
//    等水合/networkidle 后再测，IO 早已触发，会误报 false。
// 2) 首页默认信息流是 SectionedFeed（首卡在折叠下方，不传 priority），
//    首卡 loading=lazy 是正确行为，断言 lazy 而非 eager。
// 3) 悬停预取判定兼容「该文章加载时已被视口预取」的缓存命中：
//    触发成功 = hover 后出现新的 _rsc 请求，或该卡片文章本就在已预取集合里。
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const BASE = process.env.BASE || 'https://starteday.com/zh';
const ART_RE = /\/(zh|en|ja|ko|es|fr|de)\/article\//;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.feed-card', { timeout: 60000 });
      page = p;
    } catch (e) {
      console.log(`第 ${attempt} 轮加载失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!page) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }

  const report = {};

  // ---- 1. 地球延迟初始化：容器出现瞬间无 canvas，随后（进入视口/IO 触发）才建 ----
  // 关键：不等水合，.sd-globe 一出现就测（globe.gl 是异步 chunk，此刻必然还没建）。
  try {
    await page.waitForSelector('.sd-globe', { timeout: 30000 });
    const canvasEarly = await page.evaluate(() => !!document.querySelector('.sd-globe canvas'));
    let canvasLater = canvasEarly;
    for (let i = 0; i < 20 && !canvasLater; i++) {
      await page.waitForTimeout(1000);
      canvasLater = await page.evaluate(() => !!document.querySelector('.sd-globe canvas'));
    }
    report.deferredInit = canvasEarly === false && canvasLater === true;
    report.canvasEarly = canvasEarly;
    report.canvasLater = canvasLater;
  } catch (e) {
    report.deferredInit = 'err:' + e.message.split('\n')[0];
  }
  await page.waitForTimeout(3000); // 等水合稳定

  // ---- 2. 图片 lazy：首页首卡在折叠下方 → lazy 是正确行为 ----
  report.images = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.feed-card')];
    const first = cards[0]?.querySelector('img');
    const rest = cards[1]?.querySelector('img');
    const li = (img) => (img ? (img.getAttribute('loading') || 'auto') : null);
    return {
      firstFeedCardLazy: li(first) === 'lazy', // 折叠下方卡片应为 lazy
      firstCardLoading: li(first),
      secondCardLoading: li(rest),
      lazyCount: [...document.querySelectorAll('img[loading="lazy"]')].length,
      eagerCount: [...document.querySelectorAll('img[loading="eager"]')].length,
    };
  });

  // ---- 3. 卡片 hover 预取文章页 ----
  const rscReqs = new Set();
  page.on('request', (req) => {
    const u = req.url();
    const h = req.headers();
    if (ART_RE.test(u) && (u.includes('_rsc') || (h && (h.rsc === '1' || h.RSC === '1')))) {
      rscReqs.add(u);
    }
  });
  const card = await page.$('.feed-card');
  const cb = await card.boundingBox();
  const cardHref = await card.evaluate((el) => {
    const a = el.querySelector('a[href*="/article/"]');
    return a ? a.getAttribute('href') : null;
  });
  const before = rscReqs.size;
  const beforeUrls = [...rscReqs];
  // 悬停卡片中部并停留 >120ms（防抖阈值）让预取触发。
  // 关键：首卡在折叠下方（y≈1300 > 视口高），必须先 scrollIntoViewIfNeeded，
  // 且 element.hover() 用视口内中心坐标——直接 mouse.move(页面绝对坐标) 会移到视口外，悬停根本不生效。
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(1500);
  await page.mouse.move(0, 0); // 移开再回来，确保 mouseenter 重新触发
  await page.waitForTimeout(300);
  await card.hover();
  await page.waitForTimeout(2000);
  const after = rscReqs.size;
  const newReq = after > before;
  // 缓存命中：该卡片文章在 hover 前就已被视口预取（_rsc URL 的 path 部分 = href）
  const cacheHit = cardHref
    ? [...rscReqs].some((u) => u.split('?')[0].endsWith(cardHref))
    : false;
  report.prefetch = {
    before,
    after,
    newRequest: newReq,
    cacheHit,
    triggered: newReq || cacheHit, // 新请求或命中已预取缓存都算成功
    cardHref,
    sample: [...rscReqs].slice(0, 3),
  };

  // ---- 4. 移动端面板静态化（≤980px 应 position:static）----
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  try {
    await mob.waitForSelector('.feed-card', { timeout: 60000 });
    await mob.waitForTimeout(2500);
    report.mobilePanel = await mob.evaluate(() => {
      const p = document.querySelector('.sd-panel');
      if (!p) return 'no-panel';
      return getComputedStyle(p).position;
    });
  } catch (e) {
    report.mobilePanel = 'load-failed:' + e.message.split('\n')[0];
  }
  await mob.close();

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
