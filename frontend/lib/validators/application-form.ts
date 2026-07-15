import { z } from "zod";

z.config(z.locales.tr());
z.config({
  customError: (issue) => {
    const code = String((issue as { code?: string }).code ?? "");
    const expected = String(
      (issue as { expected?: string }).expected ?? "",
    ).toLowerCase();

    if (code === "invalid_date") {
      return "Lütfen geçerli bir tarih giriniz.";
    }

    if (code === "invalid_type") {
      if (expected === "date") {
        return "Lütfen geçerli bir tarih giriniz.";
      }
      return "Bu alan zorunludur.";
    }

    if (code === "too_small" || code === "too_big") {
      return "Geçersiz uzunluk.";
    }

    return undefined;
  },
});

import {
  ALPHA_TEXT_RE,
  ASCII_MULTILINE_RE,
  ASCII_SINGLE_LINE_RE,
  NAME_INPUT_RE,
  PASSPORT_NUMBER_RE,
  PHONE_INPUT_RE,
  TC_KIMLIK_RE,
} from "@/lib/input-masks";
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

const requiredName = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .regex(NAME_INPUT_RE, {
      message: `${label} yalnızca İngilizce harf içermelidir.`,
    });

const optionalName = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .refine((value) => value === "" || NAME_INPUT_RE.test(value), {
      message: `${label} yalnızca İngilizce harf içermelidir.`,
    });

const requiredAlphaText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .regex(ALPHA_TEXT_RE, {
      message: `${label} yalnızca İngilizce harf içermelidir.`,
    });

const optionalAlphaText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .refine((value) => value === "" || ALPHA_TEXT_RE.test(value), {
      message: `${label} yalnızca İngilizce harf içermelidir.`,
    });

const requiredSingleLineText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .regex(ASCII_SINGLE_LINE_RE, {
      message: `${label} yalnızca İngilizce karakter içerebilir.`,
    });

const optionalSingleLineText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .refine((value) => value === "" || ASCII_SINGLE_LINE_RE.test(value), {
      message: `${label} yalnızca İngilizce karakter içerebilir.`,
    });

const requiredMultilineText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .regex(ASCII_MULTILINE_RE, {
      message: `${label} yalnızca İngilizce karakter içerebilir.`,
    });

const optionalMultilineText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .refine((value) => value === "" || ASCII_MULTILINE_RE.test(value), {
      message: `${label} yalnızca İngilizce karakter içerebilir.`,
    });

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    });

const requiredPhone = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `${label} zorunludur.` })
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .regex(PHONE_INPUT_RE, {
      message: `${label} yalnızca rakam ve + içerebilir.`,
    });

const optionalPhone = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${label} en fazla ${maxLength} karakter olabilir.`,
    })
    .refine((value) => value === "" || PHONE_INPUT_RE.test(value), {
      message: `${label} yalnızca rakam ve + içerebilir.`,
    });

const requiredTcKimlik = () =>
  z
    .string()
    .trim()
    .regex(TC_KIMLIK_RE, {
      message: "T.C. kimlik numarası 11 rakam olmalıdır.",
    });

const requiredPassportNumber = () =>
  z
    .string()
    .trim()
    .regex(PASSPORT_NUMBER_RE, {
      message:
        "Pasaport numarası U veya H ile başlamalı ve 8 rakam içermelidir.",
    });

const requiredIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: "Bu alan zorunludur." })
    .regex(ISO_DATE_RE, { message: "Lütfen geçerli bir tarih giriniz." });

const optionalIsoDate = () =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
      }

      return value;
    },
    z
      .string()
      .regex(ISO_DATE_RE, { message: "Geçerli bir tarih giriniz" })
      .optional(),
  );

function buildApplicationFormSchema(targetCountry?: string | null) {
  const denmarkRuleActive =
    normalizeCountry(targetCountry) === DENMARK_COUNTRY;
  const minTravelStartDate = addDaysIso(todayIsoUtc(), DENMARK_MIN_LEAD_DAYS);

  return z
    .object({
    firstName: requiredName("İlk adı", 80),
    lastName: requiredName("Soy ismi", 80),
    maidenSurname: optionalName("Kızlık soyadı", 80),
    nationalId: requiredTcKimlik(),
    dateOfBirth: requiredIsoDate("Doğum tarihi"),
    placeOfBirth: requiredAlphaText("Doğum yeri", 120),
    nationality: requiredAlphaText("Milliyet", 80),
    gender: requiredText("Cinsiyet", 32),
    maritalStatus: requiredText("Medeni durum", 32),

    email: z
      .string()
      .trim()
      .email({ message: "Geçerli bir e-posta adresi girin." })
      .max(160, { message: "E-posta en fazla 160 karakter olabilir." }),
    phone: requiredPhone("Telefon numarası", 32),
    residenceCity: requiredAlphaText("İkamet şehri", 120),
    registeredAddress: requiredMultilineText("Kayıtlı adres", 500),

    occupation: requiredAlphaText("Meslek", 120),
    employmentStatus: requiredText("Çalışma durumu", 32),
    isEmployer: z.boolean(),
    employerName: optionalSingleLineText("İşveren adı", 160),
    employerAddress: optionalMultilineText("İşveren adresi", 500),
    employerPhone: optionalPhone("İşveren telefonu", 32),
    educationInstitution: optionalSingleLineText("Eğitim kurumu", 160),
    educationLevel: optionalAlphaText("Eğitim seviyesi", 120),

    passportType: requiredText("Pasaport türü", 32),
    passportNumber: requiredPassportNumber(),
    passportIssueDate: requiredIsoDate("Pasaport veriliş tarihi"),
    passportExpiryDate: requiredIsoDate("Pasaport son kullanma tarihi"),
    passportIssuePlace: requiredAlphaText("Pasaportun verildiği yer", 120),
    appointmentLocation: requiredAlphaText("Randevu lokasyonu", 120),

    fingerprintGiven: z
      .string()
      .trim()
      .refine((value) => value === "" || value === "Evet" || value === "Hayır", {
        message: "Parmak izi bilgisi yalnızca Evet veya Hayır olabilir.",
      }),
    fingerprintDate: optionalIsoDate(),
    schengenAppliedBefore: z
      .string()
      .trim()
      .refine((value) => value === "Evet" || value === "Hayır", {
        message: "Schengen başvuru bilgisi zorunludur.",
      }),
    previousSchengenCountries: optionalMultilineText("Geçmiş vize ülkeleri", 500),

    purposeOfTravel: requiredMultilineText("Seyahat amacı", 1000),
    plannedTravelStartDate: requiredIsoDate("Seyahat başlangıç tarihi"),
    plannedTravelEndDate: requiredIsoDate("Seyahat bitiş tarihi"),

    hasSponsor: z.boolean(),
    sponsorFullName: optionalName("Sponsor adı", 120),
    sponsorIdentity: optionalSingleLineText("Sponsor kimliği", 120),
    sponsorContact: optionalMultilineText("Sponsor iletişim bilgisi", 240),
    sponsorRelation: optionalAlphaText("Yakınlık derecesi", 80),
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

    fingerprintGiven:
      details?.fingerprintGiven === "Evet"
        ? "Evet"
        : details?.fingerprintGiven === "Hayır"
          ? "Hayır"
          : "",
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
