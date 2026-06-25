// שואב את הצעות החוק שכל ח"כ יזם או חתם עליהן בכנסת ה-25.
// מקור: KNS_Bill (פרטי החוק + סטטוס) + KNS_BillInitiator (מי יזם/חתם).
// הרצה: node scripts/fetch-bills.mjs   (קורא app/data/members.json)
// תוצאה: app/data/member-bills.json   { personId: [ {billId, name, statusId, statusDesc, category, isInitiator} ] }

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
// OData v4 (הפיד החדש של הכנסת). v2 הישן מיועד להוצאה משימוש.
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

// קיבוץ סטטוסים ל-3 קטגוריות תצוגה. הטקסט המדויק נשמר בנפרד (statusDesc).
const PASSED = new Set([118]); // התקבלה בקריאה שלישית = הפך לחוק
const STOPPED = new Set([110, 122, 124, 140, 143, 176, 177]); // הוסר/נדחה/מוזג/נעצר
function categorize(statusId) {
  if (PASSED.has(statusId)) return "passed";
  if (STOPPED.has(statusId)) return "stopped";
  return "in_progress"; // בהליך חקיקה
}

// שואב JSON עם ניסיונות-חוזרים (השרת מנתק לעיתים חיבורים → "fetch failed")
async function fetchJson(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt)); // השהיה גוברת
    }
  }
}

// שואב את כל השורות מטבלה ב-v4 (עוקב @odata.nextLink — עוקף תקרת 100 של v2).
// הערה: מפתחות-זרים (BillID, PersonID בתוך KNS_BillInitiator) שומרים שמם ב-v4.
// expand (אופציונלי) = $expand להבאת טבלאות קשורות בקריאה אחת (יתרון מרכזי של v4).
async function fetchAll(table, filter, select, expand) {
  const results = [];
  const parts = [];
  if (filter) parts.push(`$filter=${encodeURIComponent(filter)}`);
  if (select) parts.push(`$select=${select}`);
  if (expand) parts.push(`$expand=${expand}`);
  let url = `${BASE}/${table}${parts.length ? `?${parts.join("&")}` : ""}`;
  while (url) {
    const data = await fetchJson(url);
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return results;
}

async function main() {
  // 1) מילון תיאורי סטטוס: StatusID -> Desc
  console.log("שואב את טבלת הסטטוסים...");
  const statuses = await fetchAll("KNS_Status", "TypeDesc eq 'הצעת חוק'", "Id,Desc");
  const statusDesc = new Map();
  for (const s of statuses) statusDesc.set(s.Id, (s.Desc || "").trim());

  // 2) כל הצעות החוק של הכנסת ה-25, יחד עם היוזמים שלהן — בסריקה אחת.
  // ב-v4 משתמשים ב-$expand במקום 147 שאילתות נפרדות לכל ח"כ (שעמיסו והתנתקו),
  // ואז הופכים את המבנה: מהצעה→יוזמים לכל ח"כ→הצעות שלו.
  console.log(`שואב את כל הצעות החוק של הכנסת ה-${KNESSET_NUM} עם היוזמים (v4 $expand)...`);
  const bills = await fetchAll(
    "KNS_Bill",
    `KnessetNum eq ${KNESSET_NUM}`,
    "Id,Name,StatusID,SubTypeDesc,LastUpdatedDate",
    "KNS_BillInitiator($select=PersonID,IsInitiator,Ordinal)"
  );
  console.log(`נמצאו ${bills.length} הצעות חוק.`);

  // 3) היפוך: לכל ח"כ — אילו חוקים יזם/חתם עליהם (רק ח"כים שברשימה שלנו)
  const members = JSON.parse(await readFile(join(DATA_DIR, "members.json"), "utf8"));
  const memberIds = new Set(members.map((m) => m.personId));
  const memberBills = {}; // id (=String(personId)) -> [ ... ]
  let totalLinks = 0;

  for (const bill of bills) {
    const entry = {
      billId: bill.Id,
      name: (bill.Name || "").trim(),
      statusId: bill.StatusID,
      statusDesc: statusDesc.get(bill.StatusID) || "",
      category: categorize(bill.StatusID),
      subType: bill.SubTypeDesc || "",
      lastUpdated: bill.LastUpdatedDate || "",
    };
    for (const ini of bill.KNS_BillInitiator || []) {
      if (!memberIds.has(ini.PersonID)) continue; // רק ח"כים שברשימה שלנו
      const key = String(ini.PersonID);
      (memberBills[key] ||= []).push({
        ...entry,
        isInitiator: ini.IsInitiator === true, // יוזם רשמי (true) או חתום/תומך (null/false)
        ordinal: typeof ini.Ordinal === "number" ? ini.Ordinal : null, // סדר ברשימת היוזמים (1 = מציע ראשון)
      });
      totalLinks++;
    }
  }

  // מיון בכל ח"כ: שהתקבלו קודם, ובכל קבוצה — לפי עדכון אחרון (חדש→ישן)
  const order = { passed: 0, in_progress: 1, stopped: 2 };
  for (const list of Object.values(memberBills)) {
    list.sort((a, b) => {
      const c = order[a.category] - order[b.category];
      if (c !== 0) return c;
      return (b.lastUpdated || "").localeCompare(a.lastUpdated || "");
    });
  }

  await writeFile(
    join(DATA_DIR, "member-bills.json"),
    JSON.stringify(memberBills, null, 2),
    "utf8"
  );

  const withBills = Object.keys(memberBills).length;
  const passed = Object.values(memberBills).flat().filter((b) => b.category === "passed").length;
  console.log(`\nנשמרו חוקים ל-${withBills} מתוך ${members.length} ח"כים (${totalLinks} קשרים, מתוכם ${passed} שהתקבלו).`);
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
