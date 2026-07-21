import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { ApplicationDetailsView } from "@/components/applications/application-details-view";
import { ApplicationForm } from "@/components/applications/application-form";
import { CustomerFormStatusCard } from "@/components/applications/customer-form-status-card";
import { CustomerPersonUploadPanel } from "@/components/applications/customer-person-upload-panel";
import {
  type PersonBasedUploadApplicant,
} from "@/components/applications/person-based-upload-section";
import {
  type UploadDocumentOption,
} from "@/components/documents/document-uploader";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { ForceDownloadButton } from "@/components/documents/force-download-button";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { deriveDownloadFileName } from "@/lib/download";
import {
  DocAssistantDocumentType,
  FileType,
  OcrStatus,
  VisaStage,
} from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import {
  FILE_TYPE_LABEL,
  INTENT_CLASSES,
  getCustomerStageName,
  type Intent,
  type StageDisplayContext,
} from "@/lib/status";
import type {
  ApplicationFormEntry,
  DeliveredCustomerFile,
  DownloadUrlResponse,
  VisaApplicationDetail,
  DocumentRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const OCR_BADGE: Record<OcrStatus, { label: string; intent: Intent }> = {
  PENDING: { label: "Dijital Kontrol Bekliyor", intent: "neutral" },
  PROCESSED: { label: "Dijital Evrak Okuma", intent: "success" },
  FAILED: { label: "OCR başarısız", intent: "danger" },
};

const DOC_ASSISTANT_TITLE_BY_TYPE: Record<DocAssistantDocumentType, string> = {
  [DocAssistantDocumentType.BASVURU_FORMU_KONTROLU]:
    "Başvuru Formu Kontrolü",
  [DocAssistantDocumentType.VIZE_DILEKCESI_NIYET_YAZISI]:
    "Vize Dilekçesi / Niyet Yazısı",
  [DocAssistantDocumentType.SEYAHAT_PLANI]: "Seyahat Planı",
  [DocAssistantDocumentType.UCAK_REZERVASYONU]: "Uçak Rezervasyonu",
  [DocAssistantDocumentType.OTEL_KONAKLAMA_REZERVASYONU]:
    "Otel / Konaklama Rezervasyonu",
  [DocAssistantDocumentType.SEYAHAT_SAGLIK_SIGORTASI]:
    "Seyahat Sağlık Sigortası",
  [DocAssistantDocumentType.SPONSORLUK_YAZISI]: "Sponsorluk Yazısı",
  [DocAssistantDocumentType.EK_TURISTIK_DESTEK_BELGELERI]:
    "Ek Turistik Destek Belgeleri",
  [DocAssistantDocumentType.RANDEVU_ONAYI]: "Randevu Onayı",
  [DocAssistantDocumentType.BASVURU_TESLIM_FORMU]: "Başvuru Teslim Formu",
  [DocAssistantDocumentType.VIZE_HARCI_SERVIS_BEDELI_DEKONTU]:
    "Vize Harcı / Servis Bedeli Dekontu",
  [DocAssistantDocumentType.KALAN_ODEME_DEKONTU]: "Kalan Ödeme Dekontu",
  [DocAssistantDocumentType.VIZE_SONUC_BELGESI]: "Vize Sonuç Belgesi",
  [DocAssistantDocumentType.PASAPORT_TESLIM_IADE_BELGESI]:
    "Pasaport Teslim / İade Belgesi",
  [DocAssistantDocumentType.RET_KARARI_RET_MEKTUBU]:
    "Ret Kararı / Ret Mektubu",
  [DocAssistantDocumentType.DIGER_EK_OPERASYON_BELGESI]:
    "Diğer / Ek Operasyon Belgesi",
};

const UPLOAD_LABEL_TOKEN_RE = /^__uplabel_([A-Za-z0-9_-]+)__/;

function decodeBase64UrlUtf8(token: string): string | null {
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function getUploadedDocumentLabel(fileUrl: string): string | null {
  const objectName = fileUrl.split("/").pop();
  if (!objectName) {
    return null;
  }

  const sanitizedFileName = objectName.replace(/^[0-9a-f-]+-/, "");
  const labelToken = sanitizedFileName.match(UPLOAD_LABEL_TOKEN_RE)?.[1];
  if (!labelToken) {
    return null;
  }

  return decodeBase64UrlUtf8(labelToken);
}

function getCustomerDocumentLabel(document: DocumentRecord): string {
  const uploadedLabel = getUploadedDocumentLabel(document.fileUrl);
  if (uploadedLabel) {
    return uploadedLabel;
  }

  if (document.docAssistantType) {
    return DOC_ASSISTANT_TITLE_BY_TYPE[document.docAssistantType];
  }
  return FILE_TYPE_LABEL[document.fileType];
}

const BASE_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "passport-main",
    category: "Kimlik ve Pasaport Belgeleri",
    label: "Pasaport",
    fileType: FileType.PASSPORT,
    description:
      "Pasaportunuzun fotoğraflı kimlik sayfasını tam, net ve okunabilir şekilde yükleyin. Pasaportunuz son 10 yıl içinde alınmış olmalı, başvurduğunuz vize bitiş tarihinden sonra en az 3 ay daha geçerli olmalıdır.",
  },
  {
    id: "identity-card",
    category: "Kimlik ve Pasaport Belgeleri",
    label: "Kimlik Kartı (Ön/Arka)",
    fileType: FileType.CONSULATE_FORM,
    description:
      "T.C. kimlik kartınızın ön ve arka yüzünü tek dosyada, köşeler görünür ve bilgiler okunabilir olacak şekilde yükleyin.",
  },
  {
    id: "population-record",
    category: "Kimlik ve Pasaport Belgeleri",
    label: "Tam Tekmil Vukuatlı Nüfus Kayıt Örneği",
    fileType: FileType.OTHER,
    description:
      "E-Devlet üzerinden alınmış, güncel ve barkodlu/QR kodlu tam tekmil vukuatlı nüfus kayıt örneğini PDF olarak yükleyin.",
  },
  {
    id: "bank-statement-main",
    category: "Finansal Belgeler",
    label: "Banka Hesap Dökümü",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Son 3 aya ait kaşeli-imzalı veya barkodlu/QR kodlu banka hesap dökümünü yükleyin. Hesap hareketleri, bakiye ve ad-soyad bilgileri net görünmelidir. DİKKAT: Belgenin güncel olması için randevu gününe en fazla 3 gün kala yüklenmesi zorunludur.",
  },
  {
    id: "financial-support",
    category: "Finansal Belgeler",
    label: "Gelir Destekleyici Evrak",
    fileType: FileType.OTHER,
    description:
      "Gelirinizi destekleyen ek belgeleri (kira geliri, tapu, araç ruhsatı vb.) tek PDF halinde yükleyin.",
    optional: true,
  },
  {
    id: "travel-reservation",
    category: "Satın alınmış seyahat belgeleri",
    label: "Uçak ve Otel Rezervasyonları",
    fileType: FileType.FLIGHT_HOTEL_RESERVATION,
    description:
      "Gidiş-dönüş uçuş ve konaklama rezervasyonlarınızı tarih, isim ve rezervasyon numarası görünür olacak şekilde yükleyin.",
  },
  {
    id: "travel-insurance",
    category: "Satın alınmış seyahat belgeleri",
    label: "Seyahat Sağlık Sigortası",
    fileType: FileType.HEALTH_INSURANCE,
    description:
      "Seyahat tarih aralığının tamamını kapsayan, Schengen kurallarına uygun seyahat sağlık sigortası poliçesini yükleyin.",
  },
  {
    id: "travel-plan",
    category: "Satın alınmış seyahat belgeleri",
    label: "Seyahat Planı",
    fileType: FileType.TRAVEL_PLAN,
    description:
      "Seyahatinizde hangi tarihte hangi şehirde olacağınızı gösteren detaylı seyahat planını yükleyin.",
  },
  {
    id: "extra-document",
    category: "Ek belgeler",
    label: "Ek Destekleyici Belge",
    fileType: FileType.OTHER,
    description:
      "Yukarıdaki başlıklara girmeyen ama başvurunuzu güçlendirecek ek belgeleri yükleyin.",
    optional: true,
  },
];

