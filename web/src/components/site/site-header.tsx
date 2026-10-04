"use client";

import { Bell, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/ui/kite-mark";
import { useT } from "@/lib/i18n/client";

import { LanguageSwitch } from "./language-switch";

export const SITE_NAV = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/shops", label: "Shops" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/rankings", label: "Rankings" },
  { href: "/events", label: "Events" },
  { href: "/community", label: "Community" },
];

const iconBtn = "inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-surface-2";

export function SiteHeader({ userName, cartCount = 0, unreadCount = 0 }: { userName: string | null; cartCount?: number; unreadCount?: number }) {
  const t = useT();
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof value === "function" ? value(open) : value) ? pathname : null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={t("GetPatang home")} className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label={t("Main")} className="ms-4 hidden items-center gap-1 lg:flex">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitch className="hidden sm:inline-flex" />
          <Link href="/search" className={iconBtn} aria-label={t("Search")}>
            <Search className="size-5" />
          </Link>
          <Link href="/notifications" className={`${iconBtn} relative`} aria-label={unreadCount ? t("Notifications, {unreadCount} unread", { unreadCount }) : t("Notifications")}>
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-ink tabular-nums">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/cart" className={`${iconBtn} relative`} aria-label={cartCount ? t("Cart, {cartCount} items", { cartCount }) : t("Cart")}>
            <ShoppingBag className="size-5" />
            {cartCount > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-ink tabular-nums">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          {userName ? (
            <Link
              href="/account"
              className="ms-1 hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-2 sm:inline-flex"
            >
              <User className="size-4" />
              {userName}
            </Link>
          ) : (
            <Link
              href="/login"
              className="ms-1 hidden h-10 items-center rounded-md bg-primary px-4 font-display text-sm font-semibold text-primary-ink hover:bg-primary-hover sm:inline-flex"
            >
              {t("Sign in")}</Link>
          )}
          <button
            type="button"
            className={`${iconBtn} lg:hidden`}
            aria-label={open ? t("Close menu") : t("Open menu")}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label={t("Main")} className="grid gap-1 border-t border-border px-4 py-3 lg:hidden">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className="rounded-md px-3 py-2.5 font-medium aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              {t(item.label)}
            </Link>
          ))}
          <Link href={userName ? "/account" : "/login"} className="rounded-md px-3 py-2.5 font-semibold text-primary">
            {userName ? t("My account") : t("Sign in")}
          </Link>
          <LanguageSwitch className="justify-start sm:hidden" />
        </nav>
      )}
    </header>
  );
}
