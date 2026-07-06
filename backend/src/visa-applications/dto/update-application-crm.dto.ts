import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** ISO calendar date, e.g. 2026-07-06. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepted payment types for the finance module. */
export const PAYMENT_TYPES = ['NORMAL', 'PREPAID'] as const;

/**
 * Payload for `PATCH /applications/:id` — the Sales CRM + finance data entry.
 * Applicant identity, target country, phone and travel date are pulled from the
 * customer's profile / application form and are NOT submitted here. A successful
 * save is the precondition for advancing out of SALES_PROCESS.
 */
export class UpdateApplicationCrmDto {
  /** Date the sale was closed (YYYY-MM-DD). */
  @Matches(ISO_DATE, { message: 'salesDate must be a valid date' })
  salesDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  residenceCity!: string;

  @IsIn(PAYMENT_TYPES)
  paymentType!: (typeof PAYMENT_TYPES)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000)
  totalAmount!: number;

  /** Required only when paymentType is PREPAID; must not exceed totalAmount. */
  @ValidateIf((o: UpdateApplicationCrmDto) => o.paymentType === 'PREPAID')
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  upfrontPaid?: number;

  /** Uploaded payment receipt (dekont) Document id. */
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'receiptFileId must be a valid document id',
  })
  receiptFileId?: string;
}
