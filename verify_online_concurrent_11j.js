// verify_online_concurrent_11j.js — 验收线上已由并行会话发布的 2026-11j 批次
// 8 语种首页各 3 篇 / 9 张图 200 / 详情页标题·正文·署名 / 0 应用控制台错误 / 旧稿 404
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://start" + "eday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SLUGS = ["china-ai-export", "china-games-export", "china-webnovel-global"];
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const NET_ERR = /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_HTTP2_SERVER_REFUSED_STREAM|ERR_HTTP2_PROTOCOL_ERROR|ERR_HTTP2_PING_FAILED|ERR_ABORTED|net::ERR/;
const splitErrs = (e) => ({
  app: e.filter((x) => !NET_ERR.test(x) && !/favicon|404/.test(x)),
  net: e.filter((x) => NET_ERR.test(x)),
});
const IMG = [];
for (const s of SLUGS) for (const n of [1, 2, 3]) IMG.push(`${s}-${n}`);
const pass = [], fail = [];
const artId = (loc, s) => `rss-orig-${s}-2026-11j${loc === "zh" ? "" : "-" + loc}`;

(async () => {
  const browser = await chromium.launch();

  // 1. 9 张真实图 200（3 次重试）
  const req = await browser.newContext().then((c) => c.newPage());
  for (const s of IMG) {
    let code = 0;
    for (let t = 0; t < 3; t++) {
      const r = await req.goto(`${BASE}/original/${s}.webp`, { timeout: 30000 }).catch(() => null);
      if (r && r.ok()) { code = r.status(); break; }
      await sleep(2000);
    }
    (code === 200 ? pass : fail).push(`img ${s}.webp -> ${code}`);
  }
  await req.close();

  // 2. 8 语种首页 3/3 + 0 应用错误
  for (const loc of LOCALES) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    let html = "";
    for (let t = 0; t < 3; t++) {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await sleep(8000);
      html = await page.content().catch(() => "");
      if (SLUGS.every((s) => html.includes(`article/${artId(loc, s)}`))) break;
      await sleep(4000);
    }
    const found = SLUGS.filter((s) => html.includes(`article/${artId(loc, s)}`)).length;
    (found === 3 ? pass : fail).push(`${loc} 首页新稿链接 ${found}/3`);
    const { app, net } = splitErrs(errs);
    (app.length === 0 ? pass : fail).push(`${loc} 应用控制台错误 ${app.length}${app.length ? ": " + app[0].slice(0, 90) : ""}`);
    if (net.length) console.log(`  (${loc} 链路抖动 ${net.length} 条，非应用错误)`);
    await page.close();
  }

  // 3. 详情页：zh 全 3 篇 + 其余 7 语种各 1 篇
  const checks = SLUGS.map((s) => ["zh", s]);
  for (const loc of LOCALES.slice(1)) checks.push([loc, SLUGS[0]]);
  for (const [loc, s] of checks) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(`${BASE}/${loc}/article/${artId(loc, s)}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(8000);
    const title = await page.title().catch(() => "");
    const paras = await page.$$eval("article p, .art-body p, p", (ps) => ps.length).catch(() => 0);
    const credits = await page.$$eval(".art-image-credits, [class*='image-credits'], [class*='credits']", (els) => els.length).catch(() => 0);
    const txt = await page.evaluate(() => document.body.innerText).catch(() => "");
    (title && title.length > 10 ? pass : fail).push(`${loc}/${s} title="${title.slice(0, 42)}"`);
    (paras >= 12 ? pass : fail).push(`${loc}/${s} 正文段落 ${paras}`);
    (credits >= 1 ? pass : fail).push(`${loc}/${s} 署名区块 ${credits}`);
    (/Wikimedia Commons|CC BY|CC0|Public domain/i.test(txt) ? pass : fail).push(`${loc}/${s} 可见署名/许可`);
    const imgs = await page.$$("img");
    let ok = 0, total = 0;
    for (const im of imgs) {
      const src = await im.getAttribute("src").catch(() => "") || "";
      if (!/\/original\/.*\.webp/.test(src)) continue;
      total++;
      await im.scrollIntoViewIfNeeded().catch(() => {});
      const good = await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, im, { timeout: 18000 }).then(() => true).catch(() => false);
      if (good) ok++;
    }
    (total >= 3 && ok === total ? pass : fail).push(`${loc}/${s} 文内图 ${ok}/${total}`);
    const { app, net } = splitErrs(errs);
    (app.length === 0 ? pass : fail).push(`${loc}/${s} 应用控制台错误 ${app.length}${app.length ? ": " + app[0].slice(0, 90) : ""}`);
    if (net.length) console.log(`  (${loc}/${s} 链路抖动 ${net.length} 条)`);
    await page.close();
  }

  // 4. 旧稿 404
  const p4 = await browser.newContext().then((c) => c.newPage());
  const r1 = await p4.goto(BASE + "/zh/article/rss-bnf7qm", { timeout: 60000 }).catch(() => null);
  (r1 && r1.status() === 404 ? pass : fail).push(`旧稿 rss-bnf7qm -> ${r1 ? r1.status() : "null"}`);
  const r2 = await p4.goto(BASE + "/zh/article/rss-orig-ultracold-space-2026-11", { timeout: 60000 }).catch(() => null);
  (r2 && r2.status() === 404 ? pass : fail).push(`已移除稿 ultracold-space -> ${r2 ? r2.status() : "null"}`);
  await p4.close();

  await browser.close();
  console.log("PASS", pass.length, "FAIL", fail.length);
  pass.forEach((x) => console.log("  ✓", x));
  fail.forEach((x) => console.log("  ✗", x));
  process.exit(fail.length ? 1 : 0);
})();
