// תיבת חיפוש — טופס GET פשוט שמנווט ל-/search?q=...
// אין צורך ב-"use client": זה טופס HTML רגיל שעובד בלי JavaScript.
export default function SearchBox({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/search" method="get" role="search" className="relative block w-full">
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        {/* אייקון זכוכית מגדלת */}
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
