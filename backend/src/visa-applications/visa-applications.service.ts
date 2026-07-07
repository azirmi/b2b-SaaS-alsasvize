import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { EmailService } from '../email/email.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '../generated/prisma/client';
import { Department, Role, VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ForceStageDto } from './dto/force-stage.dto';
import { PauseApplicationDto } from './dto/pause-application.dto';
import { ReassignApplicationDto } from './dto/reassign-application.dto';
import { ResumeApplicationDto } from './dto/resume-application.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { UpdateApplicationCrmDto } from './dto/update-application-crm.dto';
import { UpsertApplicationDetailsDto } from './dto/upsert-application-details.dto';

type AssignmentField = 'assignedSalesId' | 'assignedDocId' | 'assignedSecId';

interface ClaimConfig {
  poolStage: VisaStage;
  processStage: VisaStage;
  assignmentField: AssignmentField;
}

/** Pool -> process stage and assignment column, keyed by staff department. */
const CLAIM_CONFIG: Record<Department, ClaimConfig> = {
  [Department.SALES]: {
    poolStage: VisaStage.SALES_POOL,
    processStage: VisaStage.SALES_PROCESS,
    assignmentField: 'assignedSalesId',
  },
  [Department.DOC]: {
    poolStage: VisaStage.DOC_POOL,
    processStage: VisaStage.DOC_PROCESS,
    assignmentField: 'assignedDocId',
  },
  [Department.SEC]: {
    poolStage: VisaStage.SEC_POOL,
    processStage: VisaStage.SEC_PROCESS,
    assignmentField: 'assignedSecId',
  },
};

interface StageTransition {
  next: VisaStage;
  ownerField: AssignmentField;
}

/** Forward transitions: each *_PROCESS hands off to the next pool (SEC completes). */
const STAGE_TRANSITIONS: Partial<Record<VisaStage, StageTransition>> = {
  [VisaStage.SALES_PROCESS]: {
    next: VisaStage.DOC_POOL,
    ownerField: 'assignedSalesId',
  },
  [VisaStage.DOC_PROCESS]: {
    next: VisaStage.SEC_POOL,
    ownerField: 'assignedDocId',
  },
  [VisaStage.SEC_PROCESS]: {
    next: VisaStage.COMPLETED,
    ownerField: 'assignedSecId',
  },
};

