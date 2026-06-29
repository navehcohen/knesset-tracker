"use client";

// פס התקדמות דק בראש המסך — נדלק ברגע שלוחצים על קישור פנימי
// ונעלם כשהדף החדש נטען. נותן משוב מיידי ש"הלחיצה נקלטה" גם כשההורדה
// מהרשת לוקחת רגע (במיוחד בכניסה ראשונה, לפני שיש cache).

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const url = qs ? `${pathname}?${qs}` : pathname;

  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrl = useRef(url); // הכתובת הקודמת — להבחין במעבר אמיתי

  function clearTimers() {
    if (trickle.current) clearInterval(trickle.current);
    if (fade.current) clearTimeout(fade.current);
    if (safety.current) clearTimeout(safety.current);
  }

  function start() {
    clearTimers();
    setActive(true);
    setWidth(12);
    // זחילה הדרגתית עד ~90% (לא מגיעים ל-100% עד שהדף באמת נטען)
    trickle.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 250);
    // רשת ביטחון: אם משום מה המעבר לא הושלם, לא משאירים פס תקוע
    safety.current = setTimeout(finish, 10000);
  }

  function finish() {
    clearTimers();
    setWidth(100);
    fade.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 250);
  }

  // האזנה ללחיצות על קישורים פנימיים בכל האתר
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return; // רק קישורים פנימיים
      if (a.target === "_blank") return;
      if (href === prevUrl.current) return; // אותו דף — אין מעבר
      start();
    }
    // שלב ה-capture — לפני ש-Next.js תופס את הלחיצה וקורא preventDefault
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // השלמת הפס רק כשהכתובת השתנתה בפועל (מעבר הסתיים)
  useEffect(() => {
    if (prevUrl.current !== url) {
      prevUrl.current = url;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => clearTimers, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      style={{ opacity: active ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="h-full bg-blue-600 shadow-[0_0_8px] shadow-blue-500/50"
        style={{ width: `${width}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}

export default function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressInner />
    </Suspense>
  );
}
