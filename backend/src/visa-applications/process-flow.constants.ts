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

export type ProcessPaymentType = 'NORMAL' | 'PREPAID';

export const CUSTOMER_PROCESS_STAGE_ORDER: CustomerProcessStage[] = [
  CustomerProcessStage.STAGE_1_RECORD_CREATED,
  CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN,
  CustomerProcessStage.STAGE_3_OPERATION_STARTED,
  CustomerProcessStage.STAGE_4_FORM_READY,
  CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED,
  CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN,
  CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED,
  CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED,
  CustomerProcessStage.STAGE_9_DOSSIER_READY,
  CustomerProcessStage.STAGE_10_PROCESS_COMPLETED,
];

export const CUSTOMER_PROCESS_STAGE_LABEL_TR: Record<CustomerProcessStage, string> =
  {
    [CustomerProcessStage.STAGE_1_RECORD_CREATED]:
      'İşlem Kaydınız Oluşturuldu',
    [CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN]:
      'Başvurunuz İşleme Alındı',
    [CustomerProcessStage.STAGE_3_OPERATION_STARTED]:
      'Başvurunuz Operasyon Sürecine Alındı',
    [CustomerProcessStage.STAGE_4_FORM_READY]:
      'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır (Tam Ödeme) / Başvuru Formunuz Hazır (Ön Ödeme)',
    [CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED]:
      'Randevunuz Oluşturuldu',
    [CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN]:
      'Belgelerinizi Yükleyebilirsiniz',
    [CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED]:
      'Belgeleriniz İçin Düzenleme Gerekiyor',
    [CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED]:
      'Belgeleriniz Kontrol Edildi',
    [CustomerProcessStage.STAGE_9_DOSSIER_READY]:
      'Başvuru Dosyanız Hazır',
    [CustomerProcessStage.STAGE_10_PROCESS_COMPLETED]:
      'Süreç Tamamlandı',
  };

export function getCustomerProcessStageLabel(
  stage: CustomerProcessStage,
  paymentType: ProcessPaymentType,
): string {
  if (stage === CustomerProcessStage.STAGE_4_FORM_READY) {
    return paymentType === 'NORMAL'
      ? 'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır (Tam Ödeme)'
      : 'Başvuru Formunuz Hazır (Ön Ödeme)';
  }

  if (stage === CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED) {
    return paymentType === 'NORMAL'
      ? 'Randevunuz Oluşturuldu (Tam Ödeme)'
      : 'Randevunuz Oluşturuldu (Ön Ödeme)';
  }

  if (stage === CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN) {
    return paymentType === 'NORMAL'
      ? 'Belgelerinizi Yükleyebilirsiniz (Tam Ödeme)'
      : 'Belgelerinizi Yükleyebilirsiniz (Ön Ödeme)';
  }

  return CUSTOMER_PROCESS_STAGE_LABEL_TR[stage];
}
