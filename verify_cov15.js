// cov15 验证：悬停国家→可点击分站新闻列表 + ?src 信息流过滤修复
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");

const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const out = {};

  // ---- 1. 首页 + 地球初始化 ----
  await page.goto(BASE + "/zh", { waitUntil: "networkidle" });
  await page.waitForSelector(".sd-globe canvas", { timeout: 60000 });
  await sleep(9000); // 等地球首帧 + boot 占位结束

  // 停自转（让聚焦后的国家稳定停在正面）
  const rotBtn = await page.$(".sd-rot");
  const rotText = rotBtn ? await rotBtn.innerText() : "";
  if (rotText.includes("暂停")) { await rotBtn.click(); await sleep(500); }
  out.rotatingStopped = true;

  const wrap = await page.$(".sd-globe-wrap");
  const box = await wrap.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const cardState = () =>
    page.evaluate(() => {
      const c = document.querySelector(".sd-country-card");
      if (!c) return { visible: false };
      const disp = getComputedStyle(c).display;
      const name = (c.querySelector(".sd-cc-name") || {}).textContent || "";
      const items = c.querySelectorAll(".sd-cc-news-item").length;
      const enter = !!c.querySelector(".sd-cc-enter");
      return { visible: disp !== "none", name, items, enter };
    });

  // ---- 2. 逐个聚焦图例地区 → 国家正对镜头 → 悬停中心检出分站卡片 ----
  const legend = await page.$$(".sd-leg-item");
  out.legendCount = legend.length;
  const detected = [];
  for (const li of legend) {
    const code = (await li.$eval(".sd-leg-code", (e) => e.textContent)).trim();
    await li.hover();
    await sleep(1100); // 等 POV 动画
    let st = null;
    // 中心 + 一圈偏移，尽量命中国家多边形
    const pts = [[0, 0], [0, -40], [0, 40], [-50, 0], [50, 0], [-40, 50], [40, 50], [0, -80]];
    for (const [dx, dy] of pts) {
      await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
      await sleep(320);
      st = await cardState();
      if (st.visible && st.items > 0) break;
    }
    detected.push({ code, ...st });
  }
  out.detected = detected;
  const good = detected.find((d) => d.visible && d.items > 0);

  // ---- 3. 点击新闻条目 → 进详情页 ----
  out.clickNews = null;
  if (good) {
    // 重新聚焦该地区并命中卡片
    const idx = detected.indexOf(good);
    const liEl = (await page.$$(".sd-leg-item"))[idx];
    await liEl.hover();
    await sleep(1100);
    let ok = false;
    for (const [dx, dy] of [[0, 0], [0, -40], [-50, 0], [50, 0], [0, 40]]) {
      await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
      await sleep(320);
      const s = await cardState();
      if (s.visible && s.items > 0) { ok = true; break; }
    }
    if (ok) {
      const before = page.url();
      await page.click(".sd-country-card .sd-cc-news-item");
      await page.waitForLoadState("networkidle");
      await sleep(1500);
      const url = page.url();
      const detailOk = await page.evaluate(() => {
        const h = document.querySelector("h1") || document.querySelector(".article-title") || document.querySelector(".at-title");
        return { url: location.pathname, hasTitle: !!h, title: h ? h.textContent : "" };
      });
      out.clickNews = { before, after: url, ...detailOk };
    }
  }

  // ---- 4. ?src 过滤修复验证 ----
  const testCode = good ? good.code : "BJS";
  await page.goto(BASE + "/zh?src=" + testCode, { waitUntil: "networkidle" });
  await sleep(2500);
  const feed = await page.evaluate(() => {
    const hasHomeSections = !!document.querySelector(".home-sections");
    const hasFeed = !!document.querySelector(".feed");
    const panelCode = (document.querySelector(".sd-panel .sd-panel-code") || {}).textContent || null;
    const cards = [...document.querySelectorAll(".feed-card")];
    const srcs = [...new Set(cards.map((c) => (c.querySelector(".src") || {}).textContent || ""))];
    return { hasHomeSections, hasFeed, panelCode, cardCount: cards.length, srcs };
  });
  out.srcFilter = { code: testCode, ...feed };

  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
