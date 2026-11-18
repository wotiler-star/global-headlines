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
const LOCALES = ["zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "tr", "ru", "uk", "ar", "hi", "id", "ms", "fil", "vi", "th", "my", "bn", "ur"];
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
const recent = articles.filter((a) => Number(a.publishedAt || 0) >= cutoff && !isEnglishClone(a));
const urls = new Set([`${BASE}/`, ...recent.map((a) => `${BASE}/${a.locale}/article/${a.id}`)]);
// 全部 22 语种首页始终提交，保证新批次被各语种入口发现
for (const loc of LOCALES) urls.add(`${BASE}/${loc}`);

const urlList = [...urls];
console.log(`[indexnow] 窗口 ${HOURS}h 内 ${recent.length} 篇，提交 ${urlList.length} 个 URL`);
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

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body,
});
const text = await res.text();
console.log(`[indexnow] HTTP ${res.status} ${text.slice(0, 200)}`);
if (res.status !== 200 && res.status !== 202) process.exitCode = 1;
