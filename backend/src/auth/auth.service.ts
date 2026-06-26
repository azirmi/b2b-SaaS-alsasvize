import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/** bcrypt cost factor. 12 is a solid production default (matches users module). */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Public self-registration for customers.
   *
   * SECURITY: The role is **always** hardcoded to CUSTOMER — the DTO
   * intentionally omits a role field and the ValidationPipe's `whitelist`
   * strips any extra properties, so privilege-escalation is impossible.
   *
   * @throws ConflictException when the email is already taken.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        role: Role.CUSTOMER, // CRITICAL: hardcoded — never trust client input
      },
      omit: { password: true },
    });

    return user;
  }

  /**
   * Authenticates a user by email + password and returns a signed JWT.
   *
   * @throws UnauthorizedException when the email or password is invalid.
   * @throws ForbiddenException when the account is soft-deleted (isActive = false).
   */
  async login(email: string, password: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Use the same generic message whether the user is missing or the password
    // is wrong, to avoid leaking which emails are registered (user enumeration).
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Soft-delete check: deactivated accounts cannot log in.
    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }
}

