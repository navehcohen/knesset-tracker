// בונה מפה: מספר ישיבת מליאה -> קישור לפרוטוקול המלא (דברי הכנסת / סטנוגרמה).
// הרצה: node scripts/fetch-protocols.mjs   (אחרי fetch-votes.mjs — קורא votes.json)
// תוצאה: app/data/session-protocols.json   { sessionNumber: url }

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
// OData v4 (הפיד החדש של הכנסת). v2 הישן מיועד להוצאה משימוש.
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// שואב את כל השורות מטבלה ב-v4 (עוקב @odata.nextLink — עוקף תקרת 100 של v2).
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

// בוחר את מסמך הפרוטוקול הטוב ביותר לישיבה: דברי הכנסת > סטנוגרמה
function pickProtocol(docs) {
  const norm = (s) => (s || "").trim();
  const byType = (kw) => docs.find((d) => norm(d.GroupTypeDesc).includes(kw));
  const doc = byType("דברי הכנסת") || byType("סטנוגרמה");
  return doc ? doc.FilePath : null;
}

async function main() {
  // מספרי הישיבות שמופיעים בהצבעות שלנו
  const votes = JSON.parse(await readFile(join(DATA_DIR, "votes.json"), "utf8"));
  const sessionNums = [...new Set(votes.map((v) => v.session).filter((n) => n != null))];
  console.log(`נמצאו ${sessionNums.length} ישיבות שונות בהצבעות.`);

  // מפה: מספר ישיבה -> PlenumSessionID
  console.log("שואב את רשימת ישיבות המליאה...");
  const sessions = await fetchAll(
    "KNS_PlenumSession",
    `KnessetNum eq ${KNESSET_NUM}`,
    "Id,Number"
  );
  const idByNumber = new Map();
  for (const s of sessions) idByNumber.set(s.Number, s.Id);

  // לכל ישיבה — מאתר את מסמך הפרוטוקול
  const result = {};
  let found = 0;
  for (let i = 0; i < sessionNums.length; i++) {
    const num = sessionNums[i];
    const sid = idByNumber.get(num);
    if (!sid) continue;
    try {
      const docs = await fetchAll(
        "KNS_DocumentPlenumSession",
        `PlenumSessionID eq ${sid}`,
        "GroupTypeDesc,FilePath"
      );
      const url = pickProtocol(docs);
      if (url) {
        result[num] = url;
        found++;
      }
    } catch (err) {
      console.warn(`  דילוג על ישיבה ${num}: ${err.message}`);
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${sessionNums.length}`);
  }

  await writeFile(
    join(DATA_DIR, "session-protocols.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  console.log(`\nנשמרו קישורי פרוטוקול ל-${found} מתוך ${sessionNums.length} ישיבות.`);
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
