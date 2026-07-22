export type CountrySpecificFormType = "UK" | "USA";

/**
 * Input behavior for a country-specific field, mirroring the default form's
 * masking/uppercase rules so UK/USA forms feel identical.
 */
export type CountrySpecificFieldInput =
  | "name"
  | "alpha"
  | "text"
  | "note"
  | "phone"
  | "tc"
  | "passport"
  | "email"
  | "date";

export interface CountrySpecificFieldDefinition {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "date";
  /** Masking/normalization behavior; defaults to uppercase English text. */
  input?: CountrySpecificFieldInput;
  maxLength?: number;
}

export interface CountrySpecificCommonInput {
  isEmployer: boolean;
  employerName?: string;
  employerAddress?: string;
  employerPhone?: string;
  hasSponsor: boolean;
  sponsorFullName?: string;
  sponsorIdentity?: string;
  sponsorContact?: string;
  sponsorRelation?: string;
}

export interface CountrySpecificDetailsPayload {
  applicantIndex: number;
  firstName: string;
  lastName: string;
  maidenSurname: string;
  nationalId: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  gender: string;
  maritalStatus: string;
  email: string;
  phone: string;
  residenceCity: string;
  registeredAddress: string;
  occupation: string;
  employmentStatus: string;
  isEmployer: boolean;
  employerName?: string;
  employerAddress?: string;
  employerPhone?: string;
  educationInstitution?: string;
  educationLevel?: string;
  passportType: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuePlace: string;
  appointmentLocation: string;
  fingerprintGiven: "Evet" | "Hayır";
  fingerprintDate?: string;
  schengenAppliedBefore: "Evet" | "Hayır";
  previousSchengenCountries?: string;
  purposeOfTravel: string;
  plannedTravelStartDate: string;
  plannedTravelEndDate: string;
  hasSponsor: boolean;
  sponsorFullName?: string;
  sponsorIdentity?: string;
  sponsorContact?: string;
  sponsorRelation?: string;
  countrySpecificFormData: {
    formType: CountrySpecificFormType;
    fields: Record<string, string>;
    common: CountrySpecificCommonInput;
  };
}

export const UK_FORM_NOTICE = "Eksiksiz doldurulması gerekmektedir.";
export const USA_FORM_NOTICE = "MADDİ GELİRLER VE GİDERLER NET YAZILMALIDIR";

