import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../documents/storage.service';
import {
  FileType,
  OcrStatus,
  Role,
  VisaStage,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
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
    passports: Express.Multer.File[],
  ) {
    // ── File validation ──────────────────────────────────────────────────
    if (!passports || passports.length === 0) {
      throw new BadRequestException('En az bir pasaport dosyası yüklenmelidir');
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
            passportDocumentIds: documents.map((doc) => doc.id),
          },
        },
      });

      return { user, application, documents };
    });

    return {
      user: result.user,
      application: {
        id: result.application.id,
        currentStage: result.application.currentStage,
        createdAt: result.application.createdAt,
      },
      documents: result.documents,
    };
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
    return this.jwt.signAsync(payload);
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private sanitizeFileName(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? 'file';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return cleaned.length > 0 ? cleaned : 'file';
  }
}
