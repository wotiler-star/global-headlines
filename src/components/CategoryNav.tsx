"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Locale, Category, categories, isCategory } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { categoryHref, homeHref } from "@/lib/paths";

export default function CategoryNav({
  locale,
  active,
}: {
  locale: Locale;
  active?: Category;
}) {
  const sp = useSearchParams();
  const d = getDict(locale);
  const catParam = sp.get("cat");
  const isFollowing = sp.get("view") === "following";
  const current: Category = active && isCategory(active)
    ? active
    : catParam && isCategory(catParam)
      ? catParam
      : "recommend";
  const cats = categories;
  // 切分类时保留当前搜索词与标签，避免「搜索后点分类丢词」。
  const keep = [
    sp.get("q") && `q=${encodeURIComponent(sp.get("q") as string)}`,
    sp.get("tag") && `tag=${encodeURIComponent(sp.get("tag") as string)}`,
  ]
    .filter(Boolean)
    .join("&") || undefined;
  const followHref = `${homeHref(locale)}?view=following${keep ? `&${keep}` : ""}`;
  return (
    <nav className="cat-nav">
      <div className="cat-nav-inner">
        <Link href={followHref} className={`cat-link${isFollowing ? " active" : ""}`}>
          {d.followChannel}
        </Link>
        {cats.map((c) => {
          const href = categoryHref(locale, c, keep);
          const isActive = !isFollowing && current === c;
          return (
            <Link key={c} href={href} className={`cat-link${isActive ? " active" : ""}`}>
              {d.categories[c]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
