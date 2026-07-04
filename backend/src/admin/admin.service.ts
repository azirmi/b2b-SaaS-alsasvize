import { Injectable } from '@nestjs/common';
import { VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Canonical stage order for the analytics breakdown. */
const STAGE_ORDER: VisaStage[] = [
  VisaStage.SALES_POOL,
  VisaStage.SALES_PROCESS,
  VisaStage.DOC_POOL,
  VisaStage.DOC_PROCESS,
  VisaStage.SEC_POOL,
  VisaStage.SEC_PROCESS,
  VisaStage.COMPLETED,
  VisaStage.PAUSED,
  VisaStage.CANCELLED,
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Business analytics for the owner dashboard:
   *  - total applications broken down by stage,
   *  - per-staff productivity (claims + stage transitions performed),
   *  - average processing time from creation to completion.
   */
  async getStats() {
    const [total, byStageRaw, claimedRaw, processedRaw, staff, completed] =
      await Promise.all([
        this.prisma.visaApplication.count(),
        this.prisma.visaApplication.groupBy({
          by: ['currentStage'],
          _count: { _all: true },
          orderBy: { currentStage: 'asc' },
        }),
        this.prisma.auditLog.groupBy({
          by: ['performedById'],
          where: { actionType: 'CLAIMED' },
          _count: { _all: true },
          orderBy: { performedById: 'asc' },
        }),
        this.prisma.auditLog.groupBy({
          by: ['performedById'],
          where: { actionType: 'STAGE_CHANGED' },
          _count: { _all: true },
          orderBy: { performedById: 'asc' },
        }),
        this.prisma.staff.findMany({
          select: {
            id: true,
            department: true,
            user: { select: { id: true, fullName: true } },
          },
        }),
        this.prisma.visaApplication.findMany({
          where: { currentStage: VisaStage.COMPLETED },
          select: { createdAt: true, stageUpdatedAt: true },
        }),
      ]);

    const stageCounts = new Map(
      byStageRaw.map((row) => [row.currentStage, row._count._all]),
    );
    const byStage = STAGE_ORDER.map((stage) => ({
      stage,
      count: stageCounts.get(stage) ?? 0,
    }));

    const claimedMap = new Map(
      claimedRaw.map((row) => [row.performedById, row._count._all]),
    );
    const processedMap = new Map(
      processedRaw.map((row) => [row.performedById, row._count._all]),
    );
    const staffPerformance = staff
      .map((member) => ({
        staffId: member.id,
        userId: member.user.id,
        fullName: member.user.fullName,
        department: member.department,
        claimed: claimedMap.get(member.user.id) ?? 0,
        processed: processedMap.get(member.user.id) ?? 0,
      }))
      .sort((a, b) => b.claimed + b.processed - (a.claimed + a.processed));

    const avgProcessingMs = completed.length
      ? Math.round(
          completed.reduce(
            (sum, app) =>
              sum + (app.stageUpdatedAt.getTime() - app.createdAt.getTime()),
            0,
          ) / completed.length,
        )
      : 0;

    return {
      totalApplications: total,
      byStage,
      staffPerformance,
      avgProcessingMs,
      completedCount: completed.length,
    };
  }
}
