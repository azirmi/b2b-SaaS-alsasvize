import {
  DocAssistantConstraintLabel,
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
  FileType,
} from '../generated/prisma/enums';

export interface DocAssistantCatalogItem {
  type: DocAssistantDocumentType;
  constraintLabel: DocAssistantConstraintLabel;
  title: string;
  uploadFileType: FileType;
  initialStatus?: DocAssistantDocumentStatus;
}

export const DOC_ASSISTANT_CATALOG: DocAssistantCatalogItem[] = [
  {
    type: DocAssistantDocumentType.VIZE_DILEKCESI_NIYET_YAZISI,
    constraintLabel: DocAssistantConstraintLabel.ZORUNLU,
    title: 'Vize Dilekcesi / Niyet Yazisi',
    uploadFileType: FileType.LETTER_OF_INTENT,
  },
  {
    type: DocAssistantDocumentType.SEYAHAT_PLANI,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Seyahat Plani',
    uploadFileType: FileType.TRAVEL_PLAN,
  },
  {
    type: DocAssistantDocumentType.UCAK_REZERVASYONU,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Ucak Rezervasyonu',
    uploadFileType: FileType.FLIGHT_HOTEL_RESERVATION,
  },
  {
    type: DocAssistantDocumentType.OTEL_KONAKLAMA_REZERVASYONU,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Otel / Konaklama Rezervasyonu',
    uploadFileType: FileType.FLIGHT_HOTEL_RESERVATION,
  },
  {
    type: DocAssistantDocumentType.SEYAHAT_SAGLIK_SIGORTASI,
    constraintLabel: DocAssistantConstraintLabel.ZORUNLU,
    title: 'Seyahat Saglik Sigortasi',
    uploadFileType: FileType.HEALTH_INSURANCE,
  },
  {
    type: DocAssistantDocumentType.SPONSORLUK_YAZISI,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Sponsorluk Yazisi',
    uploadFileType: FileType.OTHER,
  },
  {
    type: DocAssistantDocumentType.EK_TURISTIK_DESTEK_BELGELERI,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Ek Turistik Destek Belgeleri',
    uploadFileType: FileType.OTHER,
  },
  {
    type: DocAssistantDocumentType.RANDEVU_ONAYI,
    constraintLabel: DocAssistantConstraintLabel.ZORUNLU,
    title: 'Randevu Onayi',
    uploadFileType: FileType.APPOINTMENT_CONFIRMATION,
  },
  {
    type: DocAssistantDocumentType.BASVURU_TESLIM_FORMU,
    constraintLabel: DocAssistantConstraintLabel.ZORUNLU,
    title: 'Basvuru Teslim Formu',
    uploadFileType: FileType.CONSULATE_FORM,
  },
  {
    type: DocAssistantDocumentType.VIZE_HARCI_SERVIS_BEDELI_DEKONTU,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Vize Harci / Servis Bedeli Dekontu',
    uploadFileType: FileType.VISA_FEE_RECEIPT,
  },
  {
    type: DocAssistantDocumentType.KALAN_ODEME_DEKONTU,
    constraintLabel: DocAssistantConstraintLabel.SARTLI_ZORUNLU,
    title: 'Kalan Odeme Dekontu',
    uploadFileType: FileType.FINAL_RECEIPT,
  },
  {
    type: DocAssistantDocumentType.VIZE_SONUC_BELGESI,
    constraintLabel: DocAssistantConstraintLabel.SUREC_SONU,
    title: 'Vize Sonuc Belgesi',
    uploadFileType: FileType.VISA_GRANT,
  },
  {
    type: DocAssistantDocumentType.DIGER_EK_OPERASYON_BELGESI,
    constraintLabel: DocAssistantConstraintLabel.OPSIYONEL,
    title: 'Diger / Ek Operasyon Belgesi',
    uploadFileType: FileType.OTHER,
  },
];

export const DOC_ASSISTANT_TITLE_BY_TYPE: Record<
  DocAssistantDocumentType,
  string
> = DOC_ASSISTANT_CATALOG.reduce(
  (acc, item) => {
    acc[item.type] = item.title;
    return acc;
  },
  {} as Record<DocAssistantDocumentType, string>,
);

export const DOC_ASSISTANT_CATALOG_BY_TYPE: Record<
  DocAssistantDocumentType,
  DocAssistantCatalogItem
> = DOC_ASSISTANT_CATALOG.reduce(
  (acc, item) => {
    acc[item.type] = item;
    return acc;
  },
  {} as Record<DocAssistantDocumentType, DocAssistantCatalogItem>,
);

export const DOC_ASSISTANT_STATUS_LABEL_TR: Record<
  DocAssistantDocumentStatus,
  string
> = {
  [DocAssistantDocumentStatus.HAZIRLANACAK]: 'Hazirlanacak',
  [DocAssistantDocumentStatus.KONTROL_EDILECEK]: 'Kontrol Edilecek',
  [DocAssistantDocumentStatus.REVIZE_GEREKLI]: 'Revize Gerekli',
  [DocAssistantDocumentStatus.DOSYAYA_EKLENDI]: 'Dosyaya Eklendi',
  [DocAssistantDocumentStatus.KALAN_ODEME_BEKLENIYOR]: 'Kalan Odeme Bekleniyor',
  [DocAssistantDocumentStatus.HAZIRLANIYOR]: 'Hazirlaniyor',
  [DocAssistantDocumentStatus.YUKLENDI]: 'Yuklendi',
  [DocAssistantDocumentStatus.TESLIME_HAZIR]: 'Teslime Hazir',
};
