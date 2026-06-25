import Link from "next/link";
import {
  searchAll,
  getPhoto,
  getParty,
  type Member,
  type Bill,
  type BillCategory,
} from "../data/knesset";
import SearchBox from "../components/SearchBox";

// ראשי תיבות לאווטאר כשאין תמונה
function initials(name: string): string {
  const parts = name.replace(/['"]/g, "").split(" ");
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

// צבע תגית סטטוס לפי קטגוריה (כמו בדף הח"כ)
const CATEGORY_BADGE: Record<BillCategory, string> = {
  passed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  stopped: "bg-gray-200 text-gray-700",
};

function MemberResult({ member }: { member: Member }) {
  const isFormer = member.status === "former";
  const photo = getPhoto(member.id);
  const party = getParty(member.partyId);
  return (
    <Link
      href={`/member/${member.id}`}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
        isFormer ? "opacity-70" : ""
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={member.name}
          className={`h-12 w-12 shrink-0 rounded-full object-cover ${
            isFormer ? "grayscale" : ""
          }`}
        />
      ) : (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: isFormer ? "#9ca3af" : party?.color ?? "#6b7280" }}
        >
          {initials(member.name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold leading-tight">{member.name}</p>
        <p className="truncate text-xs text-muted">
          {party?.name ?? ""}
          {isFormer ? " · פרש מהכנסת" : member.roles[0] ? ` · ${member.roles[0]}` : ""}
        </p>
      </div>
    </Link>
  );
}

function BillResult({ bill }: { bill: Bill }) {
  return (
    <Link
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
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  const { members, bills, memberTotal, billTotal } = searchAll(q);
  const total = members.length + bills.length;
  // טקסט כותרת שקוף: "(60 מתוך 134)" כשיש יותר ממה שמוצג, אחרת "(N)"
  const countLabel = (shown: number, found: number) =>
    found > shown ? `${shown} מתוך ${found}` : `${found}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← חזרה לעמוד הבית
      </Link>

      <div className="mt-4">
        <SearchBox defaultValue={q} autoFocus />
      </div>

      {/* מצב ריק — לא הוקלד חיפוש */}
      {!q ? (
        <p className="mt-10 text-center text-muted">
          הקלידו שם של חבר/ת כנסת, או שם/נושא של הצעת חוק.
        </p>
      ) : total === 0 ? (
        <p className="mt-10 text-center text-muted">
          לא נמצאו תוצאות עבור “{q}”. נסו ניסוח אחר.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {members.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-muted">
                חברי כנסת ({countLabel(members.length, memberTotal)})
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => (
                  <MemberResult key={m.id} member={m} />
                ))}
              </div>
            </section>
          )}

          {bills.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-muted">
                הצעות חוק וחוקים ({countLabel(bills.length, billTotal)})
              </h2>
              <div className="space-y-2">
                {bills.map((b) => (
                  <BillResult key={b.billId} bill={b} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
