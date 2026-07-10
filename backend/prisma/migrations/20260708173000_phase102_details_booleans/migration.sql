-- AlterTable
ALTER TABLE "visa_application_details"
ADD COLUMN "isEmployer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasSponsor" BOOLEAN NOT NULL DEFAULT false;
