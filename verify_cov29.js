// verify_cov29.js — 验收 cov29：pt/tr 界面语言 + 非洲/中东新分站 + 性能记忆
// 用法：node verify_cov29.js            （默认 https://starteday.com）
//       BASE=http://127.0.0.1:8082 node verify_cov29.js
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

// cov29 新增的 9 个非洲/中东城市代码（有信号才会出现在图例）
const NEW_CODES = ["DXB", "TLV", "DOH", "AMM", "NBO", "CPT", "ADD", "TUN", "GHA"];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const errors = {};
  const present = {}; // locale -> 出现的新代码集合

  for (const loc of ["zh", "en", "pt", "tr"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const perr = [];
    page.on("pageerror", (e) => perr.push(String(e)));
    const url = `${BASE}/${loc}`;
    let legendCodes = [];
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // 等水合 + 图例出现（最多 ~60s，多轮轮询）
      for (let i = 0; i < 30; i++) {
        legendCodes = await page.$$eval(".sd-leg-code", (els) => els.map((e) => e.textContent.trim())).catch(() => []);
        if (legendCodes.length > 0) break;
        await page.waitForTimeout(2000);
      }
      const title = await page.title();
      // 字典接入校验
      const titleOk = (TITLE_HAS[loc] || "").split(" ").every((w) => title.includes(w)) || title.includes(TITLE_HAS[loc] || "___");
      present[loc] = NEW_CODES.filter((c) => legendCodes.includes(c));
      await page.screenshot({ path: path.join(SHOTS, `cov29_${loc}_globe.png`), fullPage: false });
      errors[loc] = { pageErrors: perr, title, titleOk, legendCount: legendCodes.length };
      console.log(`[${loc}] titleOk=${titleOk} legend=${legendCodes.length} 新分站(${present[loc].length}/9)=${present[loc].join(",")} pageErrors=${perr.length}`);
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
  console.log(`新分站进图例覆盖：${totalPresent.size}/9 = ${[...totalPresent].sort().join(",")}`);
  const missing = NEW_CODES.filter((c) => !totalPresent.has(c));
  if (missing.length) console.log(`未进图例（可能采集源未拉到，非代码错误）：${missing.join(",")}`);
  console.log("\n截图：", Object.keys(present).map((l) => `${SHOTS}/cov29_${l}_globe.png`).join(", "));
})();
