import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Payload accepted by `POST /auth/reset-password`. */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
