import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Payload for the public `POST /auth/register` endpoint. */
export class RegisterDto {
  @IsEmail()
  email: string;

  // bcrypt only hashes the first 72 bytes — cap the length to avoid silent truncation.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;
}
