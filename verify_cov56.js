// verify_cov56.js — 第三批 2026-11c 验收
// 1) 8 语种首页各有 3 篇新文章链接；2) 3 个 zh 详情页标题/正文/署名/3 图 naturalWidth；
// 3) 9 张图 HTTP 200（3 次重试）；4) 0 控制台错误；5) 旧稿 404。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NEW_SLUGS = ["harmony-desktop", "oil-membrane", "chemo-neuro"];
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const IMG = ["harmony-desktop-cover", "harmony-desktop-fig1", "harmony-desktop-fig2",
  "oil-membrane-cover", "oil-membrane-fig1", "oil-membrane-fig2",
  "chemo-neuro-cover", "chemo-neuro-fig1", "chemo-neuro-fig2"];
const pass = [], fail = [];

(async () => {
  const browser = await chromium.launch();

  // --- 1. 静态图 200（3 次重试） ---
  const req = await browser.newContext().then((c) => c.newPage());
  for (const s of IMG) {
    let code = 0;
    for (let t = 0; t < 3; t++) {
      const resp = await req.goto(BASE + "/original/" + s + ".webp", { timeout: 30000 }).catch(() => null);
      if (resp && resp.ok()) { code = resp.status(); break; }
      await sleep(2000);
    }
    (code === 200 ? pass : fail).push(`img ${s}.webp -> ${code}`);
  }

  // --- 2. 8 语种首页：3 篇新稿链接 ---
  for (const loc of LOCALES) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(9000);
    const href = await page.content().then((h) => h);
    let found = 0;
    for (const s of NEW_SLUGS) {
      if (href.includes(`article/rss-orig-${s}-2026-11${loc === "zh" ? "" : "-" + loc}`)) found++;
    }
    (found === 3 ? pass : fail).push(`${loc} 首页新稿链接 ${found}/3`);
    const errReal = errs.filter((e) => !/favicon|404/.test(e));
    (errReal.length === 0 ? pass : fail).push(`${loc} 控制台错误 ${errReal.length}`);
    await page.close();
  }

  // --- 3. zh 详情页：标题/正文/署名/图片 naturalWidth ---
  for (const s of NEW_SLUGS) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`${BASE}/zh/article/rss-orig-${s}-2026-11`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(9000);
    const title = await page.title();
    const paras = await page.$$eval("article p, .art-body p, p", (ps) => ps.length).catch(() => 0);
    const credits = await page.$$eval(".art-image-credits, [class*='image-credits'], [class*='credits']", (els) => els.length).catch(() => 0);
    (title && title.length > 10 ? pass : fail).push(`${s} title="${title.slice(0, 40)}"`);
    (paras >= 12 ? pass : fail).push(`${s} 正文段落 ${paras}`);
    (credits >= 1 ? pass : fail).push(`${s} 署名区块 ${credits}`);
    // 逐张滚动等待加载（lazy 图不能快滚）
    const imgs = await page.$$("img");
    let okImgs = 0, total = 0;
    for (const im of imgs) {
      const src = await im.getAttribute("src").catch(() => "") || "";
      if (!/\/original\/.*\.webp/.test(src)) continue;
      total++;
      await im.scrollIntoViewIfNeeded().catch(() => {});
      const ok = await page.waitForFunction(
        (el) => el.complete && el.naturalWidth > 0, im, { timeout: 15000 }
      ).then(() => true).catch(() => false);
      if (ok) okImgs++;
    }
    (total === 3 && okImgs === 3 ? pass : fail).push(`${s} 文内图 ${okImgs}/${total}`);
    const errReal = errs.filter((e) => !/favicon|404/.test(e));
    (errReal.length === 0 ? pass : fail).push(`${s} 控制台错误 ${errReal.length}${errReal.length ? ": " + errReal[0].slice(0, 80) : ""}`);
    await page.screenshot({ path: `cov56_${s}.png`, fullPage: false });
    await page.close();
  }

  // --- 4. 旧稿 404 ---
  const page4 = await browser.newContext().then((c) => c.newPage());
  const resp = await page4.goto(BASE + "/zh/article/rss-bnf7qm", { timeout: 60000 }).catch(() => null);
  (resp && resp.status() === 404 ? pass : fail).push(`旧稿 rss-bnf7qm -> ${resp ? resp.status() : "null"}`);

  await browser.close();
  console.log("PASS", pass.length);
  pass.forEach((x) => console.log("  ✓", x));
  console.log("FAIL", fail.length);
  fail.forEach((x) => console.log("  ✗", x));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
