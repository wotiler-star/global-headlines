import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomBytes, scrypt, scryptSync } from "node:crypto";
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
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
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
  `);
  migrate(db);
}

// 已有数据库（开发期已生成）补充新列，避免重建库丢失数据
function migrate(db: DatabaseSync) {
  const alters = [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE articles ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE articles ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
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
  created_at: number;
};

export function addComment(
  db: DatabaseSync,
  articleId: string,
  authorName: string,
  body: string,
  userId: number | null = null
): CommentRow {
  const r = db
    .prepare("INSERT INTO comments (article_id, user_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(articleId, userId, authorName, body, Date.now());
  return db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(r.lastInsertRowid)) as CommentRow;
}

export function getComments(db: DatabaseSync, articleId: string): CommentRow[] {
  return db
    .prepare("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC")
    .all(articleId) as CommentRow[];
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
  }
): DbArticle[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeDeleted) {
    where.push("deleted = 0");
  }
  if (opts.locale) {
    where.push("locale = ?");
    params.push(opts.locale);
  }
  if (opts.category && opts.category !== "recommend") {
    where.push("category = ?");
    params.push(opts.category);
  }
  if (opts.q) {
    where.push("(title LIKE ? OR summary LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.tag) {
    where.push("tags LIKE ?");
    params.push(`%${opts.tag}%`);
  }
  const limit = Math.min(opts.limit ?? 30, 100);
  const offset = opts.offset ?? 0;
  const sql = `SELECT * FROM articles ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY pinned DESC, published_at DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, limit, offset) as DbArticle[];
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
  fields: { title?: string; summary?: string; category?: string; source?: string }
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

export type { Locale, Category };
