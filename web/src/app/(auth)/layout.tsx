import Link from "next/link";

import { KiteMark, Logo } from "@/components/ui/kite-mark";

/** Split layout: maroon brand panel (desktop only) beside the form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="kite-pattern relative hidden flex-col justify-between overflow-hidden bg-maroon-900 p-10 text-white lg:flex">
        <Link href="/" aria-label="Kite Platform home">
          <Logo inverted />
        </Link>
        <div className="grid max-w-md gap-4">
          <h2 className="text-4xl leading-tight font-bold">Shops, tournaments and the people who fly.</h2>
          <p className="text-maroon-100">
            Buy from verified kite shops, register for approved tournaments and follow the rankings in your city.
          </p>
        </div>
        <p className="text-sm text-maroon-100/80">
          Fly safely. Use only materials allowed by local law. Dangerous or banned strings are never sold here.
        </p>
        <KiteMark size={280} body="#6b1a1a" wing="#9b3b3b" className="pointer-events-none absolute -right-16 -bottom-10 opacity-40" />
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Link href="/" aria-label="Kite Platform home">
            <Logo />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
