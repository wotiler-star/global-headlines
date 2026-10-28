import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomBytes, scrypt, scryptSync } from "node:crypto";
import { tokenize, buildIdf } from "./keywords";
import { Locale, Category, locales } from "@/i18n/config";
import { getArticles as mockGetArticles } from "@/data/news";

// ---------------------------------------------------------------------------
// SQLite 连接（Node 22 内置 node:sqlite，零依赖、免编译）
// 单例：同一进程复用连接；首次访问建表并种子数据。
// ---------------------------------------------------------------------------

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "global-headlines.sqlite");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const db = new DatabaseSync(DB_PATH);
  // DELETE 模式（非 WAL）：沙箱里 next start 进程无法创建 -wal/-shm 共享内存文件，
  // 会导致 "attempt to write a readonly database"。DELETE 仅事务期间生成临时 -journal，
  // 无需共享内存，单连接（本应用为单例）下无并发损失。
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initSchema(db);
  // 幂等迁移：老库补 parent_id 列（老库没有 parent_id）
  try { db.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER"); } catch { /* 列已存在 */ }
  seedIfEmpty(db);
  _db = db;
  return _db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL,
      article_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, article_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS follows (
      user_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, source),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      user_id INTEGER,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      parent_id INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL,
      comment_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, comment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cl_comment ON comment_likes(comment_id);

    CREATE TABLE IF NOT EXISTS user_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      article_id TEXT,
      category TEXT,
      weight INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ue_user ON user_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      source TEXT,
      author TEXT,
      published_at INTEGER NOT NULL,
      image_count INTEGER NOT NULL,
      images TEXT NOT NULL,
      tags TEXT,
      read_minutes INTEGER,
      media TEXT,
      video_platform TEXT,
      video_id TEXT,
      source_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_articles_locale ON articles(locale);
    CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(locale, category);
    CREATE TABLE IF NOT EXISTS point_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_point_ledger_user ON point_ledger(user_id);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      body TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, read);
    CREATE TABLE IF NOT EXISTS ad_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      article_id TEXT,
      kind TEXT NOT NULL,
      revenue INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ad_events_user ON ad_events(user_id);
    CREATE TABLE IF NOT EXISTS article_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      locale TEXT,
      category TEXT,
      viewer_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_article_views_uniq ON article_views(article_id, viewer_key);
    CREATE INDEX IF NOT EXISTS idx_article_views_id ON article_views(article_id);
  `);
  migrate(db);
}

// 已有数据库（开发期已生成）补充新列，避免重建库丢失数据
function migrate(db: DatabaseSync) {
  const alters = [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN balance INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN avatar TEXT",
    "ALTER TABLE users ADD COLUMN bio TEXT",
    "ALTER TABLE articles ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE articles ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE articles ADD COLUMN owner_id INTEGER",
    "ALTER TABLE articles ADD COLUMN status TEXT NOT NULL DEFAULT 'published'",
    "ALTER TABLE articles ADD COLUMN cover TEXT",
    "ALTER TABLE articles ADD COLUMN review_note TEXT",
    // cov43：会员投稿正文 —— 过去正文只能塞进 summary，真正的稿件需要独立的正文列
    "ALTER TABLE articles ADD COLUMN body TEXT",
    "ALTER TABLE articles ADD COLUMN submitted_at INTEGER",
    "ALTER TABLE articles ADD COLUMN updated_at INTEGER",
    "ALTER TABLE articles ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN last_login_at INTEGER",
  ];
  for (const sql of alters) {
    try {
      db.exec(sql);
    } catch {
      /* 列已存在则忽略 */
    }
  }
}

// 首次启动种子：演示账号 + 文章（来自现有 mock 生成器，保证有内容可管）
function seedIfEmpty(db: DatabaseSync) {
  const u = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (u.c === 0) {
    const id = createUser(db, "demo", "demo@example.com", "demo1234");
    if (id) {
      // 默认关注几个来源，体验更顺
      const demo = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as { username: string };
      void demo;
    }
  }
  // 确保始终存在至少一个管理员账号（兼容旧库用户表非空的情况）
  const adminCnt = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as { c: number };
  if (adminCnt.c === 0) {
    const aid = createUser(db, "admin", "admin@example.com", "admin1234");
    if (aid) db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(aid);
  }
  const a = db.prepare("SELECT COUNT(*) AS c FROM articles").get() as { c: number };
  if (a.c === 0) {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO articles
       (id, locale, category, title, summary, source, author, published_at, image_count, images, tags, read_minutes, media, video_platform, video_id, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const locale of locales) {
      const list = mockGetArticles(locale as Locale);
      for (const art of list) {
        insert.run(
          art.id,
          art.locale,
          art.category,
          art.title,
          art.summary,
          art.source,
          art.author,
          art.publishedAt,
          art.imageCount,
          JSON.stringify(art.images),
          JSON.stringify(art.tags),
          art.readMinutes,
          art.media ?? null,
          art.videoPlatform ?? null,
          art.videoId ?? null,
          art.sourceUrl ?? null
        );
      }
    }
  }
}

// ------------------------------- 密码哈希 -------------------------------
export function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(pw, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

export function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(pw, salt, 64, (err, derived) => {
      if (err) resolve(false);
      else resolve(derived.toString("hex") === key);
    });
  });
}

// ------------------------------- 用户 ----------------------------------
export function createUser(
  db: DatabaseSync,
  username: string,
  email: string | null,
  password: string
): number | null {
  const hash = hashPasswordSync(password);
  try {
    const r = db
      .prepare("INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(username, email, hash, Date.now());
    return Number(r.lastInsertRowid);
  } catch {
    return null; // 用户名/邮箱冲突
  }
}

// scrypt 同步包装（用于种子/注册）
function hashPasswordSync(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function updateUserPassword(db: DatabaseSync, id: number, newPassword: string): void {
  const hash = hashPasswordSync(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
}

export function getUserByUsername(db: DatabaseSync, username: string) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | {
        id: number;
        username: string;
        email: string | null;
        password_hash: string;
        role: string;
        banned: number;
        created_at: number;
      }
    | undefined;
}

export function getUserById(db: DatabaseSync, id: number) {
  return db.prepare("SELECT id, username, email, role, banned, created_at FROM users WHERE id = ?").get(id) as
    | { id: number; username: string; email: string | null; role: string; banned: number; created_at: number }
    | undefined;
}

// ------------------------------- 会话 ----------------------------------
export function createSession(db: DatabaseSync, userId: number, ttlMs = 30 * 24 * 3600 * 1000): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now, now + ttlMs);
  return token;
}

export function getUserBySession(db: DatabaseSync, token: string | undefined) {
  if (!token) return undefined;
  const sess = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | { token: string; user_id: number; expires_at: number }
    | undefined;
  if (!sess) return undefined;
  if (sess.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return undefined;
  }
  return getUserById(db, sess.user_id);
}

export function deleteSession(db: DatabaseSync, token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ----------------------------- 收藏 / 关注 ------------------------------
export function getBookmarks(db: DatabaseSync, userId: number): string[] {
  const rows = db.prepare("SELECT article_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC").all(userId) as {
    article_id: string;
  }[];
  return rows.map((r) => r.article_id);
}

export function setBookmark(db: DatabaseSync, userId: number, articleId: string, on: boolean) {
  if (on) {
    db.prepare("INSERT OR IGNORE INTO bookmarks (user_id, article_id, created_at) VALUES (?, ?, ?)").run(
      userId,
      articleId,
      Date.now()
    );
  } else {
    db.prepare("DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?").run(userId, articleId);
  }
}

export function getFollows(db: DatabaseSync, userId: number): string[] {
  const rows = db.prepare("SELECT source FROM follows WHERE user_id = ? ORDER BY created_at DESC").all(userId) as {
    source: string;
  }[];
  return rows.map((r) => r.source);
}

export function setFollow(db: DatabaseSync, userId: number, source: string, on: boolean) {
  if (on) {
    db.prepare("INSERT OR IGNORE INTO follows (user_id, source, created_at) VALUES (?, ?, ?)").run(
      userId,
      source,
      Date.now()
    );
  } else {
    db.prepare("DELETE FROM follows WHERE user_id = ? AND source = ?").run(userId, source);
  }
}

// ------------------------------- 评论 ----------------------------------
export type CommentRow = {
  id: number;
  article_id: string;
  user_id: number | null;
  author_name: string;
  body: string;
  parent_id?: number | null;
  created_at: number;
};

export function addComment(
  db: DatabaseSync,
  articleId: string,
  authorName: string,
  body: string,
  userId: number | null = null,
  parentId: number | null = null
): CommentRow {
  const r = db
    .prepare("INSERT INTO comments (article_id, user_id, author_name, body, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(articleId, userId, authorName, body, parentId, Date.now());
  return db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(r.lastInsertRowid)) as CommentRow;
}

export function getComments(db: DatabaseSync, articleId: string): CommentRow[] {
  return db
    .prepare("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC")
    .all(articleId) as CommentRow[];
}

// 评论点赞 toggle：返回最新状态与该评论总赞数
export function toggleCommentLike(
  db: DatabaseSync,
  userId: number,
  commentId: number
): { liked: boolean; count: number } {
  const existing = db
    .prepare("SELECT 1 AS x FROM comment_likes WHERE user_id = ? AND comment_id = ?")
    .get(userId, commentId) as { x: number } | undefined;
  if (existing) {
    db.prepare("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?").run(userId, commentId);
  } else {
    db.prepare("INSERT OR IGNORE INTO comment_likes (user_id, comment_id, created_at) VALUES (?, ?, ?)").run(
      userId,
      commentId,
      Date.now()
    );
  }
  const c = db.prepare("SELECT COUNT(*) AS c FROM comment_likes WHERE comment_id = ?").get(commentId) as {
    c: number;
  };
  return { liked: !existing, count: c.c };
}

// 某文章下所有评论的点赞总数 Map<commentId, count>
export function commentLikeCounts(db: DatabaseSync, articleId: string): Map<number, number> {
  const rows = db
    .prepare(
      "SELECT cl.comment_id AS id, COUNT(*) AS c FROM comment_likes cl JOIN comments cm ON cm.id = cl.comment_id WHERE cm.article_id = ? GROUP BY cl.comment_id"
    )
    .all(articleId) as { id: number; c: number }[];
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.id, r.c);
  return m;
}

// 当前用户在某文章下赞过的评论 id 集合
export function userLikedCommentIds(db: DatabaseSync, userId: number, articleId: string): Set<number> {
  const rows = db
    .prepare(
      "SELECT cl.comment_id AS id FROM comment_likes cl JOIN comments cm ON cm.id = cl.comment_id WHERE cm.article_id = ? AND cl.user_id = ?"
    )
    .all(articleId, userId) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

// ------------------------------- 文章 API ------------------------------
export type DbArticle = {
  id: string;
  locale: string;
  category: string;
  title: string;
  summary: string | null;
  source: string | null;
  author: string | null;
  published_at: number;
  image_count: number;
  images: string;
  tags: string | null;
  read_minutes: number | null;
  media: string | null;
  video_platform: string | null;
  video_id: string | null;
  source_url: string | null;
  cover?: string | null;
  review_note?: string | null;
  status?: string | null;
  owner_id?: number | null;
  deleted?: number;
  pinned?: number;
  body?: string | null;
  submitted_at?: number | null;
  updated_at?: number | null;
  word_count?: number | null;
};

export function queryArticles(
  db: DatabaseSync,
  opts: {
    locale?: string;
    category?: string;
    q?: string;
    tag?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
    includeDrafts?: boolean;
    ownerId?: number;
    orderBy?: "new" | "comments";
    pinnedOnly?: boolean;
  }
): DbArticle[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeDeleted) {
    where.push("deleted = 0");
  }
  if (!opts.includeDrafts) {
    where.push("status = 'published'");
  }
  if (opts.ownerId) {
    where.push("owner_id = ?");
    params.push(opts.ownerId);
  }
  if (opts.locale) {
    where.push("locale = ?");
    params.push(opts.locale);
  }
  if (opts.category && opts.category !== "recommend") {
    where.push("category = ?");
    params.push(opts.category);
  }
  if (opts.pinnedOnly) {
    where.push("pinned = 1");
  }
  if (opts.q) {
    const qToks = tokenize(String(opts.q).trim().toLowerCase());
    if (qToks.length) {
      const ors: string[] = [];
      for (const t of qToks) {
        ors.push("(title LIKE ? OR summary LIKE ? OR tags LIKE ?)");
        params.push(`%${t}%`, `%${t}%`, `%${t}%`);
      }
      where.push("(" + ors.join(" OR ") + ")");
    } else {
      where.push("(title LIKE ? OR summary LIKE ?)");
      params.push(`%${opts.q}%`, `%${opts.q}%`);
    }
  }
  if (opts.tag) {
    where.push("tags LIKE ?");
    params.push(`%${opts.tag}%`);
  }
  const limit = Math.min(opts.limit ?? 30, 100);
  const offset = opts.offset ?? 0;
  const orderSql =
    opts.orderBy === "comments"
      ? "comment_count DESC, published_at DESC"
      : "pinned DESC, published_at DESC";
  const sql = `SELECT *, (SELECT COUNT(*) FROM comments WHERE comments.article_id = articles.id) AS comment_count FROM articles ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${orderSql} LIMIT ? OFFSET ?`;
  let rows = db.prepare(sql).all(...params, limit, offset) as DbArticle[];
  if (opts.q && opts.orderBy !== "new") {
    const qToks2 = tokenize(String(opts.q).trim().toLowerCase());
    if (qToks2.length) {
      const idfMap = getIdf(db).idf;
      const idf = (k: string) => idfMap[k] || 1;
      const now = Date.now();
      const tagOf = (r: DbArticle) => {
        try {
          const t = typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : (r.tags || []);
          return (Array.isArray(t) ? t : []).join(" ").toLowerCase();
        } catch {
          return "";
        }
      };
      const scored = rows
        .map((r) => {
          const title = (r.title || "").toLowerCase();
          const sum = (r.summary || "").toLowerCase();
          const tags = tagOf(r);
          let s2 = 0;
          for (const t of qToks2) {
            const w = idf(t);
            if (title.includes(t)) s2 += 3 * w;
            if (tags.includes(t)) s2 += 2 * w;
            if (sum.includes(t)) s2 += 1 * w;
          }
          const ageH = Math.abs((r.published_at || now) - now) / 3.6e6;
          const recency = 1 / (1 + ageH / 168);
          return { r, score: s2 + recency * 0.5 };
        })
        .sort((a, b) => b.score - a.score);
      rows = scored.map((x) => x.r);
    }
  }
  return rows;
}

export function getArticleRow(db: DatabaseSync, id: string): DbArticle | undefined {
  return db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as DbArticle | undefined;
}

// ------------------------------- 管理后台 ------------------------------
export type AdminUserRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  banned: number;
  created_at: number;
  bookmarks: number;
  comments: number;
};

export function listUsersAdmin(db: DatabaseSync): AdminUserRow[] {
  return db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.banned, u.created_at,
              (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = u.id) AS bookmarks,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments
       FROM users u ORDER BY u.created_at DESC`
    )
    .all() as AdminUserRow[];
}

