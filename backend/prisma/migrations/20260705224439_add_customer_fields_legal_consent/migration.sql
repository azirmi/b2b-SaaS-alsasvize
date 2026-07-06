-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hasAcceptedKVKK" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasAcceptedTerms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "targetCountry" TEXT;
