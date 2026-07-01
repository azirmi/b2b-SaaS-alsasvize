/**
 * Client-side mirror of the backend Prisma enums.
 * Source of truth: backend/src/generated/prisma/enums.ts — keep in sync.
 */

export const Role = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  DOC: 'DOC',
  SEC: 'SEC',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Department = {
  SALES: 'SALES',
  DOC: 'DOC',
  SEC: 'SEC',
} as const;
export type Department = (typeof Department)[keyof typeof Department];

export const VisaStage = {
  SALES_POOL: 'SALES_POOL',
  SALES_PROCESS: 'SALES_PROCESS',
  DOC_POOL: 'DOC_POOL',
  DOC_PROCESS: 'DOC_PROCESS',
  SEC_POOL: 'SEC_POOL',
  SEC_PROCESS: 'SEC_PROCESS',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
} as const;
export type VisaStage = (typeof VisaStage)[keyof typeof VisaStage];

export const FileType = {
  PASSPORT: 'PASSPORT',
  BANK_STATEMENT: 'BANK_STATEMENT',
  INTENT_LETTER: 'INTENT_LETTER',
  CONSULATE_FORM: 'CONSULATE_FORM',
  OTHER: 'OTHER',
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

export const OcrStatus = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type OcrStatus = (typeof OcrStatus)[keyof typeof OcrStatus];
