"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, SendHorizontal, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  getDijizinFormsSnapshot,
  sendDijizinConsentSms,
  sendDijizinFormToCustomer,
  verifyDijizinConsentCode,
} from "@/lib/actions/applications";
import type {
  DijizinCustomerForm,
  DijizinFormsSnapshot,
  DijizinSystemForm,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type NoticeTone = "success" | "error" | "muted";

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("tr-TR");
}

function mapStatusLabel(status: string | null): string {
  if (!status) {
    return "Durum Yok";
  }

  const normalized = status.trim().toLowerCase();
  if (["completed", "approved", "onay", "onaylandi", "signed"].includes(normalized)) {
    return "Tamamlandı";
  }
  if (["pending", "waiting", "sent", "queued"].includes(normalized)) {
    return "Bekliyor";
  }
  if (["rejected", "cancelled", "failed"].includes(normalized)) {
    return "Başarısız";
  }
  return status;
}

function statusClasses(status: string | null): string {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (["completed", "approved", "onay", "onaylandi", "signed"].includes(normalized)) {
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900";
  }
  if (["rejected", "cancelled", "failed"].includes(normalized)) {
    return "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900";
  }
  return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900";
}

function noticeClasses(tone: NoticeTone): string {
  if (tone === "success") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (tone === "error") {
    return "text-red-600 dark:text-red-400";
  }
  return "text-muted-foreground";
}

function firstActiveFormId(forms: DijizinSystemForm[]): string {
  const active = forms.find((form) => form.isActive);
  return active?.formId ?? "";
}

