import Link from "next/link";

import { Logo } from "@/components/ui/kite-mark";

const columns = [
  {
    title: "Explore",
    links: [
      { href: "/marketplace", label: "Marketplace" },
      { href: "/shops", label: "Shops" },
      { href: "/tournaments", label: "Tournaments" },
      { href: "/events", label: "Events" },
      { href: "/designer", label: "Kite designer" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/about", label: "About" },
      { href: "/seller", label: "Sell on Kite Platform" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="kite-pattern mt-auto bg-maroon-950 text-maroon-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="grid content-start gap-3">
          <Logo inverted />
          <p className="max-w-xs text-sm">
            The digital home for kite lovers, kite shops, events and organised competitions in Pakistan.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title} className="grid content-start gap-2">
            <h2 className="font-display text-sm font-semibold text-white">{col.title}</h2>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm hover:text-white hover:underline">
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6">
          © {new Date().getFullYear()} Kite Platform. Fly safely and follow local laws. Metal, glass-coated and other
          prohibited strings are not allowed on this platform.
        </p>
      </div>
    </footer>
  );
}