/** Shared, optimized include — only the customer fields a list/detail view needs. */
const APPLICATION_INCLUDE = {
  customer: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.VisaApplicationInclude;

/** Workspace list include — customer plus a document count for at-a-glance triage. */
const ASSIGNED_INCLUDE = {
  customer: { select: { id: true, email: true, fullName: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.VisaApplicationInclude;

/** Admin global-table include — customer, current assignees and a document count. */
const ADMIN_LIST_INCLUDE = {
  customer: { select: { id: true, email: true, fullName: true } },
  assignedSales: { select: { id: true, user: { select: { fullName: true } } } },
  assignedDoc: { select: { id: true, user: { select: { fullName: true } } } },
  assignedSec: { select: { id: true, user: { select: { fullName: true } } } },
  _count: { select: { documents: true } },
} satisfies Prisma.VisaApplicationInclude;

/** Full detail include for GET /applications/:id (passwords omitted everywhere). */
const APPLICATION_DETAIL_INCLUDE = {
  customer: { omit: { password: true } },
  assignedSales: { include: { user: { omit: { password: true } } } },
  assignedDoc: { include: { user: { omit: { password: true } } } },
  assignedSec: { include: { user: { omit: { password: true } } } },
  documents: true,
  details: true,
  crmData: true,
  auditLogs: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.VisaApplicationInclude;

@Injectable()
export class VisaApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly email: EmailService,
  ) {}

  /**
   * Creates an application in SALES_POOL together with its first audit-log
   * entry. The nested write runs in a single implicit transaction.
   */
  async create(dto: CreateApplicationDto, actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(dto, actor);

    return this.prisma.visaApplication.create({
      data: {
        customer: { connect: { id: customerId } },
        currentStage: VisaStage.SALES_POOL,
        auditLogs: {
          create: {
            performedBy: { connect: { id: actor.userId } },
            actionType: 'CREATED',
            details: {
              newStage: VisaStage.SALES_POOL,
              createdByUserId: actor.userId,
            },
          },
        },
      },
      include: APPLICATION_INCLUDE,
    });
  }

  /** Returns the role-appropriate work pool (admins see all in-flight apps). */
  getPool(actor: AuthenticatedUser) {
    return this.prisma.visaApplication.findMany({
      where: this.poolWhere(actor.role),
      include: APPLICATION_INCLUDE,
      orderBy: { stageUpdatedAt: 'asc' }, // longest-waiting first
    });
  }

  /**
   * Staff workspace: the applications the caller is actively working — assigned
   * to them and sitting in their department's *_PROCESS stage. Admins see every
   * in-flight *_PROCESS application across all departments.
   */
  async getAssigned(actor: AuthenticatedUser) {
    if (actor.role === Role.ADMIN) {
      return this.prisma.visaApplication.findMany({
        where: {
          currentStage: {
            in: [
              VisaStage.SALES_PROCESS,
              VisaStage.DOC_PROCESS,
              VisaStage.SEC_PROCESS,
            ],
          },
        },
        include: ASSIGNED_INCLUDE,
        orderBy: { stageUpdatedAt: 'asc' },
      });
    }

    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true, department: true },
    });
    if (!staff) {
      throw new ForbiddenException('Çalışma alanı yalnızca personel hesapları için kullanılabilir');
    }
    const config = CLAIM_CONFIG[staff.department];

    return this.prisma.visaApplication.findMany({
      where: {
        currentStage: config.processStage,
        ...this.assignmentWhere(staff.department, staff.id),
      },
      include: ASSIGNED_INCLUDE,
      orderBy: { stageUpdatedAt: 'asc' },
    });
  }

  /** God-Mode: every application across all stages/departments (admin only). */
  async getAll(filters?: { q?: string; staffId?: string }) {
    const q = filters?.q?.trim();
    const staffId = filters?.staffId?.trim();

    if (staffId && !this.isUuid(staffId)) {
      throw new BadRequestException('Geçersiz personel kimliği formatı');
    }

    const conditions: Prisma.VisaApplicationWhereInput[] = [];
    if (q) {
      const searchConditions: Prisma.VisaApplicationWhereInput[] = [
        {
          customer: {
            fullName: { contains: q, mode: 'insensitive' },
          },
        },
        {
          assignedSales: {
            user: {
              fullName: { contains: q, mode: 'insensitive' },
            },
          },
        },
        {
          assignedDoc: {
            user: {
              fullName: { contains: q, mode: 'insensitive' },
            },
          },
        },
        {
          salesStaff: {
            user: {
              fullName: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];

      if (this.isUuid(q)) {
        searchConditions.push({ id: q });
      }

      conditions.push({
        OR: searchConditions,
      });
    }

    if (staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId },
        select: { userId: true },
      });
      if (!staff) {
        return [];
      }

      conditions.push({
        OR: [
          { assignedSalesId: staffId },
          { assignedDocId: staffId },
          { salesStaffId: staffId },
          {
            auditLogs: {
              some: {
                performedById: staff.userId,
                actionType: { in: ['CLAIMED', 'STAGE_CHANGED'] },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.VisaApplicationWhereInput = conditions.length
      ? { AND: conditions }
      : {};

    return this.prisma.visaApplication.findMany({
      where,
      include: ADMIN_LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  /**
   * Full application detail with customer, assigned staff (passwords omitted),
   * documents and audit logs (newest first). Visibility is enforced per record.
   */
  async findOne(id: string, actor: AuthenticatedUser) {
    const application = await this.prisma.visaApplication.findUnique({
      where: { id },
      include: APPLICATION_DETAIL_INCLUDE,
    });
    if (!application) {
      throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
    }

    await this.assertCanView(application, actor);
    return application;
  }

  /**
   * Atomically claims an application from the caller's pool: assigns it to the
   * caller's staff profile, moves pool -> process, and writes a CLAIMED log.
   */
  async claim(id: string, actor: AuthenticatedUser) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true, department: true },
    });
    if (!staff) {
      // Admins / non-staff have no staff profile, so they can't be assigned.
      throw new ForbiddenException('Başvuru alma işlemini yalnızca personel yapabilir');
    }
    const config = CLAIM_CONFIG[staff.department];

    try {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: {
            currentStage: true,
            assignedSalesId: true,
            assignedDocId: true,
            assignedSecId: true,
          },
        });
        if (!application) {
          throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
        }
        if (application.currentStage !== config.poolStage) {
          throw new ConflictException(
            `Başvuru şu anda ${application.currentStage} aşamasında; ${config.poolStage} havuzundan alınamaz`,
          );
        }
        if (application[config.assignmentField] !== null) {
          throw new ConflictException('Bu başvuru zaten alınmış');
        }

        const { where, data } = this.buildClaimUpdate(id, config, staff.id);
        // Conditional WHERE => atomic compare-and-swap; a racing claim throws P2025.
        const updated = await tx.visaApplication.update({
          where,
          data,
          include: APPLICATION_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'CLAIMED',
            details: {
              previousStage: config.poolStage,
              newStage: config.processStage,
              assignedTo: actor.userId,
              assignedStaffId: staff.id,
            },
          },
        });

        return updated;
      });

      // Broadcast only after the transaction (mutation + audit) has committed,
      // so clients never observe a claim that later rolled back.
      this.events.emitApplicationClaimed({
        applicationId: claimed.id,
        previousStage: config.poolStage,
        newStage: config.processStage,
        department: staff.department,
        claimedByUserId: actor.userId,
        assignedStaffId: staff.id,
        at: new Date().toISOString(),
      });

      return claimed;
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Başvuru az önce başka bir personel tarafından alındı',
      );
    }
  }

  /**
   * Moves an application from its current *_PROCESS stage to the next logical
   * stage, resets stageUpdatedAt, and writes a STAGE_CHANGED log — atomically.
   */
  async transitionStage(
    id: string,
    dto: TransitionStageDto,
    actor: AuthenticatedUser,
  ) {
    try {
      let previousStage!: VisaStage;
      let nextStage!: VisaStage;

      const transitioned = await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: {
            currentStage: true,
            assignedSalesId: true,
            assignedDocId: true,
            assignedSecId: true,
            crmData: true,
          },
        });
        if (!application) {
          throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
        }

        const transition = STAGE_TRANSITIONS[application.currentStage];
        if (!transition) {
          throw new ConflictException(
            `Başvuru ${application.currentStage} aşamasından bir sonraki adıma taşınamaz`,
          );
        }

        previousStage = application.currentStage;
        nextStage = transition.next;

        // Only the staff currently handling the stage (or an admin) may advance it.
        if (actor.role !== Role.ADMIN) {
          const staff = await tx.staff.findUnique({
            where: { userId: actor.userId },
            select: { id: true },
          });
          if (!staff || application[transition.ownerField] !== staff.id) {
            throw new ForbiddenException(
              'Bu başvuru mevcut aşamada size atanmadığı için işlem yapamazsınız',
            );
          }
        }

        // Gating rule: Sales must complete the CRM data entry before the
        // application can be handed off to the Documents pool.
        if (application.currentStage === VisaStage.SALES_PROCESS) {
          if (!this.isCrmComplete(application.crmData)) {
            throw new ConflictException(
              'Belgeler aşamasına göndermeden önce CRM verilerini eksiksiz kaydedin',
            );
          }
        }

        // Gating rule: EVERY uploaded document must be approved before the file
        // can leave DOC_PROCESS. Any pending or rejected file blocks the advance
        // (the customer deletes/replaces rejected files, staff approves them).
        if (application.currentStage === VisaStage.DOC_PROCESS) {
          const [totalDocuments, unapprovedDocuments] = await Promise.all([
            tx.document.count({ where: { applicationId: id } }),
            tx.document.count({
              where: { applicationId: id, isApproved: false },
            }),
          ]);
          if (totalDocuments === 0) {
            throw new ConflictException(
              'Sekreterya aşamasına göndermeden önce en az bir onaylı evrak gereklidir',
            );
          }
          if (unapprovedDocuments > 0) {
            throw new ConflictException(
              `İlerletilemez: ${unapprovedDocuments} evrak henüz onaylanmamış`,
            );
          }
        }

        const updated = await tx.visaApplication.update({
          where: { id, currentStage: application.currentStage },
          data: { currentStage: transition.next, stageUpdatedAt: new Date() },
          include: APPLICATION_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'STAGE_CHANGED',
            details: {
              previousStage: application.currentStage,
              newStage: transition.next,
              performedByUserId: actor.userId,
              ...(dto.note ? { note: dto.note } : {}),
            },
          },
        });

        return updated;
      });

      // Broadcast only after the transaction (mutation + audit) has committed.
      this.events.emitStageChanged({
        applicationId: transitioned.id,
        previousStage,
        newStage: nextStage,
        performedByUserId: actor.userId,
        at: new Date().toISOString(),
      });

      // Fire-and-forget after commit: notify the customer of the milestone
      // (Document Review, Processing, and especially Completed).
      void this.email.sendStageAdvanced({
        to: transitioned.customer.email,
        customerName: transitioned.customer.fullName,
        previousStage,
        newStage: nextStage,
        applicationId: transitioned.id,
      });

      return transitioned;
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Başvurunun aşaması eşzamanlı olarak değişti, lütfen tekrar deneyin',
      );
    }
  }

  /**
   * God-Mode: force-reassign an application's department slot to another staff
   * member, atomically writing a FORCE_REASSIGNED audit entry.
   */
  async reassign(
    id: string,
    dto: ReassignApplicationDto,
    actor: AuthenticatedUser,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.newStaffId },
      select: { id: true, department: true },
    });
    if (!staff) {
      throw new BadRequestException(`Personel bulunamadı: ${dto.newStaffId}`);
    }
    if (staff.department !== dto.department) {
      throw new BadRequestException(
        `${dto.newStaffId} kimlikli personel ${dto.department} biriminde değil`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.visaApplication.findUnique({
        where: { id },
        select: {
          id: true,
          currentStage: true,
          assignedSalesId: true,
          assignedDocId: true,
          assignedSecId: true,
        },
      });
      if (!application) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }
      if (
        application.currentStage === VisaStage.COMPLETED ||
        application.currentStage === VisaStage.CANCELLED
      ) {
        throw new ConflictException(
          'Tamamlanmış veya iptal edilmiş başvurular yeniden atanamaz',
        );
      }

      const targetConfig = CLAIM_CONFIG[dto.department];
      const updateData: Prisma.VisaApplicationUncheckedUpdateInput = {
        ...this.assignmentData(dto.department, dto.newStaffId),
        currentStage: targetConfig.processStage,
        stageUpdatedAt: new Date(),
      };
      if (dto.department === Department.SALES) {
        // Keep historical sales ownership aligned with the forced reassignment.
        updateData.salesStaffId = dto.newStaffId;
      }

      const updated = await tx.visaApplication.update({
        where: { id },
        data: updateData,
        include: APPLICATION_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'FORCE_REASSIGNED',
          details: {
            department: dto.department,
            previousStage: application.currentStage,
            newStage: targetConfig.processStage,
            previousAssignments: {
              assignedSalesId: application.assignedSalesId,
              assignedDocId: application.assignedDocId,
              assignedSecId: application.assignedSecId,
            },
            newStaffId: dto.newStaffId,
          },
        },
      });

      return updated;
    });
  }

  /**
   * God-Mode: immediately cancel an application, atomically writing a
   * FORCE_CANCELLED audit entry.
   */
  async forceCancel(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.visaApplication.findUnique({
        where: { id },
        select: { currentStage: true },
      });
      if (!application) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }
      if (application.currentStage === VisaStage.CANCELLED) {
        throw new ConflictException('Başvuru zaten iptal edilmiş');
      }

      const updated = await tx.visaApplication.update({
        where: { id },
        data: { currentStage: VisaStage.CANCELLED, stageUpdatedAt: new Date() },
        include: APPLICATION_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'FORCE_CANCELLED',
          details: {
            previousStage: application.currentStage,
            newStage: VisaStage.CANCELLED,
          },
        },
      });

      return updated;
    });
  }

  /**
   * God-Mode: force an application into any stage (admin only), bypassing the
   * normal gates for a stuck file. Atomic mutation + FORCE_STAGE_CHANGED audit,
   * then a post-commit stageChanged broadcast.
   */
  async forceStage(id: string, dto: ForceStageDto, actor: AuthenticatedUser) {
    let previousStage!: VisaStage;
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: { currentStage: true },
      });
      if (!before) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }
      previousStage = before.currentStage;

      const app = await tx.visaApplication.update({
        where: { id },
        data: { currentStage: dto.stage, stageUpdatedAt: new Date() },
        include: APPLICATION_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'FORCE_STAGE_CHANGED',
          details: {
            previousStage: before.currentStage,
            newStage: dto.stage,
          },
        },
      });

      return app;
    });

    this.events.emitStageChanged({
      applicationId: id,
      previousStage,
      newStage: dto.stage,
      performedByUserId: actor.userId,
      at: new Date().toISOString(),
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  //  Task 1: Customer-Facing Application List
  // ---------------------------------------------------------------------------

  /**
   * Returns all applications owned by the calling customer.
   * Throws 403 if a non-CUSTOMER user calls this endpoint.
   */
  async getMyApplications(actor: AuthenticatedUser) {
    if (actor.role !== Role.CUSTOMER) {
      throw new ForbiddenException(
        'Bu uç nokta yalnızca müşteriler içindir',
      );
    }

    return this.prisma.visaApplication.findMany({
      where: { customerId: actor.userId },
      include: APPLICATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Sales history ("Geçmiş Satışlarım"): every application this sales rep has
   * processed, regardless of its current pipeline stage. Read-only tracking —
   * the rep sees where each file is and the customer it belongs to.
   */
  async getSalesHistory(actor: AuthenticatedUser) {
    if (actor.role === Role.ADMIN) {
      return this.prisma.visaApplication.findMany({
        where: { salesStaffId: { not: null } },
        include: ASSIGNED_INCLUDE,
        orderBy: { updatedAt: 'desc' },
      });
    }

    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true, department: true },
    });
    if (!staff || staff.department !== Department.SALES) {
      throw new ForbiddenException('Geçmiş satış kaydını yalnızca satış personeli görüntüleyebilir');
    }

    return this.prisma.visaApplication.findMany({
      where: { salesStaffId: staff.id },
      include: ASSIGNED_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  //  Task 2: Pause Application Logic
  // ---------------------------------------------------------------------------

  /**
   * Pauses an in-flight application so it doesn't breach SLA metrics while
   * waiting for external factors (e.g. consulate). The previous stage is
   * persisted in the PAUSED audit entry's `details.previousStage` so it can
   * be restored on resume — no schema migration required.
   */
  async pause(id: string, dto: PauseApplicationDto, actor: AuthenticatedUser) {
    /** Terminal + already-paused stages that cannot be paused. */
    const NON_PAUSABLE: VisaStage[] = [
      VisaStage.COMPLETED,
      VisaStage.CANCELLED,
      VisaStage.PAUSED,
    ];

    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: { currentStage: true },
        });
        if (!application) {
          throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
        }
        if (NON_PAUSABLE.includes(application.currentStage)) {
          throw new ConflictException(
            `Başvuru ${application.currentStage} aşamasında olduğu için duraklatılamaz`,
          );
        }

        const updated = await tx.visaApplication.update({
          where: { id, currentStage: application.currentStage },
          data: { currentStage: VisaStage.PAUSED, stageUpdatedAt: new Date() },
          include: APPLICATION_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'PAUSED',
            details: {
              previousStage: application.currentStage,
              newStage: VisaStage.PAUSED,
              performedByUserId: actor.userId,
              ...(dto.reason ? { reason: dto.reason } : {}),
            },
          },
        });

        return updated;
      });
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Başvuru durumu eşzamanlı olarak değişti, lütfen tekrar deneyin',
      );
    }
  }

  // ---------------------------------------------------------------------------
  //  Task 3: Resume Application Logic
  // ---------------------------------------------------------------------------

  /**
   * Resumes a PAUSED application back to the stage it was in before the pause.
   * The original stage is read from the most recent PAUSED audit-log entry's
   * `details.previousStage`. Resets `stageUpdatedAt` to restart the SLA clock.
   */
  async resume(
    id: string,
    dto: ResumeApplicationDto,
    actor: AuthenticatedUser,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: { currentStage: true },
        });
        if (!application) {
          throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
        }
        if (application.currentStage !== VisaStage.PAUSED) {
          throw new ConflictException(
            `Başvuru şu anda ${application.currentStage} aşamasında; duraklatılmış değil`,
          );
        }

        // Find the most recent PAUSED audit entry to recover the previous stage.
        const pausedLog = await tx.auditLog.findFirst({
          where: { applicationId: id, actionType: 'PAUSED' },
          orderBy: { createdAt: 'desc' },
          select: { details: true },
        });
        if (!pausedLog) {
          throw new ConflictException(
            'Duraklatma öncesi aşama belirlenemedi: PAUSED denetim kaydı bulunamadı',
          );
        }

        const details = pausedLog.details as Record<string, unknown>;
        const previousStage = details?.previousStage as VisaStage | undefined;
        if (
          !previousStage ||
          !Object.values(VisaStage).includes(previousStage)
        ) {
          throw new ConflictException(
            'Duraklatma öncesi aşama belirlenemedi: PAUSED denetim kaydı geçersiz',
          );
        }

        const updated = await tx.visaApplication.update({
          where: { id, currentStage: VisaStage.PAUSED },
          data: { currentStage: previousStage, stageUpdatedAt: new Date() },
          include: APPLICATION_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'RESUMED',
            details: {
              previousStage: VisaStage.PAUSED,
              newStage: previousStage,
              performedByUserId: actor.userId,
              ...(dto.note ? { note: dto.note } : {}),
            },
          },
        });

        return updated;
      });
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Başvuru durumu eşzamanlı olarak değişti, lütfen tekrar deneyin',
      );
    }
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  /**
   * Persists the Sales CRM data entry into the application's `metadata.crm`
   * (atomic mutation + CRM_UPDATED audit). Editable by the assigned sales owner
   * while the app is in SALES_PROCESS, or by an admin at any time.
   */
  /**
   * Persists the Sales CRM + finance data entry into a dedicated
   * `ApplicationCrmData` record (atomic upsert + CRM_UPDATED audit). Editable by
   * the assigned sales owner while the app is in SALES_PROCESS, or by an admin
   * at any time. Also stamps the historical `salesStaffId` tracker.
   */
  async updateCrm(
    id: string,
    dto: UpdateApplicationCrmDto,
    actor: AuthenticatedUser,
  ) {
    // Finance guard: a prepaid plan needs an upfront amount within the total.
    if (dto.paymentType === 'PREPAID') {
      if (typeof dto.upfrontPaid !== 'number') {
        throw new BadRequestException(
          'Ön ödemeli plan için upfrontPaid alanı zorunludur',
        );
      }
      if (dto.upfrontPaid > dto.totalAmount) {
        throw new BadRequestException(
          'Ön ödeme tutarı toplam tutarı aşamaz',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: {
          currentStage: true,
          assignedSalesId: true,
          salesStaffId: true,
          crmData: true,
        },
      });
      if (!before) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }

      // Authorization: admin (any time) or the assigned sales owner in-process.
      if (actor.role !== Role.ADMIN) {
        const staff = await tx.staff.findUnique({
          where: { userId: actor.userId },
          select: { id: true, department: true },
        });
        if (
          !staff ||
          staff.department !== Department.SALES ||
          before.assignedSalesId !== staff.id
        ) {
          throw new ForbiddenException(
            'Bu CRM kaydını yalnızca atanan satış personeli düzenleyebilir',
          );
        }
        if (before.currentStage !== VisaStage.SALES_PROCESS) {
          throw new ConflictException(
            'CRM verisi yalnızca başvuru Satış İşlem aşamasındayken düzenlenebilir',
          );
        }
      }

      // A supplied receipt must be a document on this same application.
      if (dto.receiptFileId) {
        const receipt = await tx.document.findUnique({
          where: { id: dto.receiptFileId },
          select: { applicationId: true },
        });
        if (!receipt || receipt.applicationId !== id) {
          throw new BadRequestException(
            'Ödeme dekontu bu başvuruya ait değil',
          );
        }
      }

      const data = {
        salesDate: new Date(dto.salesDate),
        residenceCity: dto.residenceCity.trim(),
        paymentType: dto.paymentType,
        totalAmount: dto.totalAmount,
        upfrontPaid:
          dto.paymentType === 'PREPAID' ? (dto.upfrontPaid ?? 0) : null,
        receiptFileId: dto.receiptFileId ?? null,
        updatedById: actor.userId,
      };

      await tx.applicationCrmData.upsert({
        where: { applicationId: id },
        create: { applicationId: id, ...data },
        update: data,
      });

      // Stamp the historical sales-rep tracker if it isn't set yet.
      if (!before.salesStaffId && before.assignedSalesId) {
        await tx.visaApplication.update({
          where: { id },
          data: { salesStaffId: before.assignedSalesId },
        });
      }

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'CRM_UPDATED',
          details: {
            // JSON round-trip keeps the snapshot JSON-safe (drops Date instances).
            before: before.crmData
              ? (JSON.parse(
                  JSON.stringify(before.crmData),
                ) as Prisma.InputJsonValue)
              : null,
            after: { ...data, salesDate: data.salesDate.toISOString() },
          },
        },
      });

      return tx.visaApplication.findUniqueOrThrow({
        where: { id },
        include: APPLICATION_DETAIL_INCLUDE,
      });
    });
  }

  /**
   * Upserts the customer's comprehensive application form ("Başvuru Formu").
   * Only the owning customer (or an admin) may write it; the form is surfaced
   * read-only to staff through the application detail response. The write and
   * its audit-log entry run in a single transaction.
   */
  async updateDetails(
    id: string,
    dto: UpsertApplicationDetailsDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: { customerId: true, currentStage: true, details: true },
      });
      if (!before) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }

      // Authorization: admin (any time) or the owning customer on a live app.
      if (actor.role !== Role.ADMIN) {
        if (
          actor.role !== Role.CUSTOMER ||
          before.customerId !== actor.userId
        ) {
          throw new ForbiddenException(
            'Yalnızca kendi başvuru formunuzu düzenleyebilirsiniz',
          );
        }
        if (
          before.currentStage === VisaStage.COMPLETED ||
          before.currentStage === VisaStage.CANCELLED
        ) {
          throw new ConflictException(
            'Bu başvuru kapatılmıştır; form artık düzenlenemez',
          );
        }
      }

      const data = {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        maidenSurname: dto.maidenSurname?.trim() || null,
        nationalId: dto.nationalId.trim(),
        dateOfBirth: dto.dateOfBirth,
        placeOfBirth: dto.placeOfBirth.trim(),
        gender: dto.gender.trim(),
        maritalStatus: dto.maritalStatus.trim(),
        nationality: dto.nationality.trim(),

        email: dto.email.trim(),
        phone: dto.phone.trim(),
        registeredAddress: dto.registeredAddress.trim(),

        occupation: dto.occupation.trim(),
        employmentStatus: dto.employmentStatus.trim(),
        employerName: dto.employerName?.trim() || null,
        employerAddress: dto.employerAddress?.trim() || null,
        employerPhone: dto.employerPhone?.trim() || null,
        educationInstitution: dto.educationInstitution?.trim() || null,
        educationLevel: dto.educationLevel?.trim() || null,

        passportType: dto.passportType.trim(),
        passportNumber: dto.passportNumber.trim(),
        passportIssueDate: dto.passportIssueDate,
        passportExpiryDate: dto.passportExpiryDate,
        passportIssuePlace: dto.passportIssuePlace.trim(),
        appointmentLocation: dto.appointmentLocation.trim(),

        fingerprintGiven: dto.fingerprintGiven.trim(),
        fingerprintDate: dto.fingerprintDate ?? null,
        schengenAppliedBefore: dto.schengenAppliedBefore.trim(),
        previousSchengenCountries:
          dto.previousSchengenCountries?.trim() || null,

        purposeOfTravel: dto.purposeOfTravel.trim(),
        plannedTravelDates: dto.plannedTravelDates.trim(),

        sponsorFullName: dto.sponsorFullName?.trim() || null,
        sponsorIdentity: dto.sponsorIdentity?.trim() || null,
        sponsorContact: dto.sponsorContact?.trim() || null,
        sponsorRelation: dto.sponsorRelation?.trim() || null,
      };

      await tx.visaApplicationDetails.upsert({
        where: { applicationId: id },
        create: { applicationId: id, ...data },
        update: data,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: before.details ? 'DETAILS_UPDATED' : 'DETAILS_SUBMITTED',
          details: {
            // JSON round-trip drops Date instances so the snapshot is JSON-safe.
            before: before.details
              ? (JSON.parse(
                  JSON.stringify(before.details),
                ) as Prisma.InputJsonValue)
              : null,
            after: data,
          },
        },
      });

      return tx.visaApplication.findUniqueOrThrow({
        where: { id },
        include: APPLICATION_DETAIL_INCLUDE,
      });
    });
  }

  /**
   * True when the Sales CRM + finance record is complete enough to leave
   * SALES_PROCESS: a sale date, residence city, a valid payment type and a
   * positive total — plus a valid upfront amount (0..total) when PREPAID.
   */
  private isCrmComplete(
    crm:
      | {
          salesDate: Date | null;
          residenceCity: string | null;
          paymentType: string | null;
          totalAmount: number | null;
          upfrontPaid: number | null;
        }
      | null
      | undefined,
  ): boolean {
    if (!crm) {
      return false;
    }
    const hasCity =
      typeof crm.residenceCity === 'string' &&
      crm.residenceCity.trim().length > 0;
    const validType =
      crm.paymentType === 'NORMAL' || crm.paymentType === 'PREPAID';
    const validTotal =
      typeof crm.totalAmount === 'number' &&
      Number.isFinite(crm.totalAmount) &&
      crm.totalAmount > 0;
    if (!crm.salesDate || !hasCity || !validType || !validTotal) {
      return false;
    }
    if (crm.paymentType === 'PREPAID') {
      return (
        typeof crm.upfrontPaid === 'number' &&
        Number.isFinite(crm.upfrontPaid) &&
        crm.upfrontPaid >= 0 &&
        typeof crm.totalAmount === 'number' &&
        crm.upfrontPaid <= crm.totalAmount
      );
    }
    return true;
  }

  /** Resolves the customer id, enforcing that staff target a real active customer. */
  private async resolveCustomerId(
    dto: CreateApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<string> {
    if (actor.role === Role.CUSTOMER) {
      return actor.userId;
    }
    if (!dto.customerId) {
      throw new BadRequestException(
        'Müşteri adına başvuru oluştururken customerId alanı zorunludur',
      );
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: { id: true, role: true, isActive: true },
    });
    if (!customer || customer.role !== Role.CUSTOMER || !customer.isActive) {
      throw new BadRequestException(
        'customerId aktif bir müşteri hesabını göstermelidir',
      );
    }
    return customer.id;
  }

  private poolWhere(role: Role): Prisma.VisaApplicationWhereInput {
    switch (role) {
      case Role.SALES:
        return {
          currentStage: VisaStage.SALES_POOL,
          assignedSalesId: null,
        };
      case Role.DOC:
        return {
          currentStage: VisaStage.DOC_POOL,
          assignedDocId: null,
        };
      case Role.SEC:
        return {
          currentStage: VisaStage.SEC_POOL,
          assignedSecId: null,
        };
      case Role.ADMIN:
        return {
          OR: [
            {
              currentStage: VisaStage.SALES_POOL,
              assignedSalesId: null,
            },
            {
              currentStage: VisaStage.DOC_POOL,
              assignedDocId: null,
            },
            {
              currentStage: VisaStage.SEC_POOL,
              assignedSecId: null,
            },
          ],
        };
      default:
        throw new ForbiddenException('Rolünüz için bir iş havuzu tanımlı değil');
    }
  }

  /**
   * Enforces detail-view access: ADMIN (any), CUSTOMER (own only), staff
   * (assigned to it, or it is sitting unassigned in their departmental pool).
   */
  private async assertCanView(
    application: {
      customerId: string;
      currentStage: VisaStage;
      assignedSalesId: string | null;
      assignedDocId: string | null;
      assignedSecId: string | null;
    },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role === Role.CUSTOMER) {
      if (application.customerId !== actor.userId) {
        throw new ForbiddenException('Yalnızca kendi başvurularınızı görüntüleyebilirsiniz');
      }
      return;
    }

    // Staff: visible if assigned to them, or sitting in their department pool.
    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true, department: true },
    });
    if (!staff) {
      throw new ForbiddenException(
        'Bu başvuruyu görüntüleme yetkiniz yok',
      );
    }
    const config = CLAIM_CONFIG[staff.department];
    const assignedToMe = application[config.assignmentField] === staff.id;
    const inMyPool = application.currentStage === config.poolStage;
    if (assignedToMe || inMyPool) {
      return;
    }
    throw new ForbiddenException(
      'Bu başvuruyu görüntüleme yetkiniz yok',
    );
  }

  /** Builds the atomic claim where/data for a given department (no dynamic keys). */
  private buildClaimUpdate(
    id: string,
    config: ClaimConfig,
    staffId: string,
  ): {
    where: Prisma.VisaApplicationWhereUniqueInput;
    data: Prisma.VisaApplicationUncheckedUpdateInput;
  } {
    const baseData = {
      currentStage: config.processStage,
      stageUpdatedAt: new Date(),
    };
    switch (config.assignmentField) {
      case 'assignedSalesId':
        return {
          where: { id, currentStage: config.poolStage, assignedSalesId: null },
          data: {
            ...baseData,
            assignedSalesId: staffId,
            // Stamp the historical sales-rep tracker on the initial claim.
            salesStaffId: staffId,
          },
        };
      case 'assignedDocId':
        return {
          where: { id, currentStage: config.poolStage, assignedDocId: null },
          data: { ...baseData, assignedDocId: staffId },
        };
      case 'assignedSecId':
        return {
          where: { id, currentStage: config.poolStage, assignedSecId: null },
          data: { ...baseData, assignedSecId: staffId },
        };
    }
  }

  /** Maps a target department to its assignment-column update (no dynamic keys). */
  private assignmentData(
    department: Department,
    staffId: string,
  ): Prisma.VisaApplicationUncheckedUpdateInput {
    switch (department) {
      case Department.SALES:
        return { assignedSalesId: staffId };
      case Department.DOC:
        return { assignedDocId: staffId };
      case Department.SEC:
        return { assignedSecId: staffId };
      default:
        throw new BadRequestException('Desteklenmeyen birim');
    }
  }

  /** Maps a department to its assignment-column filter (no dynamic keys). */
  private assignmentWhere(
    department: Department,
    staffId: string,
  ): Prisma.VisaApplicationWhereInput {
    switch (department) {
      case Department.SALES:
        return { assignedSalesId: staffId };
      case Department.DOC:
        return { assignedDocId: staffId };
      case Department.SEC:
        return { assignedSecId: staffId };
      default:
        throw new BadRequestException('Desteklenmeyen birim');
    }
  }

  /** Turns a P2025 (conditional update matched nothing) into a 409 Conflict. */
  private translateRaceError(error: unknown, message: string): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return new ConflictException(message);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