const EMPLOYEE_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "employee-employment-letter",
    category: "Çalışanlar İçin Belgeler",
    label: "İş Yeri Yazısı",
    fileType: FileType.OTHER,
    description:
      "Çalıştığınız kurumdan antetli kağıda, kaşeli-imzalı görev/izin yazısını yükleyin.",
  },
  {
    id: "employee-payslips",
    category: "Çalışanlar İçin Belgeler",
    label: "Maaş Bordroları",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Son 3 aya ait maaş bordrolarınızı tek dosya halinde yükleyin.",
  },
  {
    id: "employee-sgk",
    category: "Çalışanlar İçin Belgeler",
    label: "SGK Hizmet Dökümü",
    fileType: FileType.OTHER,
    description:
      "E-Devlet üzerinden alınmış, güncel ve barkodlu/QR kodlu SGK hizmet dökümünü PDF formatında yükleyin.",
  },
];

const EMPLOYER_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "employer-tax",
    category: "İşverenler / Şirket Sahipleri İçin Belgeler",
    label: "Vergi Levhası",
    fileType: FileType.OTHER,
    description:
      "Şirketinize ait güncel vergi levhasını yükleyin.",
  },
  {
    id: "employer-activity",
    category: "İşverenler / Şirket Sahipleri İçin Belgeler",
    label: "Faaliyet Belgesi",
    fileType: FileType.OTHER,
    description:
      "Ticaret odasından alınmış güncel faaliyet belgesini yükleyin.",
  },
  {
    id: "employer-signature",
    category: "İşverenler / Şirket Sahipleri İçin Belgeler",
    label: "İmza Sirküleri",
    fileType: FileType.OTHER,
    description:
      "Şirket imza yetkilerini gösteren imza sirkülerini eksiksiz şekilde yükleyin.",
  },
  {
    id: "employer-company-bank",
    category: "İşverenler / Şirket Sahipleri İçin Belgeler",
    label: "Şirket Banka Hesap Dökümü",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Şirket hesabına ait son 3 aya ait kaşeli-imzalı banka dökümünü yükleyin.",
  },
];

