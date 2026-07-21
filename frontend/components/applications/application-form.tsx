"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, type FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { saveApplicationDetails } from "@/lib/actions/applications";
import {
  APPLICATION_FORM_SECTIONS,
  SPONSOR_SECTION_TITLE,
  type ApplicationFieldName,
  type FormField,
} from "@/lib/application-form";
import {
  maskAlphaTextInput,
  maskEnglishNoteInput,
  maskEnglishTextInput,
  maskNameInput,
  normalizeEnglishChars,
  maskPassportNumberInput,
  maskPhoneInput,
  maskTcKimlikInput,
} from "@/lib/input-masks";
import {
  createApplicationFormSchema,
  toApplicationFormDefaults,
  type ApplicationFormValues,
} from "@/lib/validators/application-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationDetailsData, CrmActionState } from "@/lib/types";

interface ApplicationFormPrefill {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  residenceCity?: string | null;
  plannedTravelStartDate?: string | null;
}

const EMPLOYER_FIELD_NAMES = new Set([
  "employerName",
  "employerAddress",
  "employerPhone",
]);

const NAME_FIELD_NAMES = new Set<ApplicationFieldName>([
  "firstName",
  "lastName",
  "maidenSurname",
  "sponsorFullName",
]);

const TC_FIELD_NAMES = new Set<ApplicationFieldName>(["nationalId"]);

const PASSPORT_FIELD_NAMES = new Set<ApplicationFieldName>(["passportNumber"]);

const PHONE_FIELD_NAMES = new Set<ApplicationFieldName>([
  "phone",
  "employerPhone",
]);

const ALPHA_FIELD_NAMES = new Set<ApplicationFieldName>([
  "placeOfBirth",
  "nationality",
  "residenceCity",
  "occupation",
  "educationLevel",
  "passportIssuePlace",
  "appointmentLocation",
  "sponsorRelation",
]);

const UPPERCASE_FIELD_KINDS = new Set(["text", "tel"]);

const UPPERCASE_FIELD_NAMES = new Set<ApplicationFieldName>(
  APPLICATION_FORM_SECTIONS.flatMap((section) =>
    section.fields
      .filter((field) => UPPERCASE_FIELD_KINDS.has(field.kind))
      .map((field) => field.name),
  ),
);

function toUppercaseInput(value: string): string {
  return normalizeEnglishChars(value).toUpperCase();
}

function splitFullName(
  fullName: string | null | undefined,
): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function withCustomerPrefill(
  defaults: ApplicationFormValues,
  prefill?: ApplicationFormPrefill,
): ApplicationFormValues {
  if (!prefill) {
    return defaults;
  }

  const { firstName, lastName } = splitFullName(prefill.fullName);

  return {
    ...defaults,
    firstName: defaults.firstName || firstName,
    lastName: defaults.lastName || lastName,
    email: defaults.email || (prefill.email ?? ""),
    phone: defaults.phone || (prefill.phone ?? ""),
    nationalId: defaults.nationalId || (prefill.nationalId ?? ""),
    residenceCity: defaults.residenceCity || (prefill.residenceCity ?? ""),
    plannedTravelStartDate:
      defaults.plannedTravelStartDate || (prefill.plannedTravelStartDate ?? ""),
  };
}

function maskFieldInput(field: FormField, value: string): string {
  const maxLength = field.maxLength;

  if (TC_FIELD_NAMES.has(field.name)) {
    return maskTcKimlikInput(value);
  }

  if (PASSPORT_FIELD_NAMES.has(field.name)) {
    return maskPassportNumberInput(value);
  }

  if (PHONE_FIELD_NAMES.has(field.name)) {
    return maskPhoneInput(value, maxLength ?? 32);
  }

  if (NAME_FIELD_NAMES.has(field.name)) {
    return maskNameInput(value, maxLength);
  }

  if (ALPHA_FIELD_NAMES.has(field.name)) {
    return maskAlphaTextInput(value, maxLength);
  }

  if (field.kind === "textarea") {
    return maskEnglishNoteInput(value, maxLength);
  }

  if (field.kind === "text") {
    return maskEnglishTextInput(value, maxLength);
  }

  return value;
}

