// שואב נתונים רשמיים על הח"כים הנוכחיים מה-API הרשמי של אתר הכנסת (MkLobby),
// ומוריד את התמונות הרשמיות מקומית. אפס תלות בויקיפדיה לח"כים הנוכחיים.
// הרצה: node scripts/fetch-mk-official.mjs   (אחרי fetch-knesset.mjs)
// תוצאה: app/data/mk-official.json  { memberId: { faction, birthYear, email, photo } }
//        + public/mk-photos/official_{id}.{ext}

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://www.knesset.gov.il/WebSiteApi/knessetapi/MkLobby/GetMkLobbyData120?lang=he";
const UA = { "User-Agent": "Mozilla/5.0 (KnessetTracker educational project)" };
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
const PHOTO_DIR = join(__dirname, "..", "public", "mk-photos");

// כינויים: שם ב-API -> שם רשמי אצלנו
const FIRST_NAME_ALIASES = { בני: "בנימין" };

function tokens(name) {
  return (name || "")
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((t) => FIRST_NAME_ALIASES[t] || t);
}
function nameKey(name) {
  return [...new Set(tokens(name))].sort().join(" ");
}
function extOf(url) {
  const path = (url || "").split("?")[0];
  const m = path.match(/\.(jpe?g|png|gif|webp)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

async function main() {
  const members = JSON.parse(await readFile(join(DATA_DIR, "members.json"), "utf8"));
  const current = members.filter((m) => m.status === "current");
  const byName = new Map(current.map((m) => [nameKey(m.name), m.id]));
  const tokenSets = current.map((m) => ({ id: m.id, set: new Set(tokens(m.name)) }));

  // התאמה: מדויק -> תת-קבוצה חד-משמעית (שמות אמצעיים)
  function match(fullName) {
    const exact = byName.get(nameKey(fullName));
    if (exact) return exact;
    const vset = new Set(tokens(fullName));
    if (vset.size < 2) return null;
    let found = null, count = 0;
    for (const mt of tokenSets) {
      const sub =
        [...vset].every((t) => mt.set.has(t)) || [...mt.set].every((t) => vset.has(t));
      if (sub) { found = mt.id; count++; }
    }
    return count === 1 ? found : null;
  }

  console.log("שואב נתונים רשמיים מ-MkLobby...");
  const data = JSON.parse(await (await fetch(API, { headers: UA })).text());
  const lobby = data.mks || [];
  await mkdir(PHOTO_DIR, { recursive: true });

  const out = {};
  const unmatched = [];
  let photos = 0;
  for (const mk of lobby) {
    const full = `${mk.Firstname} ${mk.Lastname}`.trim();
    const id = match(full);
    if (!id) { unmatched.push(full); continue; }

    let photoPath = null;
    if (mk.ImagePath) {
      try {
        const buf = Buffer.from(await (await fetch(mk.ImagePath, { headers: UA })).arrayBuffer());
        const ext = extOf(mk.ImagePath);
        await writeFile(join(PHOTO_DIR, `official_${id}.${ext}`), buf);
        photoPath = `/mk-photos/official_${id}.${ext}`;
        photos++;
      } catch (e) {
        console.warn(`  תמונה נכשלה ל-${full}: ${e.message}`);
      }
    }

    out[id] = {
      faction: (mk.FactionName || "").trim(),
      birthYear: mk.YearDate || null,
      email: (mk.Email || "").trim() || null,
      photo: photoPath,
    };
    await new Promise((r) => setTimeout(r, 100));
  }

  await writeFile(join(DATA_DIR, "mk-official.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(
    `\nהותאמו ${Object.keys(out).length}/${lobby.length} ח"כים · תמונות רשמיות: ${photos}.`
  );
  if (unmatched.length) console.log("לא הותאמו: " + unmatched.join(" | "));
}

main().catch((e) => {
  console.error("שגיאה:", e.message);
  process.exit(1);
});
