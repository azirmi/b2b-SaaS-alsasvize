import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { EmailService } from '../email/email.service';
import { Prisma } from '../generated/prisma/client';
import { FileType, OcrStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { StorageService } from './storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
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
      select: {
        id: true,
        customerId: true,
        assignedSalesId: true,
        assignedDocId: true,
        assignedSecId: true,
        crmData: {
          select: {
            paymentType: true,
            appointmentDate: true,
          },
        },
        documents: {
          where: { fileType: FileType.APPOINTMENT_CONFIRMATION },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!application) {
      throw new NotFoundException(`Başvuru bulunamadı: ${dto.applicationId}`);
    }

    await this.assertCanUpload(application, actor);
  this.assertCustomerPrepaidUploadAllowed(application, dto.fileType, actor);

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
        fileType: true,
        application: { select: { customerId: true } },
      },
    });
    if (!document) {
      throw new NotFoundException(`Evrak bulunamadı: ${id}`);
    }

    // Customers may only access documents on their own applications; staff see all.
    if (
      actor.role === Role.CUSTOMER &&
      document.application.customerId !== actor.userId
    ) {
      throw new ForbiddenException(
        'Yalnızca kendi başvurularınızdaki evrakları indirebilirsiniz',
      );
    }

    if (actor.role === Role.SALES && document.fileType !== FileType.PASSPORT) {
      throw new ForbiddenException(
        'Satış birimi yalnızca pasaport belgelerini görüntüleyebilir',
      );
    }

    const url = await this.storage.createDownloadUrl(document.fileUrl);
    return { url, expiresIn: this.storage.downloadTtlSeconds };
  }

  /** Approves a document (DOC/ADMIN), clearing any prior rejection — audited. */
  async approve(id: string, actor: AuthenticatedUser) {
    const { updated } = await this.reviewDocument(
      id,
      actor,
      { isApproved: true, rejectionReason: null },
      'DOCUMENT_APPROVED',
    );
    return updated;
  }

  /**
   * Rejects a document with a reason so the customer is prompted to re-upload a
   * replacement (DOC/ADMIN only) — audited, then emails the customer.
   */
  async reject(id: string, dto: RejectDocumentDto, actor: AuthenticatedUser) {
    const reason = dto.reason.trim();
    const { updated, before } = await this.reviewDocument(
      id,
      actor,
      { isApproved: false, rejectionReason: reason },
      'DOCUMENT_REJECTED',
      reason,
    );

    // Fire-and-forget after commit: an SMTP hiccup must never fail the request.
    void this.email.sendDocumentRejected({
      to: before.application.customer.email,
      customerName: before.application.customer.fullName,
      fileType: before.fileType,
      reason,
      currentStage: before.application.currentStage,
      applicationId: updated.applicationId,
    });

    return updated;
  }

  /**
   * Shared review mutation: flips approval/rejection and writes the matching
   * audit entry inside a single transaction (actor from the JWT, before/after
   * snapshot), translating a missing row to 404.
   */
  private async reviewDocument(
    id: string,
    actor: AuthenticatedUser,
    data: { isApproved: boolean; rejectionReason: string | null },
    actionType: 'DOCUMENT_APPROVED' | 'DOCUMENT_REJECTED',
    reason?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.document.findUnique({
          where: { id },
          select: {
            applicationId: true,
            fileType: true,
            isApproved: true,
            rejectionReason: true,
            application: {
              select: {
                currentStage: true,
                customer: { select: { email: true, fullName: true } },
              },
            },
          },
        });
        if (!before) {
          throw new NotFoundException(`Evrak bulunamadı: ${id}`);
        }

        const updated = await tx.document.update({
          where: { id },
          data,
          select: {
            id: true,
            applicationId: true,
            fileType: true,
            isApproved: true,
            rejectionReason: true,
          },
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id: before.applicationId } },
            performedBy: { connect: { id: actor.userId } },
            actionType,
            details: {
              documentId: id,
              fileType: before.fileType,
              before: {
                isApproved: before.isApproved,
                rejectionReason: before.rejectionReason,
              },
              after: data,
              ...(reason ? { reason } : {}),
            },
          },
        });

        return { updated, before };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Evrak bulunamadı: ${id}`);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  /**
   * Deletes a document (its owner customer, or an admin). Removes the row and
   * writes a DOCUMENT_DELETED audit entry in one transaction, then best-effort
   * deletes the stored object.
   */
  async remove(id: string, actor: AuthenticatedUser) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id },
        select: {
          id: true,
          fileUrl: true,
          fileType: true,
          isApproved: true,
          rejectionReason: true,
          applicationId: true,
          application: { select: { customerId: true } },
        },
      });
      if (!document) {
        throw new NotFoundException(`Evrak bulunamadı: ${id}`);
      }

      // Customers may only delete their own documents; admins may delete any.
      if (actor.role !== Role.ADMIN) {
        if (
          actor.role !== Role.CUSTOMER ||
          document.application.customerId !== actor.userId
        ) {
          throw new ForbiddenException(
            'Yalnızca kendi evraklarınızı silebilirsiniz',
          );
        }
      }

      await tx.document.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          application: { connect: { id: document.applicationId } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'DOCUMENT_DELETED',
          details: {
            documentId: id,
            fileType: document.fileType,
            fileUrl: document.fileUrl,
            wasApproved: document.isApproved,
            wasRejected: Boolean(document.rejectionReason),
          },
        },
      });

      return { fileUrl: document.fileUrl };
    });

    // Best-effort object cleanup — never fail the request if storage lags.
    await this.storage.deleteObject(deleted.fileUrl).catch(() => undefined);

    return { id, deleted: true };
  }

  private async assertCanUpload(
    application: {
      customerId: string;
      assignedSalesId: string | null;
      assignedDocId: string | null;
      assignedSecId: string | null;
      crmData?: {
        paymentType: string;
        appointmentDate: Date | null;
      } | null;
      documents?: Array<{ id: string }>;
    },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (actor.role === Role.CUSTOMER) {
      if (application.customerId !== actor.userId) {
        throw new ForbiddenException(
          'Yalnızca kendi başvurularınıza evrak yükleyebilirsiniz',
        );
      }
      return;
    }
    if (actor.role === Role.SALES) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (!staff || application.assignedSalesId !== staff.id) {
        throw new ForbiddenException(
          'Yalnızca size atanmış başvurulara evrak yükleyebilirsiniz',
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
          'Yalnızca size atanmış başvurulara evrak yükleyebilirsiniz',
        );
      }
      return;
    }
    if (actor.role === Role.SEC) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (!staff || application.assignedSecId !== staff.id) {
        throw new ForbiddenException(
          'Yalnızca size atanmış başvurulara evrak yükleyebilirsiniz',
        );
      }
      return;
    }
    throw new ForbiddenException('Bu başvuruya evrak yükleme yetkiniz bulunmuyor');
  }

  private assertCustomerPrepaidUploadAllowed(
    application: {
      crmData?: {
        paymentType: string;
        appointmentDate: Date | null;
      } | null;
      documents?: Array<{ id: string }>;
    },
    requestedFileType: FileType,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role !== Role.CUSTOMER) {
      return;
    }

    const isPrepaid = application.crmData?.paymentType === 'PREPAID';
    if (!isPrepaid) {
      return;
    }

    const hasAppointmentDate = Boolean(application.crmData?.appointmentDate);
    const hasAppointmentConfirmation =
      (application.documents?.length ?? 0) > 0;
    const locked = !hasAppointmentDate || !hasAppointmentConfirmation;
    if (locked && requestedFileType !== FileType.PASSPORT) {
      throw new ForbiddenException(
        'Ön ödemeli başvuruda randevu kesinleşene kadar yalnızca pasaport yüklenebilir',
      );
    }
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
