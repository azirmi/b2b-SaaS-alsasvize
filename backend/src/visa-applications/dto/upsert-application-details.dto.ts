import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
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

/**
 * Payload for `PUT /applications/:id/details` — the customer's comprehensive
 * "Başvuru Formu" (application form). Every field is required: a successful save
 * means the form is complete. DOC staff read this back read-only.
 */
export class UpsertApplicationDetailsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kişi sırası geçersiz.' })
  @Min(0, { message: 'Kişi sırası en az 0 olmalıdır.' })
  applicantIndex?: number;

  // ── Personal information ──────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  maidenSurname?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nationalId!: string;

  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  placeOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nationality!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  gender!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  maritalStatus!: string;

  // ── Contact & address ─────────────────────────────────────────────────
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  residenceCity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  registeredAddress!: string;

  // ── Professional & education ──────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  occupation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  employmentStatus!: string;

  @IsBoolean()
  isEmployer!: boolean;

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  passportType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  passportNumber!: string;

  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  passportIssueDate!: string;

  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  passportExpiryDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  passportIssuePlace!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  appointmentLocation!: string;

  // ── Visa information ──────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @IsIn(['Evet', 'Hayır'])
  fingerprintGiven!: string;

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
  @IsNotEmpty()
  @IsIn(['Evet', 'Hayır'])
  schengenAppliedBefore!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previousSchengenCountries?: string;

  // ── Travel information ────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  purposeOfTravel!: string;

  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  plannedTravelStartDate!: string;

  @Matches(ISO_DATE, { message: 'Geçerli bir tarih giriniz.' })
  plannedTravelEndDate!: string;

  // ── Sponsor information ───────────────────────────────────────────────
  @IsBoolean()
  hasSponsor!: boolean;

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
}