export const UK_VISA_FIELDS: readonly CountrySpecificFieldDefinition[] = [
  { key: "adiniz", label: "ADINIZ:", input: "name", maxLength: 80 },
  { key: "soyadiniz", label: "SOYADINIZ:", input: "name", maxLength: 80 },
  {
    key: "kizlik_soyadi",
    label: "Varsa kızlık soyadı belirtiniz:",
    input: "name",
    maxLength: 80,
  },
  { key: "dogum_tarihi", label: "DOĞUM TARİHİ:", kind: "date" },
  {
    key: "tc_kimlik_numarasi",
    label: "TC KİMLİK NUMARASI:",
    input: "tc",
    maxLength: 11,
  },
  {
    key: "kimlik_verilis_ve_bitis_tarihi",
    label: "KİMLİK VERİLİŞ VE BİTİŞ TARİHİ:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "ev_adresiniz",
    label: "EV ADRESİNİZ (E-devlette kayıtlı olan adresiniz):",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "bu_adreste_ne_kadardir_yasiyorsunuz",
    label: "BU ADRESTE NE KADARDIR YAŞIYORSUNUZ (Yıl / Ay):",
    input: "text",
    maxLength: 60,
  },
  {
    key: "oturdugunuz_ev_kira_mi_size_mi_ait",
    label: "OTURDUĞUNUZ EV KİRA MI, SİZE Mİ AİT:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "telefon_numarasi",
    label: "TELEFON NUMARASI:",
    input: "phone",
    maxLength: 32,
  },
  { key: "email_adresi", label: "E-MAIL ADRESİ:", input: "email", maxLength: 160 },
  {
    key: "baska_ulke_vatandasligi",
    label: "BAŞKA BİR ÜLKE VATANDAŞLIĞINIZ VAR MI? (Varsa belirtiniz):",
    input: "text",
    maxLength: 120,
  },
  {
    key: "pasaport_numarasi",
    label: "PASAPORT NUMARASI:",
    input: "passport",
    maxLength: 9,
  },
  { key: "pasaport_verilis_tarihi", label: "VERİLİŞ TARİHİ:", kind: "date" },
  { key: "pasaport_bitis_tarihi", label: "BİTİŞ TARİHİ:", kind: "date" },
  { key: "veren_makam", label: "VEREN MAKAM:", input: "alpha", maxLength: 120 },
  {
    key: "baba_bilgileri",
    label: "BABA ADI SOYADI / DOĞUM TARİHİ / DOĞUM YERİ / UYRUĞU:",
    kind: "textarea",
    input: "note",
    maxLength: 240,
  },
  {
    key: "anne_bilgileri",
    label: "ANNE ADI SOYADI / DOĞUM TARİHİ / DOĞUM YERİ / UYRUĞU:",
    kind: "textarea",
    input: "note",
    maxLength: 240,
  },
  {
    key: "evlilik_tarihi",
    label: "EVLİ İSENİZ EVLİLİK TARİHİ:",
    kind: "date",
  },
  {
    key: "es_bilgileri",
    label: "EŞİNİZİN ADI SOYADI / DOĞUM TARİHİ / DOĞUM YERİ / UYRUĞU:",
    kind: "textarea",
    input: "note",
    maxLength: 240,
  },
  {
    key: "es_pasaport_no",
    label: "EŞİNİZ SEYAHAT ETMEYECEKSE BİLE PASAPORT NO:",
    input: "text",
    maxLength: 32,
  },
  {
    key: "cocuk_bilgileri",
    label: "ÇOCUĞUNUZ VARSA ADI / DOĞUM TARİHİ / DOĞUM YERİ:",
    kind: "textarea",
    input: "note",
    maxLength: 240,
  },
  {
    key: "es_ve_cocuklar_sizinle_mi",
    label: "EŞ VE ÇOCUKLARINIZ SİZİNLE BİRLİKTE Mİ YAŞIYOR?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "degilse_adresleri",
    label: "DEĞİLSE ADRESLERİ:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  { key: "is_yeri_adi", label: "İŞ YERİ ADI:", input: "text", maxLength: 160 },
  {
    key: "is_yeri_adresi",
    label: "İŞ YERİ ADRESİ:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  { key: "ise_giris_tarihi", label: "İŞE GİRİŞ TARİHİ:", kind: "date" },
  { key: "is_telefonu", label: "İŞ TELEFONU:", input: "phone", maxLength: 32 },
  { key: "pozisyonunuz", label: "POZİSYONUNUZ:", input: "text", maxLength: 120 },
  { key: "aylik_net_gelir", label: "AYLIK NET GELİR:", input: "text", maxLength: 60 },
  { key: "yillik_gelir", label: "YILLIK GELİR:", input: "text", maxLength: 60 },
  {
    key: "baska_gelir_veya_birikim",
    label:
      "BAŞKA GELİR YA DA BİRİKİMİNİZ VAR MI?: (KİRA GELİRİ VS ) VARSA TUTARI:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "aylik_giderler_toplami",
    label: "AYLIK GİDERLER TOPLAMI:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "aileye_verilen_aylik_tutar",
    label: "AİLEYE VERİLEN AYLIK TUTAR:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "bu_gezi_icin_elde_para",
    label: "BU GEZİ İÇİN ELİNİZDE BULUNAN PARA:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "askeriye_kamu_basin",
    label: "DAHA ÖNCE ASKERİYE / KAMU / BASIN SEKTÖRÜNDE ÇALIŞTINIZ MI?:",
    input: "text",
    maxLength: 120,
  },
  { key: "detay", label: "DETAY:", kind: "textarea", input: "note", maxLength: 500 },
  {
    key: "seyahat_amaci",
    label: "SEYAHAT AMACI:",
    kind: "textarea",
    input: "note",
    maxLength: 1000,
  },
  {
    key: "seyahat_tarihleri",
    label: "SEYAHAT TARİHLERİ (Gidiş / Dönüş):",
    input: "text",
    maxLength: 60,
  },
  {
    key: "ingiltere_davetiyesi",
    label: "İNGİLTERE DAVETİYESİ VAR MI?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "vize_reddi_aldiniz_mi",
    label: "VİZE REDDİ ALDINIZ MI?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "daha_once_ingiltere_basvuru",
    label: "DAHA ÖNCE İNGİLTERE VİZESİNE BAŞVURDUNUZ MU?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "red_tarihi_ve_nedeni",
    label: "RED VARSA TARİHİ VE NEDENİ:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "ingilterede_yasayan_akraba",
    label: "İNGİLTERE’DE YAŞAYAN AKRABA VAR MI?:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "yurtdisi_seyahatleriniz",
    label: "DAHA ÖNCE YURTDIŞI SEYAHATLERİNİZ:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "kiminle_seyahat",
    label: "KİMİNLE SEYAHAT EDECEKSİNİZ?:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "seyahat_masraflarini_kim_karsilayacak",
    label: "SEYAHAT MASRAFLARINI KİM KARŞILAYACAK?:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "birlesik_krallik_harcama",
    label:
      "BIRLEŞIK KRALLIK'A ZIYARETINIZDE NE KADAR PARA HARCAMAYI PLANLAMAKTASINIZ?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "talep_edilen_vize_suresi",
    label: "TALEP EDİLEN VİZE SÜRESİ (6 AY / 2 SENE / 5 SENE / 10 SENE ):",
    input: "text",
    maxLength: 60,
  },
] as const;

export const USA_VISA_FIELDS: readonly CountrySpecificFieldDefinition[] = [
  { key: "ad_soyad", label: "AD-SOYAD:", input: "name", maxLength: 120 },
  { key: "medeni_hal", label: "MEDENİ HAL:", input: "alpha", maxLength: 32 },
  { key: "ev_adresi", label: "EV ADRESİ:", kind: "textarea", input: "note", maxLength: 500 },
  { key: "telefon_no", label: "TELEFON NO:", input: "phone", maxLength: 32 },
  { key: "mail_adresi", label: "MAİL ADRESİ:", input: "email", maxLength: 160 },
  {
    key: "sosyal_medya_kullanici_ismi",
    label: "SOSYAL MEDYA HESAPLARI KULLANICI İSMİ:",
    input: "text",
    maxLength: 160,
  },
  {
    key: "bakmakla_yukumlu_oldugunuz_kisiler",
    label: "BAKMAKLA YÜKÜMLÜ OLDUĞUNUZ KİŞİLER(EŞ ,COCUK ,ANNE -BABA):",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "anne_baba_bilgileri",
    label: "ANNE BABA İSİM SOY İSİM DOĞUM TARİHİ:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "isyeri_bilgileri",
    label:
      "İŞYERİ BİLGİLERİ (İŞLETME İSMİ, İŞLETME SAHİBİ ADI SOYAD,TELEFON,İŞLETME ADRESİ ,İŞLETMEDE GÖREVİNİZ NEDİR):",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "abdye_gidis_amaci",
    label: "ABD’YE GIDIŞ AMACı:",
    kind: "textarea",
    input: "note",
    maxLength: 1000,
  },
  {
    key: "planlanan_giris_tarihi",
    label: "PLANLANAN GIRIŞ TARIHI:",
    kind: "date",
  },
  { key: "kalis_suresi", label: "KALıŞ SÜRESI:", input: "text", maxLength: 60 },
  {
    key: "abdde_kalacaginiz_adres",
    label: "ABD’DE KALACAĞıNıZ ADRES:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "seyahat_masraflarini_kim",
    label: "SEYAHAT MASRAFLARıNı KIM KARŞıLıYOR:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "abdde_tanidiginiz_kisi_veya_kurum",
    label: "ABD’DE TANıDıĞıNıZ KIŞI VEYA KURUM:",
    input: "text",
    maxLength: 160,
  },
  {
    key: "adres_ve_telefon",
    label: "ADRES VE TELEFON (OTEL, AKRABA, OKUL VB.):",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "abdde_yasayan_akraba_var_mi",
    label: "ABD’DE YAŞAYAN AKRABA VAR Mı?:",
    input: "text",
    maxLength: 120,
  },
  {
    key: "egitim_durumu",
    label: "EGİTİM DURUMUNUZ NEDİR? MEZUNİYET TARİHİNİZ NEDİR?:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "onceki_is_egitim_gecmisi",
    label: "ÖNCEKI IŞ VE EĞITIM GEÇMIŞI TAMAMINI YAZALIM:",
    kind: "textarea",
    input: "note",
    maxLength: 1000,
  },
  { key: "aylik_gelir", label: "AYLIK GELİR:", input: "text", maxLength: 60 },
  { key: "aylik_harcama", label: "AYLIK HARCAMA:", input: "text", maxLength: 60 },
  {
    key: "abdde_kalis_harcama",
    label: "ABD DE KALIŞ SÜRENİZDE NE KADAR HARCAMA YAPACAKSINIZ?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "ek_otel_ucak_biletleri",
    label: "EK OTEL UÇAK BİLETLERİ SATIN ALMA YAPILACAK MI?:",
    input: "text",
    maxLength: 60,
  },
  {
    key: "daha_onceki_vize_ziyaretleriniz",
    label: "DAHA ÖNCEKİ VİZE VE YURTDIŞI ZİYARETLERİNİZ?:",
    kind: "textarea",
    input: "note",
    maxLength: 500,
  },
  {
    key: "kendinize_ait_ek_notlar",
    label:
      "KENDİNİZE AİT VEREBİLECEĞİNİZ BİLGİLER :EK NOTLARA YAZABİLMEMİZ İÇİN FORMDA",
    kind: "textarea",
    input: "note",
    maxLength: 1000,
  },
] as const;

const FALLBACK_DATE = "1900-01-01";
const FALLBACK_TEXT = "Belirtilmedi";

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

export function detectCountrySpecificFormType(
  targetCountry: string | null | undefined,
): CountrySpecificFormType | null {
  const normalized = normalizeForMatch(targetCountry ?? "");

  if (
    normalized === "ingiltere" ||
    normalized === "uk" ||
    normalized === "united kingdom" ||
    normalized === "birlesik krallik"
  ) {
    return "UK";
  }

  if (
    normalized === "amerika" ||
    normalized === "usa" ||
    normalized === "abd" ||
    normalized === "amerika birlesik devletleri" ||
    normalized === "united states" ||
    normalized === "united states of america"
  ) {
    return "USA";
  }

  return null;
}

export function getCountrySpecificFieldDefinitions(
  formType: CountrySpecificFormType,
): readonly CountrySpecificFieldDefinition[] {
  return formType === "UK" ? UK_VISA_FIELDS : USA_VISA_FIELDS;
}

function crop(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pick(
  value: string | null | undefined,
  fallback = FALLBACK_TEXT,
  maxLength = 120,
): string {
  const normalized = clean(value);
  return crop(normalized.length > 0 ? normalized : fallback, maxLength);
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const normalized = clean(fullName);
  if (!normalized) {
    return { firstName: FALLBACK_TEXT, lastName: FALLBACK_TEXT };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: FALLBACK_TEXT };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function toIsoDate(raw: string | null | undefined, fallback = FALLBACK_DATE): string {
  const value = clean(raw);
  if (!value) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const dotMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month}-${day}`;
  }

  const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function parseDateRange(raw: string): { start: string; end: string } {
  const candidates =
    raw.match(/\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4}/g) ?? [];

  const first = toIsoDate(candidates[0], FALLBACK_DATE);
  const second = toIsoDate(candidates[1], first);

  if (second < first) {
    return { start: first, end: first };
  }

  return { start: first, end: second };
}

function toYesNo(value: string | null | undefined): "Evet" | "Hayır" {
  const normalized = normalizeForMatch(value ?? "");
  if (
    normalized.includes("evet") ||
    normalized.includes("yes") ||
    normalized.includes("var")
  ) {
    return "Evet";
  }
  return "Hayır";
}

function normalizeFieldMap(fields: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = clean(value);
  }
  return normalized;
}

function normalizeCommonInput(
  common: CountrySpecificCommonInput | undefined,
): CountrySpecificCommonInput {
  return {
    isEmployer: Boolean(common?.isEmployer),
    employerName: clean(common?.employerName),
    employerAddress: clean(common?.employerAddress),
    employerPhone: clean(common?.employerPhone),
    hasSponsor: Boolean(common?.hasSponsor),
    sponsorFullName: clean(common?.sponsorFullName),
    sponsorIdentity: clean(common?.sponsorIdentity),
    sponsorContact: clean(common?.sponsorContact),
    sponsorRelation: clean(common?.sponsorRelation),
  };
}

function buildUkPayload(
  fields: Record<string, string>,
  applicantIndex: number,
  common: CountrySpecificCommonInput | undefined,
): CountrySpecificDetailsPayload {
  const normalized = normalizeFieldMap(fields);
  const normalizedCommon = normalizeCommonInput(common);
  const { start, end } = parseDateRange(normalized.seyahat_tarihleri ?? "");

  return {
    applicantIndex,
    firstName: pick(normalized.adiniz, FALLBACK_TEXT, 80),
    lastName: pick(normalized.soyadiniz, FALLBACK_TEXT, 80),
    maidenSurname: crop(clean(normalized.kizlik_soyadi), 80),
    nationalId: pick(normalized.tc_kimlik_numarasi, FALLBACK_TEXT, 32),
    dateOfBirth: toIsoDate(normalized.dogum_tarihi),
    placeOfBirth: pick(undefined, FALLBACK_TEXT, 120),
    nationality: pick(
      normalized.baska_ulke_vatandasligi
        ? `Turk / ${normalized.baska_ulke_vatandasligi}`
        : "Turk",
      "Turk",
      80,
    ),
    gender: "Belirtilmedi",
    maritalStatus: normalized.evlilik_tarihi ? "Evli" : "Belirtilmedi",
    email: pick(normalized.email_adresi, "ornek@example.com", 160),
    phone: pick(normalized.telefon_numarasi, "0000000000", 32),
    residenceCity: FALLBACK_TEXT,
    registeredAddress: pick(normalized.ev_adresiniz, FALLBACK_TEXT, 500),
    occupation: pick(normalized.pozisyonunuz, FALLBACK_TEXT, 120),
    employmentStatus: normalizedCommon.isEmployer
      ? "İşveren"
      : normalized.is_yeri_adi
        ? "Çalışıyor"
        : "Belirtilmedi",
    isEmployer: normalizedCommon.isEmployer,
    employerName: normalizedCommon.isEmployer
      ? crop(
          normalizedCommon.employerName || normalized.is_yeri_adi,
          160,
        )
      : "",
    employerAddress: normalizedCommon.isEmployer
      ? crop(
          normalizedCommon.employerAddress || normalized.is_yeri_adresi,
          500,
        )
      : "",
    employerPhone: normalizedCommon.isEmployer
      ? crop(normalizedCommon.employerPhone || normalized.is_telefonu, 32)
      : "",
    educationInstitution: "",
    educationLevel: "",
    passportType: "Umuma Mahsus (Bordo)",
    passportNumber: pick(normalized.pasaport_numarasi, FALLBACK_TEXT, 64),
    passportIssueDate: toIsoDate(normalized.pasaport_verilis_tarihi),
    passportExpiryDate: toIsoDate(normalized.pasaport_bitis_tarihi),
    passportIssuePlace: pick(normalized.veren_makam, FALLBACK_TEXT, 120),
    appointmentLocation: pick(normalized.veren_makam, FALLBACK_TEXT, 120),
    fingerprintGiven: "Hayır",
    fingerprintDate: "",
    schengenAppliedBefore: toYesNo(normalized.daha_once_ingiltere_basvuru),
    previousSchengenCountries: crop(
      clean(normalized.yurtdisi_seyahatleriniz),
      500,
    ),
    purposeOfTravel: pick(normalized.seyahat_amaci, FALLBACK_TEXT, 1000),
    plannedTravelStartDate: start,
    plannedTravelEndDate: end,
    hasSponsor: normalizedCommon.hasSponsor,
    sponsorFullName: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorFullName || "", 120)
      : "",
    sponsorIdentity: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorIdentity || "", 120)
      : "",
    sponsorContact: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorContact || "", 240)
      : "",
    sponsorRelation: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorRelation || "", 80)
      : "",
    countrySpecificFormData: {
      formType: "UK",
      fields: normalized,
      common: normalizedCommon,
    },
  };
}

function buildUsaPayload(
  fields: Record<string, string>,
  applicantIndex: number,
  common: CountrySpecificCommonInput | undefined,
): CountrySpecificDetailsPayload {
  const normalized = normalizeFieldMap(fields);
  const normalizedCommon = normalizeCommonInput(common);
  const { firstName, lastName } = splitFullName(normalized.ad_soyad ?? "");
  const startDate = toIsoDate(normalized.planlanan_giris_tarihi);
  const stayDaysMatch = clean(normalized.kalis_suresi).match(/\d+/);
  const stayDays = stayDaysMatch ? Number(stayDaysMatch[0]) : 0;
  const endDate = addDays(startDate, Number.isFinite(stayDays) ? Math.max(stayDays, 1) : 1);

  return {
    applicantIndex,
    firstName: crop(firstName, 80),
    lastName: crop(lastName, 80),
    maidenSurname: "",
    nationalId: "Belirtilmedi",
    dateOfBirth: FALLBACK_DATE,
    placeOfBirth: FALLBACK_TEXT,
    nationality: FALLBACK_TEXT,
    gender: "Belirtilmedi",
    maritalStatus: pick(normalized.medeni_hal, FALLBACK_TEXT, 32),
    email: pick(normalized.mail_adresi, "ornek@example.com", 160),
    phone: pick(normalized.telefon_no, "0000000000", 32),
    residenceCity: FALLBACK_TEXT,
    registeredAddress: pick(normalized.ev_adresi, FALLBACK_TEXT, 500),
    occupation: pick(normalized.isyeri_bilgileri, FALLBACK_TEXT, 120),
    employmentStatus: normalizedCommon.isEmployer
      ? "İşveren"
      : normalized.isyeri_bilgileri
        ? "Çalışıyor"
        : "Belirtilmedi",
    isEmployer: normalizedCommon.isEmployer,
    employerName: normalizedCommon.isEmployer
      ? crop(normalizedCommon.employerName || "", 160)
      : "",
    employerAddress: normalizedCommon.isEmployer
      ? crop(normalizedCommon.employerAddress || "", 500)
      : "",
    employerPhone: normalizedCommon.isEmployer
      ? crop(normalizedCommon.employerPhone || "", 32)
      : "",
    educationInstitution: crop(clean(normalized.egitim_durumu), 160),
    educationLevel: "",
    passportType: "Umuma Mahsus (Bordo)",
    passportNumber: "Belirtilmedi",
    passportIssueDate: startDate,
    passportExpiryDate: endDate,
    passportIssuePlace: FALLBACK_TEXT,
    appointmentLocation: pick(normalized.abdde_kalacaginiz_adres, FALLBACK_TEXT, 120),
    fingerprintGiven: "Hayır",
    fingerprintDate: "",
    schengenAppliedBefore: toYesNo(normalized.daha_onceki_vize_ziyaretleriniz),
    previousSchengenCountries: crop(
      clean(normalized.daha_onceki_vize_ziyaretleriniz),
      500,
    ),
    purposeOfTravel: pick(normalized.abdye_gidis_amaci, FALLBACK_TEXT, 1000),
    plannedTravelStartDate: startDate,
    plannedTravelEndDate: endDate,
    hasSponsor: normalizedCommon.hasSponsor,
    sponsorFullName: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorFullName || "", 120)
      : "",
    sponsorIdentity: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorIdentity || "", 120)
      : "",
    sponsorContact: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorContact || "", 240)
      : "",
    sponsorRelation: normalizedCommon.hasSponsor
      ? crop(normalizedCommon.sponsorRelation || "", 80)
      : "",
    countrySpecificFormData: {
      formType: "USA",
      fields: normalized,
      common: normalizedCommon,
    },
  };
}

export function buildCountrySpecificDetailsPayload(
  formType: CountrySpecificFormType,
  fields: Record<string, string>,
  applicantIndex: number,
  common?: CountrySpecificCommonInput,
): CountrySpecificDetailsPayload {
  if (formType === "UK") {
    return buildUkPayload(fields, applicantIndex, common);
  }

  return buildUsaPayload(fields, applicantIndex, common);
}

export function getInitialCountrySpecificValues(
  definitions: readonly CountrySpecificFieldDefinition[],
  initialValues?: Record<string, string> | null,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const definition of definitions) {
    values[definition.key] = clean(initialValues?.[definition.key]);
  }

  return values;
}
