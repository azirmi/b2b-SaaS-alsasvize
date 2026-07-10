"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { saveAppointmentOps } from "@/lib/actions/applications";
import { COUNTRY_RULES } from "@/lib/countries";
import { FileType } from "@/lib/enums";
import { STAGE_LABEL } from "@/lib/status";
import type { CrmActionState, LinkedActiveApplication } from "@/lib/types";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";

const INITIAL: CrmActionState = {};

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

export function AppointmentOpsForm({
  applicationId,
  targetCountry,
  initialAppointmentCity,
  initialAppointmentDate,
  initialTravelDate,
  initialAppointmentExpense,
  linkedApplications = [],
  appointmentConfirmationDocuments = [],
}: {
  applicationId: string;
  targetCountry: string;
  initialAppointmentCity?: string | null;
  initialAppointmentDate?: string | null;
  initialTravelDate?: string | null;
  initialAppointmentExpense?: number | null;
  linkedApplications?: LinkedActiveApplication[];
  appointmentConfirmationDocuments?: Array<{ id: string; createdAt: string }>;
}) {
  const action = saveAppointmentOps.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

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

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {selectedLinkedIds.map((linkedId) => (
          <input
            key={linkedId}
            type="hidden"
            name="linkedApplicationIds"
            value={linkedId}
          />
        ))}
        <input
          type="hidden"
          name="appointmentConfirmationDocumentId"
          value={appointmentConfirmationDocumentId}
        />

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
            <Input
              id="appointmentDate"
              name="appointmentDate"
              type="datetime-local"
              step={60}
              value={appointmentDate}
              onChange={(event) => setAppointmentDate(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="travelDate">Seyahat Başlangıç Tarihi (Zorla Güncelle)</Label>
          <Input
            id="travelDate"
            name="travelDate"
            type="date"
            value={travelDate}
            onChange={(event) => setTravelDate(event.target.value)}
            min={minTravelDate || undefined}
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

        <div className="space-y-1.5">
          <Label htmlFor="appointmentConfirmationDocumentSelect">
            Randevu Onay Belgesi
          </Label>
          <Select
            value={appointmentConfirmationDocumentId}
            onValueChange={setAppointmentConfirmationDocumentId}
          >
            <SelectTrigger id="appointmentConfirmationDocumentSelect" className="w-full">
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
          {appointmentConfirmationDocuments.length === 0 ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              Kaydetmeden önce en az bir randevu onay belgesi yükleyin.
            </p>
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
              onChange={(event) => setAppointmentExpense(event.target.value)}
              placeholder="0"
            />
          </div>
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
                        aria-label={`${application.applicationId} seç`}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-foreground">
                          {application.applicationId}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {STAGE_LABEL[application.currentStage]} · {application.targetCountry || "Ülke yok"}
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
            {`Dikkat: Seçilen ülkenin kuralları gereği seyahat tarihi en erken ${minTravelDate} olmalıdır.`}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="note">Not (Opsiyonel)</Label>
          <Textarea
            id="note"
            name="note"
            maxLength={500}
            placeholder="Randevu planına ilişkin kısa not"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={
              pending ||
              travelDateInvalid ||
              !countryRule ||
              !appointmentConfirmationDocumentId
            }
          >
            {pending ? "Kaydediliyor…" : "Randevu işlemlerini kaydet"}
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

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Randevu Onay Belgesi Yükleme
        </p>
        <DocumentUploader
          applicationId={applicationId}
          defaultType={FileType.APPOINTMENT_CONFIRMATION}
          allowedTypes={[FileType.APPOINTMENT_CONFIRMATION]}
        />
      </div>
    </div>
  );
}
