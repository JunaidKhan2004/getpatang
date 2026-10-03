"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export interface SellerActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

async function token() {
  const t = await getAccessToken();
  if (!t) redirect("/login?next=/seller");
  return t;
}

async function run(fn: (token: string) => Promise<unknown>, success?: string, paths: string[] = []): Promise<SellerActionResult> {
  try {
    await fn(await token());
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: success };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function submitApplicationAction(body: Record<string, unknown>) {
  return run((t) => api("/seller/application", { method: "PUT", token: t, body }), "Application submitted. We will review it soon.", ["/seller"]);
}

export async function saveProductAction(id: string | null, body: Record<string, unknown>): Promise<SellerActionResult & { id?: string }> {
  let savedId: string | undefined;
  const res = await run(
    async (t) => {
      const p = await api<{ id: string }>(id ? `/seller/products/${id}` : "/seller/products", { method: id ? "PUT" : "POST", token: t, body });
      savedId = p.id;
    },
    undefined,
    ["/seller/products"],
  );
  return { ...res, id: savedId };
}

export async function productVisibilityAction(id: string, visible: boolean) {
  return run((t) => api(`/seller/products/${id}/${visible ? "show" : "hide"}`, { method: "POST", token: t }), visible ? "Product is live again." : "Product paused.", ["/seller/products"]);
}

export async function deleteProductAction(id: string) {
  return run((t) => api(`/seller/products/${id}`, { method: "DELETE", token: t }), "Product deleted.", ["/seller/products"]);
}

export async function updateStockAction(id: string, body: { stock?: number; variants?: Record<string, number> }) {
  return run((t) => api(`/seller/products/${id}/stock`, { method: "PATCH", token: t, body }), "Stock updated.", ["/seller/products", "/seller"]);
}

export async function updateOrderStatusAction(orderNumber: string, body: Record<string, unknown>) {
  return run(
    (t) => api(`/seller/orders/${orderNumber}/status`, { method: "POST", token: t, body }),
    "Order updated. The customer can see the new status.",
    [`/seller/orders/${orderNumber}`, "/seller/orders", "/seller"],
  );
}

export async function updateShopAction(body: Record<string, unknown>) {
  return run((t) => api("/seller/shop", { method: "PATCH", token: t, body }), "Shop updated.", ["/seller/shop"]);
}

export async function updatePayoutAction(body: Record<string, unknown>) {
  return run((t) => api("/seller/payout", { method: "PUT", token: t, body }), "Payout details saved.", ["/seller/settings"]);
}

// Admin moderation
export async function shopDecisionAction(shopId: string, decision: string, note?: string) {
  return run(
    (t) => api(`/admin/shops/${shopId}/decision`, { method: "POST", token: t, body: { decision, note: note || undefined } }),
    "Decision saved.",
    [`/admin/sellers/${shopId}`, "/admin/sellers"],
  );
}

export async function shopVerificationAction(shopId: string, isVerified: boolean) {
  return run(
    (t) => api(`/admin/shops/${shopId}/verification`, { method: "PATCH", token: t, body: { isVerified } }),
    isVerified ? "Verified badge added." : "Verified badge removed.",
    [`/admin/sellers/${shopId}`],
  );
}

export async function productDecisionAction(productId: string, decision: string, note?: string) {
  return run(
    (t) => api(`/admin/products/${productId}/decision`, { method: "POST", token: t, body: { decision, note: note || undefined } }),
    "Decision saved.",
    ["/admin/products"],
  );
}
