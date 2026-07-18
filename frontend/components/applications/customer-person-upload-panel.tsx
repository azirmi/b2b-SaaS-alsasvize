"use client";

import {
  PersonBasedUploadSection,
  type PersonBasedUploadApplicant,
} from "@/components/applications/person-based-upload-section";
import {
  DocumentUploader,
  type UploadDocumentOption,
} from "@/components/documents/document-uploader";
import { FileType } from "@/lib/enums";

export function CustomerPersonUploadPanel({
  applicationId,
  applicants,
  allowedTypes,
  optionalTypes,
  documentOptions,
}: {
  applicationId: string;
  applicants: PersonBasedUploadApplicant[];
  allowedTypes: FileType[];
  optionalTypes: FileType[];
  documentOptions: UploadDocumentOption[];
}) {
  return (
    <PersonBasedUploadSection
      title="Belgelerinizi Kontrol İçin Yükleyin"
      description="Kişi sekmeleri arasında geçiş yaparak pasaport ve evrak yükleme alanını yönetin."
      applicants={applicants}
      renderContent={({ activeApplicant }) => {
        const scopedOptions = documentOptions.map((option) => ({
          ...option,
          id: `${activeApplicant.id}-${option.id}`,
          label: `${activeApplicant.name} · ${option.label}`,
        }));

        return (
          <DocumentUploader
            key={activeApplicant.id}
            applicationId={applicationId}
            defaultType={FileType.PASSPORT}
            allowedTypes={allowedTypes}
            optionalTypes={optionalTypes}
            documentOptions={scopedOptions}
          />
        );
      }}
    />
  );
}
