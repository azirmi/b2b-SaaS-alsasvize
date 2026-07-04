"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}: {
  applicationId: string;
  defaultType?: FileType;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState<FileType>(defaultType);
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
      <div className="space-y-1.5 sm:max-w-56">
        <Label htmlFor="doc-type">Document type</Label>
        <Select
          value={fileType}
          onValueChange={(value) => setFileType(value as FileType)}
        >
          <SelectTrigger id="doc-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(FileType).map((type) => (
              <SelectItem key={type} value={type}>
                {FILE_TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
