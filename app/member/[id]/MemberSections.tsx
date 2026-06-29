"use client";

// המקטעים האינטראקטיביים של דף הח"כ: "חוקים שקידם" (סינון לפי מצב/תקופה)
// ו"הצבעות" (דפדוף). הסינון והדפדוף מתבצעים בצד-הלקוח ב-useState — כך הדף
// כולו נבנה מראש כ-HTML סטטי (אין תלות בפרמטרי URL ובחישוב בשרת בכל בקשה).
// השרת מחשב את כל הנתונים פעם אחת ומעביר אותם כ-props מוכנים לתצוגה.

import { useState } from "react";
import Link from "next/link";
import VoteTallyBar from "../../components/VoteTallyBar";
import type {
  BillInitiator,
  MemberBill,
  MemberVoteGroup,
  VoteChoice,
  BillCategory,
} from "../../data/knesset";

// חוק מועשר: פרטי החוק + היוזמים + קישור לנוסח הסופי — הכול חושב בשרת
export type EnrichedBill = MemberBill & {
  initiators: BillInitiator[];
  finalText: { url: string; official: boolean } | null;
};
// קבוצת הצבעה מועשרת: + קישור לפרוטוקול הישיבה (חושב בשרת)
export type EnrichedGroup = MemberVoteGroup & {
  protocolUrl: string | null;
};

const choiceLabel: Record<VoteChoice, string> = {
  for: "בעד",
  against: "נגד",
  abstain: "נמנע",
  other: "אחר",
};

const choiceStyle: Record<VoteChoice, string> = {
  for: "bg-green-100 text-green-800",
  against: "bg-red-100 text-red-800",
  abstain: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-600",
};

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

// --- סינון חוקים לפי טווח זמן (לפי תאריך העדכון האחרון של החוק) ---
const BILL_RANGES = [
  { key: "all", label: "הכול" },
  { key: "1y", label: "שנה אחרונה" },
  { key: "6m", label: "חצי שנה" },
  { key: "3m", label: "3 חודשים" },
] as const;
type BillRangeKey = (typeof BILL_RANGES)[number]["key"];

// התאריך הכי מוקדם שייכלל בטווח (null = הכול)
function billRangeCutoff(range: BillRangeKey): Date | null {
  const d = new Date();
  if (range === "3m") d.setMonth(d.getMonth() - 3);
  else if (range === "6m") d.setMonth(d.getMonth() - 6);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  else return null;
  return d;
}

// --- סינון חוקים לפי מצב (עברו / בהליך) ---
const BILL_STATUSES = [
  { key: "all", label: "הכול" },
  { key: "passed", label: "עברו" },
  { key: "in_progress", label: "בהליך" },
] as const;
type BillStatusKey = (typeof BILL_STATUSES)[number]["key"];

const MAX_BILLS = 40; // כמה חוקים להציג בכל רשימה לפני קיצור
const PER_PAGE_VOTES = 40; // הצבעות/נושאים לעמוד (דפדוף)

// תפקיד הח"כ בחוק מסוים — לפי הנתון הרשמי (KNS_BillInitiator)
type BillRole = "first" | "initiator" | "cosigner";
const roleInfo: Record<BillRole, { label: string; style: string }> = {
  first: { label: "★ מציע ראשון", style: "bg-indigo-100 text-indigo-800" },
  initiator: { label: "יוזם", style: "bg-sky-100 text-sky-800" },
  cosigner: { label: "חתום", style: "bg-gray-100 text-gray-600" },
};

