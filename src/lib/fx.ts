import { Locale } from "@/i18n/config";

// 静态汇率表（以「1 美元 = N 单位」为基准，snapshot 2026-01，仅作参考/工具用途）。
// 站点 6 语言对应的主要币种 + 常用国际货币；切换数据源时不影响本表（纯前端换算）。
// 如需实时汇率，可后续叠加 /api/fx 路由；当前选「内置静态表」以零网络依赖、离线可用。
export interface Currency {
  code: string;
  symbol: string;
  /** 1 美元可兑换的本币数量（越大越弱） */
  perUsd: number;
  /** 各语言下的币种名；缺省回退英文 */
  names: Partial<Record<Locale, string>> & { en: string };
}

export const FX_BASELINE = "2026-01 (static)";

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", perUsd: 1, names: { en: "US Dollar", zh: "美元", ja: "米ドル", ko: "미국 달러", es: "Dólar estadounidense", fr: "Dollar américain" } },
  { code: "CNY", symbol: "¥", perUsd: 7.1, names: { en: "Chinese Yuan", zh: "人民币", ja: "人民元", ko: "위안", es: "Yuan chino", fr: "Yuan chinois" } },
  { code: "JPY", symbol: "¥", perUsd: 149.5, names: { en: "Japanese Yen", zh: "日元", ja: "円", ko: "엔", es: "Yen japonés", fr: "Yen japonais" } },
  { code: "KRW", symbol: "₩", perUsd: 1370, names: { en: "South Korean Won", zh: "韩元", ja: "韓国ウォン", ko: "원", es: "Won surcoreano", fr: "Won sud-coréen" } },
  { code: "EUR", symbol: "€", perUsd: 0.92, names: { en: "Euro", zh: "欧元", ja: "ユーロ", ko: "유로", es: "Euro", fr: "Euro" } },
  { code: "GBP", symbol: "£", perUsd: 0.79, names: { en: "British Pound", zh: "英镑", ja: "ポンド", ko: "파운드", es: "Libra esterlina", fr: "Livre sterling" } },
  { code: "HKD", symbol: "HK$", perUsd: 7.78, names: { en: "Hong Kong Dollar", zh: "港元" } },
  { code: "TWD", symbol: "NT$", perUsd: 32.3, names: { en: "New Taiwan Dollar", zh: "新台币" } },
  { code: "SGD", symbol: "S$", perUsd: 1.34, names: { en: "Singapore Dollar", zh: "新加坡元" } },
  { code: "AUD", symbol: "A$", perUsd: 1.52, names: { en: "Australian Dollar", zh: "澳元" } },
  { code: "CAD", symbol: "C$", perUsd: 1.36, names: { en: "Canadian Dollar", zh: "加元" } },
  { code: "CHF", symbol: "Fr", perUsd: 0.89, names: { en: "Swiss Franc", zh: "瑞士法郎" } },
  { code: "THB", symbol: "฿", perUsd: 36.5, names: { en: "Thai Baht", zh: "泰铢" } },
  { code: "INR", symbol: "₹", perUsd: 83.5, names: { en: "Indian Rupee", zh: "印度卢比" } },
  { code: "RUB", symbol: "₽", perUsd: 93, names: { en: "Russian Ruble", zh: "俄罗斯卢布" } },
  { code: "BRL", symbol: "R$", perUsd: 5.4, names: { en: "Brazilian Real", zh: "巴西雷亚尔" } },
  { code: "MXN", symbol: "MX$", perUsd: 18.0, names: { en: "Mexican Peso", zh: "墨西哥比索" } },
  { code: "NZD", symbol: "NZ$", perUsd: 1.64, names: { en: "New Zealand Dollar", zh: "新西兰元" } },
  { code: "SEK", symbol: "kr", perUsd: 10.6, names: { en: "Swedish Krona", zh: "瑞典克朗" } },
  { code: "ZAR", symbol: "R", perUsd: 18.6, names: { en: "South African Rand", zh: "南非兰特" } },
  { code: "AED", symbol: "د.إ", perUsd: 3.67, names: { en: "UAE Dirham", zh: "阿联酋迪拉姆" } },
  { code: "SAR", symbol: "﷼", perUsd: 3.75, names: { en: "Saudi Riyal", zh: "沙特里亚尔" } },
];

const _byCode = new Map(CURRENCIES.map((c) => [c.code, c]));

/** amount 个 from 币种 ≈ 多少 to 币种（基于 USD 基准交叉汇率） */
export function convert(amount: number, from: string, to: string): number {
  const f = _byCode.get(from);
  const t = _byCode.get(to);
  if (!f || !t || !isFinite(amount)) return 0;
  return (amount * t.perUsd) / f.perUsd;
}

export function currencyName(code: string, locale: Locale): string {
  const c = _byCode.get(code);
  if (!c) return code;
  return c.names[locale] || c.names.en;
}

export function currencySymbol(code: string): string {
  return _byCode.get(code)?.symbol || "";
}
