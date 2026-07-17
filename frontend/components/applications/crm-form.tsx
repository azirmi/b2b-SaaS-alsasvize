"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalizedDatePickerInput } from "@/components/ui/localized-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveCrm } from "@/lib/actions/applications";
import { requestDocumentUpload } from "@/lib/actions/documents";
import {
  CURRENCY,
  formatTl,
  PAYMENT_TYPE_LABEL,
  PAYMENT_TYPES,
  type PaymentType,
} from "@/lib/crm";
import { FileType } from "@/lib/enums";
import { maskDecimalInput } from "@/lib/input-masks";
import type { CrmActionState, CrmData } from "@/lib/types";
import { cn } from "@/lib/utils";

const INITIAL: CrmActionState = {};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const ACCEPT_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Disabled input whose value is pulled from the customer's own records. */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value || "—"} disabled readOnly tabIndex={-1} />
    </div>
  );
}

/**
 * Sales CRM + finance data-entry form. Applicant target country, phone and
 * travel date are pulled read-only from the customer's own records; the rep
 * captures the sale, payment plan and (for prepaid) the balance, and attaches
 * the payment receipt (dekont). Submits via a server action bound to the
 * application id; on success the dashboard subtree revalidates, which flips the
 * "Send to Documents" gate open.
 */
export function CrmForm({
  applicationId,
  crm,
  targetCountry,
  phone,
  travelDate,
  residenceCity,
}: {
  applicationId: string;
  crm: CrmData | null;
  targetCountry: string;
  phone: string;
  travelDate: string;
  residenceCity: string;
}) {
  const action = saveCrm.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [paymentType, setPaymentType] = useState<PaymentType>(
    crm?.paymentType ?? "NORMAL",
  );
  const [total, setTotal] = useState<string>(
    crm?.totalAmount != null ? String(crm.totalAmount) : "",
  );
  const [salesDate, setSalesDate] = useState<string>(
    crm?.salesDate ? crm.salesDate.slice(0, 10) : "",
  );
  const [upfront, setUpfront] = useState<string>(
    crm?.upfrontPaid != null ? String(crm.upfrontPaid) : "",
  );

  // Receipt (dekont) upload state — the id feeds a hidden field on submit.
  const inputRef = useRef<HTMLInputElement>(null);
  const [receiptFileId, setReceiptFileId] = useState<string>(
    crm?.receiptFileId ?? "",
  );
  const [receiptName, setReceiptName] = useState<string>("");
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const totalNum = Number(total);
  const upfrontNum = Number(upfront);
  const remaining =
    Number.isFinite(totalNum) && Number.isFinite(upfrontNum)
      ? totalNum - upfrontNum
      : NaN;

  function uploadReceipt(file: File | null) {
    setReceiptError(null);
    if (!file) return;
    if (!ACCEPT_SET.has(file.type)) {
      setReceiptError("Desteklenmeyen dosya türü. JPG, PNG, WebP veya PDF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setReceiptError("Dosya 10 MB sınırını aşıyor.");
      return;
    }
    startUpload(async () => {
      const ticket = await requestDocumentUpload(
        applicationId,
        FileType.PAYMENT_RECEIPT,
        file.name,
      );
      if (!ticket.ok) {
        setReceiptError(ticket.error);
        return;
      }
      try {
        const response = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: file,
        });
        if (!response.ok) {
          setReceiptError("Depolamaya yükleme başarısız. Tekrar deneyin.");
          return;
        }
      } catch {
        setReceiptError("Depolamaya ulaşılamadı. Tekrar deneyin.");
        return;
      }
      setReceiptFileId(ticket.documentId);
      setReceiptName(file.name);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function clearReceipt() {
    setReceiptFileId("");
    setReceiptName("");
    setReceiptError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="receiptFileId" value={receiptFileId} />

      {/* Pulled read-only from the customer's application form / profile. */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Danışan Bilgileri
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <ReadOnlyField label="Hedef Ülke" value={targetCountry} />
          <ReadOnlyField label="Telefon" value={phone} />
          <ReadOnlyField label="İkamet Şehri" value={residenceCity} />
          <ReadOnlyField label="Seyahat Tarihi" value={travelDate} />
        </div>
      </fieldset>

      {/* Sales record. */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Satış Bilgileri
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salesDate">Satış Tarihi</Label>
            <LocalizedDatePickerInput
              id="salesDate"
              name="salesDate"
              value={salesDate}
              onChange={setSalesDate}
              placeholder="DD.MM.YYYY"
              required
            />
          </div>
        </div>
      </fieldset>

      {/* Finance module. */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Finans
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="paymentType">Ödeme Türü</Label>
            <Select
              name="paymentType"
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
              required
            >
              <SelectTrigger id="paymentType" className="w-full">
                <SelectValue placeholder="Seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PAYMENT_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalAmount">Toplam Tutar</Label>
            <div className="relative">
              <Input
                id="totalAmount"
                name="totalAmount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={total}
                onChange={(event) =>
                  setTotal(maskDecimalInput(event.target.value, 16))
                }
                placeholder="0"
                className="pr-10"
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                {CURRENCY}
              </span>
            </div>
          </div>
        </div>

        {paymentType === "PREPAID" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="upfrontPaid">Ön Ödeme</Label>
              <div className="relative">
                <Input
                  id="upfrontPaid"
                  name="upfrontPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={upfront}
                  onChange={(event) =>
                    setUpfront(maskDecimalInput(event.target.value, 16))
                  }
                  placeholder="0"
                  className="pr-10"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                  {CURRENCY}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Kalan Bakiye</Label>
              <div
                className={cn(
                  "flex h-9 items-center justify-end rounded-md border border-border/40 bg-muted px-3 text-sm font-medium tabular-nums",
                  Number.isFinite(remaining) && remaining < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground",
                )}
              >
                {Number.isFinite(remaining) ? formatTl(remaining) : "—"}
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>

      {/* Payment receipt (dekont). */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Ödeme Dekontu
        </legend>
        {receiptFileId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/40 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Check
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <span className="truncate font-medium">
                {receiptName || "Dekont yüklendi"}
              </span>
            </span>
            <button
              type="button"
              onClick={clearReceipt}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dekontu kaldır"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
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
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {uploading ? (
              <span className="text-muted-foreground">Yükleniyor…</span>
            ) : (
              <>
                <FileUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>
                  <span className="font-medium">Dekont yükleyin</span> · JPG,
                  PNG, WebP veya PDF
                </span>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => uploadReceipt(event.target.files?.[0] ?? null)}
        />
        {receiptError ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {receiptError}
          </p>
        ) : null}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || uploading}>
          {pending ? "Kaydediliyor…" : "CRM verilerini kaydet"}
        </Button>
        {state.error ? (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : null}
        {state.ok ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Kaydedildi.
          </span>
        ) : null}
      </div>
    </form>
  );
}
