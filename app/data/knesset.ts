// שכבת הנתונים של האתר.
// המפלגות, חברי הכנסת, ההצבעות והחוקים נשאבים אוטומטית מה-API של הכנסת
// (ראו scripts/fetch-knesset.mjs, fetch-votes.mjs, fetch-bill-summaries.mjs,
// fetch-bills.mjs).

import partiesData from "./parties.json";
import membersData from "./members.json";
import votesData from "./votes.json";
import memberVotesData from "./member-votes.json";
import photosData from "./photos.json";
import photosLocalData from "./photos-local.json";
import mkOfficialData from "./mk-official.json";
import committeesData from "./committees.json";
import biosData from "./bios.json";
import memberBillsData from "./member-bills.json";
import partyLogosData from "./party-logos.json";
import sessionProtocolsData from "./session-protocols.json";
import billDocsData from "./bill-docs.json";
import billExplanationsData from "./bill-explanations.json";
import billExplanationsMissingData from "./bill-explanations-missing.json";
import committeeLinksData from "./committee-links.json";

export type Party = {
  id: string;
  name: string;
  seats: number;
  color: string;
};

export type MemberStatus = "current" | "former";

export type Member = {
  id: string;
  personId: number;
  name: string;
  partyId: string;
  status: MemberStatus;
  endDate: string | null; // תאריך פרישה (רק למי שעזב)
  roles: string[]; // תפקידים נוכחיים (שר, יו"ר וכו')
};

export const parties: Party[] = partiesData;
export const members: Member[] = membersData as Member[];

// --- הצבעות אמיתיות מהכנסת ה-25 ---
// נשאבות מ-API אתר הכנסת (ראו scripts/fetch-votes.mjs).

export type VoteChoice = "for" | "against" | "abstain" | "other";

// הצבעה במליאה (משותפת לכל הח"כים)
export type Vote = {
  voteId: number;
  title: string;
  date: string;
  dateStr: string;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
  accepted: boolean;
  decision: string;
  summary: string | null; // תקציר רשמי מ-KNS_Bill (אם קיים)
  billId: number | null;  // מזהה הצעת החוק ב-OData
  session: number | null; // מספר ישיבת המליאה (לקישור לפרוטוקול)
};

// הצבעה אישית של ח"כ מסוים, מחוברת לפרטי ההצבעה
export type MemberVote = Vote & { choice: VoteChoice };

export const votes: Vote[] = votesData;

// מיפוי מהיר מ-voteId לפרטי ההצבעה
const voteById = new Map<number, Vote>(votes.map((v) => [v.voteId, v]));

// member-votes.json: personId -> [{ voteId, choice }]
const memberVotes: Record<string, { voteId: number; choice: string }[]> =
  memberVotesData;

// --- חוקים שכל ח"כ קידם (אמיתיים מ-OData) ---
// נשאבים ב-scripts/fetch-bills.mjs מטבלת KNS_BillInitiator (לפי PersonID),
// בהצטלבות עם הצעות החוק של הכנסת ה-25 (KNS_Bill).

// הסטטוס מתומצת לשלוש קטגוריות לתצוגה:
// passed = התקבל בקריאה שלישית · stopped = הוסר/נדחה/הוקפא · in_progress = בהליך
export type BillCategory = "passed" | "in_progress" | "stopped";

export type MemberBill = {
  billId: number;
  name: string;
  statusId: number;
  statusDesc: string; // הטקסט הרשמי בעברית (KNS_Status)
  category: BillCategory;
  subType: string; // פרטית / ממשלתית / ועדה וכו'
  isInitiator: boolean; // יוזם רשמי (true) או חתום/תומך (false)
  ordinal: number | null; // מקומו ברשימת היוזמים (1 = מציע ראשון)
  lastUpdated: string;
};

// member-bills.json: personId -> [MemberBill] (כבר ממוין: עבר→בהליך→נעצר, ואז לפי עדכון אחרון)
const memberBills: Record<string, MemberBill[]> =
  memberBillsData as Record<string, MemberBill[]>;

