const apiBaseFromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL =
  apiBaseFromEnv && apiBaseFromEnv.length > 0
    ? apiBaseFromEnv.replace(/\/+$/, "")
    : "/api";

/** Thrown for any non-2xx API response. Carries the HTTP status and parsed body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestInit extends Omit<RequestInit, "body"> {
  /** Plain object (JSON-encoded), `FormData`, or other `BodyInit` passthrough. */
  body?: unknown;
  /** Cookie header to forward — server-side only; see `lib/api.server.ts`. */
  cookie?: string;
  /** Optional absolute API base URL override, mainly for server-side usage. */
  baseUrl?: string;
}

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/**
 * Isomorphic fetch wrapper for the Alsasvize API.
 *  - Browser: authenticates via the HTTP-only cookie using `credentials: "include"`.
 *  - Server (RSC / route handlers / Server Actions): the cookie is NOT inherited,
 *    so forward it explicitly with `cookie` — use the helpers in `lib/api.server.ts`.
 *
 * Non-2xx responses throw `ApiError`. Auth'd data is never cached unless a caller
 * overrides `cache`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { body, cookie, headers, method = "GET", baseUrl, ...rest } = init;
  const requestBaseUrl =
    (baseUrl ?? API_BASE_URL).replace(/\/+$/, "") || API_BASE_URL;

  const finalHeaders = new Headers(headers);
  const sendsBody = !BODYLESS_METHODS.has(method.toUpperCase()) && body != null;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (sendsBody && !isFormData && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (cookie) {
    finalHeaders.set("cookie", cookie);
  }

  const response = await fetch(`${requestBaseUrl}${path}`, {
    method,
    // Web cross-origin cookie auth; ignored (harmless) on the server.
    credentials: "include",
    // Authenticated data is never cached unless a caller explicitly opts in.
    cache: "no-store",
    ...rest,
    headers: finalHeaders,
    body: sendsBody
      ? isFormData
        ? (body as FormData)
        : JSON.stringify(body)
      : undefined,
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(payload, response),
      payload,
    );
  }

  return payload as T;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined);
  }
  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

/** Normalizes NestJS error bodies (`{ message: string | string[] }`) into a string. */
function extractMessage(payload: unknown, response: Response): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string" && message) return message;
  }
  if (typeof payload === "string" && payload) return payload;
  return response.statusText || "Request failed";
}

/** Client-safe verb helpers. Import these in Client Components and browser code. */
export const api = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "PUT", body }),
  del: <T>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};
