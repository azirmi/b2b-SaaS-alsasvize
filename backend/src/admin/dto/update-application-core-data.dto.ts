import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateApplicationCoreDataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  targetCountry!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  appointmentCity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  residenceCity!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(ISO_DATE_RE, {
    message: 'Planlanan seyahat tarihi YYYY-MM-DD formatında olmalıdır',
  })
  plannedTravelDate!: string;

  @IsOptional()
  @IsInt({ message: 'Kişi sayısı tam sayı olmalıdır' })
  @Min(1, { message: 'Kişi sayısı en az 1 olmalıdır' })
  applicantCount?: number;
}
