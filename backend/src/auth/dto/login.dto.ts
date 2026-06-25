import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** Payload accepted by `POST /auth/login`. */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
