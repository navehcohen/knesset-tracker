import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import VoteTallyBar from "../../components/VoteTallyBar";
import Explanation from "./Explanation";
import {
  getAllBillIds,
  getBill,
  getBillInitiators,
  getBillVotes,
  getBillFinalText,
  getBillExplanation,
  getBillExplanationMissing,
  getParty,
  getVoteMemberChoices,
  type BillCategory,
  type VoteChoice,
} from "../../data/knesset";

// בניית דף סטטי מראש לכל הצעת חוק
export const dynamicParams = false;
export function generateStaticParams() {
  return getAllBillIds().map((id) => ({ id: String(id) }));
}

const choiceLabel: Record<VoteChoice, string> = {
  for: "בעד",
  against: "נגד",
  abstain: "נמנע",
  other: "אחר",
};
const choiceColor: Record<VoteChoice, string> = {
  for: "text-green-700",
  against: "text-red-700",
  abstain: "text-amber-600",
  other: "text-gray-500",
};

// טבלת "איך כל ח"כ הצביע" — מקובצת לפי בחירה, כל שם מקושר לדף הח"כ
function RollCall({ voteId }: { voteId: number }) {
  const groups = getVoteMemberChoices(voteId);
  const order: VoteChoice[] = ["for", "against", "abstain"];
  const total = order.reduce((n, c) => n + groups[c].length, 0);
  if (total === 0) return null;
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-blue-700 hover:underline">
        <span className="group-open:hidden">איך כל ח&quot;כ הצביע ▾</span>
        <span className="hidden group-open:inline">הסתר ▴</span>
      </summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {order.map((c) => (
          <div key={c}>
            <div className={`mb-1 text-xs font-bold ${choiceColor[c]}`}>
              {choiceLabel[c]} ({groups[c].length})
            </div>
            <div className="flex flex-wrap gap-1">
              {groups[c].map((m) => (
                <Link
                  key={m.memberId}
                  href={`/member/${m.memberId}`}
                  className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-card"
                >
                  {m.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bill = getBill(Number(id));
  if (!bill) return { title: "הצעת חוק — מעקב כנסת" };
  return {
    title: `${bill.name} — מעקב כנסת`,
    description: `סטטוס, יוזמים, הצבעות ודברי הסבר על ${bill.name}.`,
  };
}

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
  // כשאין הסבר — הסיבה (no_doc / no_text), כדי להציג הודעה ממוקדת
  const explanationMissing = explanation ? null : getBillExplanationMissing(billId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <BackButton fallback="/" />

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
          <a
            href={billUrl(billId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs text-muted/70 hover:text-blue-700 hover:underline"
          >
            מקור: אתר הכנסת ←
          </a>
        </section>
      )}

      {/* דברי הסבר — מתוך מסמך הצעת החוק לקריאה ראשונה (בלשון היוזם) */}
      {explanation ? (
        <Explanation
          text={explanation.text}
          source={explanation.source ?? null}
          date={explanation.date ?? null}
          docUrl={explanation.url}
          billUrl={billUrl(billId)}
        />
      ) : (
        <section className="mb-8">
          <h2 className="mb-2 text-xl font-bold">דברי הסבר</h2>
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
            {explanationMissing?.reason === "no_text" ? (
              <>
                {/* יש מסמך אך לא אותרו בו דברי הסבר — מנוסח בזהירות (ייתכן פספוס-חילוץ) */}
                <p>נמצא מסמך הצעת החוק לקריאה ראשונה, אך לא אותרו בו דברי הסבר.</p>
                <p className="mt-1 text-muted/80">
                  אפשר לעיין במסמך המלא ולבדוק ידנית.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={explanationMissing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 hover:bg-blue-100"
                  >
                    📄 למסמך הצעת החוק (קריאה ראשונה) ←
                  </a>
                  <a
                    href={billUrl(billId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200"
                  >
                    🔗 לדף החוק באתר הכנסת ←
                  </a>
                </div>
              </>
            ) : (
              <>
                {/* אין מסמך קריאה ראשונה (no_doc), או שאין מידע — הסיבה הנפוצה */}
                <p>לא נמצא מסמך הצעת חוק לקריאה ראשונה באתר הכנסת.</p>
                <p className="mt-1 text-muted/80">
                  דברי ההסבר מתפרסמים בדרך כלל במסמך זה — וכשהוא חסר, אין מקור לחלץ ממנו.
                </p>
                <div className="mt-3">
                  <a
                    href={billUrl(billId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200"
                  >
                    🔗 לדף החוק באתר הכנסת ←
                  </a>
                </div>
              </>
            )}
          </div>
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
                <VoteTallyBar vote={vote} variant="detailed" />
                {/* טבלת הצבעה אישית של כל ח"כ (מהנתונים שלנו), עם קישור לדף הח"כ */}
                <RollCall voteId={vote.voteId} />
                <a
                  href={voteUrl(vote.voteId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  🔗 לרשומת ההצבעה באתר הכנסת ←
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
