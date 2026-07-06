"use client";

import { useActionState } from "react";

import { saveApplicationDetails } from "@/lib/actions/applications";
import {
  APPLICATION_FORM_SECTIONS,
  type FormField,
} from "@/lib/application-form";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationDetailsData, CrmActionState } from "@/lib/types";

const INITIAL: CrmActionState = {};

function Field({
  field,
  value,
}: {
  field: FormField;
  value: string;
}) {
  const id = `af-${field.name}`;
  const common = {
    id,
    name: field.name,
    required: true,
  } as const;

  return (
    <div className={field.full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.kind === "select" ? (
        <Select name={field.name} defaultValue={value || undefined} required>
          <SelectTrigger id={id} className="w-full">
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
      ) : field.kind === "textarea" ? (
        <Textarea
          {...common}
          defaultValue={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          rows={3}
        />
      ) : field.kind === "number" ? (
        <Input
          {...common}
          type="number"
          inputMode="numeric"
          defaultValue={value}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
        />
      ) : (
        <Input
          {...common}
          type={field.kind}
          defaultValue={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          autoComplete="off"
        />
      )}
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
  details,
}: {
  applicationId: string;
  details: ApplicationDetailsData | null;
}) {
  const action = saveApplicationDetails.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      {APPLICATION_FORM_SECTIONS.map((section) => (
        <fieldset key={section.title} className="space-y-4">
          <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const raw = details?.[field.name];
              return (
                <Field
                  key={field.name}
                  field={field}
                  value={raw === undefined || raw === null ? "" : String(raw)}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Formu Kaydet"}
        </Button>
        {state.ok ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            Form kaydedildi.
          </span>
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
