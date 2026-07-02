import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * Payload for `PATCH /applications/:id` — the Sales CRM data entry.
 * All fields are required: a successful save means the CRM record is complete,
 * which is the precondition for advancing out of SALES_PROCESS.
 */
export class UpdateApplicationCrmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  passportId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  targetCountry!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  totalCost!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  currency!: string;
}
