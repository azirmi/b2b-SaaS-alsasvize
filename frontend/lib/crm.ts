import type { CrmData } from "./types";

/** Payment plans offered in the Sales CRM finance module. */
export const PAYMENT_TYPES = ["NORMAL", "PREPAID"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Human labels for the payment plans (Turkish, enterprise copy). */
export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  NORMAL: "Peşin Ödeme",
  PREPAID: "Ön Ödemeli",
};

/** Hardcoded currency for the finance module — the platform bills strictly in TL. */
export const CURRENCY = "TL" as const;

/** Formats an amount as a monochrome TL string, e.g. "45.000 TL". */
export function formatTl(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "—";
  }
  return `${amount.toLocaleString("tr-TR")} ${CURRENCY}`;
}

/**
 * Mirrors the backend `isCrmComplete` gate: a sale date, a valid payment type
 * and a positive total — plus a positive upfront installment (0..total,
 * excluding 0) when the plan
 * is prepaid. This is the client-side precondition for enabling
 * "Send to Documents".
 */
export function isCrmComplete(crm: CrmData | null | undefined): boolean {
  if (!crm) {
    return false;
  }
  const hasDate = typeof crm.salesDate === "string" && crm.salesDate.length > 0;
  const validType =
    crm.paymentType === "NORMAL" || crm.paymentType === "PREPAID";
  const validTotal =
    typeof crm.totalAmount === "number" &&
    Number.isFinite(crm.totalAmount) &&
    crm.totalAmount > 0;
  if (!hasDate || !validType || !validTotal) {
    return false;
  }
  if (crm.paymentType === "PREPAID") {
    return (
      typeof crm.upfrontPaid === "number" &&
      Number.isFinite(crm.upfrontPaid) &&
      crm.upfrontPaid > 0 &&
      crm.upfrontPaid <= crm.totalAmount
    );
  }
  return true;
}
