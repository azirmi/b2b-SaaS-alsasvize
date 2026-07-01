import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Prisma } from '../generated/prisma/client';
import { Department, Role, VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const DEFAULT_TAKE = 50;
const MAX_TAKE = 100;
const DEFAULT_SLA_THRESHOLD_HOURS = 48;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Lists audit logs (newest first, paginated).
   *  - ADMIN sees everything.
   *  - Staff see only logs for applications currently assigned to them.
   *  - Anyone else (e.g. a customer) sees nothing.
   */
  async findAll(query: QueryAuditLogsDto, actor: AuthenticatedUser) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? DEFAULT_TAKE, MAX_TAKE);

    const where = await this.buildWhere(query, actor);
    if (where === null) {
      return { data: [], total: 0, skip, take };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          applicationId: true,
          performedById: true,
          actionType: true,
          details: true,
          createdAt: true,
          performedBy: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  /**
   * Admin SLA dashboard: applications still in-flight whose current stage has
   * not changed for longer than the configured SLA threshold, with a daysStuck
   * metric. Threshold = SLA_THRESHOLD_HOURS (.env), defaulting to 48h.
   */
  async getSlaBreaches() {
    const parsed = Number(this.config.get('SLA_THRESHOLD_HOURS'));
    const thresholdHours =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_SLA_THRESHOLD_HOURS;
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    const applications = await this.prisma.visaApplication.findMany({
      where: {
        currentStage: {
          notIn: [VisaStage.COMPLETED, VisaStage.CANCELLED, VisaStage.PAUSED],
        },
        stageUpdatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        currentStage: true,
        stageUpdatedAt: true,
        createdAt: true,
        assignedSalesId: true,
        assignedDocId: true,
        assignedSecId: true,
        customer: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { stageUpdatedAt: 'asc' }, // most overdue first
    });

    const now = Date.now();
    return applications.map((app) => ({
      ...app,
      daysStuck: Number(
        ((now - app.stageUpdatedAt.getTime()) / MS_PER_DAY).toFixed(1),
      ),
    }));
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  /** Builds the where filter, or null when the caller has no visibility. */
  private async buildWhere(
    query: QueryAuditLogsDto,
    actor: AuthenticatedUser,
  ): Promise<Prisma.AuditLogWhereInput | null> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.userId) where.performedById = query.userId;
    if (query.actionType) where.actionType = query.actionType;

    if (actor.role === Role.ADMIN) {
      return where;
    }

    // Staff: restrict to applications currently assigned to them.
    const staff = await this.prisma.staff.findUnique({
      where: { userId: actor.userId },
      select: { id: true, department: true },
    });
    if (!staff) {
      return null; // not a staff member (e.g. a customer) -> no visibility
    }

    where.application = this.assignedToStaffFilter(staff.department, staff.id);
    return where;
  }

  private assignedToStaffFilter(
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
        throw new Error('Unsupported staff department');
    }
  }
}
