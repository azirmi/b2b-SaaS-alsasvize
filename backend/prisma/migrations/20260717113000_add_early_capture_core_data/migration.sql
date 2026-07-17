ALTER TABLE "visa_applications"
ADD COLUMN IF NOT EXISTS "residenceCity" TEXT,
ADD COLUMN IF NOT EXISTS "plannedTravelDate" TIMESTAMP(3);
