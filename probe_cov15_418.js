// 隔离 cov15 是否引入新的 #418：分别用全新 context 加载 /zh 与 /zh?src=ICN 各 5 次
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function trial(browser, path) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let err418 = false;
  page.on("pageerror", (e) => { if (String(e).includes("#418") || String(e).includes("418")) err418 = true; });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await sleep(6000);
  await ctx.close();
  return err418;
}

(async () => {
  const browser = await chromium.launch();
  const res = { zh: [], srcICN: [] };
  for (let i = 0; i < 5; i++) {
    res.zh.push(await trial(browser, "/zh"));
    res.srcICN.push(await trial(browser, "/zh?src=ICN"));
  }
  res.zhCount = res.zh.filter(Boolean).length;
  res.srcICNCount = res.srcICN.filter(Boolean).length;
  console.log(JSON.stringify(res, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
