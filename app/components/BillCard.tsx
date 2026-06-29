import Link from "next/link";
import { getBillMainVote, type Bill, type BillCategory } from "../data/knesset";
import VoteTallyBar from "./VoteTallyBar";

const CATEGORY_BADGE: Record<BillCategory, string> = {
  passed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  stopped: "bg-gray-200 text-gray-700",
};

// סרגל הצבעה קומפקטי (איפה שיש הצבעה סופית מקושרת לחוק)
function MiniTally({ billId }: { billId: number }) {
  const v = getBillMainVote(billId);
  if (!v) return null;
  return (
    <div className="mt-2">
      <VoteTallyBar vote={v} />
    </div>
  );
}

// כרטיס חוק אחיד — בשימוש בדף החוקים ובתוצאות החיפוש.
// showTally מציג את סרגל ההצבעה הסופית (בחיפוש מושאר כבוי כדי לשמור על קומפקטיות).
export default function BillCard({
  bill,
  showTally = false,
}: {
  bill: Bill;
  showTally?: boolean;
}) {
  return (
    <Link
      href={`/law/${bill.billId}`}
      className="block rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="font-medium leading-snug">{bill.name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[bill.category]}`}
        >
          {bill.statusDesc || bill.category}
        </span>
        {bill.subType ? <span className="text-xs text-muted">{bill.subType}</span> : null}
      </div>
      {showTally ? <MiniTally billId={bill.billId} /> : null}
    </Link>
  );
}
