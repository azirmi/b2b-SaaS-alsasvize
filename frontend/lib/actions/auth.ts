"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveServerApiUrl } from "@/lib/api.server";
import { APPLICATION_TYPE_OPTIONS } from "@/lib/application-type";
import { ACCESS_TOKEN_COOKIE } from "@/lib/constants";
import { COUNTRY_RULES } from "@/lib/countries";
import { ApplicationType } from "@/lib/enums";
import {
  NAME_INPUT_RE,
  maskNameInput,
} from "@/lib/input-masks";

/** Mirrors backend ACCESS_TOKEN_MAX_AGE_MS (1 day), in seconds. */
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;
const TOKEN_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const APPLICATION_TYPES = new Set<ApplicationType>(
  APPLICATION_TYPE_OPTIONS.map((option) => option.value),
);

interface OnboardingExtraApplicantInput {
  fullName: string;
}

function normalizeOnboardPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("90")) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith("0")) {
    return `+90${digits.slice(1, 11)}`;
  }
  return `+90${digits.slice(0, 10)}`;
}

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
async function persistSession(
  setCookies: string[],
  maxAgeSeconds: number,
): Promise<boolean> {
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
    maxAge: maxAgeSeconds,
  });
  return true;
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("rememberMe") === "true";
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "E-posta ve şifre zorunludur." };
  }

  try {
    const loginUrl = await resolveServerApiUrl("/auth/login");
    const response = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { error: messageFrom(body) ?? "E-posta veya şifre hatalı." };
    }
    if (
      !(await persistSession(
        response.headers.getSetCookie(),
        rememberMe ? TOKEN_REMEMBER_MAX_AGE_SECONDS : TOKEN_MAX_AGE_SECONDS,
      ))
    ) {
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
  const fullNameRaw = String(formData.get("fullName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const fullName = maskNameInput(fullNameRaw, 120);
  const phone = normalizeOnboardPhone(phoneRaw);
  const targetCountry = String(formData.get("targetCountry") ?? "").trim();
  const appointmentCity = String(formData.get("appointmentCity") ?? "").trim();
  const residenceCity = String(formData.get("residenceCity") ?? "").trim();
  const plannedTravelDate = String(formData.get("plannedTravelDate") ?? "").trim();
  const applicationType = String(formData.get("applicationType") ?? "").trim() as ApplicationType;
  const acceptKvkk = formData.get("acceptKvkk") === "true";
  const acceptTerms = formData.get("acceptTerms") === "true";
  const groupApplicantsRaw = String(formData.get("groupApplicants") ?? "[]");
  const passports = formData
    .getAll("passports")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  let groupApplicants: OnboardingExtraApplicantInput[] = [];
  try {
    const parsed = JSON.parse(groupApplicantsRaw) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Başvuru kişi listesi geçersiz formatta." };
    }

    const parsedNames = parsed.map((item) => {
      if (typeof item === "string") {
        return maskNameInput(item.trim(), 120);
      }
      if (item && typeof item === "object") {
        const fullName = (item as { fullName?: unknown }).fullName;
        return typeof fullName === "string"
          ? maskNameInput(fullName.trim(), 120)
          : "";
      }
      return "";
    });

    if (parsedNames.some((name) => name.length === 0)) {
      return { error: "Ek kişi ad soyad alanı boş bırakılamaz." };
    }

    groupApplicants = parsedNames.map((fullName) => ({ fullName }));
  } catch {
    return { error: "Başvuru kişi listesi çözümlenemedi." };
  }

  if (
    !email ||
    !password ||
    !fullName ||
    !phone ||
    !targetCountry ||
    !appointmentCity ||
    !residenceCity ||
    !plannedTravelDate ||
    !applicationType
  ) {
    return { error: "Tüm alanların doldurulması zorunludur." };
  }

  const countryRule = COUNTRY_RULES[targetCountry];
  if (!countryRule) {
    return { error: "Lütfen listeden geçerli bir hedef ülke seçin." };
  }
  if (!countryRule.cities.includes(appointmentCity)) {
    return { error: "Seçilen ülke için randevu şehri geçersiz." };
  }
  if (!APPLICATION_TYPES.has(applicationType)) {
    return { error: "Lütfen geçerli bir başvuru türü seçin." };
  }
  if (residenceCity.length > 120) {
    return { error: "İkamet edilen şehir en fazla 120 karakter olabilir." };
  }
  if (!NAME_INPUT_RE.test(residenceCity)) {
    return { error: "İkamet edilen şehir yalnızca İngilizce harf içermelidir." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedTravelDate)) {
    return { error: "Planlanan seyahat tarihi geçerli formatta olmalıdır." };
  }
  const parsedPlannedTravelDate = new Date(`${plannedTravelDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedPlannedTravelDate.getTime())) {
    return { error: "Planlanan seyahat tarihi geçersiz." };
  }

  if (password.length < 8 || password.length > 72) {
    return { error: "Şifre 8 ile 72 karakter arasında olmalıdır." };
  }
  if (!NAME_INPUT_RE.test(fullName)) {
    return { error: "Ad soyad yalnızca İngilizce harf içermelidir." };
  }
  if (!/^\+90\d{10}$/.test(phone)) {
    return { error: "Telefon numarası +90 ile başlamalı ve 10 haneli olmalıdır." };
  }
  if (groupApplicants.some((item) => !NAME_INPUT_RE.test(item.fullName))) {
    return { error: "Ek kişi ad soyad alanı yalnızca İngilizce harf içermelidir." };
  }
  if (passports.length === 0) {
    return { error: "En az bir pasaport dosyası yüklemeniz gerekir." };
  }
  if (groupApplicants.some((item) => item.fullName.length > 120)) {
    return { error: "Ek kişi ad soyad 120 karakteri aşamaz." };
  }

  const totalApplicants = groupApplicants.length + 1;
  if (totalApplicants > 10) {
    return { error: "Toplam başvuru kişi sayısı en fazla 10 olabilir." };
  }
  if (passports.length !== totalApplicants) {
    return {
      error:
        "Yüklenen pasaport sayısı, sizinle birlikte toplam başvuru kişi sayısı ile aynı olmalıdır.",
    };
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
    payload.set("appointmentCity", appointmentCity);
    payload.set("residenceCity", residenceCity);
    payload.set("plannedTravelDate", plannedTravelDate);
    payload.set("applicationType", applicationType);
    payload.set("groupApplicants", JSON.stringify(groupApplicants));
    payload.set("hasAcceptedKVKK", "true");
    payload.set("hasAcceptedTerms", "true");
    for (const passport of passports) {
      payload.append("passports", passport);
    }

    const onboardUrl = await resolveServerApiUrl("/auth/onboard");
    const onboardResponse = await fetch(onboardUrl, {
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
    const loginUrl = await resolveServerApiUrl("/auth/login");
    const loginResponse = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const signedIn =
      loginResponse.ok &&
      (await persistSession(
        loginResponse.headers.getSetCookie(),
        TOKEN_MAX_AGE_SECONDS,
      ));
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
