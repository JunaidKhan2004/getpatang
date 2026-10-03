"use client";

import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ADMIN_NAV } from "@/app/admin/nav";
import { logoutAction } from "@/app/actions/auth";
import { SELLER_NAV } from "@/app/seller/nav";
import { Logo } from "@/components/ui/kite-mark";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to people with this permission (the API checks again). */
  permission?: string;
}

/** Shared frame for the seller and admin dashboards: maroon sidebar + top bar. */
const AREAS = {
  admin: { label: "Admin", nav: ADMIN_NAV },
  seller: { label: "Seller", nav: SELLER_NAV },
};

export function DashboardShell({
  area: areaKey,
  userName,
  permissions,
  children,
}: {
  area: keyof typeof AREAS;
  userName: string;
  permissions?: string[];
  children: React.ReactNode;
}) {
  // Navigation is resolved here, in the client component, because icon components cannot be passed from the server.
  const { label: area, nav: allNav } = AREAS[areaKey];
  const nav = permissions ? allNav.filter((n) => !n.permission || permissions.includes(n.permission)) : allNav;
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof value === "function" ? value(open) : value) ? pathname : null);

  const root = nav[0].href;
  const isActive = (href: string) => (href === root ? pathname === root : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label={`${area} navigation`} className="grid gap-0.5">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-maroon-100 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-maroon-900"
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="kite-pattern sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-maroon-900 p-4 lg:flex">
        <Link href="/" className="px-2 pt-2" aria-label="Kite Platform home">
          <Logo inverted />
        </Link>
        <p className="px-3 text-xs font-semibold tracking-[0.1em] text-maroon-100/70 uppercase">{area}</p>
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${area} menu`}>
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="kite-pattern relative flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-maroon-900 p-4">
            <div className="flex items-center justify-between px-2 pt-2">
              <Logo inverted />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-white" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button className="rounded-md p-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold">{area}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{userName}</span>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-2">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
