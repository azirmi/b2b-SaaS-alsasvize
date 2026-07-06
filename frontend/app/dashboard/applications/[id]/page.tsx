import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

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
import { ApiError } from "@/lib/api";
import { getSession, serverApi } from "@/lib/api.server";
import { isCrmComplete } from "@/lib/crm";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === Role.CUSTOMER) {
    return <CustomerApplicationDetail applicationId={id} />;
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

  const crm = detail.metadata?.crm ?? null;
  const crmComplete = isCrmComplete(crm);
  const advanceBlockedByCrm = stage === VisaStage.SALES_PROCESS && !crmComplete;
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
                    Capture the applicant&rsquo;s details and invoice. Every
                    field is required before the file can move to Documents.
                  </p>
                  <Separator className="my-4" />
                  <CrmForm applicationId={detail.id} crm={crm} />
                </>
              ) : crm ? (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CrmField
                    label="Applicant"
                    value={`${crm.firstName} ${crm.lastName}`}
                  />
                  <CrmField label="Passport ID" value={crm.passportId} mono />
                  <CrmField label="Target country" value={crm.targetCountry} />
                  <CrmField
                    label="Invoice total"
                    value={`${crm.currency} ${crm.totalCost.toLocaleString()}`}
                  />
                </dl>
              ) : null}
            </section>
          ) : null}

          {detail.details ? (
            <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Başvuru Formu</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Customer-submitted application form — read-only.
              </p>
              <Separator className="my-4" />
              <ApplicationDetailsView details={detail.details} />
            </section>
          ) : null}

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
