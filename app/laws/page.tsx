import Link from "next/link";
import { getBillsByCategory, getBillYears, type BillCategory } from "../data/knesset";
import BrowseToggle from "../components/BrowseToggle";
import BillCard from "../components/BillCard";

const STATUSES: { key: BillCategory; label: string }[] = [
  { key: "passed", label: "עברו" },
  { key: "in_progress", label: "בהליך" },
  { key: "stopped", label: "נעצרו / נדחו" },
];

const PER_PAGE = 50;

const TYPES: { key: string; label: string }[] = [
  { key: "all", label: "כל הסוגים" },
  { key: "פרטית", label: "פרטית" },
  { key: "ממשלתית", label: "ממשלתית" },
  { key: "ועדה", label: "ועדה" },
];

const SORTS: { key: string; label: string }[] = [
  { key: "updated", label: "מהחדש לישן" },
  { key: "oldest", label: "מהישן לחדש" },
];

export default async function LawsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; type?: string; sort?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const status: BillCategory = STATUSES.some((s) => s.key === sp.status)
    ? (sp.status as BillCategory)
    : "passed";
  const type = TYPES.some((t) => t.key === sp.type) ? (sp.type as string) : "all";
  const sort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as string) : "updated";

  const years = getBillYears();
  const year = years.includes(sp.year ?? "") ? (sp.year as string) : "all";

  let all = getBillsByCategory(status); // ממוין מהמעודכן לישן כברירת מחדל
  if (type !== "all") all = all.filter((b) => b.subType === type);
  if (year !== "all") all = all.filter((b) => (b.lastUpdated || "").slice(0, 4) === year);
  if (sort === "oldest") all = [...all].sort((a, b) => (a.lastUpdated || "").localeCompare(b.lastUpdated || ""));

  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const shown = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const pill = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  const on = "bg-blue-600 text-white";
  const off = "border border-border text-muted hover:bg-card";
  // בונה קישור עם שמירת הבחירות הקיימות (שינוי פילטר מאפס לעמוד 1)
  const hrefWith = (next: { status?: string; type?: string; sort?: string; year?: string; page?: number }) => {
    const q = new URLSearchParams();
    q.set("status", next.status ?? status);
    const t = next.type ?? type;
    if (t !== "all") q.set("type", t);
    const y = next.year ?? year;
    if (y !== "all") q.set("year", y);
    const s = next.sort ?? sort;
    if (s !== "updated") q.set("sort", s);
    if (next.page && next.page > 1) q.set("page", String(next.page));
    return `/laws?${q.toString()}`;
  };

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";
  const typeLabel = TYPES.find((t) => t.key === type)?.label ?? "";
  // תקציר הבחירות הפעילות, להצגה על כפתור הסינון המקופל —
  // רק בחירות שאינן ברירת-המחדל (כדי שכברירת מחדל יופיע רק "סינון ומיון")
  const activeBits = [
    type !== "all" ? typeLabel : null,
    year !== "all" ? year : null,
    sort !== "updated" ? sortLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-4 sm:py-8">
      <BrowseToggle active="laws" />

      <h1 className="mb-3 text-2xl font-bold">חוקים והצעות חוק</h1>

      {/* שורה אחת: מתגי סטטוס + כפתור "סינון ומיון" מתקפל כתפריט צף — חוסך שורה בראש הדף */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => {
          const list = getBillsByCategory(s.key);
          return (
            <Link
              key={s.key}
              href={hrefWith({ status: s.key })}
              className={`${pill} ${status === s.key ? on : off}`}
            >
              {s.label} ({list.length})
            </Link>
          );
        })}

        {/* סינון ומיון — נפתח כתפריט צף (overlay) כדי לא להוסיף שורה לראש הדף */}
        <details className="relative mr-auto">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-card">
            <span>סינון ומיון</span>
            {activeBits ? (
              <span className="text-xs font-normal text-blue-700">· {activeBits}</span>
            ) : null}
            <span className="text-xs">▾</span>
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-[min(88vw,420px)] space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 text-xs text-muted">סוג:</span>
              {TYPES.map((t) => (
                <Link
                  key={t.key}
                  href={hrefWith({ type: t.key })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    type === t.key ? on : off
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 text-xs text-muted">שנה:</span>
              <Link
                href={hrefWith({ year: "all" })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  year === "all" ? on : off
                }`}
              >
                כל השנים
              </Link>
              {years.map((y) => (
                <Link
                  key={y}
                  href={hrefWith({ year: y })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    year === y ? on : off
                  }`}
                >
                  {y}
                </Link>
              ))}
              <span className="w-full text-[11px] text-muted">לפי שנת הפעילות האחרונה בחוק (לא שנת ההגשה)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 text-xs text-muted">מיון:</span>
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={hrefWith({ sort: s.key })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    sort === s.key ? on : off
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </details>
      </div>

      <p className="mb-4 text-xs text-muted">
        מוצגים {shown.length} מתוך {all.length} · עמוד {page} מתוך {totalPages} · {sortLabel}.
        מקור: אתר הכנסת.
      </p>

      {/* רשימת החוקים */}
      <div className="space-y-2">
        {shown.map((bill) => (
          <BillCard key={bill.billId} bill={bill} showTally />
        ))}
      </div>

      {/* דפדוף */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={hrefWith({ page: page - 1 })} className={`${pill} ${off}`}>
              → הקודם
            </Link>
          ) : (
            <span className={`${pill} opacity-40`}>→ הקודם</span>
          )}
          <span className="text-muted">
            עמוד {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefWith({ page: page + 1 })} className={`${pill} ${off}`}>
              הבא ←
            </Link>
          ) : (
            <span className={`${pill} opacity-40`}>הבא ←</span>
          )}
        </div>
      )}
    </main>
  );
}
