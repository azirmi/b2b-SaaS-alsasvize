import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

/** Upper bound on passports accepted per onboarding (customer + family/friends). */
const MAX_PASSPORT_FILES = 10;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}
  /**
   * Public self-registration for customers.
   * No guards — this route is intentionally unauthenticated.
   * Role is hardcoded to CUSTOMER in the service layer.
   */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
  /**
   * Full customer auto-onboarding (multipart/form-data).
   *
   * Accepts `email`, `password`, `fullName`, `phone`, `targetCountry`,
   * `hasAcceptedKVKK`, `hasAcceptedTerms` as text fields and one or more
   * `passports` file uploads (customer + family/friends). Creates the user,
   * uploads every passport to MinIO, creates the visa application in
   * SALES_POOL, and links each document — all atomically.
   *
   * No guards — this route is intentionally public.
   */
  @Post('onboard')
  @UseInterceptors(FilesInterceptor('passports', MAX_PASSPORT_FILES))
  async onboard(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('fullName') fullName: string,
    @Body('phone') phone: string,
    @Body('targetCountry') targetCountry: string,
    @Body('hasAcceptedKVKK') hasAcceptedKVKK: string,
    @Body('hasAcceptedTerms') hasAcceptedTerms: string,
    @UploadedFiles() passports: Express.Multer.File[],
  ) {
    // ── Manual field validation (multipart bodies bypass class-validator) ──
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('E-posta alanı zorunludur');
    }
    // Lightweight email format check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-posta adresi geçerli formatta olmalıdır');
    }
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Şifre alanı zorunludur');
    }
    if (password.length < 8 || password.length > 72) {
      throw new BadRequestException(
        'Şifre 8 ile 72 karakter arasında olmalıdır',
      );
    }
    if (
      !fullName ||
      typeof fullName !== 'string' ||
      fullName.trim().length === 0
    ) {
      throw new BadRequestException('Ad Soyad alanı zorunludur');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      throw new BadRequestException('Telefon alanı zorunludur');
    }
    if (
      !targetCountry ||
      typeof targetCountry !== 'string' ||
      targetCountry.trim().length === 0
    ) {
      throw new BadRequestException('Hedef ülke alanı zorunludur');
    }
    // Booleans arrive as strings over multipart — both consents must be "true".
    if (hasAcceptedKVKK !== 'true') {
      throw new BadRequestException('KVKK Aydınlatma Metni onayı zorunludur.');
    }
    if (hasAcceptedTerms !== 'true') {
      throw new BadRequestException(
        'Mesafeli Hizmet Satış Sözleşmesi onayı zorunludur.',
      );
    }
    if (!passports || passports.length === 0) {
      throw new BadRequestException('En az bir pasaport dosyası yüklenmelidir');
    }

    return this.authService.onboard(
      email,
      password,
      fullName.trim(),
      phone.trim(),
      targetCountry.trim(),
      passports,
    );
  }
  /**
   * Validates credentials and sets the JWT as an HTTP-only cookie.
   * The token itself is never returned in the response body.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const token = await this.authService.login(dto.email, dto.password);
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      // Only send over HTTPS in production.
      secure: this.config.get<string>('NODE_ENV') === 'production',
      // 'lax' is fine when the front-end is served same-site; a cross-site
      // deployment would need 'none' + secure: true.
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: '/',
    });
    return { message: 'Giriş başarılı' };
  }
  /** Clears the auth cookie. Required because HTTP-only cookies can't be cleared client-side. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { message: 'Çıkış başarılı' };
  }
  /** Returns the currently authenticated user. Demonstrates JwtAuthGuard. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
