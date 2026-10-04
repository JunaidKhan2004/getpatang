import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";

import type { ShopCard as Shop } from "@/lib/market";

import { Stars } from "./product-card";
import { getT } from "@/lib/i18n/server";

export function ShopLogo({ shop, size = "md" }: { shop: Pick<Shop, "name" | "logoUrl">; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-20 text-3xl" : "size-12 text-lg";
  if (shop.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={shop.logoUrl} alt="" className={`${cls} shrink-0 rounded-md border border-border object-cover`} />;
  }
  return (
    <span aria-hidden="true" className={`${cls} inline-flex shrink-0 items-center justify-center rounded-md bg-primary font-display font-semibold text-primary-ink`}>
      {shop.name.charAt(0)}
    </span>
  );
}

export async function ShopCard({ shop }: { shop: Shop }) {
  const t = await getT();
  return (
    <Link href={`/shops/${shop.slug}`} className="group flex gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-primary">
      <ShopLogo shop={shop} />
      <div className="grid min-w-0 gap-1">
        <span className="flex items-center gap-1 font-display font-semibold group-hover:text-primary">
          <span className="truncate">{shop.name}</span>
          {shop.isVerified && <BadgeCheck className="size-4 shrink-0 text-info" aria-label={t("Verified shop")} />}
        </span>
        <span className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-3.5" aria-hidden="true" />
          {shop.city}
        </span>
        <Stars value={shop.ratingAvg} count={shop.ratingCount} />
        <span className="text-xs text-muted">
          {shop.followerCount.toLocaleString("en-PK")} {" "}{t("followers")}{shop.productCount !== undefined && t("· {productCount} products", { productCount: shop.productCount })}
        </span>
      </div>
    </Link>
  );
}
