// scripts/indexnow.mjs — 新稿即时推送到 IndexNow（Bing / Yandex / DuckDuckGo / Seznam 等）
// 用法：容器内 node scripts/indexnow.mjs [小时窗口，默认 72]
// key 文件位于 public/<KEY>.txt，必须与本脚本 KEY 一致。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = join(fileURLToPath(new URL("../", import.meta.url)));

const KEY = "a7f3c91e5b2d4806fae13c7d95b26e4f01";
const HOST = "starteday.com";
const BASE = `https://${HOST}`;
const HOURS = Number(process.argv[2] || 72);
const DATA = process.env.ARTICLES_PATH || "/app/data/articles.json";
// FULL=1：全量模式，提交全部非克隆文章页，上限 10000（IndexNow 单次请求上限）。
// ⚠️ Bing WMT 明确警告「避免使用 IndexNow 批量模式，以防止服务器负载过高和潜在的索引延迟」。
// 因此 FULL 仅限站点首次接入 IndexNow 时手动执行一次（2026-11-20 已推 616 URL），
// 严禁重复执行、严禁放进任何定时任务。全量发现请靠 sitemap.xml / news-sitemap.xml，
// 日常增量一律走默认 72h 窗口（几个到几十个 URL 即可）。
const FULL = process.env.FULL === "1";

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const articles = Array.isArray(raw) ? raw : raw.articles || [];
// 与文章页 noindex / sitemap 同一口径：未翻译的英文复读页不推送给 IndexNow，
// 否则等于主动请 Bing/Yandex 抓取 200+ 重复 URL。译文补齐后标题变化会自动恢复推送。
function readCloneLocales() {
  try {
    const src = fs.readFileSync(join(ROOT, "src", "i18n", "config.ts"), "utf8");
    const m = src.match(/export const NEW_LOCALES\s*=\s*\[([^\]]+)\]/);
    return m ? [...m[1].matchAll(/["']([a-z]{2,3})["']/g)].map((x) => x[1]) : [];
  } catch {
    return [];
  }
}
const CLONE_LOCALES = new Set(readCloneLocales());
// 23 语种（含 zh-Hant 繁体；放在 zh 之前让 alternation 先吃掉长码）
const LOCALES = ["zh-Hant", "zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "tr", "ru", "uk", "ar", "hi", "id", "ms", "fil", "vi", "th", "my", "bn", "ur"];
const SUFFIX = new RegExp(`-(${LOCALES.join("|")})$`);
const baseId = (id = "") => String(id).replace(SUFFIX, "");
const enOriginals = new Map(
  articles.filter((a) => a.locale === "en" && String(a.id || "").startsWith("rss-orig-"))
    .map((a) => [baseId(a.id), a])
);
function isEnglishClone(a) {
  if (!CLONE_LOCALES.has(a.locale) || !String(a.id || "").startsWith("rss-orig-")) return false;
  const en = enOriginals.get(baseId(a.id));
  return !!en && en.title === a.title && en.summary === a.summary;
}
const cutoff = Date.now() - HOURS * 3600 * 1000;
const recent = FULL
  ? articles.filter((a) => Number(a.publishedAt || 0) > 0 && !isEnglishClone(a))
  : articles.filter((a) => Number(a.publishedAt || 0) >= cutoff && !isEnglishClone(a));
const urls = new Set([`${BASE}/`, ...recent.map((a) => `${BASE}/${a.locale}/article/${a.id}`)]);
// 全部 23 语种首页始终提交，保证新批次被各语种入口发现
for (const loc of LOCALES) urls.add(`${BASE}/${loc}`);

const urlList = [...urls].slice(0, 10000);
console.log(`[indexnow] ${FULL ? "FULL 模式" : `窗口 ${HOURS}h`} 内 ${recent.length} 篇，提交 ${urlList.length} 个 URL`);
if (FULL) console.warn("[indexnow] ⚠️ FULL 批量模式：Bing 不推荐，仅限首次接入一次性使用，请勿重复执行");
if (process.env.DRY_RUN === "1") {
  console.log("[indexnow] DRY_RUN=1，跳过实际上报");
  process.exit(0);
}

const body = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `${BASE}/${KEY}.txt`,
  urlList,
});

// 双通道推送：
// 1) api.indexnow.org 聚合端点 → Yandex / Seznam / Naver / DuckDuckGo 等
// 2) www.bing.com/indexnow 微软官方专用端点 → Bing 优先收录（实测 200 有效）
// Bing sitemap ping（www.bing.com/ping?sitemap=）已于 2023 废弃返回 410，故不用。
// 两个端点互不影响；单个失败仅告警不阻断其他端点，避免一处超时拖垮整批推送。
const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
];
for (const endpoint of ENDPOINTS) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
    });
    const text = await res.text();
    const ok = res.status === 200 || res.status === 202;
    console.log(`[indexnow] ${new URL(endpoint).host} HTTP ${res.status} ${text.slice(0, 160)} ${ok ? "✓" : "✗"}`);
    if (!ok) process.exitCode = 1;
  } catch (e) {
    console.warn(`[indexnow] ${new URL(endpoint).host} 请求失败: ${e?.message || e}`);
    process.exitCode = 1;
  }
}
