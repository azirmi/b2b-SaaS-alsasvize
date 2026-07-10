import { z } from "zod";

import type { ApplicationDetailsData } from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DENMARK_COUNTRY = "danimarka";
const DENMARK_MIN_LEAD_DAYS = 45;

function normalizeCountry(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("tr-TR");
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    });

const optionalText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    });

const requiredIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .regex(ISO_DATE_RE, { message: `${label} geçerli bir tarih olmalıdır.` });

function buildApplicationFormSchema(targetCountry?: string | null) {
  const denmarkRuleActive =
    normalizeCountry(targetCountry) === DENMARK_COUNTRY;
  const minTravelStartDate = addDaysIso(todayIsoUtc(), DENMARK_MIN_LEAD_DAYS);

  return z
    .object({
    firstName: requiredText("İlk adı", 80),
    lastName: requiredText("Soy ismi", 80),
    maidenSurname: optionalText("Kızlık soyadı", 80),
    nationalId: requiredText("T.C. kimlik numarası", 32),
    dateOfBirth: requiredIsoDate("Doğum tarihi"),
    placeOfBirth: requiredText("Doğum yeri", 120),
    nationality: requiredText("Milliyet", 80),
    gender: requiredText("Cinsiyet", 32),
    maritalStatus: requiredText("Medeni durum", 32),

    email: z
      .string()
      .trim()
      .email({ message: "Geçerli bir e-posta adresi girin." })
      .max(160, { message: "E-posta en fazla 160 karakter olabilir." }),
    phone: requiredText("Telefon numarası", 32),
    residenceCity: requiredText("İkamet şehri", 120),
    registeredAddress: requiredText("Kayıtlı adres", 500),

    occupation: requiredText("Meslek", 120),
    employmentStatus: requiredText("Çalışma durumu", 32),
    isEmployer: z.boolean(),
    employerName: optionalText("İşveren adı", 160),
    employerAddress: optionalText("İşveren adresi", 500),
    employerPhone: optionalText("İşveren telefonu", 32),
    educationInstitution: optionalText("Eğitim kurumu", 160),
    educationLevel: optionalText("Eğitim seviyesi", 120),

    passportType: requiredText("Pasaport türü", 32),
    passportNumber: requiredText("Pasaport numarası", 64),
    passportIssueDate: requiredIsoDate("Pasaport veriliş tarihi"),
    passportExpiryDate: requiredIsoDate("Pasaport son kullanma tarihi"),
    passportIssuePlace: requiredText("Pasaportun verildiği yer", 120),
    appointmentLocation: requiredText("Randevu lokasyonu", 120),

    fingerprintGiven: z
      .string()
      .trim()
      .refine((value) => value === "Evet" || value === "Hayır", {
        message: "Parmak izi bilgisi zorunludur.",
      }),
    fingerprintDate: z.string().trim(),
    schengenAppliedBefore: z
      .string()
      .trim()
      .refine((value) => value === "Evet" || value === "Hayır", {
        message: "Schengen başvuru bilgisi zorunludur.",
      }),
    previousSchengenCountries: optionalText("Geçmiş vize ülkeleri", 500),

    purposeOfTravel: requiredText("Seyahat amacı", 1000),
    plannedTravelStartDate: requiredIsoDate("Seyahat başlangıç tarihi"),
    plannedTravelEndDate: requiredIsoDate("Seyahat bitiş tarihi"),

    hasSponsor: z.boolean(),
    sponsorFullName: optionalText("Sponsor adı", 120),
    sponsorIdentity: optionalText("Sponsor kimliği", 120),
    sponsorContact: optionalText("Sponsor iletişim bilgisi", 240),
    sponsorRelation: optionalText("Yakınlık derecesi", 80),
    })
    .superRefine((value, ctx) => {
      if (
        value.plannedTravelStartDate &&
        value.plannedTravelEndDate &&
        value.plannedTravelEndDate < value.plannedTravelStartDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bitiş tarihi başlangıç tarihinden önce olamaz.",
          path: ["plannedTravelEndDate"],
        });
      }

      if (
        denmarkRuleActive &&
        value.plannedTravelStartDate &&
        value.plannedTravelStartDate < minTravelStartDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Danimarka başvurularında seyahat başlangıcı bugünden en az 45 gün sonrası olmalıdır.",
          path: ["plannedTravelStartDate"],
        });
      }

      if (value.fingerprintGiven === "Evet" && !value.fingerprintDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parmak izi verildiyse tarih zorunludur.",
          path: ["fingerprintDate"],
        });
      }

      if (
        value.schengenAppliedBefore === "Evet" &&
        !value.previousSchengenCountries
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Önceki Schengen ülkeleri zorunludur.",
          path: ["previousSchengenCountries"],
        });
      }

      const employerValues = [
        value.employerName,
        value.employerAddress,
      ].map((item) => item.trim());
      const hasMissingEmployer = employerValues.some((item) => item.length === 0);
      if (value.isEmployer && hasMissingEmployer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "İşveren seçiliyse işveren adı ve adresi zorunludur.",
          path: ["employerName"],
        });
      }

      const sponsorValues = [
        value.sponsorFullName,
        value.sponsorIdentity,
        value.sponsorContact,
        value.sponsorRelation,
      ].map((item) => item.trim());
      const hasMissingSponsor = sponsorValues.some((item) => item.length === 0);
      if (value.hasSponsor && hasMissingSponsor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Sponsor bilgisi girilecekse tüm sponsor alanları doldurulmalıdır.",
          path: ["sponsorFullName"],
        });
      }
    });
}

