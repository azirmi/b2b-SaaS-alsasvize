/*
  Warnings:

  - The values [CRM_FORM,CONSULATE_DOC] on the enum `FileType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "FileType_new" AS ENUM ('PASSPORT', 'BANK_STATEMENT', 'INTENT_LETTER', 'CONSULATE_FORM', 'OTHER');
ALTER TABLE "documents" ALTER COLUMN "fileType" TYPE "FileType_new" USING ("fileType"::text::"FileType_new");
ALTER TYPE "FileType" RENAME TO "FileType_old";
ALTER TYPE "FileType_new" RENAME TO "FileType";
DROP TYPE "public"."FileType_old";
COMMIT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "ocrStatus" "OcrStatus";
