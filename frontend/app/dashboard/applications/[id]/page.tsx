import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText } from "lucide-react";

import { AdminActions } from "@/components/applications/admin-actions";
import { ApplicationDetailsView } from "@/components/applications/application-details-view";
import { CrmForm } from "@/components/applications/crm-form";
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

/** Document types DOC staff prepare and upload during Document Review. */
const DOC_UPLOAD_TYPES: FileType[] = [
  FileType.FLIGHT_HOTEL_RESERVATION,
  FileType.LETTER_OF_INTENT,
  FileType.TRAVEL_PLAN,
  FileType.HEALTH_INSURANCE,
  FileType.APPOINTMENT_CONFIRMATION,
];

function isStage(value: unknown): value is VisaStage {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STAGE_LABEL, value)
  );
}

/** "STAGE_CHANGED" -> "Stage changed". */
function humanizeAction(action: string): string {
  const lower = action.replaceAll("_", " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
        <span className="text-sm text-muted-foreground">Unassigned</span>
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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/workspace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        My workspace
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
        title="Application not found"
        body="This application no longer exists or the link is out of date. Head back to your workspace to see current applications."
      />
    );
  }
  if (forbidden) {
    return (
      <Notice
        title="Not available"
        body="This application is not assigned to you and is not sitting in your department pool."
      />
    );
  }
  if (loadError || !detail) {
    return (
      <Notice
        title="Unable to load application"
        body="Something went wrong reaching the service. It will be available again once the service is reachable."
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
  const approvedDocs = detail.documents.filter((d) => d.isApproved).length;
  const rejectedDocs = detail.documents.filter(
    (d) => !d.isApproved && d.rejectionReason,
  ).length;
  const unapprovedDocs = detail.documents.length - approvedDocs;
  const advanceBlockedByDocs =
    stage === VisaStage.DOC_PROCESS &&
    (detail.documents.length === 0 || unapprovedDocs > 0);

  const crm = detail.crmData ?? null;
  const crmComplete = isCrmComplete(crm);
  const advanceBlockedByCrm = stage === VisaStage.SALES_PROCESS && !crmComplete;

  // Read-only context for the CRM form, pulled from the customer's own records.
  const crmTargetCountry = detail.customer.targetCountry ?? "";
  const crmPhone = detail.details?.phone ?? detail.customer.phone ?? "";
  const crmTravelDate = detail.details?.plannedTravelDates ?? "";

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
  const advanceProp =
    advanceCfg && (isAdmin || isCurrentStageOwner)
      ? {
          label: advanceCfg.label,
          disabled: advanceDisabled,
          hint: advanceBlockedByCrm
            ? "Complete and save the CRM data entry before sending to Documents."
            : advanceBlockedByDocs
              ? detail.documents.length === 0
                ? "At least one approved document is required before sending to Secretary."
                : `All documents must be approved — ${unapprovedDocs} still ${unapprovedDocs === 1 ? "needs" : "need"} approval.`
              : undefined,
        }
      : undefined;
  const canPause = PROCESS_STAGES.has(stage) && (isAdmin || isAssignedToMe);
  const canResume = stage === VisaStage.PAUSED && (isAdmin || isAssignedToMe);

  const canIssueVisaGrant =
    stage === VisaStage.SEC_PROCESS &&
    (isAdmin || detail.assignedSec?.user.id === session.userId);

  const canDocUpload =
    stage === VisaStage.DOC_PROCESS &&
    (isAdmin || detail.assignedDoc?.user.id === session.userId);

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
        My workspace
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.customer.fullName}
            </h1>
            <StageBadge stage={stage} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {detail.customer.email} · {detail.id}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Opened {timeAgo(detail.createdAt)} ago</div>
          <div>In stage {timeAgo(detail.stageUpdatedAt)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Workflow</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Current stage: {STAGE_LABEL[stage]}
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
                <h2 className="text-sm font-medium">CRM · Sales data entry</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[11px]",
                    crmComplete
                      ? INTENT_CLASSES.success
                      : INTENT_CLASSES.warning,
                  )}
                >
                  {crmComplete ? "Complete" : "Incomplete"}
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
                  <CrmField label="İkamet şehri" value={crm.residenceCity} />
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
                      <dt className="text-xs text-muted-foreground">Dekont</dt>
                      <dd className="text-sm">
                        {urlById.get(crm.receiptFileId) ? (
                          <a
                            href={urlById.get(crm.receiptFileId)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                          >
                            Görüntüle
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
            </TabsList>

          <TabsContent value="form">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Başvuru Formu</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Customer-submitted application form — read-only.
            </p>
            <Separator className="my-4" />
            {detail.details ? (
              <ApplicationDetailsView details={detail.details} />
            ) : (
              <p className="text-sm text-muted-foreground">
                The customer has not submitted the application form yet.
              </p>
            )}
          </section>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Documents</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {detail.documents.length} file
                {detail.documents.length === 1 ? "" : "s"}
                {pendingDocs > 0 ? ` · ${pendingDocs} pending` : ""}
                {rejectedDocs > 0 ? ` · ${rejectedDocs} rejected` : ""}
              </span>
            </div>

            {detail.documents.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                The customer has not uploaded any documents yet.
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
                                ? "Approved"
                                : document.rejectionReason
                                  ? "Rejected"
                                  : "Pending"}
                            </Badge>
                          </div>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            >
                              Open original
                            </a>
                          ) : (
                            <span className="block text-xs text-muted-foreground">
                              Preview unavailable
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

          {canDocUpload ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Staff Uploads</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hazırladığınız belgeleri yükleyin — uçuş/otel rezervasyonu,
                niyet mektubu, seyahat planı, sağlık sigortası ve randevu teyidi.
              </p>
              <Separator className="my-4" />
              <DocumentUploader
                applicationId={detail.id}
                defaultType={FileType.FLIGHT_HOTEL_RESERVATION}
                allowedTypes={DOC_UPLOAD_TYPES}
              />
            </section>
          ) : null}

          {canDocUpload && crm && crm.paymentType === "PREPAID" ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Kalan Ödeme</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Randevu alındıktan sonra kalan ödemeyi tahsil edin ve dekontunu
                yükleyin.
              </p>
              <Separator className="my-4" />

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

              <Separator className="my-4" />

              {finalReceipt ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background px-3 py-2.5">
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
                      Görüntüle
                    </a>
                  ) : null}
                </div>
              ) : null}

              <DocumentUploader
                applicationId={detail.id}
                defaultType={FileType.FINAL_RECEIPT}
                allowedTypes={[FileType.FINAL_RECEIPT]}
              />
            </section>
          ) : null}

          {canIssueVisaGrant ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Issue visa grant</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload the approved visa grant document — the customer will see
                it in their application.
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
          </Tabs>

          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Activity</h2>
            {detail.auditLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {detail.auditLogs.map((log) => {
                  const change = stageChangeText(log.details);
                  return (
                    <li
                      key={log.id}
                      className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium">
                          {humanizeAction(log.actionType)}
                        </span>
                        {change ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {change}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {timeAgo(log.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Applicant</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="text-sm">{detail.customer.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-mono text-sm break-all">
                  {detail.customer.email}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium">Assignments</h2>
            <div className="mt-4 space-y-3">
              <AssignmentRow label="Sales" staff={detail.assignedSales} />
              <AssignmentRow label="Documents" staff={detail.assignedDoc} />
              <AssignmentRow label="Secretary" staff={detail.assignedSec} />
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
