// verify_11q_lite.js — 2026-11q 精简浏览器验收
// 8 语种首页各 3 链接 + 3 篇详情标题/正文/署名/3 图 + 0 应用错误
// 公网链路抖动单独统计不计 FAIL；图片 200 与 SSR 署名另由服务器侧 curl 交叉验证。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://starteday.com";
const SLUGS = ["twisted-oxide-moire", "glucose-powered-neuroaxis", "folding-steering-suv"];
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const BATCH = "2026-11q";
const NET = /ERR_CONNECTION|ERR_HTTP2|ERR_ABORTED|net::ERR|Timeout|ECONNRESET|PING_FAILED/i;
const pass = [], fail = [], netErrs = [];
function artId(loc, s) { return `rss-orig-${s}-${BATCH}${loc === "zh" ? "" : "-" + loc}`; }
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  for (const loc of LOCALES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", e => errs.push(String(e)));
    try {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);
      const html = await page.content();
      const found = SLUGS.filter(s => html.includes(artId(loc, s))).length;
      if (found === 3) pass.push(loc + " 首页 3/3 链接"); else fail.push(loc + " 首页 " + found + "/3 链接");
      const appErr = errs.filter(e => !NET.test(e));
      if (appErr.length === 0) pass.push(loc + " 首页 0 应用错误"); else fail.push(loc + " 应用错误: " + appErr.slice(0, 2).join(" | "));
      netErrs.push(...errs.filter(e => NET.test(e)).map(e => loc + ": " + e.slice(0, 60)));
    } catch (e) { fail.push(loc + " 首页加载失败: " + String(e).slice(0, 80)); }
    await page.close();
  }
  for (const s of SLUGS) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", e => errs.push(String(e)));
    try {
      await page.goto(`${BASE}/zh/article/${artId("zh", s)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1000);
      const d = await page.evaluate((slug) => ({
        title: document.title,
        paras: document.querySelectorAll(".art-body p, .article-body p, article p, .art-lead p").length,
        cred: /IMAGE CREDITS|图片来源|commons\.wikimedia/i.test(document.body.innerText),
        imgs: Array.from(document.querySelectorAll('img[src*="/original/' + slug + '-"]')).map(i => i.getAttribute("src")),
      }), s);
      if (d.title && d.title.includes("starteday")) pass.push(s + " 标题正常"); else fail.push(s + " 标题异常: " + d.title);
      if (d.paras >= 12) pass.push(s + " 正文 " + d.paras + " 段"); else fail.push(s + " 正文仅 " + d.paras + " 段");
      if (d.cred) pass.push(s + " 署名区块在"); else fail.push(s + " 署名区块缺失");
      if (d.imgs.length >= 3) pass.push(s + " 3 张真实图标签 " + d.imgs.length); else fail.push(s + " 图标签 " + d.imgs.length + "/3");
      const appErr = errs.filter(e => !NET.test(e));
      if (appErr.length === 0) pass.push(s + " 0 应用错误"); else fail.push(s + " 应用错误: " + appErr.slice(0, 1));
      netErrs.push(...errs.filter(e => NET.test(e)).map(e => s + ": " + e.slice(0, 60)));
    } catch (e) { fail.push(s + " 详情失败: " + String(e).slice(0, 80)); }
    await page.close();
  }
  await browser.close();
  console.log("PASS", pass.length, "FAIL", fail.length, "NET_ERR(抖动)", netErrs.length);
  pass.forEach(x => console.log("  OK", x));
  fail.forEach(x => console.log("  FAIL", x));
  if (netErrs.length) console.log("  网络抖动:", netErrs.slice(0, 5).join(" | "));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(2); });
