import { Article } from "@/data/news";
import { tokenize, buildIdf } from "@/lib/keywords";

// 相关阅读精排（服务端/构建期专用，勿在客户端组件引用：会带进 16MB 分词词典）。
// 打分：标题+摘要+标签 关键词(词典分词 + 语料 IDF)重合*6 + 同标签*2 + 同来源*0.6 + 同分类*0.8 + 时效接近*0.3
// 关键改进：把摘要也纳入分词，可匹配词量大幅增加，避免 RSS 标题共享词过少(几乎只剩"科技"等通用词)导致
// 关键词信号被 IDF 压成≈0、精排退化为"同分类最新"。
// 同来源最多 2 条，避免相关阅读被同一家媒体刷屏。

type Entry = { a: Article; toks: string[] };
const corpusCache = new Map<string, { idf: Record<string, number>; entries: Entry[] }>();

function textOf(a: Article) {
  return `${a.title || ""} ${a.summary || ""} ${(a.tags || []).join(" ")}`;
}

function getCorpus(locale: string, all: Article[]) {
  const hit = corpusCache.get(locale);
  if (hit) return hit;
  const idf = buildIdf(all.map(textOf)).idf;
  const entries: Entry[] = all.map((a) => ({ a, toks: tokenize(textOf(a)) }));
  const obj = { idf, entries };
  corpusCache.set(locale, obj);
  return obj;
}

export function rankRelated(article: Article, pool: Article[], n = 6): Article[] {
  if (!article || pool.length === 0) return [];
  const { idf, entries } = getCorpus(article.locale, pool);
  const aToks = new Set(tokenize(textOf(article)));
  const aTags = new Set(article.tags || []);
  const aSrc = article.source || "";

  const scored = entries
    .filter((e) => e.a.id !== article.id && (article.media === "video" || e.a.media !== "video"))
    .map((e) => {
      let knum = 0;
      let kden = 0;
      for (const k of e.toks) {
        const w = idf[k] || 1;
        kden += w;
        if (aToks.has(k)) knum += w;
      }
      const kwSim = kden > 0 ? knum / kden : 0;
      const tags = e.a.tags || [];
      const tagSim = tags.length ? tags.filter((t) => aTags.has(t)).length / Math.max(1, tags.length) : 0;
      const srcSim = aSrc && e.a.source === aSrc ? 1 : 0;
      const catSim = e.a.category === article.category ? 1 : 0.35;
      const ageH = Math.abs(e.a.publishedAt - article.publishedAt) / 3_600_000;
      const near = 1 / (1 + ageH / 72);
      return { a: e.a, score: kwSim * 6 + tagSim * 2 + srcSim * 0.6 + catSim * 0.8 + near * 0.3 };
    })
    .sort((x, y) => y.score - x.score);

  // cov62：内容去重。同一张封面在推荐位并排出现，或在同一侧栏里出现同题稿（同源同事件分两批发），
  // 视觉上就是"图片重复"，必须挡掉。
  const titleToks = (a: Article) => new Set(tokenize(a.title || ""));
  const coverOf = (a: Article) => a.cover || (a.images && a.images[0]) || "";
  const nearDupTitle = (x: Set<string>, y: Set<string>) => {
    if (!x.size || !y.size) return false;
    let inter = 0;
    for (const t of x) if (y.has(t)) inter++;
    return inter / Math.min(x.size, y.size) >= 0.6;
  };
  const selfTitle = titleToks(article);
  const selfCover = coverOf(article);

  const picked: Article[] = [];
  const pickedTitles: Set<string>[] = [];
  const pickedCovers = new Set<string>(selfCover ? [selfCover] : []);

  const accept = (a: Article) => {
    const cv = coverOf(a);
    if (cv && pickedCovers.has(cv)) return false;
    const tt = titleToks(a);
    if (nearDupTitle(tt, selfTitle)) return false;
    for (const p of pickedTitles) if (nearDupTitle(tt, p)) return false;
    if (cv) pickedCovers.add(cv);
    pickedTitles.push(tt);
    picked.push(a);
    return true;
  };

  // 同来源最多 2 条（多样性），不足再用后续高分补齐
  const bySrc = new Map<string, number>();
  for (const s of scored) {
    if (!accept(s.a)) continue;
    const k = s.a.source || "";
    const c = bySrc.get(k) || 0;
    if (k && c >= 2) {
      // 回滚刚接受的这条，交给后面的候选
      picked.pop();
      pickedTitles.pop();
      const cv = coverOf(s.a);
      if (cv) pickedCovers.delete(cv);
      continue;
    }
    bySrc.set(k, c + 1);
    if (picked.length >= n) break;
  }
  return picked.slice(0, n);
}
