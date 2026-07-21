"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APPLICATION_TYPE_OPTIONS } from "@/lib/application-type";
import {
  removeOnboardingApplicant,
  updateApplicationCoreData,
} from "@/lib/actions/applications";
import { deleteDocument } from "@/lib/actions/documents";
import { COUNTRY_RULES, SUPPORTED_COUNTRIES } from "@/lib/countries";
import { ApplicationType } from "@/lib/enums";
import { maskNameInput, normalizeEnglishChars } from "@/lib/input-masks";

const APPLICATION_TYPES = new Set<ApplicationType>(
  APPLICATION_TYPE_OPTIONS.map((option) => option.value),
);

function toIsoDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeResidenceCity(value: string): string {
  const masked = maskNameInput(value, 120);
  return normalizeEnglishChars(masked).toUpperCase();
}

function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("tr-TR");
}

interface ApplicantItem {
  id: string;
  fullName: string;
}

interface PassportItem {
  id: string;
  createdAt: string;
}

export function CoreDataOverrideDialog({
  applicationId,
  initialApplicationType,
  initialTargetCountry,
  initialAppointmentCity,
  initialResidenceCity,
  initialPlannedTravelDate,
  initialApplicantCount,
  initialApplicants,
  initialPassportDocuments,
}: {
  applicationId: string;
  initialApplicationType: ApplicationType;
  initialTargetCountry: string;
  initialAppointmentCity: string;
  initialResidenceCity: string;
  initialPlannedTravelDate: string | null;
  initialApplicantCount: number;
  initialApplicants: ApplicantItem[];
  initialPassportDocuments: PassportItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletingApplicant, startDeletingApplicant] = useTransition();
  const [deletingPassport, startDeletingPassport] = useTransition();
  const [applicationType, setApplicationType] = useState(initialApplicationType);
  const [targetCountry, setTargetCountry] = useState(initialTargetCountry);
  const [appointmentCity, setAppointmentCity] = useState(initialAppointmentCity);
  const [residenceCity, setResidenceCity] = useState(
    normalizeResidenceCity(initialResidenceCity),
  );
  const [plannedTravelDate, setPlannedTravelDate] = useState(
    toIsoDate(initialPlannedTravelDate),
  );
  const [applicantCount, setApplicantCount] = useState(
    String(Math.max(1, initialApplicantCount)),
  );
  const [applicants, setApplicants] = useState(initialApplicants);
  const [passportDocuments, setPassportDocuments] = useState(
    initialPassportDocuments,
  );
  const [activeApplicantDeleteId, setActiveApplicantDeleteId] = useState<
    string | null
  >(null);
  const [activePassportDeleteId, setActivePassportDeleteId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const appointmentCities = useMemo(
    () => COUNTRY_RULES[targetCountry]?.cities ?? [],
    [targetCountry],
  );

  function resetToInitial() {
    setApplicationType(initialApplicationType);
    setTargetCountry(initialTargetCountry);
    setAppointmentCity(initialAppointmentCity);
    setResidenceCity(normalizeResidenceCity(initialResidenceCity));
    setPlannedTravelDate(toIsoDate(initialPlannedTravelDate));
    setApplicantCount(String(Math.max(1, initialApplicantCount)));
    setApplicants(initialApplicants);
    setPassportDocuments(initialPassportDocuments);
    setActiveApplicantDeleteId(null);
    setActivePassportDeleteId(null);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetToInitial();
    }
  }

  function submitOverride() {
    setError(null);
    setNote(null);

    const parsedApplicantCount = Number(applicantCount.trim());
    if (!Number.isInteger(parsedApplicantCount) || parsedApplicantCount < 1) {
      setError("Kişi sayısı en az 1 olmalıdır.");
      return;
    }

    startTransition(async () => {
      const result = await updateApplicationCoreData(applicationId, {
        applicationType,
        targetCountry,
        appointmentCity,
        residenceCity,
        plannedTravelDate,
        applicantCount: parsedApplicantCount,
      });

      if (!result.ok) {
        setError(result.error ?? "Çekirdek veriler güncellenemedi.");
        return;
      }

      setOpen(false);
      setNote("Çekirdek veriler güncellendi.");
    });
  }

  function handleRemoveApplicant(applicantId: string) {
    setError(null);
    setNote(null);
    setActiveApplicantDeleteId(applicantId);

    startDeletingApplicant(async () => {
      const result = await removeOnboardingApplicant(applicationId, applicantId);
      setActiveApplicantDeleteId(null);

      if (!result.ok) {
        setError(result.error ?? "Kişi kaydı silinemedi.");
        return;
      }

      setApplicants((previous) =>
        previous.filter((applicant) => applicant.id !== applicantId),
      );
      if (typeof result.applicantCount === "number") {
        setApplicantCount(String(Math.max(1, result.applicantCount)));
      }
      setNote("Kişi kaydı silindi.");
    });
  }

  function handleRemovePassport(documentId: string) {
    setError(null);
    setNote(null);
    setActivePassportDeleteId(documentId);

    startDeletingPassport(async () => {
      const result = await deleteDocument(documentId);
      setActivePassportDeleteId(null);

      if (!result.ok) {
        setError(result.error ?? "Pasaport belgesi silinemedi.");
        return;
      }

      setPassportDocuments((previous) =>
        previous.filter((document) => document.id !== documentId),
      );
      setNote("Pasaport belgesi silindi.");
    });
  }

  return (
    <Card className="rounded-lg border border-border/40 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          Yönetici İşlemleri
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bu alan sadece yöneticiler tarafından kullanılabilir. Müşterinin kayıt
          sırasında hatalı girdiği temel verileri (ülke, şehir, tarih) buradan
          ezebilirsiniz.
        </p>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" className="w-full justify-center" variant="outline">
              <Pencil className="h-4 w-4" aria-hidden />
              Başvuru Temel Bilgilerini Düzenle
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Başvuru Temel Bilgilerini Düzenle</DialogTitle>
              <DialogDescription>
                Bu işlem denetim kaydına yazılır ve müşteri temel verilerini
                günceller.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="core-data-application-type">Vize Türü</Label>
                <Select
                  value={applicationType}
                  onValueChange={(value) => {
                    if (APPLICATION_TYPES.has(value as ApplicationType)) {
                      setApplicationType(value as ApplicationType);
                    }
                  }}
                >
                  <SelectTrigger id="core-data-application-type" className="w-full">
                    <SelectValue placeholder="Vize türü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-data-country">Hedef Ülke</Label>
                <Select
                  value={targetCountry}
                  onValueChange={(value) => {
                    setTargetCountry(value);
                    const defaultCity = COUNTRY_RULES[value]?.cities ?? [];
                    setAppointmentCity(
                      defaultCity.includes(appointmentCity) ? appointmentCity : "",
                    );
                  }}
                >
                  <SelectTrigger id="core-data-country" className="w-full">
                    <SelectValue placeholder="Ülke seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-data-city">Randevu Şehri</Label>
                <Select
                  value={appointmentCity}
                  onValueChange={setAppointmentCity}
                  disabled={!targetCountry}
                >
                  <SelectTrigger id="core-data-city" className="w-full">
                    <SelectValue
                      placeholder={
                        targetCountry
                          ? "Randevu şehri seçin"
                          : "Önce hedef ülke seçin"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-data-residence">İkamet Edilen Şehir</Label>
                <Input
                  id="core-data-residence"
                  value={residenceCity}
                  onChange={(event) =>
                    setResidenceCity(normalizeResidenceCity(event.target.value))
                  }
                  placeholder="Uygun bir şehir giriniz"
                  maxLength={120}
                  className="uppercase"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-data-travel-date">Planlanan Seyahat Tarihi</Label>
                <DatePickerInput
                  id="core-data-travel-date"
                  value={plannedTravelDate}
                  onChange={setPlannedTravelDate}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="core-data-applicant-count">Kişi Sayısı</Label>
                <Input
                  id="core-data-applicant-count"
                  type="number"
                  min={1}
                  step={1}
                  value={applicantCount}
                  onChange={(event) => setApplicantCount(event.target.value)}
                  inputMode="numeric"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Bu alan artırılıp azaltılabilir. Azaltma sırasında fazla kişi
                  kayıtları ve ilgili formlar kaldırılır.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Kişi Kayıtları</Label>
                <div className="rounded-md border border-border/40">
                  {applicants.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Kayıtlı ek kişi bulunmuyor.
                    </p>
                  ) : (
                    applicants.map((applicant, index) => {
                      const isPrimary = index === 0;
                      const isDeleting =
                        deletingApplicant && activeApplicantDeleteId === applicant.id;

                      return (
                        <div
                          key={applicant.id}
                          className="flex items-center justify-between gap-3 border-b border-border/30 px-3 py-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {index + 1}. {applicant.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isPrimary
                                ? "Ana başvuru sahibi"
                                : "Ek başvuru sahibi"}
                            </p>
                          </div>

                          {isPrimary ? (
                            <span className="text-xs text-muted-foreground">
                              Silinemez
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveApplicant(applicant.id)}
                              disabled={pending || deletingApplicant || deletingPassport}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              {isDeleting ? "Siliniyor…" : "Sil"}
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pasaport Belgeleri</Label>
                <div className="rounded-md border border-border/40">
                  {passportDocuments.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Kayıtlı pasaport belgesi bulunmuyor.
                    </p>
                  ) : (
                    passportDocuments.map((document, index) => {
                      const isDeleting =
                        deletingPassport && activePassportDeleteId === document.id;

                      return (
                        <div
                          key={document.id}
                          className="flex items-center justify-between gap-3 border-b border-border/30 px-3 py-2 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              Pasaport #{index + 1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Yüklenme: {formatShortDate(document.createdAt)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePassport(document.id)}
                            disabled={pending || deletingApplicant || deletingPassport}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            {isDeleting ? "Siliniyor…" : "Sil"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending || deletingApplicant || deletingPassport}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={submitOverride}
                disabled={pending || deletingApplicant || deletingPassport}
              >
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {note ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {note}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
