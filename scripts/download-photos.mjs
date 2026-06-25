// מוריד את תמונות הח"כים (מהכתובות שב-photos.json) אל תוך האתר עצמו,
// כדי שלא נטען אותן מויקיפדיה בכל כניסה (מהיר יותר, אמין, ולא תלוי באתר חיצוני).
// הרצה: node scripts/download-photos.mjs   (אחרי fetch-photos.mjs)
// תוצאה: public/mk-photos/{id}.{ext}  +  app/data/photos-local.json { id: "/mk-photos/..." }

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
const OUT_DIR = join(__dirname, "..", "public", "mk-photos");
const UA = { "User-Agent": "KnessetTracker/1.0 (educational project)" };

// סיומת הקובץ מתוך הכתובת (jpg/png/...), ברירת מחדל jpg
function extFromUrl(url) {
  const m = (url || "").match(/\.(jpg|jpeg|png|gif|webp|svg)(?:$|\?)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

async function download(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429) {
        if (attempt >= tries) throw new Error("HTTP 429");
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

async function main() {
  const photos = JSON.parse(await readFile(join(DATA_DIR, "photos.json"), "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  // טוען מה שכבר ירד כדי לדלג עליו (כדי לא להעמיס שוב על ויקימדיה)
  let local = {};
  try {
    local = JSON.parse(await readFile(join(DATA_DIR, "photos-local.json"), "utf8"));
  } catch {
    // אין קובץ עדיין — מתחילים מאפס
  }

  const ids = Object.keys(photos);
  const todo = ids.filter((id) => photos[id] && !local[id]);
  console.log(`כבר ירדו ${Object.keys(local).length}. נותרו להורדה: ${todo.length}`);

  let ok = 0;
  let failed = 0;
  for (const id of todo) {
    const url = photos[id];
    const ext = extFromUrl(url);
    try {
      const buf = await download(url);
      await writeFile(join(OUT_DIR, `${id}.${ext}`), buf);
      local[id] = `/mk-photos/${id}.${ext}`;
      ok++;
    } catch (err) {
      console.warn(`  דילוג על ${id}: ${err.message}`);
      failed++;
    }
    // השהיה קטנה בין בקשות כדי להימנע מחסימת-קצב (429)
    await new Promise((r) => setTimeout(r, 250));
    if (ok % 20 === 0 && ok > 0) console.log(`  +${ok}/${todo.length}`);
  }

  await writeFile(
    join(DATA_DIR, "photos-local.json"),
    JSON.stringify(local, null, 2),
    "utf8"
  );
  console.log(`\nהורדו ${ok} תמונות (${failed} נכשלו). photos-local.json עודכן.`);
}

main().catch((err) => {
  console.error("שגיאה:", err.message);
  process.exit(1);
});
