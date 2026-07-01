import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Prisma } from '../generated/prisma/client';
import { FileType, OcrStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { StorageService } from './storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Authorizes the caller, mints a presigned PUT URL, and records the document.
   *  - Customer uploads start unapproved; staff/admin uploads are auto-approved.
   *  - PASSPORT uploads are queued for the future OCR service (ocrStatus PENDING).
   */
  async createUploadUrl(
    dto: CreatePresignedUploadDto,
    actor: AuthenticatedUser,
  ) {
    const application = await this.prisma.visaApplication.findUnique({
      where: { id: dto.applicationId },
      select: { id: true, customerId: true, assignedDocId: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${dto.applicationId} not found`);
    }

    await this.assertCanUpload(application, actor);

    const isCustomer = actor.role === Role.CUSTOMER;
    const key = this.buildObjectKey(dto.applicationId, dto.fileName);

    const document = await this.prisma.document.create({
      data: {
        application: { connect: { id: dto.applicationId } },
        uploadedBy: { connect: { id: actor.userId } },
        fileType: dto.fileType,
        fileUrl: key,
        // Smart auto-approve: trust staff/admin, gate customers.
        isApproved: !isCustomer,
        // Future-proofing: queue passports for OCR extraction.
        ocrStatus:
          dto.fileType === FileType.PASSPORT ? OcrStatus.PENDING : null,
      },
      select: { id: true, fileType: true, isApproved: true, ocrStatus: true },
    });

    const uploadUrl = await this.storage.createUploadUrl(key);

    return {
      document,
      key,
      uploadUrl,
      expiresIn: this.storage.uploadTtlSeconds,
    };
  }

  /** Mints a presigned GET URL after an ownership/role check. */
  async createDownloadUrl(id: string, actor: AuthenticatedUser) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: {
        fileUrl: true,
        application: { select: { customerId: true } },
      },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Customers may only access documents on their own applications; staff see all.
    if (
      actor.role === Role.CUSTOMER &&
      document.application.customerId !== actor.userId
    ) {
      throw new ForbiddenException(
        'You can only download documents from your own applications',
      );
    }

    const url = await this.storage.createDownloadUrl(document.fileUrl);
    return { url, expiresIn: this.storage.downloadTtlSeconds };
  }

  /** Marks a document approved (DOC/ADMIN only — enforced at the controller). */
  async approve(id: string) {
    try {
      return await this.prisma.document.update({
        where: { id },
        data: { isApproved: true },
        select: {
          id: true,
          applicationId: true,
          fileType: true,
          isApproved: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Document ${id} not found`);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private async assertCanUpload(
    application: { customerId: string; assignedDocId: string | null },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (actor.role === Role.CUSTOMER) {
      if (application.customerId !== actor.userId) {
        throw new ForbiddenException(
          'You can only upload documents to your own applications',
        );
      }
      return;
    }
    if (actor.role === Role.DOC) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (!staff || application.assignedDocId !== staff.id) {
        throw new ForbiddenException(
          'You can only upload documents to applications assigned to you',
        );
      }
      return;
    }
    throw new ForbiddenException('You are not allowed to upload documents');
  }

  private buildObjectKey(applicationId: string, fileName: string): string {
    return `applications/${applicationId}/${randomUUID()}-${this.sanitizeFileName(fileName)}`;
  }

  private sanitizeFileName(fileName: string): string {
    // Strip any path components, then keep a safe character subset.
    const base = fileName.split(/[\\/]/).pop() ?? 'file';
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return cleaned.length > 0 ? cleaned : 'file';
  }
}
