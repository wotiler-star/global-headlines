"use client";

import { useEffect } from "react";

const KEY = "gh_read_history";
type HistoryItem = { id: string; cat: string };

// Records the current article into local read-history so the recommendation rail
// can personalize. Renders nothing.
export default function ReadHistoryTracker({
  id,
  category,
}: {
  id: string;
  category: string;
}) {
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryItem[];
      const next = [{ id, cat: category }, ...raw.filter((r) => r.id !== id)].slice(0, 50);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [id, category]);
  return null;
}
