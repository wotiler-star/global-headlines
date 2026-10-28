import { Suspense } from "react";
import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  return isLocale(loc)
    ? { title: getDict(loc).authJoinTitle, robots: { index: true, follow: true } }
    : { title: "Register" };
}

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const loc = locale as Locale;
  if (!isLocale(loc)) {
    return (
      <div className="container">
        <p>Invalid locale.</p>
      </div>
    );
  }
  const raw = sp.next || "/write";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? `/${loc}${raw === "/" ? "" : raw}` : `/${loc}/write`;
  return (
    <div className="container">
      <Suspense fallback={null}>
        <AuthForm locale={loc} mode="register" next={next} />
      </Suspense>
    </div>
  );
}
