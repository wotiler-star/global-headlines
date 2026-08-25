"use client";

import { useEffect, useState } from "react";

// 暗色模式切换：localStorage 持久化，初始值在 layout 内联防闪烁脚本里已设好。
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const cur = (document.documentElement.dataset.theme as "light" | "dark") || "light";
    setTheme(cur);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("gh_theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={theme === "dark" ? "切换到亮色" : "切换到暗色"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
