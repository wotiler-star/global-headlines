// cov43：「导读 == 全文正文」低质量摘要稿判定（采集器与一次性清理脚本共用）
//
// 页面事实：LEAD 区块渲染 article.summary，正文渲染 article.body（数组）。
// 这类文章正文只有一段、且与导读一字不差，点进去没有任何增量信息。
// 归一化口径与本地 lead_dup_filter.py 保持一致：去标签 / 反转义 / 去空白与标点 / 小写。
const TAG = /<[^>]+>/g;
const PUNCT = /[\s\u3000，。！？、；：,.!?;:（）()\[\]【】"\u201c\u201d\u2018\u2019《》<>「」·—…\-\/|]+/g;
const ENTITY = /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g;
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
};

function unescapeHtml(s) {
  return s.replace(ENTITY, (m, e) => {
    if (e[0] === "#") {
      const hex = e[1] === "x" || e[1] === "X";
      const n = parseInt(hex ? e.slice(2) : e.slice(1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function normalizeText(s) {
  return unescapeHtml(String(s ?? "").replace(TAG, ""))
    .replace(PUNCT, "")
    .toLowerCase();
}

export function bodyText(a) {
  const b = a?.body;
  return Array.isArray(b) ? b.map((x) => String(x ?? "")).join("") : String(b ?? "");
}

/** 严格口径：整篇正文（归一化后）与导读完全相同。 */
export function isLeadDuplicate(a) {
  const sm = normalizeText(a?.summary);
  const full = normalizeText(bodyText(a));
  return !!sm && !!full && sm === full;
}

/** 原创策展稿（rss-orig-*）是编辑资产，即便短也永不清理。 */
export function isEditorial(a) {
  return String(a?.id ?? "").startsWith("rss-orig-");
}

export function shouldPurge(a) {
  return !isEditorial(a) && isLeadDuplicate(a);
}
