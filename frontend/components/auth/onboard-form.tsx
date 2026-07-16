"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { onboard, type AuthFormState } from "@/lib/actions/auth";
import { APPLICATION_TYPE_OPTIONS } from "@/lib/application-type";
import { COUNTRY_RULES, SUPPORTED_COUNTRIES } from "@/lib/countries";
import { maskNameInput, normalizeEnglishChars } from "@/lib/input-masks";
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

function normalizeTurkishPhoneLocal(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("90")) {
    return digits.slice(2, 12);
  }
  if (digits.startsWith("0")) {
    return digits.slice(1, 11);
  }
  return digits.slice(0, 10);
}

function toUppercaseAscii(value: string): string {
  return normalizeEnglishChars(value).toUpperCase();
}

export function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboard, INITIAL_STATE);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [targetCountry, setTargetCountry] = useState("");
  const [applicationType, setApplicationType] = useState("");
  const [appointmentCity, setAppointmentCity] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [applicants, setApplicants] = useState<OnboardApplicantDraft[]>([]);

  const selectedApplicationType = useMemo(
    () =>
      APPLICATION_TYPE_OPTIONS.find((option) => option.value === applicationType) ??
      null,
    [applicationType],
  );

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
    const masked = maskNameInput(value, 120);
    setApplicants((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, fullName: toUppercaseAscii(masked) }
          : item,
      ),
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
          value={fullName}
          onChange={(event) => {
            const masked = maskNameInput(event.target.value, 120);
            setFullName(toUppercaseAscii(masked));
          }}
          autoComplete="name"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Ayşe Yılmaz"
          maxLength={120}
          className="uppercase"
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
        <div className="flex items-center rounded-md border border-input bg-transparent focus-within:ring-2 focus-within:ring-ring/40">
          <span className="border-r border-border/60 px-3 text-sm text-muted-foreground">
            +90
          </span>
          <Input
            id="phone"
            value={phoneLocal}
            onChange={(event) =>
              setPhoneLocal(normalizeTurkishPhoneLocal(event.target.value))
            }
            type="tel"
            autoComplete="tel-national"
            inputMode="numeric"
            placeholder="5xxxxxxxxx"
            maxLength={10}
            className="border-0 focus-visible:ring-0"
            required
          />
        </div>
        <input
          type="hidden"
          name="phone"
          value={phoneLocal ? `+90${phoneLocal}` : ""}
        />
        <p className="text-xs text-muted-foreground">
          Telefon numarasını başında 0 olmadan 10 hane girin.
        </p>
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
        <Label htmlFor="applicationType">Başvuru Türü</Label>
        <Select
          name="applicationType"
          value={applicationType}
          onValueChange={setApplicationType}
          required
        >
          <SelectTrigger id="applicationType" className="w-full">
            <SelectValue placeholder="Başvuru türü seçin" />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedApplicationType?.description ??
            "Başvuru türü, dosyanın operasyon akışını doğru sınıfta takip etmemizi sağlar."}
        </p>
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
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Ek Kişi Ad Soyad"
                  maxLength={120}
                  className="uppercase"
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

