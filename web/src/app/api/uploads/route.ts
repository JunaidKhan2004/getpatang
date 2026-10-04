import { type NextRequest, NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

/**
 * Browser → this route → backend. The access token lives in an httpOnly cookie,
 * so file uploads are forwarded from here instead of calling the API directly.
 */
export async function POST(request: NextRequest) {
  const t = await getT();
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: t("Please sign in again.") } }, { status: 401 });

  const purpose = request.nextUrl.searchParams.get("purpose") ?? "";
  const form = await request.formData();
  const res = await fetch(`${API_URL}/uploads?purpose=${encodeURIComponent(purpose)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).catch(() => null);

  if (!res) return NextResponse.json({ error: { code: "NETWORK_ERROR", message: t("Upload failed. Please try again.") } }, { status: 503 });
  return NextResponse.json(await res.json(), { status: res.status });
}
