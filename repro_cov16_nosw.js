// cov16 对照：屏蔽 /sw.js（不让 SW 接管），同样「客户端导航→重载」，看 #418 是否消失
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route("**/sw.js", (r) => r.abort());
  const errs = [];
  page.on("pageerror", (e) => errs.push("418=" + (String(e.message || e).includes("418")) + " | " + (e.message || String(e)).slice(0, 80)));

  const results = [];
  for (let i = 0; i < 5; i++) {
    errs.length = 0;
    await page.goto(BASE + "/zh", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
    await sleep(6000);
    const link = await page.$(".hs-more");
    if (link) { await link.click(); await sleep(1200); }
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(6000);
    results.push({ i, url: page.url(), any418: errs.some((e) => e.includes("418=true")), errs: errs.slice(0, 3) });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
