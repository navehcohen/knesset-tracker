// בונה מיפוי: מזהה ח"כ (PersonID) -> מזהה הפרופיל הציבורי באתר הכנסת (SiteId).
// מקור: KNS_MkSiteCode ב-OData v4 (KnsID = PersonID, SiteId = מזהה הפרופיל).
// הרצה: node scripts/fetch-mk-site.mjs   (אחרי fetch-knesset.mjs)
// תוצאה: app/data/mk-site.json   { memberId: siteId }

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// שואב את כל השורות (עוקב @odata.nextLink — עוקף תקרת 100 של הדף)
async function fetchAll(table, select) {
  const results = [];
  let url = `${BASE}/${table}${select ? `?$select=${select}` : ""}`;
  while (url) {
    const data = await fetchJson(url);
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return results;
}

async function main() {
  const members = JSON.parse(await readFile(join(DATA_DIR, "members.json"), "utf8"));
  const memberIds = new Set(members.map((m) => String(m.personId)));

  console.log("שואב מיפוי KNS_MkSiteCode ...");
  const rows = await fetchAll("KNS_MkSiteCode", "KnsID,SiteId");

  const map = {};
  for (const r of rows) {
    const id = String(r.KnsID);
    if (memberIds.has(id) && r.SiteId != null) map[id] = r.SiteId;
  }

  await writeFile(
    join(DATA_DIR, "mk-site.json"),
    JSON.stringify(map, null, 2),
    "utf8"
  );
  console.log(
    `נשמר מיפוי ל-${Object.keys(map).length} מתוך ${members.length} ח"כים (מתוך ${rows.length} שורות במקור).`
  );
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
