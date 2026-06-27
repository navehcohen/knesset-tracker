"use client";

// תיבת חיפוש — מנווטת ל-/search?q=...
// עם JavaScript: ניווט צד-לקוח + ספינר טעינה בתוך התיבה (מראה שהדף מחפש).
// בלי JavaScript: נופל בחזרה לטופס GET רגיל (action/method למטה) — עדיין עובד.
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function SearchBox({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get("q") ?? "").toString().trim();
    startTransition(() => {
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    });
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      onSubmit={handleSubmit}
      className="relative block w-full"
    >
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        {isPending ? (
          // ספינר מסתובב — מראה שהדף מחפש כרגע
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          // אייקון זכוכית מגדלת
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="חיפוש ח״כ, הצעת חוק או נושא…"
        aria-label="חיפוש"
        className="w-full rounded-full border border-border bg-card py-2 pr-10 pl-4 text-sm outline-none transition focus:border-gray-400 focus:shadow-sm"
      />
    </form>
  );
}
