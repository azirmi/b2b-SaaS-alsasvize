import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/** ISO calendar date, e.g. 2026-07-06. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Payload for `PUT /applications/:id/details` — the customer's comprehensive
 * "Başvuru Formu" (application form). Draft saves are allowed: empty fields are
 * accepted so customers can continue later, while provided values are still
 * validated for format/length consistency.
 */
export class UpsertApplicationDetailsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kişi sırası geçersiz.' })
  @Min(1, { message: 'Kişi sırası en az 1 olmalıdır.' })
  applicantIndex?: number;

  // ── Personal information ──────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  maidenSurname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => hasText(value))
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maritalStatus?: string;

  // ── Contact & address ─────────────────────────────────────────────────
  @IsOptional()
  @ValidateIf((_, value) => hasText(value))
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  residenceCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  registeredAddress?: string;

  // ── Professional & education ──────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  employmentStatus?: string;

  @IsOptional()
  @IsBoolean()
  isEmployer?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  employerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  employerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  employerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  educationInstitution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  educationLevel?: string;

  // ── Passport ──────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(32)
  passportType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  passportNumber?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => hasText(value))
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  passportIssueDate?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => hasText(value))
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  passportExpiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  passportIssuePlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  appointmentLocation?: string;

  // ── Visa information ──────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @IsIn(['', 'Evet', 'Hayır'])
  fingerprintGiven?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value !== 'string') {
      return true;
    }

    return value.trim().length > 0;
  })
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz' })
  fingerprintDate?: string;

  @IsString()
  @IsIn(['', 'Evet', 'Hayır'])
  @IsOptional()
  schengenAppliedBefore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previousSchengenCountries?: string;

  // ── Travel information ────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  purposeOfTravel?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => hasText(value))
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  plannedTravelStartDate?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => hasText(value))
  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  plannedTravelEndDate?: string;

  // ── Sponsor information ───────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  hasSponsor?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sponsorFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sponsorIdentity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  sponsorContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sponsorRelation?: string;

  @IsOptional()
  @IsObject({ message: 'Ülkeye özel form verisi geçersiz.' })
  countrySpecificFormData?: Record<string, unknown>;
}
