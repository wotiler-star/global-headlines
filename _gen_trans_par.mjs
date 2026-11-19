// 并发版: 生成 ru/ar/hi/id 四个新语种译文。
// 背景: nemotron-3-ultra-550b-a55b:free 是唯一可用引擎; 双语种长输出必超时(>150s),
//       故改为单语种任务 + 多并发; 实测 3 路并发无 429, 吞吐约翻倍。
// 断点续传: _tp.json (与 _gen_trans.mjs 共用), 原子写, 随时可中断重跑。
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ORIG = path.join(ROOT, 'data', 'original');
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const PROGRESS = path.join(ROOT, '_tp.json');
const LANGS = ['ru', 'ar', 'hi', 'id'];
const LNAME = { ru: 'Russian', ar: 'Arabic', hi: 'Hindi', id: 'Indonesian' };
// 默认单路: 免费模型有 50 次/天配额 + 并发易触发 429 风暴。
// 配额刷新后可用 TRANS_CONC=2 适度提速, 但不要 >2。
const CONCURRENCY = Number(process.env.TRANS_CONC || 1);
let quotaExhausted = false;

function loadSources() {
  const map = new Map();
  for (const f of fs.readdirSync(ORIG)) {
    if (!/^premium.*\.json$/.test(f)) continue;
    if (/^premium-(ru|ar|hi|id)-2026/.test(f)) continue;
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
const loadProgress = () => { try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch { return {}; } };
function saveProgress(p) { const tmp = PROGRESS + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(p)); fs.renameSync(tmp, PROGRESS); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makePrompt(src, srcLangName, l) {
  const body = (src.body || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
  return `You are a professional news translator. Translate the following ${srcLangName} news article into ${LNAME[l]} (${l}).
Return ONLY one JSON object, no markdown, no analysis, no reasoning, with this exact shape:
{"${l}":{"title":string,"summary":string,"tags":[string],"body":[string]}}
Rules:
- Translate naturally and fluently for a native news reader.
- Keep EXACTLY ${(src.body || []).length} body paragraphs: translate each numbered paragraph into one array element. Do not merge, split or omit any.
- Keep numbers, dates and brand/proper nouns as-is where appropriate.
- Tags: translate but keep proper nouns in original form.
Title: ${src.title}
Summary: ${src.summary}
Tags: ${(src.tags || []).join(', ')}
Body:
${body}`;
}

function stripFences(s) {
  let t = s.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) t = m[1].trim();
  const o = t.match(/\{[\s\S]*\}/);
  return o ? o[0] : t;
}

async function translateOne(task, tag) {
  const { src, srcLangName, l } = task;
  const prompt = makePrompt(src, srcLangName, l);
  let rpmRetries = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 8000 }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const c = j.choices?.[0]?.message?.content || '';
      if (r.status === 429 || (j.error && /rate/i.test(j.error.message || ''))) {
        const msg = String(j.error?.message || '');
        // 每日配额耗尽时立刻全局停机, 绝不继续烧掉剩余任务队列
        if (/free-models-per-day|daily|per-day/i.test(msg)) {
          quotaExhausted = true;
          console.log(`[FATAL] 免费模型每日配额耗尽 (X-RateLimit-Remaining: 0), 停止全部任务: ${msg.slice(0, 120)}`);
          return null;
        }
        rpmRetries++;
        if (rpmRetries > 6) { console.log(`[WARN] ${tag} RPM 限流持续, 放弃本轮`); return null; }
        console.log(`[retry] ${tag} 429 RPM ${secs}s, 退避 30s (${rpmRetries}/6)`);
        await sleep(30000); attempt--; continue; // RPM 限流不消耗重试次数
      }
      if (!c || c.length < 20) { console.log(`[retry] ${tag} empty(${r.status}) ${secs}s`); await sleep(3000); continue; }
      let p = null; try { p = JSON.parse(stripFences(c)); } catch {}
      const o = p && p[l];
      if (!o || !o.title || !Array.isArray(o.body) || o.body.length !== (src.body || []).length) {
        console.log(`[retry] ${tag} bad/paras=${o?.body?.length ?? 'x'} want=${(src.body || []).length} ${secs}s`);
        await sleep(2500); continue;
      }
      console.log(`[ok] ${tag} ${secs}s tok=${j.usage?.completion_tokens ?? '-'}`);
      return o;
    } catch (e) {
      console.log(`[retry] ${tag} ${e.name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await sleep(3000);
    }
  }
  return null;
}

async function main() {
  const sources = loadSources();
  const progress = loadProgress();
  const bases = [...sources.keys()].sort();
  const queue = [];
  for (const base of bases) {
    const v = sources.get(base);
    const src = pickSource(v);
    const srcLangName = v.en ? 'English' : (v.zh ? 'Chinese' : 'English');
    for (const l of LANGS) {
      if (!progress[`${base}__${l}`]) queue.push({ base, l, src, srcLangName });
    }
  }
  console.log(`[gen-par] 基础文章 ${bases.length} 篇 | 已有译文 ${Object.keys(progress).length} 条 | 待译任务 ${queue.length} 个 | 并发 ${CONCURRENCY}`);
  let done = 0;
  const failed = [], requeues = new Map();
  async function worker() {
    while (queue.length && !quotaExhausted) {
      const t = queue.shift();
      const tag = `${t.base}__${t.l}`;
      const res = await translateOne(t, tag);
      if (quotaExhausted) { queue.unshift(t); break; } // 配额停机: 当前任务留待下次续跑
      if (res) {
        progress[tag] = res;
        saveProgress(progress);
        done++;
        console.log(`[gen-par] 完成 ${done}, 进度总计 ${Object.keys(progress).length} 条`);
      } else {
        const n = (requeues.get(tag) || 0) + 1;
        requeues.set(tag, n);
        if (n <= 2) { queue.push(t); console.log(`[requeue] ${tag} 第 ${n} 次重排`); }
        else { failed.push(tag); console.log(`[WARN] ${tag} 最终失败`); }
      }
      await sleep(600);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  if (quotaExhausted) console.log(`[gen-par] 因每日配额耗尽提前停止, 队列剩余 ${queue.length} 个任务待下次续跑`);

  // 组装 4 语种文件 (与 _assemble_trans.mjs 同逻辑)
  const out = { ru: [], ar: [], hi: [], id: [] };
  const missing = [];
  for (const base of bases) {
    const src = pickSource(sources.get(base));
    for (const l of LANGS) {
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
  for (const l of LANGS) {
    fs.writeFileSync(path.join(ORIG, `premium-${l}-2026-11.json`), JSON.stringify(out[l], null, 2));
    console.log(`[gen-par] 写出 premium-${l}-2026-11.json (${out[l].length} 篇)`);
  }
  console.log(`[gen-par] 完成. 本次成功 ${done}, 失败 ${failed.length}, 仍缺 ${missing.length} 条`);
  if (missing.length) console.log('[gen-par] 前20缺失:', missing.slice(0, 20).join(', '));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
