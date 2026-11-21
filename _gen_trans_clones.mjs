// 批量生成 7 个克隆语种(ms/fil/vi/th/my/bn/ur)的真实译文, 替换 gen_locale_clones.mjs 产出的英文克隆。
// 源: 仅 data/original/premium-en-2026-11*.json (32 篇唯一, 英文策展稿)
// 引擎: OpenRouter 免费模型 nvidia/nemotron-3-ultra-550b-a55b:free
// 策略: 每篇每调用产出 2 语种(ms,fil)/(vi,th)/(my,bn)/(ur 单独);max_tokens 16000;段落数严格相等;
//       断点续传(_tp_clones.json);退避重试;并发 CONCURRENCY 个调用以压缩墙钟时间。
//       超时 300s(部分单语种调用需 ~190s, 200s 上限会误杀, 调高到 300s 避免无谓重试)。
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ORIG = path.join(ROOT, 'data', 'original');
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const PROGRESS = path.join(ROOT, '_tp_clones.json');
const PAIRS = [['ms', 'fil'], ['vi', 'th'], ['my', 'bn'], ['ur']];
const LANGS = ['ms', 'fil', 'vi', 'th', 'my', 'bn', 'ur'];
const LNAME = {
  ms: 'Malay', fil: 'Filipino', vi: 'Vietnamese', th: 'Thai',
  my: 'Burmese', bn: 'Bengali', ur: 'Urdu',
};
const CONCURRENCY = 3;
const TIMEOUT_MS = 300000;

// ---------- 只加载英文源 ----------
function loadSources() {
  const map = new Map();
  const files = fs.readdirSync(ORIG).filter(f => /^premium-en-2026-11.*\.json$/.test(f));
  console.log('[src] en 源文件:', files.join(', '));
  for (const f of files) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(ORIG, f), 'utf8')); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const a of arr) {
      if (!a || !a.id) continue;
      const base = a.id.replace(/-(en|es|fr|ja|ko|pt|tr|zh|ru|ar|hi|id|ms|fil|vi|th|my|bn|ur)$/, '');
      map.set(base, a); // 英文即源
    }
  }
  return map;
}

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildPrompt(src, srcLangName, langs) {
  const body = (src.body || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
  const langSpec = langs.map(l => `${LNAME[l]} (${l})`).join(' and ');
  return `You are a professional news translator. Translate the following ${srcLangName} news article into ${langSpec}.
Return ONLY a JSON object (no markdown, no commentary) with this exact shape, one key per target language:
{${langs.map(l => `"${l}":{"title":string,"summary":string,"tags":[string],"body":[string]}`).join(',')}}
Rules:
- Translate naturally and fluently for a native news reader.
- Keep the SAME number of body paragraphs as the source (currently ${(src.body || []).length}). Translate each paragraph; do not merge or split them.
- Keep numbers, dates, brand/proper nouns (e.g. INMO, NASA, China, EU, iPhone) as-is where appropriate.
- Tags: translate, but keep proper nouns in original form.
Title: ${src.title}
Summary: ${src.summary}
Tags: ${(src.tags || []).join(', ')}
Body:
${body}`;
}

async function callModel(prompt) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 16000 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const j = await r.json();
  return { status: r.status, content: j.choices?.[0]?.message?.content || '', err: j.error || null };
}

async function translate(src, srcLangName, langs, tag) {
  const prompt = buildPrompt(src, srcLangName, langs);
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    try {
      const { status, content, err } = await callModel(prompt);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (status === 429 || (err && /rate/i.test(err.message || ''))) {
        console.log(`[retry] ${tag} 429 ${secs}s wait ${(attempt + 1) * 4}s`);
        await sleep(4000 * (attempt + 1)); continue;
      }
      if (!content || content.length < 20) {
        console.log(`[retry] ${tag} empty(${status}) ${secs}s`);
        await sleep(2000 * (attempt + 1)); continue;
      }
      let parsed = null; try { parsed = JSON.parse(stripFences(content)); } catch {}
      if (!parsed) { console.log(`[retry] ${tag} badjson ${secs}s`); await sleep(2000); continue; }
      let ok = true;
      for (const l of langs) {
        const o = parsed[l];
        if (!o || !o.title || !Array.isArray(o.body) || o.body.length !== (src.body || []).length) { ok = false; break; }
      }
      if (!ok) { console.log(`[retry] ${tag} para-mismatch ${secs}s`); await sleep(2000 * (attempt + 1)); continue; }
      console.log(`[ok] ${tag} ${langs.join('/')} ${secs}s`);
      return parsed;
    } catch (e) {
      console.log(`[retry] ${tag} ${e.name || 'ERR'} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  const sources = loadSources();
  const progress = loadProgress();
  const bases = [...sources.keys()].sort();
  console.log(`[gen] 共 ${bases.length} 篇基础文章; 已翻译进度 ${Object.keys(progress).length} 条 (断点续传)`);

  // 构建任务队列(跳过已完成语种)
  const queue = [];
  for (const base of bases) {
    for (const pair of PAIRS) {
      const need = pair.filter(l => !progress[`${base}__${l}`]);
      if (need.length === 0) continue;
      queue.push({ base, pair });
    }
  }
  console.log(`[gen] 待处理任务 ${queue.length} 个, 并发 ${CONCURRENCY}`);

  let active = 0;
  async function worker() {
    while (queue.length) {
      const { base, pair } = queue.shift();
      const src = sources.get(base);
      const tag = `${base}:${pair.join('/')}`;
      let res = await translate(src, 'English', pair, tag);
      if (!res) {
        console.log(`[fallback] ${tag} -> 单语种降级`);
        res = {};
        for (const l of pair) {
          if (progress[`${base}__${l}`]) continue;
          const one = await translate(src, 'English', [l], `${base}:${l}`);
          if (one && one[l]) res[l] = one[l];
        }
      }
      if (!res || Object.keys(res).length === 0) {
        console.log(`[WARN] 跳过 ${tag} 翻译失败`);
        continue;
      }
      for (const l of pair) {
        if (res[l] && res[l].title && Array.isArray(res[l].body) && res[l].body.length === (src.body || []).length) {
          progress[`${base}__${l}`] = res[l];
        }
      }
      saveProgress(progress); // 同步写, 单线程下原子, 断点续传安全
      console.log(`[gen] 进度: ${Object.keys(progress).length} 条译文已落盘`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  console.log('[gen] 所有翻译任务完成, 开始组装 7 语种文件');

  // ---------- 组装 7 语种文件 ----------
  const out = {}; for (const l of LANGS) out[l] = [];
  const missing = [];
  for (const base of bases) {
    const src = sources.get(base);
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
  // 合并式写出: 以现有文件为基底, 只用真译文替换对应篇目, 未翻译篇目保留原样(继续 noindex 止血)。
  // 避免进度部分完成时整文件覆盖导致各语种篇目骤减而 404。
  for (const l of LANGS) {
    const fp = path.join(ORIG, `premium-${l}-2026-11.json`);
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {}
    const trById = new Map(out[l].map(a => [a.id, a]));
    const final = existing.map(a => {
      if (!trById.has(a.id)) return a;
      const t = trById.get(a.id);
      trById.delete(a.id);
      return t;
    });
    for (const [, a] of trById) final.push(a);
    fs.writeFileSync(fp, JSON.stringify(final, null, 2));
    console.log(`[gen] ${path.basename(fp)}: ${final.length} 篇 (真译文 ${out[l].length}, 保留原文 ${final.length - out[l].length})`);
  }
  console.log(`[gen] 完成. 进度 ${Object.keys(progress).length} 条, 缺失 ${missing.length} 条`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
