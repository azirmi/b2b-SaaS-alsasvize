-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('TOURISTIC', 'COMMERCIAL', 'FAMILY_VISIT', 'EDUCATION', 'OTHER');

-- AlterEnum
ALTER TYPE "FileType" ADD VALUE 'VISA_FEE_RECEIPT';

-- AlterTable
ALTER TABLE "application_crm_data" ADD COLUMN     "appointmentNote" TEXT,
ADD COLUMN     "hasVisaFee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visaFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "visaFeeReceiptDocumentId" UUID;

-- AlterTable
ALTER TABLE "visa_applications" ADD COLUMN     "applicationType" "ApplicationType" NOT NULL DEFAULT 'TOURISTIC';
