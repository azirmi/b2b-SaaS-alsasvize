import 'dotenv/config';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';

import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { Role, VisaStage } from '../src/generated/prisma/enums';

const DEFAULT_FILE_NAME = 'SIFIR_YENI_SHEETS_DDMMYYYY_DUZELTILMIS_2.xlsx';
const FALLBACK_FILE_NAME = 'SIFIR_YENI_SHEETS_DDMMYYYY_DUZELTILMIS.xlsx';
const DUMMY_EMAIL_DOMAIN = 'excel-import.local';
const DUMMY_PASSWORD = 'ImportedCustomer#2026';
const BCRYPT_SALT_ROUNDS = 12;
const EUR_TO_TRY = 53.99;
const USD_TO_TRY = 47.35;

type ImportStatus = 'COMPLETED' | 'IN_PROGRESS';
type CrmPaymentType = 'NORMAL' | 'PREPAID';

type NormalizedRow = Record<string, unknown>;

type PreparedRow = {
  sheetName: string;
  excelRowNumber: number;
  sourceKey: string;
  fullName: string;
  phone: string | null;
  targetCountry: string | null;
  salesDate: Date;
  totalAmount: number;
  upfrontPaid: number;
  remainingPayment: number;
  paymentType: CrmPaymentType;
  stage: VisaStage;
  status: ImportStatus;
  randevuRaw: string;
  originalSalesAmountRaw: string;
  originalDownPaymentRaw: string;
  originalRemainingPaymentRaw: string;
  email: string;
};

type ImportStats = {
  processed: number;
  insertedUsers: number;
  updatedUsers: number;
  insertedApplications: number;
  updatedApplications: number;
  upsertedCrmRows: number;
  skippedEmptyName: number;
  fallbackDateCount: number;
  fallbackAmountCount: number;
  failedRows: number;
};

function parseArgs(argv: string[]) {
  let file = '';
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (token === '--file') {
      file = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (!file && token.trim()) {
      file = token;
    }
  }

  return { file: file.trim(), dryRun };
}

function normalizeTurkishToAscii(value: string): string {
  return value
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'I')
    .replace(/\u015E/g, 'S')
    .replace(/\u015F/g, 'S')
    .replace(/\u011E/g, 'G')
    .replace(/\u011F/g, 'G')
    .replace(/\u00DC/g, 'U')
    .replace(/\u00FC/g, 'U')
    .replace(/\u00D6/g, 'O')
    .replace(/\u00F6/g, 'O')
    .replace(/\u00C7/g, 'C')
    .replace(/\u00E7/g, 'C');
}

function normalizeHeaderKey(header: string): string {
  const compact = header.trim().replace(/\s+/g, ' ');
  if (!compact) {
    return '';
  }

  const upper = compact.toLocaleUpperCase('tr-TR');
  return normalizeTurkishToAscii(upper);
}

