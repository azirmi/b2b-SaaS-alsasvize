import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '../src/generated/prisma/client';
import { Department, Role } from '../src/generated/prisma/enums';

/** Shared plaintext password for every seeded account (hashed with bcrypt). */
const PASSWORD = 'asdasdasd123';
/** Matches the app's BCRYPT_SALT_ROUNDS (auth.service.ts / users module). */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Department staff. There is no "STAFF" role in the schema — an operator's
 * User.role IS their department role (SALES/DOC/SEC), and the Staff profile
 * carries the department used by the work-pool logic.
 */
const STAFF: {
  email: string;
  fullName: string;
  role: Role;
  department: Department;
}[] = [
  { email: 'sales1@test.com', fullName: 'sales1', role: Role.SALES, department: Department.SALES },
  { email: 'sales2@test.com', fullName: 'sales2', role: Role.SALES, department: Department.SALES },
  { email: 'doc1@test.com', fullName: 'doc1', role: Role.DOC, department: Department.DOC },
  { email: 'doc2@test.com', fullName: 'doc2', role: Role.DOC, department: Department.DOC },
  { email: 'sec1@test.com', fullName: 'sec1', role: Role.SEC, department: Department.SEC },
  { email: 'sec2@test.com', fullName: 'sec2', role: Role.SEC, department: Department.SEC },
];

const ADMINS: { email: string; fullName: string }[] = [
  { email: 'admin1@test.com', fullName: 'admin1' },
  { email: 'admin2@test.com', fullName: 'admin2' },
];

const CUSTOMERS: { email: string; fullName: string }[] = [
  { email: 'cus1@test.com', fullName: 'batuhan mutlu' },
  { email: 'cus2@test.com', fullName: 'tunahan albayrak' },
  { email: 'cus3@test.com', fullName: 'bilal kose' },
  { email: 'cus4@test.com', fullName: 'berkay ocal' },
  { email: 'cus5@test.com', fullName: 'tughan sungu' },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env before seeding.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Clean slate — delete children before parents to satisfy foreign keys.
    await prisma.auditLog.deleteMany();
    await prisma.document.deleteMany();
    await prisma.visaApplication.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.user.deleteMany();

    // 2. One shared bcrypt hash for every seeded account.
    const password = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

    // 3. Staff: department role on the User + a Staff profile with the department.
    for (const member of STAFF) {
      await prisma.user.create({
        data: {
          email: member.email,
          fullName: member.fullName,
          password,
          role: member.role,
          staffProfile: { create: { department: member.department } },
        },
      });
    }

    // 4. Admins (God Mode — no Staff profile, so they are never assignable).
    for (const admin of ADMINS) {
      await prisma.user.create({
        data: {
          email: admin.email,
          fullName: admin.fullName,
          password,
          role: Role.ADMIN,
        },
      });
    }

    // 5. Customers.
    for (const customer of CUSTOMERS) {
      await prisma.user.create({
        data: {
          email: customer.email,
          fullName: customer.fullName,
          password,
          role: Role.CUSTOMER,
        },
      });
    }

    console.log(
      `Seed complete — ${STAFF.length} staff, ${ADMINS.length} admins, ` +
        `${CUSTOMERS.length} customers (${STAFF.length + ADMINS.length + CUSTOMERS.length} users). ` +
        `Every account password: ${PASSWORD}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
