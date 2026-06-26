import Link from "next/link";

// מתג מעבר בין תצוגות: מפלגות / חברי כנסת / חוקים
export default function BrowseToggle({
  active,
}: {
  active: "parties" | "members" | "laws";
}) {
  const base = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  const on = "bg-blue-600 text-white";
  const off = "border border-border text-muted hover:bg-card";
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-2">
      <Link href="/" className={`${base} ${active === "parties" ? on : off}`}>
        לפי מפלגה
      </Link>
      <Link href="/members" className={`${base} ${active === "members" ? on : off}`}>
        לפי חברי הכנסת
      </Link>
      <Link href="/laws" className={`${base} ${active === "laws" ? on : off}`}>
        לפי חוקים
      </Link>
    </div>
  );
}
