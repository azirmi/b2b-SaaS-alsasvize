"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, ShieldCheck } from "lucide-react";

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
import { updateApplicationCoreData } from "@/lib/actions/applications";
import { COUNTRY_RULES, SUPPORTED_COUNTRIES } from "@/lib/countries";
import { maskNameInput, normalizeEnglishChars } from "@/lib/input-masks";

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

export function CoreDataOverrideDialog({
  applicationId,
  initialTargetCountry,
  initialAppointmentCity,
  initialResidenceCity,
  initialPlannedTravelDate,
}: {
  applicationId: string;
  initialTargetCountry: string;
  initialAppointmentCity: string;
  initialResidenceCity: string;
  initialPlannedTravelDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [targetCountry, setTargetCountry] = useState(initialTargetCountry);
  const [appointmentCity, setAppointmentCity] = useState(initialAppointmentCity);
  const [residenceCity, setResidenceCity] = useState(
    normalizeResidenceCity(initialResidenceCity),
  );
  const [plannedTravelDate, setPlannedTravelDate] = useState(
    toIsoDate(initialPlannedTravelDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const appointmentCities = useMemo(
    () => COUNTRY_RULES[targetCountry]?.cities ?? [],
    [targetCountry],
  );

  function resetToInitial() {
    setTargetCountry(initialTargetCountry);
    setAppointmentCity(initialAppointmentCity);
    setResidenceCity(normalizeResidenceCity(initialResidenceCity));
    setPlannedTravelDate(toIsoDate(initialPlannedTravelDate));
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

    startTransition(async () => {
      const result = await updateApplicationCoreData(applicationId, {
        targetCountry,
        appointmentCity,
        residenceCity,
        plannedTravelDate,
      });

      if (!result.ok) {
        setError(result.error ?? "Çekirdek veriler güncellenemedi.");
        return;
      }

      setOpen(false);
      setNote("Çekirdek veriler güncellendi.");
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
                disabled={pending}
              >
                Vazgeç
              </Button>
              <Button type="button" onClick={submitOverride} disabled={pending}>
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
