import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '../generated/prisma/client';
import { VisaStage } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type AssignmentField = 'assignedSalesId' | 'assignedDocId' | 'assignedSecId';

/** One SLA rule per department process stage (extensible: add DOC/SEC here). */
interface SlaRule {
  processStage: VisaStage;
  poolStage: VisaStage;
  assignmentField: AssignmentField;
  thresholdHours: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_SALES_PROCESS_SLA_HOURS = 2;
const DEFAULT_SLA_AUTO_REVERT_ENABLED = false;

/**
 * Periodically reclaims applications that have stalled in a department's
 * *_PROCESS stage beyond its SLA threshold: reverts them to the department pool,
 * clears the assignment, audits the reversion, and pushes a real-time event so
 * the freed task reappears in the pool without a manual refresh.
 */
@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);
  private readonly rules: SlaRule[];
  private readonly autoRevertEnabled: boolean;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    config: ConfigService,
  ) {
    this.autoRevertEnabled = this.resolveBoolean(
      config.get('SLA_AUTO_REVERT_ENABLED'),
      DEFAULT_SLA_AUTO_REVERT_ENABLED,
    );

    // Thresholds are env-driven per department, defaulting to the spec's 2h.
    this.rules = [
      {
        processStage: VisaStage.SALES_PROCESS,
        poolStage: VisaStage.SALES_POOL,
        assignmentField: 'assignedSalesId',
        thresholdHours: this.resolveHours(
          config.get('SLA_SALES_PROCESS_HOURS'),
          DEFAULT_SALES_PROCESS_SLA_HOURS,
        ),
      },
    ];

    if (!this.autoRevertEnabled) {
      this.logger.warn(
        'SLA auto-revert disabled (SLA_AUTO_REVERT_ENABLED=false); applications will not be moved back to pool automatically.',
      );
    }
  }

  /**
   * Runs every 5 minutes. Guarded against overlapping executions so a slow pass
   * never double-processes an application.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async enforceSlaBreaches(): Promise<void> {
    if (!this.autoRevertEnabled) {
      return;
    }
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      for (const rule of this.rules) {
        await this.enforceRule(rule);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async enforceRule(rule: SlaRule): Promise<void> {
    const cutoff = new Date(Date.now() - rule.thresholdHours * MS_PER_HOUR);

    const breached = await this.prisma.visaApplication.findMany({
      where: {
        currentStage: rule.processStage,
        stageUpdatedAt: { lt: cutoff },
        ...this.assignedNotNullWhere(rule.assignmentField),
      },
      select: {
        id: true,
        assignedSalesId: true,
        assignedDocId: true,
        assignedSecId: true,
      },
    });

    for (const application of breached) {
      const staffId = this.readAssignedId(application, rule.assignmentField);
      if (!staffId) {
        continue;
      }
      await this.revertBreachedApplication(application.id, staffId, rule);
    }
  }

  /**
   * Reverts a single stalled application atomically — the mutation and the
   * SLA_BREACH audit row commit together — then emits the real-time events
   * strictly after the transaction has committed.
   */
  private async revertBreachedApplication(
    applicationId: string,
    assignedStaffId: string,
    rule: SlaRule,
  ): Promise<void> {
    // Resolve the responsible user so the audit trail records who held the file.
    const staff = await this.prisma.staff.findUnique({
      where: { id: assignedStaffId },
      select: { userId: true },
    });
    if (!staff) {
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const { where, data } = this.buildRevertUpdate(
          applicationId,
          rule,
          assignedStaffId,
        );
        // Conditional WHERE => atomic compare-and-swap. If the application was
        // completed, reassigned or already reverted between the scan and now,
        // this matches nothing and throws P2025 (handled below).
        await tx.visaApplication.update({ where, data });

        await tx.auditLog.create({
          data: {
            application: { connect: { id: applicationId } },
            performedBy: { connect: { id: staff.userId } },
            actionType: 'SLA_BREACH',
            details: {
              previousStage: rule.processStage,
              newStage: rule.poolStage,
              revertedStaffId: assignedStaffId,
              thresholdHours: rule.thresholdHours,
              trigger: 'SLA_CRON',
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // The application moved on between the scan and the update — skip it.
        return;
      }
      this.logger.error(
        `Failed to revert SLA-breached application ${applicationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    // Post-commit only: clients never observe a reversion that later rolled back.
    const at = new Date().toISOString();
    this.events.emitStageChanged({
      applicationId,
      previousStage: rule.processStage,
      newStage: rule.poolStage,
      performedByUserId: staff.userId,
      at,
    });
    this.events.emitSlaBreached({
      applicationId,
      previousStage: rule.processStage,
      newStage: rule.poolStage,
      revertedStaffId: assignedStaffId,
      thresholdHours: rule.thresholdHours,
      at,
    });

    this.logger.warn(
      `SLA breach: application ${applicationId} reverted ${rule.processStage} -> ${rule.poolStage} after ${rule.thresholdHours}h (held by staff ${assignedStaffId})`,
    );
  }

  private resolveHours(raw: unknown, fallback: number): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private resolveBoolean(raw: unknown, fallback: boolean): boolean {
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  private assignedNotNullWhere(
    field: AssignmentField,
  ): Prisma.VisaApplicationWhereInput {
    switch (field) {
      case 'assignedSalesId':
        return { assignedSalesId: { not: null } };
      case 'assignedDocId':
        return { assignedDocId: { not: null } };
      case 'assignedSecId':
        return { assignedSecId: { not: null } };
    }
  }

  private readAssignedId(
    application: {
      assignedSalesId: string | null;
      assignedDocId: string | null;
      assignedSecId: string | null;
    },
    field: AssignmentField,
  ): string | null {
    switch (field) {
      case 'assignedSalesId':
        return application.assignedSalesId;
      case 'assignedDocId':
        return application.assignedDocId;
      case 'assignedSecId':
        return application.assignedSecId;
    }
  }

  /** Builds the atomic revert where/data for a rule (no dynamic Prisma keys). */
  private buildRevertUpdate(
    id: string,
    rule: SlaRule,
    staffId: string,
  ): {
    where: Prisma.VisaApplicationWhereUniqueInput;
    data: Prisma.VisaApplicationUncheckedUpdateInput;
  } {
    const baseData = {
      currentStage: rule.poolStage,
      stageUpdatedAt: new Date(),
    };
    switch (rule.assignmentField) {
      case 'assignedSalesId':
        return {
          where: {
            id,
            currentStage: rule.processStage,
            assignedSalesId: staffId,
          },
          data: { ...baseData, assignedSalesId: null },
        };
      case 'assignedDocId':
        return {
          where: {
            id,
            currentStage: rule.processStage,
            assignedDocId: staffId,
          },
          data: { ...baseData, assignedDocId: null },
        };
      case 'assignedSecId':
        return {
          where: {
            id,
            currentStage: rule.processStage,
            assignedSecId: staffId,
          },
          data: { ...baseData, assignedSecId: null },
        };
    }
  }
}
