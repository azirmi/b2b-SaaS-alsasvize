import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText, History } from "lucide-react";

import { AdminActions } from "@/components/applications/admin-actions";
import { ApplicationDetailsView } from "@/components/applications/application-details-view";
import { AppointmentOpsForm } from "@/components/applications/appointment-ops-form";
import { CrmForm } from "@/components/applications/crm-form";
import { DocAssistantDashboard } from "@/components/applications/doc-assistant-dashboard";
import { CustomerApplicationDetail } from "@/components/applications/customer-application-detail";
import { DocumentReviewActions } from "@/components/applications/document-review-actions";
import { StageActions } from "@/components/applications/stage-actions";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { getSession, serverApi } from "@/lib/api.server";
import { isCrmComplete, formatTl, PAYMENT_TYPE_LABEL } from "@/lib/crm";
import { Department, FileType, Role, VisaStage } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import {
  FILE_TYPE_LABEL,
  INTENT_CLASSES,
  STAGE_ADVANCE,
  STAGE_LABEL,
} from "@/lib/status";
import type {
  DownloadUrlResponse,
  LinkedActiveApplication,
  StaffOption,
  StaffProfile,
  VisaApplicationDetail,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Stages that are actively worked (pausable, and the only stages that advance). */
const PROCESS_STAGES = new Set<VisaStage>([
  VisaStage.SALES_PROCESS,
  VisaStage.DOC_PROCESS,
  VisaStage.SEC_PROCESS,
]);

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i;

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Oluşturuldu",
  CLAIMED: "Alındı",
  STAGE_CHANGED: "Aşama değiştirildi",
  FORCE_REASSIGNED: "Zorla yeniden atandı",
  FORCE_CANCELLED: "Zorla iptal edildi",
  PAUSED: "Duraklatıldı",
  RESUMED: "Devam ettirildi",
  SLA_BREACH: "SLA ihlali",
  CRM_UPDATED: "CRM güncellendi",
  DETAILS_UPDATED: "Başvuru formu güncellendi",
  DOCUMENT_APPROVED: "Belge onaylandı",
  DOCUMENT_REJECTED: "Belge reddedildi",
  DOC_ASSISTANT_ITEM_INITIALIZED: "Dosya asistanı kaydı oluşturuldu",
  DOC_ASSISTANT_STATUS_UPDATED: "Dosya asistanı durumu güncellendi",
  DIJIZIN_KVKK_SMS_SENT: "Dijizin KVKK SMS gönderildi",
  DIJIZIN_FORM_SENT: "Dijizin formu gönderildi",
  DIJIZIN_KVKK_VERIFIED: "Dijizin KVKK doğrulandı",
};

function isStage(value: unknown): value is VisaStage {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STAGE_LABEL, value)
  );
}

/** "STAGE_CHANGED" -> "Stage changed". */
function humanizeAction(action: string): string {
  if (ACTION_LABEL[action]) {
    return ACTION_LABEL[action];
  }
  return action.replaceAll("_", " ");
}

