import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

export default function Footer({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return <footer className="footer">{d.footer}</footer>;
}
