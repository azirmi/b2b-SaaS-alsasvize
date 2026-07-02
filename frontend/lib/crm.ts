import type { CrmData } from "./types";

/** Currencies offered in the Sales CRM invoice. */
export const CRM_CURRENCIES = ["USD", "EUR", "GBP", "TRY"] as const;

/** Target countries offered in the Sales CRM (common visa destinations). */
export const CRM_TARGET_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Schengen Area",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Ireland",
  "Switzerland",
  "Sweden",
  "United Arab Emirates",
  "Japan",
  "South Korea",
  "Singapore",
] as const;

/**
 * Mirrors the backend `isCrmComplete` gate: every applicant field, target
 * country and currency filled, plus a positive invoice total. This is the
 * client-side precondition for enabling "Send to Documents".
 */
export function isCrmComplete(crm: CrmData | null | undefined): boolean {
  if (!crm) {
    return false;
  }
  const filled = (value: unknown): boolean =>
    typeof value === "string" && value.trim().length > 0;
  return (
    filled(crm.firstName) &&
    filled(crm.lastName) &&
    filled(crm.passportId) &&
    filled(crm.targetCountry) &&
    filled(crm.currency) &&
    typeof crm.totalCost === "number" &&
    Number.isFinite(crm.totalCost) &&
    crm.totalCost > 0
  );
}
