"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { APPLICATION_FORM_FIELDS } from "@/lib/application-form";
import type { Department, VisaStage } from "@/lib/enums";
import type { ActionResult, CrmActionState } from "@/lib/types";

/** Guards the path param before it is interpolated into the API URL. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared runner for application mutations. Validates the id, runs the request on
 * the server (auth rides the forwarded HTTP-only cookie via `serverApi` — the
 * browser `api` client would send nothing here), maps `ApiError` to an inline
 * message, and revalidates the `/dashboard` subtree so lists and the detail view
 * re-render without a reload. Other staff clients update via the socket events
 * the backend emits post-commit.
 */
async function runApplicationMutation(
  id: string,
  request: (applicationId: string) => Promise<unknown>,
  fallback: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Invalid application reference." };
  }

  try {
    await request(id);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: fallback };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Claims a pooled application for the current staff member (pool -> process). */
export async function claimApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.post(`/applications/${applicationId}/claim`),
    "Unable to claim the application. Please retry.",
  );
}

/** Advances an application from its current *_PROCESS stage to the next stage. */
export async function advanceStage(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/stage`),
    "Unable to advance the application. Please retry.",
  );
}

/** Pauses an in-flight application (stops the SLA clock). */
export async function pauseApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/pause`),
    "Unable to pause the application. Please retry.",
  );
}

/** Resumes a paused application back to its pre-pause stage. */
export async function resumeApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/resume`),
    "Unable to resume the application. Please retry.",
  );
}

/** God-Mode: force-reassign an application's department slot to another staff member. */
export async function reassignApplication(
  id: string,
  department: Department,
  newStaffId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(newStaffId)) {
    return { ok: false, error: "Invalid staff reference." };
  }
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/reassign`, {
        department,
        newStaffId,
      }),
    "Unable to reassign the application. Please retry.",
  );
}

/** God-Mode: force an application into any stage (bypasses the normal gates). */
export async function forceStage(
  id: string,
  stage: VisaStage,
): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/force-stage`, { stage }),
    "Unable to change the stage. Please retry.",
  );
}

/** God-Mode: immediately cancel an application. */
export async function forceCancelApplication(
  id: string,
): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/force-cancel`),
    "Unable to cancel the application. Please retry.",
  );
}

/**
 * Saves the Sales CRM data entry (`PATCH /applications/:id`). Every field is
 * required: a successful save is what unlocks advancing out of SALES_PROCESS.
 * Bound to the application id, so it plugs straight into `useActionState`.
 */
export async function saveCrm(
  id: string,
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  if (!UUID_RE.test(id)) {
    return { error: "Geçersiz başvuru referansı." };
  }

  const salesDate = String(formData.get("salesDate") ?? "").trim();
  const residenceCity = String(formData.get("residenceCity") ?? "").trim();
  const paymentType = String(formData.get("paymentType") ?? "").trim();
  const totalAmount = Number(String(formData.get("totalAmount") ?? "").trim());
  const upfrontRaw = String(formData.get("upfrontPaid") ?? "").trim();
  const receiptFileId = String(formData.get("receiptFileId") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(salesDate)) {
    return { error: "Geçerli bir satış tarihi seçin." };
  }
  if (!residenceCity) {
    return { error: "İkamet şehri gereklidir." };
  }
  if (paymentType !== "NORMAL" && paymentType !== "PREPAID") {
    return { error: "Ödeme türünü seçin." };
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: "Toplam tutar pozitif bir değer olmalıdır." };
  }

  const payload: Record<string, string | number> = {
    salesDate,
    residenceCity,
    paymentType,
    totalAmount,
  };

  if (paymentType === "PREPAID") {
    const upfrontPaid = Number(upfrontRaw);
    if (!Number.isFinite(upfrontPaid) || upfrontPaid < 0) {
      return { error: "Ön ödeme tutarı geçerli olmalıdır." };
    }
    if (upfrontPaid > totalAmount) {
      return { error: "Ön ödeme toplam tutarı aşamaz." };
    }
    payload.upfrontPaid = upfrontPaid;
  }

  if (receiptFileId) {
    if (!UUID_RE.test(receiptFileId)) {
      return { error: "Dekont referansı geçersiz." };
    }
    payload.receiptFileId = receiptFileId;
  }

  try {
    await serverApi.patch(`/applications/${id}`, payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "CRM verileri kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Saves the customer's comprehensive application form ("Başvuru Formu") via
 * `PUT /applications/:id/details`. Every field is required; the backend
 * re-validates. Bound to the application id for `useActionState`.
 */
export async function saveApplicationDetails(
  id: string,
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  if (!UUID_RE.test(id)) {
    return { error: "Geçersiz başvuru referansı." };
  }

  const payload: Record<string, string | number> = {};
  for (const field of APPLICATION_FORM_FIELDS) {
    const raw = String(formData.get(field.name) ?? "").trim();
    const required = field.required !== false;
    if (!raw && required) {
      return { error: "Lütfen tüm alanları eksiksiz doldurun." };
    }
    if (!raw && !required) {
      continue;
    }
    if (field.kind === "number") {
      const value = Number(raw);
      if (!Number.isInteger(value)) {
        return { error: "Sayısal alanlar için geçerli bir sayı giriniz." };
      }
      payload[field.name] = value;
    } else {
      payload[field.name] = raw;
    }
  }

  try {
    await serverApi.put(`/applications/${id}/details`, payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Form kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
