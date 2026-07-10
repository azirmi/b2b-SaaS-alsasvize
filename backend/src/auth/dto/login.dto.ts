import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Payload accepted by `POST /auth/login`. */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
