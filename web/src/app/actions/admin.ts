"use server";

import { api } from "@/lib/api";
import { runAction } from "@/lib/run-action";

// Users
export async function setUserStatusAction(id: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", reason: string) {
  const done = { ACTIVE: "Account restored.", SUSPENDED: "Account suspended and signed out everywhere.", BANNED: "Account banned and signed out everywhere." };
  return runAction((t) => api(`/admin/users/${id}/status`, { method: "POST", token: t, body: { status, reason } }), done[status], [`/admin/users/${id}`, "/admin/users"]);
}

export async function verifyUserAction(id: string) {
  return runAction((t) => api(`/admin/users/${id}/verify`, { method: "POST", token: t }), "Account marked as verified.", [`/admin/users/${id}`]);
}

export async function setUserRolesAction(id: string, roles: string[]) {
  return runAction((t) => api(`/admin/users/${id}/roles`, { method: "PUT", token: t, body: { roles } }), "Roles updated.", [`/admin/users/${id}`, "/admin/users"]);
}

// Orders
export async function adminCancelOrderAction(orderNumber: string, reason: string) {
  return runAction((t) => api(`/admin/orders/${orderNumber}/cancel`, { method: "POST", token: t, body: { reason } }), "Order cancelled. The customer and shop were told.", [`/admin/orders/${orderNumber}`, "/admin/orders"]);
}

// Settings
export async function saveSettingAction(key: string, value: unknown) {
  return runAction((t) => api(`/admin/settings/${key}`, { method: "PUT", token: t, body: { value } }), "Setting saved.", ["/admin/settings"]);
}

export async function resetSettingAction(key: string) {
  return runAction((t) => api(`/admin/settings/${key}/reset`, { method: "POST", token: t }), "Back to the default.", ["/admin/settings"]);
}

// Content
export async function saveContentPageAction(slug: string, body: { title: string; body: string; published: boolean }) {
  return runAction((t) => api(`/admin/pages/${slug}`, { method: "PUT", token: t, body }), body.published ? "Page saved and published." : "Draft saved.", ["/admin/content", `/${slug}`]);
}