function normalizeRow(rawRow: Record<string, unknown>): NormalizedRow {
  const normalized: NormalizedRow = {};

  for (const [header, value] of Object.entries(rawRow)) {
    const key = normalizeHeaderKey(header);
    if (!key) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function getCell(row: NormalizedRow, ...candidateHeaders: string[]): unknown {
  for (const candidate of candidateHeaders) {
    const normalizedCandidate = normalizeHeaderKey(candidate);
    if (normalizedCandidate in row) {
      return row[normalizedCandidate];
    }
  }
  return undefined;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function cleanPhone(raw: unknown): string | null {
  const compact = textValue(raw).replace(/\s+/g, '');
  if (!compact) {
    return null;
  }

  const digitsOnly = compact.replace(/\D+/g, '');
  if (!digitsOnly) {
    return compact;
  }

  if (digitsOnly.length === 10 && digitsOnly.startsWith('5')) {
    return `0${digitsOnly}`;
  }

  return digitsOnly;
}

function standardizeCountry(raw: unknown): string | null {
  const country = textValue(raw);
  if (!country) {
    return null;
  }

  const upper = country.toLocaleUpperCase('tr-TR').trim();
  if (upper === 'YUNANISTAN') {
    return 'YUNAN\u0130STAN';
  }

  return upper;
}

function parseExcelDate(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(raw.getTime());
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H ?? 0,
        parsed.M ?? 0,
        Math.floor(parsed.S ?? 0),
      );
    }

    const unixMs = Math.round((raw - 25569) * 86400 * 1000);
    const fallback = new Date(unixMs);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  const text = textValue(raw);
  if (!text) {
    return null;
  }

  const dmy = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const yearPart = Number(dmy[3]);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    const hours = dmy[4] ? Number(dmy[4]) : 0;
    const minutes = dmy[5] ? Number(dmy[5]) : 0;
    const seconds = dmy[6] ? Number(dmy[6]) : 0;

    const candidate = new Date(year, month - 1, day, hours, minutes, seconds);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return candidate;
    }
  }

  const iso = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const hours = iso[4] ? Number(iso[4]) : 0;
    const minutes = iso[5] ? Number(iso[5]) : 0;
    const seconds = iso[6] ? Number(iso[6]) : 0;

    const candidate = new Date(year, month - 1, day, hours, minutes, seconds);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return candidate;
    }
  }

  const nativeParsed = new Date(text);
  if (!Number.isNaN(nativeParsed.getTime())) {
    return nativeParsed;
  }

  return null;
}

function parseAmount(raw: unknown): number | null {
  const text = textValue(raw);
  if (!text) {
    return null;
  }

  const parseNumericPart = (source: string): number | null => {
    const compact = source.replace(/\s+/g, '');
    const numberTokens = compact.match(/-?\d+[\d.,]*/g);
    const lastToken = numberTokens?.[numberTokens.length - 1] ?? '';
    if (!lastToken) {
      return null;
    }

    let normalized = lastToken;

    if (normalized.includes(',') && normalized.includes('.')) {
      if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
        normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }
    } else if (normalized.includes(',')) {
      const parts = normalized.split(',');
      const decimalPart = parts[parts.length - 1] ?? '';

      if (decimalPart.length > 0 && decimalPart.length <= 2) {
        normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }
    } else {
      normalized = normalized.replace(/\.(?=\d{3}(\D|$))/g, '');
    }

    normalized = normalized.replace(/[^\d.-]/g, '');
    if (!normalized) {
      return null;
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount)) {
      return null;
    }

    return amount;
  };

  const baseAmount = parseNumericPart(text);
  if (baseAmount === null) {
    return null;
  }

  const upper = text.toLocaleUpperCase('tr-TR');
  if (upper.includes('USD') || text.includes('$')) {
    return baseAmount * USD_TO_TRY;
  }

  if (upper.includes('TL') || upper.includes('TRY')) {
    return baseAmount;
  }

  if (upper.includes('EUR') || upper.includes('EURO') || text.includes('€')) {
    return baseAmount * EUR_TO_TRY;
  }

  const hasLetters = /[A-Z\u00C0-\u024F]/i.test(text);
  const hasCurrencySymbol = /[$€₺]/.test(text);

  if (!hasLetters && !hasCurrencySymbol) {
    return baseAmount * EUR_TO_TRY;
  }

  return null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function resolveWorkbookPath(argumentFile: string): string {
  const desiredName = argumentFile || DEFAULT_FILE_NAME;
  const desiredPath = path.resolve(process.cwd(), desiredName);

  if (existsSync(desiredPath)) {
    return desiredPath;
  }

  if (!argumentFile) {
    const fallbackPath = path.resolve(process.cwd(), FALLBACK_FILE_NAME);
    if (existsSync(fallbackPath)) {
      console.warn(
        `Warning: ${DEFAULT_FILE_NAME} was not found. Falling back to ${FALLBACK_FILE_NAME}.`,
      );
      return fallbackPath;
    }
  }

  throw new Error(
    `Excel file not found: ${desiredPath}. ` +
      'Pass --file <path> with the correct workbook location.',
  );
}

