import {
  APPLICATION_FORM_SECTIONS,
  SPONSOR_SECTION_TITLE,
  getCountryExtraSections,
} from "@/lib/application-form";
import type { CountrySpecificFormType } from "@/lib/country-visa-forms";
import type { ApplicationDetailsData } from "@/lib/types";

/**
 * Read-only rendering of the customer's application form ("Başvuru Formu").
 * Used by staff (DOC in particular) to review the exact submitted values
 * alongside the uploaded documents. No inputs — display only. UK/USA
 * applications also render their extra bilgi-form sections from metadata.
 */
export function ApplicationDetailsView({
  details,
  countryFormType = null,
  countryExtraValues = null,
}: {
  details: ApplicationDetailsData;
  countryFormType?: CountrySpecificFormType | null;
  countryExtraValues?: Record<string, string> | null;
}) {
  const countryExtraSections = getCountryExtraSections(countryFormType);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border/40 bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">İşveren Durumu</p>
          <p className="text-sm font-medium">{details.isEmployer ? "Evet" : "Hayır"}</p>
        </div>
        <div className="rounded-md border border-border/40 bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Sponsor Durumu</p>
          <p className="text-sm font-medium">{details.hasSponsor ? "Var" : "Yok"}</p>
        </div>
      </div>

      {APPLICATION_FORM_SECTIONS.map((section) => (
        !details.hasSponsor && section.title === SPONSOR_SECTION_TITLE ? null : (
        <div key={section.title} className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.fields.map((field) => {
              const raw = details[field.name as keyof ApplicationDetailsData];
              const value =
                raw === undefined || raw === null || raw === ""
                  ? "—"
                  : String(raw);
              return (
                <div
                  key={field.name}
                  className={field.full ? "sm:col-span-2" : undefined}
                >
                  <dt className="text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
        )
      ))}

      {countryExtraSections.map((section) => (
        <div key={section.title} className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.fields.map((field) => {
              const raw = countryExtraValues?.[field.name];
              const value =
                raw === undefined || raw === null || raw === "" ? "—" : raw;
              return (
                <div
                  key={field.name}
                  className={field.full ? "sm:col-span-2" : undefined}
                >
                  <dt className="text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
