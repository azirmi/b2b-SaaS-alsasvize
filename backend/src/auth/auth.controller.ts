import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';
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
   * Accepts `email`, `password`, `fullName` as text fields and a `passport`
   * file upload. Creates the user, uploads the passport to MinIO, creates the
   * visa application in SALES_POOL, and links the document — all atomically.
   *
   * No guards — this route is intentionally public.
   */
  @Post('onboard')
  @UseInterceptors(FileInterceptor('passport'))
  async onboard(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('fullName') fullName: string,
    @UploadedFile() passport: Express.Multer.File,
  ) {
    // ── Manual field validation (multipart bodies bypass class-validator) ──
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    // Lightweight email format check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('email must be a valid email address');
    }
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('password is required');
    }
    if (password.length < 8 || password.length > 72) {
      throw new BadRequestException(
        'password must be between 8 and 72 characters',
      );
    }
    if (
      !fullName ||
      typeof fullName !== 'string' ||
      fullName.trim().length === 0
    ) {
      throw new BadRequestException('fullName is required');
    }
    if (!passport) {
      throw new BadRequestException('passport file is required');
    }
    return this.authService.onboard(email, password, fullName.trim(), passport);
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
    return { message: 'Login successful' };
  }
  /** Clears the auth cookie. Required because HTTP-only cookies can't be cleared client-side. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { message: 'Logout successful' };
  }
  /** Returns the currently authenticated user. Demonstrates JwtAuthGuard. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
