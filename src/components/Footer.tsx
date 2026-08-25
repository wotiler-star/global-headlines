import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { SITE_URL } from "@/lib/site";

export default function Footer({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <footer className="footer">
      <a href={`${SITE_URL}/${locale}/rss.xml`} className="rss-link">
        📰 RSS
      </a>
      <span> · {d.footer}</span>
    </footer>
  );
}
