"use server";

import { revalidatePath } from "next/cache";

import { api, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export interface CResult<T = unknown> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  signIn?: boolean;
  data?: T;
}

async function run<T>(fn: (token: string) => Promise<T>, success?: string, paths: string[] = [], needsAuth = true): Promise<CResult<T>> {
  const token = await getAccessToken();
  if (needsAuth && !token) return { ok: false, signIn: true, message: "Please sign in to continue." };
  try {
    const data = await fn(token ?? "");
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, message: success, data };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, signIn: e.status === 401 };
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function createPostAction(body: string, mediaUploadIds: string[]) {
  return run((t) => api<{ id: string }>("/posts", { method: "POST", token: t, body: { body, mediaUploadIds } }), "Posted.", ["/community"]);
}

export async function editPostAction(id: string, body: string) {
  return run((t) => api(`/posts/${id}`, { method: "PATCH", token: t, body: { body } }), "Post updated.", ["/community", `/community/posts/${id}`]);
}

export async function deletePostAction(id: string) {
  return run((t) => api(`/posts/${id}`, { method: "DELETE", token: t }), "Post deleted.", ["/community"]);
}

export async function likeAction(id: string, like: boolean) {
  return run((t) => api<{ liked: boolean; likeCount: number }>(`/posts/${id}/like`, { method: like ? "PUT" : "DELETE", token: t }));
}

export async function shareAction(id: string) {
  return run((t) => api<{ path: string; shareCount: number }>(`/posts/${id}/share`, { method: "POST", token: t || undefined }), undefined, [], false);
}

export async function commentAction(postId: string, body: string, parentId?: string) {
  return run((t) => api(`/posts/${postId}/comments`, { method: "POST", token: t, body: { body, parentId } }), "Comment added.", [`/community/posts/${postId}`]);
}

export async function deleteCommentAction(postId: string, id: string) {
  return run((t) => api(`/comments/${id}`, { method: "DELETE", token: t }), "Comment deleted.", [`/community/posts/${postId}`]);
}

export async function followAction(userId: string, follow: boolean) {
  return run((t) => api(`/community/users/${userId}/follow`, { method: follow ? "PUT" : "DELETE", token: t }), follow ? "Following." : "Unfollowed.", [`/community/u/${userId}`]);
}

export async function blockAction(userId: string, block: boolean) {
  return run(
    (t) => api(`/community/users/${userId}/block`, { method: block ? "PUT" : "DELETE", token: t }),
    block ? "Blocked. You will no longer see each other’s posts." : "Unblocked.",
    [`/community/u/${userId}`, "/community"],
  );
}

export async function reportAction(targetType: string, targetId: string, reason: string, details?: string) {
  return run(
    (t) => api<{ message: string }>("/reports", { method: "POST", token: t, body: { targetType, targetId, reason, details: details || undefined } }),
    "Thanks for reporting. Our moderators will review it.",
  );
}

export async function moderateAction(targetType: string, targetId: string, action: string, note?: string) {
  return run(
    (t) => api(`/admin/moderation/${targetType}/${targetId}`, { method: "POST", token: t, body: { action, note: note || undefined } }),
    "Decision saved.",
    ["/admin/community", "/admin/reports"],
  );
}
