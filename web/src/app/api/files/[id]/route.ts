import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/** Streams a private file (seller documents) to the owner or authorised staff. The backend decides who may see it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAccessToken();
  if (!token) return new NextResponse("Please sign in.", { status: 401 });
  const { id } = await params;
  const res = await fetch(`${API_URL}/uploads/${encodeURIComponent(id)}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok || !res.body) return new NextResponse("File not available.", { status: res?.status ?? 503 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
