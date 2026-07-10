"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { APPLICATION_FORM_FIELDS } from "@/lib/application-form";
import type { Department, VisaStage } from "@/lib/enums";
import type {
  ActionResult,
  CrmActionState,
  DijizinFormsSnapshot,
} from "@/lib/types";

/** Guards the path param before it is interpolated into the API URL. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DijizinActionResult extends ActionResult {
  message?: string;
}

interface DijizinSnapshotResult extends ActionResult {
  data?: DijizinFormsSnapshot;
}

function mapActionError(error: unknown, fallback: string): ActionResult {
  if (error instanceof ApiError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}

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
    return { ok: false, error: "Geçersiz başvuru referansı." };
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
    "Başvuru alınamadı. Lütfen tekrar deneyin.",
  );
}

/** Advances an application from its current *_PROCESS stage to the next stage. */
export async function advanceStage(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/stage`),
    "Başvuru ilerletilemedi. Lütfen tekrar deneyin.",
  );
}

/** Pauses an in-flight application (stops the SLA clock). */
export async function pauseApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/pause`),
    "Başvuru duraklatılamadı. Lütfen tekrar deneyin.",
  );
}

/** Resumes a paused application back to its pre-pause stage. */
export async function resumeApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/resume`),
    "Başvuru devam ettirilemedi. Lütfen tekrar deneyin.",
  );
}

/** God-Mode: force-reassign an application's department slot to another staff member. */
export async function reassignApplication(
  id: string,
  department: Department,
  newStaffId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(newStaffId)) {
    return { ok: false, error: "Geçersiz personel referansı." };
  }
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/reassign`, {
        department,
        newStaffId,
      }),
    "Başvuru yeniden atanamadı. Lütfen tekrar deneyin.",
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
    "Aşama değiştirilemedi. Lütfen tekrar deneyin.",
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
    "Başvuru iptal edilemedi. Lütfen tekrar deneyin.",
  );
}

/** Reads Dijizin forms snapshot for the sales-side widget on the detail screen. */
export async function getDijizinFormsSnapshot(
  id: string,
): Promise<DijizinSnapshotResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  try {
    const data = await serverApi.get<DijizinFormsSnapshot>(
      `/applications/${id}/dijizin/forms`,
    );
    return { ok: true, data };
  } catch (error) {
    return mapActionError(
      error,
      "Dijizin form bilgileri alınamadı. Lütfen tekrar deneyin.",
    );
  }
}

/** Sends the Dijizin KVKK OTP SMS to the customer tied to this application. */
export async function sendDijizinConsentSms(
  id: string,
): Promise<DijizinActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  try {
    const response = await serverApi.post<{ message?: string }>(
      `/applications/${id}/dijizin/consent/sms`,
    );
    revalidatePath("/dashboard", "layout");
    return {
      ok: true,
      message: response.message ?? "KVKK onay SMS'i gönderildi.",
    };
  } catch (error) {
    return mapActionError(
      error,
      "KVKK onay SMS'i gönderilemedi. Lütfen tekrar deneyin.",
    );
  }
}

/** Verifies the Dijizin KVKK OTP and opens the Sales -> DOC gate. */
export async function verifyDijizinConsentCode(
  id: string,
  code: string,
): Promise<DijizinActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  const normalizedCode = code.trim();
  if (!/^\d{1,16}$/.test(normalizedCode)) {
    return { ok: false, error: "Doğrulama kodu yalnızca rakamlardan oluşmalıdır." };
  }

  try {
    const response = await serverApi.post<{ message?: string }>(
      `/applications/${id}/dijizin/consent/verify`,
      { code: normalizedCode },
    );
    revalidatePath("/dashboard", "layout");
    return {
      ok: true,
      message: response.message ?? "KVKK doğrulaması başarıyla tamamlandı.",
    };
  } catch (error) {
    return mapActionError(
      error,
      "KVKK doğrulaması tamamlanamadı. Lütfen tekrar deneyin.",
    );
  }
}

