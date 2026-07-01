"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE_URL } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE } from "@/lib/constants";

/** Mirrors backend ACCESS_TOKEN_MAX_AGE_MS (1 day), in seconds. */
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface AuthFormState {
  error?: string;
}

function messageFrom(body: unknown): string | undefined {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string" && message) return message;
  }
  return undefined;
}

/** Prevents open-redirects: only same-origin, non-protocol-relative paths pass. */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/**
 * Re-issues the backend JWT as a FIRST-PARTY HTTP-only cookie on the app origin.
 * This is what lets RSC forward the cookie back to the API — a cookie the backend
 * set on its own origin would be invisible to the Next server.
 */
async function persistSession(setCookies: string[]): Promise<boolean> {
  const tokenCookie = setCookies.find((entry) =>
    entry.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
  );
  if (!tokenCookie) {
    return false;
  }
  const firstPair = tokenCookie.split(";", 1)[0];
  const token = firstPair.slice(firstPair.indexOf("=") + 1);
  if (!token) {
    return false;
  }

  (await cookies()).set(ACCESS_TOKEN_COOKIE, decodeURIComponent(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
  return true;
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: messageFrom(body) ?? "Invalid email or password." };
    }
    if (!(await persistSession(response.headers.getSetCookie()))) {
      return { error: "Login succeeded but no session was issued. Try again." };
    }
  } catch {
    return { error: "Unable to reach the server. Please try again." };
  }

  redirect(next);
}

export async function onboard(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const passport = formData.get("passport");

  if (!email || !password || !fullName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: "Password must be between 8 and 72 characters." };
  }
  if (!(passport instanceof File) || passport.size === 0) {
    return { error: "A passport file is required." };
  }

  let destination: string;
  try {
    const payload = new FormData();
    payload.set("email", email);
    payload.set("password", password);
    payload.set("fullName", fullName);
    payload.set("passport", passport);

    const onboardResponse = await fetch(`${API_BASE_URL}/auth/onboard`, {
      method: "POST",
      body: payload,
      cache: "no-store",
    });
    if (!onboardResponse.ok) {
      const body = await onboardResponse.json().catch(() => null);
      return {
        error: messageFrom(body) ?? "Onboarding failed. Review your details.",
      };
    }

    // Onboarding creates the account but does not sign in — do it now.
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const signedIn =
      loginResponse.ok &&
      (await persistSession(loginResponse.headers.getSetCookie()));
    destination = signedIn ? "/dashboard" : "/login";
  } catch {
    return { error: "Unable to reach the server. Please try again." };
  }

  redirect(destination);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ACCESS_TOKEN_COOKIE);
  redirect("/login");
}
