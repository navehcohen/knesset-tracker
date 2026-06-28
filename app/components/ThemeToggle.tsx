"use client";

import { useEffect, useState } from "react";

// מתג מצב כהה/בהיר. שומר את הבחירה ב-localStorage תחת המפתח "theme".
// סקריפט קטן ב-layout מחיל את הבחירה לפני הציור הראשון כדי למנוע הבהוב.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  // עד שהרכיב נטען בצד-לקוח, לא מציגים אייקון כדי למנוע אי-התאמה עם השרת
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "עבור למצב בהיר" : "עבור למצב כהה"}
      title={dark ? "מצב בהיר" : "מצב כהה"}
      className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-sm text-muted transition hover:bg-card"
    >
      {mounted ? (dark ? "☀️" : "🌙") : "🌙"}
    </button>
  );
}
