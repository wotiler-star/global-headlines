// 基线对照：屏蔽 SW，跑 30 次「直接带参加载 → 客户端导航 → 重载」，确认无 SW 时 #418 是否真的为 0。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attach(page, errs) {
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + (e.message || String(e))));
}

const is418 = (s) => /react error #418|text content does not match|hydration failed|did not match server-rendered/i.test(s);

async function run(label, iterations) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.route("**/sw.js", (r) => r.abort()); // 屏蔽 SW
  const page = await ctx.newPage();
  const errs = [];
  attach(page, errs);
  let total418 = 0;
  const fails = [];
  for (let i = 0; i < iterations; i++) {
    errs.length = 0;
    const start = i % 3 === 0 ? BASE + "/zh" : i % 3 === 1 ? BASE + "/zh?src=ICN" : BASE + "/zh?cat=world";
    await page.goto(start, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => errs.push("GOTO_TIMEOUT"));
    await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
    await sleep(6000);
    const link = await page.$(".hs-more");
    if (link) { await link.click().catch(() => {}); await sleep(1200); }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => errs.push("RELOAD_TIMEOUT"));
    await sleep(6000);
    const matched = errs.filter(is418);
    if (matched.length) { total418++; fails.push({ i, start: start.replace(BASE, ""), matched }); }
  }
  await browser.close();
  return { label, iterations, total418, fails };
}

(async () => {
  const r = await run("NO_SW_BASELINE", 30);
  console.log(JSON.stringify(r, null, 2));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
