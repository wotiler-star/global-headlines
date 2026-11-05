// verify_cov41.js — starteday 品牌升级线上验收（Playwright）
const { chromium } = require("C:/Users/Administrator/node_modules/playwright");

const BASE = "https://starteday.com";
const BRAND = "start" + "eday";
const OLD = ["全球头条", "Global Headlines", "グローバルヘッドライン", "Titulares Globales", "Titres Mondiaux"];

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("PAGEERR " + e.message.slice(0, 160)));
  const out = { checks: {} };

  async function goto(path) {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
        return;
      } catch (e) { last = e.message; await page.waitForTimeout(1500); }
    }
    throw new Error("goto failed " + path + " : " + last);
  }

  try {
    // ---------- 中文首页 ----------
    await goto("/zh");
    await page.waitForSelector(".brand-mark", { timeout: 30000 });
    await page.waitForTimeout(2500);

    const zh = await page.evaluate((OLD_LIST) => {
      const txt = (s) => (document.querySelector(s)?.innerText || "").trim();
      const cs = getComputedStyle(document.documentElement);
      const mark = document.querySelector(".brand-mark");
      let jsonLd = null;
      try { jsonLd = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || "null"); } catch {}
      const meta = (sel, attr = "content") => document.querySelector(sel)?.getAttribute(attr) || null;
      const brandZones = [txt(".app-header"), txt(".tt-hero"), txt(".footer")].join(" | ");
      return {
        title: document.title,
        logo: txt(".logo"),
        h1: txt(".tt-hero-title"),
        tagline: txt(".tt-hero-tagline"),
        footer: txt(".footer-brand"),
        footerMeta: txt(".footer-meta"),
        heroTagline: txt(".tt-hero-tagline"),
        brandVar: cs.getPropertyValue("--brand").trim(),
        solidVar: cs.getPropertyValue("--brand-solid").trim(),
        markBg: mark ? getComputedStyle(mark).backgroundImage.slice(0, 80) : null,
        markCount: document.querySelectorAll(".brand-mark").length,
        wordmarkCount: document.querySelectorAll(".wordmark").length,
        ogSiteName: meta('meta[property="og:site_name"]'),
        ogImage: meta('meta[property="og:image"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
        jsonLdNames: (jsonLd?.["@graph"] || []).map((n) => n.name),
        jsonLdLogo: (jsonLd?.["@graph"] || []).find((n) => n["@type"] === "Organization")?.logo?.url || null,
        rssTitle: meta('link[rel="alternate"][type="application/rss+xml"]', "title"),
        oldBrandInZones: OLD_LIST.filter((o) => brandZones.includes(o)),
      };
    }, OLD);
    out.checks.zh = zh;
    await page.screenshot({ path: "cov41_brand_zh.png", fullPage: false });

    // ---------- 浅色主题下的品牌可读性 ----------
    try {
      await page.locator(".theme-toggle").click();
      await page.waitForTimeout(700);
      out.checks.light = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        brand: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      await page.screenshot({ path: "cov41_brand_light.png", fullPage: false });
      await page.locator(".theme-toggle").click();
      await page.waitForTimeout(400);
    } catch (e) {
      out.checks.light = { error: e.message.slice(0, 90) };
    }

    // ---------- 静态品牌资源 ----------
    const assets = {};
    for (const u of ["/manifest.webmanifest", "/icon.svg", "/favicon.ico",
                     "/icons/icon-192.png", "/icons/icon-512.png",
                     "/icons/icon-maskable-512.png", "/brand/og-cover.png",
                     "/brand/starteday-lockup.svg", "/rss.xml"]) {
      try {
        const r = await page.request.get(BASE + u, { timeout: 25000 });
        assets[u] = { status: r.status(), size: (await r.body()).length };
      } catch (e) { assets[u] = { error: e.message.slice(0, 90) }; }
    }
    out.checks.assets = assets;
    try {
      const mf = await (await page.request.get(BASE + "/manifest.webmanifest")).json();
      out.checks.manifest = { name: mf.name, short_name: mf.short_name, theme_color: mf.theme_color, icons: mf.icons.length };
    } catch (e) { out.checks.manifest = { error: e.message.slice(0, 90) }; }

    // ---------- 英文首页：品牌名不随语言本地化 ----------
    await goto("/en");
    await page.waitForSelector(".brand-mark", { timeout: 30000 });
    out.checks.en = await page.evaluate(() => ({
      title: document.title,
      logo: (document.querySelector(".logo")?.innerText || "").trim(),
      h1: (document.querySelector(".tt-hero-title")?.innerText || "").trim(),
      tagline: (document.querySelector(".tt-hero-tagline")?.innerText || "").trim(),
      footer: (document.querySelector(".footer-meta")?.innerText || "").trim(),
    }));
    await page.screenshot({ path: "cov41_brand_en.png", fullPage: false });

    // ---------- 搜索页品牌位 ----------
    await goto("/zh/search?q=AI");
    await page.waitForSelector(".sp-logo", { timeout: 30000 });
    out.checks.searchLogo = await page.evaluate(() => ({
      text: (document.querySelector(".sp-logo")?.innerText || "").trim(),
      isLink: document.querySelector(".sp-logo")?.tagName,
      mark: !!document.querySelector(".sp-logo .brand-mark"),
    }));

    // ---------- 断言 ----------
    const A = [];
    const ck = (name, cond, got) => A.push({ name, pass: !!cond, got });
    ck("zh title 含品牌", zh.title.includes(BRAND), zh.title);
    ck("zh logo = 品牌字标", zh.logo.replace(/\s/g, "") === BRAND, zh.logo);
    ck("zh h1 = 品牌字标", zh.h1.replace(/\s/g, "") === BRAND, zh.h1);
    ck("页脚有品牌行", zh.footer.replace(/\s/g, "").includes(BRAND), zh.footer);
    ck("字标为连续文本", zh.logo.replace(/\s/g, "") === BRAND && !zh.logo.includes("\n"), zh.logo);
    ck("浅色主题品牌色", out.checks.light?.brand === "#c2410c", out.checks.light);
    ck("品牌标语已显示", zh.tagline.length > 0, zh.tagline);
    ck("无旧品牌残留", zh.oldBrandInZones.length === 0, zh.oldBrandInZones.join(","));
    ck("主色已换晨曦橙", zh.brandVar === "#ff9248", zh.brandVar);
    ck("mark 使用渐变", /gradient/.test(zh.markBg || ""), zh.markBg);
    ck("mark 在 header+footer 均渲染", zh.markCount >= 2, zh.markCount);
    ck("OG site_name", zh.ogSiteName === BRAND, zh.ogSiteName);
    ck("OG 分享图", /og-cover\.png/.test(zh.ogImage || ""), zh.ogImage);
    ck("JSON-LD 名称", (zh.jsonLdNames || []).every((n) => n === BRAND), zh.jsonLdNames);
    ck("JSON-LD logo", /\/icon\.svg$/.test(zh.jsonLdLogo || ""), zh.jsonLdLogo);
    ck("RSS 订阅名", /starteday/.test(zh.rssTitle || ""), zh.rssTitle);
    ck("en 仍用同一品牌", out.checks.en.logo.replace(/\s/g, "") === BRAND, out.checks.en.logo);
    ck("en title 含品牌", out.checks.en.title.includes(BRAND), out.checks.en.title);
    ck("搜索页品牌位", out.checks.searchLogo.text.replace(/\s/g, "") === BRAND && out.checks.searchLogo.isLink === "A", out.checks.searchLogo);
    ck("manifest 品牌", /starteday/.test(out.checks.manifest.name || ""), out.checks.manifest.name);
    ck("PWA 图标齐全", out.checks.manifest.icons >= 4, out.checks.manifest.icons);
    for (const [u, v] of Object.entries(assets)) ck("资源 " + u, v.status === 200 && v.size > 100, JSON.stringify(v));
    out.assertions = A;
    out.summary = { total: A.length, passed: A.filter((a) => a.pass).length, failed: A.filter((a) => !a.pass).map((a) => a.name) };
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
