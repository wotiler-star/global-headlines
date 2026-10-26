// dev 模式探针：捕获 React 水合失败的详细信息（dev 会打印具体不匹配的节点/组件）。
// 用法：先 `next dev -p 3137`，再 `node dev_probe.js`
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:3137";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  // 不拦截 sw.js（本就无 SW），但避免任何 route 拦截掩盖时序竞争：不加 route
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push("[" + m.type() + "] " + m.text()); });
  page.on("pageerror", (e) => logs.push("[PAGEERROR] " + (e.message || String(e))));

  for (let i = 0; i < 6; i++) {
    logs.length = 0;
    const start = i % 2 === 0 ? BASE + "/zh" : BASE + "/zh?src=ICN";
    await page.goto(start, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => logs.push("[GOTO_ERR] " + e.message));
    await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
    await sleep(5000);
    const link = await page.$(".hs-more");
    if (link) { await link.click().catch(() => {}); await sleep(1000); }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => logs.push("[RELOAD_ERR] " + e.message));
    await sleep(5000);
    const has418 = logs.some((l) => /hydrat|did not match|418|server rendered/i.test(l));
    console.log(`--- iter ${i} (${start.replace(BASE, "")}) has418=${has418} ---`);
    if (has418) console.log(logs.filter((l) => /hydrat|did not match|418|server rendered/i.test(l)).join("\n"));
  }
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
