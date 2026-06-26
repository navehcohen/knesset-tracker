// מחלץ את "דברי ההסבר" של חוקים שעברו, מתוך מסמך "הצעת חוק לקריאה הראשונה" הרשמי.
// הרצה: node scripts/fetch-bill-explanations.mjs   (אחרי fetch-bills.mjs)
// דורש: pdftotext (מגיע עם Git for Windows). רץ פעם אחת — שומר רק טקסט, לא PDF.
// תוצאה: app/data/bill-explanations.json
//   { billId: { text, source, date, url } }
//   text=דברי ההסבר · source=סוג המסמך · date=תאריך המסמך · url=קישור ל-PDF המלא

import { writeFile, readFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
const UA = { "User-Agent": "Mozilla/5.0 (KnessetTracker educational project)" };
const MAX_LEN = 6000; // קיצוץ ביטחון לטקסטים חריגים (הנוסח המלא ממילא בקישור)

// מנקה סימני כיווניות (RTL/LRM) ורווחים מיותרים
function clean(t) {
  return (t || "")
    .replace(/[‎‏‪-‮­]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJson(url, tries = 4) {
  for (let a = 1; ; a++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...UA },
        signal: AbortSignal.timeout(20000), // לא להיתקע על חיבור תלוי
      });
      if (res.status === 429) {
        if (a >= tries) throw new Error("429");
        await new Promise((r) => setTimeout(r, a * 1500));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      if (a >= tries) throw e;
      await new Promise((r) => setTimeout(r, a * 1000));
    }
  }
}

// בוחר את מסמך ההסבר: קריאה ראשונה > דיון מוקדם. רק PDF — pdftotext לא קורא DOCX,
// ולחלק מהמסמכים יש גם גרסת docx וגם pdf (חובה להעדיף את ה-PDF).
function pickDoc(docs) {
  const isPdf = (d) => /\.pdf(\?|$)/i.test(d.FilePath || "");
  const pick = (kw) =>
    docs.filter((d) => (d.GroupTypeDesc || "").includes(kw)).find(isPdf) || null;
  return pick("קריאה הראשונה") || pick("מוקדם") || null;
}

// מריץ pdftotext; סובל יציאה לא-אפסית (PDF פגום חלקית) ומשתמש בפלט החלקי אם יש
function pdfToText(path) {
  try {
    return execFileSync("pdftotext", ["-enc", "UTF-8", "-nopgbrk", path, "-"], {
      encoding: "utf8",
      maxBuffer: 60 * 1024 * 1024,
    });
  } catch (e) {
    return e.stdout ? e.stdout.toString() : "";
  }
}

async function downloadPdf(url, path) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

// מחלץ את "דברי הסבר" של החוק הספציפי. ה-PDF הוא לרוב חוברת עם כמה הצעות חוק,
// אז מבודדים לפי עוגן הערת-השוליים "מספר פנימי: {billId}" שמסיים את קטע החוק שלנו.
function extractExplanation(text, billId) {
  const cleaned = clean(text);
  const bid = String(billId);
  // עוגן: המופע של ה-billId שמופיע אחרי "מספר פנימי" (הערת השוליים של החוק שלנו)
  let anchor = -1, from = 0;
  while (from < cleaned.length) {
    const i = cleaned.indexOf(bid, from);
    if (i === -1) break;
    if (cleaned.slice(Math.max(0, i - 60), i).includes("מספר פנימי")) { anchor = i; break; }
    from = i + bid.length;
  }
  let start, end;
  if (anchor !== -1) {
    start = cleaned.lastIndexOf("דברי הסבר", anchor);
    const fn = cleaned.lastIndexOf("הצעת חוק מס", anchor); // תחילת הערת השוליים
    end = fn > start ? fn : anchor;
  } else {
    // גיבוי: מ"דברי הסבר" עד הסימן הבא (חוק/הסבר נוסף), כדי לא לגלוש
    start = cleaned.indexOf("דברי הסבר");
    if (start !== -1) {
      const cands = [
        cleaned.indexOf("הצעת חוק מס", start + 9),
        cleaned.indexOf("דברי הסבר", start + 9),
      ].filter((x) => x !== -1);
      end = cands.length ? Math.min(...cands) : cleaned.length;
    }
  }
  if (start === undefined || start === -1) return null;
  let body = cleaned.slice(start + "דברי הסבר".length, end).trim();
  // חיתוך בשורת היוזמים (סוף ההסבר; היוזמים מוצגים ממילא בנפרד) וניקוי שאריות
  const pm = body.match(/יוזמ(?:ים|ת|י)\s*:/);
  if (pm && pm.index > 40) body = body.slice(0, pm.index).trim();
  body = body.replace(/\*+\s*$/, "").trim();
  if (body.length < 40) return null;
  if (body.length > MAX_LEN) body = body.slice(0, MAX_LEN).trim() + "…";
  return body;
}

