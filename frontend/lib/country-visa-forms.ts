export type CountrySpecificFormType = "UK" | "USA";

export interface CountrySpecificFieldDefinition {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "date";
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
  { key: "adiniz", label: "ADINIZ:" },
  { key: "soyadiniz", label: "SOYADINIZ:" },
  { key: "kizlik_soyadi", label: "Varsa kızlık soyadı belirtiniz:" },
  { key: "dogum_tarihi", label: "DOĞUM TARİHİ:", kind: "date" },
  { key: "tc_kimlik_numarasi", label: "TC KİMLİK NUMARASI:" },
  {
    key: "kimlik_verilis_ve_bitis_tarihi",
    label: "KİMLİK VERİLİŞ VE BİTİŞ TARİHİ:",
  },
  {
    key: "ev_adresiniz",
    label: "EV ADRESİNİZ (E-devlette kayıtlı olan adresiniz):",
    kind: "textarea",
  },
  {
    key: "bu_adreste_ne_kadardir_yasiyorsunuz",
    label: "BU ADRESTE NE KADARDIR YAŞIYORSUNUZ (Yıl / Ay):",
  },
  {
    key: "oturdugunuz_ev_kira_mi_size_mi_ait",
    label: "OTURDUĞUNUZ EV KİRA MI, SİZE Mİ AİT:",
  },
  { key: "telefon_numarasi", label: "TELEFON NUMARASI:" },
  { key: "email_adresi", label: "E-MAIL ADRESİ:", kind: "text" },
  {
    key: "baska_ulke_vatandasligi",
    label: "BAŞKA BİR ÜLKE VATANDAŞLIĞINIZ VAR MI? (Varsa belirtiniz):",
  },
  { key: "pasaport_numarasi", label: "PASAPORT NUMARASI:" },
  { key: "pasaport_verilis_tarihi", label: "VERİLİŞ TARİHİ:", kind: "date" },
  { key: "pasaport_bitis_tarihi", label: "BİTİŞ TARİHİ:", kind: "date" },
  { key: "veren_makam", label: "VEREN MAKAM:" },
  {
    key: "baba_bilgileri",
    label: "BABA ADI SOYADI / DOĞUM TARİHİ / DOĞUM YERİ / UYRUĞU:",
    kind: "textarea",
  },
  {
    key: "anne_bilgileri",
    label: "ANNE ADI SOYADI / DOĞUM TARİHİ / DOĞUM YERİ / UYRUĞU:",
    kind: "textarea",
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
  },
  {
    key: "es_pasaport_no",
    label: "EŞİNİZ SEYAHAT ETMEYECEKSE BİLE PASAPORT NO:",
  },
  {
    key: "cocuk_bilgileri",
    label: "ÇOCUĞUNUZ VARSA ADI / DOĞUM TARİHİ / DOĞUM YERİ:",
    kind: "textarea",
  },
  {
    key: "es_ve_cocuklar_sizinle_mi",
    label: "EŞ VE ÇOCUKLARINIZ SİZİNLE BİRLİKTE Mİ YAŞIYOR?:",
  },
  { key: "degilse_adresleri", label: "DEĞİLSE ADRESLERİ:", kind: "textarea" },
  { key: "is_yeri_adi", label: "İŞ YERİ ADI:" },
  { key: "is_yeri_adresi", label: "İŞ YERİ ADRESİ:", kind: "textarea" },
  { key: "ise_giris_tarihi", label: "İŞE GİRİŞ TARİHİ:", kind: "date" },
  { key: "is_telefonu", label: "İŞ TELEFONU:" },
  { key: "pozisyonunuz", label: "POZİSYONUNUZ:" },
  { key: "aylik_net_gelir", label: "AYLIK NET GELİR:" },
  { key: "yillik_gelir", label: "YILLIK GELİR:" },
  {
    key: "baska_gelir_veya_birikim",
    label:
      "BAŞKA GELİR YA DA BİRİKİMİNİZ VAR MI?: (KİRA GELİRİ VS ) VARSA TUTARI:",
    kind: "textarea",
  },
  { key: "aylik_giderler_toplami", label: "AYLIK GİDERLER TOPLAMI:" },
  { key: "aileye_verilen_aylik_tutar", label: "AİLEYE VERİLEN AYLIK TUTAR:" },
  { key: "bu_gezi_icin_elde_para", label: "BU GEZİ İÇİN ELİNİZDE BULUNAN PARA:" },
  {
    key: "askeriye_kamu_basin",
    label: "DAHA ÖNCE ASKERİYE / KAMU / BASIN SEKTÖRÜNDE ÇALIŞTINIZ MI?:",
  },
  { key: "detay", label: "DETAY:", kind: "textarea" },
  { key: "seyahat_amaci", label: "SEYAHAT AMACI:", kind: "textarea" },
  {
    key: "seyahat_tarihleri",
    label: "SEYAHAT TARİHLERİ (Gidiş / Dönüş):",
  },
  { key: "ingiltere_davetiyesi", label: "İNGİLTERE DAVETİYESİ VAR MI?:" },
  { key: "vize_reddi_aldiniz_mi", label: "VİZE REDDİ ALDINIZ MI?:" },
  {
    key: "daha_once_ingiltere_basvuru",
    label: "DAHA ÖNCE İNGİLTERE VİZESİNE BAŞVURDUNUZ MU?:",
  },
  {
    key: "red_tarihi_ve_nedeni",
    label: "RED VARSA TARİHİ VE NEDENİ:",
    kind: "textarea",
  },
  {
    key: "ingilterede_yasayan_akraba",
    label: "İNGİLTERE’DE YAŞAYAN AKRABA VAR MI?:",
  },
  {
    key: "yurtdisi_seyahatleriniz",
    label: "DAHA ÖNCE YURTDIŞI SEYAHATLERİNİZ:",
    kind: "textarea",
  },
  { key: "kiminle_seyahat", label: "KİMİNLE SEYAHAT EDECEKSİNİZ?:" },
  {
    key: "seyahat_masraflarini_kim_karsilayacak",
    label: "SEYAHAT MASRAFLARINI KİM KARŞILAYACAK?:",
  },
  {
    key: "birlesik_krallik_harcama",
    label:
      "BIRLEŞIK KRALLIK'A ZIYARETINIZDE NE KADAR PARA HARCAMAYI PLANLAMAKTASINIZ?:",
  },
  {
    key: "talep_edilen_vize_suresi",
    label: "TALEP EDİLEN VİZE SÜRESİ (6 AY / 2 SENE / 5 SENE / 10 SENE ):",
  },
] as const;

