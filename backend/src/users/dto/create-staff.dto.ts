import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Department } from '../../generated/prisma/enums';

/** Payload for `POST /users/staff` (admin only). */
export class CreateStaffDto {
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

  @IsEnum(Department)
  department: Department;
}
