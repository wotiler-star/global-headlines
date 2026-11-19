// 批量生成 4 个新语种(ru/ar/hi/id)的文章译文版本(断点续传)。
// 源: data/original/premium-<lang>-2026-11*.json —— 只加载真实源语种 zh/en/es/fr/ja/ko/pt/tr。
// 引擎: OpenRouter 免费模型 nvidia/nemotron-3-ultra-550b-a55b:free
// 策略: 每篇每调用产出 2 语种(ru,ar)/(hi,id); max_tokens 8000; 单语种降级; 连续 429 熔断。
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ORIG = path.join(ROOT, 'data', 'original');
const KEY = process.env.OPENROUTER_API_KEY;
// 3.5-lightning + reasoning:none + 严格段落约束 prompt ≈ 8s/篇(550B 要 120s),快 15 倍
const MODEL = "nvidia/nemotron-3.5-lightning:free";
const EXTRA_BODY = { reasoning: { effort: "none" } };
const PROGRESS = path.join(ROOT, '_tp.json');
// 单语种逐个调用: 2 语种长文输出会超 max_tokens 截断且极易超时, 单语种 550B ~87s 可靠
const PAIRS = [['ru'], ['ar'], ['hi'], ['id']];
const LNAME = { ru: 'Russian', ar: 'Arabic', hi: 'Hindi', id: 'Indonesian' };
const SRC_LANGS = new Set(['zh', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'tr']);
let quotaHits = 0; // 连续 429 计数: 达阈值判定免费额度耗尽, 熔断停批

// ---------- 加载源 ----------
function loadSources() {
  const map = new Map();
  for (const f of fs.readdirSync(ORIG)) {
    if (!/^premium.*\.json$/.test(f)) continue;
    const m = f.match(/^premium-(?:([a-z]{2})-)?2026-11/);
    if (!m) continue;
    const lang = m[1] || 'zh';
    if (!SRC_LANGS.has(lang)) continue; // 排除克隆语种(bn/fil/ms/my/th/ur/vi)与本脚本输出(ru/ar/hi/id)
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(ORIG, f), 'utf8')); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const a of arr) {
      if (!a || !a.id) continue;
      const base = a.id.replace(/-(en|es|fr|ja|ko|pt|tr|zh)$/, '');
      if (!map.has(base)) map.set(base, {});
      map.get(base)[a.locale || lang] = a;
    }
  }
  return map;
}

function pickSource(v) { return v.en || v.zh || Object.values(v)[0]; }

function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch { return {}; } }
function saveProgress(p) {
  const tmp = PROGRESS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(p));
  fs.renameSync(tmp, PROGRESS);
}

function stripFences(s) {
  let t = s.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) t = m[1].trim();
  const o = t.match(/\{[\s\S]*\}/);
  return o ? o[0] : t;
}

// 容错 JSON 解析: 去掉控制字符后再试; 快速模型偶发输出非法 JSON, 配合多次重试兜底。
function parseLoose(s) {
  const raw = stripFences(s);
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(raw.replace(/[\u0000-\u001F\u007F]/g, ' ')); } catch {}
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildPrompt(src, srcLangName, langs, withMeta) {
  const n = (src.body || []).length;
  const body = (src.body || []).map((p, i) => `[${i + 1}] ${p}`).join('\n');
  const langSpec = langs.map(l => `${LNAME[l]} (${l})`).join(' and ');
  const shape = withMeta
    ? langs.map(l => `"${l}":{"title":string,"summary":string,"tags":[string],"body":[string]}`).join(',')
    : langs.map(l => `"${l}":{"body":[string]}`).join(',');
  const metaBlock = withMeta ? `Title: ${src.title}\nSummary: ${src.summary}\nTags: ${(src.tags || []).join(', ')}\n` : '';
  return `You are a professional news translator. Translate the following ${srcLangName} news article ${withMeta ? '(including its title, summary and tags)' : 'paragraphs'} into ${langSpec}.
Output ONLY a JSON object, no markdown, no commentary, with one key per target language:
{${shape}}
CRITICAL RULES:
- Each "body" array MUST contain EXACTLY ${n} strings — one translation per numbered paragraph below. Do NOT merge, split, drop, or add paragraphs. body[i] is the translation of paragraph [i+1].
- Translate naturally and fluently for a native news reader.
- Keep numbers, dates, and brand/proper nouns (e.g. INMO, NASA, China, EU) as-is where appropriate.
${withMeta ? '- Tags: translate, but keep proper nouns in original form.\n' : ''}${metaBlock}Numbered paragraphs:
${body}`;
}

