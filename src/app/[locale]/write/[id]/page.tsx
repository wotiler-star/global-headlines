import { redirect } from "next/navigation";
import { isLocale, Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import ArticleEditor from "@/components/ArticleEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) {
    return (
      <div className="container">
        <p>Invalid locale.</p>
      </div>
    );
  }
  const user = await getCurrentUser();
  // 未登录 → 登录页回跳到这篇稿件的编辑页
  if (!user) redirect(`/${loc}/login?next=${encodeURIComponent(`/write/${id}`)}`);
  return (
    <div className="container">
      <ArticleEditor locale={loc} editId={id} />
    </div>
  );
}
