// סקריפט לשאיבת תמונות וביוגרפיה של חברי הכנסת מוויקיפדיה העברית.
// התמונות מוויקישיתוף (חופשי לשימוש), הביוגרפיה היא פתיח הערך.
// הרצה: node scripts/fetch-photos.mjs
// תוצאה: app/data/photos.json ({id: url}) ו-app/data/bios.json ({id: text})

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
const WIKI = "https://he.wikipedia.org/w/api.php";
const UA = { "User-Agent": "KnessetTracker/1.0 (educational project)" };
const THUMB = 400; // גודל התמונה בפיקסלים
const BATCH = 20; // exintro מוגבל ל-20 ערכים בבקשה

// כותרות ויקיפדיה מדויקות לח"כים ששמם נפוץ (החיפוש האוטומטי הגיע לדף-פירושונים).
// מפתח = מזהה הח"כ (id ב-members.json). אומת ידנית שלכל כותרת יש תמונה.
// "עוז חיים" (30916) הושמט בכוונה — לערך שלו אין תמונה חופשית בוויקיפדיה.
const TITLE_OVERRIDES = {
  "468": 'ישראל כ"ץ (הליכוד)', // ישראל כץ
  "30881": "ירון לוי (פוליטיקאי)",
  "30705": "מיכל שיר",
  "30777": "משה טור-פז",
  "30083": "אלי כהן (פוליטיקאי, 1972)",
  "30833": "אלמוג כהן (חבר הכנסת)",
  "23564": "דודי אמסלם", // דוד אמסלם
  "30872": "סימיון מושיאשוילי", // סימון מושיאשוילי
};

async function fetchJson(url, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      // 429 = יותר מדי בקשות; מכבדים Retry-After אם קיים, אחרת המתנה גוברת
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after")) || attempt * 2;
        if (attempt >= tries) throw new Error("HTTP 429");
        await new Promise((r) => setTimeout(r, ra * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// שולף תמונה + פתיח לקבוצת שמות בבת אחת. מחזיר name -> { photo, bio }
async function fetchBatch(names) {
  const titles = names.map((n) => encodeURIComponent(n)).join("|");
  const url =
    `${WIKI}?action=query&titles=${titles}` +
    `&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=${THUMB}` +
    `&exintro=1&explaintext=1&format=json&redirects=1`;
  const data = await fetchJson(url);
  const q = data.query || {};

  // מיפוי שם מבוקש -> שם בפועל (אחרי נירמול והפניות)
  const alias = {};
  for (const n of q.normalized || []) alias[n.from] = n.to;
  for (const r of q.redirects || []) alias[r.from] = r.to;
  const resolve = (name) => {
    let t = name;
    for (let i = 0; i < 5 && alias[t]; i++) t = alias[t];
    return t;
  };

  const byTitle = {};
  for (const p of Object.values(q.pages || {})) {
    byTitle[p.title] = {
      photo: p.thumbnail?.source || null,
      bio: (p.extract || "").trim() || null,
    };
  }

  const result = {};
  for (const n of names) result[n] = byTitle[resolve(n)] || { photo: null, bio: null };
  return result;
}

// שם מקוצר: מילה ראשונה + אחרונה (מסיר שמות אמצעיים)
function simplify(name) {
  const t = (name || "").replace(/["'`׳״]/g, "").split(/\s+/).filter(Boolean);
  return t.length > 2 ? `${t[0]} ${t[t.length - 1]}` : name;
}

// גיבוי: חיפוש חופשי כשהשם הישיר לא נתן תוצאה
async function searchOne(name) {
  const searchUrl = `${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(
    name + " חבר הכנסת"
  )}&srlimit=1&format=json`;
  const data = await fetchJson(searchUrl);
  const hit = data.query?.search?.[0];
  if (!hit) return { photo: null, bio: null };
  const got = await fetchBatch([hit.title]);
  return got[hit.title] || { photo: null, bio: null };
}

async function main() {
  const members = JSON.parse(
    await readFile(join(DATA_DIR, "members.json"), "utf8")
  );

  const photos = {};
  const bios = {};
  const store = (id, data) => {
    if (data.photo) photos[id] = data.photo;
    if (data.bio) bios[id] = data.bio;
  };

  // שלב 1 — שאיבה בקבוצות לפי השם המלא
  console.log(`שואב תמונות וביוגרפיה ל-${members.length} ח"כים...`);
  const missing = [];
  for (let i = 0; i < members.length; i += BATCH) {
    const chunk = members.slice(i, i + BATCH);
    const got = await fetchBatch(chunk.map((m) => m.name));
    for (const m of chunk) {
      const d = got[m.name];
      store(m.id, d);
      if (!d.photo && !d.bio) missing.push(m);
    }
    console.log(`  ${Math.min(i + BATCH, members.length)}/${members.length}`);
  }

  // שלב 2 — ניסיון נוסף עם שם מקוצר
  const retry = missing.filter((m) => simplify(m.name) !== m.name);
  if (retry.length) {
    console.log(`ניסיון עם שם מקוצר ל-${retry.length} ח"כים...`);
    for (let i = 0; i < retry.length; i += BATCH) {
      const chunk = retry.slice(i, i + BATCH);
      const got = await fetchBatch(chunk.map((m) => simplify(m.name)));
      for (const m of chunk) store(m.id, got[simplify(m.name)]);
    }
  }

  // שלב 3 — גיבוי חיפוש למי שעדיין חסר
  const missing2 = members.filter((m) => !photos[m.id] && !bios[m.id]);
  console.log(`מחפש בגיבוי ל-${missing2.length} ח"כים...`);
  for (const m of missing2) {
    try {
      store(m.id, await searchOne(m.name));
    } catch {
      // מתעלמים משגיאות בודדות
    }
  }

  // שלב 4 — כותרות מדויקות לשמות נפוצים (גובר על השלבים הקודמים)
  const overrideIds = Object.keys(TITLE_OVERRIDES).filter((id) =>
    members.some((m) => m.id === id)
  );
  if (overrideIds.length) {
    console.log(`מושך כותרות מדויקות ל-${overrideIds.length} ח"כים...`);
    const titles = overrideIds.map((id) => TITLE_OVERRIDES[id]);
    const got = await fetchBatch(titles);
    for (const id of overrideIds) store(id, got[TITLE_OVERRIDES[id]]);
  }

  await writeFile(join(DATA_DIR, "photos.json"), JSON.stringify(photos, null, 2), "utf8");
  await writeFile(join(DATA_DIR, "bios.json"), JSON.stringify(bios, null, 2), "utf8");

  console.log(
    `\nנשמרו ${Object.keys(photos).length} תמונות ו-${Object.keys(bios).length} ביוגרפיות מתוך ${members.length}.`
  );
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
