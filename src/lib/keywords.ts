// 关键词分词：优先用词典分词(segmentit，纯 JS 无原生依赖，Docker 构建稳定)；
// 词典/库加载异常时自动回退到无依赖的中文 bigram，保证推荐链路永不中断。
// 输出用于标题内容相似度 + 语料 IDF。
import * as SegmentNS from "segmentit";

const STOP = new Set(
  "的了是在有和与对为将年被个让但从及或并等其之此该各每上下一不人看会能要用来去里说你他她它们这那些什么怎么为什么以及并且但是如果虽然因为所以还就都也很可能着于越把向按照根据通过以及其中之前以来高低多少已经过発"
);

let segInst: any = null;
let segTried = false;
// 词典分词器懒加载（词典较大，首次使用时构建一次；失败则永久回退 bigram）
function getSegmenter(): any {
  if (segTried) return segInst;
  segTried = true;
  try {
    // 兼容多种导出形态（default / 命名空间 / esModule 互操作）
    const ns: any = SegmentNS;
    const mod: any = ns && ns.default ? ns.default : ns;
    const Ctor: any = mod && mod.default ? mod.default : mod && mod.Segment ? mod.Segment : mod;
    const useDefault: any = (mod && mod.useDefault) || (ns && ns.useDefault);
    segInst = typeof useDefault === "function" ? useDefault(new Ctor()) : new Ctor();
  } catch (e) {
    segInst = null;
    try { console.warn("[keywords] segmentit 加载失败，回退 bigram:", (e as Error)?.message); } catch {}
  }
  return segInst;
}

// 当前分词模式（便于线上校验词典是否生效）
export function tokMode(): "dict" | "bigram" {
  return getSegmenter() ? "dict" : "bigram";
}

// 提取关键词：拉丁/数字词(长度≥2，小写) + 中文词典词(长度≥2，非停用词)。
export function tokenize(text: string): string[] {
  if (!text) return [];
  const s = text.toLowerCase();
  const out = new Set<string>();
  // 拉丁 / 数字词
  const latin = s.match(/[a-z0-9]+/g) || [];
  for (const w of latin) if (w.length >= 2) out.add(w);
  // 中文段：词典分词优先，失败则 bigram
  const runs = s.match(/[\u4e00-\u9fff]+/g) || [];
  const seg = getSegmenter();
  for (const run of runs) {
    if (run.length < 2) continue;
    let got = false;
    if (seg) {
      try {
        const arr = seg.doSegment(run) as { w: string }[];
        for (const o of arr) {
          const w = String(o?.w || "").trim();
          if (w.length < 2 || STOP.has(w)) continue;
          out.add(w);
          got = true;
        }
      } catch {
        got = false;
      }
    }
    if (got) continue;
    // 兜底：中文二元组（跳过含停用字的）
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i];
      const b = run[i + 1];
      if (STOP.has(a) || STOP.has(b)) continue;
      out.add(a + b);
    }
  }
  return [...out];
}

// 语料 IDF：df 越高（"科技/公司"等高频词）权重越低，稀有词权重更高，抑制通用词噪音。
// idf = ln((N+1)/(df+1)) + 1（平滑），返回 { idf, maxIdf }。
export function buildIdf(titles: string[]): { idf: Record<string, number>; maxIdf: number } {
  const df: Record<string, number> = {};
  let n = 0;
  for (const t of titles) {
    n++;
    for (const k of tokenize(t)) df[k] = (df[k] || 0) + 1;
  }
  const N = Math.max(1, n);
  const idf: Record<string, number> = {};
  let maxIdf = 1;
  for (const k of Object.keys(df)) {
    const v = Math.log((N + 1) / (df[k] + 1)) + 1;
    idf[k] = v;
    if (v > maxIdf) maxIdf = v;
  }
  return { idf, maxIdf };
}
