import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { DocumentUploader } from "@/components/documents/document-uploader";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { OcrStatus, VisaStage } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import { FILE_TYPE_LABEL, INTENT_CLASSES, type Intent } from "@/lib/status";
import type { DownloadUrlResponse, VisaApplicationDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Customer-facing, plain-language status for each pipeline stage. */
const STAGE_MESSAGE: Record<VisaStage, string> = {
  SALES_POOL: "Received — waiting to be picked up by our Sales team.",
  SALES_PROCESS: "Your application is being prepared by our Sales team.",
  DOC_POOL: "Queued for document review.",
  DOC_PROCESS: "Our Documents team is reviewing your files.",
  SEC_POOL: "Queued for final processing.",
  SEC_PROCESS: "Final processing by our Secretary team.",
  COMPLETED: "Your application is complete.",
  PAUSED: "Your application is temporarily on hold.",
  CANCELLED: "This application has been cancelled.",
};

const OCR_BADGE: Record<OcrStatus, { label: string; intent: Intent }> = {
  PENDING: { label: "OCR pending", intent: "neutral" },
  PROCESSED: { label: "OCR read", intent: "success" },
  FAILED: { label: "OCR failed", intent: "danger" },
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
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
}: {
  applicationId: string;
}) {
  let detail: VisaApplicationDetail | null = null;
  let forbidden = false;
  let loadError = false;
  try {
    detail = await serverApi.get<VisaApplicationDetail>(
      `/applications/${applicationId}`,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      forbidden = true;
    } else {
      loadError = true;
    }
  }

  if (forbidden) {
    return (
      <Notice
        title="Not available"
        body="This application isn’t associated with your account."
      />
    );
  }
  if (loadError || !detail) {
    return (
      <Notice
        title="Unable to load application"
        body="Something went wrong reaching the service. Please try again in a moment."
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your application
            </h1>
            <StageBadge stage={stage} />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {STAGE_MESSAGE[stage]}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {detail.id}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Opened {timeAgo(detail.createdAt)} ago</div>
        </div>
      </div>

      {canUpload ? (
        <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium">Upload a document</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your passport and any documents our team requests. Files upload
            securely, straight to storage.
          </p>
          <Separator className="my-4" />
          <DocumentUploader applicationId={detail.id} />
        </section>
      ) : null}

      <section className="rounded-lg border border-border/40 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Your documents</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail.documents.length} file
            {detail.documents.length === 1 ? "" : "s"}
          </span>
        </div>

        {detail.documents.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No documents yet. Upload your passport above to get started.
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
                              : INTENT_CLASSES.warning,
                          )}
                        >
                          {document.isApproved ? "Approved" : "Pending review"}
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
                        Uploaded {timeAgo(document.createdAt)} ago
                      </div>
                    </div>
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Unavailable
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