function fieldErrorMessage(
  errors: FieldErrors<ApplicationFormValues>,
  name: keyof ApplicationFormValues,
): string | null {
  const error = errors[name];
  if (!error?.message) {
    return null;
  }
  return String(error.message);
}

interface VisibleFieldMeta {
  name: ApplicationFieldName;
  label: string;
  sectionTitle: string;
}

interface ValidationIssue {
  fieldName: ApplicationFieldName;
  fieldLabel: string;
  sectionTitle: string;
  message: string;
}

function Field({
  field,
  control,
  errors,
}: {
  field: FormField;
  control: ReturnType<typeof useForm<ApplicationFormValues>>["control"];
  errors: FieldErrors<ApplicationFormValues>;
}) {
  const id = `af-${field.name}`;
  const required = field.required !== false;
  const error = fieldErrorMessage(
    errors,
    field.name as keyof ApplicationFormValues,
  );

  return (
    <div className={field.full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={id}>
        {field.label}
        {required ? (
          <span className="ml-1 font-semibold text-red-600 dark:text-red-400">*</span>
        ) : (
          <span className="ml-1 text-xs text-muted-foreground">(Opsiyonel)</span>
        )}
      </Label>
      <Controller
        control={control}
        name={field.name as keyof ApplicationFormValues}
        render={({ field: formField }) => {
          const value = typeof formField.value === "string" ? formField.value : "";
          const shouldUppercase = UPPERCASE_FIELD_NAMES.has(field.name);

          if (field.kind === "select") {
            return (
              <Select
                name={formField.name}
                value={value}
                onValueChange={formField.onChange}
                required={required}
              >
                <SelectTrigger
                  id={id}
                  className={error ? "w-full border-red-500 focus-visible:ring-red-500/30" : "w-full"}
                  aria-invalid={Boolean(error)}
                >
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          if (field.kind === "textarea") {
            return (
              <Textarea
                id={id}
                name={formField.name}
                value={value}
                onChange={(event) =>
                  formField.onChange(maskFieldInput(field, event.target.value))
                }
                onBlur={formField.onBlur}
                ref={formField.ref}
                required={required}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                rows={3}
                aria-invalid={Boolean(error)}
                className={error ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
              />
            );
          }

          if (field.kind === "date") {
            return (
              <LocalizedDatePickerInput
                id={id}
                value={value}
                onChange={formField.onChange}
                required={required}
                placeholder="DD.MM.YYYY"
                className={
                  error
                    ? "border-red-500 focus-visible:ring-red-500/30"
                    : undefined
                }
              />
            );
          }

          if (field.kind === "number") {
            return (
              <Input
                id={id}
                name={formField.name}
                type="number"
                inputMode="numeric"
                value={value}
                onChange={formField.onChange}
                onBlur={formField.onBlur}
                ref={formField.ref}
                required={required}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                className={error ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
              />
            );
          }

          return (
            <Input
              id={id}
              name={formField.name}
              type={field.kind}
              value={value}
              onChange={(event) => {
                const nextValue =
                  field.kind === "text" || field.kind === "tel"
                    ? maskFieldInput(field, event.target.value)
                    : event.target.value;
                const transformedValue = shouldUppercase
                  ? toUppercaseInput(nextValue)
                  : nextValue;
                formField.onChange(transformedValue);
              }}
              onBlur={formField.onBlur}
              ref={formField.ref}
              required={required}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              autoComplete="off"
              autoCapitalize={shouldUppercase ? "characters" : "none"}
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              className={cn(
                shouldUppercase && "uppercase",
                error && "border-red-500 focus-visible:ring-red-500/30",
              )}
            />
          );
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The customer's comprehensive application form ("Başvuru Formu"). Submits via a
 * server action bound to the application id; on success the dashboard subtree
 * revalidates so the saved values re-hydrate and the DOC team sees them.
 */
export function ApplicationForm({
  applicationId,
  applicantIndex,
  details,
  targetCountry,
  customerPrefill,
}: {
  applicationId: string;
  applicantIndex: number;
  details: ApplicationDetailsData | null;
  targetCountry?: string | null;
  customerPrefill?: ApplicationFormPrefill;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CrmActionState>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [validationCardDismissed, setValidationCardDismissed] = useState(false);
  const [successCardDismissed, setSuccessCardDismissed] = useState(false);
  const schema = useMemo(
    () => createApplicationFormSchema(targetCountry),
    [targetCountry],
  );
  const formDefaults = useMemo(
    () => withCustomerPrefill(toApplicationFormDefaults(details), customerPrefill),
    [details, customerPrefill],
  );

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
    mode: "onBlur",
  });

  useEffect(() => {
    form.reset(formDefaults);
  }, [formDefaults, form]);

  const isEmployer = form.watch("isEmployer");
  const hasSponsor = form.watch("hasSponsor");

  const visibleFields = useMemo<VisibleFieldMeta[]>(() => {
    return APPLICATION_FORM_SECTIONS.flatMap((section) => {
      if (!hasSponsor && section.title === SPONSOR_SECTION_TITLE) {
        return [];
      }

      return section.fields
        .filter((field) => !(!isEmployer && EMPLOYER_FIELD_NAMES.has(field.name)))
        .map((field) => ({
          name: field.name,
          label: field.label,
          sectionTitle: section.title,
        }));
    });
  }, [hasSponsor, isEmployer]);

  const visibleFieldMap = useMemo(() => {
    return new Map<ApplicationFieldName, VisibleFieldMeta>(
      visibleFields.map((field) => [field.name, field]),
    );
  }, [visibleFields]);

  useEffect(() => {
    if (!isEmployer) {
      form.setValue("employerName", "", { shouldDirty: false });
      form.setValue("employerAddress", "", { shouldDirty: false });
      form.setValue("employerPhone", "", { shouldDirty: false });
    }
  }, [isEmployer, form]);

  useEffect(() => {
    if (!hasSponsor) {
      form.setValue("sponsorFullName", "", { shouldDirty: false });
      form.setValue("sponsorIdentity", "", { shouldDirty: false });
      form.setValue("sponsorContact", "", { shouldDirty: false });
      form.setValue("sponsorRelation", "", { shouldDirty: false });
    }
  }, [hasSponsor, form]);

  function focusField(fieldName: ApplicationFieldName) {
    const element = document.getElementById(`af-${fieldName}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in element && typeof element.focus === "function") {
      element.focus();
    }
  }

  function collectValidationIssues(
    errors: FieldErrors<ApplicationFormValues>,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [key, error] of Object.entries(errors)) {
      const fieldName = key as ApplicationFieldName;
      const meta = visibleFieldMap.get(fieldName);
      if (!meta) {
        continue;
      }

      const message =
        error && typeof error.message === "string"
          ? error.message
          : "Bu alanı kontrol edin.";
      issues.push({
        fieldName,
        fieldLabel: meta.label,
        sectionTitle: meta.sectionTitle,
        message,
      });
    }

    return issues;
  }

  function onSubmit(values: ApplicationFormValues) {
    setValidationIssues([]);
    setValidationCardDismissed(false);
    setSuccessCardDismissed(false);
    setState({});

    startTransition(async () => {
      const formData = new FormData();
      formData.set("applicantIndex", String(applicantIndex));
      for (const [key, value] of Object.entries(values)) {
        const normalizedValue = String(value ?? "").trim();
        const shouldUppercase = UPPERCASE_FIELD_NAMES.has(
          key as ApplicationFieldName,
        );
        formData.set(
          key,
          shouldUppercase ? toUppercaseInput(normalizedValue) : normalizedValue,
        );
      }
      const result = await saveApplicationDetails(applicationId, {}, formData);
      setState(result);

      if (result.ok) {
        setValidationIssues([]);
      }
    });
  }

  function onInvalid(errors: FieldErrors<ApplicationFormValues>) {
    setState({});

    const issues = collectValidationIssues(errors);
    setValidationIssues(issues);
    setValidationCardDismissed(false);

    if (issues[0]) {
      focusField(issues[0].fieldName);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="space-y-6"
      noValidate
    >
      {validationIssues.length > 0 && !validationCardDismissed ? (
        <div
          className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Formda eksik veya hatalı alanlar var.
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                  Aşağıdaki başlıklara dokunarak ilgili alana gidebilirsiniz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setValidationCardDismissed(true)}
              className="text-amber-900/70 transition-colors hover:text-amber-950 dark:text-amber-100/80 dark:hover:text-amber-100"
              aria-label="Eksik alan kartını kapat"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {validationIssues.map((issue) => (
              <button
                key={`${issue.fieldName}-${issue.message}`}
                type="button"
                onClick={() => focusField(issue.fieldName)}
                className="rounded-md border border-amber-300/70 bg-amber-100/60 px-2.5 py-1 text-left text-xs transition-colors hover:bg-amber-200/80 dark:border-amber-400/40 dark:bg-amber-900/40 dark:hover:bg-amber-800/50"
              >
                <span className="block font-medium">{issue.fieldLabel}</span>
                <span className="block text-[11px] opacity-80">
                  {issue.sectionTitle} · {issue.message}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state.ok && !successCardDismissed ? (
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  Başvuru formunuz oluşturulmuştur.
                </p>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                  Bilgileriniz başarıyla kaydedildi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSuccessCardDismissed(true)}
              className="text-emerald-900/70 transition-colors hover:text-emerald-950 dark:text-emerald-100/80 dark:hover:text-emerald-100"
              aria-label="Başarı kartını kapat"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border border-border/40 bg-card p-4">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Ek Bilgiler
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="isEmployer"
            render={({ field }) => (
              <label className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background px-3 py-2.5 text-sm">
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  aria-label="İşverenim"
                />
                <span>
                  <span className="block font-medium">İşverenim</span>
                  <span className="block text-xs text-muted-foreground">
                    İşveren bilgilerini aktif olarak beyan ediyorum.
                  </span>
                </span>
              </label>
            )}
          />

          <Controller
            control={form.control}
            name="hasSponsor"
            render={({ field }) => (
              <label className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background px-3 py-2.5 text-sm">
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  aria-label="Sponsorum Var"
                />
                <span>
                  <span className="block font-medium">Sponsorum Var</span>
                  <span className="block text-xs text-muted-foreground">
                    Sponsor bilgileri bölümünü doldurmak istiyorum.
                  </span>
                </span>
              </label>
            )}
          />
        </div>
      </fieldset>

      {APPLICATION_FORM_SECTIONS.map((section) => (
        !hasSponsor && section.title === SPONSOR_SECTION_TITLE ? null : (
        <fieldset key={section.title} className="space-y-4">
          <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              if (
                !isEmployer &&
                EMPLOYER_FIELD_NAMES.has(field.name)
              ) {
                return null;
              }
              return (
                <Field
                  key={field.name}
                  field={field}
                  control={form.control}
                  errors={form.formState.errors}
                />
              );
            })}
          </div>
        </fieldset>
        )
      ))}

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Formu Kaydet"}
        </Button>
        {state.ok ? (
          <Button asChild>
            <Link href="/dashboard">Ana Ekrana Dön</Link>
          </Button>
        ) : null}
        {state.error ? (
          <span
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