async function main() {
  const mb = JSON.parse(await readFile(join(DATA_DIR, "member-bills.json"), "utf8"));
  // חוקים שעברו או בהליך, ייחודיים (לא כולל נעצרו/נדחו)
  const target = new Map(); // billId -> category
  for (const bills of Object.values(mb))
    for (const b of bills)
      if (
        (b.category === "passed" || b.category === "in_progress") &&
        !target.has(b.billId)
      )
        target.set(b.billId, b.category);

  // טוען מה שכבר חולץ (כדי לדלג — הרצה אידמפוטנטית)
  const OUT_PATH = join(DATA_DIR, "bill-explanations.json");
  let out = {};
  try {
    out = JSON.parse(await readFile(OUT_PATH, "utf8"));
  } catch {}

  // שמירה ביניים — כדי שהתקדמות לא תאבד אם הריצה הארוכה תיקטע
  const save = () => writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");

  // חוקים שעברו קודם (כדי לסיים אותם מהר ולפרסם), ואז בהליך
  const todo = [...target.keys()]
    .filter((id) => !out[id])
    .sort((a, b) => (target.get(a) === "passed" ? -1 : 0) - (target.get(b) === "passed" ? -1 : 0));
  console.log(`חוקים (עברו+בהליך): ${target.size} · כבר חולצו: ${Object.keys(out).length} · נותרו: ${todo.length}`);

  let ok = 0, noDoc = 0, noExp = 0, err = 0;
  for (const billId of todo) {
    const tmp = join(__dirname, `_tmp_${billId}.pdf`);
    try {
      const data = await fetchJson(
        `${BASE}/KNS_DocumentBill?$filter=BillID eq ${billId}&$select=GroupTypeDesc,FilePath,LastUpdatedDate`
      );
      const doc = pickDoc(data.value || []);
      if (!doc) { noDoc++; continue; }
      await downloadPdf(doc.FilePath, tmp);
      const text = pdfToText(tmp);
      const explanation = extractExplanation(text, billId);
      if (!explanation) { noExp++; continue; }
      out[billId] = {
        text: explanation,
        source: (doc.GroupTypeDesc || "").trim(),
        date: (doc.LastUpdatedDate || "").slice(0, 10),
        url: doc.FilePath,
      };
      ok++;
    } catch (e) {
      err++;
      console.warn(`  שגיאה בחוק ${billId}: ${e.message}`);
    } finally {
      await unlink(tmp).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 150));
    if ((ok + noDoc + noExp + err) % 25 === 0) {
      console.log(`  התקדמות: חולצו ${ok}, ללא מסמך ${noDoc}, ללא הסבר ${noExp}, שגיאות ${err}`);
      await save(); // שמירת ביניים
    }
  }

  await save();
  console.log(
    `\nסיום. סהכ עם דברי הסבר: ${Object.keys(out).length}/${target.size}. ` +
      `(הרצה זו: חולצו ${ok}, ללא מסמך ${noDoc}, ללא הסבר ${noExp}, שגיאות ${err}.)`
  );
}

main().catch((e) => {
  console.error("שגיאה:", e.message);
  process.exit(1);
});
