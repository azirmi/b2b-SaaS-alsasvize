import {
  Equals,
  IsBoolean,
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetCountry: string;

  // Legal consent — registration is rejected unless both are explicitly true.
  @IsBoolean()
  @Equals(true, { message: 'KVKK Aydınlatma Metni onayı zorunludur.' })
  hasAcceptedKVKK: boolean;

  @IsBoolean()
  @Equals(true, {
    message: 'Mesafeli Hizmet Satış Sözleşmesi onayı zorunludur.',
  })
  hasAcceptedTerms: boolean;
}
