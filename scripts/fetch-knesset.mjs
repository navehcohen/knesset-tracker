// סקריפט לשאיבת נתוני הכנסת ה-25 מה-API הרשמי של הכנסת.
// הרצה: node scripts/fetch-knesset.mjs
// התוצאה נשמרת ב-app/data/parties.json ו-app/data/members.json

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
// OData v4 (הפיד החדש של הכנסת). v2 הישן מיועד להוצאה משימוש.
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

// צבע לכל מפלגה לפי שם (אם אין — אפור)
const COLORS = {
  "הליכוד": "#1e5aa8",
  "יש עתיד": "#00aabb",
  "הציונות הדתית": "#d97706",
  "הציונות הדתית בראשות בצלאל סמוטריץ'": "#d97706",
  "עוצמה יהודית בראשות איתמר בן גביר": "#f59e0b",
  "נעם - בראשות אבי מעוז": "#92400e",
  "המחנה הממלכתי": "#2563eb",
  "כחול לבן - המחנה הממלכתי": "#2563eb",
  "הימין הממלכתי": "#1d4ed8",
  "התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ\"ל": "#0f172a",
  "יהדות התורה": "#334155",
  "ישראל ביתנו": "#0891b2",
  "רע\"ם": "#15803d",
  "חד\"ש-תע\"ל": "#b91c1c",
  "העבודה": "#dc2626",
};

// מזהה קצר באנגלית לכל מפלגה (לכתובות URL)
const SLUGS = {
  "הליכוד": "likud",
  "יש עתיד": "yesh-atid",
  "הציונות הדתית": "religious-zionism",
  "הציונות הדתית בראשות בצלאל סמוטריץ'": "religious-zionism",
  "עוצמה יהודית בראשות איתמר בן גביר": "otzma",
  "נעם - בראשות אבי מעוז": "noam",
  "המחנה הממלכתי": "national-unity",
  "כחול לבן - המחנה הממלכתי": "national-unity",
  "הימין הממלכתי": "national-right",
  "התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ\"ל": "shas",
  "יהדות התורה": "utj",
  "ישראל ביתנו": "yisrael-beiteinu",
  "רע\"ם": "raam",
  "חד\"ש-תע\"ל": "hadash-taal",
  "העבודה": "labor",
};

