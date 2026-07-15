"use client";

import { useState } from "react";

import { handleDownload } from "@/lib/download";
import { cn } from "@/lib/utils";

export function ForceDownloadButton({
  url,
  filename,
  className,
}: {
  url: string;
  filename: string;
  className?: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <button
      type="button"
      disabled={isDownloading}
      onClick={async () => {
        setIsDownloading(true);
        try {
          await handleDownload(url, filename);
        } finally {
          setIsDownloading(false);
        }
      }}
      className={cn(
        "inline-flex h-8 items-center rounded-md border border-border/60 px-3 text-xs font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {isDownloading ? "İndiriliyor…" : "İndir"}
    </button>
  );
}
