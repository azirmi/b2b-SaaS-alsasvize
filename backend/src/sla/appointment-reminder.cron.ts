import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { Role, VisaStage } from '../generated/prisma/enums';
import {
  buildAppointmentReminderMarker,
  withNotificationMarker,
} from '../messages/notification-markers';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AppointmentReminderCron {
  private readonly logger = new Logger(AppointmentReminderCron.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendFourDayAppointmentReminders(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      await this.runReminderCycle();
    } finally {
      this.isRunning = false;
    }
  }

  private async runReminderCycle(): Promise<void> {
    const targetDate = new Date(Date.now() + 4 * DAY_MS);
    const dayStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const [applications, admins] = await Promise.all([
      this.prisma.visaApplication.findMany({
        where: {
          currentStage: {
            notIn: [VisaStage.COMPLETED, VisaStage.CANCELLED],
          },
          assignedDocId: { not: null },
          crmData: {
            is: {
              appointmentDate: {
                gte: dayStart,
                lt: dayEnd,
              },
            },
          },
        },
        select: {
          id: true,
          customer: {
            select: {
              email: true,
              fullName: true,
            },
          },
          assignedDoc: {
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
          crmData: {
            select: {
              appointmentDate: true,
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (applications.length === 0) {
      return;
    }

    const systemSenderId = admins[0]?.id;
    if (!systemSenderId) {
      this.logger.warn(
        'No active admin found for appointment reminder sender context.',
      );
      return;
    }

    let sentCount = 0;

    for (const application of applications) {
      const appointmentDate = application.crmData?.appointmentDate;
      const docUser = application.assignedDoc?.user;
      if (!appointmentDate || !docUser) {
        continue;
      }

      const appointmentDay = appointmentDate.toISOString().slice(0, 10);
      const marker = buildAppointmentReminderMarker(
        application.id,
        appointmentDay,
      );

      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.message.findFirst({
          where: {
            receiverId: docUser.id,
            content: {
              startsWith: marker,
            },
          },
          select: {
            id: true,
          },
        });
        if (existing) {
          return false;
        }

        const docContent = withNotificationMarker(
          marker,
          `Randevunuza 4 gün kaldı. Danışan: ${application.customer.fullName}.`,
        );

        await tx.message.create({
          data: {
            senderId: systemSenderId,
            receiverId: docUser.id,
            content: docContent,
          },
        });

        if (admins.length > 0) {
          const adminContent = withNotificationMarker(
            marker,
            `Doc ${docUser.fullName} received notification for Customer ${application.customer.fullName} - Unread.`,
          );

          await tx.message.createMany({
            data: admins.map((admin) => ({
              senderId: docUser.id,
              receiverId: admin.id,
              content: adminContent,
            })),
          });
        }

        return true;
      });

      if (!created) {
        continue;
      }

      sentCount += 1;

      if (application.customer.email) {
        void this.email.sendAppointmentFourDayReminder({
          to: application.customer.email,
          customerName: application.customer.fullName,
          appointmentDate: appointmentDate.toISOString(),
          applicationId: application.id,
        });
      }
    }

    if (sentCount > 0) {
      this.logger.log(`Appointment 4-day reminders sent: ${sentCount}`);
    }
  }
}