function buildDummyEmail(sourceKey: string): string {
  const digest = createHash('sha1').update(sourceKey).digest('hex').slice(0, 18);
  return `excel-${digest}@${DUMMY_EMAIL_DOMAIN}`;
}

function toImportMetadata(
  row: PreparedRow,
  workbookFileName: string,
): Prisma.InputJsonValue {
  return {
    importSource: 'excel',
    importFile: workbookFileName,
    importSheet: row.sheetName,
    importRow: row.excelRowNumber,
    importSourceKey: row.sourceKey,
    status: row.status,
    randevuValue: row.randevuRaw || '',
    originalSalesAmountRaw: row.originalSalesAmountRaw || '',
    originalDownPaymentRaw: row.originalDownPaymentRaw || '',
    originalRemainingPaymentRaw: row.originalRemainingPaymentRaw || '',
    parsedDownPaymentTl: row.upfrontPaid,
    parsedRemainingPaymentTl: row.remainingPayment,
    resolvedPaymentType: row.paymentType,
  } satisfies Record<string, Prisma.InputJsonValue>;
}

function extractJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, Prisma.InputJsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Prisma.InputJsonValue>;
}

function prepareRow(
  rawRow: Record<string, unknown>,
  sheetName: string,
  excelRowNumber: number,
  workbookFileName: string,
):
  | { prepared: PreparedRow }
  | { skipped: 'EMPTY_NAME'; reason: string } {
  const row = normalizeRow(rawRow);

  const firstName = textValue(getCell(row, 'ISIM'));
  if (!firstName) {
    return { skipped: 'EMPTY_NAME', reason: 'ISIM is empty' };
  }

  const lastName = textValue(getCell(row, 'SOYISIM'));
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const phone = cleanPhone(getCell(row, 'TELEFON'));
  const targetCountry = standardizeCountry(getCell(row, 'ULKE'));

  const parsedSalesDate = parseExcelDate(getCell(row, 'TARIH'));
  const salesDate = parsedSalesDate ?? startOfToday();

  const rawTotalAmount = getCell(row, 'SATIS TUTARI');
  const originalSalesAmountRaw = textValue(rawTotalAmount);
  const parsedAmount = parseAmount(rawTotalAmount);
  const totalAmount = parsedAmount ?? -1;

  const rawDownPayment = getCell(row, 'ALINAN ODEME', 'ALINAN ÖDEME');
  const originalDownPaymentRaw = textValue(rawDownPayment);
  const normalizedDownPaymentRaw = normalizeTurkishToAscii(
    originalDownPaymentRaw.toLocaleUpperCase('tr-TR'),
  );

  const downPayment = normalizedDownPaymentRaw.includes('PESIN')
    ? totalAmount
    : (parseAmount(rawDownPayment) ?? 0);

  const rawRemainingPayment = getCell(row, 'KALAN ODEME', 'KALAN ÖDEME');
  const originalRemainingPaymentRaw = textValue(rawRemainingPayment);
  const normalizedRemainingPaymentRaw = normalizeTurkishToAscii(
    originalRemainingPaymentRaw.toLocaleUpperCase('tr-TR'),
  );

  const remainingPayment =
    normalizedRemainingPaymentRaw.includes('YOK') ||
    normalizedRemainingPaymentRaw.includes('ALINDI')
      ? 0
      : (parseAmount(rawRemainingPayment) ?? 0);

  const paymentType: CrmPaymentType =
    remainingPayment > 0 && !normalizedDownPaymentRaw.includes('PESIN')
      ? 'PREPAID'
      : 'NORMAL';

  const randevuRaw = textValue(getCell(row, 'RANDEVU'));
  const isCompleted = randevuRaw.toLocaleUpperCase('tr-TR') === 'R';

  const stage = isCompleted ? VisaStage.COMPLETED : VisaStage.DOC_POOL;
  const status: ImportStatus = isCompleted ? 'COMPLETED' : 'IN_PROGRESS';

  const sourceKey = `${workbookFileName}|${sheetName}|${excelRowNumber}`;

  return {
    prepared: {
      sheetName,
      excelRowNumber,
      sourceKey,
      fullName,
      phone,
      targetCountry,
      salesDate,
      totalAmount,
      upfrontPaid: downPayment,
      remainingPayment,
      paymentType,
      stage,
      status,
      randevuRaw,
      originalSalesAmountRaw,
      originalDownPaymentRaw,
      originalRemainingPaymentRaw,
      email: buildDummyEmail(sourceKey),
    },
  };
}