export function setUserRole(db: DatabaseSync, id: number, role: string) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function setUserBanned(db: DatabaseSync, id: number, banned: boolean) {
  db.prepare("UPDATE users SET banned = ? WHERE id = ?").run(banned ? 1 : 0, id);
}

export function deleteUser(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export type AdminCommentRow = {
  id: number;
  article_id: string;
  user_id: number | null;
  author_name: string;
  body: string;
  created_at: number;
  username: string | null;
};

export function listCommentsAdmin(db: DatabaseSync, limit = 100): AdminCommentRow[] {
  return db
    .prepare(
      `SELECT c.id, c.article_id, c.user_id, c.author_name, c.body, c.created_at, u.username
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC LIMIT ?`
    )
    .all(limit) as AdminCommentRow[];
}

export function deleteCommentAdmin(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);
}

export function updateArticlePin(db: DatabaseSync, id: string, pinned: boolean) {
  db.prepare("UPDATE articles SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
}

export function setArticleDeleted(db: DatabaseSync, id: string, deleted: boolean) {
  db.prepare("UPDATE articles SET deleted = ? WHERE id = ?").run(deleted ? 1 : 0, id);
}

export function updateArticle(
  db: DatabaseSync,
  id: string,
  fields: {
    title?: string;
    summary?: string;
    category?: string;
    source?: string;
    cover?: string | null;
    reviewNote?: string | null;
    publishedAt?: number;
    status?: "draft" | "pending" | "published" | "rejected";
  }
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    params.push(fields.title);
  }
  if (fields.summary !== undefined) {
    sets.push("summary = ?");
    params.push(fields.summary);
  }
  if (fields.category !== undefined) {
    sets.push("category = ?");
    params.push(fields.category);
  }
  if (fields.source !== undefined) {
    sets.push("source = ?");
    params.push(fields.source);
  }
  if (fields.cover !== undefined) {
    sets.push("cover = ?");
    params.push(fields.cover);
  }
  if (fields.reviewNote !== undefined) {
    sets.push("review_note = ?");
    params.push(fields.reviewNote);
  }
  if (fields.publishedAt !== undefined) {
    sets.push("published_at = ?");
    params.push(fields.publishedAt);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    params.push(fields.status);
  }
  sets.push("updated_at = ?");
  params.push(Date.now());
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE articles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

export type AdminStats = {
  users: number;
  admins: number;
  articles: number;
  comments: number;
  bookmarks: number;
  follows: number;
  bannedUsers: number;
};

export function getAdminStats(db: DatabaseSync): AdminStats {
  const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    users: one("SELECT COUNT(*) AS c FROM users"),
    admins: one("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'"),
    articles: one("SELECT COUNT(*) AS c FROM articles WHERE deleted = 0"),
    comments: one("SELECT COUNT(*) AS c FROM comments"),
    bookmarks: one("SELECT COUNT(*) AS c FROM bookmarks"),
    follows: one("SELECT COUNT(*) AS c FROM follows"),
    bannedUsers: one("SELECT COUNT(*) AS c FROM users WHERE banned = 1"),
  };
}

