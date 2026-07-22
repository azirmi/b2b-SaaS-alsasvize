"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requestDocumentUpload } from "@/lib/actions/documents";
import { FileType } from "@/lib/enums";
import { FILE_TYPE_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const UPLOAD_LABEL_PREFIX = "__uplabel_";
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
  FileType.CONSULATE_FORM,
  FileType.OTHER,
];

/** Per-type fallback guidance used when a custom document catalog is not provided. */
const DOCUMENT_INSTRUCTIONS: Record<FileType, string> = {
  PASSPORT:
    "Pasaportunuzun fotoğraflı sayfasını tam ve net görünecek şekilde yükleyin. Parlama, kesik kenar veya bulanıklık olmamalıdır.",
  BANK_STATEMENT:
    "Son 3 aya ait kaşeli-imzalı veya barkodlu/QR kodlu banka hesap dökümünü yükleyin. Hesap hareketleri, bakiye ve ad-soyad bilgileri net görünmelidir. DİKKAT: Belgenin güncel olması için randevu gününe en fazla 3 gün kala yüklenmesi zorunludur.",
  INTENT_LETTER:
    "Seyahat amacınızı ve planlanan tarihleri açıklayan niyet mektubunu imzalı ve okunur şekilde yükleyin.",
  CONSULATE_FORM:
    "Konsolosluk başvuru formunu eksiksiz doldurup imzalı biçimde yükleyin.",
  VISA_GRANT:
    "Onaylı vize sonuç belgesini tek dosya halinde yükleyin. Belge numarası ve geçerlilik tarihleri net olmalıdır.",
  PAYMENT_RECEIPT:
    "Ödeme dekontunu yükleyin. Tutar, tarih ve alıcı bilgileri açıkça okunabilmelidir.",
  FLIGHT_HOTEL_RESERVATION:
    "Gidiş-dönüş uçuş ve konaklama rezervasyon belgelerini tek PDF veya okunur görseller halinde yükleyin.",
  LETTER_OF_INTENT:
    "Başvuru kapsamında talep edilen destekleyici niyet yazısını imzalı ve okunur şekilde yükleyin.",
  TRAVEL_PLAN:
    "Gün bazlı seyahat planını (şehir, tarih, amaç) içeren belgeyi yükleyin.",
  HEALTH_INSURANCE:
    "Seyahat süresini kapsayan sağlık sigortası poliçesini yükleyin.",
  APPOINTMENT_CONFIRMATION:
    "Randevu onay belgesini tarih ve saat bilgileri görünür olacak şekilde yükleyin.",
  VISA_FEE_RECEIPT:
    "Vize harcı ödeme dekontunu yükleyin. Tutar ve işlem tarihi görünür olmalıdır.",
  FINAL_RECEIPT:
    "Kalan ödeme dekontunu yükleyin. İşlem referans numarası görünür olmalıdır.",
  OTHER:
    "Yukarıdaki türlere girmeyen ek belgeleri yükleyin. Belge adı ve içeriği anlaşılır olmalıdır.",
};

export interface UploadDocumentOption {
  id: string;
  category: string;
  label: string;
  description: string;
  fileType: FileType;
  optional?: boolean;
  highlightNote?: string;
}

function toDefaultOption(
  fileType: FileType,
  optionalTypeSet: Set<FileType>,
): UploadDocumentOption {
  return {
    id: fileType,
    category: "Belgeler",
    label: FILE_TYPE_LABEL[fileType],
    description: DOCUMENT_INSTRUCTIONS[fileType],
    fileType,
    optional: optionalTypeSet.has(fileType),
  };
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function encodeUploadLabel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const bytes = new TextEncoder().encode(trimmed);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function withUploadLabelPrefix(fileName: string, uploadLabel: string): string {
  const encodedLabel = encodeUploadLabel(uploadLabel);
  if (!encodedLabel) {
    return fileName;
  }

  return `${UPLOAD_LABEL_PREFIX}${encodedLabel}__${fileName}`;
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
  optionalTypes = [],
  documentOptions,
}: {
  applicationId: string;
  defaultType?: FileType;
  allowedTypes?: FileType[];
  optionalTypes?: FileType[];
  documentOptions?: UploadDocumentOption[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const optionalTypeSet = useMemo(
    () => new Set(optionalTypes),
    [optionalTypes],
  );
  const allowedTypeSet = useMemo(
    () => new Set(allowedTypes),
    [allowedTypes],
  );

  const options = useMemo(() => {
    const source =
      documentOptions && documentOptions.length > 0
        ? documentOptions
        : allowedTypes.map((type) => toDefaultOption(type, optionalTypeSet));

    const filtered = source.filter((option) =>
      allowedTypeSet.has(option.fileType),
    );
    return filtered.length > 0
      ? filtered
      : allowedTypes.map((type) => toDefaultOption(type, optionalTypeSet));
  }, [allowedTypeSet, allowedTypes, documentOptions, optionalTypeSet]);

  const initialOptionId =
    options.find((option) => option.fileType === defaultType)?.id ?? options[0]?.id;
  const [selectedOptionId, setSelectedOptionId] = useState(initialOptionId);

  useEffect(() => {
    if (!options.some((option) => option.id === selectedOptionId) && options[0]) {
      setSelectedOptionId(options[0].id);
    }
  }, [options, selectedOptionId]);

  const selectedOption =
    options.find((option) => option.id === selectedOptionId) ?? options[0];

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, UploadDocumentOption[]>();
    for (const option of options) {
      const existing = groups.get(option.category);
      if (existing) {
        existing.push(option);
      } else {
        groups.set(option.category, [option]);
      }
    }
    return Array.from(groups.entries());
  }, [options]);

  function selectFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPT_SET.has(next.type)) {
      setError("Desteklenmeyen dosya türü. JPG, PNG, WebP veya PDF yükleyin.");
      return;
    }
    if (next.size > MAX_SIZE) {
      setError("Dosya 10 MB sınırını aşıyor.");
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
    if (!selectedOption) {
      setError("Lütfen önce yüklemek istediğiniz belgeyi seçin.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const ticket = await requestDocumentUpload(
        applicationId,
        selectedOption.fileType,
        withUploadLabelPrefix(file.name, selectedOption.label),
      );
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
          setError("Depolama alanına yükleme başarısız oldu. Lütfen tekrar deneyin.");
          return;
        }
      } catch {
        setError("Depolama hizmetine ulaşılamadı. Lütfen tekrar deneyin.");
        return;
      }
      clearFile();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Yüklemek İstediğiniz Belge Türünü Seçin</p>
        <div className="space-y-3">
          {groupedOptions.map(([category, categoryOptions]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {category}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categoryOptions.map((option) => {
                  const active = option.id === selectedOption?.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedOptionId(option.id)}
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
                      <span className="min-w-0">
                        <span className="block font-medium">{option.label}</span>
                        {option.optional ? (
                          <span className="text-[11px] text-muted-foreground">
                            Opsiyonel
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {selectedOption?.label ?? "Belge"} · Hazırlama talimatı
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {selectedOption?.description ?? "Belge talimatı bulunamadı."}
        </p>
        {selectedOption?.highlightNote ? (
          <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {selectedOption.highlightNote}
          </p>
        ) : null}
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
              aria-label="Dosyayı kaldır"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-medium">Dosyayı buraya sürükleyin</span> veya
              seçmek için tıklayın
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP veya PDF · en fazla 10 MB
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
        {pending ? "Yükleniyor…" : "Belgeyi Yükle"}
      </Button>
    </div>
  );
}