async function upsertPreparedRow(
  prisma: PrismaClient,
  row: PreparedRow,
  workbookFileName: string,
  passwordHash: string,
): Promise<{
  insertedUser: boolean;
  insertedApplication: boolean;
}> {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: row.email },
      select: { id: true },
    });

    const user = await tx.user.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        password: passwordHash,
        fullName: row.fullName,
        phone: row.phone,
        targetCountry: row.targetCountry,
        role: Role.CUSTOMER,
        isActive: true,
      },
      update: {
        fullName: row.fullName,
        phone: row.phone,
        targetCountry: row.targetCountry,
        role: Role.CUSTOMER,
        isActive: true,
      },
      select: { id: true },
    });

    const existingApplication = await tx.visaApplication.findFirst({
      where: {
        customerId: user.id,
        metadata: {
          path: ['importSourceKey'],
          equals: row.sourceKey,
        },
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const importMetadata = toImportMetadata(row, workbookFileName);

    const application = existingApplication
      ? await tx.visaApplication.update({
          where: { id: existingApplication.id },
          data: {
            currentStage: row.stage,
            stageUpdatedAt: row.salesDate,
            metadata: {
              ...extractJsonObject(existingApplication.metadata),
              ...extractJsonObject(importMetadata as Prisma.JsonValue),
            },
          },
          select: { id: true },
        })
      : await tx.visaApplication.create({
          data: {
            customer: { connect: { id: user.id } },
            currentStage: row.stage,
            stageUpdatedAt: row.salesDate,
            metadata: importMetadata,
          },
          select: { id: true },
        });

    await tx.applicationCrmData.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        salesDate: row.salesDate,
        appointmentDate: null,
        paymentType: row.paymentType,
        totalAmount: row.totalAmount,
        // Kalan bakiye UI'da totalAmount - upfrontPaid olarak hesaplanir.
        upfrontPaid: row.paymentType === 'PREPAID' ? row.upfrontPaid : null,
      },
      update: {
        salesDate: row.salesDate,
        appointmentDate: null,
        paymentType: row.paymentType,
        totalAmount: row.totalAmount,
        // Kalan bakiye UI'da totalAmount - upfrontPaid olarak hesaplanir.
        upfrontPaid: row.paymentType === 'PREPAID' ? row.upfrontPaid : null,
      },
    });

    return {
      insertedUser: !existingUser,
      insertedApplication: !existingApplication,
    };
  });
}

