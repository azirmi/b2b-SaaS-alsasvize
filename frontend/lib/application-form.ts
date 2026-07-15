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
  /** Whether the field is mandatory in UI/server-action validation. */
  required?: boolean;
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

export const EMPLOYER_SECTION_TITLE = "Profesyonel Bilgiler";
export const SPONSOR_SECTION_TITLE = "Sponsor Bilgileri";

export const GENDER_OPTIONS = ["Kadın", "Erkek", "Diğer"] as const;
export const MARITAL_STATUS_OPTIONS = [
  "Evli",
  "Bekar",
  "Boşanmış",
] as const;
export const EMPLOYMENT_STATUS_OPTIONS = [
  "Çalışan",
  "İşveren",
  "Emekli",
  "Öğrenci",
] as const;
export const PASSPORT_TYPE_OPTIONS = [
  "Umuma Mahsus (Bordo)",
  "Hususi (Yeşil)",
  "Hizmet (Gri)",
  "Diplomatik (Siyah)",
] as const;
export const YES_NO_OPTIONS = ["Evet", "Hayır"] as const;

/**
 * The Schengen application definition sourced from BAŞVURU FORMU.docx.
 * Drives both editable and read-only renderers, plus server-action payload
 * extraction, so the shape stays synchronized end-to-end.
 */
export const APPLICATION_FORM_SECTIONS: readonly FormSection[] = [
  {
    title: "Kişisel Bilgiler",
    fields: [
      { name: "firstName", label: "İlk Adı", kind: "text", maxLength: 80 },
      { name: "lastName", label: "Soy İsmi", kind: "text", maxLength: 80 },
      {
        name: "maidenSurname",
        label: "Kızlık Soyadı (varsa)",
        kind: "text",
        maxLength: 80,
        required: false,
      },
      {
        name: "nationalId",
        label: "T.C. Kimlik Numarası",
        kind: "text",
        maxLength: 11,
      },
      { name: "dateOfBirth", label: "Doğum Tarihi", kind: "date" },
      {
        name: "placeOfBirth",
        label: "Doğum Yeri",
        kind: "text",
        maxLength: 120,
      },
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
        name: "nationality",
        label: "Milliyet",
        kind: "text",
        maxLength: 80,
        placeholder: "Türk",
      },
    ],
  },
  {
    title: "İletişim Bilgileri",
    fields: [
      { name: "email", label: "E-posta", kind: "email", maxLength: 160 },
      { name: "phone", label: "Telefon Numarası", kind: "tel", maxLength: 32 },
      {
        name: "residenceCity",
        label: "İkamet Şehri",
        kind: "text",
        maxLength: 120,
      },
      {
        name: "registeredAddress",
        label: "Kayıtlı Adres (e-Devlet kayıtlarındaki gibi)",
        kind: "textarea",
        full: true,
        maxLength: 500,
      },
    ],
  },
  {
    title: EMPLOYER_SECTION_TITLE,
    fields: [
      { name: "occupation", label: "Meslek", kind: "text", maxLength: 120 },
      {
        name: "employmentStatus",
        label: "Çalışma Durumu",
        kind: "select",
        options: EMPLOYMENT_STATUS_OPTIONS,
      },
      {
        name: "employerName",
        label: "İşveren Adı (Vergi levhasındaki gibi)",
        kind: "text",
        maxLength: 160,
        required: false,
      },
      {
        name: "employerAddress",
        label: "İşveren Adresi",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "employerPhone",
        label: "İşveren Telefonu",
        kind: "tel",
        maxLength: 32,
        required: false,
      },
    ],
  },
  {
    title: "Eğitim Bilgileri (Öğrenciyseniz)",
    fields: [
      {
        name: "educationInstitution",
        label: "Eğitim Kurumu",
        kind: "text",
        maxLength: 160,
        required: false,
      },
      {
        name: "educationLevel",
        label: "Eğitim Seviyesi",
        kind: "text",
        maxLength: 120,
        required: false,
      },
    ],
  },
  {
    title: "Pasaport Bilgileri",
    fields: [
      {
        name: "passportType",
        label: "Pasaport Türü",
        kind: "select",
        options: PASSPORT_TYPE_OPTIONS,
      },
      {
        name: "passportNumber",
        label: "Pasaport Numarası",
        kind: "text",
        maxLength: 9,
      },
      {
        name: "passportIssueDate",
        label: "Pasaport Veriliş Tarihi",
        kind: "date",
      },
      {
        name: "passportExpiryDate",
        label: "Pasaport Son Kullanma Tarihi",
        kind: "date",
      },
      {
        name: "passportIssuePlace",
        label: "Pasaportun Verildiği Yer",
        kind: "text",
        maxLength: 120,
      },
      {
        name: "appointmentLocation",
        label: "Randevuya Nereden Katılmak İstiyorsunuz",
        kind: "text",
        maxLength: 120,
      },
    ],
  },
  {
    title: "Vize Bilgileri",
    fields: [
      {
        name: "fingerprintGiven",
        label: "Daha Önce Parmak İzi Verdiniz mi?",
        kind: "select",
        options: YES_NO_OPTIONS,
        required: false,
      },
      {
        name: "fingerprintDate",
        label: "Parmak İzi Gönderim Tarihi",
        kind: "date",
        required: false,
      },
      {
        name: "schengenAppliedBefore",
        label: "Daha Önce Schengen Vizesine Başvurdunuz mu?",
        kind: "select",
        options: YES_NO_OPTIONS,
      },
      {
        name: "previousSchengenCountries",
        label: "Geçmiş Vize Ülkeleri (Son 5 yıl)",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
        placeholder: "Varsa ülkeleri virgül ile yazın.",
      },
    ],
  },
  {
    title: "Seyahat Bilgileri",
    fields: [
      {
        name: "purposeOfTravel",
        label: "Seyahat Amacınız",
        kind: "textarea",
        full: true,
        maxLength: 1000,
      },
      {
        name: "plannedTravelStartDate",
        label: "Planlanan Seyahat Başlangıç Tarihi",
        kind: "date",
      },
      {
        name: "plannedTravelEndDate",
        label: "Planlanan Seyahat Bitiş Tarihi",
        kind: "date",
      },
    ],
  },
  {
    title: SPONSOR_SECTION_TITLE,
    fields: [
      {
        name: "sponsorFullName",
        label: "Sponsorun Tam Adı",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "sponsorIdentity",
        label: "Sponsorun Kimliği",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "sponsorContact",
        label: "Sponsorun İletişim Bilgileri (Telefon / E-posta)",
        kind: "textarea",
        full: true,
        maxLength: 240,
        required: false,
      },
      {
        name: "sponsorRelation",
        label: "Yakınlık Derecesi",
        kind: "text",
        maxLength: 80,
        required: false,
      },
    ],
  },
] as const;

/** Flat list of every field, e.g. for server-action parsing. */
export const APPLICATION_FORM_FIELDS: readonly FormField[] =
  APPLICATION_FORM_SECTIONS.flatMap((section) => section.fields);
