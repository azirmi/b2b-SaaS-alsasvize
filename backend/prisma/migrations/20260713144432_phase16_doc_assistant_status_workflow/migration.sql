-- CreateEnum
CREATE TYPE "DocAssistantDocumentType" AS ENUM ('BASVURU_FORMU_KONTROLU', 'VIZE_DILEKCESI_NIYET_YAZISI', 'SEYAHAT_PLANI', 'UCAK_REZERVASYONU', 'OTEL_KONAKLAMA_REZERVASYONU', 'SEYAHAT_SAGLIK_SIGORTASI', 'SPONSORLUK_YAZISI', 'EK_TURISTIK_DESTEK_BELGELERI', 'RANDEVU_ONAYI', 'BASVURU_TESLIM_FORMU', 'VIZE_HARCI_SERVIS_BEDELI_DEKONTU', 'KALAN_ODEME_DEKONTU', 'VIZE_SONUC_BELGESI', 'PASAPORT_TESLIM_IADE_BELGESI', 'RET_KARARI_RET_MEKTUBU', 'DIGER_EK_OPERASYON_BELGESI');

-- CreateEnum
CREATE TYPE "DocAssistantConstraintLabel" AS ENUM ('ZORUNLU', 'OPSIYONEL', 'SARTLI', 'SARTLI_ZORUNLU', 'KONTROL', 'SUREC_SONU');

-- CreateEnum
CREATE TYPE "DocAssistantDocumentStatus" AS ENUM ('HAZIRLANACAK', 'HAZIRLANIYOR', 'KONTROL_EDILECEK', 'YUKLENDI', 'REVIZE_GEREKLI', 'DOSYAYA_EKLENDI', 'KALAN_ODEME_BEKLENIYOR', 'TESLIME_HAZIR');

-- CreateTable
CREATE TABLE "application_doc_assistant_items" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" "DocAssistantDocumentType" NOT NULL,
    "constraintLabel" "DocAssistantConstraintLabel" NOT NULL,
    "status" "DocAssistantDocumentStatus" NOT NULL DEFAULT 'HAZIRLANACAK',
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_doc_assistant_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_doc_assistant_items_applicationId_idx" ON "application_doc_assistant_items"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_doc_assistant_items_applicationId_type_key" ON "application_doc_assistant_items"("applicationId", "type");

-- AddForeignKey
ALTER TABLE "application_doc_assistant_items" ADD CONSTRAINT "application_doc_assistant_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "visa_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_doc_assistant_items" ADD CONSTRAINT "application_doc_assistant_items_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