async function main(): Promise<void> {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  const workbookPath = resolveWorkbookPath(file);
  const workbookFileName = path.basename(workbookPath);

  const workbook = XLSX.readFile(workbookPath, {
    cellDates: true,
    raw: true,
  });

  const stats: ImportStats = {
    processed: 0,
    insertedUsers: 0,
    updatedUsers: 0,
    insertedApplications: 0,
    updatedApplications: 0,
    upsertedCrmRows: 0,
    skippedEmptyName: 0,
    fallbackDateCount: 0,
    fallbackAmountCount: 0,
    failedRows: 0,
  };

  const warnings: string[] = [];

  const connectionString = process.env.DATABASE_URL;
  if (!dryRun && !connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env before running import.',
    );
  }

  const adapter = !dryRun && connectionString
    ? new PrismaPg({ connectionString })
    : null;
  const prisma = adapter ? new PrismaClient({ adapter }) : null;

  const passwordHash = !dryRun
    ? await bcrypt.hash(DUMMY_PASSWORD, BCRYPT_SALT_ROUNDS)
    : '';

  try {
    for (const sheetName of workbook.SheetNames) {
        if (sheetName !== 'ALSAS') continue;
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: null,
        raw: true,
      });

      for (let index = 0; index < rawRows.length; index += 1) {
        const rawRow = rawRows[index] ?? {};
        const excelRowNumber = index + 2;

        const preparedResult = prepareRow(
          rawRow,
          sheetName,
          excelRowNumber,
          workbookFileName,
        );

        if ('skipped' in preparedResult) {
          stats.skippedEmptyName += 1;
          continue;
        }

        stats.processed += 1;

        const normalizedCurrentRow = normalizeRow(rawRow);
        const rawDate = getCell(normalizedCurrentRow, 'TARIH');
        const rawAmount = getCell(normalizedCurrentRow, 'SATIS TUTARI');

        if (!parseExcelDate(rawDate)) {
          stats.fallbackDateCount += 1;
          warnings.push(
            `[${sheetName} #${excelRowNumber}] TARIH parse edilemedi, bugunun tarihi kullanildi.`,
          );
        }

        if (parseAmount(rawAmount) === null) {
          stats.fallbackAmountCount += 1;
          warnings.push(
            `[${sheetName} #${excelRowNumber}] SATIS TUTARI parse edilemedi, -1 kullanildi.`,
          );
        }

        if (dryRun) {
          continue;
        }

        const prepared = preparedResult.prepared;

        try {
          const upsertResult = await upsertPreparedRow(
            prisma as PrismaClient,
            prepared,
            workbookFileName,
            passwordHash,
          );

          if (upsertResult.insertedUser) {
            stats.insertedUsers += 1;
          } else {
            stats.updatedUsers += 1;
          }

          if (upsertResult.insertedApplication) {
            stats.insertedApplications += 1;
          } else {
            stats.updatedApplications += 1;
          }

          stats.upsertedCrmRows += 1;
        } catch (error) {
          stats.failedRows += 1;
          warnings.push(
            `[${sheetName} #${excelRowNumber}] failed: ${(error as Error).message}`,
          );
        }
      }
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }

  const mode = dryRun ? 'DRY RUN' : 'IMPORT';

  console.log('----------------------------------------');
  console.log(`Excel ${mode} summary`);
  console.log(`File: ${workbookPath}`);
  console.log(`Rows prepared for insert/update: ${stats.processed}`);
  console.log(`Skipped (empty ISIM): ${stats.skippedEmptyName}`);
  console.log(`Fallback date used: ${stats.fallbackDateCount}`);
  console.log(`Fallback amount used: ${stats.fallbackAmountCount}`);

  if (!dryRun) {
    console.log(`Users inserted: ${stats.insertedUsers}`);
    console.log(`Users updated: ${stats.updatedUsers}`);
    console.log(`Applications inserted: ${stats.insertedApplications}`);
    console.log(`Applications updated: ${stats.updatedApplications}`);
    console.log(`CRM rows upserted: ${stats.upsertedCrmRows}`);
    console.log(`Failed rows: ${stats.failedRows}`);
  }

  if (warnings.length > 0) {
    console.log('----------------------------------------');
    console.log(`Warnings (${warnings.length}):`);
    for (const warning of warnings.slice(0, 50)) {
      console.log(`- ${warning}`);
    }
    if (warnings.length > 50) {
      console.log(`... and ${warnings.length - 50} more`);
    }
  }

  console.log('----------------------------------------');
  if (!dryRun && stats.failedRows > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Excel import failed:', error);
  process.exit(1);
});
