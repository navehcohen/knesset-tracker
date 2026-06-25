// שואב לוגואים של המפלגות:
//   שלב א: Wikipedia REST API (EN) — מהיר, עובד לחלק
//   שלב ב: prop=images מהדף העברי → מסנן קבצי לוגו → שואב URL
// תוצאה: app/data/party-logos.json  { partyId: logoUrl }
// הרצה: node scripts/fetch-party-logos.mjs

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");

// [שם EN לREST API, שם עברי לפעולת גיבוי]
const PARTY_WIKI = {
  "likud":             ["Likud",                  "הליכוד"],
  "yesh-atid":         ["Yesh_Atid",              "יש עתיד"],
  "national-unity":    ["National_Unity_(Israel)", "המחנה הממלכתי"],
  "shas":              ["Shas",                    "ש\"ס"],
  "utj":               ["United_Torah_Judaism",    "יהדות התורה"],
  "religious-zionism": ["Religious_Zionism_party", "הציונות הדתית (מפלגה)"],
  "otzma":             ["Otzma_Yehudit",           "עוצמה יהודית"],
  "yisrael-beiteinu":  ["Yisrael_Beiteinu",        "ישראל ביתנו"],
  "labor":             ["Israeli_Labor_Party",      "המפלגה הציונית-החברתית"],
  "hadash-taal":       ["Hadash",                  "חד\"ש-תע\"ל"],
  "raam":              ["Ra%27am",                 "רשימה המאוחדת"],
  "noam":              ["Noam_(political_party)",  "נועם (מפלגה)"],
  "national-right":    ["The_State_Right",         "הימין הממלכתי"],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "knesset-tracker/1.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// שלב א: Wikipedia REST summary (מהיר)
async function tryRestApi(enTitle) {
  try {
    const d = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${enTitle}`);
    return d?.thumbnail?.source ?? null;
  } catch { return null; }
}

// שלב ב: prop=images מהדף העברי → מחפש קובץ עם "לוגו"/"logo" בשם → שואב URL
async function tryLogoFromImages(heTitle) {
  const q = await get(
    `https://he.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(heTitle)}` +
    `&prop=images&imlimit=50&format=json&formatversion=2`
  );
  const imgs = (q?.query?.pages?.[0]?.images ?? []).map(i => i.title);

  // מחפש קובץ עם לוגו בשם, מעדיף את השנה הכי גדולה
  const logoFiles = imgs.filter(t => /לוגו|logo/i.test(t));
  if (logoFiles.length === 0) return null;

  // בוחר את השנה הכי חדשה (לפי 4 ספרות בשם הקובץ)
  logoFiles.sort((a, b) => {
    const ya = parseInt((a.match(/\d{4}/) ?? ["0"])[0]);
    const yb = parseInt((b.match(/\d{4}/) ?? ["0"])[0]);
    return yb - ya;
  });
  const chosen = logoFiles[0];

  // מביא URL לתמונה
  const info = await get(
    `https://he.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(chosen)}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&formatversion=2`
  );
  return info?.query?.pages?.[0]?.imageinfo?.[0]?.thumburl ?? null;
}

async function fetchLogo(enTitle, heTitle) {
  const a = await tryRestApi(enTitle);
  if (a) return a;
  await sleep(300);
  return tryLogoFromImages(heTitle);
}

async function main() {
  // טוען מה שכבר נמצא (כדי לא לשאוב מחדש)
  let existing = {};
  try {
    existing = JSON.parse(await readFile(join(DATA_DIR, "party-logos.json"), "utf8"));
  } catch {}

  const logos = { ...existing };
  const entries = Object.entries(PARTY_WIKI);

  for (let i = 0; i < entries.length; i++) {
    const [partyId, [enTitle, heTitle]] = entries[i];
    if (logos[partyId]) {
      console.log(`⏭  ${partyId}: כבר קיים`);
      continue;
    }
    if (i > 0) await sleep(500);
    try {
      const url = await fetchLogo(enTitle, heTitle);
      if (url) {
        logos[partyId] = url;
        console.log(`✓ ${partyId}: ${url.split("/").slice(-1)[0].slice(0, 60)}`);
      } else {
        console.log(`✗ ${partyId}: לא נמצאה תמונה`);
      }
    } catch (e) {
      console.warn(`✗ ${partyId}: שגיאה — ${e.message}`);
    }
  }

  await writeFile(
    join(DATA_DIR, "party-logos.json"),
    JSON.stringify(logos, null, 2),
    "utf8"
  );
  console.log(`\nסה"כ: ${Object.keys(logos).length}/${entries.length} לוגואים.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
