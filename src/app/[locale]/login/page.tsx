import { Suspense } from "react";
import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  return isLocale(loc) ? { title: getDict(loc).authLoginTitle, robots: { index: true, follow: true } } : { title: "Login" };
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
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
  // 只接受站内相对路径，杜绝 ?next=//evil.com 这类开放重定向
  const raw = sp.next || "/me";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? `/${loc}${raw === "/" ? "" : raw}` : `/${loc}/me`;
  return (
    <div className="container">
      <Suspense fallback={null}>
        <AuthForm locale={loc} mode="login" next={next} />
      </Suspense>
    </div>
  );
}