// ------------------------------ 用户稿件(UGC) ------------------------------
export type ArticleStatus = "draft" | "pending" | "published" | "rejected";

export type UserArticleInput = {
  locale: string;
  category: string;
  title: string;
  body?: string | null;
  summary?: string | null;
  source?: string | null;
  author?: string | null;
  images?: string[];
  tags?: string[];
  cover?: string | null;
  wordCount?: number;
  status?: ArticleStatus;
};

export function createUserArticle(db: DatabaseSync, ownerId: number, f: UserArticleInput): string {
  const id = "u" + Date.now().toString(36) + randomBytes(4).toString("hex");
  const now = Date.now();
  const st = f.status ?? "published";
  db.prepare(
    `INSERT INTO articles
     (id, locale, category, title, summary, source, author, published_at, image_count, images, tags, read_minutes, media, video_platform, video_id, source_url, owner_id, cover, status, body, submitted_at, updated_at, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    f.locale,
    f.category,
    f.title,
    f.summary ?? null,
    f.source ?? null,
    f.author ?? null,
    now,
    f.images?.length ?? 0,
    JSON.stringify(f.images ?? []),
    f.tags && f.tags.length ? JSON.stringify(f.tags) : null,
    null,
    null,
    null,
    null,
    null,
    ownerId,
    f.cover ?? null,
    st,
    f.body ?? null,
    st === "pending" || st === "published" ? now : null,
    now,
    f.wordCount ?? 0
  );
  return id;
}

export function getArticleOwner(db: DatabaseSync, id: string): number | null {
  const r = db.prepare("SELECT owner_id FROM articles WHERE id = ?").get(id) as
    | { owner_id: number | null }
    | undefined;
  return r ? (r.owner_id ?? null) : null;
}

export function updateUserArticle(
  db: DatabaseSync,
  id: string,
  fields: {
    title?: string;
    summary?: string | null;
    body?: string | null;
    category?: string;
    source?: string | null;
    tags?: string[];
    images?: string[];
    cover?: string | null;
    reviewNote?: string | null;
    wordCount?: number;
    publishedAt?: number;
    status?: ArticleStatus;
  }
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.body !== undefined) {
    sets.push("body = ?");
    params.push(fields.body);
  }
  if (fields.wordCount !== undefined) {
    sets.push("word_count = ?");
    params.push(fields.wordCount);
  }
  if (fields.title !== undefined) {
    sets.push("title = ?");
    params.push(fields.title);
  }
  if (fields.summary !== undefined) {
    sets.push("summary = ?");
    params.push(fields.summary);
  }
  if (fields.category !== undefined) {
    sets.push("category = ?");
    params.push(fields.category);
  }
  if (fields.source !== undefined) {
    sets.push("source = ?");
    params.push(fields.source);
  }
  if (fields.tags !== undefined) {
    sets.push("tags = ?");
    params.push(fields.tags.length ? JSON.stringify(fields.tags) : null);
  }
  if (fields.images !== undefined) {
    sets.push("images = ?, image_count = ?");
    params.push(JSON.stringify(fields.images), fields.images.length);
  }
  if (fields.cover !== undefined) {
    sets.push("cover = ?");
    params.push(fields.cover);
  }
  if (fields.reviewNote !== undefined) {
    sets.push("review_note = ?");
    params.push(fields.reviewNote);
  }
  if (fields.publishedAt !== undefined) {
    sets.push("published_at = ?");
    params.push(fields.publishedAt);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    params.push(fields.status);
    // 进入/重进审核队列时刷新提交时间，便于后台按提交先后排序
    if (fields.status === "pending" || fields.status === "published") {
      sets.push("submitted_at = ?");
      params.push(Date.now());
    }
  }
  sets.push("updated_at = ?");
  params.push(Date.now());
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE articles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

// ------------------------------- 积分系统 ----------------------------------
export type PointLedgerRow = {
  id: number;
  user_id: number;
  delta: number;
  reason: string;
  ref: string | null;
  created_at: number;
};

export function getPoints(db: DatabaseSync, userId: number): number {
  const r = db.prepare("SELECT points FROM users WHERE id = ?").get(userId) as
    | { points: number }
    | undefined;
  return r ? r.points : 0;
}

/** 记一笔积分流水并更新余额（不会低于 0），返回最新余额 */
export function addPoints(db: DatabaseSync, userId: number, delta: number, reason: string, ref?: string): number {
  db.prepare("INSERT INTO point_ledger (user_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)").run(
    userId,
    delta,
    reason,
    ref ?? null,
    Date.now()
  );
  db.prepare("UPDATE users SET points = MAX(0, points + ?) WHERE id = ?").run(delta, userId);
  return getPoints(db, userId);
}

export function getPointLedger(db: DatabaseSync, userId: number, limit = 50): PointLedgerRow[] {
  return db
    .prepare("SELECT * FROM point_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit) as PointLedgerRow[];
}

/** 最近一次签到时间（reason=checkin 的流水） */
export function lastCheckinAt(db: DatabaseSync, userId: number): number | null {
  const r = db.prepare(
    "SELECT created_at FROM point_ledger WHERE user_id = ? AND reason = 'checkin' ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as { created_at: number } | undefined;
  return r ? r.created_at : null;
}

// ------------------------------- 消息系统 ----------------------------------
export type MessageRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string | null;
  read: number;
  created_at: number;
};

export function createMessage(
  db: DatabaseSync,
  userId: number,
  title: string,
  body?: string | null,
  type = "system"
): number {
  const r = db
    .prepare("INSERT INTO messages (user_id, type, title, body, read, created_at) VALUES (?, ?, ?, ?, 0, ?)")
    .run(userId, type, title, body ?? null, Date.now());
  return Number(r.lastInsertRowid);
}

export function listMessages(db: DatabaseSync, userId: number, limit = 50): MessageRow[] {
  return db
    .prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit) as MessageRow[];
}

export function unreadMessageCount(db: DatabaseSync, userId: number): number {
  const r = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND read = 0").get(userId) as {
    c: number;
  };
  return r.c;
}

export function markMessageRead(db: DatabaseSync, userId: number, id: number) {
  db.prepare("UPDATE messages SET read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
}

export function markAllMessagesRead(db: DatabaseSync, userId: number) {
  db.prepare("UPDATE messages SET read = 1 WHERE user_id = ? AND read = 0").run(userId);
}

// ------------------------------ 广告收入系统 -------------------------------
export type AdStats = { impressions: number; clicks: number; revenue: number };

export function recordAdEvent(
  db: DatabaseSync,
  userId: number | null,
  articleId: string | null,
  kind: string,
  revenue: number
) {
  db.prepare("INSERT INTO ad_events (user_id, article_id, kind, revenue, created_at) VALUES (?, ?, ?, ?, ?)").run(
    userId,
    articleId,
    kind,
    revenue,
    Date.now()
  );
}

export function getAdStats(db: DatabaseSync, userId: number): AdStats {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN kind = 'impression' THEN 1 ELSE 0 END) AS impressions,
         SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks,
         SUM(revenue) AS revenue
       FROM ad_events WHERE user_id = ?`
    )
    .get(userId) as { impressions: number | null; clicks: number | null; revenue: number | null };
  return {
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    revenue: row.revenue ?? 0,
  };
}