const SPECIAL_STATUS_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "special-student",
    category: "Öğrenci/Emekli/Çiftçi/18 yaş altı",
    label: "Öğrenci Belgesi",
    fileType: FileType.OTHER,
    description:
      "Öğrenciyseniz güncel ve barkodlu öğrenci belgesini yükleyin.",
  },
  {
    id: "special-retired",
    category: "Öğrenci/Emekli/Çiftçi/18 yaş altı",
    label: "Emeklilik Belgesi",
    fileType: FileType.OTHER,
    description:
      "Emekliyseniz emeklilik durumunu gösteren resmi belgeyi yükleyin.",
  },
  {
    id: "special-farmer",
    category: "Öğrenci/Emekli/Çiftçi/18 yaş altı",
    label: "Çiftçilik Belgesi",
    fileType: FileType.OTHER,
    description:
      "Çiftçiyseniz ziraat odası kaydı veya eşdeğer resmi belgenizi yükleyin.",
  },
  {
    id: "special-consent",
    category: "Öğrenci/Emekli/Çiftçi/18 yaş altı",
    label: "18 Yaş Altı Muvafakatname",
    fileType: FileType.OTHER,
    description:
      "18 yaş altı başvurularda noter onaylı muvafakatnameyi eksiksiz şekilde yükleyin.",
  },
];

const SPONSOR_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "sponsor-letter",
    category: "Sponsor Evrakları",
    label: "Sponsor Dilekçesi",
    fileType: FileType.OTHER,
    description:
      "Sponsorun masrafları üstlendiğini belirten imzalı sponsor dilekçesini yükleyin.",
  },
  {
    id: "sponsor-id",
    category: "Sponsor Evrakları",
    label: "Sponsor Kimlik/Pasaport",
    fileType: FileType.OTHER,
    description:
      "Sponsorun kimlik kartı veya pasaport kimlik sayfasını net ve okunur şekilde yükleyin.",
  },
  {
    id: "sponsor-work-letter",
    category: "Sponsor Evrakları",
    label: "Sponsor İş Yeri Yazısı",
    fileType: FileType.OTHER,
    description:
      "Sponsor çalışan ise iş yerinden antetli kağıda alınmış görev/izin yazısını yükleyin.",
  },
  {
    id: "sponsor-payroll",
    category: "Sponsor Evrakları",
    label: "Sponsor Maaş Bordrosu",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Sponsor çalışan ise son 3 aya ait maaş bordrolarını yükleyin.",
  },
  {
    id: "sponsor-bank",
    category: "Sponsor Evrakları",
    label: "Sponsor Banka Hesap Dökümü",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Sponsorun son 3 aya ait kaşeli-imzalı banka hesap dökümünü yükleyin.",
  },
];

