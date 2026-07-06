import type { ApplicationDetailsData } from "./types";

/** Every editable field on the application form. */
export type ApplicationFieldName = Exclude<
  keyof ApplicationDetailsData,
  "submittedAt" | "updatedAt"
>;

export type FieldKind =
  | "text"
  | "date"
  | "tel"
  | "email"
  | "number"
  | "textarea"
  | "select";

export interface FormField {
  name: ApplicationFieldName;
  label: string;
  kind: FieldKind;
  /** Options for `select` fields. */
  options?: readonly string[];
  placeholder?: string;
  /** Span both columns (textarea / long fields). */
  full?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

export const GENDER_OPTIONS = ["Kadın", "Erkek", "Diğer"] as const;
export const MARITAL_STATUS_OPTIONS = [
  "Bekar",
  "Evli",
  "Boşanmış",
  "Dul",
] as const;
export const VISA_TYPE_OPTIONS = [
  "Turistik",
  "Ticari",
  "Öğrenci",
  "Çalışma",
  "Aile Ziyareti",
  "Transit",
] as const;

/**
 * The comprehensive "Başvuru Formu" definition. Drives the editable customer
 * form, the read-only staff view, and the server action's field parsing so the
 * three never drift apart.
 */
export const APPLICATION_FORM_SECTIONS: readonly FormSection[] = [
  {
    title: "Kişisel Bilgiler",
    fields: [
      { name: "fullName", label: "Ad Soyad", kind: "text", maxLength: 120 },
      { name: "dateOfBirth", label: "Doğum Tarihi", kind: "date" },
      {
        name: "placeOfBirth",
        label: "Doğum Yeri",
        kind: "text",
        maxLength: 120,
      },
      { name: "nationality", label: "Uyruk", kind: "text", maxLength: 80 },
      {
        name: "gender",
        label: "Cinsiyet",
        kind: "select",
        options: GENDER_OPTIONS,
      },
      {
        name: "maritalStatus",
        label: "Medeni Durum",
        kind: "select",
        options: MARITAL_STATUS_OPTIONS,
      },
      {
        name: "nationalId",
        label: "T.C. Kimlik No",
        kind: "text",
        maxLength: 32,
      },
    ],
  },
  {
    title: "Pasaport Bilgileri",
    fields: [
      {
        name: "passportNumber",
        label: "Pasaport No",
        kind: "text",
        maxLength: 64,
      },
      { name: "passportIssueDate", label: "Veriliş Tarihi", kind: "date" },
      { name: "passportExpiryDate", label: "Geçerlilik Tarihi", kind: "date" },
    ],
  },
  {
    title: "İletişim ve Adres",
    fields: [
      { name: "phone", label: "Telefon", kind: "tel", maxLength: 32 },
      { name: "email", label: "E-posta", kind: "email", maxLength: 160 },
      {
        name: "homeAddress",
        label: "Ev Adresi",
        kind: "textarea",
        full: true,
        maxLength: 300,
      },
      { name: "city", label: "Şehir", kind: "text", maxLength: 120 },
      {
        name: "countryOfResidence",
        label: "İkamet Ülkesi",
        kind: "text",
        maxLength: 80,
      },
    ],
  },
  {
    title: "Seyahat Bilgileri",
    fields: [
      {
        name: "targetCountry",
        label: "Hedef Ülke",
        kind: "text",
        maxLength: 80,
      },
      {
        name: "visaType",
        label: "Vize Türü",
        kind: "select",
        options: VISA_TYPE_OPTIONS,
      },
      {
        name: "purposeOfTravel",
        label: "Seyahat Amacı",
        kind: "textarea",
        full: true,
        maxLength: 1000,
      },
      { name: "intendedArrivalDate", label: "Planlanan Gidiş", kind: "date" },
      {
        name: "intendedDepartureDate",
        label: "Planlanan Dönüş",
        kind: "date",
      },
      {
        name: "durationOfStayDays",
        label: "Kalış Süresi (gün)",
        kind: "number",
        min: 1,
        max: 3650,
      },
    ],
  },
  {
    title: "İş ve Finansal Bilgiler",
    fields: [
      { name: "occupation", label: "Meslek", kind: "text", maxLength: 120 },
      {
        name: "employerName",
        label: "İşveren / Kurum",
        kind: "text",
        maxLength: 160,
      },
      {
        name: "monthlyIncome",
        label: "Aylık Gelir",
        kind: "text",
        maxLength: 80,
        placeholder: "Örn. 45.000 TL",
      },
    ],
  },
  {
    title: "Acil Durum İletişim",
    fields: [
      {
        name: "emergencyContactName",
        label: "Acil Durumda Aranacak Kişi",
        kind: "text",
        maxLength: 120,
      },
      {
        name: "emergencyContactPhone",
        label: "Acil Durum Telefonu",
        kind: "tel",
        maxLength: 32,
      },
    ],
  },
] as const;

/** Flat list of every field, e.g. for server-action parsing. */
export const APPLICATION_FORM_FIELDS: readonly FormField[] =
  APPLICATION_FORM_SECTIONS.flatMap((section) => section.fields);
