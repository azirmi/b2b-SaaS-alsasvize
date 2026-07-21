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
import {
  ApplicationType,
  Department,
  DocAssistantConstraintLabel,
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
  FileType,
  Role,
  VisaStage,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { COUNTRY_RULES } from './country-rules';
import {
  DOC_ASSISTANT_CATALOG_BY_TYPE,
  DOC_ASSISTANT_CATALOG,
  DOC_ASSISTANT_STATUS_LABEL_TR,
  DOC_ASSISTANT_TITLE_BY_TYPE,
} from './doc-assistant-catalog';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ForceStageDto } from './dto/force-stage.dto';
import { PauseApplicationDto } from './dto/pause-application.dto';
import { ReassignApplicationDto } from './dto/reassign-application.dto';
import { ResumeApplicationDto } from './dto/resume-application.dto';
import { UpdateAppointmentOpsDto } from './dto/update-appointment-ops.dto';
import { UpdateDocAssistantStatusDto } from './dto/update-doc-assistant-status.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { UpdateApplicationCrmDto } from './dto/update-application-crm.dto';
import { UpsertApplicationDetailsDto } from './dto/upsert-application-details.dto';
import {
  CustomerProcessStage,
  ProcessPaymentType,
} from './process-flow.constants';

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

const CLAIM_CUSTOMER_PROCESS_STAGE: Record<Department, CustomerProcessStage> = {
  [Department.SALES]: CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN,
  [Department.DOC]: CustomerProcessStage.STAGE_4_FORM_READY,
  [Department.SEC]: CustomerProcessStage.STAGE_9_DOSSIER_READY,
};

const TRANSITION_CUSTOMER_PROCESS_STAGE_BY_NEXT: Partial<
  Record<VisaStage, CustomerProcessStage>
> = {
  [VisaStage.DOC_POOL]: CustomerProcessStage.STAGE_3_OPERATION_STARTED,
  [VisaStage.SEC_POOL]: CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED,
  [VisaStage.COMPLETED]: CustomerProcessStage.STAGE_10_PROCESS_COMPLETED,
};

/** Required document set for DOC -> SEC transition (flight/hotel stays optional). */
const DOC_REQUIRED_BASE_FILE_TYPES: FileType[] = [
  FileType.PASSPORT,
  FileType.LETTER_OF_INTENT,
  FileType.TRAVEL_PLAN,
  FileType.HEALTH_INSURANCE,
  FileType.APPOINTMENT_CONFIRMATION,
];

/** Optional by policy: does not block stage transition when missing. */
const DOC_OPTIONAL_FILE_TYPES: FileType[] = [FileType.FLIGHT_HOTEL_RESERVATION];

const FILE_TYPE_LABELS_TR: Record<FileType, string> = {
  [FileType.PASSPORT]: 'Pasaport',
  [FileType.BANK_STATEMENT]: 'Banka Hesap Dökümü',
  [FileType.INTENT_LETTER]: 'Niyet Mektubu',
  [FileType.CONSULATE_FORM]: 'Konsolosluk Formu',
  [FileType.VISA_GRANT]: 'Vize Sonuç Belgesi',
  [FileType.PAYMENT_RECEIPT]: 'Ödeme Dekontu',
  [FileType.FLIGHT_HOTEL_RESERVATION]: 'Uçak ve Otel Rezervasyonu',
  [FileType.LETTER_OF_INTENT]: 'Niyet Mektubu',
  [FileType.TRAVEL_PLAN]: 'Seyahat Planı',
  [FileType.HEALTH_INSURANCE]: 'Seyahat Sağlık Sigortası',
  [FileType.APPOINTMENT_CONFIRMATION]: 'Randevu Onayı',
  [FileType.VISA_FEE_RECEIPT]: 'Vize Harcı Dekontu',
  [FileType.FINAL_RECEIPT]: 'Kalan Ödeme Dekontu',
  [FileType.OTHER]: 'Diğer',
};

const DELIVERY_GATEKEEPER_ERROR_MESSAGE =
  'Hata: Tüm zorunlu belgeler yüklenmeden ve durumları Teslime Hazır yapılmadan danışana gönderim yapılamaz.';

interface DeliveredCustomerFileSnapshot {
  cardType: DocAssistantDocumentType;
  title: string;
  documentId: string;
  fileType: FileType;
  fileUrl: string;
  deliveredAt: string;
}

