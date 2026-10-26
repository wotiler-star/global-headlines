// 截图验证：聚焦北京分站 → 悬停中国 → 截国家卡片（含可点击新闻列表）
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://www.starteday.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(BASE + "/zh", { waitUntil: "networkidle" });
  await page.waitForSelector(".sd-globe canvas", { timeout: 60000 });
  await sleep(9000);
  const rotBtn = await page.$(".sd-rot");
  const rotText = rotBtn ? await rotBtn.innerText() : "";
  if (rotText.includes("暂停")) { await rotBtn.click(); await sleep(500); }

  const wrap = await page.$(".sd-globe-wrap");
  const box = await wrap.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // 用图例把北京分站正对镜头（POV 居中中国）
  const legends = await page.$$(".sd-leg-item");
  for (const li of legends) {
    const code = (await li.$eval(".sd-leg-code", (e) => e.textContent)).trim();
    if (code === "BJS") { await li.hover(); break; }
  }
  await sleep(1200);
  let captured = false;
  for (const [dx, dy] of [[0, 0], [0, -40], [-50, 0], [50, 0], [0, 40], [0, -80], [-40, 40]]) {
    await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
    await sleep(350);
    const st = await page.evaluate(() => {
      const c = document.querySelector(".sd-country-card");
      const d = c ? getComputedStyle(c).display : "none";
      return { visible: d !== "none", items: c ? c.querySelectorAll(".sd-cc-news-item").length : 0, name: c && c.querySelector(".sd-cc-name") ? c.querySelector(".sd-cc-name").textContent : "" };
    });
    if (st.visible && st.items > 0) { captured = true; console.log("CAPTURED", JSON.stringify(st)); break; }
  }
  if (captured) {
    await page.screenshot({ path: "cov15_china_news.png", fullPage: false });
    const card = await page.$(".sd-country-card");
    if (card) await card.screenshot({ path: "cov15_card.png" });
  }
  console.log("done captured=" + captured);
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
