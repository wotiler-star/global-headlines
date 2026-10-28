/**
 * 会员投稿正文的行内标记渲染（极简 Markdown 子集）。
 *
 * 刻意不使用 dangerouslySetInnerHTML：投稿内容来自任意注册用户，
 * 走结构化 React 节点可以从根上杜绝存储型 XSS，同时保留最常用的排版能力。
 * 支持：**加粗** *斜体* `代码` [文字](链接)
 */
import { Fragment, type ReactNode } from "react";

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
export function RichBlock({ line }: { line: string }) {
  const head = /^(#{1,3})\s+(.+)$/.exec(line.trim());
  if (head) {
    const Tag = (["h2", "h3", "h4"] as const)[head[1].length - 1];
    return <Tag className="art-h">{head[2].trim()}</Tag>;
  }
  const quote = /^>\s?(.+)$/.exec(line.trim());
  if (quote) {
    return (
      <blockquote className="art-bq">
        <RichLine line={quote[1]} />
      </blockquote>
    );
  }
  const bullet = /^[-*]\s+(.+)$/.exec(line.trim());
  if (bullet) {
    return (
      <div className="art-li">
        <span className="art-li-dot" aria-hidden />
        <RichLine line={bullet[1]} />
      </div>
    );
  }
  return (
    <p>
      <RichLine line={line} />
    </p>
  );
}

export default function RichLine({ line }: { line: string }) {
  const toks = tokenizeInline(line);
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
            return <Fragment key={i}>{t.v}</Fragment>;
        }
      })}
    </>
  );
}
