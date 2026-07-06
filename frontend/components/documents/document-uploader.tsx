"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requestDocumentUpload } from "@/lib/actions/documents";
import { FileType } from "@/lib/enums";
import { FILE_TYPE_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const ACCEPT_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Document types a customer can upload (the visa grant is issued by staff). */
export const CUSTOMER_DOCUMENT_TYPES: FileType[] = [
  FileType.PASSPORT,
  FileType.BANK_STATEMENT,
  FileType.INTENT_LETTER,
  FileType.CONSULATE_FORM,
  FileType.OTHER,
];

/** Per-type preparation guidance shown above the upload area (placeholder copy). */
const DOCUMENT_INSTRUCTIONS: Record<FileType, string> = {
  PASSPORT:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  BANK_STATEMENT:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate.",
  INTENT_LETTER:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
  CONSULATE_FORM:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error.",
  VISA_GRANT:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore.",
  PAYMENT_RECEIPT:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt.",
  OTHER:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Customer document uploader. Two hops, zero API payload: a server action mints a
 * presigned URL (and creates the Document record), then the browser PUTs the raw
 * bytes straight to storage. On success the page is refreshed to show the new
 * pending document.
 */
export function DocumentUploader({
  applicationId,
  defaultType = FileType.PASSPORT,
  allowedTypes = CUSTOMER_DOCUMENT_TYPES,
}: {
  applicationId: string;
  defaultType?: FileType;
  allowedTypes?: FileType[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialType = allowedTypes.includes(defaultType)
    ? defaultType
    : allowedTypes[0];
  const [fileType, setFileType] = useState<FileType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPT_SET.has(next.type)) {
      setError("Unsupported file type. Use JPG, PNG, WebP, or PDF.");
      return;
    }
    if (next.size > MAX_SIZE) {
      setError("File exceeds the 10 MB limit.");
      return;
    }
    setFile(next);
  }

  function clearFile() {
    selectFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function upload() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const ticket = await requestDocumentUpload(applicationId, fileType, file.name);
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }
      try {
        const response = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: file,
        });
        if (!response.ok) {
          setError("Upload to storage failed. Please retry.");
          return;
        }
      } catch {
        setError("Could not reach storage. Please retry.");
        return;
      }
      clearFile();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Belge türünü seçin</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {allowedTypes.map((type) => {
            const active = type === fileType;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setFileType(type)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-foreground/40 bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                    active
                      ? "border-foreground/30 bg-background text-foreground"
                      : "border-border/60 bg-muted text-muted-foreground",
                  )}
                >
                  {active ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 font-medium">
                  {FILE_TYPE_LABEL[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {FILE_TYPE_LABEL[fileType]} · Hazırlama Talimatı
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {DOCUMENT_INSTRUCTIONS[fileType]}
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) selectFile(dropped);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          dragActive
            ? "border-foreground/40 bg-muted"
            : "border-border hover:bg-muted/50",
        )}
      >
        <FileUp className="h-5 w-5 text-muted-foreground" aria-hidden />
        {file ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {humanSize(file.size)}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearFile();
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-medium">Drag a file here</span> or click to
              browse
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP, or PDF · up to 10 MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <Button size="sm" onClick={upload} disabled={!file || pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>
    </div>
  );
}