// תפקידי הנהגה/שרים להצגה — לא כולל "חבר כנסת"/"חבר סיעה" ולא תפקידי ועדה
// (ועדות יטופלו בנפרד בשלב הבא)
const ROLE_POSITION_IDS = new Set([
  29, 30, 31, 39, 40, 45, 48, 50, 51, 57, 59, 65, 70, 71, 73, 122, 123, 130,
  131, 285078, 285079,
]);

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// שולף את כל הרשומות מטבלה ב-v4 (עוקב @odata.nextLink — עוקף תקרת 100 של v2).
// הערה: מפתחות-זרים (PersonID, PositionID, FactionID בתוך KNS_PersonToPosition)
// שומרים שמם ב-v4; רק המפתח הראשי של כל טבלה הפך ל-Id.
async function fetchAll(table, filter, select) {
  const results = [];
  const parts = [];
  if (filter) parts.push(`$filter=${encodeURIComponent(filter)}`);
  if (select) parts.push(`$select=${select}`);
  let url = `${BASE}/${table}${parts.length ? `?${parts.join("&")}` : ""}`;
  while (url) {
    const data = await fetchJson(url);
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return results;
}

async function main() {
  console.log("שואב מפלגות...");
  const factionsRaw = await fetchAll("KNS_Faction", `KnessetNum eq ${KNESSET_NUM}`);

  console.log("שואב שיוך ח\"כים למפלגות ותפקידים (כולל מי שפרש)...");
  // שואבים את כל שורות התפקידים בכנסת ה-25 — חברות, שרים, יו"ר וכו'
  const allK25Positions = await fetchAll(
    "KNS_PersonToPosition",
    `KnessetNum eq ${KNESSET_NUM}`
  );
  // שורות החברות בסיעה (חבר/ת סיעה) — לקביעת מי ח"כ
  const allPositions = allK25Positions.filter((p) => p.PositionID === 54);

  // אוסף מזהי הח"כים שהם נוכחיים (יש להם לפחות שורה אחת פעילה)
  const currentPersonIds = new Set(
    allPositions.filter((p) => p.IsCurrent).map((p) => p.PersonID)
  );

  // לכל ח"כ בוחרים שורה מייצגת: עדיף הפעילה, אחרת האחרונה לפי תאריך התחלה
  const positionByPerson = new Map();
  for (const p of allPositions) {
    const existing = positionByPerson.get(p.PersonID);
    if (!existing) {
      positionByPerson.set(p.PersonID, p);
      continue;
    }
    // אם החדש פעיל והקיים לא — מעדיפים את הפעיל
    if (p.IsCurrent && !existing.IsCurrent) {
      positionByPerson.set(p.PersonID, p);
    } else if (p.IsCurrent === existing.IsCurrent) {
      // אחרת לפי תאריך התחלה מאוחר יותר
      if (new Date(p.StartDate) > new Date(existing.StartDate)) {
        positionByPerson.set(p.PersonID, p);
      }
    }
  }

  const positions = [...positionByPerson.values()];
  console.log(
    `נמצאו ${positions.length} ח"כים (${currentPersonIds.size} נוכחיים, ${positions.length - currentPersonIds.size} פרשו). שואב שמות...`
  );

  // שליפת שמות בקבוצות של 15 כדי לא להעמיס על ה-API
  const personIds = [...new Set(positions.map((p) => p.PersonID))];
  const nameById = {};
  for (let i = 0; i < personIds.length; i += 15) {
    const chunk = personIds.slice(i, i + 15);
    // ב-v4 המפתח הראשי של KNS_Person הוא Id (היה PersonID ב-v2)
    const filter = chunk.map((id) => `Id eq ${id}`).join(" or ");
    const url = `${BASE}/KNS_Person?$filter=${encodeURIComponent(filter)}`;
    const data = await fetchJson(url);
    for (const person of data.value || []) {
      nameById[person.Id] = `${person.FirstName} ${person.LastName}`.trim();
    }
  }

  // מפת תיאורי תפקידים (Id של התפקיד -> שם התפקיד)
  console.log("שואב שמות תפקידים...");
  const posDescRows = await fetchAll("KNS_Position", null, "Id,Description");
  const posDesc = {};
  for (const p of posDescRows)
    posDesc[p.Id] = (p.Description || "").trim();

  // בונים תפקידים נוכחיים לכל ח"כ
  const rolesByPerson = {};
  for (const p of allK25Positions) {
    if (!p.IsCurrent || !ROLE_POSITION_IDS.has(p.PositionID)) continue;
    let label = (p.DutyDesc || "").trim();
    if (!label) {
      label = posDesc[p.PositionID] || "";
      const min = (p.GovMinistryName || "").trim();
      if (min) label = label ? `${label}, ${min}` : min;
    }
    if (!label) continue;
    (rolesByPerson[p.PersonID] ||= []).push(label);
  }
  for (const k in rolesByPerson)
    rolesByPerson[k] = [...new Set(rolesByPerson[k])];

  // מיפוי מזהה-סיעה -> מזהה-קצר (slug). כמה סיעות יכולות להתמזג לאותה מפלגה
  // (למשל "המחנה הממלכתי" ו"כחול לבן - המחנה הממלכתי").
  const factionInfo = new Map(); // factionId -> { name, slug }
  for (const f of factionsRaw) {
    const name = (f.Name || "").trim();
    // ב-v4 המפתח הראשי של KNS_Faction הוא Id (היה FactionID ב-v2);
    // אבל p.FactionID ב-KNS_PersonToPosition הוא מפתח-זר ושומר שמו.
    factionInfo.set(f.Id, { name, slug: SLUGS[name] || `faction-${f.Id}` });
  }

  // סופרים מנדטים (ח"כים נוכחיים) לכל slug
  const seatsBySlug = new Map();
  for (const p of positions) {
    if (!currentPersonIds.has(p.PersonID)) continue;
    const info = factionInfo.get(p.FactionID);
    if (!info) continue;
    seatsBySlug.set(info.slug, (seatsBySlug.get(info.slug) || 0) + 1);
  }

  // בונים מפלגות — רק כאלה שיש בהן ח"כ נוכחי אחד לפחות
  const parties = [];
  const seenSlugs = new Set();
  for (const f of factionsRaw) {
    const info = factionInfo.get(f.Id);
    const seats = seatsBySlug.get(info.slug) || 0;
    if (seats === 0 || seenSlugs.has(info.slug)) continue;
    parties.push({
      id: info.slug,
      name: info.name,
      seats,
      color: COLORS[info.name] || "#6b7280",
    });
    seenSlugs.add(info.slug);
  }

  // בונים רשימת ח"כים — מדלגים על מי שהמפלגה שלו לא נכנסה לרשימה
  const members = [];
  for (const p of positions) {
    const info = factionInfo.get(p.FactionID);
    if (!info || !seenSlugs.has(info.slug)) continue;
    const isCurrent = currentPersonIds.has(p.PersonID);
    members.push({
      id: String(p.PersonID),
      personId: p.PersonID,
      name: nameById[p.PersonID] || `ח"כ ${p.PersonID}`,
      partyId: info.slug,
      status: isCurrent ? "current" : "former",
      // תאריך סיום הכהונה (רק למי שפרש)
      endDate: !isCurrent && p.FinishDate ? p.FinishDate.split("T")[0] : null,
      // תפקידים נוכחיים (שר, יו"ר וכו'). מצורפים גם לפורשים — כדי שמי שפרש
      // מהכנסת אך עדיין מכהן כשר (חוק נורבגי) יוצג עם תפקידו.
      roles: rolesByPerson[p.PersonID] || [],
    });
  }

  // מיון: קודם נוכחיים, אחר כך מי שפרש, ובתוך כל קבוצה לפי שם
  members.sort((a, b) => {
    if (a.status !== b.status) return a.status === "current" ? -1 : 1;
    return a.name.localeCompare(b.name, "he");
  });

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    join(DATA_DIR, "parties.json"),
    JSON.stringify(parties, null, 2),
    "utf8"
  );
  await writeFile(
    join(DATA_DIR, "members.json"),
    JSON.stringify(members, null, 2),
    "utf8"
  );

  console.log(`נשמרו ${parties.length} מפלגות ו-${members.length} חברי כנסת.`);
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
