"use client";

import { useRef, useState } from "react";

// דברי הסבר — רכיב לקוח קטן שמנגיש טקסטים ארוכים:
// • מקופל: תצוגה מקדימה של 4 שורות עם דהייה בתחתית.
// • פתוח: הטקסט בתוך תיבת גלילה בגובה מוגבל — כך הדף לא מתנפח גם לטקסט ענק,
//   וכפתור "הצג פחות" נשאר צמוד מתחת לתיבה (אין צורך לטפס חזרה 900 שורות).
export default function Explanation({
  text,
  source,
  date,
  docUrl,
  billUrl,
}: {
  text: string;
  source: string | null;
  date: string | null;
  docUrl: string;
  billUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);

  // קיפול שמחזיר את המבט לראש הסעיף, כדי לא להישאר תלוי באמצע טקסט ארוך
  const collapse = () => {
    setOpen(false);
    headRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mb-8">
      <h2 ref={headRef} className="mb-2 scroll-mt-4 text-xl font-bold">
        דברי הסבר
      </h2>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        {open ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {text}
            </p>
          </div>
        ) : (
          <div className="relative">
            <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {text}
            </p>
            {/* דהיית הטקסט בתחתית התצוגה המקדימה — רמז ש"יש עוד" */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
        )}

        <button
          type="button"
          onClick={() => (open ? collapse() : setOpen(true))}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          {open ? "הצג פחות ▴" : "קרא עוד ▾"}
        </button>

        {/* מקור + קישור למסמך המלא — בסוף הטקסט, להגעה קלה למקור */}
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
          <p>
            מקור: {source || "מסמך הצעת החוק"}
            {date ? ` · ${date}` : ""} · אתר הכנסת (בלשון היוזם).
          </p>
          <p className="mt-1 text-muted/80">
            הנוסח שהתקבל בפועל עשוי להיות שונה בעקבות דיוני הוועדה.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 hover:bg-blue-100"
            >
              📄 למסמך המלא באתר הכנסת ←
            </a>
            <a
              href={billUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200"
            >
              🔗 לדף החוק באתר הכנסת ←
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
