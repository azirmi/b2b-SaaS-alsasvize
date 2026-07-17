import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

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
}
