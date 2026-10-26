// cov16 验证：大量「客户端导航→重载」+ 直接带参 URL 加载，捕获 React #418（hydration mismatch）。
// 分别在有 SW / 屏蔽 SW 两种环境跑，确认 #418 彻底消失。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attach(page, errs) {
  page.on("pageerror", (e) =>
    errs.push("PAGEERROR: " + (e.message || String(e)) + " | digest=" + (e.digest || ""))
  );
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE: " + m.text());
  });
}

const is418 = (s) => /(^|[^0-9])418([^0-9]|$)|hydration|did not match|server rendered|text content/i.test(s);
// 严格判定：React19 hydration 失败抛出的错误 digest 为 "418"
const isStrict418 = (e) => e.digest === "418" || /hydration failed|did not match server-rendered|text content does not match/i.test(e);

async function run(label, blockSW, iterations, clearSWFirst) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  if (blockSW) await ctx.route("**/sw.js", (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  attach(page, errs);

  if (clearSWFirst) {
    await page.goto(BASE + "/zh", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.evaluate(async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {}
    }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const results = [];
  let total418 = 0;
  for (let i = 0; i < iterations; i++) {
    errs.length = 0;
    // 交替：纯首页 / 带参首页 直接加载
    const start = i % 3 === 0 ? BASE + "/zh" : i % 3 === 1 ? BASE + "/zh?src=ICN" : BASE + "/zh?cat=world";
    await page.goto(start, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => errs.push("GOTO_TIMEOUT: " + start));
    await page.waitForSelector(".sd-globe canvas", { timeout: 60000 }).catch(() => {});
    await sleep(6000);
    // 客户端导航（点分类「更多」Link → ?cat=xxx 或类似）
    const link = await page.$(".hs-more");
    if (link) { await link.click().catch(() => {}); await sleep(1200); }
    const urlAfterNav = page.url();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => errs.push("RELOAD_TIMEOUT"));
    await sleep(6000);
    const matched = errs.filter(is418);
    const has418 = matched.length > 0;
    const strict = errs.filter(isStrict418).length;
    if (has418) total418++;
    const anyErr = errs.length;
    results.push({ i, start: start.replace(BASE, ""), urlAfterNav: urlAfterNav.replace(BASE, ""), has418, strict418: strict, anyErr, matched: matched.slice(), full: errs.slice() });
  }
  await browser.close();
  return { label, iterations, total418, results };
}

(async () => {
  // 第一组：不清 SW（真实过渡态，含旧 SW 可能回灌旧缓存）
  const a = await run("WITH_SW_DIRTY", false, 15, false);
  // 第二组：先清掉旧 SW + 旧缓存，再跑（稳态，纯新 SW）
  const c = await run("WITH_SW_CLEAN", false, 15, true);
  // 第三组：屏蔽 SW（对照）
  const b = await run("NO_SW", true, 8, false);

  const summarize = (g) => {
    const fails = g.results.filter((r) => r.has418 || r.strict418 > 0);
    return { label: g.label, total418: g.total418, strict418Count: g.results.reduce((s, r) => s + r.strict418, 0), fails: fails.map((r) => ({ i: r.i, start: r.start, urlAfterNav: r.urlAfterNav, strict418: r.strict418, matched: r.matched })) };
  };
  console.log(JSON.stringify({ dirty: summarize(a), clean: summarize(c), noSW: summarize(b) }, null, 2));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
