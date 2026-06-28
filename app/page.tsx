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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-6 text-center sm:mb-10">
        {/* גודל נוזלי: גדל/מתכווץ ברצף לפי רוחב המסך (clamp) — בלי קפיצות */}
        <h1 className="text-[clamp(1.5rem,6vw,2.25rem)] font-bold">מעקב כנסת 25</h1>
        <p className="mt-2 text-sm text-muted sm:mt-3 sm:text-base">
          כל המידע על חברי הכנסת במקום אחד — לפי מפלגה, חבר/ת כנסת או חוק
        </p>
      </header>

      <BrowseToggle active="parties" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {sorted.map((party) => {
          const logo = getPartyLogo(party.id);
          const displayName = PARTY_SHORT_NAME[party.id] ?? party.name;
          return (
            <Link
              key={party.id}
              href={`/party/${party.id}`}
              className="group flex h-28 flex-col rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md sm:h-36 sm:p-4"
            >
              {/* לוגו המפלגה */}
              <div className="mb-1.5 flex h-8 items-center justify-center sm:mb-2 sm:h-10">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt={`לוגו ${displayName}`}
                    className="max-h-8 max-w-full object-contain sm:max-h-10"
                  />
                ) : (
                  <div
                    className="h-2 w-12 rounded-full"
                    style={{ backgroundColor: party.color }}
                  />
                )}
              </div>
              <h2 className="line-clamp-2 text-sm font-bold leading-tight sm:text-base">{displayName}</h2>
              <div className="mt-auto flex items-baseline gap-1 pt-1.5 sm:pt-2">
                <span className="text-lg font-bold sm:text-xl">{party.seats}</span>
                <span className="text-xs text-muted sm:text-sm">מנדטים</span>
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
