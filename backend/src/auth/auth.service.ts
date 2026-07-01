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
   * Full customer auto-onboarding:
   *   1. Validate and register the customer (email, password, fullName)
   *   2. Upload passport photo to MinIO
   *   3. In a single Prisma $transaction:
   *      - Create User (role: CUSTOMER)
   *      - Create VisaApplication (SALES_POOL)
   *      - Create Document (PASSPORT, unapproved, ocrStatus: PENDING)
   *      - Create AuditLog (CREATED)
   *
   * SECURITY: Role is hardcoded to CUSTOMER. File type is validated.
   *
   * @throws ConflictException when the email is already taken.
   * @throws BadRequestException when the passport file is missing or invalid.
   */
  async onboard(
    email: string,
    password: string,
    fullName: string,
    passport: Express.Multer.File,
  ) {
    // ── File validation ──────────────────────────────────────────────────
    if (!passport) {
      throw new BadRequestException('Passport file is required');
    }
    if (!ALLOWED_PASSPORT_MIMES.has(passport.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${passport.mimetype}". Allowed: ${[...ALLOWED_PASSPORT_MIMES].join(', ')}`,
      );
    }
    if (passport.size > MAX_PASSPORT_SIZE) {
      throw new BadRequestException(
        `Passport file exceeds the maximum size of ${MAX_PASSPORT_SIZE / (1024 * 1024)} MB`,
      );
    }

    // ── Duplicate email check ────────────────────────────────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // ── Hash password ────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // ── Prepare the MinIO object key ─────────────────────────────────────
    const sanitizedName = this.sanitizeFileName(passport.originalname);
    // We don't have the applicationId yet, so use a placeholder structure.
    // The key will be: onboarding/<userUUID>/<uuid>-<filename>
    const userUuid = randomUUID();
    const fileUuid = randomUUID();
    const objectKey = `onboarding/${userUuid}/${fileUuid}-${sanitizedName}`;

    // ── Upload to MinIO (outside transaction — MinIO is not transactional) ─
    await this.storage.uploadBuffer(
      objectKey,
      passport.buffer,
      passport.mimetype,
    );

    // ── Prisma transaction: create all records atomically ─────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the customer user
      const user = await tx.user.create({
        data: {
          id: userUuid, // reuse the UUID we generated for the object key
          email,
          password: hashedPassword,
          fullName,
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

      // 3. Create the passport document record
      const document = await tx.document.create({
        data: {
          application: { connect: { id: application.id } },
          uploadedBy: { connect: { id: user.id } },
          fileType: FileType.PASSPORT,
          fileUrl: objectKey,
          isApproved: false, // customer upload — requires staff approval
          ocrStatus: OcrStatus.PENDING,
        },
        select: {
          id: true,
          fileType: true,
          isApproved: true,
          ocrStatus: true,
        },
      });

      // 4. Create the audit log entry
      await tx.auditLog.create({
        data: {
          application: { connect: { id: application.id } },
          performedBy: { connect: { id: user.id } },
          actionType: 'CREATED',
          details: {
            method: 'Customer self-onboarded',
            newStage: VisaStage.SALES_POOL,
            passportDocumentId: document.id,
          },
        },
      });

      return { user, application, document };
    });

    return {
      user: result.user,
      application: {
        id: result.application.id,
        currentStage: result.application.currentStage,
        createdAt: result.application.createdAt,
      },
      document: result.document,
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

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private sanitizeFileName(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? 'file';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return cleaned.length > 0 ? cleaned : 'file';
  }
}
