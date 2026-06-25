import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
