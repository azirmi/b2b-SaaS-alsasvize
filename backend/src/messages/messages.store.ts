import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  parseAppointmentReminderMarker,
  stripNotificationMarker,
  withNotificationMarker,
  buildAppointmentReminderMarker,
} from './notification-markers';

const MESSAGE_INCLUDE = {
  sender: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
  receiver: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class MessagesStore {
  constructor(private readonly prisma: PrismaService) {}

  async send(dto: CreateMessageDto, actor: AuthenticatedUser) {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Mesaj içeriği boş olamaz');
    }

    const receiver = await this.prisma.user.findFirst({
      where: {
        id: dto.receiverId,
        isActive: true,
        role: { in: [Role.SALES, Role.DOC] },
      },
      select: {
        id: true,
      },
    });

    if (!receiver) {
      throw new NotFoundException('Aktif satış veya evrak personeli bulunamadı');
    }

    return this.prisma.message.create({
      data: {
        senderId: actor.userId,
        receiverId: receiver.id,
        content,
      },
      include: MESSAGE_INCLUDE,
    });
  }

  getUnread(actor: AuthenticatedUser) {
    return this.prisma.message.findMany({
      where: {
        receiverId: actor.userId,
        isRead: false,
      },
      include: {
        sender: MESSAGE_INCLUDE.sender,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    }).then((messages) =>
      messages.map((message) => ({
        ...message,
        content: stripNotificationMarker(message.content),
      })),
    );
  }

  async markAsRead(id: string, actor: AuthenticatedUser) {
    const target = await this.prisma.message.findFirst({
      where: {
        id,
        receiverId: actor.userId,
      },
      select: {
        id: true,
        content: true,
        isRead: true,
      },
    });

    if (!target) {
      throw new NotFoundException('Mesaj bulunamadı');
    }

    if (target.isRead) {
      return { ok: true };
    }

    await this.prisma.message.updateMany({
      where: {
        id,
        receiverId: actor.userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    await this.notifyAdminsWhenDocReadsReminder(target.content, actor);

    return { ok: true };
  }

  private async notifyAdminsWhenDocReadsReminder(
    content: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role !== Role.DOC) {
      return;
    }

    const marker = parseAppointmentReminderMarker(content);
    if (!marker) {
      return;
    }

    const [docUser, application, admins] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: { fullName: true },
      }),
      this.prisma.visaApplication.findUnique({
        where: { id: marker.applicationId },
        select: {
          customer: {
            select: {
              fullName: true,
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

    if (!docUser || !application || admins.length === 0) {
      return;
    }

    const followUpMessage = withNotificationMarker(
      buildAppointmentReminderMarker(
        marker.applicationId,
        marker.appointmentDate,
      ),
      `Doc ${docUser.fullName} read the notification for Customer ${application.customer.fullName}.`,
    );

    await this.prisma.message.createMany({
      data: admins.map((admin) => ({
        senderId: actor.userId,
        receiverId: admin.id,
        content: followUpMessage,
      })),
    });
  }
}
