"use client";

import { DocAssistantDashboard } from "@/components/applications/doc-assistant-dashboard";
import {
  PersonBasedUploadSection,
  type PersonBasedUploadApplicant,
} from "@/components/applications/person-based-upload-section";
import type { DocAssistantItem } from "@/lib/types";

export function DocPersonUploadPanel({
  applicationId,
  applicants,
  items,
  canEdit,
}: {
  applicationId: string;
  applicants: PersonBasedUploadApplicant[];
  items: DocAssistantItem[];
  canEdit: boolean;
}) {
  return (
    <PersonBasedUploadSection
      title="Personel Yüklemeleri"
      description="Kişi sekmeleri arasında geçiş yaparak dosya asistanı yükleme kartlarını yönetin."
      applicants={applicants}
      renderContent={({ activeApplicant }) => (
        <DocAssistantDashboard
          key={activeApplicant.id}
          applicationId={applicationId}
          items={items}
          canEdit={canEdit}
        />
      )}
    />
  );
}
