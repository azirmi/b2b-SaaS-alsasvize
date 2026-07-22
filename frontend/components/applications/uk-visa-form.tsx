"use client";

import { CountrySpecificVisaForm } from "@/components/applications/country-specific-visa-form";
import {
  UK_FORM_NOTICE,
  UK_VISA_FIELDS,
} from "@/lib/country-visa-forms";

export function UKVisaForm({
  applicationId,
  applicantIndex,
  initialValues,
}: {
  applicationId: string;
  applicantIndex: number;
  initialValues?: Record<string, string> | null;
}) {
  return (
    <CountrySpecificVisaForm
      applicationId={applicationId}
      applicantIndex={applicantIndex}
      formType="UK"
      title="İNGİLTERE VİZE BİLGİ FORMU"
      notice={UK_FORM_NOTICE}
      fields={UK_VISA_FIELDS}
      initialValues={initialValues}
    />
  );
}
