-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "docAssistantType" "DocAssistantDocumentType";

-- AlterTable
ALTER TABLE "visa_applications" ADD COLUMN     "deliveredToCustomerAt" TIMESTAMP(3),
ADD COLUMN     "deliveredToCustomerFiles" JSONB,
ADD COLUMN     "isDeliveredToCustomer" BOOLEAN NOT NULL DEFAULT false;
