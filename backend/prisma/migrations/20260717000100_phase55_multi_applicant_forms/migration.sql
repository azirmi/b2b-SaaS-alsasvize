-- Phase 55: Support per-applicant application forms (1 application -> N forms)

ALTER TABLE "visa_application_details"
  ADD COLUMN "applicantIndex" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "visa_application_details"
  ALTER COLUMN "applicantIndex" DROP DEFAULT;

ALTER TABLE "visa_application_details"
  DROP CONSTRAINT "visa_application_details_applicationId_key";

CREATE UNIQUE INDEX "visa_application_details_applicationId_applicantIndex_key"
  ON "visa_application_details"("applicationId", "applicantIndex");

CREATE INDEX "visa_application_details_applicationId_idx"
  ON "visa_application_details"("applicationId");
