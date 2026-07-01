import "server-only";

import { cookies } from "next/headers";

import { ApiError, apiFetch, type ApiRequestInit } from "./api";
import type { AuthenticatedUser } from "./types";

/** Serializes the inbound request cookies into a forwardable `Cookie` header. */
async function forwardedCookie(): Promise<string> {
  return (await cookies()).toString();
}

/**
 * Server-side API client. Forwards the caller's HTTP-only auth cookie to the
 * backend on every request — the reliable way to authenticate from RSC, route
 * handlers, and Server Actions, where `credentials` alone sends nothing.
 */
export async function serverFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  return apiFetch<T>(path, { ...init, cookie: await forwardedCookie() });
}

export const serverApi = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    serverFetch<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    serverFetch<T>(path, { ...init, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    serverFetch<T>(path, { ...init, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    serverFetch<T>(path, { ...init, method: "PUT", body }),
  del: <T>(path: string, init?: ApiRequestInit) =>
    serverFetch<T>(path, { ...init, method: "DELETE" }),
};

/**
 * Resolves the current session from `GET /auth/me`.
 * Returns `null` for an absent/expired session (401/403) so callers can redirect;
 * re-throws anything else so real failures are not mistaken for sign-out.
 */
export async function getSession(): Promise<AuthenticatedUser | null> {
  try {
    return await serverApi.get<AuthenticatedUser>("/auth/me");
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }
    throw error;
  }
}
