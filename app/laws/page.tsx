import Link from "next/link";
import { getBillsByCategory, type BillCategory } from "../data/knesset";
import BrowseToggle from "../components/BrowseToggle";

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

export default async function LawsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status: BillCategory = STATUSES.some((s) => s.key === sp.status)
    ? (sp.status as BillCategory)
    : "passed";

  const all = getBillsByCategory(status);
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const shown = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const pill = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  const on = "bg-blue-600 text-white";
  const off = "border border-border text-muted hover:bg-card";
  const pageHref = (p: number) => `/laws?status=${status}&page=${p}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <BrowseToggle active="laws" />

      <h1 className="mb-4 text-2xl font-bold">חוקים והצעות חוק</h1>

      {/* מתג סטטוס (חוזר לעמוד 1) */}
      <div className="mb-2 flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const list = getBillsByCategory(s.key);
          return (
            <Link
              key={s.key}
              href={`/laws?status=${s.key}`}
              className={`${pill} ${status === s.key ? on : off}`}
            >
              {s.label} ({list.length})
            </Link>
          );
        })}
      </div>

      <p className="mb-5 text-xs text-muted">
        מוצגים {shown.length} מתוך {all.length} · עמוד {page} מתוך {totalPages} · ממוין
        מהמעודכן לישן. מקור: אתר הכנסת.
      </p>

      {/* רשימת החוקים */}
      <div className="space-y-2">
        {shown.map((bill) => (
          <Link
            key={bill.billId}
            href={`/law/${bill.billId}`}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[bill.category]}`}
            >
              {bill.statusDesc || bill.category}
            </span>
            <div className="min-w-0">
              <p className="font-medium leading-snug">{bill.name}</p>
              {bill.subType ? (
                <p className="mt-0.5 text-xs text-muted">{bill.subType}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

      {/* דפדוף */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={`${pill} ${off}`}>
              → הקודם
            </Link>
          ) : (
            <span className={`${pill} opacity-40`}>→ הקודם</span>
          )}
          <span className="text-muted">
            עמוד {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={`${pill} ${off}`}>
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
