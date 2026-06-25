import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBill,
  getBillInitiators,
  getBillVotes,
  getBillFinalText,
  getBillExplanation,
  getParty,
  type BillCategory,
  type Vote,
} from "../../data/knesset";

// תגית סטטוס — זהה במשמעות לזו שבדף הח"כ
const billLabel: Record<BillCategory, string> = {
  passed: "עבר",
  in_progress: "בהליך",
  stopped: "נעצר",
};

const billStyle: Record<BillCategory, string> = {
  passed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  stopped: "bg-gray-100 text-gray-600",
};

function billUrl(billId: number): string {
  return `https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=LawSuggestionsSearch&lawitemid=${billId}`;
}

function voteUrl(voteId: number): string {
  return `https://main.knesset.gov.il/Activity/plenum/Votes/Pages/vote.aspx?voteId=${voteId}`;
}

// מד בעד/נגד/נמנע לפי תוצאות ההצבעה
function TallyBar({ vote }: { vote: Vote }) {
  const total = vote.totalFor + vote.totalAgainst + vote.totalAbstain || 1;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="bg-green-500" style={{ width: `${(vote.totalFor / total) * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${(vote.totalAgainst / total) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${(vote.totalAbstain / total) * 100}%` }} />
      </div>
      <div className="mt-1 flex gap-3 text-xs text-muted">
        <span className="text-green-700">בעד {vote.totalFor}</span>
        <span className="text-red-700">נגד {vote.totalAgainst}</span>
        <span className="text-amber-600">נמנע {vote.totalAbstain}</span>
      </div>
    </div>
  );
}

export default async function LawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const billId = Number(id);
  if (!Number.isFinite(billId)) notFound();

  const bill = getBill(billId);
  if (!bill) notFound();

  const initiators = getBillInitiators(billId);
  const firstId = initiators.find((i) => i.isInitiator)?.memberId ?? null;
  const billVotes = getBillVotes(billId);
  const finalText = bill.category === "passed" ? getBillFinalText(billId) : null;
  // תקציר רשמי — אם הוא חובר לאחת ההצבעות של החוק
  const summary = billVotes.find((v) => v.summary)?.summary ?? null;
  // דברי הסבר — חולצו ממסמך הצעת החוק לקריאה ראשונה
  const explanation = getBillExplanation(billId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← חזרה לעמוד הראשי
      </Link>

      {/* כותרת החוק */}
      <header className="mb-8 mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-snug">{bill.name}</h1>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${billStyle[bill.category]}`}
          >
            {billLabel[bill.category]}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{bill.statusDesc}</span>
          {bill.subType ? <span>· {bill.subType}</span> : null}
        </div>
      </header>

      {/* תקציר רשמי */}
      {summary && (
        <section className="mb-8 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
          <div className="mb-1 font-semibold text-blue-800">תקציר הצעת החוק</div>
          {summary}
          <div className="mt-1.5 text-xs text-muted/70">מקור: אתר הכנסת</div>
        </section>
      )}

      {/* דברי הסבר — מתוך מסמך הצעת החוק לקריאה ראשונה (בלשון היוזם) */}
      {explanation && (
        <section className="mb-8">
          <h2 className="mb-2 text-xl font-bold">דברי הסבר</h2>
          <details className="group rounded-xl border border-border bg-card px-4 py-3">
            <summary className="cursor-pointer list-none">
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 line-clamp-4 group-open:line-clamp-none">
                {explanation.text}
              </p>
              <span className="mt-1 inline-block text-sm text-blue-600 hover:underline">
                <span className="group-open:hidden">קרא עוד ▾</span>
                <span className="hidden group-open:inline">הצג פחות ▴</span>
              </span>
            </summary>

            {/* מקור + קישור למסמך המלא — בסוף הטקסט, להגעה קלה למקור */}
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
              <p>
                מקור: {explanation.source || "מסמך הצעת החוק"}
                {explanation.date ? ` · ${explanation.date}` : ""} · אתר הכנסת (בלשון היוזם).
              </p>
              <p className="mt-1 text-muted/80">
                הנוסח שהתקבל בפועל עשוי להיות שונה בעקבות דיוני הוועדה.
              </p>
              <a
                href={explanation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 hover:bg-blue-100"
              >
                📄 למסמך המלא באתר הכנסת ←
              </a>
            </div>
          </details>
        </section>
      )}

      {/* יוזמים וחתומים */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">יוזמים וחתומים</h2>
        {initiators.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
            לא רשומים יוזמים לחוק זה בנתונים.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">
              {initiators.length} ח&quot;כ חתומים. ★ מסמן את המציע הראשון. לחצו למעבר לח&quot;כ.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {initiators.map((p) => {
                const party = getParty(p.partyId);
                return (
                  <Link
                    key={p.memberId}
                    href={`/member/${p.memberId}`}
                    title={
                      p.memberId === firstId
                        ? "מציע ראשון"
                        : p.isInitiator
                          ? "יוזם"
                          : "חתום"
                    }
                    className={`rounded-full border border-border px-2.5 py-1 text-xs hover:bg-card ${
                      p.isInitiator ? "" : "text-muted"
                    } ${p.status === "former" ? "opacity-60" : ""}`}
                  >
                    {p.memberId === firstId ? "★ " : ""}
                    {p.name}
                    {party ? (
                      <span className="text-muted/70"> · {party.name}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* הצבעות במליאה */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">הצבעות במליאה</h2>
        {billVotes.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
            לא נמצאו הצבעות מליאה המקושרות לחוק זה בנתונים שנשאבו עד כה.
          </p>
        ) : (
          <ul className="space-y-2">
            {billVotes.map((vote) => (
              <li
                key={vote.voteId}
                className="overflow-hidden rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="text-xs text-muted">
                      {vote.dateStr} · {vote.decision}
                      {vote.accepted ? " — התקבל" : " — לא התקבל"}
                    </div>
                  </div>
                </div>
                <TallyBar vote={vote} />
                <a
                  href={voteUrl(vote.voteId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  🔗 איך כל ח&quot;כ הצביע ←
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* קישורים רשמיים */}
      <section className="mb-8 flex flex-wrap gap-2">
        <a
          href={billUrl(billId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          צפייה בהצעת החוק באתר הכנסת ←
        </a>
        {finalText && (
          <a
            href={finalText.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            📄 נוסח החוק{finalText.official ? " שפורסם ברשומות" : " (לא רשמי)"} ←
          </a>
        )}
      </section>

      {/*
        🔒 אזור שמור להמשך: "הסבר הח"כ" — קישור שהח"כ מוסיף (אינסטגרם/יוטיוב/אתר) המסביר את החוק.
        כלל מבני שהוסכם (ראו זיכרון project-business-model): העיצוב כאן צנוע, קבוע, ומסומן
        "קישור מטעם הח"כ" — ולא משתנה כדי להגדיל קליקים. לעולם. הפיצ'ר עצמו טרם מומש.
      */}
    </main>
  );
}
