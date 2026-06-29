import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "../../components/BackButton";
import MemberAvatar from "../../components/MemberAvatar";
import {
  getParty,
  getPartyMembers,
  type Member,
} from "../../data/knesset";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const party = getParty(id);
  if (!party) return { title: "מפלגה — מעקב כנסת" };
  return {
    title: `${party.name} — מעקב כנסת`,
    description: `חברי הכנסת של ${party.name} (${party.seats} מנדטים) — הצבעות וחוקים.`,
  };
}

function MemberCard({ member }: { member: Member }) {
  const isFormer = member.status === "former";
  return (
    <Link
      href={`/member/${member.id}`}
      className={`group block rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
        isFormer ? "opacity-70" : ""
      }`}
    >
      <MemberAvatar
        member={member}
        className="mb-2 h-14 w-14 sm:mb-3 sm:h-16 sm:w-16"
        textClassName="text-sm"
      />
      <h2 className="text-sm font-bold leading-tight sm:text-base">{member.name}</h2>
      {isFormer ? (
        member.roles.length > 0 ? (
          // פרש ממושב הכנסת אך מכהן בתפקיד (חוק נורבגי) — מציגים את התפקיד
          <p className="mt-2 text-xs font-medium text-blue-800">
            {member.roles[0]}
            <span className="font-normal text-muted"> · פרש מהכנסת</span>
          </p>
        ) : (
          <span className="mt-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
            פרש מהכנסת
          </span>
        )
      ) : member.roles.length > 0 ? (
        <p className="mt-2 text-xs font-medium text-blue-800">
          {member.roles[0]}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">חבר/ת כנסת</p>
      )}
    </Link>
  );
}

export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const party = getParty(id);
  if (!party) notFound();

  const members = getPartyMembers(id);
  const current = members.filter((m) => m.status === "current");
  const former = members.filter((m) => m.status === "former");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <BackButton fallback="/" />

      <header className="mb-6 mt-4 flex items-center gap-4 sm:mb-8">
        <div
          className="h-12 w-3 rounded-full"
          style={{ backgroundColor: party.color }}
        />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{party.name}</h1>
          <p className="mt-1 text-muted">{party.seats} חברי כנסת</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {current.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </section>

      {former.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-muted">
            כיהנו בעבר ופרשו ({former.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {former.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
