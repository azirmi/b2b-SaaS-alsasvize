import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/enums';

const CREATABLE_ROLES = [Role.SALES, Role.DOC, Role.SEC, Role.CUSTOMER] as const;

/** Payload for `POST /admin/users` (admin only). */
export class CreateAdminUserDto {
  @IsEmail()
  email: string;

  // bcrypt only hashes the first 72 bytes — cap the length to avoid silent truncation.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @IsIn(CREATABLE_ROLES)
  role: Role;
}
