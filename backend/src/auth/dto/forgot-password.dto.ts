import { IsEmail } from 'class-validator';

/** Payload accepted by `POST /auth/forgot-password`. */
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
