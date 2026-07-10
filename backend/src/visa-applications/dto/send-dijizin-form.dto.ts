import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendDijizinFormDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  formId!: string;
}
