/**
 * 稿件审核状态机 —— 注册/投稿/审核全链路的唯一裁决入口。
 *
 * 背景：之前补丁 PATCH /api/articles/[id] 时没有做状态降级，普通会员可以把自己的稿件
 * 直接写成 published 从而绕过审核。这里把「谁能把稿件推进到什么状态」收敛到一个纯函数，
 * 由 POST（新建）与 PATCH（编辑）共同调用，保证两条路径行为一致。
 */
import type { ArticleStatus } from "./db";

/** 提交审核所需的正文字数下限（防止一个标题就占一个名额） */
export const MIN_BODY_CHARS = 80;
/** 正文上限，约合 2 万字符（UTF-16 code unit） */
export const MAX_BODY_CHARS = 20000;
/** 摘要上限 */
export const MAX_SUMMARY_CHARS = 300;
/** 积分奖励常量：通过审核并上线 */
export const POINTS_PUBLISH = 20;
/** 积分奖励常量：新用户注册礼包 */
export const POINTS_WELCOME = 10;

export const ARTICLE_STATUSES: ArticleStatus[] = ["draft", "pending", "published", "rejected"];

export function parseStatus(v: unknown, fallback: ArticleStatus = "draft"): ArticleStatus {
  return ARTICLE_STATUSES.includes(v as ArticleStatus) ? (v as ArticleStatus) : fallback;
}

/**
 * 正文清洗：统一换行符、去掉控制字符、压缩连续空行、截断到上限。
 * 不做 HTML 转义——渲染端不使用 dangerouslySetInnerHTML，只按行安全渲染行内标记。
 */
export function sanitizeBody(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

/** CJK 友好的字数统计：中日韩逐字计入，拉丁语系按词计入 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
  const latin = text
    .replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g)?.length ?? 0;
  return cjk + latin;
}

/** 由正文推导出摘要缺省值（取首个非空段落） */
export function deriveSummary(body: string): string {
  const first = body.split(/\n+/).map((s) => s.trim()).filter(Boolean)[0] || "";
  return first.slice(0, MAX_SUMMARY_CHARS);
}

export type RoleLike = { role?: string | null };

/**
 * 计算稿件落库后的最终状态。
 *
 * 规则：
 * - 管理员（且未被封禁）可自由设置任意状态，缺省 published；
 * - 普通会员「发布」一律落到待审核（pending），不能直接 published/rejected；
 * - 普通会员编辑已上线稿件：内容更新后回到 pending 重新审核（否则可用旧稿过审、事后塞违规内容）；
 * - 已驳回稿件再次提交审核 → pending。
 */
export function resolveTargetStatus(
  actor: RoleLike | null,
  current: ArticleStatus | null,
  desiredInput: unknown
): ArticleStatus {
  const isAdmin = !!actor && actor.role === "admin";
  const desired = parseStatus(desiredInput, isAdmin ? "published" : "draft");
  if (isAdmin) return desired;
  if (desired === "draft") return "draft";
  // 会员：除草稿外的任何诉求都进审核队列（含对已发布稿件的再编辑）
  return "pending";
}

/** 该次保存是否让稿件（重新）进入审核队列 */
export function enteredReview(prev: ArticleStatus | null, next: ArticleStatus): boolean {
  return next === "pending" && prev !== "pending";
}

/** 展示用状态：未 reflects deleted */
export function statusLabelKey(s: ArticleStatus): "memberDraft" | "reviewPending" | "memberPublished" | "reviewRejected" {
  if (s === "draft") return "memberDraft";
  if (s === "pending") return "reviewPending";
  if (s === "published") return "memberPublished";
  return "reviewRejected";
}
