import Link from "next/link";
import { getBillsByCategory, getBillYears, getBillMainVote, type BillCategory } from "../data/knesset";
import BrowseToggle from "../components/BrowseToggle";

// סרגל הצבעה קומפקטי (איפה שיש הצבעה סופית מקושרת לחוק)
function MiniTally({ billId }: { billId: number }) {
  const v = getBillMainVote(billId);
  if (!v) return null;
  const total = v.totalFor + v.totalAgainst + v.totalAbstain || 1;
  return (
    <div className="mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="bg-green-500" style={{ width: `${(v.totalFor / total) * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${(v.totalAgainst / total) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${(v.totalAbstain / total) * 100}%` }} />
      </div>
      <div className="mt-1 flex gap-3 text-[11px] text-muted">
        <span className="text-green-700">בעד {v.totalFor}</span>
        <span className="text-red-700">נגד {v.totalAgainst}</span>
        <span className="text-amber-600">נמנע {v.totalAbstain}</span>
      </div>
    </div>
  );
}

const CATEGORY_BADGE: Record<BillCategory, string> = {
  passed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  stopped: "bg-gray-200 text-gray-700",
};

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
  { key: "alpha", label: "לפי א–ת" },
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
  else if (sort === "alpha") all = [...all].sort((a, b) => a.name.localeCompare(b.name, "he"));

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
  // תקציר הבחירות הפעילות, להצגה בכותרת הסרגל המקופל
  const activeBits = [type !== "all" ? typeLabel : null, year !== "all" ? year : null, sortLabel]
    .filter(Boolean)
    .join(" · ");
  // לפתוח את הסרגל אוטומטית אם יש סינון/מיון לא-ברירת-מחדל פעיל
  const filtersActive = type !== "all" || year !== "all" || sort !== "updated";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <BrowseToggle active="laws" />

      <h1 className="mb-4 text-2xl font-bold">חוקים והצעות חוק</h1>

      {/* מתג סטטוס (חוזר לעמוד 1, שומר סוג/מיון) */}
      <div className="mb-2 flex flex-wrap gap-2">
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
      </div>

      {/* סינון ומיון — מקופל כברירת מחדל כדי לא להכביד */}
      <details open={filtersActive} className="mb-2 rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
          <span>סינון ומיון</span>
          <span className="text-xs font-normal text-muted">{activeBits}</span>
        </summary>
        <div className="space-y-2 border-t border-border px-3 py-3">
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

      <p className="mb-5 text-xs text-muted">
        מוצגים {shown.length} מתוך {all.length} · עמוד {page} מתוך {totalPages} · {sortLabel}.
        מקור: אתר הכנסת.
      </p>

      {/* רשימת החוקים */}
      <div className="space-y-2">
        {shown.map((bill) => (
          <Link
            key={bill.billId}
            href={`/law/${bill.billId}`}
            className="block rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="font-medium leading-snug">{bill.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[bill.category]}`}
              >
                {bill.statusDesc || bill.category}
              </span>
              {bill.subType ? (
                <span className="text-xs text-muted">{bill.subType}</span>
              ) : null}
            </div>
            <MiniTally billId={bill.billId} />
          </Link>
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