export interface DocChecklistState {
  requiredTypes: FileType[];
  optionalTypes: FileType[];
  missingTypes: FileType[];
  pendingApprovalTypes: FileType[];
  prepaidLocked: boolean;
}

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
  docAssistantItems: {
    orderBy: {
      type: 'asc',
    },
  },
  details: {
    orderBy: {
      applicantIndex: 'asc',
    },
  },
  onboardingApplicants: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      fullName: true,
      createdAt: true,
    },
  },
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
    const applicationType = dto.applicationType ?? ApplicationType.TOURISTIC;

    return this.prisma.visaApplication.create({
      data: {
        customer: { connect: { id: customerId } },
        currentStage: VisaStage.SALES_POOL,
        applicationType,
        docAssistantItems: {
          create: DOC_ASSISTANT_CATALOG.map((item) => ({
            type: item.type,
            constraintLabel: item.constraintLabel,
            status: item.initialStatus ?? DocAssistantDocumentStatus.HAZIRLANIYOR,
          })),
        },
        auditLogs: {
          create: {
            performedBy: { connect: { id: actor.userId } },
            actionType: 'CREATED',
            details: {
              newStage: VisaStage.SALES_POOL,
              customerProcessStage: CustomerProcessStage.STAGE_1_RECORD_CREATED,
              applicationType,
              createdByUserId: actor.userId,
            },
          },
        },
      },
      include: APPLICATION_INCLUDE,
    });
  }

  /**
   * Returns the role-appropriate work pool.
   * Admin pool is intentionally limited to never-claimed intake files so a
   * claimed application does not appear in both Pool and Workspace views.
   */
  getPool(actor: AuthenticatedUser) {
    return this.prisma.visaApplication.findMany({
      where: this.poolWhere(actor.role),
      include: APPLICATION_INCLUDE,
      orderBy: { stageUpdatedAt: 'asc' }, // longest-waiting first
    });
  }

  /**
   * Staff workspace: the applications the caller is actively working — assigned
   * to them and sitting in their department's *_PROCESS stage.
   *
   * Admin workspace shows every in-flight file that has ever been claimed by a
   * staff member, including handoff waiting points between departments.
   */
  async getAssigned(actor: AuthenticatedUser) {
    if (actor.role === Role.ADMIN) {
      return this.prisma.visaApplication.findMany({
        where: {
          currentStage: { notIn: [VisaStage.COMPLETED, VisaStage.CANCELLED] },
          OR: [
            { assignedSalesId: { not: null } },
            { assignedDocId: { not: null } },
            { assignedSecId: { not: null } },
            { salesStaffId: { not: null } },
          ],
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
  async getAll(filters?: {
    q?: string;
    staffId?: string;
    sortBy?: string;
    sortDirection?: string;
  }) {
    const q = filters?.q?.trim();
    const staffId = filters?.staffId?.trim();
    const sortBy = filters?.sortBy === 'stage' ? 'stage' : 'date';
    const sortDirection =
      filters?.sortDirection === 'asc' || filters?.sortDirection === 'desc'
        ? filters.sortDirection
        : sortBy === 'date'
          ? 'desc'
          : 'asc';

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

    const orderBy: Prisma.VisaApplicationOrderByWithRelationInput[] =
      sortBy === 'stage'
        ? [
            { currentStage: sortDirection },
            { createdAt: 'desc' },
            { id: 'desc' },
          ]
        : [{ createdAt: sortDirection }, { id: 'desc' }];

    return this.prisma.visaApplication.findMany({
      where,
      include: ADMIN_LIST_INCLUDE,
      orderBy,
    });
  }

  /** Global appointment agenda used by admin/doc calendar screens. */
  async getAppointments(actor: AuthenticatedUser) {
    if (actor.role === Role.DOC) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: actor.userId },
        select: { id: true, department: true },
      });
      if (!staff || staff.department !== Department.DOC) {
        throw new ForbiddenException(
          'Takvim görünümünü yalnızca evrak personeli kullanabilir',
        );
      }
    }

    const applications = await this.prisma.visaApplication.findMany({
      where: {
        crmData: {
          is: {
            appointmentDate: {
              not: null,
            },
          },
        },
      },
      select: {
        id: true,
        applicationType: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        crmData: {
          select: {
            appointmentDate: true,
            appointmentCity: true,
          },
        },
        assignedDoc: {
          select: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return applications
      .filter((app) => app.crmData?.appointmentDate)
      .sort(
        (a, b) =>
          a.crmData!.appointmentDate!.getTime() -
          b.crmData!.appointmentDate!.getTime(),
      )
      .map((app) => ({
        applicationId: app.id,
        applicationType: app.applicationType,
        appointmentDate: app.crmData!.appointmentDate!.toISOString(),
        appointmentCity: app.crmData!.appointmentCity ?? 'Belirtilmedi',
        customerName: app.customer.fullName,
        docStaffName: app.assignedDoc?.user.fullName ?? null,
      }));
  }

  /** Linked active applications for the same customer account (DOC/admin only). */
  async getLinkedActiveApplications(id: string, actor: AuthenticatedUser) {
    const base = await this.prisma.visaApplication.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        currentStage: true,
        assignedDocId: true,
      },
    });
    if (!base) {
      throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
    }

    if (actor.role !== Role.ADMIN) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: actor.userId },
        select: { id: true, department: true },
      });
      if (
        !staff ||
        staff.department !== Department.DOC ||
        base.assignedDocId !== staff.id
      ) {
        throw new ForbiddenException(
          'Bağlı başvuruları yalnızca atanan evrak personeli görüntüleyebilir',
        );
      }
      if (base.currentStage !== VisaStage.DOC_PROCESS) {
        throw new ConflictException(
          'Bağlı başvurular yalnızca Evrak İşlem aşamasında listelenebilir',
        );
      }
    }

    const linked = await this.prisma.visaApplication.findMany({
      where: {
        customerId: base.customerId,
        id: { not: id },
        currentStage: {
          notIn: [VisaStage.COMPLETED, VisaStage.CANCELLED, VisaStage.PAUSED],
        },
      },
      select: {
        id: true,
        currentStage: true,
        applicationType: true,
        customer: {
          select: {
            targetCountry: true,
          },
        },
        crmData: {
          select: {
            appointmentCity: true,
            appointmentDate: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return linked.map((application) => ({
      applicationId: application.id,
      currentStage: application.currentStage,
      applicationType: application.applicationType,
      targetCountry: application.customer.targetCountry ?? '',
      appointmentCity: application.crmData?.appointmentCity ?? null,
      appointmentDate: application.crmData?.appointmentDate
        ? application.crmData.appointmentDate.toISOString()
        : null,
    }));
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

    const checklist = this.buildDocChecklist(
      application.crmData,
      application.documents,
    );
    const requiredApplicantCount = this.resolveRequiredApplicantCount(
      application.onboardingApplicants.length,
    );
    const detailsByApplicantIndex = new Map(
      application.details.map((details) => [details.applicantIndex, details]),
    );
    const submittedFormsCount = application.details.length;
    const primaryDetails = this.pickPrimaryApplicantDetails(application.details);
    const applicationForms = Array.from(
      { length: requiredApplicantCount },
      (_, zeroBasedIndex) => {
        const applicantIndex = zeroBasedIndex + 1;
        const details =
          detailsByApplicantIndex.get(applicantIndex) ??
          (applicantIndex === 1
            ? detailsByApplicantIndex.get(0) ?? null
            : null);
        const normalizedApplicantName =
          application.onboardingApplicants[zeroBasedIndex]?.fullName?.trim() ?? '';
        const applicantFullName =
          normalizedApplicantName.length > 0
            ? normalizedApplicantName
            : applicantIndex === 1
              ? application.customer.fullName
              : null;

        return {
          applicantIndex,
          applicantLabel: `${applicantIndex}. Kişi Başvuru Formu`,
          applicantFullName,
          submitted: Boolean(details),
          submittedAt: details?.submittedAt ?? null,
          details: actor.role === Role.SALES ? null : details,
        };
      },
    );
    const scopedDocuments =
      actor.role === Role.SALES
        ? application.documents.filter(
            (document) => document.fileType === FileType.PASSPORT,
          )
        : application.documents;
    const salesReadonlyData = primaryDetails
      ? {
          residenceCity: primaryDetails.residenceCity,
          travelStartDate: primaryDetails.plannedTravelStartDate,
          travelEndDate: primaryDetails.plannedTravelEndDate,
          plannedTravelStartDate: primaryDetails.plannedTravelStartDate,
          plannedTravelEndDate: primaryDetails.plannedTravelEndDate,
        }
      : null;

    return {
      ...application,
      documents: scopedDocuments,
      details: actor.role === Role.SALES ? null : primaryDetails,
      applicationFormSubmitted: submittedFormsCount > 0,
      applicantCount: requiredApplicantCount,
      applicationFormsRequiredCount: requiredApplicantCount,
      applicationFormsSubmittedCount: submittedFormsCount,
      applicationFormsComplete: submittedFormsCount >= requiredApplicantCount,
      applicationForms,
      salesReadonlyData,
      docChecklist: checklist,
    };
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
    const claimProcessStage = CLAIM_CUSTOMER_PROCESS_STAGE[staff.department];
    let paymentType: ProcessPaymentType = 'NORMAL';

    try {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: {
            currentStage: true,
            assignedSalesId: true,
            assignedDocId: true,
            assignedSecId: true,
            crmData: {
              select: {
                paymentType: true,
              },
            },
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

        paymentType = this.resolveProcessPaymentType(
          application.crmData?.paymentType,
        );

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
              customerProcessStage: claimProcessStage,
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

      this.dispatchCustomerProcessEmail({
        applicationId: claimed.id,
        customerName: claimed.customer.fullName,
        customerEmail: claimed.customer.email,
        processStage: claimProcessStage,
        paymentType,
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
      let paymentType: ProcessPaymentType = 'NORMAL';

      const transitioned = await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: {
            currentStage: true,
            assignedSalesId: true,
            assignedDocId: true,
            assignedSecId: true,
            crmData: true,
            customer: {
              select: {
                targetCountry: true,
              },
            },
            onboardingApplicants: {
              select: {
                id: true,
              },
            },
            details: {
              orderBy: {
                applicantIndex: 'asc',
              },
              select: {
                applicantIndex: true,
                plannedTravelStartDate: true,
                plannedTravelEndDate: true,
              },
            },
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
        paymentType = this.resolveProcessPaymentType(
          application.crmData?.paymentType,
        );

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

        // Gating rule: only required document types block DOC -> SEC. Flight/
        // hotel reservation is explicitly optional by policy.
        if (application.currentStage === VisaStage.DOC_PROCESS) {
          const documents = await tx.document.findMany({
            where: { applicationId: id },
            select: { fileType: true, isApproved: true },
          });
          const checklist = this.buildDocChecklist(application.crmData, documents);

          const missingLabels = checklist.missingTypes.map(
            (type) => FILE_TYPE_LABELS_TR[type],
          );
          const pendingLabels = checklist.pendingApprovalTypes.map(
            (type) => FILE_TYPE_LABELS_TR[type],
          );

          if (missingLabels.length > 0 || pendingLabels.length > 0) {
            const messages: string[] = [];
            if (missingLabels.length > 0) {
              messages.push(`Eksik Alanlar: ${missingLabels.join(', ')}`);
            }
            if (pendingLabels.length > 0) {
              messages.push(`Onay Bekleyen Alanlar: ${pendingLabels.join(', ')}`);
            }
            throw new ConflictException(messages.join(' · '));
          }

          const requiredApplicantCount = this.resolveRequiredApplicantCount(
            application.onboardingApplicants.length,
          );
          if (application.details.length < requiredApplicantCount) {
            throw new ConflictException(
              `Başvuru formu tamamlanmadan ilerlenemez: ${application.details.length}/${requiredApplicantCount} kişi formu gönderildi`,
            );
          }

          const targetCountry = application.customer.targetCountry?.trim();
          if (!targetCountry || !COUNTRY_RULES[targetCountry]) {
            throw new ConflictException(
              'Son işleme geçmeden önce hedef ülke kuralı tanımlı olmalıdır',
            );
          }

          const appointmentCity = application.crmData?.appointmentCity?.trim();
          const appointmentDate = this.dateToIso(application.crmData?.appointmentDate);
          const primaryDetails = this.pickPrimaryApplicantDetails(
            application.details,
          );
          const travelStartDate = primaryDetails?.plannedTravelStartDate ?? null;
          const travelEndDate = primaryDetails?.plannedTravelEndDate ?? null;
          if (
            !appointmentCity ||
            !appointmentDate ||
            !travelStartDate ||
            !travelEndDate
          ) {
            throw new ConflictException(
              'Son işleme geçmeden önce randevu işlemleri alanını eksiksiz kaydedin',
            );
          }

          if (travelEndDate < travelStartDate) {
            throw new ConflictException(
              'Seyahat tarih aralığı geçersiz: dönüş tarihi gidiş tarihinden önce olamaz',
            );
          }

          const countryRule = COUNTRY_RULES[targetCountry];
          if (!countryRule.cities.includes(appointmentCity)) {
            throw new ConflictException(
              'Son işleme geçmeden önce randevu şehri ülke kuralı ile uyumlu olmalıdır',
            );
          }

          const minTravelDate = this.addDaysIso(
            appointmentDate,
            countryRule.minDays,
          );
          if (travelStartDate < minTravelDate) {
            throw new ConflictException(
              `Dikkat: Seçilen ülkenin kuralları gereği seyahat tarihi en erken ${minTravelDate} olmalıdır.`,
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
              customerProcessStage:
                TRANSITION_CUSTOMER_PROCESS_STAGE_BY_NEXT[transition.next] ?? null,
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

      const processStage = TRANSITION_CUSTOMER_PROCESS_STAGE_BY_NEXT[nextStage];
      if (processStage) {
        this.dispatchCustomerProcessEmail({
          applicationId: transitioned.id,
          customerName: transitioned.customer.fullName,
          customerEmail: transitioned.customer.email,
          processStage,
          paymentType,
        });
      }

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

    try {
      const { updatedApplication, stageTransitionNotification } =
        await this.prisma.$transaction(async (tx) => {
          const before = await tx.visaApplication.findUnique({
            where: { id },
            select: {
              currentStage: true,
              assignedSalesId: true,
              salesStaffId: true,
              crmData: true,
              customer: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  targetCountry: true,
                  appointmentCity: true,
                },
              },
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

          const targetCountry = before.customer.targetCountry?.trim() ?? null;
          const nextAppointmentCity =
            dto.appointmentCity?.trim() ??
            before.crmData?.appointmentCity?.trim() ??
            before.customer.appointmentCity?.trim() ??
            null;
          const nextAppointmentDate = dto.appointmentDate
            ? this.isoToDate(dto.appointmentDate)
            : (before.crmData?.appointmentDate ?? null);

          if (nextAppointmentCity) {
            if (!targetCountry || !COUNTRY_RULES[targetCountry]) {
              throw new BadRequestException(
                'Randevu şehri için geçerli bir hedef ülke bulunamadı',
              );
            }
            if (!COUNTRY_RULES[targetCountry].cities.includes(nextAppointmentCity)) {
              throw new BadRequestException(
                'Seçilen ülke için randevu şehri geçersiz',
              );
            }
          }

          const data = {
            salesDate: new Date(dto.salesDate),
            appointmentCity: nextAppointmentCity,
            appointmentDate: nextAppointmentDate,
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

          if (
            dto.appointmentCity !== undefined &&
            before.customer.appointmentCity !== nextAppointmentCity
          ) {
            await tx.user.update({
              where: { id: before.customer.id },
              data: { appointmentCity: nextAppointmentCity },
            });
          }

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
                after: {
                  ...data,
                  salesDate: data.salesDate.toISOString(),
                  appointmentDate: data.appointmentDate
                    ? data.appointmentDate.toISOString()
                    : null,
                },
              },
            },
          });

          const hasPrepaidInstallment =
            data.paymentType !== 'PREPAID' ||
            (typeof data.upfrontPaid === 'number' && data.upfrontPaid > 0);
          const shouldMoveToOperation =
            before.currentStage === VisaStage.SALES_PROCESS &&
            this.isCrmComplete({
              salesDate: data.salesDate,
              paymentType: data.paymentType,
              totalAmount: data.totalAmount,
              upfrontPaid: data.upfrontPaid,
            }) &&
            hasPrepaidInstallment;

          const shouldRefreshSalesProcessActivity =
            before.currentStage === VisaStage.SALES_PROCESS &&
            !shouldMoveToOperation;

          if (shouldRefreshSalesProcessActivity) {
            await tx.visaApplication.update({
              where: { id, currentStage: VisaStage.SALES_PROCESS },
              data: { stageUpdatedAt: new Date() },
            });
          }

          let stageTransitionNotification:
            | {
                previousStage: VisaStage;
                newStage: VisaStage;
                customerName: string;
                customerEmail: string;
                paymentType: ProcessPaymentType;
              }
            | null = null;

          if (shouldMoveToOperation) {
            await tx.visaApplication.update({
              where: { id, currentStage: VisaStage.SALES_PROCESS },
              data: {
                currentStage: VisaStage.DOC_POOL,
                stageUpdatedAt: new Date(),
              },
            });

            await tx.auditLog.create({
              data: {
                application: { connect: { id } },
                performedBy: { connect: { id: actor.userId } },
                actionType: 'STAGE_CHANGED',
                details: {
                  previousStage: VisaStage.SALES_PROCESS,
                  newStage: VisaStage.DOC_POOL,
                  customerProcessStage:
                    CustomerProcessStage.STAGE_3_OPERATION_STARTED,
                  performedByUserId: actor.userId,
                  trigger: 'CRM_UPDATED',
                },
              },
            });

            stageTransitionNotification = {
              previousStage: VisaStage.SALES_PROCESS,
              newStage: VisaStage.DOC_POOL,
              customerName: before.customer.fullName,
              customerEmail: before.customer.email,
              paymentType: this.resolveProcessPaymentType(data.paymentType),
            };
          }

          const updatedApplication = await tx.visaApplication.findUniqueOrThrow({
            where: { id },
            include: APPLICATION_DETAIL_INCLUDE,
          });

          return {
            updatedApplication,
            stageTransitionNotification,
          };
        });

      if (stageTransitionNotification) {
        this.events.emitStageChanged({
          applicationId: id,
          previousStage: stageTransitionNotification.previousStage,
          newStage: stageTransitionNotification.newStage,
          performedByUserId: actor.userId,
          at: new Date().toISOString(),
        });

        this.dispatchCustomerProcessEmail({
          applicationId: id,
          customerName: stageTransitionNotification.customerName,
          customerEmail: stageTransitionNotification.customerEmail,
          processStage: CustomerProcessStage.STAGE_3_OPERATION_STARTED,
          paymentType: stageTransitionNotification.paymentType,
        });
      }

      return updatedApplication;
    } catch (error) {
      throw this.translateRaceError(
        error,
        'CRM kaydı sırasında başvurunun aşaması eşzamanlı olarak değişti, lütfen tekrar deneyin',
      );
    }
  }

  /**
   * DOC + admin workflow: save appointment city/date, enforce country minimum
   * travel lead time, and force-update the customer travel date in one atomic
   * transaction with an APPOINTMENT_OPS_UPDATED audit entry.
   */
  async updateAppointmentOps(
    id: string,
    dto: UpdateAppointmentOpsDto,
    actor: AuthenticatedUser,
  ) {
    const linkedIds = Array.from(
      new Set(
        (dto.linkedApplicationIds ?? []).filter(
          (applicationId) => applicationId !== id,
        ),
      ),
    );
    const targetIds = [id, ...linkedIds];
    const appointmentNote = dto.note.trim();
    if (!appointmentNote) {
      throw new BadRequestException('Randevu notu zorunludur');
    }

    const hasVisaFee = dto.hasVisaFee === true;
    if (hasVisaFee && typeof dto.visaFeeAmount !== 'number') {
      throw new BadRequestException('Vize harcı tutarı zorunludur');
    }
    if (hasVisaFee && !dto.visaFeeReceiptDocumentId) {
      throw new BadRequestException('Vize harcı dekontu zorunludur');
    }

    const { updatedApplication, appointmentStageNotification } =
      await this.prisma.$transaction(async (tx) => {
        let appointmentStageNotification:
          | {
              applicationId: string;
              customerName: string;
              customerEmail: string;
              paymentType: ProcessPaymentType;
            }
          | null = null;

      const sourceConfirmation = await tx.document.findUnique({
        where: { id: dto.appointmentConfirmationDocumentId },
        select: {
          id: true,
          applicationId: true,
          fileType: true,
          fileUrl: true,
        },
      });
      if (
        !sourceConfirmation ||
        sourceConfirmation.applicationId !== id ||
        sourceConfirmation.fileType !== FileType.APPOINTMENT_CONFIRMATION
      ) {
        throw new BadRequestException(
          'Randevu onay belgesi geçersiz veya bu başvuruya ait değil',
        );
      }

      const sourceVisaFeeReceipt = hasVisaFee
        ? await tx.document.findUnique({
            where: { id: dto.visaFeeReceiptDocumentId! },
            select: {
              id: true,
              applicationId: true,
              fileType: true,
              fileUrl: true,
            },
          })
        : null;
      if (
        hasVisaFee &&
        (!sourceVisaFeeReceipt ||
          sourceVisaFeeReceipt.applicationId !== id ||
          sourceVisaFeeReceipt.fileType !== FileType.VISA_FEE_RECEIPT)
      ) {
        throw new BadRequestException(
          'Vize harcı dekontu geçersiz veya bu başvuruya ait değil',
        );
      }

      const applications = await tx.visaApplication.findMany({
        where: {
          id: {
            in: targetIds,
          },
        },
        select: {
          id: true,
          currentStage: true,
          assignedDocId: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
              targetCountry: true,
              appointmentCity: true,
            },
          },
          crmData: {
            select: {
              paymentType: true,
              appointmentCity: true,
              appointmentDate: true,
              appointmentExpense: true,
              appointmentNote: true,
              hasVisaFee: true,
              visaFeeAmount: true,
              visaFeeReceiptDocumentId: true,
            },
          },
          onboardingApplicants: {
            select: {
              id: true,
            },
          },
          details: {
            orderBy: {
              applicantIndex: 'asc',
            },
            select: {
              applicantIndex: true,
              plannedTravelStartDate: true,
              plannedTravelEndDate: true,
            },
          },
        },
      });

      if (applications.length !== targetIds.length) {
        throw new NotFoundException(
          'Seçilen bağlı başvurulardan biri bulunamadı',
        );
      }

      const byId = new Map(applications.map((application) => [application.id, application]));
      const sourceApplication = byId.get(id);
      if (!sourceApplication) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }
      const sourceCustomerId = sourceApplication.customer.id;

      const docStaff =
        actor.role === Role.ADMIN
          ? null
          : await tx.staff.findUnique({
              where: { userId: actor.userId },
              select: { id: true, department: true },
            });

      if (actor.role !== Role.ADMIN) {
        if (
          !docStaff ||
          docStaff.department !== Department.DOC
        ) {
          throw new ForbiddenException(
            'Randevu işlemlerini yalnızca evrak personeli güncelleyebilir',
          );
        }
      }

      const appointmentCity = dto.appointmentCity.trim();
      const appointmentDate = dto.appointmentDate;
      const travelDate = dto.travelDate;

      for (const targetId of targetIds) {
        const before = byId.get(targetId);
        if (!before) {
          throw new NotFoundException(`Başvuru bulunamadı: ${targetId}`);
        }

        if (before.currentStage !== VisaStage.DOC_PROCESS) {
          throw new ConflictException(
            'Randevu işlemleri yalnızca Evrak İşlem aşamasındaki başvurulara uygulanabilir',
          );
        }
        const requiredApplicantCount = this.resolveRequiredApplicantCount(
          before.onboardingApplicants.length,
        );
        if (before.details.length < requiredApplicantCount) {
          throw new ConflictException(
            `Randevu işlemleri için önce tüm başvuru formları gönderilmiş olmalıdır (${before.details.length}/${requiredApplicantCount})`,
          );
        }
        const primaryDetails = this.pickPrimaryApplicantDetails(before.details);
        if (!primaryDetails) {
          throw new ConflictException(
            'Randevu işlemleri için önce başvuru formu gönderilmiş olmalıdır',
          );
        }
        if (!before.crmData) {
          throw new ConflictException(
            'Randevu işlemleri için önce CRM kaydı oluşturulmalıdır',
          );
        }
        if (before.customer.id !== sourceCustomerId) {
          throw new BadRequestException(
            'Bağlı başvurular yalnızca aynı müşteri hesabına ait olabilir',
          );
        }
        if (docStaff && before.assignedDocId !== docStaff.id) {
          throw new ForbiddenException(
            'Seçilen bağlı başvurular yalnızca size atanmış dosyalardan oluşmalıdır',
          );
        }

        const targetCountry = before.customer.targetCountry?.trim();
        if (!targetCountry || !COUNTRY_RULES[targetCountry]) {
          throw new BadRequestException('Desteklenmeyen hedef ülke seçimi');
        }
        const countryRule = COUNTRY_RULES[targetCountry];

        if (!countryRule.cities.includes(appointmentCity)) {
          throw new BadRequestException('Seçilen ülke için randevu şehri geçersiz');
        }

        const minTravelDate = this.addDaysIso(appointmentDate, countryRule.minDays);
        if (travelDate < minTravelDate) {
          throw new BadRequestException(
            `Dikkat: Seçilen ülkenin kuralları gereği seyahat tarihi en erken ${minTravelDate} olmalıdır.`,
          );
        }
        if (primaryDetails.plannedTravelEndDate < travelDate) {
          throw new BadRequestException(
            'Seyahat başlangıç tarihi mevcut bitiş tarihinden sonra olamaz',
          );
        }

        const nextAppointmentExpense =
          dto.appointmentExpense ?? before.crmData.appointmentExpense ?? null;
        const nextVisaFeeAmount = hasVisaFee ? (dto.visaFeeAmount ?? null) : null;
        const nextVisaFeeReceiptDocumentId = hasVisaFee
          ? (dto.visaFeeReceiptDocumentId ?? null)
          : null;

        if (targetId === id && !before.crmData.appointmentDate) {
          appointmentStageNotification = {
            applicationId: targetId,
            customerName: before.customer.fullName,
            customerEmail: before.customer.email,
            paymentType: this.resolveProcessPaymentType(
              before.crmData.paymentType,
            ),
          };
        }

        await tx.applicationCrmData.update({
          where: { applicationId: targetId },
          data: {
            appointmentCity,
            appointmentDate: this.isoToDate(appointmentDate),
            appointmentNote,
            ...(dto.appointmentExpense !== undefined
              ? { appointmentExpense: dto.appointmentExpense }
              : {}),
            hasVisaFee,
            visaFeeAmount: nextVisaFeeAmount,
            visaFeeReceiptDocumentId: nextVisaFeeReceiptDocumentId,
            updatedById: actor.userId,
          },
        });

        await tx.user.update({
          where: { id: before.customer.id },
          data: { appointmentCity },
        });

        await tx.visaApplicationDetails.updateMany({
          where: { applicationId: targetId },
          data: {
            plannedTravelStartDate: travelDate,
          },
        });

        if (targetId !== id) {
          const existingConfirmation = await tx.document.findFirst({
            where: {
              applicationId: targetId,
              fileType: FileType.APPOINTMENT_CONFIRMATION,
              fileUrl: sourceConfirmation.fileUrl,
            },
            select: { id: true },
          });
          if (!existingConfirmation) {
            await tx.document.create({
              data: {
                applicationId: targetId,
                uploadedById: actor.userId,
                fileType: FileType.APPOINTMENT_CONFIRMATION,
                fileUrl: sourceConfirmation.fileUrl,
                isApproved: true,
              },
            });
          }

          if (hasVisaFee && sourceVisaFeeReceipt) {
            const existingVisaFeeReceipt = await tx.document.findFirst({
              where: {
                applicationId: targetId,
                fileType: FileType.VISA_FEE_RECEIPT,
                fileUrl: sourceVisaFeeReceipt.fileUrl,
              },
              select: { id: true },
            });
            if (!existingVisaFeeReceipt) {
              await tx.document.create({
                data: {
                  applicationId: targetId,
                  uploadedById: actor.userId,
                  fileType: FileType.VISA_FEE_RECEIPT,
                  fileUrl: sourceVisaFeeReceipt.fileUrl,
                  isApproved: true,
                },
              });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            application: { connect: { id: targetId } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'APPOINTMENT_OPS_UPDATED',
            details: {
              before: {
                appointmentCity:
                  before.crmData.appointmentCity ?? before.customer.appointmentCity,
                appointmentDate: this.dateToIso(before.crmData.appointmentDate),
                appointmentNote: before.crmData.appointmentNote,
                appointmentExpense: before.crmData.appointmentExpense,
                hasVisaFee: before.crmData.hasVisaFee,
                visaFeeAmount: before.crmData.visaFeeAmount,
                visaFeeReceiptDocumentId: before.crmData.visaFeeReceiptDocumentId,
                travelStartDate: primaryDetails.plannedTravelStartDate,
                travelEndDate: primaryDetails.plannedTravelEndDate,
              },
              after: {
                customerProcessStage:
                  CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED,
                appointmentCity,
                appointmentDate,
                appointmentNote,
                appointmentExpense: nextAppointmentExpense,
                hasVisaFee,
                visaFeeAmount: nextVisaFeeAmount,
                visaFeeReceiptDocumentId: nextVisaFeeReceiptDocumentId,
                travelStartDate: travelDate,
                travelEndDate: primaryDetails.plannedTravelEndDate,
                minTravelDate,
                targetCountry,
                minDays: countryRule.minDays,
                formProgress: {
                  requiredApplicantCount,
                  submittedApplicantCount: before.details.length,
                },
                appointmentConfirmationDocumentId:
                  dto.appointmentConfirmationDocumentId,
                batchAppliedTo: targetIds,
              },
            },
          },
        });
      }

        const updatedApplication = await tx.visaApplication.findUniqueOrThrow({
          where: { id },
          include: APPLICATION_DETAIL_INCLUDE,
        });

        return {
          updatedApplication,
          appointmentStageNotification,
        };
      });

    if (appointmentStageNotification) {
      this.dispatchCustomerProcessEmail({
        applicationId: appointmentStageNotification.applicationId,
        customerName: appointmentStageNotification.customerName,
        customerEmail: appointmentStageNotification.customerEmail,
        processStage: CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED,
        paymentType: appointmentStageNotification.paymentType,
      });
    }

    return updatedApplication;
  }

  /** DOC + admin: updates one DOC assistant card status and writes an audit row. */
  async updateDocAssistantStatus(
    id: string,
    dto: UpdateDocAssistantStatusDto,
    actor: AuthenticatedUser,
  ) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const application = await tx.visaApplication.findUnique({
          where: { id },
          select: {
            id: true,
            assignedDocId: true,
            customer: {
              select: {
                fullName: true,
                email: true,
              },
            },
            docAssistantItems: {
              where: {
                type: dto.type,
              },
              select: {
                id: true,
                type: true,
                constraintLabel: true,
                status: true,
                updatedAt: true,
              },
            },
          },
        });

        if (!application) {
          throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
        }

        if (actor.role !== Role.ADMIN) {
          if (actor.role !== Role.DOC) {
            throw new ForbiddenException('Bu kaynağa erişim yetkiniz yok');
          }

          const staff = await tx.staff.findUnique({
            where: { userId: actor.userId },
            select: {
              id: true,
              department: true,
            },
          });

          if (!staff || staff.department !== Department.DOC) {
            throw new ForbiddenException(
              'Durum güncellemesini yalnızca evrak personeli yapabilir',
            );
          }

          if (application.assignedDocId !== staff.id) {
            throw new ForbiddenException(
              'Durum güncellemesi yalnızca size atanmış dosyalarda yapılabilir',
            );
          }
        }

        const catalogItem = DOC_ASSISTANT_CATALOG_BY_TYPE[dto.type];
        if (!catalogItem) {
          throw new ConflictException(
            'Belge türü için katalog kaydı bulunamadı',
          );
        }

        let current = application.docAssistantItems[0] ?? null;
        if (!current) {
          current = await tx.applicationDocAssistantItem.create({
            data: {
              applicationId: id,
              type: dto.type,
              constraintLabel: catalogItem.constraintLabel,
              status:
                catalogItem.initialStatus ?? DocAssistantDocumentStatus.HAZIRLANIYOR,
              updatedById: actor.userId,
            },
            select: {
              id: true,
              type: true,
              constraintLabel: true,
              status: true,
              updatedAt: true,
            },
          });

          await tx.auditLog.create({
            data: {
              application: { connect: { id } },
              performedBy: { connect: { id: actor.userId } },
              actionType: 'DOC_ASSISTANT_ITEM_INITIALIZED',
              details: {
                documentType: current.type,
                constraintLabel: current.constraintLabel,
                beforeStatus: null,
                afterStatus: current.status,
              },
            },
          });
        }

        if (current.status === dto.status) {
          return {
            statusChanged: false,
            item: current,
            customerName: application.customer.fullName,
            customerEmail: application.customer.email,
          };
        }

        const updated = await tx.applicationDocAssistantItem.update({
          where: {
            id: current.id,
            status: current.status,
          },
          data: {
            status: dto.status,
            updatedById: actor.userId,
          },
          select: {
            id: true,
            type: true,
            constraintLabel: true,
            status: true,
            updatedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            application: { connect: { id } },
            performedBy: { connect: { id: actor.userId } },
            actionType: 'DOC_ASSISTANT_STATUS_UPDATED',
            details: {
              documentType: current.type,
              constraintLabel: current.constraintLabel,
              beforeStatus: current.status,
              afterStatus: updated.status,
            },
          },
        });

        return {
          statusChanged: true,
          item: updated,
          customerName: application.customer.fullName,
          customerEmail: application.customer.email,
        };
      });

      if (result.statusChanged) {
        void this.email.sendDocAssistantStatusUpdated({
          to: result.customerEmail,
          customerName: result.customerName,
          documentName: DOC_ASSISTANT_TITLE_BY_TYPE[result.item.type],
          statusLabel: DOC_ASSISTANT_STATUS_LABEL_TR[result.item.status],
          applicationId: id,
        });
      }

      return result.item;
    } catch (error) {
      throw this.translateRaceError(
        error,
        'Belge durumu başka bir işlemde güncellendi, lütfen tekrar deneyin',
      );
    }
  }

  /** DOC + admin workflow: deliver validated assistant package to the customer portal. */
  async deliverToCustomer(id: string, actor: AuthenticatedUser) {
    const { result, deliveryStageNotification } =
      await this.prisma.$transaction(async (tx) => {
        let deliveryStageNotification:
          | {
              applicationId: string;
              customerName: string;
              customerEmail: string;
              paymentType: ProcessPaymentType;
            }
          | null = null;

      const application = await tx.visaApplication.findUnique({
        where: { id },
        select: {
          id: true,
          assignedDocId: true,
          isDeliveredToCustomer: true,
          deliveredToCustomerAt: true,
          deliveredToCustomerFiles: true,
          crmData: {
            select: {
              paymentType: true,
            },
          },
          customer: {
            select: {
              fullName: true,
              email: true,
            },
          },
          docAssistantItems: {
            select: {
              type: true,
              constraintLabel: true,
              status: true,
            },
          },
          documents: {
            select: {
              id: true,
              fileType: true,
              fileUrl: true,
              docAssistantType: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
      if (!application) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }

      if (actor.role !== Role.ADMIN) {
        const staff = await tx.staff.findUnique({
          where: { userId: actor.userId },
          select: { id: true, department: true },
        });
        if (
          !staff ||
          staff.department !== Department.DOC ||
          application.assignedDocId !== staff.id
        ) {
          throw new ForbiddenException(
            'Dosya iletimini yalnızca atanan evrak personeli yapabilir',
          );
        }
      }

      const isPrepaid = application.crmData?.paymentType === 'PREPAID';
      const requiredCardTypes = application.docAssistantItems
        .filter((item) => {
          if (item.constraintLabel === DocAssistantConstraintLabel.ZORUNLU) {
            return true;
          }
          return (
            item.constraintLabel ===
              DocAssistantConstraintLabel.SARTLI_ZORUNLU && isPrepaid
          );
        })
        .map((item) => item.type);

      const itemByType = new Map(
        application.docAssistantItems.map((item) => [item.type, item] as const),
      );
      const documentsByCardType = new Map<
        DocAssistantDocumentType,
        Array<{
          id: string;
          fileType: FileType;
          fileUrl: string;
          docAssistantType: DocAssistantDocumentType | null;
          createdAt: Date;
        }>
      >();
      const documentsByFileType = new Map<
        FileType,
        Array<{
          id: string;
          fileType: FileType;
          fileUrl: string;
          docAssistantType: DocAssistantDocumentType | null;
          createdAt: Date;
        }>
      >();

      for (const document of application.documents) {
        if (document.docAssistantType) {
          const existingByCardType =
            documentsByCardType.get(document.docAssistantType) ?? [];
          existingByCardType.push(document);
          documentsByCardType.set(document.docAssistantType, existingByCardType);
        }

        const existingByFileType = documentsByFileType.get(document.fileType) ?? [];
        existingByFileType.push(document);
        documentsByFileType.set(document.fileType, existingByFileType);
      }

      const resolveCardDocument = (cardType: DocAssistantDocumentType) => {
        const byCardType = documentsByCardType.get(cardType);
        if (byCardType && byCardType.length > 0) {
          return byCardType[0];
        }

        const catalogItem = DOC_ASSISTANT_CATALOG_BY_TYPE[cardType];
        if (!catalogItem) {
          return null;
        }

        const byFileType = documentsByFileType.get(catalogItem.uploadFileType);
        return byFileType && byFileType.length > 0 ? byFileType[0] : null;
      };

      const missingRequired = requiredCardTypes.some((cardType) => {
        const item = itemByType.get(cardType);
        if (!item || item.status !== DocAssistantDocumentStatus.TESLIME_HAZIR) {
          return true;
        }

        return !resolveCardDocument(cardType);
      });

      if (missingRequired) {
        throw new ConflictException(DELIVERY_GATEKEEPER_ERROR_MESSAGE);
      }

      const now = new Date();
      const deliveredFiles: DeliveredCustomerFileSnapshot[] = [];
      const deliveredDocumentIds = new Set<string>();

      for (const item of application.docAssistantItems) {
        if (item.status !== DocAssistantDocumentStatus.TESLIME_HAZIR) {
          continue;
        }

        const document = resolveCardDocument(item.type);
        if (!document) {
          continue;
        }

        deliveredDocumentIds.add(document.id);
        deliveredFiles.push({
          cardType: item.type,
          title: DOC_ASSISTANT_TITLE_BY_TYPE[item.type],
          documentId: document.id,
          fileType: document.fileType,
          fileUrl: document.fileUrl,
          deliveredAt: now.toISOString(),
        });
      }

      if (deliveredFiles.length === 0) {
        throw new ConflictException(DELIVERY_GATEKEEPER_ERROR_MESSAGE);
      }

      const deliveredFilesJson =
        deliveredFiles as unknown as Prisma.InputJsonValue;

      await tx.visaApplication.update({
        where: { id },
        data: {
          isDeliveredToCustomer: true,
          deliveredToCustomerAt: now,
          deliveredToCustomerFiles: deliveredFilesJson,
        },
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'DELIVERED_TO_CUSTOMER',
          details: {
            before: {
              isDeliveredToCustomer: application.isDeliveredToCustomer,
              deliveredToCustomerAt:
                application.deliveredToCustomerAt?.toISOString() ?? null,
              deliveredToCustomerFiles:
                application.deliveredToCustomerFiles ?? null,
            },
            after: {
              isDeliveredToCustomer: true,
              deliveredToCustomerAt: now.toISOString(),
              deliveredToCustomerFiles: deliveredFilesJson,
              customerProcessStage:
                CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN,
            },
            requiredCardTypes,
            deliveredDocumentIds: Array.from(deliveredDocumentIds),
          } as Prisma.InputJsonValue,
        },
      });

      if (!application.isDeliveredToCustomer) {
        deliveryStageNotification = {
          applicationId: id,
          customerName: application.customer.fullName,
          customerEmail: application.customer.email,
          paymentType: this.resolveProcessPaymentType(
            application.crmData?.paymentType,
          ),
        };
      }

        return {
          result: {
            applicationId: id,
            isDeliveredToCustomer: true,
            deliveredCount: deliveredFiles.length,
          },
          deliveryStageNotification,
        };
      });

    if (deliveryStageNotification) {
      this.dispatchCustomerProcessEmail({
        applicationId: deliveryStageNotification.applicationId,
        customerName: deliveryStageNotification.customerName,
        customerEmail: deliveryStageNotification.customerEmail,
        processStage: CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN,
        paymentType: deliveryStageNotification.paymentType,
      });
    }

    return result;
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
    const applicantIndex = dto.applicantIndex ?? 1;
    if (!Number.isInteger(applicantIndex) || applicantIndex < 1) {
      throw new BadRequestException('Kişi sırası geçersiz');
    }
    const lookupApplicantIndexes =
      applicantIndex === 1 ? [applicantIndex, 0] : [applicantIndex];

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.visaApplication.findUnique({
        where: { id },
        select: {
          customerId: true,
          currentStage: true,
          onboardingApplicants: {
            select: {
              id: true,
            },
          },
          details: {
            where: {
              applicantIndex: {
                in: lookupApplicantIndexes,
              },
            },
            take: lookupApplicantIndexes.length,
          },
          customer: { select: { targetCountry: true } },
        },
      });
      if (!before) {
        throw new NotFoundException(`Başvuru bulunamadı: ${id}`);
      }

      const requiredApplicantCount = this.resolveRequiredApplicantCount(
        before.onboardingApplicants.length,
      );
      if (applicantIndex > requiredApplicantCount) {
        throw new BadRequestException(
          `Geçersiz kişi sırası: bu başvuru için 1-${requiredApplicantCount} aralığında kişi formu girilebilir`,
        );
      }

      const existingDetails =
        before.details.find((details) => details.applicantIndex === applicantIndex) ??
        before.details.find((details) => details.applicantIndex === 0) ??
        null;
      const targetApplicantIndex = existingDetails?.applicantIndex ?? applicantIndex;

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

      if (dto.plannedTravelEndDate < dto.plannedTravelStartDate) {
        throw new BadRequestException(
          'Seyahat bitiş tarihi başlangıç tarihinden önce olamaz',
        );
      }

      const targetCountry = before.customer.targetCountry?.trim() ?? null;
      if (targetCountry === 'Danimarka') {
        const minTravelStartDate = this.addDaysIso(
          new Date().toISOString().slice(0, 10),
          COUNTRY_RULES.Danimarka.minDays,
        );
        if (dto.plannedTravelStartDate < minTravelStartDate) {
          throw new BadRequestException(
            `Danimarka başvurularında seyahat başlangıcı en erken ${minTravelStartDate} olabilir`,
          );
        }
      }

      const sponsorFields = [
        dto.sponsorFullName,
        dto.sponsorIdentity,
        dto.sponsorContact,
        dto.sponsorRelation,
      ].map((value) => value?.trim() ?? '');
      if (dto.hasSponsor && sponsorFields.some((value) => value.length === 0)) {
        throw new BadRequestException(
          'Sponsor bilgileri girilecekse tüm sponsor alanları doldurulmalıdır',
        );
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
        residenceCity: dto.residenceCity.trim(),
        registeredAddress: dto.registeredAddress.trim(),

        occupation: dto.occupation.trim(),
        employmentStatus: dto.employmentStatus.trim(),
        isEmployer: dto.isEmployer,
        employerName: dto.isEmployer ? dto.employerName?.trim() || null : null,
        employerAddress: dto.isEmployer
          ? dto.employerAddress?.trim() || null
          : null,
        employerPhone: dto.isEmployer ? dto.employerPhone?.trim() || null : null,
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
        plannedTravelStartDate: dto.plannedTravelStartDate,
        plannedTravelEndDate: dto.plannedTravelEndDate,

        hasSponsor: dto.hasSponsor,
        sponsorFullName: dto.hasSponsor ? dto.sponsorFullName?.trim() || null : null,
        sponsorIdentity: dto.hasSponsor ? dto.sponsorIdentity?.trim() || null : null,
        sponsorContact: dto.hasSponsor ? dto.sponsorContact?.trim() || null : null,
        sponsorRelation: dto.hasSponsor ? dto.sponsorRelation?.trim() || null : null,
      };

      await tx.visaApplicationDetails.upsert({
        where: {
          applicationId_applicantIndex: {
            applicationId: id,
            applicantIndex: targetApplicantIndex,
          },
        },
        create: {
          applicationId: id,
          applicantIndex: targetApplicantIndex,
          ...data,
        },
        update: data,
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: existingDetails ? 'DETAILS_UPDATED' : 'DETAILS_SUBMITTED',
          details: {
            // JSON round-trip drops Date instances so the snapshot is JSON-safe.
            applicantIndex,
            storedApplicantIndex: targetApplicantIndex,
            formProgress: {
              requiredApplicantCount,
            },
            before: existingDetails
              ? (JSON.parse(
                  JSON.stringify(existingDetails),
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
   * SALES_PROCESS: a sale date, a valid payment type and a positive total —
    * plus a positive upfront installment (0..total, excluding 0) when PREPAID.
   */
  private isCrmComplete(
    crm:
      | {
          salesDate: Date | null;
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
    const validType =
      crm.paymentType === 'NORMAL' || crm.paymentType === 'PREPAID';
    const validTotal =
      typeof crm.totalAmount === 'number' &&
      Number.isFinite(crm.totalAmount) &&
      crm.totalAmount > 0;
    if (!crm.salesDate || !validType || !validTotal) {
      return false;
    }
    if (crm.paymentType === 'PREPAID') {
      return (
        typeof crm.upfrontPaid === 'number' &&
        Number.isFinite(crm.upfrontPaid) &&
        crm.upfrontPaid > 0 &&
        typeof crm.totalAmount === 'number' &&
        crm.upfrontPaid <= crm.totalAmount
      );
    }
    return true;
  }

  private buildDocChecklist(
    crm:
      | {
          paymentType: string | null;
        }
      | null
      | undefined,
    documents: Array<{ fileType: FileType; isApproved: boolean }>,
  ): DocChecklistState {
    const isPrepaid = crm?.paymentType === 'PREPAID';
    const requiredTypes = isPrepaid
      ? [...DOC_REQUIRED_BASE_FILE_TYPES, FileType.FINAL_RECEIPT]
      : [...DOC_REQUIRED_BASE_FILE_TYPES];

    const uploadedTypes = new Set(
      documents.map((document) => document.fileType),
    );
    const approvedTypes = new Set(
      documents
        .filter((document) => document.isApproved)
        .map((document) => document.fileType),
    );

    const missingTypes = requiredTypes.filter((type) => !uploadedTypes.has(type));
    const pendingApprovalTypes = requiredTypes.filter(
      (type) => uploadedTypes.has(type) && !approvedTypes.has(type),
    );

    return {
      requiredTypes,
      optionalTypes: [...DOC_OPTIONAL_FILE_TYPES],
      missingTypes,
      pendingApprovalTypes,
      prepaidLocked: isPrepaid && !approvedTypes.has(FileType.FINAL_RECEIPT),
    };
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
          currentStage: VisaStage.SALES_POOL,
          assignedSalesId: null,
          assignedDocId: null,
          assignedSecId: null,
          salesStaffId: null,
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

  /** Parses either YYYY-MM-DD or a full ISO datetime string. */
  private isoToDate(isoDate: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const [year, month, day] = isoDate.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Geçersiz tarih formatı');
    }
    return parsed;
  }

  /** Converts a Date to YYYY-MM-DD in UTC. */
  private dateToIso(date: Date | null | undefined): string | null {
    if (!date) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  /** Uses onboarding applicant rows as the authoritative person count (fallback: 1). */
  private resolveRequiredApplicantCount(onboardingApplicantsCount: number): number {
    return onboardingApplicantsCount > 0 ? onboardingApplicantsCount : 1;
  }

  /** Picks the primary form record (index 1 if present, otherwise the lowest index). */
  private pickPrimaryApplicantDetails<
    T extends { applicantIndex: number },
  >(details: T[]): T | null {
    if (details.length === 0) {
      return null;
    }

    const directMatch = details.find((item) => item.applicantIndex === 1);
    if (directMatch) {
      return directMatch;
    }

    return details.reduce((currentLowest, item) => {
      if (!currentLowest) {
        return item;
      }
      return item.applicantIndex < currentLowest.applicantIndex
        ? item
        : currentLowest;
    }, null as T | null);
  }

  /** Returns YYYY-MM-DD after adding the country lead-time days. */
  private addDaysIso(isoDate: string, days: number): string {
    const base = this.isoToDate(isoDate);
    const shifted = new Date(base);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  private resolveProcessPaymentType(
    paymentType: string | null | undefined,
  ): ProcessPaymentType {
    return paymentType === 'PREPAID' ? 'PREPAID' : 'NORMAL';
  }

  private dispatchCustomerProcessEmail(input: {
    applicationId: string;
    customerName: string;
    customerEmail: string;
    processStage: CustomerProcessStage;
    paymentType: ProcessPaymentType;
  }): void {
    // Stage 2 is internal-only by product rule and must never send an email.
    if (input.processStage === CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN) {
      return;
    }

    void this.email.sendStageAdvanced({
      to: input.customerEmail,
      customerName: input.customerName,
      processStage: input.processStage,
      paymentType: input.paymentType,
      applicationId: input.applicationId,
    });
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
