"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { onboard, type AuthFormState } from "@/lib/actions/auth";
import { COUNTRY_RULES, SUPPORTED_COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KvkkDialog, TermsDialog } from "@/components/auth/legal-dialogs";

const INITIAL_STATE: AuthFormState = {};

interface OnboardApplicantDraft {
  id: string;
  fullName: string;
}

function newApplicant(): OnboardApplicantDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: "",
  };
}

export function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboard, INITIAL_STATE);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [targetCountry, setTargetCountry] = useState("");
  const [appointmentCity, setAppointmentCity] = useState("");
  const [applicants, setApplicants] = useState<OnboardApplicantDraft[]>([]);

  const appointmentCities = useMemo(
    () => COUNTRY_RULES[targetCountry]?.cities ?? [],
    [targetCountry],
  );

  const groupApplicantsPayload = useMemo(
    () =>
      JSON.stringify(
        applicants.map((item) => ({
          fullName: item.fullName.trim(),
        })),
      ),
    [applicants],
  );

  function updateApplicant(id: string, value: string) {
    setApplicants((current) =>
      current.map((item) => (item.id === id ? { ...item, fullName: value } : item)),
    );
  }

  function addApplicant() {
    setApplicants((current) => [...current, newApplicant()]);
  }

  function removeApplicant(id: string) {
    setApplicants((current) => current.filter((item) => item.id !== id));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="groupApplicants" value={groupApplicantsPayload} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Ad Soyad</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Ayşe Yılmaz"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="siz@ornek.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+90 5xx xxx xx xx"
          maxLength={32}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetCountry">Hedef Ülke</Label>
        <Select
          name="targetCountry"
          value={targetCountry}
          onValueChange={(value) => {
            setTargetCountry(value);
            setAppointmentCity("");
          }}
          required
        >
          <SelectTrigger id="targetCountry" className="w-full">
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
        <Label htmlFor="appointmentCity">Randevu Şehri</Label>
        <Select
          name="appointmentCity"
          value={appointmentCity}
          onValueChange={setAppointmentCity}
          disabled={!targetCountry}
          required
        >
          <SelectTrigger id="appointmentCity" className="w-full">
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
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="passports">Pasaportlar</Label>
        <Input
          id="passports"
          name="passports"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          required
        />
        <p className="text-xs text-muted-foreground">
          Aile ve arkadaşlarınız için birden fazla pasaport
          yükleyebilirsiniz · JPG, PNG, WebP veya PDF · her biri en fazla 10 MB.
          Yüklenen pasaport sayısı: 1 (siz) + ek kişi sayısı ile aynı olmalıdır.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Ek Başvuru Kişileri</p>
            <p className="text-xs text-muted-foreground">
              Buraya sadece size ek olarak başvuruya dahil edilecek kişilerin ad
              soyad bilgisini girin.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addApplicant}>
            <Plus className="h-4 w-4" aria-hidden />
            Kişi Ekle
          </Button>
        </div>

        <div className="space-y-3">
          {applicants.map((applicant, index) => (
            <div
              key={applicant.id}
              className="grid gap-3 rounded-md border border-border/40 bg-background p-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`applicant-name-${applicant.id}`}>
                  {index + 2}. Kişi Ad Soyad
                </Label>
                <Input
                  id={`applicant-name-${applicant.id}`}
                  value={applicant.fullName}
                  onChange={(event) =>
                    updateApplicant(applicant.id, event.target.value)
                  }
                  placeholder="Ek Kişi Ad Soyad"
                  maxLength={120}
                  required
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeApplicant(applicant.id)}
                  aria-label="Kişiyi kaldır"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}

          {applicants.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ek kişi yok. Sadece kendi başvurunuz için devam edebilirsiniz.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="acceptKvkk"
            name="acceptKvkk"
            value="true"
            checked={acceptKvkk}
            onCheckedChange={(value) => setAcceptKvkk(value === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="acceptKvkk"
            className="text-sm leading-relaxed font-normal text-muted-foreground"
          >
            <KvkkDialog>KVKK Aydınlatma Metni</KvkkDialog>’ni okudum ve kabul
            ediyorum.
          </Label>
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            value="true"
            checked={acceptTerms}
            onCheckedChange={(value) => setAcceptTerms(value === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="acceptTerms"
            className="text-sm leading-relaxed font-normal text-muted-foreground"
          >
            <TermsDialog>Mesafeli Hizmet Satış Sözleşmesi</TermsDialog>’ni
            okudum ve kabul ediyorum.
          </Label>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={pending || !acceptKvkk || !acceptTerms}
      >
        {pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
      </Button>
    </form>
  );
}

