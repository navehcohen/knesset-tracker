import Link from "next/link";
import {
  searchAll,
  getParty,
  type Member,
  type Vote,
} from "../data/knesset";
import SearchBox from "../components/SearchBox";
import BillCard from "../components/BillCard";
import MemberAvatar from "../components/MemberAvatar";

function MemberResult({ member }: { member: Member }) {
  const isFormer = member.status === "former";
  const party = getParty(member.partyId);
  return (
    <Link
      href={`/member/${member.id}`}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
        isFormer ? "opacity-70" : ""
      }`}
    >
      <MemberAvatar member={member} className="h-12 w-12" textClassName="text-xs" />
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

// הצבעה עצמאית (אי-אמון, חסינות, הצעה לסדר) — מקשרת לדף ההצבעה
function VoteResult({ vote }: { vote: Vote }) {
  return (
    <Link
      href={`/vote/${vote.voteId}`}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          vote.accepted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {vote.accepted ? "התקבל" : "נדחה"}
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-snug">{vote.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {vote.dateStr} · בעד {vote.totalFor} · נגד {vote.totalAgainst}
        </p>
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
  const { members, bills, votes, memberTotal, billTotal, voteTotal } = searchAll(q);
  const total = members.length + bills.length + votes.length;
  // טקסט כותרת שקוף: "(60 מתוך 134)" כשיש יותר ממה שמוצג, אחרת "(N)"
  const countLabel = (shown: number, found: number) =>
    found > shown ? `${shown} מתוך ${found}` : `${found}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← חזרה לעמוד הבית
      </Link>

      <div className="mt-4">
        {/* בלי autoFocus — כדי שבמובייל המקלדת לא תיפתח מחדש אחרי כל חיפוש */}
        <SearchBox defaultValue={q} />
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
                  <BillCard key={b.billId} bill={b} />
                ))}
              </div>
            </section>
          )}

          {votes.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-muted">
                הצבעות (אי-אמון, חסינות, הצעות לסדר) ({countLabel(votes.length, voteTotal)})
              </h2>
              <div className="space-y-2">
                {votes.map((v) => (
                  <VoteResult key={v.voteId} vote={v} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
