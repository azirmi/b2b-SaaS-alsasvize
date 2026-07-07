import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { Department, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateStaffDto } from './dto/create-staff.dto';

/** bcrypt cost factor. 12 is a solid production default. */
const BCRYPT_SALT_ROUNDS = 12;

/** Each staff department maps onto the matching user role. */
const DEPARTMENT_TO_ROLE: Record<Department, Role> = {
  [Department.SALES]: Role.SALES,
  [Department.DOC]: Role.DOC,
  [Department.SEC]: Role.SEC,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a staff member atomically: a USERS row (role derived from the
   * department) and the related STAFF row (isAvailable = true), in one
   * transaction so we never end up with a half-created staff member.
   */
  async createStaff(dto: CreateStaffDto) {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            fullName: dto.fullName,
            role: DEPARTMENT_TO_ROLE[dto.department],
          },
          omit: { password: true },
        });

        const staffProfile = await tx.staff.create({
          data: {
            userId: user.id,
            department: dto.department,
            isAvailable: true,
          },
        });

        return { ...user, staffProfile };
      });
    } catch (error) {
      this.rethrowKnownErrors(error);
    }
  }

  /** Creates a CUSTOMER account (no staff profile). */
  async createCustomer(dto: CreateCustomerDto) {
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          fullName: dto.fullName,
          role: Role.CUSTOMER,
        },
        omit: { password: true },
      });
    } catch (error) {
      this.rethrowKnownErrors(error);
    }
  }

  /** Soft-deletes a user by flipping `isActive` to false. */
  async deactivate(id: string) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        omit: { password: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Kullanıcı bulunamadı: ${id}`);
      }
      throw error;
    }
  }

  /** Lists every user with their staff profile (if any); passwords omitted. */
  findAll() {
    return this.prisma.user.findMany({
      omit: { password: true },
      include: { staffProfile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Maps a Prisma unique-constraint violation (P2002) to a 409 Conflict. */
  private rethrowKnownErrors(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Bu e-posta ile kayıtlı bir kullanıcı zaten var');
    }
    throw error;
  }
}
