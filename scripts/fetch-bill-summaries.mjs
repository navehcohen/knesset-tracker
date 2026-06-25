// מוסיף לכל הצבעה את התקציר הרשמי של הצעת החוק (שדה SummaryLaw מ-KNS_Bill).
// הקישור נעשה לפי billId המדויק שכבר נשמר בכל הצבעה (FK_ItemID מ-fetch-votes.mjs),
// ולא לפי השם — כך הקישור מדויק ב-100% ומכסה הרבה יותר הצבעות.
//
// משתמש ב-OData v4 (הפיד החדש של הכנסת). v2 הישן מיועד להוצאה משימוש.
// ב-v4 מפתח ההצעה הוא Id (לא BillID), ו-$expand זמין (כאן לא נחוץ — שליפה פשוטה).
//
// הרצה: node scripts/fetch-bill-summaries.mjs  (אחרי fetch-votes.mjs)
// תוצאה: מוסיף/מעדכן שדה summary לכל הצבעה ב-app/data/votes.json
//        (שדה billId כבר נשמר ע"י fetch-votes.mjs — כאן רק קוראים אותו)

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// שליפת כל השורות מטבלה ב-v4. v4 מדפדף עם @odata.nextLink — עוקבים אחריו עד הסוף.
// (זה עוקף את תקרת 100 השורות שהציקה לנו ב-v2.)
async function fetchAll(table, filter, select) {
  const results = [];
  let url = `${BASE}/${table}?$filter=${encodeURIComponent(filter)}&$select=${select}`;
  while (url) {
    const data = await fetchJson(url);
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return results;
}

async function main() {
  console.log("שואב את כל הצעות החוק של הכנסת ה-25 מ-OData v4...");
  const bills = await fetchAll(
    "KNS_Bill",
    `KnessetNum eq ${KNESSET_NUM}`,
    "Id,SummaryLaw"
  );
  console.log(`נמצאו ${bills.length} הצעות חוק.`);

  // מפה: billId -> תקציר (רק חוקים עם תקציר)
  const summaryById = new Map();
  for (const b of bills) {
    const summary = (b.SummaryLaw || "").trim();
    if (summary) summaryById.set(b.Id, summary);
  }
  console.log(`מתוכן ${summaryById.size} עם תקציר רשמי.`);

  // טוענים את ההצבעות ומחברים תקציר לפי billId המדויק שכבר קיים בהן
  const votes = JSON.parse(await readFile(join(DATA_DIR, "votes.json"), "utf8"));
  let withBillId = 0;
  let matched = 0;
  for (const v of votes) {
    if (v.billId != null) withBillId++;
    const hit = v.billId != null ? summaryById.get(v.billId) : null;
    v.summary = hit ?? null;
    if (hit) matched++;
  }

  await writeFile(join(DATA_DIR, "votes.json"), JSON.stringify(votes, null, 2), "utf8");
  console.log(
    `\nמתוך ${votes.length} הצבעות: ל-${withBillId} יש billId, ול-${matched} חובר תקציר.`
  );
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
