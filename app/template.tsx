// template.tsx נטען מחדש בכל ניווט (בניגוד ל-layout) — לכן זה המקום הנכון
// לאנימציית כניסה עדינה שתיתן תחושת מעבר נעים בין הלשוניות והדפים.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
