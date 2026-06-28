"use client";

// כפתור "חזרה לעמוד הקודם": חוזר בהיסטוריית הדפדפן אם אפשר, אחרת נופל
// ל-fallback (הדף ההורה ההגיוני) — למקרה כניסה ישירה מקישור/חיפוש בלי היסטוריה.
import { useRouter } from "next/navigation";

export default function BackButton({
  fallback = "/",
  label = "חזרה",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="text-sm text-muted hover:underline"
    >
      ← {label}
    </button>
  );
}
