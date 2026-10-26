// cov27 验证：地球仪「图例点击 / 分站直载镜头不转向」bug 修复
// 范式：轮询重试（本地→服务器 HTTPS 偶发挂起），长等待水合 + 地球 canvas 出现。
//
// 验收重点（cov25 遗留 bug）：
//   - 直载 ?src=MOW 时，地球初始化完成后应按 active 补转镜头到该地区。
//   - 之前 bug：worldRef 在 [active] 镜头 effect 运行时为 null → 跳过，地球不转向。
//   - 现修复：globe 就绪瞬间按 activeRef 补转（SignalDeck.tsx）。
// 可观测代理：
//   1) 选中态 UI：图例 .sd-leg-item.on（code=MOW）+ 面板 .sd-panel-code == "MOW"（与镜头同链路）。
//   2) 镜头转向：暂停自转后读 .sd-coord HUD（相机经纬度），应接近 MOW(≈55.75N, 37.6E)；
//      因自转漂移，仅作辅助核对（非硬性 gate），主要看截图 + 选中态。
const { chromium } = require('C:/Users/Administrator/node_modules/playwright');

const CODE = process.env.CODE || 'MOW';
const BASE = process.env.BASE || ('https://starteday.com/zh?src=' + CODE);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let page = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForSelector('.sd-globe', { timeout: 60000 });
      page = p;
    } catch (e) {
      console.log(`第 ${attempt} 轮加载失败: ${e.message.split('\n')[0]}`);
      await p.close();
    }
  }
  if (!page) { console.log('ALL_ATTEMPTS_FAILED'); await browser.close(); process.exit(1); }

  const report = {};

  // ---- 等地球 canvas 出现（进入视口才创建，可能要滚一下）----
  let hasCanvas = false;
  for (let i = 0; i < 25 && !hasCanvas; i++) {
    hasCanvas = await page.evaluate(() => !!document.querySelector('.sd-globe canvas'));
    if (!hasCanvas) await page.waitForTimeout(1000);
  }
  report.canvasReady = hasCanvas;
  await page.waitForTimeout(4000); // 等补转镜头 + 水合稳定

  // ---- 1. 选中态 UI（与镜头同驱动链：active → selected → 图例 on + 面板 code）----
  report.selection = await page.evaluate((code) => {
    const onItem = document.querySelector('.sd-leg-item.on');
    const panelCode = document.querySelector('.sd-panel .sd-panel-code');
    return {
      legendOnCode: onItem ? onItem.querySelector('.sd-leg-code')?.textContent : null,
      panelCode: panelCode ? panelCode.textContent : null,
      legendOnMatches: onItem ? (onItem.querySelector('.sd-leg-code')?.textContent === code) : false,
      panelMatches: panelCode ? (panelCode.textContent === code) : false,
    };
  }, CODE);
  report.selectionPass = report.selection.legendOnMatches && report.selection.panelMatches;

  // ---- 2. 镜头转向辅助核对：暂停自转 → 读相机 HUD 经纬度 ----
  try {
    // 点「⏸ 暂停」停自转，避免漂移
    const paused = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.sd-rot')].find((b) => /暂停|⏸/.test(b.textContent));
      if (btn) { btn.click(); return true; }
      return false;
    });
    report.autoRotatePaused = paused;
    await page.waitForTimeout(800);
    report.cameraCoord = await page.evaluate(() => {
      const el = document.querySelector('.sd-coord');
      return el ? el.textContent : null;
    });
    // 解析 LAT/LON
    const m = (report.cameraCoord || '').match(/LAT\s*([-\d.]+).*LON\s*([-\d.]+)/);
    if (m) {
      const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
      // MOW ≈ 55.75N, 37.6E；自转漂移下允许 ±25° 误差作为辅助判断
      report.cameraNearRegion = Math.abs(lat - 55.75) < 25 && Math.abs(((lon - 37.6 + 540) % 360) - 180) < 25;
    }
  } catch (e) {
    report.cameraCoord = 'err:' + e.message.split('\n')[0];
  }

  // ---- 截图（globe 区域）----
  try {
    const wrap = await page.$('.sd-globe-wrap');
    if (wrap) {
      const box = await wrap.boundingBox();
      if (box) {
        const OUT = process.env.OUT || 'shots_live';
        await page.screenshot({ path: `${OUT}/cov27_${CODE}_globe.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
        report.screenshot = `${OUT}/cov27_${CODE}_globe.png`;
      }
    }
  } catch (e) {
    report.screenshot = 'err:' + e.message.split('\n')[0];
  }

  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
