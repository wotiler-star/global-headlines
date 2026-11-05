// verify_cov42.js — 八语种深度品牌验收 + RSS 修复验证
// 网络说明：本地 → 站点 HTTPS 偶发 socket hang up（项目已知），静态资源请求统一 3 次重试。
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");

const BASE = "https://starteday.com";
const BRAND = "start" + "eday";
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"];
const OLD = ["全球头条", "Global Headlines", "グローバルヘッドライン", "글로벌 헤드라인",
             "Titulares Globales", "Titres Mondiaux", "Manchetes Globais", "Küresel Manşetler"];

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errors.push("PAGEERR " + e.message.slice(0, 140)));
  const out = { perLocale: {}, checks: {}, assertions: [] };

  async function goto(path) {
    let last;
    for (let i = 0; i < 3; i++) {
      try { return await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 50000 }); }
      catch (e) { last = e.message; await page.waitForTimeout(1200); }
    }
    throw new Error("goto failed " + path + " : " + last);
  }
  async function reqGet(path, tries = 3) {
    let last;
    for (let i = 0; i < tries; i++) {
      try { return await page.request.get(BASE + path, { timeout: 30000 }); }
      catch (e) { last = e; await new Promise((r) => setTimeout(r, 900)); }
    }
    throw last;
  }
  const ck = (name, cond, got) => out.assertions.push({ name, pass: !!cond, got });

  try {
    // ---------- 八语种逐页验证（页内字标，而不只是 <title>）----------
    for (const L of LOCALES) {
      await goto("/" + L);
      await page.waitForSelector(".brand-mark", { timeout: 30000 });
      const r = await page.evaluate((OLDS) => {
        const t = (s) => (document.querySelector(s)?.innerText || "").replace(/\s/g, "");
        const zones = [".app-header", ".tt-hero", ".footer"].map((s) =>
          document.querySelector(s)?.innerText || "").join(" | ");
        return {
          title: document.title,
          logo: t(".logo"),
          h1: t(".tt-hero-title"),
          footerBrand: t(".footer-brand"),
          ogSite: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || null,
          themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") || null,
          appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || null,
          oldLeft: OLDS.filter((o) => zones.includes(o)),
        };
      }, OLD);
      out.perLocale[L] = r;
      ck(`${L} title`, r.title.startsWith(BRAND), r.title);
      ck(`${L} 页头字标`, r.logo === BRAND, r.logo);
      ck(`${L} Hero 字标`, r.h1 === BRAND, r.h1);
      ck(`${L} 页脚品牌行`, r.footerBrand.includes(BRAND), r.footerBrand);
      ck(`${L} OG site_name`, r.ogSite === BRAND, r.ogSite);
      ck(`${L} 无旧品牌`, r.oldLeft.length === 0, r.oldLeft.join(","));
      if (L === "pt") await page.screenshot({ path: "cov42_brand_pt.png", fullPage: false });
    }

    // ---------- 全站级 meta / 资源 ----------
    out.checks.themeColor = out.perLocale.zh.themeColor;
    out.checks.appleIcon = out.perLocale.zh.appleIcon;
    ck("浏览器主题色", out.checks.themeColor === "#ea5f22", out.checks.themeColor);
    ck("iOS 主屏图标", /apple-touch-icon\.png/.test(out.checks.appleIcon || ""), out.checks.appleIcon);

    const feeds = {};
    for (const L of LOCALES) {
      try {
        const res = await reqGet(`/${L}/rss.xml`);
        const body = await res.text();
        feeds[L] = {
          status: res.status(),
          title: (body.match(/<channel>\s*<title>([^<]*)<\/title>/) || [])[1] || null,
          items: (body.match(/<item>/g) || []).length,
          nakedDomain: /<link>https:\/\/starteday\.com\//.test(body),
        };
      } catch (e) { feeds[L] = { error: e.message.slice(0, 90) }; }
      ck(`RSS /${L}`, feeds[L].status === 200 && feeds[L].title === `${BRAND} (${L})` && feeds[L].items > 0, feeds[L]);
      if (L === "pt" || L === "tr") ck(`RSS /${L} 用裸域`, feeds[L].nakedDomain === true, feeds[L].nakedDomain);
    }
    out.checks.feeds = feeds;

    for (const u of ["/apple-touch-icon.png", "/sw.js", "/manifest.webmanifest", "/brand/og-cover.png"]) {
      const res = await reqGet(u);
      const size = (await res.body()).length;
      ck(`资源 ${u}`, res.status() === 200 && size > 100, `${res.status()} ${size}B`);
    }
    const sw = await (await reqGet("/sw.js")).text();
    ck("SW 缓存版本", /starteday-cache-v2/.test(sw), (sw.match(/const CACHE = "[^"]+"/) || [])[0]);

    // ---------- 404 页品牌落款（404 是预期状态，产生的控制台噪声不计入）----------
    const errBefore = errors.length;
    const nf = await goto("/zh/cov42-definitely-missing");
    await page.waitForTimeout(600);
    out.checks.notFound = await page.evaluate(() => ({
      text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 220),
      marks: document.querySelectorAll("svg").length,
    }));
    ck("404 状态码", nf.status() === 404, nf.status());
    ck("404 有品牌落款", /starteday/.test(out.checks.notFound.text), out.checks.notFound.text);
    await page.screenshot({ path: "cov42_404.png", fullPage: false });
    errors.length = errBefore;

    // ---------- 文章页 publisher（遍历所有 ld+json，第一个是 layout 的 WebSite）----------
    await goto("/zh");
    const href = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/zh/article/"]');
      return a ? a.getAttribute("href") : null;
    });
    if (href) {
      await goto(href);
      out.checks.article = await page.evaluate(() => {
        let publisher = null;
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            const j = JSON.parse(s.textContent || "null");
            const nodes = j?.["@graph"] || (Array.isArray(j) ? j : [j]);
            for (const n of nodes) {
              if (n?.["@type"] === "NewsArticle" && n?.publisher?.name) publisher = n.publisher.name;
            }
          } catch {}
        }
        return {
          ogSite: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || null,
          publisher,
        };
      });
      ck("文章页 OG site_name", out.checks.article.ogSite === BRAND, out.checks.article.ogSite);
      ck("文章页 publisher", out.checks.article.publisher === BRAND, out.checks.article.publisher);
    } else {
      ck("文章页可访问", false, "首页未找到文章链接");
    }

    out.summary = {
      total: out.assertions.length,
      passed: out.assertions.filter((a) => a.pass).length,
      failed: out.assertions.filter((a) => !a.pass).map((a) => a.name),
    };
    out.ok = out.summary.failed.length === 0;
  } catch (e) {
    out.fatal = e.message;
    out.ok = false;
  } finally {
    out.errors = errors.slice(0, 12);
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
