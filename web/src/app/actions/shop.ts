"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import type { Address, Quote } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import type { FormState } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

/** Result of a small action (add to cart, follow…). */
export interface ActionResult {
  ok: boolean;
  message?: string;
  /** Set when the visitor must sign in first; the client redirects. */
  signIn?: boolean;
}

async function tokenOr(returnTo: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return token;
}

async function failure(e: unknown): Promise<ActionResult> {
  if (e instanceof ApiError) return { ok: false, message: e.message, signIn: e.status === 401 };
  console.error(e);
  const t = await getT();
  return { ok: false, message: t("Something went wrong. Please try again.") };
}

const refreshShell = () => revalidatePath("/", "layout");

export async function addToCartAction(input: { productId: string; variantId?: string; quantity: number }): Promise<ActionResult> {
  const t = await getT();
  const token = await getAccessToken();
  if (!token) return { ok: false, signIn: true };
  try {
    await api("/cart/items", { method: "POST", token, body: input });
    refreshShell();
    return { ok: true, message: t("Added to your cart.") };
  } catch (e) {
    return failure(e);
  }
}

export async function updateCartItemAction(id: string, patch: { quantity?: number; savedForLater?: boolean }): Promise<ActionResult> {
  const token = await tokenOr("/cart");
  try {
    await api(`/cart/items/${id}`, { method: "PATCH", token, body: patch });
    refreshShell();
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

export async function removeCartItemAction(id: string): Promise<ActionResult> {
  const t = await getT();
  const token = await tokenOr("/cart");
  try {
    await api(`/cart/items/${id}`, { method: "DELETE", token });
    refreshShell();
    return { ok: true, message: t("Removed from your cart.") };
  } catch (e) {
    return failure(e);
  }
}

export async function setWishlistAction(productId: string, saved: boolean): Promise<ActionResult> {
  const t = await getT();
  const token = await getAccessToken();
  if (!token) return { ok: false, signIn: true };
  try {
    await api(`/wishlist/${productId}`, { method: saved ? "PUT" : "DELETE", token });
    revalidatePath("/account/wishlist");
    return { ok: true, message: saved ? t("Saved to your wishlist.") : t("Removed from your wishlist.") };
  } catch (e) {
    return failure(e);
  }
}

export async function setFollowAction(shopSlug: string, follow: boolean): Promise<ActionResult & { followerCount?: number }> {
  const t = await getT();
  const token = await getAccessToken();
  if (!token) return { ok: false, signIn: true };
  try {
    const res = await api<{ followerCount: number }>(`/shops/${shopSlug}/follow`, { method: follow ? "PUT" : "DELETE", token });
    revalidatePath(`/shops/${shopSlug}`);
    return { ok: true, followerCount: res.followerCount, message: follow ? t("You are following this shop.") : t("You unfollowed this shop.") };
  } catch (e) {
    return failure(e);
  }
}

export async function createAddressAction(_prev: FormState, fd: FormData): Promise<FormState & { address?: Address }> {
  const t = await getT();
  const token = await tokenOr("/checkout");
  const fields = ["label", "fullName", "phone", "line1", "line2", "city", "province", "postalCode"] as const;
  const values = Object.fromEntries(fields.map((f) => [f, String(fd.get(f) ?? "").trim()]));
  const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
  try {
    const address = await api<Address>("/addresses", { method: "POST", token, body: { ...body, isDefault: fd.get("isDefault") === "on" } });
    revalidatePath("/checkout");
    return { ok: true, address };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, fieldErrors: e.fieldErrors, values };
    return { error: t("Could not save the address. Please try again."), values };
  }
}

/** Prices the cart on the server (shipping, coupon). The client never computes totals itself. */
export async function quoteAction(deliveryMethod: string, couponCode?: string): Promise<{ quote?: Quote; error?: string; couponError?: string }> {
  const t = await getT();
  const token = await tokenOr("/checkout");
  try {
    return { quote: await api<Quote>("/checkout/quote", { method: "POST", token, body: { deliveryMethod, couponCode: couponCode || undefined } }) };
  } catch (e) {
    if (e instanceof ApiError && e.code === "COUPON_INVALID") return { couponError: e.message };
    return { error: e instanceof ApiError ? e.message : t("Could not price your order.") };
  }
}

export async function placeOrderAction(input: {
  checkoutId: string;
  addressId: string;
  deliveryMethod: string;
  paymentMethod: string;
  couponCode?: string;
  notes?: string;
}): Promise<ActionResult & { fieldErrors?: Record<string, string> }> {
  const token = await tokenOr("/checkout");
  let checkoutId: string;
  try {
    ({ checkoutId } = await api<{ checkoutId: string }>("/checkout", { method: "POST", token, body: input }));
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
    return failure(e);
  }
  refreshShell();
  redirect(`/checkout/success?id=${checkoutId}`);
}

export async function cancelOrderAction(orderNumber: string, reason: string): Promise<ActionResult> {
  const t = await getT();
  const token = await tokenOr(`/account/orders/${orderNumber}`);
  try {
    await api(`/orders/${orderNumber}/cancel`, { method: "POST", token, body: { reason: reason || undefined } });
    revalidatePath(`/account/orders/${orderNumber}`);
    revalidatePath("/account/orders");
    return { ok: true, message: t("Your order was cancelled.") };
  } catch (e) {
    return failure(e);
  }
}

export async function submitReviewAction(productSlug: string, rating: number, comment: string): Promise<ActionResult> {
  const t = await getT();
  const token = await tokenOr(`/products/${productSlug}`);
  try {
    await api(`/products/${productSlug}/reviews`, { method: "POST", token, body: { rating, comment: comment || undefined } });
    revalidatePath(`/products/${productSlug}`);
    return { ok: true, message: t("Thanks! Your review is published.") };
  } catch (e) {
    return failure(e);
  }
}
