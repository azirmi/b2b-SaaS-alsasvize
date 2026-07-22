"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { saveCountrySpecificApplicationDetails } from "@/lib/actions/applications";
import {
  type CountrySpecificCommonInput,
  type CountrySpecificFieldDefinition,
  type CountrySpecificFormType,
  getInitialCountrySpecificValues,
} from "@/lib/country-visa-forms";
import type { ApplicationDetailsData, CrmActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface MissingFieldIssue {
  key: string;
  label: string;
  domId: string;
}

function fieldDomId(
  formType: CountrySpecificFormType,
  applicantIndex: number,
  key: string,
): string {
  return `country-form-${formType}-${applicantIndex}-${key}`;
}

function commonFieldDomId(
  formType: CountrySpecificFormType,
  applicantIndex: number,
  key: string,
): string {
  return `country-form-common-${formType}-${applicantIndex}-${key}`;
}

export function CountrySpecificVisaForm({
  applicationId,
  applicantIndex,
  formType,
  title,
  notice,
  fields,
  initialValues,
  commonInitialValues,
}: {
  applicationId: string;
  applicantIndex: number;
  formType: CountrySpecificFormType;
  title: string;
  notice: string;
  fields: readonly CountrySpecificFieldDefinition[];
  initialValues?: Record<string, string> | null;
  commonInitialValues?: ApplicationDetailsData | null;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CrmActionState>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    getInitialCountrySpecificValues(fields, initialValues),
  );
  const [isEmployer, setIsEmployer] = useState(
    Boolean(commonInitialValues?.isEmployer),
  );
  const [hasSponsor, setHasSponsor] = useState(
    Boolean(commonInitialValues?.hasSponsor),
  );
  const [employerName, setEmployerName] = useState(
    commonInitialValues?.employerName ?? "",
  );
  const [employerAddress, setEmployerAddress] = useState(
    commonInitialValues?.employerAddress ?? "",
  );
  const [employerPhone, setEmployerPhone] = useState(
    commonInitialValues?.employerPhone ?? "",
  );
  const [sponsorFullName, setSponsorFullName] = useState(
    commonInitialValues?.sponsorFullName ?? "",
  );
  const [sponsorIdentity, setSponsorIdentity] = useState(
    commonInitialValues?.sponsorIdentity ?? "",
  );
  const [sponsorContact, setSponsorContact] = useState(
    commonInitialValues?.sponsorContact ?? "",
  );
  const [sponsorRelation, setSponsorRelation] = useState(
    commonInitialValues?.sponsorRelation ?? "",
  );
  const [issues, setIssues] = useState<MissingFieldIssue[]>([]);
  const [issuesDismissed, setIssuesDismissed] = useState(false);
  const [successDismissed, setSuccessDismissed] = useState(false);

  useEffect(() => {
    setValues(getInitialCountrySpecificValues(fields, initialValues));
    setIsEmployer(Boolean(commonInitialValues?.isEmployer));
    setHasSponsor(Boolean(commonInitialValues?.hasSponsor));
    setEmployerName(commonInitialValues?.employerName ?? "");
    setEmployerAddress(commonInitialValues?.employerAddress ?? "");
    setEmployerPhone(commonInitialValues?.employerPhone ?? "");
    setSponsorFullName(commonInitialValues?.sponsorFullName ?? "");
    setSponsorIdentity(commonInitialValues?.sponsorIdentity ?? "");
    setSponsorContact(commonInitialValues?.sponsorContact ?? "");
    setSponsorRelation(commonInitialValues?.sponsorRelation ?? "");
    setIssues([]);
    setIssuesDismissed(false);
    setSuccessDismissed(false);
    setState({});
  }, [fields, initialValues, formType, applicantIndex, commonInitialValues]);

  useEffect(() => {
    if (!isEmployer) {
      setEmployerName("");
      setEmployerAddress("");
      setEmployerPhone("");
    }
  }, [isEmployer]);

  useEffect(() => {
    if (!hasSponsor) {
      setSponsorFullName("");
      setSponsorIdentity("");
      setSponsorContact("");
      setSponsorRelation("");
    }
  }, [hasSponsor]);

  function updateValue(key: string, value: string) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function focusDomId(domId: string) {
    const element = document.getElementById(domId);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in element && typeof element.focus === "function") {
      element.focus();
    }
  }

  function collectMissingFields(): MissingFieldIssue[] {
    const missing: MissingFieldIssue[] = fields
      .filter((field) => (values[field.key] ?? "").trim().length === 0)
      .map((field) => ({
        key: field.key,
        label: field.label,
        domId: fieldDomId(formType, applicantIndex, field.key),
      }));

    if (isEmployer) {
      if (!employerName.trim()) {
        missing.push({
          key: "employerName",
          label: "İşveren Adı",
          domId: commonFieldDomId(formType, applicantIndex, "employerName"),
        });
      }
      if (!employerAddress.trim()) {
        missing.push({
          key: "employerAddress",
          label: "İşveren Adresi",
          domId: commonFieldDomId(formType, applicantIndex, "employerAddress"),
        });
      }
    }

    if (hasSponsor) {
      if (!sponsorFullName.trim()) {
        missing.push({
          key: "sponsorFullName",
          label: "Sponsorun Tam Adı",
          domId: commonFieldDomId(formType, applicantIndex, "sponsorFullName"),
        });
      }
      if (!sponsorIdentity.trim()) {
        missing.push({
          key: "sponsorIdentity",
          label: "Sponsorun Kimliği",
          domId: commonFieldDomId(formType, applicantIndex, "sponsorIdentity"),
        });
      }
      if (!sponsorContact.trim()) {
        missing.push({
          key: "sponsorContact",
          label: "Sponsorun İletişim Bilgileri",
          domId: commonFieldDomId(formType, applicantIndex, "sponsorContact"),
        });
      }
      if (!sponsorRelation.trim()) {
        missing.push({
          key: "sponsorRelation",
          label: "Yakınlık Derecesi",
          domId: commonFieldDomId(formType, applicantIndex, "sponsorRelation"),
        });
      }
    }

    return missing;
  }

  function submitForm() {
    setState({});
    setSuccessDismissed(false);

    const missing = collectMissingFields();
    if (missing.length > 0) {
      setIssues(missing);
      setIssuesDismissed(false);
      focusDomId(missing[0].domId);
      return;
    }

    setIssues([]);

    startTransition(async () => {
      const commonPayload: CountrySpecificCommonInput = {
        isEmployer,
        employerName,
        employerAddress,
        employerPhone,
        hasSponsor,
        sponsorFullName,
        sponsorIdentity,
        sponsorContact,
        sponsorRelation,
      };

      const result = await saveCountrySpecificApplicationDetails(
        applicationId,
        applicantIndex,
        formType,
        values,
        commonPayload,
      );
      setState(result);

      if (!result.ok) {
        return;
      }

      setIssues([]);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{notice}</p>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border/40 bg-card p-4">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Ek Bilgiler
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background px-3 py-2.5 text-sm">
            <Checkbox
              checked={isEmployer}
              onCheckedChange={(checked) => setIsEmployer(Boolean(checked))}
              aria-label="İşverenim"
            />
            <span>
              <span className="block font-medium">İşverenim</span>
              <span className="block text-xs text-muted-foreground">
                İşveren bilgilerini aktif olarak beyan ediyorum.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background px-3 py-2.5 text-sm">
            <Checkbox
              checked={hasSponsor}
              onCheckedChange={(checked) => setHasSponsor(Boolean(checked))}
              aria-label="Sponsorum Var"
            />
            <span>
              <span className="block font-medium">Sponsorum Var</span>
              <span className="block text-xs text-muted-foreground">
                Sponsor bilgileri bölümünü doldurmak istiyorum.
              </span>
            </span>
          </label>
        </div>

        {isEmployer ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "employerName")}>İşveren Adı</Label>
              <Input
                id={commonFieldDomId(formType, applicantIndex, "employerName")}
                value={employerName}
                onChange={(event) => setEmployerName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "employerPhone")}>İşveren Telefonu (opsiyonel)</Label>
              <Input
                id={commonFieldDomId(formType, applicantIndex, "employerPhone")}
                value={employerPhone}
                onChange={(event) => setEmployerPhone(event.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "employerAddress")}>İşveren Adresi</Label>
              <Textarea
                id={commonFieldDomId(formType, applicantIndex, "employerAddress")}
                value={employerAddress}
                onChange={(event) => setEmployerAddress(event.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}

        {hasSponsor ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "sponsorFullName")}>Sponsorun Tam Adı</Label>
              <Input
                id={commonFieldDomId(formType, applicantIndex, "sponsorFullName")}
                value={sponsorFullName}
                onChange={(event) => setSponsorFullName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "sponsorIdentity")}>Sponsorun Kimliği</Label>
              <Input
                id={commonFieldDomId(formType, applicantIndex, "sponsorIdentity")}
                value={sponsorIdentity}
                onChange={(event) => setSponsorIdentity(event.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "sponsorContact")}>Sponsorun İletişim Bilgileri (Telefon / E-posta)</Label>
              <Textarea
                id={commonFieldDomId(formType, applicantIndex, "sponsorContact")}
                value={sponsorContact}
                onChange={(event) => setSponsorContact(event.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={commonFieldDomId(formType, applicantIndex, "sponsorRelation")}>Yakınlık Derecesi</Label>
              <Input
                id={commonFieldDomId(formType, applicantIndex, "sponsorRelation")}
                value={sponsorRelation}
                onChange={(event) => setSponsorRelation(event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.key] ?? "";
          const id = fieldDomId(formType, applicantIndex, field.key);
          const isTextarea = field.kind === "textarea";

          return (
            <div
              key={field.key}
              className={isTextarea ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
            >
              <Label htmlFor={id}>{field.label}</Label>
              {isTextarea ? (
                <Textarea
                  id={id}
                  value={value}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  rows={4}
                />
              ) : (
                <Input
                  id={id}
                  type={field.kind === "date" ? "date" : "text"}
                  value={value}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  autoComplete="off"
                />
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {issues.length > 0 && !issuesDismissed ? (
        <div
          className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">Eksik alanlar var.</p>
                <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                  Aşağıdan eksik alanı seçtiğinizde ilgili satıra yönlendirilirsiniz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIssuesDismissed(true)}
              className="text-amber-900/70 transition-colors hover:text-amber-950 dark:text-amber-100/80 dark:hover:text-amber-100"
              aria-label="Eksik alan kartını kapat"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {issues.map((issue) => (
              <button
                key={`${issue.key}-${issue.domId}`}
                type="button"
                onClick={() => focusDomId(issue.domId)}
                className="rounded-md border border-amber-300/70 bg-amber-100/60 px-2.5 py-1 text-left text-xs transition-colors hover:bg-amber-200/80 dark:border-amber-400/40 dark:bg-amber-900/40 dark:hover:bg-amber-800/50"
              >
                {issue.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state.ok && !successDismissed ? (
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium">Başvuru formunuz oluşturulmuştur.</p>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                  Ülkeye özel form bilgileri kaydedildi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSuccessDismissed(true)}
              className="text-emerald-900/70 transition-colors hover:text-emerald-950 dark:text-emerald-100/80 dark:hover:text-emerald-100"
              aria-label="Başarı kartını kapat"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={submitForm}>
          {pending ? "Kaydediliyor…" : "Formu Kaydet"}
        </Button>
        {state.error ? (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