// כל החוקים שח"כ מסוים קידם
export function getMemberBills(memberId: string): MemberBill[] {
  return memberBills[memberId] || [];
}

// מיפוי מהיר מ-id לח"כ
const memberById = new Map<string, Member>(members.map((m) => [m.id, m]));

// --- אינדקס הפוך: לכל הצעת חוק, מי הח"כים שיזמו/חתמו עליה ---
// נבנה מהיפוך member-bills.json — נתון אמיתי מ-KNS_BillInitiator, ללא פניות נוספות.
export type BillInitiator = {
  memberId: string;
  name: string;
  partyId: string;
  status: MemberStatus;
  isInitiator: boolean; // יוזם רשמי
  ordinal: number | null; // 1 = מציע ראשון
};

const billInitiators = new Map<number, BillInitiator[]>();
for (const [memberId, bills] of Object.entries(memberBills)) {
  const m = memberById.get(memberId);
  for (const b of bills) {
    const arr = billInitiators.get(b.billId) ?? [];
    arr.push({
      memberId,
      name: m?.name ?? memberId,
      partyId: m?.partyId ?? "",
      status: m?.status ?? "current",
      isInitiator: b.isInitiator,
      ordinal: b.ordinal,
    });
    billInitiators.set(b.billId, arr);
  }
}
// בכל חוק: היוזמים הרשמיים קודם (לפי הסדר ord), ואז שאר החתומים
for (const arr of billInitiators.values()) {
  arr.sort((a, b) => {
    if (a.isInitiator !== b.isInitiator) return a.isInitiator ? -1 : 1;
    return (a.ordinal ?? 999) - (b.ordinal ?? 999);
  });
}

// כל היוזמים/החתומים על הצעת חוק נתונה (ממוינים: מציע ראשון → שאר היוזמים → חתומים)
export function getBillInitiators(billId: number): BillInitiator[] {
  return billInitiators.get(billId) ?? [];
}

// --- חוק בודד (לדף החוק העצמאי /law/[id]) ---
// פרטי החוק זהים בכל הופעה אצל הח"כים השונים, לכן בונים אינדקס מ-member-bills:
// לכל billId שומרים את פרטי החוק (שם, סטטוס, סוג) פעם אחת — בלי כפילות בזיכרון.
export type Bill = {
  billId: number;
  name: string;
  statusId: number;
  statusDesc: string;
  category: BillCategory;
  subType: string;
  lastUpdated: string;
};

const billsById = new Map<number, Bill>();
for (const bills of Object.values(memberBills)) {
  for (const b of bills) {
    if (!billsById.has(b.billId)) {
      billsById.set(b.billId, {
        billId: b.billId,
        name: b.name,
        statusId: b.statusId,
        statusDesc: b.statusDesc,
        category: b.category,
        subType: b.subType,
        lastUpdated: b.lastUpdated || "",
      });
    }
  }
}

// כל החוקים בקטגוריה נתונה (עברו/בהליך/נעצרו), מהמעודכן לישן — לדף עיון החוקים
export function getBillsByCategory(category: BillCategory): Bill[] {
  return [...billsById.values()]
    .filter((b) => b.category === category)
    .sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
}

// פרטי הצעת חוק לפי מזהה (undefined אם לא קיים בנתונים)
export function getBill(billId: number): Bill | undefined {
  return billsById.get(billId);
}

// כל מזהי החוקים — לבניית דפים סטטיים מראש (generateStaticParams)
export function getAllBillIds(): number[] {
  return [...billsById.keys()];
}

