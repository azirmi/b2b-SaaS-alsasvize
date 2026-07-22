import type { ApplicationDetailsData } from "./types";
import type { CountrySpecificFormType } from "./country-visa-forms";

/** Every editable field on the standard application form. */
export type ApplicationFieldName = Exclude<
  keyof ApplicationDetailsData,
  "submittedAt" | "updatedAt"
>;

/**
 * Extra fields the UK/USA bilgi forms request on top of the standard form.
 * Stored in `metadata.countrySpecificForms[applicantIndex].fields`, not in
 * dedicated DB columns, so they never touch the shared details DTO contract.
 */
export type CountryExtraFieldName =
  // ── United Kingdom ──────────────────────────────────────────────────
  | "ukIdIssueExpiry"
  | "ukAddressDuration"
  | "ukHomeOwnership"
  | "ukOtherCitizenship"
  | "ukFatherInfo"
  | "ukMotherInfo"
  | "ukMarriageDate"
  | "ukSpouseInfo"
  | "ukSpousePassportNo"
  | "ukChildrenInfo"
  | "ukFamilyLivesTogether"
  | "ukFamilyAddressIfSeparate"
  | "ukEmploymentStartDate"
  | "ukJobPosition"
  | "ukMonthlyNetIncome"
  | "ukAnnualIncome"
  | "ukOtherIncomeSavings"
  | "ukMonthlyExpenses"
  | "ukMonthlyFamilySupport"
  | "ukTripBudget"
  | "ukWorkedMilitaryPublicPress"
  | "ukMilitaryDetail"
  | "ukHasInvitation"
  | "ukVisaRejectionBefore"
  | "ukAppliedBefore"
  | "ukRejectionDetail"
  | "ukRelativesInUk"
  | "ukTravelCompanions"
  | "ukTravelFinancedBy"
  | "ukSpendPlan"
  | "ukRequestedVisaDuration"
  // ── United States ───────────────────────────────────────────────────
  | "usaSocialMedia"
  | "usaDependents"
  | "usaParentsInfo"
  | "usaDurationOfStay"
  | "usaStayAddress"
  | "usaTravelFinancedBy"
  | "usaContacts"
  | "usaContactAddress"
  | "usaRelativesInUs"
  | "usaEducationGraduation"
  | "usaWorkEducationHistory"
  | "usaMonthlyIncome"
  | "usaMonthlyExpenses"
  | "usaStaySpendPlan"
  | "usaTicketsPurchasePlan"
  | "usaAdditionalNotes";

/** Union of standard + country-extra field names the renderer can host. */
export type FormFieldName = ApplicationFieldName | CountryExtraFieldName;

export type FieldKind =
  | "text"
  | "date"
  | "tel"
  | "email"
  | "number"
  | "textarea"
  | "select";

