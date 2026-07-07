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
    return { error: "E-posta ve şifre zorunludur." };
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
      return { error: messageFrom(body) ?? "E-posta veya şifre hatalı." };
    }
    if (!(await persistSession(response.headers.getSetCookie()))) {
      return {
        error: "Giriş başarılı ancak oturum oluşturulamadı. Lütfen tekrar deneyin.",
      };
    }
  } catch {
    return { error: "Sunucuya ulaşılamıyor. Lütfen tekrar deneyin." };
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
  const phone = String(formData.get("phone") ?? "").trim();
  const targetCountry = String(formData.get("targetCountry") ?? "").trim();
  const acceptKvkk = formData.get("acceptKvkk") === "true";
  const acceptTerms = formData.get("acceptTerms") === "true";
  const passports = formData
    .getAll("passports")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!email || !password || !fullName || !phone || !targetCountry) {
    return { error: "Tüm alanların doldurulması zorunludur." };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: "Şifre 8 ile 72 karakter arasında olmalıdır." };
  }
  if (passports.length === 0) {
    return { error: "En az bir pasaport dosyası yüklemeniz gerekir." };
  }
  if (!acceptKvkk) {
    return { error: "KVKK Aydınlatma Metni onayı zorunludur." };
  }
  if (!acceptTerms) {
    return {
      error: "Mesafeli Hizmet Satış Sözleşmesi onayı zorunludur.",
    };
  }

  let destination: string;
  try {
    const payload = new FormData();
    payload.set("email", email);
    payload.set("password", password);
    payload.set("fullName", fullName);
    payload.set("phone", phone);
    payload.set("targetCountry", targetCountry);
    payload.set("hasAcceptedKVKK", "true");
    payload.set("hasAcceptedTerms", "true");
    for (const passport of passports) {
      payload.append("passports", passport);
    }

    const onboardResponse = await fetch(`${API_BASE_URL}/auth/onboard`, {
      method: "POST",
      body: payload,
      cache: "no-store",
    });
    if (!onboardResponse.ok) {
      const body = await onboardResponse.json().catch(() => null);
      return {
        error:
          messageFrom(body) ?? "Kayıt tamamlanamadı. Bilgilerinizi kontrol edin.",
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
    return { error: "Sunucuya ulaşılamıyor. Lütfen tekrar deneyin." };
  }

  redirect(destination);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ACCESS_TOKEN_COOKIE);
  redirect("/login");
}
