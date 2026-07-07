"use client";

import { useActionState, useState } from "react";

import { onboard, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KvkkDialog, TermsDialog } from "@/components/auth/legal-dialogs";

const INITIAL_STATE: AuthFormState = {};

export function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboard, INITIAL_STATE);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
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
        <Input
          id="targetCountry"
          name="targetCountry"
          autoComplete="country-name"
          placeholder="Örn. Almanya"
          maxLength={120}
          required
        />
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
        </p>
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

