import { IsString, Matches } from 'class-validator';

/** POST /applications/:id/dijizin/verify */
export class VerifyDijizinConsentDto {
  @IsString()
  @Matches(/^\d{1,16}$/, {
    message: 'Doğrulama kodu yalnızca rakamlardan oluşmalıdır',
  })
  code!: string;
}
