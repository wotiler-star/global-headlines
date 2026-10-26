import { NextRequest, NextResponse } from "next/server";
import { getDb, getInterestProfile, getHotStats, getIdf } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { tokenize, tokMode } from "@/lib/keywords";

export const dynamic = "force-dynamic";

// 复刻今日头条推荐算法（服务端按账号打分）：
//   score = 分类*3 + 标题关键词(IDF加权)*2.5 + 同标签*2 + 同来源*2 + 时效*2 + 热度*0.5 + 已读降权 + 探索抖动
//   - 兴趣：user_events 聚合的分类权重（阅读1/收藏3/评论2），30 天半衰衰减
//   - 时效：1/(1+年龄h/48)
//   - 热度：log(1+阅读) + 评论*1.5
//   - 多样性：插入一个非前列主导分类的"探索"项，缓解信息茧房
// 匿名/冷启动：热度+时效兜底。
// POST /api/recommend { locale, candidates:[{id,cat,ts}], limit }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const locale = String(body?.locale || "zh").slice(0, 8);
  const cands: { id: string; cat: string; ts: number; tags?: string[]; src?: string; title?: string }[] = Array.isArray(body?.candidates)
    ? body.candidates.filter((c: any) => c && typeof c.id === "string" && typeof c.cat === "string")
    : [];
  const limit = Math.max(1, Math.min(20, Number(body?.limit) || 6));
  if (cands.length === 0) return NextResponse.json({ personalized: false, items: [] });

  const db = getDb();
  const now = Date.now();
  const hot = getHotStats(db, locale, 300);
  const hotMap = new Map(hot.map((h) => [h.id, h]));
  const user = await getCurrentUser();

  const freshPop = (id: string, ts: number) => {
    const h = hotMap.get(id);
    const ageH = Math.max(0, (now - ts) / 3.6e6);
    const fresh = 1 / (1 + ageH / 48);
    const pop = Math.log1p(h?.views || 0) + (h?.comments || 0) * 1.5;
    return { fresh, pop };
  };

  // 匿名：热度 + 时效 + 抖动兜底
  if (!user) {
    const items = cands
      .map((c) => {
        const { fresh, pop } = freshPop(c.id, c.ts);
        return { id: c.id, cat: c.cat, score: fresh * 2 + pop * 0.5 + Math.random() * 0.3 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return NextResponse.json({ personalized: false, items });
  }

  const profile = getInterestProfile(db, user.id);
  const interests = profile.cats;
  const tagW = profile.tags;
  const srcW = profile.sources;
  const kwW = profile.keywords;
  const readIds = new Set(profile.readIds);
  const maxW = Math.max(1, ...Object.values(interests));
  const maxTag = Math.max(1, ...Object.values(tagW));
  const maxSrc = Math.max(1, ...Object.values(srcW));
  const maxKw = Math.max(1, ...Object.values(kwW));
  const idfObj = getIdf(db); // 语料 IDF：稀有词权重更高
  const idf = idfObj.idf;
  const idfDefault = idfObj.maxIdf; // 语料中未出现的词视为极稀有

  // 相似文章精排：在分类兴趣之上，按 同标签 / 同来源 亲和再叠加（头条"相关推荐"思路）。
  const scored = cands
    .map((c) => {
      const { fresh, pop } = freshPop(c.id, c.ts);
      const catI = (interests[c.cat] || 0) / maxW;
      const ctags = Array.isArray(c.tags) ? c.tags : [];
      const tagSim = ctags.length ? ctags.reduce((sum, t) => sum + (tagW[t] || 0), 0) / (maxTag * ctags.length) : 0;
      const srcSim = (srcW[c.src || ""] || 0) / maxSrc;
      const ckws = c.title ? tokenize(c.title) : [];
      // IDF 加权：用户命中"稀有关键词"贡献更大，命中"科技/公司"等通用词被稀释抑制
      let knum = 0;
      let kden = 0;
      for (const k of ckws) {
        const w = idf[k] || idfDefault;
        knum += (kwW[k] || 0) * w;
        kden += w;
      }
      const kwSim = kden > 0 ? knum / (maxKw * kden) : 0;
      const seen = readIds.has(c.id) ? -1.5 : 0;
      return { id: c.id, cat: c.cat, score: catI * 3 + kwSim * 2.5 + tagSim * 2 + srcSim * 2 + fresh * 2 + pop * 0.5 + seen + Math.random() * 0.4 };
    })
    .sort((a, b) => b.score - a.score);

  let items = scored.slice(0, limit);
  // 多样性/探索：插入一个非前列主导分类的项
  if (items.length >= 3) {
    const topCats = new Set(items.slice(0, Math.ceil(limit / 2)).map((i) => i.cat));
    const explore = scored.find((i) => !topCats.has(i.cat) && !items.some((x) => x.id === i.id));
    if (explore) items = [...items.slice(0, limit - 1), explore];
  }
  return NextResponse.json({ personalized: Object.keys(interests).length > 0, interests, items, idfDocs: idfObj.docs, idfTokens: Object.keys(idf).length, tokMode: tokMode() });
}
