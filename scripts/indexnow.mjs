// scripts/indexnow.mjs — 新稿即时推送到 IndexNow（Bing / Yandex / DuckDuckGo / Seznam 等）
// 用法：容器内 node scripts/indexnow.mjs [小时窗口，默认 72]
// key 文件位于 public/<KEY>.txt，必须与本脚本 KEY 一致。
import fs from "node:fs";

const KEY = "a7f3c91e5b2d4806fae13c7d95b26e4f01";
const HOST = "starteday.com";
const BASE = `https://${HOST}`;
const HOURS = Number(process.argv[2] || 72);
const DATA = process.env.ARTICLES_PATH || "/app/data/articles.json";

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const articles = Array.isArray(raw) ? raw : raw.articles || [];
const cutoff = Date.now() - HOURS * 3600 * 1000;
const recent = articles.filter((a) => Number(a.publishedAt || 0) >= cutoff);
const urls = new Set([`${BASE}/`, ...recent.map((a) => `${BASE}/${a.locale}/article/${a.id}`)]);
// 8 语种首页始终提交，保证新批次被各语种入口发现
for (const loc of ["zh", "en", "ja", "ko", "es", "fr", "pt", "tr"]) urls.add(`${BASE}/${loc}`);

const urlList = [...urls];
console.log(`[indexnow] 窗口 ${HOURS}h 内 ${recent.length} 篇，提交 ${urlList.length} 个 URL`);

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
