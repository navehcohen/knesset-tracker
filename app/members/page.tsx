import Link from "next/link";
import { members, getParty, getPhoto, type Member, type Party } from "../data/knesset";
import BrowseToggle from "../components/BrowseToggle";

// שם פרטי = המילה הראשונה בשם (הסינון לפי אות והמיון לפי שם פרטי)
function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[0] || name;
}
function firstLetter(name: string): string {
  return firstName(name).replace(/["'`׳״]/g, "").charAt(0);
}
function initials(name: string): string {
  const parts = name.replace(/['"]/g, "").split(" ");
  return parts.slice(0, 2).map((p) => p[0]).join("");
}
function byFirstName(a: Member, b: Member): number {
  return firstName(a.name).localeCompare(firstName(b.name), "he");
}

function Avatar({ member, party, size }: { member: Member; party?: Party; size: number }) {
  const photo = getPhoto(member.id);
  const isFormer = member.status === "former";
  const cls = `shrink-0 rounded-full object-cover ${isFormer ? "grayscale" : ""}`;
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={member.name} className={cls} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size / 3,
        backgroundColor: isFormer ? "#9ca3af" : party?.color ?? "#6b7280",
      }}
    >
      {initials(member.name)}
    </div>
  );
}

function GridCard({ member }: { member: Member }) {
  const party = getParty(member.partyId);
  return (
    <Link
      href={`/member/${member.id}`}
      className={`flex flex-col items-center rounded-2xl border border-border bg-card p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
        member.status === "former" ? "opacity-70" : ""
      }`}
    >
      <Avatar member={member} party={party} size={60} />
      <h2 className="mt-2 text-sm font-bold leading-tight sm:mt-3">{member.name}</h2>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{party?.name ?? ""}</p>
    </Link>
  );
}

function ListRow({ member }: { member: Member }) {
  const party = getParty(member.partyId);
  return (
    <Link
      href={`/member/${member.id}`}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition hover:shadow-md ${
        member.status === "former" ? "opacity-70" : ""
      }`}
    >
      <Avatar member={member} party={party} size={44} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">{member.name}</p>
        <p className="truncate text-xs text-muted">
          {party?.name ?? ""}
          {member.status === "former"
            ? member.roles.length > 0
              ? ` · ${member.roles[0]} · פרש מהכנסת`
              : " · פרש מהכנסת"
            : ""}
        </p>
      </div>
    </Link>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; letter?: string }>;
}) {
  const sp = await searchParams;
  const isList = sp.view === "list";
  const letter = sp.letter || "";

  const current = members.filter((m) => m.status === "current").sort(byFirstName);
  const former = members.filter((m) => m.status === "former").sort(byFirstName);

  // אותיות זמינות (לפי שם פרטי של הח"כים הנוכחיים)
  const letters = [...new Set(current.map((m) => firstLetter(m.name)))].sort((a, b) =>
    a.localeCompare(b, "he")
  );
  const shown = letter ? current.filter((m) => firstLetter(m.name) === letter) : current;

  // בונה קישור תוך שמירת הפרמטר השני
  const hrefWith = (next: { view?: string; letter?: string }) => {
    const view = next.view ?? (isList ? "list" : "");
    const lt = next.letter ?? letter;
    const q = new URLSearchParams();
    if (view === "list") q.set("view", "list");
    if (lt) q.set("letter", lt);
    const s = q.toString();
    return s ? `/members?${s}` : "/members";
  };

  const pill = "rounded-full px-3 py-1 text-xs font-medium transition-colors";
  const on = "bg-blue-600 text-white";
  const off = "border border-border text-muted hover:bg-card";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:py-8">
      <BrowseToggle active="members" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">חברי הכנסת ה-25</h1>
        {/* מתג רשת / רשימה */}
        <div className="flex gap-2">
          <Link href={hrefWith({ view: "" })} className={`${pill} ${!isList ? on : off}`}>
            ⊞ תצוגת רשת
          </Link>
          <Link href={hrefWith({ view: "list" })} className={`${pill} ${isList ? on : off}`}>
            ☰ תצוגת רשימה
          </Link>
        </div>
      </div>

      {/* סינון לפי אות (שם פרטי) — חץ קטן שפותח את רשימת האותיות */}
      <details open={!!letter} className="group mb-6">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-card">
          <span>סינון לפי אות{letter ? `: ${letter}` : ""}</span>
          <span className="text-[10px] leading-none transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link href={hrefWith({ letter: "" })} className={`${pill} ${!letter ? on : off}`}>
            הכל
          </Link>
          {letters.map((l) => (
            <Link
              key={l}
              href={hrefWith({ letter: l })}
              className={`${pill} ${letter === l ? on : off}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </details>

      {/* הח"כים הנוכחיים */}
      {isList ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shown.map((m) => (
            <ListRow key={m.id} member={m} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((m) => (
            <GridCard key={m.id} member={m} />
          ))}
        </div>
      )}

      {/* מי שפרש — רק כשאין סינון לאות, בתחתית */}
      {!letter && former.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-muted">
            כיהנו בעבר ופרשו ({former.length})
          </h2>
          {isList ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {former.map((m) => (
                <ListRow key={m.id} member={m} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {former.map((m) => (
                <GridCard key={m.id} member={m} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
