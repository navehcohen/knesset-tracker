# knesset-tracker — מעקב כנסת

## מה זה
אתר ציבורי (עברית, RTL) שמרכז מידע על חברי הכנסת ה-25: מפלגות, חברי כנסת, הצבעות,
הצעות חוק, ועדות ופרופילים אישיים. כולל חיפוש וצפייה לפי מפלגה / ח"כ / הצבעה / חוק.

## טכנולוגיות
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (גופן Heebo)
- אין מסד נתונים ואין סודות — הנתונים הם **קבצי JSON סטטיים** ב-`app/data/`

## ארכיטקטורה — שתי שכבות
1. **שליפת נתונים (ידנית):** סקריפטים ב-`scripts/*.mjs` מושכים מ-API של הכנסת
   (OData הרשמי + API לא-מתועד של אתר הכנסת) וכותבים קבצי JSON ל-`app/data/`.
2. **תצוגה:** Next.js מרנדר את הדפים מתוך אותם קבצי JSON (אין שליפה בזמן ריצה).

> כדי לרענן נתונים מריצים את הסקריפטים הרלוונטיים ידנית, ואז commit ל-JSON. אין רענון אוטומטי.

## איך מריצים
```bash
npm run dev      # שרת פיתוח → http://localhost:4000   (שים לב: פורט 4000, לא 3000)
npm run build    # בנייה
npm start        # הרצת production
npm run lint
```
רענון נתונים (דוגמאות):
```bash
node scripts/fetch-knesset.mjs    # מפלגות + חברי כנסת
node scripts/fetch-votes.mjs      # הצבעות + הצבעה לפי ח"כ
node scripts/fetch-bills.mjs      # הצעות חוק
node scripts/fetch-committees.mjs # ועדות
# ועוד fetch-*.mjs בתיקיית scripts
```

## מבנה
- `app/` — דפים (App Router): `member/[id]`, `party/[id]`, `vote/[id]`, `law/[id]`, `search/` ועוד; `components/`; `data/` (ה-JSON + `knesset.ts`)
- `scripts/` — סקריפטי שליפת נתונים (`.mjs`) + `extract_explanation.py`
- `public/mk-photos/` — תמונות ח"כים שהורדו

## git
- repo: https://github.com/navehcohen/knesset-tracker (ענף `main`)
- Claude מטפל בפקודות git — לא צריך לזכור אותן ידנית.

## כללים
- שומרים על עברית/RTL בכל טקסט למשתמש.
- `_legacy/` מכיל קוד jQuery ישן ולא בשימוש (לא נכלל ב-git) — **לא להסתמך עליו**; הקוד הפעיל הוא ב-`app/`.
- הערות פנימיות (`claude-notes/`, קבצי txt) כבר ב-`.gitignore`.
