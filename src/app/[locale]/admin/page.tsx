import { isLocale, Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { getDict } from "@/i18n/dictionaries";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale as Locale;
  if (!isLocale(loc)) {
    return <div className="container"><p>Invalid locale.</p></div>;
  }
  const d = getDict(loc);
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return (
      <div className="container">
        <div className="admin-guard">
          <h1>{d.adminTitle}</h1>
          <p>{d.adminNeedLogin}</p>
          <p className="admin-hint">{d.adminHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <AdminPanel locale={loc} username={user.username} />
    </div>
  );
}
