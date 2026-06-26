# מחלץ את "דברי הסבר" של חוק מתוך PDF, עם קריאה נכונה של פריסת שתי-עמודות.
# שימוש: python extract_explanation.py <pdf_path> <billId>
# מדפיס את הטקסט ל-stdout (ריק אם לא נמצא). דורש PyMuPDF (fitz).
#
# למה fitz ולא pdftotext: ה-PDF הוא חוברת עם דברי הסבר בשתי עמודות (ימין+שמאל).
# pdftotext קורא אותן בסדר שגוי וקוטע. כאן קוראים את אזור ההסבר (מהכותרת עד
# הערת-השוליים "מספר פנימי: {billId}") לפי בלוקים, ממוין עמודה ימנית→שמאלית.
import sys
import re

import fitz  # PyMuPDF


def clean(t):
    t = re.sub(r"[‎‏‪-‮­]", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" ?\n ?", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def despace(s):
    s = re.sub(r"[‎‏‪-‮­]", "", s)
    return re.sub(r"\s", "", s)


def extract(path, billid):
    doc = fitz.open(path)
    blocks = []
    for pno, page in enumerate(doc):
        mid = page.rect.width / 2
        for b in page.get_text("blocks"):
            if b[6] != 0 or not b[4].strip():
                continue
            blocks.append({"p": pno, "y": b[1], "cx": (b[0] + b[2]) / 2, "mid": mid, "t": b[4]})

    head = next((b for b in blocks if "דבריהסבר" in despace(b["t"])), None)
    if not head:
        return ""
    foot = next(
        (b for b in blocks if "מספרפנימי" in despace(b["t"]) and str(billid) in despace(b["t"])),
        None,
    )
    start = (head["p"], head["y"])
    end = (foot["p"], foot["y"]) if foot else (10 ** 9, 0)

    # אזור ההסבר: כל הבלוקים בין הכותרת להערת-השוליים, ממוינים: עמודה ימנית קודם
    region = [b for b in blocks if start < (b["p"], b["y"]) < end]
    region.sort(key=lambda b: (b["p"], 0 if b["cx"] >= b["mid"] else 1, round(b["y"])))

    txt = clean("\n".join(b["t"] for b in region))
    # חיתוך בשורת היוזמים (סוף ההסבר; היוזמים מוצגים בנפרד באתר)
    m = re.search(r"יוזמ(?:ים|ת|י)\s*:", txt)
    if m and m.start() > 40:
        txt = txt[: m.start()].strip()
    return txt


if __name__ == "__main__":
    out = extract(sys.argv[1], sys.argv[2])
    sys.stdout.buffer.write(out.encode("utf-8"))
