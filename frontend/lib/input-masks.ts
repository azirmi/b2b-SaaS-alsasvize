const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

export const TC_KIMLIK_RE = /^\d{11}$/;
export const PASSPORT_NUMBER_RE = /^[UH]\d{8}$/;
export const PHONE_INPUT_RE = /^\+?\d+$/;
export const NAME_INPUT_RE = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
export const ALPHA_TEXT_RE = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
export const ASCII_SINGLE_LINE_RE = /^[\x20-\x7E]*$/;
export const ASCII_MULTILINE_RE = /^[\x09\x0A\x0D\x20-\x7E]*$/;

function clamp(value: string, maxLength?: number): string {
  if (typeof maxLength !== "number" || maxLength <= 0) {
    return value;
  }
  return value.slice(0, maxLength);
}

export function normalizeEnglishChars(value: string): string {
  const mapped = value
    .split("")
    .map((char) => TURKISH_CHAR_MAP[char] ?? char)
    .join("");

  return mapped
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "");
}

export function maskNameInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value)
    .replace(/[^A-Za-z\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\s+/g, "");

  return clamp(normalized, maxLength);
}

export function maskAlphaTextInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value)
    .replace(/[^A-Za-z\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\s+/g, "");

  return clamp(normalized, maxLength);
}

export function maskEnglishTextInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ");

  return clamp(normalized, maxLength);
}

export function maskEnglishNoteInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value).replace(
    /[^\x09\x0A\x0D\x20-\x7E]/g,
    "",
  );

  return clamp(normalized, maxLength);
}

export function maskTcKimlikInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function maskPassportNumberInput(value: string): string {
  const normalized = normalizeEnglishChars(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "";
  }

  let prefix = normalized[0];
  let startIndex = 1;
  if (prefix !== "U" && prefix !== "H") {
    const index = normalized.search(/[UH]/);
    if (index === -1) {
      return "";
    }
    prefix = normalized[index];
    startIndex = index + 1;
  }

  const digits = normalized.slice(startIndex).replace(/\D/g, "").slice(0, 8);
  return `${prefix}${digits}`;
}

export function maskPhoneInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value).replace(/[^\d+]/g, "");
  const hasLeadingPlus = normalized.startsWith("+");
  const digits = normalized.replace(/\D/g, "");
  return clamp(`${hasLeadingPlus ? "+" : ""}${digits}`, maxLength);
}

export function maskDecimalInput(value: string, maxLength?: number): string {
  const normalized = normalizeEnglishChars(value).replace(/,/g, ".");
  let result = "";
  let dotUsed = false;

  for (const char of normalized) {
    if (/\d/.test(char)) {
      result += char;
      continue;
    }
    if (char === "." && !dotUsed) {
      result += char;
      dotUsed = true;
    }
  }

  return clamp(result, maxLength);
}