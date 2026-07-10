import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyDijizinConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  @Matches(/^[0-9]+$/, {
    message: 'code alanina yalnizca rakam girilebilir',
  })
  code!: string;
}
