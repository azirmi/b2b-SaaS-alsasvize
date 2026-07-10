import { FileType, VisaStage } from './enums';

/** Semantic intents — the ONLY place accent color is allowed. The canvas stays monochrome. */
export type Intent = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export const INTENT_CLASSES: Record<Intent, string> = {
  success:
    'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900',
  danger:
    'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900',
  warning:
    'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900',
  info: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900',
  neutral: 'text-muted-foreground bg-muted border-border',
};

export const STAGE_INTENT: Record<VisaStage, Intent> = {
  SALES_POOL: 'neutral',
  DOC_POOL: 'neutral',
  SEC_POOL: 'neutral',
  SALES_PROCESS: 'info',
  DOC_PROCESS: 'info',
  SEC_PROCESS: 'info',
  COMPLETED: 'success',
  PAUSED: 'warning',
  CANCELLED: 'danger',
};

export const STAGE_LABEL: Record<VisaStage, string> = {
  SALES_POOL: 'Satış · Bekliyor',
  SALES_PROCESS: 'Satış · İşleniyor',
  DOC_POOL: 'Evrak · Bekliyor',
  DOC_PROCESS: 'Evrak · İşleniyor',
  SEC_POOL: 'Son İşlem · Bekliyor',
  SEC_PROCESS: 'Son İşlem · İşleniyor',
  COMPLETED: 'Tamamlandı',
  PAUSED: 'Duraklatıldı',
  CANCELLED: 'İptal Edildi',
};

export const STAGE_LABEL_CUSTOMER: Record<VisaStage, string> = {
  SALES_POOL: 'Satış · Bekliyor Aşamasında',
  SALES_PROCESS: 'Satış · İşleniyor Aşamasında',
  DOC_POOL: 'Evrak · Bekliyor Aşamasında',
  DOC_PROCESS: 'Evrak · İşleniyor Aşamasında',
  SEC_POOL: 'Son İşlem · Bekliyor Aşamasında',
  SEC_PROCESS: 'Son İşlem · İşleniyor Aşamasında',
  COMPLETED: 'Tamamlandı',
  PAUSED: 'Duraklatıldı',
  CANCELLED: 'İptal Edildi',
};

/** Canonical happy-path order (terminal PAUSED/CANCELLED excluded). */
export const STAGE_FLOW: VisaStage[] = [
  VisaStage.SALES_POOL,
  VisaStage.SALES_PROCESS,
  VisaStage.DOC_POOL,
  VisaStage.DOC_PROCESS,
  VisaStage.SEC_POOL,
  VisaStage.SEC_PROCESS,
  VisaStage.COMPLETED,
];

/** Forward stage-advance action, keyed by the active *_PROCESS stage. */
export const STAGE_ADVANCE: Partial<
  Record<VisaStage, { label: string; next: VisaStage }>
> = {
  [VisaStage.SALES_PROCESS]: {
    label: 'Belgelere Gönder',
    next: VisaStage.DOC_POOL,
  },
  [VisaStage.DOC_PROCESS]: {
    label: 'Son İşleme Gönder',
    next: VisaStage.SEC_POOL,
  },
  [VisaStage.SEC_PROCESS]: {
    label: 'Tamamlandı Olarak İşaretle',
    next: VisaStage.COMPLETED,
  },
};

/** Human labels for document categories. */
export const FILE_TYPE_LABEL: Record<FileType, string> = {
  PASSPORT: 'Pasaport',
  BANK_STATEMENT: 'Banka Hesap Dökümü',
  INTENT_LETTER: 'Niyet Mektubu',
  CONSULATE_FORM: 'Konsolosluk Formu',
  VISA_GRANT: 'Vize Sonuç Belgesi',
  PAYMENT_RECEIPT: 'Ödeme Dekontu',
  FLIGHT_HOTEL_RESERVATION: 'Uçak ve Otel Rezervasyonu',
  LETTER_OF_INTENT: 'Niyet Mektubu',
  TRAVEL_PLAN: 'Seyahat Planı',
  HEALTH_INSURANCE: 'Seyahat Sağlık Sigortası',
  APPOINTMENT_CONFIRMATION: 'Randevu Onayı',
  FINAL_RECEIPT: 'Kalan Ödeme Dekontu',
  OTHER: 'Diğer',
};
