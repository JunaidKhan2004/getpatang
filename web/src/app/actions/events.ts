"use server";

import { api } from "@/lib/api";
import { runAction } from "@/lib/run-action";

export async function registerEventAction(slug: string, guests: number) {
  return runAction((t) => api(`/events/${slug}/registration`, { method: "POST", token: t, body: { guests } }), undefined, [`/events/${slug}`, "/account/events"], `/events/${slug}`);
}

export async function cancelEventRegistrationAction(slug: string) {
  return runAction((t) => api(`/events/${slug}/registration`, { method: "DELETE", token: t }), "Your registration was cancelled.", [`/events/${slug}`, "/account/events"], `/events/${slug}`);
}

export async function saveEventAction(id: string | null, body: Record<string, unknown>) {
  return runAction((t) => api(id ? `/admin/events/${id}` : "/admin/events", { method: id ? "PUT" : "POST", token: t, body }), "Event saved.", ["/admin/events", "/events"]);
}

export async function eventCommandAction(id: string, command: "publish" | "cancel", reason?: string) {
  return runAction(
    (t) => api(`/admin/events/${id}/${command}`, { method: "POST", token: t, body: command === "cancel" ? { reason } : undefined }),
    command === "publish" ? "Event published." : "Event cancelled. Registered people can see the reason.",
    [`/admin/events/${id}`, "/admin/events", "/events"],
  );
}
