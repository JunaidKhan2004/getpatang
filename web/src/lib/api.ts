import "server-only";

import { getLang } from "./i18n/server";
import { translate } from "./i18n/core";

/** Server-side base URL of the backend API. Never exposed to the browser. */
export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | undefined>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function send(path: string, { method = "GET", body, token, query }: ApiOptions) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

  const lang = await getLang();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        // Labels, messages and errors come back in the visitor's language.
        "Accept-Language": lang,
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(translate(lang, "We could not reach the server. Please try again in a moment."), "NETWORK_ERROR", 503);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    const fieldErrors: Record<string, string> = {};
    for (const d of err.details ?? []) if (d?.field) fieldErrors[d.field] = d.message;
    throw new ApiError(err.message ?? translate(lang, "Something went wrong. Please try again."), err.code ?? "ERROR", res.status, fieldErrors);
  }
  return json;
}

/** Calls the backend and unwraps `{ data }`. Throws ApiError with a user-safe message. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return (await send(path, options)).data as T;
}

/** Same as api() for paginated endpoints: returns `{ data, meta }`. */
export async function apiPage<T>(path: string, options: ApiOptions = {}): Promise<{ data: T[]; meta: PageMeta }> {
  return send(path, options);
}
