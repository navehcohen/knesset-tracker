// מד הצבעה אחיד (בעד/נגד/נמנע). שני מצבים:
//   inline   — סרגל דק + מקרא קצר בשורה (כרטיס חוק, רשימת הצבעות בדף הח"כ)
//   detailed — סרגל + טבלת 4 תאים כולל "לא הצביעו" (דף הצבעה, דף חוק)

const KNESSET_SEATS = 120; // לחישוב "לא הצביעו" במצב detailed

type Tally = { totalFor: number; totalAgainst: number; totalAbstain: number };

export default function VoteTallyBar({
  vote,
  variant = "inline",
}: {
  vote: Tally;
  variant?: "inline" | "detailed";
}) {
  const voted = vote.totalFor + vote.totalAgainst + vote.totalAbstain;
  const total = voted || 1;

  const bar = (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
      <div className="bg-green-500" style={{ width: `${(vote.totalFor / total) * 100}%` }} />
      <div className="bg-red-500" style={{ width: `${(vote.totalAgainst / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(vote.totalAbstain / total) * 100}%` }} />
    </div>
  );

  if (variant === "detailed") {
    const notVoted = Math.max(0, KNESSET_SEATS - voted);
    const cell = "rounded-lg border border-border bg-card px-2 py-1.5 text-center";
    return (
      <div>
        {bar}
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
          <div className={cell}>
            <div className="font-bold text-green-700">{vote.totalFor}</div>
            <div className="text-muted">בעד</div>
          </div>
          <div className={cell}>
            <div className="font-bold text-red-700">{vote.totalAgainst}</div>
            <div className="text-muted">נגד</div>
          </div>
          <div className={cell}>
            <div className="font-bold text-amber-600">{vote.totalAbstain}</div>
            <div className="text-muted">נמנע</div>
          </div>
          <div className={cell}>
            <div className="font-bold text-gray-500">{notVoted}</div>
            <div className="text-muted">לא הצביעו</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {bar}
      <div className="mt-1 flex gap-3 text-xs text-muted">
        <span className="text-green-700">בעד {vote.totalFor}</span>
        <span className="text-red-700">נגד {vote.totalAgainst}</span>
        <span className="text-amber-600">נמנע {vote.totalAbstain}</span>
      </div>
    </div>
  );
}
