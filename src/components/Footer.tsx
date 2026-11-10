import Link from "next/link";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { citeCopy } from "@/i18n/citePage";
import { SITE_URL } from "@/lib/site";
import { BrandMark, BrandWordmark } from "./BrandMark";

// 外链优化：可引用资产页 /<locale>/about 必须有全站可见的内链入口，
// 否则爬虫只能靠 sitemap 发现，数千篇文章页的权重也传不过去。Footer 全站渲染。
export default function Footer({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const c = citeCopy[locale];
  return (
    <footer className="footer">
      <div className="footer-brand">
        <BrandMark size={22} />
        <BrandWordmark />
        <span className="footer-tagline">{d.tagline}</span>
      </div>
      <div className="footer-meta">
        <Link href={`/${locale}/about`} className="rss-link" title={c.desc}>{c.citeTitle}</Link>
        <span> · </span>
        <a href={`${SITE_URL}/${locale}/rss.xml`} className="rss-link">📰 RSS</a>
        <a href={`${SITE_URL}/atom.xml`} className="rss-link">Atom</a>
        <span> · {d.footer}</span>
      </div>
    </footer>
  );
}
