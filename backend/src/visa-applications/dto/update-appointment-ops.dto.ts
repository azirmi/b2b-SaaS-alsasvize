import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateAppointmentOpsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  appointmentCity!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsDateString()
  travelDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  appointmentExpense?: number;

  @IsUUID('4')
  appointmentConfirmationDocumentId!: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasVisaFee!: boolean;

  @ValidateIf((dto: UpdateAppointmentOpsDto) => dto.hasVisaFee)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  visaFeeAmount?: number;

  @ValidateIf((dto: UpdateAppointmentOpsDto) => dto.hasVisaFee)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'visaFeeReceiptDocumentId must be a valid document id',
  })
  visaFeeReceiptDocumentId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  linkedApplicationIds?: string[];
}