// כל השנים שיש בהן פעילות חוקים (לפי lastUpdated), מהחדשה לישנה — לסינון בדף העיון
export function getBillYears(): string[] {
  const years = new Set<string>();
  for (const b of billsById.values()) {
    const y = (b.lastUpdated || "").slice(0, 4);
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

// --- חיפוש חופשי בח"כים ובהצעות חוק/חוקים ---
// מנרמל טקסט להשוואה: מסיר ניקוד, גרשיים ופיסוק, מאחד רווחים.
function normalizeSearch(s: string): string {
  return (s || "")
    .replace(/[֑-ׇ]/g, "") // ניקוד עברי
    .replace(/["'`׳״]/g, "") // גרשיים
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// אינדקסי חיפוש — נבנים פעם אחת בטעינת המודול (השם המנורמל לכל פריט)
const memberSearchIndex = members.map((m) => ({ m, norm: normalizeSearch(m.name) }));
const billSearchIndex = [...billsById.values()].map((b) => ({
  b,
  norm: normalizeSearch(b.name),
}));
const billCategoryOrder: Record<BillCategory, number> = {
  passed: 0,
  in_progress: 1,
  stopped: 2,
};

// אינדקס הצבעות עצמאיות (בלי billId) — אי-אמון, בקשות חסינות, הצעות לסדר.
// אלו לא "הצעות חוק", אז לא באינדקס החוקים — מוסיפים אותן בנפרד לחיפוש.
// מנכים כפילויות לפי כותרת (שומרים הצבעה אחת מייצגת לכל כותרת).
const standaloneVoteSearchIndex = (() => {
  const seen = new Set<string>();
  const out: { vote: Vote; norm: string }[] = [];
  for (const v of votes) {
    if (v.billId || seen.has(v.title)) continue;
    seen.add(v.title);
    out.push({ vote: v, norm: normalizeSearch(v.title) });
  }
  return out;
})();

export type SearchResults = {
  members: Member[];
  bills: Bill[];
  votes: Vote[];
  // הסך-הכול שנמצא לפני חיתוך לתקרה — לשקיפות ("מוצגות 60 מתוך N")
  memberTotal: number;
  billTotal: number;
  voteTotal: number;
};

// חיפוש: מחזיר ח"כים, הצעות-חוק והצבעות עצמאיות שכותרתם מכילה את כל מילות החיפוש.
export function searchAll(query: string, limit = 60): SearchResults {
  const q = normalizeSearch(query);
  if (!q)
    return { members: [], bills: [], votes: [], memberTotal: 0, billTotal: 0, voteTotal: 0 };
  const tokens = q.split(" ").filter(Boolean);
  const match = (norm: string) => tokens.every((t) => norm.includes(t));

  // ח"כים — כבר ממוינים (נוכחיים קודם, לפי שם)
  const allMembers = memberSearchIndex.filter((x) => match(x.norm)).map((x) => x.m);

  // הצעות חוק — מיון: שעברו קודם, ובכל קבוצה לפי שם
  const allBills = billSearchIndex
    .filter((x) => match(x.norm))
    .map((x) => x.b)
    .sort((a, b) => {
      const c = billCategoryOrder[a.category] - billCategoryOrder[b.category];
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, "he");
    });

  // הצבעות עצמאיות — מהחדש לישן
  const allVotes = standaloneVoteSearchIndex
    .filter((x) => match(x.norm))
    .map((x) => x.vote)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    members: allMembers.slice(0, limit),
    bills: allBills.slice(0, limit),
    votes: allVotes.slice(0, limit),
    memberTotal: allMembers.length,
    billTotal: allBills.length,
    voteTotal: allVotes.length,
  };
}

// כל ההצבעות במליאה על הצעת חוק נתונה (לפי שדה billId שב-votes), מהחדש לישן.
// הערה: לא לכל חוק יש הצבעות מקושרות — רק לחלק מה-votes חובר billId.
export function getBillVotes(billId: number): Vote[] {
  return votes
    .filter((v) => v.billId === billId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ההצבעה המרכזית של חוק — הקריאה הסופית ביותר (לתצוגת סרגל ברשימת החוקים).
// null אם אין לחוק הצבעות מקושרות בנתונים (רק חלק מהחוקים).
export function getBillMainVote(billId: number): Vote | null {
  const vs = getBillVotes(billId);
  if (!vs.length) return null;
  return [...vs].sort(compareByReading)[0];
}

// הצבעה בודדת לפי מזהה (לדף ההצבעה /vote/[id])
export function getVote(voteId: number): Vote | null {
  return voteById.get(voteId) ?? null;
}

// --- אינדקס הפוך: לכל הצבעה, מי הצביע ואיך (נבנה מ-member-votes, נתון מקומי) ---
export type VoteMemberChoice = {
  memberId: string;
  name: string;
  partyId: string;
  choice: VoteChoice;
};
const voteMemberChoices = new Map<number, VoteMemberChoice[]>();
for (const [memberId, mvs] of Object.entries(memberVotes)) {
  const m = memberById.get(memberId);
  if (!m) continue;
  for (const mv of mvs) {
    const arr = voteMemberChoices.get(mv.voteId) ?? [];
    arr.push({ memberId, name: m.name, partyId: m.partyId, choice: mv.choice as VoteChoice });
    voteMemberChoices.set(mv.voteId, arr);
  }
}

// איך כל ח"כ הצביע בהצבעה נתונה, מקובץ לפי בחירה (בעד/נגד/נמנע)
export function getVoteMemberChoices(voteId: number): Record<VoteChoice, VoteMemberChoice[]> {
  const out: Record<VoteChoice, VoteMemberChoice[]> = {
    for: [],
    against: [],
    abstain: [],
    other: [],
  };
  for (const c of voteMemberChoices.get(voteId) ?? []) out[c.choice].push(c);
  for (const k of Object.keys(out) as VoteChoice[])
    out[k].sort((a, b) => a.name.localeCompare(b.name, "he"));
  return out;
}

// פונקציות עזר לשליפת נתונים
export function getParty(id: string): Party | undefined {
  return parties.find((p) => p.id === id);
}

const partyLogos: Record<string, string> = partyLogosData;
export function getPartyLogo(partyId: string): string | null {
  return partyLogos[partyId] ?? null;
}

export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

// קישור לפרוטוקול המלא של ישיבת מליאה (דברי הכנסת/סטנוגרמה), לפי מספר ישיבה
const sessionProtocols: Record<string, string> = sessionProtocolsData;
export function getSessionProtocol(session: number | null): string | null {
  if (session == null) return null;
  return sessionProtocols[String(session)] ?? null;
}

// קישור לנוסח החוק הסופי (פרסום ברשומות) לחוק שעבר, לפי billId
type BillDoc = { url: string; official: boolean };
const billDocs: Record<string, BillDoc> = billDocsData;
export function getBillFinalText(billId: number): BillDoc | null {
  return billDocs[String(billId)] ?? null;
}

// דברי הסבר — חולצו ממסמך "הצעת חוק לקריאה הראשונה" הרשמי (ראו fetch-bill-explanations.mjs).
// text=הטקסט · source=סוג המסמך · date=תאריך · url=קישור ל-PDF המלא (להגעה למקור).
export type BillExplanation = {
  text: string;
  source: string;
  date: string;
  url: string;
};
const billExplanations: Record<string, BillExplanation> = billExplanationsData;
export function getBillExplanation(billId: number): BillExplanation | null {
  return billExplanations[String(billId)] ?? null;
}

// כשאין דברי הסבר — *הסיבה*, כדי להציג באתר הודעה ממוקדת (ראו fetch-bill-explanations.mjs).
//   no_doc  = לא נמצא מסמך הצעת חוק לקריאה ראשונה באתר הכנסת.
//   no_text = נמצא מסמך, אך לא אותרו בו דברי הסבר (url = קישור למסמך לקריאה ידנית).
export type BillExplanationMissing =
  | { reason: "no_doc" }
  | { reason: "no_text"; url: string };
const billExplanationsMissing: Record<string, BillExplanationMissing> =
  billExplanationsMissingData as Record<string, BillExplanationMissing>;
export function getBillExplanationMissing(billId: number): BillExplanationMissing | null {
  return billExplanationsMissing[String(billId)] ?? null;
}

// --- נתונים רשמיים על ח"כים נוכחיים (מה-API הרשמי MkLobby, ראו fetch-mk-official.mjs) ---
// פרטים בסיסיים אחידים שקיימים לכל 120 הנוכחיים. אפס תלות בויקיפדיה לנוכחיים.
export type MkOfficial = {
  faction: string;
  birthYear: number | null;
  email: string | null;
  photo: string | null; // תמונה רשמית מקומית (/mk-photos/official_...)
};
const mkOfficial: Record<string, MkOfficial> = mkOfficialData as Record<string, MkOfficial>;
export function getMkOfficial(memberId: string): MkOfficial | null {
  return mkOfficial[memberId] ?? null;
}

// --- ועדות שהח"כ חבר בהן (נוכחי, מ-KNS_PersonToPosition, ראו fetch-committees.mjs) ---
export type Committee = { committee: string; role: string; isChair: boolean };
const committees: Record<string, Committee[]> = committeesData as Record<string, Committee[]>;
export function getMemberCommittees(memberId: string): Committee[] {
  return committees[memberId] ?? [];
}

// קישור לדף הוועדה באתר הכנסת (אפליקציית הוועדות החדשה), לפי שם הוועדה.
// המיפוי שם→מזהה נשמר ב-committee-links.json (נאסף מדף הלובי הרשמי).
// מחזיר null לוועדות שאין להן מיפוי (ועדות משותפות/חריגות) — אז לא יוצג קישור.
const committeeLinks: Record<string, number> = committeeLinksData;
export function getCommitteeUrl(name: string): string | null {
  const id = committeeLinks[name];
  return id ? `https://main.knesset.gov.il/apps/committees/${id}` : null;
}

// כתובת תמונת ח"כ. עדיפות: תמונה רשמית של הכנסת (נוכחיים) → תמונה מקומית מויקיפדיה
// (פרשו) → כתובת ויקיפדיה כגיבוי אחרון.
const photos: Record<string, string> = photosData;
const photosLocal: Record<string, string> = photosLocalData;
export function getPhoto(memberId: string): string | null {
  return mkOfficial[memberId]?.photo || photosLocal[memberId] || photos[memberId] || null;
}

// ביוגרפיה מוויקיפדיה (פתיח הערך), ללא ניקוד
const bios: Record<string, string> = biosData;
export function getBio(memberId: string): string | null {
  const text = bios[memberId];
  if (!text) return null;
  // הסרת ניקוד עברי לקריאות
  return text.replace(/[֑-ׇ]/g, "");
}

export function getPartyMembers(partyId: string): Member[] {
  return members
    .filter((m) => m.partyId === partyId)
    .sort((a, b) => {
      // נוכחיים קודם, אחר כך מי שפרש, ובכל קבוצה לפי שם
      if (a.status !== b.status) return a.status === "current" ? -1 : 1;
      return a.name.localeCompare(b.name, "he");
    });
}

// כל ההצבעות של ח"כ מסוים, עם פרטי ההצבעה המלאים, מהחדש לישן
export function getMemberVotes(memberId: string): MemberVote[] {
  const list = memberVotes[memberId] || [];
  return list
    .map((mv) => {
      const vote = voteById.get(mv.voteId);
      if (!vote) return null;
      return { ...vote, choice: mv.choice as VoteChoice };
    })
    .filter((v): v is MemberVote => v !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// --- קיבוץ הצבעות לפי הצעת חוק ---
// על חוק אחד מצביעים פעמים רבות באותו יום: קריאה שנייה, קריאה שלישית,
// ועשרות דחיות של הסתייגויות. כדי לא להציף את הרשימה בשורות זהות,
// מקבצים את כל ההצבעות על אותו חוק (אותה כותרת באותו יום) לקבוצה אחת.

// שורת סיכום בתוך קבוצה: כמה פעמים הצביע הח"כ אותה הצבעה על אותו סוג החלטה.
// (אי אפשר לדעת על איזה סעיף/הסתייגות בדיוק — המידע הזה לא קיים ב-API,
//  רק בפרוטוקול המליאה כטקסט חופשי. לכן מסכמים לפי החלטה + בחירה.)
export type VoteBreakdownRow = {
  decision: string; // "לקבל בקריאה שלישית", "לדחות את ההצעה" וכו'
  choice: VoteChoice; // איך הח"כ הצביע
  count: number; // כמה הצבעות כאלה
  sampleVoteId: number; // הצבעה אחת לדוגמה (לקישור לאתר הכנסת)
};

export type MemberVoteGroup = {
  key: string;
  title: string;
  date: string;
  dateStr: string;
  summary: string | null;
  main: MemberVote; // ההצבעה המייצגת — הקריאה הסופית ביותר
  votes: MemberVote[]; // כל ההצבעות בקבוצה, מהשלב המתקדם לראשוני
  breakdown: VoteBreakdownRow[]; // סיכום מכווץ לפי החלטה + בחירה
};

// דירוג שלב הקריאה — כדי לבחור את ההצבעה המייצגת (הסופית ביותר)
function readingRank(decision: string): number {
  if (decision.includes("שלישית")) return 4;
  if (decision.includes("שנייה") || decision.includes("שניה")) return 3;
  if (decision.includes("ראשונה")) return 2;
  if (decision.includes("טרומית") || decision.includes("מוקדמת")) return 1;
  return 0; // הסתייגויות ("לדחות את ההצעה") וכל השאר
}

function compareByReading(a: Vote, b: Vote): number {
  const r = readingRank(b.decision) - readingRank(a.decision);
  if (r !== 0) return r;
  return b.date.localeCompare(a.date);
}

// מכווץ רשימת הצבעות לשורות סיכום לפי (החלטה + בחירה).
// 35 הצבעות זהות הופכות ל-2–3 שורות: "לקבל בקריאה שנייה — בעד · 12" וכו'.
function buildBreakdown(votes: MemberVote[]): VoteBreakdownRow[] {
  const map = new Map<string, VoteBreakdownRow>();
  for (const v of votes) {
    const k = `${v.decision}__${v.choice}`;
    const row = map.get(k);
    if (row) row.count++;
    else
      map.set(k, {
        decision: v.decision,
        choice: v.choice,
        count: 1,
        sampleVoteId: v.voteId,
      });
  }
  // קריאה מתקדמת קודם (שלישית→שנייה→הסתייגויות), ובשוויון — הרבות יותר קודם
  return [...map.values()].sort((a, b) => {
    const r = readingRank(b.decision) - readingRank(a.decision);
    if (r !== 0) return r;
    return b.count - a.count;
  });
}

export function getMemberVoteGroups(memberId: string): MemberVoteGroup[] {
  const all = getMemberVotes(memberId);
  const groups = new Map<string, MemberVote[]>();
  for (const v of all) {
    const key = `${v.title}__${v.dateStr}`;
    const arr = groups.get(key);
    if (arr) arr.push(v);
    else groups.set(key, [v]);
  }

  const result: MemberVoteGroup[] = [];
  for (const [key, votes] of groups) {
    const sorted = [...votes].sort(compareByReading);
    const main = sorted[0];
    const summary = votes.find((v) => v.summary)?.summary ?? null;
    result.push({
      key,
      title: main.title,
      date: main.date,
      dateStr: main.dateStr,
      summary,
      main,
      votes: sorted,
      breakdown: buildBreakdown(sorted),
    });
  }
  // לפי תאריך ההצבעה המייצגת, מהחדש לישן
  return result.sort((a, b) => b.date.localeCompare(a.date));
}
