import { redirect } from "next/navigation";
import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import MemberPanel from "@/components/MemberPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) return { title: "Member" };
  return { title: getDict(loc).memberCenter };
}

export default async function MemberPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) {
    return (
      <div className="container">
        <p>Invalid locale.</p>
      </div>
    );
  }
  // 服务端守卫：未登录直接跳登录页并带回跳地址，避免先渲染空面板再闪成登录态
  const user = await getCurrentUser();
  if (!user) redirect(`/${loc}/login?next=${encodeURIComponent("/me")}`);
  return (
    <div className="container">
      <MemberPanel locale={loc} />
    </div>
  );
}
