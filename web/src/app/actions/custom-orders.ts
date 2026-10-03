"use server";

import { api } from "@/lib/api";
import type { KiteDesign } from "@/lib/designer";
import { runAction } from "@/lib/run-action";

// Designs
export async function saveDesignAction(id: string | null, name: string, design: KiteDesign) {
  const body = { name, design: { ...design, imageUrl: undefined, text: design.text || undefined, imageUploadId: design.imageUploadId || undefined } };
  return runAction((t) => api(id ? `/designs/${id}` : "/designs", { method: id ? "PUT" : "POST", token: t, body }), "Design saved.", ["/account/designs"], "/designer");
}

export async function deleteDesignAction(id: string) {
  return runAction((t) => api(`/designs/${id}`, { method: "DELETE", token: t }), "Design deleted.", ["/account/designs"], "/account/designs");
}

// Customer requests
export async function createCustomOrderAction(body: Record<string, unknown>) {
  return runAction((t) => api("/custom-orders", { method: "POST", token: t, body }), "Request sent. The shop will reply with a quote or a question.", ["/account/custom-orders"], "/account/designs");
}

export async function customOrderMessageAction(id: string, body: string) {
  return runAction((t) => api(`/custom-orders/${id}/messages`, { method: "POST", token: t, body: { body } }), "Message sent.", [`/account/custom-orders/${id}`]);
}

export async function customOrderCommandAction(id: string, command: "decline" | "cancel") {
  return runAction(
    (t) => api(`/custom-orders/${id}/${command}`, { method: "POST", token: t }),
    command === "decline" ? "Quote declined." : "Request cancelled.",
    [`/account/custom-orders/${id}`, "/account/custom-orders"],
  );
}

export async function acceptQuoteAction(id: string, body: { addressId: string; deliveryMethod: string; paymentMethod: string }) {
  return runAction((t) => api(`/custom-orders/${id}/accept`, { method: "POST", token: t, body }), "Quote accepted. Your order is placed.", [`/account/custom-orders/${id}`, "/account/orders"]);
}

// Sellers
export async function sellerCustomOrderAction(id: string, command: "messages" | "clarify" | "quote" | "reject", body: Record<string, unknown>) {
  const messages = { messages: "Message sent.", clarify: "Question sent to the customer.", quote: "Quote sent.", reject: "Request declined." };
  return runAction((t) => api(`/seller/custom-orders/${id}/${command}`, { method: "POST", token: t, body }), messages[command], [`/seller/custom-orders/${id}`, "/seller/custom-orders"]);
}
