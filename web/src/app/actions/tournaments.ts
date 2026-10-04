"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export interface TResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  signIn?: boolean;
  id?: string;
}

async function run(fn: (token: string) => Promise<unknown>, success?: string, paths: string[] = [], returnTo = "/tournaments"): Promise<TResult> {
  const tr = await getT();
  const token = await getAccessToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  try {
    const res = await fn(token);
    paths.forEach((p) => revalidatePath(p));
    const msg = (res as { message?: string } | null)?.message;
    return { ok: true, message: msg ?? (success && (await getT())(success)), id: (res as { id?: string } | null)?.id };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, signIn: e.status === 401 };
    console.error(e);
    return { ok: false, message: tr("Something went wrong. Please try again.") };
  }
}

// Players
export async function registerAction(slug: string, body: { acceptRules: boolean; dateOfBirth?: string }) {
  return run((t) => api(`/tournaments/${slug}/registration`, { method: "POST", token: t, body }), undefined, [`/tournaments/${slug}`], `/tournaments/${slug}`);
}

export async function withdrawAction(slug: string) {
  return run((t) => api(`/tournaments/${slug}/registration`, { method: "DELETE", token: t }), "You have withdrawn from this tournament.", [`/tournaments/${slug}`], `/tournaments/${slug}`);
}

export async function disputeAction(matchId: string, slug: string, reason: string) {
  return run((t) => api(`/matches/${matchId}/dispute`, { method: "POST", token: t, body: { reason } }), "Dispute sent. A tournament manager will review it.", [`/tournaments/${slug}`]);
}

// Organizers
export async function saveTournamentAction(id: string | null, body: Record<string, unknown>) {
  return run(
    (t) => api(id ? `/admin/tournaments/${id}` : "/admin/tournaments", { method: id ? "PUT" : "POST", token: t, body }),
    "Tournament saved.",
    ["/admin/tournaments"],
  );
}

export async function tournamentCommandAction(id: string, command: "publish" | "bracket" | "cancel", reason?: string) {
  const messages = { publish: "Tournament published.", bracket: "Bracket drawn. Registration is closed.", cancel: "Tournament cancelled." };
  return run(
    (t) => api(`/admin/tournaments/${id}/${command}`, { method: "POST", token: t, body: command === "cancel" ? { reason } : undefined }),
    messages[command],
    [`/admin/tournaments/${id}`, "/admin/tournaments"],
  );
}

export async function updateParticipantAction(id: string, participantId: string, body: { status?: string; seed?: number | null; note?: string }) {
  return run((t) => api(`/admin/tournaments/${id}/participants/${participantId}`, { method: "PATCH", token: t, body }), "Player updated.", [`/admin/tournaments/${id}`]);
}

export async function scheduleMatchAction(tournamentId: string, matchId: string, body: { scheduledAt?: string | null; location?: string | null; officialId?: string | null }) {
  return run((t) => api(`/admin/matches/${matchId}`, { method: "PATCH", token: t, body }), "Match updated.", [`/admin/tournaments/${tournamentId}`]);
}

export async function resolveDisputeAction(tournamentId: string, matchId: string, decision: "uphold" | "overturn", note: string) {
  return run((t) => api(`/admin/matches/${matchId}/resolve-dispute`, { method: "POST", token: t, body: { decision, note } }), "Dispute resolved.", [`/admin/tournaments/${tournamentId}`, "/admin/matches"]);
}

export async function recalculateRankingsAction() {
  return run((t) => api("/admin/rankings/recalculate", { method: "POST", token: t }), "Rankings recalculated with the current formula.", ["/rankings"]);
}

// Officials
export async function matchStatusAction(matchId: string, status: "CHECK_IN" | "LIVE") {
  return run((t) => api(`/officials/matches/${matchId}/status`, { method: "POST", token: t, body: { status } }), "Match updated.", ["/admin/matches"]);
}

export async function matchResultAction(matchId: string, body: Record<string, unknown>) {
  return run((t) => api(`/officials/matches/${matchId}/result`, { method: "POST", token: t, body }), "Official result recorded.", ["/admin/matches"]);
}
