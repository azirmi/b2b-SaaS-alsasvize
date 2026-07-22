"use client";

import { CountrySpecificVisaForm } from "@/components/applications/country-specific-visa-form";
import {
  USA_FORM_NOTICE,
  USA_VISA_FIELDS,
} from "@/lib/country-visa-forms";
import type { ApplicationDetailsData } from "@/lib/types";

export function USAVisaForm({
  applicationId,
  applicantIndex,
  initialValues,
  details,
}: {
  applicationId: string;
  applicantIndex: number;
  initialValues?: Record<string, string> | null;
  details?: ApplicationDetailsData | null;
}) {
  return (
    <CountrySpecificVisaForm
      applicationId={applicationId}
      applicantIndex={applicantIndex}
      formType="USA"
      title="AMERİKA BİLGİ FORMU"
      notice={USA_FORM_NOTICE}
      fields={USA_VISA_FIELDS}
      initialValues={initialValues}
      commonInitialValues={details}
    />
  );
}
