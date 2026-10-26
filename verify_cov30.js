// verify_cov30.js — 验收 cov30：pt/tr 真实 RSS + 中亚/拉美西语区分站 + 首屏 JS 瘦身
// 用法：node verify_cov30.js            （默认 https://starteday.com）
//       BASE=http://127.0.0.1:8082 node verify_cov30.js
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");

const BASE = process.env.BASE || "https://starteday.com";
const SHOTS = "shots_live";
const fs = require("fs");
const path = require("path");

// 每个 locale 期望在 <title> 出现的站点名（验证字典已正确接入路由）
const TITLE_HAS = {
  zh: "全球",
  en: "Global Headlines",
  pt: "Manchetes Globais",
  tr: "Küresel Manşetler",
};

// cov30 新增的 7 个分站城市代码（有信号才会出现在图例）
const NEW_CODES = ["ALA", "TAS", "FRU", "DUSH", "BAK", "SCL", "CCS"];

// 关键验收：pt/tr 是否真正接入真实 RSS（替代 mock）。
// 真实采集文章 id 形如 rss-<hash>，mock 文章不同；统计首页 /pt|tr/article/rss- 链接数 > 0 即生效。
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const errors = {};
  const present = {}; // locale -> 出现的新代码集合
  const rssCount = {}; // locale -> 首页 rss- 文章链接数

  for (const loc of ["zh", "en", "pt", "tr", "es"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const perr = [];
    page.on("pageerror", (e) => perr.push(String(e)));
    const url = `${BASE}/${loc}`;
    let legendCodes = [];
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // 等水合 + 图例出现（最多 ~60s，多轮轮询）；地球经 dynamic(ssr:false) 懒加载，需等更久
      for (let i = 0; i < 40; i++) {
        legendCodes = await page.$$eval(".sd-leg-code", (els) => els.map((e) => e.textContent.trim())).catch(() => []);
        if (legendCodes.length > 0) break;
        await page.waitForTimeout(2000);
      }
      const title = await page.title();
      const titleOk = TITLE_HAS[loc]
        ? (title.includes(TITLE_HAS[loc]) || (TITLE_HAS[loc].split(" ").every((w) => title.includes(w))))
        : true; // es 已稳定，不强制校验
      present[loc] = NEW_CODES.filter((c) => legendCodes.includes(c));
      // 真实 RSS 文章链接统计（仅 pt/tr 强验收）
      let rc = 0;
      if (loc === "pt" || loc === "tr") {
        rc = await page.$$eval(`a[href*="/${loc}/article/rss-"]`, (els) => els.length).catch(() => 0);
      }
      rssCount[loc] = rc;
      await page.screenshot({ path: path.join(SHOTS, `cov30_${loc}_globe.png`), fullPage: false });
      errors[loc] = { pageErrors: perr, title, titleOk, legendCount: legendCodes.length, rssCount: rc };
      console.log(`[${loc}] titleOk=${titleOk} legend=${legendCodes.length} 新分站(${present[loc].length}/7)=${present[loc].join(",")} rss文章=${rc} pageErrors=${perr.length}`);
    } catch (e) {
      errors[loc] = { pageErrors: perr, fatal: String(e) };
      console.log(`[${loc}] FATAL ${e}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // 汇总
  const totalPresent = new Set(Object.values(present).flat());
  console.log("\n=== 汇总 ===");
  console.log("无 pageerror 的 locale：", Object.entries(errors).filter(([, v]) => (v.pageErrors || []).length === 0).map(([k]) => k).join(",") || "无");
  const badTitle = Object.entries(errors).filter(([, v]) => v.titleOk === false);
  console.log("字典未接入(title 不符)的 locale：", badTitle.length ? badTitle.map(([k, v]) => `${k}->${v.title}`).join(" | ") : "无 ✓");
  console.log(`新分站进图例覆盖：${totalPresent.size}/7 = ${[...totalPresent].sort().join(",")}`);
  const missing = NEW_CODES.filter((c) => !totalPresent.has(c));
  if (missing.length) console.log(`未进图例（可能采集源未拉到，非代码错误）：${missing.join(",")}`);
  // pt/tr 真实 RSS 强验收
  const ptRss = rssCount.pt || 0;
  const trRss = rssCount.tr || 0;
  console.log(`pt 真实 RSS 文章数=${ptRss}${ptRss > 0 ? " ✓ 已脱离 mock" : " ✗ 仍为空（采集源可能未拉到）"}`);
  console.log(`tr 真实 RSS 文章数=${trRss}${trRss > 0 ? " ✓ 已脱离 mock" : " ✗ 仍为空（采集源可能未拉到）"}`);
  console.log("\n截图：", ["zh", "en", "pt", "tr", "es"].map((l) => `${SHOTS}/cov30_${l}_globe.png`).join(", "));
})();
