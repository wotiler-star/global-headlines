// verify_cov61.js — 第四批 2026-11e 验收
// 1) 8 语种首页各有 3 篇新稿链接；2) 9 张真实图 HTTP 200（3 次重试）；
// 3) 10 个详情页（zh 3 篇 + 其余 7 语种各 1 篇）标题/正文/署名/文内图 naturalWidth；
// 4) 旧稿 404；5) 0 控制台错误。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://start" + "eday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NEW_SLUGS = ["ultracold-space", "oled-ipad-mini", "dino-heme"];
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const IMG = [];
for (const s of NEW_SLUGS) for (const r of ["cover", "fig1", "fig2"]) IMG.push(`${s}-${r}`);
const pass = [], fail = [];

function artUrl(loc, slug) {
  return `${BASE}/${loc}/article/rss-orig-${slug}-2026-11${loc === "zh" ? "" : "-" + loc}`;
}

(async () => {
  const browser = await chromium.launch();

  // --- 1. 9 张图静态 200（3 次重试） ---
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
  await req.close();

  // --- 2. 8 语种首页各 3 篇新稿链接 + 0 控制台错误 ---
  for (const loc of LOCALES) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    let html = "";
    for (let t = 0; t < 2; t++) {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await sleep(8000);
      html = await page.content().catch(() => "");
      if (NEW_SLUGS.every((s) => html.includes(`article/rss-orig-${s}-2026-11${loc === "zh" ? "" : "-" + loc}`))) break;
      await sleep(4000);
    }
    let found = 0;
    for (const s of NEW_SLUGS) {
      if (html.includes(`article/rss-orig-${s}-2026-11${loc === "zh" ? "" : "-" + loc}`)) found++;
    }
    (found === 3 ? pass : fail).push(`${loc} 首页新稿链接 ${found}/3`);
    const errReal = errs.filter((e) => !/favicon|404/.test(e));
    (errReal.length === 0 ? pass : fail).push(`${loc} 控制台错误 ${errReal.length}${errReal.length ? ": " + errReal[0].slice(0, 90) : ""}`);
    await page.close();
  }

  // --- 3. 详情页抽查：zh 全 3 篇 + 其余 7 语种各 1 篇 ---
  const checks = [["zh", NEW_SLUGS[0]], ["zh", NEW_SLUGS[1]], ["zh", NEW_SLUGS[2]]];
  for (const loc of LOCALES.slice(1)) checks.push([loc, NEW_SLUGS[0]]);
  for (const [loc, s] of checks) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(artUrl(loc, s), { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(8000);
    const title = await page.title().catch(() => "");
    const paras = await page.$$eval("article p, .art-body p, p", (ps) => ps.length).catch(() => 0);
    const credits = await page.$$eval(".art-image-credits, [class*='image-credits'], [class*='credits']", (els) => els.length).catch(() => 0);
    (title && title.length > 10 ? pass : fail).push(`${loc}/${s} title="${title.slice(0, 46)}"`);
    (paras >= 12 ? pass : fail).push(`${loc}/${s} 正文段落 ${paras}`);
    (credits >= 1 ? pass : fail).push(`${loc}/${s} 署名区块 ${credits}`);
    // 逐张滚动等待加载（lazy 图不能快滚，否则 naturalWidth=0 假 FAIL）
    const imgs = await page.$$("img");
    let okImgs = 0, total = 0;
    for (const im of imgs) {
      const src = await im.getAttribute("src").catch(() => "") || "";
      if (!/\/original\/.*\.webp/.test(src)) continue;
      total++;
      await im.scrollIntoViewIfNeeded().catch(() => {});
      const ok = await page.waitForFunction(
        (el) => el.complete && el.naturalWidth > 0, im, { timeout: 18000 }
      ).then(() => true).catch(() => false);
      if (ok) okImgs++;
    }
    (total >= 3 && okImgs >= 3 ? pass : fail).push(`${loc}/${s} 文内图 naturalWidth ${okImgs}/${total}`);
    const errReal = errs.filter((e) => !/favicon|404/.test(e));
    (errReal.length === 0 ? pass : fail).push(`${loc}/${s} 控制台错误 ${errReal.length}${errReal.length ? ": " + errReal[0].slice(0, 90) : ""}`);
    if (loc === "zh") await page.screenshot({ path: `cov61_${s}.png`, fullPage: false }).catch(() => {});
    await page.close();
  }

  // --- 4. 旧稿 404 ---
  const page4 = await browser.newContext().then((c) => c.newPage());
  const resp = await page4.goto(BASE + "/zh/article/rss-bnf7qm", { timeout: 60000 }).catch(() => null);
  (resp && resp.status() === 404 ? pass : fail).push(`旧稿 rss-bnf7qm -> ${resp ? resp.status() : "null"}`);
  await page4.close();

  await browser.close();
  console.log("PASS", pass.length);
  pass.forEach((x) => console.log("  ✓", x));
  console.log("FAIL", fail.length);
  fail.forEach((x) => console.log("  ✗", x));
  if (fail.length) process.exit(2);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
