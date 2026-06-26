import Link from "next/link";

// מתג מעבר בין תצוגת מפלגות לתצוגת חברי כנסת
export default function BrowseToggle({ active }: { active: "parties" | "members" }) {
  const base = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  const on = "bg-blue-600 text-white";
  const off = "border border-border text-muted hover:bg-card";
  return (
    <div className="mb-6 flex justify-center gap-2">
      <Link href="/" className={`${base} ${active === "parties" ? on : off}`}>
        לפי מפלגה
      </Link>
      <Link href="/members" className={`${base} ${active === "members" ? on : off}`}>
        לפי חברי הכנסת
      </Link>
    </div>
  );
}
