-- AlterTable
ALTER TABLE "application_crm_data" ADD COLUMN     "appointmentCity" TEXT,
ADD COLUMN     "appointmentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "appointmentCity" TEXT;

-- AlterTable
ALTER TABLE "visa_application_details" ALTER COLUMN "firstName" DROP DEFAULT,
ALTER COLUMN "lastName" DROP DEFAULT,
ALTER COLUMN "registeredAddress" DROP DEFAULT,
ALTER COLUMN "employmentStatus" DROP DEFAULT,
ALTER COLUMN "passportType" DROP DEFAULT,
ALTER COLUMN "passportIssuePlace" DROP DEFAULT,
ALTER COLUMN "appointmentLocation" DROP DEFAULT,
ALTER COLUMN "fingerprintGiven" DROP DEFAULT,
ALTER COLUMN "schengenAppliedBefore" DROP DEFAULT,
ALTER COLUMN "plannedTravelDates" DROP DEFAULT;
