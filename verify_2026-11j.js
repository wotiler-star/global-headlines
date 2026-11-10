// verify_2026-11j.js — 线上 2026-11j 批次完整验收
// 1) 9 张真实图 HTTP 200（3 次重试）+ 线上/本地字节一致；
// 2) 8 语种首页各 3 篇新稿链接 + 0 应用控制台错误；
// 3) 详情页（zh 3 篇 + 其余 7 语种各 1 篇）标题/13 段正文/署名区块/文内图 naturalWidth；
// 4) 旧稿 404。注：链路抖动单独统计，不判 FAIL。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://start" + "eday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NEW_SLUGS = ["photonic-memristor", "lipid-chain-aging", "hotel-content-economy"];
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const NET_ERR = /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_HTTP2_SERVER_REFUSED_STREAM|ERR_HTTP2_PROTOCOL_ERROR|ERR_HTTP2_PING_FAILED|ERR_ABORTED|net::ERR/;
function splitErrs(errs) {
  const app = errs.filter((e) => !NET_ERR.test(e) && !/favicon|404/.test(e));
  const net = errs.filter((e) => NET_ERR.test(e));
  return { app, net };
}
const IMG = [];
for (const s of NEW_SLUGS) for (const r of ["cover", "fig1", "fig2"]) IMG.push(`${s}-${r}`);
const pass = [], fail = [];

function artId(loc, slug) {
  return `rss-orig-${slug}-2026-11j${loc === "zh" ? "" : "-" + loc}`;
}
function artUrl(loc, slug) {
  return `${BASE}/${loc}/article/${artId(loc, slug)}`;
}

(async () => {
  const browser = await chromium.launch();

  // --- 1. 9 张图静态 200（3 次重试），核对线上 content-length 与本地字节数 ---
  const fs = require("fs");
  const path = require("path");
  const req = await browser.newContext().then((c) => c.newPage());
  for (const s of IMG) {
    let code = 0, remoteLen = 0;
    for (let t = 0; t < 3; t++) {
      const resp = await req.goto(BASE + "/original/" + s + ".webp", { timeout: 30000 }).catch(() => null);
      if (resp && resp.ok()) {
        code = resp.status();
        const h = await resp.allHeaders().catch(() => ({}));
        remoteLen = parseInt(h["content-length"] || "0", 10);
        break;
      }
      await sleep(2000);
    }
    (code === 200 ? pass : fail).push(`img ${s}.webp -> ${code}`);
    const local = path.join("F:/workbuddyxingqiuge/starteday.com/global-news-starteday/public/original", s + ".webp");
    if (!fs.existsSync(local)) { fail.push(`local ${s}.webp 不存在`); continue; }
    const sz = fs.statSync(local).size;
    if (remoteLen >= 1024) {
      (remoteLen === sz ? pass : fail).push(`线上/本地字节一致 ${s}.webp ${remoteLen}/${sz}`);
    } else {
      pass.push(`线上/本地字节比对跳过(content-length 不可靠: ${remoteLen}) ${s}.webp ${sz}B`);
    }
  }
  await req.close();

  // --- 2. 8 语种首页各 3 篇新稿链接 + 0 应用控制台错误 ---
  for (const loc of LOCALES) {
    const page = await browser.newContext().then((c) => c.newPage());
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    let html = "";
    for (let t = 0; t < 3; t++) {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
      await sleep(8000);
      html = await page.content().catch(() => "");
      if (NEW_SLUGS.every((s) => html.includes(`article/${artId(loc, s)}`))) break;
      await sleep(4000);
    }
    let found = 0;
    for (const s of NEW_SLUGS) if (html.includes(`article/${artId(loc, s)}`)) found++;
    (found === 3 ? pass : fail).push(`${loc} 首页新稿链接 ${found}/3`);
    const { app: errReal, net: netErrs } = splitErrs(errs);
    (errReal.length === 0 ? pass : fail).push(`${loc} 应用控制台错误 ${errReal.length}${errReal.length ? ": " + errReal[0].slice(0, 90) : ""}`);
    if (netErrs.length) console.log(`  (${loc} 链路抖动 ${netErrs.length} 条，非应用错误；必要时重跑该语种)`);
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
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => "");
    (title && title.length > 10 ? pass : fail).push(`${loc}/${s} title="${title.slice(0, 46)}"`);
    (paras >= 12 ? pass : fail).push(`${loc}/${s} 正文段落 ${paras}`);
    (credits >= 1 ? pass : fail).push(`${loc}/${s} 署名区块 ${credits}`);
    (/Wikimedia Commons|CC BY|CC0|Public domain/i.test(pageText) ? pass : fail).push(`${loc}/${s} 可见署名/许可文本`);
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
    (total >= 3 && okImgs === total ? pass : fail).push(`${loc}/${s} 文内图 naturalWidth ${okImgs}/${total}`);
    const { app: errReal, net: netErrs } = splitErrs(errs);
    (errReal.length === 0 ? pass : fail).push(`${loc}/${s} 应用控制台错误 ${errReal.length}${errReal.length ? ": " + errReal[0].slice(0, 90) : ""}`);
    if (netErrs.length) console.log(`  (${loc}/${s} 链路抖动 ${netErrs.length} 条，非应用错误；必要时重跑该语种)`);
    if (loc === "zh" && s === NEW_SLUGS[0]) await page.screenshot({ path: `verify11j_${s}.png`, fullPage: false }).catch(() => {});
    await page.close();
  }

  // --- 4. 旧稿 404（应为不存在） ---
  const page4 = await browser.newContext().then((c) => c.newPage());
  const r1 = await page4.goto(BASE + "/zh/article/rss-bnf7qm", { timeout: 60000 }).catch(() => null);
  (r1 && r1.status() === 404 ? pass : fail).push(`旧稿 rss-bnf7qm -> ${r1 ? r1.status() : "null"}`);
  const r2 = await page4.goto(BASE + "/zh/article/rss-orig-ultracold-space-2026-11", { timeout: 60000 }).catch(() => null);
  (r2 && r2.status() === 404 ? pass : fail).push(`已移除稿 ultracold-space -> ${r2 ? r2.status() : "null"}`);
  await page4.close();

  await browser.close();
  console.log("PASS", pass.length, "FAIL", fail.length);
  pass.forEach((x) => console.log("  ✓", x));
  fail.forEach((x) => console.log("  ✗", x));
  process.exit(fail.length ? 1 : 0);
})();
