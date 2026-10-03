/** Server-side runner shared by the events, designs and custom-order actions. Not an action itself. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export interface EResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  signIn?: boolean;
  id?: string;
}

/** Shared runner for events, designs and custom orders. */
export async function runAction(fn: (token: string) => Promise<unknown>, success?: string, paths: string[] = [], returnTo = "/"): Promise<EResult> {
  const token = await getAccessToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  try {
    const res = await fn(token);
    paths.forEach((p) => revalidatePath(p));
    const msg = (res as { message?: string } | null)?.message;
    return { ok: true, message: msg ?? success, id: (res as { id?: string } | null)?.id };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, signIn: e.status === 401 };
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

