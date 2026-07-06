import { APPLICATION_FORM_SECTIONS } from "@/lib/application-form";
import type { ApplicationDetailsData } from "@/lib/types";

/**
 * Read-only rendering of the customer's application form ("Başvuru Formu").
 * Used by staff (DOC in particular) to review the exact submitted values
 * alongside the uploaded documents. No inputs — display only.
 */
export function ApplicationDetailsView({
  details,
}: {
  details: ApplicationDetailsData;
}) {
  return (
    <div className="space-y-5">
      {APPLICATION_FORM_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.fields.map((field) => {
              const raw = details[field.name];
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
      ))}
    </div>
  );
}
