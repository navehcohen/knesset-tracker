import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMember,
  getParty,
  getMemberVoteGroups,
  getMemberBills,
  getBillInitiators,
  getSessionProtocol,
  getBillFinalText,
  getPhoto,
  type VoteChoice,
  type MemberVote,
  type BillCategory,
  type MemberBill,
} from "../../data/knesset";

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

// קיצור לתצוגת התגית; הטקסט המלא (statusDesc) מוצג ממילא ליד הכותרת
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

// כפתורי בחירת טווח (קישורים — הסינון מתבצע בצד השרת לפי ?bills=)
function BillRangeTabs({ memberId, active }: { memberId: string; active: BillRangeKey }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {BILL_RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "all" ? `/member/${memberId}` : `/member/${memberId}?bills=${r.key}`}
          scroll={false}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            active === r.key
              ? "bg-blue-600 text-white"
              : "border border-border text-muted hover:bg-card"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

const MAX_BILLS = 40; // כמה חוקים להציג בכל רשימה לפני קיצור

// תפקיד הח"כ בחוק מסוים — לפי הנתון הרשמי (KNS_BillInitiator)
type BillRole = "first" | "initiator" | "cosigner";
// הכוכבית בתגית "מציע ראשון" תואמת ל-★ שליד שם המציע הראשון ברשימת היוזמים,
// כך שהמשתמש מבין לבד שכוכבית = מציע ראשון.
const roleInfo: Record<BillRole, { label: string; style: string }> = {
  first: { label: "★ מציע ראשון", style: "bg-indigo-100 text-indigo-800" },
  initiator: { label: "יוזם", style: "bg-sky-100 text-sky-800" },
  cosigner: { label: "חתום", style: "bg-gray-100 text-gray-600" },
};

// שורת חוק — מתרחבת להצגת שאר היוזמים (כל שם לחיץ) וקישור לאתר הכנסת
function BillRow({ bill, memberId }: { bill: MemberBill; memberId: string }) {
  const initiators = getBillInitiators(bill.billId);
  // המציע הראשון = היוזם הרשמי בעל ה-Ordinal הנמוך ביותר (הרשימה כבר ממוינת)
  const firstId = initiators.find((i) => i.isInitiator)?.memberId ?? null;
  const role: BillRole =
    memberId === firstId ? "first" : bill.isInitiator ? "initiator" : "cosigner";
  const others = initiators.filter((i) => i.memberId !== memberId);
  // נוסח החוק הסופי — קיים רק לחוקים שעברו (פורסמו ברשומות)
  const finalText = bill.category === "passed" ? getBillFinalText(bill.billId) : null;

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

function initials(name: string): string {
  const parts = name.replace(/['"]/g, "").split(" ");
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

function voteUrl(voteId: number): string {
  return `https://main.knesset.gov.il/Activity/plenum/Votes/Pages/vote.aspx?voteId=${voteId}`;
}

// מד בעד/נגד/נמנע לפי תוצאות ההצבעה
function TallyBar({ vote }: { vote: MemberVote }) {
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

const MAX_SHOWN = 150; // כמה חוקים/נושאים להציג בעמוד

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bills?: string }>;
}) {
  const { id } = await params;
  const { bills: billsParam } = await searchParams;
  const member = getMember(id);
  if (!member) notFound();

  const party = getParty(member.partyId)!;
  const groups = getMemberVoteGroups(id);
  const photo = getPhoto(id);

  // חוקים: מבחינים בין מה שהח"כ הוביל בפועל (מציע ראשון) לבין יוזם-עם-אחרים וחתום.
  // "הוביל" = יוזם רשמי שהוא גם המציע הראשון (Ordinal 1) — המספר הכן והמשמעותי.
  const allBills = getMemberBills(id);
  const isLead = (b: MemberBill) => b.isInitiator && b.ordinal === 1;

  // סינון לפי טווח זמן שנבחר (ברירת מחדל: הכול)
  const range: BillRangeKey = BILL_RANGES.some((r) => r.key === billsParam)
    ? (billsParam as BillRangeKey)
    : "all";
  const cutoff = billRangeCutoff(range);
  const inRange = (b: { lastUpdated: string }) =>
    !cutoff || (b.lastUpdated ? new Date(b.lastUpdated) >= cutoff : false);

  // שלוש קבוצות לפי התפקיד הרשמי בחוק, בתוך הטווח שנבחר
  const ledBills = allBills.filter((b) => isLead(b) && inRange(b)); // מציע ראשון
  const coInitBills = allBills.filter((b) => b.isInitiator && !isLead(b) && inRange(b)); // יוזם עם אחרים
  const coSignBills = allBills.filter((b) => !b.isInitiator && inRange(b)); // חתום בלבד
  const passedLed = ledBills.filter((b) => b.category === "passed").length;
  const ledAllTime = allBills.filter(isLead).length; // בכל הקדנציה (להשוואה כשיש טווח)
  const shownLed = ledBills.slice(0, MAX_BILLS);

  // הסטטיסטיקה לפי ההצבעה המייצגת של כל חוק (הקריאה הסופית), לא לפי הסתייגויות
  const forCount = groups.filter((g) => g.main.choice === "for").length;
  const againstCount = groups.filter((g) => g.main.choice === "against").length;
  const abstainCount = groups.filter((g) => g.main.choice === "abstain").length;

  const shown = groups.slice(0, MAX_SHOWN);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href={`/party/${party.id}`}
        className="text-sm text-muted hover:underline"
      >
        ← חזרה ל{party.name}
      </Link>

      {/* כותרת הפרופיל */}
      <header className="mb-8 mt-4 flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={member.name}
            className={`h-20 w-20 rounded-full object-cover ${
              member.status === "former" ? "grayscale" : ""
            }`}
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{
              backgroundColor:
                member.status === "former" ? "#9ca3af" : party.color,
            }}
          >
            {initials(member.name)}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{member.name}</h1>
          <p className="mt-1 text-muted">{party.name}</p>
          {member.roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                >
                  {role}
                </span>
              ))}
            </div>
          )}
          {member.status === "former" && (
            <span className="mt-2 inline-block rounded-full bg-gray-200 px-3 py-0.5 text-xs text-gray-700">
              פרש מהכנסת{member.endDate ? ` · ${member.endDate}` : ""}
            </span>
          )}
        </div>
      </header>

      {/* כרטיסי סיכום */}
      <section className="mb-8 grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-card p-4 text-center">
          <div className="text-2xl font-bold">{groups.length}</div>
          <div className="text-xs text-muted">חוקים ונושאים</div>
        </div>
        <div className="rounded-xl bg-card p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{forCount}</div>
          <div className="text-xs text-muted">בעד</div>
        </div>
        <div className="rounded-xl bg-card p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{againstCount}</div>
          <div className="text-xs text-muted">נגד</div>
        </div>
        <div className="rounded-xl bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{abstainCount}</div>
          <div className="text-xs text-muted">נמנע</div>
        </div>
      </section>

      {/* חוקים שקידם — מוצג מעל ההצבעות */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">חוקים שקידם</h2>

        {allBills.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
            לא נמצאו הצעות חוק שח&quot;כ זה יזם או חתם עליהן בכנסת ה-25.
          </p>
        ) : (
          <>
            {/* בחירת טווח זמן (לפי תאריך עדכון אחרון של החוק) */}
            <BillRangeTabs memberId={id} active={range} />

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
                    <BillRow key={bill.billId} bill={bill} memberId={id} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="rounded-xl border border-border bg-card px-4 py-4 text-center text-sm text-muted">
                לא הוביל הצעות חוק כמציע ראשון בטווח הזה.
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
                    <BillRow key={bill.billId} bill={bill} memberId={id} />
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
                    <BillRow key={bill.billId} bill={bill} memberId={id} />
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
      </section>

      {/* הצבעות אחרונות (מקובצות לפי חוק) */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">הצבעות אחרונות</h2>
          {groups.length > MAX_SHOWN && (
            <span className="text-xs text-muted">
              מוצגים {MAX_SHOWN} מתוך {groups.length}
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
              const protocolUrl = getSessionProtocol(main.session);
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
                      <TallyBar vote={main} />
                    </summary>

                    {/* תוכן מורחב */}
                    <div className="border-t border-border bg-background/40 px-4 py-3 text-sm">
                      <div className="font-medium">{group.title}</div>

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

                      {/* קישורים שימושיים — בתחתית ההרחבה בלבד */}
                      <div className="mt-3 flex flex-wrap gap-2">
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
      </section>

    </main>
  );
}
