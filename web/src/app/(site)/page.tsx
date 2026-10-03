import { CalendarDays, ShieldCheck, Store, Trophy, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { ProductGrid } from "@/components/market/product-card";
import { ShopCard } from "@/components/market/shop-card";
import { PostCard } from "@/components/community/post-card";
import { KitePreview } from "@/components/designer/kite-preview";
import { EventCard } from "@/components/events/event-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { ButtonLink } from "@/components/ui/button";
import { KiteMark } from "@/components/ui/kite-mark";
import { apiPage } from "@/lib/api";
import type { ProductCard, ShopCard as Shop } from "@/lib/market";
import type { PostView } from "@/lib/community";
import { DEFAULT_DESIGN } from "@/lib/designer";
import type { EventCard as Event } from "@/lib/events";
import type { TournamentCard as Tournament } from "@/lib/tournaments";

const pillars: { icon: LucideIcon; title: string; body: string; href: string }[] = [
  { icon: Store, title: "Marketplace", body: "Kites, charkhis and accessories from verified shops across Pakistan.", href: "/marketplace" },
  { icon: Trophy, title: "Tournaments", body: "Approved competitions with brackets, official results and live match status.", href: "/tournaments" },
  { icon: CalendarDays, title: "Events", body: "Festivals, exhibitions and workshops, with online registration.", href: "/events" },
  { icon: Users, title: "Community", body: "Share photos and videos, follow flyers and shops you like.", href: "/community" },
];

const steps = [
  { title: "Create your account", body: "Verify your email and set up a profile with your city." },
  { title: "Shop or register", body: "Order from verified sellers or sign up for an approved tournament." },
  { title: "Fly and climb", body: "Official results feed the city and national rankings." },
];

export default async function HomePage() {
  // Real marketplace data only; a section is hidden until it has something to show.
  const [products, shops, tournaments, posts, events] = await Promise.all([
    apiPage<ProductCard>("/products", { query: { sort: "popular", inStock: "true", pageSize: 8 } }).catch(() => null),
    apiPage<Shop>("/shops", { query: { sort: "popular", pageSize: 3 } }).catch(() => null),
    apiPage<Tournament>("/tournaments", { query: { view: "upcoming", pageSize: 3 } }).catch(() => null),
    apiPage<PostView>("/feed", { query: { pageSize: 2 } }).catch(() => null),
    apiPage<Event>("/events", { query: { pageSize: 3 } }).catch(() => null),
  ]);

  return (
    <>
      <section className="kite-pattern relative overflow-hidden bg-maroon-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[3fr_2fr]">
          <div className="grid gap-6">
            <p className="text-sm font-semibold tracking-[0.1em] text-maroon-100 uppercase">Pakistan’s kite platform</p>
            <h1 className="max-w-2xl text-4xl leading-tight font-bold sm:text-5xl">
              Kite shops, organised tournaments and the people who fly.
            </h1>
            <p className="max-w-xl text-lg text-maroon-100">
              Buy from trusted sellers, register for approved competitions and follow official rankings, all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/marketplace" size="lg" className="!bg-white !text-maroon-900 hover:!bg-maroon-100">
                Browse the marketplace
              </ButtonLink>
              <ButtonLink href="/tournaments" size="lg" variant="secondary" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10">
                See tournaments
              </ButtonLink>
            </div>
          </div>
          <div className="hidden justify-self-center lg:block">
            <KiteMark size={260} body="#6b1a1a" wing="#9b3b3b" />
          </div>
        </div>
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 id="pillars" className="mb-8 text-2xl font-semibold sm:text-3xl">Everything kite flying needs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ icon: Icon, title, body, href }) => (
            <Link key={title} href={href} className="group grid content-start gap-3 rounded-md border border-border bg-surface p-6 transition-colors hover:border-primary">
              <span className="inline-flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="text-lg font-semibold group-hover:text-primary">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </Link>
          ))}
        </div>
      </section>

      {products && products.data.length > 0 && (
        <section aria-labelledby="featured" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="featured" className="text-2xl font-semibold sm:text-3xl">Popular right now</h2>
            <Link href="/marketplace?sort=popular" className="text-sm font-semibold text-primary hover:underline">See all</Link>
          </div>
          <ProductGrid products={products.data} />
        </section>
      )}

      {tournaments && tournaments.data.length > 0 && (
        <section aria-labelledby="upcoming-t" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="upcoming-t" className="text-2xl font-semibold sm:text-3xl">Upcoming tournaments</h2>
            <Link href="/tournaments" className="text-sm font-semibold text-primary hover:underline">All tournaments</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tournaments.data.map((t) => <TournamentCard key={t.id} t={t} />)}</div>
        </section>
      )}

      {events && events.data.length > 0 && (
        <section aria-labelledby="upcoming-e" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="upcoming-e" className="text-2xl font-semibold sm:text-3xl">Upcoming events</h2>
            <Link href="/events" className="text-sm font-semibold text-primary hover:underline">All events</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{events.data.map((e) => <EventCard key={e.id} e={e} />)}</div>
        </section>
      )}

      <section aria-labelledby="designer-cta" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid items-center gap-6 overflow-hidden rounded-md border border-border bg-surface p-6 sm:grid-cols-[1fr_200px] sm:p-10">
          <div className="grid gap-3">
            <h2 id="designer-cta" className="text-2xl font-semibold sm:text-3xl">Design your own kite</h2>
            <p className="max-w-xl text-muted">Choose a shape, colours, a pattern and your team name. Save it and ask a shop for a quote; when you accept, it becomes a normal order you can track.</p>
            <div><ButtonLink href="/designer">Open the designer</ButtonLink></div>
          </div>
          <KitePreview design={{ ...DEFAULT_DESIGN, text: "Your team" }} className="mx-auto h-56 w-full max-w-[180px]" title="Example kite design" />
        </div>
      </section>

      {shops && shops.data.length > 0 && (
        <section aria-labelledby="popular-shops" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="popular-shops" className="text-2xl font-semibold sm:text-3xl">Popular shops</h2>
            <Link href="/shops" className="text-sm font-semibold text-primary hover:underline">All shops</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shops.data.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
        </section>
      )}

      {posts && posts.data.length > 0 && (
        <section aria-labelledby="from-community" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="from-community" className="text-2xl font-semibold sm:text-3xl">From the community</h2>
            <Link href="/community" className="text-sm font-semibold text-primary hover:underline">Open community</Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">{posts.data.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}

      <section aria-labelledby="how" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 id="how" className="mb-8 text-2xl font-semibold sm:text-3xl">How it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="grid content-start gap-2">
                <span className="font-display text-sm font-bold text-highlight">Step {i + 1}</span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="safety" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 rounded-lg bg-primary-soft p-8 md:grid-cols-[auto_1fr] md:items-start">
          <ShieldCheck className="size-10 text-primary" aria-hidden="true" />
          <div className="grid gap-2">
            <h2 id="safety" className="text-2xl font-semibold">Safety comes first</h2>
            <p className="max-w-3xl text-muted">
              Every tournament on Kite Platform must follow local law, venue rules, approved materials and age
              requirements. Metal, glass-coated and other dangerous strings are never sold. Report anything unsafe and our
              moderators will review it.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
