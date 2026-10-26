import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import SearchBox from "./SearchBox";

// 今日头条式 Hero：居中大标题 + 大号搜索框（复用 SearchBox 建议下拉）。
// 地球仪（SignalDeck）位于其下方，保持原样不动。
export default function HeroHead({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <section className="tt-hero">
      <h1 className="tt-hero-title">{d.heroTitle}</h1>
      <div className="tt-hero-search">
        <SearchBox locale={locale} variant="hero" />
      </div>
    </section>
  );
}
