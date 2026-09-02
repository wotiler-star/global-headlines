// 用裸 node 预建数据库（已验证裸 node 创建/写入 sqlite 正常）。
// 服务端 next start 在沙箱里创建 DB 会被置为只读，故改为构建期预生成。
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "global-headlines.sqlite");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = DELETE;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    banned INTEGER NOT NULL DEFAULT 0
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
    PRIMARY KEY(user_id, article_id)
  );
  CREATE TABLE IF NOT EXISTS follows (
    user_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, source)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    user_id INTEGER,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
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
    source_url TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0
  );
`);

function hash(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function createUser(username, email, pw) {
  try {
    const r = db.prepare("INSERT INTO users (username, email, password_hash, created_at, role) VALUES (?, ?, ?, ?, ?)")
      .run(username, email, hash(pw), Date.now(), username === "admin" ? "admin" : "user");
    return Number(r.lastInsertRowid);
  } catch {
    return null;
  }
}

const u = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (u === 0) createUser("demo", "demo@example.com", "demo1234");
const adminCnt = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get().c;
if (adminCnt === 0) {
  const aid = createUser("admin", "admin@example.com", "admin1234");
  if (aid) db.prepare("UPDATE users SET role='admin' WHERE id=?").run(aid);
}
console.log("seeded. users:", db.prepare("SELECT COUNT(*) c FROM users").get().c,
  "admins:", db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c);
db.close();