const REJECTED_AFTER_DOCUMENT_OPTIONS: UploadDocumentOption[] = [
  {
    id: "rejected-letter",
    category: "Ret sonrası",
    label: "Ret Mektubu",
    fileType: FileType.OTHER,
    description:
      "Daha önce ret aldıysanız konsolosluk ret mektubunu eksiksiz şekilde yükleyin.",
  },
  {
    id: "rejected-financial-update",
    category: "Ret sonrası",
    label: "Güncel Finansal Belgeler",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Ret sonrası başvuruda güncellenmiş banka dökümü ve gelir evraklarını yeniden yükleyin.",
  },
];

function hasCompanyOwnerProfile(detail: VisaApplicationDetail): boolean {
  const primaryDetails = getPrimaryApplicationDetails(detail);
  const employmentStatus =
    primaryDetails?.employmentStatus?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const occupation =
    primaryDetails?.occupation?.trim().toLocaleLowerCase("tr-TR") ?? "";

  return (
    Boolean(primaryDetails?.isEmployer) ||
    employmentStatus === "işveren" ||
    occupation.includes("şirket") ||
    occupation.includes("işveren") ||
    occupation.includes("esnaf")
  );
}

function hasSpecialProfile(detail: VisaApplicationDetail): boolean {
  const primaryDetails = getPrimaryApplicationDetails(detail);
  const employmentStatus =
    primaryDetails?.employmentStatus?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const occupation =
    primaryDetails?.occupation?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const dob = primaryDetails?.dateOfBirth;

  let isMinor = false;
  if (dob) {
    const birthDate = new Date(dob);
    if (!Number.isNaN(birthDate.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age -= 1;
      }
      isMinor = age < 18;
    }
  }

  return (
    employmentStatus === "öğrenci" ||
    employmentStatus === "emekli" ||
    occupation.includes("çiftçi") ||
    isMinor
  );
}

function buildCustomerDocumentOptions(
  detail: VisaApplicationDetail,
): UploadDocumentOption[] {
  const primaryDetails = getPrimaryApplicationDetails(detail);
  const options: UploadDocumentOption[] = [...BASE_DOCUMENT_OPTIONS];

  if (hasCompanyOwnerProfile(detail)) {
    options.push(...EMPLOYER_DOCUMENT_OPTIONS);
  } else if (hasSpecialProfile(detail)) {
    options.push(...SPECIAL_STATUS_DOCUMENT_OPTIONS);
  } else {
    options.push(...EMPLOYEE_DOCUMENT_OPTIONS);
  }

  if (primaryDetails?.hasSponsor) {
    options.push(...SPONSOR_DOCUMENT_OPTIONS);
  }

  const hasRejectedDocument = detail.documents.some(
    (document) => Boolean(document.rejectionReason),
  );
  if (hasRejectedDocument) {
    options.push(...REJECTED_AFTER_DOCUMENT_OPTIONS);
  }

  return options;
}

function getApplicationForms(detail: VisaApplicationDetail): ApplicationFormEntry[] {
  if (detail.applicationForms.length > 0) {
    return detail.applicationForms;
  }

  return [
    {
      applicantIndex: 1,
      applicantLabel: "1. Kişi Başvuru Formu",
      applicantFullName: detail.customer.fullName ?? null,
      submitted: Boolean(detail.details),
      submittedAt: detail.details?.submittedAt ?? null,
      details: detail.details,
    },
  ];
}

function getPrimaryApplicationDetails(
  detail: VisaApplicationDetail,
): VisaApplicationDetail["details"] {
  const forms = getApplicationForms(detail);
  const primaryFromForms =
    forms.find((form) => form.applicantIndex === 1)?.details ?? null;
  return primaryFromForms ?? detail.details;
}

function isDeliveredCustomerFile(value: unknown): value is DeliveredCustomerFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DeliveredCustomerFile>;
  return (
    typeof candidate.documentId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.deliveredAt === "string"
  );
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Panel
      </Link>
      <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

/**
 * Customer-facing application detail. Loads strictly the caller's own
 * application (the API enforces ownership; a foreign id returns 403 → notice),
 * lets them upload documents straight to storage, and lists every file with its
 * approval and OCR status.
 */
