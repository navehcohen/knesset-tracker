import Link from "next/link";
import { parties, getPartyLogo } from "./data/knesset";
import BrowseToggle from "./components/BrowseToggle";

// שמות מקוצרים לתצוגה בכרטיס (כשהשם הרשמי ארוך מדי)
const PARTY_SHORT_NAME: Record<string, string> = {
  "shas": "התאחדות הספרדים שומרי תורה",
};

export default function Home() {
  const sorted = [...parties].sort((a, b) => b.seats - a.seats);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">מעקב כנסת</h1>
        <p className="mt-3 text-muted">
          כל המידע על חברי הכנסת במקום אחד — לפי מפלגה, חבר/ת כנסת או חוק
        </p>
      </header>

      <BrowseToggle active="parties" />


      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((party) => {
          const logo = getPartyLogo(party.id);
          const displayName = PARTY_SHORT_NAME[party.id] ?? party.name;
          return (
            <Link
              key={party.id}
              href={`/party/${party.id}`}
              className="group flex h-48 flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* לוגו המפלגה */}
              <div className="mb-3 flex h-14 items-center justify-center">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt={`לוגו ${displayName}`}
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : (
                  <div
                    className="h-2 w-12 rounded-full"
                    style={{ backgroundColor: party.color }}
                  />
                )}
              </div>
              <h2 className="line-clamp-2 text-lg font-bold leading-tight">{displayName}</h2>
              <div className="mt-auto flex items-baseline gap-1 pt-2">
                <span className="text-2xl font-bold">{party.seats}</span>
                <span className="text-sm text-muted">מנדטים</span>
              </div>
            </Link>
          );
        })}
      </section>

      <footer className="mt-12 text-center text-xs text-muted">
        נתוני הכנסת ה-25 · גרסת הדגמה
      </footer>
    </main>
  );
}
