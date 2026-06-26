// שואב את חברות הח"כים בוועדות הכנסת (הכנסת ה-25, נוכחי).
// מקור: KNS_PersonToPosition (שורות עם CommitteeName) ב-OData v4.
// הרצה: node scripts/fetch-committees.mjs   (אחרי fetch-knesset.mjs)
// תוצאה: app/data/committees.json   { memberId: [ { committee, role, isChair } ] }

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNESSET_NUM = 25;
const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

async function fetchAll(table, filter, select) {
  const results = [];
  const parts = [];
  if (filter) parts.push(`$filter=${encodeURIComponent(filter)}`);
  if (select) parts.push(`$select=${select}`);
  let url = `${BASE}/${table}${parts.length ? `?${parts.join("&")}` : ""}`;
  while (url) {
    const data = await (await fetch(url, { headers: { Accept: "application/json" } })).json();
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return results;
}

// תפקיד לפי PositionID: 41=יו"ר, 67=ממלא מקום, אחר (42/66)=חבר/ה
function roleOf(positionId) {
  if (positionId === 41) return { role: 'יו"ר', rank: 0 };
  if (positionId === 67) return { role: "ממלא/ת מקום", rank: 2 };
  return { role: "חבר/ה", rank: 1 };
}

async function main() {
  const members = JSON.parse(await readFile(join(DATA_DIR, "members.json"), "utf8"));
  const memberIds = new Set(members.map((m) => String(m.personId)));

  console.log("שואב חברות בוועדות...");
  const rows = await fetchAll(
    "KNS_PersonToPosition",
    `KnessetNum eq ${KNESSET_NUM} and IsCurrent eq true and CommitteeName ne null`,
    "PersonID,PositionID,CommitteeName"
  );

  // קיבוץ לפי ח"כ; לכל ועדה שומרים את התפקיד הבכיר ביותר (יו"ר > חבר > ממ"מ)
  const byMember = {};
  for (const r of rows) {
    const id = String(r.PersonID);
    if (!memberIds.has(id)) continue;
    const committee = (r.CommitteeName || "").trim();
    if (!committee) continue;
    const { role, rank } = roleOf(r.PositionID);
    const map = (byMember[id] ||= new Map());
    const existing = map.get(committee);
    if (!existing || rank < existing.rank) map.set(committee, { committee, role, rank });
  }

  // יו"ר קודם, ואז לפי שם הוועדה
  let total = 0;
  const out = {};
  for (const id in byMember) {
    const list = [...byMember[id].values()].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.committee.localeCompare(b.committee, "he");
    });
    out[id] = list.map(({ committee, role }) => ({ committee, role, isChair: role === 'יו"ר' }));
    total += out[id].length;
  }
  await writeFile(
    join(DATA_DIR, "committees.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );
  console.log(
    `נשמרו חברות בוועדות ל-${Object.keys(out).length} ח"כים (${total} חברויות).`
  );
}

main().catch((e) => {
  console.error("שגיאה:", e.message);
  process.exit(1);
});
