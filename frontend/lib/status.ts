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

export type PaymentType = 'NORMAL' | 'PREPAID';

export interface StageDisplayContext {
  paymentType?: PaymentType | null;
  hasAppointmentDate?: boolean;
  isDeliveredToCustomer?: boolean;
  hasDocumentRevision?: boolean;
}

export const CustomerProcessStage = {
  STAGE_1_RECORD_CREATED: 'STAGE_1_RECORD_CREATED',
  STAGE_2_APPLICATION_TAKEN_IN: 'STAGE_2_APPLICATION_TAKEN_IN',
  STAGE_3_OPERATION_STARTED: 'STAGE_3_OPERATION_STARTED',
  STAGE_4_FORM_READY: 'STAGE_4_FORM_READY',
  STAGE_5_APPOINTMENT_CREATED: 'STAGE_5_APPOINTMENT_CREATED',
  STAGE_6_DOCUMENT_UPLOAD_OPEN: 'STAGE_6_DOCUMENT_UPLOAD_OPEN',
  STAGE_7_DOCUMENT_REVISION_REQUIRED: 'STAGE_7_DOCUMENT_REVISION_REQUIRED',
  STAGE_8_DOCUMENTS_CHECKED: 'STAGE_8_DOCUMENTS_CHECKED',
  STAGE_9_DOSSIER_READY: 'STAGE_9_DOSSIER_READY',
  STAGE_10_PROCESS_COMPLETED: 'STAGE_10_PROCESS_COMPLETED',
} as const;

export type CustomerProcessStage =
  (typeof CustomerProcessStage)[keyof typeof CustomerProcessStage];

export const CUSTOMER_PROCESS_STAGE_LABEL: Record<CustomerProcessStage, string> = {
  [CustomerProcessStage.STAGE_1_RECORD_CREATED]:
    'İşlem Kaydınız Oluşturuldu',
  [CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN]:
    'Başvurunuz İşleme Alındı',
  [CustomerProcessStage.STAGE_3_OPERATION_STARTED]:
    'Başvurunuz Operasyon Sürecine Alındı',
  [CustomerProcessStage.STAGE_4_FORM_READY]:
    'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır',
  [CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED]: 'Randevunuz Oluşturuldu',
  [CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN]:
    'Belgelerinizi Yükleyebilirsiniz',
  [CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED]:
    'Belgeleriniz İçin Düzenleme Gerekiyor',
  [CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED]:
    'Belgeleriniz Kontrol Edildi',
  [CustomerProcessStage.STAGE_9_DOSSIER_READY]: 'Başvuru Dosyanız Hazır',
  [CustomerProcessStage.STAGE_10_PROCESS_COMPLETED]: 'Süreç Tamamlandı',
};

const CUSTOMER_PROCESS_STAGE_INTENT: Record<CustomerProcessStage, Intent> = {
  [CustomerProcessStage.STAGE_1_RECORD_CREATED]: 'info',
  [CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN]: 'info',
  [CustomerProcessStage.STAGE_3_OPERATION_STARTED]: 'info',
  [CustomerProcessStage.STAGE_4_FORM_READY]: 'success',
  [CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED]: 'success',
  [CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN]: 'success',
  [CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED]: 'warning',
  [CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED]: 'success',
  [CustomerProcessStage.STAGE_9_DOSSIER_READY]: 'success',
  [CustomerProcessStage.STAGE_10_PROCESS_COMPLETED]: 'success',
};

export const STAGE_INTENT: Record<VisaStage, Intent> = {
  SALES_POOL: 'info',
  DOC_POOL: 'info',
  SEC_POOL: 'success',
  SALES_PROCESS: 'info',
  DOC_PROCESS: 'info',
  SEC_PROCESS: 'success',
  COMPLETED: 'success',
  PAUSED: 'warning',
  CANCELLED: 'danger',
};

export const STAGE_LABEL: Record<VisaStage, string> = {
  SALES_POOL: 'İşlem Kaydınız Oluşturuldu',
  SALES_PROCESS: 'Başvurunuz İşleme Alındı',
  DOC_POOL: 'Başvurunuz Operasyon Sürecine Alındı',
  DOC_PROCESS: 'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır',
  SEC_POOL: 'Belgeleriniz Kontrol Edildi',
  SEC_PROCESS: 'Başvuru Dosyanız Hazır',
  COMPLETED: 'Süreç Tamamlandı',
  PAUSED: 'Süreç Geçici Olarak Bekletiliyor',
  CANCELLED: 'Başvuru İptal Edildi',
};

export const STAGE_LABEL_CUSTOMER = STAGE_LABEL;

function resolveCustomerProcessStage(
  internalStage: VisaStage,
  context: StageDisplayContext = {},
): CustomerProcessStage | null {
  switch (internalStage) {
    case VisaStage.SALES_POOL:
      return CustomerProcessStage.STAGE_1_RECORD_CREATED;
    case VisaStage.SALES_PROCESS:
      return CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN;
    case VisaStage.DOC_POOL:
      return CustomerProcessStage.STAGE_3_OPERATION_STARTED;
    case VisaStage.DOC_PROCESS:
      if (context.hasDocumentRevision) {
        return CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED;
      }
      if (context.isDeliveredToCustomer) {
        return CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN;
      }
      if (context.hasAppointmentDate) {
        return CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED;
      }
      return CustomerProcessStage.STAGE_4_FORM_READY;
    case VisaStage.SEC_POOL:
      return CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED;
    case VisaStage.SEC_PROCESS:
      return CustomerProcessStage.STAGE_9_DOSSIER_READY;
    case VisaStage.COMPLETED:
      return CustomerProcessStage.STAGE_10_PROCESS_COMPLETED;
    default:
      return null;
  }
}

function getCustomerProcessStageLabel(
  stage: CustomerProcessStage,
  context: StageDisplayContext = {},
): string {
  if (stage !== CustomerProcessStage.STAGE_4_FORM_READY) {
    return CUSTOMER_PROCESS_STAGE_LABEL[stage];
  }

  return context.paymentType === 'PREPAID'
    ? 'Başvuru Formunuz Hazır'
    : 'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır';
}

export function getStageLabel(
  internalStage: VisaStage,
  context: StageDisplayContext = {},
): string {
  const processStage = resolveCustomerProcessStage(internalStage, context);
  if (!processStage) {
    return STAGE_LABEL[internalStage];
  }
  return getCustomerProcessStageLabel(processStage, context);
}

export function getStageIntent(
  internalStage: VisaStage,
  context: StageDisplayContext = {},
): Intent {
  const processStage = resolveCustomerProcessStage(internalStage, context);
  if (!processStage) {
    return STAGE_INTENT[internalStage];
  }
  return CUSTOMER_PROCESS_STAGE_INTENT[processStage];
}

/** Public-safe stage wording used only in customer-facing screens. */
export function getCustomerStageName(
  internalStage: VisaStage,
  context: StageDisplayContext = {},
): string {
  return getStageLabel(internalStage, context);
}

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
  VISA_FEE_RECEIPT: 'Vize Harcı Dekontu',
  FINAL_RECEIPT: 'Kalan Ödeme Dekontu',
  OTHER: 'Diğer',
};