/** 广告分成入账（分），返回最新余额 */
export function creditBalance(db: DatabaseSync, userId: number, cents: number): number {
  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(cents, userId);
  const r = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId) as { balance: number } | undefined;
  return r ? r.balance : 0;
}

// ------------------------------ 用户资料 -----------------------------------
export function updateUserProfile(
  db: DatabaseSync,
  id: number,
  fields: { avatar?: string | null; bio?: string | null }
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.avatar !== undefined) {
    sets.push("avatar = ?");
    params.push(fields.avatar);
  }
  if (fields.bio !== undefined) {
    sets.push("bio = ?");
    params.push(fields.bio);
  }
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

// ------------------------------ 用户评论管理 ------------------------------
export type UserCommentRow = {
  id: number;
  article_id: string;
  author_name: string;
  body: string;
  created_at: number;
};

export function getCommentsByUser(db: DatabaseSync, userId: number, limit = 50): UserCommentRow[] {
  return db
    .prepare(
      "SELECT id, article_id, author_name, body, created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userId, limit) as UserCommentRow[];
}

export function deleteCommentById(db: DatabaseSync, id: number) {
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);
}

// 今日某类奖励已发放次数（本地零点起算，用于评论积分防刷）
export function countTodayPointsByReason(db: DatabaseSync, userId: number, reason: string): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const r = db
    .prepare("SELECT COUNT(*) AS c FROM point_ledger WHERE user_id = ? AND reason = ? AND created_at >= ?")
    .get(userId, reason, start.getTime()) as { c: number };
  return r.c;
}

