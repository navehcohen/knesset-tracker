// מסך-שלד שמופיע בזמן שהשרת מכין את תוצאות החיפוש (cold-start / חיפוש כבד)
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="h-4 w-28 animate-pulse rounded bg-card" />
      <div className="mt-4 h-10 w-full animate-pulse rounded-full bg-card" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-card" />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">מחפש…</p>
    </main>
  );
}
