/**
 * 会员投稿正文的行内标记渲染（极简 Markdown 子集）。
 *
 * 刻意不使用 dangerouslySetInnerHTML：投稿内容来自任意注册用户，
 * 走结构化 React 节点可以从根上杜绝存储型 XSS，同时保留最常用的排版能力。
 * 支持：**加粗** *斜体* `代码` [文字](链接)
 */
import { Fragment, type ReactNode } from "react";
import Link from "next/link";

type Tok =
  | { k: "text"; v: string }
  | { k: "bold"; v: string }
  | { k: "italic"; v: string }
  | { k: "code"; v: string }
  | { k: "link"; v: string; href: string };

const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

/** 只放行 http(s) 与站内相对链接，堵掉 javascript: / data: 之类的伪协议 */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|\/)/i.test(h)) return h;
  return null;
}

/**
 * 正文内 contextual 实体链接（SEO：把关键词首遇处包成内链，强化主题聚类）。
 * - entities: 实体短语 → 站内链接（如标签名 → 标签聚合页）
 * - used: 跨整篇共享的去重集合，保证同一实体只链一次
 * - 边界判定：匹配处前后若紧贴 CJK/拉丁「成词字符」则视为更大词的子串，跳过，
 *   避免「中国」误链进「中国人」、「AI」误链进「email」等噪声。
 * - 每篇上限 MAX_ENTITY_LINKS 条，避免关键词堆砌。
 */
const MAX_ENTITY_LINKS = 3;

// 中文（CJK）短语命中：长度过短（<3 字）的多为更大词的子串（如「中国」⊂「中国人」），
// 跳过以降噪；3 字及以上视为稳定实体短语，直接链接首个出现处（中文无词边界，不强制非 CJK 邻接）。
// 拉丁（ASCII）短语命中：必须词边界（前后非 [A-Za-z0-9]），避免「AI」⊂「email」之类误链。
function hasCJKChar(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) return true;
  }
  return false;
}
function isLatinWord(ch: string): boolean {
  return ch !== "" && /[A-Za-z0-9]/.test(ch);
}
function isCleanMatch(text: string, idx: number, len: number): boolean {
  const phrase = text.slice(idx, idx + len);
  if (hasCJKChar(phrase)) return len >= 3;
  const before = idx > 0 ? text[idx - 1] : "";
  const after = idx + len < text.length ? text[idx + len] : "";
  return !isLatinWord(before) && !isLatinWord(after);
}

function linkify(
  text: string,
  entities: Map<string, string>,
  used: Set<string>,
  cap: number,
): ReactNode[] {
  if (!entities || entities.size === 0 || used.size >= cap) return [text];
  let best: { idx: number; len: number; href: string; phrase: string } | null = null;
  for (const [phrase, href] of entities) {
    if (used.has(phrase)) continue;
    if (hasCJKChar(phrase) ? phrase.length < 3 : phrase.length < 2) continue;
    let from = 0;
    // 在 text 内找该短语的第一个「干净」出现
    while (true) {
      const idx = text.indexOf(phrase, from);
      if (idx < 0) break;
      if (isCleanMatch(text, idx, phrase.length)) {
        if (!best || idx < best.idx) best = { idx, len: phrase.length, href, phrase };
        break;
      }
      from = idx + 1;
    }
  }
  if (!best) return [text];
  used.add(best.phrase);
  const before = text.slice(0, best.idx);
  const match = text.slice(best.idx, best.idx + best.len);
  const after = text.slice(best.idx + best.len);
  const out: ReactNode[] = [];
  if (before) out.push(...linkify(before, entities, used, cap));
  out.push(
    <Link key={`ent-${used.size}-${best.phrase}`} href={best.href} className="art-entity-link">
      {match}
    </Link>,
  );
  if (after) out.push(...linkify(after, entities, used, cap));
  return out;
}

export function tokenizeInline(line: string): Tok[] {
  if (!line) return [];
  const toks: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(line))) {
    if (m.index > last) toks.push({ k: "text", v: line.slice(last, m.index) });
    const rawTok = m[0];
    if (rawTok.startsWith("**")) toks.push({ k: "bold", v: rawTok.slice(2, -2) });
    else if (rawTok.startsWith("`")) toks.push({ k: "code", v: rawTok.slice(1, -1) });
    else if (rawTok.startsWith("[")) {
      const cut = rawTok.indexOf("](");
      const label = rawTok.slice(1, cut);
      const href = rawTok.slice(cut + 2, -1);
      const safe = safeHref(href);
      if (safe) toks.push({ k: "link", v: label, href: safe });
      else toks.push({ k: "text", v: label });
    } else toks.push({ k: "italic", v: rawTok.slice(1, -1) });
    last = m.index + rawTok.length;
  }
  if (last < line.length) toks.push({ k: "text", v: line.slice(last) });
  return toks;
}

/** 整段渲染：识别 # / ## / ### 标题行与 > 引用行，其余按普通段落处理 */
export function RichBlock({
  line,
  entities,
  used,
}: {
  line: string;
  entities?: Map<string, string>;
  used?: Set<string>;
}) {
  const head = /^(#{1,3})\s+(.+)$/.exec(line.trim());
  if (head) {
    const Tag = (["h2", "h3", "h4"] as const)[head[1].length - 1];
    return <Tag className="art-h">{head[2].trim()}</Tag>;
  }
  const quote = /^>\s?(.+)$/.exec(line.trim());
  if (quote) {
    return (
      <blockquote className="art-bq">
        <RichLine line={quote[1]} entities={entities} used={used} />
      </blockquote>
    );
  }
  const bullet = /^[-*]\s+(.+)$/.exec(line.trim());
  if (bullet) {
    return (
      <div className="art-li">
        <span className="art-li-dot" aria-hidden />
        <RichLine line={bullet[1]} entities={entities} used={used} />
      </div>
    );
  }
  return (
    <p>
      <RichLine line={line} entities={entities} used={used} />
    </p>
  );
}

export default function RichLine({
  line,
  entities,
  used,
}: {
  line: string;
  entities?: Map<string, string>;
  used?: Set<string>;
}) {
  const toks = tokenizeInline(line);
  const localUsed = used ?? new Set<string>();
  return (
    <>
      {toks.map((t, i) => {
        switch (t.k) {
          case "bold":
            return <strong key={i}>{t.v}</strong>;
          case "italic":
            return <em key={i}>{t.v}</em>;
          case "code":
            return <code key={i}>{t.v}</code>;
          case "link":
            // 用户投稿里出现的外部链接一律 noreferrer，避免钓鱼/ referer 泄露
            return (
              <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow">
                {t.v}
              </a>
            );
          default:
            return (
              <Fragment key={i}>
                {linkify(t.v, entities ?? new Map(), localUsed, MAX_ENTITY_LINKS)}
              </Fragment>
            );
        }
      })}
    </>
  );
}
