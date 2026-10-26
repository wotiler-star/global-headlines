import { isLocale, Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
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
  return (
    <div className="container">
      <MemberPanel locale={loc} />
    </div>
  );
}
