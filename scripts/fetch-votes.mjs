// סקריפט לשאיבת הצבעות אמיתיות של הכנסת ה-25 מה-API החי של אתר הכנסת.
// הרצה: node scripts/fetch-votes.mjs
// התוצאה: app/data/votes.json (רשימת ההצבעות) + app/data/member-votes.json (איך כל ח"כ הצביע)
//
// הערה: ה-API הרשמי (OData) קפוא ב-2021. זה ה-API הלא-מתועד של אתר הכנסת,
// שמזין את עמודי ההצבעות באתר. הוא עלול להשתנות בעתיד.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
const RECENT_LIMIT = 500; // כמה הצבעות אחרונות לשאוב (אפשר להגדיל בעתיד)

// כינויים נפוצים: שם באתר ההצבעות -> שם רשמי אצלנו
const FIRST_NAME_ALIASES = {
  בני: "בנימין",
};
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Referer: "https://main.knesset.gov.il/Activity/plenum/Votes/Pages/default.aspx",
  "User-Agent": "Mozilla/5.0",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

// ממיר טקסט הצבעה בעברית לקוד אחיד
function choiceFromTitle(title) {
  const t = (title || "").trim();
  if (t === "בעד") return "for";
  if (t === "נגד") return "against";
  if (t === "נמנע") return "abstain";
  return "other";
}

// מפרק שם למילים מנורמלות (ללא גרשיים, עם החלפת כינויים)
function tokens(name) {
  return (name || "")
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((t) => FIRST_NAME_ALIASES[t] || t);
}

// מפתח מדויק: מילים ממוינות. "ינון אזולאי" = "אזולאי ינון"
function nameKey(name) {
  return [...new Set(tokens(name))].sort().join(" ");
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  // טוענים את רשימת הח"כים כדי לשייך הצבעות לפי שם
  const members = JSON.parse(
    await readFile(join(DATA_DIR, "members.json"), "utf8")
  );
  // התאמה מדויקת לפי מפתח מילים ממוין
  const memberByName = new Map();
  // קבוצות מילים לכל ח"כ — לצורך התאמת תת-קבוצה (שמות אמצעיים)
  const memberTokenSets = members.map((m) => ({
    id: m.id,
    set: new Set(tokens(m.name)),
  }));
  for (const m of members) memberByName.set(nameKey(m.name), m.id);

  // מנסה להתאים שם הצבעה לח"כ: קודם מדויק, אחר כך תת-קבוצה (חד-משמעית בלבד)
  function matchMember(voteName) {
    const exact = memberByName.get(nameKey(voteName));
    if (exact) return exact;
    const vset = new Set(tokens(voteName));
    if (vset.size < 2) return null;
    let found = null;
    let count = 0;
    for (const mt of memberTokenSets) {
      const [small, big] =
        vset.size <= mt.set.size ? [vset, mt.set] : [mt.set, vset];
      if (small.size >= 2 && [...small].every((x) => big.has(x))) {
        found = mt.id;
        count++;
      }
    }
    return count === 1 ? found : null;
  }

  console.log("שואב את רשימת ההצבעות של הכנסת ה-25...");
  const headersData = await fetchJson(
    "https://knesset.gov.il/WebSiteApi/knessetapi/Votes/GetVotesHeaders",
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        KnessetNum: KNESSET_NUM,
        FromDate: "2022-11-15",
        ToDate: "2026-12-31",
      }),
    }
  );

  const allVotes = headersData.Table || [];
  console.log(`נמצאו ${allVotes.length} הצבעות. שואב פרטים על ${RECENT_LIMIT} האחרונות...`);

  // ה-API מחזיר מהחדש לישן — לוקחים את הראשונות
  const recent = allVotes.slice(0, RECENT_LIMIT);

  const votes = [];
  const memberVotes = {}; // personId -> [{ voteId, choice }]
  const unmatchedNames = new Set();

  for (let i = 0; i < recent.length; i++) {
    const v = recent[i];
    try {
      const detail = await fetchJson(
        `https://knesset.gov.il/WebSiteApi/knessetapi/Votes/GetVoteDetails/${v.VoteId}`,
        { headers: HEADERS }
      );
      if (!detail) continue;

      // ספירת בעד/נגד/נמנע
      let totalFor = 0,
        totalAgainst = 0,
        totalAbstain = 0;
      for (const c of detail.VoteCounters || []) {
        const choice = choiceFromTitle(c.Title);
        if (choice === "for") totalFor = c.countOfResult;
        else if (choice === "against") totalAgainst = c.countOfResult;
        else if (choice === "abstain") totalAbstain = c.countOfResult;
      }

      const header = (detail.VoteHeader && detail.VoteHeader[0]) || {};
      votes.push({
        voteId: v.VoteId,
        title: v.ItemTitle || header.ItemTitle || "",
        date: v.VoteDate,
        dateStr: v.VoteDateStr,
        totalFor,
        totalAgainst,
        totalAbstain,
        accepted: !!header.IsForAccepted,
        // Decision = מהות ההצבעה ("לקבל בקריאה שלישית", "לדחות את ההצעה"=הסתייגות).
        // AcceptedText = רק התוצאה ("ההצעה התקבלה") — נשמר בנפרד בשדה accepted.
        decision: header.Decision || header.AcceptedText || "",
        // מספר ישיבת המליאה — לקישור לפרוטוקול המלא (ראו fetch-protocols.mjs)
        session: header.SessionNumber ?? null,
        // מזהה הצעת החוק המדויק מהמקור (FK_ItemID), רק כשההצבעה היא על הצעת חוק
        // (LU_ItemType === 2). זה החיבור המדויק להצעת החוק — מחליף התאמה לפי שם.
        // הסיכום (summary) מתווסף לפי billId זה ב-fetch-bill-summaries.mjs.
        billId: header.LU_ItemType === 2 ? (header.FK_ItemID ?? null) : null,
      });

      // איך כל ח"כ הצביע
      for (const d of detail.VoteDetails || []) {
        const memberId = matchMember(d.MkName);
        if (!memberId) {
          unmatchedNames.add((d.MkName || "").trim());
          continue;
        }
        if (!memberVotes[memberId]) memberVotes[memberId] = [];
        memberVotes[memberId].push({
          voteId: v.VoteId,
          choice: choiceFromTitle(d.Title),
        });
      }
    } catch (err) {
      console.warn(`  דילוג על הצבעה ${v.VoteId}: ${err.message}`);
    }

    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${recent.length}`);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, "votes.json"), JSON.stringify(votes, null, 2), "utf8");
  await writeFile(
    join(DATA_DIR, "member-votes.json"),
    JSON.stringify(memberVotes, null, 2),
    "utf8"
  );

  const matchedMembers = Object.keys(memberVotes).length;
  console.log(`\nנשמרו ${votes.length} הצבעות.`);
  console.log(`שויכו הצבעות ל-${matchedMembers} מתוך ${members.length} ח"כים.`);
  if (unmatchedNames.size > 0) {
    console.log(`שמות שלא הותאמו (${unmatchedNames.size}): ${[...unmatchedNames].slice(0, 20).join(", ")}`);
  }
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
