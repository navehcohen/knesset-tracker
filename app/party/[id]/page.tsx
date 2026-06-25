import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getParty,
  getPartyMembers,
  getPhoto,
  type Member,
  type Party,
} from "../../data/knesset";

// מחזיר את ראשי התיבות של השם (לעיגול האווטאר)
function initials(name: string): string {
  const parts = name.replace(/['"]/g, "").split(" ");
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

function MemberCard({ member, party }: { member: Member; party: Party }) {
  const isFormer = member.status === "former";
  const photo = getPhoto(member.id);
  return (
    <Link
      href={`/member/${member.id}`}
      className={`group block rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
        isFormer ? "opacity-70" : ""
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={member.name}
          className={`mb-3 h-16 w-16 rounded-full object-cover ${
            isFormer ? "grayscale" : ""
          }`}
        />
      ) : (
        <div
          className="mb-3 flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: isFormer ? "#9ca3af" : party.color }}
        >
          {initials(member.name)}
        </div>
      )}
      <h2 className="text-base font-bold leading-tight">{member.name}</h2>
      {isFormer ? (
        <span className="mt-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
          פרש מהכנסת
        </span>
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
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← חזרה למפלגות
      </Link>

      <header className="mb-8 mt-4 flex items-center gap-4">
        <div
          className="h-12 w-3 rounded-full"
          style={{ backgroundColor: party.color }}
        />
        <div>
          <h1 className="text-3xl font-bold">{party.name}</h1>
          <p className="mt-1 text-muted">{party.seats} חברי כנסת</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {current.map((member) => (
          <MemberCard key={member.id} member={member} party={party} />
        ))}
      </section>

      {former.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-muted">
            כיהנו בעבר ופרשו ({former.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {former.map((member) => (
              <MemberCard key={member.id} member={member} party={party} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