export async function CustomerApplicationDetail({
  applicationId,
  view = "documents",
  preferredApplicantIndex,
}: {
  applicationId: string;
  view?: "documents" | "form";
  preferredApplicantIndex?: number;
}) {
  let detail: VisaApplicationDetail | null = null;
  let missing = false;
  let forbidden = false;
  let loadError = false;
  try {
    detail = await serverApi.get<VisaApplicationDetail>(
      `/applications/${applicationId}`,
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      // Stale/removed application or malformed id — render an in-shell notice
      // rather than hard-calling notFound() and dropping the dashboard chrome.
      missing = true;
    } else if (error instanceof ApiError && error.status === 403) {
      forbidden = true;
    } else {
      loadError = true;
    }
  }

  if (missing) {
    return (
      <Notice
        title="Başvuru bulunamadı"
        body="Bu başvuru artık mevcut değil veya bağlantı güncel değil. Güncel başvurularınız için panele dönün."
      />
    );
  }
  if (forbidden) {
    return (
      <Notice
        title="Erişim yok"
        body="Bu başvuru hesabınızla ilişkili değil."
      />
    );
  }
  if (loadError || !detail) {
    return (
      <Notice
        title="Başvuru yüklenemedi"
        body="Hizmete erişirken bir sorun oluştu. Lütfen kısa süre sonra tekrar deneyin."
      />
    );
  }

  const downloads = await Promise.all(
    detail.documents.map(async (document) => {
      try {
        const { url } = await serverApi.get<DownloadUrlResponse>(
          `/documents/${document.id}/download`,
        );
        return [document.id, url] as const;
      } catch {
        return [document.id, null] as const;
      }
    }),
  );
  const urlById = new Map(downloads);
  const deliveredFiles = Array.isArray(detail.deliveredToCustomerFiles)
    ? detail.deliveredToCustomerFiles.filter(isDeliveredCustomerFile)
    : [];
  const visibleDocuments = detail.documents.filter(
    (document) => document.fileType !== FileType.PAYMENT_RECEIPT,
  );
  const metadata = detail.metadata;
  const metadataFullName =
    metadata && typeof metadata.fullName === "string"
      ? metadata.fullName
      : null;
  const metadataEmail =
    metadata && typeof metadata.email === "string" ? metadata.email : null;
  const metadataPhone =
    metadata && typeof metadata.phone === "string" ? metadata.phone : null;
  const metadataResidenceCity =
    metadata && typeof metadata.residenceCity === "string"
      ? metadata.residenceCity
      : null;
  const metadataPlannedTravelDate =
    metadata && typeof metadata.plannedTravelDate === "string"
      ? metadata.plannedTravelDate
      : null;
  const applicationForms = getApplicationForms(detail);
  const primaryDetails = getPrimaryApplicationDetails(detail);
  const preferredForm =
    typeof preferredApplicantIndex === "number" &&
    applicationForms.some(
      (form) => form.applicantIndex === preferredApplicantIndex,
    )
      ? preferredApplicantIndex
      : null;
  const defaultFormTabValue = applicationForms[0]
    ? preferredForm
      ? `applicant-${preferredForm}`
      : `applicant-${applicationForms[0].applicantIndex}`
    : "applicant-1";
  const requiredFormCount =
    detail.applicationFormsRequiredCount || applicationForms.length;
  const submittedFormCount =
    detail.applicationFormsSubmittedCount ||
    applicationForms.filter((form) => form.submitted).length;
  const missingForms = applicationForms.filter((form) => !form.submitted);
  const onboardingTravelStartDate =
    toIsoDate(detail.plannedTravelDate) ??
    toIsoDate(primaryDetails?.plannedTravelStartDate) ??
    toIsoDate(metadataPlannedTravelDate);

  const stage = detail.currentStage;
  const canEditForm =
    stage !== VisaStage.COMPLETED && stage !== VisaStage.CANCELLED;
  const hasAppointmentDate = Boolean(detail.crmData?.appointmentDate);
  const hasReachedOperationStage =
    stage === VisaStage.DOC_POOL ||
    stage === VisaStage.DOC_PROCESS ||
    stage === VisaStage.SEC_POOL ||
    stage === VisaStage.SEC_PROCESS;
  const stageDisplayContext: StageDisplayContext = {
    paymentType: detail.crmData?.paymentType ?? null,
    hasAppointmentDate,
    isDeliveredToCustomer: detail.isDeliveredToCustomer,
    hasDocumentRevision: detail.documents.some(
      (document) => !document.isApproved && Boolean(document.rejectionReason),
    ),
  };
  const canUpload = canEditForm && hasReachedOperationStage;
  const formLockedByStage = canEditForm && !canUpload;
  const showingForm = view === "form";
  const personBasedUploadApplicants: PersonBasedUploadApplicant[] =
    applicationForms.map((formEntry) => ({
      id: `applicant-${formEntry.applicantIndex}`,
      name: formEntry.applicantFullName ?? `${formEntry.applicantIndex}. Kişi`,
      status: formEntry.submitted ? "Tamamlandı" : "Bekliyor",
    }));
  const customerDocumentOptions = buildCustomerDocumentOptions(detail);
  const customerAllowedTypes = Array.from(
    new Set(customerDocumentOptions.map((option) => option.fileType)),
  );
  const customerOptionalTypes = Array.from(
    new Set(
      customerDocumentOptions
        .filter((option) => Boolean(option.optional))
        .map((option) => option.fileType),
    ),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Panel
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
              Başvurunuz
            </h1>
            <StageBadge
              stage={stage}
              customerView
              context={stageDisplayContext}
            />
            <Badge variant="outline" className="rounded-md text-[11px]">
              {APPLICATION_TYPE_LABEL[detail.applicationType]}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Süreç durumu: {getCustomerStageName(stage, stageDisplayContext)}
          </p>
        </div>
        <div className="w-full text-left text-xs text-muted-foreground sm:w-auto sm:text-right">
          <div>Açılış: {timeAgo(detail.createdAt)}</div>
        </div>
      </div>

      {showingForm ? (
        <section className="rounded-lg border border-border/40 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Başvuru Formları</h2>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md text-[11px]",
                submittedFormCount >= requiredFormCount
                  ? INTENT_CLASSES.success
                  : INTENT_CLASSES.warning,
              )}
            >
              {submittedFormCount}/{requiredFormCount} Tamamlandı
            </Badge>
          </div>

          {canEditForm ? (
            formLockedByStage ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Başvuru formu ve evrak yükleme alanı, başvurunuz operasyon sürecine alındığında açılır.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Her başvuru kişisi için ilgili formu ayrı ayrı doldurup kaydedin.
              </p>
            )
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Bu başvuru kapandığı için form düzenlenemez. Kaydedilen bilgiler
              aşağıda gösteriliyor.
            </p>
          )}

          {canEditForm && !formLockedByStage ? (
            <div className="mt-3">
              <CustomerFormStatusCard
                applicationId={detail.id}
                requiredFormCount={requiredFormCount}
                submittedFormCount={submittedFormCount}
                missingForms={missingForms.map((form) => ({
                  applicantIndex: form.applicantIndex,
                  applicantLabel: form.applicantLabel,
                  applicantFullName: form.applicantFullName,
                }))}
              />
            </div>
          ) : null}

          <Separator className="my-4" />

          <Tabs defaultValue={defaultFormTabValue} className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border/60 bg-muted/50 p-1">
              {applicationForms.map((formEntry) => (
                <TabsTrigger
                  key={formEntry.applicantIndex}
                  value={`applicant-${formEntry.applicantIndex}`}
                  className="shrink-0"
                >
                  {formEntry.applicantIndex}. Kişi
                </TabsTrigger>
              ))}
            </TabsList>

            {applicationForms.map((formEntry) => (
              <TabsContent
                key={formEntry.applicantIndex}
                value={`applicant-${formEntry.applicantIndex}`}
                className="mt-0"
              >
                <article className="rounded-md border border-border/40 bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formEntry.applicantLabel}</p>
                      {formEntry.applicantFullName ? (
                        <p className="text-xs text-muted-foreground">
                          {formEntry.applicantFullName}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md text-[11px]",
                        formEntry.submitted
                          ? INTENT_CLASSES.success
                          : INTENT_CLASSES.warning,
                      )}
                    >
                      {formEntry.submitted ? "Tamamlandı" : "Bekliyor"}
                    </Badge>
                  </div>

                  <Separator className="my-3" />

                  {canEditForm ? (
                    formLockedByStage ? (
                      <p className="text-xs text-muted-foreground">
                        Bu form başvuru operasyon sürecine alındığında aktif olacaktır.
                      </p>
                    ) : (
                      <ApplicationForm
                        applicationId={detail.id}
                        applicantIndex={formEntry.applicantIndex}
                        details={formEntry.details}
                        targetCountry={detail.customer.targetCountry}
                        customerPrefill={{
                          fullName:
                            formEntry.applicantFullName ||
                            detail.customer.fullName ||
                            metadataFullName,
                          email: detail.customer.email || metadataEmail,
                          phone: detail.customer.phone || metadataPhone,
                          nationalId: formEntry.details?.nationalId ?? null,
                          residenceCity:
                            formEntry.details?.residenceCity ??
                            detail.residenceCity ??
                            metadataResidenceCity,
                          plannedTravelStartDate: onboardingTravelStartDate,
                        }}
                      />
                    )
                  ) : formEntry.details ? (
                    <ApplicationDetailsView details={formEntry.details} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Bu kişi için henüz başvuru formu gönderilmedi.
                    </p>
                  )}
                </article>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : (
        <>
          {detail.isDeliveredToCustomer ? (
            <section className="rounded-lg border border-border/40 bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium">Hazırlanan Başvuru Dosyanız</h2>
                {detail.deliveredToCustomerAt ? (
                  <span className="text-xs text-muted-foreground">
                    İletim: {timeAgo(detail.deliveredToCustomerAt)}
                  </span>
                ) : null}
              </div>

              {deliveredFiles.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Hazırlanan dosyalar için indirme listesi henüz oluşturulmadı.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border/40">
                  {deliveredFiles.map((file) => {
                    const downloadUrl = urlById.get(file.documentId) ?? null;
                    const fileName = deriveDownloadFileName(
                      file.fileUrl,
                      `${file.title}.pdf`,
                    );

                    return (
                      <li
                        key={`${file.cardType}-${file.documentId}`}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{file.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {FILE_TYPE_LABEL[file.fileType]}
                          </p>
                        </div>

                        {downloadUrl ? (
                          <ForceDownloadButton
                            url={downloadUrl}
                            filename={fileName}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            İndirilemedi
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {canEditForm ? (
            canUpload ? (
              <CustomerPersonUploadPanel
                applicationId={detail.id}
                applicants={personBasedUploadApplicants}
                allowedTypes={customerAllowedTypes}
                optionalTypes={customerOptionalTypes}
                documentOptions={customerDocumentOptions}
              />
            ) : (
              <section className="rounded-lg border border-border/40 bg-card p-4 shadow-sm sm:p-5">
                <h2 className="text-sm font-medium">Belgelerinizi Kontrol İçin Yükleyin</h2>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  Başvurunuz operasyon sürecine alındığında evrak yükleme alanı açılacaktır.
                </p>
              </section>
            )
          ) : null}

          <section className="rounded-lg border border-border/40 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Belgeleriniz</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {visibleDocuments.length} belge
          </span>
        </div>

        {visibleDocuments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {canUpload
              ? "Henüz belge yok. Başlamak için yukarıdan pasaportunuzu yükleyin."
              : canEditForm
                ? "Başvurunuz operasyon sürecine alındığında evrak yükleme alanı açılacaktır."
                : "Bu başvuru için henüz belge bulunmuyor."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/40">
            {visibleDocuments.map((document) => {
              const url = urlById.get(document.id) ?? null;
              const ocr = document.ocrStatus
                ? OCR_BADGE[document.ocrStatus]
                : null;
              return (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {getCustomerDocumentLabel(document)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[11px]",
                            document.isApproved
                              ? INTENT_CLASSES.success
                              : document.rejectionReason
                                ? INTENT_CLASSES.danger
                                : INTENT_CLASSES.warning,
                          )}
                        >
                          {document.isApproved
                            ? "Belge Uygun"
                            : document.rejectionReason
                              ? "Reddedildi"
                              : "İnceleme bekliyor"}
                        </Badge>
                        {ocr ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-[11px]",
                              INTENT_CLASSES[ocr.intent],
                            )}
                          >
                            {ocr.label}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Yüklendi: {timeAgo(document.createdAt)}
                      </div>
                      {document.rejectionReason ? (
                        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                          Reddedildi: {document.rejectionReason} — lütfen yukarıdan
                          yeni bir dosya yükleyin.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Detayları Görüntüle
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Kullanılamıyor
                      </span>
                    )}
                    {!document.isApproved ? (
                      <DeleteDocumentButton documentId={document.id} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
          </section>
        </>
      )}
    </div>
  );
}