// כפתורי בחירת מצב החוק (סינון בצד-לקוח). כל כפתור מציג מונה.
function BillStatusTabs({
  active,
  counts,
  onSelect,
}: {
  active: BillStatusKey;
  counts: Record<BillStatusKey, number>;
  onSelect: (s: BillStatusKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">מצב החוק:</span>
      {BILL_STATUSES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onSelect(s.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            active === s.key
              ? "bg-blue-600 text-white"
              : "border border-border text-muted hover:bg-card"
          }`}
        >
          {s.label} ({counts[s.key]})
        </button>
      ))}
    </div>
  );
}

// כפתורי בחירת טווח (סינון בצד-לקוח)
function BillRangeTabs({
  active,
  onSelect,
}: {
  active: BillRangeKey;
  onSelect: (r: BillRangeKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">תקופה:</span>
      {BILL_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onSelect(r.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            active === r.key
              ? "bg-blue-600 text-white"
              : "border border-border text-muted hover:bg-card"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// שורת חוק — מתרחבת להצגת שאר היוזמים (כל שם לחיץ) וקישור לאתר הכנסת.
// היוזמים והנוסח הסופי מגיעים מוכנים מהשרת (bill.initiators / bill.finalText).
function BillRow({ bill, memberId }: { bill: EnrichedBill; memberId: string }) {
  const initiators = bill.initiators;
  const firstId = initiators.find((i) => i.isInitiator)?.memberId ?? null;
  const role: BillRole =
    memberId === firstId ? "first" : bill.isInitiator ? "initiator" : "cosigner";
  const others = initiators.filter((i) => i.memberId !== memberId);
  const finalText = bill.category === "passed" ? bill.finalText : null;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
          <div className="flex-1">
            <Link
              href={`/law/${bill.billId}`}
              className="text-sm font-medium leading-snug text-blue-700 hover:underline"
            >
              {bill.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${roleInfo[role].style}`}
              >
                {roleInfo[role].label}
              </span>
              <span>{bill.statusDesc}</span>
              {bill.subType ? <span>· {bill.subType}</span> : null}
              {initiators.length > 1 && (
                <span>· {initiators.length} ח&quot;כ חתומים</span>
              )}
              <span className="text-muted/70 group-open:hidden">· לפרטים</span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${billStyle[bill.category]}`}
          >
            {billLabel[bill.category]}
          </span>
        </summary>

        {/* תוכן מורחב */}
        <div className="border-t border-border bg-background/40 px-4 py-3 text-sm">
          {others.length > 0 ? (
            <>
              <div className="mb-2 text-xs font-semibold text-muted">
                יוזמים וחתומים נוספים ({others.length}) — לחצו למעבר לח&quot;כ:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {others.map((p) => (
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
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">אין יוזמים נוספים רשומים.</div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/law/${bill.billId}`}
              className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              ⚖ לדף החוק המלא ←
            </Link>
            <a
              href={billUrl(bill.billId)}
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
          </div>
        </div>
      </details>
    </li>
  );
}

