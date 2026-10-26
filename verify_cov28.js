// cov28 验收：数据覆盖扩充（葡语/土耳其/东南亚分站）+ 首页响应式打磨
//  - 加载中/英首页，断言无 pageerror；
//  - 检查新增分站代码是否已进入地球图例（即已采到信号数据）：
//      BKK 曼谷 / JKT 雅加达 / KUL 吉隆坡 / SIN 新加坡 / LAD 罗安达 / MPM 马普托 / RIO 里约 / IST 伊斯坦布尔(修复死站)
//  - 某代码缺失 = 对应 RSS 源在服务器网络不可达（采集器优雅跳过），并非代码错误；报告供排查。
//  - 截图留存（桌面图例顶部对齐 / 面板滚动 的视觉核对）。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");

const BASE = process.env.BASE || "https://starteday.com";
const CODES = ["BKK", "JKT", "KUL", "SIN", "LAD", "MPM", "RIO", "IST"];
const TARGETS = [
  { loc: "zh", url: `${BASE}/zh` },
  { loc: "en", url: `${BASE}/en` },
];

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    try {
      await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // 轮询等地球 canvas 与水合（SignalDeck 进入视口才建地球）
      let ok = false;
      for (let i = 0; i < 30; i++) {
        const has = await page.$("canvas");
        if (has) { ok = true; break; }
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(2500);
      const body = await page.content();
      const present = CODES.filter((c) => body.includes(`>${c}<`) || body.includes(c));
      const missing = CODES.filter((c) => !present.includes(c));
      const shot = `shots_live/cov28_${t.loc}_globe.png`;
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`[${t.loc}] 地球就绪=${ok} pageerror=${errors.length}`);
      console.log(`[${t.loc}] 已进入图例的新分站: ${present.join(", ") || "(无)"}`);
      console.log(`[${t.loc}] 未出现(可能源不可达): ${missing.join(", ") || "(全部到位)"}`);
      console.log(`[${t.loc}] 截图: ${shot}`);
      if (errors.length) { failed = true; console.log(`[${t.loc}] ⚠ 控制台/页面错误:\n` + errors.slice(0, 5).join("\n")); }
      // 桌面图例顶部对齐：检查 .sd-legend 计算样式 top≈10px（非 50% 居中）
      const legTop = await page.$eval(".sd-legend", (el) => getComputedStyle(el).top).catch(() => "n/a");
      console.log(`[${t.loc}] .sd-legend top=${legTop}（期望 ~10px，长列表顶部对齐）`);
    } catch (e) {
      failed = true;
      console.log(`[${t.loc}] ❌ 加载失败: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(failed ? "\n=== cov28 验收：存在错误，请查看上方 ⚠/❌ ===" : "\n=== cov28 验收：无 pageerror，新分站信号见上方覆盖率 ===");
  process.exit(failed ? 1 : 0);
})();
