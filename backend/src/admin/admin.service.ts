import { Injectable } from '@nestjs/common';
import { Department, VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const SALES_PIPELINE_STAGES: VisaStage[] = [
  VisaStage.SALES_POOL,
  VisaStage.SALES_PROCESS,
];

const DOC_PIPELINE_STAGES: VisaStage[] = [
  VisaStage.DOC_POOL,
  VisaStage.DOC_PROCESS,
];

const EXCLUDED_SEC_STAGES: VisaStage[] = [
  VisaStage.SEC_POOL,
  VisaStage.SEC_PROCESS,
];

const ACTIVE_PRODUCTIVITY_DEPARTMENTS: Department[] = [
  Department.SALES,
  Department.DOC,
];

function mapPipelineCounts(
  rows: Array<{ currentStage: VisaStage; _count: { _all: number } }>,
  order: VisaStage[],
) {
  const counts = new Map(rows.map((row) => [row.currentStage, row._count._all]));
  return order.map((stage) => ({
    stage,
    count: counts.get(stage) ?? 0,
  }));
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Business analytics for the owner dashboard:
   *  - split pipeline counts for Sales and DOC,
   *  - split per-staff productivity (claims + stage transitions performed),
   *  - average processing time from creation to completion.
   * SEC data is intentionally excluded from all chart datasets.
   */
  async getStats() {
    const [
      total,
      salesPipelineRaw,
      docPipelineRaw,
      claimedRaw,
      processedRaw,
      staff,
      completed,
    ] = await Promise.all([
      this.prisma.visaApplication.count({
        where: {
          currentStage: {
            notIn: EXCLUDED_SEC_STAGES,
          },
        },
      }),
      this.prisma.visaApplication.groupBy({
        by: ['currentStage'],
        where: {
          currentStage: {
            in: SALES_PIPELINE_STAGES,
          },
        },
        _count: { _all: true },
      }),
      this.prisma.visaApplication.groupBy({
        by: ['currentStage'],
        where: {
          currentStage: {
            in: DOC_PIPELINE_STAGES,
          },
        },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['performedById'],
        where: { actionType: 'CLAIMED' },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['performedById'],
        where: { actionType: 'STAGE_CHANGED' },
        _count: { _all: true },
      }),
      this.prisma.staff.findMany({
        where: {
          department: {
            in: ACTIVE_PRODUCTIVITY_DEPARTMENTS,
          },
        },
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

    const claimedMap = new Map(
      claimedRaw.map((row) => [row.performedById, row._count._all]),
    );
    const processedMap = new Map(
      processedRaw.map((row) => [row.performedById, row._count._all]),
    );
    const allStaffPerformance = staff
      .map((member) => {
        const claimed = claimedMap.get(member.user.id) ?? 0;
        const processed = processedMap.get(member.user.id) ?? 0;
        return {
          staffId: member.id,
          userId: member.user.id,
          fullName: member.user.fullName,
          department: member.department,
          claimed,
          processed,
          total: claimed + processed,
        };
      })
      .sort((a, b) => b.total - a.total);

    const salesProductivity = allStaffPerformance
      .filter((member) => member.department === Department.SALES)
      .map(({ total: _total, ...rest }) => rest);
    const docProductivity = allStaffPerformance
      .filter((member) => member.department === Department.DOC)
      .map(({ total: _total, ...rest }) => rest);

    const salesPipeline = mapPipelineCounts(
      salesPipelineRaw,
      SALES_PIPELINE_STAGES,
    );
    const docPipeline = mapPipelineCounts(docPipelineRaw, DOC_PIPELINE_STAGES);

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
      salesPipeline,
      salesProductivity,
      docPipeline,
      docProductivity,
      avgProcessingMs,
      completedCount: completed.length,
    };
  }
}
