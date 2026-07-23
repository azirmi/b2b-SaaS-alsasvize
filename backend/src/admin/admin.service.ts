import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ApplicationType,
  Department,
  FileType,
  Role,
  VisaStage,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { COUNTRY_RULES } from '../visa-applications/country-rules';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateApplicationCoreDataDto } from './dto/update-application-core-data.dto';

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
const BCRYPT_SALT_ROUNDS = 12;

type StaffRole = 'SALES' | 'DOC' | 'SEC';

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

function isStaffRole(role: Role): role is StaffRole {
  return role === Role.SALES || role === Role.DOC || role === Role.SEC;
}

function toDepartment(role: StaffRole): Department {
  switch (role) {
    case Role.SALES:
      return Department.SALES;
    case Role.DOC:
      return Department.DOC;
    case Role.SEC:
      return Department.SEC;
    default: {
      const _never: never = role;
      throw new Error(`Beklenmeyen personel rolü: ${_never}`);
    }
  }
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** User management list source for the admin "Kullanıcılar" panel. */
  getUsers() {
    return this.prisma.user.findMany({
      omit: { password: true },
      include: {
        staffProfile: {
          select: {
            id: true,
            department: true,
            isAvailable: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Creates a staff/customer account from the admin panel in one transaction. */
  async createUser(dto: CreateAdminUserDto, _actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            fullName,
            role: dto.role,
            isActive: true,
          },
          omit: { password: true },
        });

        const staffProfile = isStaffRole(dto.role)
          ? await tx.staff.create({
              data: {
                userId: user.id,
                department: toDepartment(dto.role),
                isAvailable: true,
              },
              select: {
                id: true,
                department: true,
                isAvailable: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : null;

        return {
          ...user,
          staffProfile,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu e-posta ile kayıtlı bir kullanıcı zaten var');
      }
      throw error;
    }
  }

  /**
   * Admin/Sales override for core application data captured early in onboarding.
   * This updates customer country/appointment city + application residence/travel date
   * and writes an immutable audit row in the same transaction.
   */
  async updateApplicationCoreData(
    applicationId: string,
    dto: UpdateApplicationCoreDataDto,
    actor: AuthenticatedUser,
  ) {
    const applicationType = dto.applicationType;
    const targetCountry = dto.targetCountry.trim();
    const appointmentCity = dto.appointmentCity.trim();
    const residenceCity = dto.residenceCity.trim();
    const plannedTravelDate = dto.plannedTravelDate.trim();
    const requestedApplicantCount = dto.applicantCount;
    const requestedApplicantNames = dto.applicantNames?.map((name) =>
      name.trim(),
    );

    if (
      requestedApplicantNames &&
      requestedApplicantNames.some((name) => name.length === 0)
    ) {
      throw new BadRequestException('Kişi adı boş olamaz');
    }

    if (!Object.values(ApplicationType).includes(applicationType)) {
      throw new BadRequestException('Geçersiz vize türü seçimi');
    }

    const countryRule = COUNTRY_RULES[targetCountry];
    if (!countryRule) {
      throw new BadRequestException('Desteklenmeyen hedef ülke seçimi');
    }
    if (!countryRule.cities.includes(appointmentCity)) {
      throw new BadRequestException(
        'Seçilen ülke için randevu şehri geçersiz',
      );
    }
    const parsedPlannedTravelDate = new Date(`${plannedTravelDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedPlannedTravelDate.getTime())) {
      throw new BadRequestException('Planlanan seyahat tarihi geçersiz');
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.visaApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          applicationType: true,
          customerId: true,
          assignedSalesId: true,
          salesStaffId: true,
          customer: {
            select: {
              fullName: true,
              targetCountry: true,
              appointmentCity: true,
            },
          },
          onboardingApplicants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              fullName: true,
              createdAt: true,
            },
          },
          documents: {
            select: {
              fileType: true,
            },
          },
          residenceCity: true,
          plannedTravelDate: true,
        },
      });

      if (!application) {
        throw new NotFoundException(`Başvuru bulunamadı: ${applicationId}`);
      }

      if (actor.role === Role.SALES) {
        const staff = await tx.staff.findUnique({
          where: { userId: actor.userId },
          select: { id: true, department: true },
        });

        if (!staff || staff.department !== Department.SALES) {
          throw new ForbiddenException('Satış personeli profili bulunamadı');
        }

        const canOverride =
          application.assignedSalesId === staff.id ||
          application.salesStaffId === staff.id;

        if (!canOverride) {
          throw new ForbiddenException(
            'Bu başvurunun temel verilerini düzenleme yetkiniz yok',
          );
        }
      }

      const existingApplicantRows = application.onboardingApplicants.length;
      const existingApplicantCount =
        existingApplicantRows > 0 ? existingApplicantRows : 1;
      const targetApplicantCount = requestedApplicantCount ?? existingApplicantCount;

      if (
        requestedApplicantNames &&
        requestedApplicantNames.length !== targetApplicantCount
      ) {
        throw new BadRequestException(
          `Kişi sayısı ${targetApplicantCount} ise ${targetApplicantCount} adet kişi adı girilmelidir`,
        );
      }

      const passportDocumentCount = application.documents.filter(
        (document) => document.fileType === FileType.PASSPORT,
      ).length;
      if (
        requestedApplicantCount !== undefined &&
        requestedApplicantCount > existingApplicantCount &&
        passportDocumentCount < requestedApplicantCount
      ) {
        throw new BadRequestException(
          `Kişi sayısını ${requestedApplicantCount} yapmak için en az ${requestedApplicantCount} pasaport yüklenmelidir`,
        );
      }

      let resultingApplicantCount = existingApplicantCount;
      let addedApplicantRows = 0;
      let removedApplicantRows = 0;
      let removedDetailRows = 0;
      let renamedApplicantRows = 0;
      let removedApplicantIds: string[] = [];

      if (
        requestedApplicantCount !== undefined &&
        requestedApplicantCount > existingApplicantCount
      ) {
        const rowsToCreate =
          existingApplicantRows === 0
            ? requestedApplicantCount
            : requestedApplicantCount - existingApplicantRows;

        if (rowsToCreate > 0) {
          const firstGeneratedOrdinal =
            existingApplicantRows === 0 ? 1 : existingApplicantRows + 1;

          const applicantRows = Array.from({ length: rowsToCreate }, (_, offset) => {
            const ordinal = firstGeneratedOrdinal + offset;
            const fullName =
              requestedApplicantNames?.[ordinal - 1] ??
              (existingApplicantRows === 0 && offset === 0
                ? application.customer.fullName
                : `Ek Basvuru ${ordinal}`);

            return {
              applicationId: application.id,
              fullName,
            };
          });

          await tx.onboardingApplicant.createMany({ data: applicantRows });
          addedApplicantRows = applicantRows.length;
        }

        resultingApplicantCount = requestedApplicantCount;
      }

      let currentApplicants = await tx.onboardingApplicant.findMany({
        where: { applicationId: application.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          fullName: true,
        },
      });

      if (currentApplicants.length === 0 && resultingApplicantCount > 0) {
        const seededRows = Array.from(
          { length: resultingApplicantCount },
          (_, index) => ({
            applicationId: application.id,
            fullName:
              requestedApplicantNames?.[index] ??
              (index === 0
                ? application.customer.fullName
                : `Ek Basvuru ${index + 1}`),
          }),
        );

        await tx.onboardingApplicant.createMany({ data: seededRows });
        addedApplicantRows += seededRows.length;

        currentApplicants = await tx.onboardingApplicant.findMany({
          where: { applicationId: application.id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            fullName: true,
          },
        });
      }

      if (requestedApplicantNames) {
        const namesToApply = requestedApplicantNames.slice(0, resultingApplicantCount);

        for (let index = 0; index < namesToApply.length; index += 1) {
          const applicant = currentApplicants[index];
          if (!applicant) {
            continue;
          }

          const nextName = namesToApply[index];
          if (applicant.fullName.trim() === nextName) {
            continue;
          }

          await tx.onboardingApplicant.update({
            where: { id: applicant.id },
            data: { fullName: nextName },
          });
          renamedApplicantRows += 1;
        }
      }

      const finalApplicants = await tx.onboardingApplicant.findMany({
        where: { applicationId: application.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          fullName: true,
        },
      });

      if (
        requestedApplicantCount !== undefined &&
        requestedApplicantCount < existingApplicantCount
      ) {
        if (actor.role !== Role.ADMIN) {
          throw new ForbiddenException(
            'Kişi azaltma işlemi yalnızca yönetici tarafından yapılabilir',
          );
        }

        if (existingApplicantRows > 0 && requestedApplicantCount < existingApplicantRows) {
          const applicantsToRemove = application.onboardingApplicants.slice(
            requestedApplicantCount,
          );
          const applicantIdsToRemove = applicantsToRemove.map(
            (applicant) => applicant.id,
          );

          if (applicantIdsToRemove.length > 0) {
            await tx.onboardingApplicant.deleteMany({
              where: {
                id: { in: applicantIdsToRemove },
                applicationId: application.id,
              },
            });
            removedApplicantRows = applicantIdsToRemove.length;
            removedApplicantIds = applicantIdsToRemove;
          }
        }

        const deletedDetails = await tx.visaApplicationDetails.deleteMany({
          where: {
            applicationId: application.id,
            applicantIndex: { gt: requestedApplicantCount },
          },
        });
        removedDetailRows = deletedDetails.count;

        resultingApplicantCount = requestedApplicantCount;
      }

      const updatedCustomer = await tx.user.update({
        where: { id: application.customerId },
        data: {
          targetCountry,
          appointmentCity,
        },
        select: {
          targetCountry: true,
          appointmentCity: true,
        },
      });

      const updatedApplication = await tx.visaApplication.update({
        where: { id: application.id },
        data: {
          applicationType,
          residenceCity,
          plannedTravelDate: parsedPlannedTravelDate,
        },
        select: {
          id: true,
          applicationType: true,
          residenceCity: true,
          plannedTravelDate: true,
        },
      });

      await tx.auditLog.create({
        data: {
          application: { connect: { id: application.id } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'CORE_DATA_OVERRIDDEN',
          details: {
            before: {
              applicationType: application.applicationType,
              targetCountry: application.customer.targetCountry,
              appointmentCity: application.customer.appointmentCity,
              residenceCity: application.residenceCity,
              plannedTravelDate: application.plannedTravelDate
                ? application.plannedTravelDate.toISOString().slice(0, 10)
                : null,
              applicantCount: existingApplicantCount,
              applicantNames: application.onboardingApplicants.map(
                (applicant) => applicant.fullName,
              ),
            },
            after: {
              applicationType: updatedApplication.applicationType,
              targetCountry: updatedCustomer.targetCountry,
              appointmentCity: updatedCustomer.appointmentCity,
              residenceCity: updatedApplication.residenceCity,
              plannedTravelDate: updatedApplication.plannedTravelDate
                ? updatedApplication.plannedTravelDate.toISOString().slice(0, 10)
                : null,
              applicantCount: resultingApplicantCount,
              addedApplicantRows,
              removedApplicantRows,
              removedDetailRows,
              renamedApplicantRows,
              removedApplicantIds,
              passportDocumentCount,
              applicantNames: finalApplicants
                .slice(0, resultingApplicantCount)
                .map((applicant) => applicant.fullName),
            },
          },
        },
      });

      return {
        applicationId: updatedApplication.id,
        applicationType: updatedApplication.applicationType,
        targetCountry: updatedCustomer.targetCountry,
        appointmentCity: updatedCustomer.appointmentCity,
        residenceCity: updatedApplication.residenceCity,
        plannedTravelDate: updatedApplication.plannedTravelDate
          ? updatedApplication.plannedTravelDate.toISOString().slice(0, 10)
          : null,
        applicantCount: resultingApplicantCount,
        removedApplicantRows,
        removedDetailRows,
        renamedApplicantRows,
      };
    });
  }

  /**
   * Admin-only: removes one onboarding applicant from an application.
   * Deletes that applicant's form entry and compacts later applicant indexes
   * so person-based forms remain contiguous.
   */
  async removeOnboardingApplicant(
    applicationId: string,
    applicantId: string,
    actor: AuthenticatedUser,
  ) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Bu işlem yalnızca yönetici tarafından yapılabilir');
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.visaApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          onboardingApplicants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      if (!application) {
        throw new NotFoundException(`Başvuru bulunamadı: ${applicationId}`);
      }

      const currentApplicantCount =
        application.onboardingApplicants.length > 0
          ? application.onboardingApplicants.length
          : 1;

      if (currentApplicantCount <= 1) {
        throw new BadRequestException('Başvuruda en az 1 kişi kalmalıdır');
      }

      const removeIndex = application.onboardingApplicants.findIndex(
        (applicant) => applicant.id === applicantId,
      );
      if (removeIndex < 0) {
        throw new NotFoundException('Silinecek kişi kaydı bulunamadı');
      }

      if (removeIndex === 0) {
        throw new BadRequestException('Ana başvuru sahibi bu alandan silinemez');
      }

      const removedApplicant = application.onboardingApplicants[removeIndex];
      const removedApplicantIndex = removeIndex + 1;

      await tx.onboardingApplicant.delete({
        where: { id: removedApplicant.id },
      });

      const deletedDetails = await tx.visaApplicationDetails.deleteMany({
        where: {
          applicationId,
          applicantIndex: removedApplicantIndex,
        },
      });

      const detailsToShift = await tx.visaApplicationDetails.findMany({
        where: {
          applicationId,
          applicantIndex: { gt: removedApplicantIndex },
        },
        orderBy: { applicantIndex: 'asc' },
        select: { id: true, applicantIndex: true },
      });

      for (const detail of detailsToShift) {
        await tx.visaApplicationDetails.update({
          where: { id: detail.id },
          data: { applicantIndex: detail.applicantIndex - 1 },
        });
      }

      await tx.auditLog.create({
        data: {
          application: { connect: { id: applicationId } },
          performedBy: { connect: { id: actor.userId } },
          actionType: 'APPLICANT_REMOVED',
          details: {
            removedApplicantId: removedApplicant.id,
            removedApplicantName: removedApplicant.fullName,
            removedApplicantIndex,
            beforeApplicantCount: currentApplicantCount,
            afterApplicantCount: currentApplicantCount - 1,
            removedDetailRows: deletedDetails.count,
            shiftedDetailRows: detailsToShift.length,
          },
        },
      });

      return {
        applicationId,
        removedApplicantId: removedApplicant.id,
        applicantCount: currentApplicantCount - 1,
      };
    });
  }

  /**
   * Hard-deletes a user with relation cleanup to avoid FK failures.
   * CUSTOMER deletion also clears owned applications and dependent rows.
   */
  async deleteUser(id: string, actor: AuthenticatedUser) {
    if (id === actor.userId) {
      throw new BadRequestException('Kendi hesabınızı silemezsiniz');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          staffProfile: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`Kullanıcı bulunamadı: ${id}`);
      }

      let deletedApplications = 0;

      if (user.role === Role.CUSTOMER) {
        const customerApplications = await tx.visaApplication.findMany({
          where: { customerId: user.id },
          select: { id: true },
        });

        const applicationIds = customerApplications.map((application) => application.id);
        deletedApplications = applicationIds.length;

        if (applicationIds.length > 0) {
          await tx.document.deleteMany({
            where: { applicationId: { in: applicationIds } },
          });

          await tx.auditLog.deleteMany({
            where: { applicationId: { in: applicationIds } },
          });

          await tx.visaApplication.deleteMany({
            where: { id: { in: applicationIds } },
          });
        }
      }

      if (user.staffProfile) {
        await Promise.all([
          tx.visaApplication.updateMany({
            where: { assignedSalesId: user.staffProfile.id },
            data: { assignedSalesId: null },
          }),
          tx.visaApplication.updateMany({
            where: { assignedDocId: user.staffProfile.id },
            data: { assignedDocId: null },
          }),
          tx.visaApplication.updateMany({
            where: { assignedSecId: user.staffProfile.id },
            data: { assignedSecId: null },
          }),
          tx.visaApplication.updateMany({
            where: { salesStaffId: user.staffProfile.id },
            data: { salesStaffId: null },
          }),
        ]);

        await tx.staff.delete({ where: { id: user.staffProfile.id } });
      }

      await tx.applicationDocAssistantItem.updateMany({
        where: { updatedById: user.id },
        data: { updatedById: null },
      });

      await tx.message.deleteMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
      });

      await tx.document.deleteMany({
        where: { uploadedById: user.id },
      });

      await tx.auditLog.deleteMany({
        where: { performedById: user.id },
      });

      await tx.user.delete({ where: { id: user.id } });

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        deletedApplications,
        deleted: true,
      };
    });
  }

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
          orderBy: {
            applicantIndex: 'asc',
          },
          take: 1,
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

      const primaryDetails = application.details[0] ?? null;

      const firstName = primaryDetails?.firstName ?? fallbackFirstName;
      const lastName = primaryDetails?.lastName ?? fallbackLastName;

      return {
        applicationId: application.id,
        createdAt: application.createdAt.toISOString(),
        applicationType: application.applicationType,
        firstName,
        lastName,
        phone: primaryDetails?.phone ?? application.customer.phone ?? '',
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

    const staffByUserId = new Map(
      staff.map((member) => [member.user.id, member]),
    );
    const activityLogs =
      staffByUserId.size > 0
        ? await this.prisma.auditLog.findMany({
            where: {
              actionType: {
                in: ['CLAIMED', 'STAGE_CHANGED'],
              },
              performedById: {
                in: Array.from(staffByUserId.keys()),
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              applicationId: true,
              performedById: true,
              actionType: true,
              details: true,
              createdAt: true,
              application: {
                select: {
                  customer: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          })
        : [];

    const staffActivityEvents = activityLogs
      .map((log) => {
        const member = staffByUserId.get(log.performedById);
        if (!member) {
          return null;
        }

        return {
          staffId: member.id,
          userId: member.user.id,
          staffName: member.user.fullName,
          department: member.department,
          applicationId: log.applicationId,
          customerName: log.application.customer.fullName,
          actionType: log.actionType,
          stageFrom: readDetailStage(log.details, 'previousStage'),
          stageTo: readDetailStage(log.details, 'newStage'),
          happenedAt: log.createdAt.toISOString(),
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event));

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
      staffActivityEvents,
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
