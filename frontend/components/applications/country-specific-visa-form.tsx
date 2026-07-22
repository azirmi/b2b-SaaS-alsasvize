"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { saveCountrySpecificApplicationDetails } from "@/lib/actions/applications";
import {
  type CountrySpecificFieldDefinition,
  type CountrySpecificFormType,
  getInitialCountrySpecificValues,
} from "@/lib/country-visa-forms";
import type { CrmActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface MissingFieldIssue {
  key: string;
  label: string;
}

function fieldDomId(
  formType: CountrySpecificFormType,
  applicantIndex: number,
  key: string,
): string {
  return `country-form-${formType}-${applicantIndex}-${key}`;
}

export function CountrySpecificVisaForm({
  applicationId,
  applicantIndex,
  formType,
  title,
  notice,
  fields,
  initialValues,
}: {
  applicationId: string;
  applicantIndex: number;
  formType: CountrySpecificFormType;
  title: string;
  notice: string;
  fields: readonly CountrySpecificFieldDefinition[];
  initialValues?: Record<string, string> | null;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CrmActionState>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    getInitialCountrySpecificValues(fields, initialValues),
  );
  const [issues, setIssues] = useState<MissingFieldIssue[]>([]);
  const [issuesDismissed, setIssuesDismissed] = useState(false);
  const [successDismissed, setSuccessDismissed] = useState(false);

  const fieldMap = useMemo(() => {
    return new Map(fields.map((field) => [field.key, field]));
  }, [fields]);

  useEffect(() => {
    setValues(getInitialCountrySpecificValues(fields, initialValues));
    setIssues([]);
    setIssuesDismissed(false);
    setSuccessDismissed(false);
    setState({});
  }, [fields, initialValues, formType, applicantIndex]);

  function updateValue(key: string, value: string) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function focusField(key: string) {
    const element = document.getElementById(fieldDomId(formType, applicantIndex, key));
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in element && typeof element.focus === "function") {
      element.focus();
    }
  }

  function collectMissingFields(): MissingFieldIssue[] {
    return fields
      .filter((field) => (values[field.key] ?? "").trim().length === 0)
      .map((field) => ({ key: field.key, label: field.label }));
  }

  function submitForm() {
    setState({});
    setSuccessDismissed(false);

    const missing = collectMissingFields();
    if (missing.length > 0) {
      setIssues(missing);
      setIssuesDismissed(false);
      focusField(missing[0].key);
      return;
    }

    setIssues([]);

    startTransition(async () => {
      const result = await saveCountrySpecificApplicationDetails(
        applicationId,
        applicantIndex,
        formType,
        values,
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
                key={issue.key}
                type="button"
                onClick={() => {
                  const field = fieldMap.get(issue.key);
                  if (!field) {
                    return;
                  }
                  focusField(field.key);
                }}
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
