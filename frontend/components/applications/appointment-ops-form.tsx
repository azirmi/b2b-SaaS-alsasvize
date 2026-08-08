"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { saveAppointmentOps } from "@/lib/actions/applications";
import { requestDocumentUpload } from "@/lib/actions/documents";
import { APPLICATION_TYPE_LABEL } from "@/lib/application-type";
import { COUNTRY_RULES } from "@/lib/countries";
import { FileType } from "@/lib/enums";
import { maskDecimalInput, maskEnglishNoteInput } from "@/lib/input-masks";
import { STAGE_LABEL } from "@/lib/status";
import type { LinkedActiveApplication } from "@/lib/types";
import { withUploadLabelPrefix } from "@/lib/upload-label";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LocalizedDatePickerInput,
  LocalizedDateTimePickerInput,
} from "@/components/ui/localized-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const UPLOAD_ACCEPT_SET = new Set([
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
 * Compact inline dropzone for a single appointment document. The parent owns the
 * selected `File` so the same submit can upload it and clear it only after the
 * save is confirmed. Validation mirrors the storage limits.
 */
function AppointmentFileField({
  id,
  file,
  onSelect,
  disabled,
}: {
  id: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(next: File | null) {
    setError(null);
    if (!next) {
      onSelect(null);
      return;
    }
    if (!UPLOAD_ACCEPT_SET.has(next.type)) {
      setError("Desteklenmeyen dosya türü. JPG, PNG, WebP veya PDF yükleyin.");
      return;
    }
    if (next.size > MAX_UPLOAD_SIZE) {
      setError("Dosya 10 MB sınırını aşıyor.");
      return;
    }
    onSelect(next);
  }

  function clear() {
    pick(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragActive(false);
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) pick(dropped);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:bg-muted/50",
          dragActive ? "border-foreground/40 bg-muted" : "border-border",
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
                clear();
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
          id={id}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function extractIsoDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function toLocalDateTimeValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeLabel(iso: string | null): string {
  if (!iso) {
    return "Randevu tarihi henüz girilmedi";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Randevu tarihi henüz girilmedi";
  }
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIsoDateForUi(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }

  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function AppointmentOpsForm({
  applicationId,
  targetCountry,
  initialAppointmentCity,
  initialAppointmentDate,
  initialTravelDate,
  initialAppointmentNote,
  initialAppointmentExpense,
  initialHasVisaFee,
  initialVisaFeeAmount,
  initialVisaFeeReceiptDocumentId,
  linkedApplications = [],
  appointmentConfirmationDocuments = [],
  visaFeeReceiptDocuments = [],
}: {
  applicationId: string;
  targetCountry: string;
  initialAppointmentCity?: string | null;
  initialAppointmentDate?: string | null;
  initialTravelDate?: string | null;
  initialAppointmentNote?: string | null;
  initialAppointmentExpense?: number | null;
  initialHasVisaFee?: boolean;
  initialVisaFeeAmount?: number | null;
  initialVisaFeeReceiptDocumentId?: string | null;
  linkedApplications?: LinkedActiveApplication[];
  appointmentConfirmationDocuments?: Array<{ id: string; createdAt: string }>;
  visaFeeReceiptDocuments?: Array<{ id: string; createdAt: string }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmationFile, setConfirmationFile] = useState<File | null>(null);
  const [visaFeeFile, setVisaFeeFile] = useState<File | null>(null);
  const [fileResetKey, setFileResetKey] = useState(0);

  const countryRule = COUNTRY_RULES[targetCountry] ?? null;
  const allowedCities = countryRule?.cities ?? [];

  const [appointmentCity, setAppointmentCity] = useState(
    initialAppointmentCity && allowedCities.includes(initialAppointmentCity)
      ? initialAppointmentCity
      : allowedCities[0] ?? "",
  );
  const [appointmentDate, setAppointmentDate] = useState(
    toLocalDateTimeValue(initialAppointmentDate),
  );
  const [travelDate, setTravelDate] = useState(extractIsoDate(initialTravelDate));
  const [appointmentExpense, setAppointmentExpense] = useState(
    initialAppointmentExpense != null ? String(initialAppointmentExpense) : "",
  );
  const [note, setNote] = useState(initialAppointmentNote ?? "");
  const [hasVisaFee, setHasVisaFee] = useState(initialHasVisaFee === true);
  const [visaFeeAmount, setVisaFeeAmount] = useState(
    initialVisaFeeAmount != null ? String(initialVisaFeeAmount) : "",
  );
  const [visaFeeReceiptDocumentId, setVisaFeeReceiptDocumentId] = useState(
    initialVisaFeeReceiptDocumentId ?? visaFeeReceiptDocuments[0]?.id ?? "",
  );
  const [selectedLinkedIds, setSelectedLinkedIds] = useState<string[]>([]);
  const [appointmentConfirmationDocumentId, setAppointmentConfirmationDocumentId] =
    useState(appointmentConfirmationDocuments[0]?.id ?? "");

  const minTravelDate = useMemo(() => {
    const appointmentDay = extractIsoDate(appointmentDate);
    if (!countryRule || !appointmentDay) {
      return "";
    }
    return addDaysIso(appointmentDay, countryRule.minDays);
  }, [appointmentDate, countryRule]);

  const travelDateInvalid = Boolean(
    travelDate && minTravelDate && travelDate < minTravelDate,
  );

  function toggleLinkedApplication(applicationIdToToggle: string) {
    setSelectedLinkedIds((current) => {
      if (current.includes(applicationIdToToggle)) {
        return current.filter((id) => id !== applicationIdToToggle);
      }
      return [...current, applicationIdToToggle];
    });
  }

  async function uploadDocument(
    file: File,
    fileType: FileType,
    label: string,
  ): Promise<string> {
    const ticket = await requestDocumentUpload(
      applicationId,
      fileType,
      withUploadLabelPrefix(file.name, label),
    );
    if (!ticket.ok) {
      throw new Error(ticket.error);
    }
    const response = await fetch(ticket.uploadUrl, {
      method: "PUT",
      body: file,
    });
    if (!response.ok) {
      throw new Error(
        "Dosya depolama alanına yüklenemedi. Lütfen tekrar deneyin.",
      );
    }
    return ticket.documentId;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    if (!countryRule) {
      toast.error("Seçilen ülke için kural tanımı bulunamadı.");
      return;
    }
    if (!appointmentCity || !appointmentDate || !travelDate) {
      toast.error(
        "Randevu şehri, randevu tarihi ve seyahat tarihi zorunludur.",
      );
      return;
    }
    if (travelDateInvalid) {
      toast.error(
        `Seyahat tarihi en erken ${formatIsoDateForUi(minTravelDate)} olmalıdır.`,
      );
      return;
    }
    if (!note.trim()) {
      toast.error("Randevu notu zorunludur.");
      return;
    }
    if (!confirmationFile && !appointmentConfirmationDocumentId) {
      toast.error(
        "Randevu onay belgesi için bir dosya seçin veya yüklenmiş bir belge seçin.",
      );
      return;
    }
    if (hasVisaFee) {
      if (!visaFeeAmount || Number(visaFeeAmount) <= 0) {
        toast.error("Vize harcı için geçerli bir tutar girin.");
        return;
      }
      if (!visaFeeFile && !visaFeeReceiptDocumentId) {
        toast.error(
          "Vize harcı dekontu için bir dosya seçin veya yüklenmiş bir belge seçin.",
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      let confirmationId = appointmentConfirmationDocumentId;
      if (confirmationFile) {
        confirmationId = await uploadDocument(
          confirmationFile,
          FileType.APPOINTMENT_CONFIRMATION,
          "Randevu Onayı",
        );
      }

      let visaFeeId = visaFeeReceiptDocumentId;
      if (hasVisaFee && visaFeeFile) {
        visaFeeId = await uploadDocument(
          visaFeeFile,
          FileType.VISA_FEE_RECEIPT,
          "Vize Harcı Dekontu",
        );
      }

      const formData = new FormData();
      formData.set("appointmentCity", appointmentCity);
      formData.set("appointmentDate", appointmentDate);
      formData.set("travelDate", travelDate);
      formData.set("note", note);
      formData.set("appointmentExpense", appointmentExpense);
      formData.set("hasVisaFee", hasVisaFee ? "true" : "false");
      formData.set("appointmentConfirmationDocumentId", confirmationId);
      if (hasVisaFee) {
        formData.set("visaFeeAmount", visaFeeAmount);
        formData.set("visaFeeReceiptDocumentId", visaFeeId);
      }
      for (const linkedId of selectedLinkedIds) {
        formData.append("linkedApplicationIds", linkedId);
      }

      const result = await saveAppointmentOps(applicationId, {}, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        "Randevu işlemleri kaydedildi. Randevu takvimde görünecek.",
      );
      setConfirmationFile(null);
      setVisaFeeFile(null);
      setFileResetKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Randevu işlemleri kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="appointmentCity">Randevu Şehri</Label>
            <Select
              name="appointmentCity"
              value={appointmentCity}
              onValueChange={setAppointmentCity}
              disabled={!countryRule}
              required
            >
              <SelectTrigger id="appointmentCity" className="w-full">
                <SelectValue
                  placeholder={
                    countryRule
                      ? "Randevu şehri seçin"
                      : "Ülke kuralı bulunamadı"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {allowedCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointmentDate">Randevu Tarih & Saat</Label>
            <LocalizedDateTimePickerInput
              id="appointmentDate"
              name="appointmentDate"
              value={appointmentDate}
              onChange={setAppointmentDate}
              placeholder="DD.MM.YYYY"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="travelDate">Seyahat Başlangıç Tarihi (Zorla Güncelle)</Label>
          <LocalizedDatePickerInput
            id="travelDate"
            name="travelDate"
            value={travelDate}
            onChange={setTravelDate}
            min={minTravelDate}
            placeholder="DD.MM.YYYY"
            required
          />
          {countryRule ? (
            <p className="text-xs text-muted-foreground">
              Ülke kuralı: en az {countryRule.minDays} gün
            </p>
          ) : (
            <p className="text-xs text-red-600 dark:text-red-400">
              Seçilen ülke için kural tanımı bulunamadı.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-3.5">
          <Label htmlFor="appointmentConfirmationFile">Randevu Onay Belgesi</Label>
          <p className="text-xs text-muted-foreground">
            Randevu onay belgesini (PDF veya görsel) seçin. Kaydet’e bastığınızda
            dosya yüklenir ve randevu bilgileriyle birlikte tek adımda kaydedilir.
          </p>
          <AppointmentFileField
            key={`confirmation-${fileResetKey}`}
            id="appointmentConfirmationFile"
            file={confirmationFile}
            onSelect={setConfirmationFile}
            disabled={submitting}
          />
          {appointmentConfirmationDocuments.length > 0 ? (
            <div className="space-y-1.5">
              <Label
                htmlFor="appointmentConfirmationDocumentSelect"
                className="text-xs text-muted-foreground"
              >
                veya daha önce yüklenmiş bir belgeyi kullanın
              </Label>
              <Select
                value={appointmentConfirmationDocumentId}
                onValueChange={setAppointmentConfirmationDocumentId}
                disabled={submitting || confirmationFile !== null}
              >
                <SelectTrigger
                  id="appointmentConfirmationDocumentSelect"
                  className="w-full"
                >
                  <SelectValue placeholder="Randevu onay belgesi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {appointmentConfirmationDocuments.map((document) => (
                    <SelectItem key={document.id} value={document.id}>
                      {formatDateTimeLabel(document.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="appointmentExpense">Randevu Maliyeti (Gider)</Label>
            <Input
              id="appointmentExpense"
              name="appointmentExpense"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={appointmentExpense}
              onChange={(event) =>
                setAppointmentExpense(maskDecimalInput(event.target.value, 16))
              }
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={hasVisaFee}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setHasVisaFee(next);
                if (!next) {
                  setVisaFeeAmount("");
                  setVisaFeeReceiptDocumentId("");
                } else if (!visaFeeReceiptDocumentId) {
                  setVisaFeeReceiptDocumentId(visaFeeReceiptDocuments[0]?.id ?? "");
                }
              }}
              aria-label="Vize harcı var"
            />
            <span className="text-sm">
              <span className="block font-medium text-foreground">Vize Harcı Var</span>
              <span className="block text-xs text-muted-foreground">
                İşaretlendiğinde harç tutarı ve harç dekontu zorunlu olur.
              </span>
            </span>
          </label>

          {hasVisaFee ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="visaFeeAmount">Vize Harcı Tutarı</Label>
                <Input
                  id="visaFeeAmount"
                  name="visaFeeAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={visaFeeAmount}
                  onChange={(event) =>
                    setVisaFeeAmount(maskDecimalInput(event.target.value, 16))
                  }
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visaFeeReceiptFile">Vize Harcı Dekontu</Label>
                <AppointmentFileField
                  key={`visa-fee-${fileResetKey}`}
                  id="visaFeeReceiptFile"
                  file={visaFeeFile}
                  onSelect={setVisaFeeFile}
                  disabled={submitting}
                />
                {visaFeeReceiptDocuments.length > 0 ? (
                  <Select
                    value={visaFeeReceiptDocumentId}
                    onValueChange={setVisaFeeReceiptDocumentId}
                    disabled={submitting || visaFeeFile !== null}
                  >
                    <SelectTrigger id="visaFeeReceiptDocumentSelect" className="w-full">
                      <SelectValue placeholder="veya yüklenmiş dekontu seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {visaFeeReceiptDocuments.map((document) => (
                        <SelectItem key={document.id} value={document.id}>
                          {formatDateTimeLabel(document.createdAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {linkedApplications.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border/40 bg-muted/40 p-3.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Aynı Hesaptaki Diğer Aktif Başvurular
            </p>
            <p className="text-xs text-muted-foreground">
              Seçilen başvurulara aynı randevu tarihi, gider ve randevu onay belgesi
              tek işlemde uygulanır.
            </p>
            <ul className="space-y-2">
              {linkedApplications.map((application) => {
                const selected = selectedLinkedIds.includes(application.applicationId);
                return (
                  <li key={application.applicationId}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/40 bg-background px-3 py-2.5">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() =>
                          toggleLinkedApplication(application.applicationId)
                        }
                        aria-label="Bağlı başvuruyu seç"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-foreground">
                          Bağlı Başvuru
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {APPLICATION_TYPE_LABEL[application.applicationType]} · {STAGE_LABEL[application.currentStage]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {application.appointmentCity ?? "Randevu şehri yok"} · {formatDateTimeLabel(application.appointmentDate)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {travelDateInvalid ? (
          <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {`Dikkat: Seçilen ülkenin kuralları gereği seyahat tarihi en erken ${formatIsoDateForUi(minTravelDate)} olmalıdır.`}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="note">Randevu Notu</Label>
          <Textarea
            id="note"
            name="note"
            value={note}
            onChange={(event) =>
              setNote(maskEnglishNoteInput(event.target.value, 500))
            }
            maxLength={500}
            required
            placeholder="Randevu planına ilişkin kısa not"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={
              submitting ||
              travelDateInvalid ||
              !countryRule ||
              !appointmentCity ||
              !appointmentDate ||
              !travelDate ||
              !note.trim() ||
              (!confirmationFile && !appointmentConfirmationDocumentId) ||
              (hasVisaFee &&
                (!visaFeeAmount ||
                  Number(visaFeeAmount) <= 0 ||
                  (!visaFeeFile && !visaFeeReceiptDocumentId)))
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              "Randevu işlemlerini kaydet"
            )}
          </Button>
          {submitting ? (
            <span className="text-xs text-muted-foreground">
              Belge yükleniyor ve randevu bilgileri kaydediliyor…
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
