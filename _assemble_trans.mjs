// 兜底工具: 随时从 _tp.json 进度独立组装 4 语种文章文件, 不依赖 _gen_trans 是否跑完。
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ORIG = path.join(ROOT, 'data', 'original');
const PROGRESS = path.join(ROOT, '_tp.json');
const LANGS = ['ru', 'ar', 'hi', 'id'];

function loadSources() {
  const map = new Map();
  for (const f of fs.readdirSync(ORIG)) {
    if (!/^premium.*\.json$/.test(f)) continue;
    if (/^premium-(ru|ar|hi|id)-2026/.test(f)) continue; // 排除本工具的输出
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(ORIG, f), 'utf8')); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    const lang = f === 'premium-2026-11.json' ? 'zh' : (f.match(/^premium-([a-z]{2})-2026/) || [, ''])[1];
    for (const a of arr) {
      if (!a || !a.id) continue;
      const base = a.id.replace(/-(en|es|fr|ja|ko|pt|tr|zh|ru|ar|hi|id)$/, '');
      if (!map.has(base)) map.set(base, {});
      map.get(base)[a.locale || lang] = a;
    }
  }
  return map;
}
const pickSource = v => v.en || v.zh || Object.values(v)[0];

const sources = loadSources();
const progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
const bases = [...sources.keys()].sort();
const out = { ru: [], ar: [], hi: [], id: [] };
const missing = [];
for (const base of bases) {
  const src = pickSource(sources.get(base));
  for (const l of LANGS) {
    const tr = progress[`${base}__${l}`];
    if (!tr) { missing.push(`${base}__${l}`); continue; }
    out[l].push({
      id: `${base}-${l}`,
      title: tr.title,
      summary: tr.summary,
      cover: src.cover,
      images: src.images,
      imageCount: src.imageCount,
      tags: tr.tags || src.tags,
      category: src.category,
      locale: l,
      source: src.source,
      sourceUrl: src.sourceUrl,
      author: src.author,
      publishedAt: src.publishedAt,
      readMinutes: src.readMinutes,
      pinned: src.pinned || 0,
      body: tr.body,
    });
  }
}
for (const l of LANGS) {
  const f = path.join(ORIG, `premium-${l}-2026-11.json`);
  fs.writeFileSync(f, JSON.stringify(out[l], null, 2));
  console.log(`[asm] 写出 ${path.basename(f)} (${out[l].length} 篇)`);
}
console.log(`[asm] 基础文章 ${bases.length} 篇, 缺失译文 ${missing.length} 条`);
if (missing.length) console.log('[asm] 前20缺失:', missing.slice(0, 20).join(', '));