// ------------------------------- 阅读量（埋点） ------------------------------
// 同一访客对同一文章只计一次（唯一索引 article_id + viewer_key 去重）
export function recordView(
  db: DatabaseSync,
  articleId: string,
  viewerKey: string,
  locale: string | null,
  category: string | null
): boolean {
  const r = db
    .prepare(
      "INSERT OR IGNORE INTO article_views (article_id, locale, category, viewer_key, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(articleId, locale, category, viewerKey, Date.now());
  return Number(r.changes) > 0;
}

export function getViewCount(db: DatabaseSync, articleId: string): number {
  const r = db
    .prepare("SELECT COUNT(*) AS c FROM article_views WHERE article_id = ?")
    .get(articleId) as { c: number };
  return r.c;
}

export type HotStat = { id: string; views: number; comments: number };

// 真·热度榜素材：按真实阅读量排序，附带该文章的评论数
export function getHotStats(db: DatabaseSync, locale?: string, limit = 20): HotStat[] {
  const params: unknown[] = [];
  const where = locale ? "WHERE locale = ?" : "";
  if (locale) params.push(locale);
  const vrows = db
    .prepare(
      `SELECT article_id, COUNT(*) AS views FROM article_views ${where} GROUP BY article_id ORDER BY views DESC LIMIT ?`
    )
    .all(...params, limit) as { article_id: string; views: number }[];
  const crows = db
    .prepare("SELECT article_id, COUNT(*) AS comments FROM comments GROUP BY article_id")
    .all() as { article_id: string; comments: number }[];
  const cm = new Map<string, number>();
  crows.forEach((c) => cm.set(c.article_id, c.comments));
  return vrows.map((v) => ({
    id: v.article_id,
    views: v.views,
    comments: cm.get(v.article_id) || 0,
  }));
}

// 记录一条用户行为（推荐画像信号）：read/bookmark/comment/publish
export type HotBoardItem = {
  id: string;
  locale: string;
  category: string;
  title: string;
  publishedAt: number;
  views: number;
  recentViews: number;
  comments: number;
  score: number;
};

// 热榜：窗口内阅读(时间窗) + 累计阅读 + 评论 + 发布时效(24h 半衰) + 内容热度。
// 与 getHotStats 的区别：0 阅读的新稿也能进榜（旧接口只统计有阅读的文章），并支持分类筛选与时间窗。
export function getHotBoardStats(
  db: DatabaseSync,
  opts: { locale?: string; category?: string; limit?: number; hours?: number } = {}
): HotBoardItem[] {
  const limit = Math.min(Math.max(1, opts.limit ?? 10), 50);
  const hours = Math.min(Math.max(1, opts.hours ?? 72), 24 * 30);
  const now = Date.now();
  const since = now - hours * 3_600_000;

  const query = (withSince: boolean) => {
    const where: string[] = ["deleted = 0", "status = 'published'"];
    const params: unknown[] = [];
    if (withSince) {
      where.push("published_at >= ?");
      params.push(since);
    }
    if (opts.locale) {
      where.push("locale = ?");
      params.push(opts.locale);
    }
    if (opts.category && opts.category !== "recommend") {
      where.push("category = ?");
      params.push(opts.category);
    }
    return db
      .prepare(
        `SELECT id, locale, category, title, published_at, read_minutes, media FROM articles WHERE ${where.join(
          " AND "
        )} ORDER BY published_at DESC LIMIT 500`
      )
      .all(...params) as {
      id: string;
      locale: string;
      category: string;
      title: string;
      published_at: number;
      read_minutes: number | null;
      media: string | null;
    }[];
  };

  let rows = query(true);
  if (rows.length < limit) rows = query(false); // 窗口内不足则放宽到近期 500 篇
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const vmap = new Map<string, { total: number; recent: number }>();
  const cmap = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const ph = chunk.map(() => "?").join(",");
    const vs = db
      .prepare(
        `SELECT article_id, COUNT(*) AS total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent FROM article_views WHERE article_id IN (${ph}) GROUP BY article_id`
      )
      .all(since, ...chunk) as { article_id: string; total: number; recent: number | null }[];
    vs.forEach((v) => vmap.set(v.article_id, { total: v.total, recent: Number(v.recent || 0) }));
    const cs = db
      .prepare(`SELECT article_id, COUNT(*) AS c FROM comments WHERE article_id IN (${ph}) GROUP BY article_id`)
      .all(...chunk) as { article_id: string; c: number }[];
    cs.forEach((c) => cmap.set(c.article_id, c.c));
  }

  const out = rows.map((r) => {
    const v = vmap.get(r.id) || { total: 0, recent: 0 };
    const comments = cmap.get(r.id) || 0;
    const ageHrs = Math.max(0, (now - r.published_at) / 3_600_000);
    const recency = 1 / (1 + ageHrs / 24);
    const popularity = (r.read_minutes || 0) * 0.5 + (r.media === "video" ? 3 : 0);
    const score = v.recent * 3 + v.total * 0.5 + comments * 6 + recency * 10 + popularity;
    return {
      id: r.id,
      locale: r.locale,
      category: r.category,
      title: r.title,
      publishedAt: r.published_at,
      views: v.total,
      recentViews: v.recent,
      comments,
      score,
    };
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function recordUserEvent(
  db: DatabaseSync,
  userId: number,
  kind: string,
  category: string | null,
  weight: number,
  articleId?: string | null
): void {
  db.prepare(
    "INSERT INTO user_events (user_id, kind, article_id, category, weight, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, kind, articleId ?? null, category, weight, Date.now());
}

// 推荐画像：按账号聚合行为。分类权重随时间指数衰减；并聚合 标签/来源 亲和（相似文章精排）。
// 返回：分类兴趣 + 已读文章 + 标签兴趣 + 来源兴趣。
// 语料 IDF：取最近 3000 篇已发布文章标题计算词频，进程内缓存 30 分钟（避免每次请求重算）。
let idfCache: { at: number; idf: Record<string, number>; maxIdf: number; docs: number } | null = null;
const IDF_TTL = 30 * 60 * 1000;
export function getIdf(db: DatabaseSync): { idf: Record<string, number>; maxIdf: number; docs: number } {
  if (idfCache && Date.now() - idfCache.at < IDF_TTL) {
    return { idf: idfCache.idf, maxIdf: idfCache.maxIdf, docs: idfCache.docs };
  }
  try {
    const rows = db
      .prepare("SELECT title FROM articles WHERE deleted = 0 AND status = 'published' ORDER BY published_at DESC LIMIT 3000")
      .all() as { title: string | null }[];
    const built = buildIdf(rows.map((r) => r.title || ""));
    idfCache = { at: Date.now(), idf: built.idf, maxIdf: built.maxIdf, docs: rows.length };
    return { idf: built.idf, maxIdf: built.maxIdf, docs: rows.length };
  } catch {
    return { idf: {}, maxIdf: 1, docs: 0 };
  }
}

export function getInterestProfile(
  db: DatabaseSync,
  userId: number,
  halfLifeDays = 30
): { cats: Record<string, number>; readIds: string[]; tags: Record<string, number>; sources: Record<string, number>; keywords: Record<string, number> } {
  const rows = db
    .prepare("SELECT kind, article_id, category, weight, created_at FROM user_events WHERE user_id = ?")
    .all(userId) as { kind: string; article_id: string | null; category: string | null; weight: number; created_at: number }[];
  const now = Date.now();
  const hl = Math.max(1, halfLifeDays) * 86400000;

  // 预取事件文章的 source/tags（用于"同来源/同标签"相似精排），按 200 分批
  const artIds = Array.from(new Set(rows.filter((r) => r.article_id).map((r) => r.article_id as string)));
  const meta = new Map<string, { source: string | null; tags: string[]; title: string }>();
  for (let i = 0; i < artIds.length; i += 200) {
    const chunk = artIds.slice(i, i + 200);
    const rs = db
      .prepare(`SELECT id, source, tags, title FROM articles WHERE id IN (${chunk.map(() => "?").join(",")})`)
      .all(...chunk) as { id: string; source: string | null; tags: string | null; title: string | null }[];
    for (const r of rs) {
      let tags: string[] = [];
      try { tags = r.tags ? (JSON.parse(r.tags) as string[]) : []; } catch { tags = []; }
      meta.set(r.id, { source: r.source, tags: Array.isArray(tags) ? tags : [], title: r.title || "" });
    }
  }

  const cats: Record<string, number> = {};
  const tagW: Record<string, number> = {};
  const srcW: Record<string, number> = {};
  const kwW: Record<string, number> = {};
  const readIds: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const decay = Math.exp(-(now - r.created_at) / hl);
    if (r.category) cats[r.category] = (cats[r.category] || 0) + r.weight * decay;
    if (r.kind === "read" && r.article_id && !seen.has(r.article_id)) {
      seen.add(r.article_id);
      readIds.push(r.article_id);
    }
    const m = r.article_id ? meta.get(r.article_id) : null;
    if (m) {
      if (m.source) srcW[m.source] = (srcW[m.source] || 0) + r.weight * decay;
      for (const t of m.tags) tagW[t] = (tagW[t] || 0) + r.weight * decay;
      if (m.title) { for (const k of tokenize(m.title)) kwW[k] = (kwW[k] || 0) + r.weight * decay; }
    }
  }

  // 关注来源 -> 分类 + 来源亲和：显式持续偏好，权重 4（强于单次阅读），不随时间衰减。
  const FOLLOW_W = 4;
  const followed = db.prepare("SELECT source FROM follows WHERE user_id = ?").all(userId) as { source: string }[];
  for (const f of followed) {
    const top = db
      .prepare("SELECT category, COUNT(*) AS n FROM articles WHERE source = ? GROUP BY category ORDER BY n DESC, category ASC LIMIT 1")
      .get(f.source) as { category: string; n: number } | undefined;
    if (top && top.category) cats[top.category] = (cats[top.category] || 0) + FOLLOW_W;
    srcW[f.source] = (srcW[f.source] || 0) + FOLLOW_W;
  }
  return { cats, readIds, tags: tagW, sources: srcW, keywords: kwW };
}

// 批量取多篇文章的阅读量（一次 GROUP BY，供信息流卡片/我的稿件列表使用）
export function getViewCounts(db: DatabaseSync, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!ids || ids.length === 0) return out;
  const uniq = Array.from(new Set(ids.filter(Boolean))).slice(0, 200);
  if (uniq.length === 0) return out;
  const ph = uniq.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT article_id, COUNT(*) AS c FROM article_views WHERE article_id IN (${ph}) GROUP BY article_id`)
    .all(...uniq) as { article_id: string; c: number }[];
  rows.forEach((r) => {
    out[r.article_id] = r.c;
  });
  return out;
}

export type { Locale, Category };