export const applicationFormSchema = buildApplicationFormSchema();

export function createApplicationFormSchema(targetCountry?: string | null) {
  return buildApplicationFormSchema(targetCountry);
}

export type ApplicationFormValues = z.input<typeof applicationFormSchema>;

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

export function toApplicationFormDefaults(
  details: ApplicationDetailsData | null,
): ApplicationFormValues {
  return {
    firstName: valueOrEmpty(details?.firstName),
    lastName: valueOrEmpty(details?.lastName),
    maidenSurname: valueOrEmpty(details?.maidenSurname),
    nationalId: valueOrEmpty(details?.nationalId),
    dateOfBirth: valueOrEmpty(details?.dateOfBirth),
    placeOfBirth: valueOrEmpty(details?.placeOfBirth),
    nationality: valueOrEmpty(details?.nationality),
    gender: valueOrEmpty(details?.gender),
    maritalStatus: valueOrEmpty(details?.maritalStatus),

    email: valueOrEmpty(details?.email),
    phone: valueOrEmpty(details?.phone),
    residenceCity: valueOrEmpty(details?.residenceCity),
    registeredAddress: valueOrEmpty(details?.registeredAddress),

    occupation: valueOrEmpty(details?.occupation),
    employmentStatus: valueOrEmpty(details?.employmentStatus),
    isEmployer: Boolean(details?.isEmployer),
    employerName: valueOrEmpty(details?.employerName),
    employerAddress: valueOrEmpty(details?.employerAddress),
    employerPhone: valueOrEmpty(details?.employerPhone),
    educationInstitution: valueOrEmpty(details?.educationInstitution),
    educationLevel: valueOrEmpty(details?.educationLevel),

    passportType: valueOrEmpty(details?.passportType),
    passportNumber: valueOrEmpty(details?.passportNumber),
    passportIssueDate: valueOrEmpty(details?.passportIssueDate),
    passportExpiryDate: valueOrEmpty(details?.passportExpiryDate),
    passportIssuePlace: valueOrEmpty(details?.passportIssuePlace),
    appointmentLocation: valueOrEmpty(details?.appointmentLocation),

    fingerprintGiven: details?.fingerprintGiven === "Evet" ? "Evet" : "Hayır",
    fingerprintDate: valueOrEmpty(details?.fingerprintDate),
    schengenAppliedBefore:
      details?.schengenAppliedBefore === "Evet" ? "Evet" : "Hayır",
    previousSchengenCountries: valueOrEmpty(details?.previousSchengenCountries),

    purposeOfTravel: valueOrEmpty(details?.purposeOfTravel),
    plannedTravelStartDate: valueOrEmpty(details?.plannedTravelStartDate),
    plannedTravelEndDate: valueOrEmpty(details?.plannedTravelEndDate),

    hasSponsor: Boolean(
      details?.hasSponsor ||
        details?.sponsorFullName ||
        details?.sponsorIdentity ||
        details?.sponsorContact ||
        details?.sponsorRelation,
    ),
    sponsorFullName: valueOrEmpty(details?.sponsorFullName),
    sponsorIdentity: valueOrEmpty(details?.sponsorIdentity),
    sponsorContact: valueOrEmpty(details?.sponsorContact),
    sponsorRelation: valueOrEmpty(details?.sponsorRelation),
  };
}
