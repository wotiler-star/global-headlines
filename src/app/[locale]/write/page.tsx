import { redirect } from "next/navigation";
import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import ArticleEditor from "@/components/ArticleEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) return { title: "Write" };
  return { title: getDict(loc).memberWrite };
}

export default async function WritePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const loc = locale as Locale;
  const d = getDict(loc);
  if (!isLocale(loc)) {
    return (
      <div className="container">
        <p>Invalid locale.</p>
      </div>
    );
  }
  const user = await getCurrentUser();
  // 未登录 → 登录页，登录后自动回到投稿页（服务端跳转，session 立刻生效）
  if (!user) redirect(`/${loc}/login?next=${encodeURIComponent("/write")}`);
  return (
    <div className="container">
      <ArticleEditor locale={loc} />
    </div>
  );
}
