"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-client";

const BOOKMARK_KEY = "gh_bookmarks";
const FOLLOW_KEY = "gh_follows";

function readList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

/**
 * 收藏（书签）：登录后数据与后端同步（/api/bookmarks），未登录时回退到 localStorage。
 * 挂载后从「服务端(已登录) / localStorage(未登录)」读出初始集合，避免水合错位。
 */
export function useBookmarks() {
  const { user, ready: authReady } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    if (user) {
      fetch("/api/bookmarks")
        .then((r) => r.json())
        .then((d) => {
          if (alive && Array.isArray(d.bookmarks)) setIds(new Set(d.bookmarks));
        })
        .catch(() => {})
        .finally(() => alive && setReady(true));
    } else {
      setIds(new Set(readList(BOOKMARK_KEY)));
      setReady(true);
    }
    return () => {
      alive = false;
    };
  }, [user, authReady]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        const on = !next.has(id);
        if (on) next.add(id);
        else next.delete(id);
        // 本地即时落盘，保证未登录体验一致
        const changed = on
          ? Array.from(new Set([...readList(BOOKMARK_KEY), id]))
          : readList(BOOKMARK_KEY).filter((x) => x !== id);
        writeList(BOOKMARK_KEY, changed);
        return next;
      });
      const on = !ids.has(id);
      if (user) {
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: id, on }),
        }).catch(() => {});
      }
    },
    [ids, user]
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, has, toggle, ready };
}

/**
 * 关注（来源）：与书签同构，存储「来源名」集合，登录后同步到 /api/follows。
 */
export function useFollows() {
  const { user, ready: authReady } = useAuth();
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    if (user) {
      fetch("/api/follows")
        .then((r) => r.json())
        .then((d) => {
          if (alive && Array.isArray(d.follows)) setSources(new Set(d.follows));
        })
        .catch(() => {})
        .finally(() => alive && setReady(true));
    } else {
      setSources(new Set(readList(FOLLOW_KEY)));
      setReady(true);
    }
    return () => {
      alive = false;
    };
  }, [user, authReady]);

  const toggle = useCallback(
    (source: string) => {
      setSources((prev) => {
        const next = new Set(prev);
        const on = !next.has(source);
        if (on) next.add(source);
        else next.delete(source);
        const changed = on
          ? Array.from(new Set([...readList(FOLLOW_KEY), source]))
          : readList(FOLLOW_KEY).filter((x) => x !== source);
        writeList(FOLLOW_KEY, changed);
        return next;
      });
      const on = !sources.has(source);
      if (user) {
        fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, on }),
        }).catch(() => {});
      }
    },
    [sources, user]
  );

  const has = useCallback((source: string) => sources.has(source), [sources]);

  return { sources, has, toggle, ready };
}