export function DijizinPanel({
  applicationId,
  phone,
  initialSnapshot,
  initialError,
}: {
  applicationId: string;
  phone: string;
  initialSnapshot: DijizinFormsSnapshot | null;
  initialError?: string | null;
}) {
  const [kvkkVerified, setKvkkVerified] = useState(
    Boolean(initialSnapshot?.kvkkVerified),
  );
  const [availableForms, setAvailableForms] = useState<DijizinSystemForm[]>(
    initialSnapshot?.availableForms ?? [],
  );
  const [customerForms, setCustomerForms] = useState<DijizinCustomerForm[]>(
    initialSnapshot?.customerForms ?? [],
  );
  const [selectedFormId, setSelectedFormId] = useState<string>(
    firstActiveFormId(initialSnapshot?.availableForms ?? []),
  );
  const [otpCode, setOtpCode] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(
    initialError
      ? {
          tone: "error",
          text: initialError,
        }
      : null,
  );
  const [pending, startTransition] = useTransition();

  const activeForms = useMemo(
    () => availableForms.filter((form) => form.isActive),
    [availableForms],
  );

  function syncSnapshot(snapshot: DijizinFormsSnapshot) {
    setKvkkVerified(snapshot.kvkkVerified);
    setAvailableForms(snapshot.availableForms);
    setCustomerForms(snapshot.customerForms);

    const selectedStillValid = snapshot.availableForms.some(
      (form) => form.isActive && form.formId === selectedFormId,
    );
    if (!selectedStillValid) {
      setSelectedFormId(firstActiveFormId(snapshot.availableForms));
    }
  }

  async function refreshSnapshot(): Promise<boolean> {
    const result = await getDijizinFormsSnapshot(applicationId);
    if (!result.ok || !result.data) {
      setNotice({
        tone: "error",
        text: result.error ?? "Dijizin form bilgileri yenilenemedi.",
      });
      return false;
    }

    syncSnapshot(result.data);
    return true;
  }

  function handleSendSms() {
    setNotice(null);
    startTransition(async () => {
      const result = await sendDijizinConsentSms(applicationId);
      if (!result.ok) {
        setNotice({
          tone: "error",
          text: result.error ?? "KVKK onay SMS'i gönderilemedi.",
        });
        return;
      }

      setNotice({
        tone: "success",
        text: result.message ?? "KVKK onay SMS'i gönderildi.",
      });
    });
  }

  function handleVerify() {
    const code = otpCode.trim();
    if (!/^\d{1,16}$/.test(code)) {
      setNotice({
        tone: "error",
        text: "Doğrulama kodu yalnızca rakamlardan oluşmalıdır.",
      });
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await verifyDijizinConsentCode(applicationId, code);
      if (!result.ok) {
        setNotice({
          tone: "error",
          text: result.error ?? "KVKK doğrulaması tamamlanamadı.",
        });
        return;
      }

      setOtpCode("");
      setNotice({
        tone: "success",
        text: result.message ?? "KVKK doğrulaması başarıyla tamamlandı.",
      });
      setKvkkVerified(true);
      await refreshSnapshot();
    });
  }

  function handleSendForm() {
    if (!kvkkVerified) {
      setNotice({
        tone: "error",
        text: "Form göndermeden önce KVKK doğrulaması tamamlanmalıdır.",
      });
      return;
    }

    if (!selectedFormId) {
      setNotice({
        tone: "error",
        text: "Gönderilecek formu seçin.",
      });
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await sendDijizinFormToCustomer(applicationId, selectedFormId);
      if (!result.ok) {
        setNotice({
          tone: "error",
          text: result.error ?? "Form müşteriye gönderilemedi.",
        });
        return;
      }

      setNotice({
        tone: "success",
        text: result.message ?? "Form müşteriye başarıyla gönderildi.",
      });
      await refreshSnapshot();
    });
  }

  function handleRefresh() {
    setNotice(null);
    startTransition(async () => {
      const ok = await refreshSnapshot();
      if (ok) {
        setNotice({
          tone: "muted",
          text: "Dijizin verileri güncellendi.",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Dijizin İşlemleri</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            KVKK doğrulamasını tamamlayın, ardından aktif Dijizin formlarını müşteriye gönderin.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={pending}
        >
          <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} aria-hidden />
          Yenile
        </Button>
      </div>

      <div className="rounded-lg border border-border/40 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h4 className="text-sm font-medium">A. KVKK Onayı</h4>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-md text-[11px]",
              kvkkVerified
                ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900"
                : "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900",
            )}
          >
            {kvkkVerified ? "KVKK Onaylandı" : "Onay Bekleniyor"}
          </Badge>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Doğrulama numarası: {phone || "Telefon bilgisi yok"}
        </p>

        {kvkkVerified ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            KVKK doğrulaması tamamlandı. Satış aşaması bir sonraki adıma geçebilir.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="dijizin-otp">Doğrulama Kodu</Label>
              <Input
                id="dijizin-otp"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                placeholder="SMS kodunu girin"
                inputMode="numeric"
                maxLength={16}
              />
            </div>
            <div className="flex flex-col gap-2 self-end sm:w-40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendSms}
                disabled={pending}
              >
                SMS Gönder
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleVerify}
                disabled={pending || otpCode.trim().length === 0}
              >
                Kodu Doğrula
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="rounded-lg border border-border/40 bg-background p-4">
        <div className="flex items-center gap-2">
          <SendHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h4 className="text-sm font-medium">B. Form İşlemleri</h4>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Aktif formu seçip müşteriye gönderin. Gönderim geçmişi aşağıda listelenir.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="dijizin-form">Aktif Form</Label>
            <Select
              value={selectedFormId}
              onValueChange={setSelectedFormId}
              disabled={activeForms.length === 0 || pending}
            >
              <SelectTrigger id="dijizin-form" className="w-full">
                <SelectValue
                  placeholder={
                    activeForms.length > 0 ? "Form seçin" : "Aktif form bulunamadı"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {activeForms.map((form) => (
                  <SelectItem key={form.formId} value={form.formId}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="self-end sm:w-40">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={handleSendForm}
              disabled={pending || activeForms.length === 0 || !kvkkVerified}
            >
              Form Gönder
            </Button>
          </div>
        </div>

        {!kvkkVerified ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Form göndermek için önce KVKK doğrulamasını tamamlayın.
          </p>
        ) : null}

        <div className="mt-4 rounded-md border border-border/40">
          {customerForms.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Müşteriye henüz Dijizin formu gönderilmedi.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {customerForms.map((form, index) => (
                <li
                  key={`${form.formId}-${form.sentAt ?? "na"}-${index}`}
                  className="grid gap-1 px-3 py-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Gönderim: {formatDateTime(form.sentAt)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("w-fit rounded-md text-[11px]", statusClasses(form.status))}
                  >
                    {mapStatusLabel(form.status)}
                  </Badge>
                  <p className="text-xs text-muted-foreground sm:text-right">
                    Cevap: {formatDateTime(form.answeredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {notice ? (
        <p className={cn("text-xs", noticeClasses(notice.tone))}>{notice.text}</p>
      ) : null}
    </div>
  );
}