export interface FormField {
  name: FormFieldName;
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
        placeholder: "Örn: ... Mah. ... Sok. ... Bina No:... İlçe/İl",
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

/**
 * United Kingdom "İNGİLTERE VİZE BİLGİ FORMU" extras. These are the questions the
 * UK bilgi form asks beyond the standard Schengen form; the shared fields (name,
 * passport, address, employer, sponsor, travel purpose/dates, previous trips)
 * are already covered by `APPLICATION_FORM_SECTIONS` and are NOT repeated here.
 * All optional so a save never blocks — the customer fills what applies.
 */
export const UK_EXTRA_SECTIONS: readonly FormSection[] = [
  {
    title: "İngiltere · Ek Kimlik ve İkamet Bilgileri",
    fields: [
      {
        name: "ukIdIssueExpiry",
        label: "Kimlik Veriliş ve Bitiş Tarihi",
        kind: "text",
        maxLength: 120,
        required: false,
        placeholder: "Örn: Veriliş 27.06.2018 – Bitiş 27.06.2028",
      },
      {
        name: "ukAddressDuration",
        label: "Bu Adreste Ne Kadardır Yaşıyorsunuz (Yıl / Ay)",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukHomeOwnership",
        label: "Oturduğunuz Ev Kira mı, Size mi Ait",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukOtherCitizenship",
        label: "Başka Bir Ülke Vatandaşlığınız Var mı? (Varsa belirtiniz)",
        kind: "text",
        maxLength: 120,
        required: false,
      },
    ],
  },
  {
    title: "İngiltere · Aile Bilgileri",
    fields: [
      {
        name: "ukFatherInfo",
        label: "Baba Adı Soyadı / Doğum Tarihi / Doğum Yeri / Uyruğu",
        kind: "textarea",
        full: true,
        maxLength: 240,
        required: false,
      },
      {
        name: "ukMotherInfo",
        label: "Anne Adı Soyadı / Doğum Tarihi / Doğum Yeri / Uyruğu",
        kind: "textarea",
        full: true,
        maxLength: 240,
        required: false,
      },
      {
        name: "ukMarriageDate",
        label: "Evli İseniz Evlilik Tarihi",
        kind: "date",
        required: false,
      },
      {
        name: "ukSpouseInfo",
        label: "Eşinizin Adı Soyadı / Doğum Tarihi / Doğum Yeri / Uyruğu",
        kind: "textarea",
        full: true,
        maxLength: 240,
        required: false,
      },
      {
        name: "ukSpousePassportNo",
        label: "Eşiniz Seyahat Etmeyecekse Bile Pasaport No",
        kind: "text",
        maxLength: 32,
        required: false,
      },
      {
        name: "ukChildrenInfo",
        label: "Çocuğunuz Varsa Adı / Doğum Tarihi / Doğum Yeri",
        kind: "textarea",
        full: true,
        maxLength: 300,
        required: false,
      },
      {
        name: "ukFamilyLivesTogether",
        label: "Eş ve Çocuklarınız Sizinle Birlikte mi Yaşıyor?",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukFamilyAddressIfSeparate",
        label: "Birlikte Değilse Adresleri",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
    ],
  },
  {
    title: "İngiltere · İş ve Finansal Bilgiler",
    fields: [
      {
        name: "ukEmploymentStartDate",
        label: "İşe Giriş Tarihi",
        kind: "date",
        required: false,
      },
      {
        name: "ukJobPosition",
        label: "Pozisyonunuz",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukMonthlyNetIncome",
        label: "Aylık Net Gelir",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukAnnualIncome",
        label: "Yıllık Gelir",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukOtherIncomeSavings",
        label: "Başka Gelir ya da Birikiminiz Var mı? (Kira geliri vb.) Varsa Tutarı",
        kind: "textarea",
        full: true,
        maxLength: 300,
        required: false,
      },
      {
        name: "ukMonthlyExpenses",
        label: "Aylık Giderler Toplamı",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukMonthlyFamilySupport",
        label: "Aileye Verilen Aylık Tutar",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukTripBudget",
        label: "Bu Gezi İçin Elinizde Bulunan Para",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukWorkedMilitaryPublicPress",
        label: "Daha Önce Askeriye / Kamu / Basın Sektöründe Çalıştınız mı?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukMilitaryDetail",
        label: "Detay (Askeriye / Kamu / Basın)",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
    ],
  },
  {
    title: "İngiltere · Vize ve Seyahat Detayları",
    fields: [
      {
        name: "ukHasInvitation",
        label: "İngiltere Davetiyesi Var mı?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukVisaRejectionBefore",
        label: "Vize Reddi Aldınız mı?",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukAppliedBefore",
        label: "Daha Önce İngiltere Vizesine Başvurdunuz mu?",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "ukRejectionDetail",
        label: "Red Varsa Tarihi ve Nedeni",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "ukRelativesInUk",
        label: "İngiltere'de Yaşayan Akraba Var mı?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukTravelCompanions",
        label: "Kiminle Seyahat Edeceksiniz?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukTravelFinancedBy",
        label: "Seyahat Masraflarını Kim Karşılayacak?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukSpendPlan",
        label:
          "Birleşik Krallık Ziyaretinizde Ne Kadar Para Harcamayı Planlıyorsunuz?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "ukRequestedVisaDuration",
        label: "Talep Edilen Vize Süresi (6 Ay / 2 Sene / 5 Sene / 10 Sene)",
        kind: "text",
        maxLength: 60,
        required: false,
      },
    ],
  },
] as const;

/**
 * United States "AMERİKA BİLGİ FORMU" extras. Shared fields (name, marital
 * status, home address, phone, e-mail, employer info, travel purpose, planned
 * entry date, previous trips) already live in `APPLICATION_FORM_SECTIONS`.
 */
export const USA_EXTRA_SECTIONS: readonly FormSection[] = [
  {
    title: "Amerika · Ek Kişisel Bilgiler",
    fields: [
      {
        name: "usaSocialMedia",
        label: "Sosyal Medya Hesapları Kullanıcı İsmi",
        kind: "text",
        maxLength: 160,
        required: false,
      },
      {
        name: "usaDependents",
        label: "Bakmakla Yükümlü Olduğunuz Kişiler (Eş, Çocuk, Anne-Baba)",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "usaParentsInfo",
        label: "Anne-Baba İsim Soy İsim ve Doğum Tarihi",
        kind: "textarea",
        full: true,
        maxLength: 300,
        required: false,
      },
    ],
  },
  {
    title: "Amerika · Seyahat ve Konaklama",
    fields: [
      {
        name: "usaDurationOfStay",
        label: "Kalış Süresi",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "usaStayAddress",
        label: "ABD'de Kalacağınız Adres",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "usaTravelFinancedBy",
        label: "Seyahat Masraflarını Kim Karşılıyor",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "usaContacts",
        label: "ABD'de Tanıdığınız Kişi veya Kurum",
        kind: "text",
        maxLength: 160,
        required: false,
      },
      {
        name: "usaContactAddress",
        label: "Adres ve Telefon (Otel, Akraba, Okul vb.)",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "usaRelativesInUs",
        label: "ABD'de Yaşayan Akraba Var mı?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
    ],
  },
  {
    title: "Amerika · Eğitim ve Finansal Bilgiler",
    fields: [
      {
        name: "usaEducationGraduation",
        label: "Eğitim Durumunuz ve Mezuniyet Tarihiniz Nedir?",
        kind: "textarea",
        full: true,
        maxLength: 500,
        required: false,
      },
      {
        name: "usaWorkEducationHistory",
        label: "Önceki İş ve Eğitim Geçmişiniz",
        kind: "textarea",
        full: true,
        maxLength: 1000,
        required: false,
      },
      {
        name: "usaMonthlyIncome",
        label: "Aylık Gelir",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "usaMonthlyExpenses",
        label: "Aylık Harcama",
        kind: "text",
        maxLength: 60,
        required: false,
      },
      {
        name: "usaStaySpendPlan",
        label: "ABD'de Kalış Sürenizde Ne Kadar Harcama Yapacaksınız?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "usaTicketsPurchasePlan",
        label: "Otel / Uçak Biletleri Satın Alma Yapılacak mı?",
        kind: "text",
        maxLength: 120,
        required: false,
      },
      {
        name: "usaAdditionalNotes",
        label: "Kendinize Ait Verebileceğiniz Ek Bilgiler",
        kind: "textarea",
        full: true,
        maxLength: 1000,
        required: false,
      },
    ],
  },
] as const;

/** Returns the extra sections a target country appends to the standard form. */
export function getCountryExtraSections(
  formType: CountrySpecificFormType | null,
): readonly FormSection[] {
  if (formType === "UK") {
    return UK_EXTRA_SECTIONS;
  }
  if (formType === "USA") {
    return USA_EXTRA_SECTIONS;
  }
  return [];
}

/** Flat list of every country-extra field across UK + USA. */
export const COUNTRY_EXTRA_FIELDS: readonly FormField[] = [
  ...UK_EXTRA_SECTIONS,
  ...USA_EXTRA_SECTIONS,
].flatMap((section) => section.fields);

/** Fast membership set of every country-extra field name. */
export const COUNTRY_EXTRA_FIELD_NAMES: ReadonlySet<CountryExtraFieldName> =
  new Set(
    COUNTRY_EXTRA_FIELDS.map((field) => field.name as CountryExtraFieldName),
  );
