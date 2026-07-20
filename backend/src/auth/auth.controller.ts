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
import { ApplicationType } from '../generated/prisma/enums';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  ACCESS_TOKEN_REMEMBER_MAX_AGE_MS,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** Upper bound on passports accepted per onboarding (customer + family/friends). */
const MAX_PASSPORT_FILES = 10;
const APPLICATION_TYPES = new Set(Object.values(ApplicationType));

interface OnboardingExtraApplicantInput {
  fullName: string;
}

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
    * Accepts `email`, `password`, `fullName`, `phone`, `targetCountry`, `appointmentCity`,
    * `residenceCity`, `plannedTravelDate`,
    * `applicationType`,
    * `groupApplicants` (JSON array of only extra full names),
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
    @Body('appointmentCity') appointmentCity: string,
    @Body('residenceCity') residenceCity: string,
    @Body('plannedTravelDate') plannedTravelDate: string,
    @Body('applicationType') applicationType: string,
    @Body('groupApplicants') groupApplicantsRaw: string,
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
    if (
      !appointmentCity ||
      typeof appointmentCity !== 'string' ||
      appointmentCity.trim().length === 0
    ) {
      throw new BadRequestException('Randevu şehri alanı zorunludur');
    }
    if (
      !residenceCity ||
      typeof residenceCity !== 'string' ||
      residenceCity.trim().length === 0
    ) {
      throw new BadRequestException('İkamet edilen şehir alanı zorunludur');
    }
    if (residenceCity.trim().length > 120) {
      throw new BadRequestException('İkamet edilen şehir en fazla 120 karakter olabilir');
    }
    if (
      !plannedTravelDate ||
      typeof plannedTravelDate !== 'string' ||
      plannedTravelDate.trim().length === 0
    ) {
      throw new BadRequestException('Planlanan seyahat tarihi alanı zorunludur');
    }
    const normalizedPlannedTravelDate = plannedTravelDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedPlannedTravelDate)) {
      throw new BadRequestException('Planlanan seyahat tarihi geçerli formatta olmalıdır');
    }
    const parsedPlannedTravelDate = new Date(`${normalizedPlannedTravelDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedPlannedTravelDate.getTime())) {
      throw new BadRequestException('Planlanan seyahat tarihi geçersiz');
    }
    if (
      !applicationType ||
      typeof applicationType !== 'string' ||
      applicationType.trim().length === 0
    ) {
      throw new BadRequestException('Başvuru türü alanı zorunludur');
    }
    const normalizedApplicationType = applicationType.trim();
    if (!APPLICATION_TYPES.has(normalizedApplicationType as ApplicationType)) {
      throw new BadRequestException('Geçersiz başvuru türü seçimi');
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

    const extraApplicants = this.parseGroupApplicants(groupApplicantsRaw);
    const totalApplicants = extraApplicants.length + 1;
    if (totalApplicants > MAX_PASSPORT_FILES) {
      throw new BadRequestException(
        `Toplam başvuru kişi sayısı en fazla ${MAX_PASSPORT_FILES} olabilir`,
      );
    }
    if (passports.length !== totalApplicants) {
      throw new BadRequestException(
        'Yüklenen pasaport sayısı, sizinle birlikte toplam başvuru kişi sayısı ile aynı olmalıdır',
      );
    }

    return this.authService.onboard(
      email,
      password,
      fullName.trim(),
      phone.trim(),
      targetCountry.trim(),
      appointmentCity.trim(),
      residenceCity.trim(),
      normalizedPlannedTravelDate,
      normalizedApplicationType as ApplicationType,
      extraApplicants,
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
    const rememberMe = dto.rememberMe === true;
    const token = await this.authService.login(dto.email, dto.password, rememberMe);
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      // Only send over HTTPS in production.
      secure: this.config.get<string>('NODE_ENV') === 'production',
      // 'lax' is fine when the front-end is served same-site; a cross-site
      // deployment would need 'none' + secure: true.
      sameSite: 'lax',
      maxAge: rememberMe ? ACCESS_TOKEN_REMEMBER_MAX_AGE_MS : ACCESS_TOKEN_MAX_AGE_MS,
      path: '/',
    });
    return { message: 'Giriş başarılı' };
  }

  /** Starts the password-reset flow and emails a reset link to the account owner. */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.requestPasswordReset(dto.email);
  }

  /** Verifies a reset token and updates the account password. */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.token, dto.password);
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

  private parseGroupApplicants(raw?: string): OnboardingExtraApplicantInput[] {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Başvuru kişi listesi geçersiz formatta');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('Başvuru kişi listesi geçersiz formatta');
    }
    if (parsed.length > MAX_PASSPORT_FILES - 1) {
      throw new BadRequestException(
        `En fazla ${MAX_PASSPORT_FILES - 1} ek kişi eklenebilir`,
      );
    }

    return parsed.map((item, index) => {
      const entry = item as Partial<OnboardingExtraApplicantInput>;
      const fullName =
        typeof item === 'string'
          ? item.trim()
          : typeof entry.fullName === 'string'
            ? entry.fullName.trim()
            : '';

      if (!fullName) {
        throw new BadRequestException(
          `${index + 2}. kişi için ad soyad zorunludur`,
        );
      }
      if (fullName.length > 120) {
        throw new BadRequestException(
          `${index + 2}. kişi için ad soyad 120 karakteri aşamaz`,
        );
      }

      return { fullName };
    });
  }
}
