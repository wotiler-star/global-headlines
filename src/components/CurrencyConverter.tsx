"use client";

import { useState } from "react";
import { Locale } from "@/i18n/config";
import { CURRENCIES, convert, currencyName, currencySymbol } from "@/lib/fx";

const I18N: Record<Locale, { title: string; amount: string; from: string; to: string; swap: string; note: string; approx: string }> = {
  zh: { title: "货币兑换", amount: "金额", from: "从", to: "到", swap: "互换", note: "静态汇率", approx: "仅供参考" },
  en: { title: "Currency", amount: "Amount", from: "From", to: "To", swap: "Swap", note: "static rates", approx: "indicative only" },
  ja: { title: "通貨換算", amount: "金額", from: "元", to: "先", swap: "入替", note: "静的レート", approx: "目安" },
  ko: { title: "환율 계산", amount: "금액", from: "보내는", to: "받는", swap: "교환", note: "고정 환율", approx: "참고용" },
  es: { title: "Divisas", amount: "Monto", from: "De", to: "A", swap: "Invertir", note: "tipos fijos", approx: "referencia" },
  fr: { title: "Devises", amount: "Montant", from: "De", to: "Vers", swap: "Inverser", note: "taux statiques", approx: "indicatif" },
  pt: { title: "Moedas", amount: "Valor", from: "De", to: "Para", swap: "Trocar", note: "taxas fixas", approx: "apenas referência" },
  tr: { title: "Döviz", amount: "Tutar", from: "Kaynak", to: "Hedef", swap: "Değiştir", note: "sabit kurlar", approx: "yalnızca referans" },
};

export default function CurrencyConverter({ locale }: { locale: Locale }) {
  const t = I18N[locale] || I18N.en;
  // 默认折叠：展开态会盖住右侧信息面板底部，收起时只占一个小胶囊位
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("CNY");

  const num = parseFloat(amount);
  const result = isFinite(num) ? convert(num, from, to) : 0;
  const fmt = (v: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const opt = (code: string) => (
    <option key={code} value={code}>
      {code} · {currencySymbol(code)}
    </option>
  );

  return (
    <div className={"fx-card" + (open ? "" : " collapsed")} aria-label={t.title}>
      <button
        type="button"
        className="fx-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="fx-dot" />
        {t.title}
        <span className="fx-caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="fx-body">
          <div className="fx-row fx-top">
            <input
              className="fx-amt"
              inputMode="decimal"
              aria-label={t.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <select
              className="fx-sel"
              aria-label={t.from}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {CURRENCIES.map((c) => opt(c.code))}
            </select>
          </div>

          <button type="button" className="fx-swap" onClick={swap} title={t.swap} aria-label={t.swap}>
            ⇅
          </button>

          <div className="fx-row fx-bottom">
            <div className="fx-out" aria-live="polite">
              <span className="fx-sym">{currencySymbol(to)}</span>
              {fmt(result)}
            </div>
            <select
              className="fx-sel"
              aria-label={t.to}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {CURRENCIES.map((c) => opt(c.code))}
            </select>
          </div>

          <div className="fx-foot">
            {currencyName(from, locale)} → {currencyName(to, locale)} · {t.note} · {t.approx}
          </div>
        </div>
      )}
    </div>
  );
}
