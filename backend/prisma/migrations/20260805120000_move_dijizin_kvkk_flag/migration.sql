-- Move the Dijizin KVKK consent flag off ApplicationCrmData so it is independent
-- of the CRM row (Sales can confirm KVKK immediately, on any application/stage).
ALTER TABLE "visa_applications" ADD COLUMN "dijizinKvkkVerified" BOOLEAN NOT NULL DEFAULT false;

-- Preserve any already-verified state before dropping the old column.
UPDATE "visa_applications" v
SET "dijizinKvkkVerified" = true
FROM "application_crm_data" c
WHERE c."applicationId" = v."id" AND c."dijizinKvkkVerified" = true;

ALTER TABLE "application_crm_data" DROP COLUMN "dijizinKvkkVerified";
