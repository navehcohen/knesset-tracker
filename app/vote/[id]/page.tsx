import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import { getVote, getVoteMemberChoices, type VoteChoice } from "../../data/knesset";

const KNESSET_SEATS = 120;

const choiceLabel: Record<VoteChoice, string> = {
  for: "בעד",
  against: "נגד",
  abstain: "נמנע",
  other: "אחר",
};
const choiceColor: Record<VoteChoice, string> = {
  for: "text-green-700",
  against: "text-red-700",
  abstain: "text-amber-600",
  other: "text-gray-500",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vote = getVote(Number(id));
  if (!vote) return { title: "הצבעה — מעקב כנסת" };
  return { title: `${vote.title} — מעקב כנסת`, description: `תוצאות ההצבעה: ${vote.decision}.` };
}

function voteUrl(voteId: number): string {
  return `https://main.knesset.gov.il/Activity/plenum/Votes/Pages/vote.aspx?voteId=${voteId}`;
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const voteId = Number(id);
  if (!Number.isFinite(voteId)) notFound();
  const vote = getVote(voteId);
  if (!vote) notFound();

  const groups = getVoteMemberChoices(voteId);
  const voted = vote.totalFor + vote.totalAgainst + vote.totalAbstain;
  const total = voted || 1;
  const notVoted = Math.max(0, KNESSET_SEATS - voted);
  const cell = "rounded-lg border border-border bg-card px-2 py-1.5 text-center";
  const order: VoteChoice[] = ["for", "against", "abstain"];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <BackButton fallback="/" />

      <header className="mb-6 mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-snug">{vote.title}</h1>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
              vote.accepted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {vote.accepted ? "התקבל" : "לא התקבל"}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {vote.dateStr} · {vote.decision}
        </p>
      </header>

      {/* התפלגות הקולות */}
      <section className="mb-6">
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="bg-green-500" style={{ width: `${(vote.totalFor / total) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(vote.totalAgainst / total) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(vote.totalAbstain / total) * 100}%` }} />
        </div>
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
      </section>

      {/* מי הצביע ואיך */}
      {order.some((c) => groups[c].length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">איך כל ח&quot;כ הצביע</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {order.map((c) => (
              <div key={c}>
                <div className={`mb-1 text-sm font-bold ${choiceColor[c]}`}>
                  {choiceLabel[c]} ({groups[c].length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {groups[c].map((m) => (
                    <Link
                      key={m.memberId}
                      href={`/member/${m.memberId}`}
                      className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-card"
                    >
                      {m.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <a
        href={voteUrl(voteId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        🔗 לרשומת ההצבעה באתר הכנסת ←
      </a>
    </main>
  );
}
