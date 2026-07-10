import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { ApplicationDetailsView } from "@/components/applications/application-details-view";
import { ApplicationForm } from "@/components/applications/application-form";
import {
  DocumentUploader,
  type UploadDocumentOption,
} from "@/components/documents/document-uploader";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { FileType, OcrStatus, VisaStage } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import { FILE_TYPE_LABEL, INTENT_CLASSES, type Intent } from "@/lib/status";
import type { DownloadUrlResponse, VisaApplicationDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Customer-facing, plain-language status for each pipeline stage. */
const STAGE_MESSAGE: Record<VisaStage, string> = {
  SALES_POOL: "Alındı. Satış ekibimizin başvuruyu üstlenmesi bekleniyor.",
  SALES_PROCESS: "Başvurunuz satış ekibimiz tarafından hazırlanıyor.",
  DOC_POOL: "Belge inceleme kuyruğunda bekliyor.",
  DOC_PROCESS: "Belgeleriniz evrak ekibimiz tarafından inceleniyor.",
  SEC_POOL: "Son işlem kuyruğunda bekliyor.",
  SEC_PROCESS: "Başvurunuz son işlem aşamasında değerlendiriliyor.",
  COMPLETED: "Başvurunuz tamamlandı.",
  PAUSED: "Başvurunuz geçici olarak duraklatıldı.",
  CANCELLED: "Bu başvuru iptal edildi.",
};

const OCR_BADGE: Record<OcrStatus, { label: string; intent: Intent }> = {
  PENDING: { label: "OCR bekliyor", intent: "neutral" },
  PROCESSED: { label: "OCR okundu", intent: "success" },
  FAILED: { label: "OCR başarısız", intent: "danger" },
};

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
      "E-Devlet veya nüfus müdürlüğünden alınmış güncel tam tekmil vukuatlı nüfus kayıt örneğini PDF olarak yükleyin.",
  },
  {
    id: "bank-statement-main",
    category: "Finansal Belgeler",
    label: "Banka Hesap Dökümü",
    fileType: FileType.BANK_STATEMENT,
    description:
      "Son 3 aya ait kaşeli-imzalı banka hesap dökümünü yükleyin. Hesap hareketleri, bakiye ve ad-soyad bilgileri net görünmelidir.",
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
    id: "intent-letter",
    category: "Satın alınmış seyahat belgeleri",
    label: "Niyet Mektubu",
    fileType: FileType.INTENT_LETTER,
    description:
      "Seyahat amacınızı, planınızı ve geri dönüş niyetinizi açıklayan imzalı niyet mektubunu yükleyin.",
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
    fileType: FileType.LETTER_OF_INTENT,
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
      "E-Devlet üzerinden alınmış güncel SGK hizmet dökümünü PDF formatında yükleyin.",
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
    fileType: FileType.INTENT_LETTER,
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
    fileType: FileType.LETTER_OF_INTENT,
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
    id: "rejected-new-intent",
    category: "Ret sonrası",
    label: "Güncel Niyet Mektubu",
    fileType: FileType.INTENT_LETTER,
    description:
      "Ret sonrası yeni başvuruda, önceki red gerekçelerini ele alan güncel niyet mektubunu yükleyin.",
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
  const employmentStatus =
    detail.details?.employmentStatus?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const occupation =
    detail.details?.occupation?.trim().toLocaleLowerCase("tr-TR") ?? "";

  return (
    Boolean(detail.details?.isEmployer) ||
    employmentStatus === "işveren" ||
    occupation.includes("şirket") ||
    occupation.includes("işveren") ||
    occupation.includes("esnaf")
  );
}

function hasSpecialProfile(detail: VisaApplicationDetail): boolean {
  const employmentStatus =
    detail.details?.employmentStatus?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const occupation =
    detail.details?.occupation?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const dob = detail.details?.dateOfBirth;

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
  const options: UploadDocumentOption[] = [...BASE_DOCUMENT_OPTIONS];

  if (hasCompanyOwnerProfile(detail)) {
    options.push(...EMPLOYER_DOCUMENT_OPTIONS);
  } else if (hasSpecialProfile(detail)) {
    options.push(...SPECIAL_STATUS_DOCUMENT_OPTIONS);
  } else {
    options.push(...EMPLOYEE_DOCUMENT_OPTIONS);
  }

  if (detail.details?.hasSponsor) {
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
}: {
  applicationId: string;
  view?: "documents" | "form";
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

  const stage = detail.currentStage;
  const canUpload =
    stage !== VisaStage.COMPLETED && stage !== VisaStage.CANCELLED;
  const isPrepaid = detail.crmData?.paymentType === "PREPAID";
  const hasAppointmentDate = Boolean(detail.crmData?.appointmentDate);
  const hasAppointmentConfirmation = detail.documents.some(
    (document) => document.fileType === FileType.APPOINTMENT_CONFIRMATION,
  );
  const customerPrepaidLocked =
    isPrepaid && (!hasAppointmentDate || !hasAppointmentConfirmation);
  const showingForm = view === "form";
  const customerDocumentOptions = buildCustomerDocumentOptions(detail);

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
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Başvurunuz
            </h1>
            <StageBadge stage={stage} customerView />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {STAGE_MESSAGE[stage]}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {detail.id}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Açılış: {timeAgo(detail.createdAt)}</div>
        </div>
      </div>

      {showingForm ? (
        <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium">Başvuru Formu</h2>
          {canUpload ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Schengen başvuru formunu aşağıdaki alandan doldurup kaydedin.
              </p>
              <Separator className="my-4" />
              <ApplicationForm
                applicationId={detail.id}
                details={detail.details}
                targetCountry={detail.customer.targetCountry}
              />
            </>
          ) : detail.details ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu başvuru kapandığı için form düzenlenemez. Kaydedilen bilgiler
                aşağıda gösteriliyor.
              </p>
              <Separator className="my-4" />
              <ApplicationDetailsView details={detail.details} />
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Bu başvuru için henüz başvuru formu kaydı bulunmuyor.
            </p>
          )}
        </section>
      ) : (
        <>
          {canUpload ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Belge Yükle</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {customerPrepaidLocked
                  ? "Ön ödemeli başvuruda randevu kesinleşene kadar yalnızca pasaport yükleyebilirsiniz."
                  : "Pasaportunuzu ve ekibimizin talep ettiği belgeleri yükleyin. Dosyalar güvenli şekilde doğrudan depolama alanına gönderilir."}
              </p>
              <Separator className="my-4" />
              <DocumentUploader
                applicationId={detail.id}
                defaultType={FileType.PASSPORT}
                allowedTypes={
                  customerPrepaidLocked ? [FileType.PASSPORT] : undefined
                }
                documentOptions={customerDocumentOptions}
              />
            </section>
          ) : null}

          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Belgeleriniz</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail.documents.length} belge
          </span>
        </div>

        {detail.documents.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Henüz belge yok. Başlamak için yukarıdan pasaportunuzu yükleyin.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/40">
            {detail.documents.map((document) => {
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
                          {FILE_TYPE_LABEL[document.fileType]}
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
                            ? "Onaylandı"
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
                        Görüntüle
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
