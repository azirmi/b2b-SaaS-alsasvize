import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { FileType, OcrStatus, Role, VisaStage } from '../src/generated/prisma/enums';

/** The five seeded customers that should each receive a passport document. */
const CUSTOMER_EMAILS = [
  'cus1@test.com',
  'cus2@test.com',
  'cus3@test.com',
  'cus4@test.com',
  'cus5@test.com',
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Builds a clean, labelled placeholder passport (SVG) so it renders as an image. */
function buildPassportSvg(
  fullName: string,
  email: string,
  passportNo: string,
): string {
  const name = xmlEscape(fullName.toUpperCase());
  const mail = xmlEscape(email);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480" font-family="Arial, Helvetica, sans-serif">
  <rect width="720" height="480" fill="#f1f5f9"/>
  <rect x="24" y="24" width="672" height="432" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="24" y="24" width="672" height="72" fill="#0f172a"/>
  <text x="48" y="70" fill="#ffffff" font-size="30" font-weight="bold" letter-spacing="4">PASSPORT</text>
  <text x="672" y="66" fill="#94a3b8" font-size="16" text-anchor="end">SPECIMEN</text>
  <rect x="48" y="128" width="150" height="190" rx="8" fill="#e2e8f0" stroke="#cbd5e1"/>
  <text x="123" y="228" fill="#94a3b8" font-size="14" text-anchor="middle">PHOTO</text>
  <text x="232" y="150" fill="#64748b" font-size="13">Surname / Given names</text>
  <text x="232" y="182" fill="#0f172a" font-size="26" font-weight="bold">${name}</text>
  <text x="232" y="230" fill="#64748b" font-size="13">Passport No.</text>
  <text x="232" y="256" fill="#0f172a" font-size="20" font-family="monospace">${passportNo}</text>
  <text x="232" y="300" fill="#64748b" font-size="13">Email</text>
  <text x="232" y="324" fill="#0f172a" font-size="16" font-family="monospace">${mail}</text>
  <text x="48" y="392" fill="#64748b" font-size="12">Nationality</text>
  <text x="48" y="412" fill="#0f172a" font-size="16">Türkiye</text>
  <text x="48" y="440" fill="#94a3b8" font-size="11">Test document generated for development — not a real passport.</text>
</svg>`;
}

function passportNumber(): string {
  return `TR${Math.floor(10_000_000 + Math.random() * 90_000_000)}`;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Populate backend/.env first.');
  }

  const bucket = process.env.MINIO_BUCKET ?? 'visa-documents';
  const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
  const port = process.env.MINIO_PORT ?? '9000';
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('MINIO_ACCESS_KEY / MINIO_SECRET_KEY are not set.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const s3 = new S3Client({
    region: process.env.MINIO_REGION ?? 'us-east-1',
    endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    // Ensure the storage bucket exists (idempotent).
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    let created = 0;
    let skipped = 0;

    for (const email of CUSTOMER_EMAILS) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, fullName: true, role: true },
      });
      if (!user || user.role !== Role.CUSTOMER) {
        console.warn(`- skip ${email}: no matching customer account`);
        skipped += 1;
        continue;
      }

      // Reuse the customer's existing application, or open one in SALES_POOL.
      let application = await prisma.visaApplication.findFirst({
        where: { customerId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!application) {
        application = await prisma.visaApplication.create({
          data: {
            customer: { connect: { id: user.id } },
            currentStage: VisaStage.SALES_POOL,
            auditLogs: {
              create: {
                performedBy: { connect: { id: user.id } },
                actionType: 'CREATED',
                details: {
                  newStage: VisaStage.SALES_POOL,
                  createdByUserId: user.id,
                  seeded: true,
                },
              },
            },
          },
          select: { id: true },
        });
      }

      // Idempotent: don't add a second passport to the same application.
      const existingPassport = await prisma.document.findFirst({
        where: { applicationId: application.id, fileType: FileType.PASSPORT },
        select: { id: true },
      });
      if (existingPassport) {
        console.warn(`- skip ${email}: passport already exists`);
        skipped += 1;
        continue;
      }

      const key = `applications/${application.id}/${randomUUID()}-passport.svg`;
      const svg = buildPassportSvg(user.fullName, email, passportNumber());
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(svg, 'utf8'),
          ContentType: 'image/svg+xml',
        }),
      );

      await prisma.document.create({
        data: {
          application: { connect: { id: application.id } },
          uploadedBy: { connect: { id: user.id } },
          fileType: FileType.PASSPORT,
          fileUrl: key,
          isApproved: false,
          ocrStatus: OcrStatus.PENDING,
        },
      });

      console.log(`+ ${email} (${user.fullName}) → passport attached`);
      created += 1;
    }

    console.log(`Done — ${created} passport(s) created, ${skipped} skipped.`);
  } finally {
    await prisma.$disconnect();
    s3.destroy();
  }
}

main().catch((error) => {
  console.error('Passport seed failed:', error);
  process.exit(1);
});
