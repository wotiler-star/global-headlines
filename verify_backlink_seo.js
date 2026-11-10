// verify_backlink_seo.js — 外链优化验收
// 1) 8 语种 /about 页面 200 + canonical/hreflang/OG/JSON-LD/引用块
// 2) Atom feed 200 且 XML 合规、条目含绝对 URL
// 3) RSS（合并 + 8 语种）channel/link、enclosure 绝对 URL、source 回链
// 4) 文章页 citation JSON-LD + 可见原始报道链接 nofollow
// 5) sitemap 收录 about、llms.txt 含 about 入口
// 6) 0 应用控制台错误（链路抖动单独归类）
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");
const BASE = "https://start" + "eday.com";
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const NET_ERR = /ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_HTTP2_SERVER_REFUSED_STREAM|ERR_HTTP2_PROTOCOL_ERROR|ERR_HTTP2_PING_FAILED|net::ERR/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (c, m) => (c ? pass : fail).push(m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  // --- 1. 8 语种 about 页 ---
  for (const loc of LOCALES) {
    let r = null, html = "";
    for (let t = 0; t < 3; t++) {
      r = await ctx.request.get(`${BASE}/${loc}/about`, { timeout: 40000 }).catch(() => null);
      if (r && r.status() === 200) { html = await r.text().catch(() => ""); break; }
      await sleep(2000);
    }
    const code = r ? r.status() : 0;
    ok(code === 200, `${loc}/about HTTP ${code}`);
    if (code !== 200) continue;
    ok(html.includes(`rel="canonical" href="${BASE}/${loc}/about"`) ||
       html.includes(`href="${BASE}/${loc}/about"`) && html.includes("canonical"),
       `${loc}/about canonical`);
    // Next SSR 把 hreflang 渲染成驼峰 hrefLang（HTML 属性名大小写不敏感，等价有效），
    // 且首页全站同此写法。这里不区分大小写，并确认确实带 rel=alternate。
    ok(/hrefLang=["']x-default["']/i.test(html) && /rel=["']alternate["']/i.test(html),
       `${loc}/about x-default hreflang`);
    ok(html.includes('property="og:title"') || html.includes("og:title"), `${loc}/about OG`);
    ok(html.includes('"@type":"AboutPage"'), `${loc}/about AboutPage JSON-LD`);
    ok(html.includes('"sameAs"') && html.includes("publishingPrinciples"), `${loc}/about Organization sameAs/规范`);
    ok(html.includes("cite-block"), `${loc}/about 可复制引用块`);
    ok(html.includes("IMAGE CREDITS") || html.includes("Wikimedia Commons"), `${loc}/about 图片署名政策`);
    ok(html.includes("/atom.xml"), `${loc}/about feed 入口`);
  }

  // --- 2. Atom feed ---
  {
    let r = null, txt = "";
    for (let t = 0; t < 3; t++) {
      r = await ctx.request.get(`${BASE}/atom.xml`, { timeout: 40000 }).catch(() => null);
      if (r && r.status() === 200) { txt = await r.text().catch(() => ""); break; }
      await sleep(2000);
    }
    const code = r ? r.status() : 0;
    ok(code === 200, `atom.xml HTTP ${code} (原 500)`);
    ok(txt.includes('<feed xmlns="http://www.w3.org/2005/Atom"'), "Atom 命名空间正确");
    ok(txt.includes('rel="self"'), "Atom rel=self");
    const entries = (txt.match(/<entry>/g) || []).length;
    ok(entries >= 10, `Atom 条目 ${entries}`);
    // 只统计 <entry> 内部的 alternate link：feed 头部还有一个站点级
    // <link rel="alternate" type="text/html">，不能算进条目数里。
    const entryBlocks = txt.split("<entry>").slice(1);
    const hrefs = entryBlocks
      .map(b => (b.match(/<link rel="alternate"[^>]*href="(https:\/\/[^"]+)"/) || [])[1])
      .filter(Boolean);
    ok(entryBlocks.length === entries && hrefs.length === entries && hrefs.every(h => h.startsWith(BASE)),
       `Atom 条目绝对 URL ${hrefs.length}/${entries}（feed 级 link 已排除）`);
  }

  // --- 3. RSS ---
  for (const path of ["/rss.xml", "/zh/rss.xml", "/en/rss.xml", "/tr/rss.xml"]) {
    let r = null, txt = "";
    for (let t = 0; t < 3; t++) {
      r = await ctx.request.get(BASE + path, { timeout: 40000 }).catch(() => null);
      if (r && r.status() === 200) { txt = await r.text().catch(() => ""); break; }
      await sleep(2000);
    }
    const code = r ? r.status() : 0;
    ok(code === 200, `RSS ${path} HTTP ${code}`);
    if (code !== 200) continue;
    const chanLink = (txt.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/) || [])[1] || "";
    ok(chanLink.startsWith(BASE) && !chanLink.endsWith("rss.xml"), `RSS ${path} channel/link 指向站点: ${chanLink}`);
    const encs = [...txt.matchAll(/<enclosure url="([^"]+)"/g)].map(m => m[1]);
    ok(encs.length > 0 && encs.every(u => u.startsWith(BASE)), `RSS ${path} enclosure 全绝对 ${encs.length}`);
    ok((txt.match(/<source url=/g) || []).length > 0, `RSS ${path} source 回链`);
    ok(txt.includes("<image>") && txt.includes("<copyright>"), `RSS ${path} image/copyright`);
  }

  // --- 4. 文章页 citation + 可见外链 ---
  {
    const u = `${BASE}/zh/article/rss-orig-solar-flare-field-2026-11`;
    let r = null, html = "";
    for (let t = 0; t < 3; t++) {
      r = await ctx.request.get(u, { timeout: 40000 }).catch(() => null);
      if (r && r.status() === 200) { html = await r.text().catch(() => ""); break; }
      await sleep(2000);
    }
    ok(r && r.status() === 200, `文章页 HTTP ${r ? r.status() : 0}`);
    ok(html.includes('"citation"') && html.includes('"isBasedOn"'), "文章 JSON-LD citation/isBasedOn");
    ok(html.includes("usageInfo"), "文章 JSON-LD usageInfo 指向 about");
    ok(html.includes('rel="nofollow noopener noreferrer citation"'), "原始报道外链 nofollow 合规");
    ok(html.includes("art-source-link"), "原始报道可见链接");
    ok(html.includes('"sameAs"'), "Organization sameAs（layout 级）");
  }

  // --- 5. sitemap / llms.txt ---
  {
    const sm = await ctx.request.get(`${BASE}/sitemap.xml`, { timeout: 40000 }).catch(() => null);
    const smt = sm ? await sm.text().catch(() => "") : "";
    const aboutLocs = [...smt.matchAll(/<loc>(https:\/\/[^<]*\/about)<\/loc>/g)].map(m => m[1]);
    ok(aboutLocs.length === 8, `sitemap 收录 about ${aboutLocs.length}/8`);
    const llms = await ctx.request.get(`${BASE}/llms.txt`, { timeout: 40000 }).catch(() => null);
    const lt = llms ? await llms.text().catch(() => "") : "";
    ok(lt.includes("/about") && lt.includes("atom.xml"), "llms.txt 含 about 与 Atom 入口");
  }

  // --- 6. 浏览器 0 应用错误（抽样 zh/en about + 首页） ---
  for (const p of ["/zh/about", "/en/about", "/zh"]) {
    const page = await browser.newContext().then(c => c.newPage());
    const errs = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(6000);
    const app = errs.filter(e => !NET_ERR.test(e) && !/favicon|404/.test(e));
    const net = errs.filter(e => NET_ERR.test(e));
    ok(app.length === 0, `浏览器 ${p} 应用错误 ${app.length}${app.length ? ": " + app[0].slice(0, 80) : ""}${net.length ? ` (链路抖动 ${net.length} 已排除)` : ""}`);
    await page.close();
  }

  await ctx.close();
  await browser.close();
  console.log(`PASS ${pass.length} FAIL ${fail.length}`);
  pass.forEach(x => console.log("  ✓", x));
  fail.forEach(x => console.log("  ✗", x));
  process.exit(fail.length ? 1 : 0);
})();
