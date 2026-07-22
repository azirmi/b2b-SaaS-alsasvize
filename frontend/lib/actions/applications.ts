"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { APPLICATION_FORM_FIELDS } from "@/lib/application-form";
import {
  buildCountrySpecificDetailsPayload,
  type CountrySpecificCommonInput,
  type CountrySpecificFormType,
} from "@/lib/country-visa-forms";
import {
  ASCII_MULTILINE_RE,
  maskEnglishNoteInput,
} from "@/lib/input-masks";
import type {
  Department,
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
  VisaStage,
} from "@/lib/enums";
import type {
  ActionResult,
  CrmActionState,
  DijizinFormsSnapshot,
} from "@/lib/types";
import { applicationFormSchema } from "@/lib/validators/application-form";

/** Guards the path param before it is interpolated into the API URL. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY_RE = /^\d+(?:[.,]\d{1,2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface DijizinActionResult extends ActionResult {
  message?: string;
}

interface DijizinSnapshotResult extends ActionResult {
  data?: DijizinFormsSnapshot;
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

/** Admin/Sales override for onboarding core data fields. */
export async function updateApplicationCoreData(
  id: string,
  payload: {
    applicationType: string;
    targetCountry: string;
    appointmentCity: string;
    residenceCity: string;
    plannedTravelDate: string;
    applicantCount: number;
  },
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  const applicationType = payload.applicationType.trim();
  const targetCountry = payload.targetCountry.trim();
  const appointmentCity = payload.appointmentCity.trim();
  const residenceCity = payload.residenceCity.trim();
  const plannedTravelDate = payload.plannedTravelDate.trim();
  const applicantCount = payload.applicantCount;

  if (
    !applicationType ||
    !targetCountry ||
    !appointmentCity ||
    !residenceCity ||
    !plannedTravelDate
  ) {
    return { ok: false, error: "Tüm alanlar zorunludur." };
  }
  if (!ISO_DATE_RE.test(plannedTravelDate)) {
    return { ok: false, error: "Seyahat tarihi YYYY-MM-DD formatında olmalıdır." };
  }
  if (!Number.isInteger(applicantCount) || applicantCount < 1) {
    return { ok: false, error: "Kişi sayısı en az 1 olmalıdır." };
  }

  try {
    await serverApi.put(`/admin/applications/${id}/core-data`, {
      applicationType,
      targetCountry,
      appointmentCity,
      residenceCity,
      plannedTravelDate,
      applicantCount,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Çekirdek veriler güncellenemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Admin-only: removes one onboarding applicant from an application. */
export async function removeOnboardingApplicant(
  applicationId: string,
  applicantId: string,
): Promise<ActionResult & { applicantCount?: number }> {
  if (!UUID_RE.test(applicationId)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }
  if (!UUID_RE.test(applicantId)) {
    return { ok: false, error: "Geçersiz kişi referansı." };
  }

  try {
    const response = await serverApi.del<{ applicantCount: number }>(
      `/admin/applications/${applicationId}/applicants/${applicantId}`,
    );

    revalidatePath("/dashboard", "layout");
    return { ok: true, applicantCount: response.applicantCount };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: "Kişi kaydı silinemedi. Lütfen tekrar deneyin.",
    };
  }
}

/** Updates one DOC assistant card status for the given application. */
export async function updateDocAssistantStatus(
  id: string,
  type: DocAssistantDocumentType,
  status: DocAssistantDocumentStatus,
): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/doc-assistant/status`, {
        type,
        status,
      }),
    "Belge durumu güncellenemedi. Lütfen tekrar deneyin.",
  );
}

/** DOC + admin: validates required cards and delivers prepared files to the customer portal. */
export async function deliverToCustomer(
  id: string,
): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) =>
      serverApi.patch(`/applications/${applicationId}/deliver-to-customer`),
    "Dosyalar danışana iletilemedi. Lütfen tekrar deneyin.",
  );
}

/** Reads Dijizin forms snapshot for the sales-side widget on the detail screen. */
export async function getDijizinFormsSnapshot(
  id: string,
): Promise<DijizinSnapshotResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  return {
    ok: false,
    error: "Dijizin entegrasyonu devre dışı bırakıldı.",
  };
}

/** Sends the Dijizin KVKK OTP SMS to the customer tied to this application. */
export async function sendDijizinConsentSms(
  id: string,
): Promise<DijizinActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }

  return {
    ok: false,
    error: "Dijizin entegrasyonu devre dışı bırakıldı.",
  };
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

  return {
    ok: false,
    error: "Dijizin entegrasyonu devre dışı bırakıldı.",
  };
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

  return {
    ok: false,
    error: "Dijizin entegrasyonu devre dışı bırakıldı.",
  };
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
  const totalRaw = String(formData.get("totalAmount") ?? "").trim();
  const totalAmount = Number(totalRaw.replace(",", "."));
  const upfrontRaw = String(formData.get("upfrontPaid") ?? "").trim();
  const receiptFileId = String(formData.get("receiptFileId") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(salesDate)) {
    return { error: "Geçerli bir satış tarihi seçin." };
  }
  if (paymentType !== "NORMAL" && paymentType !== "PREPAID") {
    return { error: "Ödeme türünü seçin." };
  }
  if (!MONEY_RE.test(totalRaw)) {
    return { error: "Toplam tutar yalnızca rakam içermelidir." };
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
    if (!MONEY_RE.test(upfrontRaw)) {
      return { error: "Ön ödeme tutarı yalnızca rakam içermelidir." };
    }
    const upfrontPaid = Number(upfrontRaw.replace(",", "."));
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
  const hasVisaFee = String(formData.get("hasVisaFee") ?? "").trim() === "true";
  const visaFeeAmountRaw = String(formData.get("visaFeeAmount") ?? "").trim();
  const visaFeeReceiptDocumentId = String(
    formData.get("visaFeeReceiptDocumentId") ?? "",
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
  if (!note) {
    return { error: "Randevu notu zorunludur." };
  }
  if (note && !ASCII_MULTILINE_RE.test(note)) {
    return { error: "Not alanı yalnızca İngilizce karakter içerebilir." };
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
  let visaFeeAmount: number | undefined;

  if (appointmentExpenseRaw) {
    if (!MONEY_RE.test(appointmentExpenseRaw)) {
      return { error: "Randevu maliyeti yalnızca rakam içermelidir." };
    }
    const normalized = appointmentExpenseRaw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "Randevu maliyeti için geçerli bir tutar girin." };
    }
    appointmentExpense = parsed;
  }

  if (hasVisaFee) {
    if (!MONEY_RE.test(visaFeeAmountRaw)) {
      return { error: "Vize harcı tutarı yalnızca rakam içermelidir." };
    }
    const normalized = visaFeeAmountRaw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { error: "Vize harcı için geçerli bir tutar girin." };
    }
    visaFeeAmount = parsed;

    if (!UUID_RE.test(visaFeeReceiptDocumentId)) {
      return { error: "Vize harcı dekontu seçimi zorunludur." };
    }
  }

  const payload: {
    appointmentCity: string;
    appointmentDate: string;
    travelDate: string;
    note: string;
    hasVisaFee: boolean;
    visaFeeAmount?: number;
    visaFeeReceiptDocumentId?: string;
    appointmentConfirmationDocumentId: string;
    linkedApplicationIds: string[];
    appointmentExpense?: number;
  } = {
    appointmentCity,
    appointmentDate: appointmentDateIso,
    travelDate,
    note: maskEnglishNoteInput(note, 500),
    hasVisaFee,
    appointmentConfirmationDocumentId,
    linkedApplicationIds: linkedApplicationIds.filter((linkedId) => linkedId !== id),
  };
  if (appointmentExpense !== undefined) {
    payload.appointmentExpense = appointmentExpense;
  }
  if (hasVisaFee) {
    payload.visaFeeAmount = visaFeeAmount;
    payload.visaFeeReceiptDocumentId = visaFeeReceiptDocumentId;
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
  const applicantIndexRaw = String(formData.get("applicantIndex") ?? "1").trim();

  if (!/^\d+$/.test(applicantIndexRaw)) {
    return { error: "Kişi sırası geçersiz." };
  }

  const applicantIndex = Number(applicantIndexRaw);
  if (!Number.isInteger(applicantIndex) || applicantIndex < 1) {
    return { error: "Kişi sırası geçersiz." };
  }

  const candidatePayload: Record<string, string | boolean> = {
    isEmployer,
    hasSponsor,
  };

  for (const field of APPLICATION_FORM_FIELDS) {
    candidatePayload[field.name] = String(formData.get(field.name) ?? "").trim();
  }

  const parsedPayload = applicationFormSchema.safeParse(candidatePayload);
  if (!parsedPayload.success) {
    return {
      error:
        parsedPayload.error.issues[0]?.message ??
        "Lütfen form alanlarını kontrol ederek tekrar deneyin.",
    };
  }

  const payload: Record<string, string | number | boolean> = {
    ...parsedPayload.data,
    applicantIndex,
  };

  if (payload.fingerprintGiven === "") {
    payload.fingerprintGiven = "Hayır";
  }
  if (payload.fingerprintGiven !== "Evet") {
    payload.fingerprintDate = "";
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

/** Saves country-specific (UK/USA) customer form data without breaking default flow. */
export async function saveCountrySpecificApplicationDetails(
  id: string,
  applicantIndex: number,
  formType: CountrySpecificFormType,
  fields: Record<string, string>,
  common: CountrySpecificCommonInput,
): Promise<CrmActionState> {
  if (!UUID_RE.test(id)) {
    return { error: "Geçersiz başvuru referansı." };
  }

  if (!Number.isInteger(applicantIndex) || applicantIndex < 1) {
    return { error: "Kişi sırası geçersiz." };
  }

  const hasMissingField = Object.values(fields).some(
    (value) => String(value ?? "").trim().length === 0,
  );
  if (hasMissingField) {
    return {
      error: "Lütfen tüm alanları doldurun.",
    };
  }

  if (common.isEmployer) {
    if (!common.employerName?.trim() || !common.employerAddress?.trim()) {
      return {
        error: "İşveren seçiliyse işveren adı ve adresi zorunludur.",
      };
    }
  }

  if (common.hasSponsor) {
    const sponsorMissing = [
      common.sponsorFullName,
      common.sponsorIdentity,
      common.sponsorContact,
      common.sponsorRelation,
    ].some((value) => String(value ?? "").trim().length === 0);

    if (sponsorMissing) {
      return {
        error:
          "Sponsor bilgisi girilecekse tüm sponsor alanları doldurulmalıdır.",
      };
    }
  }

  const payload = buildCountrySpecificDetailsPayload(
    formType,
    fields,
    applicantIndex,
    common,
  );

  try {
    await serverApi.put(`/applications/${id}/details`, payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return {
      error: "Ülkeye özel başvuru formu kaydedilemedi. Lütfen tekrar deneyin.",
    };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
