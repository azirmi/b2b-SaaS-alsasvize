import {
  ApplicationType,
} from '../../generated/prisma/enums';
import {
  ArrayMinSize,
  IsEnum,
  IsArray,
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
  @IsEnum(ApplicationType, {
    message: 'Geçersiz vize türü seçimi',
  })
  applicationType!: ApplicationType;

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

  @IsOptional()
  @IsArray({ message: 'Kişi isimleri liste formatında olmalıdır' })
  @ArrayMinSize(1, { message: 'En az 1 kişi adı girilmelidir' })
  @IsString({ each: true, message: 'Kişi adı metin olmalıdır' })
  @IsNotEmpty({ each: true, message: 'Kişi adı boş olamaz' })
  @MaxLength(120, {
    each: true,
    message: 'Kişi adı en fazla 120 karakter olabilir',
  })
  applicantNames?: string[];
}
