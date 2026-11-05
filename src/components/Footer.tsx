import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { SITE_URL } from "@/lib/site";
import { BrandMark, BrandWordmark } from "./BrandMark";

export default function Footer({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <footer className="footer">
      <div className="footer-brand">
        <BrandMark size={22} />
        <BrandWordmark />
        <span className="footer-tagline">{d.tagline}</span>
      </div>
      <div className="footer-meta">
        <a href={`${SITE_URL}/${locale}/rss.xml`} className="rss-link">
          📰 RSS
        </a>
        <span> · {d.footer}</span>
      </div>
    </footer>
  );
}
