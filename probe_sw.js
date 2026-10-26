// 探针：直接观察线上页面是否注册了 SW、是否请求了 /sw.js、是否抛 #418。
// 两种情况各跑 6 次：A=不拦截 sw.js；B=拦截 sw.js。对比 getRegistrations 数量 + #418。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(blockSW) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  if (blockSW) await ctx.route("**/sw.js", (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  const swReq = [];
  page.on("pageerror", (e) => { if (/react error #418/i.test(e.message || "")) errs.push("418:" + e.message); });
  page.on("request", (r) => { if (r.url().endsWith("/sw.js")) swReq.push(r.url()); });
  await page.goto(BASE + "/zh", { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
  await sleep(6000);
  const regCount = await page.evaluate(async () => {
    try { return (await navigator.serviceWorker.getRegistrations()).length; } catch (e) { return "ERR:" + e.message; }
  }).catch((e) => "EVAL_ERR:" + e.message);
  await browser.close();
  return { blockSW, regCount, swRequests: swReq.length, e418: errs.length };
}

(async () => {
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await probe(false));
  for (let i = 0; i < 6; i++) out.push(await probe(true));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
