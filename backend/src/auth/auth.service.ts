import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../documents/storage.service';
import { EmailService } from '../email/email.service';
import {
  ApplicationType,
  FileType,
  OcrStatus,
  Role,
  VisaStage,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { COUNTRY_RULES } from '../visa-applications/country-rules';
import { ACCESS_TOKEN_REMEMBER_EXPIRES_IN } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/** bcrypt cost factor. 12 is a solid production default (matches users module). */
const BCRYPT_SALT_ROUNDS = 12;

/** Allowed MIME types for passport uploads. */
const ALLOWED_PASSPORT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Maximum passport file size: 10 MB. */
const MAX_PASSPORT_SIZE = 10 * 1024 * 1024;
const PASSWORD_RESET_EXPIRES_IN_DEFAULT = '30m';

interface PasswordResetTokenPayload {
  sub: string;
  purpose: 'PASSWORD_RESET';
}

interface OnboardingApplicantInput {
  fullName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
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
      throw new ConflictException('Bu e-posta ile kayıtlı bir hesap zaten var');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        targetCountry: dto.targetCountry,
        appointmentCity: dto.appointmentCity?.trim() || null,
        hasAcceptedKVKK: dto.hasAcceptedKVKK,
        hasAcceptedTerms: dto.hasAcceptedTerms,
        role: Role.CUSTOMER, // CRITICAL: hardcoded — never trust client input
      },
      omit: { password: true },
    });

    return user;
  }

  /**
   * Full customer auto-onboarding:
   *   1. Validate and register the customer (email, password, fullName, phone,
   *      targetCountry)
   *   2. Upload every passport photo (customer + family/friends) to MinIO
   *   3. In a single Prisma $transaction:
   *      - Create User (role: CUSTOMER, legal consent flags set true)
   *      - Create VisaApplication (SALES_POOL)
   *      - Create one Document (PASSPORT, unapproved, ocrStatus: PENDING) per file
   *      - Create AuditLog (CREATED)
   *
   * SECURITY: Role is hardcoded to CUSTOMER. Every file type is validated.
   *
   * @throws ConflictException when the email is already taken.
   * @throws BadRequestException when a passport file is missing or invalid.
   */
  async onboard(
    email: string,
    password: string,
    fullName: string,
    phone: string,
    targetCountry: string,
    appointmentCity: string,
    residenceCity: string,
    plannedTravelDate: string,
    applicationType: ApplicationType,
    extraApplicants: OnboardingApplicantInput[],
    passports: Express.Multer.File[],
  ) {
    const countryRule = COUNTRY_RULES[targetCountry];
    if (!countryRule) {
      throw new BadRequestException('Desteklenmeyen hedef ülke seçimi');
    }
    if (!countryRule.cities.includes(appointmentCity)) {
      throw new BadRequestException(
        'Seçilen ülke için randevu şehri geçersiz',
      );
    }
    if (!residenceCity || typeof residenceCity !== 'string') {
      throw new BadRequestException('İkamet edilen şehir alanı zorunludur');
    }
    const normalizedResidenceCity = residenceCity.trim();
    if (!normalizedResidenceCity) {
      throw new BadRequestException('İkamet edilen şehir alanı zorunludur');
    }
    if (normalizedResidenceCity.length > 120) {
      throw new BadRequestException('İkamet edilen şehir en fazla 120 karakter olabilir');
    }
    if (!plannedTravelDate || typeof plannedTravelDate !== 'string') {
      throw new BadRequestException('Planlanan seyahat tarihi alanı zorunludur');
    }
    const normalizedPlannedTravelDate = plannedTravelDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedPlannedTravelDate)) {
      throw new BadRequestException('Planlanan seyahat tarihi geçerli formatta olmalıdır');
    }
    const parsedPlannedTravelDate = new Date(
      `${normalizedPlannedTravelDate}T00:00:00.000Z`,
    );
    if (Number.isNaN(parsedPlannedTravelDate.getTime())) {
      throw new BadRequestException('Planlanan seyahat tarihi geçersiz');
    }

    // ── File validation ──────────────────────────────────────────────────
    if (!passports || passports.length === 0) {
      throw new BadRequestException('En az bir pasaport dosyası yüklenmelidir');
    }
    const normalizedExtraApplicants = (extraApplicants ?? []).map((applicant) => {
      const normalizedName = applicant.fullName?.trim() ?? '';
      if (!normalizedName) {
        throw new BadRequestException('Ek kişi ad soyad alanı boş bırakılamaz');
      }
      if (normalizedName.length > 120) {
        throw new BadRequestException('Ek kişi ad soyad 120 karakteri aşamaz');
      }
      return { fullName: normalizedName };
    });

    const applicantsToPersist = [
      fullName,
      ...normalizedExtraApplicants.map((applicant) => applicant.fullName),
    ];

    if (applicantsToPersist.length > 10) {
      throw new BadRequestException('Toplam başvuru kişi sayısı en fazla 10 olabilir');
    }
    if (applicantsToPersist.length !== passports.length) {
      throw new BadRequestException(
        'Yüklenen pasaport sayısı, sizinle birlikte toplam başvuru kişi sayısı ile aynı olmalıdır',
      );
    }
    for (const passport of passports) {
      if (!ALLOWED_PASSPORT_MIMES.has(passport.mimetype)) {
        throw new BadRequestException(
          `Geçersiz dosya türü: "${passport.mimetype}". İzin verilenler: ${[...ALLOWED_PASSPORT_MIMES].join(', ')}`,
        );
      }
      if (passport.size > MAX_PASSPORT_SIZE) {
        throw new BadRequestException(
          `"${passport.originalname}" dosyası azami ${MAX_PASSPORT_SIZE / (1024 * 1024)} MB sınırını aşıyor`,
        );
      }
    }

    // ── Duplicate email check ────────────────────────────────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta ile kayıtlı bir hesap zaten var');
    }

    // ── Hash password ────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // ── Prepare the MinIO object keys ────────────────────────────────────
    // We don't have the applicationId yet, so key on the user UUID.
    // Each key: onboarding/<userUUID>/<uuid>-<filename>
    const userUuid = randomUUID();
    const uploads = passports.map((passport) => ({
      key: `onboarding/${userUuid}/${randomUUID()}-${this.sanitizeFileName(passport.originalname)}`,
      buffer: passport.buffer,
      contentType: passport.mimetype,
    }));

    // ── Upload to MinIO (outside transaction — MinIO is not transactional) ─
    await this.storage.uploadBuffers(uploads);

    // ── Prisma transaction: create all records atomically ─────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the customer user
      const user = await tx.user.create({
        data: {
          id: userUuid, // reuse the UUID we generated for the object keys
          email,
          password: hashedPassword,
          fullName,
          phone,
          targetCountry,
          appointmentCity,
          hasAcceptedKVKK: true,
          hasAcceptedTerms: true,
          role: Role.CUSTOMER,
        },
        omit: { password: true },
      });

      // 2. Create the visa application in SALES_POOL
      const application = await tx.visaApplication.create({
        data: {
          customer: { connect: { id: user.id } },
          currentStage: VisaStage.SALES_POOL,
          applicationType,
          residenceCity: normalizedResidenceCity,
          plannedTravelDate: parsedPlannedTravelDate,
          metadata: {
            source: 'onboarding',
            residenceCity: normalizedResidenceCity,
            plannedTravelDate: normalizedPlannedTravelDate,
          },
        },
      });

      // 3. Create a passport document record per uploaded file
      const documents = await Promise.all(
        uploads.map((upload) =>
          tx.document.create({
            data: {
              application: { connect: { id: application.id } },
              uploadedBy: { connect: { id: user.id } },
              fileType: FileType.PASSPORT,
              fileUrl: upload.key,
              isApproved: false, // customer upload — requires staff approval
              ocrStatus: OcrStatus.PENDING,
            },
            select: {
              id: true,
              fileType: true,
              isApproved: true,
              ocrStatus: true,
            },
          }),
        ),
      );

      const applicants = await Promise.all(
        applicantsToPersist.map((applicantFullName) =>
          tx.onboardingApplicant.create({
            data: {
              applicationId: application.id,
              fullName: applicantFullName,
              passportNumber: null,
            },
            select: {
              id: true,
              fullName: true,
            },
          }),
        ),
      );

      // 4. Create the audit log entry
      await tx.auditLog.create({
        data: {
          application: { connect: { id: application.id } },
          performedBy: { connect: { id: user.id } },
          actionType: 'CREATED',
          details: {
            method: 'Customer self-onboarded',
            newStage: VisaStage.SALES_POOL,
            targetCountry,
            applicationType,
            appointmentCity,
            residenceCity: normalizedResidenceCity,
            plannedTravelDate: normalizedPlannedTravelDate,
            applicantCount: applicants.length,
            passportDocumentIds: documents.map((doc) => doc.id),
          },
        },
      });

      return { user, application, documents, applicants };
    });

    return {
      user: result.user,
      application: {
        id: result.application.id,
        currentStage: result.application.currentStage,
        createdAt: result.application.createdAt,
      },
      documents: result.documents,
      applicants: result.applicants,
    };
  }

  /**
   * Authenticates a user by email + password and returns a signed JWT.
   *
   * @throws UnauthorizedException when the email or password is invalid.
   * @throws ForbiddenException when the account is soft-deleted (isActive = false).
   */
  async login(
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Use the same generic message whether the user is missing or the password
    // is wrong, to avoid leaking which emails are registered (user enumeration).
    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    // Soft-delete check: deactivated accounts cannot log in.
    if (!user.isActive) {
      throw new ForbiddenException('Bu hesap devre dışı bırakılmış');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    if (rememberMe) {
      return this.jwt.signAsync(payload, {
        expiresIn: ACCESS_TOKEN_REMEMBER_EXPIRES_IN,
      });
    }
    return this.jwt.signAsync(payload);
  }

  /** Sends a password reset link to a registered account email. */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new BadRequestException('Lütfen hesabınızdaki mail adresini girin');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Lütfen hesabınızdaki mail adresini girin');
    }

    const resetToken = await this.jwt.signAsync(
      {
        sub: user.id,
        purpose: 'PASSWORD_RESET',
      } satisfies PasswordResetTokenPayload,
      {
        expiresIn: this.config.get<string>(
          'PASSWORD_RESET_EXPIRES_IN',
          PASSWORD_RESET_EXPIRES_IN_DEFAULT,
        ) as unknown as JwtSignOptions['expiresIn'],
      },
    );

    await this.email.sendPasswordReset({
      to: user.email,
      customerName: user.fullName,
      resetUrl: this.buildPasswordResetUrl(resetToken),
    });

    return {
      message:
        'Şifre yenileme bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.',
    };
  }

  /** Verifies a password reset token and persists the new account password. */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new BadRequestException('Şifre yenileme bağlantısı geçersiz');
    }

    let payload: PasswordResetTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<PasswordResetTokenPayload>(
        normalizedToken,
      );
    } catch {
      throw new BadRequestException(
        'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş',
      );
    }

    if (payload.purpose !== 'PASSWORD_RESET' || !payload.sub) {
      throw new BadRequestException(
        'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new BadRequestException(
        'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş',
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
    };
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private buildPasswordResetUrl(token: string): string {
    const configuredUrl = this.config.get<string>('PASSWORD_RESET_URL')?.trim();
    const frontendAppUrl =
      this.config.get<string>('FRONTEND_APP_URL')?.trim() ||
      'https://alsasvize.com';
    const baseUrl =
      configuredUrl && configuredUrl.length > 0
        ? configuredUrl
        : `${frontendAppUrl.replace(/\/+$/, '')}/reset-password`;

    const url = new URL(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private sanitizeFileName(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? 'file';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return cleaned.length > 0 ? cleaned : 'file';
  }
}
