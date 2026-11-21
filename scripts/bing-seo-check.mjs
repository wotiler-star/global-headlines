// scripts/bing-seo-check.mjs — Bing SEO 健康度自检（只读，不联网到 Bing SERP）
// 用法：node scripts/bing-seo-check.mjs [站点根URL，默认 https://starteday.com]
// 核查：robots.txt / sitemap / news-sitemap / IndexNow key / msvalidate 验证 /
//       canonical 域名一致性 / 文章页 NewsArticle JSON-LD / noindex 克隆页是否误入 sitemap。
// 说明：Bing SERP 的 site: 查询在数据中心 IP 上会被污染，不能用它判断收录，
//       真实收录数据只能看 Bing Webmaster Tools 后台——本脚本刻意不查 SERP。
const BASE = (process.argv[2] || "https://starteday.com").replace(/\/$/, "");
const INDEXNOW_KEY = "a7f3c91e5b2d4806fae13c7d95b26e4f01";
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "tr", "ru", "uk", "ar", "hi", "id", "zh-Hant"];

async function get(path) {
  try {
    const res = await fetch(BASE + path, { redirect: "follow" });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: "", err: e?.message };
  }
}
function line(ok, label, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
}

console.log(`Bing SEO 自检：${BASE}\n`);

// 1. robots.txt
const robots = await get("/robots.txt");
line(robots.status === 200, "robots.txt 可达", `HTTP ${robots.status}`);
line(/Sitemap:/i.test(robots.text), "robots 声明 sitemap");
line(!/Disallow:\s*\/\s*$/m.test(robots.text), "robots 未全站封禁");

// 2. sitemap
const sm = await get("/sitemap.xml");
const smUrls = (sm.text.match(/<loc>/g) || []).length;
line(sm.status === 200 && smUrls > 100, "sitemap.xml 正常", `HTTP ${sm.status}, ${smUrls} URL`);
const smHosts = new Set((sm.text.match(/<loc>https?:\/\/[^/]+/g) || []).map((s) => s.replace("<loc>", "")));
line(smHosts.size === 1 && smHosts.has(BASE), "sitemap 域名统一", [...smHosts].join(", "));

// 3. news-sitemap
const ns = await get("/news-sitemap.xml");
const nsUrls = (ns.text.match(/<loc>/g) || []).length;
line(ns.status === 200 && nsUrls > 0, "news-sitemap.xml 正常", `HTTP ${ns.status}, ${nsUrls} URL`);

// 4. IndexNow key
const key = await get(`/${INDEXNOW_KEY}.txt`);
line(key.status === 200 && key.text.trim() === INDEXNOW_KEY, "IndexNow key 文件有效", `HTTP ${key.status}`);

// 5. Bing 站点验证 meta（首页即可）
const home = await get("/zh");
const ms = home.text.match(/msvalidate\.01"\s+content="([0-9A-Fa-f]{32})"/);
line(!!ms, "Bing msvalidate.01 验证", ms ? `code=${ms[1].slice(0, 8)}…` : "未检测到");

// 6. canonical 域名一致性（抽查一个文章页）
const art = await get("/zh/article/rss-orig-twisted-oxide-moire-2026-11q");
const canon = art.text.match(/<link rel="canonical" href="([^"]+)"/);
line(!!canon && canon[1].startsWith(BASE + "/"), "文章页 canonical 域名一致", canon ? canon[1] : "无");
line(/application\/ld\+json/.test(art.text) && /NewsArticle/.test(art.text), "文章页 NewsArticle JSON-LD");
const noindex = /name="robots"[^>]*content="[^"]*noindex/.test(art.text) || /content="[^"]*noindex[^"]*"[^>]*name="robots"/.test(art.text);
line(!noindex, "抽查文章可索引（非 noindex）");

// 7. 多语种首页可达
let bad = [];
for (const l of LOCALES) {
  const r = await get("/" + l);
  if (r.status !== 200) bad.push(`${l}:${r.status}`);
}
line(bad.length === 0, `多语种首页可达（${LOCALES.length}）`, bad.length ? bad.join(" ") : "全部 200");

console.log(`\n完成 ${process.exitCode ? "（存在异常项）" : "（全部通过）"}`);
