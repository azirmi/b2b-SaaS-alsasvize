/**
 * Client-side mirror of the backend Prisma enums.
 * Source of truth: backend/src/generated/prisma/enums.ts — keep in sync.
 */

export const Role = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  DOC: 'DOC',
  SEC: 'SEC',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Department = {
  SALES: 'SALES',
  DOC: 'DOC',
  SEC: 'SEC',
} as const;
export type Department = (typeof Department)[keyof typeof Department];

export const VisaStage = {
  SALES_POOL: 'SALES_POOL',
  SALES_PROCESS: 'SALES_PROCESS',
  DOC_POOL: 'DOC_POOL',
  DOC_PROCESS: 'DOC_PROCESS',
  SEC_POOL: 'SEC_POOL',
  SEC_PROCESS: 'SEC_PROCESS',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
} as const;
export type VisaStage = (typeof VisaStage)[keyof typeof VisaStage];

export const ApplicationType = {
  TOURISTIC: 'TOURISTIC',
  COMMERCIAL: 'COMMERCIAL',
  FAMILY_VISIT: 'FAMILY_VISIT',
  EDUCATION: 'EDUCATION',
  OTHER: 'OTHER',
} as const;
export type ApplicationType = (typeof ApplicationType)[keyof typeof ApplicationType];

export const FileType = {
  PASSPORT: 'PASSPORT',
  BANK_STATEMENT: 'BANK_STATEMENT',
  INTENT_LETTER: 'INTENT_LETTER',
  CONSULATE_FORM: 'CONSULATE_FORM',
  VISA_GRANT: 'VISA_GRANT',
  PAYMENT_RECEIPT: 'PAYMENT_RECEIPT',
  FLIGHT_HOTEL_RESERVATION: 'FLIGHT_HOTEL_RESERVATION',
  LETTER_OF_INTENT: 'LETTER_OF_INTENT',
  TRAVEL_PLAN: 'TRAVEL_PLAN',
  HEALTH_INSURANCE: 'HEALTH_INSURANCE',
  APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
  VISA_FEE_RECEIPT: 'VISA_FEE_RECEIPT',
  FINAL_RECEIPT: 'FINAL_RECEIPT',
  OTHER: 'OTHER',
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

export const OcrStatus = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type OcrStatus = (typeof OcrStatus)[keyof typeof OcrStatus];

export const DocAssistantDocumentType = {
  BASVURU_FORMU_KONTROLU: 'BASVURU_FORMU_KONTROLU',
  VIZE_DILEKCESI_NIYET_YAZISI: 'VIZE_DILEKCESI_NIYET_YAZISI',
  SEYAHAT_PLANI: 'SEYAHAT_PLANI',
  UCAK_REZERVASYONU: 'UCAK_REZERVASYONU',
  OTEL_KONAKLAMA_REZERVASYONU: 'OTEL_KONAKLAMA_REZERVASYONU',
  SEYAHAT_SAGLIK_SIGORTASI: 'SEYAHAT_SAGLIK_SIGORTASI',
  SPONSORLUK_YAZISI: 'SPONSORLUK_YAZISI',
  EK_TURISTIK_DESTEK_BELGELERI: 'EK_TURISTIK_DESTEK_BELGELERI',
  RANDEVU_ONAYI: 'RANDEVU_ONAYI',
  BASVURU_TESLIM_FORMU: 'BASVURU_TESLIM_FORMU',
  VIZE_HARCI_SERVIS_BEDELI_DEKONTU: 'VIZE_HARCI_SERVIS_BEDELI_DEKONTU',
  KALAN_ODEME_DEKONTU: 'KALAN_ODEME_DEKONTU',
  VIZE_SONUC_BELGESI: 'VIZE_SONUC_BELGESI',
  PASAPORT_TESLIM_IADE_BELGESI: 'PASAPORT_TESLIM_IADE_BELGESI',
  RET_KARARI_RET_MEKTUBU: 'RET_KARARI_RET_MEKTUBU',
  DIGER_EK_OPERASYON_BELGESI: 'DIGER_EK_OPERASYON_BELGESI',
} as const;
export type DocAssistantDocumentType =
  (typeof DocAssistantDocumentType)[keyof typeof DocAssistantDocumentType];

export const DocAssistantConstraintLabel = {
  ZORUNLU: 'ZORUNLU',
  OPSIYONEL: 'OPSIYONEL',
  SARTLI: 'SARTLI',
  SARTLI_ZORUNLU: 'SARTLI_ZORUNLU',
  KONTROL: 'KONTROL',
  SUREC_SONU: 'SUREC_SONU',
} as const;
export type DocAssistantConstraintLabel =
  (typeof DocAssistantConstraintLabel)[keyof typeof DocAssistantConstraintLabel];

export const DocAssistantDocumentStatus = {
  HAZIRLANIYOR: 'HAZIRLANIYOR',
  YUKLENDI: 'YUKLENDI',
  TESLIME_HAZIR: 'TESLIME_HAZIR',
} as const;
export type DocAssistantDocumentStatus =
  (typeof DocAssistantDocumentStatus)[keyof typeof DocAssistantDocumentStatus];
