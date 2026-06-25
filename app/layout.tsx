import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import SearchBox from "./components/SearchBox";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "מעקב כנסת — כל המידע על חברי הכנסת",
  description:
    "אתר שמנגיש לאזרחי ישראל את כל המידע על חברי הכנסת: הצבעות, חוקים, ועדות ועוד.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="shrink-0 text-lg font-bold">
              מעקב כנסת
            </Link>
            <div className="max-w-md flex-1">
              <SearchBox />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
