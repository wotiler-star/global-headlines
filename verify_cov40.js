const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERR " + e.message));
  const out = {};
  try {
    await page.goto("https://www.starteday.com/zh", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".sd-globe canvas", { timeout: 25000 });
    await page.waitForSelector(".sd-timeline", { timeout: 25000 });
    out.liveText = (await page.locator(".sd-timeline").innerText()).replace(/\n/g, " ");

    // 贴图切换按钮：昼夜 -> 日间
    const mapBefore = await page.locator("button:has-text('昼夜')").first().innerText();
    await page.locator("button:has-text('昼夜')").first().click();
    await page.waitForTimeout(400);
    const mapAfter = await page.locator("button:has-text('日间')").first().innerText().catch(() => null);
    out.mapBefore = mapBefore;
    out.mapAfter = mapAfter;

    // 时间轴：用原生 value setter（绕过 React 受控组件 value 劫持）模拟真实 input 事件
    await page.locator(".sd-range").evaluate((el) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, "5");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(500);
    out.hourText = await page.locator(".sd-hour").innerText();

    // LIVE 按钮回到全时
    await page.locator("button:has-text('LIVE')").first().click();
    await page.waitForTimeout(300);
    out.hourAfterLive = await page.locator(".sd-hour").innerText();

    await page.screenshot({ path: "cov40_shot.png", fullPage: false });
    out.ok = true;
  } catch (e) {
    out.fatal = e.message;
  } finally {
    out.errors = errors;
    console.log(JSON.stringify(out));
    await browser.close();
  }
})();
