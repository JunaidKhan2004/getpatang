"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { runAction } from "@/lib/run-action";

// Inbox
export async function markReadAction(id: string) {
  return runAction((t) => api(`/notifications/${id}/read`, { method: "POST", token: t }), undefined, [], "/notifications").then((r) => {
    revalidatePath("/", "layout");
    return r;
  });
}

export async function markAllReadAction() {
  const r = await runAction((t) => api("/notifications/read-all", { method: "POST", token: t }), "All caught up.", ["/notifications"], "/notifications");
  revalidatePath("/", "layout");
  return r;
}

export async function savePreferencesAction(prefs: Record<string, { inApp: boolean; email: boolean; push: boolean }>) {
  return runAction((t) => api("/notifications/preferences", { method: "PUT", token: t, body: { prefs } }), "Notification settings saved.", ["/account/notifications"], "/account/notifications");
}

// Payments (customer)
export async function submitPaymentProofAction(orderNumber: string, body: { reference: string; proofUploadId?: string }) {
  return runAction((t) => api(`/orders/${orderNumber}/payment-proof`, { method: "POST", token: t, body }), undefined, [`/account/orders/${orderNumber}`], `/account/orders/${orderNumber}`);
}

// Payments (staff)
export async function reviewPaymentAction(id: string, decision: "approve" | "reject", note?: string) {
  return runAction(
    (t) => api(`/admin/payments/${id}/review`, { method: "POST", token: t, body: { decision, note } }),
    decision === "approve" ? "Payment verified. The customer and shop were told." : "Payment rejected. The customer was asked to check it.",
    ["/admin/payments"],
  );
}

export async function completeRefundAction(id: string, reference: string) {
  return runAction((t) => api(`/admin/refunds/${id}/complete`, { method: "POST", token: t, body: { reference } }), "Refund recorded. The customer was told.", ["/admin/payments"]);
}
