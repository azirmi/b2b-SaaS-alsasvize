import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAppointmentOpsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  appointmentCity!: string;

  @IsDateString()
  appointmentDate!: string;

  @IsDateString()
  travelDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  appointmentExpense?: number;

  @IsUUID('4')
  appointmentConfirmationDocumentId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  linkedApplicationIds?: string[];
}
