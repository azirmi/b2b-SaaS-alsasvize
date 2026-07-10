-- CreateTable
CREATE TABLE "onboarding_applicants" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_applicants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "onboarding_applicants"
ADD CONSTRAINT "onboarding_applicants_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "visa_applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "visa_application_details"
ADD COLUMN "residenceCity" TEXT,
ADD COLUMN "plannedTravelStartDate" TEXT,
ADD COLUMN "plannedTravelEndDate" TEXT;

-- Backfill residence city from existing CRM data where available.
UPDATE "visa_application_details" AS vad
SET "residenceCity" = COALESCE(acd."residenceCity", 'Belirtilmedi')
FROM "visa_applications" AS va
LEFT JOIN "application_crm_data" AS acd ON acd."applicationId" = va."id"
WHERE va."id" = vad."applicationId";

-- Backfill travel date range from the legacy free-text field.
UPDATE "visa_application_details" AS vad
SET "plannedTravelStartDate" = COALESCE(
      (regexp_match(vad."plannedTravelDates", '([0-9]{4}-[0-9]{2}-[0-9]{2})'))[1],
      to_char(CURRENT_DATE, 'YYYY-MM-DD')
    );

UPDATE "visa_application_details" AS vad
SET "plannedTravelEndDate" = COALESCE(
      (regexp_match(vad."plannedTravelDates", '([0-9]{4}-[0-9]{2}-[0-9]{2})[^0-9]+([0-9]{4}-[0-9]{2}-[0-9]{2})'))[2],
      vad."plannedTravelStartDate"
    );

-- Enforce the new required columns.
ALTER TABLE "visa_application_details"
ALTER COLUMN "residenceCity" SET NOT NULL,
ALTER COLUMN "plannedTravelStartDate" SET NOT NULL,
ALTER COLUMN "plannedTravelEndDate" SET NOT NULL;

-- Remove legacy travel free-text storage.
ALTER TABLE "visa_application_details"
DROP COLUMN "plannedTravelDates";

-- Residence city is now owned by customer application details.
ALTER TABLE "application_crm_data"
DROP COLUMN "residenceCity";