export default function MemberSections({
  memberId,
  bills,
  groups,
}: {
  memberId: string;
  bills: EnrichedBill[];
  groups: EnrichedGroup[];
}) {
  const [range, setRange] = useState<BillRangeKey>("all");
  const [status, setStatus] = useState<BillStatusKey>("all");
  const [votePage, setVotePage] = useState(1);

  const isLead = (b: MemberBill) => b.isInitiator && b.ordinal === 1;

  // סינון לפי טווח זמן
  const cutoff = billRangeCutoff(range);
  const inRange = (b: { lastUpdated: string }) =>
    !cutoff || (b.lastUpdated ? new Date(b.lastUpdated) >= cutoff : false);

  // סינון לפי מצב החוק
  const inStatus = (b: MemberBill) => status === "all" || b.category === status;

  // מוני המצבים — בתוך הטווח שנבחר
  const billsInRange = bills.filter(inRange);
  const statusCounts: Record<BillStatusKey, number> = {
    all: billsInRange.length,
    passed: billsInRange.filter((b) => b.category === "passed").length,
    in_progress: billsInRange.filter((b) => b.category === "in_progress").length,
  };

  // שלוש קבוצות לפי התפקיד הרשמי בחוק, בתוך הטווח והמצב שנבחרו
  const ledBills = bills.filter((b) => isLead(b) && inRange(b) && inStatus(b));
  const coInitBills = bills.filter((b) => b.isInitiator && !isLead(b) && inRange(b) && inStatus(b));
  const coSignBills = bills.filter((b) => !b.isInitiator && inRange(b) && inStatus(b));
  const passedLed = ledBills.filter((b) => b.category === "passed").length;
  const ledAllTime = bills.filter(isLead).length;
  const shownLed = ledBills.slice(0, MAX_BILLS);

  // דפדוף בהצבעות
  const votePages = Math.max(1, Math.ceil(groups.length / PER_PAGE_VOTES));
  const safePage = Math.min(Math.max(1, votePage), votePages);
  const shown = groups.slice((safePage - 1) * PER_PAGE_VOTES, safePage * PER_PAGE_VOTES);

  return (
    <>
      {/* חוקים שקידם — מכווץ מאחורי חץ אך פתוח כברירת מחדל. */}
      <section className="mb-8">
        <details className="group/bills" open>
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-2">
            <h2 className="text-xl font-bold">חוקים שקידם</h2>
            <span className="text-sm text-blue-600 group-open/bills:hidden">הצג ▾</span>
            <span className="hidden text-sm text-blue-600 group-open/bills:inline">הסתר ▴</span>
          </summary>

          {bills.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
              לא נמצאו הצעות חוק שח&quot;כ זה יזם או חתם עליהן בכנסת ה-25.
            </p>
          ) : (
            <>
              {/* מסננים: מצב החוק (עם מונים) + טווח זמן */}
              <div className="mb-3 space-y-2">
                <BillStatusTabs active={status} counts={statusCounts} onSelect={setStatus} />
                <BillRangeTabs active={range} onSelect={setRange} />
              </div>

              {/* סיכום כן: המספר המרכזי הוא מה שהוביל בפועל (מציע ראשון) */}
              <p className="mb-1 text-sm">
                הוביל כ<strong>מציע ראשון</strong>:{" "}
                <strong>{ledBills.length}</strong> הצעות חוק
                {passedLed > 0 && (
                  <span className="text-green-700"> · {passedLed} התקבלו כחוק</span>
                )}
              </p>
              <p className="mb-3 text-xs text-muted">
                בנוסף: יוזם רשמי יחד עם ח&quot;כים אחרים על {coInitBills.length} · חתום על{" "}
                {coSignBills.length}.
                {range !== "all" &&
                  ledAllTime !== ledBills.length &&
                  ` (בכל הקדנציה הוביל ${ledAllTime}.)`}{" "}
                לחצו על חוק כדי לראות את שאר היוזמים. מקור: אתר הכנסת.
              </p>

              {/* רשימת ההצעות שהוביל */}
              {ledBills.length > 0 ? (
                <>
                  {ledBills.length > MAX_BILLS && (
                    <p className="mb-2 text-xs text-muted">
                      מוצגים {MAX_BILLS} מתוך {ledBills.length} שהוביל
                    </p>
                  )}
                  <ul className="space-y-2">
                    {shownLed.map((bill) => (
                      <BillRow key={bill.billId} bill={bill} memberId={memberId} />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="rounded-xl border border-border bg-card px-4 py-4 text-center text-sm text-muted">
                  אין הצעות חוק שהוביל כמציע ראשון לפי הסינון הנוכחי.
                </p>
              )}

              {/* יוזם עם אחרים — מכווץ */}
              {coInitBills.length > 0 && (
                <details className="group mt-3">
                  <summary className="cursor-pointer list-none text-sm text-blue-600 hover:underline">
                    <span className="group-open:hidden">
                      הצג {coInitBills.length} הצעות שהיה יוזם בהן (עם ח&quot;כים אחרים) ▾
                    </span>
                    <span className="hidden group-open:inline">הסתר ▴</span>
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {coInitBills.slice(0, MAX_BILLS).map((bill) => (
                      <BillRow key={bill.billId} bill={bill} memberId={memberId} />
                    ))}
                  </ul>
                  {coInitBills.length > MAX_BILLS && (
                    <p className="mt-2 text-xs text-muted">
                      מוצגים {MAX_BILLS} מתוך {coInitBills.length}
                    </p>
                  )}
                </details>
              )}

              {/* חתום בלבד — מכווץ */}
              {coSignBills.length > 0 && (
                <details className="group mt-3">
                  <summary className="cursor-pointer list-none text-sm text-blue-600 hover:underline">
                    <span className="group-open:hidden">
                      הצג {coSignBills.length} הצעות שחתם עליהן ▾
                    </span>
                    <span className="hidden group-open:inline">הסתר ▴</span>
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {coSignBills.slice(0, MAX_BILLS).map((bill) => (
                      <BillRow key={bill.billId} bill={bill} memberId={memberId} />
                    ))}
                  </ul>
                  {coSignBills.length > MAX_BILLS && (
                    <p className="mt-2 text-xs text-muted">
                      מוצגים {MAX_BILLS} מתוך {coSignBills.length}
                    </p>
                  )}
                </details>
              )}
            </>
          )}
        </details>
      </section>

      {/* הצבעות (מקובצות לפי חוק) — עם דפדוף */}
      <section className="mb-8" id="votes">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">הצבעות</h2>
          {groups.length > PER_PAGE_VOTES && (
            <span className="text-xs text-muted">
              עמוד {safePage} מתוך {votePages} · סה״כ {groups.length}
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-muted">
          על חוק מתקיימות לרוב כמה הצבעות באותו יום (קריאות והסתייגויות). הן
          מקובצות יחד — ההצבעה המוצגת היא הסופית, ואפשר להרחיב לראות את כולן.
        </p>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
            לא נמצאו הצבעות עבור ח"כ זה בנתונים שנשאבו עד כה.
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((group) => {
              const main = group.main;
              const isMulti = group.votes.length > 1;
              const protocolUrl = group.protocolUrl;
              return (
                <li
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-medium leading-snug">
                            {group.title}
                          </div>
                          <div className="mt-0.5 text-xs text-muted">
                            {main.dateStr} · {main.decision}
                            {main.accepted ? " — התקבל" : " — לא התקבל"}
                            {isMulti && (
                              <span className="mr-1 text-blue-600">
                                {" "}
                                · {group.votes.length} הצבעות בחוק זה
                              </span>
                            )}
                            <span className="mr-2 text-muted/70 group-open:hidden">
                              · לחצו לפרטים
                            </span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${choiceStyle[main.choice]}`}
                        >
                          {choiceLabel[main.choice]}
                        </span>
                      </div>
                      <VoteTallyBar vote={main} />
                    </summary>

                    {/* תוכן מורחב */}
                    <div className="border-t border-border bg-background/40 px-4 py-3 text-sm">
                      {group.summary && (
                        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-gray-700">
                          <div className="mb-1 font-semibold text-blue-800">
                            תקציר הצעת החוק
                          </div>
                          {group.summary}
                          <div className="mt-1.5 text-muted/70">מקור: אתר הכנסת</div>
                        </div>
                      )}

                      {isMulti && (
                        <div className="mt-3">
                          <div className="mb-1 text-xs font-semibold text-muted">
                            פירוט {group.votes.length} ההצבעות על חוק זה:
                          </div>
                          <p className="mb-2 text-xs text-muted/70">
                            על חוק מצביעים סעיף-סעיף ועל כל הסתייגות בנפרד. כאן
                            מסוכם כמה פעמים הצביע כך בכל שלב.
                          </p>
                          <ul className="space-y-1.5">
                            {group.breakdown.map((row) => (
                              <li
                                key={`${row.decision}-${row.choice}`}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                              >
                                <div className="flex-1 text-xs">
                                  <div className="font-medium">{row.decision}</div>
                                  <div className="mt-0.5 text-muted">
                                    {row.count === 1
                                      ? "הצבעה אחת"
                                      : `${row.count} הצבעות`}
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${choiceStyle[row.choice]}`}
                                >
                                  {choiceLabel[row.choice]}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* קישורים שימושיים */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {main.billId && (
                          <Link
                            href={`/law/${main.billId}`}
                            className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            ⚖ לדף החוק המלא ←
                          </Link>
                        )}
                        <a
                          href={voteUrl(main.voteId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          🔗 {isMulti
                            ? "ההצבעה הסופית — איך כל ח\"כ הצביע"
                            : "ההצבעה באתר הכנסת — איך כל ח\"כ הצביע"}{" "}
                          ←
                        </a>
                        {protocolUrl && (
                          <a
                            href={protocolUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            📄 פרוטוקול הישיבה המלא ←
                          </a>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {/* דפדוף בין עמודי ההצבעות */}
        {votePages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            {safePage > 1 ? (
              <button
                type="button"
                onClick={() => setVotePage(safePage - 1)}
                className="rounded-full border border-border px-4 py-1.5 text-muted hover:bg-card"
              >
                → הקודם
              </button>
            ) : (
              <span className="rounded-full border border-border px-4 py-1.5 opacity-40">
                → הקודם
              </span>
            )}
            <span className="text-muted">
              עמוד {safePage} / {votePages}
            </span>
            {safePage < votePages ? (
              <button
                type="button"
                onClick={() => setVotePage(safePage + 1)}
                className="rounded-full border border-border px-4 py-1.5 text-muted hover:bg-card"
              >
                הבא ←
              </button>
            ) : (
              <span className="rounded-full border border-border px-4 py-1.5 opacity-40">
                הבא ←
              </span>
            )}
          </div>
        )}
      </section>
    </>
  );
}