async function callModel(prompt) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 8000 }, EXTRA_BODY)),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json();
  return { status: r.status, content: j.choices?.[0]?.message?.content || '', err: j.error || null };
}

// 翻译单个 block(一段 body),校验段落数;withMeta 为 true 时还要 title/summary/tags
async function translateBlock(block, srcLangName, langs, tag, withMeta) {
  const expect = (block.body || []).length;
  const prompt = buildPrompt(block, srcLangName, langs, withMeta);
  for (let attempt = 0; attempt < 8; attempt++) {
    const t0 = Date.now();
    try {
      const { status, content, err } = await callModel(prompt);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (status === 429 || (err && /rate/i.test(err.message || ''))) {
        quotaHits++;
        if (quotaHits >= 5) throw new Error('QUOTA_EXHAUSTED');
        console.log(`[retry] ${tag} 429 ${secs}s wait ${(attempt + 1) * 6}s (streak ${quotaHits})`);
        await sleep(6000 * (attempt + 1)); continue;
      }
      if (!content || content.length < 20) { console.log(`[retry] ${tag} empty(${status}) ${secs}s`); await sleep(3000 * (attempt + 1)); continue; }
      const parsed = parseLoose(content);
      if (!parsed) { console.log(`[retry] ${tag} badjson ${secs}s`); await sleep(1500); continue; }
      let ok = true;
      for (const l of langs) {
        const o = parsed[l];
        if (!o || !Array.isArray(o.body) || o.body.length !== expect) { ok = false; break; }
        if (withMeta && !o.title) { ok = false; break; }
      }
      if (!ok) { console.log(`[retry] ${tag} para-mismatch(got ${langs.map(l=>parsed[l]?.body?.length).join(',')}) ${secs}s`); await sleep(1200); continue; }
      quotaHits = 0;
      return parsed;
    } catch (e) {
      if (e.message === 'QUOTA_EXHAUSTED') throw e;
      console.log(`[retry] ${tag} ${e.name || 'ERR'} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

// 外层:长文(>6 段)按每块 6 段切分翻译后拼回;短文一次完成。
// 返回结构: { lang: { title, summary, tags, body:[...完整段落] } }
async function translate(src, srcLangName, langs, tag) {
  const paras = src.body || [];
  const CHUNK = 6;
  if (paras.length <= CHUNK) {
    const res = await translateBlock(src, srcLangName, langs, tag, true);
    if (res) console.log(`[ok] ${tag} ${langs.join('/')} ${paras.length}段`);
    return res;
  }
  // 分块
  const merged = {};
  let totalParas = 0;
  for (let start = 0; start < paras.length; start += CHUNK) {
    const slice = paras.slice(start, start + CHUNK);
    const withMeta = start === 0;
    const block = { title: src.title, summary: src.summary, tags: src.tags, body: slice };
    const res = await translateBlock(block, srcLangName, langs, `${tag}@${start}`, withMeta);
    if (!res) { console.log(`[WARN] ${tag} 块 ${start} 翻译失败`); return null; }
    for (const l of langs) {
      if (!merged[l]) merged[l] = { title: null, summary: null, tags: null, body: [] };
      merged[l].body.push(...res[l].body);
      if (withMeta) { merged[l].title = res[l].title; merged[l].summary = res[l].summary; merged[l].tags = res[l].tags; }
    }
    totalParas += slice.length;
  }
  for (const l of langs) if (!merged[l].title || merged[l].body.length !== paras.length) { console.log(`[WARN] ${tag} 拼接段落数不符`); return null; }
  console.log(`[ok] ${tag} ${langs.join('/')} ${totalParas}段(分块)`);
  return merged;
}

async function main() {
  const sources = loadSources();
  const progress = loadProgress();
  const bases = [...sources.keys()].sort();
  console.log(`[gen] 共 ${bases.length} 篇基础文章; 已翻译进度 ${Object.keys(progress).length} 条`);
  for (const base of bases) {
    const v = sources.get(base);
    const src = pickSource(v);
    const srcLangName = v.en ? 'English' : (v.zh ? 'Chinese' : 'English');
    for (const pair of PAIRS) {
      const need = pair.filter(l => !progress[`${base}__${l}`]);
      if (need.length === 0) continue;
      console.log(`[call] ${base} -> ${pair.join('/')} (need ${need.join('/')})`);
      let res = await translate(src, srcLangName, pair, `${base}:${pair.join('/')}`);
      if (!res) {
        console.log(`[fallback] ${base} ${pair.join('/')} -> 单语种降级`);
        res = {};
        for (const l of pair) {
          if (progress[`${base}__${l}`]) continue;
          const one = await translate(src, srcLangName, [l], `${base}:${l}`);
          if (one && one[l]) res[l] = one[l];
        }
      }
      if (!res || Object.keys(res).length === 0) { console.log(`[WARN] 跳过 ${base} (${pair.join('/')}) 翻译失败`); continue; }
      for (const l of pair) {
        if (res[l] && res[l].title && Array.isArray(res[l].body) && res[l].body.length === (src.body || []).length) {
          progress[`${base}__${l}`] = res[l];
        }
      }
      saveProgress(progress);
      console.log(`[gen] 进度: ${Object.keys(progress).length} 条译文已落盘`);
      await sleep(400);
    }
  }
  writeOutputs();
}

// 组装并写出 4 语种文件(正常完成 / 额度熔断都调用, 保证已完成的译文落盘)
function writeOutputs() {
  const sources = loadSources();
  const progress = loadProgress();
  const bases = [...sources.keys()].sort();
  const out = { ru: [], ar: [], hi: [], id: [] };
  const missing = [];
  for (const base of bases) {
    const src = pickSource(sources.get(base));
    for (const l of ['ru', 'ar', 'hi', 'id']) {
      const tr = progress[`${base}__${l}`];
      if (!tr) { missing.push(`${base}__${l}`); continue; }
      out[l].push({
        id: `${base}-${l}`, title: tr.title, summary: tr.summary,
        cover: src.cover, images: src.images, imageCount: src.imageCount,
        tags: tr.tags || src.tags, category: src.category, locale: l,
        source: src.source, sourceUrl: src.sourceUrl, author: src.author,
        publishedAt: src.publishedAt, readMinutes: src.readMinutes,
        pinned: src.pinned || 0, body: tr.body,
      });
    }
  }
  for (const l of ['ru', 'ar', 'hi', 'id']) {
    fs.writeFileSync(path.join(ORIG, `premium-${l}-2026-11.json`), JSON.stringify(out[l], null, 2));
    console.log(`[gen] 写出 premium-${l}-2026-11.json (${out[l].length} 篇)`);
  }
  console.log(`[gen] 完成. 缺失 ${missing.length} 条:`, missing.slice(0, 20).join(', '));
}

main().catch(e => {
  if (e && e.message === 'QUOTA_EXHAUSTED') {
    console.log('[QUOTA] 免费额度耗尽, 停止本批; 保存已完成的译文');
    try { writeOutputs(); } catch (err) { console.error('writeOutputs failed', err.message); }
    process.exit(0);
  }
  console.error('FATAL', e); process.exit(1);
});