/** Sends one selected Dijizin form to the customer. */
export async function sendDijizinFormToCustomer(
  id: string,
  formId: string,
): Promise<DijizinActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  const normalizedFormId = formId.trim();
  if (!normalizedFormId) {
    return { ok: false, error: "Gönderilecek formu seçin." };
  }

  try {
    const response = await serverApi.post<{ message?: string }>(
      `/applications/${id}/dijizin/forms/send`,
      { formId: normalizedFormId },
    );
    revalidatePath("/dashboard", "layout");
    return {
      ok: true,
      message: response.message ?? "Form müşteriye başarıyla gönderildi.",
    };
  } catch (error) {
    return mapActionError(
      error,
      "Form müşteriye gönderilemedi. Lütfen tekrar deneyin.",
    );
  }
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
  const paymentType = String(formData.get("paymentType") ?? "").trim();
  const totalAmount = Number(String(formData.get("totalAmount") ?? "").trim());
  const upfrontRaw = String(formData.get("upfrontPaid") ?? "").trim();
  const receiptFileId = String(formData.get("receiptFileId") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(salesDate)) {
    return { error: "Geçerli bir satış tarihi seçin." };
  }
  if (paymentType !== "NORMAL" && paymentType !== "PREPAID") {
    return { error: "Ödeme türünü seçin." };
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: "Toplam tutar pozitif bir değer olmalıdır." };
  }

  const payload: Record<string, string | number> = {
    salesDate,
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
 * DOC + admin appointment workflow:
 * saves appointment city/date and force-updates customer travel date.
 */
export async function saveAppointmentOps(
  id: string,
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  if (!UUID_RE.test(id)) {
    return { error: "Geçersiz başvuru referansı." };
  }

  const appointmentCity = String(formData.get("appointmentCity") ?? "").trim();
  const appointmentDate = String(formData.get("appointmentDate") ?? "").trim();
  const travelDate = String(formData.get("travelDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const appointmentExpenseRaw = String(
    formData.get("appointmentExpense") ?? "",
  ).trim();
  const appointmentConfirmationDocumentId = String(
    formData.get("appointmentConfirmationDocumentId") ?? "",
  ).trim();
  const linkedApplicationIds = Array.from(
    new Set(
      formData
        .getAll("linkedApplicationIds")
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (!appointmentCity || !appointmentDate || !travelDate) {
    return { error: "Randevu şehri, randevu tarihi ve seyahat tarihi zorunludur." };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(appointmentDate)) {
    return { error: "Geçerli bir randevu tarih/saat seçin." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
    return { error: "Geçerli bir seyahat tarihi seçin." };
  }
  if (!UUID_RE.test(appointmentConfirmationDocumentId)) {
    return { error: "Randevu onay belgesi seçimi zorunludur." };
  }

  for (const linkedId of linkedApplicationIds) {
    if (!UUID_RE.test(linkedId)) {
      return { error: "Bağlı başvuru listesinde geçersiz kayıt bulundu." };
    }
  }

  const appointmentDateValue = new Date(appointmentDate);
  if (Number.isNaN(appointmentDateValue.getTime())) {
    return { error: "Randevu tarih/saat değeri geçersiz." };
  }
  const appointmentDateIso = appointmentDateValue.toISOString();

  let appointmentExpense: number | undefined;

  if (appointmentExpenseRaw) {
    const normalized = appointmentExpenseRaw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "Randevu maliyeti için geçerli bir tutar girin." };
    }
    appointmentExpense = parsed;
  }

  const payload: {
    appointmentCity: string;
    appointmentDate: string;
    travelDate: string;
    appointmentConfirmationDocumentId: string;
    linkedApplicationIds: string[];
    note?: string;
    appointmentExpense?: number;
  } = {
    appointmentCity,
    appointmentDate: appointmentDateIso,
    travelDate,
    appointmentConfirmationDocumentId,
    linkedApplicationIds: linkedApplicationIds.filter((linkedId) => linkedId !== id),
  };
  if (note) {
    payload.note = note;
  }
  if (appointmentExpense !== undefined) {
    payload.appointmentExpense = appointmentExpense;
  }

  try {
    await serverApi.patch(`/applications/${id}/appointment-ops`, payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Randevu işlemleri kaydedilemedi. Lütfen tekrar deneyin." };
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

  const isEmployer = String(formData.get("isEmployer") ?? "").trim() === "true";
  const hasSponsor = String(formData.get("hasSponsor") ?? "").trim() === "true";

  const payload: Record<string, string | number | boolean> = {
    isEmployer,
    hasSponsor,
  };
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

  if (!isEmployer) {
    delete payload.employerName;
    delete payload.employerAddress;
    delete payload.employerPhone;
  }
  if (!hasSponsor) {
    delete payload.sponsorFullName;
    delete payload.sponsorIdentity;
    delete payload.sponsorContact;
    delete payload.sponsorRelation;
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
