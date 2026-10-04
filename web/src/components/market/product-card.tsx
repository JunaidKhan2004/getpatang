import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { formatPKR, type ImageRef, type ProductCard as Product } from "@/lib/market";

import { KiteMark } from "../ui/kite-mark";
import { Tx } from "@/lib/i18n/client";

/** Product photo, or a branded placeholder when the seller has not uploaded one yet. */
export function ProductImage({ image, title, className = "" }: { image: ImageRef | null; title: string; className?: string }) {
  if (!image) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-primary-soft to-surface-2 ${className}`} aria-hidden="true">
        <KiteMark size={56} />
      </div>
    );
  }
  // Images come from object storage on any host; next/image remote patterns are set up with storage.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={image.alt ?? title} loading="lazy" className={`object-cover ${className}`} />;
}

export function Stars({ value, count, size = "sm" }: { value: number; count?: number; size?: "sm" | "md" }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${size === "md" ? "text-base" : "text-xs"} text-muted`}>
      <span aria-hidden="true" className="tracking-tight text-highlight">
        {"★".repeat(full)}
        <span className="text-border">{"★".repeat(5 - full)}</span>
      </span>
      <span className="sr-only"><Tx text="Rated {value} out of 5" values={{ value }} /></span>
      {count !== undefined && <span>{count > 0 ? `${value.toFixed(1)} (${count})` : <Tx text="No reviews yet" />}</span>}
    </span>
  );
}

export function Price({ price, compareAtPrice, from = false }: { price: number; compareAtPrice?: number | null; from?: boolean }) {
  const discount = compareAtPrice && compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 tabular-nums">
      <span className="font-semibold text-ink">
        {from && <span className="text-xs font-normal text-muted"><Tx text="From" /> </span>}
        {formatPKR(price)}
      </span>
      {discount > 0 && (
        <>
          <s className="text-sm text-muted">{formatPKR(compareAtPrice!)}</s>
          <span className="text-xs font-semibold text-highlight">−{discount}%</span>
        </>
      )}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-primary"
    >
      <div className="relative">
        <ProductImage image={product.image} title={product.title} className="aspect-[4/3] w-full" />
        {!product.inStock && (
          <span className="absolute top-2 start-2 rounded bg-ink/80 px-2 py-0.5 text-xs font-semibold text-surface"><Tx text="Out of stock" /></span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="flex items-center gap-1 text-xs text-muted">
          {product.shop.name}
          {product.shop.isVerified && (
            <>
              <BadgeCheck className="size-3.5 text-info" aria-hidden="true" />
              <span className="sr-only"><Tx text="Verified shop" /></span>
            </>
          )}
        </span>
        <span className="line-clamp-2 font-display text-[15px] leading-snug font-semibold group-hover:text-primary">{product.title}</span>
        <Stars value={product.ratingAvg} count={product.ratingCount} />
        <span className="mt-auto pt-1">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} from={product.hasVariants} />
        </span>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
