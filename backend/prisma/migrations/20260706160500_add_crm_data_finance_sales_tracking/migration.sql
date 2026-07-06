-- AlterTable: track the sales rep who processed each application (history)
ALTER TABLE "visa_applications" ADD COLUMN "salesStaffId" UUID;

-- Backfill historical tracking from the currently-assigned sales staff
UPDATE "visa_applications"
SET "salesStaffId" = "assignedSalesId"
WHERE "assignedSalesId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "visa_applications"
ADD CONSTRAINT "visa_applications_salesStaffId_fkey"
FOREIGN KEY ("salesStaffId") REFERENCES "staff"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: dedicated Sales CRM + finance record (replaces metadata.crm JSON)
CREATE TABLE "application_crm_data" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "salesDate" TIMESTAMP(3) NOT NULL,
    "residenceCity" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "upfrontPaid" DOUBLE PRECISION,
    "receiptFileId" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_crm_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_crm_data_applicationId_key" ON "application_crm_data"("applicationId");

-- AddForeignKey
ALTER TABLE "application_crm_data"
ADD CONSTRAINT "application_crm_data_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "visa_applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
