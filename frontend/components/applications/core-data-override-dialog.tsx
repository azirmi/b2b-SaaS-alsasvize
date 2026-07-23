"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import {
  deleteDocument,
  requestDocumentUpload,
} from "@/lib/actions/documents";
import { COUNTRY_RULES, SUPPORTED_COUNTRIES } from "@/lib/countries";
import { ApplicationType, FileType } from "@/lib/enums";
import { maskNameInput, normalizeEnglishChars } from "@/lib/input-masks";

const APPLICATION_TYPES = new Set<ApplicationType>(
  APPLICATION_TYPE_OPTIONS.map((option) => option.value),
);

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const UPLOAD_MIME_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

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

function normalizeApplicantFullName(value: string): string {
  const masked = maskNameInput(value, 120);
  return normalizeEnglishChars(masked).toUpperCase().trim();
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
  const [uploadingPassport, startUploadingPassport] = useTransition();
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
  const [applicantNames, setApplicantNames] = useState<string[]>(
    initialApplicants.map((applicant) =>
      normalizeApplicantFullName(applicant.fullName),
    ),
  );
  const [passportDocuments, setPassportDocuments] = useState(
    initialPassportDocuments,
  );
  const [passportFile, setPassportFile] = useState<File | null>(null);
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

  const requestedApplicantCount = Number(applicantCount.trim());
  const normalizedRequestedApplicantCount =
    Number.isInteger(requestedApplicantCount) && requestedApplicantCount > 0
      ? requestedApplicantCount
      : Math.max(1, applicants.length);
  const renderedApplicantCount = Math.max(
    normalizedRequestedApplicantCount,
    applicants.length,
  );
  const missingPassportCount = Math.max(
    0,
    normalizedRequestedApplicantCount - passportDocuments.length,
  );
  const busy = pending || deletingApplicant || deletingPassport || uploadingPassport;

  const applicantRows = useMemo(
    () =>
      Array.from({ length: renderedApplicantCount }, (_, index) => ({
        index,
        id: applicants[index]?.id ?? null,
        isPrimary: index === 0,
      })),
    [applicants, renderedApplicantCount],
  );

  useEffect(() => {
    setApplicantNames((previous) => {
      const next = [...previous];

      while (next.length < renderedApplicantCount) {
        next.push("");
      }

      if (next.length > renderedApplicantCount) {
        next.length = renderedApplicantCount;
      }

      if (
        next.length === previous.length &&
        next.every((value, index) => value === previous[index])
      ) {
        return previous;
      }

      return next;
    });
  }, [renderedApplicantCount]);

  function resetToInitial() {
    setApplicationType(initialApplicationType);
    setTargetCountry(initialTargetCountry);
    setAppointmentCity(initialAppointmentCity);
    setResidenceCity(normalizeResidenceCity(initialResidenceCity));
    setPlannedTravelDate(toIsoDate(initialPlannedTravelDate));
    setApplicantCount(String(Math.max(1, initialApplicantCount)));
    setApplicants(initialApplicants);
    setApplicantNames(
      initialApplicants.map((applicant) =>
        normalizeApplicantFullName(applicant.fullName),
      ),
    );
    setPassportDocuments(initialPassportDocuments);
    setPassportFile(null);
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

    const normalizedApplicantNames = applicantNames
      .slice(0, parsedApplicantCount)
      .map((name) => normalizeApplicantFullName(name));

    if (normalizedApplicantNames.length !== parsedApplicantCount) {
      setError("Her kişi için isim alanını doldurun.");
      return;
    }

    if (normalizedApplicantNames.some((name) => name.length === 0)) {
      setError("Her kişi için ad-soyad bilgisi zorunludur.");
      return;
    }

    if (passportDocuments.length < parsedApplicantCount) {
      setError(
        `Kişi sayısı ${parsedApplicantCount} olduğu için en az ${parsedApplicantCount} pasaport yüklenmelidir.`,
      );
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
        applicantNames: normalizedApplicantNames,
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
    const removeIndex = applicants.findIndex((applicant) => applicant.id === applicantId);
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

      if (removeIndex >= 0) {
        setApplicantNames((previous) =>
          previous.filter((_, index) => index !== removeIndex),
        );
      }

      if (typeof result.applicantCount === "number") {
        setApplicantCount(String(Math.max(1, result.applicantCount)));
      }
      setNote("Kişi kaydı silindi.");
    });
  }

  function handlePassportFileSelect(file: File | null) {
    if (!file) {
      setPassportFile(null);
      return;
    }

    const loweredName = file.name.toLocaleLowerCase("en-US");
    const extensionAllowed =
      loweredName.endsWith(".jpg") ||
      loweredName.endsWith(".jpeg") ||
      loweredName.endsWith(".png") ||
      loweredName.endsWith(".webp") ||
      loweredName.endsWith(".pdf");
    const mimeAllowed = UPLOAD_MIME_SET.has(file.type);

    if (!mimeAllowed && !extensionAllowed) {
      setError("Desteklenmeyen dosya türü. JPG, PNG, WebP veya PDF yükleyin.");
      setPassportFile(null);
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setError("Dosya 10 MB sınırını aşıyor.");
      setPassportFile(null);
      return;
    }

    setError(null);
    setPassportFile(file);
  }

  function uploadPassport() {
    if (!passportFile) {
      setError("Lütfen önce bir pasaport dosyası seçin.");
      return;
    }

    setError(null);
    setNote(null);

    startUploadingPassport(async () => {
      const ticket = await requestDocumentUpload(
        applicationId,
        FileType.PASSPORT,
        passportFile.name,
      );

      if (!ticket.ok) {
        setError(ticket.error ?? "Pasaport yükleme başlatılamadı.");
        return;
      }

      try {
        const response = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: passportFile,
        });
        if (!response.ok) {
          setError("Depolama alanına yükleme başarısız oldu. Lütfen tekrar deneyin.");
          return;
        }
      } catch {
        setError("Depolama hizmetine ulaşılamadı. Lütfen tekrar deneyin.");
        return;
      }

      setPassportDocuments((previous) => [
        ...previous,
        { id: ticket.documentId, createdAt: new Date().toISOString() },
      ]);
      setPassportFile(null);
      setNote("Pasaport belgesi yüklendi.");
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
                <p className="text-xs text-muted-foreground">
                  Her kişi için ad-soyad girilmelidir. Sekmelerde ve dosya alanında
                  bu isimler gösterilir.
                </p>
                <div className="rounded-md border border-border/40">
                  {applicantRows.map((row) => {
                    const isDeleting =
                      deletingApplicant && activeApplicantDeleteId === row.id;
                    const nameValue = applicantNames[row.index] ?? "";

                    return (
                      <div
                        key={row.id ?? `virtual-${row.index + 1}`}
                        className="space-y-2 border-b border-border/30 px-3 py-2 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            {row.index + 1}. kişi
                          </p>

                          {row.id && !row.isPrimary ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveApplicant(row.id as string)}
                              disabled={busy}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              {isDeleting ? "Siliniyor…" : "Sil"}
                            </Button>
                          ) : row.isPrimary ? (
                            <span className="text-xs text-muted-foreground">
                              Ana başvuru sahibi
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Yeni kişi</span>
                          )}
                        </div>

                        <Input
                          value={nameValue}
                          onChange={(event) => {
                            const normalized = normalizeApplicantFullName(
                              event.target.value,
                            );
                            setApplicantNames((previous) => {
                              const next = [...previous];
                              next[row.index] = normalized;
                              return next;
                            });
                          }}
                          placeholder="Örn: AYSE YILMAZ"
                          maxLength={120}
                          className="uppercase"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pasaport Belgeleri</Label>
                <p className="text-xs text-muted-foreground">
                  Zorunlu: {normalizedRequestedApplicantCount} pasaport · Yüklü: {passportDocuments.length}
                  {missingPassportCount > 0 ? ` · Eksik: ${missingPassportCount}` : ""}
                </p>

                <div className="grid gap-2 rounded-md border border-border/40 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Input
                    type="file"
                    accept={UPLOAD_ACCEPT}
                    onChange={(event) =>
                      handlePassportFileSelect(event.target.files?.[0] ?? null)
                    }
                    className="text-xs"
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={uploadPassport}
                    disabled={!passportFile || busy}
                  >
                    {uploadingPassport ? "Yükleniyor…" : "Pasaport Yükle"}
                  </Button>
                </div>

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
                            <p className="text-sm font-medium">Pasaport #{index + 1}</p>
                            <p className="text-xs text-muted-foreground">
                              Yüklenme: {formatShortDate(document.createdAt)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePassport(document.id)}
                            disabled={busy}
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
                disabled={busy}
              >
                Vazgeç
              </Button>
              <Button type="button" onClick={submitOverride} disabled={busy}>
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {note ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{note}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
