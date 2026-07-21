"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

interface MissingFormItem {
  applicantIndex: number;
  applicantLabel: string;
  applicantFullName: string | null;
}

export function CustomerFormStatusCard({
  applicationId,
  requiredFormCount,
  submittedFormCount,
  missingForms,
}: {
  applicationId: string;
  requiredFormCount: number;
  submittedFormCount: number;
  missingForms: MissingFormItem[];
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  if (missingForms.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">Başvuru formunuz oluşturulmuştur.</p>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                Tüm kişi formları kaydedildi ({submittedFormCount}/{requiredFormCount}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-emerald-900/70 transition-colors hover:text-emerald-950 dark:text-emerald-100/80 dark:hover:text-emerald-100"
            aria-label="Form durum kartını kapat"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium">Doldurulmamış başvuru bölümleri var.</p>
            <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
              {submittedFormCount}/{requiredFormCount} kişi formu tamamlandı. Eksik olan forma gidip kaydedin.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-900/70 transition-colors hover:text-amber-950 dark:text-amber-100/80 dark:hover:text-amber-100"
          aria-label="Form durum kartını kapat"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {missingForms.map((item) => (
          <Link
            key={item.applicantIndex}
            href={`/dashboard/applications/${applicationId}?view=form&applicant=${item.applicantIndex}`}
            className="rounded-md border border-amber-300/70 bg-amber-100/60 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-amber-200/80 dark:border-amber-400/40 dark:bg-amber-900/40 dark:hover:bg-amber-800/50"
          >
            {item.applicantIndex}. Kişi: {item.applicantFullName ?? item.applicantLabel}
          </Link>
        ))}
      </div>
    </div>
  );
}
