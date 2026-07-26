import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const DUMMY_EMAIL_SUFFIX = '@excel-import.local';

type RevertStats = {
  matchedUsers: number;
  matchedApplications: number;
  plannedCrmRows: number;
  plannedDetailsRows: number;
  plannedOnboardingRows: number;
  plannedDocAssistantRows: number;
  plannedDocuments: number;
  plannedAuditLogs: number;
  plannedMessages: number;
  plannedStaffRows: number;
  deletedCrmRows: number;
  deletedDetailsRows: number;
  deletedOnboardingRows: number;
  deletedDocAssistantRows: number;
  deletedDocuments: number;
  deletedAuditLogs: number;
  deletedApplications: number;
  deletedMessages: number;
  deletedStaffRows: number;
  deletedUsers: number;
};

function parseArgs(argv: string[]): { dryRun: boolean } {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

function printSummary(mode: 'DRY RUN' | 'REVERT', stats: RevertStats): void {
  console.log('----------------------------------------');
  console.log(`Excel ${mode} summary`);
  console.log(`Email filter: *${DUMMY_EMAIL_SUFFIX}`);
  console.log(`Matched users: ${stats.matchedUsers}`);
  console.log(`Matched applications: ${stats.matchedApplications}`);
  console.log(`Planned CRM rows: ${stats.plannedCrmRows}`);
  console.log(`Planned detail rows: ${stats.plannedDetailsRows}`);
  console.log(`Planned onboarding rows: ${stats.plannedOnboardingRows}`);
  console.log(`Planned doc-assistant rows: ${stats.plannedDocAssistantRows}`);
  console.log(`Planned documents: ${stats.plannedDocuments}`);
  console.log(`Planned audit logs: ${stats.plannedAuditLogs}`);
  console.log(`Planned messages: ${stats.plannedMessages}`);
  console.log(`Planned staff rows: ${stats.plannedStaffRows}`);

  if (mode === 'REVERT') {
    console.log(`Deleted CRM rows: ${stats.deletedCrmRows}`);
    console.log(`Deleted detail rows: ${stats.deletedDetailsRows}`);
    console.log(`Deleted onboarding rows: ${stats.deletedOnboardingRows}`);
    console.log(`Deleted doc-assistant rows: ${stats.deletedDocAssistantRows}`);
    console.log(`Deleted documents: ${stats.deletedDocuments}`);
    console.log(`Deleted audit logs: ${stats.deletedAuditLogs}`);
    console.log(`Deleted applications: ${stats.deletedApplications}`);
    console.log(`Deleted messages: ${stats.deletedMessages}`);
    console.log(`Deleted staff rows: ${stats.deletedStaffRows}`);
    console.log(`Deleted users: ${stats.deletedUsers}`);
  }

  console.log('----------------------------------------');
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env before running revert.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          endsWith: DUMMY_EMAIL_SUFFIX,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    const userIds = users.map((user) => user.id);

    if (userIds.length === 0) {
      printSummary(dryRun ? 'DRY RUN' : 'REVERT', {
        matchedUsers: 0,
        matchedApplications: 0,
        plannedCrmRows: 0,
        plannedDetailsRows: 0,
        plannedOnboardingRows: 0,
        plannedDocAssistantRows: 0,
        plannedDocuments: 0,
        plannedAuditLogs: 0,
        plannedMessages: 0,
        plannedStaffRows: 0,
        deletedCrmRows: 0,
        deletedDetailsRows: 0,
        deletedOnboardingRows: 0,
        deletedDocAssistantRows: 0,
        deletedDocuments: 0,
        deletedAuditLogs: 0,
        deletedApplications: 0,
        deletedMessages: 0,
        deletedStaffRows: 0,
        deletedUsers: 0,
      });
      return;
    }

    const applications = await prisma.visaApplication.findMany({
      where: {
        customerId: {
          in: userIds,
        },
      },
      select: {
        id: true,
      },
    });

    const applicationIds = applications.map((application) => application.id);

    const [
      plannedCrmRows,
      plannedDetailsRows,
      plannedOnboardingRows,
      plannedDocAssistantRows,
      plannedDocuments,
      plannedAuditLogs,
      plannedMessages,
      plannedStaffRows,
    ] = await prisma.$transaction([
      prisma.applicationCrmData.count({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      }),
      prisma.visaApplicationDetails.count({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      }),
      prisma.onboardingApplicant.count({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      }),
      prisma.applicationDocAssistantItem.count({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      }),
      prisma.document.count({
        where: {
          OR: [
            {
              applicationId: {
                in: applicationIds,
              },
            },
            {
              uploadedById: {
                in: userIds,
              },
            },
          ],
        },
      }),
      prisma.auditLog.count({
        where: {
          OR: [
            {
              applicationId: {
                in: applicationIds,
              },
            },
            {
              performedById: {
                in: userIds,
              },
            },
          ],
        },
      }),
      prisma.message.count({
        where: {
          OR: [
            {
              senderId: {
                in: userIds,
              },
            },
            {
              receiverId: {
                in: userIds,
              },
            },
          ],
        },
      }),
      prisma.staff.count({
        where: {
          userId: {
            in: userIds,
          },
        },
      }),
    ]);

    const baseStats: RevertStats = {
      matchedUsers: userIds.length,
      matchedApplications: applicationIds.length,
      plannedCrmRows,
      plannedDetailsRows,
      plannedOnboardingRows,
      plannedDocAssistantRows,
      plannedDocuments,
      plannedAuditLogs,
      plannedMessages,
      plannedStaffRows,
      deletedCrmRows: 0,
      deletedDetailsRows: 0,
      deletedOnboardingRows: 0,
      deletedDocAssistantRows: 0,
      deletedDocuments: 0,
      deletedAuditLogs: 0,
      deletedApplications: 0,
      deletedMessages: 0,
      deletedStaffRows: 0,
      deletedUsers: 0,
    };

    if (dryRun) {
      printSummary('DRY RUN', baseStats);
      return;
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const deletedCrmRows = await tx.applicationCrmData.deleteMany({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      });

      const deletedDetailsRows = await tx.visaApplicationDetails.deleteMany({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      });

      const deletedOnboardingRows = await tx.onboardingApplicant.deleteMany({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      });

      const deletedDocAssistantRows = await tx.applicationDocAssistantItem.deleteMany({
        where: {
          applicationId: {
            in: applicationIds,
          },
        },
      });

      const deletedDocuments = await tx.document.deleteMany({
        where: {
          OR: [
            {
              applicationId: {
                in: applicationIds,
              },
            },
            {
              uploadedById: {
                in: userIds,
              },
            },
          ],
        },
      });

      const deletedAuditLogs = await tx.auditLog.deleteMany({
        where: {
          OR: [
            {
              applicationId: {
                in: applicationIds,
              },
            },
            {
              performedById: {
                in: userIds,
              },
            },
          ],
        },
      });

      const deletedApplications = await tx.visaApplication.deleteMany({
        where: {
          id: {
            in: applicationIds,
          },
        },
      });

      const deletedMessages = await tx.message.deleteMany({
        where: {
          OR: [
            {
              senderId: {
                in: userIds,
              },
            },
            {
              receiverId: {
                in: userIds,
              },
            },
          ],
        },
      });

      const deletedStaffRows = await tx.staff.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      const deletedUsers = await tx.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      return {
        deletedCrmRows: deletedCrmRows.count,
        deletedDetailsRows: deletedDetailsRows.count,
        deletedOnboardingRows: deletedOnboardingRows.count,
        deletedDocAssistantRows: deletedDocAssistantRows.count,
        deletedDocuments: deletedDocuments.count,
        deletedAuditLogs: deletedAuditLogs.count,
        deletedApplications: deletedApplications.count,
        deletedMessages: deletedMessages.count,
        deletedStaffRows: deletedStaffRows.count,
        deletedUsers: deletedUsers.count,
      };
    });

    printSummary('REVERT', {
      ...baseStats,
      ...deleted,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Excel revert failed:', error);
  process.exit(1);
});