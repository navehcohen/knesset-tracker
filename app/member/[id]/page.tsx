import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import MemberAvatar from "../../components/MemberAvatar";
import MemberSections, {
  type EnrichedBill,
  type EnrichedGroup,
} from "./MemberSections";
import {
  members,
  getMember,
  getParty,
  getMemberVoteGroups,
  getMemberBills,
  getBillInitiators,
  getSessionProtocol,
  getBillFinalText,
  getMkOfficial,
  getMemberCommittees,
  getCommitteeUrl,
} from "../../data/knesset";

// בניית דף סטטי מראש לכל חבר כנסת. הסינון/דפדוף עברו לצד-הלקוח (MemberSections),
// ולכן הדף כבר אינו תלוי בפרמטרי URL וניתן לבנייה מראש כ-HTML.
export const dynamicParams = false;
export function generateStaticParams() {
  return members.map((m) => ({ id: String(m.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = getMember(id);
  if (!member) return { title: "חבר כנסת — מעקב כנסת" };
  const party = getParty(member.partyId);
  return {
    title: `${member.name} — מעקב כנסת`,
    description: `הצבעות, חוקים ופרטים על ${member.name}${party ? ` (${party.name})` : ""} בכנסת ה-25.`,
  };
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = getMember(id);
  if (!member) notFound();

  const party = getParty(member.partyId)!;
  const groups = getMemberVoteGroups(id);
  // פרטים רשמיים בסיסיים (לנוכחיים) — שנת לידה + מייל
  const official = getMkOfficial(id);
  const committees = getMemberCommittees(id);

  // העשרת הנתונים בשרת (פעם אחת בזמן הבנייה) — היוזמים, נוסח סופי וקישור לפרוטוקול —
  // כדי שרכיב הלקוח יקבל הכול מוכן ולא יזדקק לשכבת הנתונים.
  const allBills = getMemberBills(id);
  const enrichedBills: EnrichedBill[] = allBills.map((b) => ({
    ...b,
    initiators: getBillInitiators(b.billId),
    finalText: b.category === "passed" ? getBillFinalText(b.billId) : null,
  }));
  const enrichedGroups: EnrichedGroup[] = groups.map((g) => ({
    ...g,
    protocolUrl: getSessionProtocol(g.main.session),
  }));

  // הסטטיסטיקה לפי ההצבעה המייצגת של כל חוק (הקריאה הסופית), לא לפי הסתייגויות
  const forCount = groups.filter((g) => g.main.choice === "for").length;
  const againstCount = groups.filter((g) => g.main.choice === "against").length;
  const abstainCount = groups.filter((g) => g.main.choice === "abstain").length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <BackButton fallback={`/party/${party.id}`} />

      {/* כותרת הפרופיל */}
      <header className="mb-6 mt-4 flex items-center gap-4 sm:mb-8">
        <MemberAvatar
          member={member}
          className="h-16 w-16 sm:h-20 sm:w-20"
          textClassName="text-xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{member.name}</h1>
          <p className="mt-1 text-muted">{party.name}</p>
          {/* פרטים רשמיים בסיסיים (מהכנסת) — שנת לידה + מייל רשמי */}
          {official && (official.birthYear || official.email) && (
            <p className="mt-1 text-xs text-muted">
              {official.birthYear ? <span>שנת לידה: {official.birthYear}</span> : null}
              {official.birthYear && official.email ? <span> · </span> : null}
              {official.email ? (
                <a
                  href={`mailto:${official.email}`}
                  className="text-blue-700 hover:underline"
                >
                  ✉ {official.email}
                </a>
              ) : null}
            </p>
          )}
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
      {groups.length > 0 && (
        <p className="-mt-6 mb-8 text-center text-xs text-muted">
          המספרים מבוססים על {groups.length} ההצבעות שנשאבו עד כה לח״כ זה — ייתכן
          שאינם מכסים את כלל הצבעותיו בקדנציה.
        </p>
      )}

      {/* ועדות שהח"כ חבר בהן — מכווץ מאחורי חץ (הרשימה ארוכה) */}
      {committees.length > 0 && (
        <section className="mb-8">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <h2 className="text-xl font-bold">ועדות ({committees.length})</h2>
              <span className="text-sm text-blue-600 group-open:hidden">הצג ▾</span>
              <span className="hidden text-sm text-blue-600 group-open:inline">הסתר ▴</span>
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {committees.map((c) => {
                const url = getCommitteeUrl(c.committee);
                const label = (
                  <>
                    {c.committee}
                    {c.isChair ? ' · יו"ר' : ""}
                  </>
                );
                return url ? (
                  <a
                    key={c.committee}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-border px-3 py-1 text-xs text-blue-700 transition hover:bg-blue-50"
                  >
                    {label} <span aria-hidden>↗</span>
                  </a>
                ) : (
                  <span
                    key={c.committee}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted/70">
              מקור: אתר הכנסת. ועדות עם קישור (↗) מובילות לדף הוועדה באתר הכנסת.
            </p>
          </details>
        </section>
      )}

      {/* חוקים שקידם + הצבעות — סינון ודפדוף בצד-הלקוח */}
      <MemberSections memberId={id} bills={enrichedBills} groups={enrichedGroups} />
    </main>
  );
}
