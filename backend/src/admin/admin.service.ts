import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { Department, FileType, VisaStage } from '../generated/prisma/enums';
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

const DEFAULT_DOC_CLAIM_SLA_HOURS = 2;

type FinancePeriodKey = 'daily' | 'weekly' | 'monthly' | 'yearly';
type DeliveryStatus = 'TESLIM_EDILDI' | 'BEKLIYOR' | 'EKSIK';

function isVisaStage(value: unknown): value is VisaStage {
  return typeof value === 'string' && Object.values(VisaStage).includes(value as VisaStage);
}

function readDetailStage(
  details: Prisma.JsonValue,
  key: 'previousStage' | 'newStage',
): VisaStage | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }
  const candidate = (details as Record<string, unknown>)[key];
  return isVisaStage(candidate) ? candidate : null;
}

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

function resolveDeliveryStatus(
  documents: Array<{ isApproved: boolean; rejectionReason: string | null }>,
): DeliveryStatus {
  if (documents.length === 0) {
    return 'BEKLIYOR';
  }
  if (documents.some((document) => Boolean(document.rejectionReason))) {
    return 'EKSIK';
  }
  if (documents.some((document) => !document.isApproved)) {
    return 'BEKLIYOR';
  }
  return 'TESLIM_EDILDI';
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Flat admin master table rows (Excel-like frontend grid source). */
  async getMasterTable() {
    const applications = await this.prisma.visaApplication.findMany({
      where: {
        crmData: {
          isNot: null,
        },
        currentStage: {
          notIn: [VisaStage.CANCELLED],
        },
      },
      select: {
        id: true,
        createdAt: true,
        applicationType: true,
        customer: {
          select: {
            fullName: true,
            phone: true,
            targetCountry: true,
          },
        },
        details: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        crmData: {
          select: {
            totalAmount: true,
            upfrontPaid: true,
            paymentType: true,
            appointmentDate: true,
            appointmentNote: true,
          },
        },
        documents: {
          select: {
            isApproved: true,
            rejectionReason: true,
          },
        },
        salesStaff: {
          select: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        assignedSales: {
          select: {
            user: {
              select: {
                fullName: true,
              },
            },
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return applications.map((application) => {
      const trimmedFullName = application.customer.fullName.trim();
      const fullNameParts = trimmedFullName.length
        ? trimmedFullName.split(/\s+/)
        : [];

      const fallbackFirstName = fullNameParts[0] ?? '';
      const fallbackLastName =
        fullNameParts.length > 1 ? fullNameParts.slice(1).join(' ') : '';

      const firstName = application.details?.firstName ?? fallbackFirstName;
      const lastName = application.details?.lastName ?? fallbackLastName;

      return {
        applicationId: application.id,
        createdAt: application.createdAt.toISOString(),
        applicationType: application.applicationType,
        firstName,
        lastName,
        phone: application.details?.phone ?? application.customer.phone ?? '',
        country: application.customer.targetCountry ?? '',
        totalAmount: application.crmData?.totalAmount ?? 0,
        upfrontPaid: application.crmData?.upfrontPaid ?? null,
        paymentType: application.crmData?.paymentType ?? null,
        appointmentDate: application.crmData?.appointmentDate
          ? application.crmData.appointmentDate.toISOString()
          : null,
        appointmentNote: application.crmData?.appointmentNote ?? null,
        deliveryStatus: resolveDeliveryStatus(application.documents),
        salesStaff:
          application.salesStaff?.user.fullName ??
          application.assignedSales?.user.fullName ??
          null,
        docStaff: application.assignedDoc?.user.fullName ?? null,
      };
    });
  }

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

  /**
   * SLA/compliance table: queue delay from Sales handoff (SALES_PROCESS -> DOC_POOL)
   * to DOC claim (DOC_POOL -> DOC_PROCESS).
   */
  async getCompliance() {
    const parsed = Number(this.config.get('SLA_SALES_PROCESS_HOURS'));
    const slaHours =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_DOC_CLAIM_SLA_HOURS;
    const slaMs = slaHours * 60 * 60 * 1000;

    const applications = await this.prisma.visaApplication.findMany({
      select: {
        id: true,
        currentStage: true,
        customer: {
          select: {
            fullName: true,
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
        auditLogs: {
          where: {
            actionType: {
              in: ['STAGE_CHANGED', 'CLAIMED'],
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            actionType: true,
            createdAt: true,
            details: true,
            performedBy: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    const now = Date.now();
    const rows = applications
      .map((application) => {
        let salesToDocAt: Date | null = null;
        let docClaimAt: Date | null = null;
        let docClaimedBy: string | null = null;

        for (const log of application.auditLogs) {
          if (log.actionType === 'STAGE_CHANGED') {
            const previousStage = readDetailStage(log.details, 'previousStage');
            const newStage = readDetailStage(log.details, 'newStage');
            if (
              previousStage === VisaStage.SALES_PROCESS &&
              newStage === VisaStage.DOC_POOL
            ) {
              salesToDocAt = log.createdAt;
              docClaimAt = null;
              docClaimedBy = null;
            }
            continue;
          }

          if (log.actionType === 'CLAIMED' && salesToDocAt && !docClaimAt) {
            const previousStage = readDetailStage(log.details, 'previousStage');
            const newStage = readDetailStage(log.details, 'newStage');
            if (
              previousStage === VisaStage.DOC_POOL &&
              newStage === VisaStage.DOC_PROCESS &&
              log.createdAt.getTime() >= salesToDocAt.getTime()
            ) {
              docClaimAt = log.createdAt;
              docClaimedBy = log.performedBy.fullName;
            }
          }
        }

        if (!salesToDocAt) {
          return null;
        }

        const waitMs = (docClaimAt ?? new Date(now)).getTime() - salesToDocAt.getTime();
        const status = docClaimAt ? 'CLAIMED' : 'WAITING';

        return {
          applicationId: application.id,
          customerName: application.customer.fullName,
          currentStage: application.currentStage,
          salesToDocAt: salesToDocAt.toISOString(),
          docClaimAt: docClaimAt ? docClaimAt.toISOString() : null,
          waitMs,
          status,
          docClaimedBy,
          docAssignee: application.assignedDoc?.user.fullName ?? null,
          isSlaBreached: waitMs > slaMs,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.waitMs - a.waitMs);

    const claimedRows = rows.filter((row) => row.status === 'CLAIMED');
    const waitingRows = rows.filter((row) => row.status === 'WAITING');

    const avgClaimWaitMs = claimedRows.length
      ? Math.round(
          claimedRows.reduce((sum, row) => sum + row.waitMs, 0) /
            claimedRows.length,
        )
      : 0;

    const maxOpenWaitMs = waitingRows.reduce(
      (max, row) => Math.max(max, row.waitMs),
      0,
    );

    return {
      slaHours,
      totalTransferred: rows.length,
      claimedCount: claimedRows.length,
      waitingCount: waitingRows.length,
      breachedCount: rows.filter((row) => row.isSlaBreached).length,
      avgClaimWaitMs,
      maxOpenWaitMs,
      rows,
    };
  }

  /** Finance & accounting dashboard: income/expense/net across standard periods. */
  async getFinance() {
    const now = new Date();
    const starts = this.financePeriodStarts(now);

    const metricsEntries = await Promise.all(
      (Object.keys(starts) as FinancePeriodKey[]).map(async (period) => {
        const start = starts[period];

        const [incomeAgg, expenseAgg] = await Promise.all([
          this.prisma.applicationCrmData.aggregate({
            where: {
              salesDate: {
                gte: start,
                lte: now,
              },
            },
            _sum: {
              totalAmount: true,
            },
          }),
          this.prisma.applicationCrmData.aggregate({
            where: {
              appointmentDate: {
                gte: start,
                lte: now,
              },
            },
            _sum: {
              appointmentExpense: true,
            },
          }),
        ]);

        const totalIncome = incomeAgg._sum.totalAmount ?? 0;
        const totalExpense = expenseAgg._sum.appointmentExpense ?? 0;

        return [
          period,
          {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
          },
        ] as const;
      }),
    );

    const pendingRowsRaw = await this.prisma.visaApplication.findMany({
      where: {
        crmData: {
          is: {
            paymentType: 'PREPAID',
            totalAmount: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        currentStage: true,
        customer: {
          select: {
            fullName: true,
            email: true,
          },
        },
        crmData: {
          select: {
            salesDate: true,
            totalAmount: true,
            upfrontPaid: true,
            appointmentExpense: true,
          },
        },
        documents: {
          where: {
            fileType: FileType.FINAL_RECEIPT,
            isApproved: true,
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    const pendingPayments = pendingRowsRaw
      .map((row) => {
        const totalAmount = row.crmData?.totalAmount ?? 0;
        const upfrontPaid = row.crmData?.upfrontPaid ?? 0;
        const remainingAmount = totalAmount - upfrontPaid;
        const hasFinalReceipt = row.documents.length > 0;

        return {
          applicationId: row.id,
          customerName: row.customer.fullName,
          customerEmail: row.customer.email,
          currentStage: row.currentStage,
          salesDate: row.crmData?.salesDate?.toISOString() ?? null,
          totalAmount,
          upfrontPaid,
          remainingAmount,
          appointmentExpense: row.crmData?.appointmentExpense ?? null,
          hasFinalReceipt,
        };
      })
      .filter((row) => row.remainingAmount > 0 && !row.hasFinalReceipt)
      .sort((a, b) => b.remainingAmount - a.remainingAmount);

    const allTransactionsRaw = await this.prisma.visaApplication.findMany({
      where: {
        currentStage: {
          notIn: [VisaStage.CANCELLED],
        },
      },
      select: {
        id: true,
        currentStage: true,
        customer: {
          select: {
            fullName: true,
            email: true,
          },
        },
        crmData: {
          select: {
            salesDate: true,
            totalAmount: true,
            appointmentExpense: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const allTransactions = allTransactionsRaw.map((row) => {
      const totalAmount = row.crmData?.totalAmount ?? 0;
      const appointmentExpense = row.crmData?.appointmentExpense ?? 0;

      return {
        applicationId: row.id,
        customerName: row.customer.fullName,
        customerEmail: row.customer.email,
        currentStage: row.currentStage,
        salesDate: row.crmData?.salesDate?.toISOString() ?? null,
        totalAmount,
        appointmentExpense,
        netProfit: totalAmount - appointmentExpense,
      };
    });

    return {
      generatedAt: now.toISOString(),
      metrics: Object.fromEntries(metricsEntries) as Record<
        FinancePeriodKey,
        {
          totalIncome: number;
          totalExpense: number;
          netProfit: number;
        }
      >,
      pendingPayments,
      allTransactions,
    };
  }

  private financePeriodStarts(now: Date): Record<FinancePeriodKey, Date> {
    const daily = new Date(now);
    daily.setHours(0, 0, 0, 0);

    const weekly = new Date(daily);
    const weekday = weekly.getDay();
    const diffToMonday = (weekday + 6) % 7;
    weekly.setDate(weekly.getDate() - diffToMonday);

    const monthly = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const yearly = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

    return {
      daily,
      weekly,
      monthly,
      yearly,
    };
  }
}
