export type CountrySpecificFormType = "UK" | "USA";

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .trim();
}

/**
 * Resolves the extra-field bundle a target country needs on top of the standard
 * application form. Everything else falls through to the default Schengen form.
 */
export function detectCountrySpecificFormType(
  targetCountry: string | null | undefined,
): CountrySpecificFormType | null {
  const normalized = normalizeForMatch(targetCountry ?? "");

  if (
    normalized === "ingiltere" ||
    normalized === "uk" ||
    normalized === "united kingdom" ||
    normalized === "birlesik krallik"
  ) {
    return "UK";
  }

  if (
    normalized === "amerika" ||
    normalized === "usa" ||
    normalized === "abd" ||
    normalized === "amerika birlesik devletleri" ||
    normalized === "united states" ||
    normalized === "united states of america"
  ) {
    return "USA";
  }

  return null;
}

/**
 * Reads the country-specific extra answers a customer already saved. They live
 * under `metadata.countrySpecificForms[applicantIndex].fields` and are keyed by
 * the extra field names declared in `application-form.ts`.
 */
export function extractCountryExtraValues(
  metadata: Record<string, unknown> | null | undefined,
  applicantIndex: number,
): Record<string, string> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const formsNode = (metadata as Record<string, unknown>).countrySpecificForms;
  if (!formsNode || typeof formsNode !== "object" || Array.isArray(formsNode)) {
    return {};
  }

  const candidate = (formsNode as Record<string, unknown>)[
    String(applicantIndex)
  ];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }

  const fieldsNode = (candidate as Record<string, unknown>).fields;
  if (!fieldsNode || typeof fieldsNode !== "object" || Array.isArray(fieldsNode)) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldsNode as Record<string, unknown>)) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
}
