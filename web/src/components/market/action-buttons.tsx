"use client";

import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addToCartAction, type ActionResult, setFollowAction, setWishlistAction } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";

import { useT, useFormat } from "@/lib/i18n/client";

/** Shows the action result as a toast, or sends a signed-out visitor to sign in. */
function useActionFeedback() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  return (res: ActionResult) => {
    if (res.signIn) {
      toast.info(t("Please sign in to continue."));
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (res.ok) {
      if (res.message) toast.success(res.message);
    } else {
      toast.error(res.message ?? t("Something went wrong."));
    }
  };
}

export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  label = "Quantity",
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useT();
  const btn = "inline-flex size-10 items-center justify-center hover:bg-surface-2 disabled:opacity-40";
  return (
    <div role="group" aria-label={t(label)} className="inline-flex items-center rounded-md border border-border bg-surface">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label={t("Decrease quantity")}>
        <Minus className="size-4" />
      </button>
      <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={t("Increase quantity")}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function AddToCart({
  productId,
  basePrice,
  stock,
  variants,
}: {
  productId: string;
  basePrice: number;
  stock: number;
  variants: { id: string; name: string; price: number; stock: number }[];
}) {
  const { formatPKR } = useFormat();
  const t = useT();
  const feedback = useActionFeedback();
  const router = useRouter();
  const [variantId, setVariantId] = useState<string | undefined>(variants.find((v) => v.stock > 0)?.id);
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();

  const variant = variants.find((v) => v.id === variantId);
  const available = variants.length ? (variant?.stock ?? 0) : stock;
  const price = variant?.price ?? basePrice;

  const add = (thenCheckout: boolean) =>
    start(async () => {
      const res = await addToCartAction({ productId, variantId, quantity });
      feedback(res);
      if (res.ok && thenCheckout) router.push("/cart");
    });

  return (
    <div className="grid gap-5">
      {variants.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("Choose an option")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info border-border`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  className="sr-only"
                  checked={variantId === v.id}
                  disabled={v.stock <= 0}
                  onChange={() => {
                    setVariantId(v.id);
                    setQuantity(1);
                  }}
                />
                {v.name}
                {v.price !== basePrice && <span className="ms-1 text-muted">· {formatPKR(v.price)}</span>}
                {v.stock <= 0 && <span className="ms-1">{t("· sold out")}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="font-display text-3xl font-bold tabular-nums">{formatPKR(price * quantity)}</p>
      <p className={`text-sm font-medium ${available > 0 ? (available <= 5 ? "text-warning" : "text-success") : "text-danger"}`}>
        {available <= 0 ? t("Out of stock") : available <= 5 ? t("Only {available} left", { available }) : t("In stock")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} max={Math.max(1, Math.min(available, 99))} onChange={setQuantity} disabled={available <= 0} />
        <Button onClick={() => add(false)} loading={pending} disabled={available <= 0} size="lg" className="flex-1 sm:flex-none">
          <ShoppingBag className="size-4" aria-hidden="true" />
          {t("Add to cart")}</Button>
        <Button onClick={() => add(true)} disabled={available <= 0 || pending} size="lg" variant="secondary" className="flex-1 sm:flex-none">
          {t("Buy now")}</Button>
      </div>
    </div>
  );
}

export function WishlistButton({ productId, initial }: { productId: string; initial: boolean }) {
  const t = useT();
  const feedback = useActionFeedback();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setWishlistAction(productId, !saved);
          if (res.ok) setSaved(!saved);
          feedback(res);
        })
      }
      className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2 aria-pressed:border-primary aria-pressed:text-primary"
    >
      <Heart className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
      {saved ? t("Saved") : t("Save to wishlist")}
    </button>
  );
}

export function FollowButton({ shopSlug, initial, initialCount }: { shopSlug: string; initial: boolean; initialCount: number }) {
  const t = useT();
  const feedback = useActionFeedback();
  const [following, setFollowing] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={following ? "secondary" : "primary"}
        loading={pending}
        aria-pressed={following}
        onClick={() =>
          start(async () => {
            const res = await setFollowAction(shopSlug, !following);
            if (res.ok) {
              setFollowing(!following);
              if (res.followerCount !== undefined) setCount(res.followerCount);
            }
            feedback(res);
          })
        }
      >
        {following ? t("Following") : t("Follow shop")}
      </Button>
      <span className="text-sm text-muted tabular-nums">{count.toLocaleString("en-PK")} {" "}{t("followers")}</span>
    </div>
  );
}