export const USA_VISA_FIELDS: readonly CountrySpecificFieldDefinition[] = [
  { key: "ad_soyad", label: "AD-SOYAD:" },
  { key: "medeni_hal", label: "MEDENİ HAL:" },
  { key: "ev_adresi", label: "EV ADRESİ:", kind: "textarea" },
  { key: "telefon_no", label: "TELEFON NO:" },
  { key: "mail_adresi", label: "MAİL ADRESİ:" },
  {
    key: "sosyal_medya_kullanici_ismi",
    label: "SOSYAL MEDYA HESAPLARI KULLANICI İSMİ:",
  },
  {
    key: "bakmakla_yukumlu_oldugunuz_kisiler",
    label: "BAKMAKLA YÜKÜMLÜ OLDUĞUNUZ KİŞİLER(EŞ ,COCUK ,ANNE -BABA):",
    kind: "textarea",
  },
  {
    key: "anne_baba_bilgileri",
    label: "ANNE BABA İSİM SOY İSİM DOĞUM TARİHİ:",
    kind: "textarea",
  },
  {
    key: "isyeri_bilgileri",
    label:
      "İŞYERİ BİLGİLERİ (İŞLETME İSMİ, İŞLETME SAHİBİ ADI SOYAD,TELEFON,İŞLETME ADRESİ ,İŞLETMEDE GÖREVİNİZ NEDİR):",
    kind: "textarea",
  },
  { key: "abdye_gidis_amaci", label: "ABD’YE GIDIŞ AMACı:", kind: "textarea" },
  {
    key: "planlanan_giris_tarihi",
    label: "PLANLANAN GIRIŞ TARIHI:",
    kind: "date",
  },
  { key: "kalis_suresi", label: "KALıŞ SÜRESI:" },
  {
    key: "abdde_kalacaginiz_adres",
    label: "ABD’DE KALACAĞıNıZ ADRES:",
    kind: "textarea",
  },
  {
    key: "seyahat_masraflarini_kim",
    label: "SEYAHAT MASRAFLARıNı KIM KARŞıLıYOR:",
  },
  {
    key: "abdde_tanidiginiz_kisi_veya_kurum",
    label: "ABD’DE TANıDıĞıNıZ KIŞI VEYA KURUM:",
  },
  {
    key: "adres_ve_telefon",
    label: "ADRES VE TELEFON (OTEL, AKRABA, OKUL VB.):",
    kind: "textarea",
  },
  {
    key: "abdde_yasayan_akraba_var_mi",
    label: "ABD’DE YAŞAYAN AKRABA VAR Mı?:",
  },
  {
    key: "egitim_durumu",
    label: "EGİTİM DURUMUNUZ NEDİR? MEZUNİYET TARİHİNİZ NEDİR?:",
    kind: "textarea",
  },
  {
    key: "onceki_is_egitim_gecmisi",
    label: "ÖNCEKI IŞ VE EĞITIM GEÇMIŞI TAMAMINI YAZALIM:",
    kind: "textarea",
  },
  { key: "aylik_gelir", label: "AYLIK GELİR:" },
  { key: "aylik_harcama", label: "AYLIK HARCAMA:" },
  {
    key: "abdde_kalis_harcama",
    label: "ABD DE KALIŞ SÜRENİZDE NE KADAR HARCAMA YAPACAKSINIZ?:",
  },
  {
    key: "ek_otel_ucak_biletleri",
    label: "EK OTEL UÇAK BİLETLERİ SATIN ALMA YAPILACAK MI?:",
  },
  {
    key: "daha_onceki_vize_ziyaretleriniz",
    label: "DAHA ÖNCEKİ VİZE VE YURTDIŞI ZİYARETLERİNİZ?:",
    kind: "textarea",
  },
  {
    key: "kendinize_ait_ek_notlar",
    label:
      "KENDİNİZE AİT VEREBİLECEĞİNİZ BİLGİLER :EK NOTLARA YAZABİLMEMİZ İÇİN FORMDA",
    kind: "textarea",
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
