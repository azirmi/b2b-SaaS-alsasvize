import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '../generated/prisma/client';
import { Department, Role, VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { PauseApplicationDto } from './dto/pause-application.dto';
import { ReassignApplicationDto } from './dto/reassign-application.dto';
import { ResumeApplicationDto } from './dto/resume-application.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { UpdateApplicationCrmDto } from './dto/update-application-crm.dto';

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

/** Full detail include for GET /applications/:id (passwords omitted everywhere). */
const APPLICATION_DETAIL_INCLUDE = {
  customer: { omit: { password: true } },
  assignedSales: { include: { user: { omit: { password: true } } } },
  assignedDoc: { include: { user: { omit: { password: true } } } },
  assignedSec: { include: { user: { omit: { password: true } } } },
  documents: true,
  auditLogs: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.VisaApplicationInclude;

@Injectable()
export class VisaApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
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
      throw new ForbiddenException('Only staff members have a workspace');
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
      throw new NotFoundException(`Application ${id} not found`);
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
      throw new ForbiddenException('Only staff members can claim applications');
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
          throw new NotFoundException(`Application ${id} not found`);
        }
        if (application.currentStage !== config.poolStage) {
          throw new ConflictException(
            `Application is in ${application.currentStage} and cannot be claimed from the ${config.poolStage}`,
          );
        }
        if (application[config.assignmentField] !== null) {
          throw new ConflictException('Application has already been claimed');
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
        'Application was just claimed by someone else',
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
            metadata: true,
          },
        });
        if (!application) {
          throw new NotFoundException(`Application ${id} not found`);
        }

        const transition = STAGE_TRANSITIONS[application.currentStage];
        if (!transition) {
          throw new ConflictException(
            `Application in ${application.currentStage} cannot be moved to a next stage`,
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
              'You are not assigned to this application at its current stage',
            );
          }
        }

        // Gating rule: Sales must complete the CRM data entry before the
        // application can be handed off to the Documents pool.
        if (application.currentStage === VisaStage.SALES_PROCESS) {
          if (!this.isCrmComplete(application.metadata)) {
            throw new ConflictException(
              'Complete the CRM data entry before sending to Documents',
            );
          }
        }

        // Gating rule: every document must be approved before leaving DOC_PROCESS.
        if (application.currentStage === VisaStage.DOC_PROCESS) {
          const pendingDocuments = await tx.document.count({
            where: { applicationId: id, isApproved: false },
          });
          if (pendingDocuments > 0) {
            throw new ConflictException(
              `Cannot advance: ${pendingDocuments} document(s) are pending approval`,
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

      return transitioned;
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Application stage changed concurrently; please retry',
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
      throw new BadRequestException(`Staff ${dto.newStaffId} not found`);
    }
    if (staff.department !== dto.department) {
      throw new BadRequestException(
        `Staff ${dto.newStaffId} is not in the ${dto.department} department`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.visaApplication.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }

      const updated = await tx.visaApplication.update({
        where: { id },
        data: this.assignmentData(dto.department, dto.newStaffId),
        include: APPLICATION_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'FORCE_REASSIGNED',
          details: { newStaffId: dto.newStaffId, department: dto.department },
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
        throw new NotFoundException(`Application ${id} not found`);
      }
      if (application.currentStage === VisaStage.CANCELLED) {
        throw new ConflictException('Application is already cancelled');
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
        'This endpoint is exclusively for customers',
      );
    }

    return this.prisma.visaApplication.findMany({
      where: { customerId: actor.userId },
      include: APPLICATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
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
          throw new NotFoundException(`Application ${id} not found`);
        }
        if (NON_PAUSABLE.includes(application.currentStage)) {
          throw new ConflictException(
            `Application in ${application.currentStage} cannot be paused`,
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
        'Application state changed concurrently; please retry',
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
          throw new NotFoundException(`Application ${id} not found`);
        }
        if (application.currentStage !== VisaStage.PAUSED) {
          throw new ConflictException(
            `Application is in ${application.currentStage}, not PAUSED`,
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
            'Cannot determine the pre-pause stage: no PAUSED audit entry found',
          );
        }

        const details = pausedLog.details as Record<string, unknown>;
        const previousStage = details?.previousStage as VisaStage | undefined;
        if (
          !previousStage ||
          !Object.values(VisaStage).includes(previousStage)
        ) {
          throw new ConflictException(
            'Cannot determine the pre-pause stage: PAUSED audit entry is malformed',
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
        'Application state changed concurrently; please retry',
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
  async updateCrm(
    id: string,
    dto: UpdateApplicationCrmDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: {
          currentStage: true,
          assignedSalesId: true,
          metadata: true,
        },
      });
      if (!before) {
        throw new NotFoundException(`Application ${id} not found`);
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
            'Only the assigned sales owner can edit this CRM record',
          );
        }
        if (before.currentStage !== VisaStage.SALES_PROCESS) {
          throw new ConflictException(
            'CRM data can only be edited while the application is in Sales processing',
          );
        }
      }

      const existing =
        before.metadata &&
        typeof before.metadata === 'object' &&
        !Array.isArray(before.metadata)
          ? (before.metadata as Prisma.JsonObject)
          : {};

      const crm = {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passportId: dto.passportId.trim(),
        targetCountry: dto.targetCountry.trim(),
        totalCost: dto.totalCost,
        currency: dto.currency.trim().toUpperCase(),
        updatedBy: actor.userId,
        updatedAt: new Date().toISOString(),
      };

      const updated = await tx.visaApplication.update({
        where: { id },
        data: { metadata: { ...existing, crm } },
        include: APPLICATION_DETAIL_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'CRM_UPDATED',
          details: {
            before: existing.crm ?? null,
            after: crm,
          },
        },
      });

      return updated;
    });
  }

  /**
   * True when `metadata.crm` holds a complete Sales record: non-empty applicant
   * details, target country and currency, plus a positive invoice total.
   */
  private isCrmComplete(metadata: Prisma.JsonValue | null | undefined): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    const crm = (metadata as Record<string, unknown>).crm;
    if (!crm || typeof crm !== 'object' || Array.isArray(crm)) {
      return false;
    }
    const record = crm as Record<string, unknown>;
    const filled = (value: unknown): boolean =>
      typeof value === 'string' && value.trim().length > 0;
    return (
      filled(record.firstName) &&
      filled(record.lastName) &&
      filled(record.passportId) &&
      filled(record.targetCountry) &&
      filled(record.currency) &&
      typeof record.totalCost === 'number' &&
      Number.isFinite(record.totalCost) &&
      record.totalCost > 0
    );
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
        'customerId is required when creating an application for a customer',
      );
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: { id: true, role: true, isActive: true },
    });
    if (!customer || customer.role !== Role.CUSTOMER || !customer.isActive) {
      throw new BadRequestException(
        'customerId must reference an active customer account',
      );
    }
    return customer.id;
  }

  private poolWhere(role: Role): Prisma.VisaApplicationWhereInput {
    switch (role) {
      case Role.SALES:
        return { currentStage: VisaStage.SALES_POOL };
      case Role.DOC:
        return { currentStage: VisaStage.DOC_POOL };
      case Role.SEC:
        return { currentStage: VisaStage.SEC_POOL };
      case Role.ADMIN:
        return {
          currentStage: { notIn: [VisaStage.COMPLETED, VisaStage.CANCELLED] },
        };
      default:
        throw new ForbiddenException('Your role does not have a work pool');
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
        throw new ForbiddenException('You can only view your own applications');
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
        'You are not allowed to view this application',
      );
    }
    const config = CLAIM_CONFIG[staff.department];
    const assignedToMe = application[config.assignmentField] === staff.id;
    const inMyPool = application.currentStage === config.poolStage;
    if (assignedToMe || inMyPool) {
      return;
    }
    throw new ForbiddenException(
      'You are not allowed to view this application',
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
          data: { ...baseData, assignedSalesId: staffId },
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
        throw new BadRequestException('Unsupported department');
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
        throw new BadRequestException('Unsupported department');
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
