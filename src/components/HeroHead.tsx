import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import SearchBox from "./SearchBox";
import { BrandWordmark } from "./BrandMark";

// 品牌 Hero：居中字标 + 品牌标语 + 大号搜索框（复用 SearchBox 建议下拉）。
// 地球仪（SignalDeck）位于其下方，保持原样不动。
export default function HeroHead({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  return (
    <section className="tt-hero">
      <h1 className="tt-hero-title">
        <BrandWordmark />
      </h1>
      <p className="tt-hero-tagline">{d.tagline}</p>
      <div className="tt-hero-search">
        <SearchBox locale={locale} variant="hero" />
      </div>
    </section>
  );
}
