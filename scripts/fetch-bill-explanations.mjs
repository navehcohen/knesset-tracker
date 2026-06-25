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
      const res = await fetch(url, { headers: { Accept: "application/json", ...UA } });
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

// בוחר את מסמך ההסבר: קריאה ראשונה > דיון מוקדם
function pickDoc(docs) {
  const by = (kw) => docs.find((d) => (d.GroupTypeDesc || "").includes(kw));
  return by("קריאה הראשונה") || by("מוקדם") || null;
}

async function downloadPdf(url, path) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

// מחלץ את קטע "דברי הסבר" מתוך טקסט המסמך
function extractExplanation(text) {
  const cleaned = clean(text);
  const idx = cleaned.indexOf("דברי הסבר");
  if (idx === -1) return null;
  let body = cleaned.slice(idx + "דברי הסבר".length).trim();
  if (body.length < 40) return null; // קצר מדי = כנראה לא ההסבר האמיתי
  if (body.length > MAX_LEN) body = body.slice(0, MAX_LEN).trim() + "…";
  return body;
}

async function main() {
  const mb = JSON.parse(await readFile(join(DATA_DIR, "member-bills.json"), "utf8"));
  // חוקים שעברו, ייחודיים
  const passed = new Map();
  for (const bills of Object.values(mb))
    for (const b of bills)
      if (b.category === "passed" && !passed.has(b.billId)) passed.set(b.billId, b.name);

  // טוען מה שכבר חולץ (כדי לדלג — הרצה אידמפוטנטית)
  let out = {};
  try {
    out = JSON.parse(await readFile(join(DATA_DIR, "bill-explanations.json"), "utf8"));
  } catch {}

  const todo = [...passed.keys()].filter((id) => !out[id]);
  console.log(`חוקים שעברו: ${passed.size} · כבר חולצו: ${Object.keys(out).length} · נותרו: ${todo.length}`);

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
      const text = execFileSync("pdftotext", ["-enc", "UTF-8", "-nopgbrk", tmp, "-"], {
        encoding: "utf8",
        maxBuffer: 60 * 1024 * 1024,
      });
      const explanation = extractExplanation(text);
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
    if ((ok + noDoc + noExp + err) % 25 === 0)
      console.log(`  התקדמות: חולצו ${ok}, ללא מסמך ${noDoc}, ללא הסבר ${noExp}, שגיאות ${err}`);
  }

  await writeFile(
    join(DATA_DIR, "bill-explanations.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );
  console.log(
    `\nסיום. סהכ עם דברי הסבר: ${Object.keys(out).length}/${passed.size}. ` +
      `(הרצה זו: חולצו ${ok}, ללא מסמך ${noDoc}, ללא הסבר ${noExp}, שגיאות ${err}.)`
  );
}

main().catch((e) => {
  console.error("שגיאה:", e.message);
  process.exit(1);
});
