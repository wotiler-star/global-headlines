import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import ArticleEditor from "@/components/ArticleEditor";
import LoginEntryButton from "@/components/LoginEntryButton";

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
  if (!user) {
    return (
      <div className="container">
        <div className="admin-guard">
          <h1>{d.memberWrite}</h1>
          <p>{d.memberNeedLogin}</p>
          <p className="admin-hint">{d.adminHint}</p>
          <p>
            <LoginEntryButton next={`/${loc}/write`} label={d.authLoginContinue} />
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="container">
      <ArticleEditor locale={loc} />
    </div>
  );
}