/** Renders the prev -> new stage snapshot from an audit entry's details, if present. */
function stageChangeText(details: Record<string, unknown> | null): string | null {
  if (!details) {
    return null;
  }
  const { previousStage, newStage } = details;
  if (isStage(previousStage) && isStage(newStage)) {
    return `${STAGE_LABEL[previousStage]} → ${STAGE_LABEL[newStage]}`;
  }
  return isStage(newStage) ? STAGE_LABEL[newStage] : null;
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("tr-TR");
  }

  return value;
}

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) {
    return "";
  }
  return `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
}

function AssignmentRow({
  label,
  staff,
}: {
  label: string;
  staff: StaffProfile | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {staff ? (
        <span className="text-sm">{staff.user.fullName}</span>
      ) : (
        <span className="text-sm text-muted-foreground">Atanmadı</span>
      )}
    </div>
  );
}

function CrmField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function Notice({
  title,
  body,
  backLabel,
}: {
  title: string;
  body: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/workspace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
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

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === Role.CUSTOMER) {
    return (
      <CustomerApplicationDetail
        applicationId={id}
        view={query.view === "form" ? "form" : "documents"}
      />
    );
  }

  const workspaceLabel =
    session.role === Role.ADMIN ? "Atanan Dosyalarım" : "Atanan Başvurularım";

  let detail: VisaApplicationDetail | null = null;
  let missing = false;
  let forbidden = false;
  let loadError = false;
  try {
    detail = await serverApi.get<VisaApplicationDetail>(`/applications/${id}`);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      // Stale/removed application or a malformed id: show an in-shell notice
      // rather than hard-calling notFound(), which drops the dashboard chrome
      // and makes it look like the route itself is broken.
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
        body="Bu başvuru artık mevcut değil veya bağlantı güncel değil. Güncel başvurular için çalışma alanınıza dönün."
        backLabel={workspaceLabel}
      />
    );
  }
  if (forbidden) {
    return (
      <Notice
        title="Erişim yok"
        body="Bu başvuru size atanmamış ve birim havuzunuzda bulunmuyor."
        backLabel={workspaceLabel}
      />
    );
  }
  if (loadError || !detail) {
    return (
      <Notice
        title="Başvuru yüklenemedi"
        body="Hizmete erişirken bir sorun oluştu. Hizmet tekrar erişilebilir olduğunda sayfa yenilenecektir."
        backLabel={workspaceLabel}
      />
    );
  }

  // Mint presigned download URLs for every document (5-min TTL, valid on load).
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

  const isAdmin = session.role === Role.ADMIN;
  const stage = detail.currentStage;
  const advanceCfg = STAGE_ADVANCE[stage];

  const isCurrentStageOwner =
    (stage === VisaStage.SALES_PROCESS &&
      detail.assignedSales?.user.id === session.userId) ||
    (stage === VisaStage.DOC_PROCESS &&
      detail.assignedDoc?.user.id === session.userId) ||
    (stage === VisaStage.SEC_PROCESS &&
      detail.assignedSec?.user.id === session.userId);

  const isAssignedToMe =
    detail.assignedSales?.user.id === session.userId ||
    detail.assignedDoc?.user.id === session.userId ||
    detail.assignedSec?.user.id === session.userId;

  const pendingDocs = detail.documents.filter(
    (d) => !d.isApproved && !d.rejectionReason,
  ).length;
  const rejectedDocs = detail.documents.filter(
    (d) => !d.isApproved && d.rejectionReason,
  ).length;
  const checklist = detail.docChecklist;
  const missingRequiredLabels = checklist.missingTypes.map(
    (type) => FILE_TYPE_LABEL[type],
  );
  const pendingRequiredLabels = checklist.pendingApprovalTypes.map(
    (type) => FILE_TYPE_LABEL[type],
  );
  const advanceBlockedByDocs =
    stage === VisaStage.DOC_PROCESS &&
    (missingRequiredLabels.length > 0 || pendingRequiredLabels.length > 0);

  const crm = detail.crmData ?? null;
  const crmComplete = isCrmComplete(crm);
  const advanceBlockedByCrm =
    stage === VisaStage.SALES_PROCESS && !crmComplete;

  const appointmentCity =
    crm?.appointmentCity ?? detail.customer.appointmentCity ?? null;
  const appointmentDate = crm?.appointmentDate ?? null;

  // Read-only context for the CRM form, pulled from the customer's own records.
  const crmTargetCountry = detail.customer.targetCountry ?? "";
  const crmPhone = detail.details?.phone ?? detail.customer.phone ?? "";
  const crmTravelDateStart =
    detail.salesReadonlyData?.travelStartDate ??
    detail.details?.travelStartDate ??
    detail.salesReadonlyData?.plannedTravelStartDate ??
    detail.details?.plannedTravelStartDate ??
    "";
  const crmTravelDateEnd =
    detail.salesReadonlyData?.travelEndDate ??
    detail.details?.travelEndDate ??
    detail.salesReadonlyData?.plannedTravelEndDate ??
    detail.details?.plannedTravelEndDate ??
    "";
  const crmTravelDate = formatDateRange(crmTravelDateStart, crmTravelDateEnd);
  const customerResidenceCity =
    detail.salesReadonlyData?.residenceCity ??
    detail.details?.residenceCity ??
    detail.customer.residenceCity ??
    "";

  // Finance (DOC): remaining balance on a prepaid plan + any final receipt.
  const crmRemaining =
    crm && crm.paymentType === "PREPAID"
      ? crm.totalAmount - (crm.upfrontPaid ?? 0)
      : null;
  const finalReceipt =
    detail.documents.find((d) => d.fileType === FileType.FINAL_RECEIPT) ?? null;
  const advanceDisabled = advanceBlockedByDocs || advanceBlockedByCrm;
  const canEditCrm =
    stage === VisaStage.SALES_PROCESS && (isAdmin || isCurrentStageOwner);

  const canReviewDocs =
    stage === VisaStage.DOC_PROCESS && (session.role === Role.DOC || isAdmin);
  const canDocUpload =
    stage === VisaStage.DOC_PROCESS &&
    (isAdmin || detail.assignedDoc?.user.id === session.userId);
  const isSales = session.role === Role.SALES;
  const canUseDocWorkspace = canDocUpload;

  let linkedApplications: LinkedActiveApplication[] = [];
  if (canUseDocWorkspace) {
    try {
      linkedApplications = await serverApi.get<LinkedActiveApplication[]>(
        `/applications/${detail.id}/linked-active`,
      );
    } catch {
      linkedApplications = [];
    }
  }

  const appointmentConfirmationDocuments = detail.documents
    .filter((document) => document.fileType === FileType.APPOINTMENT_CONFIRMATION)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((document) => ({
      id: document.id,
      createdAt: document.createdAt,
    }));
  const visaFeeReceiptDocuments = detail.documents
    .filter((document) => document.fileType === FileType.VISA_FEE_RECEIPT)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((document) => ({
      id: document.id,
      createdAt: document.createdAt,
    }));

  const docAdvanceHintParts: string[] = [];
  if (missingRequiredLabels.length > 0) {
    docAdvanceHintParts.push(`Eksik Alanlar: ${missingRequiredLabels.join(", ")}`);
  }
  if (pendingRequiredLabels.length > 0) {
    docAdvanceHintParts.push(
      `Onay Bekleyen Alanlar: ${pendingRequiredLabels.join(", ")}`,
    );
  }
  const docAdvanceHint = docAdvanceHintParts.join(" · ");

  const advanceProp =
    advanceCfg && (isAdmin || isCurrentStageOwner)
      ? {
          label: advanceCfg.label,
          disabled: advanceDisabled,
          hint: advanceBlockedByCrm
            ? "Evrak aşamasına geçmeden önce CRM verilerini eksiksiz doldurup kaydedin."
            : advanceBlockedByDocs
              ? docAdvanceHint
              : undefined,
        }
      : undefined;
  const canPause = PROCESS_STAGES.has(stage) && (isAdmin || isAssignedToMe);
  const canResume = stage === VisaStage.PAUSED && (isAdmin || isAssignedToMe);

  const canIssueVisaGrant =
    stage === VisaStage.SEC_PROCESS &&
    (isAdmin || detail.assignedSec?.user.id === session.userId);


  // Admin God-Mode: staff options for the reassign picker.
  let staffOptions: StaffOption[] = [];
  if (isAdmin) {
    try {
      const users = await serverApi.get<
        {
          fullName: string;
          staffProfile: { id: string; department: Department } | null;
        }[]
      >("/users");
      staffOptions = users
        .filter((u) => u.staffProfile)
        .map((u) => ({
          staffId: u.staffProfile!.id,
          fullName: u.fullName,
          department: u.staffProfile!.department,
        }));
    } catch {
      staffOptions = [];
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/workspace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {workspaceLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {isSales ? (
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Danışan Başvuru Detayı
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.customer.fullName}
            </h1>
            <StageBadge stage={stage} />
            <Badge variant="outline" className="rounded-md text-[11px]">
              {APPLICATION_TYPE_LABEL[detail.applicationType]}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {detail.customer.email}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Açılış: {timeAgo(detail.createdAt)}</div>
          <div>Aşamadaki Süre: {timeAgo(detail.stageUpdatedAt)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">İş Akışı</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mevcut süreç durumu: {STAGE_LABEL[stage]}
            </p>
            <Separator className="my-4" />
            <StageActions
              id={detail.id}
              advance={advanceProp}
              canPause={canPause}
              canResume={canResume}
            />
          </section>

          {canEditCrm || crm ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium">CRM · Satış Veri Girişi</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[11px]",
                    crmComplete
                      ? INTENT_CLASSES.success
                      : INTENT_CLASSES.warning,
                  )}
                >
                  {crmComplete ? "Tamamlandı" : "Eksik"}
                </Badge>
              </div>

              {canEditCrm ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Satış, ödeme ve dekont bilgilerini girin. Dosya Belgeler
                    aşamasına geçmeden önce bu alanlar zorunludur.
                  </p>
                  <Separator className="my-4" />
                  <CrmForm
                    applicationId={detail.id}
                    crm={crm}
                    targetCountry={crmTargetCountry}
                    phone={crmPhone}
                    travelDate={crmTravelDate}
                    residenceCity={customerResidenceCity}
                  />
                </>
              ) : crm ? (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CrmField
                    label="Satış tarihi"
                    value={
                      crm.salesDate
                        ? new Date(crm.salesDate).toLocaleDateString("tr-TR")
                        : "—"
                    }
                  />
                  <CrmField
                    label="İkamet şehri"
                    value={customerResidenceCity || "—"}
                  />
                  <CrmField
                    label="Ödeme türü"
                    value={PAYMENT_TYPE_LABEL[crm.paymentType]}
                  />
                  <CrmField
                    label="Toplam tutar"
                    value={formatTl(crm.totalAmount)}
                  />
                  {crm.paymentType === "PREPAID" ? (
                    <>
                      <CrmField
                        label="Ön ödeme"
                        value={formatTl(crm.upfrontPaid)}
                      />
                      <CrmField
                        label="Kalan bakiye"
                        value={formatTl(
                          crm.totalAmount - (crm.upfrontPaid ?? 0),
                        )}
                      />
                    </>
                  ) : null}
                  {crm.receiptFileId ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Ödeme Dekontu</dt>
                      <dd className="text-sm">
                        {urlById.get(crm.receiptFileId) ? (
                          <a
                            href={urlById.get(crm.receiptFileId)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            Detayları Görüntüle
                          </a>
                        ) : (
                          "Yüklü"
                        )}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </section>
          ) : null}

          <Tabs defaultValue="form" className="gap-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="form">
                <ClipboardList aria-hidden />
                Başvuru Formu
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText aria-hidden />
                Evrak Yükleme
              </TabsTrigger>
              <TabsTrigger value="activity">
                <History aria-hidden />
                Aktivite
              </TabsTrigger>
            </TabsList>

          <TabsContent value="form">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Başvuru Formu</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSales
                ? "Satış rolü yalnızca formun gönderim durumunu görebilir."
                : "Danışan tarafından gönderilen başvuru formu (salt okunur)."}
            </p>
            <Separator className="my-4" />
            {isSales ? (
              <div className="rounded-lg border border-border/40 bg-muted/40 p-4">
                <p className="text-sm font-medium">
                  {detail.applicationFormSubmitted
                    ? "Başvuru Formu Gönderildi"
                    : "Başvuru Formu Gönderilmedi"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Satış birimi için form içeriği gizlenmiştir.
                </p>
              </div>
            ) : detail.details ? (
              <ApplicationDetailsView details={detail.details} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Danışan henüz başvuru formunu göndermedi.
              </p>
            )}
          </section>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Belgeler</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {detail.documents.length} belge
                {pendingDocs > 0 ? ` · ${pendingDocs} bekleyen` : ""}
                {rejectedDocs > 0 ? ` · ${rejectedDocs} reddedilen` : ""}
              </span>
            </div>

            {stage === VisaStage.DOC_PROCESS &&
            (missingRequiredLabels.length > 0 || pendingRequiredLabels.length > 0) ? (
              <div className="mt-4 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400">
                {missingRequiredLabels.length > 0 ? (
                  <p>Eksik Alanlar: {missingRequiredLabels.join(", ")}</p>
                ) : null}
                {pendingRequiredLabels.length > 0 ? (
                  <p>Onay Bekleyen Alanlar: {pendingRequiredLabels.join(", ")}</p>
                ) : null}
              </div>
            ) : null}

            {detail.documents.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Danışan henüz herhangi bir belge yüklemedi.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {detail.documents.map((document) => {
                  const url = urlById.get(document.id) ?? null;
                  const isImage = IMAGE_RE.test(document.fileUrl);
                  return (
                    <li
                      key={document.id}
                      className="overflow-hidden rounded-lg border border-border/40 bg-background"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                        {url && isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={FILE_TYPE_LABEL[document.fileType]}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <FileText
                            className="h-8 w-8 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2 border-t border-border/40 p-3">
                        <div className="min-w-0 space-y-1">
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
                                ? "Belge Uygun"
                                : document.rejectionReason
                                  ? "Reddedildi"
                                  : "Bekliyor"}
                            </Badge>
                          </div>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            >
                              Dosyayı Aç
                            </a>
                          ) : (
                            <span className="block text-xs text-muted-foreground">
                              Önizleme yok
                            </span>
                          )}
                          {document.rejectionReason ? (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {document.rejectionReason}
                            </p>
                          ) : null}
                        </div>
                        {canReviewDocs ? (
                          <DocumentReviewActions
                            documentId={document.id}
                            isApproved={document.isApproved}
                            isRejected={Boolean(document.rejectionReason)}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {canUseDocWorkspace ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">DOC Çalışma Alanı</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Personel yüklemeleri, kalan ödeme ve randevu işlemlerini sekmeler
                üzerinden yönetin.
              </p>
              <Separator className="my-4" />

              <Tabs defaultValue="staff" className="gap-4">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="staff">Personel Yüklemeleri</TabsTrigger>
                  <TabsTrigger value="payment">Kalan Ödeme</TabsTrigger>
                  <TabsTrigger value="appointment">Randevu İşlemleri</TabsTrigger>
                </TabsList>

                <TabsContent value="staff" className="space-y-4">
                  <DocAssistantDashboard
                    applicationId={detail.id}
                    items={detail.docAssistantItems}
                    canEdit={canUseDocWorkspace}
                  />
                </TabsContent>

                <TabsContent value="payment" className="space-y-4">
                  {crm && crm.paymentType === "PREPAID" ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Randevu alındıktan sonra kalan ödemeyi tahsil edin ve
                        dekontunu yükleyin.
                      </p>

                      <div className="rounded-lg border border-border/40 bg-muted/40 p-4">
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          Kalan Bakiye
                        </p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                          {formatTl(crmRemaining)}
                        </p>
                        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-muted-foreground">Toplam</dt>
                            <dd className="text-sm tabular-nums">
                              {formatTl(crm.totalAmount)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-muted-foreground">Ön ödeme</dt>
                            <dd className="text-sm tabular-nums">
                              {formatTl(crm.upfrontPaid)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {finalReceipt ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background px-3 py-2.5">
                          <span className="flex min-w-0 items-center gap-2 text-sm">
                            <FileText
                              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                              aria-hidden
                            />
                            <span className="truncate font-medium">
                              Kalan ödeme dekontu yüklendi
                            </span>
                          </span>
                          {urlById.get(finalReceipt.id) ? (
                            <a
                              href={urlById.get(finalReceipt.id)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                            >
                              Detayları Görüntüle
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      <DocumentUploader
                        applicationId={detail.id}
                        defaultType={FileType.FINAL_RECEIPT}
                        allowedTypes={[FileType.FINAL_RECEIPT]}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Bu başvuru ön ödemeli değil. Kalan ödeme işlemi gerekmiyor.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="appointment" className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Randevu şehri ve tarih/saat bilgisini kaydedin, ülke kuralına
                    göre seyahat başlangıç tarihini güncelleyin.
                  </p>
                  <AppointmentOpsForm
                    applicationId={detail.id}
                    targetCountry={crmTargetCountry}
                    initialAppointmentCity={appointmentCity}
                    initialAppointmentDate={appointmentDate}
                    initialTravelDate={detail.details?.plannedTravelStartDate ?? null}
                    initialAppointmentNote={crm?.appointmentNote ?? null}
                    initialAppointmentExpense={crm?.appointmentExpense ?? null}
                    initialHasVisaFee={crm?.hasVisaFee ?? false}
                    initialVisaFeeAmount={crm?.visaFeeAmount ?? null}
                    initialVisaFeeReceiptDocumentId={
                      crm?.visaFeeReceiptDocumentId ?? null
                    }
                    linkedApplications={linkedApplications}
                    appointmentConfirmationDocuments={appointmentConfirmationDocuments}
                    visaFeeReceiptDocuments={visaFeeReceiptDocuments}
                  />
                </TabsContent>
              </Tabs>
            </section>
          ) : null}

          {canIssueVisaGrant ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Vize Sonuç Belgesi</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Onaylı vize sonuç belgesini yükleyin. Danışan bu belgeyi kendi
                başvuru ekranında görecektir.
              </p>
              <Separator className="my-4" />
              <DocumentUploader
                applicationId={detail.id}
                defaultType={FileType.VISA_GRANT}
                allowedTypes={[FileType.VISA_GRANT]}
              />
            </section>
          ) : null}
                </TabsContent>
                <TabsContent value="activity">
                  <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-medium">Aktivite</h2>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {detail.auditLogs.length} kayıt
                      </span>
                    </div>
                    {detail.auditLogs.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Henüz aktivite kaydı yok.
                      </p>
                    ) : (
                      <ol className="mt-4 space-y-2">
                        {detail.auditLogs.map((log) => {
                          const change = stageChangeText(log.details);
                          return (
                            <li
                              key={log.id}
                              className="rounded-md border border-border/40 bg-background px-3 py-2.5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">
                                    {humanizeAction(log.actionType)}
                                  </p>
                                  {change ? (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {change}
                                    </p>
                                  ) : null}
                                </div>
                                <Badge variant="outline" className="shrink-0 rounded-md text-[11px]">
                                  {timeAgo(log.createdAt)}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                </TabsContent>
              </Tabs>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Danışan Bilgileri</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Ad Soyad</dt>
                <dd className="text-sm">{detail.customer.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">E-posta</dt>
                <dd className="font-mono text-sm break-all">
                  {detail.customer.email}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Atamalar</h2>
            <div className="mt-4 space-y-3">
              <AssignmentRow label="Satış" staff={detail.assignedSales} />
              <AssignmentRow label="Evrak" staff={detail.assignedDoc} />
              <AssignmentRow label="Son İşlem" staff={detail.assignedSec} />
            </div>
          </section>

          {isAdmin ? (
            <AdminActions
              applicationId={detail.id}
              currentStage={stage}
              staff={staffOptions}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
