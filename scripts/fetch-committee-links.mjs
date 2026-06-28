// בונה מיפוי "שם ועדה → מזהה בלובי הוועדות" לקישור מדף הח"כ לעמוד הוועדה.
// הרצה: node scripts/fetch-committee-links.mjs   (אחרי fetch-committees.mjs)
// תוצאה: app/data/committee-links.json   { "שם הוועדה": lobbyId }
//
// רקע / שורש העניין:
//   לאפליקציית הלובי (main.knesset.gov.il/apps/committees) יש מרחב-מזהים *נפרד*
//   שאינו ניתן לחיבור למזהי ה-OData (KNS_Committee.Id). אין מפתח משותף, ולכן
//   הגשר היחיד בין הנתונים שלנו (שמות ועדות מ-OData) לבין הלובי הוא *השם*.
//   כאן אנחנו מושכים את הרשימה הנקייה מה-API הרשמי של הלובי
//   (GetAllCommittees, ב-www.knesset.gov.il — נגיש לבוטים, בניגוד ל-main)
//   ומתאימים לפי שם מנורמל. התאמת-שם אף פעם אינה 100% (ועדות אד-הוק/משותפות
//   עם שמות ארוכים משתנים), לכן הסקריפט מדפיס דוח כיסוי ורשימת מה שלא הותאם.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
const API = "https://www.knesset.gov.il/WebSiteApi/knessetapi/Committees/GetAllCommittees/HE";

// נירמול שם להשוואה. הפערים האמיתיים בין השמות שלנו (OData) לבין הלובי:
//   • "וועדת" מול "ועדת"  → מאחדים וו→ו
//   • "הוועדה" מול "ועדה" (ה' הידיעה) → מסירים ה' פותחת
//   • "ועדת המשנה" מול "ועדת משנה" → מסירים את ה' מ"המשנה"
// בנוסף מסירים ניקוד/גרשיים/פיסוק ומאחדים רווחים.
function norm(s) {
  return (s || "")
    .replace(/[֑-ׇ]/g, "") // ניקוד
    .replace(/["'`׳״]/g, "") // גרשיים
    .replace(/[(),.\-–—:]/g, " ") // פיסוק
    .replace(/\s+/g, " ")
    .trim()
    .replace(/וו/g, "ו") // וו → ו (וועדת ↔ ועדת)
    .replace(/^ה(ועד)/, "$1") // הוועדה ↔ ועדה (אחרי וו→ו)
    .replace(/ המשנה /g, " משנה "); // ועדת המשנה ↔ ועדת משנה
}

async function main() {
  // 1) שמות הוועדות שמופיעים אצלנו (מתוך חברות הח"כים)
  const committees = JSON.parse(
    await readFile(join(DATA_DIR, "committees.json"), "utf8")
  );
  const ourNames = new Set();
  for (const arr of Object.values(committees))
    for (const x of arr) if (x.committee) ourNames.add(x.committee);

  // 2) רשימת הלובי הרשמית (שם נקי + מזהה)
  const res = await fetch(API, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const lobby = await res.json();
  const lobMap = new Map(); // normName -> id
  for (const c of lobby) {
    const k = norm(c.name);
    if (k && !lobMap.has(k)) lobMap.set(k, c.id);
  }

  // 3) התאמה לפי שם מנורמל
  const out = {};
  const unmatched = [];
  for (const name of ourNames) {
    const id = lobMap.get(norm(name));
    if (id) out[name] = id;
    else unmatched.push(name);
  }

  // שמירה ממוינת (יציבות ב-git)
  const sorted = Object.fromEntries(
    Object.entries(out).sort((a, b) => a[0].localeCompare(b[0], "he"))
  );
  await writeFile(
    join(DATA_DIR, "committee-links.json"),
    JSON.stringify(sorted, null, 2),
    "utf8"
  );

  console.log(
    `ועדות אצלנו: ${ourNames.size} · בלובי: ${lobby.length} · הותאמו: ${
      Object.keys(out).length
    } · ללא קישור: ${unmatched.length}`
  );
  console.log("\n--- ללא קישור (אין עמוד ייעודי בלובי, או שם שונה מהותית) ---");
  for (const n of unmatched.sort((a, b) => a.localeCompare(b, "he")))
    console.log("  •", n);
}

main().catch((e) => {
  console.error("שגיאה:", e.message);
  process.exit(1);
});
