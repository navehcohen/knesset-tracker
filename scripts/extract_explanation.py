# מחלץ את "דברי הסבר" של חוק מתוך PDF, עם קריאה נכונה של פריסת שתי-עמודות.
# שימוש: python extract_explanation.py <pdf_path> <billId>
# מדפיס את הטקסט ל-stdout (ריק אם לא נמצא). דורש PyMuPDF (fitz).
#
# למה fitz ולא pdftotext: ה-PDF הוא חוברת עם דברי הסבר בשתי עמודות (ימין+שמאל),
# לעיתים על פני כמה עמודים. pdftotext קורא אותן בסדר שגוי וקוטע.
#
# הגישה כאן (ברמת-התו): get_text("rawdict") נותן כל גליף עם מיקומו. בכל שורה:
#   1) ממיינים תווים לפי x יורד = סדר קריאה עברי (ימין→שמאל);
#   2) הופכים "ריצות" של ספרות/אותיות לטיניות (כיוון LTR) כדי לשחזר מספרים
#      וסוגריים נכון — (1), 346(א)(1), 1977 — שאחרת מתהפכים בדו-כיווניות.
# מיון השורות: עמודה ימנית→שמאלית בכל עמוד. הכותרת הרצה "דברי הסבר" חוזרת
# בראש כל עמוד של ההסבר ומשמשת לזיהוי האזור.
import sys
import re

import fitz  # PyMuPDF

# סימני כותרת/שוליים שאין לכלול (חלקם "הפוכים" ולעולם לא בטקסט עברי אמיתי)
EXCLUDE = ("מספרפנימי", "סודרוהודפס", 'ס"ח', "ISSN", "תסנכה", "הלשממ")


def despace(s):
    s = re.sub(r"[‎‏‪-‮­]", "", s)
    s = s.replace("״", '"').replace("׳", "'")  # גרשיים/גרש עברי → ישר (לזיהוי 'ס"ח')
    return re.sub(r"\s", "", s)


def _ltr(c):
    return c.isascii() and c.isalnum()  # ספרה/אות לטינית = כיוון LTR


def line_text(chars):
    # מיון לפי x יורד (ימין→שמאל), ואז היפוך ריצות LTR (מספרים/לטינית)
    seq = [c["c"] for c in sorted(chars, key=lambda c: -(c["bbox"][0] + c["bbox"][2]) / 2)]
    out = []
    i = 0
    while i < len(seq):
        if _ltr(seq[i]):
            j = i
            while j < len(seq) and _ltr(seq[j]):
                j += 1
            out.extend(reversed(seq[i:j]))  # 643→346 · NSSI→ISSN
            i = j
        else:
            out.append(seq[i])
            i += 1
    return "".join(out)


def is_spaced_heading(chars):
    # שורה "מנוקדת" (רוב המילים אות בודדת) = כותרת/כותרת-רצה — מסננים.
    words = "".join(c["c"] for c in chars).split()
    if len(words) < 4:
        return False
    singles = sum(1 for w in words if len(w.strip()) == 1)
    return singles / len(words) > 0.6


def clean(t):
    t = re.sub(r"[‎‏‪-‮­]", "", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)              # רווח לפני פיסוק
    t = re.sub(r"(\S)\s+'", r"\1'", t)                  # רווח לפני גרש
    t = re.sub(r"([א-ת])\s*\"\s*([א-ת])(?=[\s.,;:)–\-]|$)", r'\1"\2', t)  # ראשי-תיבות
    t = re.sub(r"([(“])\s+", r"\1", t)
    t = re.sub(r"\s+([)”])", r"\1", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def extract(path, billid):
    doc = fitz.open(path)
    parts = []
    for page in doc:
        mid = page.rect.width / 2
        rows = []  # {cx, y, chars, txt, ds}
        for block in page.get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                chars = [ch for span in line["spans"] for ch in span["chars"]]
                if not chars:
                    continue
                txt = line_text(chars)
                rows.append({
                    "cx": sum((c["bbox"][0] + c["bbox"][2]) / 2 for c in chars) / len(chars),
                    "y": min(c["bbox"][1] for c in chars),
                    "chars": chars,
                    "txt": txt,
                    "ds": despace(txt),
                })

        head_y = next((r["y"] for r in rows if "דבריהסבר" in r["ds"]), None)
        if head_y is None:
            continue  # אין כותרת "דברי הסבר" בעמוד הזה → לא חלק מההסבר

        keep = []
        for r in rows:
            if r["y"] <= head_y + 2 or is_spaced_heading(r["chars"]):
                continue  # מעל הכותרת, או שורת-כותרת מנוקדת
            ds = r["ds"]
            if not ds or any(e.replace(" ", "") in ds for e in EXCLUDE):
                continue
            if "ISSN" in r["txt"] or re.fullmatch(r"\d{1,4}", ds):
                continue  # מספרי עמוד / שורת ISSN
            if re.fullmatch(r"המחיר[\d.]+שקליםחדשים", ds):
                continue  # שורת מחיר החוברת
            if re.fullmatch(r"[*•·]+", ds):
                continue  # סימן הערת-שוליים בודד
            keep.append(r)

        # עמודה ימנית (cx גבוה) קודם, בתוך עמודה לפי y, ובאותה שורה הימני קודם —
        # כך תווית-שוליים ("סעיף 2", bold) שחולקת y עם השורה הראשונה באה לפניה.
        keep.sort(key=lambda r: (0 if r["cx"] >= mid else 1, round(r["y"]), -r["cx"]))
        parts.extend(r["txt"] for r in keep)

    if not parts:
        return ""
    txt = clean("\n".join(parts))
    # חיתוך בשורת היוזמים (סוף ההסבר; היוזמים מוצגים בנפרד באתר)
    m = re.search(r"יוזמ(?:ים|ת|י)\s*:", txt)
    if m and m.start() > 40:
        txt = txt[: m.start()].strip()
    return txt


if __name__ == "__main__":
    out = extract(sys.argv[1], sys.argv[2])
    sys.stdout.buffer.write(out.encode("utf-8"))
