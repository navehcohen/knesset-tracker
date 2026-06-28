// מחלץ את "דברי ההסבר" של חוקים שעברו, מתוך מסמך "הצעת חוק לקריאה הראשונה" הרשמי.
// הרצה רגילה: node scripts/fetch-bill-explanations.mjs   (אחרי fetch-bills.mjs)
//   — מוסיף רק חוקים חדשים שעדיין לא חולצו.
// חילוץ-מחדש של הכול: REEXTRACT=1 node scripts/fetch-bill-explanations.mjs
//   — מחלץ שוב את כל החוקים עם הסקריפט הנוכחי, מתוך מטמון ה-PDF (בלי הורדה חוזרת).
// דורש: python + PyMuPDF (scripts/extract_explanation.py).
// ה-PDFים נשמרים במטמון scripts/_pdf-cache/ (ב-.gitignore) להורדה חד-פעמית.
// תוצאה: app/data/bill-explanations.json
//   { billId: { text, source, date, url } }
//   text=דברי ההסבר · source=סוג המסמך · date=תאריך המסמך · url=קישור ל-PDF המלא

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "app", "data");
// מטמון PDF מקומי (ב-.gitignore): מורידים פעם אחת, ואז אפשר לחלץ מחדש מהר
// (REEXTRACT=1) בלי להוריד שוב — שימושי אם מכווננים את סקריפט החילוץ.
const PDF_CACHE = join(__dirname, "_pdf-cache");
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

// הורדת PDF עם ניסיון חוזר. בריצה ארוכה שרת הקבצים (fs.knesset.gov.il) חוסם
// זמנית בקצב גבוה ומחזיר 406/429/5xx, או שהחיבור נופל ("fetch failed") — שני
// המקרים חולפים, אז מנסים שוב עם השהיה הולכת וגדלה (בניגוד ל-fetchJson, פעם זו
// היחידה שבה איבדנו חוקים בריצה הקודמת).
async function downloadPdf(url, path, tries = 4) {
  for (let a = 1; ; a++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
      if (res.status === 406 || res.status === 429 || res.status >= 500) {
        if (a >= tries) throw new Error(`PDF HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, a * 2000));
        continue;
      }
      if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) {
      if (a >= tries) throw e;
      await new Promise((r) => setTimeout(r, a * 2000));
    }
  }
}

// מחלץ "דברי הסבר" באמצעות סקריפט פייתון (PyMuPDF/fitz) — קורא נכון פריסת
// שתי-עמודות (ימין→שמאל) ואזור-הסבר רב-עמודי. ראו scripts/extract_explanation.py.
const PY_EXTRACT = join(__dirname, "extract_explanation.py");
function extractExplanation(pdfPath, billId) {
  let body;
  try {
    body = execFileSync("python", [PY_EXTRACT, pdfPath, String(billId)], {
      encoding: "utf8",
      maxBuffer: 60 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
  if (!body || body.length < 40) return null;
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

  // חוקים שאין להם הסבר — נשמרת *הסיבה* כדי שהאתר יציג הודעה ממוקדת:
  //   no_doc  = אין מסמך הצעת חוק לקריאה ראשונה באתר הכנסת
  //   no_text = יש מסמך, אך לא אותרו בו דברי הסבר (url = קישור למסמך לקריאה ידנית)
  const MISSING_PATH = join(DATA_DIR, "bill-explanations-missing.json");
  let missing = {};
  try {
    missing = JSON.parse(await readFile(MISSING_PATH, "utf8"));
  } catch {}

  // שמירה ביניים — כדי שהתקדמות לא תאבד אם הריצה הארוכה תיקטע
  const save = async () => {
    await writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
    await writeFile(MISSING_PATH, JSON.stringify(missing, null, 2), "utf8");
  };

  await mkdir(PDF_CACHE, { recursive: true });

  // מצב חילוץ-מחדש: מחלץ שוב את כל הרשומות הקיימות עם הסקריפט הנוכחי, מתוך
  // ה-PDF במטמון (מוריד רק מה שחסר, לפי ה-url השמור). לא נוגע ב-source/date/url.
  if (process.env.REEXTRACT) {
    const ids = Object.keys(out);
    console.log(`חילוץ-מחדש מהמטמון: ${ids.length} חוקים`);
    let changed = 0, fail = 0, done = 0;
    for (const billId of ids) {
      const pdfPath = join(PDF_CACHE, `${billId}.pdf`);
      try {
        if (!existsSync(pdfPath)) await downloadPdf((out[billId].url || "").replace(/\\/g, "/"), pdfPath);
        const text = extractExplanation(pdfPath, billId);
        if (text) { out[billId].text = text; changed++; }
        else fail++;
      } catch (e) {
        fail++;
        console.warn(`  שגיאה בחוק ${billId}: ${e.message}`);
      }
      if (++done % 25 === 0) {
        console.log(`  ${done}/${ids.length} (חולצו ${changed}, נכשלו ${fail})`);
        await save();
      }
    }
    await save();
    console.log(`\nסיום חילוץ-מחדש. עודכנו ${changed}, נכשלו ${fail}.`);
    return;
  }

  // חוקים שעברו קודם (כדי לסיים אותם מהר ולפרסם), ואז בהליך
  const todo = [...target.keys()]
    .filter((id) => !out[id])
    .sort((a, b) => (target.get(a) === "passed" ? -1 : 0) - (target.get(b) === "passed" ? -1 : 0));
  console.log(`חוקים (עברו+בהליך): ${target.size} · כבר חולצו: ${Object.keys(out).length} · נותרו: ${todo.length}`);

  let ok = 0, noDoc = 0, noExp = 0, err = 0;
  for (const billId of todo) {
    const pdfPath = join(PDF_CACHE, `${billId}.pdf`);
    try {
      const data = await fetchJson(
        `${BASE}/KNS_DocumentBill?$filter=BillID eq ${billId}&$select=GroupTypeDesc,FilePath,LastUpdatedDate`
      );
      const doc = pickDoc(data.value || []);
      if (!doc) { noDoc++; missing[billId] = { reason: "no_doc" }; continue; }
      const fileUrl = (doc.FilePath || "").replace(/\\/g, "/");
      if (!existsSync(pdfPath)) await downloadPdf(fileUrl, pdfPath);
      const explanation = extractExplanation(pdfPath, billId);
      if (!explanation) { noExp++; missing[billId] = { reason: "no_text", url: fileUrl }; continue; }
      out[billId] = {
        text: explanation,
        source: (doc.GroupTypeDesc || "").trim(),
        date: (doc.LastUpdatedDate || "").slice(0, 10),
        url: fileUrl,
      };
      delete missing[billId]; // אם הצליח עכשיו — להסיר מרשימת החסרים
      ok++;
    } catch (e) {
      err++;
      console.warn(`  שגיאה בחוק ${billId}: ${e.message}`);
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
