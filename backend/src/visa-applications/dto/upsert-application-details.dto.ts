import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** ISO calendar date, e.g. 2026-07-06. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Payload for `PUT /applications/:id/details` — the customer's comprehensive
 * "Başvuru Formu" (application form). Every field is required: a successful save
 * means the form is complete. DOC staff read this back read-only.
 */
export class UpsertApplicationDetailsDto {
  // ── Personal information ──────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @Matches(ISO_DATE, { message: 'dateOfBirth must be a valid date' })
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nationalId!: string;

  // ── Passport ──────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  passportNumber!: string;

  @Matches(ISO_DATE, { message: 'passportIssueDate must be a valid date' })
  passportIssueDate!: string;

  @Matches(ISO_DATE, { message: 'passportExpiryDate must be a valid date' })
  passportExpiryDate!: string;

  // ── Contact & address ─────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  homeAddress!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  countryOfResidence!: string;

  // ── Travel ────────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  targetCountry!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  visaType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  purposeOfTravel!: string;

  @Matches(ISO_DATE, { message: 'intendedArrivalDate must be a valid date' })
  intendedArrivalDate!: string;

  @Matches(ISO_DATE, { message: 'intendedDepartureDate must be a valid date' })
  intendedDepartureDate!: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  durationOfStayDays!: number;

  // ── Employment & financial ────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  occupation!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  employerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  monthlyIncome!: string;

  // ── Emergency contact ─────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  emergencyContactName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  emergencyContactPhone!: string;
}
