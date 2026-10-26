// cov16 诊断：复现「客户端导航→重载」#418 并捕获完整错误细节（含 SW 控制）
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) =>
    errs.push("PAGEERROR: msg=" + (e.message || String(e)) + " | digest=" + (e.digest || "") + " | stack=" + ((e.stack || "").slice(0, 600)))
  );
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text());
  });

  const results = [];
  for (let i = 0; i < 8; i++) {
    errs.length = 0;
    await page.goto(BASE + "/zh", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
    await sleep(7000);
    // 等 SW 接管
    await page.evaluate(async () => {
      if (navigator.serviceWorker) { try { await navigator.serviceWorker.ready; } catch (e) {} }
    });
    // 客户端导航（点分类「更多」Link → ?cat=xxx）
    const link = await page.$(".hs-more");
    if (link) { await link.click(); await sleep(1500); }
    const urlAfterNav = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(7000);
    const has418 = errs.some((e) => e.includes("418"));
    results.push({ i, urlAfterNav, has418, errs: errs.slice(0, 4) });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
