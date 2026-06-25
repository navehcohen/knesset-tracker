// בונה מפה: BillID -> קישור לנוסח החוק הסופי (פרסום ברשומות), לחוקים שעברו.
// הרצה: node scripts/fetch-bill-docs.mjs   (אחרי fetch-bills.mjs — קורא member-bills.json)
// תוצאה: app/data/bill-docs.json   { billId: { url, official } }
//   official=true  → "חוק - פרסום ברשומות" (הנוסח הרשמי הסופי)
//   official=false → "חוק - נוסח לא רשמי" (גיבוי כשאין פרסום רשמי עדיין)

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// OData v4 (הפיד החדש של הכנסת). v2 הישן מיועד להוצאה משימוש.
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// שואב את כל השורות מטבלה ב-v4. v4 מדפדף עם @odata.nextLink — עוקבים עד הסוף
// (עוקף את תקרת 100 השורות של v2). הערה: מפתחות-זרים (BillID וכו') שומרים שמם.
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

// בוחר את נוסח החוק: קודם הרשמי (רשומות), אחרת הלא-רשמי
function pickLawText(docs) {
  const norm = (s) => (s || "").trim();
  const official = docs.find((d) => norm(d.GroupTypeDesc).includes("פרסום ברשומות"));
  if (official) return { url: official.FilePath, official: true };
  const unofficial = docs.find((d) => norm(d.GroupTypeDesc).includes("נוסח לא רשמי"));
  if (unofficial) return { url: unofficial.FilePath, official: false };
  return null;
}

async function main() {
  // אוסף את כל החוקים שעברו (category=passed) מכל הח"כים — מזהים ייחודיים
  const memberBills = JSON.parse(
    await readFile(join(DATA_DIR, "member-bills.json"), "utf8")
  );
  const passedIds = new Set();
  for (const bills of Object.values(memberBills)) {
    for (const b of bills) if (b.category === "passed") passedIds.add(b.billId);
  }
  const ids = [...passedIds];
  console.log(`חוקים שעברו (מזהים ייחודיים): ${ids.length}`);

  const result = {};
  let found = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const docs = await fetchAll(
        "KNS_DocumentBill",
        `BillID eq ${id}`,
        "GroupTypeDesc,FilePath"
      );
      const pick = pickLawText(docs);
      if (pick) {
        result[id] = pick;
        found++;
      }
    } catch (err) {
      console.warn(`  דילוג על חוק ${id}: ${err.message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${ids.length}`);
  }

  await writeFile(
    join(DATA_DIR, "bill-docs.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  console.log(`\nנשמרו קישורי נוסח חוק ל-${found} מתוך ${ids.length} חוקים שעברו.`);
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
